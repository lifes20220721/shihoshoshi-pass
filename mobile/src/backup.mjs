export function allowedKey(key, config) {
  return key.startsWith(config.storagePrefix) || key === `pass-demo:${config.id}`;
}
export function exportBackup(storage, config) {
  const values = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (allowedKey(key, config)) values[key] = storage.getItem(key);
  }
  return {format: 'pass-native-backup', version: 1, app: config.id, created: new Date().toISOString(), values};
}
export function validateBackup(text, config) {
  if (text.length > 10_000_000) throw Error('バックアップのサイズが大きすぎます。');
  const payload = JSON.parse(text);
  if (payload.format !== 'pass-native-backup' || payload.version !== 1 || payload.app !== config.id || !payload.values || Array.isArray(payload.values)) throw Error('このアプリのバックアップではありません。');
  for (const [key, value] of Object.entries(payload.values)) {
    if (!allowedKey(key, config) || typeof value !== 'string') throw Error('バックアップに対応していないデータが含まれています。');
    JSON.parse(value);
  }
  return payload.values;
}
export function restoreBackup(storage, values) {
  const before = new Map(Object.keys(values).map(key => [key, storage.getItem(key)]));
  try { for (const [key, value] of Object.entries(values)) storage.setItem(key, value); }
  catch (error) { for (const [key, value] of before) value === null ? storage.removeItem(key) : storage.setItem(key, value); throw error; }
}
