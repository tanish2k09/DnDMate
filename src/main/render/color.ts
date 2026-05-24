/** An RGB color with 8-bit channels (0-255). */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Clamp a number to an integer in [0, 255]. */
function clampByte(n: number): number {
  if (n < 0) return 0;
  if (n > 255) return 255;
  return Math.round(n);
}

/** Build an `Rgb`, clamping each channel into [0, 255]. */
export function rgb(r: number, g: number, b: number): Rgb {
  return { r: clampByte(r), g: clampByte(g), b: clampByte(b) };
}

/** Parse a `#rgb` or `#rrggbb` hex string (the leading `#` is optional). */
export function fromHex(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

/** Format a color as a `#rrggbb` string. */
export function toHex(color: Rgb): string {
  const channel = (n: number) => clampByte(n).toString(16).padStart(2, "0");
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

/** Linearly interpolate between two colors; `t` is clamped to [0, 1]. */
export function lerp(a: Rgb, b: Rgb, t: number): Rgb {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return rgb(a.r + (b.r - a.r) * k, a.g + (b.g - a.g) * k, a.b + (b.b - a.b) * k);
}

/** Linearly interpolate across an ordered list of color stops; `t` is clamped to [0, 1]. */
export function gradient(stops: readonly Rgb[], t: number): Rgb {
  if (stops.length === 0) throw new Error("gradient: needs at least one stop");
  if (stops.length === 1) return stops[0];
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  const scaled = k * (stops.length - 1);
  const index = Math.min(Math.floor(scaled), stops.length - 2);
  return lerp(stops[index], stops[index + 1], scaled - index);
}

/** Whether two colors have identical channels. */
export function colorsEqual(a: Rgb, b: Rgb): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

export const BLACK: Rgb = { r: 0, g: 0, b: 0 };
export const WHITE: Rgb = { r: 255, g: 255, b: 255 };
export const RED: Rgb = { r: 255, g: 0, b: 0 };
export const GREEN: Rgb = { r: 0, g: 255, b: 0 };
export const BLUE: Rgb = { r: 0, g: 0, b: 255 };
export const YELLOW: Rgb = { r: 255, g: 255, b: 0 };
export const ORANGE: Rgb = { r: 255, g: 140, b: 0 };
export const CYAN: Rgb = { r: 0, g: 255, b: 255 };
export const MAGENTA: Rgb = { r: 255, g: 0, b: 255 };
export const GRAY: Rgb = { r: 128, g: 128, b: 128 };
