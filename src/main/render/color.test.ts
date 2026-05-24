import { describe, expect, test } from "vitest";
import {
  BLACK,
  colorsEqual,
  fromHex,
  GREEN,
  gradient,
  lerp,
  RED,
  rgb,
  toHex,
  WHITE,
} from "./color";

describe("rgb", () => {
  test("clamps channels into [0, 255]", () => {
    expect(rgb(-10, 300, 128)).toEqual({ r: 0, g: 255, b: 128 });
  });

  test("rounds fractional channels", () => {
    expect(rgb(1.4, 1.6, 2.5)).toEqual({ r: 1, g: 2, b: 3 });
  });
});

describe("fromHex", () => {
  test("parses 6-digit hex with and without a leading #", () => {
    expect(fromHex("#ff8800")).toEqual({ r: 255, g: 136, b: 0 });
    expect(fromHex("ff8800")).toEqual({ r: 255, g: 136, b: 0 });
  });

  test("expands 3-digit shorthand", () => {
    expect(fromHex("#f80")).toEqual({ r: 255, g: 136, b: 0 });
  });

  test("throws on invalid input", () => {
    expect(() => fromHex("#xyz123")).toThrow();
    expect(() => fromHex("#ff88")).toThrow();
  });
});

describe("toHex", () => {
  test("round-trips with fromHex", () => {
    expect(toHex(fromHex("#1a2b3c"))).toBe("#1a2b3c");
  });

  test("zero-pads single-digit channels", () => {
    expect(toHex(rgb(1, 2, 3))).toBe("#010203");
  });
});

describe("lerp", () => {
  test("returns the endpoints at t=0 and t=1", () => {
    expect(lerp(BLACK, WHITE, 0)).toEqual(BLACK);
    expect(lerp(BLACK, WHITE, 1)).toEqual(WHITE);
  });

  test("returns the midpoint at t=0.5", () => {
    expect(lerp(BLACK, WHITE, 0.5)).toEqual({ r: 128, g: 128, b: 128 });
  });

  test("clamps t outside [0, 1]", () => {
    expect(lerp(BLACK, WHITE, -1)).toEqual(BLACK);
    expect(lerp(BLACK, WHITE, 2)).toEqual(WHITE);
  });
});

describe("gradient", () => {
  test("interpolates across multiple stops", () => {
    const stops = [RED, GREEN, WHITE];
    expect(gradient(stops, 0)).toEqual(RED);
    expect(gradient(stops, 0.5)).toEqual(GREEN);
    expect(gradient(stops, 1)).toEqual(WHITE);
  });
});

describe("colorsEqual", () => {
  test("compares channels", () => {
    expect(colorsEqual(rgb(1, 2, 3), rgb(1, 2, 3))).toBe(true);
    expect(colorsEqual(rgb(1, 2, 3), rgb(1, 2, 4))).toBe(false);
  });
});
