const MESSAGE_NAMES = { 0: 'file_id', 18: 'session', 19: 'lap', 20: 'record', 21: 'event', 23: 'device_info', 34: 'activity' };
const FIELD_NAMES = {
  0: { 0: 'position_lat', 1: 'position_long', 2: 'altitude', 3: 'heart_rate', 4: 'cadence', 5: 'distance', 6: 'speed', 7: 'power', 13: 'temperature', 18: 'calories', 19: 'vertical_speed', 31: 'gps_accuracy', 73: 'enhanced_speed', 78: 'enhanced_altitude', 253: 'timestamp' },
  20: { 0: 'position_lat', 1: 'position_long', 2: 'altitude', 3: 'heart_rate', 4: 'cadence', 5: 'distance', 6: 'speed', 7: 'power', 13: 'temperature', 18: 'calories', 19: 'vertical_speed', 31: 'gps_accuracy', 73: 'enhanced_speed', 78: 'enhanced_altitude', 253: 'timestamp' },
  18: { 0: 'event', 1: 'event_type', 2: 'start_time', 5: 'sport', 6: 'sub_sport', 7: 'total_elapsed_time', 8: 'total_timer_time', 9: 'total_distance', 11: 'total_calories', 13: 'avg_speed', 14: 'max_speed', 16: 'avg_heart_rate', 17: 'max_heart_rate', 18: 'avg_cadence', 19: 'max_cadence', 20: 'avg_power', 21: 'max_power', 22: 'total_ascent', 23: 'total_descent', 26: 'num_laps', 29: 'training_stress_score', 30: 'intensity_factor', 253: 'timestamp' },
  19: { 0: 'event', 1: 'event_type', 2: 'start_time', 7: 'total_elapsed_time', 8: 'total_timer_time', 9: 'total_distance', 11: 'total_calories', 13: 'avg_speed', 14: 'max_speed', 15: 'avg_heart_rate', 16: 'max_heart_rate', 17: 'avg_cadence', 18: 'max_cadence', 19: 'avg_power', 20: 'max_power', 21: 'total_ascent', 22: 'total_descent', 25: 'training_stress_score', 26: 'intensity_factor', 253: 'timestamp' },
  21: { 0: 'event', 1: 'event_type', 2: 'event_group', 3: 'data16', 4: 'data', 253: 'timestamp' },
  34: { 0: 'total_timer_time', 1: 'num_sessions', 2: 'type', 3: 'event', 4: 'event_type', 253: 'timestamp' }
};

const WIDTHS = { 0: 1, 1: 1, 2: 1, 3: 2, 4: 2, 5: 4, 6: 4, 7: 1, 8: 4, 9: 8, 10: 1, 11: 2, 12: 4, 13: 1, 14: 8, 15: 8, 16: 8 };
const FIT_EPOCH = Date.UTC(1989, 11, 31);

function isNull(value, baseType) {
  return (baseType === 0 || baseType === 2 || baseType === 10) && value === 255 ||
    (baseType === 4 || baseType === 11) && value === 65535 ||
    (baseType === 6 || baseType === 12) && value === 4294967295 ||
    baseType === 1 && value === -128 || baseType === 3 && value === -32768 || baseType === 5 && value === -2147483648;
}

function decodeScalar(buffer, offset, baseType, littleEndian) {
  const width = WIDTHS[baseType];
  if (!width || offset + width > buffer.length) return null;
  const method = littleEndian ? 'LE' : 'BE';
  const id = baseType & 31;
  let value;
  if (id === 0 || id === 2 || id === 10) value = buffer.readUInt8(offset);
  else if (id === 1) value = buffer.readInt8(offset);
  else if (id === 3) value = buffer[`readInt16${method}`](offset);
  else if (id === 4 || id === 11) value = buffer[`readUInt16${method}`](offset);
  else if (id === 5) value = buffer[`readInt32${method}`](offset);
  else if (id === 6 || id === 12) value = buffer[`readUInt32${method}`](offset);
  else if (id === 8) value = buffer[`readFloat${method}`](offset);
  else if (id === 9) value = buffer[`readDouble${method}`](offset);
  else if (id === 14) value = Number(buffer[`readBigInt64${method}`](offset));
  else if (id === 15 || id === 16) value = Number(buffer[`readBigUInt64${method}`](offset));
  else value = buffer.readUInt8(offset);
  return isNull(value, id) ? null : value;
}

function decodeField(buffer, offset, size, baseType, littleEndian) {
  const id = baseType & 31;
  if (id === 7) return buffer.subarray(offset, offset + size).toString('utf8').replace(/\0+$/, '');
  if (id === 13) return Array.from(buffer.subarray(offset, offset + size));
  const width = WIDTHS[id] || 1;
  const values = [];
  for (let cursor = offset; cursor < offset + size; cursor += width) values.push(decodeScalar(buffer, cursor, id, littleEndian));
  return values.length === 1 ? values[0] : values;
}

function fieldName(globalNum, fieldNum) { return FIELD_NAMES[globalNum]?.[fieldNum] || `field_${fieldNum}`; }

function transformValue(globalNum, fieldNum, value) {
  if (value === null || Array.isArray(value)) return value;
  if ([0, 1].includes(fieldNum) && globalNum === 20 && Number.isFinite(value)) return value * 180 / 2147483648;
  if ((fieldNum === 253 || (fieldNum === 2 && [18, 19].includes(globalNum))) && Number.isFinite(value)) return new Date(FIT_EPOCH + value * 1000).toISOString();
  if (fieldNum === 5 && globalNum === 20) return value / 100;
  if (fieldNum === 9 && [18, 19].includes(globalNum)) return value / 100;
  if ([7, 8].includes(fieldNum) && [18, 19].includes(globalNum)) return value / 1000;
  if ([13, 14].includes(fieldNum) && [18, 19].includes(globalNum)) return value / 1000;
  if ([6, 73].includes(fieldNum) && globalNum === 20) return value / 1000;
  if (fieldNum === 19 && globalNum === 20) return value / 1000;
  if ([2, 78].includes(fieldNum) && globalNum === 20) return value / 5 - 500;
  return value;
}

function parseFit(buffer) {
  const headerSize = buffer[0];
  const dataSize = buffer.readUInt32LE(4);
  const end = Math.min(buffer.length, headerSize + dataSize);
  const definitions = new Map();
  const messages = [];
  let offset = headerSize;
  let messageIndex = 0;
  while (offset < end) {
    const header = buffer[offset++];
    const compressed = Boolean(header & 0x80);
    const isDefinition = !compressed && Boolean(header & 0x40);
    const developerData = !compressed && Boolean(header & 0x20);
    const local = header & 0x0f;
    if (isDefinition) {
      if (offset + 5 > end) throw new Error('Definición FIT incompleta.');
      offset += 1;
      const littleEndian = buffer[offset++] === 0;
      const globalNum = littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset); offset += 2;
      const fieldCount = buffer[offset++];
      const fields = [];
      for (let i = 0; i < fieldCount; i++) fields.push({ num: buffer[offset++], size: buffer[offset++], baseType: buffer[offset++] });
      const developerFields = [];
      if (developerData) { const count = buffer[offset++]; for (let i = 0; i < count; i++) developerFields.push({ num: buffer[offset++], size: buffer[offset++], baseType: 13 }); }
      definitions.set(local, { globalNum, littleEndian, fields, developerFields });
      continue;
    }
    const definition = definitions.get(local);
    if (!definition) throw new Error(`No existe definición para el mensaje local ${local}.`);
    const fields = {};
    let fieldOffset = offset;
    for (const field of definition.fields) {
      const raw = decodeField(buffer, fieldOffset, field.size, field.baseType, definition.littleEndian);
      if (raw !== null && !(Array.isArray(raw) && raw.every(value => value === null))) fields[fieldName(definition.globalNum, field.num)] = { raw, value: transformValue(definition.globalNum, field.num, raw) };
      fieldOffset += field.size;
    }
    for (const field of definition.developerFields) fieldOffset += field.size;
    if (fieldOffset > end) throw new Error('Mensaje FIT incompleto.');
    if (MESSAGE_NAMES[definition.globalNum]) messages.push({ index: messageIndex++, globalNum: definition.globalNum, type: MESSAGE_NAMES[definition.globalNum], timestamp: fields.timestamp?.value || null, fields });
    offset = fieldOffset;
  }
  return messages;
}

module.exports = { parseFit, MESSAGE_NAMES };
