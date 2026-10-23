import { percentDifference } from './current';
import { compareEnergy } from './energy';
import type { MeasurementRecord } from './types';
export function measurementComparisons(record: MeasurementRecord) {
  const input = record.input;
  const check = input.stateCheck;
  const interval =
    check?.result ?? (input.interval ? compareEnergy(input.interval, input.config) : undefined);
  return [
    {
      key: 'meter-energis',
      label: 'Elektroměr ↔ Energis',
      percent: interval?.percent ?? null,
      note: interval
        ? 'Spotřeby za stejný interval; základ: elektroměr po MTP korekci.'
        : 'Porovnání není dostupné: chybí kontrola stavů.',
    },
    {
      key: 'kyoritsu-energis',
      label: 'Kyoritsu ↔ Energis',
      percent: percentDifference(input.energis, input.kyoritsu),
      note: 'Okamžité výkony; základ: Kyoritsu. Trend Energis může být časově opožděný.',
    },
    {
      key: 'meter-kyoritsu',
      label: 'Elektroměr ↔ Kyoritsu',
      percent: null,
      note: 'Porovnání není dostupné: intervalová spotřeba elektroměru (kWh) a okamžitý výkon Kyoritsu (kW) nejsou souběžné veličiny.',
    },
  ];
}
