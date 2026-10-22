import { SaveInfo } from './Info';
import { resetCurrentDraft, locations } from '../core/current';
import { useEffect, useState } from 'react';
import { PHASES, phaseColor } from '../core/config';
import {
  currentOptions,
  currentInstructions,
  changeClampRange,
  rangeAdvice,
  workingBand,
  emptyCurrent,
  evaluateCurrent,
  RANGES,
  signedPercent,
  type CurrentDraft,
  type CurrentRecord,
  type ClampRange,
  type InputUnit,
} from '../core/current';
import { formatNumber, parseNumber } from '../core/numbers';
import type { Identification } from '../core/types';
import { IdentificationFields, IdentificationSummary } from './Identification';
import { Field, SelectField } from './Fields';
const pairs = ['UL1-L2', 'UL1-L3', 'UL2-L3'];
export function CurrentResult({
  record,
  section = 'detail',
}: {
  record: CurrentRecord;
  section?: string;
}) {
  if (section === 'inspection')
    return (
      <section className="card">
        <h2>Co prověřit</h2>
        {currentInstructions(record).map((text) => (
          <p key={text}>{text}</p>
        ))}
      </section>
    );
  if (section === 'result')
    return (
      <section className="card">
        <h2>Výsledek proudového měření</h2>
        {record.phases.flatMap((p, i) =>
          p.unused
            ? []
            : [
                <p key={i} className={`notice ${workingBand(p.differencePercent)}`}>
                  IL{i + 1}: {signedPercent(p.differencePercent)} ·{' '}
                  {workingBand(p.differencePercent) === 'success' ? 'V toleranci' : 'Ověřit měření'}
                </p>,
              ],
        )}
      </section>
    );

  return (
    <>
      <h2>Proudové měření {record.input.vn ? 'VN · SCADA' : 'NN · měřený proud'}</h2>
      <p>
        <strong>
          MTP {formatNumber(record.input.ctPrimary)}/{record.input.ctSecondary} A · Kyoritsu 8112 –
          rozsah {record.input.range}
        </strong>
      </p>
      <div className="phase-inputs">
        {record.phases.map((p, i) =>
          p.unused ? (
            <section className="card aron-center" key={i}>
              ARON – IL2 se nepoužívá
            </section>
          ) : (
            <section className="card" key={i}>
              <h3 className="current-phase" style={{ backgroundColor: phaseColor(i as 0 | 1 | 2) }}>
                IL{i + 1}
              </h3>
              <dl className="current-values">
                <dt>Primár ({p.source})</dt>
                <dd>{formatNumber(p.primary, 1)} A</dd>
                <dt>Očekávaný sekundár</dt>
                <dd>
                  {formatNumber(p.expectedA * 1000, 1)} mA / {formatNumber(p.expectedA, 3)} A
                </dd>
                <dt>Klešťový ampérmetr (mV / V)</dt>
                <dd>
                  {formatNumber(parseNumber(p.raw))} {p.unit} ({formatNumber(p.millivolts, 3)} mV)
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
          ),
        )}
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
function restore(key = 'mereni-current-draft-v1'): CurrentDraft {
  try {
    const d = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (d?.phases?.length === 3 && d.identification && d.voltage) return d;
  } catch {
    /* retain session */
  }
  return emptyCurrent();
}
export function CurrentMeasurement({
  onSave,
  notify,
  shared,
}: {
  shared?: { serial: string; identification: Identification; actualMtp?: number };
  onSave: (r: CurrentRecord) => Promise<void>;
  notify: (s: string) => void;
}) {
  const storageKey = shared ? 'mereni-current-draft-v1' : 'mereni-current-independent-v1';
  const [draft, setDraft] = useState<CurrentDraft>(() => restore(storageKey)),
    [result, setResult] = useState<CurrentRecord | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const networkVoltage = shared?.identification.networkVoltage ?? draft.networkVoltage ?? 400;
  useEffect(() => {
    if (!shared) return;
    setResult(null);
    const sharedHeaderKey = JSON.stringify([
      shared.serial,
      shared.identification.date,
      shared.identification.location,
      shared.identification.placement,
      networkVoltage,
      shared.actualMtp,
    ]);
    setDraft((d) => {
      // Reopening the same header keeps an unfinished measurement and its chosen MTP.
      if (d.sharedHeaderKey === sharedHeaderKey) return d;
      const next = d.serial ? resetCurrentDraft(d) : d;
      return {
        ...next,
        sharedHeaderKey,
        ctPrimary: shared.actualMtp ?? d.ctPrimary,
        serial: shared.serial,
        identification: { ...shared.identification },
        vn: networkVoltage > 500,
        networkVoltage,
        voltage: {
          ...next.voltage,
          ...(networkVoltage > 500
            ? {
                preset: String(networkVoltage / 1000),
                primary: [
                  String(networkVoltage / 1000),
                  String(networkVoltage / 1000),
                  String(networkVoltage / 1000),
                ] as [string, string, string],
              }
            : {}),
        },
      };
    });
  }, [
    shared?.serial,
    shared?.actualMtp,
    shared?.identification.date,
    shared?.identification.location,
    shared?.identification.placement,
    networkVoltage,
  ]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      /* session remains usable */
    }
  }, [draft, storageKey]);
  const [customMtp, setCustomMtp] = useState(false);
  const [mtpText, setMtpText] = useState(() => String(draft.ctPrimary));
  function change(d: CurrentDraft) {
    setDraft(d);
    setResult(null);
    setError('');
    try {
      localStorage.setItem(storageKey, JSON.stringify(d));
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
      change(resetCurrentDraft(draft));
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
      {shared ? (
        <>
          <IdentificationSummary serial={draft.serial} value={draft.identification} />
          <p className="hint">Identifikaci upravíte na kartě 3f měření.</p>
        </>
      ) : (
        <>
          <IdentificationFields
            serial={draft.serial}
            value={draft.identification}
            vn={draft.vn}
            onSerial={(serial) => change({ ...draft, serial })}
            onChange={(identification) => change({ ...draft, identification })}
          />
          <SelectField
            label="Režim sítě / napětí"
            value={networkVoltage}
            onChange={(v) => {
              const voltage = Number(v),
                vn = voltage > 500;
              change({
                ...resetCurrentDraft(draft),
                vn,
                networkVoltage: voltage,
                identification: {
                  ...draft.identification,
                  networkVoltage: voltage,
                  location: locations(vn)[0],
                },
                voltage: {
                  ...resetCurrentDraft(draft).voltage,
                  preset: String(voltage / 1000),
                  primary: vn
                    ? ([v, v, v].map(() => String(voltage / 1000)) as [string, string, string])
                    : ['', '', ''],
                },
              });
            }}
          >
            {[400, 500, 6000, 6300, 10000, 10300].map((v) => (
              <option key={v} value={v}>
                {v > 500 ? `VN ${v / 1000} kV` : `NN ${v} V${v === 500 ? ' – ARON' : ''}`}
              </option>
            ))}
          </SelectField>
        </>
      )}
      <section className="card">
        <div className="field-grid">
          <SelectField
            label="MTP"
            value={
              customMtp || !currentOptions(draft.vn).some((ct) => ct.primary === draft.ctPrimary)
                ? 'custom'
                : draft.ctPrimary
            }
            onChange={(v) => {
              setCustomMtp(v === 'custom');
              if (v === 'custom') setMtpText(String(draft.ctPrimary));
              if (v !== 'custom') change({ ...draft, ctPrimary: Number(v) });
            }}
          >
            <option value="custom">VLASTNÍ MTP</option>
            {currentOptions(draft.vn).map((ct) => (
              <option key={ct.primary} value={ct.primary}>
                {ct.primary}/{ct.secondary} A
              </option>
            ))}
          </SelectField>
          {(customMtp ||
            !currentOptions(draft.vn).some((ct) => ct.primary === draft.ctPrimary)) && (
            <Field
              label="Vlastní primár MTP"
              value={customMtp ? mtpText : String(draft.ctPrimary)}
              onChange={(v) => {
                setMtpText(v);
                change({ ...draft, ctPrimary: parseNumber(v) });
              }}
            />
          )}
          <p>
            MTP {formatNumber(draft.ctPrimary)}/{draft.vn ? 1 : 5} A
          </p>
          <SelectField
            label="Rozsah Kyoritsu 8112"
            value={draft.range}
            onChange={(v) => {
              change(changeClampRange(draft, v as ClampRange));
              notify('Rozsah změněn – znovu odečtěte a zadejte hodnoty.');
            }}
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
      {rangeAdvice(draft).map((text) => (
        <p className="notice warning" key={text}>
          {text}
        </p>
      ))}
      <div className="phase-inputs">
        {PHASES.map((i) =>
          networkVoltage === 500 && i === 1 ? (
            <section className="card aron-center" key={i}>
              ARON – IL2 se nepoužívá
            </section>
          ) : (
            <section className="card" key={i}>
              <h3
                className="current-phase"
                data-phase={`I${i + 1}`}
                style={{ backgroundColor: phaseColor(i) }}
              >
                IL{i + 1}
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
                label={`Klešťový ampérmetr L${i + 1} (mV / V)`}
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
          ),
        )}
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
            <p>
              Primární napětí SCADA: {String(networkVoltage / 1000).replace('.', ',')} kV (z
              Identifikace měření)
            </p>
          </>
        )}
        <div className="phase-inputs">
          {pairs.map((pair, i) => (
            <div key={pair}>
              {draft.vn ? (
                <p>
                  {pair}: {String(networkVoltage / 1000).replace('.', ',')} kV
                </p>
              ) : (
                <Field
                  label={`Primární ${pair}${draft.vn ? ' SCADA' : ''}`}
                  unit={draft.vn ? 'kV' : 'V'}
                  value={draft.voltage.primary[i]}
                  onChange={(v) =>
                    change({
                      ...draft,
                      voltage: {
                        ...draft.voltage,
                        primary: draft.voltage.primary.map((x, j) =>
                          i === j ? v : x,
                        ) as CurrentDraft['voltage']['primary'],
                      },
                    })
                  }
                />
              )}
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
          <CurrentResult record={result} section="result" />
          <CurrentResult record={result} section="inspection" />
          <CurrentResult record={result} />
          <button className="button primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'UKLÁDÁM…' : 'ULOŽIT PROUDOVÉ MĚŘENÍ'}
          </button>
          <SaveInfo />
        </>
      )}
    </>
  );
}
