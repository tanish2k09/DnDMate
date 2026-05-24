import type { Rgb } from "./color";
import type { Framebuffer } from "./framebuffer";

/**
 * Drawing primitives. Every function operates on a {@link Framebuffer} and
 * relies on its clipping (out-of-bounds writes are ignored), so callers never
 * have to bounds-check coordinates themselves.
 */

/** Draw a horizontal run of `w` pixels starting at (x, y). */
export function drawHLine(fb: Framebuffer, x: number, y: number, w: number, color: Rgb): void {
  for (let dx = 0; dx < w; dx++) {
    fb.set(x + dx, y, color);
  }
}

/** Draw a vertical run of `h` pixels starting at (x, y). */
export function drawVLine(fb: Framebuffer, x: number, y: number, h: number, color: Rgb): void {
  for (let dy = 0; dy < h; dy++) {
    fb.set(x, y + dy, color);
  }
}

/** Fill a `w` x `h` rectangle with its top-left corner at (x, y). */
export function fillRect(
  fb: Framebuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  color: Rgb,
): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      fb.set(x + dx, y + dy, color);
    }
  }
}

/** Draw the 1px outline of a `w` x `h` rectangle with its top-left corner at (x, y). */
export function drawRect(
  fb: Framebuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  color: Rgb,
): void {
  if (w <= 0 || h <= 0) return;
  drawHLine(fb, x, y, w, color);
  drawHLine(fb, x, y + h - 1, w, color);
  drawVLine(fb, x, y, h, color);
  drawVLine(fb, x + w - 1, y, h, color);
}

/** Draw a line between (x0, y0) and (x1, y1) using Bresenham's algorithm. */
export function drawLine(
  fb: Framebuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: Rgb,
): void {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const steps = Math.max(dx, -dy);
  for (let i = 0; i <= steps; i++) {
    fb.set(x, y, color);
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Copy every pixel of `src` onto `dest` with `src`'s top-left placed at (dx, dy). */
export function blit(dest: Framebuffer, src: Framebuffer, dx: number, dy: number): void {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      dest.set(dx + x, dy + y, src.get(x, y));
    }
  }
}
