const signature = typeof navigator === "undefined" ? "" : navigator.platform || navigator.userAgent;

export const isApple = /mac|iphone|ipad|ipod/i.test(signature);

/** The iPhone itself: the phone an Apple Watch pairs with, so the workout is already where it needs to go. */
export const isIphone = /iphone|ipod/i.test(signature);

export const isIos =
  /iphone|ipad|ipod/i.test(signature) ||
  (/mac/i.test(signature) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
