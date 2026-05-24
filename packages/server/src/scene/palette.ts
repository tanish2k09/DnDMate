import { fromHex, type Rgb } from "../render";

/** Shared colors for the DnDMate scenes, kept in one place for a consistent look. */

export const SCENE_BG: Rgb = fromHex("#0a0a0e");
export const TEXT: Rgb = fromHex("#e8e8ee");
export const MUTED: Rgb = fromHex("#6a6a80");

export const TRACK: Rgb = fromHex("#1c1c26");

/** HP bar color stops: low (red) -> mid (amber) -> full (green). */
export const HP_GRADIENT: readonly Rgb[] = [
  fromHex("#d23b3b"),
  fromHex("#e0a020"),
  fromHex("#46c25f"),
];

export const PARTY_ACCENT: Rgb = fromHex("#5b8fd6");
export const ENEMY_ACCENT: Rgb = fromHex("#d2553b");

export const HOURGLASS_FRAME: Rgb = fromHex("#9fb4d8");
export const SAND: Rgb = fromHex("#e0a838");
export const SAND_LOW: Rgb = fromHex("#d23b3b");
export const ALERT: Rgb = fromHex("#e0402e");
