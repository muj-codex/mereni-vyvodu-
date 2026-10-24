import { Info } from '../ui/Info';
export type Boundary = 'previous' | 'next';
export function EnergisHelp() {
  return (
    <Info label="−E / +E">
      -E = Energis do předchozí časové hranice. +E = Energis do následující časové hranice. Příklad:
      ruční odečet 08:37 → -E = 08:30, +E = 08:45.
    </Info>
  );
}
export function EnergisBoundary({
  value,
  onChange,
}: {
  value: Boundary;
  onChange: (v: Boundary) => void;
}) {
  return (
    <div className="energis-boundary" role="group" aria-label="Hranice Energisu">
      {(['previous', 'next'] as const).map((v) => (
        <button
          type="button"
          key={v}
          aria-pressed={value === v}
          className={value === v ? 'active' : ''}
          onClick={() => onChange(v)}
        >
          {v === 'previous' ? '-E' : '+E'}
        </button>
      ))}
      <EnergisHelp />
    </div>
  );
}
