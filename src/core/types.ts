import type { Phase } from './config';
export type Triple<T> = [T, T, T];
export interface PhaseReading {
  u: number;
  i: number;
  pf: number;
  p: number;
  currentAngleDegrees?: number;
}
export interface MeterConfig {
  actualMtp: number;
  meterMtp: number;
  voltage: number;
  meterPulse: number;
  energisPulse: number | 'X';
}
export interface IntervalInput {
  from: string;
  to: string;
  start: number;
  end: number;
  energis: number;
}
export interface MeasurementInput {
  serial: string;
  config: MeterConfig;
  interval?: IntervalInput;
  phases: Triple<PhaseReading>;
  kyoritsu: number;
  energis: number;
}
export interface Scenario {
  id: string;
  permutation: Triple<Phase>;
  shorted: Triple<boolean>;
  power: number | null;
  error: number | null;
  score: number | null;
  issues: string[];
}
export interface Diagnosis {
  status: 'ok' | 'outside' | 'near-zero';
  differencePercent: number | null;
  scenarios: Scenario[];
  best?: Scenario;
  alternative?: Scenario;
  warnings: string[];
  modelVersion: string;
}
export interface MeasurementRecord {
  id: string;
  savedAt: string;
  localTimestamp: string;
  input: MeasurementInput;
  diagnosis: Diagnosis;
}
export interface FormDraft {
  serial: string;
  config: MeterConfig;
  intervalEnabled: boolean;
  interval: { from: string; to: string; start: string; end: string; energis: string };
  phases: Triple<{ u: string; i: string; pf: string; p: string }>;
  kyoritsu: string;
  energis: string;
}
