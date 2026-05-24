import type { Combatant } from "../../shared";
import {
  classIcon,
  drawClassIcon,
  fillRect,
  Framebuffer,
  gradient,
  type IconSize,
  type Rgb,
} from "../render";
import { HP_GRADIENT, MUTED, SCENE_BG, TRACK } from "./palette";
import type { Scene, SceneContext } from "./scene";

/** 1px breathing room around the rendered content on every edge. */
const PADDING = 1;
/** Ideal pixels per HP point — scaled down when a high-HP party can't fit. */
const IDEAL_PIXELS_PER_HP = 2;

type RowLayout = {
  rowH: number;
  barH: number;
  iconSize: IconSize;
  iconPx: number;
  gap: number;
};

function pickLayout(count: number): RowLayout {
  if (count <= 2) return { rowH: 14, barH: 6, iconSize: "normal", iconPx: 6, gap: 2 };
  if (count <= 4) return { rowH: 7, barH: 4, iconSize: "normal", iconPx: 6, gap: 1 };
  return { rowH: 5, barH: 4, iconSize: "compact", iconPx: 4, gap: 1 };
}

/**
 * Roster as a stack of (icon, HP gauge) rows. Each HP point is rendered as a
 * 2px segment by default; if any combatant's max HP would overflow the
 * available bar width, the segment scales down proportionally so all bars
 * stay comparable. HP color (red→amber→green) carries the wounded/healthy
 * signal — there's no sub-pixel rendering.
 */
export function renderHpScene(
  ctx: SceneContext,
  combatants: readonly Combatant[],
  _title: string,
  _accent: Rgb,
): Framebuffer {
  const fb = new Framebuffer(ctx.width, ctx.height);
  fb.fill(SCENE_BG);

  const innerW = ctx.width - PADDING * 2;
  const innerH = ctx.height - PADDING * 2;

  if (combatants.length === 0) {
    const y = PADDING + Math.floor(innerH / 2);
    for (let x = PADDING + 4; x < ctx.width - PADDING - 4; x += 3) {
      fillRect(fb, x, y, 2, 1, MUTED);
    }
    return fb;
  }

  const layout = pickLayout(combatants.length);
  const maxRows = Math.max(1, Math.floor(innerH / layout.rowH));
  const visible = combatants.slice(0, maxRows);
  const usedH = layout.rowH * visible.length;

  // Bar geometry: starts after icon + gap, ends at the right padding.
  const barX = PADDING + layout.iconPx + layout.gap;
  const barMaxWidth = ctx.width - PADDING - barX;

  // Pick a global pixels-per-HP that fits the highest-HP combatant in view.
  // 1 px is the floor; below that we degrade to a continuous fraction.
  const maxMaxHp = visible.reduce((m, c) => Math.max(m, c.maxHp), 1);
  const pixelsPerHp = Math.min(IDEAL_PIXELS_PER_HP, Math.max(1, Math.floor(barMaxWidth / maxMaxHp)));

  let y = PADDING + Math.floor((innerH - usedH) / 2);
  for (const combatant of visible) {
    renderRow(fb, combatant, y, barX, barMaxWidth, pixelsPerHp, layout);
    y += layout.rowH;
  }
  return fb;
}

function renderRow(
  fb: Framebuffer,
  combatant: Combatant,
  rowTop: number,
  barX: number,
  barMaxWidth: number,
  pixelsPerHp: number,
  layout: RowLayout,
): void {
  const fraction = combatant.maxHp > 0 ? clamp01(combatant.currentHp / combatant.maxHp) : 0;
  const fillColor = gradient(HP_GRADIENT, fraction);

  // Icon: drawn in its own descriptive palette, centered vertically.
  const iconY = rowTop + Math.max(0, Math.floor((layout.rowH - layout.iconPx) / 2));
  drawClassIcon(fb, classIcon(combatant.charClass, layout.iconSize), PADDING, iconY);

  // Bar:
  //  - Track length = maxHp segments (so the empty portion shows max capacity)
  //  - Fill length  = currentHp segments
  //  - If max wouldn't fit, the segment width is already 1 — and if max still
  //    overflows we fall back to fraction-of-available so the track ends at
  //    the panel edge.
  const trackWidth = Math.min(barMaxWidth, combatant.maxHp * pixelsPerHp);
  const useFraction = combatant.maxHp * pixelsPerHp > barMaxWidth;
  const barY = rowTop + Math.floor((layout.rowH - layout.barH) / 2);
  fillRect(fb, barX, barY, trackWidth, layout.barH, TRACK);

  const fillWidth = useFraction
    ? Math.round(trackWidth * fraction)
    : Math.min(trackWidth, combatant.currentHp * pixelsPerHp);
  if (fillWidth > 0) {
    fillRect(fb, barX, barY, fillWidth, layout.barH, fillColor);
  }
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export const partyHpScene: Scene = {
  id: "party-hp",
  render: (ctx) => renderHpScene(ctx, ctx.state.party, "PARTY", { r: 0, g: 0, b: 0 }),
};

export const enemyHpScene: Scene = {
  id: "enemy-hp",
  render: (ctx) => renderHpScene(ctx, ctx.state.enemies, "ENEMY", { r: 0, g: 0, b: 0 }),
};
