import { untrack } from "svelte";

class ModalStack {
  #open = $state(0);

  get any(): boolean {
    return this.#open > 0;
  }

  enter(): () => void {
    untrack(() => (this.#open += 1));
    return () => untrack(() => (this.#open -= 1));
  }
}

export const modals = new ModalStack();
