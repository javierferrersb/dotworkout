export type Stage = "welcome" | "choose" | "name" | "compose";
export type ThemeChoice = "system" | "light" | "dark";

const THEME_KEY = "dotworkout.theme";

function readChoice(): ThemeChoice {
  const stored = typeof localStorage === "undefined" ? null : localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

function systemPrefersLight(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches;
}

export class AppFlow {
  stage = $state<Stage>("welcome");
  themeChoice = $state<ThemeChoice>(readChoice());
  systemIsLight = $state(systemPrefersLight());

  resolvedTheme = $derived<"light" | "dark">(
    this.themeChoice === "system"
      ? this.systemIsLight
        ? "light"
        : "dark"
      : this.themeChoice,
  );

  go(stage: Stage): void {
    this.stage = stage;
  }

  setTheme(choice: ThemeChoice): void {
    this.themeChoice = choice;
    try {
      localStorage.setItem(THEME_KEY, choice);
    } catch {
      return;
    }
  }

  applyTheme(): void {
    document.documentElement.dataset["theme"] = this.resolvedTheme;
  }

  watchSystem(): () => void {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const listener = (event: MediaQueryListEvent) => {
      this.systemIsLight = event.matches;
    };
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }
}
