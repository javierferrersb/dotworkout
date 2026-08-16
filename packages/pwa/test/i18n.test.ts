import { deepStrictEqual, ok } from "node:assert/strict";
import { describe, it } from "node:test";
import { ACTIVITY_CATALOGUE } from "../src/domain/activity.js";
import { DICTIONARIES, LOCALES, type LocaleCode, type MessageKey } from "../src/i18n/messages.js";

const CODES = LOCALES.map((locale) => locale.code);

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1] as string).sort();
}

function missing(key: string): LocaleCode[] {
  return CODES.filter((code) => DICTIONARIES[code][key as MessageKey] === undefined);
}

/**
 * Keys the code assembles at runtime and casts to MessageKey. TypeScript checks
 * the literal ones and checks that Spanish covers English, so what is left to
 * check is the casts: a sport added to the matrix reaches the picker without
 * anyone writing it a name.
 */
describe("every assembled message key exists in both languages", () => {
  it("names every activity in the catalogue", () => {
    for (const activity of ACTIVITY_CATALOGUE) {
      deepStrictEqual(missing(`activity.${activity.id}`), [], `activity.${activity.id}`);
    }
  });

  it("names every block kind, goal, target and shape", () => {
    const families: Record<string, readonly string[]> = {
      kind: ["WARMUP", "INTERVAL", "RECOVERY", "COOLDOWN"],
      kindKey: ["WARMUP", "INTERVAL", "RECOVERY", "COOLDOWN"],
      goal: ["DISTANCE", "DISTANCE_TIME", "TIME", "OPEN"],
      goalKey: ["DISTANCE", "DISTANCE_TIME", "TIME", "OPEN"],
      alert: ["NONE", "HEART_RATE", "CADENCE", "POWER"],
      alertKey: ["NONE", "HEART_RATE", "CADENCE", "POWER"],
      reading: ["current", "average"],
      readingKey: ["current", "average"],
      style: ["ZONE", "VALUE", "RANGE"],
      styleKey: ["ZONE", "VALUE", "RANGE"],
    };

    for (const [prefix, values] of Object.entries(families)) {
      for (const value of values) {
        deepStrictEqual(missing(`${prefix}.${value}`), [], `${prefix}.${value}`);
      }
    }
  });

  it("names a speed target both ways round, because running reads it as a pace", () => {
    for (const key of [
      "alert.SPEED.pace",
      "alert.SPEED.speed",
      "alertKey.SPEED.pace",
      "alertKey.SPEED.speed",
    ]) {
      deepStrictEqual(missing(key), [], key);
    }
  });
});

describe("the dictionaries line up", () => {
  it("carries a dictionary for every locale offered in the picker", () => {
    for (const code of CODES) {
      ok(Object.keys(DICTIONARIES[code]).length > 0, code);
    }
  });

  it("holds the same keys in every language", () => {
    const english = Object.keys(DICTIONARIES.en).sort();
    for (const code of CODES) {
      deepStrictEqual(Object.keys(DICTIONARIES[code]).sort(), english, code);
    }
  });

  it("leaves nothing blank", () => {
    for (const code of CODES) {
      for (const [key, value] of Object.entries(DICTIONARIES[code])) {
        ok(value.trim().length > 0, `${code} ${key} is empty`);
      }
    }
  });

  /** A dropped {count} renders as a sentence with a hole in it, silently. */
  it("keeps the same placeholders in every language", () => {
    for (const [key, english] of Object.entries(DICTIONARIES.en)) {
      for (const code of CODES) {
        const translated = DICTIONARIES[code][key as MessageKey];
        deepStrictEqual(placeholders(translated), placeholders(english), `${code} ${key}`);
      }
    }
  });
});
