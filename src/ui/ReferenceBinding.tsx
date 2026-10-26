import type { BindingStatus } from '../series/reference/directory';
export function ReferenceBinding({ status }: { status: BindingStatus }) {
  if (status === 'empty') return null;
  return (
    <p aria-live="polite" className={`hint reference-binding reference-binding-${status}`}>
      {status === 'verified'
        ? 'Vazba ověřena podle referenčních dat.'
        : 'Vazba UZEL ↔ TS/R ↔ pole ↔ MTP není ověřena. Zkontrolujte zadané hodnoty.'}
    </p>
  );
}
