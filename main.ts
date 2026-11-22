// The picture that tastes of one ingredient:
// a tall stack of golden pancakes, warm maple syrup dripping down the sides,
// a pat of melting butter on top, blueberries on the plate. One hero subject,
// huge in frame, warm light on a dark background, glossy highlights, steam.
// Pure TypeScript, Node built-ins only, fully deterministic, no network.
import * as fs from "node:fs";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;
const OUT = "/output/entry.png";

// ---------- deterministic value noise ----------
function hash2(ix: number, iy: number): number {
  let h = (ix * 374761393 + iy * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295;
}
function vnoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(x: number, y: number): number {
  return (
    vnoise(x, y) * 0.55 +
    vnoise(x * 2.13 + 7.7, y * 2.13 + 3.1) * 0.3 +
    vnoise(x * 4.31 + 13.7, y * 4.31 + 9.4) * 0.15
  );
}
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
function smoothstep(a: number, b: number, v: number): number {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// ---------- scene layout ----------
const CX = 512;
// pancakes: bottom to top
const PAN = [
  { cy: 680, rx: 330, ry: 68 },
  { cy: 600, rx: 318, ry: 66 },
  { cy: 520, rx: 304, ry: 64 },
];
// syrup drips hanging off the syrup coat on the top pancake (x, length, half-width)
const DRIPS = [
  { x: 262, len: 95, w: 12 },
  { x: 322, len: 52, w: 9 },
  { x: 378, len: 128, w: 13 },
  { x: 444, len: 58, w: 10 },
  { x: 508, len: 102, w: 12 },
  { x: 572, len: 48, w: 9 },
  { x: 636, len: 118, w: 13 },
  { x: 704, len: 66, w: 11 },
  { x: 764, len: 86, w: 12 },
];
// blueberries on the plate
const BERRIES = [
  { x: 742, y: 756, r: 34 },
  { x: 288, y: 770, r: 29 },
  { x: 648, y: 468, r: 26 },
];
// soft warm bokeh lights in the background
const BOKEH = [
  { x: 150, y: 210, r: 46, a: 0.10 },
  { x: 880, y: 170, r: 60, a: 0.12 },
  { x: 920, y: 420, r: 34, a: 0.08 },
  { x: 90, y: 470, r: 38, a: 0.09 },
  { x: 800, y: 90, r: 26, a: 0.10 },
];

const img = new Uint8Array(W * H * 3);

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    // ---- background: warm dark radial glow behind the stack ----
    const dxc = (x - CX) / 620;
    const dyc = (y - 480) / 620;
    const dc = Math.sqrt(dxc * dxc + dyc * dyc);
    const glow = Math.max(0, 1 - dc);
    let r = 46 + 74 * glow * glow;
    let g = 28 + 44 * glow * glow;
    let b = 16 + 22 * glow * glow;
    // bokeh
    for (let i = 0; i < BOKEH.length; i++) {
      const bk = BOKEH[i];
      const bx = (x - bk.x) / bk.r;
      const by = (y - bk.y) / bk.r;
      const bd = bx * bx + by * by;
      if (bd < 1) {
        const f = (1 - bd) * bk.a;
        r += 255 * f * 0.9;
        g += 190 * f * 0.9;
        b += 110 * f * 0.9;
      }
    }

    // ---- soft shadow under the plate ----
    {
      const sx = (x - CX) / 470;
      const sy = (y - 846) / 46;
      const sd = sx * sx + sy * sy;
      if (sd < 1) {
        const f = (1 - sd) * 0.55;
        r *= 1 - f;
        g *= 1 - f;
        b *= 1 - f;
      }
    }

    // ---- plate: wide cream ellipse ----
    {
      const px = (x - CX) / 452;
      const py = (y - 800) / 108;
      const pd = px * px + py * py;
      if (pd < 1) {
        const edge = smoothstep(0.86, 1.0, Math.sqrt(pd));
        const shade = 1 - 0.22 * clamp(py + 0.4, 0, 1);
        r = 238 * shade - 46 * edge;
        g = 226 * shade - 40 * edge;
        b = 205 * shade - 34 * edge;
        // rim ring
        const ring = Math.abs(Math.sqrt(pd) - 0.88);
        if (ring < 0.02) {
          r = 196; g = 178; b = 148;
        }
        // warm light pooling on the plate from the top-left
        const lx = 1 - clamp(Math.hypot(x - 380, y - 700) / 700, 0, 1);
        r += 26 * lx; g += 18 * lx; b += 6 * lx;
      }
    }

    // ---- pancakes, bottom to top ----
    for (let i = 0; i < PAN.length; i++) {
      const p = PAN[i];
      const nx = (x - CX) / p.rx;
      const ny = (y - p.cy) / p.ry;
      const d2 = nx * nx + ny * ny;
      if (d2 >= 1) continue;
      const d = Math.sqrt(d2);
      const n = fbm(x * 0.012, y * 0.02);
      const n2 = fbm(x * 0.05 + 40, y * 0.09);
      if (ny < -0.12) {
        // golden top surface, toasted in patches
        const toast = clamp(0.35 + n * 0.9, 0, 1);
        const base = 214 + 26 * toast;
        r = base;
        g = 148 + 34 * toast;
        b = 52 + 26 * toast;
        // darker toasted freckles
        const fr = fbm(x * 0.09 + 3, y * 0.11);
        if (fr > 0.62) {
          const f = (fr - 0.62) * 2.2;
          r -= 52 * f; g -= 46 * f; b -= 30 * f;
        }
        // pale crumb speckle
        if (n2 > 0.72) {
          r += 22; g += 16; b += 8;
        }
        // warm light from top-left
        const lx = 1 - clamp(Math.hypot(x - 400, y - (p.cy - 40)) / 520, 0, 1);
        r += 30 * lx; g += 20 * lx;
        // rim darkening
        r -= 34 * smoothstep(0.86, 1.0, d);
        g -= 28 * smoothstep(0.86, 1.0, d);
        b -= 18 * smoothstep(0.86, 1.0, d);
      } else {
        // fluffy side: warm tan with soft, faint horizontal bands
        const band = 0.5 + 0.5 * Math.sin(y * 0.35 + n * 4);
        r = 196 + 10 * band;
        g = 138 + 8 * band;
        b = 58 + 5 * band;
        // crumb texture
        const cr = fbm(x * 0.08, y * 0.16);
        r += (cr - 0.5) * 26;
        g += (cr - 0.5) * 20;
        b += (cr - 0.5) * 12;
        // side shading: darker at the bottom edge, light catching the top
        const shade = 1 - 0.34 * clamp(ny, 0, 1) + 0.18 * (1 - clamp(ny + 0.2, 0, 1));
        r *= shade; g *= shade; b *= shade;
        // rim
        r -= 26 * smoothstep(0.9, 1.0, d);
        g -= 20 * smoothstep(0.9, 1.0, d);
        b -= 12 * smoothstep(0.9, 1.0, d);
      }
    }

    // ---- syrup pool on the top pancake ----
    {
      const top = PAN[2];
      const sx = (x - CX) / 230;
      const sy = (y - (top.cy - 18)) / 32;
      const sd2 = sx * sx + sy * sy;
      if (sd2 < 1) {
        const sd = Math.sqrt(sd2);
        const gloss = fbm(x * 0.03, y * 0.06);
        r = 168 + 26 * gloss;
        g = 96 + 18 * gloss;
        b = 16 + 8 * gloss;
        // glossy highlight arc upper-left
        const hx = (x - 430) / 120;
        const hy = (y - (top.cy - 30)) / 22;
        const hd = hx * hx + hy * hy;
        if (hd < 1) {
          const f = (1 - hd) * 0.75;
          r += 80 * f; g += 52 * f; b += 14 * f;
        }
        r -= 30 * smoothstep(0.8, 1.0, sd);
        g -= 22 * smoothstep(0.8, 1.0, sd);
        b -= 10 * smoothstep(0.8, 1.0, sd);
      }
    }

    // ---- syrup coat wrapping the top pancake's side, wavy lower edge ----
    {
      const top = PAN[2];
      const nx = (x - CX) / top.rx;
      const ny = (y - top.cy) / top.ry;
      const d2 = nx * nx + ny * ny;
      if (d2 < 1 && ny > -0.12) {
        const edge = 0.38 + 0.38 * fbm(x * 0.02, 3.7);
        if (ny < edge) {
          const n = fbm(x * 0.03, y * 0.06);
          r = 178 + 22 * n;
          g = 104 + 14 * n;
          b = 20 + 8 * n;
          // glossy sheen across the coat
          const sheen = Math.exp(-Math.pow((y - (top.cy - 6)) / 14, 2)) * 0.5;
          r += 66 * sheen; g += 42 * sheen; b += 10 * sheen;
          // darker toward the wavy lower edge
          r -= 34 * smoothstep(edge - 0.12, edge, ny);
          g -= 26 * smoothstep(edge - 0.12, edge, ny);
          b -= 12 * smoothstep(edge - 0.12, edge, ny);
        }
      }
    }

    // ---- syrup drips down the stack ----
    for (let i = 0; i < DRIPS.length; i++) {
      const dr = DRIPS[i];
      const y0 = 540 + 12 * Math.sin(dr.x * 0.043 + 0.7);
      const y1 = y0 + dr.len;
      if (y < y0 || y > y1 + dr.w) continue;
      const wob = Math.sin((y - y0) * 0.03 + i * 1.7) * 2.5;
      const dxd = Math.abs(x - (dr.x + wob));
      // rounded drip body + round bulb at the bottom
      const bulbCy = y1;
      const inBody = dxd < dr.w && y <= y1;
      const bdx = (x - (dr.x + wob)) / dr.w;
      const bdy = (y - bulbCy) / dr.w;
      const inBulb = bdx * bdx + bdy * bdy < 1 && y > y1 - dr.w;
      if (!inBody && !inBulb) continue;
      const n = fbm(x * 0.06, y * 0.05);
      r = 172 + 22 * n;
      g = 100 + 14 * n;
      b = 18 + 8 * n;
      // bright glossy stripe on the left of each drip
      const stripe = Math.exp(-Math.pow((x - (dr.x + wob - dr.w * 0.45)) / 4.5, 2));
      r += 60 * stripe; g += 38 * stripe; b += 10 * stripe;
      // dark edge on the right
      const edgeR = smoothstep(0.55, 1.0, dxd / dr.w);
      r -= 46 * edgeR; g -= 34 * edgeR; b -= 14 * edgeR;
      // bulb highlight
      if (inBulb) {
        const hl = Math.exp(-(Math.pow(x - (dr.x + wob - 4), 2) + Math.pow(y - (bulbCy - 3), 2)) / 26);
        r += 90 * hl; g += 60 * hl;
      }
    }

    // ---- melting butter pat on top ----
    {
      // soft contact shadow under the butter
      const shx = (x - 478) / 62;
      const shy = (y - 472) / 11;
      const shd2 = shx * shx + shy * shy;
      if (shd2 < 1) {
        const f = (1 - Math.sqrt(shd2)) * 0.4;
        r *= 1 - f; g *= 1 - f; b *= 1 - f;
      }
      // rotate around (478, 444) by -0.21 rad
      const bx = 478;
      const by = 444;
      const cos = 0.978;
      const sin = -0.208;
      const rx2 = (x - bx) * cos - (y - by) * sin;
      const ry2 = (x - bx) * sin + (y - by) * cos;
      if (Math.abs(rx2) < 46 && Math.abs(ry2) < 26) {
        const topFace = ry2 < 6;
        if (topFace) {
          r = 255; g = 214; b = 74;
          const hl = Math.exp(-(Math.pow(x - 462, 2) + Math.pow(y - 458, 2)) / 300);
          r += 0; g += 26 * hl; b += 60 * hl;
        } else {
          r = 238; g = 186; b = 44;
        }
        // soft edge
        const e = Math.max(Math.abs(rx2) / 46, Math.abs(ry2) / 26);
        const ef = smoothstep(0.85, 1.0, e);
        r -= 40 * ef; g -= 34 * ef; b -= 16 * ef;
      }
      // butter melt pool spreading on the syrup
      const mx = (x - 500) / 92;
      const my = (y - 498) / 26;
      const md2 = mx * mx + my * my;
      if (md2 < 1) {
        const f = (1 - Math.sqrt(md2)) * 0.85;
        r = r * (1 - f) + 250 * f;
        g = g * (1 - f) + 208 * f;
        b = b * (1 - f) + 92 * f;
      }
    }

    // ---- blueberries ----
    for (let i = 0; i < BERRIES.length; i++) {
      const bb = BERRIES[i];
      const bx = (x - bb.x) / bb.r;
      const by = (y - bb.y) / bb.r;
      const bd2 = bx * bx + by * by;
      if (bd2 >= 1) continue;
      const bd = Math.sqrt(bd2);
      const bloom = fbm(x * 0.1, y * 0.1);
      r = 52 + 20 * bloom;
      g = 48 + 18 * bloom;
      b = 96 + 30 * bloom;
      // round shading: light top-left, dark bottom-right
      const light = 1 - 0.55 * clamp((bx + by) * 0.7 + 0.3, 0, 1);
      r *= light + 0.35; g *= light + 0.35; b *= light + 0.45;
      // star crown on top
      const starD = Math.hypot(x - (bb.x - 4), y - (bb.y - bb.r * 0.55));
      if (starD < bb.r * 0.28) {
        r = 96; g = 82; b = 110;
      }
      // specular dot
      const hl = Math.exp(-(Math.pow(x - (bb.x - bb.r * 0.38), 2) + Math.pow(y - (bb.y - bb.r * 0.42), 2)) / (bb.r * bb.r * 0.03));
      r += 150 * hl; g += 150 * hl; b += 170 * hl;
      // rim
      r -= 22 * smoothstep(0.82, 1.0, bd);
      g -= 20 * smoothstep(0.82, 1.0, bd);
      b -= 18 * smoothstep(0.82, 1.0, bd);
    }

    // ---- rising steam above the stack: faint, narrow, wavy ----
    if (y < 450 && y > 120) {
      const rise = (450 - y) / 330;
      const topFade = smoothstep(120, 200, y);
      for (let s = 0; s < 3; s++) {
        const sx0 = 420 + s * 92;
        const wob = Math.sin((450 - y) * 0.028 + s * 2.1) * 26 * rise;
        const sd = Math.abs(x - (sx0 + wob));
        const width = 16 + rise * 22;
        if (sd < width) {
          const a = (1 - sd / width) * 0.05 * rise * topFade * (0.7 + 0.3 * Math.sin(y * 0.05 + s));
          r += (235 - r) * a;
          g += (228 - g) * a;
          b += (218 - b) * a;
        }
      }
    }

    // ---- vignette ----
    const vx = (x - CX) / 720;
    const vy = (y - 512) / 720;
    const vd = Math.sqrt(vx * vx + vy * vy);
    const vig = 1 - 0.30 * smoothstep(0.55, 1.0, vd);
    const idx = (y * W + x) * 3;
    img[idx] = clamp(Math.round(r * vig), 0, 255);
    img[idx + 1] = clamp(Math.round(g * vig), 0, 255);
    img[idx + 2] = clamp(Math.round(b * vig), 0, 255);
  }
}

// ---------- PNG encoder (filter 0, zlib deflate) ----------
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(img.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const png = encodePNG();
fs.mkdirSync("/output", { recursive: true });
fs.writeFileSync(OUT, png);
console.log(`wrote ${OUT}: ${png.length} bytes, ${W}x${H}`);
