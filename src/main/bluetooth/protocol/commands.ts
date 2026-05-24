/**
 * Divoom command-byte payloads, ready to be wrapped by {@link encodeFrame} and
 * sent over the BT RFCOMM channel.
 *
 * The command IDs and payload layouts below are reverse-engineered consensus
 * values from public projects (jakobwesthoff/divoom-pixoo-max-nodejs,
 * hass-divoom, virtualabs/pixoo-client). They are believed correct for the
 * 32x32 Pixoo Max but unverified against real hardware until M4. Tests in
 * {@link ./commands.test.ts} pin the byte output so any later calibration
 * surfaces as a test failure rather than a silent regression.
 */

import { encodeFrame } from "./framing";

export const COMMAND = {
  /** Set the display brightness (0-100). */
  SET_BRIGHTNESS: 0x74,
  /** Switch the active "channel" (clock, custom, animation, …). */
  SET_CHANNEL: 0x45,
  /** Send a static image (single-frame animation). */
  SET_STATIC_IMAGE: 0x44,
  /** Begin a multi-frame animation; payload includes the frame count. */
  START_ANIMATION: 0x1a,
  /** Send one frame of a multi-frame animation. */
  ANIMATION_FRAME: 0x49,
} as const;

/** The fixed "channel" the device should land on for user-driven content. */
export const CHANNEL = {
  CLOCK: 0x00,
  CUSTOM: 0x03,
} as const;

/** Encode a SET_BRIGHTNESS command. Brightness clamps to 0..100. */
export function setBrightness(value: number): Uint8Array {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return encodeFrame(new Uint8Array([COMMAND.SET_BRIGHTNESS, clamped]));
}

/** Encode a SET_CHANNEL command. */
export function setChannel(channel: number): Uint8Array {
  return encodeFrame(new Uint8Array([COMMAND.SET_CHANNEL, channel & 0xff]));
}

/**
 * Encode a single static-image push. `rgb` must be width*height*3 bytes,
 * row-major, in RGB order — the same shape {@link Framebuffer.data} produces.
 *
 * Payload layout (from jakobwesthoff/divoom-pixoo-max-nodejs):
 *   [SET_STATIC_IMAGE] [size_lo] [size_hi] [0x00 0x00 0x00 0x00 0x00]
 *   [palette_size_lo=0 palette_size_hi=0] [raw RGB bytes …]
 *
 * We send the image as a "1-frame animation" with a zero-entry palette and
 * raw RGB pixel data — the Max accepts this shape on its custom channel.
 */
export function setStaticImage(rgb: Uint8Array): Uint8Array {
  const size = rgb.length + 7 + 2; // 7-byte header tail + 2-byte palette size
  const payload = new Uint8Array(1 + 2 + 7 + 2 + rgb.length);
  let offset = 0;
  payload[offset++] = COMMAND.SET_STATIC_IMAGE;
  payload[offset++] = size & 0xff;
  payload[offset++] = (size >> 8) & 0xff;
  // 7-byte zero tail; the protocol reserves it for animation timing & format.
  for (let i = 0; i < 7; i++) payload[offset++] = 0;
  // palette size = 0 → raw RGB pixel data follows.
  payload[offset++] = 0;
  payload[offset++] = 0;
  payload.set(rgb, offset);
  return encodeFrame(payload);
}

/**
 * Encode the START_ANIMATION header. The device expects this before the
 * stream of ANIMATION_FRAME commands begins.
 */
export function startAnimation(frameCount: number): Uint8Array {
  if (frameCount < 1 || frameCount > 0xffff) {
    throw new RangeError(`startAnimation: frameCount ${frameCount} out of range`);
  }
  return encodeFrame(
    new Uint8Array([COMMAND.START_ANIMATION, frameCount & 0xff, (frameCount >> 8) & 0xff]),
  );
}

/**
 * Encode one ANIMATION_FRAME push. `frameIndex` is 0-based. The Pixoo Max
 * has been observed to drop frames past ~40 per animation.
 */
export function animationFrame(frameIndex: number, rgb: Uint8Array): Uint8Array {
  if (frameIndex < 0 || frameIndex > 0xffff) {
    throw new RangeError(`animationFrame: index ${frameIndex} out of range`);
  }
  const payload = new Uint8Array(1 + 2 + rgb.length);
  payload[0] = COMMAND.ANIMATION_FRAME;
  payload[1] = frameIndex & 0xff;
  payload[2] = (frameIndex >> 8) & 0xff;
  payload.set(rgb, 3);
  return encodeFrame(payload);
}
