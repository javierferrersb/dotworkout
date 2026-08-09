/**
 * Re-exports of the generated protobuf-es bindings.
 *
 * The files under `src/gen/` are produced by `npm run generate:proto` and are
 * checked in, so building this package never requires protoc or the buf CLI.
 * `buf.gen.yaml` sets `clean: true`, which wipes that directory on every
 * regeneration — which is why this barrel lives beside it rather than inside it.
 *
 * Nothing here is hand-written. Treat `proto/` as the source of truth and
 * regenerate rather than editing `src/gen/`.
 */

export {
  file_WorkoutFile,
  WorkoutBinarySchema,
  type WorkoutBinary,
} from "./gen/WorkoutFile_pb.js";

export {
  file_CustomWorkout,
  CustomWorkoutSchema,
  CustomWorkout_ActivityType,
  CustomWorkout_LocationType,
  type CustomWorkout,
} from "./gen/CustomWorkout_pb.js";

export {
  file_SingleGoalWorkout,
  SingleGoalWorkoutSchema,
  type SingleGoalWorkout,
} from "./gen/SingleGoalWorkout_pb.js";

export {
  file_IntervalBlock,
  IntervalBlockSchema,
  IntervalBlock_IntervalStepSchema,
  IntervalBlock_IntervalStep_IntervalPurpose,
  type IntervalBlock,
  type IntervalBlock_IntervalStep,
} from "./gen/IntervalBlock_pb.js";

export {
  file_WorkoutStep,
  WorkoutStepSchema,
  type WorkoutStep,
} from "./gen/WorkoutStep_pb.js";

export {
  file_WorkoutGoal,
  WorkoutGoalSchema,
  WorkoutGoal_TimeGoalSchema,
  WorkoutGoal_DistanceGoalSchema,
  WorkoutGoal_EnergyGoalSchema,
  WorkoutGoal_DistanceTimeGoalSchema,
  WorkoutGoal_GoalType,
  WorkoutGoal_TimeGoal_TimeUnitType,
  WorkoutGoal_DistanceGoal_DistanceUnitType,
  WorkoutGoal_EnergyGoal_EnergyUnitType,
  type WorkoutGoal,
  type WorkoutGoal_TimeGoal,
  type WorkoutGoal_DistanceGoal,
  type WorkoutGoal_EnergyGoal,
  type WorkoutGoal_DistanceTimeGoal,
} from "./gen/WorkoutGoal_pb.js";

export {
  file_WorkoutAlert,
  WorkoutAlertSchema,
  WorkoutAlert_AlertMetricEnum,
  WorkoutAlert_AlertStyle,
  type WorkoutAlert,
} from "./gen/WorkoutAlert_pb.js";

export {
  file_SpeedAlert,
  SpeedAlertSchema,
  SpeedAlert_SpeedSchema,
  SpeedAlert_SpeedBoundSchema,
  SpeedAlert_SpeedRangeAlertSchema,
  SpeedAlert_TimeUnitSchema,
  SpeedAlert_Speed_SpeedUnitEnum,
  type SpeedAlert,
  type SpeedAlert_Speed,
  type SpeedAlert_SpeedBound,
  type SpeedAlert_SpeedRangeAlert,
  type SpeedAlert_TimeUnit,
} from "./gen/SpeedAlert_pb.js";

export {
  file_CadenceAlert,
  CadenceAlertSchema,
  CadenceAlert_CadenceBoundSchema,
  CadenceAlert_CadenceRangeAlertSchema,
  CadenceAlert_TimeUnitSchema,
  type CadenceAlert,
  type CadenceAlert_CadenceBound,
  type CadenceAlert_CadenceRangeAlert,
  type CadenceAlert_TimeUnit,
} from "./gen/CadenceAlert_pb.js";

export {
  file_PowerAlert,
  PowerAlertSchema,
  PowerAlert_PowerBoundSchema,
  PowerAlert_PowerRangeAlertSchema,
  type PowerAlert,
  type PowerAlert_PowerBound,
  type PowerAlert_PowerRangeAlert,
} from "./gen/PowerAlert_pb.js";

export {
  file_HeartRateRangeAlert,
  HeartRateRangeAlertSchema,
  HeartRateRangeAlert_ClosedRangeSchema,
  HeartRateRangeAlert_HeartRateZoneSchema,
  HeartRateRangeAlert_WrapDoubleSchema,
  type HeartRateRangeAlert,
  type HeartRateRangeAlert_ClosedRange,
  type HeartRateRangeAlert_HeartRateZone,
  type HeartRateRangeAlert_WrapDouble,
} from "./gen/HeartRateRangeAlert_pb.js";
