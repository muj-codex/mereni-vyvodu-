import type { ReactNode } from 'react';
import { PHASES, phaseColor, type Phase } from '../core/config';
import { formatNumber } from '../core/numbers';
import { inspectionInstructions } from '../core/diagnosis';
import type { Diagnosis, MeasurementRecord, Scenario } from '../core/types';
export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    bolt: <path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z" />,
    meter: (
      <>
        <path d="M4 18a9 9 0 1 1 16 0" />
        <path d="m12 12 4-5M5 18h14" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    list: (
      <>
        <path d="M8 6h12M8 12h12M8 18h12M3 6h.01M3 12h.01M3 18h.01" />
      </>
    ),
    arrow: <path d="m9 5 7 7-7 7" />,
    check: <path d="m5 12 4 4L19 6" />,
    back: <path d="m15 5-7 7 7 7" />,
    share: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v.01" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="13" rx="2" />
        <path d="M16 8V3H3v13h5" />
      </>
    ),
    alert: (
      <>
        <path d="m12 3 10 18H2L12 3Z" />
        <path d="M12 9v5m0 3v.1" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.info}
    </svg>
  );
}
export function PhaseBadge({
  kind,
  phase,
  shorted = false,
}: {
  kind: 'U' | 'I';
  phase: Phase;
  shorted?: boolean;
}) {
  return (
    <span
      className={`phase-badge ${!shorted && phase === 2 ? 'yellow' : ''} ${shorted ? 'shorted' : ''}`}
      style={{ backgroundColor: phaseColor(shorted ? null : phase) }}
      data-phase={shorted ? 'shorted' : `${kind}${phase + 1}`}
    >
      {shorted ? 'VYZKRATOVÁNO' : `${kind}${phase + 1}`}
    </span>
  );
}
export function Mapping({ scenario, title }: { scenario?: Scenario; title: string }) {
  return (
    <section className="mapping-card">
      <h3>{title}</h3>
      <div className="mapping-head">
        <span>NAPĚTÍ</span>
        <span />
        <span>PROUD</span>
      </div>
      {PHASES.map((target) => {
        const source = scenario?.permutation[target] ?? target;
        return (
          <div className="mapping-row" key={target}>
            <PhaseBadge kind="U" phase={target} />
            <span className="connect">←</span>
            <PhaseBadge kind="I" phase={source} shorted={scenario?.shorted[source]} />
          </div>
        );
      })}
    </section>
  );
}
export function Result({ diagnosis, serial }: { diagnosis: Diagnosis; serial: string }) {
  const ok = diagnosis.status === 'ok';
  return (
    <>
      <div className={`result-banner ${ok ? 'success' : 'warning'}`}>
        <Icon name={ok ? 'check' : 'alert'} size={28} />
        <h2>
          {ok
            ? 'MĚŘENÍ V POŘÁDKU'
            : diagnosis.status === 'near-zero'
              ? 'VÝKON TÉMĚŘ NULOVÝ'
              : 'MIMO TOLERANCI – PROVĚŘIT ZAPOJENÍ'}
        </h2>
      </div>
      <p className="serial-line">
        Elektroměr <strong>{serial}</strong>
      </p>
      {ok ? (
        <>
          <Mapping title="Přiřazení fází – referenční zapojení" />
          <p className="hint">
            Přímé porovnání Kyoritsu × Energis je v toleranci ±15 %. Chybové varianty se
            nezobrazují.
          </p>
        </>
      ) : (
        <>
          {diagnosis.best ? (
            <>
              <Mapping scenario={diagnosis.best} title="Hlavní varianta modelu" />
              <p className="hint">
                Barevné přiřazení je diagnostická pomůcka. Samotná shoda celkového výkonu
                nepotvrzuje zapojení.
              </p>
            </>
          ) : (
            <div className="notice warning">
              Z dostupných dat nelze bezpečně určit hlavní variantu. Ověřte naměřené hodnoty v
              detailu.
            </div>
          )}
          {diagnosis.alternative && (
            <Mapping scenario={diagnosis.alternative} title="DALŠÍ MOŽNÁ VARIANTA" />
          )}
        </>
      )}
      {diagnosis.warnings.map((w) => (
        <p key={w} className="notice warning">
          {w}
        </p>
      ))}
    </>
  );
}
export function Inspection({ diagnosis }: { diagnosis: Diagnosis }) {
  return (
    <>
      <div className="notice">
        <Icon name="info" />
        <div>
          Pracovní pokyny se týkají <strong>elektroměru</strong>. Primární MTP i napěťové fáze se
          považují za správné.
        </div>
      </div>
      <section className="card instructions">
        {inspectionInstructions(diagnosis).map((text, i) => (
          <div className="instruction" key={text}>
            <span>{String(i + 1).padStart(2, '0')}</span>
            <p>{text}</p>
          </div>
        ))}
      </section>
      <p className="hint">
        Energis může být opožděný nebo vyhlazený. Nejprve ověřte souběžnost měření. Pokyny jsou
        interní a nikdy se neposílají e-mailem ani do Excelu.
      </p>
      <p className="notice warning">
        Zásahy pouze podle schváleného bezpečného pracovního postupu. Sekundární proudový obvod MTP
        se nesmí při provozu rozpojit.
      </p>
    </>
  );
}
export function Detail({ record }: { record: MeasurementRecord }) {
  const { input, diagnosis: d } = record;
  return (
    <>
      <section className="card">
        <h3>Porovnání výkonů</h3>
        <dl className="data-list">
          <dt>Výrobní číslo</dt>
          <dd>{input.serial}</dd>
          {record.savedAt && (
            <>
              <dt>Uloženo</dt>
              <dd>{record.localTimestamp}</dd>
            </>
          )}
          <dt>Kyoritsu</dt>
          <dd>{formatNumber(input.kyoritsu)} kW</dd>
          <dt>Energis</dt>
          <dd>{formatNumber(input.energis)} kW</dd>
          <dt>Přímý rozdíl</dt>
          <dd>{formatNumber(d.differencePercent)} %</dd>
          <dt>Modelovaný výkon</dt>
          <dd>{formatNumber(d.best?.power)} kW</dd>
          <dt>Shoda modelu</dt>
          <dd>{formatNumber(d.best?.score)} %</dd>
          {d.alternative && (
            <>
              <dt>Další blízký model</dt>
              <dd>
                {formatNumber(d.alternative.power)} kW / {formatNumber(d.alternative.score)} %
              </dd>
            </>
          )}
        </dl>
      </section>
      <section className="card">
        <h3>Naměřené hodnoty</h3>
        <div className="reading-grid">
          {input.phases.map((p, index) => (
            <div key={index} className="reading-phase">
              <PhaseBadge kind="U" phase={index as Phase} />
              <dl>
                <dt>U</dt>
                <dd>{formatNumber(p.u)} V</dd>
                <dt>I</dt>
                <dd>{formatNumber(p.i)} A</dd>
                <dt>PF</dt>
                <dd>{formatNumber(p.pf, 3)}</dd>
                <dt>P</dt>
                <dd>{formatNumber(p.p)} kW</dd>
              </dl>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <h3>Pulz / elektroměr</h3>
        <dl className="data-list">
          <dt>MTP primár</dt>
          <dd>{input.config.actualMtp}/5 A</dd>
          <dt>MTP elektroměr</dt>
          <dd>{input.config.meterMtp}/5 A</dd>
          <dt>Napětí</dt>
          <dd>{input.config.voltage} V</dd>
          <dt>Pulz elektroměru</dt>
          <dd>{formatNumber(input.config.meterPulse, 3)} kWh</dd>
          <dt>Pulz Energis</dt>
          <dd>
            {input.config.energisPulse === 'X'
              ? 'X'
              : `${formatNumber(input.config.energisPulse, 3)} kWh`}
          </dd>
        </dl>
        {input.interval && (
          <>
            <h4>Ruční kontrola stavů</h4>
            <dl className="data-list">
              <dt>Od</dt>
              <dd>{input.interval.from.replace('T', ' ')}</dd>
              <dt>Do</dt>
              <dd>{input.interval.to.replace('T', ' ')}</dd>
              <dt>Stav OD / DO</dt>
              <dd>
                {formatNumber(input.interval.start)} / {formatNumber(input.interval.end)} kWh
              </dd>
              <dt>Energis interval</dt>
              <dd>{formatNumber(input.interval.energis)} kWh</dd>
            </dl>
          </>
        )}
      </section>
      {d.scenarios.length > 0 && (
        <details className="card technical">
          <summary>Všech 48 scénářů · technický detail</summary>
          <p className="hint">
            Shoda = max(0; 100 × (1 − |model − Energis| / max(|Kyoritsu|; 0,001))). Jde o
            normalizovanou blízkost výkonů.
          </p>
          <ol className="scenario-list">
            {d.scenarios.map((s) => (
              <li key={s.id}>
                <span>
                  {s.permutation
                    .map(
                      (p, t) => `U${t + 1}←${s.shorted[p] ? 'zkrat I' + (p + 1) : 'I' + (p + 1)}`,
                    )
                    .join(' · ')}
                </span>
                <strong>
                  {formatNumber(s.power)} kW · {formatNumber(s.score)} %
                </strong>
                {s.issues.map((x) => (
                  <small key={x}>{x}</small>
                ))}
              </li>
            ))}
          </ol>
        </details>
      )}
      <details className="card">
        <summary>Předpoklady fyzikálního modelu</summary>
        <p>
          U1 = 0°, U2 = −120°, U3 = +120°. PF &gt; 0 je lagging, PF &lt; 0 leading. Směr činného
          výkonu určuje samostatně znaménko P.
        </p>
        <p>
          Ekvivalentní fázové napětí každé fáze je |P| × 1000 / (I × |PF|). Zadaných přibližně 500 V
          se nepoužívá jako napětí fáze vůči neutrálu. Pro chybné přiřazení se používá ekvivalentní
          napětí cílové fáze a úhel a proud zdrojové fyzické fáze.
        </p>
        <p>
          Nulové I, PF nebo P mohou znemožnit kalibraci napětí. V takovém případě se neodhaduje
          vítězný scénář z neúplného pořadí. Nulová větev sama přispívá 0.
        </p>
        <p>
          Ruční kontrola předpokládá registr i pulz škálovaný na primární stranu podle
          naprogramovaného MTP. Korekce = skutečný MTP / MTP elektroměru. Tento předpoklad je třeba
          potvrdit pro konkrétní typ elektroměru.
        </p>
        <p>Verze modelu: {d.modelVersion}. Bluetooth ani přímé řízení měřáku nejsou zapojeny.</p>
      </details>
    </>
  );
}
