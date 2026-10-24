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
        .map((c) => {
          // Presentation only: compare the existing unrounded percentage, never its display text.
          const warning =
            c.key === 'kyoritsu-energis' && c.percent !== null && Math.abs(c.percent) > 5;
          return (
            <div
              key={c.key}
              data-comparison={c.key}
              className={warning ? 'comparison-warning' : undefined}
            >
              <strong>
                {warning && (
                  <span className="comparison-warning-icon" role="img" aria-label="Upozornění">
                    !
                  </span>
                )}
                {c.label}:{' '}
                {c.percent === null
                  ? 'Porovnání není dostupné'
                  : `${c.percent > 0 ? '+' : ''}${formatNumber(c.percent)} %`}
              </strong>
              <p className="hint">
                {warning ? 'Rozdíl překročil 5 %. Trend Energis může být časově posunutý.' : c.note}
              </p>
            </div>
          );
        })}
    </section>
  );
}
