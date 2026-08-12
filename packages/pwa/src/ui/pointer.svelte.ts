const COARSE = "(pointer: coarse)";

function coarseNow(): boolean {
  return typeof window !== "undefined" && window.matchMedia(COARSE).matches;
}

class PointerKind {
  coarse = $state(coarseNow());

  watch(): () => void {
    const query = window.matchMedia(COARSE);
    const listener = (event: MediaQueryListEvent) => {
      this.coarse = event.matches;
    };
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }
}

export const pointer = new PointerKind();
