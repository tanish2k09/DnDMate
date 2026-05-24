import { type CombatantClass, COMBATANT_CLASSES } from "../../shared";

const GLYPH: Record<CombatantClass, string> = {
  barbarian: "BRB",
  wizard: "WIZ",
  paladin: "PAL",
  bard: "BRD",
  ranger: "RNG",
  druid: "DRD",
  other: "—",
};

const LABEL: Record<CombatantClass, string> = {
  barbarian: "Barbarian",
  wizard: "Wizard",
  paladin: "Paladin",
  bard: "Bard",
  ranger: "Ranger",
  druid: "Druid",
  other: "Other",
};

interface ClassBadgeProps {
  charClass: CombatantClass;
  onChange?: (charClass: CombatantClass) => void;
}

/**
 * Compact class tag for the combatant tile. When `onChange` is supplied the
 * badge is editable — a hidden `<select>` overlay lets the user reassign the
 * class without taking up an extra row.
 */
export function ClassBadge({ charClass, onChange }: ClassBadgeProps) {
  if (!onChange) {
    return (
      <span className={`class-badge class-badge-${charClass}`} title={LABEL[charClass]}>
        {GLYPH[charClass]}
      </span>
    );
  }
  return (
    <label className={`class-badge class-badge-${charClass} class-badge-editable`} title={`${LABEL[charClass]} — click to change`}>
      <span aria-hidden>{GLYPH[charClass]}</span>
      <select
        className="class-badge-select"
        value={charClass}
        onChange={(event) => onChange(event.target.value as CombatantClass)}
        aria-label="Class"
      >
        {COMBATANT_CLASSES.map((c) => (
          <option key={c} value={c}>
            {LABEL[c]}
          </option>
        ))}
      </select>
    </label>
  );
}
