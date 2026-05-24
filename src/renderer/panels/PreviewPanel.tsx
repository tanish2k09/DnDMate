import type { ReactNode } from "react";
import type { SceneId } from "../../shared";
import { PixooCanvas } from "../components/PixooCanvas";
import { RosterSection } from "../components/RosterSection";
import { ScenePicker } from "../components/ScenePicker";
import { TimerControls } from "../components/TimerControls";
import { useApp } from "../store/app-context";

/**
 * Single-page composer: scene tabs on top, the dual preview (draft + live) and
 * commit/discard controls in the middle, and the active scene's editor below.
 *
 * Co-locating the editor with the preview means every action that can be
 * enqueued is visible alongside the draft preview that reflects it.
 */
export function PreviewPanel() {
  const { state, draftPreview, livePreview, pendingCount, actions } = useApp();
  const hasPending = pendingCount > 0;

  return (
    <div className="panel">
      <ScenePicker />

      <div className="preview-pair">
        <PreviewBox label="Draft" badge={hasPending ? `${pendingCount} queued` : null}>
          <PixooCanvas preview={draftPreview} scale={8} />
        </PreviewBox>
        <div className={`commit-arrow ${hasPending ? "commit-arrow-armed" : ""}`} aria-hidden>
          →
        </div>
        <PreviewBox label="Live" badge={null}>
          <PixooCanvas preview={livePreview} scale={8} />
        </PreviewBox>
      </div>

      <div className="commit-row">
        <button
          type="button"
          className="button button-primary"
          onClick={() => actions.commit()}
          disabled={!hasPending}
          title={hasPending ? "Push queued frames to the device" : "Nothing to commit"}
        >
          Commit{hasPending ? ` (${pendingCount})` : ""}
        </button>
        <button
          type="button"
          className="button"
          onClick={() => actions.discard()}
          disabled={!hasPending}
          title="Drop the queued draft frames"
        >
          Discard
        </button>
      </div>

      <SceneEditor scene={state?.activeScene ?? "blank"} />
    </div>
  );
}

function SceneEditor({ scene }: { scene: SceneId }) {
  const { state } = useApp();
  if (!state) return null;
  switch (scene) {
    case "party-hp":
      return <RosterSection title="Party" group="party" combatants={state.party} />;
    case "enemy-hp":
      return <RosterSection title="Enemies" group="enemy" combatants={state.enemies} />;
    case "hourglass":
      return (
        <>
          <h2 className="section-title">Timer</h2>
          <TimerControls />
        </>
      );
    case "blank":
      return <p className="empty-note">Display is blank. Pick another scene to drive content.</p>;
  }
}

function PreviewBox({
  label,
  badge,
  children,
}: {
  label: string;
  badge: string | null;
  children: ReactNode;
}) {
  return (
    <div className="preview-column">
      <div className="preview-label">
        <span>{label}</span>
        {badge && <span className="preview-badge">{badge}</span>}
      </div>
      <div className="preview-bezel-wrap">
        <div className="preview-bezel">{children}</div>
      </div>
    </div>
  );
}
