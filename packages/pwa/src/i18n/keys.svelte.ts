import { isApple } from "../ui/platform.js";
import { t } from "./locale.svelte.js";

function join(...parts: string[]): string {
  return parts.join(isApple ? "" : "+");
}

class KeyLabels {
  primary = $derived(isApple ? "⌘" : t("key.ctrl"));
  alt = $derived(isApple ? "⌥" : t("key.alt"));
  enter = $derived(t("key.enter"));
  escape = $derived(t("key.esc"));
  tab = $derived(t("key.tab"));
  up = "↑";
  down = "↓";

  save = $derived(join(this.primary, "S"));
  blockUp = $derived(join(this.alt, this.up));
  blockDown = $derived(join(this.alt, this.down));
}

export const keys = new KeyLabels();
