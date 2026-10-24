import type { Page } from '@playwright/test';
import { createIntervalCheck } from '../src/core/intervalCheck';
import { resetInterval } from '../src/core/measurement';

// Archived standalone checks remain readable/restorable, but the main UI no longer
// creates them. Seed that legacy fixture explicitly for compatibility-only tests.
export async function seedLegacyIntervalFromDraft(page: Page) {
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('mereni-draft-v1')!));
  const record = createIntervalCheck(draft);
  await page.evaluate(
    async ({ record, draft }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('mereni-vyvodu-v1');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('measurements', 'readwrite');
          tx.objectStore('measurements').add(record);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
      localStorage.setItem('mereni-draft-v1', JSON.stringify(draft));
    },
    { record, draft: { ...draft, interval: resetInterval(draft.interval) } },
  );
  await page.reload();
}
