// Approximate formant values for an adult male voice (vocal tract about
// 17.5 cm). Vowel F1-F3 mostly follow Peterson & Barney (1952); the vowels not
// in their set (e, a, o, y, ø) and the consonants are rough textbook values.
// The consonant models are simplified: fricatives and nasals are given one or
// two resonances (poles) and an anti-resonance (zero) that shape the spectrum
// roughly right. They are meant for teaching, not as accurate phonetic data.
//
// poles/zeros: [frequency Hz, bandwidth Hz]
// noise: typical share of noise in the excitation (0 = voiced, 1 = noise).

const vowel = (ipa, example, f1, f2, f3, f4 = 3500, f5 = 4500) => ({
  ipa, example, group: 'vowel', noise: 0,
  poles: [[f1, 80], [f2, 100], [f3, 150], [f4, 250], [f5, 300]],
  zeros: [],
});

export const PHONES = [
  vowel('i', 'see', 270, 2290, 3010),
  vowel('ɪ', 'sit', 390, 1990, 2550),
  vowel('e', 'German See', 400, 2100, 2700),
  vowel('ɛ', 'bed', 530, 1840, 2480),
  vowel('æ', 'cat', 660, 1720, 2410),
  vowel('a', 'Spanish casa', 700, 1220, 2600),
  vowel('ɑ', 'father', 730, 1090, 2440),
  vowel('ɔ', 'thought', 570, 840, 2410),
  vowel('o', 'German so', 450, 800, 2600),
  vowel('ʊ', 'book', 440, 1020, 2240),
  vowel('u', 'food', 300, 870, 2240),
  vowel('ʌ', 'cup', 640, 1190, 2390),
  vowel('ə', 'about', 500, 1500, 2500),
  vowel('ɝ', 'bird', 490, 1350, 1690),
  vowel('y', 'German über', 280, 1800, 2200, 3300),
  vowel('ø', 'German schön', 400, 1550, 2300, 3300),
  { ipa: 'j', example: 'yes', group: 'approximant', noise: 0,
    poles: [[260, 60], [2070, 150], [3020, 200], [3600, 250], [4500, 300]], zeros: [] },
  { ipa: 'w', example: 'we', group: 'approximant', noise: 0,
    poles: [[290, 60], [610, 100], [2150, 150], [3300, 250], [4500, 300]], zeros: [] },
  { ipa: 'l', example: 'let', group: 'approximant', noise: 0,
    poles: [[360, 80], [1300, 150], [2700, 200], [3500, 250], [4500, 300]], zeros: [] },
  { ipa: 'ɹ', example: 'red', group: 'approximant', noise: 0,
    poles: [[310, 80], [1060, 100], [1380, 120], [3200, 250], [4500, 300]], zeros: [] },
  { ipa: 'm', example: 'me', group: 'nasal', noise: 0,
    poles: [[250, 50], [1100, 150], [2200, 200], [3200, 250]], zeros: [[750, 150]] },
  { ipa: 'n', example: 'no', group: 'nasal', noise: 0,
    poles: [[250, 50], [1600, 150], [2600, 200], [3400, 250]], zeros: [[1450, 200]] },
  { ipa: 'ŋ', example: 'sing', group: 'nasal', noise: 0,
    poles: [[250, 50], [2000, 150], [2700, 200], [3600, 250]], zeros: [[3000, 300]] },
  { ipa: 's', example: 'see', group: 'fricative', noise: 1,
    poles: [[5500, 600]], zeros: [[1500, 1000]] },
  { ipa: 'z', example: 'zoo', group: 'fricative', noise: 0.6,
    poles: [[5500, 600]], zeros: [[1500, 1000]] },
  { ipa: 'ʃ', example: 'she', group: 'fricative', noise: 1,
    poles: [[2700, 300], [4800, 600]], zeros: [[1200, 600]] },
  { ipa: 'ʒ', example: 'vision', group: 'fricative', noise: 0.6,
    poles: [[2700, 300], [4800, 600]], zeros: [[1200, 600]] },
  { ipa: 'f', example: 'fee', group: 'fricative', noise: 1,
    poles: [[5000, 3000]], zeros: [[1000, 1500]] },
  { ipa: 'v', example: 'vee', group: 'fricative', noise: 0.6,
    poles: [[5000, 3000]], zeros: [[1000, 1500]] },
  { ipa: 'x', example: 'German Bach', group: 'fricative', noise: 1,
    poles: [[1500, 250], [2800, 400]], zeros: [[800, 600]] },
  { ipa: 'h', example: 'he', group: 'fricative', noise: 1,
    poles: [[500, 200], [1500, 250], [2500, 300], [3500, 400], [4500, 500]], zeros: [] },
];

export const PHONE_GROUPS = [
  ['vowel', 'Vowels'],
  ['approximant', 'Approximants'],
  ['nasal', 'Nasals'],
  ['fricative', 'Fricatives'],
];

export function phoneByIpa(ipa) {
  return PHONES.find((p) => p.ipa === ipa) ?? PHONES.find((p) => p.ipa === 'a');
}

// Phones that can take part in a glide (same filter structure: five poles).
export const canGlide = (p) => p.group === 'vowel' || p.group === 'approximant';
