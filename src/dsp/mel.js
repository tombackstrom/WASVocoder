// Mel-spectral envelope, following the Vocoder section of the book
// "Introduction to Speech Processing" (speechprocessingbook.aalto.fi):
// half-overlapping triangular bands on the mel scale, band energies, and
// interpolation back to a smooth power envelope. As in the book, the lowest
// band is flat down to 0 Hz and the highest band is flat up to Nyquist, so the
// triangles sum to one at every frequency. Here each band value is the mean
// power in the band, so a flat spectrum gives a flat envelope at the same level.

export const hz2mel = (f) => 2595 * Math.log10(1 + f / 700);
export const mel2hz = (m) => 700 * (10 ** (m / 2595) - 1);

export function melFilterbank(nBins, fs, bands) {
  const nyq = fs / 2;
  const maxMel = hz2mel(nyq);
  const centres = [];
  for (let k = 0; k < bands; k++) centres.push(mel2hz(((k + 0.5) / bands) * maxMel));
  const W = [];
  const norm = new Float64Array(bands);
  for (let k = 0; k < bands; k++) {
    const w = new Float64Array(nBins);
    for (let b = 0; b < nBins; b++) {
      const f = (b * nyq) / (nBins - 1);
      const up = k > 0 ? (f - centres[k - 1]) / (centres[k] - centres[k - 1]) : 1;
      const down = k < bands - 1 ? (centres[k + 1] - f) / (centres[k + 1] - centres[k]) : 1;
      w[b] = Math.max(0, Math.min(1, up, down));
      norm[k] += w[b];
    }
    W.push(w);
  }
  return { W, norm, centres, bands, nBins };
}

// Smooth power envelope from a power spectrum.
export function melEnvelope(power, fb) {
  const { W, norm, bands, nBins } = fb;
  const env = new Float64Array(nBins);
  for (let k = 0; k < bands; k++) {
    const w = W[k];
    let m = 0;
    for (let b = 0; b < nBins; b++) m += w[b] * power[b];
    m = norm[k] > 0 ? m / norm[k] : 0;
    for (let b = 0; b < nBins; b++) env[b] += w[b] * m;
  }
  return env;
}
