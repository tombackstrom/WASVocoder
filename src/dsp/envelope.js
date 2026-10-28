// Spectral envelope estimation and its two uses: removing an envelope from a
// signal (giving the residual, i.e. the estimated excitation) and applying an
// envelope to an excitation. Two methods are offered:
//   'lpc' - linear prediction, filtering in the time domain (lattice filters)
//   'mel' - mel-spectral envelope, filtering in the STFT domain, as in the
//           book's Vocoder section
// Both envelopes have unit gain, so the signal level stays in the residual.

import { WIN_LEN, HOP, NFFT, NBINS, FS } from './config.js';
import { analyseLpc, latticeAnalysis, latticeSynthesis, kAtTime, k2a, allPoleResponse } from './lpc.js';
import { melFilterbank, melEnvelope } from './mel.js';
import { stftFilter } from './stft.js';
import { sineWindow, frameCount, getFrame } from './frames.js';
import { powerSpectrum } from './fft.js';

const STFT_OPTS = { winLen: WIN_LEN, hop: HOP, nfft: NFFT };
const FLOOR_DB = -50; // mel envelope floor relative to the frame peak

export function estimateEnvelope(x, { method, order = 18, bands = 40 }) {
  if (method === 'lpc') return { method, lpc: analyseLpc(x, { order, hop: HOP, winLen: WIN_LEN }) };
  const fb = melFilterbank(NBINS, FS, bands);
  const win = sineWindow(WIN_LEN);
  const M = frameCount(x.length, HOP);
  const shape = [];
  const buf = new Float64Array(WIN_LEN);
  for (let m = 0; m < M; m++) {
    getFrame(x, m * HOP, win, buf);
    const env = melEnvelope(powerSpectrum(buf, NFFT), fb);
    let peak = 0;
    for (let b = 0; b < NBINS; b++) peak = Math.max(peak, env[b]);
    const floor = peak * 10 ** (FLOOR_DB / 10) + 1e-20;
    const a = new Float64Array(NBINS);
    let mean = 0;
    for (let b = 0; b < NBINS; b++) {
      a[b] = Math.sqrt(env[b] + floor);
      mean += a[b] * a[b];
    }
    mean = Math.sqrt(mean / NBINS);
    for (let b = 0; b < NBINS; b++) a[b] /= mean;
    shape.push(a);
  }
  return { method, shape };
}

const shapeAt = (env, m) => env.shape[Math.min(m, env.shape.length - 1)];

export function removeEnvelope(x, env) {
  if (env.method === 'lpc') return latticeAnalysis(x, env.lpc);
  const inv = new Float64Array(NBINS);
  return stftFilter(x, STFT_OPTS, (m) => {
    const s = shapeAt(env, m);
    for (let b = 0; b < NBINS; b++) inv[b] = 1 / s[b];
    return inv;
  });
}

export function applyEnvelope(e, env) {
  if (env.method === 'lpc') return latticeSynthesis(e, env.lpc);
  return stftFilter(e, STFT_OPTS, (m) => shapeAt(env, m));
}

// Magnitude response of the envelope at sample n, at NBINS frequencies.
export function envelopeResponse(env, n) {
  if (env.method === 'lpc') return allPoleResponse(k2a(kAtTime(env.lpc, n)), NFFT);
  return shapeAt(env, Math.round(n / HOP));
}
