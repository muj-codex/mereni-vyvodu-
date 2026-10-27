import { useState } from 'react';
import type { ComparisonContext } from './calculations';
import { companyTariffCodes, householdTariffCodes } from './catalog';
import {
  assessEsco,
  assessHousehold,
  escoSource,
  householdRow,
  householdSources,
  latestSpotMonth,
  spotPrice,
  spotRefresh,
  type CezLine,
} from './cezCosts';
const fmt = (n: number) => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n);
const label = (code: string) =>
  ['C01d', 'C02d', 'C03d', 'D01d', 'D02d', 'C62d'].includes(code) ? code : `${code} · 2T`;
function Breakdown({
  lines,
  priceWithoutVat,
  priceWithVat,
}: {
  lines: CezLine[];
  priceWithoutVat: number | null;
  priceWithVat: number | null;
}) {
  return (
    <>
      <p className="hint">Roční položky bez DPH</p>
      <dl className="tariff-summary">
        {lines.map((line) => (
          <div key={line.label}>
            <dt>{line.label}</dt>
            <dd>{fmt(line.priceWithoutVat)} Kč/rok</dd>
          </div>
        ))}
      </dl>
      {priceWithoutVat !== null && priceWithVat !== null && (
        <dl className="tariff-summary" aria-label="Roční cena ČEZ">
          <div>
            <dt>Celkem bez DPH</dt>
            <dd>{fmt(priceWithoutVat)} Kč/rok</dd>
          </div>
          <div>
            <dt>DPH 21 %</dt>
            <dd>{fmt(priceWithVat - priceWithoutVat)} Kč/rok</dd>
          </div>
          <div>
            <dt>Celkový orientační roční náklad včetně DPH</dt>
            <dd>
              <strong>{fmt(priceWithVat)} Kč/rok</strong>
            </dd>
          </div>
        </dl>
      )}
    </>
  );
}
function EscoPrices({ context }: { context: ComparisonContext }) {
  const [choice, setChoice] = useState('C02d');
  const code = context.method === 'company' ? context.originalTariff! : choice;
  const result = assessEsco(
    code,
    context.distributionArea,
    context.breakerA,
    context.annualKwh,
    context.annualSplit,
  );
  const refresh = spotRefresh();
  return (
    <section className="card" style={{ overflowWrap: 'anywhere' }} aria-label="ČEZ ESCO SPOT">
      <h2>ČEZ ESCO – SPOT · {code}</h2>
      <p>Elektřina SPOT na dobu neurčitou</p>
      <p className="notice">
        SPOT · orientační cena podle posledního zveřejněného měsíce. Nejde o garantovanou roční
        pevnou cenu.
      </p>
      <p>
        Referenční měsíc:{' '}
        {new Intl.DateTimeFormat('cs-CZ', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(`${latestSpotMonth()}-01T00:00:00Z`))}
      </p>
      <p>Oblast: {escoSource.metadata.distributionArea}</p>
      <p>
        Distribuční oblast odběrného místa: {context.distributionArea} · 3×{fmt(context.breakerA)} A
        · {fmt(context.annualKwh)} kWh/rok
      </p>
      {context.method === 'flat' && (
        <label className="field">
          <span>Sazba ČEZ ESCO</span>
          <select
            aria-label="Sazba ČEZ ESCO"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
          >
            {companyTariffCodes.map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </select>
        </label>
      )}
      {!result ? (
        <p className="notice">Pro tuto sazbu nemáme ověřený cenový podklad.</p>
      ) : (
        <>
          <p>
            Dodávka VT = NT: {fmt(spotPrice(code)!)} Kč/MWh bez DPH · stálá obchodní platba: 95
            Kč/měsíc bez DPH.
          </p>
          <p className="hint">
            Zveřejněná cena již zahrnuje přirážku za odchylku a služby 285 Kč/MWh.
          </p>
          {!result.complete && (
            <p className="notice">
              Úplný roční výpočet není pro tuto kombinaci k dispozici. Chybí ověřená regulovaná část
              nebo rozpad spotřeby VT/NT. Níže je pouze obchodní část.
            </p>
          )}
          <Breakdown {...result} />
        </>
      )}
      <p className="hint">
        Ověřeno: {escoSource.metadata.lastVerifiedAt} · příští doporučená kontrola:{' '}
        {refresh.nextRecommendedCheckAt} (po 20 dnech).
      </p>
      {refresh.recommended && (
        <p className="notice">
          Doporučena aktualizace ceníku. Používáme poslední známá ověřená data.
        </p>
      )}
      <p className="hint">Zdroj: {escoSource.metadata.sourceFile} · účinnost od 1. 1. 2026.</p>
    </section>
  );
}
function HouseholdPrices({ context }: { context: ComparisonContext }) {
  const [code, setCode] = useState('D02d');
  const [amps, setAmps] = useState(String(context.breakerA));
  const [phases, setPhases] = useState<1 | 3>(3);
  const [nt, setNt] = useState('');
  const dual = householdRow(context.distributionArea, code, 2) !== null;
  const annualNT = dual ? (nt.trim() === '' ? NaN : Number(nt.replace(',', '.'))) : 0;
  const annualVT = context.annualKwh - annualNT;
  let result: ReturnType<typeof assessHousehold> = null;
  let error = '';
  try {
    result = assessHousehold(
      code,
      context.distributionArea,
      amps.trim() === '' ? NaN : Number(amps.replace(',', '.')),
      phases,
      annualVT,
      annualNT,
    );
  } catch (e) {
    error = (e as Error).message;
  }
  const metadata = householdSources[context.distributionArea].metadata;
  return (
    <section className="card" style={{ overflowWrap: 'anywhere' }} aria-label="ČEZ domácnosti">
      <h2>Domácnosti / sazby D – ČEZ</h2>
      <p>Elektřina na dobu neurčitou · účinnost od 1. 1. 2026</p>
      <p>Distribuční oblast: {context.distributionArea}</p>
      <div className="field-grid">
        <label className="field">
          <span>Sazba domácnosti ČEZ</span>
          <select
            aria-label="Sazba domácnosti ČEZ"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          >
            {householdTariffCodes.map((c) => (
              <option value={c} key={c}>
                {label(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Počet fází pro cenu ČEZ</span>
          <select
            aria-label="Počet fází pro cenu ČEZ"
            value={phases}
            onChange={(e) => setPhases(Number(e.target.value) as 1 | 3)}
          >
            <option value="3">3 fáze</option>
            <option value="1">1 fáze</option>
          </select>
        </label>
        <label className="field">
          <span>Jistič ČEZ [A]</span>
          <input
            aria-label="Jistič ČEZ [A]"
            inputMode="decimal"
            value={amps}
            onChange={(e) => setAmps(e.target.value)}
          />
        </label>
        {dual && (
          <label className="field">
            <span>Roční spotřeba NT ČEZ [kWh]</span>
            <input
              aria-label="Roční spotřeba NT ČEZ [kWh]"
              inputMode="decimal"
              value={nt}
              onChange={(e) => setNt(e.target.value)}
            />
          </label>
        )}
      </div>
      <p>
        Celková roční spotřeba: {fmt(context.annualKwh)} kWh.{' '}
        {dual
          ? 'Zadejte skutečný roční podíl NT; VT je zbytek celkové spotřeby.'
          : 'Jednotarifní sazba – celá spotřeba ve VT.'}
      </p>
      {error && (
        <p className="notice">
          {dual && nt.trim() === '' ? 'Pro dvoutarifní výpočet zadejte roční spotřebu NT.' : error}
        </p>
      )}
      {result && (
        <>
          <p>
            {label(code)} · {phases}×{amps} A · VT {fmt(annualVT)} kWh/rok
            {dual ? ` · NT ${fmt(annualNT)} kWh/rok` : ''}
          </p>
          <dl className="tariff-summary" aria-label="Jednotkové ceny ČEZ">
            {[
              ['Dodávka VT', 1],
              ...(dual ? [['Dodávka NT', 2]] : []),
              ['Distribuce VT', 4],
              ...(dual ? [['Distribuce NT', 5]] : []),
            ].map(([name, row]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>
                  {fmt(householdRow(context.distributionArea, code, Number(row))!)} Kč/MWh bez DPH
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
          <p className="hint">
            POZE: minimum z 12 × sazba podle jističe × A × počet fází ({fmt(result.pozeByBreaker)}{' '}
            Kč) a roční spotřeby v MWh × sazba podle spotřeby ({fmt(result.pozeByConsumption)} Kč),
            bez DPH.
          </p>
          <Breakdown {...result} />
        </>
      )}
      <p className="hint">
        Zdroj: {metadata.sourceFile} · ověřeno {metadata.lastVerifiedAt}. Ceny v závorkách zdroje
        jsou bez DPH; DPH se přičítá jednou.
      </p>
    </section>
  );
}
export function CezPrices({ context }: { context: ComparisonContext }) {
  return context.customer === 'C' ? (
    <EscoPrices context={context} />
  ) : (
    <HouseholdPrices context={context} />
  );
}
