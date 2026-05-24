import { describe, expect, test } from "bun:test";
import { BLACK, RED, WHITE } from "./color";
import { Framebuffer } from "./framebuffer";
import { blit, drawHLine, drawLine, drawRect, drawVLine, fillRect } from "./primitives";

describe("fillRect", () => {
  test("fills the region and leaves the rest untouched", () => {
    const fb = new Framebuffer(6, 6);
    fillRect(fb, 1, 1, 3, 2, RED);
    expect(fb.get(1, 1)).toEqual(RED);
    expect(fb.get(3, 2)).toEqual(RED);
    expect(fb.get(4, 1)).toEqual(BLACK);
    expect(fb.get(0, 0)).toEqual(BLACK);
  });
});

describe("drawRect", () => {
  test("draws the outline only", () => {
    const fb = new Framebuffer(6, 6);
    drawRect(fb, 0, 0, 4, 4, WHITE);
    expect(fb.get(0, 0)).toEqual(WHITE);
    expect(fb.get(3, 0)).toEqual(WHITE);
    expect(fb.get(3, 3)).toEqual(WHITE);
    expect(fb.get(1, 1)).toEqual(BLACK);
  });
});

describe("drawHLine / drawVLine", () => {
  test("draw straight runs", () => {
    const fb = new Framebuffer(6, 6);
    drawHLine(fb, 1, 2, 3, RED);
    drawVLine(fb, 4, 0, 3, WHITE);
    expect(fb.get(1, 2)).toEqual(RED);
    expect(fb.get(3, 2)).toEqual(RED);
    expect(fb.get(4, 0)).toEqual(WHITE);
    expect(fb.get(4, 2)).toEqual(WHITE);
  });
});

describe("drawLine", () => {
  test("draws a horizontal line", () => {
    const fb = new Framebuffer(8, 8);
    drawLine(fb, 0, 3, 5, 3, RED);
    for (let x = 0; x <= 5; x++) {
      expect(fb.get(x, 3)).toEqual(RED);
    }
  });

  test("draws a 45-degree diagonal", () => {
    const fb = new Framebuffer(8, 8);
    drawLine(fb, 0, 0, 4, 4, WHITE);
    for (let i = 0; i <= 4; i++) {
      expect(fb.get(i, i)).toEqual(WHITE);
    }
    expect(fb.get(0, 4)).toEqual(BLACK);
  });
});

describe("blit", () => {
  test("copies a source buffer onto a destination", () => {
    const src = new Framebuffer(2, 2);
    src.fill(RED);
    const dest = new Framebuffer(6, 6);
    blit(dest, src, 1, 1);
    expect(dest.get(1, 1)).toEqual(RED);
    expect(dest.get(2, 2)).toEqual(RED);
    expect(dest.get(0, 0)).toEqual(BLACK);
  });

  test("clips when placed partially out of bounds", () => {
    const src = new Framebuffer(2, 2);
    src.fill(WHITE);
    const dest = new Framebuffer(4, 4);
    blit(dest, src, 3, 3);
    expect(dest.get(3, 3)).toEqual(WHITE);
    expect(dest.get(2, 2)).toEqual(BLACK);
  });
});
