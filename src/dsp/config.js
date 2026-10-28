// Shared constants for all DSP code. Everything runs at one internal sample
// rate; the browser resamples to the sound card rate on playback.
export const FS = 16000;

// Short-time analysis grid, as in the book's Vocoder section (30 ms / 5 ms).
export const WIN_LEN = Math.round(0.030 * FS);
export const HOP = Math.round(0.005 * FS);
export const NFFT = 1024;
export const NBINS = NFFT / 2 + 1;
