// Settings, their defaults, and conversion to and from the page URL, so that
// any setting can be shared as a link or embedded in a book page.

import { phoneByIpa } from './dsp/phones.js';

const a = phoneByIpa('a');

export const DEFAULTS = {
  // Source
  src: 'synth', // synth | follow (pitch and voicing from sample) | residual
  model: 'lf', // impulse | rosenberg | lf
  f0: 120,
  f0scale: 1,
  oq: 0.6,
  rd: 1.0,
  jitter: 0, // percent
  shimmer: 0, // percent
  noise: 'white', // white | pulsed
  mix: 0, // share of noise, 0..1
  flatten: true,
  // Vocal tract
  vt: 'synth', // synth | sample
  phone: 'a',
  glide: '',
  f1: a.poles[0][0],
  f2: a.poles[1][0],
  f3: a.poles[2][0],
  f4: a.poles[3][0],
  vtl: 17.5, // cm
  dur: 1.0, // s
  // Speech sample analysis
  sample: 'speech',
  method: 'lpc', // lpc | mel
  order: 18,
  bands: 40,
  // Playback and display
  loop: false,
  fade: 30, // ms
  listen: 'output', // output | source | original
  specwin: 'narrow', // spectrogram: narrow (40 ms, harmonics) | wide (5 ms, formants)
  vol: 0.8,
  z0: 0, // visible time range in seconds; z1 <= z0 shows everything
  z1: 0,
};

// Page-level options that are not synthesis settings.
export const PAGE_OPTIONS = ['embed', 'hide'];

export function fromUrl(search = location.search) {
  const params = new URLSearchParams(search);
  const s = { ...DEFAULTS };
  for (const [key, def] of Object.entries(DEFAULTS)) {
    if (!params.has(key)) continue;
    const raw = params.get(key);
    if (typeof def === 'number') {
      const v = Number(raw);
      if (Number.isFinite(v)) s[key] = v;
    } else if (typeof def === 'boolean') {
      s[key] = raw === '1' || raw === 'true';
    } else {
      s[key] = raw;
    }
  }
  // A phone given without formants takes the phone's own formants.
  if (params.has('phone')) {
    const p = phoneByIpa(s.phone);
    ['f1', 'f2', 'f3', 'f4'].forEach((k, i) => {
      if (!params.has(k)) s[k] = p.poles[i]?.[0] ?? 0;
    });
  }
  return s;
}

export function toQuery(s, page = {}) {
  const params = new URLSearchParams();
  const phone = phoneByIpa(s.phone);
  for (const [key, def] of Object.entries(DEFAULTS)) {
    let v = s[key];
    // Formants equal to the phone's own values are implied by the phone.
    const fi = ['f1', 'f2', 'f3', 'f4'].indexOf(key);
    if (fi >= 0 ? v === (phone.poles[fi]?.[0] ?? 0) : v === def) continue;
    if (typeof v === 'boolean') v = v ? 1 : 0;
    params.set(key, String(v));
  }
  for (const k of PAGE_OPTIONS) if (page[k]) params.set(k, page[k]);
  const q = params.toString();
  return q ? `?${q}` : '';
}
