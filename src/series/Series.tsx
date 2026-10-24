import { EnergisBoundary, type Boundary } from './EnergisBoundary';
import { SavedEnergis, SavedEnergisImport, usedEnergisBoundary } from './SavedEnergis';
import { seriesGroups } from './grouping';
import { roundsFor, roundLabel } from './rounds';
import type { SeriesRound } from './model';
import { readingTimeOffset } from './energisDisplay';
import { useEffect, useMemo, useRef, useState } from 'react';
import { locations } from '../core/current';
import { MtpSelect } from '../ui/MtpSelect';
import { MtpCoefficient } from '../ui/MtpCoefficient';
import { localTime, normalizeTime } from './model';
import { Info } from '../ui/Info';
import {
  intervalValues,
  blankEntry,
  emptySeries,
  latest,
  nextReading,
  resetEntry,
  resolveMeter,
  timestamp,
  type Entry,
  type Meter,
  type Reading,
  type SeriesData,
  type EnergisMeta,
} from './model';
import { createSeriesStore } from './store';
import { parseStylus } from './stylus';
import { importMetadata, parseEnergis } from './energis';
import { exportSelected } from './export';
type Mode = 'single' | 'series' | 'stylus' | 'history';
type Round = {
  date: string;
  time: string;
  value: string;
  energis: string;
  active: boolean;
  take: boolean;
  node: string;
  boundary: Boundary;
  import?: EnergisMeta;
  issue?: string;
};
function Input({
  label,
  value,
  onChange,
  type = 'text',
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (s: string) => void;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="series-field">
      <span>{label}</span>
      <input
        type={type}
        aria-label={label}
        value={value}
        readOnly={readOnly}
        inputMode={label.startsWith('UZEL') ? 'numeric' : undefined}
        onBlur={() => {
          if (label.includes('čas') || label.includes('Čas')) onChange?.(normalizeTime(value));
        }}
        onChange={(e) =>
          onChange?.(label.startsWith('UZEL') ? e.target.value.replace(/\D/g, '') : e.target.value)
        }
        autoComplete="off"
      />
      {!readOnly && (label.includes('čas') || label.includes('Čas')) && (
        <button type="button" onClick={() => onChange?.(localTime())}>
          TEĎ
        </button>
      )}
    </label>
  );
}
export function Series({
  initial = 'series',
  historyOnly = false,
  initialDetail = '',
  initialBatch = '',
  onModeChange,
}: {
  initial?: Mode;
  historyOnly?: boolean;
  initialDetail?: string;
  initialBatch?: string;
  onModeChange?: (mode: Exclude<Mode, 'history'>) => void;
}) {
  const repo = useMemo(() => createSeriesStore(), []);
  const [data, setData] = useState<SeriesData>(emptySeries);
  const [mode, setMode] = useState<Mode>(historyOnly ? 'history' : initial);
  const [vn, setVn] = useState(false);
  const [lastBatch, setLastBatch] = useState('');
  const [entry, setEntry] = useState<Entry>(blankEntry);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(false);
  const [batch, setBatch] = useState(initialBatch);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [roundIds, setRoundIds] = useState<string[]>([]);
  const [round, setRound] = useState<Record<string, Round>>({});
  const [roundDate, setRoundDate] = useState('');
  const [roundTime, setRoundTime] = useState('');
  const [initialRoundDate, setInitialRoundDate] = useState('');
  const [initialRoundTime, setInitialRoundTime] = useState('');
  const [firstRoundId, setFirstRoundId] = useState('');
  const [viewRoundId, setViewRoundId] = useState('');
  const visits = roundsFor(data, batch);
  const viewRound = visits.find((r) => r.roundId === viewRoundId);
  const visitReadings = viewRound
    ? data.readings.filter((r) => viewRound.entries.some((e) => e.readingId === r.id))
    : data.readings;
  const [dirtyEnergis, setDirtyEnergis] = useState<Record<string, boolean>>({});
  const markEnergisDraft = (id: string, dirty: boolean) =>
    setDirtyEnergis((current) => ({ ...current, [id]: dirty }));
  const [detail, setDetail] = useState(initialDetail);
  const file = useRef<HTMLInputElement>(null);
  const instanceId = useRef(crypto.randomUUID());
  const broadcast = () =>
    window.dispatchEvent(new CustomEvent('series-updated', { detail: instanceId.current }));
  const reload = async () => {
    const next = await repo.all();
    next.meters.sort(
      (a, b) =>
        a.location.localeCompare(b.location) ||
        a.serial.localeCompare(b.serial, 'cs', { numeric: true }),
    );
    setData(next);
  };
  useEffect(() => {
    const refresh = (event?: Event) => {
      if (event instanceof CustomEvent && event.detail === instanceId.current) return;
      void reload().catch((e) => setError(String(e)));
    };
    refresh();
    window.addEventListener('series-updated', refresh);
    return () => {
      window.removeEventListener('series-updated', refresh);
      void repo.close();
    };
  }, [repo]);
  useEffect(() => {
    if (!historyOnly) {
      setMode(initial);
      setRoundIds([]);
      setDetail('');
    }
  }, [initial, historyOnly]);
  useEffect(() => {
    if (initialBatch)
      setSelected(
        data.meters.filter((m) => m.batchId === initialBatch && m.active).map((m) => m.id),
      );
  }, [initialBatch, data.meters]);
  const saved = async () => {
    await reload();
    broadcast();
  };
  const openBatch = (id: string) => {
    setBatch(id);
    setViewRoundId('');
    setDetail('');
    setSearch('');
    setSelected(data.meters.filter((m) => m.batchId === id && m.active).map((m) => m.id));
  };
  const update = (key: keyof Entry, v: string) => setEntry((e) => ({ ...e, [key]: v }));
  const act = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const visible = data.meters.filter(
    (m) =>
      (!batch || m.batchId === batch) &&
      [m.serial, m.node, m.placement, m.location].some((v) =>
        v.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  const chosen = data.meters.filter((m) => selected.includes(m.id));
  const roundMeters = data.meters.filter((m) => roundIds.includes(m.id));
  const begin = (meters: Meter[], preset?: Entry) => {
    const date = preset?.date || roundDate;
    setRoundDate(date);
    setRoundTime('');
    meters = meters.filter((m) => m.active);
    const batchIds = [...new Set(meters.map((m) => m.batchId))];
    if (batchIds.length === 1) setBatch(batchIds[0]);
    setRoundIds(meters.map((m) => m.id));
    setDetail('');
    setRound(
      Object.fromEntries(
        meters.map((m) => [
          m.id,
          {
            date,
            time: preset?.time ?? '',
            value: preset?.value ?? '',
            energis: '',
            active: true,
            take: true,
            node: m.node,
            boundary: 'previous' as const,
          },
        ]),
      ),
    );
    setError('');
    setNotice('');
    window.scrollTo(0, 0);
  };
  const editRound = (id: string, patch: Partial<Round>) =>
    setRound((v) => ({ ...v, [id]: { ...v[id], ...patch } }));
  async function saveRound() {
    timestamp(roundDate, roundTime);
    const valid: { meter: Meter; previous: Reading; reading: Reading }[] = [];
    const failures: string[] = [];
    for (const m of roundMeters) {
      const r = { ...round[m.id], date: roundDate };
      if (!r.take) continue;
      try {
        const previous = latest(data.readings, m.id);
        if (!previous) throw Error('Chybí předchozí odečet.');
        const meta = r.import
          ? {
              ...r.import,
              offsetMinutes:
                r.date && r.time
                  ? Math.round(
                      (Date.parse(r.import.to) - Date.parse(timestamp(r.date, r.time))) / 60000,
                    )
                  : undefined,
            }
          : undefined;
        valid.push({
          meter: { ...m, node: r.node },
          previous,
          reading: nextReading(m, previous, { ...r, import: meta }),
        });
      } catch (e) {
        failures.push(`EM ${m.serial}: ${(e as Error).message}`);
      }
    }
    if (failures.length) throw Error(failures.join(' · '));
    const visits: SeriesRound[] = [...new Set(roundMeters.map((m) => m.batchId))].map((batchId) => {
      const roundId = crypto.randomUUID();
      const members = data.meters.filter((m) => m.batchId === batchId && m.active);
      return {
        roundId,
        batchId,
        roundDate,
        roundTime: normalizeTime(roundTime),
        entries: members.map((m) => {
          const row = valid.find((v) => v.meter.id === m.id);
          if (row) row.reading.roundId = roundId;
          return { meterId: m.id, ...(row ? { readingId: row.reading.id } : {}) };
        }),
      };
    });
    await repo.append(valid, visits);
    await reload();
    setRoundIds([]);
    setMode('history');
    setViewRoundId(visits.find((v) => v.batchId === batch)?.roundId ?? '');
    setNotice(`Uloženo ${valid.length} odečtů. Historie zůstává zachována.`);
    broadcast();
  }

  const renderResult = (r: Reading) => {
    const previous = data.readings.find((p) => p.id === r.previousId);
    const meter = data.meters.find((m) => m.id === r.meterId);
    if (!previous || !meter) return null;
    const values = intervalValues(meter, previous, r);
    return (
      <p>
        Rozdíl elektroměru: {values.registerDelta} kWh · po korekci MTP: {values.meterEnergy} kWh
        {r.energis === undefined ? (
          ' · SUMA ENERGIS nezadána'
        ) : (
          <>
            {' '}
            · SUMA ENERGIS: {r.energis} kWh · rozdíl {values.difference} kWh ·{' '}
            {values.percent === null ? '—' : values.percent.toFixed(2) + ' %'} ·{' '}
            {readingTimeOffset(r.import, r.date, r.time, r.boundary)}
            {r.boundary && <> · Použit Energis do {usedEnergisBoundary(r)}.</>}
          </>
        )}
      </p>
    );
  };
  return (
    <section className="series-workflow" aria-label="Odečtové série">
      {!historyOnly && (
        <div className="segmented">
          {(['single', 'series', 'stylus', 'history'] as Mode[]).map((v, i) => (
            <button
              key={v}
              className={mode === v ? 'active' : ''}
              onClick={() => {
                setMode(v);
                if (v !== 'history') onModeChange?.(v);
                setRoundIds([]);
                setDetail('');
              }}
            >
              {['Jednotlivý odečet', 'Série odečtů', 'STYLUS', 'Historie odečtů'][i]}
            </button>
          ))}
        </div>
      )}
      <h1>
        {roundIds.length
          ? 'Pokračovat dalším odečtem'
          : mode === 'history'
            ? 'Odečtové série'
            : mode === 'stylus'
              ? 'STYLUS'
              : mode === 'single'
                ? 'Jednotlivý odečet'
                : 'Série odečtů'}
      </h1>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {roundIds.length > 0 ? (
        <>
          <section className="card series-round-heading">
            <h2>{[...new Set(roundMeters.map((m) => m.location))].join(' · ')}</h2>
            <div className="round-common-fields">
              <Input
                label="Datum nového odečtu"
                type="date"
                value={roundDate}
                onChange={(date) => {
                  setRoundDate(date);
                  setRound((v) =>
                    Object.fromEntries(
                      Object.entries(v).map(([id, r]) => [id, r.take ? { ...r, date } : r]),
                    ),
                  );
                }}
              />
              <Input label="Čas kola" value={roundTime} onChange={setRoundTime} />
            </div>
            <p>{roundMeters.length} vybraných elektroměrů</p>
          </section>
          <p>Čas kola je společný čas návštěvy. Skutečný čas každého vývodu vyplňte zvlášť.</p>
          {roundMeters.map((m) => {
            const p = latest(data.readings, m.id);
            const r = { ...round[m.id], date: roundDate };
            let calculated: Reading | undefined;
            try {
              if (r.value && r.time && r.date) calculated = nextReading(m, p, r);
            } catch {}
            return (
              <article className={`card series-meter ${r.take ? '' : 'round-skipped'}`} key={m.id}>
                <Input label="UZEL" value={r.node} onChange={(node) => editRound(m.id, { node })} />
                <label className="optional-toggle">
                  <span>ODEČÍST</span>
                  <input
                    type="checkbox"
                    checked={r.take}
                    onChange={(e) => editRound(m.id, { take: e.target.checked })}
                  />
                </label>
                <h2>EM {m.serial}</h2>
                <p>
                  {m.location} · {m.placement} · UZEL {m.node || '—'}
                </p>
                <fieldset disabled>
                  <legend>Předchozí odečet – zamčeno</legend>
                  <div className="field-grid">
                    <Input label="Předchozí datum" value={p.date} readOnly />
                    <Input label="Předchozí čas" value={p.time} readOnly />
                    <Input label="Předchozí stav [kWh]" value={String(p.value)} readOnly />
                  </div>
                </fieldset>
                <fieldset disabled={!r.take}>
                  <legend>Nový odečet</legend>
                  <div className="field-grid">
                    <Input
                      label="Nový čas"
                      value={r.time}
                      onChange={(time) => editRound(m.id, { time })}
                    />
                    <Input
                      label="Nový stav [kWh]"
                      value={r.value}
                      onChange={(value) => editRound(m.id, { value })}
                    />
                    <Input
                      label="SUMA ENERGIS [kWh]"
                      value={r.energis}
                      onChange={(energis) =>
                        editRound(m.id, { energis, import: undefined, issue: undefined })
                      }
                    />
                  </div>
                  <EnergisBoundary
                    value={r.boundary}
                    onChange={(boundary) =>
                      editRound(m.id, {
                        boundary,
                        import: r.import ? { ...r.import, boundary } : undefined,
                      })
                    }
                  />
                </fieldset>
                <Info label="SUMA ENERGIS">
                  Součet za srovnávaný interval. Lze zadat ručně i bez UZLU. Ruční změna nahradí
                  importovanou hodnotu.
                </Info>
                {r.import && (
                  <p>
                    Energis: {r.import.from.replace('T', ' ')} → {r.import.to.replace('T', ' ')} ·
                    UZEL {r.import.node} · {r.import.sum} {r.import.unit} ·{' '}
                    {readingTimeOffset(r.import, r.date, r.time, r.boundary)} ·{' '}
                    {r.import.boundary === 'previous' ? 'předchozí' : 'následující'} hranice
                  </p>
                )}
                {r.issue && <p className="notice">{r.issue}</p>}
                {calculated && renderResult(calculated)}
                <label className="optional-toggle">
                  <span>Pokračovat dalším odečtem</span>
                  <input
                    type="checkbox"
                    checked={r.active}
                    onChange={(e) => editRound(m.id, { active: e.target.checked })}
                  />
                </label>
                <Info label="zatržítko pokračování">
                  Vypnutí ukončí sledování. Historie zůstává a elektroměr lze později znovu otevřít.
                </Info>
              </article>
            );
          })}
          <button className="button primary" disabled={busy} onClick={() => void act(saveRound)}>
            ULOŽIT VYPLNĚNÉ ODEČTY
          </button>
          <section className="card">
            <button
              className="button secondary"
              onClick={() => file.current?.click()}
              disabled={busy}
            >
              IMPORT SUMA ENERGIS
            </button>
            <p>Přiřazení podle čísla UZLU.</p>
            <Info label="IMPORT SUMA ENERGIS">
              Vyberte export XLSX nebo TXT. Podle UZLU se doplní pouze vybrané elektroměry.
              Konflikty zkontrolujte ručně. Hodnoty se bez výslovných metadat nepřepočítávají.
            </Info>
            <input
              hidden
              ref={file}
              type="file"
              accept=".xlsx,.txt,.csv,.tsv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f)
                  void act(async () => {
                    const importMeters = roundMeters
                      .filter((m) => round[m.id].take)
                      .map((m) => ({ ...m, node: round[m.id].node }));
                    const results = await parseEnergis(f, importMeters);
                    setRound((current) => {
                      const next = { ...current };
                      for (const m of importMeters) {
                        const found = results.find((r) => r.node === m.node);
                        const prev = current[m.id];
                        if (importMeters.filter((other) => other.node === m.node).length > 1)
                          next[m.id] = { ...prev, issue: 'Nejednoznačný UZEL – ruční kontrola.' };
                        else if (!m.node)
                          next[m.id] = { ...prev, issue: 'Bez UZLU – doplňte Energis ručně.' };
                        else if (found) {
                          const meta = importMetadata(
                            found,
                            f.name,
                            prev.boundary,
                            prev.date && prev.time ? `${prev.date}T${prev.time}` : '',
                          );
                          if (meta && prev.energis.trim())
                            next[m.id] = {
                              ...prev,
                              issue: 'SUMA již vyplněna – import ji nepřepsal. Ruční kontrola.',
                            };
                          else
                            next[m.id] = {
                              ...prev,
                              energis: meta ? String(meta.sum) : prev.energis,
                              import: meta ?? prev.import,
                              issue: found.issue,
                            };
                        }
                      }
                      return next;
                    });
                  });
              }}
            />
          </section>
          <button
            className="button secondary"
            onClick={() => {
              setRoundIds([]);
              setMode('history');
            }}
          >
            Zpět do historie
          </button>
        </>
      ) : detail ? (
        <>
          {(() => {
            const m = data.meters.find((m) => m.id === detail);
            if (!m) return <p role="status">Načítám historii elektroměru…</p>;
            return (
              <article className="card">
                <h2>UZEL {m.node || 'neuveden'}</h2>
                <p>Elektroměr {m.serial}</p>
                <p>
                  {m.location} · {m.placement}
                </p>
                <p>{m.active ? 'Sledování: AKTIVNÍ' : 'Sledování: UKONČENO'}</p>
                {data.readings
                  .filter((r) => r.meterId === m.id)
                  .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
                  .map((r) => (
                    <section key={r.id}>
                      <h3>
                        {r.date} {r.time} – {r.value} kWh
                      </h3>
                      {renderResult(r)}
                      <SavedEnergis
                        reading={r}
                        repo={repo}
                        onSaved={saved}
                        onDraft={markEnergisDraft}
                      />
                      {r.import && (
                        <p>
                          Energis: {r.import.from} → {r.import.to} · {r.import.file}
                        </p>
                      )}
                    </section>
                  ))}
                {m.active ? (
                  <button className="button primary" onClick={() => begin([m])}>
                    POKRAČOVAT DALŠÍM ODEČTEM
                  </button>
                ) : (
                  <button
                    className="button primary"
                    onClick={() =>
                      void act(async () => {
                        await repo.reactivate(m.id);
                        await reload();
                        broadcast();
                      })
                    }
                  >
                    ZNOVU AKTIVOVAT SLEDOVÁNÍ
                  </button>
                )}
                <button className="button secondary" onClick={() => setDetail('')}>
                  Zpět na sérii
                </button>
              </article>
            );
          })()}
        </>
      ) : mode === 'history' ? (
        <>
          {!batch ? (
            <div>
              {seriesGroups(data).map(({ batch: b, at }) => (
                <button
                  className="card series-batch"
                  key={b.id}
                  onClick={() => {
                    openBatch(b.id);
                  }}
                >
                  <strong>Odečtová série · {b.location}</strong>
                  <span>
                    {at.replace('T', ' ')} · {data.meters.filter((m) => m.batchId === b.id).length}{' '}
                    elektroměrů
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <button
              className="text-button"
              onClick={() => {
                setBatch('');
                setSelected([]);
              }}
            >
              Všechny série
            </button>
          )}
          {batch ? (
            <nav className="series-dates" aria-label="Odečtová kola">
              <button type="button" aria-pressed={!viewRound} onClick={() => setViewRoundId('')}>
                Aktuální stavy
              </button>
              {visits.map((v) => (
                <button
                  type="button"
                  key={v.roundId}
                  aria-pressed={viewRoundId === v.roundId}
                  onClick={() => setViewRoundId(v.roundId)}
                >
                  {roundLabel(v)}
                </button>
              ))}
            </nav>
          ) : (
            <Input
              label="Vyhledat UZEL / pole / číslo elektroměru"
              value={search}
              onChange={setSearch}
            />
          )}
          {viewRound?.legacy && (
            <p>
              Starší data: přehled dne podle skutečných odečtů; původní kola stejného dne nelze
              spolehlivě rozlišit.
            </p>
          )}
          <div className="step-actions">
            <button
              className="button secondary"
              onClick={() =>
                setSelected((ids) => [...new Set([...ids, ...visible.map((m) => m.id)])])
              }
            >
              Vybrat vše
            </button>
            <button className="button secondary" onClick={() => setSelected([])}>
              Zrušit výběr
            </button>
          </div>
          <p>
            Vybráno {chosen.length} z {data.meters.length}
          </p>
          {visible.map((m) => {
            const r = latest(visitReadings, m.id);
            const skipped =
              !!viewRound && viewRound.entries.some((e) => e.meterId === m.id && !e.readingId);
            const readings = viewRound
              ? visitReadings
                  .filter((r) => r.meterId === m.id)
                  .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
              : r
                ? [r]
                : [];
            return (
              <article key={m.id} className="card series-meter">
                <label className="optional-toggle">
                  <span>
                    <strong>
                      {m.placement} · EM {m.serial}
                    </strong>
                    <br />
                    {m.location} · UZEL {m.node || '—'}
                  </span>
                  <input
                    aria-label={`Vybrat EM ${m.serial}`}
                    type="checkbox"
                    checked={selected.includes(m.id)}
                    onChange={(e) =>
                      setSelected((ids) =>
                        e.target.checked ? [...ids, m.id] : ids.filter((id) => id !== m.id),
                      )
                    }
                  />
                </label>
                {skipped && (
                  <p>Přeskočeno · {m.active ? 'Sledování: AKTIVNÍ' : 'Sledování: UKONČENO'}</p>
                )}
                {viewRound && !viewRound.entries.some((e) => e.meterId === m.id) && (
                  <p>Vývod nebyl součástí kola.</p>
                )}
                {readings.map((r) => (
                  <section key={r.id}>
                    <p>
                      {r?.date} {r?.time} · {r?.value} kWh ·{' '}
                      {m.active ? 'Sledování: AKTIVNÍ' : 'Sledování: UKONČENO'}
                    </p>
                    {batch && r?.previousId && (
                      <>
                        {renderResult(r)}
                        <SavedEnergis
                          reading={r}
                          repo={repo}
                          onSaved={saved}
                          onDraft={markEnergisDraft}
                        />
                      </>
                    )}
                  </section>
                ))}
                {skipped &&
                  (() => {
                    const priorIds = new Set(
                      visits
                        .slice(
                          0,
                          visits.findIndex((v) => v.roundId === viewRound!.roundId),
                        )
                        .flatMap((v) =>
                          v.entries.flatMap((e) => (e.readingId ? [e.readingId] : [])),
                        ),
                    );
                    const previous = latest(
                      data.readings.filter((r) => priorIds.has(r.id)),
                      m.id,
                    );
                    return (
                      previous && (
                        <p>
                          Poslední skutečný odečet: {previous.date} {previous.time} ·{' '}
                          {previous.value} kWh
                        </p>
                      )
                    );
                  })()}
                <button className="button secondary" onClick={() => setDetail(m.id)}>
                  Historie EM {m.serial}
                </button>
              </article>
            );
          })}
          <button
            className="button primary"
            disabled={!chosen.some((m) => m.active)}
            onClick={() => begin(chosen.filter((m) => m.active))}
          >
            POKRAČOVAT DALŠÍM ODEČTEM
          </button>
          {batch && (
            <SavedEnergisImport
              meters={data.meters.filter((m) => m.batchId === batch)}
              readings={visitReadings}
              repo={repo}
              onSaved={saved}
              protectedIds={Object.keys(dirtyEnergis).filter((id) => dirtyEnergis[id])}
            />
          )}
          <Info label="POKRAČOVAT DALŠÍM ODEČTEM">
            Otevře všechny vybrané elektroměry na jedné stránce. Předchozí hodnoty zůstávají
            zamčené.
          </Info>
          <div className="step-actions">
            {(['xlsx', 'txt'] as const).map((f) => (
              <button
                key={f}
                className="button secondary"
                disabled={busy || !chosen.length}
                onClick={() => void act(() => exportSelected(chosen, data, f))}
              >
                EXPORTOVAT VYBRANÉ {f.toUpperCase()}
              </button>
            ))}
          </div>
          <Info label="export vybraných">
            Exportuje úplnou historii vybraných elektroměrů včetně intervalů a Energis.
          </Info>
        </>
      ) : (
        <>
          {mode === 'stylus' && (
            <section className="card">
              <Info label="STYLUS">
                Pište Apple Pencil do velkého pole. Scribble převádí rukopis na text. Údaje mohou
                být v různém pořadí: TS, pole, UZEL, EM, datum, čas, stav, OD a DO. Například:
                TS3831/257 11P U21208142 EM12345678 22.10.2026 8:37 stav 23456. Nebo: U21208142
                EM12345678 29.10.2026 9:12 stav 24110. Podle UZLU/EM najdeme poslední odečet. Údaje
                opravíte v náhledu a převedete do běžného formuláře. Nic se neukládá bez kontroly.
              </Info>
              <label className="series-field">
                Volný zápis STYLUS
                <textarea
                  rows={7}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="TS3831/257 11P U21208142 EM12345678 22.10.2026 8:37 stav 23456"
                />
              </label>
              <button
                className="button secondary"
                onClick={() => {
                  const parsed = parseStylus(text);
                  const matched = [...locations(false), ...locations(true)].find(
                    (v) =>
                      v.replace(/\s/g, '').toLowerCase() ===
                      parsed.location
                        .replace(/\s/g, '')
                        .replace(/^(?=\d)/, 'TS')
                        .toLowerCase(),
                  );
                  setVn((matched || parsed.location).startsWith('R'));
                  setEntry({ ...parsed, location: matched || parsed.location });
                  setPreview(true);
                }}
              >
                ROZPOZNAT ÚDAJE
              </button>
            </section>
          )}
          {(mode !== 'stylus' || preview) && (
            <section className="card">
              <h2>{mode === 'stylus' ? 'Náhled – zkontrolujte údaje' : 'První dílčí odečet'}</h2>
              <div className="field-grid">
                <Input
                  label="Datum kola"
                  type="date"
                  value={initialRoundDate}
                  onChange={setInitialRoundDate}
                />
                <Input label="Čas kola" value={initialRoundTime} onChange={setInitialRoundTime} />
              </div>
              <div className="field-grid">
                <label className="series-field">
                  Napětí
                  <select
                    aria-label="Napětí"
                    value={vn ? 'VN' : 'NN'}
                    onChange={(e) => {
                      const next = e.target.value === 'VN';
                      setVn(next);
                      update('location', locations(next)[0]);
                    }}
                  >
                    <option>NN</option>
                    <option>VN</option>
                  </select>
                </label>
                {(
                  [
                    ['node', 'UZEL (nepovinný)'],
                    ['location', 'TS / rozvodna'],
                    ['placement', 'Pole / kobka / umístění'],
                    ['serial', 'Číslo elektroměru'],
                    ['date', 'Datum odečtu'],
                    ['time', 'Čas odečtu (HH:MM)'],
                    ['value', 'Stav elektroměru [kWh]'],
                  ] as [keyof Entry, string][]
                ).map(([key, label]) =>
                  key === 'location' ? (
                    <label className="series-field" key={key}>
                      {label}
                      <select
                        aria-label={label}
                        value={entry.location}
                        onChange={(e) => update(key, e.target.value)}
                      >
                        <option value="">Vyberte TS / rozvodnu</option>
                        {!locations(vn).includes(entry.location) && entry.location && (
                          <option>{entry.location}</option>
                        )}
                        {locations(vn).map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <Input
                      key={key}
                      label={label}
                      value={entry[key]}
                      type={key === 'date' ? 'date' : 'text'}
                      onChange={(v) => update(key, v)}
                    />
                  ),
                )}
              </div>
              <div className="field-grid">
                <MtpSelect
                  label="MTP primár"
                  secondary={vn ? 1 : 5}
                  value={Number(entry.actualMtp)}
                  onChange={(v) => update('actualMtp', String(v))}
                />
                <MtpSelect
                  label="MTP elektroměr"
                  secondary={vn ? 1 : 5}
                  value={Number(entry.meterMtp)}
                  onChange={(v) => update('meterMtp', String(v))}
                />
                {entry.actualMtp !== entry.meterMtp && (
                  <MtpCoefficient
                    primary={Number(entry.actualMtp)}
                    meter={Number(entry.meterMtp)}
                  />
                )}
              </div>
              <Info label="UZEL">
                Nepovinné číslice, alespoň 15 číslic je podporováno. Slouží pro párování Energisu;
                UZEL patří k vývodu a je nezávislý na výměně elektroměru.
              </Info>
              {mode === 'stylus' ? (
                <>
                  <p>
                    {(() => {
                      try {
                        return resolveMeter(data.meters, entry.serial, entry.node)
                          ? 'Nalezen existující elektroměr – pokračovat dalším odečtem. Předchozí odečet nalezen: ANO'
                          : 'Nový elektroměr – první odečet. Předchozí odečet nalezen: NE';
                      } catch (e) {
                        return (e as Error).message;
                      }
                    })()}
                  </p>
                  <button
                    className="button primary"
                    onClick={() => {
                      try {
                        const m = resolveMeter(data.meters, entry.serial, entry.node);
                        if (m) {
                          begin([m], entry);
                        } else {
                          setMode('single');
                          onModeChange?.('single');
                          setPreview(false);
                        }
                        setError('');
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    PŘEVÉST DO ODEČTU
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        const currentBatch = data.batches.find(
                          (b) => b.id === lastBatch && b.location === entry.location.trim(),
                        );
                        timestamp(initialRoundDate, initialRoundTime);
                        const created = await repo.first(entry, currentBatch?.id, {
                          roundDate: initialRoundDate,
                          roundTime: normalizeTime(initialRoundTime),
                          ...(currentBatch && firstRoundId ? { roundId: firstRoundId } : {}),
                        });
                        setFirstRoundId(created.round.roundId);
                        setLastBatch(created.batch.id);
                        setData((current) => ({
                          ...current,
                          batches: current.batches.some((b) => b.id === created.batch.id)
                            ? current.batches
                            : [...current.batches, created.batch],
                          meters: [...current.meters, created.meter].sort(
                            (a, b) =>
                              a.location.localeCompare(b.location) ||
                              a.serial.localeCompare(b.serial, 'cs', { numeric: true }),
                          ),
                          readings: [...current.readings, created.reading],
                          rounds: [
                            ...(current.rounds ?? []).filter(
                              (r) => r.roundId !== created.round.roundId,
                            ),
                            created.round,
                          ],
                        }));
                        broadcast();
                        setEntry(resetEntry(entry));
                        setNotice('Dílčí odečet uložen. Připraveno pro další elektroměr.');
                      })
                    }
                  >
                    ULOŽIT DÍLČÍ ODEČET
                  </button>
                  <button
                    className="button secondary"
                    disabled={!lastBatch}
                    onClick={() => {
                      openBatch(lastBatch);
                      setMode('history');
                      setDetail('');
                    }}
                  >
                    DOKONČIT DÍLČÍ ODEČET
                  </button>
                  <Info label="ULOŽIT DÍLČÍ ODEČET">
                    Uloží první stav bez druhého odečtu. TS a datum zůstanou, ostatní pracovní pole
                    se vyčistí. Pokračování najdete v historii.
                  </Info>
                </>
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}
