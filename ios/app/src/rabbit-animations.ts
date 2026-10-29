export type AnimationName =
  | "blink"
  | "swingRight"
  | "swingLeft"
  | "hop"
  | "wink"
  | "dizzy"
  | "wait"
  | "typing"
  | "smile";

export type AnimationSpec = {
  row: number;
  frames: number;
  frameMs: number;
  baselineOffset?: number;
};

export const animations: Record<AnimationName, AnimationSpec> = {
  blink: { row: 0, frames: 6, frameMs: 115 },
  swingRight: { row: 1, frames: 8, frameMs: 105 },
  swingLeft: { row: 2, frames: 8, frameMs: 105 },
  hop: { row: 3, frames: 4, frameMs: 105 },
  wink: { row: 4, frames: 5, frameMs: 125, baselineOffset: -1 },
  dizzy: { row: 5, frames: 8, frameMs: 105 },
  wait: { row: 6, frames: 6, frameMs: 180 },
  typing: { row: 7, frames: 6, frameMs: 115 },
  smile: { row: 8, frames: 6, frameMs: 145 },
};
