import { formatNumber } from '../core/numbers';
// Display-only: never stored in input, history or export, never passed into the model.
export function MtpCoefficient({ primary, meter }: { primary: number; meter: number }) {
  return (
    <div className="field mtp-coefficient">
      <span>Korekční koeficient</span>
      <output aria-label="Korekční koeficient">× {formatNumber(primary / meter, 3)}</output>
    </div>
  );
}
