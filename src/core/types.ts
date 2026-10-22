import type { IntervalCheckRecord } from './intervalCheck';
import type { CurrentRecord } from './current';
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
export interface Identification {
  networkVoltage?: number;
  date: string;
  time?: string;
  location: string;
  placement: string;
}
export type HistoryRecord = MeasurementRecord | CurrentRecord | IntervalCheckRecord;
export interface MeasurementInput {
  identification?: Identification;
  serial: string;
  config: MeterConfig;
  interval?: IntervalInput;
  phases: Triple<PhaseReading>;
  kyoritsu: number;
  energis: number;
}
interface ScenarioResult {
  id: string;
  power: number | null;
  error: number | null;
  score: number | null;
  issues: string[];
}
export interface ThreeCurrentScenario extends ScenarioResult {
  kind?: 'three-current';
  permutation: Triple<Phase>;
  shorted: Triple<boolean>;
}
export interface AronScenario extends ScenarioResult {
  kind: 'aron';
  currents: [0 | 2, 0 | 2];
  // Polarity is attached to the meter member (1–3 / 7–9), not the source phase.
  reversed: [boolean, boolean];
  branchPowers: [number | null, number | null];
}
export type Scenario = ThreeCurrentScenario | AronScenario;
export interface Diagnosis {
  // Absent on legacy records: retain their original three-current interpretation.
  mode?: 'three-current' | 'aron';
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
  originalDraft?: FormDraft;
  diagnosis: Diagnosis;
}
export interface FormDraft {
  carryIdentification?: boolean;
  identification?: Identification;
  serial: string;
  config: MeterConfig;
  intervalEnabled: boolean;
  interval: { from: string; to: string; start: string; end: string; energis: string };
  phases: Triple<{ u: string; i: string; pf: string; p: string }>;
  kyoritsu: string;
  energis: string;
}
