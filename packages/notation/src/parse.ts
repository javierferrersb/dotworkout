/**
 * The swim notation grammar.
 *
 * This is the primary interface of the CLI, so it is deliberately forgiving
 * about word order and deliberately strict about ambiguity. The design rule:
 * every token is classified by its *shape*, not its position, and anything left
 * over becomes the step's label.
 *
 * That last part is not a shortcut. The format has no stroke field — the app
 * expects the stroke typed into the step's free-text name (spec/FORMAT.md §3).
 * So `4x100 pull` labelling the step "pull" is the correct modelling, not a
 * convenient fallback.
 *
 * ## Grammar
 *
 * ```
 * line        := warmup | cooldown | rest | set
 *
 * warmup      := ('warmup' | 'wu' | 'w/u')  quantity  label*
 * cooldown    := ('cooldown' | 'cd' | 'c/d') quantity label*
 * rest        := ('rest' | 'r') duration          -- a standalone recovery block
 * set         := [ reps 'x' ] quantity  modifier*
 *
 * modifier    := sendoff | restAfter | alert | labelWord
 * sendoff     := ('on' | '@') duration            -- DISTANCE_TIME, swimming only
 * restAfter   := ('rest' | 'r') [':'] duration
 * alert       := 'z' digit                        -- heart-rate zone 1-5
 *
 * quantity    := distance | duration | 'open'
 * distance    := number [ 'm' | 'y'|'yd' | 'km'|'k' | 'mi' | 'ft' ]
 * duration    := 'm:ss' | ':ss' | number ['s'|'min'|'h']
 * ```
 *
 * ## Examples
 *
 * ```
 * 400 warmup          400 m warm up
 * wu 400              the same, written the other way round
 * 8x50                8 x 50 m
 * 8x50 on 1:00        ...leaving every 1:00  (send-off)
 * 4x100 pull rest :20 ...labelled "pull", 20 s rest after each
 * 4x1:00              4 x 1 minute            (time goal, not distance)
 * 8x50 free z3        ...labelled "free", heart-rate zone 3
 * 100y                100 yards, stored as yards
 * 200 cd              200 m cool down
 * ```
 *
 * ## Deliberate ambiguity rules
 *
 * - A bare number is a **distance**. `30` means 30 metres, never 30 seconds.
 *   Times must be written with a colon or a unit: `:30`, `30s`, `1:00`.
 *   This is the one place the grammar refuses to guess, because guessing wrong
 *   silently produces a completely different workout.
 * - `r` and `rest` mean rest; `on` and `@` mean send-off. They are not
 *   interchangeable — `8x50 on 1:00` and `8x50 rest 1:00` are different
 *   workouts and both are things people write.
 */

import {
  parseDistance,
  parseDuration,
  UnitParseError,
  type AlertSpec,
  type Distance,
  type Duration,
} from "@dotworkout/domain";
import { NotationError, tokenize, type Token } from "./tokenize.js";

/** What a step is measured by. */
export type Quantity =
  | { readonly kind: "distance"; readonly distance: Distance }
  | { readonly kind: "time"; readonly duration: Duration }
  | { readonly kind: "open" };

export type ParsedLine =
  | {
      readonly kind: "set";
      readonly reps: number;
      readonly work: Quantity;
      readonly label: string | undefined;
      /** `on 1:00` — a DISTANCE_TIME send-off. */
      readonly sendOff: Duration | undefined;
      /** `rest :20` — a recovery step appended to the block. */
      readonly rest: Duration | undefined;
      readonly alert: AlertSpec | undefined;
    }
  | { readonly kind: "warmup"; readonly work: Quantity; readonly label: string | undefined }
  | { readonly kind: "cooldown"; readonly work: Quantity; readonly label: string | undefined }
  | { readonly kind: "rest"; readonly duration: Duration };

const WARMUP_WORDS = new Set(["warmup", "warm-up", "wu", "w/u"]);
const COOLDOWN_WORDS = new Set(["cooldown", "cool-down", "cd", "c/d"]);
const REST_WORDS = new Set(["rest", "r"]);
const SENDOFF_WORDS = new Set(["on", "@"]);

/**
 * Parse one line of notation.
 *
 * @throws {NotationError} with an offset and length pointing at the problem.
 */
export function parseLine(line: string): ParsedLine {
  const tokens = tokenize(line);
  if (tokens.length === 0) {
    throw new NotationError("Nothing to parse", 0, 1, "Try `8x50 on 1:00`");
  }

  const role = lineRole(tokens);
  if (role === "warmup" || role === "cooldown") {
    return parseWarmupOrCooldown(role, tokens, line);
  }
  if (role === "rest") {
    return parseStandaloneRest(tokens, line);
  }
  return parseSet(tokens, line);
}

/** True if the line parses. Cheap enough to call on every keystroke. */
export function tryParseLine(line: string): ParsedLine | NotationError {
  try {
    return parseLine(line);
  } catch (error) {
    if (error instanceof NotationError) return error;
    throw error;
  }
}

function lineRole(tokens: Token[]): "warmup" | "cooldown" | "rest" | "set" {
  // The keyword may lead or trail: both `400 warmup` and `wu 400` are natural.
  for (const token of tokens) {
    if (WARMUP_WORDS.has(token.lower)) return "warmup";
    if (COOLDOWN_WORDS.has(token.lower)) return "cooldown";
  }
  // A line that is *only* a rest is a recovery-only block. Those are real:
  // Minimal.workout and Activity_Cycle.workout each contain one.
  const first = tokens[0];
  if (first !== undefined && REST_WORDS.has(first.lower) && tokens.length === 2) return "rest";
  if (first !== undefined && /^r:?\d/.test(first.lower) && tokens.length === 1) return "rest";
  return "set";
}

function parseWarmupOrCooldown(
  role: "warmup" | "cooldown",
  tokens: Token[],
  line: string,
): ParsedLine {
  const keyword = role === "warmup" ? WARMUP_WORDS : COOLDOWN_WORDS;
  const rest = tokens.filter((t) => !keyword.has(t.lower));

  let work: Quantity | undefined;
  const labelWords: Token[] = [];
  for (const token of rest) {
    const quantity = asQuantity(token);
    if (quantity !== undefined && work === undefined) {
      work = quantity;
      continue;
    }
    labelWords.push(token);
  }

  if (work === undefined) {
    throw new NotationError(
      `A ${role === "warmup" ? "warm up" : "cool down"} needs a distance or a time`,
      0,
      line.length,
      role === "warmup" ? "Try `400 warmup` or `warmup 10:00`" : "Try `200 cooldown`",
    );
  }
  return { kind: role, work, label: joinLabel(labelWords) };
}

function parseStandaloneRest(tokens: Token[], line: string): ParsedLine {
  const target = tokens.length === 1 ? tokens[0]! : tokens[1]!;
  const text = tokens.length === 1 ? target.lower.replace(/^r:?/, "") : target.text;
  const duration = asDuration(text, target, "A standalone rest needs a time");
  if (duration === undefined) {
    throw new NotationError(
      "A standalone rest needs a time",
      target.start,
      target.end - target.start,
      "Try `rest :30`",
    );
  }
  return { kind: "rest", duration };
}

function parseSet(tokens: Token[], line: string): ParsedLine {
  let reps = 1;
  let work: Quantity | undefined;
  let sendOff: Duration | undefined;
  let rest: Duration | undefined;
  let alert: AlertSpec | undefined;
  const labelWords: Token[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;

    // `on 1:00` / `@ 1:00`, and the glued forms `@1:00`, `on1:00`.
    const sendOffText = attachedValue(token, SENDOFF_WORDS);
    if (sendOffText !== undefined) {
      const [value, valueToken] = sendOffText === "" ? [next(tokens, i), tokens[++i]] : [sendOffText, token];
      if (value === undefined || valueToken === undefined) {
        throw new NotationError(
          "`on` needs a send-off time",
          token.start,
          token.end - token.start,
          "Try `8x50 on 1:00`",
        );
      }
      sendOff = requireDuration(value, valueToken, "A send-off must be a time");
      continue;
    }

    // `rest :20`, `rest 20`, `r:20`, `r 20`.
    const restText = attachedValue(token, REST_WORDS);
    if (restText !== undefined) {
      const [value, valueToken] = restText === "" ? [next(tokens, i), tokens[++i]] : [restText, token];
      if (value === undefined || valueToken === undefined) {
        throw new NotationError(
          "`rest` needs a time",
          token.start,
          token.end - token.start,
          "Try `8x50 rest :20`",
        );
      }
      rest = requireDuration(value, valueToken, "A rest must be a time");
      continue;
    }

    // `z3` — heart-rate zone, the only alert swimming offers.
    const zone = /^z([1-5])$/.exec(token.lower);
    if (zone !== null) {
      alert = { kind: "heartRateZone", zone: Number(zone[1]) };
      continue;
    }

    // `8 x 50` and `8 x50` — the count and the multiplier arrive as separate
    // tokens, so the single-token form below never sees them.
    if (work === undefined && /^\d+$/.test(token.lower)) {
      const following = tokens[i + 1];
      if (following !== undefined && /^[x×]/.test(following.lower)) {
        reps = requireReps(Number(token.lower), token);
        const glued = following.text.slice(1);
        const quantityToken = glued === "" ? tokens[i + 2] : following;
        const quantityText = glued === "" ? tokens[i + 2]?.text : glued;
        i += glued === "" ? 2 : 1;
        if (quantityText === undefined || quantityToken === undefined) {
          throw new NotationError(
            `\`${reps}x\` needs something to repeat`,
            token.start,
            following.end - token.start,
            "Try `8x50`",
          );
        }
        work = requireQuantity(quantityText, quantityToken);
        continue;
      }
    }

    // `8x50`, `8x 50`, `8×50`.
    const repeated = /^(\d+)\s*[x×]\s*(.*)$/.exec(token.lower);
    if (repeated !== null && work === undefined) {
      reps = requireReps(Number(repeated[1]), token);
      const tail = repeated[2] ?? "";
      const quantityText = tail === "" ? next(tokens, i) : tail;
      if (tail === "") i++;
      if (quantityText === undefined) {
        throw new NotationError(
          `\`${reps}x\` needs something to repeat`,
          token.start,
          token.end - token.start,
          "Try `8x50`",
        );
      }
      work = requireQuantity(quantityText, tokens[i] ?? token);
      continue;
    }

    const quantity = asQuantity(token);
    if (quantity !== undefined && work === undefined) {
      work = quantity;
      continue;
    }

    // Anything unrecognised is label text. Stroke, equipment, intent — the
    // format has nowhere else to put them.
    labelWords.push(token);
  }

  if (work === undefined) {
    throw new NotationError(
      "This set has no distance or time",
      0,
      line.length,
      "Try `8x50 on 1:00` or `4x1:00`",
    );
  }
  if (sendOff !== undefined && work.kind !== "distance") {
    throw new NotationError(
      "A send-off applies to a distance, not a time",
      0,
      line.length,
      "`on` means leave every N — write `8x50 on 1:00`",
    );
  }

  return { kind: "set", reps, work, label: joinLabel(labelWords), sendOff, rest, alert };
}

/**
 * If `token` is one of `words`, return the value glued to it (`""` when the
 * value is a separate token). Returns undefined when the token is not a match.
 *
 * Handles `rest`, `rest:20`, `r:20` and `r20` in one place, which is what makes
 * the four spellings people actually type all work.
 */
function attachedValue(token: Token, words: ReadonlySet<string>): string | undefined {
  if (words.has(token.lower)) return "";
  for (const word of words) {
    if (token.lower.startsWith(word)) {
      const tail = token.lower.slice(word.length).replace(/^:/, "");
      // `r:20` yes; `run` no — the tail has to look like a time.
      if (tail !== "" && /^[\d:]/.test(tail)) return tail;
    }
  }
  return undefined;
}

function next(tokens: Token[], index: number): string | undefined {
  return tokens[index + 1]?.text;
}

function requireReps(reps: number, token: Token): number {
  if (!Number.isInteger(reps) || reps < 1) {
    throw new NotationError(
      "A set needs at least one repetition",
      token.start,
      token.end - token.start,
    );
  }
  return reps;
}

function asQuantity(token: Token): Quantity | undefined {
  if (token.lower === "open") return { kind: "open" };
  return quantityFrom(token.text);
}

function requireQuantity(text: string, token: Token): Quantity {
  if (text.toLowerCase() === "open") return { kind: "open" };
  const quantity = quantityFrom(text);
  if (quantity === undefined) {
    throw new NotationError(
      `\`${text}\` is not a distance or a time`,
      token.start,
      token.end - token.start,
      "Distances are plain numbers (`50`, `100y`); times need a colon or unit (`1:00`, `:30`, `30s`)",
    );
  }
  return quantity;
}

/**
 * Classify a bare value.
 *
 * A colon or an explicit time unit makes it a duration; anything else numeric is
 * a distance. This is the grammar's one hard rule against guessing — see the
 * module docs.
 */
function quantityFrom(text: string): Quantity | undefined {
  const lower = text.toLowerCase();
  if (lower.includes(":") || /^\d+(?:\.\d+)?(?:s|sec|secs|min|mins|h|hr)$/.test(lower)) {
    try {
      return { kind: "time", duration: parseDuration(lower) };
    } catch {
      return undefined;
    }
  }
  const distance = /^(\d+(?:\.\d+)?)\s*(m|km|k|y|yd|yds|yard|yards|mi|mile|miles|ft|feet)?$/.exec(
    lower,
  );
  if (distance === null) return undefined;
  const unit = normaliseDistanceUnit(distance[2]);
  try {
    return { kind: "distance", distance: parseDistance(`${distance[1]}${unit}`) };
  } catch (error) {
    if (error instanceof UnitParseError) return undefined;
    throw error;
  }
}

/** Map the shorthands people type onto the units the domain layer knows. */
function normaliseDistanceUnit(unit: string | undefined): string {
  switch (unit) {
    case undefined:
    case "":
      return "m";
    case "k":
      return "km";
    case "y":
    case "yds":
    case "yard":
    case "yards":
      return "yd";
    case "mile":
    case "miles":
      return "mi";
    case "feet":
      return "ft";
    default:
      return unit;
  }
}

function asDuration(text: string, token: Token, message: string): Duration | undefined {
  const quantity = quantityFrom(text);
  if (quantity?.kind === "time") return quantity.duration;
  // A bare number after `rest` or `on` is unambiguous — nobody rests for 20
  // metres — so seconds is the only sensible reading and we take it.
  if (/^\d+(?:\.\d+)?$/.test(text)) return parseDuration(`${text}s`);
  return undefined;
}

function requireDuration(text: string, token: Token, message: string): Duration {
  const duration = asDuration(text, token, message);
  if (duration === undefined) {
    throw new NotationError(
      `${message}, and \`${text}\` is not one`,
      token.start,
      token.end - token.start,
      "Times look like `1:00`, `:20` or `30`",
    );
  }
  return duration;
}

function joinLabel(tokens: Token[]): string | undefined {
  if (tokens.length === 0) return undefined;
  return tokens.map((t) => t.text).join(" ");
}
