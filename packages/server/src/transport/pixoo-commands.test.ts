import { describe, expect, test } from "bun:test";
import { resetHttpGifId, sendHttpGif, setBrightness, setChannelIndex } from "./pixoo-commands";

describe("pixoo command builders", () => {
  test("sendHttpGif maps params onto the device field names", () => {
    expect(
      sendHttpGif({
        picNum: 2,
        picWidth: 32,
        picOffset: 1,
        picId: 7,
        picSpeed: 100,
        picData: "AA",
      }),
    ).toEqual({
      Command: "Draw/SendHttpGif",
      PicNum: 2,
      PicWidth: 32,
      PicOffset: 1,
      PicID: 7,
      PicSpeed: 100,
      PicData: "AA",
    });
  });

  test("resetHttpGifId builds the reset command", () => {
    expect(resetHttpGifId()).toEqual({ Command: "Draw/ResetHttpGifId" });
  });

  test("setBrightness clamps to 0-100", () => {
    expect(setBrightness(150).Brightness).toBe(100);
    expect(setBrightness(-5).Brightness).toBe(0);
    expect(setBrightness(60).Brightness).toBe(60);
  });

  test("setChannelIndex carries the channel index", () => {
    expect(setChannelIndex(2)).toEqual({ Command: "Channel/SetIndex", SelectIndex: 2 });
  });
});
