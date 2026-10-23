import { DATABASE_NAME, DATABASE_VERSION, planImport, validateRecords } from './backup';
import { openDB, type DBSchema } from 'idb';
import type { HistoryRecord } from '../core/types';
interface HistoryDB extends DBSchema {
  measurements: { key: string; value: HistoryRecord; indexes: { 'by-time': string } };
}
export function createHistory(name = DATABASE_NAME) {
  const db = openDB<HistoryDB>(name, DATABASE_VERSION, {
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
    async merge(incoming: HistoryRecord[]) {
      // Validate the complete file before opening a write transaction; all additions are atomic.
      const valid = validateRecords(incoming);
      const tx = (await db).transaction('measurements', 'readwrite');
      try {
        const plan = planImport(await tx.store.getAll(), valid);
        for (const record of plan.additions) await tx.store.add(record);
        await tx.done;
        return { total: plan.total, added: plan.added, existing: plan.existing };
      } catch (error) {
        try {
          tx.abort();
        } catch {
          /* Transaction may have already aborted. */
        }
        await tx.done.catch(() => {});
        throw error;
      }
    },
    async all() {
      return (await (await db).getAll('measurements')).sort(
        (a, b) => recordTime(b) - recordTime(a) || (b.id ?? '').localeCompare(a.id ?? ''),
      );
    },
    async remove(id: string) {
      await (await db).delete('measurements', id);
    },
    async removeAllExplicitly() {
      const tx = (await db).transaction('measurements', 'readwrite');
      for (const key of await tx.store.getAllKeys()) await tx.store.delete(key);
      await tx.done;
    },
    async close() {
      (await db).close();
    },
  };
}

// Legacy rows may lack the indexed ISO timestamp. Read and sort without rewriting them.
function recordTime(record: HistoryRecord): number {
  const iso = Date.parse(record.savedAt);
  if (Number.isFinite(iso)) return iso;
  const local = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(
    record.localTimestamp ?? '',
  );
  if (local) return Date.UTC(+local[3], +local[2] - 1, +local[1], +local[4], +local[5], +local[6]);
  const date = Date.parse(record.input.identification?.date ?? '');
  return Number.isFinite(date) ? date : 0;
}
