import { useEffect, useRef } from "react";
import type { PreviewMessage } from "../../shared";

interface PixooCanvasProps {
  readonly preview: PreviewMessage | null;
  /** Maximum CSS pixels per LED pixel; the canvas scales down to fit its column. */
  readonly scale?: number;
}

const DEFAULT_SIZE = 32;
const DEFAULT_SCALE = 10;

/** Decode a base64 string into raw bytes. */
function decodeBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Render a framebuffer preview onto a `<canvas>`. The drawing buffer stays at
 * native LED resolution; CSS scales it up with `image-rendering: pixelated`, so
 * the preview is an exact, crisp-edged mirror of what the device shows.
 */
export function PixooCanvas({ preview, scale = DEFAULT_SCALE }: PixooCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = preview?.width ?? DEFAULT_SIZE;
  const height = preview?.height ?? DEFAULT_SIZE;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!preview) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const rgb = decodeBase64(preview.data);
    const image = ctx.createImageData(preview.width, preview.height);
    const pixels = preview.width * preview.height;
    for (let i = 0; i < pixels; i++) {
      image.data[i * 4] = rgb[i * 3];
      image.data[i * 4 + 1] = rgb[i * 3 + 1];
      image.data[i * 4 + 2] = rgb[i * 3 + 2];
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }, [preview]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="pixoo-canvas"
      style={{ maxWidth: `${width * scale}px` }}
    />
  );
}
