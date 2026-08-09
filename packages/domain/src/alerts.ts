/**
 * Alerts in domain terms.
 *
 * Two traps from `spec/FORMAT.md` §6 are designed out here rather than
 * documented and hoped for:
 *
 * 1. **Pace ranges read backwards.** Speed is always stored in metres per
 *    second, and `lower_bound` is the *slower* value. For running pace that
 *    inverts relative to how it is displayed — 5'30"/km is 3.03 m/s, 5'00"/km is
 *    3.33 m/s. So the API takes `slower` and `faster`, never `min`/`max`, and
 *    {@link paceToMetersPerSecond} does the conversion.
 * 2. **The current/average axis is per-metric.** Speed and power have a toggle;
 *    cadence and heart rate do not, and their metric is fixed. So `metric` is
 *    only accepted where it exists.
 */

import { create } from "@bufbuild/protobuf";
import {
  CadenceAlertSchema,
  CadenceAlert_CadenceBoundSchema,
  CadenceAlert_CadenceRangeAlertSchema,
  CadenceAlert_TimeUnitSchema,
  HeartRateRangeAlertSchema,
  HeartRateRangeAlert_ClosedRangeSchema,
  HeartRateRangeAlert_HeartRateZoneSchema,
  HeartRateRangeAlert_WrapDoubleSchema,
  PowerAlertSchema,
  PowerAlert_PowerBoundSchema,
  PowerAlert_PowerRangeAlertSchema,
  SpeedAlertSchema,
  SpeedAlert_SpeedBoundSchema,
  SpeedAlert_SpeedRangeAlertSchema,
  SpeedAlert_SpeedSchema,
  SpeedAlert_Speed_SpeedUnitEnum,
  SpeedAlert_TimeUnitSchema,
  WorkoutAlertSchema,
  WorkoutAlert_AlertMetricEnum,
  WorkoutAlert_AlertStyle,
  WorkoutGoal_TimeGoal_TimeUnitType,
  type WorkoutAlert,
} from "@dotworkout/codec";
import { parseDuration, toSeconds, type DurationInput } from "./units.js";

/** Which metric an alert watches. Mirrors the keys of `alertStyles` in the matrix. */
export type AlertKind = "HEART_RATE" | "SPEED" | "CADENCE" | "POWER";

/** The current/average toggle, where the metric has one. */
export type SpeedMetric = "current" | "average";
export type PowerMetric = "current" | "average";

export type AlertSpec =
  /** Zone index 1–5. Bounds resolve on-device against the wearer's own HR data. */
  | { readonly kind: "heartRateZone"; readonly zone: number }
  | { readonly kind: "heartRateRange"; readonly from: number; readonly to: number }
  | {
      readonly kind: "speed";
      readonly metersPerSecond: number;
      readonly metric?: SpeedMetric;
    }
  | {
      readonly kind: "speedRange";
      /** The slower end, in m/s — the numerically *smaller* value. */
      readonly slower: number;
      /** The faster end, in m/s — the numerically *larger* value. */
      readonly faster: number;
      readonly metric?: SpeedMetric;
    }
  | { readonly kind: "cadence"; readonly perMinute: number }
  | { readonly kind: "cadenceRange"; readonly from: number; readonly to: number }
  | { readonly kind: "power"; readonly watts: number; readonly metric?: PowerMetric }
  | {
      readonly kind: "powerRange";
      readonly from: number;
      readonly to: number;
      readonly metric?: PowerMetric;
    };

/** Observed only as 1, presumed watts (spec §9 lists this as unverified). */
const PRESUMED_WATTS = 1;

export function toWorkoutAlert(spec: AlertSpec): WorkoutAlert {
  switch (spec.kind) {
    case "heartRateZone":
      return create(WorkoutAlertSchema, {
        // Heart rate has no current/average toggle; its metric is fixed.
        alertMetric: WorkoutAlert_AlertMetricEnum.COUNT_PER_MINUTE,
        alertStyle: WorkoutAlert_AlertStyle.ZONE,
        heartRateRangeAlert: create(HeartRateRangeAlertSchema, {
          heartRateZone: create(HeartRateRangeAlert_HeartRateZoneSchema, { zone: spec.zone }),
        }),
      });

    case "heartRateRange":
      return create(WorkoutAlertSchema, {
        alertMetric: WorkoutAlert_AlertMetricEnum.COUNT_PER_MINUTE,
        alertStyle: WorkoutAlert_AlertStyle.RANGE,
        heartRateRangeAlert: create(HeartRateRangeAlertSchema, {
          heartRateRange: create(HeartRateRangeAlert_ClosedRangeSchema, {
            lowerBound: create(HeartRateRangeAlert_WrapDoubleSchema, { value: spec.from }),
            upperBound: create(HeartRateRangeAlert_WrapDoubleSchema, { value: spec.to }),
          }),
        }),
      });

    case "speed":
      return create(WorkoutAlertSchema, {
        alertMetric: speedMetric(spec.metric),
        alertStyle: WorkoutAlert_AlertStyle.VALUE,
        speedAlert: create(SpeedAlertSchema, { speedTarget: speedBound(spec.metersPerSecond) }),
      });

    case "speedRange":
      return create(WorkoutAlertSchema, {
        alertMetric: speedMetric(spec.metric),
        alertStyle: WorkoutAlert_AlertStyle.RANGE,
        speedAlert: create(SpeedAlertSchema, {
          speedRangeAlert: create(SpeedAlert_SpeedRangeAlertSchema, {
            lowerBound: speedBound(spec.slower),
            upperBound: speedBound(spec.faster),
          }),
        }),
      });

    case "cadence":
      return create(WorkoutAlertSchema, {
        // Cadence has no current/average toggle either.
        alertMetric: WorkoutAlert_AlertMetricEnum.CADENCE,
        alertStyle: WorkoutAlert_AlertStyle.VALUE,
        cadenceAlert: create(CadenceAlertSchema, { cadenceTarget: cadenceBound(spec.perMinute) }),
      });

    case "cadenceRange":
      return create(WorkoutAlertSchema, {
        alertMetric: WorkoutAlert_AlertMetricEnum.CADENCE,
        alertStyle: WorkoutAlert_AlertStyle.RANGE,
        cadenceAlert: create(CadenceAlertSchema, {
          cadenceRangeAlert: create(CadenceAlert_CadenceRangeAlertSchema, {
            lowerBound: cadenceBound(spec.from),
            upperBound: cadenceBound(spec.to),
          }),
        }),
      });

    case "power":
      return create(WorkoutAlertSchema, {
        alertMetric: powerMetric(spec.metric),
        alertStyle: WorkoutAlert_AlertStyle.VALUE,
        powerAlert: create(PowerAlertSchema, { powerTarget: powerBound(spec.watts) }),
      });

    case "powerRange":
      return create(WorkoutAlertSchema, {
        alertMetric: powerMetric(spec.metric),
        alertStyle: WorkoutAlert_AlertStyle.RANGE,
        powerAlert: create(PowerAlertSchema, {
          powerRangeAlert: create(PowerAlert_PowerRangeAlertSchema, {
            lowerBound: powerBound(spec.from),
            upperBound: powerBound(spec.to),
          }),
        }),
      });
  }
}

/** Which metric an alert message watches, or `undefined` if no payload is set. */
export function alertKind(alert: WorkoutAlert): AlertKind | undefined {
  if (alert.heartRateRangeAlert !== undefined) return "HEART_RATE";
  if (alert.speedAlert !== undefined) return "SPEED";
  if (alert.cadenceAlert !== undefined) return "CADENCE";
  if (alert.powerAlert !== undefined) return "POWER";
  return undefined;
}

/**
 * Convert a pace to metres per second.
 *
 * `paceToMetersPerSecond("5:30", "km")` → 3.0303…, i.e. 5 minutes 30 seconds per
 * kilometre. Remember that a *slower* pace produces a *smaller* number, which is
 * why range bounds are named `slower`/`faster`.
 */
export function paceToMetersPerSecond(
  perUnit: DurationInput,
  unit: "km" | "mi" = "km",
): number {
  const seconds = toSeconds(parseDuration(perUnit));
  const meters = unit === "km" ? 1000 : 1609.344;
  return meters / seconds;
}

/** Convert a cycling speed to metres per second. `25` km/h → 6.944… */
export function speedToMetersPerSecond(value: number, unit: "kmh" | "mph" = "kmh"): number {
  return unit === "kmh" ? (value * 1000) / 3600 : (value * 1609.344) / 3600;
}

function speedMetric(metric: SpeedMetric | undefined): WorkoutAlert_AlertMetricEnum {
  return metric === "average"
    ? WorkoutAlert_AlertMetricEnum.AVERAGE
    : WorkoutAlert_AlertMetricEnum.CURRENT;
}

function powerMetric(metric: PowerMetric | undefined): WorkoutAlert_AlertMetricEnum {
  return metric === "average"
    ? WorkoutAlert_AlertMetricEnum.POWER_AVERAGE
    : WorkoutAlert_AlertMetricEnum.POWER_CURRENT;
}

function speedBound(metersPerSecond: number) {
  return create(SpeedAlert_SpeedBoundSchema, {
    speed: create(SpeedAlert_SpeedSchema, {
      unit: SpeedAlert_Speed_SpeedUnitEnum.METERS_PER_SECOND,
      speed: metersPerSecond,
    }),
    // The TimeUnit submessage is a real denominator, not a constant:
    // {SECONDS, 1.0} is what makes this metres per *second*.
    timeUnit: create(SpeedAlert_TimeUnitSchema, {
      unit: WorkoutGoal_TimeGoal_TimeUnitType.SECONDS,
      value: 1,
    }),
  });
}

function cadenceBound(perMinute: number) {
  return create(CadenceAlert_CadenceBoundSchema, {
    cadence: perMinute,
    // Cadence carries MINUTES where speed carries SECONDS — counts per minute.
    timeUnit: create(CadenceAlert_TimeUnitSchema, {
      unit: WorkoutGoal_TimeGoal_TimeUnitType.MINUTES,
      value: 1,
    }),
  });
}

function powerBound(watts: number) {
  return create(PowerAlert_PowerBoundSchema, { unit: PRESUMED_WATTS, power: watts });
}
