import { measurementComparisons } from '../core/comparisons';
import { intervalLabel } from '../core/historyView';
import { formatNumber } from '../core/numbers';
import type { IntervalCheckRecord } from '../core/intervalCheck';
import type { MeasurementRecord } from '../core/types';
export function StateCheckSummary({ record }: { record: IntervalCheckRecord }) {
  return (
    <aside className="notice state-check-summary" aria-label="Přenesená kontrola stavů">
      <strong>Kontrola stavů: {intervalLabel(record)}</strong>
      <br />
      EM {formatNumber(record.result.meterEnergy)} kWh · Energis{' '}
      {formatNumber(record.result.energisEnergy)} kWh ·{' '}
      {record.result.percent === null ? '—' : `${formatNumber(record.result.percent)} %`}
    </aside>
  );
}
export function Comparisons({ record }: { record: MeasurementRecord }) {
  return (
    <section className="card comparisons" aria-label="Porovnání">
      <h3>Porovnání</h3>
      {record.input.stateCheck && (
        <>
          <StateCheckSummary record={record.input.stateCheck} />
          <p>
            Rozdíl: {formatNumber(record.input.stateCheck.result.difference)} kWh.{' '}
            {record.input.stateCheck.assessment.summary}
          </p>
        </>
      )}
      <p>
        Měření Kyoritsu: {formatNumber(record.input.kyoritsu)} kW · Trend Energis:{' '}
        {formatNumber(record.input.energis)} kW
      </p>
      {measurementComparisons(record)
        .filter((c) => c.key !== 'meter-kyoritsu')
        .map((c) => (
          <div key={c.key}>
            <strong>
              {c.label}:{' '}
              {c.percent === null
                ? 'Porovnání není dostupné'
                : `${c.percent > 0 ? '+' : ''}${formatNumber(c.percent)} %`}
            </strong>
            <p className="hint">{c.note}</p>
          </div>
        ))}
    </section>
  );
}
