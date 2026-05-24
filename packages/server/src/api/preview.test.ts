import { describe, expect, test } from "bun:test";
import { decodePicData, Framebuffer } from "../render";
import { framebufferToPreview } from "./preview";

describe("framebufferToPreview", () => {
  test("captures dimensions and encodes the pixels", () => {
    const fb = new Framebuffer(8, 4);
    const message = framebufferToPreview(fb);

    expect(message.type).toBe("preview");
    expect(message.width).toBe(8);
    expect(message.height).toBe(4);
    expect(decodePicData(message.data)).toHaveLength(8 * 4 * 3);
  });
});
