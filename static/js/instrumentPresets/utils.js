import { convertValToRange } from '../utils/math.js';

// Helper for dynamic parameters
export const setSynthEnvelopeParam = (property, min, max) => (shape, val) => {
  // Assuming 'shape.synth' is your Tone synth instance
  if (shape && shape.synth && shape.synth.envelope) {
      shape.synth.envelope.set(property, convertValToRange(val, 0, 100, min, max));
  }
};

export const setEffectWet = (
  effectIndex,
  effectParam = 'wet',
  min = 0,
  max = 1
) => (colorController, val) => {
  // colorController.setEffectAmount logic would go here
  // Ideally, you'd just set the effect parameter directly on your effect instance
};
