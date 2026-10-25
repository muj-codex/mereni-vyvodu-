import { useReducer, type CSSProperties } from 'react';
import { blankSupplierUpdate, type Supplier, type SupplierUpdate } from './model';
import { supplierUpdateReducer } from './supplierUpdate';

const sourceLabels: Record<SupplierUpdate['sourceStatus'], string> = {
  'not-loaded': 'Ceník zatím není načten',
  'not-verified': 'Zdroj zatím není ověřen',
  verified: 'Zdroj ověřen',
  unavailable: 'Zdroj není dostupný',
};
const updateLabels: Record<SupplierUpdate['status'], string> = {
  idle: 'Připraveno',
  updating: 'Probíhá aktualizace',
  success: 'Ověřeno',
  error: 'Chyba aktualizace',
};
// Presentation is independent of a future source adapter and its individual update state.
export function SupplierCardView({
  supplier,
  update,
  onUpdate,
}: {
  supplier: Supplier;
  update: SupplierUpdate;
  onUpdate: () => void;
}) {
  return (
    <article
      className="card tariff-supplier"
      aria-label={supplier.name}
      data-supplier-id={supplier.id}
      data-update-state={update.status}
      data-source-status={update.sourceStatus}
      style={{ '--supplier-accent': supplier.brand.accentColor } as CSSProperties}
    >
      <div className="tariff-supplier-title">
        <span className="tariff-logo" aria-hidden="true">
          {supplier.brand.logoPath ? (
            <img src={supplier.brand.logoPath} alt="" />
          ) : (
            supplier.name.slice(0, 1)
          )}
        </span>
        <h3>{supplier.id === 'orlen' ? 'ORLEN UNIPETROL' : supplier.name}</h3>
      </div>
      {supplier.workingReference && <p className="hint">Pracovní reference pro firmy</p>}
      <dl>
        <div>
          <dt>Ceník platný od:</dt>
          <dd>{update.validFrom ?? 'zatím nenahrán'}</dd>
        </div>
        <div>
          <dt>Naposledy ověřeno:</dt>
          <dd>{update.lastChecked ?? 'zatím neověřeno'}</dd>
        </div>
        <div>
          <dt>Stav ceníku</dt>
          <dd>{sourceLabels[update.sourceStatus]}</dd>
        </div>
        <div>
          <dt>Stav aktualizace</dt>
          <dd>{updateLabels[update.status]}</dd>
        </div>
      </dl>
      <button
        type="button"
        className="button secondary"
        disabled={update.status === 'updating'}
        onClick={onUpdate}
      >
        AKTUALIZOVAT CENÍK
      </button>
      {update.error && (
        <p className="notice error" role="alert">
          {update.error}
        </p>
      )}
      {update.message && (
        <p className="notice" role="status">
          {update.message}
        </p>
      )}
    </article>
  );
}
export function SupplierCard({ supplier }: { supplier: Supplier }) {
  // There is no shared loading/error state across suppliers. The placeholder never starts I/O.
  const [update, dispatch] = useReducer(supplierUpdateReducer, undefined, blankSupplierUpdate);
  return (
    <SupplierCardView
      supplier={supplier}
      update={update}
      onUpdate={() => dispatch({ type: 'placeholder' })}
    />
  );
}
