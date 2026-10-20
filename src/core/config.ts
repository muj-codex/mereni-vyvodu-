export const CONFIG = {
  tolerancePercent: 15,
  alternativeMaxScoreGap: 5,
  powerEpsilonKw: 0.001,
  numericEpsilon: 1e-8,
  modelVersion: '1.1.1',
} as const;
export type Phase = 0 | 1 | 2;
export const PHASES = [0, 1, 2] as const;
// Identity, never position or connection, determines a physical phase's colour.
export const PHASE_COLORS = ['#cf343c', '#21834a', '#f2c94c'] as const;
export const SHORT_COLOR = '#687680';
export function phaseColor(phase: Phase | null) {
  return phase === null ? SHORT_COLOR : PHASE_COLORS[phase];
}
export const MTP_OPTIONS = [75, 100, 150, 200, 250, 300, 400, 500, 600] as const;
export const PULSE_OPTIONS = [
  { value: 0.04, label: '40 Wh' },
  { value: 0.1, label: '100 Wh' },
  { value: 0.12, label: '120 Wh' },
  { value: 0.2, label: '200 Wh' },
  { value: 1, label: '1 kWh' },
  { value: 4, label: '4 kWh' },
  { value: 20, label: '20 kWh' },
] as const;
export const VOLTAGE_ANGLES = [0, -120, 120] as const;
