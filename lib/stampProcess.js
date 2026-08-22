// lib/stampProcess.js
// Kâğıt arka planını temizle; mürekkep/kaşe okunaklı kalsın (kontrast güçlendirme).
import { decode as decodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs/browser.js';
import { Buffer } from 'buffer';

function parseDataUri(dataUri) {
  const s = String(dataUri || '');
  const m = s.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) throw new Error('bad_image');
  return { mime: m[1].toLowerCase(), b64: m[2] };
}

function toRgba(mime, bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (mime.includes('png')) {
    const png = PNG.sync.read(buf);
    return { width: png.width, height: png.height, data: png.data };
  }
  const raw = decodeJpeg(buf, { useTArray: true });
  return { width: raw.width, height: raw.height, data: raw.data };
}

function luma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function chroma(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function dist2(r, g, b, pr, pg, pb) {
  const dr = r - pr;
  const dg = g - pg;
  const db = b - pb;
  return dr * dr + dg * dg + db * db;
}

function clamp8(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function samplePaperColor(data, width, height) {
  const band = Math.max(2, Math.min(14, Math.floor(Math.min(width, height) * 0.07)));
  const rs = [];
  const gs = [];
  const bs = [];
  const push = (x, y) => {
    const o = (y * width + x) * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    if (luma(r, g, b) < 130) return;
    rs.push(r); gs.push(g); bs.push(b);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < band; x++) push(x, y);
    for (let x = width - band; x < width; x++) push(x, y);
  }
  for (let x = band; x < width - band; x++) {
    for (let y = 0; y < band; y++) push(x, y);
    for (let y = height - band; y < height; y++) push(x, y);
  }
  if (!rs.length) return { r: 248, g: 248, b: 248 };
  const mid = (arr) => {
    const a = arr.slice().sort((u, v) => u - v);
    return a[Math.floor(a.length / 2)];
  };
  return { r: mid(rs), g: mid(gs), b: mid(bs) };
}

/** Kâğıttan belirgin ayrılan piksel = mürekkep / kaşe (soluk mavi imza dahil). */
function isInk(r, g, b, paperL) {
  const L = luma(r, g, b);
  const C = chroma(r, g, b);
  const delta = paperL - L;
  if (delta >= 18) return true;
  if (C >= 28 && delta >= 8) return true;
  if (C >= 40 && L < 220) return true;
  if (L < 168) return true;
  return false;
}

function isPaperish(r, g, b, paper, paperL, soft) {
  if (isInk(r, g, b, paperL)) return false;
  const L = luma(r, g, b);
  const C = chroma(r, g, b);
  const delta = paperL - L;
  if (delta >= 14) return false;
  if (L > 240 && C < 36) return true;
  return dist2(r, g, b, paper.r, paper.g, paper.b) <= soft && C < 50;
}

function floodPaperMask(data, width, height, paper, paperL) {
  // Daha dar eşik: ince harf kenarlarına taşmayı azalt
  const soft = 72 * 72;
  const n = width * height;
  const mask = new Uint8Array(n);
  const queue = new Int32Array(n);
  let qh = 0;
  let qt = 0;

  const trySeed = (x, y) => {
    const i = y * width + x;
    if (mask[i]) return;
    const o = i * 4;
    if (!isPaperish(data[o], data[o + 1], data[o + 2], paper, paperL, soft)) return;
    mask[i] = 1;
    queue[qt++] = i;
  };

  for (let x = 0; x < width; x++) {
    trySeed(x, 0);
    trySeed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    trySeed(0, y);
    trySeed(width - 1, y);
  }

  while (qh < qt) {
    const i = queue[qh++];
    const x = i % width;
    const y = (i / width) | 0;
    const neigh = [];
    if (x > 0) neigh.push(i - 1);
    if (x + 1 < width) neigh.push(i + 1);
    if (y > 0) neigh.push(i - width);
    if (y + 1 < height) neigh.push(i + width);
    for (let k = 0; k < neigh.length; k++) {
      const j = neigh[k];
      if (mask[j]) continue;
      const o = j * 4;
      if (!isPaperish(data[o], data[o + 1], data[o + 2], paper, paperL, soft)) continue;
      mask[j] = 1;
      queue[qt++] = j;
    }
  }
  return mask;
}

/**
 * Kenara yapışık gri/gölge lekeler (parmak, ekran yansıması, vignette).
 * Renkli kaşe ve koyu mürekkep çekirdeğine dokunmaz — mevcut isInk ayarlarından bağımsız.
 */
function isStainLike(r, g, b, paperL) {
  const L = luma(r, g, b);
  const C = chroma(r, g, b);
  const delta = paperL - L;
  if (C >= 36) return false; // kırmızı/mavi kaşe
  if (delta < 16) return false; // kâğıt
  if (L < 48) return false; // siyah imza çekirdeği
  return C < 34 && L < paperL - 16;
}

function floodEdgeStainMask(data, width, height, paperL) {
  const n = width * height;
  const mask = new Uint8Array(n);
  const queue = new Int32Array(n);
  let qh = 0;
  let qt = 0;

  const trySeed = (x, y) => {
    const i = y * width + x;
    if (mask[i]) return;
    const o = i * 4;
    if (!isStainLike(data[o], data[o + 1], data[o + 2], paperL)) return;
    mask[i] = 1;
    queue[qt++] = i;
  };

  for (let x = 0; x < width; x++) {
    trySeed(x, 0);
    trySeed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    trySeed(0, y);
    trySeed(width - 1, y);
  }

  while (qh < qt) {
    const i = queue[qh++];
    const x = i % width;
    const y = (i / width) | 0;
    const neigh = [];
    if (x > 0) neigh.push(i - 1);
    if (x + 1 < width) neigh.push(i + 1);
    if (y > 0) neigh.push(i - width);
    if (y + 1 < height) neigh.push(i + width);
    for (let k = 0; k < neigh.length; k++) {
      const j = neigh[k];
      if (mask[j]) continue;
      const o = j * 4;
      if (!isStainLike(data[o], data[o + 1], data[o + 2], paperL)) continue;
      mask[j] = 1;
      queue[qt++] = j;
    }
  }

  // Çok küçük kenar gürültüsünü yok say (imza ucu sanılabilir)
  const minPx = Math.max(80, Math.floor(n * 0.004));
  if (qt < minPx) return new Uint8Array(n);
  return mask;
}

/** Hafif netleştirme — aşırı koyulaştırma yok (okunaklılık bozulmasın). */
function enhanceInk(r, g, b, paper) {
  const gain = 1.12;
  return {
    r: clamp8(paper.r + (r - paper.r) * gain),
    g: clamp8(paper.g + (g - paper.g) * gain),
    b: clamp8(paper.b + (b - paper.b) * gain),
  };
}

export function stampMakeTransparent(dataUri) {
  if (!dataUri || typeof dataUri !== 'string') return dataUri;

  const { mime, b64 } = parseDataUri(dataUri);
  const bytes = Buffer.from(b64, 'base64');
  const { width, height, data } = toRgba(mime, bytes);
  const paper = samplePaperColor(data, width, height);
  const paperL = luma(paper.r, paper.g, paper.b);
  const mask = floodPaperMask(data, width, height, paper, paperL);
  const stain = floodEdgeStainMask(data, width, height, paperL);
  const out = Buffer.alloc(width * height * 4);
  const hard = 36 * 36;

  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const L = luma(r, g, b);
    const C = chroma(r, g, b);
    const delta = paperL - L;
    const d = dist2(r, g, b, paper.r, paper.g, paper.b);
    const flooded = mask[i] === 1;
    const ink = isInk(r, g, b, paperL);

    let alpha;
    if (stain[i]) {
      // Kenar gölgesi / leke — mürekkep gibi görünen gri lekeleri sil
      alpha = 0;
    } else if (ink) {
      alpha = 255;
    } else if (flooded || (d <= hard && delta < 12) || (L > 244 && C < 28)) {
      alpha = 0;
    } else if (!flooded && delta < 10 && C < 40 && d <= 64 * 64) {
      alpha = clamp8(255 * (delta / 10));
    } else {
      alpha = 255;
    }

    if (alpha < 20) {
      out[o] = 255;
      out[o + 1] = 255;
      out[o + 2] = 255;
      out[o + 3] = 0;
    } else {
      const e = enhanceInk(r, g, b, paper);
      out[o] = e.r;
      out[o + 1] = e.g;
      out[o + 2] = e.b;
      out[o + 3] = alpha;
    }
  }

  const png = new PNG({ width, height });
  png.data = out;
  const encoded = PNG.sync.write(png);
  return `data:image/png;base64,${Buffer.from(encoded).toString('base64')}`;
}

export async function stampMakeTransparentSafe(dataUri) {
  try {
    return stampMakeTransparent(dataUri);
  } catch (e) {
    console.warn('stamp transparent:', e?.message);
    return dataUri;
  }
}
