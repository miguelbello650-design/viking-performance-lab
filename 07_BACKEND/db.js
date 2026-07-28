const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'viking.db'));
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
  `);
  db.prepare('INSERT OR IGNORE INTO athletes(name, created_at) VALUES (?, ?)').run('Miguel Bello', new Date().toISOString());
}

function listActivities() {
  return db.prepare(`
    SELECT activities.id, athletes.name AS athlete, sport, kind,
           original_filename, file_size, import_status,
           normalization_status, activities.created_at,
           (SELECT COUNT(*) FROM activity_messages m WHERE m.activity_id = activities.id) AS message_count
    FROM activities JOIN athletes ON athletes.id = activities.athlete_id
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

module.exports = { db, init, listActivities, findAthlete, findDuplicate, insertActivity, setStoredPath, deleteActivity, listPendingActivities, listActivitiesWithoutMessages, recordNormalization, replaceMessages, getActivityDetail, getActivityRoute, compareActivities };
