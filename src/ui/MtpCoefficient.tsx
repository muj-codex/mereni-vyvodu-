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
          Koeficient se použije při výpočtu skutečné spotřeby z rozdílu stavů elektroměru.
        </p>
      )}
    </div>
  );
}
