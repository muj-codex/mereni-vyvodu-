import type { Identification } from '../core/types';
import { locations } from '../core/current';
export function IdentificationFields({
  serial,
  value,
  vn = false,
  onSerial,
  onChange,
}: {
  serial: string;
  value: Identification;
  vn?: boolean;
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
        <label className="field">
          <span>{vn ? 'ROZVODNA' : 'TRAFOSTANICE'}</span>
          <select
            aria-label={vn ? 'ROZVODNA' : 'TRAFOSTANICE'}
            value={value.location}
            onChange={(e) => onChange({ ...value, location: e.target.value })}
          >
            {locations(vn).map((v) => (
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
}: {
  serial: string;
  value?: Identification;
  fallback?: string;
}) {
  return (
    <section className="card identification-summary">
      <strong>Elektroměr {serial}</strong>
      <p>
        {value
          ? `${value.date} ${value.time ?? ''} · ${value.location} · ${value.placement} · ${value.networkVoltage ? (value.networkVoltage > 500 ? `VN ${String(value.networkVoltage / 1000).replace('.', ',')} kV` : `NN ${value.networkVoltage} V${value.networkVoltage === 500 ? ' – ARON' : ''}`) : ''}`
          : fallback}
      </p>
    </section>
  );
}
