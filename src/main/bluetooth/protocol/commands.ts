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

import type { Framebuffer } from "../../render";
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
 * Encode a single static-image push for the Pixoo Max.
 *
 * The Pixoo Max firmware does NOT accept raw RGB. It expects a palette of up
 * to 1024 unique colors plus a screen buffer of palette indices packed at
 * `ceil(log2(paletteCount))` bits per pixel (LE bit order). Sending raw RGB
 * makes the device fall back to a 16x16 interpretation rendered as 2x2 blocks
 * on the 32x32 panel.
 *
 * Payload layout (verified against jakobwesthoff/divoom-pixoo-max-nodejs):
 *   [0x44]                                command
 *   [0x00 0x0a 0x0a 0x04]                 prefix (purpose unknown, required)
 *   [0xAA]                                header marker
 *   [frameSize_lo frameSize_hi]           u16 LE; size of everything from frameSize onward
 *   [0x00 0x00]                           frameTime = 0 (static image)
 *   [0x03]                                paletteType = Pixoo Max palette mode
 *   [paletteCount_lo paletteCount_hi]     u16 LE
 *   [palette bytes ...]                   paletteCount * 3 bytes (RGB triples)
 *   [screen bytes ...]                    bit-packed palette indices
 */
export function setStaticImage(frame: Framebuffer): Uint8Array {
  const { paletteCount, palette, screen } = encodePaletteFrame(frame);
  // frameSize counts itself (2) + frameTime (2) + paletteType (1) + paletteCount (2)
  //   + palette + screen.
  const frameSize = 2 + 2 + 1 + 2 + palette.length + screen.length;
  const payload = new Uint8Array(1 + 4 + 1 + frameSize);
  let offset = 0;
  payload[offset++] = COMMAND.SET_STATIC_IMAGE;
  payload[offset++] = 0x00;
  payload[offset++] = 0x0a;
  payload[offset++] = 0x0a;
  payload[offset++] = 0x04;
  payload[offset++] = 0xaa;
  payload[offset++] = frameSize & 0xff;
  payload[offset++] = (frameSize >> 8) & 0xff;
  payload[offset++] = 0x00; // frameTime lo
  payload[offset++] = 0x00; // frameTime hi
  payload[offset++] = 0x03; // paletteType: Pixoo Max palette
  payload[offset++] = paletteCount & 0xff;
  payload[offset++] = (paletteCount >> 8) & 0xff;
  payload.set(palette, offset);
  offset += palette.length;
  payload.set(screen, offset);
  return encodeFrame(payload);
}

/**
 * Build the palette + bit-packed screen buffer for a framebuffer. Exposed
 * for tests; callers should generally use {@link setStaticImage}.
 */
export function encodePaletteFrame(frame: Framebuffer): {
  paletteCount: number;
  palette: Uint8Array;
  screen: Uint8Array;
} {
  const { data, width, height } = frame;
  const pixelCount = width * height;
  const paletteIndex = new Map<number, number>();
  const paletteEntries: number[] = []; // packed 0xRRGGBB
  const indices = new Uint16Array(pixelCount);
  for (let p = 0; p < pixelCount; p++) {
    const o = p * 3;
    const key = (data[o] << 16) | (data[o + 1] << 8) | data[o + 2];
    let idx = paletteIndex.get(key);
    if (idx === undefined) {
      idx = paletteEntries.length;
      paletteEntries.push(key);
      paletteIndex.set(key, idx);
    }
    indices[p] = idx;
  }
  if (paletteEntries.length > 1024) {
    throw new Error(
      `setStaticImage: palette overflow (${paletteEntries.length} colors, max 1024)`,
    );
  }

  const palette = new Uint8Array(paletteEntries.length * 3);
  for (let i = 0; i < paletteEntries.length; i++) {
    const c = paletteEntries[i];
    palette[i * 3] = (c >> 16) & 0xff;
    palette[i * 3 + 1] = (c >> 8) & 0xff;
    palette[i * 3 + 2] = c & 0xff;
  }

  // Pixoo Max wants 1+ bits per pixel even for single-color frames.
  const bitsPerPixel = Math.max(1, Math.ceil(Math.log2(Math.max(1, paletteEntries.length))));
  const screen = new Uint8Array(Math.ceil((bitsPerPixel * pixelCount) / 8));
  let acc = 0;
  let accBits = 0;
  let out = 0;
  const mask = (1 << bitsPerPixel) - 1;
  for (let p = 0; p < pixelCount; p++) {
    acc |= (indices[p] & mask) << accBits;
    accBits += bitsPerPixel;
    while (accBits >= 8) {
      screen[out++] = acc & 0xff;
      acc >>>= 8;
      accBits -= 8;
    }
  }
  if (accBits > 0) screen[out] = acc & 0xff;

  return { paletteCount: paletteEntries.length, palette, screen };
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
