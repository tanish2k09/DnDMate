import { type BitmapFont, glyphPixel } from "./bitmap-font";
import type { Rgb } from "./color";
import type { Framebuffer } from "./framebuffer";

export interface TextOptions {
  /** Extra pixels inserted between glyphs. Defaults to 1. */
  readonly letterSpacing?: number;
}

const DEFAULT_LETTER_SPACING = 1;

/** Pixel width that `text` occupies when rendered in `font`. */
export function measureText(font: BitmapFont, text: string, options: TextOptions = {}): number {
  const spacing = options.letterSpacing ?? DEFAULT_LETTER_SPACING;
  const chars = [...text];
  if (chars.length === 0) return 0;
  return chars.length * font.width + (chars.length - 1) * spacing;
}

/**
 * Draw `text` with its top-left corner at (x, y). Characters absent from the
 * font fall back to their upper-case form, then render as blank. Returns the
 * x coordinate just past the last glyph.
 */
export function drawText(
  fb: Framebuffer,
  font: BitmapFont,
  text: string,
  x: number,
  y: number,
  color: Rgb,
  options: TextOptions = {},
): number {
  const spacing = options.letterSpacing ?? DEFAULT_LETTER_SPACING;
  let cursorX = x;
  for (const char of text) {
    const glyph = font.glyphs.get(char) ?? font.glyphs.get(char.toUpperCase());
    if (glyph) {
      for (let gy = 0; gy < font.height; gy++) {
        for (let gx = 0; gx < font.width; gx++) {
          if (glyphPixel(glyph, font.width, gx, gy)) {
            fb.set(cursorX + gx, y + gy, color);
          }
        }
      }
    }
    cursorX += font.width + spacing;
  }
  return cursorX - spacing;
}

/** Draw `text` horizontally centered on `centerX`, with its top at `y`. */
export function drawTextCentered(
  fb: Framebuffer,
  font: BitmapFont,
  text: string,
  centerX: number,
  y: number,
  color: Rgb,
  options: TextOptions = {},
): number {
  const w = measureText(font, text, options);
  return drawText(fb, font, text, Math.round(centerX - w / 2), y, color, options);
}

/** Return the longest prefix of `text` that fits within `maxWidth` pixels. */
export function truncateText(
  font: BitmapFont,
  text: string,
  maxWidth: number,
  options: TextOptions = {},
): string {
  if (measureText(font, text, options) <= maxWidth) {
    return text;
  }
  let result = "";
  for (const char of text) {
    const candidate = result + char;
    if (measureText(font, candidate, options) > maxWidth) {
      break;
    }
    result = candidate;
  }
  return result;
}
