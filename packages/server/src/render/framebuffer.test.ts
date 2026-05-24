import { describe, expect, test } from "bun:test";
import { BLACK, RED, WHITE } from "./color";
import { Framebuffer } from "./framebuffer";

describe("Framebuffer", () => {
  test("allocates width * height * 3 bytes", () => {
    const fb = new Framebuffer(32, 16);
    expect(fb.width).toBe(32);
    expect(fb.height).toBe(16);
    expect(fb.data.length).toBe(32 * 16 * 3);
    expect(fb.pixelCount).toBe(512);
  });

  test("rejects invalid sizes", () => {
    expect(() => new Framebuffer(0, 10)).toThrow();
    expect(() => new Framebuffer(10, -1)).toThrow();
    expect(() => new Framebuffer(1.5, 10)).toThrow();
  });

  test("stores and retrieves pixels", () => {
    const fb = new Framebuffer(4, 4);
    fb.set(2, 1, RED);
    expect(fb.get(2, 1)).toEqual(RED);
    expect(fb.get(0, 0)).toEqual(BLACK);
  });

  test("clips out-of-bounds writes and returns black for out-of-bounds reads", () => {
    const fb = new Framebuffer(4, 4);
    fb.set(-1, 0, WHITE);
    fb.set(4, 4, WHITE);
    expect(fb.get(99, 99)).toEqual(BLACK);
    expect(fb.inBounds(4, 0)).toBe(false);
    expect(fb.inBounds(3, 3)).toBe(true);
  });

  test("fill paints every pixel", () => {
    const fb = new Framebuffer(3, 3);
    fb.fill(RED);
    expect(fb.get(0, 0)).toEqual(RED);
    expect(fb.get(2, 2)).toEqual(RED);
  });

  test("clear resets to black", () => {
    const fb = new Framebuffer(3, 3);
    fb.fill(WHITE);
    fb.clear();
    expect(fb.get(1, 1)).toEqual(BLACK);
  });

  test("clone is independent of the original", () => {
    const fb = new Framebuffer(3, 3);
    fb.set(0, 0, RED);
    const copy = fb.clone();
    copy.set(0, 0, WHITE);
    expect(fb.get(0, 0)).toEqual(RED);
    expect(copy.get(0, 0)).toEqual(WHITE);
  });

  test("equals compares dimensions and pixels", () => {
    const a = new Framebuffer(2, 2);
    const b = new Framebuffer(2, 2);
    expect(a.equals(b)).toBe(true);
    b.set(0, 0, RED);
    expect(a.equals(b)).toBe(false);
    expect(a.equals(new Framebuffer(2, 3))).toBe(false);
  });
});
