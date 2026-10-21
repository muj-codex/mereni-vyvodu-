import type { HistoryRecord } from './types';
export const isIntervalCheck = (
  r: HistoryRecord,
): r is import('./intervalCheck').IntervalCheckRecord => 'kind' in r && r.kind === 'interval-check';
export function recordVoltage(r: HistoryRecord): number {
  return 'config' in r.input
    ? r.input.config.voltage
    : (r.input.networkVoltage ?? (r.input.vn ? 10000 : 400));
}
export function voltageLabel(voltage: number) {
  return voltage > 500
    ? `VN ${String(voltage / 1000).replace('.', ',')} kV`
    : `NN ${voltage} V${voltage === 500 ? ' – ARON' : ''}`;
}
export function recordTypeLabel(r: HistoryRecord) {
  return isIntervalCheck(r)
    ? 'Kontrola stavů'
    : 'kind' in r && r.kind === 'current'
      ? '1f měření'
      : '3f měření';
}
export function filterHistory(records: HistoryRecord[], location = '', voltage = '') {
  return records.filter(
    (r) =>
      (!location || r.input.identification?.location === location) &&
      (!voltage || recordVoltage(r) === Number(voltage)),
  );
}
