import type { SceneId } from "../../shared";
import { useApp } from "../store/app-context";

const SCENES: { id: SceneId; label: string }[] = [
  { id: "party-hp", label: "Party HP" },
  { id: "enemy-hp", label: "Enemy HP" },
  { id: "hourglass", label: "Timer" },
  { id: "blank", label: "Off" },
];

/** Choose which scene drives the display. */
export function ScenePicker() {
  const { state, actions } = useApp();
  const active = state?.activeScene;

  return (
    <div className="scene-picker">
      {SCENES.map((scene) => (
        <button
          key={scene.id}
          type="button"
          className={`scene-button ${active === scene.id ? "scene-button-active" : ""}`}
          onClick={() => actions.setScene(scene.id)}
        >
          {scene.label}
        </button>
      ))}
    </div>
  );
}
