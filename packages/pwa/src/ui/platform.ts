const APPLE = /mac|iphone|ipad|ipod/i.test(
  typeof navigator === "undefined" ? "" : navigator.platform || navigator.userAgent,
);

export const isApple = APPLE;

export const KEY = {
  primary: APPLE ? "⌘" : "Ctrl",
  alt: APPLE ? "⌥" : "Alt",
  enter: APPLE ? "Return" : "Enter",
  escape: "Esc",
  tab: "Tab",
  shift: APPLE ? "⇧" : "Shift",
  up: "↑",
  down: "↓",
};

export function combo(...parts: string[]): string {
  return parts.join(APPLE ? "" : "+");
}

export const SAVE_HINT = combo(KEY.primary, "S");
export const COMMIT_HINT = combo(KEY.primary, KEY.enter);
export const BLOCK_UP_HINT = combo(KEY.alt, KEY.up);
export const BLOCK_DOWN_HINT = combo(KEY.alt, KEY.down);
