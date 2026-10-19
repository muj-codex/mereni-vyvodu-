import { openDB, type DBSchema } from 'idb';
import type { HistoryRecord } from '../core/types';
interface HistoryDB extends DBSchema {
  measurements: { key: string; value: HistoryRecord; indexes: { 'by-time': string } };
}
export function createHistory(name = 'mereni-vyvodu-v1') {
  const db = openDB<HistoryDB>(name, 2, {
    blocking() {
      // Release old tabs when a later app version upgrades the schema.
      void db.then((database) => database.close());
    },
    upgrade(database) {
      // Version 2 widens stored records. Existing v1 objects remain readable unchanged.
      if (!database.objectStoreNames.contains('measurements')) {
        const store = database.createObjectStore('measurements', { keyPath: 'id' });
        store.createIndex('by-time', 'savedAt');
      }
    },
  });
  return {
    async add(record: HistoryRecord) {
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
