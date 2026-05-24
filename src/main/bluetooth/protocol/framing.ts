/**
 * Divoom binary frame envelope, reverse-engineered from public projects
 * (jakobwesthoff/divoom-pixoo-max-nodejs, hass-divoom, virtualabs/pixoo-client).
 *
 * Wire format:
 *
 *   [START] [LEN_LO] [LEN_HI] [...payload...] [CSUM_LO] [CSUM_HI] [END]
 *
 *   - START = 0x01, END = 0x02 (frame delimiters).
 *   - LEN   = u16 LE = payload.length + 2 (covers payload + checksum bytes).
 *   - CSUM  = u16 LE = (sum of length bytes + payload bytes) mod 0x10000.
 *
 * The checksum INCLUDES the length bytes but excludes the start/end markers
 * and the checksum itself. The Pixoo Max protocol does not require byte
 * escaping inside the payload (newer Divoom firmwares do — flagged as a TODO).
 */

const START = 0x01;
const END = 0x02;

/** Wrap a payload in start/length/checksum/end markers. */
export function encodeFrame(payload: Uint8Array): Uint8Array {
  const length = payload.length + 2;
  const lenLo = length & 0xff;
  const lenHi = (length >> 8) & 0xff;

  let checksum = lenLo + lenHi;
  for (let i = 0; i < payload.length; i++) {
    checksum = (checksum + payload[i]) & 0xffff;
  }
  const csumLo = checksum & 0xff;
  const csumHi = (checksum >> 8) & 0xff;

  const frame = new Uint8Array(1 + 2 + payload.length + 2 + 1);
  let offset = 0;
  frame[offset++] = START;
  frame[offset++] = lenLo;
  frame[offset++] = lenHi;
  frame.set(payload, offset);
  offset += payload.length;
  frame[offset++] = csumLo;
  frame[offset++] = csumHi;
  frame[offset++] = END;
  return frame;
}

/** A parsed frame; either a valid payload or a structured error. */
export type DecodeResult =
  | { ok: true; payload: Uint8Array }
  | { ok: false; reason: "too-short" | "bad-start" | "bad-end" | "bad-length" | "bad-checksum" };

/** Inverse of {@link encodeFrame}; verifies framing + checksum. */
export function decodeFrame(frame: Uint8Array): DecodeResult {
  if (frame.length < 6) return { ok: false, reason: "too-short" };
  if (frame[0] !== START) return { ok: false, reason: "bad-start" };
  if (frame[frame.length - 1] !== END) return { ok: false, reason: "bad-end" };

  const length = frame[1] | (frame[2] << 8);
  const expectedTotal = 1 + 2 + length + 1; // start + len + (payload + csum) + end
  if (frame.length !== expectedTotal) return { ok: false, reason: "bad-length" };

  const payloadEnd = frame.length - 3; // exclude csum (2) + end (1)
  const payload = frame.slice(3, payloadEnd);
  const csumLo = frame[payloadEnd];
  const csumHi = frame[payloadEnd + 1];
  const expectedCsum = csumLo | (csumHi << 8);

  let actual = frame[1] + frame[2];
  for (let i = 0; i < payload.length; i++) actual = (actual + payload[i]) & 0xffff;
  if (actual !== expectedCsum) return { ok: false, reason: "bad-checksum" };

  return { ok: true, payload };
}
