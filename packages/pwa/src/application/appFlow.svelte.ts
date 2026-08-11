export type Stage = "welcome" | "choose" | "name" | "compose";

const THEME_KEY = "dotworkout.theme";

export class AppFlow {
  stage = $state<Stage>("welcome");
  theme = $state<"dark" | "light">(readTheme());

  go(stage: Stage): void {
    this.stage = stage;
  }

  toggleTheme(): void {
    this.theme = this.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset["theme"] = this.theme;
    localStorage.setItem(THEME_KEY, this.theme);
  }

  applyTheme(): void {
    document.documentElement.dataset["theme"] = this.theme;
  }
}

function readTheme(): "dark" | "light" {
  const stored = typeof localStorage === "undefined" ? null : localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;
  const prefersLight =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches;
  return prefersLight ? "light" : "dark";
}
