import { useId, useMemo } from "react";

interface HpSliderProps {
  currentHp: number;
  maxHp: number;
  onChange: (next: number) => void;
}

/**
 * Range slider with explicit tick marks for setting a combatant's HP.
 * Thumb is brass-finished and aligned to the engraved track. Ticks scale
 * with maxHp so a 200-HP boss doesn't get a forest of marks.
 */
export function HpSlider({ currentHp, maxHp, onChange }: HpSliderProps) {
  const datalistId = useId();
  const safeMax = Math.max(1, maxHp);
  const value = Math.max(0, Math.min(safeMax, currentHp));
  const fraction = value / safeMax;
  const hue = Math.round(120 * fraction);
  const fill = `hsl(${hue} 65% 45%)`;

  const ticks = useMemo(() => buildTicks(safeMax), [safeMax]);

  return (
    <div className="hp-slider">
      <input
        type="range"
        min={0}
        max={safeMax}
        step={1}
        value={value}
        list={datalistId}
        className="hp-slider-input"
        style={
          {
            "--hp-fill": fill,
            "--hp-fraction": fraction,
          } as React.CSSProperties
        }
        onChange={(event) => onChange(Number.parseInt(event.target.value, 10))}
        aria-label="Current HP"
        aria-valuetext={`${value} of ${safeMax}`}
      />
      <datalist id={datalistId}>
        {ticks.map((t) => (
          <option key={t.value} value={t.value} />
        ))}
      </datalist>
      <div className="hp-slider-ticks" aria-hidden>
        {ticks.map((t) => (
          <span
            key={t.value}
            className={t.major ? "hp-tick hp-tick-major" : "hp-tick"}
            style={{ left: `${(t.value / safeMax) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function buildTicks(maxHp: number): Array<{ value: number; major: boolean }> {
  const { minor, major } = tickIntervals(maxHp);
  const ticks: Array<{ value: number; major: boolean }> = [];
  for (let v = 0; v <= maxHp; v += minor) {
    ticks.push({ value: v, major: v % major === 0 });
  }
  // Always show the final mark (the cap) even if it falls off the minor grid.
  if (ticks[ticks.length - 1]?.value !== maxHp) {
    ticks.push({ value: maxHp, major: true });
  }
  return ticks;
}

function tickIntervals(maxHp: number): { minor: number; major: number } {
  if (maxHp <= 30) return { minor: 1, major: 5 };
  if (maxHp <= 80) return { minor: 5, major: 10 };
  if (maxHp <= 200) return { minor: 10, major: 25 };
  return { minor: 25, major: 50 };
}
