/**
 * The interactive composer's event loop.
 *
 * Draws in place rather than taking over the screen: no alternate buffer, no
 * `clear`. It repaints its own block on each keystroke and leaves the finished
 * workout sitting in your scrollback on exit, which is what you want from
 * something you run twenty times while drafting a session.
 *
 * Everything testable lives elsewhere — key decoding in `keys.ts`, editor state
 * in `editor.ts`, the display in `frame.ts`. What remains here is terminal
 * modes, repaint bookkeeping and signal handling, and it is deliberately thin
 * because none of it can be covered by a test.
 */

import { stdin, stdout } from "node:process";
import { tryParseLine } from "../notation/parse.js";
import { NotationError } from "../notation/tokenize.js";
import { ESC, Painter, detectCapabilities, truncate } from "../ui/ansi.js";
import { apply, initialState, type EditorState } from "./editor.js";
import { composeFrame } from "./frame.js";
import { decodeKeys } from "./keys.js";

export interface ComposerResult {
  readonly lines: readonly string[];
  readonly name: string;
  /** False when the user quit with Ctrl+C or `:q`. */
  readonly saved: boolean;
}

export interface ComposerOptions {
  readonly name?: string;
  readonly initialLines?: readonly string[];
}

export async function runComposer(options: ComposerOptions = {}): Promise<ComposerResult> {
  const painter = new Painter(detectCapabilities(stdout));

  let state: EditorState = initialState(options.initialLines ?? []);
  let name = options.name ?? "";
  let notice: string | undefined;
  let painted = 0;

  const width = (): number => Math.max(48, stdout.columns ?? 80);

  const render = (): void => {
    const frame = composeFrame({ state, name, painter, width: width(), notice });

    let out = painted > 0 ? ESC.up(painted) : "";
    out += ESC.clearBelow;
    // Truncate every line so nothing soft-wraps. A wrapped line would make the
    // height bookkeeping wrong, and the next repaint would eat scrollback.
    out += frame.lines.map((line) => truncate(line, width())).join("\n");

    // Park the caret on the prompt line at the buffer position.
    const below = frame.lines.length - 1 - frame.promptRow;
    out += ESC.up(below);
    out += ESC.toColumn(frame.promptColumn + state.cursor + 1);

    stdout.write(out);
    painted = frame.promptRow;
  };

  const wasRaw = stdin.isRaw === true;
  if (stdin.isTTY) stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  stdout.write(ESC.hideCursor);

  const onResize = (): void => {
    painted = 0; // the old geometry is meaningless, so repaint from scratch
    stdout.write("\n");
    render();
  };
  stdout.on("resize", onResize);

  render();

  try {
    return await new Promise<ComposerResult>((resolve) => {
      const finish = (saved: boolean): void => {
        stdin.off("data", onData);
        resolve({ lines: state.lines, name, saved });
      };

      /** Colon commands act on the composer, not on the buffer. */
      const runCommand = (input: string): "continue" | "save" | "quit" => {
        const [command = "", ...rest] = input.slice(1).split(/\s+/);
        const argument = rest.join(" ");
        switch (command.toLowerCase()) {
          case "name":
          case "title":
            name = argument;
            notice = argument === "" ? "name cleared" : `named “${argument}”`;
            return "continue";
          case "drop":
          case "rm": {
            const index = Number(argument) - 1;
            if (!Number.isInteger(index) || index < 0 || index >= state.lines.length) {
              notice = `no line ${argument}`;
              return "continue";
            }
            state = initialState(state.lines.filter((_, i) => i !== index));
            notice = `dropped line ${index + 1}`;
            return "continue";
          }
          case "save":
          case "w":
          case "wq":
            return "save";
          case "q":
          case "quit":
            return "quit";
          case "help":
          case "h":
          case "?":
            state = { ...state, showHelp: true };
            return "continue";
          default:
            notice = `unknown command :${command}`;
            return "continue";
        }
      };

      const onData = (chunk: string): void => {
        for (const key of decodeKeys(chunk)) {
          notice = undefined;

          if (key.name === "enter" && state.buffer.trim().startsWith(":")) {
            const outcome = runCommand(state.buffer.trim());
            if (outcome === "quit") return finish(false);
            if (outcome === "save") return finish(true);
            state = { ...initialState(state.lines), showHelp: state.showHelp };
            render();
            continue;
          }

          state = apply(state, key, (line) => {
            const result = tryParseLine(line);
            return result instanceof NotationError ? result.message : undefined;
          });

          switch (state.intent.kind) {
            case "cancel":
              return finish(false);
            case "save":
              return finish(true);
            case "rejected":
              notice = `${state.intent.reason} — fix it, or esc to clear`;
              break;
            default:
              break;
          }
          render();
        }
      };

      stdin.on("data", onData);
    });
  } finally {
    stdout.off("resize", onResize);
    stdout.write(ESC.showCursor);
    if (stdin.isTTY) stdin.setRawMode(wasRaw);
    stdin.pause();
    stdout.write("\n");
  }
}
