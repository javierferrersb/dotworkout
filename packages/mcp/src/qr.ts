import qrcode from "qrcode-generator";

const QUIET_ZONE = 4;

/**
 * A QR code drawn with half blocks: two module rows per line of text, because
 * a character cell is about twice as tall as it is wide, and one module per
 * cell each way comes out squashed enough that scanners give up.
 *
 * Light modules are drawn and dark ones left blank, which is the right way
 * round on a dark terminal — the blocks take the foreground colour. Set
 * DOTWORKOUT_QR_INVERT to flip it for a light one.
 */
export function qrLines(content: string, invert = process.env.DOTWORKOUT_QR_INVERT !== undefined) {
  const code = qrcode(0, "M");
  code.addData(content);
  code.make();

  const modules = code.getModuleCount();
  const size = modules + QUIET_ZONE * 2;

  const lit = (row: number, column: number): boolean => {
    const y = row - QUIET_ZONE;
    const x = column - QUIET_ZONE;
    const dark = y >= 0 && x >= 0 && y < modules && x < modules && code.isDark(y, x);
    return invert ? dark : !dark;
  };

  const lines: string[] = [];
  for (let row = 0; row < size; row += 2) {
    let line = "";
    for (let column = 0; column < size; column += 1) {
      const top = lit(row, column);
      const bottom = row + 1 < size && lit(row + 1, column);
      line += top && bottom ? "█" : top ? "▀" : bottom ? "▄" : " ";
    }
    lines.push(line);
  }
  return lines;
}

/** Beyond this a QR is too dense to read off a screen, so send the link alone. */
const READABLE_MODULES = 89;

export function qrBlock(content: string): string | undefined {
  try {
    const lines = qrLines(content);
    return lines.length * 2 > READABLE_MODULES + QUIET_ZONE * 2 ? undefined : lines.join("\n");
  } catch {
    return undefined;
  }
}
