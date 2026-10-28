// Short-time Fourier filtering with weighted overlap-add (sine window for both
// analysis and synthesis, as in the book's Vocoder section).

import { fft } from './fft.js';
import { sineWindow, frameCount } from './frames.js';

// For each frame, gainFn(m, power) returns a real gain per bin (0..nfft/2),
// given the frame index and the frame's power spectrum. Returns the filtered
// signal, same length as x.
export function stftFilter(x, { winLen, hop, nfft }, gainFn) {
  const win = sineWindow(winLen);
  const half = Math.floor(winLen / 2);
  const len = x.length;
  const M = frameCount(len, hop);
  const y = new Float64Array(len);
  const wsum = new Float64Array(len);
  const re = new Float64Array(nfft);
  const im = new Float64Array(nfft);
  const power = new Float64Array(nfft / 2 + 1);
  for (let m = 0; m < M; m++) {
    const start = m * hop - half;
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < winLen; i++) {
      const j = start + i;
      if (j >= 0 && j < len) re[i] = x[j] * win[i];
    }
    fft(re, im);
    for (let b = 0; b <= nfft / 2; b++) power[b] = re[b] * re[b] + im[b] * im[b];
    const g = gainFn(m, power);
    for (let b = 0; b <= nfft / 2; b++) {
      re[b] *= g[b];
      im[b] *= g[b];
      if (b > 0 && b < nfft / 2) {
        re[nfft - b] = re[b];
        im[nfft - b] = -im[b];
      }
    }
    fft(re, im, true);
    for (let i = 0; i < winLen; i++) {
      const j = start + i;
      if (j >= 0 && j < len) {
        y[j] += re[i] * win[i];
        wsum[j] += win[i] * win[i];
      }
    }
  }
  for (let n = 0; n < len; n++) if (wsum[n] > 1e-9) y[n] /= wsum[n];
  return y;
}
