/**
 * Marks the page with how it is being driven, `keyboard` or `pointer`, so
 * keyboard hints can show for people using the keys without cluttering the
 * screen for everyone else. Modifier keys alone do not count as keyboard use.
 */
export function watchModality(): () => void {
  const root = document.documentElement;
  const onKey = (event: KeyboardEvent) => {
    if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
    root.dataset["modality"] = "keyboard";
  };
  const onPointer = () => {
    root.dataset["modality"] = "pointer";
  };
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("pointerdown", onPointer, true);
  return () => {
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("pointerdown", onPointer, true);
  };
}
