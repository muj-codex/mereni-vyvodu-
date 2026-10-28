import { useState } from 'react';
import type { ComparisonContext } from './calculations';
import type { Customer, DistributionArea } from './model';
import { assessInnogy, innogySources } from './innogyCosts';
const fmt = (n: number) =>
  Number.isFinite(n) ? new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n) : '—';
export function InnogyPrices({
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
  let result: ReturnType<typeof assessInnogy> | null = null;
  try {
    result = assessInnogy(customer, code, area, amps, annualKwh, split, phases);
  } catch {
    /* Shared invalid inputs remain incomplete. */
  }
  const metadata = innogySources[customer].metadata;
  return (
    <section
      className="card"
      style={{ overflowWrap: 'anywhere' }}
      aria-label={`innogy ${customer === 'C' ? 'firmy' : 'domácnosti'}`}
    >
      <h2>innogy – elektřina Benefit 24 · {code}</h2>
      <p>Fixace 24 měsíců · Ceník od 1. 4. 2026 · Distribuční oblast ceníku: ČEZ Distribuce</p>
      <p>
        Distribuční oblast odběru: {area} · {phases}×{Number.isFinite(amps) ? fmt(amps) : '—'} A ·{' '}
        {fmt(annualKwh)} kWh/rok
      </p>
      {result?.warning && (
        <p className="notice">
          {result.warning} Omezení se týká kumulované spotřeby všech odběrných míst.
        </p>
      )}
      {!result ? (
        <p className="notice">Doplňte platné společné vstupy pro innogy.</p>
      ) : (
        <>
          {result.tariff && area === 'ČEZ Distribuce' && (
            <dl className="tariff-summary" aria-label="Jednotkové ceny innogy">
              <div>
                <dt>Dodávka VT</dt>
                <dd>{fmt(result.tariff.commodityVT)} Kč/MWh bez DPH</dd>
              </div>
              {result.tariff.commodityNT !== null && (
                <div>
                  <dt>Dodávka NT</dt>
                  <dd>{fmt(result.tariff.commodityNT)} Kč/MWh bez DPH</dd>
                </div>
              )}
              <div>
                <dt>Stálý obchodní plat</dt>
                <dd>127 Kč/měsíc bez DPH</dd>
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
              <dl className="tariff-summary" aria-label="Roční položky innogy">
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
              <dl className="tariff-summary" aria-label="Roční cena innogy">
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
export function InnogyBusinessPrices({ context }: { context: ComparisonContext }) {
  const [choice, setChoice] = useState('C02d');
  if (context.customer !== 'C') return null;
  const code = context.method === 'company' ? context.originalTariff! : choice;
  return (
    <>
      {context.method === 'flat' && (
        <section className="card" aria-label="Výběr sazby innogy">
          <label className="field">
            Sazba innogy pro samostatný rozpad
            <select
              aria-label="Sazba innogy"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              {Object.keys(innogySources.C.tariffs).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      <InnogyPrices
        customer="C"
        code={code}
        area={context.distributionArea}
        amps={context.breakerA}
        annualKwh={context.annualKwh}
        split={context.annualSplit}
      />
    </>
  );
}
