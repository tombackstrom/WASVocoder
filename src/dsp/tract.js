// Synthetic vocal tract: a cascade of second-order resonators (formants) and
// anti-resonators, as in the Klatt (1980) cascade synthesiser. Each section
// has unit gain at 0 Hz.

import { FS } from './config.js';

const MAX_FREQ = 0.45 * FS;
const UPDATE = 32; // samples between coefficient updates in a glide

function resonator(f, b) {
  const T = 1 / FS;
  const C = -Math.exp(-2 * Math.PI * b * T);
  const B = 2 * Math.exp(-Math.PI * b * T) * Math.cos(2 * Math.PI * f * T);
  return { A: 1 - B - C, B, C };
}

// Builds the filter description for a phone. `freqs` (optional) replaces the
// first pole frequencies (F1-F4 sliders). `scale` scales every frequency,
// modelling a shorter or longer vocal tract.
export function tractSpec(phone, { freqs = null, scale = 1 } = {}) {
  const poles = phone.poles.map(([f, b], i) => [
    (freqs && freqs[i] ? freqs[i] : f) * scale,
    b,
  ]);
  const zeros = phone.zeros.map(([f, b]) => [f * scale, b]);
  return { poles, zeros };
}

export function interpSpec(a, b, w) {
  const mix = (x, y) => x.map(([f, bw], i) => [(1 - w) * f + w * y[i][0], (1 - w) * bw + w * y[i][1]]);
  return { poles: mix(a.poles, b.poles), zeros: a.zeros };
}

function sections(spec) {
  const out = [];
  for (const [f, b] of spec.poles) if (f > 0 && f < MAX_FREQ) out.push({ zero: false, ...resonator(f, b) });
  for (const [f, b] of spec.zeros) if (f > 0 && f < MAX_FREQ) out.push({ zero: true, ...resonator(f, b) });
  return out;
}

// Filters x with the tract. If `glideTo` is given, the formants move from
// `spec` to `glideTo` between 25 % and 75 % of the signal.
export function applyTract(x, spec, glideTo = null) {
  const len = x.length;
  const y = new Float64Array(x);
  const specAt = (n) => {
    if (!glideTo) return spec;
    const w = Math.min(1, Math.max(0, (n / len - 0.25) / 0.5));
    return interpSpec(spec, glideTo, w);
  };
  let secs = sections(spec);
  const states = secs.map(() => [0, 0]);
  for (let n = 0; n < len; n++) {
    if (glideTo && n % UPDATE === 0) secs = sections(specAt(n));
    let v = y[n];
    for (let s = 0; s < secs.length; s++) {
      const { A, B, C, zero } = secs[s];
      const st = states[s];
      if (zero) {
        // Anti-resonator: inverse of the resonator (FIR).
        const out = (v - B * st[0] - C * st[1]) / A;
        st[1] = st[0];
        st[0] = v;
        v = out;
      } else {
        const out = A * v + B * st[0] + C * st[1];
        st[1] = st[0];
        st[0] = out;
        v = out;
      }
    }
    y[n] = v;
  }
  return y;
}

export function specAtTime(spec, glideTo, frac) {
  if (!glideTo) return spec;
  const w = Math.min(1, Math.max(0, (frac - 0.25) / 0.5));
  return interpSpec(spec, glideTo, w);
}

// Magnitude response at nBins frequencies from 0 to FS/2.
export function tractResponse(spec, nBins) {
  const secs = sections(spec);
  const out = new Float64Array(nBins);
  for (let b = 0; b < nBins; b++) {
    const w = (Math.PI * b) / (nBins - 1);
    const z1r = Math.cos(w), z1i = -Math.sin(w);
    const z2r = Math.cos(2 * w), z2i = -Math.sin(2 * w);
    let mag = 1;
    for (const { A, B, C, zero } of secs) {
      // Denominator 1 - B z^-1 - C z^-2
      const dr = 1 - B * z1r - C * z2r;
      const di = -B * z1i - C * z2i;
      const h = Math.abs(A) / Math.hypot(dr, di);
      mag *= zero ? 1 / h : h;
    }
    out[b] = mag;
  }
  return out;
}
