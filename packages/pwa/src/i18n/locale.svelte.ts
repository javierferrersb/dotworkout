import { DICTIONARIES, type LocaleCode, type MessageKey } from "./messages.js";

const STORAGE_KEY = "dotworkout.locale";

function detect(): LocaleCode {
  const stored = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "es") return stored;
  const preferred = typeof navigator === "undefined" ? "en" : navigator.language;
  return preferred.toLowerCase().startsWith("es") ? "es" : "en";
}

class Locale {
  code = $state<LocaleCode>(detect());

  messages = $derived(DICTIONARIES[this.code]);

  set(code: LocaleCode): void {
    this.code = code;
    document.documentElement.lang = code;
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      return;
    }
  }

  apply(): void {
    document.documentElement.lang = this.code;
  }
}

export const locale = new Locale();

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = locale.messages[key];
  if (params === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : whole,
  );
}
