import { setSynthEnvelopeParam, setEffectWet } from './utils.js';

const Tone = window.Tone;

export default {
  name: 'Ambient Synth',
  type: 'synth',
  baseSynth: Tone ? Tone.DuoSynth : null,
  params: {
    vibratoAmount: 0,
    harmonicity: 1,
    voice0: {
      volume: -11, // -1dB relative to base
      oscillator: {
        type: 'sine',
      },
      filter: {
        type: 'lowpass',
        Q: 1,
      },
      envelope: {
        attack: 0.963,
        decay: 0.625,
        sustain: 0.926,
        release: 0.599,
      },
      filterEnvelope: {
        attack: 0.008,
        decay: 0.112,
        sustain: 0.847,
        release: 0.745,
        baseFrequency: 130,
        octaves: 1.4, // 130Hz * 2^1.4 ≈ 344Hz
        exponent: 2,
      },
    },
    voice1: {
      volume: -15, // -5dB relative to base
      oscillator: {
        type: 'triangle',
      },
      filter: {
        type: 'lowpass',
        Q: 1,
      },
      envelope: {
        attack: 0.963,
        decay: 0.625,
        sustain: 0.926,
        release: 0.599,
      },
      filterEnvelope: {
        attack: 0.008,
        decay: 0.112,
        sustain: 0.847,
        release: 0.745,
        baseFrequency: 130,
        octaves: 1.4,
        exponent: 2,
      },
    },
  },
  effects: [],
  envelopeSettings: {
    attack: 0.963,
    decay: 0.625,
    sustain: 0.926,
    release: 0.599,
    // Enable all effects so UI sliders work
    reverb: { enabled: true, roomSize: 0.3, wet: 0.2 },
    eq: { enabled: true, low: 0, mid: 0, high: 0 },
    compression: { enabled: true, threshold: -10, ratio: 2, attack: 0.003, release: 0.1 },
  },
  dynamicParams: [],
};
