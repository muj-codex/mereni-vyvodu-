import { openDB, type DBSchema } from 'idb';
import type { MeasurementRecord } from '../core/types';
interface HistoryDB extends DBSchema {
  measurements: { key: string; value: MeasurementRecord; indexes: { 'by-time': string } };
}
export function createHistory(name = 'mereni-vyvodu-v1') {
  const db = openDB<HistoryDB>(name, 1, {
    upgrade(database) {
      const store = database.createObjectStore('measurements', { keyPath: 'id' });
      store.createIndex('by-time', 'savedAt');
    },
  });
  return {
    async add(record: MeasurementRecord) {
      const tx = (await db).transaction('measurements', 'readwrite');
      await Promise.all([tx.store.add(structuredClone(record)), tx.done]);
    },
    async all() {
      return (await (await db).getAllFromIndex('measurements', 'by-time')).reverse();
    },
    async remove(id: string) {
      await (await db).delete('measurements', id);
    },
    async clear() {
      await (await db).clear('measurements');
    },
    async close() {
      (await db).close();
    },
  };
}
