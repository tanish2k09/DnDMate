import { describe, expect, test } from "vitest";
import { Framebuffer } from "../../render";
import {
  animationFrame,
  CHANNEL,
  COMMAND,
  encodePaletteFrame,
  setBrightness,
  setChannel,
  setStaticImage,
  startAnimation,
} from "./commands";
import { decodeFrame } from "./framing";

const START = 0x01;
const END = 0x02;

describe("setBrightness", () => {
  test("encodes a SET_BRIGHTNESS frame with the clamped value", () => {
    // payload = [0x74, 0x32], length = 4, checksum = 4 + 0x74 + 0x32 = 0xAA
    expect(Array.from(setBrightness(50))).toEqual([
      START,
      0x04,
      0x00,
      COMMAND.SET_BRIGHTNESS,
      0x32,
      0xaa,
      0x00,
      END,
    ]);
  });

  test("clamps out-of-range brightness", () => {
    const high = decodeFrame(setBrightness(250));
    const low = decodeFrame(setBrightness(-10));
    if (!high.ok || !low.ok) throw new Error("decode failed");
    expect(high.payload[1]).toBe(100);
    expect(low.payload[1]).toBe(0);
  });

  test("rounds fractional values", () => {
    const result = decodeFrame(setBrightness(33.7));
    if (!result.ok) throw new Error("decode failed");
    expect(result.payload[1]).toBe(34);
  });
});

describe("setChannel", () => {
  test("encodes a SET_CHANNEL frame", () => {
    // payload = [0x45, 0x03], length = 4, checksum = 4 + 0x45 + 0x03 = 0x4C
    expect(Array.from(setChannel(CHANNEL.CUSTOM))).toEqual([
      START,
      0x04,
      0x00,
      COMMAND.SET_CHANNEL,
      0x03,
      0x4c,
      0x00,
      END,
    ]);
  });
});

describe("encodePaletteFrame", () => {
  test("dedupes colors into the palette and bit-packs indices", () => {
    // 2x2 framebuffer with 2 unique colors → 1 bit per pixel
    const fb = new Framebuffer(2, 2);
    fb.set(0, 0, { r: 0xff, g: 0x00, b: 0x00 }); // index 0
    fb.set(1, 0, { r: 0x00, g: 0xff, b: 0x00 }); // index 1
    fb.set(0, 1, { r: 0x00, g: 0xff, b: 0x00 }); // index 1
    fb.set(1, 1, { r: 0xff, g: 0x00, b: 0x00 }); // index 0
    const { paletteCount, palette, screen } = encodePaletteFrame(fb);
    expect(paletteCount).toBe(2);
    expect(Array.from(palette)).toEqual([0xff, 0x00, 0x00, 0x00, 0xff, 0x00]);
    // indices = [0, 1, 1, 0] packed LE at 1 bit each → 0b0110 = 0x06
    expect(Array.from(screen)).toEqual([0x06]);
  });

  test("uses 1 bit per pixel even when there is only one color", () => {
    const fb = new Framebuffer(4, 1);
    fb.fill({ r: 0x10, g: 0x20, b: 0x30 });
    const { paletteCount, palette, screen } = encodePaletteFrame(fb);
    expect(paletteCount).toBe(1);
    expect(Array.from(palette)).toEqual([0x10, 0x20, 0x30]);
    // 4 pixels × 1 bit = 4 bits → 1 byte, all zeros
    expect(Array.from(screen)).toEqual([0x00]);
  });

  test("rejects images with more than 1024 unique colors", () => {
    // 64x17 = 1088 pixels, each given a unique (r, g, b) → blows past the 1024 cap.
    const fb = new Framebuffer(64, 17);
    for (let i = 0; i < 64 * 17; i++) {
      const x = i % 64;
      const y = Math.floor(i / 64);
      fb.set(x, y, { r: i & 0xff, g: (i >> 8) & 0xff, b: (i >> 16) & 0xff });
    }
    expect(() => encodePaletteFrame(fb)).toThrow(/palette overflow/);
  });
});

describe("setStaticImage", () => {
  test("emits the canonical Pixoo Max header + palette + screen layout", () => {
    // 2x1 framebuffer, two distinct colors
    const fb = new Framebuffer(2, 1);
    fb.set(0, 0, { r: 0xff, g: 0x00, b: 0x00 });
    fb.set(1, 0, { r: 0x00, g: 0xff, b: 0x00 });
    const frame = setStaticImage(fb);
    const decoded = decodeFrame(frame);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    // [0x44] [0x00 0x0a 0x0a 0x04] [0xAA] [frameSize_lo frameSize_hi]
    //   [0x00 0x00] [0x03] [paletteCount_lo paletteCount_hi] [palette] [screen]
    expect(decoded.payload[0]).toBe(COMMAND.SET_STATIC_IMAGE);
    expect(Array.from(decoded.payload.slice(1, 5))).toEqual([0x00, 0x0a, 0x0a, 0x04]);
    expect(decoded.payload[5]).toBe(0xaa);

    // frameSize = self(2) + frameTime(2) + paletteType(1) + paletteCount(2)
    //           + palette(6) + screen(1) = 14
    expect(decoded.payload[6]).toBe(14);
    expect(decoded.payload[7]).toBe(0);
    expect(decoded.payload[8]).toBe(0); // frameTime lo
    expect(decoded.payload[9]).toBe(0); // frameTime hi
    expect(decoded.payload[10]).toBe(0x03); // paletteType
    expect(decoded.payload[11]).toBe(2); // paletteCount lo
    expect(decoded.payload[12]).toBe(0); // paletteCount hi
    expect(Array.from(decoded.payload.slice(13, 19))).toEqual([
      0xff, 0x00, 0x00, 0x00, 0xff, 0x00,
    ]);
    // screen: indices [0, 1] at 1 bit each LE → 0b10 = 0x02
    expect(decoded.payload[19]).toBe(0x02);
  });

  test("handles a full 32x32 frame within the palette limit", () => {
    const fb = new Framebuffer(32, 32);
    // 4 unique colors → 2 bits per pixel → screen = 1024*2/8 = 256 bytes
    const colors = [
      { r: 0xff, g: 0x00, b: 0x00 },
      { r: 0x00, g: 0xff, b: 0x00 },
      { r: 0x00, g: 0x00, b: 0xff },
      { r: 0xff, g: 0xff, b: 0xff },
    ];
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        fb.set(x, y, colors[(x + y) % 4]);
      }
    }
    const frame = setStaticImage(fb);
    const decoded = decodeFrame(frame);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    // header(13) + palette(12) + screen(256) = 281 bytes payload
    expect(decoded.payload.length).toBe(13 + 12 + 256);
    expect(decoded.payload[11]).toBe(4); // paletteCount = 4
  });
});

describe("startAnimation", () => {
  test("encodes the frame count little-endian", () => {
    // payload = [0x1A, 0x05, 0x00], length = 5, checksum = 5 + 0x1A + 5 = 0x24
    expect(Array.from(startAnimation(5))).toEqual([
      START,
      0x05,
      0x00,
      COMMAND.START_ANIMATION,
      0x05,
      0x00,
      0x24,
      0x00,
      END,
    ]);
  });

  test("rejects out-of-range frame counts", () => {
    expect(() => startAnimation(0)).toThrow(RangeError);
    expect(() => startAnimation(0x10000)).toThrow(RangeError);
  });
});

describe("animationFrame", () => {
  test("encodes the frame index and rgb data", () => {
    const rgb = new Uint8Array([0x11, 0x22, 0x33]);
    const frame = animationFrame(7, rgb);
    const decoded = decodeFrame(frame);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.payload[0]).toBe(COMMAND.ANIMATION_FRAME);
    expect(decoded.payload[1]).toBe(7);
    expect(decoded.payload[2]).toBe(0);
    expect(Array.from(decoded.payload.slice(3))).toEqual([0x11, 0x22, 0x33]);
  });

  test("rejects out-of-range frame indices", () => {
    expect(() => animationFrame(-1, new Uint8Array())).toThrow(RangeError);
    expect(() => animationFrame(0x10000, new Uint8Array())).toThrow(RangeError);
  });
});
