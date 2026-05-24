import { drawHLine, drawTextCentered, FONT_3X5, Framebuffer, fillRect } from "../render";
import { ALERT, HOURGLASS_FRAME, SAND, SAND_LOW, SCENE_BG, TEXT } from "./palette";
import type { Scene, SceneContext } from "./scene";

/** Below this many seconds remaining, the timer is shown as "low". */
const LOW_TIME_SECONDS = 10;
/** Vertical space reserved for the "M:SS" readout. */
const TIME_TEXT_HEIGHT = 5;

interface HourglassParams {
  cx: number;
  top: number;
  height: number;
  maxHalfWidth: number;
  neckHalfWidth: number;
  fraction: number;
  low: boolean;
  running: boolean;
  now: number;
}

/** Render the countdown timer as an hourglass with draining sand. */
export function renderHourglass(ctx: SceneContext): Framebuffer {
  const fb = new Framebuffer(ctx.width, ctx.height);
  fb.fill(SCENE_BG);

  const { durationSeconds, remainingSeconds, running } = ctx.state.timer;
  const fraction = durationSeconds > 0 ? clamp01(remainingSeconds / durationSeconds) : 0;
  const low = remainingSeconds <= LOW_TIME_SECONDS;

  const glassTop = 1;
  let glassHeight = ctx.height - TIME_TEXT_HEIGHT - glassTop - 2;
  glassHeight -= glassHeight % 2; // keep it even so the neck lands cleanly

  if (glassHeight >= 4) {
    drawHourglass(fb, {
      cx: Math.floor(ctx.width / 2),
      top: glassTop,
      height: glassHeight,
      maxHalfWidth: Math.max(
        3,
        Math.min(Math.floor(ctx.width / 2) - 2, Math.round(ctx.width * 0.22)),
      ),
      neckHalfWidth: Math.max(1, Math.round(ctx.width * 0.04)),
      fraction,
      low,
      running,
      now: ctx.now,
    });
  }

  const timeUp = remainingSeconds <= 0;
  const blink = timeUp && Math.floor(ctx.now / 400) % 2 === 0;
  if (!blink) {
    const color = timeUp ? ALERT : low ? SAND_LOW : TEXT;
    drawTextCentered(
      fb,
      FONT_3X5,
      formatTime(remainingSeconds),
      ctx.width / 2,
      ctx.height - TIME_TEXT_HEIGHT,
      color,
    );
  }
  return fb;
}

function drawHourglass(fb: Framebuffer, p: HourglassParams): void {
  const mid = p.height / 2;
  const sandColor = p.low ? SAND_LOW : SAND;
  const capWidth = 2 * (p.maxHalfWidth + 1) + 1;

  drawHLine(fb, p.cx - p.maxHalfWidth - 1, p.top, capWidth, HOURGLASS_FRAME);
  drawHLine(fb, p.cx - p.maxHalfWidth - 1, p.top + p.height - 1, capWidth, HOURGLASS_FRAME);

  const topSandRows = Math.round(p.fraction * mid);
  const bottomSandRows = Math.round((1 - p.fraction) * mid);

  for (let r = 0; r < p.height; r++) {
    const y = p.top + r;
    const halfWidth = halfWidthAt(r, p.height, p.maxHalfWidth, p.neckHalfWidth);
    fb.set(p.cx - halfWidth, y, HOURGLASS_FRAME);
    fb.set(p.cx + halfWidth, y, HOURGLASS_FRAME);

    const interior = halfWidth - 1;
    if (interior < 0) continue;

    const isSand = r < mid ? r >= mid - topSandRows : r - mid >= mid - bottomSandRows;
    if (isSand) {
      fillRect(fb, p.cx - interior, y, interior * 2 + 1, 1, sandColor);
    }
  }

  // A blinking grain of sand falling through the neck while the timer runs.
  if (p.running && p.fraction > 0 && p.fraction < 1 && Math.floor(p.now / 120) % 2 === 0) {
    const neckY = p.top + Math.floor(mid);
    fb.set(p.cx, neckY, sandColor);
    fb.set(p.cx, neckY + 1, sandColor);
  }
}

/** Half-width of the glass at row `r`: widest at the ends, narrowest at the neck. */
function halfWidthAt(r: number, height: number, maxHalf: number, neckHalf: number): number {
  const mid = height / 2;
  if (r < mid) {
    return Math.round(maxHalf + (neckHalf - maxHalf) * (r / mid));
  }
  return Math.round(neckHalf + (maxHalf - neckHalf) * ((r - mid) / mid));
}

/** Format seconds as `M:SS`. */
function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** The hourglass countdown scene. */
export const hourglassScene: Scene = {
  id: "hourglass",
  render: renderHourglass,
};
