// Excitation signals: voiced (glottal pulse trains) and unvoiced (noise).
//
// The voiced part is generated at OS times the sample rate and then low-pass
// filtered and decimated. This removes most of the aliasing caused by sharp
// corners in the pulse shapes (e.g. the LF return phase).

import { FS } from './config.js';
import { glottalTables, TABLE_SIZE } from './glottal.js';
import { makeRng, scaleToRms } from './frames.js';

const OS = 4;
const HALF_TAPS = 48;

// Windowed-sinc (Blackman) low-pass for the decimation by OS.
const decimator = (() => {
  const n = 2 * HALF_TAPS + 1;
  const fc = 0.9 * (0.5 / OS);
  const h = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const t = i - HALF_TAPS;
    const sinc = t === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * t) / (Math.PI * t);
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (n - 1));
    h[i] = sinc * w;
    sum += h[i];
  }
  for (let i = 0; i < n; i++) h[i] /= sum;
  return h;
})();

function lookup(table, phase) {
  const u = phase * TABLE_SIZE;
  const i = Math.floor(u);
  const frac = u - i;
  return (1 - frac) * table[i % TABLE_SIZE] + frac * table[(i + 1) % TABLE_SIZE];
}

// Voiced excitation (glottal flow derivative) with unit RMS.
// f0: Float64Array of F0 per output sample (Hz).
// Returns { signal, phase } where phase is the glottal cycle phase (0..1) per
// output sample, used to shape pulsed noise.
export function voicedExcitation(f0, { model, oq, rd, jitter = 0, shimmer = 0, seed = 7 }) {
  const len = f0.length;
  const { deriv } = glottalTables(model, { oq, rd });
  const rng = makeRng(seed);
  const nOs = len * OS + 2 * HALF_TAPS + 1;
  const v = new Float64Array(nOs);
  const phOs = new Float32Array(nOs);
  const fsOs = FS * OS;
  let phase = 0;
  let periodScale = 1;
  let amp = 1;
  for (let i = 0; i < nOs; i++) {
    const n = Math.min(len - 1, Math.max(0, Math.floor((i - HALF_TAPS) / OS)));
    const step = (f0[n] * periodScale) / fsOs;
    phase += step;
    if (phase >= 1) {
      phase -= 1;
      // New glottal cycle: draw this cycle's jitter (period) and shimmer (amplitude).
      periodScale = Math.max(0.5, 1 + jitter * rng.gauss());
      amp = Math.max(0, 1 + shimmer * rng.gauss());
      if (!deriv) {
        // Impulse at the exact crossing time, split over two samples.
        const d = step > 0 ? Math.min(1, phase / step) : 0;
        v[i] += amp * (1 - d);
        if (i > 0) v[i - 1] += amp * d;
      }
    }
    if (deriv) v[i] = amp * lookup(deriv, phase);
    phOs[i] = phase;
  }
  const signal = new Float64Array(len);
  const ph = new Float32Array(len);
  const h = decimator;
  for (let n = 0; n < len; n++) {
    const c = n * OS + 2 * HALF_TAPS;
    let s = 0;
    for (let j = 0; j < h.length; j++) s += h[j] * v[c - j];
    signal[n] = s;
    ph[n] = phOs[c - HALF_TAPS];
  }
  // Remove DC: the flow derivative has zero mean only over whole cycles.
  let mean = 0;
  for (let n = 0; n < len; n++) mean += signal[n];
  mean /= Math.max(1, len);
  for (let n = 0; n < len; n++) signal[n] -= mean;
  return { signal: scaleToRms(signal), phase: ph };
}

// Unvoiced excitation with unit RMS. 'white' is Gaussian white noise; 'pulsed'
// is noise whose level follows the glottal flow, as in aspiration noise of a
// breathy voice.
export function noiseExcitation(len, { type = 'white', phase = null, model = 'rosenberg', oq, rd, seed = 11 }) {
  const rng = makeRng(seed);
  const out = new Float64Array(len);
  for (let n = 0; n < len; n++) out[n] = rng.gauss();
  if (type === 'pulsed' && phase) {
    const { flow } = glottalTables(model, { oq, rd });
    for (let n = 0; n < len; n++) out[n] *= 0.2 + 0.8 * lookup(flow, phase[n]);
  }
  return scaleToRms(out);
}
