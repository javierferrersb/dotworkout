import qrcode from "qrcode-generator";
import { encode } from "@dotworkout/codec";
import { readWorkoutLink, workoutLink as buildLink, type InboundWorkout } from "@dotworkout/domain";
import { compose, type WorkoutDraft } from "./workoutComposition.js";

export type ShareRoute = "download" | "chat";

export type { InboundWorkout };

export function workoutLink(draft: WorkoutDraft): string {
  return buildLink(encode(compose(draft)), {
    origin: `${location.origin}${location.pathname}`,
    title: draft.title,
  });
}

export function readInboundWorkout(): InboundWorkout | undefined {
  return location.hash === "" ? undefined : readWorkoutLink(location.hash);
}

export function clearInboundWorkout(): void {
  history.replaceState(null, "", `${location.origin}${location.pathname}`);
}

export function qrMatrix(text: string): readonly (readonly boolean[])[] {
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  const size = code.getModuleCount();
  const rows: boolean[][] = [];
  for (let row = 0; row < size; row++) {
    const cells: boolean[] = [];
    for (let column = 0; column < size; column++) cells.push(code.isDark(row, column));
    rows.push(cells);
  }
  return rows;
}

export function whatsappLink(draft: WorkoutDraft, summary: string): string {
  const message = `${draft.title}\n${summary}\n\n${workoutLink(draft)}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
