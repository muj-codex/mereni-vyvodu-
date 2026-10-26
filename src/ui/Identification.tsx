import { referenceLocations, type BindingStatus } from '../series/reference/directory';
import { ReferenceBinding } from './ReferenceBinding';
import type { Identification } from '../core/types';
import { locations } from '../core/current';
export function IdentificationFields({
  serial,
  value,
  vn = false,
  onSerial,
  onChange,
  reference,
}: {
  serial: string;
  value: Identification;
  vn?: boolean;
  reference?: { node: string; status: BindingStatus; onNode: (value: string) => void };
  onSerial: (s: string) => void;
  onChange: (v: Identification) => void;
}) {
  return (
    <section className="card identification">
      <h3>IDENTIFIKACE MĚŘENÍ</h3>
      <div className="field-grid">
        <label className="field">
          <span>VÝROBNÍ ČÍSLO ELEKTROMĚRU</span>
          <input
            id="serial"
            type="text"
            value={serial}
            onChange={(e) => onSerial(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>DATUM</span>
          <input
            type="date"
            value={value.date}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
          />
        </label>
        {reference && (
          <label className="field">
            <span>UZEL</span>
            <input
              aria-label="UZEL"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={reference.node}
              onChange={(e) => reference.onNode(e.target.value.replace(/\D/g, ''))}
            />
          </label>
        )}
        <label className="field">
          <span>{vn ? 'ROZVODNA' : 'TRAFOSTANICE'}</span>
          <select
            aria-label={vn ? 'ROZVODNA' : 'TRAFOSTANICE'}
            value={value.location}
            onChange={(e) => onChange({ ...value, location: e.target.value })}
          >
            {reference && <option value="">Vyberte TS / rozvodnu</option>}
            {reference &&
              value.location &&
              !locations(vn).includes(value.location) &&
              !referenceLocations.includes(value.location) && <option>{value.location}</option>}
            {[...new Set([...locations(vn), ...(reference ? referenceLocations : [])])].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>POLE / UMÍSTĚNÍ</span>
          <input
            value={value.placement}
            onChange={(e) => onChange({ ...value, placement: e.target.value })}
          />
        </label>
      </div>
      {reference && <ReferenceBinding status={reference.status} />}
      <p className="hint">
        Čas vyhodnocení se zaznamená automaticky na sekundy. Počáteční nuly čísla elektroměru
        zůstávají zachovány.
      </p>
    </section>
  );
}
export function IdentificationSummary({
  serial,
  value,
  fallback,
  temporalLabel,
}: {
  serial: string;
  value?: Identification;
  fallback?: string;
  temporalLabel?: string;
}) {
  return (
    <section className="card identification-summary">
      <strong>Elektroměr {serial}</strong>
      <p>
        {value
          ? `${temporalLabel ?? `${value.date} ${value.time ?? ''}`} · ${value.location} · ${value.placement} · ${value.networkVoltage ? (value.networkVoltage > 500 ? `VN ${String(value.networkVoltage / 1000).replace('.', ',')} kV` : `NN ${value.networkVoltage} V${value.networkVoltage === 500 ? ' – ARON' : ''}`) : ''}`
          : (temporalLabel ?? fallback)}
      </p>
    </section>
  );
}
