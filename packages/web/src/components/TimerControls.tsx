import { useApp } from "../store/app-context";
import { useLiveTimer } from "../store/use-live-timer";

const PRESETS: { label: string; seconds: number }[] = [
  { label: "1 min", seconds: 60 },
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
];

/** Format seconds as `M:SS`. */
function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
}

/** Start, pause, reset, and nudge the countdown timer. */
export function TimerControls() {
  const { state, actions } = useApp();
  const timer = state?.timer;
  const remaining = useLiveTimer(timer);

  if (!timer) {
    return null;
  }

  return (
    <section className="timer-controls">
      <div className={`timer-display ${remaining <= 10 ? "timer-low" : ""}`}>
        {formatTime(remaining)}
      </div>
      <div className="button-row">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="button"
            onClick={() => actions.startTimer(preset.seconds)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="button-row">
        <button type="button" className="button" onClick={() => actions.addTimerSeconds(-60)}>
          −1 min
        </button>
        <button type="button" className="button" onClick={() => actions.addTimerSeconds(60)}>
          +1 min
        </button>
        {timer.running ? (
          <button type="button" className="button" onClick={() => actions.pauseTimer()}>
            Pause
          </button>
        ) : (
          <button
            type="button"
            className="button button-primary"
            onClick={() => actions.resumeTimer()}
          >
            Resume
          </button>
        )}
        <button type="button" className="button" onClick={() => actions.resetTimer()}>
          Reset
        </button>
      </div>
    </section>
  );
}
