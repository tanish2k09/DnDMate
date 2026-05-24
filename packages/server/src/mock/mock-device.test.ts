import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { encodeFrame, Framebuffer } from "../render";
import { MockDevice } from "./mock-device";

describe("MockDevice", () => {
  let device: MockDevice;

  beforeEach(() => {
    device = new MockDevice({ width: 32, height: 32 });
    device.start();
  });

  afterEach(() => {
    device.stop();
  });

  async function post(body: unknown): Promise<{ error_code?: number; PicId?: number }> {
    const res = await fetch(`${device.url}/post`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return (await res.json()) as { error_code?: number; PicId?: number };
  }

  test("accepts a valid SendHttpGif frame", async () => {
    const result = await post({
      Command: "Draw/SendHttpGif",
      PicNum: 1,
      PicWidth: 32,
      PicOffset: 0,
      PicID: 1,
      PicSpeed: 100,
      PicData: encodeFrame(new Framebuffer(32, 32)),
    });
    expect(result.error_code).toBe(0);
    expect(device.state.frameCount).toBe(1);
    expect(device.state.lastPicId).toBe(1);
  });

  test("rejects a frame whose PicData is the wrong size", async () => {
    const result = await post({
      Command: "Draw/SendHttpGif",
      PicNum: 1,
      PicWidth: 32,
      PicOffset: 0,
      PicID: 1,
      PicSpeed: 100,
      PicData: "AAAA",
    });
    expect(result.error_code).not.toBe(0);
    expect(device.state.frameCount).toBe(0);
  });

  test("tracks brightness and resets", async () => {
    await post({ Command: "Channel/SetBrightness", Brightness: 42 });
    expect(device.state.brightness).toBe(42);

    await post({ Command: "Draw/ResetHttpGifId" });
    expect(device.state.resetCount).toBe(1);
  });

  test("reports the current GIF id", async () => {
    await post({
      Command: "Draw/SendHttpGif",
      PicNum: 1,
      PicWidth: 32,
      PicOffset: 0,
      PicID: 5,
      PicSpeed: 100,
      PicData: encodeFrame(new Framebuffer(32, 32)),
    });
    const result = await post({ Command: "Draw/GetHttpGifId" });
    expect(result.PicId).toBe(5);
  });
});
