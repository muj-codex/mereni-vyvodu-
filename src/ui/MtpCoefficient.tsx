import { useState } from 'react';
import { formatNumber } from '../core/numbers';
export function MtpCoefficient({ primary, meter }: { primary: number; meter: number }) {
  const [info, setInfo] = useState(false);
  return (
    <div className="field mtp-coefficient">
      <span>
        Korekční koeficient{' '}
        <button
          className="icon-button"
          aria-label="Informace o korekčním koeficientu"
          aria-expanded={info}
          onClick={() => setInfo(!info)}
        >
          ⓘ
        </button>
      </span>
      <output aria-label="Korekční koeficient">× {formatNumber(primary / meter, 3, true)}</output>
      {info && (
        <p className="hint">
          Korekční koeficient se používá při porovnání stavů elektroměru s Energis. Vypočítává se z
          poměru skutečného MTP a MTP nastaveného v elektroměru. Příklad: 300 / 600 = 0,500.
        </p>
      )}
    </div>
  );
}
