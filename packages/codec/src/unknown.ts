import type { DescMessage, Message, UnknownField } from "@bufbuild/protobuf";
import { WireType } from "@bufbuild/protobuf/wire";
import { UnknownFieldsError } from "./errors.js";

/** One unrecognised field found somewhere in a decoded message tree. */
export interface UnknownFieldFinding {
  /**
   * Dotted path to the *containing message*, using original proto field names
   * so it lines up with `testdata/*.json` — e.g.
   * `custom_workout.interval_blocks[0].interval_steps[1].workout_step.workout_alert`.
   * The root message is reported as `$`.
   */
  path: string;
  /** Fully-qualified protobuf type name of the containing message. */
  typeName: string;
  fieldNumber: number;
  wireType: number;
  wireTypeName: string;
  /** Size of the retained payload, useful for guessing at what was missed. */
  byteLength: number;
}

const WIRE_TYPE_NAMES: Record<number, string> = {
  [WireType.Varint]: "varint",
  [WireType.Bit64]: "64-bit",
  [WireType.LengthDelimited]: "length-delimited",
  [WireType.StartGroup]: "start-group",
  [WireType.EndGroup]: "end-group",
  [WireType.Bit32]: "32-bit",
};

/**
 * Walk an entire decoded message tree and collect every unknown field.
 *
 * protobuf-es v2 stores unrecognised fields per-message on `$unknown` (v1's
 * `getUnknownFields()` was removed). Because it is per-message, checking only
 * the root `WorkoutBinary` would miss exactly the gaps `spec/FORMAT.md` §8
 * describes: `SpeedAlert.speed_target` sits four levels down, inside
 * `custom_workout > interval_blocks > interval_steps > workout_step >
 * workout_alert > speed_alert`. So this recurses through every singular message
 * field, every element of every repeated message field, and every map value.
 */
export function findUnknownFields(schema: DescMessage, message: Message): UnknownFieldFinding[] {
  const findings: UnknownFieldFinding[] = [];
  visit(schema, message, "$", findings, new Set());
  return findings;
}

/** Throws {@link UnknownFieldsError} if the tree contains any unknown field. */
export function assertNoUnknownFields(schema: DescMessage, message: Message): void {
  const findings = findUnknownFields(schema, message);
  if (findings.length > 0) {
    throw new UnknownFieldsError(findings);
  }
}

function visit(
  schema: DescMessage,
  message: Message,
  path: string,
  out: UnknownFieldFinding[],
  seen: Set<object>,
): void {
  // Protobuf messages cannot be cyclic on the wire, but a caller can hand us a
  // hand-built object graph that is. Cheap insurance against an infinite walk.
  if (seen.has(message)) return;
  seen.add(message);

  for (const unknown of message.$unknown ?? []) {
    out.push(describe(unknown, path, schema.typeName));
  }

  for (const field of schema.fields) {
    const value = (message as Record<string, unknown>)[field.localName];
    if (value === undefined || value === null) continue;

    switch (field.fieldKind) {
      case "message":
        visit(field.message, value as Message, `${path}.${field.name}`, out, seen);
        break;

      case "list":
        if (field.listKind === "message") {
          const items = value as Message[];
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item === undefined) continue;
            visit(field.message, item, `${path}.${field.name}[${i}]`, out, seen);
          }
        }
        break;

      case "map":
        if (field.mapKind === "message") {
          for (const [key, item] of Object.entries(value as Record<string, Message>)) {
            visit(field.message, item, `${path}.${field.name}[${key}]`, out, seen);
          }
        }
        break;

      default:
        // Scalars and enums carry no nested unknown fields. Note that an
        // out-of-range enum value is NOT an unknown field: proto3 enums are
        // open, and the number survives round-tripping. That distinction
        // matters here — `activity_type` is a permission list, not a value
        // list (spec §3), so an unmodelled activity is a validation concern,
        // not a codec one.
        break;
    }
  }

  seen.delete(message);
}

function describe(unknown: UnknownField, path: string, typeName: string): UnknownFieldFinding {
  return {
    path,
    typeName,
    fieldNumber: unknown.no,
    wireType: unknown.wireType,
    wireTypeName: WIRE_TYPE_NAMES[unknown.wireType] ?? `unrecognised(${unknown.wireType})`,
    byteLength: unknown.data.length,
  };
}
