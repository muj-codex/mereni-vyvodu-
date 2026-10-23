import { Comparisons, StateCheckSummary } from './ui/Comparisons';
import { Info, SaveInfo } from './ui/Info';
import { startKyoritsu, resetInterval } from './core/measurement';
import { MtpSelect } from './ui/MtpSelect';
import { CurrentMeasurement } from './ui/CurrentMeasurement';
import { IdentificationFields, IdentificationSummary } from './ui/Identification';
import { emptyIdentification, locations, validateIdentification } from './core/current';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PHASES, type Phase } from './core/config';
import { createRecord, emptyDraft, readDraft, saveAndReset } from './core/measurement';
import { parseNumber } from './core/numbers';
import { compareEnergy } from './core/energy';
import type { FormDraft, HistoryRecord, MeterConfig } from './core/types';
import { createHistory } from './data/history';
import { Field, SelectField } from './ui/Fields';
import { Detail, Icon, Inspection, PhaseBadge, Result } from './ui/components';
import { Interval, IntervalResult } from './ui/Interval';
import { History } from './ui/History';
import { MtpCoefficient } from './ui/MtpCoefficient';
const STEPS = [
  'Základ / kontrola stavů',
  'Napětí a proudy',
  'PF a výkony',
  'Vizuální výsledek',
  'Co prověřit',
  'Detail výsledku',
];
const DRAFT_KEY = 'mereni-draft-v1';
function restoreDraft(): FormDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (typeof d.serial === 'string' && d.phases?.length === 3 && d.config && d.interval)
        return { ...d, identification: d.identification ?? emptyIdentification() };
    }
  } catch {
    /* Storage unavailable: retain current-session functionality. */
  }
  return emptyDraft();
}
export default function App() {
  const [mainSection, setMainSection] = useState('measurement');
  const [mode, setMode] = useState<'power' | 'current'>('power');
  const [draft, setDraft] = useState<FormDraft>(restoreDraft),
    [step, setStep] = useState(0),
    [tab, setTab] = useState<'measure' | 'history'>('measure');
  const [records, setRecords] = useState<HistoryRecord[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine),
    [offlineReady, setOfflineReady] = useState(false),
    [help, setHelp] = useState(false),
    [storagePersistent, setStoragePersistent] = useState<boolean | null>(null);
  const repo = useMemo(() => createHistory(), []);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const baseDraft = useRef<FormDraft | null>(null);
  const notify = (text: string) => {
    setMessage(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setMessage(''), 6000);
  };
  useEffect(() => {
    let alive = true;
    repo
      .all()
      .then((r) => {
        if (alive) setRecords(r);
      })
      .catch(() =>
        setError(
          'Lokální úložiště není dostupné. Uložení měření nebude možné; zkontrolujte nastavení prohlížeče.',
        ),
      )
      .finally(() => setLoading(false));
    return () => {
      alive = false;
    };
  }, [repo]);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      notify(
        'Průběžné ukládání formuláře není dostupné. Nezavírejte aplikaci před uložením měření.',
      );
    }
  }, [draft]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const ready = () => setOfflineReady(true);
    window.addEventListener('app-offline-ready', ready);
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.ready.then(() => {
        if (navigator.serviceWorker.controller) setOfflineReady(true);
      });
    navigator.storage
      ?.persisted?.()
      .then(setStoragePersistent)
      .catch(() => setStoragePersistent(false));
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('app-offline-ready', ready);
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.focus();
  }, [step, tab]);
  const evaluation = useMemo(() => {
    try {
      return { record: createRecord(readDraft(draft)), error: '' };
    } catch (e) {
      return { record: null, error: (e as Error).message };
    }
  }, [draft]);
  const change = (next: FormDraft) => {
    setDraft(next);
    setError('');
  };
  const config = (key: keyof MeterConfig, value: number | 'X') =>
    change({ ...draft, config: { ...draft.config, [key]: value } });
  const phase = (index: Phase, key: 'u' | 'i' | 'pf' | 'p', value: string) =>
    change({
      ...draft,
      phases: draft.phases.map((p, i) =>
        i === index ? { ...p, [key]: value } : p,
      ) as FormDraft['phases'],
    });
  function navigate(next: number, useStateCheck = false) {
    if (next > 0 && !(step === 0 && draft.carryIdentification === false) && !draft.serial.trim()) {
      setError('Vyplňte číslo elektroměru.');
      return;
    }
    if (next > 0 && !(step === 0 && draft.carryIdentification === false)) {
      try {
        validateIdentification(draft.identification ?? emptyIdentification());
      } catch (e) {
        setError((e as Error).message);
        return;
      }
    }
    if (step === 1 && next > 1) {
      for (let i = 0; i < 3; i++) {
        const p = draft.phases[i];
        if (
          !Number.isFinite(parseNumber(p.u)) ||
          parseNumber(p.u) <= 0 ||
          (!(draft.config.voltage === 500 && i === 1) &&
            (!Number.isFinite(parseNumber(p.i)) || parseNumber(p.i) < 0))
        ) {
          setError(
            draft.config.voltage === 500 && i === 1
              ? 'Vyplňte kladné UL2. ARON – IL2 se nepoužívá.'
              : `Vyplňte kladné UL${i + 1} a nezáporné IL${i + 1}.`,
          );
          return;
        }
      }
    }
    if (next >= 3 && !evaluation.record) {
      setError(evaluation.error);
      return;
    }
    if (step === 0 && next === 1) {
      baseDraft.current = structuredClone(draft);
      change(startKyoritsu(draft, useStateCheck));
    }
    if (next === 0 && baseDraft.current) {
      change({
        ...baseDraft.current,
        phases: draft.phases,
        kyoritsu: draft.kyoritsu,
        energis: draft.energis,
      });
    }
    setError('');
    setStep(next);
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const { record, nextDraft } = await saveAndReset(draft, (r) => repo.add(r));
      setRecords((r) => [record, ...r]);
      const ready = baseDraft.current
        ? { ...nextDraft, interval: resetInterval(baseDraft.current.interval) }
        : nextDraft;
      setDraft(ready);
      baseDraft.current = null;
      setStep(0);
      setError('');
      notify(`Měření ${record.input.serial} uloženo. Připraveno pro další měření.`);
      if (navigator.storage?.persist) {
        // Persistence permission is independent from the completed measurement transaction.
        void navigator.storage
          .persist()
          .then(setStoragePersistent)
          .catch(() => setStoragePersistent(false));
      }
    } catch (e) {
      setError(`Měření nebylo uloženo. Formulář zůstává zachován. ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="bolt" size={23} />
          </span>
          <div>
            <strong>KONTROLA MĚŘENÍ</strong>
            <span>Elektroměry & vývody</span>
          </div>
        </div>
        <button
          className="icon-button help-button"
          aria-label="Nápověda a instalace"
          onClick={() => setHelp(true)}
        >
          <Icon name="info" />
        </button>
      </header>
      <div className="status-strip">
        <span>
          <i className={online ? 'status-dot' : 'status-dot offline'} />
          {online ? 'Lokální pracovní režim' : 'Bez připojení'}
        </span>
        <span>
          {import.meta.env.DEV
            ? 'Vývojový režim'
            : offlineReady
              ? 'Offline připraveno'
              : 'Offline se připravuje'}
        </span>
      </div>
      <div className="segmented" aria-label="Hlavní části aplikace">
        <button
          className={mainSection === 'measurement' ? 'active' : ''}
          onClick={() => setMainSection('measurement')}
        >
          MĚŘENÍ
        </button>
        <button
          className={mainSection === 'rates' ? 'active' : ''}
          onClick={() => setMainSection('rates')}
        >
          VÝPOČET SPOTŘEBY A SAZEB
        </button>
      </div>
      {mainSection === 'rates' && (
        <section className="card">
          <h1>Výpočet spotřeby a sazeb</h1>
          <p>Připravuje se</p>
        </section>
      )}
      <main hidden={mainSection !== 'measurement'}>
        {tab === 'history' ? (
          <History
            records={records}
            loading={loading}
            onDelete={async (id) => {
              await repo.remove(id);
              setRecords((r) => r.filter((x) => x.id !== id));
            }}
            onClear={async () => {
              await repo.removeAllExplicitly();
              setRecords([]);
            }}
            onImport={async (incoming) => {
              const result = await repo.merge(incoming);
              setRecords(await repo.all());
              return result;
            }}
            notify={notify}
          />
        ) : (
          <>
            <div className="segmented" aria-label="Režim měření">
              <button className={mode === 'power' ? 'active' : ''} onClick={() => setMode('power')}>
                3f měření
              </button>
              <button
                className={mode === 'current' ? 'active' : ''}
                onClick={() => setMode('current')}
              >
                1f měření
              </button>
            </div>
            {mode === 'current' ? (
              <CurrentMeasurement
                notify={notify}
                shared={
                  draft.carryIdentification === false
                    ? undefined
                    : {
                        actualMtp: draft.config.actualMtp,
                        serial: draft.serial,
                        identification: {
                          ...(draft.identification ?? emptyIdentification()),
                          networkVoltage: draft.config.voltage,
                        },
                      }
                }
                onSave={async (r) => {
                  await repo.add(r);
                  void navigator.storage
                    ?.persist?.()
                    .then(setStoragePersistent)
                    .catch(() => setStoragePersistent(false));
                  setRecords((prev) => [r, ...prev]);
                }}
              />
            ) : (
              <>
                <div className="step-top">
                  <span>KROK {step + 1} Z 6</span>
                  <span>{step < 3 ? 'ZADÁNÍ MĚŘENÍ' : 'VYHODNOCENÍ'}</span>
                </div>
                <div className="progress-track">
                  {STEPS.map((s, i) => (
                    <button
                      key={s}
                      aria-label={`Krok ${i + 1}: ${s}`}
                      aria-current={step === i ? 'step' : undefined}
                      className={i <= step ? 'filled' : ''}
                      onClick={() => {
                        if (i <= step) navigate(i);
                      }}
                      disabled={i > step}
                    />
                  ))}
                </div>
                <div className="page-heading">
                  <span className="eyebrow">
                    {step === 0
                      ? 'ELEKTROMĚR'
                      : step <= 2
                        ? 'KYORITSU · KEW 6305'
                        : 'DIAGNOSTIKA MĚŘENÍ'}
                  </span>
                  <h1 ref={heading} tabIndex={-1}>
                    {STEPS[step]}
                  </h1>
                  <p>
                    {
                      [
                        'Identifikace elektroměru a nastavení převodů.',
                        'Zadejte skutečné hodnoty po jednotlivých fázích.',
                        'Znaménka PF a činného výkonu se vyhodnocují odděleně.',
                        'Barva vždy označuje fyzickou fázi.',
                        'Interní pomůcka pro kontrolu na elektroměru.',
                        'Naměřené hodnoty a podrobnosti modelu.',
                      ][step]
                    }
                  </p>
                </div>
                {step === 0 && (
                  <>
                    <IdentificationFields
                      vn={draft.config.voltage > 500}
                      serial={draft.serial}
                      value={draft.identification ?? emptyIdentification()}
                      onSerial={(serial) => change({ ...draft, serial })}
                      onChange={(identification) => change({ ...draft, identification })}
                    />
                    <div className="card">
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={draft.carryIdentification !== false}
                          onChange={(e) =>
                            change({ ...draft, carryIdentification: e.target.checked })
                          }
                        />
                        Použít tuto identifikaci i pro následující měření
                      </label>
                      <Info label="přenos identifikace">
                        Přenese pouze identifikaci a konfiguraci do následujícího 1f/3f měření.
                        Nepřenáší naměřené hodnoty ani výsledek předchozí kontroly.
                      </Info>
                    </div>
                    <section className="card" aria-label="Režim sítě v identifikaci">
                      <SelectField
                        label="Režim sítě / napětí"
                        value={draft.config.voltage}
                        onChange={(v) => {
                          const voltage = Number(v);
                          const vn = voltage > 500;
                          change({
                            ...draft,
                            config: { ...draft.config, voltage },
                            identification: {
                              ...(draft.identification ?? emptyIdentification()),
                              networkVoltage: voltage,
                              location: locations(vn).includes(draft.identification?.location ?? '')
                                ? draft.identification!.location
                                : locations(vn)[0],
                            },
                          });
                        }}
                      >
                        <option value={400}>NN 400 V</option>
                        <option value={500}>NN 500 V – ARON</option>
                        <option value={6000}>VN 6 kV</option>
                        <option value={6300}>VN 6,3 kV</option>
                        <option value={10000}>VN 10 kV</option>
                        <option value={10300}>VN 10,3 kV</option>
                      </SelectField>
                    </section>
                    <>
                      <section className="card">
                        <h3>Převody MTP</h3>
                        <div className="field-grid">
                          <MtpSelect
                            label="MTP primár"
                            secondary={draft.config.voltage > 500 ? 1 : 5}
                            value={draft.config.actualMtp}
                            onChange={(v) => config('actualMtp', v)}
                          />
                          <MtpSelect
                            label="MTP elektroměr"
                            secondary={draft.config.voltage > 500 ? 1 : 5}
                            value={draft.config.meterMtp}
                            onChange={(v) => config('meterMtp', v)}
                          />
                          <MtpCoefficient
                            primary={draft.config.actualMtp}
                            meter={draft.config.meterMtp}
                          />
                        </div>
                      </section>
                      <label className="optional-toggle card">
                        <span>
                          <strong>Porovnat stavy s Energis</strong>
                          <small>Volitelná kontrola spotřeby za interval</small>
                        </span>
                        <input
                          type="checkbox"
                          checked={draft.intervalEnabled}
                          onChange={(e) => change({ ...draft, intervalEnabled: e.target.checked })}
                        />
                      </label>
                      {draft.intervalEnabled && (
                        <Interval
                          draft={draft}
                          onChange={(interval) => change({ ...draft, interval })}
                          onSave={async (record) => {
                            await repo.add(record);
                            setRecords((r) => [record, ...r]);
                            void navigator.storage
                              ?.persist?.()
                              .then(setStoragePersistent)
                              .catch(() => setStoragePersistent(false));
                          }}
                          notify={notify}
                        />
                      )}
                      {draft.config.voltage > 500 ? (
                        <p className="notice">
                          VN: pokračujte na 1f měření. Primární proud a napětí ze SCADA.
                        </p>
                      ) : (
                        <div className="step-actions">
                          <button className="button primary" onClick={() => navigate(1)}>
                            MĚŘENÍ KYORITSU <Icon name="arrow" />
                          </button>
                          {draft.intervalEnabled && (
                            <button
                              className="button secondary"
                              onClick={() => {
                                const v = draft.interval;
                                try {
                                  if (!Object.values(v).every(Boolean))
                                    throw Error(
                                      'Vyplňte všechny údaje intervalu nebo kontrolu přeskočte.',
                                    );
                                  /* Full interval check independent of phase inputs. */ validateInterval(
                                    draft,
                                  );
                                  navigate(1, true);
                                } catch (e) {
                                  setError((e as Error).message);
                                }
                              }}
                            >
                              Použít kontrolu stavů a pokračovat
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  </>
                )}
                {step > 0 && step < 3 && draft.stateCheck && (
                  <StateCheckSummary record={draft.stateCheck} />
                )}
                {step === 1 && (
                  <>
                    {draft.carryIdentification !== false ? (
                      <IdentificationSummary
                        serial={draft.serial}
                        value={{ ...draft.identification!, networkVoltage: draft.config.voltage }}
                      />
                    ) : (
                      <>
                        <IdentificationFields
                          serial={draft.serial}
                          value={draft.identification ?? emptyIdentification()}
                          onSerial={(serial) => change({ ...draft, serial })}
                          onChange={(identification) => change({ ...draft, identification })}
                        />
                        <section className="card field-grid">
                          <SelectField
                            label="Režim sítě / napětí"
                            value={draft.config.voltage}
                            onChange={(v) => config('voltage', Number(v))}
                          >
                            <option value={400}>NN 400 V</option>
                            <option value={500}>NN 500 V – ARON</option>
                          </SelectField>
                          <MtpSelect
                            label="MTP primár"
                            secondary={5}
                            value={draft.config.actualMtp}
                            onChange={(v) => config('actualMtp', v)}
                          />
                          <MtpSelect
                            label="MTP elektroměr"
                            secondary={5}
                            value={draft.config.meterMtp}
                            onChange={(v) => config('meterMtp', v)}
                          />
                        </section>
                      </>
                    )}
                    {draft.config.voltage === 500 ? (
                      <p className="hint">
                        U1 = napětí větve L1–L2, U3 = napětí větve L3–L2; PF1/PF3 patří stejným
                        výkonovým větvím.
                      </p>
                    ) : (
                      <section className="card">
                        <SelectField
                          label="Typ zadaného napětí U1–U3"
                          value={draft.voltageBasis ?? 'unknown'}
                          onChange={(v) =>
                            change({ ...draft, voltageBasis: v as FormDraft['voltageBasis'] })
                          }
                        >
                          <option value="unknown">Vyberte typ napětí</option>
                          <option value="phase-neutral">Fázová napětí L1/L2/L3 vůči N</option>
                          <option value="line-line">
                            Sdružená napětí – symetrická 3f soustava
                          </option>
                        </SelectField>
                        <p className="hint">
                          Sdružená napětí lze přepočítat dělením √3 pouze u symetrické soustavy. Pro
                          nesymetrickou soustavu zadejte skutečná fázová napětí.
                        </p>
                      </section>
                    )}
                    <div className="phase-inputs">
                      {PHASES.map((p) => (
                        <section className="card phase-input-card" key={p}>
                          <div className="phase-input-title">
                            <PhaseBadge kind="U" phase={p} />
                            {draft.config.voltage === 500 && p === 1 ? (
                              <span className="aron-center">ARON</span>
                            ) : (
                              <PhaseBadge kind="I" phase={p} />
                            )}
                            <span>FÁZE {p + 1}</span>
                          </div>
                          <div className="two-fields">
                            <Field
                              label={`U${p + 1}`}
                              unit="V"
                              value={draft.phases[p].u}
                              onChange={(v) => phase(p, 'u', v)}
                            />
                            {draft.config.voltage === 500 && p === 1 ? (
                              <p className="aron-center">ARON – IL2 se nepoužívá</p>
                            ) : (
                              <Field
                                label={`IL${p + 1}`}
                                unit="A"
                                value={draft.phases[p].i}
                                onChange={(v) => phase(p, 'i', v)}
                              />
                            )}
                          </div>
                        </section>
                      ))}
                    </div>
                    <p className="hint">
                      Čárka i tečka jsou podporované. Fáze 1 je červená, 2 zelená a 3 žlutá.
                    </p>
                    <div className="step-actions">
                      <button className="button primary" onClick={() => navigate(2)}>
                        POKRAČOVAT NA PF A VÝKONY <Icon name="arrow" />
                      </button>
                      <button className="button secondary" onClick={() => navigate(0)}>
                        Zpět
                      </button>
                    </div>
                  </>
                )}
                {step === 2 && (
                  <>
                    <div className="phase-inputs">
                      {PHASES.map((p) => (
                        <section className="card phase-input-card" key={p}>
                          <div className="phase-input-title">
                            {draft.config.voltage === 500 && p === 1 ? (
                              <span className="aron-center">ARON</span>
                            ) : (
                              <PhaseBadge kind="I" phase={p} />
                            )}
                            <span>FÁZE {p + 1}</span>
                          </div>
                          <div className="two-fields">
                            {draft.config.voltage === 500 && p === 1 ? (
                              <p className="aron-center">ARON – IL2 se nepoužívá</p>
                            ) : (
                              <>
                                <Field
                                  label={`PF${p + 1}`}
                                  value={draft.phases[p].pf}
                                  signed
                                  onChange={(v) => phase(p, 'pf', v)}
                                />
                                <Field
                                  label={`P${p + 1}`}
                                  unit="kW"
                                  value={draft.phases[p].p}
                                  signed
                                  onChange={(v) => phase(p, 'p', v)}
                                />
                              </>
                            )}
                          </div>
                        </section>
                      ))}
                    </div>
                    <p className="hint">
                      +PF: lagging / induktivní · −PF: leading / kapacitní.
                      <br />
                      Tlačítko ± mění znaménko i na klávesnici iPhonu.
                    </p>
                    <section className="card total-card">
                      <h3>Okamžité porovnání</h3>
                      <Field
                        label="Celkový výkon Kyoritsu"
                        unit="kW"
                        value={draft.kyoritsu}
                        signed
                        onChange={(kyoritsu) => change({ ...draft, kyoritsu })}
                      />
                      <Field
                        label="Trend Energis"
                        unit="kW"
                        value={draft.energis}
                        signed
                        onChange={(energis) => change({ ...draft, energis })}
                      />
                      <p className="hint">
                        Kyoritsu je okamžitá reference. Trend Energis může být časově opožděný.
                      </p>
                    </section>
                    <div className="step-actions">
                      <button className="button primary" onClick={() => navigate(3)}>
                        VYHODNOTIT MĚŘENÍ <Icon name="arrow" />
                      </button>
                      <button className="button secondary" onClick={() => navigate(1)}>
                        Zpět
                      </button>
                    </div>
                  </>
                )}
                {step >= 3 && evaluation.record && (
                  <>
                    <IdentificationSummary
                      serial={draft.serial}
                      value={evaluation.record.input.identification}
                    />
                    <Comparisons record={evaluation.record} />
                    {step === 5 && evaluation.record.input.stateCheck && (
                      <IntervalResult
                        record={evaluation.record.input.stateCheck}
                        section="detail"
                      />
                    )}
                    {step === 3 ? (
                      <Result diagnosis={evaluation.record.diagnosis} serial={draft.serial} />
                    ) : step === 4 ? (
                      <Inspection diagnosis={evaluation.record.diagnosis} />
                    ) : (
                      <Detail record={evaluation.record} />
                    )}
                    <div className="step-actions">
                      {step < 5 && (
                        <button className="button secondary" onClick={() => navigate(step + 1)}>
                          {step === 3 ? 'CO PROVĚŘIT NA ELEKTROMĚRU' : 'DETAIL VÝSLEDKU'}
                          <Icon name="arrow" />
                        </button>
                      )}
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => void save()}
                      >
                        <Icon name="check" />
                        {busy ? 'UKLÁDÁM…' : 'ULOŽIT MĚŘENÍ'}
                      </button>
                      <SaveInfo />
                      <button
                        className="text-button centered"
                        onClick={() => navigate(step === 3 ? 2 : step - 1)}
                      >
                        Zpět {step === 3 ? 'k hodnotám' : ''}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
        {error && (
          <div className="notice error" role="alert">
            <Icon name="alert" />
            <div>{error}</div>
          </div>
        )}
      </main>
      <nav
        hidden={mainSection !== 'measurement'}
        className="bottom-nav"
        aria-label="Hlavní navigace"
      >
        <button
          className={tab === 'measure' ? 'active' : ''}
          onClick={() => {
            setTab('measure');
            setError('');
          }}
        >
          <Icon name="meter" />
          <span>Nové měření</span>
        </button>
        <button
          className={tab === 'history' ? 'active' : ''}
          onClick={() => {
            setTab('history');
            setError('');
          }}
        >
          <Icon name="list" />
          <span>Výsledky měření</span>
          {records.length > 0 && <b>{records.length}</b>}
        </button>
      </nav>
      {message && (
        <div className="toast" role="status">
          <Icon name="check" />
          <span>{message}</span>
        </div>
      )}
      {help && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <h2 id="help-title">Práce v terénu</h2>
            <p className="hint">
              Verze {__APP_VERSION__} · build {new Date(__BUILD_DATE__).toLocaleString('cs-CZ')}
            </p>
            <h3>Instalace na iPhone / iPad</h3>
            <p>
              Otevřete aplikaci v Safari přes HTTPS. V nabídce sdílení Safari zvolte „Přidat na
              plochu“ a poté aplikaci otevřete z ikony.
            </p>
            <h3>Offline provoz</h3>
            <p>
              {offlineReady
                ? 'Základní aplikace je uložená pro offline provoz.'
                : 'Počkejte na stav „Offline připraveno“ při prvním načtení.'}{' '}
              Výpočty i historie pracují bez internetu. E-mail vyžaduje poštovní aplikaci a
              připojení pro doručení.
            </p>
            <h3>Uložení a zálohy</h3>
            <p>
              Historie je v IndexedDB tohoto prohlížeče.{' '}
              {storagePersistent
                ? 'Prohlížeč povolil trvalé uložení.'
                : 'Trvalé uložení zatím není potvrzené prohlížečem.'}{' '}
              Data pravidelně exportujte; vymazání dat webu nebo odinstalace je může odstranit.
            </p>
            <button
              className="button secondary"
              onClick={() =>
                void navigator.storage?.persist?.().then((v) => {
                  setStoragePersistent(v);
                  notify(
                    v
                      ? 'Trvalé uložení povoleno.'
                      : 'Prohlížeč trvalé uložení nepovolil. Exportujte důležitá měření.',
                  );
                })
              }
            >
              Požádat o trvalé úložiště
            </button>
            <button className="button primary" onClick={() => setHelp(false)}>
              Rozumím
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function validateInterval(d: FormDraft) {
  compareEnergy(
    {
      from: d.interval.from,
      to: d.interval.to,
      start: parseNumber(d.interval.start),
      end: parseNumber(d.interval.end),
      energis: parseNumber(d.interval.energis),
    },
    d.config,
  );
}
