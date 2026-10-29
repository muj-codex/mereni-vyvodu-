import { InnogyPrices } from './InnogyPrices';
import { EpetPrices } from './EpetPrices';
import { assessEpet } from './epetCosts';
import { MndPrices } from './MndPrices';
import { assessMnd } from './mndCosts';
import { CentropolPrices } from './CentropolPrices';
import { assessCentropol } from './centropolCosts';
import { PrePrices } from './PrePrices';
import { assessPre } from './preCosts';
import { assessInnogy } from './innogyCosts';
import { assessEonHousehold } from './eonCosts';
import type { assessHousehold } from './cezCosts';
import type { DistributionArea } from './model';
export function InnogyHouseholdComparison({
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
  let innogy: ReturnType<typeof assessInnogy> | null = null;
  let eon: ReturnType<typeof assessEonHousehold> = null;
  try {
    innogy = assessInnogy('D', code, area, amps, vt + nt, { annualVT: vt, annualNT: nt }, phases);
    eon = assessEonHousehold(code, area, amps, phases, vt, nt);
  } catch {
    /* Shared input validation is displayed above. */
  }
  let pre: ReturnType<typeof assessPre> | null = null;
  try { pre = assessPre('D', code, area, amps, vt + nt, { annualVT: vt, annualNT: nt }, phases); } catch { /* Shared validation. */ }
  let centropol: ReturnType<typeof assessCentropol> | null = null;
  try { centropol = assessCentropol('D', code, area, amps, vt+nt, {annualVT:vt,annualNT:nt}, phases); } catch { /* Shared validation. */ }
  let mnd: ReturnType<typeof assessMnd> | null = null;
  try { mnd = assessMnd('D', code, area, amps, vt+nt, {annualVT:vt,annualNT:nt}, phases); } catch { /* Shared validation. */ }
  let epet: ReturnType<typeof assessEpet> | null = null;
  try { epet = assessEpet('D', code, area, amps, vt+nt, {annualVT:vt,annualNT:nt}, phases); } catch { /* Shared validation. */ }
  const offers = [
    { name: 'ČEZ', value: cezResult?.priceWithVat ?? null },
    { name: 'E.ON', value: eon?.priceWithVat ?? null },
    { name: 'innogy', value: innogy?.priceWithVat ?? null },
    { name: 'PRE', value: pre?.priceWithVat ?? null },
    { name: 'Centropol', value: centropol?.priceWithVat ?? null },
    { name: 'MND', value: mnd?.priceWithVat ?? null },
    { name: 'EPET', value: epet?.priceWithVat ?? null },
  ]
    .filter((o): o is { name: string; value: number } => o.value !== null)
    .sort((a, b) => a.value - b.value || a.name.localeCompare(b.name));
  const fmt = (n: number) =>
    Number.isFinite(n)
      ? new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n)
      : '—';
  return (
    <>
      <InnogyPrices
        customer="D"
        code={code}
        area={area}
        amps={amps}
        phases={phases}
        annualKwh={vt + nt}
        split={{ annualVT: vt, annualNT: nt }}
      />
      <PrePrices customer="D" code={code} area={area} amps={amps} phases={phases} annualKwh={vt + nt} split={{annualVT:vt,annualNT:nt}} />
      <CentropolPrices customer="D" code={code} area={area} amps={amps} phases={phases} annualKwh={vt+nt} split={{annualVT:vt,annualNT:nt}} />
      <MndPrices customer="D" code={code} area={area} amps={amps} phases={phases} annualKwh={vt+nt} split={{annualVT:vt,annualNT:nt}} />
      <EpetPrices customer="D" code={code} area={area} amps={amps} phases={phases} annualKwh={vt+nt} split={{annualVT:vt,annualNT:nt}} />
      <section className="card" aria-label="Společné pořadí domácností">
        <h3>Pořadí úplných nabídek domácností</h3>
        <p>
          Stejná sazba {code}, oblast {area}, jistič {phases}×
          {Number.isFinite(amps) ? fmt(amps) : '—'} A, VT {fmt(vt)} kWh a NT {fmt(nt)} kWh za rok.
        </p>
        {offers.length >= 2 ? (
          <ol aria-label="Pořadí domácích nabídek">
            {offers.map((o) => (
              <li key={o.name}>
                {o.name} · {fmt(o.value)} Kč/rok včetně DPH · rozdíl proti nejlevnější{' '}
                {fmt(o.value - offers[0].value)} Kč/rok
                {o.name === 'MND' && mnd?.warning && <span className="notice">{mnd.warning}</span>}
              </li>
            ))}
          </ol>
        ) : (
          <p>Pro pořadí potřebujeme alespoň dvě úplné ověřené nabídky.</p>
        )}
      </section>
    </>
  );
}
