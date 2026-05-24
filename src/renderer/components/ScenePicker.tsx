import type { SceneId } from "../../shared";
import { useApp } from "../store/app-context";

const SCENES: { id: SceneId; label: string }[] = [
  { id: "party-hp", label: "Party HP" },
  { id: "enemy-hp", label: "Enemy HP" },
  { id: "hourglass", label: "Timer" },
  { id: "blank", label: "Off" },
];

/**
 * Scene tabs — clicking a tab navigates to that scene. Navigation discards any
 * pending draft frames (server-side, in {@link IpcChannel.SetScene}) so the
 * preview pair stays consistent with the scene the user just selected.
 */
export function ScenePicker() {
  const { state, actions } = useApp();
  const active = state?.activeScene;

  return (
    <div className="scene-tabs" role="tablist">
      {SCENES.map((scene) => (
        <button
          key={scene.id}
          type="button"
          role="tab"
          aria-selected={active === scene.id}
          className={`scene-tab ${active === scene.id ? "scene-tab-active" : ""}`}
          onClick={() => actions.setScene(scene.id)}
        >
          {scene.label}
        </button>
      ))}
    </div>
  );
}
