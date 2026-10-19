// Seeded PRNG (sfc32) with a serializable state, so a saved run resumes exactly.

function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

export class Rng {
  constructor(seedOrState) {
    this.s = Array.isArray(seedOrState) ? seedOrState.slice() : cyrb128(String(seedOrState));
    for (let i = 0; i < 12; i++) this.next();
  }

  static fromState(state) {
    const r = Object.create(Rng.prototype);
    r.s = state.slice();
    return r;
  }

  state() {
    return this.s.slice();
  }

  next() {
    let a = this.s[0], b = this.s[1], c = this.s[2], d = this.s[3];
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    this.s[0] = a; this.s[1] = b; this.s[2] = c; this.s[3] = d;
    return (t >>> 0) / 4294967296;
  }

  int(lo, hi) {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  chance(p) {
    return this.next() < p;
  }

  pick(arr) {
    return arr.length ? arr[Math.floor(this.next() * arr.length)] : undefined;
  }

  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // items: array, weightFn: item -> weight >= 0
  weighted(items, weightFn) {
    let total = 0;
    const ws = items.map(function (it) { const w = Math.max(0, weightFn(it)); total += w; return w; });
    if (total <= 0) return undefined;
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= ws[i];
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  }

  normal(mean, sd) {
    const u = 1 - this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Whole number in [center - spread, center + spread], peaked at center.
  triangular(center, spread) {
    if (!spread) return center;
    return Math.round(center + (this.next() + this.next() - 1) * spread);
  }

  poisson(lambda) {
    if (lambda <= 0) return 0;
    if (lambda > 30) return Math.max(0, Math.round(this.normal(lambda, Math.sqrt(lambda))));
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= this.next(); } while (p > L);
    return k - 1;
  }
}

export function newSeed() {
  return Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e9).toString(36);
}
