import { useState } from 'react';
import type { ComparisonContext } from './calculations';
import type { assessHousehold } from './cezCosts';
import { companyTariffCodes } from './catalog';
import {
  assessBusinessRegulated,
  assessEonHousehold,
  eonHouseholdSources,
  eonHouseholdRow,
  eonBusinessSource,
  eonRefresh,
} from './eonCosts';
import type { DistributionArea } from './model';
const fmt = (n: number) => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n);
export function EonBusinessPrices({ context }: { context: ComparisonContext }) {
  const [choice, setChoice] = useState('C02d');
  if (context.customer !== 'C') return null;
  const code = context.method === 'company' ? context.originalTariff! : choice;
  const supported = eonBusinessSource.tariffCodes.includes(code);
  const regulated = supported
    ? assessBusinessRegulated(
        code,
        context.distributionArea,
        context.breakerA,
        context.annualKwh,
        context.annualSplit,
      )
    : null;
  const refresh = eonRefresh();
  return (
    <section className="card" style={{ overflowWrap: 'anywhere' }} aria-label="E.ON firmy SPOT">
      <h2>E.ON – SPOT · {code}</h2>
      <p>
        Elektřina spot · pro podnikatele s průběhovým měřením · na dobu neurčitou bez fixace ceny
      </p>
      <p className="notice">
        SPOT – orientační produkt. Přesná obchodní cena závisí na cenách denního trhu OTE a průběhu
        odběru.
      </p>
      <p>
        Distribuční oblast odběrného místa: {context.distributionArea} · 3×{fmt(context.breakerA)} A
        · {fmt(context.annualKwh)} kWh/rok
      </p>
      {context.method === 'flat' && (
        <label className="field">
          <span>Sazba E.ON firmy</span>
          <select
            aria-label="Sazba E.ON firmy"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
          >
            {companyTariffCodes.map((c) => (
              <option value={c} key={c}>
                {c}
                {!['C01d', 'C02d', 'C03d', 'C62d'].includes(c) ? ' · 2T' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {!supported ? (
        <p className="notice">Pro tuto sazbu nemáme ověřený cenový podklad.</p>
      ) : (
        <>
          <p>
            Cena podle OTE + {fmt(eonBusinessSource.handlingPerMwh.priceWithoutVat)} Kč/MWh bez DPH.
          </p>
          <p>
            Stálý plat {fmt(eonBusinessSource.supplierFixedMonthly.priceWithoutVat)} Kč/měsíc bez
            DPH. Minimální jednotková cena{' '}
            {fmt(eonBusinessSource.minimumUnitPricePerMwh.priceWithoutVat)} Kč/MWh bez DPH; minimum
            není cenou pro výpočet.
          </p>
          <p className="notice">
            Nelze přesně porovnat bez průběhových SPOT dat. Přesné porovnání vyžaduje průběhová SPOT
            data. Úplná roční cena se nezobrazuje.
          </p>
          {regulated ? (
            <>
              <h3>Ověřená regulovaná část – bez DPH</h3>
              <dl className="tariff-summary" aria-label="Regulovaná část E.ON firmy">
                {regulated.lines.map((l) => (
                  <div key={l.label}>
                    <dt>{l.label}</dt>
                    <dd>{fmt(l.priceWithoutVat)} Kč/rok</dd>
                  </div>
                ))}
                <div>
                  <dt>Regulovaná část celkem</dt>
                  <dd>{fmt(regulated.priceWithoutVat)} Kč/rok</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="hint">
              Úplná regulovaná část pro tuto kombinaci není ověřena nebo chybí rozpad VT/NT. Nad
              3×160 A není jednoznačná platnost sazby za A.
            </p>
          )}
        </>
      )}
      <p className="hint">
        Podporované měřené sazby: {eonBusinessSource.tariffCodes.join(', ')}. C60d do běžného SPOT
        porovnání nepatří.
      </p>
      <p className="hint">
        Obchodní cena od 1. 7. 2024; regulovaná data ČEZ Distribuce pro rok 2026. Ověřeno{' '}
        {eonBusinessSource.metadata.lastVerifiedAt}, příští doporučená kontrola{' '}
        {refresh.nextRecommendedCheckAt} (20 dní).
      </p>
      {refresh.recommended && (
        <p className="notice">Doporučena kontrola ceníku. Používáme poslední známá ověřená data.</p>
      )}
      <p className="hint">Zdroj: {eonBusinessSource.metadata.sourceFile}</p>
    </section>
  );
}
export function EonHouseholdComparison({
  code,
  area,
  amps,
  phases,
  vt,
  nt,
  cezResult,
}: {
  code: string;
  area: DistributionArea;
  amps: number;
  phases: 1 | 3;
  vt: number;
  nt: number;
  cezResult: ReturnType<typeof assessHousehold>;
}) {
  let result: ReturnType<typeof assessEonHousehold> = null;
  try {
    result = assessEonHousehold(code, area, amps, phases, vt, nt);
  } catch {
    /* Shared input validation is displayed above the comparison. */
  }
  const metadata = eonHouseholdSources[area].metadata;
  const dual = eonHouseholdRow(area, code, 2) !== null;
  const difference = result && cezResult ? cezResult.priceWithVat - result.priceWithVat : null;
  return (
    <section className="card" aria-label="E.ON domácnosti" style={{ overflowWrap: 'anywhere' }}>
      <h2>E.ON – domácnosti</h2>
      <p>{metadata.productName}</p>
      <p>{metadata.contract} · obchodní cena od 1. 10. 2026 · výpočet podle cen pro rok 2026</p>
      <p>
        Distribuční oblast: {area} · společná sazba {code}
        {dual ? ' · 2T' : ''} · {phases}×{Number.isFinite(amps) ? fmt(amps) : '—'} A
      </p>
      {!result ? (
        <p className="notice">Pro roční srovnání doplňte platné společné vstupy ČEZ / E.ON.</p>
      ) : (
        <>
          <p>
            Stejné vstupy: VT {fmt(vt)} kWh/rok{dual ? ` · NT ${fmt(nt)} kWh/rok` : ''}.
          </p>
          <dl className="tariff-summary" aria-label="Jednotkové ceny E.ON domácnosti">
            {[
              ['Dodávka VT', 1],
              ...(dual ? [['Dodávka NT', 2]] : []),
              ['Distribuce VT', 4],
              ...(dual ? [['Distribuce NT', 5]] : []),
            ].map(([label, row]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  {fmt(eonHouseholdRow(area, code, Number(row))!.priceWithoutVat)} Kč/MWh bez DPH
                </dd>
              </div>
            ))}
            <div>
              <dt>Jistič měsíčně</dt>
              <dd>{fmt(result.breakerMonthly)} Kč/měsíc bez DPH</dd>
            </div>
          </dl>
          <p>
            Obchodní část: {fmt(result.commercial)} Kč/rok bez DPH · regulovaná část včetně daně:{' '}
            {fmt(result.regulated)} Kč/rok bez DPH.
          </p>
          <dl className="tariff-summary" aria-label="Roční položky E.ON domácnosti">
            {result.lines.map((l) => (
              <div key={l.label}>
                <dt>{l.label}</dt>
                <dd>{fmt(l.priceWithoutVat)} Kč/rok</dd>
              </div>
            ))}
          </dl>
          <p className="hint">
            POZE: sazba podle jističe 0 Kč; sazba podle spotřeby ve zdroji neuvedena (pomlčka).
            Ceník výslovně uvádí výsledné POZE 0 Kč.
          </p>
          <dl className="tariff-summary" aria-label="Roční cena E.ON">
            <div>
              <dt>Celkem bez DPH</dt>
              <dd>{fmt(result.priceWithoutVat)} Kč/rok</dd>
            </div>
            <div>
              <dt>DPH 21 %</dt>
              <dd>{fmt(result.priceWithVat - result.priceWithoutVat)} Kč/rok</dd>
            </div>
            <div>
              <dt>Celkový orientační roční náklad včetně DPH</dt>
              <dd>
                <strong>{fmt(result.priceWithVat)} Kč/rok</strong>
              </dd>
            </div>
          </dl>
        </>
      )}
      {difference !== null && (
        <section aria-label="Porovnání domácností ČEZ a E.ON">
          <h3>ČEZ × E.ON – stejné vstupy</h3>
          <p className="notice">
            {Math.abs(difference) < 0.005
              ? 'Nabídky mají shodnou roční cenu.'
              : `Levnější nabídka: ${difference > 0 ? 'E.ON' : 'ČEZ'}. Rozdíl ${fmt(Math.abs(difference))} Kč/rok včetně DPH.`}
          </p>
          <p className="hint">
            Cena není potvrzením nároku na distribuční sazbu. Technickou způsobilost je nutné ověřit
            u distributora.
          </p>
        </section>
      )}
      <p className="hint">
        Zdroj: {metadata.sourceFile} · ověřeno {metadata.lastVerifiedAt}. Obě varianty DPH jsou
        uloženy podle zdroje; roční cena se počítá z cen bez DPH s jedním přičtením DPH. Volitelné
        poplatky za poukázky či Zelenou od E.ONu nejsou zahrnuty.
      </p>
    </section>
  );
}
