const FLASH_MS = 280;

export function flashConfirm(element: HTMLElement | null | undefined): Promise<void> {
  if (element === null || element === undefined) return Promise.resolve();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();

  element.classList.remove("confirming");
  void element.offsetWidth;
  element.classList.add("confirming");

  return new Promise((resolve) => {
    setTimeout(() => {
      element.classList.remove("confirming");
      resolve();
    }, FLASH_MS);
  });
}
