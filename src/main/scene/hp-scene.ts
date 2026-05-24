import type { Combatant } from "@shared";
import {
  drawText,
  drawTextCentered,
  FONT_3X5,
  Framebuffer,
  fillRect,
  gradient,
  type Rgb,
  truncateText,
} from "../render";
import { ENEMY_ACCENT, HP_GRADIENT, MUTED, PARTY_ACCENT, SCENE_BG, TEXT, TRACK } from "./palette";
import type { Scene, SceneContext } from "./scene";

/** Title band: a 5px glyph plus a 1px gap. */
const TITLE_HEIGHT = 6;
const MIN_ROW_HEIGHT = 5;
const MAX_ROW_HEIGHT = 10;

/** Render a roster as a vertical stack of labelled HP bars. */
export function renderHpScene(
  ctx: SceneContext,
  combatants: readonly Combatant[],
  title: string,
  accent: Rgb,
): Framebuffer {
  const fb = new Framebuffer(ctx.width, ctx.height);
  fb.fill(SCENE_BG);
  drawTextCentered(fb, FONT_3X5, title, ctx.width / 2, 0, accent);

  const areaTop = TITLE_HEIGHT;
  const areaHeight = ctx.height - areaTop;

  if (combatants.length === 0) {
    drawTextCentered(
      fb,
      FONT_3X5,
      "EMPTY",
      ctx.width / 2,
      areaTop + Math.floor((areaHeight - 5) / 2),
      MUTED,
    );
    return fb;
  }

  const maxRows = Math.max(1, Math.floor(areaHeight / MIN_ROW_HEIGHT));
  const visible = combatants.slice(0, maxRows);
  const rowHeight = Math.min(MAX_ROW_HEIGHT, Math.floor(areaHeight / visible.length));
  const nameWidth = Math.floor(ctx.width * 0.44);

  let y = areaTop + Math.floor((areaHeight - rowHeight * visible.length) / 2);
  for (const combatant of visible) {
    renderHpRow(fb, combatant, y, rowHeight - 1, ctx.width, nameWidth);
    y += rowHeight;
  }
  return fb;
}

function renderHpRow(
  fb: Framebuffer,
  combatant: Combatant,
  y: number,
  height: number,
  width: number,
  nameWidth: number,
): void {
  const fraction = combatant.maxHp > 0 ? clamp01(combatant.currentHp / combatant.maxHp) : 0;

  const name = truncateText(FONT_3X5, combatant.name.toUpperCase(), nameWidth);
  drawText(fb, FONT_3X5, name, 0, y + Math.floor((height - 5) / 2), TEXT);

  const barX = nameWidth + 2;
  const barWidth = Math.max(1, width - barX);
  fillRect(fb, barX, y, barWidth, height, TRACK);
  const fillWidth = Math.round(barWidth * fraction);
  if (fillWidth > 0) {
    fillRect(fb, barX, y, fillWidth, height, gradient(HP_GRADIENT, fraction));
  }
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** HP bars for the party. */
export const partyHpScene: Scene = {
  id: "party-hp",
  render: (ctx) => renderHpScene(ctx, ctx.state.party, "PARTY", PARTY_ACCENT),
};

/** HP bars for the enemies. */
export const enemyHpScene: Scene = {
  id: "enemy-hp",
  render: (ctx) => renderHpScene(ctx, ctx.state.enemies, "ENEMY", ENEMY_ACCENT),
};
