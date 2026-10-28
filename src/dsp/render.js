// The full source-filter pipeline: build the excitation, pass it through the
// vocal tract, and return the signals for listening and plotting.
//
// This module has no browser dependencies, so it also runs under Node.js
// (see tests/).

import { FS, HOP, WIN_LEN, NBINS } from './config.js';
import { interpFrames, frameRms, scaleToRms } from './frames.js';
import { voicedExcitation, noiseExcitation } from './source.js';
import { estimateEnvelope, removeEnvelope, applyEnvelope, envelopeResponse } from './envelope.js';
import { estimatePitch } from './pitch.js';
import { phoneByIpa, canGlide } from './phones.js';
import { tractSpec, applyTract, specAtTime, tractResponse } from './tract.js';

export const REFERENCE_TRACT_LENGTH = 17.5; // cm, the length the phone table assumes

export const usesSample = (s) => s.src !== 'synth' || s.vt === 'sample';

// Pitch analysis of a sample. Depends only on the signal, so callers can cache it.
export function analysePitch(x) {
  const { f0, voicing } = estimatePitch(x, { fs: FS, hop: HOP });
  return { f0: interpFrames(f0, HOP, x.length), voicing: interpFrames(voicing, HOP, x.length) };
}

// Envelope analysis of a sample. Depends on the signal and the method settings.
export function analyseEnvelope(x, { method, order, bands }) {
  const env = estimateEnvelope(x, { method, order, bands });
  const residual = removeEnvelope(x, env);
  const gain = interpFrames(frameRms(residual, HOP, WIN_LEN), HOP, x.length);
  return { env, residual, gain };
}

function finish(x, fadeMs) {
  const y = new Float32Array(x.length);
  let peak = 0;
  scaleToRms(x, 0.1);
  for (let n = 0; n < x.length; n++) peak = Math.max(peak, Math.abs(x[n]));
  const g = peak > 0.95 ? 0.95 / peak : 1;
  const nf = Math.min(Math.floor(x.length / 2), Math.round((fadeMs / 1000) * FS));
  for (let n = 0; n < x.length; n++) {
    let w = 1;
    if (n < nf) w = 0.5 - 0.5 * Math.cos((Math.PI * (n + 0.5)) / nf);
    else if (n >= x.length - nf) w = 0.5 - 0.5 * Math.cos((Math.PI * (x.length - n - 0.5)) / nf);
    y[n] = x[n] * g * w;
  }
  return y;
}

function syntheticSource(s, len, sample) {
  const follow = s.src === 'follow';
  const f0 = new Float64Array(len);
  const mix = new Float64Array(len);
  for (let n = 0; n < len; n++) {
    if (follow) {
      f0[n] = Math.min(800, Math.max(30, sample.pitch.f0[n] * s.f0scale));
      // Noise share: full noise in unvoiced parts, `mix` in voiced parts.
      const v = sample.pitch.voicing[n];
      mix[n] = (1 - v) + v * s.mix;
    } else {
      f0[n] = s.f0;
      mix[n] = s.mix;
    }
  }
  const glottis = { model: s.model, oq: s.oq, rd: s.rd };
  const voiced = voicedExcitation(f0, { ...glottis, jitter: s.jitter / 100, shimmer: s.shimmer / 100 });
  const noise = noiseExcitation(len, { type: s.noise, phase: voiced.phase, ...glottis,
    model: s.model === 'impulse' ? 'rosenberg' : s.model });
  let e = new Float64Array(len);
  for (let n = 0; n < len; n++) e[n] = Math.sqrt(1 - mix[n]) * voiced.signal[n] + Math.sqrt(mix[n]) * noise[n];
  if (s.vt === 'sample' && s.flatten) {
    // Flatten the source spectrum with the same method used for the sample,
    // so the sample's envelope is not applied on top of the glottal tilt.
    e = scaleToRms(removeEnvelope(e, estimateEnvelope(e, s)));
  }
  if (sample) for (let n = 0; n < len; n++) e[n] *= sample.envelope.gain[n];
  return e;
}

// s: settings object (see src/state.js). sample: { x, pitch, envelope } or
// null when no sample is used. Returns the output, the excitation, the
// original sample (if any) and a function giving the vocal tract magnitude
// response at a sample index.
export function render(s, sample = null) {
  const withSample = usesSample(s);
  if (withSample && !sample) throw new Error('These settings need a speech sample');
  const len = withSample ? sample.x.length : Math.max(1, Math.round(s.dur * FS));

  const source = s.src === 'residual'
    ? Float64Array.from(sample.envelope.residual)
    : syntheticSource(s, len, withSample ? sample : null);

  let output;
  let tractAt;
  if (s.vt === 'sample') {
    output = applyEnvelope(source, sample.envelope.env);
    tractAt = (n) => envelopeResponse(sample.envelope.env, n);
  } else {
    const phone = phoneByIpa(s.phone);
    const scale = REFERENCE_TRACT_LENGTH / s.vtl;
    const spec = tractSpec(phone, { freqs: [s.f1, s.f2, s.f3, s.f4], scale });
    const target = s.glide && canGlide(phone) && canGlide(phoneByIpa(s.glide))
      ? tractSpec(phoneByIpa(s.glide), { scale })
      : null;
    output = applyTract(source, spec, target);
    tractAt = (n) => tractResponse(specAtTime(spec, target, n / len), NBINS);
  }

  return {
    len,
    output: finish(output, s.fade),
    source: finish(Float64Array.from(source), s.fade),
    original: withSample ? finish(Float64Array.from(sample.x), s.fade) : null,
    tractAt,
  };
}
