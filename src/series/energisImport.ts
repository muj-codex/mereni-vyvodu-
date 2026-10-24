import { importMetadata, parseEnergis } from './energis';
import { latest, type Meter, type Reading } from './model';
// The original parser determines sums. This adapter only selects saved intervals by UZEL.
export async function planSavedEnergis(file: File, meters: Meter[], readings: Reading[]) {
  const imported = await parseEnergis(file, meters);
  const updates: {
    reading: Reading;
    energis: string;
    boundary: 'previous' | 'next';
    import: NonNullable<Reading['import']>;
  }[] = [];
  const issues: string[] = [];
  for (const meter of meters) {
    const reading = latest(readings, meter.id);
    const label = `EM ${meter.serial}`;
    if (!meter.node) {
      issues.push(`${label}: bez UZLU – doplňte ručně.`);
      continue;
    }
    if (meters.filter((m) => m.node === meter.node).length !== 1) {
      issues.push(`${label}: nejednoznačný UZEL.`);
      continue;
    }
    if (!reading?.previousId) {
      issues.push(`${label}: zatím neexistuje interval A → B.`);
      continue;
    }
    if (reading.energis !== undefined) {
      issues.push(`${label}: SUMA již vyplněna – import ji nepřepsal.`);
      continue;
    }
    const found = imported.find((r) => r.node === meter.node);
    const boundary = reading.boundary ?? reading.import?.boundary ?? 'previous';
    const meta =
      found && importMetadata(found, file.name, boundary, `${reading.date}T${reading.time}`);
    if (!meta) {
      issues.push(`${label}: ${found?.issue || 'UZEL v importu nenalezen'}`);
      continue;
    }
    updates.push({ reading, energis: String(meta.sum), boundary, import: meta });
  }
  return { updates, issues };
}
