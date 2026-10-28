// Linear prediction: frame-wise analysis and time-varying lattice filters.
//
// Predictor convention: A(z) = 1 + a_1 z^-1 + ... + a_p z^-p, the residual is
// e(n) = A(z) x(n) and the vocal tract model is 1/A(z). Reflection
// coefficients are interpolated sample by sample between frame centres. A
// convex mix of stable reflection coefficients (|k| < 1) stays stable, so the
// synthesis filter cannot blow up, and analysis followed by synthesis with the
// same coefficients gives back the input exactly.

import { hannWindow, frameCount, getFrame } from './frames.js';
import { fft } from './fft.js';

export function autocorr(frame, p) {
  const r = new Float64Array(p + 1);
  const n = frame.length;
  for (let lag = 0; lag <= p; lag++) {
    let s = 0;
    for (let i = lag; i < n; i++) s += frame[i] * frame[i - lag];
    r[lag] = s;
  }
  return r;
}

// Levinson-Durbin recursion. Returns predictor a (a[0] = 1), reflection
// coefficients k (k[i-1] is the i-th coefficient) and the prediction error.
export function levinson(r, p) {
  const a = new Float64Array(p + 1);
  const k = new Float64Array(p);
  a[0] = 1;
  let err = r[0];
  if (!(err > 0)) return { a, k, err: 0 };
  const tmp = new Float64Array(p + 1);
  for (let i = 1; i <= p; i++) {
    let acc = r[i];
    for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
    const ki = -acc / err;
    k[i - 1] = ki;
    tmp.set(a);
    for (let j = 1; j < i; j++) a[j] = tmp[j] + ki * tmp[i - j];
    a[i] = ki;
    err *= 1 - ki * ki;
    if (err <= 0) break;
  }
  return { a, k, err };
}

// Step-up recursion from reflection coefficients to predictor coefficients.
export function k2a(k) {
  const p = k.length;
  const a = new Float64Array(p + 1);
  const tmp = new Float64Array(p + 1);
  a[0] = 1;
  for (let i = 1; i <= p; i++) {
    tmp.set(a);
    for (let j = 1; j < i; j++) a[j] = tmp[j] + k[i - 1] * tmp[i - j];
    a[i] = k[i - 1];
  }
  return a;
}

// Frame-wise LPC analysis. Returns reflection coefficients as a flat array
// (frame m occupies k[m*p .. m*p+p-1]).
export function analyseLpc(x, { order, hop, winLen }) {
  const win = hannWindow(winLen);
  const M = frameCount(x.length, hop);
  const k = new Float64Array(M * order);
  const buf = new Float64Array(winLen);
  for (let m = 0; m < M; m++) {
    getFrame(x, m * hop, win, buf);
    const r = autocorr(buf, order);
    // White-noise correction (-40 dB) keeps the recursion well conditioned.
    r[0] = r[0] * 1.0001 + 1e-12;
    k.set(levinson(r, order).k, m * order);
  }
  return { k, order, hop, frames: M };
}

// Reflection coefficients at sample n, linearly interpolated between frames.
function kAt(lpc, n, out) {
  const { k, order: p, hop, frames } = lpc;
  const u = n / hop;
  const m = Math.min(Math.floor(u), frames - 1);
  const frac = m >= frames - 1 ? 0 : u - m;
  const o0 = m * p;
  const o1 = Math.min(m + 1, frames - 1) * p;
  for (let i = 0; i < p; i++) out[i] = (1 - frac) * k[o0 + i] + frac * k[o1 + i];
  return out;
}

export function kAtTime(lpc, n) {
  return kAt(lpc, n, new Float64Array(lpc.order));
}

// Inverse filtering e = A(z) x with a time-varying lattice.
export function latticeAnalysis(x, lpc) {
  const p = lpc.order;
  const kk = new Float64Array(p);
  const bPrev = new Float64Array(p + 1); // b_i(n-1)
  const bCur = new Float64Array(p + 1);
  const e = new Float64Array(x.length);
  for (let n = 0; n < x.length; n++) {
    kAt(lpc, n, kk);
    let f = x[n];
    bCur[0] = f;
    for (let i = 1; i <= p; i++) {
      const fi = f + kk[i - 1] * bPrev[i - 1];
      bCur[i] = bPrev[i - 1] + kk[i - 1] * f;
      f = fi;
    }
    e[n] = f;
    bPrev.set(bCur);
  }
  return e;
}

// All-pole synthesis y = e / A(z) with a time-varying lattice.
export function latticeSynthesis(e, lpc) {
  const p = lpc.order;
  const kk = new Float64Array(p);
  const bPrev = new Float64Array(p + 1);
  const bCur = new Float64Array(p + 1);
  const y = new Float64Array(e.length);
  const f = new Float64Array(p + 1);
  for (let n = 0; n < e.length; n++) {
    kAt(lpc, n, kk);
    f[p] = e[n];
    for (let i = p; i >= 1; i--) f[i - 1] = f[i] - kk[i - 1] * bPrev[i - 1];
    bCur[0] = f[0];
    for (let i = 1; i <= p; i++) bCur[i] = bPrev[i - 1] + kk[i - 1] * f[i - 1];
    y[n] = f[0];
    bPrev.set(bCur);
  }
  return y;
}

// Magnitude response |1/A| at nfft/2+1 bins.
export function allPoleResponse(a, nfft) {
  const re = new Float64Array(nfft);
  const im = new Float64Array(nfft);
  re.set(a);
  fft(re, im);
  const out = new Float64Array(nfft / 2 + 1);
  for (let b = 0; b <= nfft / 2; b++) out[b] = 1 / Math.max(1e-9, Math.hypot(re[b], im[b]));
  return out;
}
