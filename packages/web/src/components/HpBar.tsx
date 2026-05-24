interface HpBarProps {
  currentHp: number;
  maxHp: number;
}

/** A horizontal HP bar whose color shifts red -> green with the HP fraction. */
export function HpBar({ currentHp, maxHp }: HpBarProps) {
  const fraction = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
  const hue = Math.round(120 * fraction);
  return (
    <div className="hp-bar" role="progressbar" aria-valuenow={currentHp} aria-valuemax={maxHp}>
      <div
        className="hp-bar-fill"
        style={{ width: `${fraction * 100}%`, background: `hsl(${hue} 60% 45%)` }}
      />
    </div>
  );
}
