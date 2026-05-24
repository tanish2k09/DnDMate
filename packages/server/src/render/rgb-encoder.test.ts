import { describe, expect, test } from "bun:test";
import { BLUE, RED } from "./color";
import { Framebuffer } from "./framebuffer";
import { decodePicData, encodeFrame, encodeFrames } from "./rgb-encoder";

describe("encodeFrame", () => {
  test("encodes raw RGB bytes as base64", () => {
    const fb = new Framebuffer(1, 1);
    fb.set(0, 0, RED);
    const encoded = encodeFrame(fb);
    expect(decodePicData(encoded)).toEqual(new Uint8Array([255, 0, 0]));
  });

  test("produces width * height * 3 decoded bytes", () => {
    const fb = new Framebuffer(32, 32);
    expect(decodePicData(encodeFrame(fb)).length).toBe(32 * 32 * 3);
  });
});

describe("encodeFrames", () => {
  test("concatenates frames in order", () => {
    const a = new Framebuffer(1, 1);
    a.set(0, 0, RED);
    const b = new Framebuffer(1, 1);
    b.set(0, 0, BLUE);
    expect(decodePicData(encodeFrames([a, b]))).toEqual(new Uint8Array([255, 0, 0, 0, 0, 255]));
  });

  test("throws when given no frames", () => {
    expect(() => encodeFrames([])).toThrow();
  });

  test("throws when frame dimensions differ", () => {
    expect(() => encodeFrames([new Framebuffer(2, 2), new Framebuffer(2, 3)])).toThrow();
  });
});

describe("decodePicData", () => {
  test("round-trips with encodeFrame", () => {
    const fb = new Framebuffer(4, 4);
    fb.fill(BLUE);
    expect(decodePicData(encodeFrame(fb))).toEqual(fb.data);
  });
});
