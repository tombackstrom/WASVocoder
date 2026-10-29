// User interface texts. To add a language, copy the `en` block, translate the
// values and add the language to LANGUAGES. Keys missing from a language fall
// back to English. Values may be functions of their arguments.

export const LANGUAGES = { en: 'English', fi: 'Suomi' };

const en = {
  pageTitle: 'WASVocoder',
  introHtml: 'Speech can be modelled as a <em>source</em> (vibrating vocal folds or turbulent noise) shaped by a <em>filter</em> (the resonances of the vocal tract). Choose a source and a vocal tract, either synthetic or estimated from a speech sample, and listen to the result.',
  repoLink: 'Source code on GitHub',
  footerHtml: 'Made for <a href="https://speechprocessingbook.aalto.fi/">Introduction to Speech Processing</a>. Runs entirely in your browser; nothing is uploaded. <a href="https://github.com/tombackstrom/WASVocoder">Source code</a>.',
  viewWaveform: 'Waveform',
  viewExcitation: 'Source (excitation)',
  viewSpectrogram: 'Spectrogram',
  viewSpectrum: 'Spectrum at the cursor',
  spectrumHint: 'Click or drag on a waveform or the spectrogram to move the cursor. Zoom with the buttons, or with Ctrl/⌘ + scroll (pinch on a touchpad); pan with horizontal scroll or Shift + scroll. Each curve is scaled to a peak of 0 dB.',

  // Source card
  sourceTitle: 'Source',
  sourceIntro: 'The excitation: vocal fold vibration (voiced), turbulent noise (unvoiced), or a mix.',
  srcSynth: 'Synthetic',
  srcFollow: 'Pitch from sample',
  srcFollowTitle: 'A synthetic source that follows the pitch, voicing and loudness of the speech sample',
  srcResidual: 'Residual from sample',
  srcResidualTitle: 'The excitation estimated from the speech sample by removing its spectral envelope',
  glottalPulse: 'Glottal pulse',
  modelImpulse: 'Impulse train',
  modelImpulseTitle: 'Idealised excitation with a flat spectrum',
  modelRosenbergTitle: 'Rosenberg (1971) glottal pulse',
  modelLfTitle: 'Liljencrants–Fant glottal pulse model',
  f0: 'F0',
  pitchShift: 'Pitch shift',
  openQuotient: 'Open quotient',
  rd: 'Rd (tense–lax)',
  jitter: 'Jitter',
  shimmer: 'Shimmer',
  mixFixed: 'Voiced – noise',
  mixFollow: 'Noise when voiced',
  noise: 'Noise',
  noiseWhite: 'White',
  noiseWhiteTitle: 'Steady white noise',
  noisePulsed: 'Pulsed',
  noisePulsedTitle: 'Noise whose level follows the glottal cycle, as in a breathy voice',
  flatten: 'Flatten source spectrum',
  flattenTitle: 'Remove the spectral tilt of the source, since the estimated envelope already contains it',
  noteResidual: 'The residual is what remains of the sample after its spectral envelope is removed.',
  noteImpulse: 'An impulse train has a flat spectrum: all harmonics have the same level.',
  noteGlottal: 'The glottal flow derivative is used, since lip radiation acts roughly as a derivative.',

  // Vocal tract card
  tractTitle: 'Vocal tract',
  tractIntro: 'The filter: resonances (formants) of the vocal tract.',
  vtSynth: 'Synthetic phone',
  vtSample: 'Estimated from sample',
  vtSampleTitle: 'The spectral envelope of the speech sample, frame by frame',
  groupVowel: 'Vowels',
  groupApproximant: 'Approximants',
  groupNasal: 'Nasals',
  groupFricative: 'Fricatives',
  phoneAsIn: (ipa, example) => `/${ipa}/ as in “${example}”`,
  glideTo: 'Glide to',
  glideNone: 'none',
  formant: (i) => `F${i}`,
  peak: (i) => `Peak ${i}`,
  tractLength: 'Tract length',
  formantScale: (x) => `formants ×${x}`,
  noteTract: (ipa, example) => `/${ipa}/ as in “${example}”. Formant values are approximate, for an adult male voice.`,

  // Sample card
  sampleTitle: 'Speech sample',
  sampleIntro: 'Used when the source or the vocal tract is estimated from speech.',
  sample: 'Sample',
  sampleSpeech: 'Example sentence',
  openFile: 'Open file…',
  record: 'Record',
  stopRecording: 'Stop recording',
  yourRecording: 'Your recording',
  envelope: 'Envelope',
  methodLpc: 'Linear prediction',
  methodLpcTitle: 'All-pole model of the envelope (time-domain filtering)',
  methodMel: 'Mel envelope',
  methodMelTitle: 'Mel-band envelope as in the Vocoder section of the book (STFT-domain filtering)',
  order: 'Model order',
  bands: 'Mel bands',
  loadingSample: 'Loading sample…',
  sampleLength: (s) => `${s} s of speech`,
  loadFailed: (url) => `Could not load ${url}`,
  needServer: (msg) => `${msg}. Open the page through a web server (see README).`,
  readFailed: (msg) => `Could not read the audio file (${msg}).`,
  noMicrophone: (msg) => `No microphone access (${msg}).`,
  recording: 'Recording… (at most 5 s)',

  // Transport
  play: 'Play',
  stop: 'Stop',
  loop: 'Continuous',
  loopTitle: 'Loop the sound; changes are heard while it plays',
  fade: 'Fade',
  length: 'Length',
  listenTo: 'Listen to',
  listenOutput: 'Output',
  listenSource: 'Source',
  listenOriginal: 'Sample',
  volume: 'Volume',
  copyLink: 'Copy link',
  linkCopied: 'Link copied',
  copyThisLink: 'Copy this link:',
  narrowBand: 'Narrow-band',
  narrowBandTitle: '40 ms window: shows the harmonics',
  wideBand: 'Wide-band',
  wideBandTitle: '5 ms window: shows the formants and individual glottal pulses',

  // Zoom
  zoomOut: 'Zoom out',
  zoomIn: 'Zoom in (around the cursor)',
  panLeft: 'Move left',
  panRight: 'Move right',
  zoomAll: 'All',
  zoomAllTitle: 'Show the whole signal',

  // Plot labels and legend
  labelOutput: 'Output',
  labelSource: 'Source (excitation)',
  labelOriginal: 'Speech sample',
  legendSource: 'Source',
  legendTract: 'Vocal tract',
  legendOutput: 'Output',
  legendOriginal: 'Sample',

  // Example words for the phones (see src/dsp/phones.js for the defaults)
  examples: {},
};

const fi = {
  pageTitle: 'WASVocoder',
  introHtml: 'Puhetta voidaan mallintaa <em>lähteenä</em> (värähtelevät äänihuulet tai turbulenttinen kohina), jota <em>suodin</em> (ääntöväylän resonanssit) muokkaa. Valitse lähde ja ääntöväylä, joko synteettinen tai puhenäytteestä arvioitu, ja kuuntele tulos.',
  repoLink: 'Lähdekoodi GitHubissa',
  footerHtml: 'Tehty kirjaa <a href="https://speechprocessingbook.aalto.fi/">Introduction to Speech Processing</a> varten. Toimii kokonaan selaimessasi; mitään ei lähetetä palvelimelle. <a href="https://github.com/tombackstrom/WASVocoder">Lähdekoodi</a>.',
  viewWaveform: 'Aaltomuoto',
  viewExcitation: 'Lähde (heräte)',
  viewSpectrogram: 'Spektrogrammi',
  viewSpectrum: 'Spektri kursorin kohdalla',
  spectrumHint: 'Siirrä kursoria napsauttamalla tai vetämällä aaltomuodon tai spektrogrammin päällä. Lähennä painikkeilla tai Ctrl/⌘ + vierityksellä (kosketuslevyllä nipistämällä); siirrä näkymää vaakavierityksellä tai Shift + vierityksellä. Jokainen käyrä on skaalattu niin, että sen huippu on 0 dB.',

  sourceTitle: 'Lähde',
  sourceIntro: 'Heräte: äänihuulten värähtely (soinnillinen), turbulenttinen kohina (soinniton) tai niiden yhdistelmä.',
  srcSynth: 'Synteettinen',
  srcFollow: 'Sävelkorkeus näytteestä',
  srcFollowTitle: 'Synteettinen lähde, joka seuraa puhenäytteen sävelkorkeutta, soinnillisuutta ja voimakkuutta',
  srcResidual: 'Jäännös näytteestä',
  srcResidualTitle: 'Puhenäytteestä arvioitu heräte, josta on poistettu spektrin verhokäyrä',
  glottalPulse: 'Glottispulssi',
  modelImpulse: 'Impulssijono',
  modelImpulseTitle: 'Idealisoitu heräte, jonka spektri on tasainen',
  modelRosenbergTitle: 'Rosenbergin (1971) glottispulssi',
  modelLfTitle: 'Liljencrantsin–Fantin glottispulssimalli',
  f0: 'F0',
  pitchShift: 'Sävelsiirto',
  openQuotient: 'Avoin osuus',
  rd: 'Rd (jännittynyt–löysä)',
  jitter: 'Jitter',
  shimmer: 'Shimmer',
  mixFixed: 'Soinnillinen – kohina',
  mixFollow: 'Kohina soinnillisissa',
  noise: 'Kohina',
  noiseWhite: 'Valkoinen',
  noiseWhiteTitle: 'Tasainen valkoinen kohina',
  noisePulsed: 'Sykkivä',
  noisePulsedTitle: 'Kohina, jonka voimakkuus seuraa glottisjaksoa kuten henkäisevässä äänessä',
  flatten: 'Tasoita lähteen spektri',
  flattenTitle: 'Poista lähteen spektrin kallistus, koska arvioitu verhokäyrä sisältää sen jo',
  noteResidual: 'Jäännös on se osa näytteestä, joka jää jäljelle, kun spektrin verhokäyrä poistetaan.',
  noteImpulse: 'Impulssijonon spektri on tasainen: kaikki harmoniset ovat yhtä voimakkaita.',
  noteGlottal: 'Herätteenä käytetään glottisvirtauksen derivaattaa, koska huulisäteily vaikuttaa likimain derivaatan tavoin.',

  tractTitle: 'Ääntöväylä',
  tractIntro: 'Suodin: ääntöväylän resonanssit (formantit).',
  vtSynth: 'Synteettinen äänne',
  vtSample: 'Arvioitu näytteestä',
  vtSampleTitle: 'Puhenäytteen spektrin verhokäyrä kehys kehykseltä',
  groupVowel: 'Vokaalit',
  groupApproximant: 'Approksimantit',
  groupNasal: 'Nasaalit',
  groupFricative: 'Frikatiivit',
  phoneAsIn: (ipa, example) => `/${ipa}/ kuten sanassa ”${example}”`,
  glideTo: 'Liuku kohti',
  glideNone: 'ei liukua',
  formant: (i) => `F${i}`,
  peak: (i) => `Huippu ${i}`,
  tractLength: 'Ääntöväylän pituus',
  formantScale: (x) => `formantit ×${x}`,
  noteTract: (ipa, example) => `/${ipa}/ kuten sanassa ”${example}”. Formanttiarvot ovat likimääräisiä aikuisen miehen äänelle.`,

  sampleTitle: 'Puhenäyte',
  sampleIntro: 'Käytetään, kun lähde tai ääntöväylä arvioidaan puheesta.',
  sample: 'Näyte',
  sampleSpeech: 'Esimerkkilause (englanti)',
  openFile: 'Avaa tiedosto…',
  record: 'Nauhoita',
  stopRecording: 'Lopeta nauhoitus',
  yourRecording: 'Oma nauhoitus',
  envelope: 'Verhokäyrä',
  methodLpc: 'Lineaarinen ennustus',
  methodLpcTitle: 'Kaikkinapainen malli verhokäyrälle (suodatus aikatasossa)',
  methodMel: 'Mel-verhokäyrä',
  methodMelTitle: 'Mel-kaistojen verhokäyrä kuten kirjan Vocoder-osiossa (suodatus STFT-tasossa)',
  order: 'Mallin aste',
  bands: 'Mel-kaistat',
  loadingSample: 'Ladataan näytettä…',
  sampleLength: (s) => `${s} s puhetta`,
  loadFailed: (url) => `Tiedostoa ${url} ei voitu ladata`,
  needServer: (msg) => `${msg}. Avaa sivu verkkopalvelimen kautta (katso README).`,
  readFailed: (msg) => `Äänitiedostoa ei voitu lukea (${msg}).`,
  noMicrophone: (msg) => `Ei pääsyä mikrofoniin (${msg}).`,
  recording: 'Nauhoitetaan… (enintään 5 s)',

  play: 'Toista',
  stop: 'Pysäytä',
  loop: 'Jatkuva',
  loopTitle: 'Toista silmukkana; muutokset kuuluvat toiston aikana',
  fade: 'Häivytys',
  length: 'Kesto',
  listenTo: 'Kuuntele',
  listenOutput: 'Tulos',
  listenSource: 'Lähde',
  listenOriginal: 'Näyte',
  volume: 'Äänenvoimakkuus',
  copyLink: 'Kopioi linkki',
  linkCopied: 'Linkki kopioitu',
  copyThisLink: 'Kopioi tämä linkki:',
  narrowBand: 'Kapeakaistainen',
  narrowBandTitle: '40 ms:n ikkuna: näyttää harmoniset',
  wideBand: 'Laajakaistainen',
  wideBandTitle: '5 ms:n ikkuna: näyttää formantit ja yksittäiset glottispulssit',

  zoomOut: 'Loitonna',
  zoomIn: 'Lähennä (kursorin ympäriltä)',
  panLeft: 'Siirrä vasemmalle',
  panRight: 'Siirrä oikealle',
  zoomAll: 'Kaikki',
  zoomAllTitle: 'Näytä koko signaali',

  labelOutput: 'Tulos',
  labelSource: 'Lähde (heräte)',
  labelOriginal: 'Puhenäyte',
  legendSource: 'Lähde',
  legendTract: 'Ääntöväylä',
  legendOutput: 'Tulos',
  legendOriginal: 'Näyte',

  // Finnish words where Finnish has the sound, otherwise marked by language.
  examples: {
    i: 'tili', 'ɪ': 'engl. sit', e: 'elo', 'ɛ': 'engl. bed', 'æ': 'äiti', a: 'esp. casa',
    'ɑ': 'kala', 'ɔ': 'engl. thought', o: 'olo', 'ʊ': 'engl. book', u: 'uni', 'ʌ': 'engl. cup',
    'ə': 'engl. about', 'ɝ': 'engl. bird', y: 'yö', 'ø': 'öljy',
    j: 'jo', w: 'engl. we', l: 'lumi', 'ɹ': 'engl. red',
    m: 'maa', n: 'nenä', 'ŋ': 'kenkä',
    s: 'sisu', z: 'engl. zoo', 'ʃ': 'šakki', 'ʒ': 'engl. vision', f: 'filmi', v: 'engl. vee',
    x: 'saks. Bach', h: 'hai',
  },
};

export const DICTS = { en, fi };

// English unless another language is asked for with ?lang=xx.
function pickLanguage() {
  const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('lang');
  return asked && DICTS[asked] ? asked : 'en';
}

export const lang = pickLanguage();
const dict = DICTS[lang];

export function t(key, ...args) {
  const v = dict[key] ?? en[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}

// Example word for a phone in the current language.
export function example(phone) {
  return dict.examples?.[phone.ipa] ?? phone.example;
}

// Number with a fixed number of decimals and the language's decimal mark.
export const DECIMAL = lang === 'fi' ? ',' : '.';
export function num(v, digits) {
  const s = digits == null ? String(v) : v.toFixed(digits);
  return DECIMAL === '.' ? s : s.replace('.', DECIMAL);
}

// Fills elements marked with data-i18n (text) or data-i18n-html (trusted markup).
export function translatePage(root = document) {
  document.documentElement.lang = lang === 'en' ? 'en-GB' : lang;
  document.title = t('pageTitle');
  for (const e of root.querySelectorAll('[data-i18n]')) e.textContent = t(e.dataset.i18n);
  for (const e of root.querySelectorAll('[data-i18n-html]')) e.innerHTML = t(e.dataset.i18nHtml);
}
