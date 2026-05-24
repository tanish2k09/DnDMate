/**
 * Typed builders for the Divoom local HTTP API. Every command is a JSON object
 * POSTed to `http://{device}/post`. Field names are PascalCase to match the
 * device protocol exactly.
 */

export interface SendHttpGifCommand {
  Command: "Draw/SendHttpGif";
  /** Total number of frames in the animation. */
  PicNum: number;
  /** Frame width in pixels. */
  PicWidth: number;
  /** Index of this frame within the animation. */
  PicOffset: number;
  /** Animation id — must strictly increase between animations, or be reset. */
  PicID: number;
  /** Milliseconds each frame is shown. */
  PicSpeed: number;
  /** Base64-encoded RGB bytes for this frame. */
  PicData: string;
}

export interface ResetHttpGifIdCommand {
  Command: "Draw/ResetHttpGifId";
}

export interface GetHttpGifIdCommand {
  Command: "Draw/GetHttpGifId";
}

export interface SetBrightnessCommand {
  Command: "Channel/SetBrightness";
  Brightness: number;
}

export interface SetChannelIndexCommand {
  Command: "Channel/SetIndex";
  SelectIndex: number;
}

export interface PlayBuzzerCommand {
  Command: "Device/PlayBuzzer";
  ActiveTimeInCycle: number;
  OffTimeInCycle: number;
  PlayTotalTime: number;
}

export type PixooCommand =
  | SendHttpGifCommand
  | ResetHttpGifIdCommand
  | GetHttpGifIdCommand
  | SetBrightnessCommand
  | SetChannelIndexCommand
  | PlayBuzzerCommand;

/** Generic response envelope returned by the device. */
export interface PixooResponse {
  error_code?: number;
  PicId?: number;
}

export interface SendGifParams {
  picNum: number;
  picWidth: number;
  picOffset: number;
  picId: number;
  picSpeed: number;
  picData: string;
}

/** Build a `Draw/SendHttpGif` command for one frame of an animation. */
export function sendHttpGif(params: SendGifParams): SendHttpGifCommand {
  return {
    Command: "Draw/SendHttpGif",
    PicNum: params.picNum,
    PicWidth: params.picWidth,
    PicOffset: params.picOffset,
    PicID: params.picId,
    PicSpeed: params.picSpeed,
    PicData: params.picData,
  };
}

/** Build a `Draw/ResetHttpGifId` command. */
export function resetHttpGifId(): ResetHttpGifIdCommand {
  return { Command: "Draw/ResetHttpGifId" };
}

/** Build a `Draw/GetHttpGifId` command. */
export function getHttpGifId(): GetHttpGifIdCommand {
  return { Command: "Draw/GetHttpGifId" };
}

/** Build a `Channel/SetBrightness` command, clamping brightness to 0-100. */
export function setBrightness(brightness: number): SetBrightnessCommand {
  return { Command: "Channel/SetBrightness", Brightness: clampBrightness(brightness) };
}

/** Build a `Channel/SetIndex` command. */
export function setChannelIndex(index: number): SetChannelIndexCommand {
  return { Command: "Channel/SetIndex", SelectIndex: index };
}

/** Build a `Device/PlayBuzzer` command. */
export function playBuzzer(activeMs = 500, offMs = 500, totalMs = 500): PlayBuzzerCommand {
  return {
    Command: "Device/PlayBuzzer",
    ActiveTimeInCycle: activeMs,
    OffTimeInCycle: offMs,
    PlayTotalTime: totalMs,
  };
}

function clampBrightness(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}
