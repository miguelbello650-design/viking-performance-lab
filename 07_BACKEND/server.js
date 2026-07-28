const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const db = require('./db');
const { parseFit } = require('./fit');

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^"(.*)"$/, '$1');
  }
}
const PORT = Number(process.env.PORT || 8766);
const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, '08_FRONTEND', 'index.html');
const UPLOADS = path.join(ROOT, '09_DATOS_PRUEBA', 'importados');
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.fit', '.fit.gz', '.gpx', '.tcx', '.csv'];
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-terra';
const ASSISTANT_SYSTEM_PROMPT = [
  'Eres el asistente de análisis deportivo de Viking Performance Lab, una plataforma de inteligencia deportiva para entrenadores y atletas de deportes de resistencia.',
  'Actúas como un analista deportivo experto en trail running, running de asfalto y ciclismo. Estás conversando con un entrenador profesional. Comunícate en español, con lenguaje claro, preciso y técnico cuando sea útil.',
  'Analiza exclusivamente la información observada que recibas en el contexto: entrenamientos, carreras, atletas, disciplinas, rutas y datos normalizados.',
  'Distingue siempre dato observado, cálculo, interpretación, hipótesis y recomendación.',
  'Nunca inventes métricas, valores, clima, nutrición, lesiones, sensaciones, zonas, cargas o causas que no estén en el contexto.',
  'Si falta información, dilo explícitamente. No uses umbrales universales ni presentes una comparación como mejora o deterioro sin contexto suficiente.',
  'Mantén separadas las reglas comunes multideporte de las reglas específicas de trail running, running de asfalto y ciclismo.',
  'No diagnostiques fatiga, enfermedad, lesión ni estado médico. No ordenes modificar un plan; cualquier recomendación es una propuesta sujeta a revisión del entrenador.',
  'No rechaces una pregunta solo porque no exista una regla analítica específica. Responde con la evidencia disponible o declara insuficiencia.',
  'Responde primero de forma directa y luego separa evidencia, cálculos, interpretación, hipótesis, limitaciones y recomendación cuando corresponda.',
  'Devuelve únicamente JSON válido con las claves answer, interpretation, hypothesis, recommendation y limitation.'
].join(' ');

function json(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length });
  res.end(body);
}

function readMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES) { reject(new Error('El archivo supera el límite permitido.')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const match = /boundary=([^;]+)/i.exec(req.headers['content-type'] || '');
      if (!match) return reject(new Error('La carga debe usar multipart/form-data.'));
      const boundary = Buffer.from(`--${match[1].replace(/^"|"$/g, '')}`);
      const fields = {};
      for (const part of Buffer.concat(chunks).toString('binary').split(boundary.toString('binary')).slice(1, -1)) {
        const raw = Buffer.from(part, 'binary');
        const headerEnd = raw.indexOf(Buffer.from('\r\n\r\n'));
        if (headerEnd < 0) continue;
        const headers = raw.subarray(0, headerEnd).toString();
        let content = raw.subarray(headerEnd + 4);
        if (content.subarray(-2).toString() === '\r\n') content = content.subarray(0, -2);
        const disposition = /name="([^"]+)"(?:; filename="([^"]*)")?/i.exec(headers);
        if (!disposition) continue;
        fields[disposition[1]] = disposition[2] ? { filename: disposition[2], content } : content.toString('utf8');
      }
      resolve(fields);
    });
    req.on('error', reject);
  });
}

function safeFilename(name) { return path.basename(name).replace(/[^A-Za-z0-9._-]+/g, '_') || 'archivo'; }
function extensionOf(name) { const lower = name.toLowerCase(); return ALLOWED_EXTENSIONS.find(ext => lower.endsWith(ext)) || ''; }

function inspectFile(filename, content) {
  const lower = filename.toLowerCase();
  if (!lower.endsWith('.fit') && !lower.endsWith('.fit.gz')) return { fileFormat: extensionOf(filename).slice(1).toUpperCase(), rawSize: content.length, status: 'pending', warnings: ['La validación específica de este formato queda pendiente.'], observed: {} };
  let fit;
  try { fit = lower.endsWith('.fit.gz') ? zlib.gunzipSync(content) : content; }
  catch (error) { return { fileFormat: 'FIT.gz', rawSize: content.length, status: 'rejected', warnings: [`Compresión gzip inválida: ${error.message}`], observed: {} }; }
  const warnings = [];
  const headerSize = fit.length >= 1 ? fit[0] : 0;
  const dataSize = fit.length >= 8 ? fit.readUInt32LE(4) : 0;
  const signature = fit.length >= 12 ? fit.subarray(8, 12).toString('ascii') : '';
  if (![12, 14].includes(headerSize)) warnings.push('El encabezado FIT no usa un tamaño estándar de 12 o 14 bytes.');
  if (signature !== '.FIT') warnings.push('No se encontró la firma FIT esperada.');
  if (fit.length < headerSize + dataSize) warnings.push('El archivo FIT está incompleto según su encabezado.');
  let messages = [];
  if (!warnings.length) {
    try { messages = parseFit(fit); }
    catch (error) { warnings.push(`No se pudieron extraer los mensajes FIT: ${error.message}`); }
  }
  const messageCounts = messages.reduce((counts, message) => { counts[message.type] = (counts[message.type] || 0) + 1; return counts; }, {});
  return { fileFormat: lower.endsWith('.fit.gz') ? 'FIT.gz' : 'FIT', rawSize: content.length, fitSize: fit.length, headerSize, dataSize, status: warnings.length ? 'warning' : 'normalized', warnings, messages, observed: { signature, header_size: headerSize, data_size: dataSize, payload_complete: fit.length >= headerSize + dataSize, message_counts: messageCounts } };
}

function normalizePendingActivities() {
  for (const activity of [...db.listPendingActivities(), ...db.listActivitiesWithoutMessages()]) {
    try {
      const content = fs.readFileSync(path.resolve(ROOT, activity.stored_path));
      const result = inspectFile(activity.original_filename, content); db.recordNormalization(activity.id, result); if (result.messages) db.replaceMessages(activity.id, result.messages);
    } catch (error) { db.recordNormalization(activity.id, { fileFormat: 'unknown', rawSize: activity.file_size, status: 'warning', warnings: [`No se pudo leer el archivo conservado: ${error.message}`], observed: {} }); }
  }
}

async function importActivity(req, res) {
  try {
    const fields = await readMultipart(req);
    const athlete = String(fields.athlete || '').trim();
    const sport = String(fields.sport || '').trim();
    const kind = String(fields.kind || '').trim();
    const uploaded = fields.file;
    if (!athlete || !sport || !['Entrenamiento', 'Carrera'].includes(kind) || !uploaded?.filename) return json(res, 400, { error: 'Completa atleta, disciplina, tipo y archivo.' });
    const extension = extensionOf(uploaded.filename);
    if (!extension) return json(res, 400, { error: 'Formato no permitido. Usa FIT, FIT.gz, GPX, TCX o CSV.' });
    const normalization = inspectFile(uploaded.filename, uploaded.content);
    if (normalization.status === 'rejected') return json(res, 400, { error: normalization.warnings.join(' ') });
    const athleteRow = db.findAthlete(athlete);
    if (!athleteRow) return json(res, 400, { error: 'El atleta no existe en el espacio actual.' });
    const sha256 = crypto.createHash('sha256').update(uploaded.content).digest('hex');
    const duplicate = db.findDuplicate(sha256);
    if (duplicate) return json(res, 409, { error: 'Este archivo ya fue importado.', activity_id: duplicate.id, filename: duplicate.original_filename });
    fs.mkdirSync(UPLOADS, { recursive: true });
    const activityId = db.insertActivity({ athleteId: athleteRow.id, sport, kind, filename: uploaded.filename, extension, size: uploaded.content.length, sha256 });
    const storedName = `activity-${activityId}-${safeFilename(uploaded.filename)}`;
    const storedPath = path.join(UPLOADS, storedName);
    try {
      fs.writeFileSync(storedPath, uploaded.content);
      db.setStoredPath(activityId, path.relative(ROOT, storedPath));
      db.recordNormalization(activityId, normalization);
      if (normalization.messages) db.replaceMessages(activityId, normalization.messages);
    } catch (error) {
      db.deleteActivity(activityId);
      throw error;
    }
    json(res, 201, { activity_id: activityId, filename: uploaded.filename, status: 'accepted', normalization_status: 'pending' });
  } catch (error) { json(res, 500, { error: `No se pudo registrar el archivo: ${error.message}` }); }
}

function coachQuery(query) {
  const text = String(query || '').trim();
  const lower = text.toLocaleLowerCase('es');
  if (!text) return { status: 400, body: { error: 'Escribe una pregunta.' } };
  if (/(actividad.*(m[aá]s larga|mayor duraci[oó]n)|mayor duraci[oó]n)/.test(lower)) {
    const activities = db.compareActivities('Miguel Bello', 4);
    const longest = activities.reduce((best, item) => Number(item.observed.duration_seconds?.value || 0) > Number(best?.observed.duration_seconds?.value || 0) ? item : best, null);
    return { status: 200, body: {
      query: text,
      type: 'longest_activity',
      answer: longest
        ? 'La actividad más larga fue ' + longest.filename + ', con ' + longest.observed.duration_seconds.value + ' segundos observados.'
        : 'No encontré actividades normalizadas con duración observada.',
      evidence: longest ? [longest] : [],
      calculations: longest ? { selected_by: 'max(duration_seconds)', duration_seconds: longest.observed.duration_seconds.value } : {},
      interpretation: null,
      hypothesis: null,
      recommendation: null,
      limitation: 'El resultado es descriptivo; no representa por sí solo una evaluación de rendimiento o fatiga.',
      coach_review_required: true
    } };
  }
  if (/(eficiencia|aer[oó]bica|misma velocidad|frecuencia cardiaca|\\bfc\\b)/.test(lower)) {
    const activities = db.compareActivities('Miguel Bello', 4);
    const latest = activities[activities.length - 1];
    const previous = activities[activities.length - 2];
    const required = ['average_speed_mps', 'average_heart_rate_bpm'];
    const missing = required.filter(key => !latest?.observed[key] || !previous?.observed[key]);
    const enough = activities.length >= 2 && missing.length === 0;
    return { status: 200, body: {
      query: text,
      type: 'aerobic_efficiency_check',
      rule: 'aerobic-efficiency-v1',
      answer: enough
        ? 'Existe evidencia mínima para revisar conjuntamente velocidad media y frecuencia cardiaca.'
        : 'No concluyente: no existe evidencia suficiente para revisar eficiencia aeróbica.',
      evidence: activities,
      missing_fields: missing,
      calculations: enough ? {
        latest_vs_previous: {
          average_speed_mps: latest.observed.average_speed_mps.value - previous.observed.average_speed_mps.value,
          average_heart_rate_bpm: latest.observed.average_heart_rate_bpm.value - previous.observed.average_heart_rate_bpm.value
        }
      } : {},
      interpretation: enough
        ? 'Los campos requeridos están disponibles para una comparación conjunta; esto no demuestra una mejora de eficiencia.'
        : 'La velocidad media o la frecuencia cardiaca media no están disponibles en ambas actividades.',
      hypothesis: enough
        ? 'La variación observada podría merecer revisión con el contexto de disciplina, duración y desnivel.'
        : null,
      recommendation: null,
      limitation: 'No se usan umbrales universales ni se presenta una conclusión deportiva sin contexto comparable.',
      coach_review_required: true
    } };
  }
  if (/(disponible|historial|cu[aá]ntas)/.test(lower)) {
    const activities = db.listActivities();
    return { status: 200, body: {
      query: text,
      type: 'activity_inventory',
      answer: 'Hay ' + activities.length + ' actividad(es) registrada(s) en el historial local.',
      evidence: activities,
      interpretation: null,
      recommendation: null,
      coach_review_required: true
    } };
  }
  if (/(comp[aá]r|fondos|actividades)/.test(lower)) {
    const activities = db.compareActivities('Miguel Bello', 4);
    const latest = activities[activities.length - 1];
    const previous = activities[activities.length - 2];
    const comparable = latest && previous
      ? ['duration_seconds', 'distance_m', 'ascent_m', 'average_heart_rate_bpm'].every(key => latest.observed[key] && previous.observed[key])
      : false;
    return { status: 200, body: {
      query: text,
      type: 'observed_comparison',
      answer: activities.length < 2
        ? 'Todavía no hay suficientes actividades normalizadas para comparar.'
        : 'Encontré ' + activities.length + ' actividades normalizadas de Miguel Bello. La respuesta se limita a datos observados y cálculos reproducibles.',
      evidence: activities,
      rule: 'comparison-context-v1',
      calculations: latest && previous ? {
        latest_vs_previous: {
          duration_seconds: latest.observed.duration_seconds && previous.observed.duration_seconds ? latest.observed.duration_seconds.value - previous.observed.duration_seconds.value : null,
          distance_m: latest.observed.distance_m && previous.observed.distance_m ? latest.observed.distance_m.value - previous.observed.distance_m.value : null,
          ascent_m: latest.observed.ascent_m && previous.observed.ascent_m ? latest.observed.ascent_m.value - previous.observed.ascent_m.value : null,
          average_heart_rate_bpm: latest.observed.average_heart_rate_bpm && previous.observed.average_heart_rate_bpm ? latest.observed.average_heart_rate_bpm.value - previous.observed.average_heart_rate_bpm.value : null
        }
      } : {},
      interpretation: comparable
        ? 'La actividad mas reciente y la anterior contienen los campos minimos para una comparacion contextual; esto no demuestra una mejora o perdida de rendimiento.'
        : 'No concluyente: faltan campos observados para aplicar la comparacion contextual.',
      hypothesis: comparable
        ? 'La diferencia observada podria responder a objetivos o contextos distintos de sesion; requiere revision del entrenador.'
        : null,
      recommendation: null,
      coach_review_required: true
    } };
  }
  return { status: 200, body: {
    query: text,
    type: 'not_yet_supported',
    answer: 'Esta pregunta todavía no tiene una regla analítica aprobada en el MVP.',
    evidence: [],
    interpretation: null,
    recommendation: null,
    limitation: 'No se generan fatiga, rendimiento, predicciones ni recomendaciones sin reglas y datos aprobados.',
    coach_review_required: true
  } };
}

function extractOpenAIText(result) {
  if (result.output_text) return result.output_text;
  return (result.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n');
}

async function assistantQuery(query, history = []) {
  const activities = db.compareActivities('Miguel Bello', 20);
  const unavailable = reason => ({ status: 200, body: {
    query,
    type: 'provider_unavailable',
    answer: 'El chat de IA no está disponible en este momento.',
    evidence: activities,
    interpretation: null,
    hypothesis: null,
    recommendation: null,
    limitation: reason,
    provider: 'unavailable',
    coach_review_required: true
  } });
  if (!OPENAI_API_KEY) return unavailable('Configura OPENAI_API_KEY en el backend para activar el chat generativo.');
  const context = JSON.stringify({ athlete: 'Miguel Bello', activities });
  const payload = {
    model: OPENAI_MODEL,
    instructions: ASSISTANT_SYSTEM_PROMPT + ' Responde directamente la pregunta usando el contexto JSON y el historial de conversación.',
    input: JSON.stringify({ question: String(query || ''), conversation_history: Array.isArray(history) ? history.slice(-10) : [], observed_context: JSON.parse(context) }),
    store: false
  };
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + OPENAI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || 'OpenAI no pudo responder.');
    const raw = extractOpenAIText(result);
    let generated;
    try { generated = JSON.parse(raw); } catch { generated = { answer: raw, interpretation: null, hypothesis: null, recommendation: null, limitation: 'La salida del modelo no llegó en JSON estructurado.' }; }
    return { status: 200, body: { query, type: 'generated_grounded_answer', provider: 'openai', model: OPENAI_MODEL, ...generated, evidence: activities, coach_review_required: true } };
  } catch (error) { return unavailable('OpenAI no está disponible: ' + error.message); }
}

db.init();
normalizePendingActivities();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/api/activities') return json(res, 200, { activities: db.listActivities() });
  if (req.method === 'GET' && url.pathname === '/api/activities/compare') return json(res, 200, { athlete: url.searchParams.get('athlete') || 'Miguel Bello', activities: db.compareActivities(url.searchParams.get('athlete') || 'Miguel Bello', Number(url.searchParams.get('limit') || 4)) });
  const routeMatch = /^\/api\/activities\/(\d+)\/route$/.exec(url.pathname);
  if (req.method === 'GET' && routeMatch) return json(res, 200, db.getActivityRoute(Number(routeMatch[1])));
  const detailMatch = /^\/api\/activities\/(\d+)$/.exec(url.pathname);
  if (req.method === 'GET' && detailMatch) { const detail = db.getActivityDetail(Number(detailMatch[1])); return detail ? json(res, 200, detail) : json(res, 404, { error: 'Actividad no encontrada.' }); }
  if (req.method === 'POST' && url.pathname === '/api/coach/query') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const result = await assistantQuery(payload.query, payload.history);
      return json(res, result.status, result.body);
    } catch (error) { return json(res, 502, { error: 'No se pudo consultar el asistente: ' + error.message }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/import') return importActivity(req, res);
  if (req.method !== 'GET' || !['/', '/index.html'].includes(url.pathname)) return json(res, 404, { error: 'Not found' });
  const content = fs.readFileSync(FRONTEND);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': content.length, 'Cache-Control': 'no-store' });
  res.end(content);
});

server.listen(PORT, '127.0.0.1', () => console.log(`Viking Performance Lab: http://127.0.0.1:${PORT}`));
