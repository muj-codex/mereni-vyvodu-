import { useState } from 'react';
export function Info({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="action-info">
      <button
        type="button"
        className="icon-button"
        aria-label={`Informace: ${label}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ⓘ
      </button>
      {open && (
        <span role="note" className="notice">
          {children}
        </span>
      )}
    </span>
  );
}
export function SaveInfo() {
  return (
    <Info label="uložení měření">
      Uloží měření do historie. Po úspěšném uložení zůstane identifikace a konfigurace, pracovní
      hodnoty a výsledky se vyčistí pro další měření.
    </Info>
  );
}
