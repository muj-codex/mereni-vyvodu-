import { useState } from 'react';
import type { ComparisonContext } from './calculations';
import { companyTariffCodes } from './catalog';
import { assessEonVariant, eonVariantSource, variantRow } from './eonVariantCosts';
import { compareBusinessOffers } from './businessOffers';
const fmt = (n: number) => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n);
export function EonVariantPrices({ context }: { context: ComparisonContext }) {
  const [choice, setChoice] = useState('C02d');
  if (context.customer !== 'C') return null;
  const code = context.method === 'company' ? context.originalTariff! : choice;
  const result = assessEonVariant(
    code,
    context.distributionArea,
    context.breakerA,
    context.annualKwh,
    context.annualSplit,
  );
  const comparison = compareBusinessOffers(code, context);
  const eonPrice = result.priceWithVat;
  const dual = variantRow(code, 2) !== null;
  return (
    <section className="card" aria-label="E.ON firmy Variant" style={{ overflowWrap: 'anywhere' }}>
      <h2>
        E.ON – {eonVariantSource.metadata.productName} · {code}
        {dual ? ' · 2T' : ''}
      </h2>
      <p className="notice">Fixace 2 roky · platnost obchodní ceny od 1. 10. 2026</p>
      <p>
        Distribuční oblast: {context.distributionArea} · 3×{fmt(context.breakerA)} A ·{' '}
        {fmt(context.annualKwh)} kWh/rok
      </p>
      {context.method === 'flat' && (
        <label className="field">
          <span>Sazba E.ON Variant a společného porovnání</span>
          <select
            aria-label="Sazba E.ON Variant a společného porovnání"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
          >
            {companyTariffCodes.map((c) => (
              <option key={c} value={c}>
                {c}
                {!['C01d', 'C02d', 'C03d', 'C62d'].includes(c) ? ' · 2T' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {!result.supported ? (
        <p className="notice">Pro tuto sazbu nemáme ověřený cenový podklad.</p>
      ) : (
        <>
          <dl className="tariff-summary" aria-label="Jednotkové ceny E.ON Variant">
            {[
              ['Dodávka VT', 1, 'Kč/MWh'],
              ...(dual ? [['Dodávka NT', 2, 'Kč/MWh']] : []),
              ['Stálý obchodní plat', 3, 'Kč/měsíc'],
            ].map(([label, row, unit]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  {fmt(variantRow(code, Number(row))!.priceWithoutVat)} {unit} bez DPH
                </dd>
              </div>
            ))}
            <div>
              <dt>Jistič měsíčně</dt>
              <dd>
                {result.regulated
                  ? `${fmt(result.regulated.breakerMonthly)} Kč/měsíc bez DPH`
                  : 'Pro tuto kombinaci není ověřen.'}
              </dd>
            </div>
          </dl>
          {context.annualSplit && dual && (
            <p>
              Roční VT {fmt(context.annualSplit.annualVT)} kWh · NT{' '}
              {fmt(context.annualSplit.annualNT)} kWh
            </p>
          )}
          {!result.complete && (
            <p className="notice">{result.missing.join(' ')} Úplná roční cena není k dispozici.</p>
          )}
          {result.commercial && (
            <p>Obchodní část: {fmt(result.commercial.priceWithoutVat)} Kč/rok bez DPH.</p>
          )}
          {result.regulated && (
            <p>
              Regulovaná část včetně daně: {fmt(result.regulated.priceWithoutVat)} Kč/rok bez DPH.
            </p>
          )}
          <dl className="tariff-summary" aria-label="Roční položky E.ON Variant">
            {result.lines.map((l) => (
              <div key={l.label}>
                <dt>{l.label}</dt>
                <dd>{fmt(l.priceWithoutVat)} Kč/rok bez DPH</dd>
              </div>
            ))}
          </dl>
          {result.complete && (
            <>
              <dl className="tariff-summary" aria-label="Roční cena E.ON Variant">
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
              <p className="hint">
                POZE: ceník výslovně uvádí konečnou platbu 0 Kč. Spotřební pomlčka zůstává
                nevyplněná.
              </p>
            </>
          )}
        </>
      )}
      <section aria-label="Firemní porovnání dodavatelů">
        <h3>Pořadí dostupných úplných nabídek</h3>
        <p>
          Stejná sazba {code}, stejná distribuční oblast, jistič a roční spotřeba VT/NT. Sazbu pro
          toto porovnání určuje výběr u E.ON Variant, u odhadu firmy původní sazba.
        </p>
        {comparison.offers.length >= 2 ? (
          <ol aria-label="Pořadí firemních nabídek">
            {comparison.offers.map((o) => (
              <li key={o.name}>
                {o.name} · {o.pricing} · <strong>{fmt(o.value)} Kč/rok včetně DPH</strong>
              </li>
            ))}
          </ol>
        ) : (
          <p className="hint">Pro pořadí potřebujeme alespoň dvě úplné ověřené nabídky.</p>
        )}
        {eonPrice !== null && (
          <dl className="tariff-summary" aria-label="Rozdíly E.ON Variant proti dodavatelům">
            {comparison.offers
              .filter((o) => o.name !== 'E.ON Variant')
              .map((o) => {
                const diff = eonPrice - o.value;
                return (
                  <div key={o.name}>
                    <dt>E.ON vůči {o.name}</dt>
                    <dd>
                      {Math.abs(diff) < 0.005
                        ? 'Shodná cena'
                        : `${fmt(Math.abs(diff))} Kč/rok ${diff > 0 ? 'dražší' : 'levnější'}`}{' '}
                      včetně DPH
                    </dd>
                  </div>
                );
              })}
          </dl>
        )}
        {comparison.missing.length > 0 && (
          <p className="hint">
            Bez úplné ceny: {comparison.missing.join(', ')}. Tyto nabídky nejsou zařazeny do pořadí.
          </p>
        )}
        <p className="hint">
          ČEZ ESCO je SPOT · orientační scénář podle září 2026, nikoli garantovaná roční pevná cena.
          Cenové pořadí nepotvrzuje technický nárok na sazbu.
        </p>
      </section>
      <p className="hint">
        Zdroj: {eonVariantSource.metadata.sourceFile} · ověřeno{' '}
        {eonVariantSource.metadata.lastVerifiedAt}. Obě varianty DPH jsou uchovány podle podrobné
        tabulky. Volitelné poplatky za poukázky či Zelenou od E.ONu nejsou zahrnuty.
      </p>
    </section>
  );
}
