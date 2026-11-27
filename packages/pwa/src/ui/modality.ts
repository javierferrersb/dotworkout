/**
 * Marks the page with how it is being driven, `keyboard` or `pointer`, so
 * keyboard hints can show for people using the keys without cluttering the
 * screen for everyone else. Modifier keys alone do not count as keyboard use,
 * and neither does typing into a field after a touch: a phone's on-screen
 * keyboard sends key events too, and showing hints then reflows the controls
 * under the next tap. Keys that move around (Tab, the arrows, Escape) still
 * count, since only a hardware keyboard sends them: an iPad with one attached
 * gets its hints even after a tap.
 */
const MODIFIERS = ["Shift", "Control", "Alt", "Meta"];
const NAVIGATION = ["Tab", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

export function watchModality(): () => void {
  const root = document.documentElement;
  let touched = false;
  const onKey = (event: KeyboardEvent) => {
    if (MODIFIERS.includes(event.key)) return;
    if (touched && isField(event.target) && !NAVIGATION.includes(event.key)) return;
    root.dataset["modality"] = "keyboard";
  };
  const onPointer = (event: PointerEvent) => {
    touched = event.pointerType === "touch" || event.pointerType === "pen";
    root.dataset["modality"] = "pointer";
  };
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("pointerdown", onPointer, true);
  return () => {
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("pointerdown", onPointer, true);
  };
}

function isField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
