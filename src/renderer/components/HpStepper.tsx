interface HpStepperProps {
  onAdjust: (delta: number) => void;
}

const STEPS = [-5, -1, 1, 5] as const;

/** Quick damage/heal buttons for a combatant. */
export function HpStepper({ onAdjust }: HpStepperProps) {
  return (
    <div className="hp-stepper">
      {STEPS.map((delta) => (
        <button
          key={delta}
          type="button"
          className={`hp-step ${delta < 0 ? "hp-step-damage" : "hp-step-heal"}`}
          onClick={() => onAdjust(delta)}
        >
          {delta > 0 ? `+${delta}` : delta}
        </button>
      ))}
    </div>
  );
}
