import { setSynthEnvelopeParam, setEffectWet } from './utils.js';

const Tone = window.Tone;

export default {
  name: 'Cello Synth',
  type: 'synth',
  baseSynth: Tone ? Tone.FMSynth : 'FMSynth',
  params: {
    harmonicity: 3.01,
    modulationIndex: 14,
    oscillator: {
      type: 'triangle',
    },
    envelope: {
      attack: 0.2,
      decay: 0.3,
      sustain: 0.1,
      release: 1.2,
    },
    modulation: {
      type: 'square',
    },
    modulationEnvelope: {
      attack: 0.5,
      decay: 0.5,
      sustain: 0.2,
      release: 0.1,
    },
  },
  effects: [
    {
      type: Tone ? Tone.Freeverb : null,
      params: {
        roomSize: 0.8,
        dampening: 5000,
      },
    },
    {
      type: Tone ? Tone.Vibrato : null,
      params: {
        maxDelay: 0.01,
        frequency: 5,
        depth: 0.1,
        type: 'sine',
      },
    },
  ],
  envelopeSettings: {
    attack: 0.2,
    decay: 0.3,
    sustain: 0.1,
    release: 1.2,
    // Enable all effects so UI sliders work
    reverb: { enabled: true, roomSize: 0.3, wet: 0.2 },
    eq: { enabled: true, low: 0, mid: 0, high: 0 },
    compression: { enabled: true, threshold: -10, ratio: 2, attack: 0.003, release: 0.1 },
  },
  dynamicParams: [
    {
      name: 'attack',
      target: 'instrument',
      default: 25,
      func: setSynthEnvelopeParam('attack', 0.1, 1),
    },
    {
      name: 'decay',
      target: 'instrument',
      default: 10,
      func: setSynthEnvelopeParam('decay', 0.5, 2),
    },
    {
      name: 'space',
      target: 'effect',
      default: 10,
      func: setEffectWet(0),
    },
    {
      name: 'vibrato',
      target: 'effect',
      default: 15,
      func: setEffectWet(1, 'depth', 0, 0.2),
    },
  ],
};
