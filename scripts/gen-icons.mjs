import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../packages/pwa/public");

const PALETTES = {
  blue: ["#0b64d0", "#4fb0ff", "#8ce9ff"],
  brand: ["#0b64d0", "#22e0e0", "#b4ff39"],
  apple: ["#fa114f", "#a6ee2a", "#22e0e0"],
};

const GRID = 25;
const RINGS = [
  { outer: 12.3, inner: 9.9 },
  { outer: 8.4, inner: 6.0 },
  { outer: 4.7, inner: 2.4 },
];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function hex(value) {
  return [
    parseInt(value.slice(1, 3), 16),
    parseInt(value.slice(3, 5), 16),
    parseInt(value.slice(5, 7), 16),
  ];
}

function shade([r, g, b], amount) {
  const mix = (c, target) => Math.round(c + (target - c) * Math.abs(amount));
  return amount >= 0 ? [mix(r, 255), mix(g, 255), mix(b, 255)] : [mix(r, 0), mix(g, 0), mix(b, 0)];
}

function cellColour(col, row, palette) {
  const centre = (GRID - 1) / 2;
  const dx = col - centre;
  const dy = row - centre;
  const dist = Math.sqrt(dx * dx + dy * dy);
  for (let i = 0; i < RINGS.length; i++) {
    if (dist <= RINGS[i].outer && dist >= RINGS[i].inner) return palette[i];
  }
  return undefined;
}

function render(size, palette, background, inset) {
  const ss = 2;
  const dim = size * ss;
  const buf = Buffer.alloc(dim * dim * 4);

  if (background !== undefined) {
    const [br, bg, bb] = hex(background);
    for (let i = 0; i < dim * dim; i++) {
      buf[i * 4] = br;
      buf[i * 4 + 1] = bg;
      buf[i * 4 + 2] = bb;
      buf[i * 4 + 3] = 255;
    }
  }

  const art = dim * inset;
  const origin = (dim - art) / 2;
  const cell = art / GRID;
  const studR = cell * 0.29;

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const name = cellColour(col, row, palette);
      if (name === undefined) continue;
      const base = hex(name);

      const x0 = Math.round(origin + col * cell);
      const y0 = Math.round(origin + row * cell);
      const x1 = Math.round(origin + (col + 1) * cell);
      const y1 = Math.round(origin + (row + 1) * cell);
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const bevel = Math.max(2, Math.round(cell * 0.1));

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const dx = x - cx + 0.5;
          const dy = y - cy + 0.5;
          const d = Math.sqrt(dx * dx + dy * dy);

          let colour;
          if (d <= studR - bevel) {
            colour = shade(base, 0.16);
          } else if (d <= studR) {
            colour = dx + dy < 0 ? shade(base, 0.42) : shade(base, -0.3);
          } else if (x - x0 < bevel || y - y0 < bevel) {
            colour = shade(base, 0.26);
          } else if (x1 - x <= bevel || y1 - y <= bevel) {
            colour = shade(base, -0.24);
          } else {
            colour = base;
          }

          const i = (y * dim + x) * 4;
          buf[i] = colour[0];
          buf[i + 1] = colour[1];
          buf[i + 2] = colour[2];
          buf[i + 3] = 255;
        }
      }
    }
  }

  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const i = ((y * ss + sy) * dim + (x * ss + sx)) * 4;
          r += buf[i];
          g += buf[i + 1];
          b += buf[i + 2];
          a += buf[i + 3];
        }
      }
      const n = ss * ss;
      const i = (y * size + x) * 4;
      out[i] = Math.round(r / n);
      out[i + 1] = Math.round(g / n);
      out[i + 2] = Math.round(b / n);
      out[i + 3] = Math.round(a / n);
    }
  }
  return encodePng(size, size, out);
}

function svg(palette) {
  const cells = palette.map(() => []);
  const studs = palette.map(() => []);

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const name = cellColour(col, row, palette);
      if (name === undefined) continue;
      const i = palette.indexOf(name);
      cells[i].push(`M${col} ${row}h1v1h-1z`);
      studs[i].push(`M${col + 0.2} ${row + 0.5}a.3.3 0 1 0 .6 0a.3.3 0 1 0-.6 0z`);
    }
  }

  const layers = palette
    .map((name, i) => {
      const stud = `rgb(${shade(hex(name), 0.2).join(",")})`;
      return `<path fill="${name}" d="${cells[i].join("")}"/><path fill="${stud}" d="${studs[i].join("")}"/>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}">${layers}</svg>\n`;
}

const which = process.argv[2] ?? "blue";
const palette = PALETTES[which];
if (palette === undefined) throw new Error(`unknown palette: ${which}`);

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, "icon-192.png"), render(192, palette, undefined, 0.94));
writeFileSync(resolve(outDir, "icon-512.png"), render(512, palette, undefined, 0.94));
writeFileSync(
  resolve(outDir, "icon-512-maskable.png"),
  render(512, palette, "#101013", 0.62),
);
writeFileSync(resolve(outDir, "favicon.svg"), svg(palette));

console.log(`wrote ${which} icons to packages/pwa/public`);
