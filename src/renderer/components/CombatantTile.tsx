import type { Combatant } from "../../shared";
import { useApp } from "../store/app-context";
import { HpBar } from "./HpBar";
import { HpStepper } from "./HpStepper";

/** One combatant: name, HP readout, HP bar, and damage/heal controls. */
export function CombatantTile({ combatant }: { combatant: Combatant }) {
  const { actions } = useApp();

  const adjust = (delta: number) => {
    const next = Math.max(0, Math.min(combatant.maxHp, combatant.currentHp + delta));
    actions.adjustHp(combatant.id, next);
  };

  return (
    <div className="combatant-tile">
      <div className="combatant-row">
        <span className="combatant-name">{combatant.name}</span>
        <span className="combatant-hp">
          {combatant.currentHp}
          <span className="combatant-hp-max">/{combatant.maxHp}</span>
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label={`Remove ${combatant.name}`}
          onClick={() => actions.removeCombatant(combatant.id)}
        >
          ×
        </button>
      </div>
      <HpBar currentHp={combatant.currentHp} maxHp={combatant.maxHp} />
      <HpStepper onAdjust={adjust} />
    </div>
  );
}
