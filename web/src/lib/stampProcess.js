// web/src/lib/stampProcess.js — kâğıt temizliği + mürekkep kontrastı (mobil ile aynı mantık).
export async function stampMakeTransparentSafe(dataUri) {
  if (!dataUri || typeof dataUri !== 'string') return dataUri;
  try {
    const img = await loadImage(dataUri);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
    const chroma = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
    const dist2 = (r, g, b, pr, pg, pb) => {
      const dr = r - pr; const dg = g - pg; const db = b - pb;
      return dr * dr + dg * dg + db * db;
    };
    const clamp8 = (n) => Math.max(0, Math.min(255, Math.round(n)));
    const isInk = (r, g, b, paperL) => {
      const L = luma(r, g, b); const C = chroma(r, g, b);
      const delta = paperL - L;
      if (delta >= 18) return true;
      if (C >= 28 && delta >= 8) return true;
      if (C >= 40 && L < 220) return true;
      if (L < 168) return true;
      return false;
    };
    const isPaperish = (r, g, b, paper, paperL, soft) => {
      if (isInk(r, g, b, paperL)) return false;
      const L = luma(r, g, b); const C = chroma(r, g, b);
      const delta = paperL - L;
      if (delta >= 14) return false;
      if (L > 240 && C < 36) return true;
      return dist2(r, g, b, paper.r, paper.g, paper.b) <= soft && C < 50;
    };
    const enhanceInk = (r, g, b, paper) => {
      const gain = 1.12;
      return {
        r: clamp8(paper.r + (r - paper.r) * gain),
        g: clamp8(paper.g + (g - paper.g) * gain),
        b: clamp8(paper.b + (b - paper.b) * gain),
      };
    };

    const band = Math.max(2, Math.min(14, Math.floor(Math.min(width, height) * 0.07)));
    const rs = []; const gs = []; const bs = [];
    const push = (x, y) => {
      const o = (y * width + x) * 4;
      const r = data[o]; const g = data[o + 1]; const b = data[o + 2];
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
    const mid = (arr) => {
      if (!arr.length) return 248;
      const a = arr.slice().sort((u, v) => u - v);
      return a[Math.floor(a.length / 2)];
    };
    const paper = { r: mid(rs), g: mid(gs), b: mid(bs) };
    const paperL = luma(paper.r, paper.g, paper.b);
    const soft = 72 * 72;
    const n = width * height;
    const mask = new Uint8Array(n);
    const queue = new Int32Array(n);
    let qh = 0; let qt = 0;
    const trySeed = (x, y) => {
      const i = y * width + x;
      if (mask[i]) return;
      const o = i * 4;
      if (!isPaperish(data[o], data[o + 1], data[o + 2], paper, paperL, soft)) return;
      mask[i] = 1; queue[qt++] = i;
    };
    for (let x = 0; x < width; x++) { trySeed(x, 0); trySeed(x, height - 1); }
    for (let y = 0; y < height; y++) { trySeed(0, y); trySeed(width - 1, y); }
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
        mask[j] = 1; queue[qt++] = j;
      }
    }

    const isStainLike = (r, g, b) => {
      const L = luma(r, g, b); const C = chroma(r, g, b);
      const delta = paperL - L;
      if (C >= 36) return false;
      if (delta < 16) return false;
      if (L < 48) return false;
      return C < 34 && L < paperL - 16;
    };
    const stain = new Uint8Array(n);
    const sq = new Int32Array(n);
    let sh = 0; let st = 0;
    const seedStain = (x, y) => {
      const i = y * width + x;
      if (stain[i]) return;
      const o = i * 4;
      if (!isStainLike(data[o], data[o + 1], data[o + 2])) return;
      stain[i] = 1; sq[st++] = i;
    };
    for (let x = 0; x < width; x++) { seedStain(x, 0); seedStain(x, height - 1); }
    for (let y = 0; y < height; y++) { seedStain(0, y); seedStain(width - 1, y); }
    while (sh < st) {
      const i = sq[sh++];
      const x = i % width;
      const y = (i / width) | 0;
      const neigh = [];
      if (x > 0) neigh.push(i - 1);
      if (x + 1 < width) neigh.push(i + 1);
      if (y > 0) neigh.push(i - width);
      if (y + 1 < height) neigh.push(i + width);
      for (let k = 0; k < neigh.length; k++) {
        const j = neigh[k];
        if (stain[j]) continue;
        const o = j * 4;
        if (!isStainLike(data[o], data[o + 1], data[o + 2])) continue;
        stain[j] = 1; sq[st++] = j;
      }
    }
    const minStain = Math.max(80, Math.floor(n * 0.004));
    const useStain = st >= minStain;

    const hard = 36 * 36;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const r = data[o]; const g = data[o + 1]; const b = data[o + 2];
      const L = luma(r, g, b); const C = chroma(r, g, b);
      const delta = paperL - L;
      const d = dist2(r, g, b, paper.r, paper.g, paper.b);
      const flooded = mask[i] === 1;
      const ink = isInk(r, g, b, paperL);
      let alpha;
      if (useStain && stain[i]) alpha = 0;
      else if (ink) alpha = 255;
      else if (flooded || (d <= hard && delta < 12) || (L > 244 && C < 28)) alpha = 0;
      else if (!flooded && delta < 10 && C < 40 && d <= 64 * 64) alpha = clamp8(255 * (delta / 10));
      else alpha = 255;

      if (alpha < 20) {
        data[o] = 255; data[o + 1] = 255; data[o + 2] = 255; data[o + 3] = 0;
      } else {
        const e = enhanceInk(r, g, b, paper);
        data[o] = e.r; data[o + 1] = e.g; data[o + 2] = e.b; data[o + 3] = alpha;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('stamp transparent:', e?.message);
    return dataUri;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
