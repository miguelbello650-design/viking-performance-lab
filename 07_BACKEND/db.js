const Database = require('better-sqlite3');
const path = require('path');

const dataDir = process.env.VPL_DATA_DIR || __dirname;
const db = new Database(path.join(dataDir, 'viking.db'));
db.pragma('journal_mode = WAL');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS athletes (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY,
      athlete_id INTEGER NOT NULL REFERENCES athletes(id),
      sport TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('Entrenamiento', 'Carrera')),
      original_filename TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      file_extension TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      sha256 TEXT NOT NULL UNIQUE,
      import_status TEXT NOT NULL DEFAULT 'accepted',
      normalization_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activity_normalization (
      activity_id INTEGER PRIMARY KEY REFERENCES activities(id),
      file_format TEXT NOT NULL,
      raw_size INTEGER NOT NULL,
      fit_size INTEGER,
      fit_header_size INTEGER,
      fit_data_size INTEGER,
      validation_status TEXT NOT NULL,
      warnings_json TEXT NOT NULL DEFAULT '[]',
      observed_json TEXT NOT NULL DEFAULT '{}',
      normalized_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activity_messages (
      id INTEGER PRIMARY KEY,
      activity_id INTEGER NOT NULL REFERENCES activities(id),
      message_index INTEGER NOT NULL,
      global_message_num INTEGER NOT NULL,
      message_type TEXT NOT NULL,
      timestamp TEXT,
      fields_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS strava_connections (
      athlete_id INTEGER PRIMARY KEY REFERENCES athletes(id),
      strava_athlete_id TEXT NOT NULL UNIQUE,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      scopes_json TEXT NOT NULL DEFAULT '[]',
      connected_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_sync_at TEXT,
      status TEXT NOT NULL DEFAULT 'connected'
    );
    CREATE TABLE IF NOT EXISTS activity_routes (
      activity_id INTEGER PRIMARY KEY REFERENCES activities(id),
      points_json TEXT NOT NULL DEFAULT '[]',
      source_format TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS athlete_learning_profiles (
      athlete_id INTEGER PRIMARY KEY REFERENCES athletes(id),
      profile_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS strava_activity_details (
      activity_id INTEGER PRIMARY KEY REFERENCES activities(id),
      detail_json TEXT NOT NULL DEFAULT '{}',
      fetched_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_activity_reports (
      activity_id INTEGER NOT NULL REFERENCES activities(id),
      report_key TEXT NOT NULL,
      model TEXT,
      report_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (activity_id, report_key)
    );
    CREATE TABLE IF NOT EXISTS athlete_learning_patterns (
      id INTEGER PRIMARY KEY,
      athlete_id INTEGER NOT NULL REFERENCES athletes(id),
      discipline TEXT NOT NULL,
      pattern_key TEXT NOT NULL,
      statement TEXT NOT NULL,
      evidence_json TEXT NOT NULL DEFAULT '[]',
      metrics_json TEXT NOT NULL DEFAULT '{}',
      confidence REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'candidate' CHECK(status IN ('candidate', 'confirmed', 'rejected')),
      coach_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(athlete_id, discipline, pattern_key)
    );
  `);
  const activityColumns = db.prepare('PRAGMA table_info(activities)').all().map(column => column.name);
  if (!activityColumns.includes('source_provider')) db.exec("ALTER TABLE activities ADD COLUMN source_provider TEXT NOT NULL DEFAULT 'file'");
  if (!activityColumns.includes('source_activity_id')) db.exec('ALTER TABLE activities ADD COLUMN source_activity_id TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS activities_source_activity_idx ON activities(source_provider, source_activity_id) WHERE source_activity_id IS NOT NULL');
  db.exec('CREATE INDEX IF NOT EXISTS activity_messages_activity_idx ON activity_messages(activity_id, message_type)');
  db.exec('CREATE INDEX IF NOT EXISTS activity_routes_activity_idx ON activity_routes(activity_id)');
  db.prepare('INSERT OR IGNORE INTO athletes(name, created_at) VALUES (?, ?)').run('Miguel Bello', new Date().toISOString());
}

function listActivities() {
  return db.prepare(`
    SELECT activities.id, athletes.name AS athlete, sport, kind,
           original_filename, file_size, import_status,
           normalization_status, activities.created_at,
           COALESCE(messages.message_count, 0) AS message_count,
           source_provider,
           CASE WHEN routes.activity_id IS NULL THEN 0 ELSE 1 END AS has_route
    FROM activities JOIN athletes ON athletes.id = activities.athlete_id
    LEFT JOIN (SELECT activity_id, COUNT(*) AS message_count FROM activity_messages GROUP BY activity_id) messages ON messages.activity_id = activities.id
    LEFT JOIN (SELECT DISTINCT activity_id FROM activity_routes) routes ON routes.activity_id = activities.id
    ORDER BY activities.id DESC
  `).all();
}

function findAthlete(name) { return db.prepare('SELECT id FROM athletes WHERE name = ?').get(name); }
function getAthleteLearningProfile(name) {
  const athlete = db.prepare('SELECT id, name, created_at FROM athletes WHERE name = ?').get(name);
  if (!athlete) return null;
  const baselines = db.prepare(`
    SELECT sport, COUNT(*) AS activities,
           MIN(json_extract(n.observed_json, '$.start_time.value')) AS first_activity,
           MAX(json_extract(n.observed_json, '$.start_time.value')) AS last_activity,
           AVG(json_extract(n.observed_json, '$.total_distance.value')) AS avg_distance_m,
           AVG(json_extract(n.observed_json, '$.total_ascent.value')) AS avg_ascent_m,
           AVG(json_extract(n.observed_json, '$.avg_speed.value')) AS avg_speed_mps,
           AVG(json_extract(n.observed_json, '$.avg_heart_rate.value')) AS avg_heart_rate_bpm,
           AVG(json_extract(n.observed_json, '$.avg_cadence.value')) AS avg_cadence_rpm
    FROM activities a JOIN activity_normalization n ON n.activity_id = a.id
    WHERE a.athlete_id = ? AND a.normalization_status = 'normalized'
    GROUP BY sport ORDER BY activities DESC
  `).all(athlete.id).map(row => ({
    discipline: row.sport,
    evidence_count: row.activities,
    period: { first: row.first_activity, last: row.last_activity },
    observed_baseline: {
      average_distance_m: row.avg_distance_m,
      average_ascent_m: row.avg_ascent_m,
      average_speed_mps: row.avg_speed_mps,
      average_heart_rate_bpm: row.avg_heart_rate_bpm,
      average_cadence_rpm: row.avg_cadence_rpm
    },
    status: row.activities >= 3 ? 'usable_baseline' : 'insufficient_history',
    limitation: 'Linea base observada; no equivale a una capacidad, diagnostico ni recomendacion.'
  }));
  const profile = { athlete: athlete.name, learning_version: 1, updated_at: new Date().toISOString(), baselines };
  db.prepare(`INSERT INTO athlete_learning_profiles (athlete_id, profile_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(athlete_id) DO UPDATE SET profile_json = excluded.profile_json, updated_at = excluded.updated_at`)
    .run(athlete.id, JSON.stringify(profile), profile.updated_at);
  return { ...profile, athlete_id: athlete.id };
}
function findDuplicate(sha256) { return db.prepare('SELECT id, original_filename FROM activities WHERE sha256 = ?').get(sha256); }

function insertActivity(data) {
  const result = db.prepare(`INSERT INTO activities
    (athlete_id, sport, kind, original_filename, stored_path, file_extension,
     file_size, sha256, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(data.athleteId, data.sport, data.kind, data.filename, '', data.extension, data.size, data.sha256, new Date().toISOString());
  return Number(result.lastInsertRowid);
}

function setStoredPath(id, storedPath) { db.prepare('UPDATE activities SET stored_path = ? WHERE id = ?').run(storedPath, id); }
function deleteActivity(id) { db.prepare('DELETE FROM activities WHERE id = ?').run(id); }
function listPendingActivities() { return db.prepare("SELECT * FROM activities WHERE normalization_status = 'pending' ORDER BY id").all(); }
function listActivitiesWithoutMessages() { return db.prepare("SELECT a.* FROM activities a LEFT JOIN activity_messages m ON m.activity_id = a.id WHERE m.id IS NULL AND (lower(a.original_filename) LIKE '%.fit' OR lower(a.original_filename) LIKE '%.fit.gz') ORDER BY a.id").all(); }
function recordNormalization(id, result) {
  db.prepare(`INSERT OR REPLACE INTO activity_normalization
    (activity_id, file_format, raw_size, fit_size, fit_header_size, fit_data_size,
     validation_status, warnings_json, observed_json, normalized_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, result.fileFormat, result.rawSize, result.fitSize || null, result.headerSize || null,
      result.dataSize || null, result.status, JSON.stringify(result.warnings || []), JSON.stringify(result.observed || {}), new Date().toISOString());
  db.prepare('UPDATE activities SET normalization_status = ? WHERE id = ?').run(result.status, id);
}
function replaceMessages(activityId, messages) {
  const insert = db.prepare(`INSERT INTO activity_messages
    (activity_id, message_index, global_message_num, message_type, timestamp, fields_json)
    VALUES (?, ?, ?, ?, ?, ?)`);
  db.transaction(() => {
    db.prepare('DELETE FROM activity_messages WHERE activity_id = ?').run(activityId);
    messages.forEach(message => insert.run(activityId, message.index, message.globalNum, message.type, message.timestamp, JSON.stringify(message.fields)));
  })();
}
function parseFields(row) { return row ? JSON.parse(row.fields_json) : {}; }
function getActivityDetail(id) {
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  if (!activity) return null;
  const normalization = db.prepare('SELECT * FROM activity_normalization WHERE activity_id = ?').get(id);
  const session = db.prepare("SELECT * FROM activity_messages WHERE activity_id = ? AND message_type = 'session' ORDER BY message_index LIMIT 1").get(id);
  const laps = db.prepare("SELECT message_index, timestamp, fields_json FROM activity_messages WHERE activity_id = ? AND message_type = 'lap' ORDER BY message_index").all(id).map(row => ({ message_index: row.message_index, timestamp: row.timestamp, fields: parseFields(row) }));
  const events = db.prepare("SELECT message_index, timestamp, fields_json FROM activity_messages WHERE activity_id = ? AND message_type = 'event' ORDER BY message_index").all(id).map(row => ({ message_index: row.message_index, timestamp: row.timestamp, fields: parseFields(row) }));
  const recordCount = db.prepare("SELECT COUNT(*) AS count FROM activity_messages WHERE activity_id = ? AND message_type = 'record'").get(id).count;
  const stravaDetail = db.prepare('SELECT detail_json, fetched_at FROM strava_activity_details WHERE activity_id = ?').get(id);
  return { activity, normalization, strava_detail: stravaDetail ? { ...JSON.parse(stravaDetail.detail_json || '{}'), fetched_at: stravaDetail.fetched_at } : null, session: session ? { message_index: session.message_index, timestamp: session.timestamp, fields: parseFields(session) } : null, laps, events, record_count: recordCount };
}
function getActivityAnalysisContext(id, maxSamples = 600) {
  const detail = getActivityDetail(id);
  if (!detail) return null;
  const rows = db.prepare("SELECT message_index, timestamp, fields_json FROM activity_messages WHERE activity_id = ? AND message_type = 'record' ORDER BY message_index").all(id);
  const step = Math.max(1, Math.ceil(rows.length / maxSamples));
  const records = rows.filter((_, index) => index % step === 0).map(row => {
    const fields = parseFields(row);
    const pick = names => { for (const name of names) if (fields[name]) return fields[name]; return null; };
    return {
      message_index: row.message_index,
      timestamp: row.timestamp,
      distance_m: pick(['distance', 'field_5']),
      speed_mps: pick(['enhanced_speed', 'speed', 'field_6']),
      heart_rate_bpm: pick(['heart_rate', 'field_3']),
      cadence_rpm: pick(['cadence', 'enhanced_cadence', 'field_4']),
      altitude_m: pick(['altitude', 'enhanced_altitude', 'field_2'])
    };
  });
  const numeric = (record, key) => Number(record[key]?.value);
  const segment = (items, label) => {
    const values = items.map(item => numeric(item, label)).filter(Number.isFinite);
    return values.length ? { samples: values.length, mean: values.reduce((sum, value) => sum + value, 0) / values.length, first: values[0], last: values[values.length - 1] } : null;
  };
  const split = Math.max(1, Math.floor(records.length / 5));
  const first = records.slice(0, split);
  const last = records.slice(-split);
  const firstSpeed = segment(first, 'speed_mps');
  const lastSpeed = segment(last, 'speed_mps');
  const firstHeartRate = segment(first, 'heart_rate_bpm');
  const lastHeartRate = segment(last, 'heart_rate_bpm');
  const firstCadence = segment(first, 'cadence_rpm');
  const lastCadence = segment(last, 'cadence_rpm');
  const changes = (start, end) => start && end && start.mean !== 0 ? { absolute: end.mean - start.mean, percent: ((end.mean - start.mean) / start.mean) * 100 } : null;
  const meanField = (items, key) => {
    const values = items.map(item => numeric(item, key)).filter(Number.isFinite);
    return values.length ? { samples: values.length, mean: values.reduce((sum, value) => sum + value, 0) / values.length } : null;
  };
  const distanceRecords = records.filter(record => Number.isFinite(numeric(record, 'distance_m')));
  const segmentBase = distanceRecords.length >= 5 ? distanceRecords : records;
  const segmentSize = Math.max(1, Math.ceil(segmentBase.length / 5));
  const segments = Array.from({ length: 5 }, (_, index) => {
    const items = segmentBase.slice(index * segmentSize, (index + 1) * segmentSize);
    if (!items.length) return null;
    const distances = items.map(item => numeric(item, 'distance_m')).filter(Number.isFinite);
    const altitudes = items.map(item => numeric(item, 'altitude_m')).filter(Number.isFinite);
    return {
      segment: index + 1,
      distance_start_m: distances.length ? distances[0] : null,
      distance_end_m: distances.length ? distances[distances.length - 1] : null,
      speed_mps: meanField(items, 'speed_mps'),
      heart_rate_bpm: meanField(items, 'heart_rate_bpm'),
      cadence_rpm: meanField(items, 'cadence_rpm'),
      altitude_range_m: altitudes.length ? { min: Math.min(...altitudes), max: Math.max(...altitudes) } : null,
      samples: items.length
    };
  }).filter(Boolean);
  const altitudeValues = records.map(record => numeric(record, 'altitude_m')).filter(Number.isFinite);
  let ascent = 0;
  let descent = 0;
  for (let index = 1; index < altitudeValues.length; index += 1) {
    const delta = altitudeValues[index] - altitudeValues[index - 1];
    if (delta > 0) ascent += delta;
    if (delta < 0) descent += Math.abs(delta);
  }
  const derived = {
    method: 'Comparación descriptiva entre el primer y último 20% de registros muestreados; no es una regla clínica ni un umbral universal.',
    data_sufficiency: { record_count: detail.record_count, sampled: records.length, speed_samples: [firstSpeed, lastSpeed].filter(Boolean).length, heart_rate_samples: [firstHeartRate, lastHeartRate].filter(Boolean).length, cadence_samples: [firstCadence, lastCadence].filter(Boolean).length, altitude_samples: altitudeValues.length },
    first_20_percent: { speed_mps: firstSpeed, heart_rate_bpm: firstHeartRate, cadence_rpm: firstCadence },
    last_20_percent: { speed_mps: lastSpeed, heart_rate_bpm: lastHeartRate, cadence_rpm: lastCadence },
    changes_first_to_last_20_percent: { speed_mps: changes(firstSpeed, lastSpeed), heart_rate_bpm: changes(firstHeartRate, lastHeartRate), cadence_rpm: changes(firstCadence, lastCadence) },
    segments,
    altitude_from_records: altitudeValues.length > 1 ? { ascent_m: ascent, descent_m: descent } : null
  };
  return {
    activity: detail.activity,
    normalization: detail.normalization,
    session: detail.session,
    laps: detail.laps,
    events: detail.events,
    record_count: detail.record_count,
    records_sampled: records.length,
    records,
    derived
  };
}
function routeCoordinate(item) {
  if (!item) return null;
  const value = Number(item.value);
  if (Number.isFinite(value) && Math.abs(value) <= 180) return value;
  const raw = Number(item.raw);
  return Number.isFinite(raw) ? raw * 180 / 2147483648 : null;
}
function getActivityRoute(id, maxPoints = 1200) {
  const rows = db.prepare("SELECT timestamp, fields_json FROM activity_messages WHERE activity_id = ? AND message_type = 'record' ORDER BY message_index").all(id);
  const points = rows.map(row => {
    const fields = parseFields(row);
    return {
      timestamp: row.timestamp,
      latitude: routeCoordinate(fields.position_lat || fields.field_0),
      longitude: routeCoordinate(fields.position_long || fields.field_1),
      altitude_m: (fields.altitude || fields.field_2)?.value ?? null,
      distance_m: (fields.distance || fields.field_5)?.value ?? null
    };
  }).filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  const step = Math.max(1, Math.ceil(points.length / maxPoints));
  return { observed_point_count: points.length, points: points.filter((_, index) => index % step === 0) };
}
function value(fields, name) { return fields?.[name]?.value ?? null; }
function comparisonRow(activity) {
  const detail = getActivityDetail(activity.id);
  const fields = detail.session?.fields || {};
  const observed = {};
  const map = { start_time: 'start_time', duration_seconds: 'total_elapsed_time', timer_seconds: 'total_timer_time', distance_m: 'total_distance', average_speed_mps: 'avg_speed', max_speed_mps: 'max_speed', average_heart_rate_bpm: 'avg_heart_rate', max_heart_rate_bpm: 'max_heart_rate', average_cadence_rpm: 'avg_cadence', max_cadence_rpm: 'max_cadence', average_power_w: 'avg_power', max_power_w: 'max_power', ascent_m: 'total_ascent', descent_m: 'total_descent', sport: 'sport', sub_sport: 'sub_sport' };
  Object.entries(map).forEach(([key, source]) => { const item = fields[source]; if (item && item.value !== null && item.value !== undefined) observed[key] = { raw: item.raw, value: item.value }; });
  return { id: activity.id, filename: activity.original_filename, athlete: activity.athlete, sport: activity.sport, kind: activity.kind, normalization_status: activity.normalization_status, observed, calculated: { record_count: detail.record_count, lap_count: detail.laps.length } };
}
function compareActivities(athlete, limit = 4, sport = null) {
  const query = sport
    ? `SELECT activities.*, athletes.name AS athlete FROM activities JOIN athletes ON athletes.id = activities.athlete_id WHERE athletes.name = ? AND activities.normalization_status = 'normalized' AND activities.sport = ? ORDER BY activities.id DESC LIMIT ?`
    : `SELECT activities.*, athletes.name AS athlete FROM activities JOIN athletes ON athletes.id = activities.athlete_id WHERE athletes.name = ? AND activities.normalization_status = 'normalized' ORDER BY activities.id DESC LIMIT ?`;
  const rows = db.prepare(query).all(...(sport ? [athlete, sport, limit] : [athlete, limit])).map(comparisonRow).sort((a, b) => String(a.observed.start_time?.value || '').localeCompare(String(b.observed.start_time?.value || '')));
  rows.forEach((row, index) => { const previous = rows[index - 1]; row.calculated.delta_from_previous = {}; if (!previous) return; ['duration_seconds', 'distance_m', 'average_speed_mps', 'average_heart_rate_bpm', 'average_power_w', 'ascent_m', 'descent_m'].forEach(key => { const current = row.observed[key]?.value; const prior = previous.observed[key]?.value; if (Number.isFinite(current) && Number.isFinite(prior)) row.calculated.delta_from_previous[key] = current - prior; }); });
  return rows;
}

function getStravaConnection(athleteName) {
  return db.prepare(`SELECT sc.*, a.name AS athlete FROM strava_connections sc JOIN athletes a ON a.id = sc.athlete_id WHERE a.name = ?`).get(athleteName);
}
function saveStravaConnection(data) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO strava_connections
    (athlete_id, strava_athlete_id, access_token, refresh_token, expires_at, scopes_json, connected_at, updated_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connected')
    ON CONFLICT(athlete_id) DO UPDATE SET strava_athlete_id = excluded.strava_athlete_id,
      access_token = excluded.access_token, refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at, scopes_json = excluded.scopes_json,
      updated_at = excluded.updated_at, status = 'connected'`).run(
    data.athleteId, String(data.stravaAthleteId), data.accessToken, data.refreshToken,
    Number(data.expiresAt), JSON.stringify(data.scopes || []), now, now
  );
}
function updateStravaTokens(athleteName, data) {
  const now = new Date().toISOString();
  db.prepare(`UPDATE strava_connections SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = ?, status = 'connected' WHERE athlete_id = (SELECT id FROM athletes WHERE name = ?)`)
    .run(data.accessToken, data.refreshToken, Number(data.expiresAt), now, athleteName);
}
function setStravaSyncAt(athleteName, timestamp) {
  db.prepare(`UPDATE strava_connections SET last_sync_at = ?, updated_at = ? WHERE athlete_id = (SELECT id FROM athletes WHERE name = ?)`)
    .run(timestamp, new Date().toISOString(), athleteName);
}
function disconnectStrava(athleteName) {
  db.prepare(`DELETE FROM strava_connections WHERE athlete_id = (SELECT id FROM athletes WHERE name = ?)`)
    .run(athleteName);
}
function stravaActivityExists(stravaActivityId) {
  return db.prepare("SELECT id FROM activities WHERE source_provider = 'strava_api' AND source_activity_id = ?").get(String(stravaActivityId));
}
function upsertStravaActivity(data) {
  const existing = stravaActivityExists(data.stravaActivityId);
  const fields = data.fields || {};
  const filename = String(data.name || `strava:${data.stravaActivityId}`);
  const sha256 = `strava:${data.stravaActivityId}`;
  const sport = data.sport || 'unknown';
  const kind = data.kind || 'Entrenamiento';
  const now = new Date().toISOString();
  let activityId;
  if (existing) {
    activityId = existing.id;
    db.prepare(`UPDATE activities SET sport = ?, kind = ?, original_filename = ?, normalization_status = 'normalized', created_at = ? WHERE id = ?`).run(sport, kind, filename, data.startDate || now, activityId);
  } else {
    const result = db.prepare(`INSERT INTO activities
      (athlete_id, sport, kind, original_filename, stored_path, file_extension, file_size, sha256,
       import_status, normalization_status, created_at, source_provider, source_activity_id)
      VALUES (?, ?, ?, ?, '', 'strava', 0, ?, 'accepted', 'normalized', ?, 'strava_api', ?)`).run(
      data.athleteId, sport, kind, filename, sha256, data.startDate || now, String(data.stravaActivityId)
    );
    activityId = Number(result.lastInsertRowid);
  }
  const sessionFields = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { raw: value, value }]));
  db.prepare("DELETE FROM activity_messages WHERE activity_id = ? AND message_type = 'session'").run(activityId);
  const insert = db.prepare(`INSERT OR REPLACE INTO activity_messages
    (activity_id, message_index, global_message_num, message_type, timestamp, fields_json)
    VALUES (?, 0, 18, 'session', ?, ?)`);
  insert.run(activityId, data.startDate || null, JSON.stringify(sessionFields));
  db.prepare(`INSERT OR REPLACE INTO activity_normalization
    (activity_id, file_format, raw_size, validation_status, warnings_json, observed_json, normalized_at)
    VALUES (?, 'Strava API', 0, 'normalized', ?, ?, ?)`).run(activityId, JSON.stringify(data.warnings || []), JSON.stringify({ source_provider: 'strava_api', strava_activity_id: String(data.stravaActivityId) }), now);
  if (Array.isArray(data.routePoints)) db.prepare(`INSERT OR REPLACE INTO activity_routes (activity_id, points_json, source_format, updated_at) VALUES (?, ?, 'strava_polyline', ?)`).run(activityId, JSON.stringify(data.routePoints), now);
  return { id: activityId, created: !existing };
}
function hasActivityRecords(activityId) {
  return db.prepare("SELECT 1 FROM activity_messages WHERE activity_id = ? AND message_type = 'record' LIMIT 1").get(activityId) != null;
}
function getStravaActivityDetail(activityId) {
  const row = db.prepare('SELECT detail_json, fetched_at FROM strava_activity_details WHERE activity_id = ?').get(activityId);
  return row ? { ...JSON.parse(row.detail_json || '{}'), fetched_at: row.fetched_at } : null;
}
function saveStravaActivityDetail(activityId, detail) {
  const fetchedAt = new Date().toISOString();
  db.prepare(`INSERT INTO strava_activity_details (activity_id, detail_json, fetched_at) VALUES (?, ?, ?)
    ON CONFLICT(activity_id) DO UPDATE SET detail_json = excluded.detail_json, fetched_at = excluded.fetched_at`)
    .run(activityId, JSON.stringify(detail || {}), fetchedAt);
  return fetchedAt;
}
function getAiActivityReport(activityId, reportKey = 'activity_report_v1') {
  const row = db.prepare('SELECT report_json, model, created_at, updated_at FROM ai_activity_reports WHERE activity_id = ? AND report_key = ?').get(activityId, reportKey);
  if (!row) return null;
  return { ...JSON.parse(row.report_json || '{}'), model: row.model, created_at: row.created_at, updated_at: row.updated_at, cached: true };
}
function saveAiActivityReport(activityId, report, model, reportKey = 'activity_report_v1') {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO ai_activity_reports (activity_id, report_key, model, report_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(activity_id, report_key) DO UPDATE SET model = excluded.model, report_json = excluded.report_json, updated_at = excluded.updated_at`)
    .run(activityId, reportKey, model || null, JSON.stringify(report || {}), now, now);
  return { ...report, model: model || null, created_at: now, updated_at: now, cached: false };
}
function correlation(pairs) {
  if (pairs.length < 5) return null;
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const xs = pairs.map(pair => pair[0]);
  const ys = pairs.map(pair => pair[1]);
  const mx = mean(xs); const my = mean(ys);
  const numerator = pairs.reduce((sum, pair) => sum + (pair[0] - mx) * (pair[1] - my), 0);
  const denominator = Math.sqrt(xs.reduce((sum, value) => sum + (value - mx) ** 2, 0) * ys.reduce((sum, value) => sum + (value - my) ** 2, 0));
  return denominator ? numerator / denominator : null;
}
function refreshAthleteLearningPatterns(name) {
  const athlete = db.prepare('SELECT id, name FROM athletes WHERE name = ?').get(name);
  if (!athlete) return [];
  const rows = db.prepare(`SELECT a.id, a.sport FROM activities a JOIN activity_normalization n ON n.activity_id = a.id WHERE a.athlete_id = ? AND a.normalization_status = 'normalized'`).all(athlete.id);
  const grouped = new Map();
  rows.forEach(row => {
    const detail = getActivityDetail(row.id);
    const fields = detail?.session?.fields || {};
    const number = key => Number(fields[key]?.value);
    const item = { id: row.id, speed: number('avg_speed'), heartRate: number('avg_heart_rate'), ascent: number('total_ascent'), distance: number('total_distance') };
    if (!grouped.has(row.sport)) grouped.set(row.sport, []);
    grouped.get(row.sport).push(item);
  });
  const now = new Date().toISOString();
  const upsert = db.prepare(`INSERT INTO athlete_learning_patterns (athlete_id, discipline, pattern_key, statement, evidence_json, metrics_json, confidence, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'candidate', ?, ?)
    ON CONFLICT(athlete_id, discipline, pattern_key) DO UPDATE SET statement = excluded.statement, evidence_json = excluded.evidence_json, metrics_json = excluded.metrics_json, confidence = excluded.confidence, updated_at = excluded.updated_at`);
  const savePattern = (discipline, key, statement, evidence, metrics) => upsert.run(athlete.id, discipline, key, statement, JSON.stringify(evidence), JSON.stringify(metrics), Math.min(0.95, 0.5 + Math.abs(metrics.correlation || 0) * 0.4), now, now);
  grouped.forEach((items, discipline) => {
    const speedHr = items.filter(item => Number.isFinite(item.speed) && Number.isFinite(item.heartRate));
    const speedAscent = items.filter(item => Number.isFinite(item.speed) && Number.isFinite(item.ascent) && Number.isFinite(item.distance) && item.distance > 0);
    const hrCorrelation = correlation(speedHr.map(item => [item.speed, item.heartRate]));
    if (hrCorrelation !== null && Math.abs(hrCorrelation) >= 0.6) savePattern(discipline, 'speed-heart-rate', `En ${speedHr.length} actividades de ${discipline} se observa una relaciÃ³n ${hrCorrelation > 0 ? 'positiva' : 'negativa'} entre velocidad media y frecuencia cardiaca media. Es un patrÃ³n candidato, no una causa confirmada.`, speedHr.map(item => item.id), { correlation: hrCorrelation, evidence_count: speedHr.length });
    const ascentCorrelation = correlation(speedAscent.map(item => [item.ascent / item.distance, item.speed]));
    if (ascentCorrelation !== null && Math.abs(ascentCorrelation) >= 0.6) savePattern(discipline, 'ascent-speed', `En ${speedAscent.length} actividades de ${discipline} se observa una relaciÃ³n ${ascentCorrelation > 0 ? 'positiva' : 'negativa'} entre desnivel relativo y velocidad media. Es un patrÃ³n candidato, no una causa confirmada.`, speedAscent.map(item => item.id), { correlation: ascentCorrelation, evidence_count: speedAscent.length });
  });
  return getAthleteLearningPatterns(name);
}
function getAthleteLearningPatterns(name) {
  const athlete = db.prepare('SELECT id FROM athletes WHERE name = ?').get(name);
  if (!athlete) return [];
  return db.prepare('SELECT id, discipline, pattern_key, statement, evidence_json, metrics_json, confidence, status, coach_note, created_at, updated_at FROM athlete_learning_patterns WHERE athlete_id = ? ORDER BY updated_at DESC').all(athlete.id).map(row => ({ ...row, evidence: JSON.parse(row.evidence_json || '[]'), metrics: JSON.parse(row.metrics_json || '{}'), evidence_json: undefined, metrics_json: undefined }));
}
function updateAthleteLearningPattern(id, status, coachNote) {
  if (!['candidate', 'confirmed', 'rejected'].includes(status)) throw new Error('Estado de patrón no válido.');
  db.prepare('UPDATE athlete_learning_patterns SET status = ?, coach_note = ?, updated_at = ? WHERE id = ?').run(status, coachNote || null, new Date().toISOString(), id);
  return db.prepare('SELECT id, discipline, pattern_key, statement, evidence_json, metrics_json, confidence, status, coach_note, created_at, updated_at FROM athlete_learning_patterns WHERE id = ?').get(id);
}
function replaceStravaStreams(activityId, streams, startDate) {
  const source = streams && typeof streams === 'object' ? streams : {};
  const length = Math.max(0, ...Object.values(source).map(stream => Array.isArray(stream?.data) ? stream.data.length : 0));
  if (!length) return 0;
  const read = (key, index) => source[key]?.data?.[index];
  const toField = value => value === undefined || value === null ? null : { raw: value, value };
  const insert = db.prepare(`INSERT OR REPLACE INTO activity_messages
    (activity_id, message_index, global_message_num, message_type, timestamp, fields_json)
    VALUES (?, ?, 20, 'record', ?, ?)`);
  const rows = [];
  for (let index = 0; index < length; index += 1) {
    const time = read('time', index);
    const fields = {
      distance: toField(read('distance', index)),
      elapsed_time: toField(time),
      speed: toField(read('velocity_smooth', index)),
      heart_rate: toField(read('heartrate', index)),
      cadence: toField(read('cadence', index)),
      power: toField(read('watts', index)),
      altitude: toField(read('altitude', index)),
      grade: toField(read('grade_smooth', index)),
      moving: toField(read('moving', index))
    };
    Object.keys(fields).forEach(key => { if (!fields[key]) delete fields[key]; });
    const timestamp = Number.isFinite(Number(time)) && startDate ? new Date(new Date(startDate).getTime() + Number(time) * 1000).toISOString() : startDate || null;
    rows.push([activityId, index + 1, timestamp, JSON.stringify(fields)]);
  }
  db.transaction(() => {
    db.prepare("DELETE FROM activity_messages WHERE activity_id = ? AND message_type = 'record'").run(activityId);
    rows.forEach(row => insert.run(...row));
  })();
  return rows.length;
}
function getActivityRouteFromSource(id, maxPoints = 1200) {
  const row = db.prepare('SELECT points_json, source_format FROM activity_routes WHERE activity_id = ?').get(id);
  if (!row) return null;
  const points = JSON.parse(row.points_json || '[]');
  const step = Math.max(1, Math.ceil(points.length / maxPoints));
  return { observed_point_count: points.length, source_format: row.source_format, points: points.filter((_, index) => index % step === 0) };
}

module.exports = { db, init, listActivities, findAthlete, getAthleteLearningProfile, refreshAthleteLearningPatterns, getAthleteLearningPatterns, updateAthleteLearningPattern, findDuplicate, insertActivity, setStoredPath, deleteActivity, listPendingActivities, listActivitiesWithoutMessages, recordNormalization, replaceMessages, getActivityDetail, getActivityAnalysisContext, getActivityRoute, getActivityRouteFromSource, compareActivities, getStravaConnection, saveStravaConnection, updateStravaTokens, setStravaSyncAt, disconnectStrava, upsertStravaActivity, hasActivityRecords, replaceStravaStreams, getStravaActivityDetail, saveStravaActivityDetail, getAiActivityReport, saveAiActivityReport };
