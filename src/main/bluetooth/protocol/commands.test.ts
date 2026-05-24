import { describe, expect, test } from "vitest";
import {
  animationFrame,
  CHANNEL,
  COMMAND,
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

describe("setStaticImage", () => {
  test("emits a header + raw RGB bytes that round-trip through decode", () => {
    // Tiny synthetic image: 2x1 pixels = 6 RGB bytes.
    const rgb = new Uint8Array([0xff, 0x00, 0x00, 0x00, 0xff, 0x00]);
    const frame = setStaticImage(rgb);
    const decoded = decodeFrame(frame);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    // Command byte
    expect(decoded.payload[0]).toBe(COMMAND.SET_STATIC_IMAGE);
    // Size header: rgb.length + 7 (tail) + 2 (palette size) = 15
    expect(decoded.payload[1]).toBe(15);
    expect(decoded.payload[2]).toBe(0);
    // 7 zero bytes
    for (let i = 3; i < 10; i++) expect(decoded.payload[i]).toBe(0);
    // 2-byte palette size = 0
    expect(decoded.payload[10]).toBe(0);
    expect(decoded.payload[11]).toBe(0);
    // RGB pixels begin at offset 12
    expect(Array.from(decoded.payload.slice(12))).toEqual(Array.from(rgb));
  });

  test("handles a full 32x32 frame (3072 RGB bytes)", () => {
    const rgb = new Uint8Array(32 * 32 * 3);
    for (let i = 0; i < rgb.length; i++) rgb[i] = i & 0xff;
    const frame = setStaticImage(rgb);
    expect(frame.length).toBe(rgb.length + 12 + 6); // header(12) + envelope(6)
    expect(decodeFrame(frame).ok).toBe(true);
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
