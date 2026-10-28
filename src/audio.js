// Playback with the Web Audio API. Each new render replaces the playing sound
// with a short crossfade at the same position, so sliders can be moved while
// the sound plays.

import { FS } from './dsp/config.js';

const XFADE = 0.04; // s

export class Player {
  constructor() {
    this.ctx = null;
    this.voice = null; // { src, gain, start, offset, duration, loop }
    this.volume = 0.8;
    this.onEnded = null;
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  get playing() {
    return this.voice !== null;
  }

  // Current position in seconds, or null when stopped.
  position() {
    const v = this.voice;
    if (!v) return null;
    const t = this.ctx.currentTime - v.start + v.offset;
    return v.loop ? t % v.duration : Math.min(t, v.duration);
  }

  #startVoice(samples, loop, offset, fadeIn) {
    const ctx = this.ensure();
    const buffer = ctx.createBuffer(1, samples.length, FS);
    buffer.copyToChannel(samples, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = loop;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    if (fadeIn) {
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + XFADE);
    }
    src.connect(gain).connect(this.master);
    const voice = { src, gain, start: now, offset, duration: buffer.duration, loop };
    src.onended = () => {
      if (this.voice === voice) {
        this.voice = null;
        this.onEnded?.();
      }
    };
    src.start(now, offset);
    this.voice = voice;
  }

  #fadeOut(voice) {
    const now = this.ctx.currentTime;
    voice.src.onended = null;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + XFADE);
    voice.src.stop(now + XFADE + 0.01);
  }

  play(samples, loop) {
    this.stop();
    this.#startVoice(samples, loop, 0, false);
  }

  // Swap in a new sound while playing, keeping the playback position.
  update(samples, loop) {
    const old = this.voice;
    if (!old) return;
    const duration = samples.length / FS;
    let pos = this.position();
    if (loop) pos %= duration;
    if (pos >= duration - XFADE) {
      if (!loop) return; // too close to the end to bother
      pos = 0;
    }
    this.#fadeOut(old);
    this.#startVoice(samples, loop, pos, true);
  }

  stop() {
    if (!this.voice) return;
    this.#fadeOut(this.voice);
    this.voice = null;
  }
}

// Decodes an audio file (ArrayBuffer) to mono at the internal sample rate.
export async function decodeToMono(arrayBuffer, maxSeconds = 10) {
  const ctx = new OfflineAudioContext(1, 1, FS);
  const audio = await ctx.decodeAudioData(arrayBuffer);
  const len = Math.min(audio.length, Math.round(maxSeconds * FS));
  const x = new Float64Array(len);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const d = audio.getChannelData(c);
    for (let i = 0; i < len; i++) x[i] += d[i] / audio.numberOfChannels;
  }
  let mean = 0;
  for (let i = 0; i < len; i++) mean += x[i];
  mean /= Math.max(1, len);
  let peak = 0;
  for (let i = 0; i < len; i++) {
    x[i] -= mean;
    peak = Math.max(peak, Math.abs(x[i]));
  }
  if (peak > 0) for (let i = 0; i < len; i++) x[i] *= 0.9 / peak;
  return x;
}
