import { BLACK, type Rgb } from "./color";

/**
 * A resolution-agnostic RGB pixel buffer — the universal currency between the
 * render primitives, the scenes, the device encoder, and the browser preview.
 *
 * Pixels are stored row-major, 3 bytes (R, G, B) per pixel, matching the byte
 * layout the Divoom `SendHttpGif` command expects for its `PicData`.
 */
export class Framebuffer {
  readonly width: number;
  readonly height: number;
  /** RGB bytes, row-major. Length is `width * height * 3`. */
  readonly data: Uint8Array;

  constructor(width: number, height: number) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new Error(`Invalid framebuffer size: ${width}x${height}`);
    }
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 3);
  }

  /** Total number of pixels. */
  get pixelCount(): number {
    return this.width * this.height;
  }

  /** Whether (x, y) lies inside the buffer. */
  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Byte offset of pixel (x, y). The caller must ensure the coordinates are in bounds. */
  private offset(x: number, y: number): number {
    return (y * this.width + x) * 3;
  }

  /** Set a pixel. Out-of-bounds writes are silently clipped. */
  set(x: number, y: number, color: Rgb): void {
    if (!this.inBounds(x, y)) return;
    const o = this.offset(x, y);
    this.data[o] = color.r;
    this.data[o + 1] = color.g;
    this.data[o + 2] = color.b;
  }

  /** Get a pixel. Out-of-bounds reads return black. */
  get(x: number, y: number): Rgb {
    if (!this.inBounds(x, y)) return BLACK;
    const o = this.offset(x, y);
    return { r: this.data[o], g: this.data[o + 1], b: this.data[o + 2] };
  }

  /** Fill the entire buffer with a single color. */
  fill(color: Rgb): void {
    for (let i = 0; i < this.data.length; i += 3) {
      this.data[i] = color.r;
      this.data[i + 1] = color.g;
      this.data[i + 2] = color.b;
    }
  }

  /** Reset every pixel to black. */
  clear(): void {
    this.data.fill(0);
  }

  /** Create an independent copy. */
  clone(): Framebuffer {
    const copy = new Framebuffer(this.width, this.height);
    copy.data.set(this.data);
    return copy;
  }

  /** Whether another framebuffer has the same dimensions and identical pixels. */
  equals(other: Framebuffer): boolean {
    if (this.width !== other.width || this.height !== other.height) return false;
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] !== other.data[i]) return false;
    }
    return true;
  }
}
