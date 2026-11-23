// Keyboard and pointer input. The input layer knows nothing about the game: it
// turns raw browser events into logical calls (a click at logical coordinates, a
// key by code, a right-click) and hands them to main.js, which decides what they
// mean on the current screen. One-shot presses are queued as flags and taken once
// by the loop, so a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_CANCEL = 8;
export const ACTION_RESTART = 16;

const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);
const DIGITS = new Set(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7']);

/** Logical (1280x720) coordinates of a pointer event on the full-window canvas. */
function toLogical(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const scale = Math.min((rect.width * ratio) / 1280, (rect.height * ratio) / 720);
  const offsetX = (rect.width * ratio - 1280 * scale) / 2;
  const offsetY = (rect.height * ratio - 720 * scale) / 2;
  const x = ((event.clientX - rect.left) * ratio - offsetX) / scale;
  const y = ((event.clientY - rect.top) * ratio - offsetY) / scale;
  return { x, y };
}

export function createInput(canvas, handlers) {
  let actions = 0;
  let digit = 0; // 1-7, the hand slot the player just asked for
  let lastClick = null; // {x, y, button} since the last takeClick

  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (DIGITS.has(event.code)) {
      if (!event.repeat) digit = Number(event.code.slice(5));
    } else {
      return;
    }
    event.preventDefault();
  });

  canvas.addEventListener('pointerdown', (event) => {
    const point = toLogical(canvas, event);
    lastClick = { x: point.x, y: point.y, button: event.button };
    if (handlers.onPointerDown) handlers.onPointerDown(point, event.button);
  });

  canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    actions |= ACTION_CANCEL;
  });

  // A key released while the tab is hidden never sends keyup: nothing here holds
  // keys, so there is nothing to let go of.

  return {
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The hand slot (1-7) the player just asked for, or 0. */
    takeDigit() {
      const taken = digit;
      digit = 0;
      return taken;
    },
    /** The most recent click, or null. */
    takeClick() {
      const taken = lastClick;
      lastClick = null;
      return taken;
    },
    /** Is (x, y) inside rect? The hit test every screen shares. */
    inside(x, y, rect) {
      return !!rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
    },
  };
}
