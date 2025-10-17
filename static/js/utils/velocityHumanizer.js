// velocityHumanizer.js
// Applies humanization (randomness) to note velocities based on a humanize percentage

import { pianoState } from '../core/appState.js';

/**
 * Generates a random number with a roughly normal (Gaussian) distribution
 * Uses the sum of three uniform random values approximation
 * Returns a value roughly between -1 and +1, centered at 0
 * @returns {number} A normally-distributed random value
 */
function gaussianRandom() {
    return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

/**
 * Applies humanization (velocity variation) to a note's velocity
 * 
 * @param {number|null} baseVelocity - The base MIDI velocity (0-127). Defaults to pianoState.velocity
 * @param {number|null} humanizePercent - The humanize percentage (0-100). Defaults to pianoState.humanize
 * @returns {number} The humanized velocity (0-127, rounded to whole number)
 * 
 * Behavior:
 * - If humanizePercent is 0 or null/undefined, returns baseVelocity unchanged
 * - If baseVelocity is 0 or null/undefined, always returns the velocity value unchanged
 * - Otherwise, applies ±humanizePercent variation around baseVelocity using normal distribution
 * - Results are clamped to MIDI range (0-127) and rounded to whole numbers
 */
export function humanizeNote(baseVelocity = null, humanizePercent = null) {
    // Use pianoState defaults if arguments not provided
    const velocity = baseVelocity !== null ? baseVelocity : pianoState.velocity;
    const humanize = humanizePercent !== null ? humanizePercent : pianoState.humanize;
    
    // Early return if humanize is disabled or unavailable, or if velocity is 0 or unavailable
    if (humanize == null || humanize === 0 || velocity == null || velocity === 0) {
        return velocity;
    }
    
    // Calculate variance as a percentage of base velocity
    const variance = (velocity * humanize) / 100;
    
    // Generate a normally-distributed random variation
    const randomVariation = gaussianRandom() * variance;
    
    // Apply variation, clamp to MIDI range (0-127), and round to whole number
    const humanizedVelocity = velocity + randomVariation;
    const clampedVelocity = Math.max(0, Math.min(127, humanizedVelocity));
    const roundedVelocity = Math.round(clampedVelocity);
    
    return roundedVelocity;
}

export function humanizeDuration(baseDuration = null, humanizePercent = null) {
    // Use pianoState defaults if arguments not provided
    const duration = baseDuration !== null ? baseDuration : pianoState.staccatoTime;
    const humanize = humanizePercent !== null ? humanizePercent : pianoState.humanize;
    
    // Early return if humanize is disabled or unavailable, or if duration is 0, 1 or unavailable
    if (humanize == null || humanize === 0 || duration == null || duration === 0 || duration === 1) {
        return duration;
    }
    
    // Calculate variance as a percentage of base duration
    // Divide humanize by 5 so that 100% humanize = 20% duration variation (the sloppy threshold)
    const variance = (duration * humanize) / 500;
    
    // Generate a normally-distributed random variation
    const randomVariation = gaussianRandom() * variance;
    
    // Apply variation, clamp to valid range (0-1)
    const humanizedDuration = duration + randomVariation;
    const clampedDuration = Math.max(0, Math.min(1, humanizedDuration));
    
    // Round to 3 decimal places
    return Math.round(clampedDuration * 1000) / 1000;
}