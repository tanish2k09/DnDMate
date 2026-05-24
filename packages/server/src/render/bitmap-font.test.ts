import { describe, expect, test } from "bun:test";
import { buildFont, glyphPixel, parseGlyph } from "./bitmap-font";
import { FONT_3X5 } from "./fonts/font-3x5";
import { FONT_5X7 } from "./fonts/font-5x7";

describe("parseGlyph", () => {
  test("converts string art into row bitmasks", () => {
    expect(parseGlyph(3, ["#.#", "##.", ".#."])).toEqual([0b101, 0b110, 0b010]);
  });

  test("treats spaces as off pixels and pads short rows", () => {
    expect(parseGlyph(3, ["# ."])).toEqual([0b100]);
    expect(parseGlyph(3, ["#"])).toEqual([0b100]);
  });
});

describe("buildFont", () => {
  test("throws when a glyph has the wrong number of rows", () => {
    expect(() => buildFont("bad", 3, 5, { A: ["###", "#.#"] })).toThrow();
  });

  test("builds a font with the requested glyphs", () => {
    const font = buildFont("tiny", 3, 1, { A: ["#.#"], B: [".#."] });
    expect(font.width).toBe(3);
    expect(font.glyphs.has("A")).toBe(true);
    expect(font.glyphs.get("B")).toEqual([0b010]);
  });
});

describe("glyphPixel", () => {
  test("reads individual pixels and clips out-of-bounds queries", () => {
    const glyph = [0b101];
    expect(glyphPixel(glyph, 3, 0, 0)).toBe(true);
    expect(glyphPixel(glyph, 3, 1, 0)).toBe(false);
    expect(glyphPixel(glyph, 3, 2, 0)).toBe(true);
    expect(glyphPixel(glyph, 3, 0, 1)).toBe(false);
    expect(glyphPixel(glyph, 3, -1, 0)).toBe(false);
  });
});

describe("bundled fonts", () => {
  test("FONT_3X5 has 3x5 cells and covers digits and letters", () => {
    expect([FONT_3X5.width, FONT_3X5.height]).toEqual([3, 5]);
    for (const ch of "0123456789ABCXYZ :/-.%") {
      expect(FONT_3X5.glyphs.has(ch)).toBe(true);
    }
  });

  test("FONT_5X7 has 5x7 cells and covers digits and letters", () => {
    expect([FONT_5X7.width, FONT_5X7.height]).toEqual([5, 7]);
    for (const ch of "0123456789ABCXYZ :/-.%") {
      expect(FONT_5X7.glyphs.has(ch)).toBe(true);
    }
  });

  test("every FONT_3X5 glyph has exactly 5 rows", () => {
    for (const rows of FONT_3X5.glyphs.values()) {
      expect(rows.length).toBe(5);
    }
  });
});
