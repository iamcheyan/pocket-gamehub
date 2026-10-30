/**
 * Handheld input mapping for Pocket GameHub.
 *
 * Pocket devices expose a standard Gamepad (D-Pad, ABXY, START, SELECT, MENU,
 * L1/R1/L2/R2) and a keyboard for desktop development. This module owns the
 * button -> semantic action table, rising-edge detection and d-pad repeat
 * timing so the UI only reacts to intent ("next", "launch"), not raw buttons.
 */

export type GamepadAction =
  | 'activate'
  | 'cancel'
  | 'favorite'
  | 'open'
  | 'launch'
  | 'help'
  | 'next'
  | 'previous'
  | 'nextNav'
  | 'previousNav';

/** Standard Gamepad API indices; the mapping page renders these labels. */
export const BUTTON_LABELS: ReadonlyArray<{ index: number; action: GamepadAction; label: string }> = [
  { index: 0, action: 'activate', label: 'A' },
  { index: 1, action: 'cancel', label: 'B' },
  { index: 2, action: 'favorite', label: 'X' },
  { index: 3, action: 'open', label: 'Y' },
  { index: 4, action: 'previousNav', label: 'L1' },
  { index: 5, action: 'activate', label: 'R1' },
  { index: 6, action: 'previous', label: 'L2' },
  { index: 7, action: 'next', label: 'R2' },
  { index: 8, action: 'help', label: 'SELECT' },
  { index: 9, action: 'launch', label: 'START' },
  { index: 12, action: 'previous', label: 'D-Pad Up' },
  { index: 13, action: 'next', label: 'D-Pad Down' },
  { index: 14, action: 'previous', label: 'D-Pad Left' },
  { index: 15, action: 'next', label: 'D-Pad Right' },
  { index: 16, action: 'help', label: 'MENU' },
];

const ACTION_BY_INDEX: Record<number, GamepadAction> = Object.fromEntries(
  BUTTON_LABELS.map(entry => [entry.index, entry.action]),
);

/** Minimum spacing between repeated actions, in milliseconds. */
export const ACTION_THROTTLE_MS = 180;

/**
 * D-pad repeat: holding a direction keeps scrolling after an initial delay.
 * Sticks are excluded so analogue drift cannot scroll the library.
 */
export const DPAD_REPEAT_DELAY_MS = 420;
export const DPAD_REPEAT_INTERVAL_MS = 130;

const KEY_ACTIONS: Record<string, GamepadAction> = {
  Enter: 'activate',
  Escape: 'cancel',
  Tab: 'help',
  ' ': 'launch',
  b: 'cancel',
  f: 'favorite',
  x: 'favorite',
  i: 'open',
  y: 'open',
  m: 'help',
};

/**
 * Converts the pressed-button bitmask into newly pressed button indices.
 * Uses a 32-bit mask: standard pads report at most 18 buttons.
 */
export function risingEdgeButtons(mask: number, previousMask: number): number[] {
  let edge = (mask & ~previousMask) >>> 0;
  const pressed: number[] = [];
  while (edge !== 0) {
    const lowest = edge & -edge;
    pressed.push(Math.log2(lowest));
    edge &= edge - 1;
  }
  return pressed;
}

/** Reads a pad's buttons into the bitmask used for edge detection. */
export function pressedButtonMask(pad: Gamepad | null | undefined): number {
  if (!pad) return 0;
  let mask = 0;
  for (let index = 0; index < pad.buttons.length && index < 32; index += 1) {
    if (pad.buttons[index]?.pressed) mask |= 1 << index;
  }
  return mask;
}

/**
 * Chooses the action for a frame. Returns `null` when the press is throttled,
 * unmapped, or already consumed.
 */
export function resolveAction(
  buttonIndex: number,
  nowMs: number,
  lastActionMs: number,
): GamepadAction | null {
  const action = ACTION_BY_INDEX[buttonIndex];
  if (!action) return null;
  if (nowMs - lastActionMs < ACTION_THROTTLE_MS) return null;
  return action;
}

/** Keyboard equivalent of a gamepad press; `null` when the key is unmapped. */
export function keyboardAction(key: string): GamepadAction | null {
  return KEY_ACTIONS[key.length === 1 ? key.toLowerCase() : key] ?? null;
}

/** True when a direction should fire, honouring the initial delay then repeat. */
export function shouldRepeatDirection(heldMs: number, lastRepeatMs: number): boolean {
  if (heldMs < DPAD_REPEAT_DELAY_MS) return false;
  return heldMs - DPAD_REPEAT_DELAY_MS - lastRepeatMs >= DPAD_REPEAT_INTERVAL_MS;
}
