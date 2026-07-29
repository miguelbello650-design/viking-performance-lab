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
  return { activity, normalization, session: session ? { message_index: session.message_index, timestamp: session.timestamp, fields: parseFields(session) } : null, laps, events, record_count: recordCount };
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
function compareActivities(athlete, limit = 4) {
  const rows = db.prepare(`SELECT activities.*, athletes.name AS athlete FROM activities JOIN athletes ON athletes.id = activities.athlete_id WHERE athletes.name = ? AND activities.normalization_status = 'normalized' ORDER BY activities.id DESC LIMIT ?`).all(athlete, limit).map(comparisonRow).sort((a, b) => String(a.observed.start_time?.value || '').localeCompare(String(b.observed.start_time?.value || '')));
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
function getActivityRouteFromSource(id, maxPoints = 1200) {
  const row = db.prepare('SELECT points_json, source_format FROM activity_routes WHERE activity_id = ?').get(id);
  if (!row) return null;
  const points = JSON.parse(row.points_json || '[]');
  const step = Math.max(1, Math.ceil(points.length / maxPoints));
  return { observed_point_count: points.length, source_format: row.source_format, points: points.filter((_, index) => index % step === 0) };
}

module.exports = { db, init, listActivities, findAthlete, findDuplicate, insertActivity, setStoredPath, deleteActivity, listPendingActivities, listActivitiesWithoutMessages, recordNormalization, replaceMessages, getActivityDetail, getActivityAnalysisContext, getActivityRoute, getActivityRouteFromSource, compareActivities, getStravaConnection, saveStravaConnection, updateStravaTokens, setStravaSyncAt, disconnectStrava, upsertStravaActivity };
