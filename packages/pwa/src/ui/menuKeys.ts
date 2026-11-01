/**
 * Arrow keys, Home and End move between a menu's items; Escape closes it and
 * hands focus back to the button that opened it; Tab closes it and lets focus
 * carry on.
 */
export function menuKeydown(
  event: KeyboardEvent,
  items: readonly (HTMLElement | undefined)[],
  close: (refocus: boolean) => void,
): void {
  const present = items.filter((item): item is HTMLElement => item !== undefined);
  const at = present.indexOf(document.activeElement as HTMLElement);
  const go = (index: number) => {
    event.preventDefault();
    present[(index + present.length) % present.length]?.focus();
  };

  switch (event.key) {
    case "ArrowDown":
      go(at + 1);
      return;
    case "ArrowUp":
      go(at - 1);
      return;
    case "Home":
      go(0);
      return;
    case "End":
      go(present.length - 1);
      return;
    case "Escape":
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    case "Tab":
      close(false);
      return;
  }
}
