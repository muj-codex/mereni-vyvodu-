import { useState } from 'react';
import { PHASES, phaseColor } from '../core/config';
import {
  currentOptions,
  emptyCurrent,
  evaluateCurrent,
  RANGES,
  signedPercent,
  type CurrentDraft,
  type CurrentRecord,
  type ClampRange,
  type InputUnit,
} from '../core/current';
import { formatNumber } from '../core/numbers';
import { IdentificationFields, IdentificationSummary } from './Identification';
import { Field, SelectField } from './Fields';
const pairs = ['L1–L2', 'L1–L3', 'L2–L3'];
export function CurrentResult({ record }: { record: CurrentRecord }) {
  return (
    <>
      <IdentificationSummary serial={record.input.serial} value={record.input.identification} />
      <h2>Proudové měření {record.input.vn ? 'VN · SCADA' : 'NN · měřený proud'}</h2>
      <p>
        <strong>
          MTP {record.input.ctPrimary}/{record.input.ctSecondary} A · Kyoritsu 8112 – rozsah{' '}
          {record.input.range}
        </strong>
      </p>
      <div className="phase-inputs">
        {record.phases.map((p, i) => (
          <section className="card" key={i}>
            <h3 className="current-phase" style={{ backgroundColor: phaseColor(i as 0 | 1 | 2) }}>
              L{i + 1}
            </h3>
            <dl className="current-values">
              <dt>Primár ({p.source})</dt>
              <dd>{formatNumber(p.primary, 1)} A</dd>
              <dt>Očekávaný sekundár</dt>
              <dd>
                {formatNumber(p.expectedA * 1000, 1)} mA / {formatNumber(p.expectedA, 3)} A
              </dd>
              <dt>Vstup multimetru</dt>
              <dd>
                {p.raw} {p.unit} ({formatNumber(p.millivolts, 3)} mV)
              </dd>
              <dt>Rozsah</dt>
              <dd>{p.range}</dd>
              <dt>Skutečný sekundár</dt>
              <dd>
                {formatNumber(p.secondaryMA, 1)} mA / {formatNumber(p.secondaryA, 3)} A
              </dd>
              <dt>Přepočtený primár</dt>
              <dd>{formatNumber(p.primaryFromSecondary, 1)} A</dd>
              <dt>Rozdíl</dt>
              <dd className="main-percent">{signedPercent(p.differencePercent)}</dd>
            </dl>
            {p.differencePercent === null && (
              <p className="hint">Při nulové referenci nelze procentní rozdíl určit.</p>
            )}
          </section>
        ))}
      </div>
      {record.voltage && (
        <section className="card">
          <h3>Doplňková diagnostika napětí</h3>
          <p>Primár: {record.voltage.source}</p>
          {pairs.map((pair, i) => (
            <p key={pair}>
              {pair}: primár <b>{formatNumber(record.voltage!.primary[i], 1)} V</b> · sekundár{' '}
              <b>{formatNumber(record.voltage!.secondary[i], 1)} V</b> (
              {record.voltage!.input.secondaryEdited[i] ? 'ručně upraveno' : 'výchozí hodnota'})
            </p>
          ))}
          <p>{record.voltage.diagnosis}</p>
        </section>
      )}
    </>
  );
}
function restore(): CurrentDraft {
  try {
    const d = JSON.parse(localStorage.getItem('mereni-current-draft-v1') ?? 'null');
    if (d?.phases?.length === 3 && d.identification && d.voltage) return d;
  } catch {
    /* retain session */
  }
  return emptyCurrent();
}
export function CurrentMeasurement({
  onSave,
  notify,
}: {
  onSave: (r: CurrentRecord) => Promise<void>;
  notify: (s: string) => void;
}) {
  const [draft, setDraft] = useState<CurrentDraft>(restore),
    [result, setResult] = useState<CurrentRecord | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  function change(d: CurrentDraft) {
    setDraft(d);
    setResult(null);
    setError('');
    try {
      localStorage.setItem('mereni-current-draft-v1', JSON.stringify(d));
    } catch {
      /* saving history still available */
    }
  }
  function evaluate() {
    try {
      const r = evaluateCurrent(draft);
      setResult(r);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function save() {
    if (!result || busy) return;
    setBusy(true);
    try {
      await onSave(result);
      change(emptyCurrent(draft.vn));
      notify('Proudové měření uloženo.');
    } catch (e) {
      setError(`Měření nebylo uloženo. ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Proudová diagnostika NN / VN</h1>
      <label className="check-label card">
        <input
          type="checkbox"
          checked={draft.vn}
          onChange={(e) => {
            const vn = e.target.checked;
            change({
              ...draft,
              vn,
              ctPrimary: currentOptions(vn).some((ct) => ct.primary === draft.ctPrimary)
                ? draft.ctPrimary
                : 300,
              identification: {
                ...draft.identification,
                location: emptyCurrent(vn).identification.location,
              },
              voltage: {
                ...draft.voltage,
                primary: vn ? ['10', '10', '10'] : ['', '', ''],
                preset: '10',
              },
            });
          }}
        />{' '}
        VN
      </label>
      <IdentificationFields
        serial={draft.serial}
        value={draft.identification}
        vn={draft.vn}
        onSerial={(serial) => change({ ...draft, serial })}
        onChange={(identification) => change({ ...draft, identification })}
      />
      <section className="card">
        <div className="field-grid">
          <SelectField
            label="MTP"
            value={draft.ctPrimary}
            onChange={(v) => change({ ...draft, ctPrimary: Number(v) })}
          >
            {currentOptions(draft.vn).map((ct) => (
              <option key={ct.primary} value={ct.primary}>
                {ct.primary}/{ct.secondary} A
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Rozsah Kyoritsu 8112"
            value={draft.range}
            onChange={(v) => change({ ...draft, range: v as ClampRange })}
          >
            {Object.keys(RANGES).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </SelectField>
        </div>
        <h3>Kyoritsu 8112 – rozsah {draft.range}</h3>
        <p className="hint">
          Nastavte stejný rozsah jako na fyzickém přepínači.{' '}
          {draft.vn ? 'Primární proud ze SCADA.' : 'Primární proud měřte velkými kleštěmi.'}
        </p>
      </section>
      <div className="phase-inputs">
        {PHASES.map((i) => (
          <section className="card" key={i}>
            <h3
              className="current-phase"
              data-phase={`I${i + 1}`}
              style={{ backgroundColor: phaseColor(i) }}
            >
              L{i + 1}
            </h3>
            <Field
              label={`Primár L${i + 1}${draft.vn ? ' SCADA' : ''}`}
              unit="A"
              value={draft.phases[i].primary}
              onChange={(v) =>
                change({
                  ...draft,
                  phases: draft.phases.map((p, j) =>
                    i === j ? { ...p, primary: v } : p,
                  ) as CurrentDraft['phases'],
                })
              }
            />
            <Field
              label={`Multimetr L${i + 1}`}
              value={draft.phases[i].raw}
              onChange={(v) =>
                change({
                  ...draft,
                  phases: draft.phases.map((p, j) =>
                    i === j ? { ...p, raw: v } : p,
                  ) as CurrentDraft['phases'],
                })
              }
            />
            <SelectField
              label={`Jednotka L${i + 1}`}
              value={draft.phases[i].unit}
              onChange={(v) =>
                change({
                  ...draft,
                  phases: draft.phases.map((p, j) =>
                    i === j ? { ...p, unit: v as InputUnit } : p,
                  ) as CurrentDraft['phases'],
                })
              }
            >
              <option>mV</option>
              <option>V</option>
            </SelectField>
          </section>
        ))}
      </div>
      <label className="check-label card">
        <input
          type="checkbox"
          checked={draft.voltageEnabled}
          onChange={(e) => change({ ...draft, voltageEnabled: e.target.checked })}
        />{' '}
        PŘIDAT MĚŘENÍ NAPĚTÍ
      </label>
      <fieldset className="card voltage-fields" disabled={!draft.voltageEnabled}>
        <legend>Napětí mezi fázemi</legend>
        {draft.vn && (
          <>
            <p>Primární VN napětí pouze ze SCADA. Nikdy neměřte multimetrem přímo na VN.</p>
            <SelectField
              label="Primární napětí SCADA"
              value={draft.voltage.preset}
              onChange={(v) =>
                change({
                  ...draft,
                  voltage: {
                    ...draft.voltage,
                    preset: v,
                    primary: v === 'custom' ? draft.voltage.primary : [v, v, v],
                  },
                })
              }
            >
              <option value="6">6 kV</option>
              <option value="10">10 kV</option>
              <option value="10.3">10,3 kV</option>
              <option value="custom">VLASTNÍ</option>
            </SelectField>
          </>
        )}
        <div className="phase-inputs">
          {pairs.map((pair, i) => (
            <div key={pair}>
              <Field
                label={`Primární ${pair}${draft.vn ? ' SCADA' : ''}`}
                unit={draft.vn ? 'kV' : 'V'}
                value={draft.voltage.primary[i]}
                onChange={(v) =>
                  change({
                    ...draft,
                    voltage: {
                      ...draft.voltage,
                      preset: draft.vn ? 'custom' : draft.voltage.preset,
                      primary: draft.voltage.primary.map((x, j) =>
                        i === j ? v : x,
                      ) as CurrentDraft['voltage']['primary'],
                    },
                  })
                }
              />
              <Field
                label={`Sekundární ${pair}`}
                unit="V"
                value={draft.voltage.secondary[i]}
                onChange={(v) =>
                  change({
                    ...draft,
                    voltage: {
                      ...draft.voltage,
                      secondary: draft.voltage.secondary.map((x, j) =>
                        i === j ? v : x,
                      ) as CurrentDraft['voltage']['secondary'],
                      secondaryEdited: draft.voltage.secondaryEdited.map((x, j) =>
                        i === j ? true : x,
                      ) as CurrentDraft['voltage']['secondaryEdited'],
                    },
                  })
                }
              />
              <small>
                {draft.voltage.secondaryEdited[i]
                  ? 'Ručně upraveno'
                  : 'Výchozí 100 V – lze zpřesnit multimetrem'}
              </small>
            </div>
          ))}
        </div>
      </fieldset>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <button className="button primary" onClick={evaluate}>
        VYHODNOTIT PROUDY
      </button>
      {result && (
        <>
          <CurrentResult record={result} />
          <button className="button primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'UKLÁDÁM…' : 'ULOŽIT PROUDOVÉ MĚŘENÍ'}
          </button>
        </>
      )}
    </>
  );
}
