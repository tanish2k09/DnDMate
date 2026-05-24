import { RosterSection } from "../components/RosterSection";
import { useApp } from "../store/app-context";

/** The roster panel: party and enemy combatants. */
export function RosterPanel() {
  const { state } = useApp();

  if (!state) {
    return (
      <div className="panel">
        <p className="empty-note">Connecting to the server…</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <RosterSection title="Party" group="party" combatants={state.party} />
      <RosterSection title="Enemies" group="enemy" combatants={state.enemies} />
    </div>
  );
}
