import { deepStrictEqual, ok } from "node:assert/strict";
import { describe, it } from "node:test";
import { decode, encode } from "@dotworkout/codec";
import {
  ACTIVITY_CATALOGUE,
  alertShapeOf,
  capabilitiesOf,
  type Activity,
  type AlertMetric,
} from "../src/domain/activity.js";
import type { AlertDraft, BlockDraft } from "../src/domain/block.js";
import { isAnswered, questionSequence } from "../src/domain/interview.js";
import { compose, inspect } from "../src/application/workoutComposition.js";

function goalAnswers(activity: Activity, goal: string): BlockDraft {
  const distance = { value: 1, unit: activity.defaultDistanceUnit };
  const time = { value: 10, unit: "min" as const };
  switch (goal) {
    case "DISTANCE":
      return { goalKind: "DISTANCE", distance };
    case "DISTANCE_TIME":
      return { goalKind: "DISTANCE_TIME", distance, sendOff: { value: 60, unit: "s" } };
    case "TIME":
      return { goalKind: "TIME", duration: time };
    default:
      return { goalKind: "OPEN" };
  }
}

/** The plainest alert each metric and shape accepts. */
function alertFor(metric: AlertMetric): AlertDraft {
  const shape = alertShapeOf(metric);
  const reading = "current" as const;
  switch (metric) {
    case "HEART_RATE":
      return shape.styles.includes("ZONE")
        ? { metric, style: "ZONE", zone: 3 }
        : { metric, style: "RANGE", from: 130, to: 150 };
    case "SPEED":
      return { metric, style: "VALUE", metersPerSecond: 3.3, reading };
    case "CADENCE":
      return { metric, style: "VALUE", perMinute: 90 };
    case "POWER":
      return { metric, style: "VALUE", watts: 250, reading };
  }
}

function block(activity: Activity, goal: string, alert?: AlertDraft): BlockDraft {
  return {
    kind: "INTERVAL",
    repetitions: 2,
    ...goalAnswers(activity, goal),
    ...(alert === undefined ? {} : { alert, alertMetric: alert.metric }),
    label: "Work",
  };
}

describe("every activity the picker offers can be composed", () => {
  for (const activity of ACTIVITY_CATALOGUE) {
    const capabilities = capabilitiesOf(activity);

    it(`${activity.id} offers at least one goal`, () => {
      ok(capabilities.goals.length > 0, `${activity.id} offers no goal at all`);
    });

    it(`${activity.id} builds a file the validator accepts, on every goal it offers`, () => {
      for (const goal of capabilities.goals) {
        const draft = {
          title: `${activity.id} test`,
          activity,
          blocks: [block(activity, goal)],
        };
        const result = inspect(draft);
        deepStrictEqual(
          result.validation?.errors ?? [{ code: "compose-threw", path: goal }],
          [],
          `${activity.id} ${goal}`,
        );
      }
    });

    it(`${activity.id} builds a file the validator accepts, on every target it offers`, () => {
      const goal = capabilities.goals[0] as string;
      for (const metric of capabilities.alerts) {
        const draft = {
          title: `${activity.id} test`,
          activity,
          blocks: [block(activity, goal, alertFor(metric))],
        };
        const result = inspect(draft);
        deepStrictEqual(
          result.validation?.errors ?? [{ code: "compose-threw", path: metric }],
          [],
          `${activity.id} ${metric}`,
        );
      }
    });

    it(`${activity.id} round-trips through the codec`, () => {
      const goal = capabilities.goals[0] as string;
      const bytes = encode(
        compose({
          title: `${activity.id} test`,
          activity,
          blocks: [
            { kind: "WARMUP", ...goalAnswers(activity, goal), label: "Easy" },
            block(activity, goal),
            { kind: "COOLDOWN", ...goalAnswers(activity, goal), label: "Loose" },
          ],
        }),
      );

      const workout = decode(bytes);
      deepStrictEqual(workout.customWorkout?.activityType, activity.type);
      ok(workout.customWorkout?.warmup !== undefined, "warm up survived");
      ok(workout.customWorkout?.cooldown !== undefined, "cool down survived");
    });
  }
});

describe("the interview only asks what the sport supports", () => {
  for (const activity of ACTIVITY_CATALOGUE) {
    const capabilities = capabilitiesOf(activity);

    it(`${activity.id} offers only goals the matrix allows`, () => {
      const draft: BlockDraft = { kind: "INTERVAL" };
      const questions = questionSequence(draft, activity, capabilities, {
        hasWarmup: false,
        hasCooldown: false,
        position: 1,
      });
      const goal = questions.find((question) => question.id === "goal");
      ok(goal !== undefined, "a goal is always asked for");
      const offered =
        goal.form.type === "choice" ? goal.form.choices.map((choice) => choice.value) : [];
      deepStrictEqual(offered, [...capabilities.goals]);
    });

    it(`${activity.id} offers only targets the matrix allows`, () => {
      const goalKind = capabilities.goals[0];
      const draft: BlockDraft = { kind: "INTERVAL", goalKind };
      const questions = questionSequence(draft, activity, capabilities, {
        hasWarmup: false,
        hasCooldown: false,
        position: 1,
      });
      const alert = questions.find((question) => question.id === "alert");
      ok(alert !== undefined, "a target is always asked for");
      const offered =
        alert.form.type === "choice"
          ? alert.form.choices.map((choice) => choice.value).filter((value) => value !== "NONE")
          : [];
      deepStrictEqual(offered, [...capabilities.alerts, ...capabilities.unverifiedAlerts]);
    });

    it(`${activity.id} finishes: answering every question completes the block`, () => {
      const draft: BlockDraft = block(activity, capabilities.goals[0] as string);
      const questions = questionSequence(draft, activity, capabilities, {
        hasWarmup: false,
        hasCooldown: false,
        position: 1,
      });
      const unanswered = questions.filter(
        (question) => !question.optional && !isAnswered(draft, question.id),
      );
      deepStrictEqual(
        unanswered.map((question) => question.id),
        [],
        `${activity.id} left questions hanging`,
      );
    });
  }
});
