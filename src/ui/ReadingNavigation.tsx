export type ReadingMode = 'single' | 'series' | 'stylus' | 'history';

export function ReadingNavigation({
  active,
  onChange,
}: {
  active?: ReadingMode;
  onChange: (mode: ReadingMode) => void;
}) {
  return (
    <nav className="segmented reading-navigation" aria-label="Odečty">
      {(['single', 'series', 'stylus'] as const).map((mode, i) => (
        <button
          key={mode}
          type="button"
          className={active === mode ? 'active' : ''}
          aria-pressed={active === mode}
          onClick={() => onChange(mode)}
        >
          {['Jednotlivý odečet', 'Série odečtů', 'Stylus'][i]}
        </button>
      ))}
    </nav>
  );
}
