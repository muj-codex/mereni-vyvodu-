import { useMemo, useState } from 'react';
import { createIntervalCheck, type IntervalCheckRecord } from '../core/intervalCheck';
import { intervalLabel, intervalEndpoint, formatIntervalDateTime } from '../core/historyView';
import { formatNumber } from '../core/numbers';
import type { FormDraft } from '../core/types';
import { toTSV, intervalSubject } from '../data/export';
import { resetInterval } from '../core/measurement';
import { Info } from './Info';
import { Field } from './Fields';
export function IntervalResult({
  record,
  section = 'result',
}: {
  record: IntervalCheckRecord;
  section?: string;
}) {
  const { input, result, assessment } = record;
  if (section === 'inspection')
    return (
      <section className="card">
        <h2>Prověřit</h2>
        <p>{assessment.summary}</p>
        {assessment.recommendations.map((r) => (
          <p key={r}>{r}</p>
        ))}
      </section>
    );
  return (
    <section className="card interval-result">
      <h3>{section === 'detail' ? 'Data / detail kontroly stavů' : 'Výsledek kontroly stavů'}</h3>
      <p>Interval: {intervalLabel(record)}</p>
      <dl className="data-list">
        {section === 'detail' && (
          <>
            <dt>MTP primár</dt>
            <dd>
              {formatNumber(input.config.actualMtp)}/{input.config.voltage > 500 ? 1 : 5} A
            </dd>
            <dt>MTP elektroměr</dt>
            <dd>
              {formatNumber(input.config.meterMtp)}/{input.config.voltage > 500 ? 1 : 5} A
            </dd>
            <dt>Interval OD</dt>
            <dd>{formatIntervalDateTime(intervalEndpoint(record, 'from'))}</dd>
            <dt>Interval DO</dt>
            <dd>{formatIntervalDateTime(intervalEndpoint(record, 'to'))}</dd>
            <dt>Stav elektroměru OD</dt>
            <dd>{formatNumber(input.interval?.start)} kWh</dd>
            <dt>Stav elektroměru DO</dt>
            <dd>{formatNumber(input.interval?.end)} kWh</dd>
          </>
        )}
        <dt>Rozdíl stavů elektroměru</dt>
        <dd>{formatNumber(result.registerDelta)} kWh</dd>
        <dt>Korekce MTP</dt>
        <dd>× {formatNumber(result.correction, 3, true)}</dd>
        <dt>Spotřeba elektroměru po korekci</dt>
        <dd>{formatNumber(result.meterEnergy)} kWh</dd>
        <dt>Spotřeba Energis</dt>
        <dd>{formatNumber(result.energisEnergy)} kWh</dd>
        <dt>Rozdíl kWh</dt>
        <dd>{formatNumber(result.difference)} kWh</dd>
        <dt>Procentní rozdíl</dt>
        <dd>{formatNumber(result.percent)} %</dd>
      </dl>
      <p className={`notice ${assessment.band}`}>{assessment.summary}</p>
      {assessment.recommendations.map((r) => (
        <p key={r}>{r}</p>
      ))}
    </section>
  );
}
export function Interval({
  draft,
  onChange,
  onSave,
  notify,
}: {
  draft: FormDraft;
  onChange: (value: FormDraft['interval']) => void;
  onSave: (record: IntervalCheckRecord) => Promise<void>;
  notify: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fallback, setFallback] = useState('');

  const values = draft.interval;
  const { result, validation } = useMemo(() => {
    if (
      !Object.values(draft.interval).every(Boolean) ||
      !draft.interval.from.split('T')[1] ||
      !draft.interval.to.split('T')[1]
    )
      return { result: undefined, validation: '' };
    try {
      return { result: createIntervalCheck(draft), validation: '' };
    } catch (e) {
      return { result: undefined, validation: (e as Error).message };
    }
  }, [draft]);
  async function save() {
    if (!result || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSave(result);
      onChange(resetInterval(values));
      setFallback('');
      notify('Kontrola stavů uložena.');
    } catch {
      setError('Kontrola nebyla uložena. Formulář zůstává zachován. Zkuste uložení znovu.');
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!result) return;
    const text = toTSV([result]);
    if (navigator.share) {
      try {
        await navigator.share({ title: intervalSubject(result), text });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      notify('TSV kontroly zkopírováno pro vložení do těla zprávy.');
    } catch {
      setFallback(text);
    }
  }
  return (
    <section className="card">
      <h3>Kontrola stavů · volitelné</h3>
      <p className="hint">
        Použijte přesně shodný interval v Energis. Stavy zadávejte v kWh. Registr musí být škálovaný
        na primární stranu podle MTP elektroměru.
      </p>
      <fieldset className="field-grid interval-fields" disabled={busy}>
        {(['from', 'to'] as const).map((key) => (
          <div key={key} className="two-fields">
            {(['date', 'time'] as const).map((part) => (
              <label className="field" key={part}>
                <span>
                  {part === 'date' ? 'Datum' : 'Čas'} {key === 'from' ? 'OD' : 'DO'}
                </span>
                <input
                  type={part}
                  step={part === 'time' ? '60' : undefined}
                  aria-label={`${part === 'date' ? 'Datum' : 'Čas'} ${key === 'from' ? 'OD' : 'DO'}`}
                  value={values[key].split('T')[part === 'date' ? 0 : 1] ?? ''}
                  onChange={(e) => {
                    const [date = '', time = ''] = values[key].split('T');
                    onChange({
                      ...values,
                      [key]:
                        part === 'date' ? `${e.target.value}T${time}` : `${date}T${e.target.value}`,
                    });
                    setError('');
                    setFallback('');
                  }}
                />
              </label>
            ))}
          </div>
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
      </fieldset>
      {(error || validation) && (
        <p className="notice warning" role="alert">
          {error || validation}
        </p>
      )}
      <Info label="Uložit kontrolu stavů">
        Uloží aktuální kontrolu do historie. Po úspěšném uložení zůstane identifikace a datumy,
        pracovní hodnoty, výsledky a časy se vyčistí pro další měření.
      </Info>
      {result && (
        <>
          <IntervalResult record={result} />
          <div className="step-actions">
            <button className="button primary" disabled={busy} onClick={() => void save()}>
              ULOŽIT KONTROLU STAVŮ
            </button>
            <button className="button secondary" onClick={() => void send()}>
              ODESLAT TUTO KONTROLU
            </button>
          </div>
        </>
      )}
      {fallback && (
        <section className="card">
          <p>Označte a zkopírujte TSV do těla zprávy.</p>
          <textarea
            aria-label="TSV kontroly pro ruční zkopírování"
            readOnly
            rows={8}
            value={fallback}
            onFocus={(e) => e.target.select()}
          />
          <button className="button secondary" onClick={() => setFallback('')}>
            Zavřít TSV
          </button>
        </section>
      )}
    </section>
  );
}
