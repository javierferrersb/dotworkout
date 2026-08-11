export const isApple = /mac|iphone|ipad|ipod/i.test(
  typeof navigator === "undefined" ? "" : navigator.platform || navigator.userAgent,
);
