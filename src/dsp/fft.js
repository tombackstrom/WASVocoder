// In-place radix-2 complex FFT. Twiddle and bit-reversal tables are cached per size.

const cache = new Map();

function tables(n) {
  let t = cache.get(n);
  if (t) return t;
  if (n < 2 || (n & (n - 1))) throw new Error(`FFT size must be a power of two, got ${n}`);
  const bits = Math.log2(n);
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = -Math.sin((2 * Math.PI * i) / n);
  }
  t = { rev, cos, sin };
  cache.set(n, t);
  return t;
}

export function fft(re, im, inverse = false) {
  const n = re.length;
  const { rev, cos, sin } = tables(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  const sign = inverse ? -1 : 1;
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step];
        const wi = sign * sin[k * step];
        const a = start + k;
        const b = a + half;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

// Power spectrum |X|^2 of a real frame, zero-padded to nfft, bins 0..nfft/2.
export function powerSpectrum(frame, nfft) {
  const re = new Float64Array(nfft);
  const im = new Float64Array(nfft);
  re.set(frame.length > nfft ? frame.subarray(0, nfft) : frame);
  fft(re, im);
  const out = new Float64Array(nfft / 2 + 1);
  for (let k = 0; k <= nfft / 2; k++) out[k] = re[k] * re[k] + im[k] * im[k];
  return out;
}
