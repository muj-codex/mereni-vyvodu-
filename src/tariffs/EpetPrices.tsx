import { useState } from 'react';
import { compareBusinessOffers } from './businessOffers';
import type { ComparisonContext } from './calculations';
import type { Customer, DistributionArea } from './model';
import { assessEpet, epetSources } from './epetCosts';
const fmt = (n: number) =>
  Number.isFinite(n) ? new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n) : '—';
export function EpetPrices({
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
  let result: ReturnType<typeof assessEpet> | null = null;
  try {
    result = assessEpet(customer, code, area, amps, annualKwh, split, phases);
  } catch {
    /* Shared invalid inputs remain incomplete. */
  }
  const metadata = epetSources[customer][area].metadata;
  return (
    <section
      className="card"
      style={{ overflowWrap: 'anywhere' }}
      aria-label={`EPET ${customer === 'C' ? 'firmy' : 'domácnosti'}`}
    >
      <h2>
        EPET – {metadata.productName} · {code}
      </h2>
      <p>Pevná obchodní cena na 24 měsíců</p>
      <p>Ceník účinný od 20. 7. 2026</p>
      <p className="hint">
        epet energie, a.s. · Fixace obchodní ceny na 24 měsíců od skutečného zahájení dodávky. Při
        prolongaci se další období řídí produktovou řadou STANDARD. Regulované ceny se mohou měnit.
        Volitelné a mimořádné služby nejsou zahrnuty do standardní roční ceny.
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
        <p className="notice">Doplňte platné společné vstupy pro EPET.</p>
      ) : (
        <>
          {result.tariff && (
            <dl className="tariff-summary" aria-label="Jednotkové ceny EPET">
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
                <dd>{fmt(result.tariff.distributionVT?.priceWithoutVat ?? NaN)} Kč/MWh bez DPH</dd>
              </div>
              {result.tariff.distributionNT && (
                <div>
                  <dt>Distribuce NT</dt>
                  <dd>{fmt(result.tariff.distributionNT.priceWithoutVat)} Kč/MWh bez DPH</dd>
                </div>
              )}
              <div>
                <dt>Stálý obchodní plat</dt>
                <dd>{fmt(result.tariff.fixedMonthly.priceWithoutVat)} Kč/měsíc bez DPH</dd>
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
            <>
              <p className="notice">
                {result.missing.join(' ')} Úplná roční cena není k dispozici.
              </p>
              {result.commercial !== null && (
                <p>Obchodní část: {fmt(result.commercial)} Kč/rok bez DPH.</p>
              )}
            </>
          ) : (
            <>
              <p>Obchodní část: {fmt(result.commercial!)} Kč/rok bez DPH.</p>
              <p>Regulovaná část včetně daně: {fmt(result.regulated!)} Kč/rok bez DPH.</p>
              <dl className="tariff-summary" aria-label="Roční položky EPET">
                {result.lines.map((l) => (
                  <div key={l.label}>
                    <dt>{l.label}</dt>
                    <dd>{fmt(l.priceWithoutVat)} Kč/rok bez DPH</dd>
                  </div>
                ))}
              </dl>
              <p>
                POZE: {fmt(result.poze!)} Kč/rok – od 1. 1. 2026 se neúčtuje. Varianta A je 0
                Kč/A/měsíc; varianta B 495 Kč/MWh je pouze maximální limit. Nesíťová infrastruktura
                12,87 Kč/OM/měsíc je započtena pouze jednou.
              </p>
              <dl className="tariff-summary" aria-label="Roční cena EPET">
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
export function EpetBusinessPrices({ context }: { context: ComparisonContext }) {
  const [choice, setChoice] = useState('C02d');
  if (context.customer !== 'C') return null;
  const code = context.method === 'company' ? context.originalTariff! : choice;
  const offers = compareBusinessOffers(code, context).offers;
  const own = offers.find((o) => o.name === 'EPET');
  return (
    <>
      {context.method === 'flat' && (
        <section className="card" aria-label="Výběr sazby EPET">
          <label className="field">
            Sazba EPET pro samostatný rozpad
            <select
              aria-label="Sazba EPET"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              {Object.keys(epetSources.C[context.distributionArea].tariffs).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      <EpetPrices
        customer="C"
        code={code}
        area={context.distributionArea}
        amps={context.breakerA}
        annualKwh={context.annualKwh}
        split={context.annualSplit}
      />
      {own && (
        <section className="card" aria-label="Rozdíly EPET proti dodavatelům">
          <p>Stejná sazba {code}, oblast, jistič a roční VT/NT:</p>
          <dl className="tariff-summary">
            {offers
              .filter((o) => o.name !== 'EPET')
              .map((o) => (
                <div key={o.name}>
                  <dt>EPET vůči {o.name}</dt>
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
