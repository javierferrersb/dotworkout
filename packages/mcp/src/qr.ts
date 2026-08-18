import qrcode from "qrcode-generator";

const QUIET_ZONE = 4;

export type Correction = "L" | "M" | "Q" | "H";

/**
 * A QR code drawn with half blocks: two module rows per line of text, because
 * a character cell is about twice as tall as it is wide, and one module per
 * cell each way comes out squashed enough that scanners give up.
 *
 * Light modules are drawn and dark ones left blank, which is the right way
 * round on a dark terminal — the blocks take the foreground colour. Set
 * DOTWORKOUT_QR_INVERT to flip it for a light one.
 */
export function qrLines(
  content: string,
  invert = env("DOTWORKOUT_QR_INVERT") !== undefined,
  correction: Correction = "M",
) {
  const code = encoded(content, correction);

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

export function qrBlock(content: string, correction: Correction = "M"): string | undefined {
  try {
    const lines = qrLines(content, undefined, correction);
    return lines.length * 2 > READABLE_MODULES + QUIET_ZONE * 2 ? undefined : lines.join("\n");
  } catch {
    return undefined;
  }
}

/**
 * Byte-mode capacity of each QR version, from the format's own tables. Passing
 * version 0 asks the library to find the fit by building the code at version 1,
 * then 2, and so on, which for a link this long is most of the work done over
 * and over: 12.5 ms of a 10 ms budget. Looking the version up first turns that
 * into a single build.
 */
const BYTE_CAPACITY: Readonly<Record<Correction, readonly number[]>> = {
  L: [
    17, 32, 53, 78, 106, 134, 154, 192, 230, 271, 321, 367, 425, 458, 520, 586, 644, 718, 792, 858,
    929, 1003, 1091, 1171, 1273, 1367, 1465, 1528, 1628, 1732, 1840, 1952, 2068, 2188, 2303, 2431,
    2563, 2699, 2809, 2953,
  ],
  M: [
    14, 26, 42, 62, 84, 106, 122, 152, 180, 213, 251, 287, 331, 362, 412, 450, 504, 560, 624, 666,
    711, 779, 857, 911, 997, 1059, 1125, 1190, 1264, 1370, 1452, 1538, 1628, 1722, 1809, 1911, 1989,
    2099, 2213, 2331,
  ],
  Q: [
    11, 20, 32, 46, 60, 74, 86, 108, 130, 151, 177, 203, 241, 258, 292, 322, 364, 394, 442, 482, 509,
    565, 611, 661, 715, 751, 805, 868, 908, 982, 1030, 1112, 1168, 1228, 1283, 1351, 1423, 1499,
    1579, 1663,
  ],
  H: [
    7, 14, 24, 34, 44, 58, 64, 84, 98, 119, 137, 155, 177, 194, 220, 250, 280, 310, 338, 382, 403,
    439, 461, 511, 535, 593, 625, 658, 698, 742, 790, 842, 898, 958, 983, 1051, 1093, 1139, 1219,
    1273,
  ],
};

function encoded(content: string, correction: Correction) {
  // The link is ASCII, but a title can carry anything, and capacity is counted
  // in bytes rather than characters.
  const length = new TextEncoder().encode(content).length;
  const capacities = BYTE_CAPACITY[correction];

  for (let version = capacities.findIndex((room) => room >= length) + 1; version <= 40; version++) {
    if (version === 0) break;
    try {
      const code = qrcode(version as Parameters<typeof qrcode>[0], correction);
      code.addData(content);
      code.make();
      return code;
    } catch {
      // The table said it would fit and it did not, so try the next size up
      // rather than trusting the table over the library.
      continue;
    }
  }

  const code = qrcode(0, correction);
  code.addData(content);
  code.make();
  return code;
}

/** Workers and Deno have no `process`; reading it defensively keeps this portable. */
function env(name: string): string | undefined {
  return typeof process === "undefined" ? undefined : process.env[name];
}
