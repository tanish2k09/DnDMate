import { describe, expect, test } from "vitest";
import { decodeFrame, encodeFrame } from "./framing";

const START = 0x01;
const END = 0x02;

describe("encodeFrame", () => {
  test("wraps a single-byte payload in start/length/checksum/end markers", () => {
    // payload = [0x44], length = 3, checksum = 3 + 0 + 0x44 = 0x47
    const frame = encodeFrame(new Uint8Array([0x44]));
    expect(Array.from(frame)).toEqual([START, 0x03, 0x00, 0x44, 0x47, 0x00, END]);
  });

  test("computes checksum across length + payload bytes", () => {
    // payload = [0x74, 0x32], length = 4, checksum = 4 + 0x74 + 0x32 = 0xAA
    const frame = encodeFrame(new Uint8Array([0x74, 0x32]));
    expect(Array.from(frame)).toEqual([START, 0x04, 0x00, 0x74, 0x32, 0xaa, 0x00, END]);
  });

  test("encodes length and checksum in little-endian order", () => {
    // 300-byte payload of 0xFF => length = 302 (0x012E).
    // checksum = 0x2E + 0x01 + 300*0xFF = 0x2F + 0x12AD4 = 0x12B03; & 0xFFFF = 0x2B03.
    const payload = new Uint8Array(300).fill(0xff);
    const frame = encodeFrame(payload);
    expect(frame[0]).toBe(START);
    expect(frame[1]).toBe(0x2e);
    expect(frame[2]).toBe(0x01);
    expect(frame[frame.length - 3]).toBe(0x03);
    expect(frame[frame.length - 2]).toBe(0x2b);
    expect(frame[frame.length - 1]).toBe(END);
  });

  test("checksum wraps at 0x10000", () => {
    // length = 5, payload = [0xFF, 0xFF, 0xFF] => sum = 5 + 0xFF*3 = 0x302
    const frame = encodeFrame(new Uint8Array([0xff, 0xff, 0xff]));
    expect(frame[frame.length - 3]).toBe(0x02);
    expect(frame[frame.length - 2]).toBe(0x03);
  });
});

describe("decodeFrame", () => {
  test("round-trips a payload through encode + decode", () => {
    const payload = new Uint8Array([0x49, 0xde, 0xad, 0xbe, 0xef, 0x00, 0xff]);
    const result = decodeFrame(encodeFrame(payload));
    expect(result.ok).toBe(true);
    if (result.ok) expect(Array.from(result.payload)).toEqual(Array.from(payload));
  });

  test("rejects frames that are too short", () => {
    expect(decodeFrame(new Uint8Array([START, END]))).toEqual({
      ok: false,
      reason: "too-short",
    });
  });

  test("rejects a frame with the wrong start byte", () => {
    const frame = encodeFrame(new Uint8Array([0x44]));
    frame[0] = 0x00;
    expect(decodeFrame(frame)).toEqual({ ok: false, reason: "bad-start" });
  });

  test("rejects a frame with the wrong end byte", () => {
    const frame = encodeFrame(new Uint8Array([0x44]));
    frame[frame.length - 1] = 0x00;
    expect(decodeFrame(frame)).toEqual({ ok: false, reason: "bad-end" });
  });

  test("rejects a frame whose length header disagrees with its size", () => {
    const frame = encodeFrame(new Uint8Array([0x44]));
    frame[1] = 0x09; // claim length=9 but the frame is short
    expect(decodeFrame(frame)).toEqual({ ok: false, reason: "bad-length" });
  });

  test("rejects a frame with a bad checksum", () => {
    const frame = encodeFrame(new Uint8Array([0x44]));
    frame[frame.length - 3] = 0x00; // corrupt csum_lo
    expect(decodeFrame(frame)).toEqual({ ok: false, reason: "bad-checksum" });
  });
});
