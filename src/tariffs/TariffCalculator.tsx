import { OrlenPrices } from './OrlenPrices';
import { CezPrices } from './CezPrices';
import { EonVariantPrices as EonBusinessPrices } from './EonVariantPrices';
import { useState } from 'react';
import { BackButton } from '../ui/BackButton';
import { SelectField } from '../ui/Fields';
import { Info } from '../ui/Info';
import { tariffsFor, tariffFor } from './catalog';
import { SupplierCard } from './SupplierCard';
import {
  blankTariffDraft,
  breakers,
  distributionAreas,
  periods,
  suppliersFor,
  type BreakerInput,
  type Customer,
  type DistributionArea,
  type ReadingInput,
  type TariffDraft,
} from './model';
import {
  calculateFlat,
  calculateCompany,
  loadAfterSimultaneity,
  comparisonContext,
  type FlatResult,
  type CompanyResult,
  type ComparisonContext,
} from './calculations';
import './tariffs.css';

type Step = 'customer' | 'method' | 'inputs' | 'area' | 'result';
const customerLabels = { C: 'C – PODNIKATEL / FIRMA', D: 'D – DOMÁCNOST' };
const methodLabels = { flat: 'PAUŠÁLNÍ PŘIPOJENÍ', company: 'ODHAD / FIRMY' };
export const formatTariffNumber = (n: number) =>
  new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n);
function NumberInput({
  label,
  value,
  onChange,
  placeholder = '0,00',
  integer = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  integer?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        <input
          aria-label={label}
          type="text"
          inputMode={integer ? 'numeric' : 'decimal'}
          pattern={integer ? '[0-9]+' : '[0-9]+([,.][0-9]+)?'}
          required={!disabled}
          disabled={disabled}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  );
}
function BreakerField({
  label,
  value,
  onChange,
  automatic = false,
  recommendation,
}: {
  label: string;
  value: BreakerInput;
  onChange: (v: BreakerInput) => void;
  automatic?: boolean;
  recommendation?: number | null;
}) {
  return (
    <>
      <SelectField
        label={label}
        value={value.choice}
        onChange={(choice) => onChange({ ...value, choice })}
      >
        {automatic ? (
          <option value="auto">
            {recommendation ? `Doporučený 3×${recommendation} A` : 'Automatický návrh'}
          </option>
        ) : (
          <option value="">Vyberte jistič</option>
        )}
        {breakers.map((b) => (
          <option key={b}>{b}</option>
        ))}
        <option value="custom">VLASTNÍ HODNOTA</option>
      </SelectField>
      {value.choice === 'custom' && (
        <NumberInput
          label="Vlastní jistič [A]"
          value={value.custom}
          onChange={(custom) => onChange({ ...value, custom })}
          placeholder="např. 64"
        />
      )}
    </>
  );
}
function TariffSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const tariff = tariffFor('C', value);
  return (
    <div>
      <SelectField label="Původní sazba" value={value} onChange={onChange}>
        <option value="">Vyberte sazbu C</option>
        {tariffsFor('C').map((t) => (
          <option key={t.code} value={t.code}>
            {t.code}
            {t.dualTariff ? ' · 2T' : ''}
          </option>
        ))}
      </SelectField>
      {tariff && (
        <Info key={value} label={`sazba ${value}`}>
          Kód sazby: {value} · Kategorie: C ·{' '}
          {tariff.tariffType === 'single' ? 'Jednotarifní' : 'Dvoutarifní'} · VT: ano · NT:{' '}
          {tariff.usesNT ? 'ano' : 'ne'}
        </Info>
      )}
    </div>
  );
}
function ReadingFields({
  order,
  value,
  onChange,
  dualTariff,
}: {
  dualTariff: boolean;
  order: 'first' | 'second';
  value: ReadingInput;
  onChange: (v: ReadingInput) => void;
}) {
  const first = order === 'first',
    name = first ? 'První odečet' : 'Druhý odečet',
    suffix = first ? 'prvního' : 'druhého';
  return (
    <section className="card tariff-reading" aria-label={name}>
      <h2>{name}</h2>
      <div className="field-grid">
        <label className="field">
          <span>Datum {suffix} odečtu</span>
          <input
            aria-label={`Datum ${suffix} odečtu`}
            type="date"
            required
            value={value.date}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Čas {suffix} odečtu</span>
          <input
            aria-label={`Čas ${suffix} odečtu`}
            type="time"
            required
            value={value.time}
            onChange={(e) => onChange({ ...value, time: e.target.value })}
          />
        </label>
        <NumberInput
          label={dualTariff ? 'Stav VT [kWh]' : 'Stav elektroměru VT / hlavní registr'}
          value={value.value}
          onChange={(reading) => onChange({ ...value, value: reading })}
        />
        <NumberInput
          label="Stav NT [kWh]"
          disabled={!dualTariff}
          value={value.ntValue ?? ''}
          onChange={(ntValue) => onChange({ ...value, ntValue })}
        />
      </div>
    </section>
  );
}
function AreaField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: DistributionArea | '') => void;
}) {
  return (
    <SelectField
      label="Distribuční oblast"
      value={value}
      onChange={(v) => onChange(v as DistributionArea | '')}
    >
      <option value="">Vyberte distribuční oblast</option>
      {distributionAreas.map((a) => (
        <option key={a}>{a}</option>
      ))}
    </SelectField>
  );
}
function PeriodField({
  value,
  custom,
  onChange,
  onCustom,
}: {
  value: string;
  custom: string;
  onChange: (v: string) => void;
  onCustom: (v: string) => void;
}) {
  return (
    <>
      <SelectField label="Délka období" value={value} onChange={onChange}>
        {periods.map((p) => (
          <option key={p} value={p}>
            {p} {p === '1' ? 'měsíc' : p === '2' || p === '3' ? 'měsíce' : 'měsíců'}
          </option>
        ))}
        <option value="custom">vlastní počet měsíců</option>
      </SelectField>
      {value === 'custom' && (
        <NumberInput label="Vlastní počet měsíců" integer value={custom} onChange={onCustom} />
      )}
    </>
  );
}
function Suppliers({ context }: { context: ComparisonContext }) {
  return (
    <section aria-label="Ceníky dodavatelů">
      <h2>CENÍKY DODAVATELŮ</h2>
      <p className="hint">
        {context.distributionArea} ·{' '}
        {context.customer === 'C'
          ? 'ORLEN: částečně ověřený ceník 2026.'
          : 'ČEZ: ověřené ceníky domácností 2026.'}
      </p>
      <div
        className="tariff-suppliers"
        key={`${context.customer}:${context.method}:${context.distributionArea}`}
      >
        {suppliersFor(context.customer, context.method).filter((s) => s.id !== 'cez' && s.id !== 'eon' && s.id !== 'innogy').map((s) => (
          <SupplierCard supplier={s} key={s.id} />
        ))}
      </div>
    </section>
  );
}
type Result =
  | { kind: 'flat'; values: FlatResult; context: ComparisonContext }
  | { kind: 'company'; values: CompanyResult; context: ComparisonContext };
function ResultView({ result, draft }: { result: Result; draft: TariffDraft }) {
  const { context, values } = result;
  return (
    <>
      <section className="card" aria-label="Shrnutí vstupů">
        <h2>{result.kind === 'flat' ? 'Paušální připojení' : 'Odhad / firmy'}</h2>
        <dl className="tariff-summary">
          <div>
            <dt>Typ odběru</dt>
            <dd>{customerLabels[context.customer]}</dd>
          </div>
          <div>
            <dt>Výpočet</dt>
            <dd>{methodLabels[result.kind]}</dd>
          </div>
          <div>
            <dt>Distribuční oblast</dt>
            <dd>{context.distributionArea}</dd>
          </div>
          <div>
            <dt>{result.kind === 'flat' ? 'Použitý jistič' : 'Původní hlavní jistič'}</dt>
            <dd>3×{formatTariffNumber(values.breakerA)} A</dd>
          </div>
          {result.kind === 'flat' ? (
            <>
              <div>
                <dt>Proudové zatížení</dt>
                <dd>{draft.flat.currentA} A</dd>
              </div>
              <div>
                <dt>Soudobost</dt>
                <dd>{draft.flat.simultaneity}</dd>
              </div>
              <div>
                <dt>Proud po soudobosti</dt>
                <dd>{formatTariffNumber(result.values.concurrentA)} A</dd>
              </div>
              <div>
                <dt>Doporučený jistič</dt>
                <dd>
                  {result.values.recommendedA
                    ? `3×${result.values.recommendedA} A`
                    : 'Mimo standardní řadu'}
                </dd>
              </div>
              <div>
                <dt>Spotřeba za období</dt>
                <dd>{formatTariffNumber(result.values.consumptionKwh)} kWh</dd>
              </div>
              <div>
                <dt>Délka období</dt>
                <dd>{result.values.months} měsíců</dd>
              </div>
              <div>
                <dt>Předpokládaná roční spotřeba</dt>
                <dd>{formatTariffNumber(values.annualKwh)} kWh/rok</dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt>Původní sazba</dt>
                <dd>{result.values.originalTariff}</dd>
              </div>
              <div>
                <dt>První odečet</dt>
                <dd>
                  {draft.company.first.date} {draft.company.first.time} ·{' '}
                  {draft.company.first.value} kWh VT
                  {result.values.dualTariff && ` · ${draft.company.first.ntValue} kWh NT`}
                </dd>
              </div>
              <div>
                <dt>Druhý odečet</dt>
                <dd>
                  {draft.company.second.date} {draft.company.second.time} ·{' '}
                  {draft.company.second.value} kWh VT
                  {result.values.dualTariff && ` · ${draft.company.second.ntValue} kWh NT`}
                </dd>
              </div>
              {result.values.dualTariff && (
                <>
                  <div>
                    <dt>Spotřeba VT za období</dt>
                    <dd>{formatTariffNumber(result.values.consumptionVT)} kWh</dd>
                  </div>
                  <div>
                    <dt>Spotřeba NT za období</dt>
                    <dd>{formatTariffNumber(result.values.consumptionNT)} kWh</dd>
                  </div>
                  <div>
                    <dt>Roční VT</dt>
                    <dd>{formatTariffNumber(result.values.annualVT)} kWh/rok</dd>
                  </div>
                  <div>
                    <dt>Roční NT</dt>
                    <dd>{formatTariffNumber(result.values.annualNT)} kWh/rok</dd>
                  </div>
                </>
              )}
              <div>
                <dt>Skutečná spotřeba za období</dt>
                <dd>{formatTariffNumber(values.consumptionKwh)} kWh</dd>
              </div>
              <div>
                <dt>Délka období</dt>
                <dd>{formatTariffNumber(result.values.elapsedHours)} hodin</dd>
              </div>
              <div>
                <dt>Přepočtená roční spotřeba</dt>
                <dd>{formatTariffNumber(values.annualKwh)} kWh/rok</dd>
              </div>
            </>
          )}
        </dl>
        {result.kind === 'company' && (
          <Info label="Roční ekvivalent">
            Časy odečtů jsou v pásmu Europe/Prague včetně změn letního času. Roční ekvivalent
            používá model 365 dní (8 760 hodin) a skutečný časový rozdíl mezi odečty.
          </Info>
        )}
        <p className="notice">
          {context.verdict.kind === 'matches'
            ? `SAZBA ODPOVÍDÁ – ${context.verdict.tariffCode}`
            : context.verdict.kind === 'recommended'
              ? `CENOVÉ DOPORUČENÍ – ${context.verdict.tariffCode}`
              : result.kind === 'company'
                ? 'Pro úplné porovnání zatím chybí ověřená cenová data.'
                : 'Zvolte sazbu pro výpočet ceny. Pro doporučení použijte Odhad / firmy.'}
        </p>
      </section>
      {context.verdict.kind !== 'pending' && (
        <section className="card" aria-label="Cenové porovnání sazeb ORLEN">
          <h2>Cenové porovnání sazeb</h2>
          <p className="hint">
            Stejná roční spotřeba a jistič. Porovnání zahrnuje C01d, C02d, C03d a případnou
            stávající dvoutarifní sazbu. Před změnou sazby ověřte její technické podmínky u
            distributora.
          </p>
          <dl className="tariff-summary">
            {context.candidates
              .filter(
                (c) =>
                  c.supplierId === 'orlen' &&
                  c.orlenAssessment?.complete &&
                  (!c.orlenAssessment.dualTariff || c.tariffCode === context.originalTariff),
              )
              .map((c) => (
                <div key={c.tariffCode}>
                  <dt>{c.tariffCode}</dt>
                  <dd>{formatTariffNumber(c.orlenAssessment!.priceWithVat!)} Kč/rok včetně DPH</dd>
                </div>
              ))}
          </dl>
        </section>
      )}
      <OrlenPrices context={context} />
      <CezPrices context={context} />
      <EonBusinessPrices context={context} />
      <Suppliers context={context} />
    </>
  );
}
export function TariffCalculator() {
  const [step, setStep] = useState<Step>('customer');
  const [draft, setDraft] = useState(blankTariffDraft);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [companyResult, setCompanyResult] = useState<CompanyResult | null>(null);
  let preview: ReturnType<typeof loadAfterSimultaneity> | null = null;
  try {
    preview = loadAfterSimultaneity(draft.flat.currentA, draft.flat.simultaneity);
  } catch {
    /* Incomplete input has no preview. */
  }
  function back() {
    setError('');
    setStep(
      step === 'result'
        ? draft.method === 'company'
          ? 'area'
          : 'inputs'
        : step === 'area'
          ? 'inputs'
          : step === 'inputs'
            ? 'method'
            : 'customer',
    );
  }
  function submit() {
    try {
      if (draft.method === 'company') {
        if (draft.customer !== 'C') throw new Error('Odhad / firmy je dostupný pouze v režimu C.');
        setCompanyResult(calculateCompany(draft.company));
        setStep('area');
      } else {
        const values = calculateFlat(draft.flat);
        const context = comparisonContext(
          draft.customer!,
          'flat',
          draft.distributionArea as DistributionArea,
          values.annualKwh,
          values.breakerA,
        );
        setResult({ kind: 'flat', values, context });
        setStep('result');
      }
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main className="tariff-module" aria-label="Výpočet spotřeby a sazeb">
      {step !== 'customer' && <BackButton onBack={back} />}
      <div className="page-heading">
        <span className="eyebrow">VÝPOČET SPOTŘEBY A SAZEB</span>
        <h1>
          {step === 'customer'
            ? 'Typ odběru'
            : step === 'method'
              ? 'Výpočet'
              : step === 'area'
                ? 'Distribuční oblast'
                : step === 'result'
                  ? draft.method === 'company'
                    ? 'Výsledek kontroly sazby'
                    : 'Výsledek výpočtu'
                  : draft.method && methodLabels[draft.method]}
        </h1>
      </div>
      {step === 'customer' && (
        <div className="tariff-choices">
          {(['C', 'D'] as const).map((customer) => (
            <button
              type="button"
              className="button secondary"
              key={customer}
              onClick={() => {
                setDraft((d) => ({ ...d, customer, method: null }));
                setStep('method');
              }}
            >
              {customerLabels[customer]}
            </button>
          ))}
        </div>
      )}
      {step === 'method' && (
        <div className="tariff-choices">
          <p className="hint">{draft.customer && customerLabels[draft.customer]}</p>
          {(draft.customer === 'C' ? (['flat', 'company'] as const) : (['flat'] as const)).map(
            (method) => (
              <button
                type="button"
                className="button secondary"
                key={method}
                onClick={() => {
                  setDraft((d) => ({ ...d, method }));
                  setStep('inputs');
                }}
              >
                {methodLabels[method]}
              </button>
            ),
          )}
        </div>
      )}
      {step === 'inputs' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {draft.method === 'flat' ? (
            <section className="card">
              <div className="field-grid">
                <AreaField
                  value={draft.distributionArea}
                  onChange={(distributionArea) => setDraft((d) => ({ ...d, distributionArea }))}
                />
                <NumberInput
                  label="Proudové zatížení [A]"
                  value={draft.flat.currentA}
                  onChange={(currentA) =>
                    setDraft((d) => ({ ...d, flat: { ...d.flat, currentA } }))
                  }
                  placeholder="např. 40"
                />
                <div>
                  <NumberInput
                    label="Soudobost"
                    value={draft.flat.simultaneity}
                    onChange={(simultaneity) =>
                      setDraft((d) => ({ ...d, flat: { ...d.flat, simultaneity } }))
                    }
                    placeholder="0,65"
                  />
                  <Info label="Soudobost">
                    Koeficient musí být větší než 0 a nejvýše 1. Proud po soudobosti je zadaný proud
                    × soudobost. Návrh použije nejbližší vyšší standardní jistič; použitý jistič
                    můžete ručně změnit.
                  </Info>
                </div>
                <NumberInput
                  label="Spotřeba za období [kWh]"
                  value={draft.flat.consumptionKwh}
                  onChange={(consumptionKwh) =>
                    setDraft((d) => ({ ...d, flat: { ...d.flat, consumptionKwh } }))
                  }
                />
                <PeriodField
                  value={draft.flat.periodMonths}
                  custom={draft.flat.customPeriodMonths}
                  onChange={(periodMonths) =>
                    setDraft((d) => ({ ...d, flat: { ...d.flat, periodMonths } }))
                  }
                  onCustom={(customPeriodMonths) =>
                    setDraft((d) => ({ ...d, flat: { ...d.flat, customPeriodMonths } }))
                  }
                />
                <BreakerField
                  automatic
                  recommendation={preview?.recommendedA}
                  label="Použitý jistič"
                  value={draft.flat.breaker}
                  onChange={(breaker) => setDraft((d) => ({ ...d, flat: { ...d.flat, breaker } }))}
                />
              </div>
              {preview && (
                <div className="notice" aria-label="Návrh jističe">
                  <p>Proud po soudobosti: {formatTariffNumber(preview.concurrentA)} A</p>
                  <p>
                    Doporučený jistič:{' '}
                    {preview.recommendedA
                      ? `3×${preview.recommendedA} A`
                      : 'mimo standardní řadu – zadejte vlastní hodnotu'}
                  </p>
                </div>
              )}
            </section>
          ) : (
            <>
              <section className="card" aria-label="Původní nastavení">
                <div className="field-grid">
                  <BreakerField
                    label="Původní hlavní jistič"
                    value={draft.company.breaker}
                    onChange={(breaker) =>
                      setDraft((d) => ({ ...d, company: { ...d.company, breaker } }))
                    }
                  />
                  <TariffSelect
                    value={draft.company.tariffCode}
                    onChange={(tariffCode) =>
                      setDraft((d) => ({ ...d, company: { ...d.company, tariffCode } }))
                    }
                  />
                </div>
              </section>
              <ReadingFields
                dualTariff={tariffFor('C', draft.company.tariffCode)?.dualTariff ?? false}
                order="first"
                value={draft.company.first}
                onChange={(first) => setDraft((d) => ({ ...d, company: { ...d.company, first } }))}
              />
              <ReadingFields
                dualTariff={tariffFor('C', draft.company.tariffCode)?.dualTariff ?? false}
                order="second"
                value={draft.company.second}
                onChange={(second) =>
                  setDraft((d) => ({ ...d, company: { ...d.company, second } }))
                }
              />
            </>
          )}
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          <div className="step-actions">
            <button className="button primary" type="submit">
              {draft.method === 'company' ? 'POKRAČOVAT K OBLASTI' : 'POKRAČOVAT K POROVNÁNÍ'}
            </button>
          </div>
        </form>
      )}
      {step === 'area' && companyResult && (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const context = comparisonContext(
                'C',
                'company',
                draft.distributionArea as DistributionArea,
                companyResult.annualKwh,
                companyResult.breakerA,
                companyResult.originalTariff,
                companyResult.dualTariff
                  ? { annualVT: companyResult.annualVT, annualNT: companyResult.annualNT }
                  : null,
              );
              setResult({ kind: 'company', values: companyResult, context });
              setStep('result');
              setError('');
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <AreaField
            value={draft.distributionArea}
            onChange={(distributionArea) => setDraft((d) => ({ ...d, distributionArea }))}
          />
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          <div className="step-actions">
            <button className="button primary" type="submit">
              VYHODNOTIT
            </button>
          </div>
        </form>
      )}
      {step === 'result' && result && <ResultView result={result} draft={draft} />}
    </main>
  );
}
