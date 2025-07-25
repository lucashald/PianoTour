// audioManager.js - Stripped Version (No Gate, No Loading Cursor)
// Bare minimum for audio initialization and single deferred action

// ===================================================================
// Imports
// ===================================================================

import { pianoState } from "./appState.js";
// Tone is loaded globally via script tag

// Add these imports with your other imports at the top of audioManager.js
import {
  initializeSpectrum,
  connectSpectrumToAudio,
  startSpectrumVisualization,
  stopSpectrumVisualization,
} from './spectrum.js';
// ===================================================================
// Audio State Management
// ===================================================================

/**
 * Initialize audio state in pianoState if not already present
 */
export function initializeAudioState() {
  if (!pianoState.audioStatus) {
    pianoState.audioStatus = 'uninitialized';
    pianoState.sampler = null;
  }
}

/**
 * Transition to a new audio status (Gate and cursor logic removed)
 * @param {string} newStatus - The new status to transition to
 */
function setAudioStatus(newStatus) {
  console.log(`Audio status: ${pianoState.audioStatus} → ${newStatus}`);
  pianoState.audioStatus = newStatus;
  // No updateGateVisibility or setLoadingCursor calls here anymore
}

// ===================================================================
// Deferred Action Management (Single Action Only)
// ===================================================================

// Store only one deferred action
let deferredAction = null;

/**
 * Process the deferred action if one exists (Loading cursor reset removed)
 */
function processDeferredAction() {
  if (deferredAction) {
    console.log('Processing deferred action');
    const action = deferredAction;
    deferredAction = null; // Clear deferred action after processing

    try {
      action();
    } catch (error) {
      console.error('Error executing deferred action:', error);
    }
  }
}

// ===================================================================
// Sample URL Configuration (FULL PIANO SAMPLES)
// ===================================================================

/**
 * Get sample URLs based on the current instrument (full piano set)
 * @returns {Object} Map of note names to sample file names
 */
function getSampleUrls() {
  // Use the same sample strategy as playbackHelpers.js for consistency
  if (pianoState.instrument === "guitar") {
    return {
      "F#2": "nylonf42.wav",
      C3: "nylonf48.wav",
      F3: "nylonf53.wav",
      "A#3": "nylonf58.wav",
      D4: "nylonf62.wav",
      "G#4": "nylonf68.wav",
      "C#5": "nylonf73.wav",
      G5: "nylonf79.wav",
    };
  } else if (pianoState.instrument === "cello") {
    return {
      "A#3": "Cello_A#3.wav",
      "A#4": "Cello_A#4.wav",
      "A#5": "Cello_A#5.wav",
      "A#6": "Cello_A#6.wav",
      E3: "Cello_E3.wav",
      E4: "Cello_E4.wav",
      E5: "Cello_E5.wav",
      E6: "Cello_E6.wav",
    };
  } else if (pianoState.instrument === "sax") {
    return {
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
    };
  } else {
    // Default piano samples (optimized set from playbackHelpers.js)
    return {
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
    };
  }
}

// ===================================================================
// Core Audio Initialization
// ===================================================================

/**
 * Initialize the audio system and load samples
 * @returns {Promise<boolean>} True if successful, false if an error occurred
 */
async function initializeAudio() {
  let timeoutId;
  try {
    setAudioStatus('loading');
    console.log("InitializeAudio: Status set to loading. Starting Tone.start()");

    // Set a timeout for the entire initialization process
    const overallTimeoutPromise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error("Audio initialization timed out after 15 seconds."));
        }, 15000); // 15 seconds overall timeout
    });

    // Race the actual initialization against the timeout
    await Promise.race([
        (async () => {
            // Play silent audio to unlock iOS (if element exists)
            const unlockAudio = document.getElementById("unlock-audio");
            if (unlockAudio) {
                try {
                    await unlockAudio.play();
                } catch (e) {
                    console.warn("Silent audio play failed, continuing anyway:", e);
                }
            }

            // Start Tone.js audio context
            await Tone.start();
            console.log("Tone.js audio context started. State:", Tone.context.state);

            // Handle iOS-specific issues
            if (Tone.context.state === 'interrupted') {
                console.log("Context interrupted, attempting resume...");
                await Tone.context.resume();
                console.log("Context resume attempted. New state:", Tone.context.state);
            }

            // Verify context is truly running
            if (Tone.context.state !== 'running') {
                throw new Error(`Audio context in unexpected state: ${Tone.context.state}`);
            }

            // Create and configure sampler with full sample set
            const sampleUrls = getSampleUrls();
            pianoState.sampler = new Tone.Sampler({
                urls: sampleUrls,
                release: 1,
                baseUrl: "/static/samples/",
                onload: () => { console.log("All samples loaded successfully."); },
                onerror: (error) => { console.error("Sample loading error:", error); }
            }).toDestination();

            // Wait for all samples to load
            await Tone.loaded();
            console.log("Sampler is ready!");

            // Set flags to match playbackHelpers.js expectations
            pianoState.ctxStarted = true;
            pianoState.samplerReady = true;
            pianoState.isUnlocked = true;

            // Initialize spectrum visualizer
            initializeSpectrumVisualizer();

            // Perform final validation
            const isValid = await validateAudioSystem();
            if (!isValid) {
                throw new Error("Audio validation failed");
            }

            return true; // Indicate success for Promise.race
        })(),
        overallTimeoutPromise // The timeout promise
    ]);

    // If we reach here, initialization was successful before timeout
    setAudioStatus('ready');
    processDeferredAction(); // Execute the deferred action

    // Focus the instrument for keyboard input
    const instrument = document.getElementById("instrument");
    if (instrument) {
      instrument.focus();
    }

    // Dispatch ready event
    window.dispatchEvent(new Event('audioReady'));

    return true;

  } catch (error) {
    console.error("Audio initialization failed:", error);
    setAudioStatus('error'); // Set status to error

    deferredAction = null; // Clear deferred action on error
    pianoState.lastAudioError = error;
    return false;
  } finally {
    if (timeoutId) {
        clearTimeout(timeoutId);
    }
  }
}


// Add these variables near the top with other module variables
let spectrumInitialized = false;
let spectrumActive = false;

// Update the initializeSpectrumVisualizer function to set the flag:
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
      enableFrequencyGain: true,
      debugMode: false,
    };

    initializeSpectrum(spectrumOptions);
    spectrumInitialized = true; // ← Add this line

    // Connect to the sampler if it exists
    if (pianoState.sampler) {
      connectSpectrumToAudio(pianoState.sampler);
      console.log("Spectrum connected to piano sampler");
    }
  } catch (error) {
    console.error("Error initializing spectrum:", error);
    spectrumInitialized = false; // ← Add this line
  }
}

// Add these new functions for spectrum control:
export function startSpectrumIfReady() {
  if (spectrumInitialized && !spectrumActive) {
    startSpectrumVisualization();
    spectrumActive = true;
  }
}

export function stopSpectrumIfActive() {
  if (spectrumActive) {
    stopSpectrumVisualization();
    spectrumActive = false;
  }
}

/**
 * Validate that the audio system is truly ready
 * @returns {Promise<boolean>}
 */
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
// User Interaction Handlers (PRODUCTION VERSION)
// ===================================================================

/**
 * Unlock audio and execute a deferred action
 * @param {Function} newAction - Action to execute once audio is ready
 * @param {boolean} replaceExisting - Whether to replace existing deferred action (default: true)
 * @returns {Promise<boolean>} Whether the action was executed
 */
export async function unlockAndExecute(newAction, replaceExisting = true) {
  console.log('UnlockAndExecute called, current status:', pianoState.audioStatus);

  // Aggressive Tone.context resume attempt on every interaction
  if (Tone.context && Tone.context.state !== 'running') {
      console.log(`Attempting to resume AudioContext. Current state: ${Tone.context.state}`);
      try {
          await Tone.context.resume();
          console.log(`AudioContext resumed. New state: ${Tone.context.state}`);
      } catch (e) {
          console.warn("Failed to resume AudioContext during unlock:", e);
      }
  }

  // If already ready, just run the action
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

  // Store deferred action (replacing any existing one by default)
  if (replaceExisting || !deferredAction) {
    deferredAction = newAction;
    console.log(replaceExisting ? 'Deferred action replaced' : 'Deferred action stored');
  } else {
    console.log('Deferred action ignored - one already pending');
    return false;
  }

  // No setLoadingCursor call here anymore

  // If currently loading, just wait
  if (pianoState.audioStatus === 'loading') {
    console.log('Audio currently loading, action deferred');
    return new Promise((resolve) => {
      const checkReady = setInterval(() => {
        if (pianoState.audioStatus === 'ready') {
          clearInterval(checkReady);
          resolve(true);
        } else if (pianoState.audioStatus === 'error') {
          clearInterval(checkReady);
          deferredAction = null; // Clear deferred action on error
          resolve(false);
        }
      }, 50);
    });
  }

  // Initialize audio
  console.log('Starting audio initialization with deferred action');
  const success = await initializeAudio();

  if (!success) {
    deferredAction = null; // Clear deferred action on error
  }

  return success;
}

// ===================================================================
// Public API
// ===================================================================

/**
 * Initialize the audio manager system (stripped of gate/keyboard/iOS monitor/cursor)
 */
export function initializeAudioManager() {
  initializeAudioState();
  console.log("Audio manager initialized (stripped version, no gate, no cursor)");
}

/**
 * Check if audio is fully ready
 * @returns {boolean}
 */
export function isAudioReady() {
  return pianoState.audioStatus === 'ready';
}

// ===================================================================
// Exports Summary
// ===================================================================

export default {
  initializeAudioManager,
  initializeAudioState,
  unlockAndExecute,
  isAudioReady,
  startSpectrumIfReady,  // ← Add this
  stopSpectrumIfActive,  // ← Add this
};