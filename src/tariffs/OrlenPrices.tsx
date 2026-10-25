import { useState } from 'react';
import type { ComparisonContext } from './calculations';
import {
  ORLEN_2026_SOURCE,
  ORLEN_ENERGY,
  ORLEN_COMMON,
  isVerifiedOrlenTariff,
  orlenDistribution,
  orlenBreakerMonthly,
} from './orlen2026';
import { assessOrlen } from './orlenCosts';
const number = (n: number) =>
  new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n);
export function OrlenPrices({ context }: { context: ComparisonContext }) {
  const [choice, setChoice] = useState('C02d');
  if (context.customer !== 'C') return null;
  const code = context.method === 'company' ? context.originalTariff! : choice;
  const assessment = assessOrlen(
    code,
    context.distributionArea,
    context.breakerA,
    context.annualKwh,
    context.annualSplit,
  );
  const energy = isVerifiedOrlenTariff(code) ? ORLEN_ENERGY[code] : null;
  const distribution = orlenDistribution(code, context.distributionArea);
  const breaker = orlenBreakerMonthly(code, context.distributionArea, context.breakerA);
  return (
    <section className="card orlen-prices" aria-label="Ověřené cenové položky ORLEN">
      <h2>ORLEN 2026 – {code}</h2>
      <p className="hint">
        {context.distributionArea} · 3×{number(context.breakerA)} A · všechny uvedené ceny bez DPH.
        Částečná data.
      </p>
      {context.method === 'flat' && (
        <label className="field">
          <span>Cenové položky ORLEN pro sazbu</span>
          <select
            aria-label="Cenové položky ORLEN pro sazbu"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
          >
            {ORLEN_2026_SOURCE.verifiedTariffs.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
      )}
      {!assessment.verified ? (
        <p className="notice">Cenová data ORLEN zatím nejsou ověřena.</p>
      ) : (
        <>
          <h3>Ověřené jednotkové ceny</h3>
          <dl className="tariff-summary">
            <div>
              <dt>{assessment.dualTariff ? 'Silová elektřina VT' : 'Silová elektřina'}</dt>
              <dd>{number(energy!.vtPerMwh.priceWithoutVat)} Kč/MWh</dd>
            </div>
            {assessment.dualTariff && (
              <div>
                <dt>Silová elektřina NT</dt>
                <dd>{number(energy!.ntPerMwh!.priceWithoutVat)} Kč/MWh</dd>
              </div>
            )}
            <div>
              <dt>{assessment.dualTariff ? 'Distribuce VT' : 'Distribuce'}</dt>
              <dd>
                {distribution
                  ? `${number(distribution.vtPerMwh.priceWithoutVat)} Kč/MWh`
                  : 'Data pro tuto oblast nejsou ověřena.'}
              </dd>
            </div>
            {assessment.dualTariff && (
              <div>
                <dt>Distribuce NT</dt>
                <dd>
                  {distribution?.ntPerMwh
                    ? `${number(distribution.ntPerMwh.priceWithoutVat)} Kč/MWh`
                    : 'Data pro tuto oblast nejsou ověřena.'}
                </dd>
              </div>
            )}
            <div>
              <dt>Cena jističe</dt>
              <dd>
                {breaker
                  ? `${number(breaker.priceWithoutVat)} Kč/měsíc`
                  : 'Cena jističe zatím není ověřena.'}
              </dd>
            </div>
            <div>
              <dt>Systémové služby</dt>
              <dd>{number(ORLEN_COMMON.systemServicesPerMwh.priceWithoutVat)} Kč/MWh</dd>
            </div>
            <div>
              <dt>POZE</dt>
              <dd>0 Kč/MWh · 0 Kč/A · 0 Kč/MW</dd>
            </div>
            <div>
              <dt>OTE / provoz nesíťové infrastruktury</dt>
              <dd>{number(ORLEN_COMMON.otePerSupplyPointMonth.priceWithoutVat)} Kč/OM/měsíc</dd>
            </div>
          </dl>
          <h3>Částečný roční rozpad – bez DPH</h3>
          <dl className="tariff-summary" aria-label="Částečné roční položky ORLEN">
            {assessment.lines
              .filter((line) => line.priceWithoutVat !== null)
              .map((line) => (
                <div key={line.key} data-cost-key={line.key}>
                  <dt>{line.label}</dt>
                  <dd>{number(line.priceWithoutVat!)} Kč/rok</dd>
                </div>
              ))}
          </dl>
        </>
      )}
      <p className="notice">Výpočet nelze dokončit – chybí ověřené cenové položky.</p>
      <p className="hint">
        Chybí: {assessment.missing.join('; ')}. Konečná roční cena ani cena s DPH se nezobrazují.
      </p>
      {context.method === 'company' && (
        <p className="notice">Pro úplné porovnání zatím chybí ověřená cenová data.</p>
      )}
    </section>
  );
}
