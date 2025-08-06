// audioManager.js - Enhanced instrument control and audio management

import {
  connectSpectrumToAudio,
  initializeSpectrum,
  startSpectrumVisualization
} from '../ui/spectrum.js';
import { pianoState } from "./appState.js";
import { EnvelopeControl } from '../classes/envelopeControl.js';

/**
 * Instrument preset class that manages sample URLs and envelope settings
 * for different instruments
 */
export class InstrumentControl {
    constructor() {
        this.presets = {
            piano: {
                name: 'Piano',
                baseUrl: '/static/samples/piano/',
                sampleUrls: {
                    C2: "SteinwayD_m_C2_L.wav",
                    E2: "SteinwayD_m_E2_L.wav",
                    "G#2": "SteinwayD_m_G#2_L.wav",
                    C3: "SteinwayD_m_C3_L.wav",
                    E3: "SteinwayD_m_E3_L.wav",
                    "G#3": "SteinwayD_m_G#3_L.wav",
                    C4: "SteinwayD_m_C4_L.wav",
                    E4: "SteinwayD_m_E4_L.wav",
                    "F#4": "SteinwayD_m_F#4_L.wav",
                    "A#4": "SteinwayD_m_A#4_L.wav",
                    C5: "SteinwayD_m_C5_L.wav",
                    "F#5": "SteinwayD_m_F#5_L.wav",
                    C6: "SteinwayD_m_C6_L.wav",
                },
                envelopeSettings: {
                    attack: 0.01,   // Very quick attack - hammer strikes
                    decay: 0.3,     // Quick decay
                    sustain: 0.5,   // Good sustain level
                    release: 0.8,     // Natural decay of strings

                    // Piano effects
                    reverb: { enabled: true, roomSize: 0.7, wet: 0.25 },
                    compression: { enabled: true, threshold: -15, ratio: 1.5, attack: 0.1, release: 0.3 },
                    eq: { enabled: true, low: -1, mid: 1, high: 0 }
                }
            },

            guitar: {
                name: 'Guitar',
                baseUrl: '/static/samples/guitar/',
                sampleUrls: {
                    "F#2": "nylonf42.wav",
                    C3: "nylonf48.wav",
                    F3: "nylonf53.wav",
                    "A#3": "nylonf58.wav",
                    D4: "nylonf62.wav",
                    "G#4": "nylonf68.wav",
                    "C#5": "nylonf73.wav",
                    G5: "nylonf79.wav",
                },
                envelopeSettings: {
                    attack: 0.0005,
                    decay: 0.2,
                    sustain: 0.2,
                    release: 0.3,

                    // Guitar effects
                    reverb: { enabled: true, roomSize: 0.4, wet: 0.15 },
                    eq: { enabled: true, low: -1, mid: 0, high: 1 },
                    compression: { enabled: true, threshold: -10, ratio: 2.5, attack: 0.025, release: 0.08 }
                }
            },

            cello: {
                name: 'Cello',
                baseUrl: '/static/samples/cello/',
                sampleUrls: {
                    "C2": "C2.wav",   // Or "C2_1.wav", "C2_2.wav", etc. if C2.wav doesn't exist
                    "G#2": "G#2.wav", // Or "G#2_1.wav", "G#2_2.wav", etc.
                    "F2": "F2.wav",   // Or "F2_1.wav", "F2_2.wav", etc.
                    "E2": "E2.wav",   // Or "E2_2.wav", "E2_3.wav", etc.
                    "D2": "D2.wav",   // Or "D2_1.wav", "D2_2.wav"
                    "C#2": "C#2.wav", // Or "C#2_2.wav", "C#2_3.wav"
                    "D#2": "D#2.wav", // Or "D#2_1.wav", "D#2_2.wav", etc.
                    "A2": "A2.wav",
                },

                envelopeSettings: {
                    attack: 0.08,   // Slower attack - bow engagement
                    decay: 0.4,     // Quick decay to sustain
                    sustain: 0.9,  // Very high sustain - bowed strings
                    release: 1.8,     // Medium release

                    // Cello effects
                    reverb: { enabled: true, roomSize: 0.8, wet: 0.35 },
                    eq: { enabled: true, low: 0, mid: 1, high: 0 },
                    compression: { enabled: true, threshold: -10, ratio: 1.5, attack: 0.15, release: 0.4 }
                }
            },

            sax: {
                name: 'Saxophone',
                baseUrl: '/static/samples/sax/',
                sampleUrls: {
                    A2: "TSAX45-2.wav",
                    "C#3": "TSAX49.wav",
                    F3: "TSAX53-3.wav",
                    A3: "TSAX57.wav",
                    C4: "TSAX60-3.wav",
                    D4: "TSAX62-2.wav",
                    F4: "TSAX65-2.wav",
                    "G#4": "TSAX68.wav",
                    A4: "TSAX69-3.wav",
                    C5: "TSAX72.wav",
                    "F#5": "TSAX78-2.wav",
                    "A#5": "TSAX82-2.wav",
                    C6: "TSAX84-2.wav",
                },
                envelopeSettings: {
                    attack: 0.04,   // Quick attack - breath/reed
                    decay: 0.15,    // Very short decay
                    sustain: 0.8,   // Full sustain - breath controlled
                    release: 0.6,     // Medium release
                    reverb: { enabled: true, roomSize: 0.5, wet: 0.2 },
                    eq: { enabled: true, low: -1, mid: 1, high: 0 },
                    compression: { enabled: true, threshold: -18, ratio: 3, attack: 0.005, release: 0.2 }
                }
            },
                bass: {
                name: 'Bass',
                baseUrl: '/static/samples/bass/',
                sampleUrls: {
        "D1": "PickedBass26-2.wav",
        "E1": "AcousticBass28.wav",
        "G1": "PickedBass31-2.wav",
        "G#1": "AcousticBass32.wav",
        "A1": "PickedBass33.wav",
        "A#1": "PickedBass34-2.wav",
        "B1": "AcousticBass35.wav",
        "D2": "PickedBass38.wav",
        "D#2": "AcousticBass39.wav",
        "E2": "PickedBass40-2.wav",
        "F#2": "AcousticBass42.wav",
        "A#2": "AcousticBass46.wav",
        "B2": "PickedBass47-2.wav",
        "C#3": "AcousticBass49.wav",
        "D#3": "PickedBass51-2.wav",
        "E3": "PickedBass52.wav",
        "F#3": "AcousticBass54.wav",
        "A3": "PickedBass57-2.wav",
        "B3": "AcousticBass59.wav",
        "C5": "PickedBass72-2.wav",
        "A5": "AcousticBass81.wav",
                },
                envelopeSettings: {
                    attack: 0.05,
                    decay: 0.3,
                    sustain: 0.6,
                    release: 0.5,

                    // Bass effects
                    reverb: { enabled: true, roomSize: 0.2, wet: 0.1 },
                    eq: { enabled: true, low: 2, mid: 0, high: -2 },
                    compression: { enabled: true, threshold: -12, ratio: 4, attack: 0.01, release: 0.15 }
                }
            },
            french_horn: {
                name: 'French Horn',
                baseUrl: '/static/samples/french_horn/',
                sampleUrls: {
                    "A#2": "A#2.wav",
                    "C#2": "C#2.wav",
                    "C2": "C2.wav",
                    "D#2": "D#2.wav",
                    "D2": "D2.wav",
                    "E2": "E2.wav",
                    "F#2": "F#2.wav",
                    "F2": "F2.wav",
                    "G2": "G2.wav",
                },
                envelopeSettings: {
                    attack: 0.1,    // Slower, smooth attack
                    decay: 0.2,     // Short decay to sustain
                    sustain: 0.7,   // Strong, brassy sustain
                    release: 0.5,   // Medium release
                    
                    // French Horn effects
                    reverb: { enabled: true, roomSize: 0.6, wet: 0.3 },
                    eq: { enabled: true, low: 0, mid: 1, high: -1 },
                    compression: { enabled: true, threshold: -15, ratio: 2, attack: 0.1, release: 0.2 }
                }
            },

            electric_guitar: {
                name: 'Electric Guitar',
                baseUrl: '/static/samples/electric_guitar/',
                sampleUrls: {
                    "A#3": "A#3.wav",
                    "C2": "C2.wav",
                    "C3": "C3.wav",
                    "D#4": "D#4.wav",
                    "F2": "F2.wav",
                    "F3": "F3.wav",
                },
                envelopeSettings: {
                    attack: 0.01,
                    decay: 0.2,
                    sustain: 0.6,
                    release: 0.5,

                    // Electric Guitar effects
                    reverb: { enabled: true, roomSize: 0.3, wet: 0.2 },
                    compression: { enabled: true, threshold: -10, ratio: 3, attack: 0.01, release: 0.1 },
                    eq: { enabled: true, low: 1, mid: 0, high: 1 }
                }
            },
            
            clarinet: {
                name: 'Clarinet',
                baseUrl: '/static/samples/clarinet/',
                sampleUrls: {
                    "A#2": "A#2.wav",
                    "A#3": "A#3.wav",
                    "D#3": "D#3.wav",
                    "F4": "F4.wav",
                    "C5": "C5.wav",
                },
                envelopeSettings: {
                    attack: 0.05,
                    decay: 0.15,
                    sustain: 0.9,
                    release: 0.4,

                    // Clarinet effects
                    reverb: { enabled: true, roomSize: 0.5, wet: 0.25 },
                    eq: { enabled: true, low: -1, mid: 1, high: 0 },
                    compression: { enabled: true, threshold: -15, ratio: 2, attack: 0.05, release: 0.2 }
                }
            },
            harp: {
                name: 'Harp',
                baseUrl: '/static/samples/harp/',
                sampleUrls: {
                    "B3": "Harp_B3.wav",
                    "C3": "Harp_C3.wav",
                    "D4": "Harp_D4.wav",
                    "D6": "Harp_D6.wav",
                    "D7": "Harp_D7.wav",
                    "E3": "Harp_E3.wav",
                    "E5": "Harp_E5.wav",
                    "F4": "Harp_F4.wav",
                    "F6": "Harp_F6.wav",
                    "F7": "Harp_F7.wav",
                    "G3": "Harp_G3.wav",
                    "G5": "Harp_G5.wav",
                    "A4": "Harp_A4.wav",
                    "A6": "Harp_A6.wav",
                    "B5": "Harp_B5.wav",
                    "C5": "Harp_C5.wav",
                },
                envelopeSettings: {
                    attack: 0.001,
                    decay: 0.1,
                    sustain: 0.0,
                    release: 2.0,

                    // Harp effects
                    reverb: { enabled: true, roomSize: 0.8, wet: 0.4 },
                    eq: { enabled: true, low: 0, mid: 0, high: 2 },
                    compression: { enabled: true, threshold: -10, ratio: 1.5, attack: 0.01, release: 0.1 }
                }
              }
        };
    }

    /**
     * Get preset data for a specific instrument
     * @param {string} instrumentName - Name of the instrument
     * @returns {object|null} Preset data or null if not found
     */
    getPreset(instrumentName) {
        return this.presets[instrumentName] || null;
    }

    /**
     * Get sample URLs for a specific instrument
     * @param {string} instrumentName - Name of the instrument
     * @returns {object} Sample URL mapping
     */
    getSampleUrls(instrumentName) {
        const preset = this.getPreset(instrumentName);
        return preset ? preset.sampleUrls : this.presets.piano.sampleUrls; // Default to piano
    }

    /**
     * Get base URL for samples
     * @param {string} instrumentName - Name of the instrument
     * @returns {string} Base URL for samples
     */
    getBaseUrl(instrumentName) {
        const preset = this.getPreset(instrumentName);
        return preset ? preset.baseUrl : this.presets.piano.baseUrl;
    }

    /**
     * Create an envelope control with instrument-appropriate settings
     * @param {string} instrumentName - Name of the instrument
     * @returns {EnvelopeControl} Configured envelope control
     */
    createEnvelope(instrumentName) {
        const preset = this.getPreset(instrumentName);
        const settings = preset ? preset.envelopeSettings : this.presets.piano.envelopeSettings;
        
        console.log(`🎛️ Creating ${instrumentName} envelope:`, settings);
        return new EnvelopeControl(settings);
    }

    /**
     * Get all available instrument names
     * @returns {string[]} Array of instrument names
     */
    getAvailableInstruments() {
        return Object.keys(this.presets);
    }

    /**
     * Get instrument display name
     * @param {string} instrumentName - Name of the instrument
     * @returns {string} Display name
     */
    getDisplayName(instrumentName) {
        const preset = this.getPreset(instrumentName);
        return preset ? preset.name : 'Unknown Instrument';
    }

    /**
     * Add or update an instrument preset
     * @param {string} instrumentName - Name of the instrument
     * @param {object} presetData - Preset configuration
     */
    addPreset(instrumentName, presetData) {
        this.presets[instrumentName] = presetData;
        console.log(`📝 Added preset for ${instrumentName}`);
    }
}

// Create a singleton instance
export const Instrument = new InstrumentControl();

// ===================================================================
// Audio State Management
// ===================================================================

export function initializeAudioState() {
  if (!pianoState.audioStatus) {
    pianoState.audioStatus = 'uninitialized';
    pianoState.sampler = null;
  }
}

function setAudioStatus(newStatus) {
  console.log(`Audio status: ${pianoState.audioStatus} → ${newStatus}`);
  pianoState.audioStatus = newStatus;
  
  // Dispatch event for volume control to listen to
  window.dispatchEvent(new CustomEvent('audioStatusChange', {
    detail: { status: newStatus }
  }));
}

// ===================================================================
// Deferred Action Management
// ===================================================================

let deferredAction = null;

function processDeferredAction() {
  if (deferredAction) {
    console.log('Processing deferred action');
    const action = deferredAction;
    deferredAction = null;

    try {
      action();
    } catch (error) {
      console.error('Error executing deferred action:', error);
    }
  }
}

// ===================================================================
// Spectrum Management
// ===================================================================

let spectrumInitialized = false;
let spectrumActive = false;

function initializeSpectrumVisualizer() {
  try {
    const spectrumContainer = document.getElementById("spectrum");
    if (!spectrumContainer) {
      console.log("Spectrum container not found - spectrum disabled");
      return;
    }

    const spectrumOptions = {
      fftSize: 4096,
      smoothingTimeConstant: 0.8,
      canvasHeight: 120,
      backgroundColor: "#000000",
      colorScheme: "blue fire",
      showGrid: false,
      showLabels: false,
      minDb: -90,
      maxDb: -5,
      drawingThreshold: 0.2,
      enableFrequencyGain: true,
      debugMode: false,
    };

    initializeSpectrum(spectrumOptions);
    spectrumInitialized = true;

    // Connect to envelope output instead of sampler
    if (pianoState.envelope) {
      connectSpectrumToAudio(pianoState.envelope.envelope); // Connect to the actual Tone.js envelope
      console.log("Spectrum connected to envelope output");
    } else if (pianoState.sampler) {
      connectSpectrumToAudio(pianoState.sampler);
      console.log("Spectrum connected to sampler (fallback - no envelope)");
    } else {
      console.log("No audio source available for spectrum connection");
    }
  } catch (error) {
    console.error("Error initializing spectrum:", error);
    spectrumInitialized = false;
  }
}

export function startSpectrumIfReady() {
  if (spectrumInitialized && !spectrumActive) {
    startSpectrumVisualization();
    spectrumActive = true;
    console.log("Spectrum visualization started from audioManager");
  }
}

// ===================================================================
// Audio Initialization
// ===================================================================

async function initializeAudio() {
    let timeoutId;
    try {
        setAudioStatus('loading');
        console.log("InitializeAudio: Starting audio initialization");

        const overallTimeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error("Audio initialization timed out after 15 seconds."));
            }, 15000);
        });

        await Promise.race([
            (async () => {
                // Stage 1: Attempt to unlock audio
                console.log("Attempting audio unlock strategies");
                await attemptMultipleAudioUnlocks();

                // Stage 2: Initialize Tone.js with retry logic
                await initializeToneWithRetry();

                // Stage 3: Create instrument-specific sampler and envelope
                console.log("Creating and configuring sampler...");
                
                // Get current instrument (default to piano)
                const currentInstrument = pianoState.instrument || 'piano';

                // Create instrument-specific envelope
                pianoState.envelope = Instrument.createEnvelope(currentInstrument);

                // Get instrument-specific sample URLs and base URL
                const sampleUrls = Instrument.getSampleUrls(currentInstrument);
                const baseUrl = Instrument.getBaseUrl(currentInstrument);

                // Create sampler with instrument-specific settings
                pianoState.sampler = new Tone.Sampler({
                    urls: sampleUrls,
                    baseUrl: baseUrl,
                    onload: () => console.log(`🎵 All ${currentInstrument} samples loaded successfully.`),
                    onerror: (error) => console.error("Sample loading error:", error)
                });

                // Connect sampler -> envelope -> destination
                pianoState.envelope.connect(pianoState.sampler);
                console.log('🎛️ Current envelope settings:', pianoState.envelope.getSettings());

                await Tone.loaded();

                // Stage 4: Final setup and validation
                pianoState.ctxStarted = true;
                pianoState.samplerReady = true;
                initializeSpectrumVisualizer();
                startSpectrumIfReady();

                const isValid = await validateAudioSystem();
                if (!isValid) {
                    throw new Error("Audio system validation failed after setup.");
                }
            })(),
            overallTimeoutPromise
        ]);

        // Success Path
        clearTimeout(timeoutId);
        setAudioStatus('ready');
        processDeferredAction();

        const instrument = document.getElementById("instrument");
        if (instrument) {
            instrument.focus();
        }
        window.dispatchEvent(new Event('audioReady'));
        return true;

    } catch (error) {
        // Error Path
        console.error("A critical error occurred during audio initialization:", error);
        clearTimeout(timeoutId);
        setAudioStatus('error');
        deferredAction = null;
        pianoState.lastAudioError = error;
        return false;
    }
}

/**
 * Tries multiple strategies to unlock the audio context on mobile devices.
 */
async function attemptMultipleAudioUnlocks() {
    const unlockStrategies = [
        // Strategy 1: Play a silent HTML audio element
        async () => {
            const unlockAudio = document.getElementById("unlock-audio");
            if (unlockAudio) {
                try {
                    await unlockAudio.play();
                    return true;
                } catch (e) {
                    return false;
                }
            }
            return false;
        },
        // Strategy 2: Create and play a silent buffer with the Web Audio API
        async () => {
            try {
                const audioContext = new(window.AudioContext || window.webkitAudioContext)();
                if (audioContext.state === 'suspended') {
                   await audioContext.resume();
                }
                const buffer = audioContext.createBuffer(1, 1, 22050);
                const source = audioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(audioContext.destination);
                source.start(0);
                // Close the temporary context to conserve resources
                setTimeout(() => audioContext.close(), 500);
                return true;
            } catch (e) {
                console.warn("Unlock Strategy: Web Audio API unlock failed.", e.name);
                return false;
            }
        }
    ];

    for (const strategy of unlockStrategies) {
        if (await strategy()) {
            return; // Exit as soon as one strategy succeeds
        }
    }
    console.warn("All audio unlock strategies failed. Proceeding with Tone.start() as a last resort.");
}

/**
 * Attempts to start Tone.js, retrying on failure.
 * @param {number} maxRetries - The maximum number of attempts.
 */
async function initializeToneWithRetry(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await Tone.start();
            console.log(`Tone.js started successfully on attempt ${attempt}.`);

            // Handle specific mobile browser state where context is 'interrupted'
            if (Tone.context.state === 'interrupted') {
                console.log("Context was interrupted, attempting resume...");
                await Tone.context.resume();
            }

            // Final check to ensure the context is running
            if (Tone.context.state !== 'running') {
                throw new Error(`Audio context is in an unexpected state: ${Tone.context.state}`);
            }

            return; // Success, exit the loop

        } catch (error) {
            console.warn(`Tone.js start attempt ${attempt} of ${maxRetries} failed:`, error);
            if (attempt === maxRetries) {
                throw new Error("Failed to start Tone.js after multiple retries.");
            }
            // Wait with an increasing backoff before the next retry
            await new Promise(resolve => setTimeout(resolve, 300 * attempt));
        }
    }
}

async function validateAudioSystem() {
  try {
    if (Tone.context.state !== 'running') {
      console.error("Validation failed: Context not running");
      return false;
    }
    if (!pianoState.sampler) {
      console.error("Validation failed: No sampler");
      return false;
    }
    return true;
  } catch (error) {
    console.error("Audio validation error:", error);
    return false;
  }
}

// ===================================================================
// User Interaction Handlers
// ===================================================================

export async function unlockAndExecute(newAction, replaceExisting = true) {
  console.log('UnlockAndExecute called, current status:', pianoState.audioStatus);

  if (Tone.context && Tone.context.state !== 'running') {
    console.log(`Attempting to resume AudioContext. Current state: ${Tone.context.state}`);
    try {
      await Tone.context.resume();
      console.log(`AudioContext resumed. New state: ${Tone.context.state}`);
    } catch (e) {
      console.warn("Failed to resume AudioContext during unlock:", e);
    }
  }

  if (pianoState.audioStatus === 'ready') {
    console.log('Audio already ready, executing action immediately');
    try {
      newAction();
      return true;
    } catch (error) {
      console.error('Error executing immediate action:', error);
      return false;
    }
  }

  if (replaceExisting || !deferredAction) {
    deferredAction = newAction;
    console.log(replaceExisting ? 'Deferred action replaced' : 'Deferred action stored');
  } else {
    console.log('Deferred action ignored - one already pending');
    return false;
  }

  if (pianoState.audioStatus === 'loading') {
    console.log('Audio currently loading, action deferred');
    return new Promise((resolve) => {
      const checkReady = setInterval(() => {
        if (pianoState.audioStatus === 'ready') {
          clearInterval(checkReady);
          resolve(true);
        } else if (pianoState.audioStatus === 'error') {
          clearInterval(checkReady);
          deferredAction = null;
          resolve(false);
        }
      }, 50);
    });
  }

  console.log('Starting audio initialization with deferred action');
  const success = await initializeAudio();

  if (!success) {
    deferredAction = null;
  }

  return success;
}

export function initializeAudioControls() {
  const volumeSlider = document.getElementById('volumeSlider');
  
  if (volumeSlider) {
    // Convert 0-100 range to dB range (-20 to 0)
    function percentToDb(percent) {
      if (percent === 0) return -Infinity; // Complete silence
      return (percent / 100) * 20 - 20; // Maps 100% to 0dB, 1% to -19.8dB
    }

    // Restore saved volume on load
    const savedVolume = localStorage.getItem('piano-volume') || '75';
    volumeSlider.value = savedVolume;
    const dbValue = percentToDb(parseFloat(savedVolume));
    Tone.Destination.volume.value = dbValue;

    // Handle volume changes
    volumeSlider.addEventListener('input', (e) => {
      const percent = parseFloat(e.target.value);
      const dbValue = percentToDb(percent);
      Tone.Destination.volume.value = dbValue;
      
      // Save volume setting
      localStorage.setItem('piano-volume', percent.toString());
      
      console.log(`Global volume set to: ${percent}% (${dbValue.toFixed(1)} dB)`);
    });
  }
}

// ===================================================================
// Public API
// ===================================================================

export function initializeAudioManager() {
  initializeAudioState();
  console.log("Audio manager initialized");
}

export function isAudioReady() {
  return pianoState.audioStatus === 'ready';
}

// ===================================================================
// Default Export
// ===================================================================

export default {
  initializeAudioManager,
  initializeAudioState,
  unlockAndExecute,
  isAudioReady,
  startSpectrumIfReady,
};