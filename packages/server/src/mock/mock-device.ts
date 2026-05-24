/**
 * A mock Divoom device — a tiny HTTP server that mimics the `/post` endpoint.
 *
 * It lets the entire transport pipeline be exercised end-to-end with no
 * hardware: it validates the `PicData` payload, tracks PicID monotonicity, and
 * can simulate latency. Used by the transport tests and available as a dev
 * target before the real Pixoo Max arrives.
 */

interface RunningServer {
  port: number | undefined;
  stop(closeActiveConnections?: boolean): void;
}

type JsonCommand = Record<string, unknown>;

export interface MockDeviceConfig {
  /** Display width the mock validates against. Defaults to 32. */
  width?: number;
  /** Display height the mock validates against. Defaults to 32. */
  height?: number;
  /** Artificial latency added to every response, in milliseconds. */
  latencyMs?: number;
  /** Port to bind; 0 (the default) picks a random free port. */
  port?: number;
}

export interface MockDeviceState {
  /** Highest PicID seen since the last reset. */
  lastPicId: number;
  /** Number of `SendHttpGif` frames received. */
  frameCount: number;
  /** Last brightness set via `Channel/SetBrightness`. */
  brightness: number;
  /** Total `SendHttpGif` requests handled. */
  cumulativeUpdates: number;
  /** Number of `Draw/ResetHttpGifId` requests handled. */
  resetCount: number;
  /** Times a PicID did not strictly increase (a protocol violation). */
  picIdViolations: number;
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class MockDevice {
  readonly width: number;
  readonly height: number;
  private readonly latencyMs: number;
  private readonly requestedPort: number;
  private server: RunningServer | null = null;

  private lastPicId = 0;
  private readonly frames: Uint8Array[] = [];
  private brightness = 100;
  private cumulativeUpdates = 0;
  private resetCount = 0;
  private picIdViolations = 0;

  constructor(config: MockDeviceConfig = {}) {
    this.width = config.width ?? 32;
    this.height = config.height ?? 32;
    this.latencyMs = config.latencyMs ?? 0;
    this.requestedPort = config.port ?? 0;
  }

  /** Start listening. */
  start(): void {
    if (this.server) return;
    this.server = Bun.serve({
      port: this.requestedPort,
      fetch: (req) => this.handle(req),
    });
  }

  /** Stop listening. */
  stop(): void {
    this.server?.stop(true);
    this.server = null;
  }

  /** Base URL of the running mock, e.g. `http://localhost:53124`. */
  get url(): string {
    const port = this.server?.port;
    if (port === undefined) throw new Error("MockDevice is not started");
    return `http://localhost:${port}`;
  }

  /** A snapshot of what the mock has observed. */
  get state(): MockDeviceState {
    return {
      lastPicId: this.lastPicId,
      frameCount: this.frames.length,
      brightness: this.brightness,
      cumulativeUpdates: this.cumulativeUpdates,
      resetCount: this.resetCount,
      picIdViolations: this.picIdViolations,
    };
  }

  /** Raw RGB bytes of the most recently received frame, or null. */
  get lastFrame(): Uint8Array | null {
    return this.frames.at(-1) ?? null;
  }

  private async handle(req: Request): Promise<Response> {
    if (this.latencyMs > 0) {
      await delay(this.latencyMs);
    }
    const url = new URL(req.url);
    if (req.method !== "POST" || url.pathname !== "/post") {
      return new Response("not found", { status: 404 });
    }
    let command: JsonCommand;
    try {
      command = (await req.json()) as JsonCommand;
    } catch {
      return Response.json({ error_code: 1 });
    }
    return this.handleCommand(command);
  }

  private handleCommand(command: JsonCommand): Response {
    switch (command.Command) {
      case "Draw/SendHttpGif":
        return this.handleSendGif(command);
      case "Draw/ResetHttpGifId":
        this.resetCount += 1;
        this.lastPicId = 0;
        return Response.json({ error_code: 0 });
      case "Draw/GetHttpGifId":
        return Response.json({ error_code: 0, PicId: this.lastPicId });
      case "Channel/SetBrightness":
        this.brightness = clampNumber(command.Brightness);
        return Response.json({ error_code: 0 });
      case "Channel/SetIndex":
      case "Device/PlayBuzzer":
        return Response.json({ error_code: 0 });
      default:
        return Response.json({ error_code: 1 });
    }
  }

  private handleSendGif(command: JsonCommand): Response {
    const picId = clampNumber(command.PicID);
    const picWidth = clampNumber(command.PicWidth);
    const picData = typeof command.PicData === "string" ? command.PicData : "";
    const bytes = Buffer.from(picData, "base64");
    const expectedBytes = this.width * this.height * 3;

    if (picWidth !== this.width) {
      return Response.json({ error_code: 2 });
    }
    if (bytes.length !== expectedBytes) {
      return Response.json({ error_code: 3 });
    }
    // Frames of one animation share a PicID; only a *decreasing* id is illegal.
    if (this.lastPicId !== 0 && picId < this.lastPicId) {
      this.picIdViolations += 1;
    }
    this.lastPicId = picId;
    this.frames.push(new Uint8Array(bytes));
    this.cumulativeUpdates += 1;
    return Response.json({ error_code: 0 });
  }
}

function clampNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
