const signature = typeof navigator === "undefined" ? "" : navigator.platform || navigator.userAgent;

export const isApple = /mac|iphone|ipad|ipod/i.test(signature);

export const isIos =
  /iphone|ipad|ipod/i.test(signature) ||
  (/mac/i.test(signature) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
