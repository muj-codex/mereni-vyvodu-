import { assessCentropol } from './centropolCosts';
import { assessPre } from './preCosts';
import { assessInnogy, innogyLimitWarning } from './innogyCosts';
import { assessOrlen } from './orlenCosts';
import { assessElectricity24 as assessEsco } from './escoElectricity24Costs';
import { assessEonVariant } from './eonVariantCosts';
import type { ComparisonContext } from './calculations';
export function compareBusinessOffers(code: string, context: ComparisonContext) {
  if (context.customer !== 'C') return { offers: [], missing: [] };
  const args = [
    code,
    context.distributionArea,
    context.breakerA,
    context.annualKwh,
    context.annualSplit,
  ] as const;
  const orlen = assessOrlen(...args);
  const esco = assessEsco(...args);
  const variant = assessEonVariant(...args);
  const results = [
    { name: 'ORLEN', pricing: 'Ověřený ceník 2026', value: orlen.priceWithVat },
    {
      name: 'ČEZ ESCO',
      pricing: 'Elektřina 24 · Fixace 24 měsíců',
      value: esco?.priceWithVat ?? null,
    },
    { name: 'E.ON Variant', pricing: 'Fixace 2 roky', value: variant.priceWithVat },
    { name: 'innogy', pricing: context.annualKwh > 30000 ? `elektřina Benefit 24 · Fixace 24 měsíců · ${innogyLimitWarning}` : 'elektřina Benefit 24 · Fixace 24 měsíců', value: assessInnogy('C', ...args).priceWithVat },
    { name: 'PRE', pricing: 'PRE PROUD FAVORIT 2 10/2026 · Garance do 30. 9. 2028', value: assessPre('C', ...args).priceWithVat },
    { name: 'Centropol', pricing: 'FIXNĚ PRO PODNIKATELE na 2 roky', value: assessCentropol('C', ...args).priceWithVat },
  ];
  const offers = results
    .filter((r): r is typeof r & { value: number } => r.value !== null)
    .sort((a, b) => a.value - b.value || a.name.localeCompare(b.name));
  return { offers, missing: results.filter((r) => r.value === null).map((r) => r.name) };
}
