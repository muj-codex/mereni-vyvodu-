import { useState } from 'react';
import type { ComparisonContext } from './calculations';
import {
  electricity24Tariff,
  escoElectricity24Source,
  assessElectricity24,
} from './escoElectricity24Costs';
import { compareBusinessOffers } from './businessOffers';
const fmt = (n: number) => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n);
export function EscoElectricity24Prices({ context }: { context: ComparisonContext }) {
  const [choice, setChoice] = useState('C02d');
  if (context.customer !== 'C') return null;
  const code = context.method === 'company' ? context.originalTariff! : choice;
  const tariff = electricity24Tariff(code);
  const result = assessElectricity24(
    code,
    context.distributionArea,
    context.breakerA,
    context.annualKwh,
    context.annualSplit,
  );
  const comparison = compareBusinessOffers(code, context);
  return (
    <section
      className="card"
      style={{ overflowWrap: 'anywhere' }}
      aria-label="ČEZ ESCO Elektřina 24"
    >
      <h2>
        ČEZ ESCO – Elektřina 24 · {code}
        {tariff?.ntPerMwh ? ' · 2T' : ''}
      </h2>
      <p className="notice">Fixace 24 měsíců</p>
      <p>Obchodní cena platná pro všechna distribuční území. Pro dodávky zahájené od 1. 6. 2026.</p>
      <p>
        Distribuční oblast odběrného místa: {context.distributionArea} · 3×{fmt(context.breakerA)} A
        · {fmt(context.annualKwh)} kWh/rok
      </p>
      {context.method === 'flat' && (
        <label className="field">
          <span>Sazba ČEZ ESCO Elektřina 24</span>
          <select
            aria-label="Sazba ČEZ ESCO Elektřina 24"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
          >
            {Object.keys(escoElectricity24Source.tariffs).map((c) => (
              <option value={c} key={c}>
                {c}
                {electricity24Tariff(c)?.ntPerMwh ? ' · 2T' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {!result || !tariff ? (
        <p className="notice">Pro tuto sazbu nemáme ověřený cenový podklad.</p>
      ) : (
        <>
          <dl className="tariff-summary" aria-label="Jednotkové ceny Elektřina 24">
            <div>
              <dt>Dodávka VT</dt>
              <dd>{fmt(tariff.vtPerMwh.priceWithoutVat)} Kč/MWh bez DPH</dd>
            </div>
            {tariff.ntPerMwh && (
              <div>
                <dt>Dodávka NT</dt>
                <dd>{fmt(tariff.ntPerMwh.priceWithoutVat)} Kč/MWh bez DPH</dd>
              </div>
            )}
            <div>
              <dt>Stálý obchodní plat</dt>
              <dd>{fmt(tariff.supplierFixedMonthly.priceWithoutVat)} Kč/měsíc bez DPH</dd>
            </div>
            {result.regulated && (
              <div>
                <dt>Jistič měsíčně</dt>
                <dd>{fmt(result.regulated.breakerMonthly)} Kč/měsíc bez DPH</dd>
              </div>
            )}
          </dl>
          <p>Obchodní část: {fmt(result.commercial)} Kč/rok bez DPH.</p>
          {result.regulated && (
            <p>
              Regulovaná část včetně daně: {fmt(result.regulated.priceWithoutVat)} Kč/rok bez DPH.
            </p>
          )}
          {!result.complete && (
            <p className="notice">{result.missing.join(' ')} Úplná roční cena není k dispozici.</p>
          )}
          <dl className="tariff-summary" aria-label="Roční položky Elektřina 24">
            {result.lines.map((l) => (
              <div key={l.label}>
                <dt>{l.label}</dt>
                <dd>{fmt(l.priceWithoutVat)} Kč/rok bez DPH</dd>
              </div>
            ))}
          </dl>
          {result.complete && (
            <dl className="tariff-summary" aria-label="Roční cena Elektřina 24">
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
          )}
          {result.priceWithVat !== null && (
            <>
              <p>Rozdíly při stejné sazbě {code}, oblasti, jističi a roční spotřebě VT/NT:</p>
              <dl className="tariff-summary" aria-label="Rozdíly Elektřina 24 proti dodavatelům">
                {comparison.offers
                  .filter((o) => o.name !== 'ČEZ ESCO')
                  .map((o) => {
                    const delta = result.priceWithVat! - o.value;
                    return (
                      <div key={o.name}>
                        <dt>ČEZ ESCO vůči {o.name}</dt>
                        <dd>
                          {Math.abs(delta) < 0.005
                            ? 'Shodná cena'
                            : `${fmt(Math.abs(delta))} Kč/rok ${delta > 0 ? 'dražší' : 'levnější'}`}{' '}
                          včetně DPH
                        </dd>
                      </div>
                    );
                  })}
              </dl>
            </>
          )}
        </>
      )}
      <p className="hint">
        Obchodní a regulovaná oblast jsou oddělené. Cenové porovnání nepotvrzuje technický nárok na
        distribuční sazbu.
      </p>
      <p className="hint">
        Zdroj: {escoElectricity24Source.metadata.sourceFile} · ověřeno{' '}
        {escoElectricity24Source.metadata.lastVerifiedAt}. Regulovaná část používá stávající ověřené
        podklady aplikace. DPH se přičítá jednou.
      </p>
    </section>
  );
}
