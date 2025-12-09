import { setSynthEnvelopeParam, setEffectWet } from './utils.js';

const Tone = window.Tone;

export default {
  name: 'Warm Synth',
  type: 'synth',
  baseSynth: Tone ? Tone.DuoSynth : null,
  params: {
    vibratoAmount: 0,
    harmonicity: 1,
    voice0: {
      volume: -10, // Base volume adjusted to avoid clipping
      oscillator: {
        type: 'square',
      },
      filter: {
        type: 'lowpass',
        Q: 1,
      },
      envelope: {
        attack: 0.182,
        decay: 0.344,
        sustain: 0.369,
        release: 0.955,
      },
      filterEnvelope: {
        attack: 0.227,
        decay: 0.832,
        sustain: 0.744,
        release: 0.667,
        baseFrequency: 52,
        octaves: 4, // 52Hz * 2^4 ≈ 832Hz
        exponent: 2,
      },
    },
    voice1: {
      volume: -25, // -15dB relative to Oscillator 1
      oscillator: {
        type: 'triangle',
      },
      filter: {
        type: 'lowpass',
        Q: 1,
      },
      envelope: {
        attack: 0.182,
        decay: 0.344,
        sustain: 0.369,
        release: 0.955,
      },
      filterEnvelope: {
        attack: 0.227,
        decay: 0.832,
        sustain: 0.744,
        release: 0.667,
        baseFrequency: 52,
        octaves: 4,
        exponent: 2,
      },
    },
  },
  effects: [],
  envelopeSettings: {
    attack: 0.182,
    decay: 0.344,
    sustain: 0.369,
    release: 0.955,
    // Enable all effects so UI sliders work
    reverb: { enabled: true, roomSize: 0.3, wet: 0.2 },
    eq: { enabled: true, low: 0, mid: 0, high: 0 },
    compression: { enabled: true, threshold: -10, ratio: 2, attack: 0.003, release: 0.1 },
  },
  dynamicParams: [],
};
