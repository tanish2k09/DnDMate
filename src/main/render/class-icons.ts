import type { CombatantClass } from "../../shared";
import type { Rgb } from "./color";
import type { Framebuffer } from "./framebuffer";

/**
 * Multi-color class glyphs at two sizes:
 *   - 6×6 ("normal"): detailed full-color silhouette
 *   - 4×4 ("compact"): simplified 2-color version for dense parties
 *
 * Each glyph is a row-major grid of single chars. Any char in `palette` is
 * lit with that color; '.' (or any other char) is transparent. Designed for
 * unique silhouettes at small sizes so the wizard never reads as the bard.
 */
export type ClassIcon = {
  readonly width: number;
  readonly height: number;
  readonly rows: readonly string[];
  readonly palette: Readonly<Record<string, Rgb>>;
};

export type IconSize = "normal" | "compact";

/* Shared palette tokens — small named library to keep the icons coherent. */
const C = {
  STEEL: { r: 184, g: 184, b: 196 } as Rgb,
  STEEL_HI: { r: 224, g: 224, b: 236 } as Rgb,
  STEEL_LO: { r: 110, g: 110, b: 130 } as Rgb,
  WOOD: { r: 138, g: 90, b: 48 } as Rgb,
  WOOD_DK: { r: 74, g: 47, b: 28 } as Rgb,
  WOOD_HI: { r: 184, g: 130, b: 78 } as Rgb,
  BRASS: { r: 212, g: 168, b: 80 } as Rgb,
  BRASS_HI: { r: 240, g: 210, b: 122 } as Rgb,
  PURPLE: { r: 122, g: 76, b: 184 } as Rgb,
  PURPLE_HI: { r: 168, g: 132, b: 220 } as Rgb,
  STAR: { r: 244, g: 217, b: 110 } as Rgb,
  LEAF: { r: 127, g: 192, b: 79 } as Rgb,
  LEAF_DK: { r: 58, g: 111, b: 36 } as Rgb,
  STRING: { r: 230, g: 220, b: 200 } as Rgb,
  FEATHER: { r: 200, g: 68, b: 60 } as Rgb,
  SKIN: { r: 232, g: 200, b: 156 } as Rgb,
  CLOTH: { r: 90, g: 120, b: 168 } as Rgb,
  CLOTH_DK: { r: 60, g: 78, b: 110 } as Rgb,
};

const ICONS_6: Record<CombatantClass, ClassIcon> = {
  // Barbarian — battle axe: steel head (S/H/D) with wood handle (W) angled down-right.
  barbarian: {
    width: 6,
    height: 6,
    rows: [
      "SSSS..",
      "SHSSW.",
      "DSSSW.",
      "..SWW.",
      "..WW..",
      ".WW...",
    ],
    palette: { S: C.STEEL, H: C.STEEL_HI, D: C.STEEL_LO, W: C.WOOD },
  },
  // Wizard — purple pointy hat with a single gold star above and gold brim.
  wizard: {
    width: 6,
    height: 6,
    rows: [
      "..Y...",
      "..P...",
      ".PPP..",
      ".PSP..",
      "PPPPP.",
      "GGGGGG",
    ],
    palette: { P: C.PURPLE, S: C.PURPLE_HI, Y: C.STAR, G: C.BRASS },
  },
  // Paladin — silver kite shield with brass cross.
  paladin: {
    width: 6,
    height: 6,
    rows: [
      "DSSSSD",
      "SHHHHS",
      "SSGGSS",
      "SGGGGS",
      ".SGGS.",
      "..DD..",
    ],
    palette: { S: C.STEEL, H: C.STEEL_HI, D: C.STEEL_LO, G: C.BRASS },
  },
  // Bard — lute: pear-shaped body bottom-left with angled neck up to top-right.
  bard: {
    width: 6,
    height: 6,
    rows: [
      ".....N",
      "....NS",
      "...NS.",
      ".WBSS.",
      "WBBBS.",
      ".BBB..",
    ],
    palette: { N: C.WOOD_DK, W: C.WOOD, B: C.WOOD_HI, S: C.STRING },
  },
  // Ranger — vertical recurve bow on the left, arrow flying right with red feathers.
  ranger: {
    width: 6,
    height: 6,
    rows: [
      "W.....",
      ".W..F.",
      "WSSAAH",
      ".W..F.",
      "W.....",
      "......",
    ],
    palette: { W: C.WOOD, S: C.STRING, A: C.WOOD_DK, H: C.STEEL, F: C.FEATHER },
  },
  // Druid — oak leaf with darker central vein, stem at bottom.
  druid: {
    width: 6,
    height: 6,
    rows: [
      "..L...",
      ".LLL..",
      "LDLLL.",
      "LLDLL.",
      ".LDL..",
      "..W...",
    ],
    palette: { L: C.LEAF, D: C.LEAF_DK, W: C.WOOD_DK },
  },
  // Other — generic person silhouette: skin head, blue tunic, dark legs.
  other: {
    width: 6,
    height: 6,
    rows: [
      "..FF..",
      "..FF..",
      ".CCCC.",
      "CCCCCC",
      "..DD..",
      "..DD..",
    ],
    palette: { F: C.SKIN, C: C.CLOTH, D: C.CLOTH_DK },
  },
};

/* 4×4 versions: 2 tones max, optimized for instant recognition at small size. */
const ICONS_4: Record<CombatantClass, ClassIcon> = {
  barbarian: {
    width: 4,
    height: 4,
    rows: ["SSS.", "SHSW", "..SW", "..W."],
    palette: { S: C.STEEL, H: C.STEEL_HI, W: C.WOOD },
  },
  wizard: {
    width: 4,
    height: 4,
    rows: [".Y..", ".P..", "PPP.", "GGGG"],
    palette: { P: C.PURPLE, Y: C.STAR, G: C.BRASS },
  },
  paladin: {
    width: 4,
    height: 4,
    rows: ["SSSS", "SGGS", "SGGS", ".SS."],
    palette: { S: C.STEEL, G: C.BRASS },
  },
  bard: {
    width: 4,
    height: 4,
    rows: ["...N", "..NS", ".WBS", "WBB."],
    palette: { N: C.WOOD_DK, W: C.WOOD, B: C.WOOD_HI, S: C.STRING },
  },
  ranger: {
    width: 4,
    height: 4,
    rows: ["W...", "WSAH", "W..F", "W..."],
    palette: { W: C.WOOD, S: C.STRING, A: C.WOOD_DK, H: C.STEEL, F: C.FEATHER },
  },
  druid: {
    width: 4,
    height: 4,
    rows: [".L..", "LDL.", "LLLL", "..W."],
    palette: { L: C.LEAF, D: C.LEAF_DK, W: C.WOOD_DK },
  },
  other: {
    width: 4,
    height: 4,
    rows: [".FF.", "CCCC", ".CC.", "DD.D"],
    palette: { F: C.SKIN, C: C.CLOTH, D: C.CLOTH_DK },
  },
};

export function classIcon(charClass: CombatantClass, size: IconSize = "normal"): ClassIcon {
  const set = size === "compact" ? ICONS_4 : ICONS_6;
  return set[charClass] ?? set.other;
}

/**
 * Draw an icon at (x, y); chars in the icon's palette become their color,
 * everything else is transparent. The optional `tint` parameter is ignored —
 * icons carry their own descriptive colors.
 */
export function drawClassIcon(fb: Framebuffer, icon: ClassIcon, x: number, y: number): void {
  for (let row = 0; row < icon.height; row++) {
    const line = icon.rows[row];
    for (let col = 0; col < icon.width; col++) {
      const ch = line[col];
      const color = icon.palette[ch];
      if (color) fb.set(x + col, y + row, color);
    }
  }
}
