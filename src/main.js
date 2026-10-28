// User interface: builds the controls, keeps the settings in the URL, renders
// the sound on every change and updates the plots and playback.

import { FS } from './dsp/config.js';
import { PHONES, PHONE_GROUPS, phoneByIpa, canGlide } from './dsp/phones.js';
import { render, usesSample, analysePitch, analyseEnvelope, REFERENCE_TRACT_LENGTH } from './dsp/render.js';
import { fromUrl, toQuery } from './state.js';
import { Player, decodeToMono } from './audio.js';
import { WaveformPlot, SpectrogramPlot, SpectrumPlot, frameSpectrum } from './plots.js';

const SAMPLES = {
  speech: { label: 'Example sentence', url: 'sounds/speech.wav' },
};

const params = new URLSearchParams(location.search);
const page = { embed: params.get('embed') ?? '', hide: params.get('hide') ?? '' };
const state = fromUrl();
const player = new Player();
player.volume = state.vol;

let result = null;
let cursorT = null;
const curvesShown = { source: true, tract: true, output: true, original: false };

// ---------------------------------------------------------------------------
// Small control builders. Each returns { el, sync() } and may have `show`.

const controls = [];

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c != null) e.append(c);
  return e;
}

function register(ctrl, show) {
  ctrl.show = show;
  controls.push(ctrl);
  return ctrl.el;
}

function set(key, value) {
  state[key] = value;
  changed();
}

function radio(key, options, { label, show } = {}) {
  const name = `r-${key}`;
  const buttons = options.map(([value, text, title]) => {
    const input = el('input', { type: 'radio', name, value, onchange: () => set(key, value) });
    return { value, input, label: el('label', { class: 'seg', title }, input, el('span', {}, text)) };
  });
  const group = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label ?? key },
    ...buttons.map((b) => b.label));
  const wrap = el('div', { class: 'row' }, label ? el('span', { class: 'row-label' }, label) : null, group);
  return register({
    el: wrap,
    sync() {
      for (const b of buttons) b.input.checked = state[key] === b.value;
    },
    buttons,
  }, show);
}

function slider(key, label, min, max, step, { unit = '', format, show, hint } = {}) {
  const input = el('input', { type: 'range', min, max, step, 'aria-label': label });
  const out = el('output');
  input.addEventListener('input', () => set(key, Number(input.value)));
  const show2 = (v) => (format ? format(v) : `${v}${unit ? ` ${unit}` : ''}`);
  const labelEl = el('span', { class: 'row-label' }, typeof label === 'function' ? '' : label);
  const hintEl = hint ? el('span', { class: 'row-hint' }) : null;
  const wrap = el('label', { class: 'row slider' }, labelEl, input, out, hintEl);
  return register({
    el: wrap,
    sync() {
      input.value = state[key];
      out.textContent = show2(state[key]);
      if (typeof label === 'function') labelEl.textContent = label(state);
      if (hintEl) hintEl.textContent = hint(state);
    },
  }, show);
}

function checkbox(key, label, { show, title } = {}) {
  const input = el('input', { type: 'checkbox', onchange: () => set(key, input.checked) });
  const wrap = el('label', { class: 'row check', title }, input, el('span', {}, label));
  return register({ el: wrap, sync() { input.checked = state[key]; } }, show);
}

function select(key, label, options, { show } = {}) {
  const sel = el('select', { 'aria-label': label, onchange: () => set(key, sel.value) });
  const fill = () => {
    const opts = typeof options === 'function' ? options(state) : options;
    const sig = opts.map((o) => o[0]).join('|');
    if (sel.dataset.sig !== sig) {
      sel.replaceChildren(...opts.map(([v, t]) => el('option', { value: v }, t)));
      sel.dataset.sig = sig;
    }
  };
  const wrap = el('label', { class: 'row' }, el('span', { class: 'row-label' }, label), sel);
  return register({ el: wrap, sync() { fill(); sel.value = state[key]; } }, show);
}

function text(content, { show, cls = 'note' } = {}) {
  const p = el('p', { class: cls });
  return register({ el: p, sync() { p.textContent = typeof content === 'function' ? content(state) : content; } }, show);
}

function card(id, title, intro, ...children) {
  return el('section', { class: 'card', id: `card-${id}` },
    el('h2', {}, title), intro ? el('p', { class: 'card-intro' }, intro) : null, ...children);
}

// ---------------------------------------------------------------------------
// The controls

const notResidual = (s) => s.src !== 'residual';
const synthTract = (s) => s.vt === 'synth';

function phoneGrid() {
  const buttons = [];
  const groups = PHONE_GROUPS.map(([group, title]) => el('div', { class: 'phone-group' },
    el('span', { class: 'phone-group-title' }, title),
    el('div', { class: 'phones' }, ...PHONES.filter((p) => p.group === group).map((p) => {
      const b = el('button', {
        type: 'button', class: 'phone', title: `/${p.ipa}/ as in “${p.example}”`, lang: 'und-fonipa',
        onclick: () => choosePhone(p.ipa),
      }, p.ipa);
      buttons.push([p.ipa, b]);
      return b;
    }))));
  const wrap = el('div', { class: 'phone-grid' }, ...groups);
  return register({
    el: wrap,
    sync() {
      for (const [ipa, b] of buttons) b.setAttribute('aria-pressed', String(state.phone === ipa));
    },
  }, synthTract);
}

function choosePhone(ipa) {
  const p = phoneByIpa(ipa);
  state.phone = ipa;
  ['f1', 'f2', 'f3', 'f4'].forEach((k, i) => { state[k] = p.poles[i]?.[0] ?? 0; });
  state.mix = p.noise;
  state.vt = 'synth';
  if (!canGlide(p)) state.glide = '';
  changed();
}

const formantRanges = [[150, 1200], [400, 3200], [1000, 4200], [2000, 6000]];
const formantSliders = formantRanges.map(([lo, hi], i) => {
  const key = `f${i + 1}`;
  return slider(key, () => (phoneByIpa(state.phone).group === 'vowel' || phoneByIpa(state.phone).group === 'approximant'
    ? `F${i + 1}` : `Peak ${i + 1}`), lo, hi, 10, {
    unit: 'Hz',
    show: (s) => synthTract(s) && phoneByIpa(s.phone).poles.length > i,
  });
});

function sampleControls() {
  const file = el('input', { type: 'file', accept: 'audio/*', hidden: true,
    onchange: async () => {
      if (file.files[0]) await setUserSample(await file.files[0].arrayBuffer(), file.files[0].name);
      file.value = '';
    } });
  const upload = el('button', { type: 'button', onclick: () => file.click() }, 'Open file…');
  const rec = el('button', { type: 'button', onclick: () => toggleRecording(rec) }, 'Record');
  const wrap = el('div', { class: 'row buttons' }, upload, rec, file);
  return register({ el: wrap, sync() {} }, null);
}

const sampleOptions = () => [
  ...Object.entries(SAMPLES).map(([k, v]) => [k, v.label]),
  ...(userSample ? [['user', userSample.label]] : []),
];

function buildControls() {
  const root = document.getElementById('controls');
  root.append(
    card('source', 'Source', 'The excitation: vocal fold vibration (voiced), turbulent noise (unvoiced), or a mix.',
      radio('src', [
        ['synth', 'Synthetic'],
        ['follow', 'Pitch from sample', 'A synthetic source that follows the pitch, voicing and loudness of the speech sample'],
        ['residual', 'Residual from sample', 'The excitation estimated from the speech sample by removing its spectral envelope'],
      ]),
      radio('model', [
        ['impulse', 'Impulse train', 'Idealised excitation with a flat spectrum'],
        ['rosenberg', 'Rosenberg', 'Rosenberg (1971) glottal pulse'],
        ['lf', 'LF', 'Liljencrants–Fant glottal pulse model'],
      ], { label: 'Glottal pulse', show: notResidual }),
      slider('f0', 'F0', 50, 400, 1, { unit: 'Hz', show: (s) => s.src === 'synth' }),
      slider('f0scale', 'Pitch shift', 0.5, 2, 0.01, {
        format: (v) => `×${v.toFixed(2)}`, show: (s) => s.src === 'follow' }),
      slider('oq', 'Open quotient', 0.3, 0.9, 0.01, {
        format: (v) => v.toFixed(2), show: (s) => notResidual(s) && s.model === 'rosenberg' }),
      slider('rd', 'Rd (tense–lax)', 0.3, 2.7, 0.01, {
        format: (v) => v.toFixed(2), show: (s) => notResidual(s) && s.model === 'lf' }),
      slider('jitter', 'Jitter', 0, 5, 0.1, { unit: '%', show: notResidual }),
      slider('shimmer', 'Shimmer', 0, 20, 0.5, { unit: '%', show: notResidual }),
      slider('mix', (s) => (s.src === 'follow' ? 'Noise when voiced' : 'Voiced – noise'), 0, 1, 0.01, {
        format: (v) => `${Math.round((1 - v) * 100)} : ${Math.round(v * 100)}`, show: notResidual }),
      radio('noise', [
        ['white', 'White', 'Steady white noise'],
        ['pulsed', 'Pulsed', 'Noise whose level follows the glottal cycle, as in a breathy voice'],
      ], { label: 'Noise', show: (s) => notResidual(s) && s.mix > 0 }),
      checkbox('flatten', 'Flatten source spectrum', {
        title: 'Remove the spectral tilt of the source, since the estimated envelope already contains it',
        show: (s) => notResidual(s) && s.vt === 'sample' }),
      text((s) => (s.src === 'residual'
        ? 'The residual is what remains of the sample after its spectral envelope is removed.'
        : s.model === 'impulse'
          ? 'An impulse train has a flat spectrum: all harmonics have the same level.'
          : 'The glottal flow derivative is used, since lip radiation acts roughly as a derivative.')),
    ),
    card('tract', 'Vocal tract', 'The filter: resonances (formants) of the vocal tract.',
      radio('vt', [
        ['synth', 'Synthetic phone'],
        ['sample', 'Estimated from sample', 'The spectral envelope of the speech sample, frame by frame'],
      ]),
      phoneGrid(),
      select('glide', 'Glide to', () => [['', 'none'], ...PHONES.filter(canGlide).map((p) => [p.ipa, `/${p.ipa}/  ${p.example}`])], {
        show: (s) => synthTract(s) && canGlide(phoneByIpa(s.phone)) }),
      ...formantSliders,
      slider('vtl', 'Tract length', 10, 22, 0.1, {
        unit: 'cm', show: synthTract,
        hint: (s) => `formants ×${(REFERENCE_TRACT_LENGTH / s.vtl).toFixed(2)}`,
      }),
      text((s) => `/${s.phone}/ as in “${phoneByIpa(s.phone).example}”. Formant values are approximate, for an adult male voice.`,
        { show: synthTract }),
    ),
    card('sample', 'Speech sample', 'Used when the source or the vocal tract is estimated from speech.',
      select('sample', 'Sample', sampleOptions),
      sampleControls(),
      radio('method', [
        ['lpc', 'Linear prediction', 'All-pole model of the envelope (time-domain filtering)'],
        ['mel', 'Mel envelope', 'Mel-band envelope as in the Vocoder section of the book (STFT-domain filtering)'],
      ], { label: 'Envelope' }),
      slider('order', 'Model order', 4, 40, 1, { show: (s) => s.method === 'lpc' }),
      slider('bands', 'Mel bands', 10, 60, 1, { show: (s) => s.method === 'mel' }),
      text(() => sampleStatus, { cls: 'note status' }),
    ),
  );

  const tr = document.getElementById('transport');
  const playBtn = el('button', { type: 'button', class: 'play', onclick: togglePlay }, 'Play');
  tr.append(
    playBtn,
    checkbox('loop', 'Continuous', { title: 'Loop the sound; changes are heard while it plays' }),
    slider('fade', 'Fade', 0, 200, 1, { unit: 'ms' }),
    slider('dur', 'Length', 0.2, 3, 0.1, { unit: 's', show: (s) => !usesSample(s) }),
    radio('listen', [['output', 'Output'], ['source', 'Source'], ['original', 'Sample']], { label: 'Listen to' }),
    slider('vol', 'Volume', 0, 1, 0.01, { format: (v) => `${Math.round(v * 100)} %` }),
    el('button', { type: 'button', class: 'link', onclick: copyLink }, 'Copy link'),
  );
  document.getElementById('spec-option').append(radio('specwin', [
    ['narrow', 'Narrow-band', '40 ms window: shows the harmonics'],
    ['wide', 'Wide-band', '5 ms window: shows the formants and individual glottal pulses'],
  ]));
  controls.push({ el: playBtn, sync() { playBtn.textContent = player.playing ? 'Stop' : 'Play'; playBtn.classList.toggle('active', player.playing); } });

  for (const id of page.hide.split(',').filter(Boolean)) {
    document.getElementById(`card-${id}`)?.setAttribute('hidden', '');
    document.getElementById(`view-${id}`)?.setAttribute('hidden', '');
    if (id === 'transport') tr.hidden = true;
  }
  if (page.embed) document.body.classList.add('embed');
}

function syncControls() {
  for (const c of controls) {
    c.sync();
    if (c.show) c.el.hidden = !c.show(state);
  }
  const listen = controls.find((c) => c.buttons?.some((b) => b.value === 'original'));
  const orig = listen.buttons.find((b) => b.value === 'original');
  orig.input.disabled = !usesSample(state);
  document.getElementById('card-sample').classList.toggle('inactive', !usesSample(state));
}

// ---------------------------------------------------------------------------
// Speech samples

let userSample = null; // { label, x }
const loaded = {}; // key -> Float64Array
let sample = null; // { key, x, pitch, envKey, envelope }
let sampleStatus = '';

async function loadSampleSignal(key) {
  if (key === 'user' && userSample) return userSample.x;
  const k = SAMPLES[key] ? key : 'speech';
  if (!loaded[k]) {
    sampleStatus = 'Loading sample…';
    const res = await fetch(SAMPLES[k].url);
    if (!res.ok) throw new Error(`Could not load ${SAMPLES[k].url}`);
    loaded[k] = await decodeToMono(await res.arrayBuffer());
  }
  return loaded[k];
}

// Returns the analysed sample for the current settings, or null if it is
// still loading (a render is triggered once it is ready).
let loading = null;
function currentSample() {
  if (!usesSample(state)) return null;
  const key = state.sample;
  if (!sample || sample.key !== key) {
    if (!loading) {
      loading = loadSampleSignal(key).then((x) => {
        sample = { key, x, pitch: null, envKey: '', envelope: null };
        sampleStatus = `${(x.length / FS).toFixed(1)} s of speech`;
      }).catch((e) => {
        sampleStatus = `${e.message}. Open the page through a web server (see README).`;
      }).finally(() => {
        loading = null;
        changed(false);
      });
    }
    return null;
  }
  const envKey = `${state.method}:${state.method === 'lpc' ? state.order : state.bands}`;
  if (sample.envKey !== envKey) {
    sample.envelope = analyseEnvelope(sample.x, state);
    sample.envKey = envKey;
  }
  if (state.src === 'follow' && !sample.pitch) sample.pitch = analysePitch(sample.x);
  return sample;
}

async function setUserSample(arrayBuffer, label) {
  try {
    const x = await decodeToMono(arrayBuffer);
    userSample = { label, x };
    sample = null;
    state.sample = 'user';
    if (!usesSample(state)) state.vt = 'sample';
    changed();
  } catch (e) {
    sampleStatus = `Could not read the audio file (${e.message}).`;
    syncControls();
  }
}

let recorder = null;
async function toggleRecording(button) {
  if (recorder) {
    recorder.stop();
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (e) {
    sampleStatus = `No microphone access (${e.message}).`;
    syncControls();
    return;
  }
  const chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (ev) => chunks.push(ev.data);
  recorder.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    clearTimeout(timer);
    recorder = null;
    button.textContent = 'Record';
    button.classList.remove('active');
    const blob = new Blob(chunks, { type: chunks[0]?.type });
    await setUserSample(await blob.arrayBuffer(), 'Your recording');
  };
  recorder.start();
  button.textContent = 'Stop recording';
  button.classList.add('active');
  sampleStatus = 'Recording… (at most 5 s)';
  syncControls();
  const timer = setTimeout(() => recorder?.stop(), 5000);
}

// ---------------------------------------------------------------------------
// Rendering, plots and playback

const plots = {
  wave: new WaveformPlot(document.getElementById('waveform')),
  spec: new SpectrogramPlot(document.getElementById('spectrogram')),
  spectrum: new SpectrumPlot(document.getElementById('spectrum')),
};

const LISTEN_LABELS = { output: 'Output', source: 'Source (excitation)', original: 'Speech sample' };

function listenSignal() {
  if (!result) return null;
  return (state.listen === 'original' && result.original) || (state.listen === 'source' && result.source) || result.output;
}

let rendering = false;
let again = false;
let urlTimer = null;

function changed(updateUrl = true) {
  player.setVolume(state.vol);
  syncControls();
  if (updateUrl) {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => history.replaceState(null, '', `${location.pathname}${toQuery(state, page)}`), 300);
  }
  scheduleRender();
}

function scheduleRender() {
  if (rendering) {
    again = true;
    return;
  }
  rendering = true;
  // Let the browser paint the slider before the (blocking) render.
  setTimeout(() => {
    try {
      doRender();
    } finally {
      rendering = false;
      if (again) {
        again = false;
        scheduleRender();
      }
    }
  }, 0);
}

function doRender() {
  const smp = currentSample();
  if (usesSample(state) && !smp) {
    syncControls();
    return;
  }
  result = render(state, smp);
  const dur = result.len / FS;
  if (cursorT == null || cursorT > dur) cursorT = dur / 2;
  const sig = listenSignal();
  plots.wave.setData(sig, LISTEN_LABELS[state.listen === 'original' && !result.original ? 'output' : state.listen]);
  plots.spec.windowMs = state.specwin === 'wide' ? 5 : 40;
  plots.spec.setData(sig);
  drawSpectrum();
  drawLines();
  if (player.playing) player.update(sig, state.loop);
  syncControls();
}

function drawSpectrum() {
  if (!result) return;
  const n = Math.round(cursorT * FS);
  const cs = getComputedStyle(document.documentElement);
  const c = (v) => cs.getPropertyValue(v).trim();
  const curves = [];
  if (curvesShown.original && result.original) {
    curves.push({ key: 'original', mag: frameSpectrum(result.original, n), colour: c('--c-original'), width: 1 });
  }
  if (curvesShown.source) curves.push({ key: 'source', mag: frameSpectrum(result.source, n), colour: c('--c-source'), width: 1 });
  if (curvesShown.output) curves.push({ key: 'output', mag: frameSpectrum(result.output, n), colour: c('--c-output'), width: 1.25 });
  if (curvesShown.tract) curves.push({ key: 'tract', mag: result.tractAt(n), colour: c('--c-tract'), width: 2.5 });
  plots.spectrum.setCurves(curves, `t = ${cursorT.toFixed(3)} s`);
  buildLegend();
}

function buildLegend() {
  const legend = document.getElementById('legend');
  const items = [
    ['source', 'Source', '--c-source'],
    ['tract', 'Vocal tract', '--c-tract'],
    ['output', 'Output', '--c-output'],
    ...(result?.original ? [['original', 'Sample', '--c-original']] : []),
  ];
  const sig = items.map((i) => i[0]).join();
  if (legend.dataset.sig === sig) return;
  legend.dataset.sig = sig;
  legend.replaceChildren(...items.map(([key, label, colour]) => {
    const input = el('input', { type: 'checkbox', onchange: () => { curvesShown[key] = input.checked; drawSpectrum(); } });
    input.checked = curvesShown[key];
    return el('label', { class: 'legend-item' }, input, el('span', { class: 'swatch', style: `background: var(${colour})` }), label);
  }));
}

function drawLines() {
  const lines = [{ t: cursorT, kind: 'cursor' }, { t: player.position(), kind: 'playhead' }];
  plots.wave.drawOverlay(lines);
  plots.spec.drawOverlay(lines);
}

function animate() {
  drawLines();
  if (player.playing) requestAnimationFrame(animate);
}

function togglePlay() {
  if (player.playing) {
    player.stop();
  } else {
    const sig = listenSignal();
    if (!sig) return;
    player.play(sig, state.loop);
    requestAnimationFrame(animate);
  }
  syncControls();
  drawLines();
}

player.onEnded = () => {
  syncControls();
  drawLines();
};

// Cursor: click or drag on the waveform or spectrogram.
for (const plot of [plots.wave, plots.spec]) {
  const canvas = plot.canvas;
  const move = (ev) => {
    const rect = canvas.getBoundingClientRect();
    cursorT = plot.xToTime(ev.clientX - rect.left);
    drawSpectrum();
    drawLines();
  };
  canvas.addEventListener('pointerdown', (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    move(ev);
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (canvas.hasPointerCapture(ev.pointerId)) move(ev);
  });
}

async function copyLink() {
  const url = `${location.origin}${location.pathname}${toQuery(state, page)}`;
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    flash('Link copied');
  } catch {
    window.prompt('Copy this link:', url);
  }
}

function flash(msg) {
  const t = el('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 1600);
}

document.addEventListener('keydown', (ev) => {
  if (ev.code !== 'Space' || ev.repeat) return;
  const tag = ev.target.tagName;
  if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tag)) return;
  ev.preventDefault();
  togglePlay();
});

// Redraw plots when the colour theme changes.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  for (const p of Object.values(plots)) p.drawBase();
  drawSpectrum();
  drawLines();
});

buildControls();
changed(false);
