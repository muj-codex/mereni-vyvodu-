import type { ReactNode } from 'react';
export function Field({
  label,
  value,
  onChange,
  unit,
  signed = false,
  serial = false,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  signed?: boolean;
  serial?: boolean;
  id?: string;
}) {
  const change = (raw: string) => onChange(serial ? raw.replace(/\D/g, '') : raw);
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        {unit && <small>{unit}</small>}
      </span>
      <div className="input-wrap">
        <input
          id={id}
          aria-label={label}
          type="text"
          inputMode={serial ? 'numeric' : 'decimal'}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => change(e.target.value)}
          placeholder={serial ? 'např. 0012345678' : '0,00'}
        />
        {signed && (
          <button
            type="button"
            className="sign-toggle"
            aria-label={`Změnit znaménko ${label}`}
            onClick={() =>
              onChange(value.startsWith('-') ? value.slice(1) : `-${value.replace(/^\+/, '')}`)
            }
          >
            ±
          </button>
        )}
      </div>
    </label>
  );
}
export function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: number | string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}
