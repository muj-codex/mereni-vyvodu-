import { useState } from 'react';
import { compareBusinessOffers } from './businessOffers';
import type { ComparisonContext } from './calculations';
import type { Customer, DistributionArea } from './model';
import { assessPre, preSources } from './preCosts';
const fmt = (n: number) =>
  Number.isFinite(n) ? new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n) : '—';
export function PrePrices({
  customer,
  code,
  area,
  amps,
  phases = 3,
  annualKwh,
  split,
}: {
  customer: Customer;
  code: string;
  area: DistributionArea;
  amps: number;
  phases?: 1 | 3;
  annualKwh: number;
  split: { annualVT: number; annualNT: number } | null;
}) {
  let result: ReturnType<typeof assessPre> | null = null;
  try {
    result = assessPre(customer, code, area, amps, annualKwh, split, phases);
  } catch {
    /* Shared invalid inputs remain incomplete. */
  }
  const metadata = preSources[customer].metadata;
  return (
    <section
      className="card"
      style={{ overflowWrap: 'anywhere' }}
      aria-label={`PRE ${customer === 'C' ? 'firmy' : 'domácnosti'}`}
    >
      <h2>PRE – PRE PROUD FAVORIT 2 10/2026 · {code}</h2>
      <p>
        Garance ceny do 30. 9. 2028 · Ceník od 1. 10. 2026 · Distribuční oblast ceníku: ČEZ
        Distribuce
      </p>
      <p>
        Distribuční oblast odběru: {area} · {phases}×{Number.isFinite(amps) ? fmt(amps) : '—'} A ·{' '}
        {fmt(annualKwh)} kWh/rok
      </p>
      {result?.tariff && (
        <p>
          Roční VT: {fmt(result.tariff.commodityNT === null ? annualKwh : (split?.annualVT ?? NaN))}{' '}
          kWh · NT:{' '}
          {result.tariff.commodityNT === null ? 'není' : `${fmt(split?.annualNT ?? NaN)} kWh`}.
        </p>
      )}
      {!result ? (
        <p className="notice">Doplňte platné společné vstupy pro PRE.</p>
      ) : (
        <>
          {result.tariff && area === 'ČEZ Distribuce' && (
            <dl className="tariff-summary" aria-label="Jednotkové ceny PRE">
              <div>
                <dt>Dodávka VT</dt>
                <dd>{fmt(result.tariff.commodityVT.priceWithoutVat)} Kč/MWh bez DPH</dd>
              </div>
              {result.tariff.commodityNT !== null && (
                <div>
                  <dt>Dodávka NT</dt>
                  <dd>{fmt(result.tariff.commodityNT.priceWithoutVat)} Kč/MWh bez DPH</dd>
                </div>
              )}
              <div>
                <dt>Distribuce VT</dt>
                <dd>{fmt(result.tariff.distributionVT.priceWithoutVat)} Kč/MWh bez DPH</dd>
              </div>
              {result.tariff.distributionNT && (
                <div>
                  <dt>Distribuce NT</dt>
                  <dd>{fmt(result.tariff.distributionNT.priceWithoutVat)} Kč/MWh bez DPH</dd>
                </div>
              )}
              <div>
                <dt>Stálý obchodní plat</dt>
                <dd>129 Kč/měsíc bez DPH</dd>
              </div>
              {result.breakerMonthly !== null && (
                <div>
                  <dt>Jistič měsíčně</dt>
                  <dd>{fmt(result.breakerMonthly)} Kč/měsíc bez DPH</dd>
                </div>
              )}
            </dl>
          )}
          {!result.complete ? (
            <p className="notice">{result.missing.join(' ')} Úplná roční cena není k dispozici.</p>
          ) : (
            <>
              <p>Obchodní část: {fmt(result.commercial!)} Kč/rok bez DPH.</p>
              <p>Regulovaná část včetně daně: {fmt(result.regulated!)} Kč/rok bez DPH.</p>
              <dl className="tariff-summary" aria-label="Roční položky PRE">
                {result.lines.map((l) => (
                  <div key={l.label}>
                    <dt>{l.label}</dt>
                    <dd>{fmt(l.priceWithoutVat)} Kč/rok bez DPH</dd>
                  </div>
                ))}
              </dl>
              <p>
                POZE A: {fmt(result.pozeA!)} Kč/rok · POZE B: {fmt(result.pozeB!)} Kč/rok. Použita
                nižší platba.
              </p>
              <dl className="tariff-summary" aria-label="Roční cena PRE">
                <div>
                  <dt>Celkem bez DPH</dt>
                  <dd>{fmt(result.priceWithoutVat!)} Kč/rok</dd>
                </div>
                <div>
                  <dt>DPH 21 %</dt>
                  <dd>{fmt(result.priceWithVat! - result.priceWithoutVat!)} Kč/rok</dd>
                </div>
                <div>
                  <dt>Celková roční cena včetně DPH</dt>
                  <dd>
                    <strong>{fmt(result.priceWithVat!)} Kč/rok</strong>
                  </dd>
                </div>
              </dl>
            </>
          )}
        </>
      )}
      <p className="hint">
        Zdroj: {metadata.sourceFile} · ověřeno {metadata.lastVerifiedAt}. Cena nepotvrzuje technický
        nárok na sazbu.
      </p>
    </section>
  );
}
export function PreBusinessPrices({ context }: { context: ComparisonContext }) {
  const [choice, setChoice] = useState('C02d');
  if (context.customer !== 'C') return null;
  const code = context.method === 'company' ? context.originalTariff! : choice;
  const offers = compareBusinessOffers(code, context).offers;
  const own = offers.find((o) => o.name === 'PRE');
  return (
    <>
      {context.method === 'flat' && (
        <section className="card" aria-label="Výběr sazby PRE">
          <label className="field">
            Sazba PRE pro samostatný rozpad
            <select
              aria-label="Sazba PRE"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              {Object.keys(preSources.C.tariffs).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      <PrePrices
        customer="C"
        code={code}
        area={context.distributionArea}
        amps={context.breakerA}
        annualKwh={context.annualKwh}
        split={context.annualSplit}
      />
      {own && (
        <section className="card" aria-label="Rozdíly PRE proti dodavatelům">
          <p>Stejná sazba {code}, oblast, jistič a roční VT/NT:</p>
          <dl className="tariff-summary">
            {offers
              .filter((o) => o.name !== 'PRE')
              .map((o) => (
                <div key={o.name}>
                  <dt>PRE vůči {o.name}</dt>
                  <dd>
                    {Math.abs(own.value - o.value) < 0.005
                      ? 'Shodná cena'
                      : `${fmt(Math.abs(own.value - o.value))} Kč/rok ${own.value > o.value ? 'dražší' : 'levnější'}`}{' '}
                    včetně DPH
                  </dd>
                </div>
              ))}
          </dl>
        </section>
      )}
    </>
  );
}
