/**
 * A fixed-width bitmap font. Each glyph is `height` rows; each row is a bitmask
 * `width` bits wide, where bit `(width - 1)` is the leftmost pixel.
 */
export interface BitmapFont {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** Character -> row bitmasks (one entry per row). */
  readonly glyphs: ReadonlyMap<string, readonly number[]>;
}

/** A pixel is "on" for any character other than `.` or a space. */
function isOn(ch: string): boolean {
  return ch !== "." && ch !== " ";
}

/** Convert string-art rows (e.g. `"#.#"`) into a glyph's row bitmasks. */
export function parseGlyph(width: number, rows: readonly string[]): number[] {
  return rows.map((row) => {
    let mask = 0;
    for (let x = 0; x < width; x++) {
      const ch = x < row.length ? row[x] : ".";
      if (isOn(ch)) {
        mask |= 1 << (width - 1 - x);
      }
    }
    return mask;
  });
}

/**
 * Build a {@link BitmapFont} from string-art glyph definitions. Throws if any
 * glyph does not have exactly `height` rows, which catches data-entry mistakes.
 */
export function buildFont(
  name: string,
  width: number,
  height: number,
  definitions: Record<string, readonly string[]>,
): BitmapFont {
  const glyphs = new Map<string, readonly number[]>();
  for (const [char, rows] of Object.entries(definitions)) {
    if (rows.length !== height) {
      throw new Error(`Font ${name}: glyph "${char}" has ${rows.length} rows, expected ${height}`);
    }
    glyphs.set(char, parseGlyph(width, rows));
  }
  return { name, width, height, glyphs };
}

/** Whether the pixel at (x, y) within a glyph is set. */
export function glyphPixel(glyph: readonly number[], width: number, x: number, y: number): boolean {
  if (y < 0 || y >= glyph.length || x < 0 || x >= width) return false;
  return (glyph[y] & (1 << (width - 1 - x))) !== 0;
}
