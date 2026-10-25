import { tariffsFor, tariffFor } from './catalog';
import { SupplierCard } from './SupplierCard';
import { useState } from 'react';
import { BackButton } from '../ui/BackButton';
import { SelectField } from '../ui/Fields';
import { Info } from '../ui/Info';
import {
  blankTariffDraft,
  breakers,
  distributionAreas,
  periods,
  suppliersFor,
  type BreakerInput,
  type Customer,
  type DistributionArea,
  type TariffDraft,
} from './model';
import './tariffs.css';

type Step = 'customer' | 'method' | 'inputs' | 'summary';
const customerLabels = { C: 'C – PODNIKATEL / FIRMA', D: 'D – DOMÁCNOST' };
const methodLabels = {
  estimate: 'ODHAD PŘED PŘIPOJENÍM',
  actual: 'KONTROLA PODLE SKUTEČNÉ SPOTŘEBY',
};

function NumberInput({
  label,
  value,
  onChange,
  placeholder = '0,00',
  integer = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  integer?: boolean;
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
          required
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
}: {
  label: string;
  value: BreakerInput;
  onChange: (value: BreakerInput) => void;
}) {
  return (
    <>
      <SelectField
        label={label}
        value={value.choice}
        onChange={(choice) => onChange({ ...value, choice })}
      >
        <option value="">Vyberte jistič</option>
        {breakers.map((b) => (
          <option key={b}>{b}</option>
        ))}
        <option value="custom">vlastní</option>
      </SelectField>
      {value.choice === 'custom' && (
        <label className="field">
          <span>Vlastní hodnota jističe</span>
          <div className="input-wrap">
            <input
              aria-label="Vlastní hodnota jističe"
              required
              value={value.custom}
              placeholder="např. 1×25 A"
              onChange={(e) => onChange({ ...value, custom: e.target.value })}
            />
          </div>
        </label>
      )}
    </>
  );
}
function TariffInfo({ customer, code }: { customer: Customer; code: string }) {
  const tariff = tariffFor(customer, code);
  if (!tariff) return null;
  return (
    <div className="tariff-info" key={code}>
      <Info label={`sazba ${tariff.code}`}>
        <span>
          Kód sazby: {tariff.code} · Kategorie: {tariff.category} ·{' '}
          {tariff.tariffType === 'single' ? 'Jednotarifní' : 'Dvoutarifní'} · VT: ano · NT:{' '}
          {tariff.usesNT ? 'ano' : 'ne'}
        </span>
      </Info>
    </div>
  );
}
function Summary({ draft }: { draft: TariffDraft & { customer: Customer } }) {
  const { customer, method, distributionArea, estimate, actual } = draft;
  const breaker = method === 'estimate' ? estimate.breaker : actual.breaker;
  const showBreaker = breaker.choice === 'custom' ? breaker.custom : breaker.choice;
  return (
    <>
      <section className="card" aria-label="Shrnutí vstupů">
        <h2>Shrnutí vstupů</h2>
        <dl className="tariff-summary">
          <div>
            <dt>Typ odběru</dt>
            <dd>{customerLabels[customer]}</dd>
          </div>
          <div>
            <dt>Způsob výpočtu</dt>
            <dd>{method && methodLabels[method]}</dd>
          </div>
          <div>
            <dt>Distribuční oblast</dt>
            <dd>{distributionArea}</dd>
          </div>
          <div>
            <dt>Hlavní jistič</dt>
            <dd>{showBreaker || 'Nezadáno'}</dd>
          </div>
          {method === 'estimate' ? (
            <>
              <div>
                <dt>Výkon spotřebičů</dt>
                <dd>{estimate.powerKw} kW</dd>
              </div>
              <div>
                <dt>Proudové zatížení</dt>
                <dd>{estimate.currentA} A</dd>
              </div>
              <div>
                <dt>Soudobost</dt>
                <dd>{estimate.simultaneity}</dd>
              </div>
              <div>
                <dt>Odhadovaná roční spotřeba</dt>
                <dd>{estimate.annualConsumptionKwh} kWh/rok</dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt>Současná sazba</dt>
                <dd>{actual.tariffCode || 'Nezadáno'}</dd>
              </div>
              <div>
                <dt>Spotřeba za období</dt>
                <dd>{actual.consumptionKwh} kWh</dd>
              </div>
              <div>
                <dt>Délka období</dt>
                <dd>
                  {actual.periodMonths === 'custom'
                    ? actual.customPeriodMonths
                    : actual.periodMonths}{' '}
                  měsíců
                </dd>
              </div>
            </>
          )}
        </dl>
        <p className="notice">Výpočet cen a doporučení sazby bude doplněn v další etapě.</p>
      </section>
      <section aria-label="Ceníky dodavatelů">
        <h2>CENÍKY DODAVATELŮ</h2>
        <p className="hint">{distributionArea} · Ceníky zatím nejsou načteny.</p>
        <div className="tariff-suppliers" key={`${customer}:${distributionArea}`}>
          {suppliersFor(customer).map((s) => (
            <SupplierCard key={s.id} supplier={s} />
          ))}
        </div>
      </section>
    </>
  );
}
export function TariffCalculator() {
  const [step, setStep] = useState<Step>('customer');
  const [draft, setDraft] = useState(blankTariffDraft);
  const [error, setError] = useState('');
  const estimate = draft.estimate,
    actual = draft.actual;
  function back() {
    setError('');
    setStep(step === 'summary' ? 'inputs' : step === 'inputs' ? 'method' : 'customer');
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
              ? 'Způsob výpočtu'
              : step === 'summary'
                ? 'Porovnání – připravujeme'
                : draft.method && methodLabels[draft.method]}
        </h1>
        <p>Vstupní podklady pro budoucí porovnání. Výpočty a ceny zatím nejsou dostupné.</p>
      </div>
      {step === 'customer' && (
        <div className="tariff-choices">
          {(['C', 'D'] as const).map((customer) => (
            <button
              key={customer}
              type="button"
              className="button secondary"
              onClick={() => {
                setDraft((d) => ({
                  ...d,
                  customer,
                  actual: {
                    ...d.actual,
                    tariffCode: d.customer === customer ? d.actual.tariffCode : '',
                  },
                }));
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
          {(['estimate', 'actual'] as const).map((method) => (
            <button
              key={method}
              type="button"
              className="button secondary"
              onClick={() => {
                setDraft((d) => ({ ...d, method }));
                setStep('inputs');
              }}
            >
              {methodLabels[method]}
            </button>
          ))}
        </div>
      )}
      {step === 'inputs' && (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            const breaker = draft.method === 'estimate' ? estimate.breaker : actual.breaker;
            if (
              !draft.distributionArea ||
              !breaker.choice ||
              (draft.method === 'actual' && !actual.periodMonths)
            ) {
              setError('Vyberte distribuční oblast, hlavní jistič a případně délku období.');
              return;
            }
            setError('');
            setStep('summary');
          }}
        >
          <div className="field-grid">
            <SelectField
              label="Distribuční oblast"
              value={draft.distributionArea}
              onChange={(area) =>
                setDraft((d) => ({ ...d, distributionArea: area as DistributionArea | '' }))
              }
            >
              <option value="">Vyberte distribuční oblast</option>
              {distributionAreas.map((area) => (
                <option key={area}>{area}</option>
              ))}
            </SelectField>
            {draft.method === 'estimate' ? (
              <>
                <NumberInput
                  label="Výkon spotřebičů [kW]"
                  value={estimate.powerKw}
                  onChange={(powerKw) =>
                    setDraft((d) => ({ ...d, estimate: { ...d.estimate, powerKw } }))
                  }
                />
                <NumberInput
                  label="Proudové zatížení [A]"
                  value={estimate.currentA}
                  onChange={(currentA) =>
                    setDraft((d) => ({ ...d, estimate: { ...d.estimate, currentA } }))
                  }
                />
                <div>
                  <NumberInput
                    label="Soudobost"
                    placeholder="0,65"
                    value={estimate.simultaneity}
                    onChange={(simultaneity) =>
                      setDraft((d) => ({ ...d, estimate: { ...d.estimate, simultaneity } }))
                    }
                  />
                  <Info label="Soudobost">
                    Koeficient soudobosti bude později použit pro odhad skutečného současného
                    zatížení. Hodnota zůstává ručně editovatelná.
                  </Info>
                </div>
                <BreakerField
                  label="Navržený hlavní jistič"
                  value={estimate.breaker}
                  onChange={(breaker) =>
                    setDraft((d) => ({ ...d, estimate: { ...d.estimate, breaker } }))
                  }
                />
                <NumberInput
                  label="Odhadovaná roční spotřeba [kWh/rok]"
                  value={estimate.annualConsumptionKwh}
                  onChange={(annualConsumptionKwh) =>
                    setDraft((d) => ({ ...d, estimate: { ...d.estimate, annualConsumptionKwh } }))
                  }
                />
              </>
            ) : (
              <>
                <SelectField
                  label="Současná sazba"
                  value={actual.tariffCode}
                  onChange={(tariffCode) =>
                    setDraft((d) => ({ ...d, actual: { ...d.actual, tariffCode } }))
                  }
                >
                  <option value="">Vyberte sazbu {draft.customer}</option>
                  {draft.customer &&
                    tariffsFor(draft.customer).map((tariff) => (
                      <option key={tariff.code}>{tariff.code}</option>
                    ))}
                </SelectField>
                {draft.customer && (
                  <TariffInfo customer={draft.customer} code={actual.tariffCode} />
                )}
                <BreakerField
                  label="Současný hlavní jistič"
                  value={actual.breaker}
                  onChange={(breaker) =>
                    setDraft((d) => ({ ...d, actual: { ...d.actual, breaker } }))
                  }
                />
                <NumberInput
                  label="Spotřeba za období [kWh]"
                  value={actual.consumptionKwh}
                  onChange={(consumptionKwh) =>
                    setDraft((d) => ({ ...d, actual: { ...d.actual, consumptionKwh } }))
                  }
                />
                <SelectField
                  label="Délka období"
                  value={actual.periodMonths}
                  onChange={(periodMonths) =>
                    setDraft((d) => ({ ...d, actual: { ...d.actual, periodMonths } }))
                  }
                >
                  <option value="">Vyberte délku období</option>
                  {periods.map((p) => (
                    <option key={p} value={p}>
                      {p} {p === '1' ? 'měsíc' : p === '2' || p === '3' ? 'měsíce' : 'měsíců'}
                    </option>
                  ))}
                  <option value="custom">vlastní počet měsíců</option>
                </SelectField>
                {actual.periodMonths === 'custom' && (
                  <NumberInput
                    label="Vlastní počet měsíců"
                    integer
                    value={actual.customPeriodMonths}
                    onChange={(customPeriodMonths) =>
                      setDraft((d) => ({ ...d, actual: { ...d.actual, customPeriodMonths } }))
                    }
                  />
                )}
              </>
            )}
          </div>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          <div className="step-actions">
            <button className="button primary" type="submit">
              POKRAČOVAT K POROVNÁNÍ
            </button>
          </div>
        </form>
      )}
      {step === 'summary' && draft.customer && (
        <Summary draft={{ ...draft, customer: draft.customer }} />
      )}
    </main>
  );
}
