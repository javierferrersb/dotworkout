/**
 * `@dotworkout/cli` — programmatic surface.
 *
 * The notation parser is the interesting export: it is the same grammar the
 * terminal composer uses, and the PWA will want it too rather than growing a
 * second, subtly different one.
 */

export { parseLine, tryParseLine, type ParsedLine, type Quantity } from "@dotworkout/notation";
export { tokenize, NotationError, type Token } from "@dotworkout/notation";
export { applyLines, describeLine, lineMeters, type ComposeOptions } from "@dotworkout/notation";
export { summarize, renderRows, renderTotals, renderHeader, type Row } from "./ui/format.js";
export {
  detectCapabilities,
  Painter,
  displayWidth,
  stripAnsi,
  type Capabilities,
} from "./ui/ansi.js";
export { decodeKeys, type Key, type KeyName } from "./tui/keys.js";
export { apply, initialState, type EditorState, type Intent } from "./tui/editor.js";
export { runComposer, type ComposerOptions, type ComposerResult } from "./tui/composer.js";
export { composeFrame, SHORTCUTS, COMMANDS, type Frame, type FrameInput } from "./tui/frame.js";
export { build, slug, type BuildOptions } from "./commands/build.js";
export { show, type ShowOptions } from "./commands/show.js";
