# WASVocoder

An interactive demonstration of speech production and vocoders that runs in the browser. Speech is modelled as a **source** (vocal fold vibration, noise, or a mix) passed through a **filter** (the vocal tract). You can build both parts synthetically, or estimate them from a speech sample. Then you can listen to the result and see its waveform, spectrogram and spectrum.

It was made for the speech production and vocoder chapters of [Introduction to Speech Processing](https://speechprocessingbook.aalto.fi/), but it works on its own for teaching and demonstrations.

## Running it

There is no build step and nothing to install: plain HTML, CSS and JavaScript modules. Browsers block module scripts and `fetch()` on `file://` pages, so serve the folder over HTTP:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. The same folder can be deployed as-is with GitHub Pages or any other static host. Microphone recording only works on `localhost` or `https://`.

## What you can do

**Source**
- *Synthetic*: a glottal pulse train with an impulse train, Rosenberg (1971) or Liljencrants–Fant (LF) pulse shape. F0, open quotient (Rosenberg), Rd (LF, tense to lax voice), jitter and shimmer are adjustable. The voiced part is the glottal flow *derivative*, since lip radiation acts roughly as a time derivative. You can mix it with white noise, or with *pulsed* noise that follows the glottal cycle (as in breathy voice).
- *Pitch from sample*: the same synthetic source, but its F0, voicing and loudness follow a speech sample. This is a classic parametric vocoder. You can shift the pitch and add noise to the voiced parts.
- *Residual from sample*: the excitation that remains after the spectral envelope is removed from the sample.

**Vocal tract**
- *Synthetic phone*: a cascade of formant resonators (as in Klatt 1980) for about 30 vowels and consonants (IPA buttons). F1–F4 and the vocal tract length can be changed, and vowels and approximants can glide from one phone to another. Choosing a phone also sets a typical voiced/noise balance.
- *Estimated from sample*: the spectral envelope of the sample, frame by frame. Two methods are available. *Linear prediction* uses time-varying lattice filters. *Mel envelope* follows the Vocoder section of the book (40 mel bands, 30 ms windows, 5 ms hop, filtering in the STFT domain).

Any source can be combined with any vocal tract. When both come from the same sample, the output equals the sample (up to rounding), which makes a good starting point for a lesson. "Flatten source spectrum" removes the spectral tilt of a synthetic source before the estimated envelope is applied, because the estimated envelope already contains the glottal tilt.

**Playback and plots**
- *Play/Stop* plays once. *Continuous* loops the sound, and you hear changes while it plays (new renders crossfade in at the same position). *Fade* sets a raised-cosine fade at both ends so the loop does not click.
- *Listen to* switches between the output, the source alone and the original sample. The plots follow the same choice.
- The spectrogram has a narrow-band mode (40 ms window, shows harmonics) and a wide-band mode (5 ms window, shows formants and glottal pulses).
- A second waveform pane always shows the source (excitation), so you can compare it with the output.
- Zoom the time axis with the buttons above the waveform, or with Ctrl/⌘ + scroll (pinch on a touchpad). Pan with horizontal scroll or Shift + scroll. Both waveforms and the spectrogram always share the same time range.
- Click or drag on a waveform or the spectrogram to choose the time shown in the spectrum plot. That plot overlays the source spectrum, the vocal tract response and the output spectrum.
- Space starts and stops playback.

## Languages

The page is in English by default. Add `lang=fi` to the address for the Finnish version (*suomeksi*), or use the language links at the top of the page. All texts live in [src/i18n.js](src/i18n.js). To add a language, copy the `en` block, translate it, and add the language to `LANGUAGES`; any text left out falls back to English. A test checks that every language has every text.

## Links and embedding

Every setting is stored in the page address, so *Copy link* gives a link that opens the demo in exactly that state. Two extra options are useful for embedding:

- `embed=1` hides the title and footer.
- `lang=fi` shows the Finnish version.
- `hide=` takes a comma-separated list of parts to hide: `source`, `tract`, `sample`, `transport`, `waveform`, `excitation`, `spectrogram`, `spectrum`.
- `z0` and `z1` set the visible time range in seconds, for example `z0=0.5&z1=0.53` to show a few glottal periods.

For example, a vowel demo for the speech production chapter that hides the speech sample panel:

```html
<iframe src="https://tombackstrom.github.io/WASVocoder/?phone=i&embed=1&hide=sample"
        width="100%" height="900" style="border:0" allow="autoplay; microphone"></iframe>
```

And the vocoder of the book's Vocoder section (mel envelope of speech applied to a synthetic source):

```
?vt=sample&method=mel&model=impulse&f0=100
```

Parameter names are the keys of `DEFAULTS` in [src/state.js](src/state.js).

## Code layout

- [src/dsp/](src/dsp/) holds all signal processing as pure functions with no browser dependencies. [render.js](src/dsp/render.js) is the full pipeline. The other files are building blocks: FFT, LPC, mel envelope, STFT filtering, glottal models, excitation, formant tract, pitch tracking, and the phone table.
- [src/main.js](src/main.js) has the user interface, [src/audio.js](src/audio.js) playback (Web Audio API) and [src/plots.js](src/plots.js) the canvas plots.
- Everything runs at 16 kHz internally; the browser resamples on playback.

The DSP is plain JavaScript rather than WebAssembly. At 16 kHz the whole pipeline renders a few seconds of audio in tens of milliseconds, so WebAssembly would add a toolchain without a noticeable gain. The DSP modules are self-contained if a port is ever needed.

## Tests

```sh
node --test tests/*.test.mjs
```

These use only Node's built-in test runner. They check the FFT, LPC analysis and synthesis (exact reconstruction), STFT transparency, the mel envelope, the LF model, pitch estimation, URL round trips, and that every source and tract combination renders.

## Limitations

- The phone table gives approximate values for an adult male voice. The consonant models are simplified (one or two resonances plus an anti-resonance). They are meant for teaching, not as phonetic data.
- The pitch tracker is a simple autocorrelation method with octave correction. It makes occasional octave errors.
- Stop consonants and other time-varying sounds can only be heard through the "estimated from sample" path.

## References

- G. E. Peterson and H. L. Barney, "Control methods used in a study of the vowels," *J. Acoust. Soc. Am.*, 24(2), 175–184, 1952. https://doi.org/10.1121/1.1906875
- A. E. Rosenberg, "Effect of glottal pulse shape on the quality of natural vowels," *J. Acoust. Soc. Am.*, 49(2B), 583–590, 1971. https://doi.org/10.1121/1.1912389
- D. H. Klatt, "Software for a cascade/parallel formant synthesizer," *J. Acoust. Soc. Am.*, 67(3), 971–995, 1980. https://doi.org/10.1121/1.383940
- G. Fant, J. Liljencrants and Q. Lin, "A four-parameter model of glottal flow," *STL-QPSR*, 26(4), 1–13, 1985. https://www.speech.kth.se/prod/publications/files/qpsr/1985/1985_26_4_001-013.pdf
- G. Fant, "The LF-model revisited. Transformations and frequency domain analysis," *STL-QPSR*, 36(2–3), 119–156, 1995. https://www.speech.kth.se/prod/publications/files/qpsr/1995/1995_36_2-3_119-156.pdf

## Licence

Code: MIT, see [LICENSE](LICENSE). The example sentence [sounds/speech.wav](sounds/speech.wav) comes from *Introduction to Speech Processing* and is licensed CC BY-SA 4.0.
