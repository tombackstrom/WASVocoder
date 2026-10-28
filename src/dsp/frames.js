// Helpers for the short-time frame grid. Frame m is centred at sample m*hop,
// so frame 0 is centred on the first sample and samples outside the signal
// count as zero.

export function sineWindow(n) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = Math.sin((Math.PI * (i + 0.5)) / n);
  return w;
}

export function hannWindow(n) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / n);
  return w;
}

export function frameCount(len, hop) {
  return Math.floor((len - 1) / hop) + 1;
}

// Windowed frame centred at `centre`, written into `out` (length = win.length).
export function getFrame(x, centre, win, out = new Float64Array(win.length)) {
  const n = win.length;
  const start = centre - Math.floor(n / 2);
  for (let i = 0; i < n; i++) {
    const j = start + i;
    out[i] = j >= 0 && j < x.length ? x[j] * win[i] : 0;
  }
  return out;
}

// Linear interpolation of one value per frame to one value per sample.
export function interpFrames(values, hop, len) {
  const out = new Float64Array(len);
  const last = values.length - 1;
  for (let n = 0; n < len; n++) {
    const u = n / hop;
    const m = Math.min(Math.floor(u), last);
    const frac = u - m;
    out[n] = m >= last ? values[last] : (1 - frac) * values[m] + frac * values[m + 1];
  }
  return out;
}

// Root-mean-square level per frame, using a Hann window of length winLen.
export function frameRms(x, hop, winLen) {
  const win = hannWindow(winLen);
  let wsum = 0;
  for (let i = 0; i < winLen; i++) wsum += win[i] * win[i];
  const M = frameCount(x.length, hop);
  const out = new Float64Array(M);
  const buf = new Float64Array(winLen);
  for (let m = 0; m < M; m++) {
    getFrame(x, m * hop, win, buf);
    let e = 0;
    for (let i = 0; i < winLen; i++) e += buf[i] * buf[i];
    out[m] = Math.sqrt(e / wsum);
  }
  return out;
}

export function rms(x) {
  let e = 0;
  for (let i = 0; i < x.length; i++) e += x[i] * x[i];
  return Math.sqrt(e / Math.max(1, x.length));
}

export function scaleToRms(x, target = 1) {
  const r = rms(x);
  if (r > 0) for (let i = 0; i < x.length; i++) x[i] *= target / r;
  return x;
}

// Small seeded random generator (mulberry32), so a re-render with the same
// settings gives the same noise and crossfades between renders stay smooth.
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare = null;
  const gauss = () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    const u = Math.max(uniform(), 1e-12);
    const v = uniform();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
  return { uniform, gauss };
}
