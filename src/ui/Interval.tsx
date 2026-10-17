import { compareEnergy, estimateEnergisPulse, mtpCorrection } from '../core/energy';
import { parseNumber, formatNumber } from '../core/numbers';
import type { FormDraft } from '../core/types';
import { Field } from './Fields';
export function Interval({
  draft,
  onChange,
}: {
  draft: FormDraft;
  onChange: (value: FormDraft['interval']) => void;
}) {
  const values = draft.interval;
  let result: ReturnType<typeof compareEnergy> | undefined,
    error = '';
  if (Object.values(values).every(Boolean)) {
    try {
      result = compareEnergy(
        {
          ...values,
          start: parseNumber(values.start),
          end: parseNumber(values.end),
          energis: parseNumber(values.energis),
        },
        draft.config,
      );
    } catch (e) {
      error = (e as Error).message;
    }
  }
  const estimate =
    result && draft.config.energisPulse === 'X'
      ? estimateEnergisPulse(
          result.meterEnergy,
          result.energisEnergy,
          draft.config.meterPulse * mtpCorrection(draft.config.actualMtp, draft.config.meterMtp),
        )
      : null;
  return (
    <section className="card">
      <h3>Kontrola stavů · volitelné</h3>
      <p className="hint">Použijte přesně shodný interval v Energis. Stavy zadávejte v kWh.</p>
      <div className="field-grid">
        {(['from', 'to'] as const).map((key) => (
          <label className="field" key={key}>
            <span>Datum a čas {key === 'from' ? 'OD' : 'DO'}</span>
            <input
              aria-label={`Datum a čas ${key === 'from' ? 'OD' : 'DO'}`}
              type="datetime-local"
              step="60"
              value={values[key]}
              onChange={(e) => onChange({ ...values, [key]: e.target.value })}
            />
          </label>
        ))}
        <Field
          label="Stav elektroměru OD"
          unit="kWh"
          value={values.start}
          onChange={(start) => onChange({ ...values, start })}
        />
        <Field
          label="Stav elektroměru DO"
          unit="kWh"
          value={values.end}
          onChange={(end) => onChange({ ...values, end })}
        />
        <Field
          label="Spotřeba Energis za interval"
          unit="kWh"
          value={values.energis}
          onChange={(energis) => onChange({ ...values, energis })}
        />
      </div>
      <p className="hint">
        Předpoklad: registr a pulz jsou škálované na primární stranu podle MTP elektroměru. U jiného
        typu registru tuto kontrolu nepoužívejte bez ověření převodu.
      </p>
      {error && (
        <p className="notice warning" role="alert">
          {error}
        </p>
      )}
      {result && (
        <dl className="data-list interval-result">
          <dt>Rozdíl stavů</dt>
          <dd>{formatNumber(result.registerDelta)} kWh</dd>
          <dt>Korekce MTP</dt>
          <dd>× {formatNumber(result.correction, 3)}</dd>
          <dt>Spotřeba elektroměru</dt>
          <dd>{formatNumber(result.meterEnergy)} kWh</dd>
          <dt>Spotřeba Energis</dt>
          <dd>{formatNumber(result.energisEnergy)} kWh</dd>
          <dt>Rozdíl</dt>
          <dd>{formatNumber(result.difference)} kWh</dd>
          <dt>Procentní rozdíl</dt>
          <dd>{formatNumber(result.percent)} %</dd>
        </dl>
      )}
      {estimate && (
        <div className="notice">
          <div>
            Odhad váhy Energis: <strong>{formatNumber(estimate.effective, 4)} kWh/puls</strong>
            <br />
            {estimate.meaningful
              ? `Nejbližší smysluplná váha: ${estimate.nearest.label}`
              : `Nejbližší standard ${estimate.nearest.label} je vzdálený o ${formatNumber(estimate.distancePercent)} %; bez smysluplné shody.`}
            <p className="hint">
              Odhad předpokládá shodný počet přenesených pulzů bez ztrát. Nejde o samostatné ověření
              nastavení Energis.
            </p>
          </div>
        </div>
      )}
      {result && draft.config.energisPulse === 'X' && !estimate && (
        <p className="hint">Odhad váhy pulzu vyžaduje kladnou energii obou systémů.</p>
      )}
    </section>
  );
}
