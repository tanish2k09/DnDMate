import type { Combatant } from "../../shared";
import { useApp } from "../store/app-context";
import { ClassBadge } from "./ClassBadge";
import { HpSlider } from "./HpSlider";
import { HpStepper } from "./HpStepper";

/** One combatant: class badge, name, HP slider, and damage/heal controls. */
export function CombatantTile({ combatant }: { combatant: Combatant }) {
  const { actions } = useApp();

  // adjust composes on top of the *current* (draft) value the row is rendering
  // with — so clicking -5 then +1 lands at -4 in the queue, not +1 vs. live.
  const adjust = (delta: number) => {
    const next = Math.max(0, Math.min(combatant.maxHp, combatant.currentHp + delta));
    actions.adjustHp(combatant.id, next);
  };

  const setHp = (value: number) => {
    actions.adjustHp(combatant.id, Math.max(0, Math.min(combatant.maxHp, value)));
  };

  return (
    <div className="combatant-tile">
      <div className="combatant-row">
        <ClassBadge
          charClass={combatant.charClass}
          onChange={(charClass) => actions.setCombatantClass(combatant.id, charClass)}
        />
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
      <HpSlider currentHp={combatant.currentHp} maxHp={combatant.maxHp} onChange={setHp} />
      <HpStepper onAdjust={adjust} />
    </div>
  );
}
