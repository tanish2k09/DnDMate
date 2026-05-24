import { PixooCanvas } from "../components/PixooCanvas";
import { ScenePicker } from "../components/ScenePicker";
import { TimerControls } from "../components/TimerControls";
import { useApp } from "../store/app-context";

/** The live panel: the display preview, the scene picker, and the timer. */
export function PreviewPanel() {
  const { preview } = useApp();

  return (
    <div className="panel">
      <div className="preview-wrap">
        <div className="preview-bezel">
          <PixooCanvas preview={preview} scale={10} />
        </div>
      </div>
      <h2 className="section-title">Display</h2>
      <ScenePicker />
      <h2 className="section-title">Timer</h2>
      <TimerControls />
    </div>
  );
}
