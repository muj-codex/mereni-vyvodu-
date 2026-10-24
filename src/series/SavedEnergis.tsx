import { useEffect, useRef, useState } from 'react';
import { EnergisBoundary, EnergisHelp, type Boundary } from './EnergisBoundary';
import { readingTimeOffset } from './energisDisplay';
import { timestamp, type Meter, type Reading } from './model';
import { planSavedEnergis } from './energisImport';
import type { createSeriesStore } from './store';
export type SeriesRepo = ReturnType<typeof createSeriesStore>;
export function usedEnergisBoundary(reading: Reading) {
  if (reading.import) return reading.import.to.replace('T', ' ');
  const offset = readingTimeOffset(undefined, reading.date, reading.time, reading.boundary);
  if (!offset) return '';
  const minutes = Number(offset.split(' ')[0]);
  return new Date(Date.parse(timestamp(reading.date, reading.time) + 'Z') + minutes * 60000)
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ');
}
export function SavedEnergis({
  reading,
  repo,
  onSaved,
  onDraft,
}: {
  reading: Reading;
  onDraft?: (id: string, dirty: boolean) => void;
  repo: SeriesRepo;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(reading.energis === undefined ? '' : String(reading.energis));
  const [boundary, setBoundary] = useState<Boundary>(
    reading.boundary ?? reading.import?.boundary ?? 'previous',
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setValue(reading.energis === undefined ? '' : String(reading.energis));
    setBoundary(reading.boundary ?? reading.import?.boundary ?? 'previous');
  }, [reading.id, reading.energis, reading.boundary, reading.energisUpdatedAt]);
  useEffect(() => () => onDraft?.(reading.id, false), [reading.id]);
  if (!reading.previousId) return null;
  const preview = { ...reading, boundary, import: reading.import };
  return (
    <section
      className="saved-energis"
      aria-label={`Energis intervalu ${reading.date} ${reading.time}`}
    >
      <label className="series-field">
        <span>SUMA ENERGIS [kWh]</span>
        <input
          aria-label="SUMA ENERGIS [kWh]"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onDraft?.(reading.id, true);
          }}
        />
      </label>
      <EnergisBoundary
        value={boundary}
        onChange={(next) => {
          setBoundary(next);
          onDraft?.(reading.id, true);
        }}
      />
      <p>
        {readingTimeOffset(preview.import, reading.date, reading.time, boundary)} · Použit Energis
        do {usedEnergisBoundary(preview)}.
      </p>
      <button
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage('');
          try {
            await repo.updateEnergis([
              {
                reading,
                energis: value,
                boundary,
                import:
                  value === String(reading.energis) && reading.import
                    ? { ...reading.import, boundary }
                    : undefined,
              },
            ]);
            await onSaved();
            onDraft?.(reading.id, false);
            setMessage('Energis uložen.');
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        ULOŽIT SUMA ENERGIS
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
export function SavedEnergisImport({
  meters,
  readings,
  protectedIds = [],
  repo,
  onSaved,
}: {
  meters: Meter[];
  readings: Reading[];
  protectedIds?: string[];
  repo: SeriesRepo;
  onSaved: () => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const protectedRef = useRef(protectedIds);
  protectedRef.current = protectedIds;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <section className="saved-energis-import">
      <button className="button secondary" disabled={busy} onClick={() => input.current?.click()}>
        IMPORT SUMA ENERGIS
      </button>
      <p>Přiřazení podle čísla UZLU.</p>
      <p>Doplní poslední uložený interval každého vývodu. Již vyplněné hodnoty zachová.</p>
      <EnergisHelp />
      <input
        hidden
        aria-label="Import SUMA ENERGIS soubor"
        ref={input}
        type="file"
        accept=".xlsx,.txt,.csv,.tsv"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file || busy) return;
          setBusy(true);
          setMessage('');
          try {
            const plan = await planSavedEnergis(file, meters, readings);
            const protectedUpdates = plan.updates.filter((u) =>
              protectedRef.current.includes(u.reading.id),
            );
            for (const update of protectedUpdates)
              plan.issues.push(
                `EM ${meters.find((m) => m.id === update.reading.meterId)?.serial}: SUMA ručně rozepsána – import ji nepřepsal.`,
              );
            const count = await repo.updateEnergis(
              plan.updates.filter((u) => !protectedRef.current.includes(u.reading.id)),
              true,
            );
            await onSaved();
            setMessage([`Importováno ${count} intervalů.`, ...plan.issues].join(' · '));
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {message && <p role="status">{message}</p>}
    </section>
  );
}
