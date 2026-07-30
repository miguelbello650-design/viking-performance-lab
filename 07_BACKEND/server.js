const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { parseFit } = require('./fit');

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^"(.*)"$/, '$1');
  }
}
const db = require('./db');
const PORT = Number(process.env.PORT || 8766);
// Render injects PORT; bind externally there while keeping local development private.
const HOST = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, '08_FRONTEND', 'index.html');
const UPLOADS = path.join(process.env.VPL_DATA_DIR || path.join(ROOT, '09_DATOS_PRUEBA'), 'importados');
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.fit', '.fit.gz', '.gpx', '.tcx', '.csv'];
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-terra';
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || '';
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET || '';
const STRAVA_REDIRECT_URI = process.env.STRAVA_REDIRECT_URI || 'http://localhost:8766/api/integrations/strava/callback';
const STRAVA_FRONTEND_REDIRECT = process.env.STRAVA_FRONTEND_REDIRECT || 'http://localhost:5173';
const STRAVA_TOKEN_KEY = process.env.STRAVA_TOKEN_KEY || '';
const STRAVA_API_BASE = 'https://www.strava.com/api/v3';
const STRAVA_OAUTH_BASE = 'https://www.strava.com/oauth';
const stravaOAuthStates = new Map();
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || 'http://localhost:8766,http://localhost:5173')
  .split(',').map(origin => origin.trim()).filter(Boolean);
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
  'Devuelve únicamente JSON válido con las claves answer, interpretation, hypothesis, recommendation, limitation, confidence y evidence_refs.',
  'En informes de actividad incluye calculations como arreglo de textos: solo cálculos derivados verificables (por ejemplo ritmo por segmento, variación porcentual o diferencia entre tramos) y, si faltan registros suficientes, indica que no es calculable. Las capas interpretation, hypothesis y recommendation deben ser texto, nunca objetos.',
  'Tu trabajo no es repetir el tablero. Conecta los datos y los cambios derivados para explicar qué ocurrió, por qué podría haber ocurrido y qué debería revisar el entrenador. Prioriza hallazgos accionables: salida, sostenimiento del esfuerzo, desaceleración, respuesta cardíaca, cadencia, ascensos, descensos y diferencias frente al historial. Cada afirmación debe citar o poder rastrearse a una evidencia o cálculo recibido.',
  'Usa los patrones aprendidos como contexto personal del atleta: los candidatos solo pueden expresarse como hipotesis y los confirmados pueden orientar una recomendacion, siempre sujetos a revision del entrenador.',
  'Usa la linea base historica solo como descripcion del historial recibido: informa cantidad de muestras, promedio y rango antes de comparar; no la conviertas en objetivo universal ni en diagnostico.',
  'confidence debe ser exactamente alta, media o limitada y reflejar la suficiencia real de los datos. evidence_refs debe ser un arreglo breve de referencias como segmento_1, historial_Run o sesion_actual. No cites fuentes que no estén en el contexto.',
].join(' ');

function json(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length });
  res.end(body);
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (!FRONTEND_ORIGINS.includes(origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return true;
}

function tokenCipherKey() {
  if (!STRAVA_TOKEN_KEY) throw new Error('STRAVA_TOKEN_KEY no está configurada.');
  return crypto.createHash('sha256').update(STRAVA_TOKEN_KEY).digest();
}
function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}
function decryptSecret(value) {
  const [ivText, tagText, encryptedText] = String(value).split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', tokenCipherKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8');
}
function redirectWithStravaResult(status, message) {
  const target = new URL(STRAVA_FRONTEND_REDIRECT);
  target.searchParams.set('strava', status);
  if (message) target.searchParams.set('message', message);
  return target.toString();
}
function jsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (error) { reject(error); } });
    req.on('error', reject);
  });
}
async function stravaRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text || '{}'); } catch { body = { raw: text }; }
  if (!response.ok) throw new Error(`Strava ${response.status}: ${body.message || body.raw || 'respuesta no válida'}`);
  return body;
}
function mapStravaSport(activity) {
  const type = String(activity.sport_type || activity.type || '').toLowerCase();
  if (type.includes('trail')) return 'TrailRun';
  if (type.includes('run')) return 'Run';
  if (type.includes('ride') || type.includes('bike') || type.includes('cycling')) return 'Ride';
  return 'Fuerza y/o movilidad';
}
function remapStoredStravaSports() {
  const rows = db.db.prepare(`SELECT a.id, m.fields_json
    FROM activities a JOIN activity_messages m ON m.activity_id = a.id
    WHERE a.source_provider = 'strava_api' AND m.message_type = 'session'`).all();
  const update = db.db.prepare('UPDATE activities SET sport = ? WHERE id = ?');
  for (const row of rows) {
    try {
      const fields = JSON.parse(row.fields_json || '{}');
      const sourceType = fields.sub_sport?.value || fields.sub_sport?.raw || fields.sport?.value || fields.sport?.raw;
      update.run(mapStravaSport({ sport_type: sourceType }), row.id);
    } catch { /* Ignore malformed legacy session data. */ }
  }
}
function mapStravaKind(activity) {
  return activity.workout_type === 1 || activity.race === true ? 'Carrera' : 'Entrenamiento';
}
function decodePolyline(encoded) {
  if (!encoded) return [];
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index < encoded.length);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index < encoded.length);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
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

function stravaStatus() {
  const connection = db.getStravaConnection('Miguel Bello');
  if (!connection) return { provider: 'strava', athlete: 'Miguel Bello', connected: false, granted_scopes: [], last_sync_at: null, sync_status: 'not_connected' };
  return { provider: 'strava', athlete: 'Miguel Bello', connected: connection.status === 'connected', granted_scopes: JSON.parse(connection.scopes_json || '[]'), last_sync_at: connection.last_sync_at, sync_status: connection.status };
}
function requireStravaConfig() {
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_TOKEN_KEY) throw new Error('Faltan STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET o STRAVA_TOKEN_KEY.');
}
function startStravaConnection(res) {
  requireStravaConfig();
  const state = crypto.randomBytes(24).toString('base64url');
  stravaOAuthStates.set(state, { createdAt: Date.now(), athlete: 'Miguel Bello' });
  const authorize = new URL(`${STRAVA_OAUTH_BASE}/authorize`);
  authorize.search = new URLSearchParams({ client_id: STRAVA_CLIENT_ID, redirect_uri: STRAVA_REDIRECT_URI, response_type: 'code', approval_prompt: 'auto', scope: 'activity:read_all', state }).toString();
  res.writeHead(302, { Location: authorize.toString(), 'Cache-Control': 'no-store' });
  res.end();
}
async function completeStravaConnection(url, res) {
  const state = url.searchParams.get('state');
  const stateData = state && stravaOAuthStates.get(state);
  if (!stateData || Date.now() - stateData.createdAt > 10 * 60 * 1000) return res.writeHead(302, { Location: redirectWithStravaResult('error', 'La autorización expiró.') }), res.end();
  stravaOAuthStates.delete(state);
  if (url.searchParams.get('error')) return res.writeHead(302, { Location: redirectWithStravaResult('denied', 'Miguel no autorizó el acceso.') }), res.end();
  try {
    requireStravaConfig();
    const token = await stravaRequest(`${STRAVA_OAUTH_BASE}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: STRAVA_CLIENT_ID, client_secret: STRAVA_CLIENT_SECRET, code: url.searchParams.get('code') || '', grant_type: 'authorization_code' }) });
    const athlete = db.findAthlete('Miguel Bello');
    db.saveStravaConnection({ athleteId: athlete.id, stravaAthleteId: token.athlete.id, accessToken: encryptSecret(token.access_token), refreshToken: encryptSecret(token.refresh_token), expiresAt: token.expires_at, scopes: String(token.scope || '').split(/[ ,]+/).filter(Boolean) });
    res.writeHead(302, { Location: redirectWithStravaResult('connected') });
    res.end();
  } catch (error) { res.writeHead(302, { Location: redirectWithStravaResult('error', error.message) }); res.end(); }
}
async function ensureStravaToken(connection) {
  const accessToken = decryptSecret(connection.access_token);
  if (Number(connection.expires_at) > Math.floor(Date.now() / 1000) + 3600) return accessToken;
  const refreshed = await stravaRequest(`${STRAVA_OAUTH_BASE}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: STRAVA_CLIENT_ID, client_secret: STRAVA_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: decryptSecret(connection.refresh_token) }) });
  db.updateStravaTokens('Miguel Bello', { accessToken: encryptSecret(refreshed.access_token), refreshToken: encryptSecret(refreshed.refresh_token), expiresAt: refreshed.expires_at });
  return refreshed.access_token;
}
async function syncStrava(mode = 'incremental') {
  requireStravaConfig();
  const connection = db.getStravaConnection('Miguel Bello');
  if (!connection) throw new Error('Strava no está conectado para Miguel Bello.');
  const accessToken = await ensureStravaToken(connection);
  const isFull = mode === 'full';
  const afterDate = mode === 'initial'
    ? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    : (connection.last_sync_at
      ? new Date(new Date(connection.last_sync_at).getTime() - 24 * 60 * 60 * 1000)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const after = Math.floor(afterDate.getTime() / 1000);
  let page = 1, received = 0, created = 0, updated = 0;
  const warnings = [];
  while (isFull || page <= 20) {
    const query = new URLSearchParams({ page: String(page), per_page: '100' });
    if (!isFull) query.set('after', String(after));
    const activities = await stravaRequest(`${STRAVA_API_BASE}/athlete/activities?${query}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!Array.isArray(activities) || !activities.length) break;
    for (const activity of activities) {
      received += 1;
      try {
        const fields = {
          start_time: activity.start_date,
          total_elapsed_time: activity.elapsed_time,
          total_timer_time: activity.moving_time,
          total_distance: activity.distance,
          avg_speed: activity.average_speed,
          max_speed: activity.max_speed,
          avg_heart_rate: activity.average_heartrate,
          max_heart_rate: activity.max_heartrate,
          avg_cadence: activity.average_cadence,
          avg_power: activity.average_watts,
          max_power: activity.max_watts,
          total_ascent: activity.total_elevation_gain,
          total_descent: null,
          name: activity.name,
          sport: mapStravaSport(activity),
          sub_sport: activity.sport_type || activity.type || null
        };
        const result = db.upsertStravaActivity({ athleteId: db.findAthlete('Miguel Bello').id, stravaActivityId: activity.id, name: activity.name, sport: mapStravaSport(activity), kind: mapStravaKind(activity), startDate: activity.start_date, fields, routePoints: decodePolyline(activity.map?.polyline || activity.map?.summary_polyline) });
        if (!db.hasActivityRecords(result.id)) {
          try {
            const streamQuery = new URLSearchParams({ keys: 'time,distance,altitude,velocity_smooth,heartrate,cadence,watts', key_by_type: 'true' });
            const streams = await stravaRequest(`${STRAVA_API_BASE}/activities/${activity.id}/streams?${streamQuery}`, { headers: { Authorization: `Bearer ${accessToken}` } });
            const recordsStored = db.replaceStravaStreams(result.id, streams, activity.start_date);
            if (!recordsStored) warnings.push(`Actividad ${activity.id}: Strava no devolvió streams detallados.`);
          } catch (streamError) { warnings.push(`Actividad ${activity.id}: streams no disponibles (${streamError.message}).`); }
        }
        if (result.created) created += 1; else updated += 1;
      } catch (error) { warnings.push(`Actividad ${activity.id}: ${error.message}`); }
    }
    if (activities.length < 100) break;
    page += 1;
  }
  const syncedAt = new Date().toISOString();
  db.setStravaSyncAt('Miguel Bello', syncedAt);
  return { provider: 'strava', athlete: 'Miguel Bello', mode, received, created, updated, skipped: 0, warnings, synced_at: syncedAt };
}
async function enrichStravaActivity(activityId, accessToken) {
  const stored = db.getActivityDetail(Number(activityId));
  if (!stored || stored.activity.source_provider !== 'strava_api' || !stored.activity.source_activity_id) return null;
  let detail = db.getStravaActivityDetail(Number(activityId));
  if (!detail) {
    detail = await stravaRequest(`${STRAVA_API_BASE}/activities/${stored.activity.source_activity_id}?include_all_efforts=true`, { headers: { Authorization: `Bearer ${accessToken}` } });
    try {
      detail.zones = await stravaRequest(`${STRAVA_API_BASE}/activities/${stored.activity.source_activity_id}/zones`, { headers: { Authorization: `Bearer ${accessToken}` } });
    } catch { detail.zones = null; }
    db.saveStravaActivityDetail(Number(activityId), detail);
  }
  if (!db.hasActivityRecords(Number(activityId))) {
    const streamQuery = new URLSearchParams({ keys: 'time,distance,altitude,velocity_smooth,heartrate,cadence,watts,latlng,moving,grade_smooth', key_by_type: 'true' });
    const streams = await stravaRequest(`${STRAVA_API_BASE}/activities/${stored.activity.source_activity_id}/streams?${streamQuery}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    db.replaceStravaStreams(Number(activityId), streams, stored.activity.created_at || detail.start_date);
  }
  return db.getActivityDetail(Number(activityId));
}
async function disconnectStrava() {
  const connection = db.getStravaConnection('Miguel Bello');
  if (!connection) return;
  try {
    requireStravaConfig();
    const token = decryptSecret(connection.refresh_token);
    await stravaRequest(`${STRAVA_OAUTH_BASE}/revoke`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${STRAVA_CLIENT_ID}:${STRAVA_CLIENT_SECRET}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token, token_type_hint: 'refresh_token' }) });
  } finally { db.disconnectStrava('Miguel Bello'); }
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

function readableLayer(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(readableLayer).filter(Boolean).join('\n');
  return Object.entries(value).map(([key, item]) => `${key}: ${readableLayer(item) || 'No disponible'}`).join('\n');
}

function normalizeGeneratedReport(value) {
  const generated = value && typeof value === 'object' ? value : { answer: readableLayer(value) };
  return {
    answer: readableLayer(generated.answer) || 'No fue posible generar una respuesta estructurada.',
    calculations: Array.isArray(generated.calculations)
      ? generated.calculations.map(readableLayer).filter(Boolean)
      : [readableLayer(generated.calculations)].filter(Boolean),
    interpretation: readableLayer(generated.interpretation),
    hypothesis: readableLayer(generated.hypothesis),
    recommendation: readableLayer(generated.recommendation),
    limitation: readableLayer(generated.limitation),
    confidence: readableLayer(generated.confidence) || 'limitada',
    evidence_refs: Array.isArray(generated.evidence_refs) ? generated.evidence_refs.map(readableLayer).filter(Boolean) : []
  };
}

function buildHistoricalBaseline(activities) {
  const metrics = {
    distance_m: 'distance_m',
    duration_seconds: 'duration_seconds',
    average_speed_mps: 'average_speed_mps',
    average_heart_rate_bpm: 'average_heart_rate_bpm',
    ascent_m: 'ascent_m'
  };
  const summarize = rows => {
    const result = { activity_count: rows.length, metrics: {} };
    for (const [name, key] of Object.entries(metrics)) {
      const values = rows.map(row => Number(row.observed?.[key]?.value)).filter(Number.isFinite);
      if (!values.length) continue;
      result.metrics[name] = {
        samples: values.length,
        mean: values.reduce((sum, value) => sum + value, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values)
      };
    }
    const dates = rows.map(row => row.observed?.start_time?.value).filter(Boolean).sort();
    result.period = dates.length ? { first: dates[0], last: dates[dates.length - 1] } : null;
    return result;
  };
  const grouped = new Map();
  for (const activity of activities) {
    if (!grouped.has(activity.sport)) grouped.set(activity.sport, []);
    grouped.get(activity.sport).push(activity);
  }
  return Object.fromEntries([...grouped.entries()].map(([sport, rows]) => [sport, summarize(rows)]));
}

async function assistantQuery(query, history = [], activityId = null) {
  const selectedActivity = activityId ? db.getActivityAnalysisContext(Number(activityId)) : null;
  const athleteName = selectedActivity?.activity?.athlete || 'Miguel Bello';
  const comparisonSport = selectedActivity?.activity?.sport || null;
  const activities = db.compareActivities(athleteName, 20, comparisonSport);
  const learningProfile = db.getAthleteLearningProfile(athleteName);
  const learningPatterns = db.refreshAthleteLearningPatterns(athleteName)
    .filter(pattern => !comparisonSport || pattern.discipline === comparisonSport);
  const historicalBaseline = buildHistoricalBaseline(activities);
  const evidenceSummary = selectedActivity ? {
    current_session: {
      record_count: selectedActivity.record_count,
      records_sampled: selectedActivity.records_sampled,
      laps: selectedActivity.laps.length,
      events: selectedActivity.events.length,
      segment_count: selectedActivity.derived?.segments?.length || 0,
      available_fields: Object.keys(selectedActivity.session?.fields || {})
    },
    comparison_activity_count: activities.length,
    comparison_scope: comparisonSport || 'all_disciplines'
  } : { comparison_activity_count: activities.length, comparison_scope: 'all_disciplines' };
  const reportKey = 'activity_report_v1';
  const cachedReport = selectedActivity && db.getAiActivityReport(Number(activityId), reportKey);
  if (cachedReport) return { status: 200, body: { query, type: 'generated_activity_report', provider: 'openai', activity_id: Number(activityId), ...cachedReport, ...normalizeGeneratedReport(cachedReport), evidence: [selectedActivity], coach_review_required: true } };
  const unavailable = reason => ({ status: 200, body: {
    query,
    type: 'provider_unavailable',
    answer: 'El chat de IA no está disponible en este momento.',
    evidence: selectedActivity ? [selectedActivity] : activities,
    interpretation: null,
    hypothesis: null,
    recommendation: null,
    limitation: reason,
    provider: 'unavailable',
    coach_review_required: true
  } });
  if (!OPENAI_API_KEY) return unavailable('Configura OPENAI_API_KEY en el backend para activar el chat generativo.');
  const context = JSON.stringify({ athlete: athleteName, comparison_scope: comparisonSport || 'all_disciplines', evidence_summary: evidenceSummary, activities, historical_baseline: historicalBaseline, selected_activity: selectedActivity, learning_profile: learningProfile, learning_patterns: learningPatterns });
  const payload = {
    model: OPENAI_MODEL,
    instructions: ASSISTANT_SYSTEM_PROMPT + ' Responde directamente la pregunta usando el contexto JSON y el historial de conversación.',
    input: JSON.stringify({ question: String(query || ''), analysis_mode: selectedActivity ? 'activity_report' : 'conversation', conversation_history: Array.isArray(history) ? history.slice(-10) : [], observed_context: JSON.parse(context) }),
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
    generated = normalizeGeneratedReport(generated);
    const savedReport = selectedActivity ? db.saveAiActivityReport(Number(activityId), generated, OPENAI_MODEL, reportKey) : generated;
    return { status: 200, body: { query, type: selectedActivity ? 'generated_activity_report' : 'generated_grounded_answer', provider: 'openai', model: OPENAI_MODEL, activity_id: selectedActivity?.activity?.id || null, ...savedReport, evidence: selectedActivity ? [selectedActivity] : activities, coach_review_required: true } };
  } catch (error) { return unavailable('OpenAI no está disponible: ' + error.message); }
}

db.init();
remapStoredStravaSports();
normalizePendingActivities();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    if (!setCors(req, res)) return json(res, 403, { error: 'Origen no autorizado.' });
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }
  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { status: 'ok' });
  if (req.method === 'GET' && url.pathname === '/api/integrations/strava/status') return json(res, 200, stravaStatus());
  if (req.method === 'GET' && url.pathname === '/api/integrations/strava/connect') {
    try { return startStravaConnection(res); } catch (error) { return json(res, 503, { error: error.message }); }
  }
  if (req.method === 'GET' && url.pathname === '/api/integrations/strava/callback') return completeStravaConnection(url, res);
  if (req.method === 'POST' && url.pathname === '/api/integrations/strava/sync') {
    try { const payload = await jsonBody(req); return json(res, 200, await syncStrava(payload.mode || 'incremental')); }
    catch (error) { return json(res, 502, { error: error.message }); }
  }
  if (req.method === 'DELETE' && url.pathname === '/api/integrations/strava') {
    try { await disconnectStrava(); return json(res, 200, { provider: 'strava', athlete: 'Miguel Bello', connected: false }); }
    catch (error) { return json(res, 502, { error: error.message }); }
  }
  if (req.method === 'GET' && url.pathname === '/api/activities') return json(res, 200, { activities: db.listActivities() });
  const profileMatch = /^\/api\/athletes\/([^/]+)\/profile$/.exec(url.pathname);
  if (req.method === 'GET' && profileMatch) {
    const profile = db.getAthleteLearningProfile(decodeURIComponent(profileMatch[1]));
    return profile ? json(res, 200, profile) : json(res, 404, { error: 'Atleta no encontrado.' });
  }
  const patternsMatch = /^\/api\/athletes\/([^/]+)\/patterns$/.exec(url.pathname);
  if (req.method === 'GET' && patternsMatch) {
    const athleteName = decodeURIComponent(patternsMatch[1]);
    return json(res, 200, { athlete: athleteName, patterns: db.refreshAthleteLearningPatterns(athleteName) });
  }
  const patternMatch = /^\/api\/athlete-learning-patterns\/(\d+)$/.exec(url.pathname);
  if (req.method === 'PATCH' && patternMatch) {
    try {
      const payload = await jsonBody(req);
      const pattern = db.updateAthleteLearningPattern(Number(patternMatch[1]), payload.status, payload.coach_note);
      return pattern ? json(res, 200, pattern) : json(res, 404, { error: 'Patrón no encontrado.' });
    } catch (error) { return json(res, 400, { error: error.message }); }
  }
  if (req.method === 'GET' && url.pathname === '/api/activities/compare') return json(res, 200, { athlete: url.searchParams.get('athlete') || 'Miguel Bello', activities: db.compareActivities(url.searchParams.get('athlete') || 'Miguel Bello', Number(url.searchParams.get('limit') || 4)) });
  const routeMatch = /^\/api\/activities\/(\d+)\/route$/.exec(url.pathname);
  if (req.method === 'GET' && routeMatch) return json(res, 200, db.getActivityRouteFromSource(Number(routeMatch[1])) || db.getActivityRoute(Number(routeMatch[1])));
  const detailMatch = /^\/api\/activities\/(\d+)$/.exec(url.pathname);
  if (req.method === 'GET' && detailMatch) { const detail = db.getActivityDetail(Number(detailMatch[1])); return detail ? json(res, 200, detail) : json(res, 404, { error: 'Actividad no encontrada.' }); }
  const enrichMatch = /^\/api\/activities\/(\d+)\/enrich$/.exec(url.pathname);
  if (req.method === 'POST' && enrichMatch) {
    try {
      const connection = db.getStravaConnection('Miguel Bello');
      if (!connection) return json(res, 409, { error: 'Strava no está conectado.' });
      const detail = await enrichStravaActivity(Number(enrichMatch[1]), await ensureStravaToken(connection));
      return detail ? json(res, 200, { status: 'enriched', activity: detail }) : json(res, 404, { error: 'Actividad no encontrada o no proviene de Strava.' });
    } catch (error) { return json(res, 502, { error: `No se pudo enriquecer la actividad: ${error.message}` }); }
  }
  const reportMatch = /^\/api\/activities\/(\d+)\/report$/.exec(url.pathname);
  if (req.method === 'GET' && reportMatch) {
    const report = db.getAiActivityReport(Number(reportMatch[1]));
    return report ? json(res, 200, { type: 'generated_activity_report', provider: 'openai', activity_id: Number(reportMatch[1]), ...report, coach_review_required: true }) : json(res, 404, { error: 'No hay informe guardado para esta actividad.' });
  }
  if (req.method === 'POST' && url.pathname === '/api/coach/query') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      if (payload.activity_id && !db.getAiActivityReport(Number(payload.activity_id))) {
        try {
          const connection = db.getStravaConnection('Miguel Bello');
          if (connection) await enrichStravaActivity(Number(payload.activity_id), await ensureStravaToken(connection));
        } catch (error) { console.warn(`No se pudo enriquecer la actividad ${payload.activity_id}: ${error.message}`); }
      }
      const result = await assistantQuery(payload.query, payload.history, payload.activity_id);
      return json(res, result.status, result.body);
    } catch (error) { return json(res, 502, { error: 'No se pudo consultar el asistente: ' + error.message }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/import') return importActivity(req, res);
  if (req.method !== 'GET' || !['/', '/index.html'].includes(url.pathname)) return json(res, 404, { error: 'Not found' });
  const content = fs.readFileSync(FRONTEND);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': content.length, 'Cache-Control': 'no-store' });
  res.end(content);
});

server.listen(PORT, HOST, () => console.log(`Viking Performance Lab: http://${HOST}:${PORT}`));
