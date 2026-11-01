import { untrack } from "svelte";

const FOCUSABLE = "button:not([disabled]), a[href], input:not([disabled]), select, textarea";

class ModalStack {
  #open = $state(0);

  get any(): boolean {
    return this.#open > 0;
  }

  /**
   * Opens a dialog: focus moves into it, Tab cycles inside it rather than
   * wandering into the page behind, and closing it puts focus back where it
   * was when the dialog opened.
   */
  enter(dialog?: HTMLElement): () => void {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    untrack(() => (this.#open += 1));

    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || dialog === undefined) return;
      const stops = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = stops[0];
      const last = stops.at(-1);
      if (first === undefined || last === undefined) return;
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog?.addEventListener("keydown", trap);
    dialog?.focus();

    return () => {
      dialog?.removeEventListener("keydown", trap);
      untrack(() => (this.#open -= 1));
      if (before?.isConnected === true) before.focus();
    };
  }
}

export const modals = new ModalStack();
