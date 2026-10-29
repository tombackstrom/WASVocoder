// DSP tests. Run with:  node --test tests/
// Uses only Node's built-in test runner (no packages needed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FS, HOP, NBINS } from '../src/dsp/config.js';
import { fft } from '../src/dsp/fft.js';
import { lf } from '../src/dsp/glottal.js';
import { analyseLpc, latticeAnalysis, latticeSynthesis } from '../src/dsp/lpc.js';
import { melFilterbank, melEnvelope } from '../src/dsp/mel.js';
import { stftFilter } from '../src/dsp/stft.js';
import { voicedExcitation } from '../src/dsp/source.js';
import { estimatePitch } from '../src/dsp/pitch.js';
import { render, analysePitch, analyseEnvelope } from '../src/dsp/render.js';
import { DEFAULTS, fromUrl, toQuery } from '../src/state.js';

// Minimal 16-bit PCM WAV reader with linear-interpolation resampling to FS.
function readWav(path) {
  const buf = readFileSync(new URL(path, import.meta.url));
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let pos = 12, fs = 0, ch = 1, data = null;
  while (pos < buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = dv.getUint32(pos + 4, true);
    if (id === 'fmt ') { ch = dv.getUint16(pos + 10, true); fs = dv.getUint32(pos + 12, true); }
    if (id === 'data') data = { start: pos + 8, size };
    pos += 8 + size + (size % 2);
  }
  const n = data.size / 2 / ch;
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = dv.getInt16(data.start + 2 * i * ch, true) / 32768;
  const m = Math.floor((n * FS) / fs);
  const y = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    const u = (i * fs) / FS, j = Math.floor(u), f = u - j;
    y[i] = (1 - f) * x[j] + f * (x[Math.min(j + 1, n - 1)]);
  }
  return y;
}

const corr = (a, b) => {
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return ab / Math.sqrt(aa * bb);
};

const speech = readWav('../sounds/speech.wav');
const loadSample = (method) => ({
  x: speech,
  pitch: analysePitch(speech),
  envelope: analyseEnvelope(speech, { method, order: DEFAULTS.order, bands: DEFAULTS.bands }),
});

test('FFT matches a direct DFT', () => {
  const n = 64;
  const x = Array.from({ length: n }, (_, i) => Math.sin(i * 0.3) + 0.1 * i);
  const re = Float64Array.from(x), im = new Float64Array(n);
  fft(re, im);
  for (const k of [0, 1, 5, 31, 32, 63]) {
    let r = 0, s = 0;
    for (let i = 0; i < n; i++) { r += x[i] * Math.cos((2 * Math.PI * k * i) / n); s -= x[i] * Math.sin((2 * Math.PI * k * i) / n); }
    assert.ok(Math.abs(re[k] - r) < 1e-9 && Math.abs(im[k] - s) < 1e-9);
  }
  fft(re, im, true);
  re.forEach((v, i) => assert.ok(Math.abs(v - x[i]) < 1e-9));
});

test('LF flow returns to zero for the whole Rd range', () => {
  for (const rd of [0.3, 1, 2.7]) {
    const { flow } = lf(rd);
    assert.ok(Math.abs(flow[0]) < 1e-3 && Math.abs(flow[flow.length - 1]) < 1e-2);
    assert.ok(Math.min(...flow) > -0.05);
  }
});

test('LPC analysis followed by synthesis gives back the signal', () => {
  const lpc = analyseLpc(speech, { order: 18, hop: HOP, winLen: 480 });
  const y = latticeSynthesis(latticeAnalysis(speech, lpc), lpc);
  let err = 0;
  for (let i = 0; i < y.length; i++) err = Math.max(err, Math.abs(y[i] - speech[i]));
  assert.ok(err < 1e-8, `max error ${err}`);
});

test('mel envelope of a flat spectrum is flat', () => {
  const fb = melFilterbank(NBINS, FS, 40);
  const env = melEnvelope(new Float64Array(NBINS).fill(2), fb);
  env.forEach((v) => assert.ok(Math.abs(v - 2) < 1e-9));
});

test('STFT filtering with unit gain is transparent', () => {
  const ones = new Float64Array(NBINS).fill(1);
  const y = stftFilter(speech, { winLen: 480, hop: HOP, nfft: 1024 }, () => ones);
  let err = 0;
  for (let i = 0; i < y.length; i++) err = Math.max(err, Math.abs(y[i] - speech[i]));
  assert.ok(err < 1e-9, `max error ${err}`);
});

test('pitch estimator finds the F0 of a synthetic vowel', () => {
  const f0 = new Float64Array(FS).fill(150);
  const { signal } = voicedExcitation(f0, { model: 'lf', rd: 1 });
  const s = { ...DEFAULTS, dur: 1 };
  const vowel = render(s).output;
  for (const x of [signal, vowel]) {
    const p = estimatePitch(Float64Array.from(x), { fs: FS, hop: HOP });
    const mid = p.f0.slice(20, -20);
    mid.forEach((v) => assert.ok(Math.abs(v - (x === signal ? 150 : 120)) < 3, `f0 ${v}`));
  }
});

test('all combinations render finite, non-silent signals', () => {
  for (const method of ['lpc', 'mel']) {
    const sample = loadSample(method);
    for (const src of ['synth', 'follow', 'residual']) {
      for (const vt of ['synth', 'sample']) {
        for (const model of ['impulse', 'rosenberg', 'lf']) {
          const s = { ...DEFAULTS, method, src, vt, model, mix: 0.3, noise: 'pulsed', jitter: 1, shimmer: 5 };
          const r = render(s, sample);
          for (const x of [r.output, r.source]) {
            assert.ok(x.every(Number.isFinite), `${method} ${src} ${vt} ${model}`);
            assert.ok(x.some((v) => Math.abs(v) > 0.01));
          }
          assert.equal(r.tractAt(1000).length, NBINS);
        }
      }
    }
  }
});

test('residual through the estimated envelope gives back the sample', () => {
  for (const method of ['lpc', 'mel']) {
    const r = render({ ...DEFAULTS, method, src: 'residual', vt: 'sample', fade: 0 }, loadSample(method));
    const c = corr(r.output, r.original);
    assert.ok(c > 0.99, `${method}: correlation ${c}`);
  }
});

test('phone glides and every phone render', async () => {
  const { PHONES } = await import('../src/dsp/phones.js');
  for (const p of PHONES) {
    const f = ['f1', 'f2', 'f3', 'f4'].map((_, i) => p.poles[i]?.[0] ?? 0);
    const r = render({ ...DEFAULTS, phone: p.ipa, f1: f[0], f2: f[1], f3: f[2], f4: f[3], mix: p.noise, glide: 'i' });
    assert.ok(r.output.every(Number.isFinite), p.ipa);
  }
});

test('settings survive a round trip through the URL', () => {
  const s = { ...DEFAULTS, phone: 'i', f1: 270, f2: 2400, f3: 3010, f4: 3500, src: 'follow', loop: true, rd: 2 };
  const back = fromUrl(toQuery(s));
  assert.deepEqual(back, s);
  assert.equal(toQuery(DEFAULTS), '');
});

test('every language has every text and an example for every phone', async () => {
  const { DICTS } = await import('../src/i18n.js');
  const { PHONES } = await import('../src/dsp/phones.js');
  for (const [code, dict] of Object.entries(DICTS)) {
    for (const key of Object.keys(DICTS.en)) assert.ok(key in dict, `${code} is missing ${key}`);
    if (code !== 'en') for (const p of PHONES) assert.ok(dict.examples[p.ipa], `${code} has no example for /${p.ipa}/`);
  }
});
