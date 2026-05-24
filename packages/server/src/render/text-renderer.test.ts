import { describe, expect, test } from "bun:test";
import { BLACK, WHITE } from "./color";
import { FONT_3X5 } from "./fonts/font-3x5";
import { Framebuffer } from "./framebuffer";
import { drawText, drawTextCentered, measureText } from "./text-renderer";

describe("measureText", () => {
  test("returns 0 for empty strings", () => {
    expect(measureText(FONT_3X5, "")).toBe(0);
  });

  test("accounts for glyph width and letter spacing", () => {
    // 3 chars * 3px + 2 gaps * 1px (default spacing)
    expect(measureText(FONT_3X5, "ABC")).toBe(11);
    // custom spacing
    expect(measureText(FONT_3X5, "ABC", { letterSpacing: 0 })).toBe(9);
  });
});

describe("drawText", () => {
  test("renders the '1' glyph at the expected pixels", () => {
    // FONT_3X5 "1" is [".#.", "##.", ".#.", ".#.", "###"].
    const fb = new Framebuffer(8, 8);
    drawText(fb, FONT_3X5, "1", 0, 0, WHITE);
    expect(fb.get(1, 0)).toEqual(WHITE);
    expect(fb.get(0, 0)).toEqual(BLACK);
    expect(fb.get(0, 1)).toEqual(WHITE);
    expect(fb.get(1, 1)).toEqual(WHITE);
    expect(fb.get(2, 1)).toEqual(BLACK);
    expect(fb.get(0, 4)).toEqual(WHITE);
    expect(fb.get(2, 4)).toEqual(WHITE);
  });

  test("returns the x coordinate past the last glyph", () => {
    const fb = new Framebuffer(32, 8);
    const endX = drawText(fb, FONT_3X5, "12", 0, 0, WHITE);
    expect(endX).toBe(measureText(FONT_3X5, "12"));
  });

  test("renders unknown glyphs as blank without throwing", () => {
    const fb = new Framebuffer(16, 8);
    expect(() => drawText(fb, FONT_3X5, "☃", 0, 0, WHITE)).not.toThrow();
  });

  test("falls back to the upper-case glyph for lower-case input", () => {
    const upper = new Framebuffer(8, 8);
    const lower = new Framebuffer(8, 8);
    drawText(upper, FONT_3X5, "A", 0, 0, WHITE);
    drawText(lower, FONT_3X5, "a", 0, 0, WHITE);
    expect(lower.equals(upper)).toBe(true);
  });
});

describe("drawTextCentered", () => {
  test("centers text around the given x", () => {
    const fb = new Framebuffer(32, 8);
    drawTextCentered(fb, FONT_3X5, "8", 16, 0, WHITE);
    // "8" is 3px wide; centered on x=16 -> starts at x=15 (round(16 - 1.5)).
    expect(fb.get(15, 0)).toEqual(WHITE);
    expect(fb.get(17, 0)).toEqual(WHITE);
  });
});
