import { create } from "@bufbuild/protobuf";
import {
  WorkoutGoal_DistanceGoalSchema,
  WorkoutGoal_DistanceTimeGoalSchema,
  WorkoutGoal_EnergyGoalSchema,
  WorkoutGoal_EnergyGoal_EnergyUnitType,
  WorkoutGoal_GoalType,
  WorkoutGoal_TimeGoalSchema,
  WorkoutGoalSchema,
  type WorkoutGoal,
} from "@dotworkout/codec";
import {
  distanceUnitFromProto,
  distanceUnitToProto,
  timeUnitFromProto,
  timeUnitToProto,
  type Distance,
  type Duration,
} from "./units.js";

/**
 * A goal in domain terms.
 *
 * `distanceTime` is the send-off — "8 × 50 on 1:00" means leave every 60 seconds
 * regardless of finishing time. It is the idiom essentially every swim set is
 * written in, and per `spec/FORMAT.md` §5 it uses `goal_type = 5` with a
 * dedicated payload: it does *not* populate `time_goal` and `distance_goal`
 * together. It is offered for swimming only, which the compatibility matrix
 * enforces.
 */
export type GoalSpec =
  | { readonly kind: "open" }
  | { readonly kind: "distance"; readonly distance: Distance }
  | { readonly kind: "time"; readonly duration: Duration }
  | { readonly kind: "energy"; readonly kilocalories: number }
  | { readonly kind: "distanceTime"; readonly distance: Distance; readonly duration: Duration };

export function toWorkoutGoal(spec: GoalSpec): WorkoutGoal {
  switch (spec.kind) {
    case "open":
      // OPEN carries no payload at all.
      return create(WorkoutGoalSchema, { goalType: WorkoutGoal_GoalType.OPEN });

    case "distance":
      return create(WorkoutGoalSchema, {
        goalType: WorkoutGoal_GoalType.DISTANCE,
        distanceGoal: distanceGoal(spec.distance),
      });

    case "time":
      return create(WorkoutGoalSchema, {
        goalType: WorkoutGoal_GoalType.TIME,
        timeGoal: timeGoal(spec.duration),
      });

    case "energy":
      return create(WorkoutGoalSchema, {
        goalType: WorkoutGoal_GoalType.ENERGY,
        energyGoal: create(WorkoutGoal_EnergyGoalSchema, {
          unitType: WorkoutGoal_EnergyGoal_EnergyUnitType.KILOCALORIES,
          unitValue: spec.kilocalories,
        }),
      });

    case "distanceTime":
      return create(WorkoutGoalSchema, {
        goalType: WorkoutGoal_GoalType.DISTANCE_TIME,
        distanceTimeGoal: create(WorkoutGoal_DistanceTimeGoalSchema, {
          distance: distanceGoal(spec.distance),
          time: timeGoal(spec.duration),
        }),
      });
  }
}

/**
 * Read a goal back into domain terms, keeping the authored units.
 *
 * @throws if `goal_type` disagrees with the populated payload — that is a
 *   structural violation the protovalidate rules also catch, but reading has to
 *   fail rather than silently pick a payload.
 */
export function fromWorkoutGoal(goal: WorkoutGoal): GoalSpec {
  switch (goal.goalType) {
    case WorkoutGoal_GoalType.OPEN:
      return { kind: "open" };

    case WorkoutGoal_GoalType.DISTANCE: {
      const payload = required(goal.distanceGoal, "DISTANCE", "distance_goal");
      return { kind: "distance", distance: readDistance(payload) };
    }

    case WorkoutGoal_GoalType.TIME: {
      const payload = required(goal.timeGoal, "TIME", "time_goal");
      return { kind: "time", duration: readDuration(payload) };
    }

    case WorkoutGoal_GoalType.ENERGY: {
      const payload = required(goal.energyGoal, "ENERGY", "energy_goal");
      return { kind: "energy", kilocalories: payload.unitValue };
    }

    case WorkoutGoal_GoalType.DISTANCE_TIME: {
      const payload = required(goal.distanceTimeGoal, "DISTANCE_TIME", "distance_time_goal");
      return {
        kind: "distanceTime",
        distance: readDistance(required(payload.distance, "DISTANCE_TIME", "distance")),
        duration: readDuration(required(payload.time, "DISTANCE_TIME", "time")),
      };
    }

    default:
      throw new Error(
        `Unmodelled goal_type ${goal.goalType}. spec/FORMAT.md §5 lists TIME 1, ` +
          `ENERGY 2, DISTANCE 3, OPEN 4, DISTANCE_TIME 5.`,
      );
  }
}

function distanceGoal(distance: Distance) {
  return create(WorkoutGoal_DistanceGoalSchema, {
    unitType: distanceUnitToProto(distance.unit),
    unitValue: distance.value,
  });
}

function timeGoal(duration: Duration) {
  return create(WorkoutGoal_TimeGoalSchema, {
    unitType: timeUnitToProto(duration.unit),
    unitValue: duration.value,
  });
}

function readDistance(goal: { unitType: number; unitValue: number }): Distance {
  return { value: goal.unitValue, unit: distanceUnitFromProto(goal.unitType) };
}

function readDuration(goal: { unitType: number; unitValue: number }): Duration {
  return { value: goal.unitValue, unit: timeUnitFromProto(goal.unitType) };
}

function required<T>(value: T | undefined, goalType: string, field: string): T {
  if (value === undefined) {
    throw new Error(`goal_type is ${goalType} but ${field} is not set`);
  }
  return value;
}
