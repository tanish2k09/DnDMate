import { type FormEvent, useState } from "react";
import { type Combatant, type CombatantClass, type CombatantGroup, COMBATANT_CLASSES } from "../../shared";
import { useApp } from "../store/app-context";
import { CombatantTile } from "./CombatantTile";

interface RosterSectionProps {
  title: string;
  group: CombatantGroup;
  combatants: Combatant[];
}

const CLASS_LABELS: Record<CombatantClass, string> = {
  barbarian: "Barbarian",
  wizard: "Wizard",
  paladin: "Paladin",
  bard: "Bard",
  ranger: "Ranger",
  druid: "Druid",
  other: "Other",
};

/** A titled roster (party or enemies) with an inline "add combatant" form. */
export function RosterSection({ title, group, combatants }: RosterSectionProps) {
  const { actions } = useApp();
  const [name, setName] = useState("");
  const [maxHp, setMaxHp] = useState("10");
  const [charClass, setCharClass] = useState<CombatantClass>("other");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const hp = Number.parseInt(maxHp, 10);
    if (!name.trim() || !Number.isFinite(hp) || hp < 1) return;
    actions.addCombatant(group, name.trim(), hp, charClass);
    setName("");
    setMaxHp("10");
    setCharClass("other");
  };

  return (
    <section className="roster-section">
      <h2 className="section-title">
        {title}
        <span className="count">{combatants.length}</span>
      </h2>
      <div className="combatant-list">
        {combatants.length === 0 && <p className="empty-note">No combatants yet.</p>}
        {combatants.map((combatant) => (
          <CombatantTile key={combatant.id} combatant={combatant} />
        ))}
      </div>
      <form className="add-form" onSubmit={submit}>
        <input
          className="text-input"
          placeholder="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          className="text-input hp-input"
          type="number"
          min="1"
          placeholder="HP"
          value={maxHp}
          onChange={(event) => setMaxHp(event.target.value)}
        />
        <select
          className="select-input class-select"
          value={charClass}
          onChange={(event) => setCharClass(event.target.value as CombatantClass)}
          aria-label="Class"
        >
          {COMBATANT_CLASSES.map((c) => (
            <option key={c} value={c}>
              {CLASS_LABELS[c]}
            </option>
          ))}
        </select>
        <button type="submit" className="button button-primary">
          Add
        </button>
      </form>
    </section>
  );
}
