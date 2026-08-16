/**
 * Test-only support for building *deliberately wrong* versions of the schema.
 *
 * `spec/FORMAT.md` §8 makes a claim the conformance suite depends on: nine of
 * the twenty corpus files round-trip byte-identically against a schema that is
 * missing ten real fields. A green assertion 3 is only meaningful if we can show
 * assertion 3 going red on precisely those gaps — otherwise we have tested that
 * our schema agrees with itself.
 *
 * So we reconstruct the upstream library's mistakes at runtime by editing
 * descriptors, rather than by checking in a second broken `.proto`. protobuf-es
 * exposes each generated file's `FileDescriptorProto` as `DescFile.proto`, so a
 * mutated registry is a clone-edit-rebuild away.
 */

import {
  clone,
  create,
  createFileRegistry,
  type DescFile,
  type DescMessage,
} from "@bufbuild/protobuf";
import {
  FileDescriptorProtoSchema,
  FileDescriptorSetSchema,
  type DescriptorProto,
  type FileDescriptorProto,
} from "@bufbuild/protobuf/wkt";
import { file_WorkoutFile } from "../src/schema.js";

const ROOT_FILE = "WorkoutFile.proto";

/**
 * Every descriptor reachable from the root, walked rather than listed.
 *
 * A hand-written list goes stale the moment the schema gains an import — which
 * it did, when the protovalidate options arrived and every file picked up a
 * dependency on buf/validate/validate.proto.
 */
function allFiles(): DescFile[] {
  const collected = new Map<string, DescFile>();
  const walk = (file: DescFile): void => {
    if (collected.has(file.proto.name)) return;
    collected.set(file.proto.name, file);
    for (const dep of file.dependencies) walk(dep);
  };
  walk(file_WorkoutFile);
  return [...collected.values()];
}

/** An edit applied to one message in the schema. */
export type SchemaEdit =
  | { readonly op: "removeField"; readonly message: string; readonly fieldNumber: number }
  | {
      readonly op: "renumberField";
      readonly message: string;
      readonly fieldNumber: number;
      readonly to: number;
    };

/**
 * Rebuild `WorkoutBinary` with the given edits applied.
 *
 * The result is a runtime `DescMessage` usable with `fromBinary`/`toBinary`
 * exactly like the generated `WorkoutBinarySchema`.
 */
export function mutatedWorkoutBinary(...edits: readonly SchemaEdit[]): DescMessage {
  const files = new Map<string, FileDescriptorProto>();
  for (const file of allFiles()) {
    files.set(file.proto.name, clone(FileDescriptorProtoSchema, file.proto));
  }

  for (const edit of edits) {
    const message = findMessage(files, edit.message);
    const index = message.field.findIndex((f) => f.number === edit.fieldNumber);
    if (index === -1) {
      throw new Error(`${edit.message} has no field ${edit.fieldNumber} to edit`);
    }
    if (edit.op === "removeField") {
      message.field.splice(index, 1);
    } else {
      message.field[index]!.number = edit.to;
    }
  }

  if (!files.has(ROOT_FILE)) throw new Error(`missing ${ROOT_FILE}`);

  // Deliberately the FileDescriptorSet overload rather than
  // createFileRegistry(proto, resolve). That overload walks imports depth-first
  // and then reverses the flattened list, which on this graph registers
  // IntervalBlock.proto before WorkoutStep.proto — the very file it imports —
  // and throws. Feeding a topologically ordered set sidesteps the ordering
  // entirely.
  const set = create(FileDescriptorSetSchema, { file: topologicalOrder(files) });
  const registry = createFileRegistry(set);
  const desc = registry.getMessage("WorkoutBinary");
  if (desc === undefined) throw new Error("WorkoutBinary missing from the mutated registry");
  return desc;
}

/** Dependencies before dependents, so each file's imports are already registered. */
function topologicalOrder(files: ReadonlyMap<string, FileDescriptorProto>): FileDescriptorProto[] {
  const ordered: FileDescriptorProto[] = [];
  const done = new Set<string>();
  const visiting = new Set<string>();

  const visit = (name: string): void => {
    if (done.has(name)) return;
    if (visiting.has(name)) throw new Error(`Import cycle through ${name}`);
    const file = files.get(name);
    if (file === undefined) throw new Error(`Cannot find ${name} among the corpus descriptors`);
    visiting.add(name);
    for (const dep of file.dependency) visit(dep);
    visiting.delete(name);
    done.add(name);
    ordered.push(file);
  };

  for (const name of files.keys()) visit(name);
  return ordered;
}

function findMessage(
  files: ReadonlyMap<string, FileDescriptorProto>,
  name: string,
): DescriptorProto {
  for (const file of files.values()) {
    const found = searchMessages(file.messageType, name);
    if (found !== undefined) return found;
  }
  throw new Error(`No message named ${name} in the corpus schema`);
}

function searchMessages(
  messages: readonly DescriptorProto[],
  name: string,
): DescriptorProto | undefined {
  for (const message of messages) {
    if (message.name === name) return message;
    const nested = searchMessages(message.nestedType, name);
    if (nested !== undefined) return nested;
  }
  return undefined;
}
