/** Base class for all transport-layer failures. */
export class PixooError extends Error {}

/** The device returned a non-2xx HTTP status. */
export class PixooHttpError extends PixooError {
  constructor(readonly status: number) {
    super(`Pixoo device returned HTTP ${status}`);
    this.name = "PixooHttpError";
  }
}

/** The device returned a JSON body with a non-zero `error_code`. */
export class PixooDeviceError extends PixooError {
  constructor(readonly errorCode: number) {
    super(`Pixoo device reported error_code ${errorCode}`);
    this.name = "PixooDeviceError";
  }
}

/** The request did not complete within the configured timeout. */
export class PixooTimeoutError extends PixooError {
  constructor(readonly timeoutMs: number) {
    super(`Pixoo request timed out after ${timeoutMs}ms`);
    this.name = "PixooTimeoutError";
  }
}
