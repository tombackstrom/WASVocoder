// Simple F0 and voicing estimator based on the normalised autocorrelation of
// a low-passed signal. Good enough for a demo vocoder; not a research tool.

import { frameCount } from './frames.js';

function biquadLowpass(x, fc, fs, q = Math.SQRT1_2) {
  const w = (2 * Math.PI * fc) / fs;
  const alpha = Math.sin(w) / (2 * q);
  const cw = Math.cos(w);
  const a0 = 1 + alpha;
  const b0 = (1 - cw) / 2 / a0, b1 = (1 - cw) / a0, b2 = b0;
  const a1 = (-2 * cw) / a0, a2 = (1 - alpha) / a0;
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let n = 0; n < x.length; n++) {
    const v = b0 * x[n] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[n]; y2 = y1; y1 = v;
    y[n] = v;
  }
  return y;
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// Returns per-frame f0 (Hz) and voicing degree (0..1) on the frame grid
// (frame m centred at sample m*hop). F0 in unvoiced frames is filled in from
// the neighbouring voiced frames.
export function estimatePitch(x, { fs, hop, fmin = 60, fmax = 400, winLen = Math.round(0.04 * fs) }) {
  const lp = biquadLowpass(biquadLowpass(x, 1000, fs), 1000, fs);
  const M = frameCount(x.length, hop);
  const tauMin = Math.floor(fs / fmax);
  const tauMax = Math.ceil(fs / fmin);
  const f0 = new Float64Array(M);
  const voicing = new Float64Array(M);
  const energy = new Float64Array(M);
  const r = new Float64Array(tauMax + 2);
  for (let m = 0; m < M; m++) {
    const start = m * hop - Math.floor(winLen / 2);
    const at = (j) => (j >= 0 && j < lp.length ? lp[j] : 0);
    let e0 = 0;
    for (let i = 0; i < winLen; i++) e0 += at(start + i) ** 2;
    energy[m] = e0;
    // Normalised cross-correlation between the frame and its lagged copy.
    let eTau = 0;
    for (let i = 0; i < winLen; i++) eTau += at(start + i + tauMin - 1) ** 2;
    let best = 0;
    for (let tau = tauMin - 1; tau <= tauMax + 1; tau++) {
      if (tau > tauMin - 1) {
        eTau += at(start + winLen - 1 + tau) ** 2 - at(start - 1 + tau) ** 2;
      }
      let c = 0;
      for (let i = 0; i < winLen; i++) c += at(start + i) * at(start + i + tau);
      r[tau] = e0 > 0 && eTau > 0 ? c / Math.sqrt(e0 * eTau) : 0;
      if (tau >= tauMin && tau <= tauMax) best = Math.max(best, r[tau]);
    }
    // Choose the shortest lag with a peak close to the best one; this avoids
    // picking a multiple of the true period (octave errors).
    let tauBest = 0;
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (r[tau] >= 0.85 * best && r[tau] >= r[tau - 1] && r[tau] >= r[tau + 1]) {
        tauBest = tau;
        break;
      }
    }
    if (tauBest > 0) {
      const a = r[tauBest - 1], b = r[tauBest], c = r[tauBest + 1];
      const den = a - 2 * b + c;
      const shift = den !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den)) : 0;
      f0[m] = fs / (tauBest + shift);
    }
    voicing[m] = Math.min(1, Math.max(0, (best - 0.4) / (0.75 - 0.4)));
  }
  // Silent frames (more than 35 dB below the loudest) are unvoiced.
  const eMax = Math.max(...energy);
  for (let m = 0; m < M; m++) {
    if (energy[m] < eMax * 10 ** -3.5 || f0[m] === 0) voicing[m] = 0;
  }
  const voiced = [];
  for (let m = 0; m < M; m++) if (voicing[m] > 0.5) voiced.push(m);
  // Octave correction: a frame about twice or half the median of nearby
  // voiced frames (within +-80 ms) is moved to the median's octave.
  const reach = Math.round((0.08 * fs) / hop);
  const corrected = Float64Array.from(f0);
  for (const m of voiced) {
    const near = voiced.filter((j) => Math.abs(j - m) <= reach).map((j) => f0[j]);
    const med = median(near);
    const ratio = f0[m] / med;
    if (ratio > 1.7 && ratio < 2.3) corrected[m] = f0[m] / 2;
    else if (ratio > 0.43 && ratio < 0.6) corrected[m] = f0[m] * 2;
  }
  f0.set(corrected);
  // Median-filter F0 over voiced frames, then fill unvoiced gaps.
  const f0s = new Float64Array(M);
  for (let m = 0; m < M; m++) {
    if (voicing[m] > 0.5) {
      const win = [];
      for (let j = m - 2; j <= m + 2; j++) if (j >= 0 && j < M && voicing[j] > 0.5) win.push(f0[j]);
      f0s[m] = median(win);
    }
  }
  const fallback = voiced.length ? median(voiced.map((m) => f0s[m])) : 120;
  let prev = -1;
  for (let m = 0; m <= M; m++) {
    if (m === M || voicing[m] > 0.5) {
      const left = prev >= 0 ? f0s[prev] : (m < M ? f0s[m] : fallback);
      const right = m < M ? f0s[m] : left;
      for (let j = prev + 1; j < m; j++) {
        const w = (j - prev) / (m - prev);
        f0s[j] = (1 - w) * left + w * right;
      }
      prev = m;
    }
  }
  // Light smoothing of the voicing degree.
  const v = new Float64Array(M);
  for (let m = 0; m < M; m++) {
    v[m] = (voicing[Math.max(0, m - 1)] + 2 * voicing[m] + voicing[Math.min(M - 1, m + 1)]) / 4;
  }
  return { f0: f0s, voicing: v };
}
