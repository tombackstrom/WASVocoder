// Canvas plots: waveform, spectrogram and a single-frame spectrum. The
// waveform and spectrogram share the same margins, so their time axes line
// up. Each plot draws its slow part once into an off-screen canvas, and
// redraws only the cursor and playhead lines on top while sound plays.

import { FS } from './dsp/config.js';
import { fft } from './dsp/fft.js';
import { hannWindow } from './dsp/frames.js';

export const MARGIN = { left: 46, right: 10, top: 8, bottom: 22 };

function colours() {
  const cs = getComputedStyle(document.documentElement);
  const get = (n) => cs.getPropertyValue(n).trim();
  return {
    bg: get('--plot-bg'), grid: get('--plot-grid'), text: get('--muted'),
    wave: get('--wave'), source: get('--c-source'), tract: get('--c-tract'),
    output: get('--c-output'), original: get('--c-original'),
    cursor: get('--cursor'), playhead: get('--playhead'),
  };
}

// Viridis-like colour map, from a few anchor colours.
const LUT = (() => {
  const anchors = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const u = (i / 255) * (anchors.length - 1);
    const j = Math.min(anchors.length - 2, Math.floor(u));
    const f = u - j;
    for (let c = 0; c < 3; c++) lut[3 * i + c] = (1 - f) * anchors[j][c] + f * anchors[j + 1][c];
  }
  return lut;
})();

function niceStep(range, target) {
  const raw = range / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

function fmt(v, step) {
  const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  return v.toFixed(d);
}

class Plot {
  constructor(canvas) {
    this.canvas = canvas;
    this.base = document.createElement('canvas');
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
  }

  get inner() {
    const { w, h } = this;
    return { x: MARGIN.left, y: MARGIN.top, w: w - MARGIN.left - MARGIN.right, h: h - MARGIN.top - MARGIN.bottom };
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.w = Math.max(50, this.canvas.clientWidth);
    this.h = Math.max(50, this.canvas.clientHeight);
    for (const c of [this.canvas, this.base]) {
      c.width = Math.round(this.w * dpr);
      c.height = Math.round(this.h * dpr);
    }
    this.dpr = dpr;
    this.drawBase();
    this.drawOverlay();
  }

  baseCtx() {
    const g = this.base.getContext('2d');
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const col = colours();
    g.fillStyle = col.bg;
    g.fillRect(0, 0, this.w, this.h);
    g.font = '11px system-ui, sans-serif';
    return { g, col };
  }

  drawOverlay(lines = this.lines ?? []) {
    this.lines = lines;
    if (!this.dpr) return;
    const g = this.canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.base, 0, 0);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawLines?.(g, lines);
  }
}

// Shared code for the plots with a time axis. All of them read the visible
// time range from one shared `view` object ({ t0, t1 } in seconds; t1 <= t0
// means the whole signal), so zooming one zooms all and they stay in sync.
class TimePlot extends Plot {
  constructor(canvas, view) {
    super(canvas);
    this.view = view ?? { t0: 0, t1: 0 };
  }

  setData(x, label) {
    this.x = x;
    this.label = label;
    this.drawBase();
    this.drawOverlay();
  }

  // Call when the shared view has changed.
  refresh() {
    this.drawBase();
    this.drawOverlay();
  }

  get duration() {
    return this.x ? this.x.length / FS : 1;
  }

  get range() {
    const d = this.duration;
    const { t0, t1 } = this.view;
    if (!(t1 > t0)) return [0, d];
    return [Math.max(0, t0), Math.min(d, t1)];
  }

  timeToX(t) {
    const r = this.inner;
    const [a, b] = this.range;
    return r.x + ((t - a) / (b - a)) * r.w;
  }

  xToTime(px) {
    const r = this.inner;
    const [a, b] = this.range;
    return Math.min(b, Math.max(a, a + ((px - r.x) / r.w) * (b - a)));
  }

  timeAxis(g, col) {
    const r = this.inner;
    const [a, b] = this.range;
    const step = niceStep(b - a, Math.max(2, r.w / 80));
    g.fillStyle = col.text;
    g.strokeStyle = col.grid;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    for (let i = Math.ceil(a / step - 1e-9); i * step <= b + 1e-9; i++) {
      const t = i * step;
      const px = this.timeToX(t);
      g.beginPath();
      g.moveTo(px, r.y + r.h);
      g.lineTo(px, r.y + r.h + 4);
      g.stroke();
      // Keep the labels at the ends inside the canvas.
      const label = fmt(t, step);
      const half = g.measureText(label).width / 2;
      g.fillText(label, Math.min(px, this.w - half - 2), r.y + r.h + 6);
    }
    g.textAlign = 'right';
    g.fillText('s', r.x - 16, r.y + r.h + 6);
  }

  // lines: [{ t, kind: 'cursor' | 'playhead' }]
  drawLines(g, lines) {
    const col = colours();
    const r = this.inner;
    const [a, b] = this.range;
    for (const { t, kind } of lines) {
      if (t == null || t < a || t > b) continue;
      const px = this.timeToX(t);
      g.strokeStyle = kind === 'playhead' ? col.playhead : col.cursor;
      g.lineWidth = kind === 'playhead' ? 1.5 : 1;
      g.setLineDash(kind === 'cursor' ? [4, 3] : []);
      g.beginPath();
      g.moveTo(px, r.y);
      g.lineTo(px, r.y + r.h);
      g.stroke();
    }
    g.setLineDash([]);
  }
}

export class WaveformPlot extends TimePlot {
  setData(x, label) {
    // Scale by the peak of the whole signal, so zooming keeps the scale.
    this.peak = 1e-9;
    if (x) for (let i = 0; i < x.length; i++) this.peak = Math.max(this.peak, Math.abs(x[i]));
    super.setData(x, label);
  }

  drawBase() {
    if (!this.dpr) return;
    const { g, col } = this.baseCtx();
    const r = this.inner;
    g.strokeStyle = col.grid;
    g.beginPath();
    g.moveTo(r.x, r.y + r.h / 2);
    g.lineTo(r.x + r.w, r.y + r.h / 2);
    g.stroke();
    this.timeAxis(g, col);
    g.fillStyle = col.text;
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillText('0', r.x - 6, r.y + r.h / 2);
    if (!this.x) return;
    const x = this.x;
    const [a, b] = this.range;
    const first = Math.max(0, Math.floor(a * FS));
    const last = Math.min(x.length, Math.ceil(b * FS) + 1);
    const yOf = (v) => r.y + r.h / 2 - (v / this.peak) * (r.h / 2) * 0.95;
    const cols = Math.max(1, Math.floor(r.w));
    const perPixel = (last - first) / cols;
    g.save();
    g.beginPath();
    g.rect(r.x, r.y, r.w, r.h);
    g.clip();
    g.fillStyle = col.wave;
    g.strokeStyle = col.wave;
    g.beginPath();
    if (perPixel > 1.5) {
      // Many samples per pixel: draw the min-max range of each pixel column.
      for (let c = 0; c < cols; c++) {
        const i0 = first + Math.floor(c * perPixel);
        const i1 = Math.max(i0 + 1, first + Math.floor((c + 1) * perPixel));
        let lo = Infinity, hi = -Infinity;
        for (let i = i0; i < i1 && i < x.length; i++) {
          lo = Math.min(lo, x[i]);
          hi = Math.max(hi, x[i]);
        }
        if (hi < lo) continue;
        g.moveTo(r.x + c + 0.5, yOf(hi));
        g.lineTo(r.x + c + 0.5, Math.max(yOf(lo), yOf(hi) + 1));
      }
      g.stroke();
    } else {
      // Zoomed in: a line through the samples, with dots when they are far apart.
      for (let i = first; i < last; i++) {
        const px = this.timeToX(i / FS);
        if (i === first) g.moveTo(px, yOf(x[i]));
        else g.lineTo(px, yOf(x[i]));
      }
      g.lineWidth = 1.25;
      g.stroke();
      if (perPixel < 1 / 6) {
        for (let i = first; i < last; i++) {
          g.beginPath();
          g.arc(this.timeToX(i / FS), yOf(x[i]), 2, 0, 2 * Math.PI);
          g.fill();
        }
      }
    }
    g.restore();
    if (this.label) {
      g.fillStyle = col.text;
      g.textAlign = 'right';
      g.textBaseline = 'top';
      g.fillText(this.label, r.x + r.w - 4, r.y + 2);
    }
  }
}

export class SpectrogramPlot extends TimePlot {
  constructor(canvas, view, { rangeDb = 70, windowMs = 30 } = {}) {
    super(canvas, view);
    this.rangeDb = rangeDb;
    this.windowMs = windowMs;
    this.image = document.createElement('canvas');
  }

  setData(x, label) {
    this.x = x;
    this.top = this.levelTop();
    this.computeImage();
    super.setData(x, label);
  }

  refresh() {
    this.computeImage();
    super.refresh();
  }

  // Short windows (wide-band) show formants, long windows (narrow-band) harmonics.
  get winLen() {
    return Math.round((this.windowMs / 1000) * FS);
  }

  // dB spectrum of the frame centred at sample c, written into db at offset.
  frameDb(c, win, re, im, db, offset) {
    const x = this.x;
    const n = win.length;
    re.fill(0);
    im.fill(0);
    const start = Math.round(c - n / 2);
    for (let i = 0; i < n; i++) {
      const j = start + i;
      if (j >= 0 && j < x.length) re[i] = x[j] * win[i];
    }
    fft(re, im);
    const nb = re.length / 2 + 1;
    let top = -Infinity;
    for (let b = 0; b < nb; b++) {
      const v = 10 * Math.log10(re[b] * re[b] + im[b] * im[b] + 1e-12);
      if (db) db[offset + b] = v;
      top = Math.max(top, v);
    }
    return top;
  }

  // Loudest level in the whole signal, so colours do not change when zooming.
  levelTop() {
    const win = hannWindow(this.winLen);
    const re = new Float64Array(1024);
    const im = new Float64Array(1024);
    const hop = Math.max(1, Math.floor(this.winLen / 4));
    let top = -Infinity;
    for (let c = 0; c < this.x.length; c += hop) top = Math.max(top, this.frameDb(c, win, re, im, null, 0));
    return top;
  }

  computeImage() {
    if (!this.x) return;
    const nfft = 1024;
    const nb = nfft / 2 + 1;
    const [a, b] = this.range;
    const span = Math.max(1, (b - a) * FS);
    const frames = Math.max(1, Math.min(900, Math.round(span)));
    const hop = span / frames;
    const win = hannWindow(this.winLen);
    const db = new Float32Array(frames * nb);
    const re = new Float64Array(nfft);
    const im = new Float64Array(nfft);
    for (let m = 0; m < frames; m++) this.frameDb(a * FS + (m + 0.5) * hop, win, re, im, db, m * nb);
    const top = this.top;
    this.image.width = frames;
    this.image.height = nb;
    const g = this.image.getContext('2d');
    const img = g.createImageData(frames, nb);
    for (let m = 0; m < frames; m++) {
      for (let k = 0; k < nb; k++) {
        const u = Math.min(1, Math.max(0, (db[m * nb + k] - top + this.rangeDb) / this.rangeDb));
        const c = 3 * Math.round(u * 255);
        const p = 4 * ((nb - 1 - k) * frames + m);
        img.data[p] = LUT[c];
        img.data[p + 1] = LUT[c + 1];
        img.data[p + 2] = LUT[c + 2];
        img.data[p + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }

  drawBase() {
    if (!this.dpr) return;
    const { g, col } = this.baseCtx();
    const r = this.inner;
    if (this.x) {
      g.imageSmoothingEnabled = true;
      g.drawImage(this.image, r.x, r.y, r.w, r.h);
    }
    this.timeAxis(g, col);
    g.fillStyle = col.text;
    g.strokeStyle = col.grid;
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    for (let f = 0; f <= FS / 2; f += 2000) {
      const py = r.y + r.h - (f / (FS / 2)) * r.h;
      g.beginPath();
      g.moveTo(r.x - 4, py);
      g.lineTo(r.x, py);
      g.stroke();
      g.fillText(String(f / 1000), r.x - 6, py);
    }
    g.save();
    g.translate(10, r.y + r.h / 2);
    g.rotate(-Math.PI / 2);
    g.textAlign = 'center';
    g.fillText('kHz', 0, 0);
    g.restore();
  }
}

// Magnitude spectra of one frame.
// curves: [{ mag: Float64Array (bins 0..FS/2, linear magnitude), colour, width, dash }]
export class SpectrumPlot extends Plot {
  constructor(canvas, { rangeDb = 80 } = {}) {
    super(canvas);
    this.rangeDb = rangeDb;
    this.curves = [];
  }

  setCurves(curves, label) {
    this.curves = curves;
    this.label = label;
    this.drawBase();
    this.drawOverlay([]);
  }

  drawBase() {
    if (!this.dpr) return;
    const { g, col } = this.baseCtx();
    const r = this.inner;
    const fToX = (f) => r.x + (f / (FS / 2)) * r.w;
    const dbToY = (d) => r.y + (-d / this.rangeDb) * r.h;
    g.strokeStyle = col.grid;
    g.fillStyle = col.text;
    g.lineWidth = 1;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    for (let f = 0; f <= FS / 2; f += 1000) {
      const px = fToX(f);
      g.beginPath();
      g.moveTo(px, r.y);
      g.lineTo(px, r.y + r.h);
      g.stroke();
      g.fillText(String(f / 1000), px, r.y + r.h + 6);
    }
    g.textAlign = 'right';
    g.fillText('kHz', r.x - 12, r.y + r.h + 6);
    g.textBaseline = 'middle';
    for (let d = 0; d >= -this.rangeDb; d -= 20) {
      const py = dbToY(d);
      g.beginPath();
      g.moveTo(r.x, py);
      g.lineTo(r.x + r.w, py);
      g.stroke();
      g.fillText(String(d), r.x - 6, py);
    }
    g.save();
    g.translate(10, r.y + r.h / 2);
    g.rotate(-Math.PI / 2);
    g.textAlign = 'center';
    g.fillText('dB', 0, 0);
    g.restore();

    g.save();
    g.beginPath();
    g.rect(r.x, r.y, r.w, r.h);
    g.clip();
    for (const c of this.curves) {
      const n = c.mag.length;
      let peak = 1e-12;
      for (let i = 0; i < n; i++) peak = Math.max(peak, c.mag[i]);
      g.strokeStyle = c.colour;
      g.lineWidth = c.width ?? 1.5;
      g.setLineDash(c.dash ?? []);
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const d = 20 * Math.log10(c.mag[i] / peak + 1e-12);
        const px = r.x + (i / (n - 1)) * r.w;
        const py = dbToY(Math.max(d, -this.rangeDb - 5));
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
    }
    g.restore();
    g.setLineDash([]);
    if (this.label) {
      g.fillStyle = col.text;
      g.textAlign = 'right';
      g.textBaseline = 'top';
      g.fillText(this.label, r.x + r.w - 4, r.y + 4);
    }
  }
}

// Magnitude spectrum of a frame of x centred at sample n (Hann window).
export function frameSpectrum(x, n, { winLen = Math.round(0.04 * FS), nfft = 2048 } = {}) {
  const win = hannWindow(winLen);
  const re = new Float64Array(nfft);
  const im = new Float64Array(nfft);
  const start = n - Math.floor(winLen / 2);
  for (let i = 0; i < winLen; i++) {
    const j = start + i;
    if (j >= 0 && j < x.length) re[i] = x[j] * win[i];
  }
  fft(re, im);
  const out = new Float64Array(nfft / 2 + 1);
  for (let b = 0; b <= nfft / 2; b++) out[b] = Math.hypot(re[b], im[b]);
  return out;
}
