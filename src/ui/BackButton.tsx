export function BackButton({
  onBack,
  disabled = false,
}: {
  onBack: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className="text-button local-back" disabled={disabled} onClick={onBack}>
      ← Zpět
    </button>
  );
}
