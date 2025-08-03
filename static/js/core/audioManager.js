// audioManager.js - Enhanced with unlock status persistence

import {
  connectSpectrumToAudio,
  initializeSpectrum,
  startSpectrumVisualization
} from '../ui/spectrum.js';
import { pianoState } from "./appState.js";

// ===================================================================
// Audio Unlock Status Persistence (Internal)
// ===================================================================

const UNLOCK_KEY = 'pianoTourAudioUnlocked';

/**
 * Check if audio was previously unlocked
 * @returns {boolean}
 */
function wasAudioPreviouslyUnlocked() {
  try {
    const unlocked = localStorage.getItem(UNLOCK_KEY);
    return unlocked === 'true';
  } catch (error) {
    console.error('Failed to check unlock status:', error);
    return false;
  }
}

/**
 * Mark audio as unlocked
 */
function markAudioAsUnlocked() {
  try {
    localStorage.setItem(UNLOCK_KEY, 'true');
    localStorage.setItem(UNLOCK_KEY + '_timestamp', Date.now().toString());
    console.log('Audio marked as unlocked');
  } catch (error) {
    console.error('Failed to save unlock status:', error);
  }
}

/**
 * Check if unlock status is recent (within 24 hours)
 * @returns {boolean}
 */
function isUnlockStatusFresh() {
  try {
    if (!wasAudioPreviouslyUnlocked()) return false;

    const timestamp = localStorage.getItem(UNLOCK_KEY + '_timestamp');
    if (!timestamp) return false;

    const unlockTime = parseInt(timestamp);
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    return (now - unlockTime) < oneDay;
  } catch (error) {
    console.error('Failed to check unlock freshness:', error);
    return false;
  }
}

/**
 * Clear unlock status (for testing or reset)
 */
function clearUnlockStatus() {
  try {
    localStorage.removeItem(UNLOCK_KEY);
    localStorage.removeItem(UNLOCK_KEY + '_timestamp');
    console.log('Audio unlock status cleared');
  } catch (error) {
    console.error('Failed to clear unlock status:', error);
  }
}

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
// Sample URL Configuration
// ===================================================================

function getSampleUrls() {
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
      enableFrequencyGain: true,
      debugMode: false,
    };

    initializeSpectrum(spectrumOptions);
    spectrumInitialized = true;

    if (pianoState.sampler) {
      connectSpectrumToAudio(pianoState.sampler);
      console.log("Spectrum connected to piano sampler");
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

/**
 * Simplified initialization that runs the full unlock process every time.
 * Assumes a first-time visitor for debugging purposes.
 */
async function initializeAudio() {
    let timeoutId;
    try {
        setAudioStatus('loading');
        console.log("InitializeAudio: Starting UNCONDITIONAL audio initialization for debugging.");

        // Create a global timeout for the entire process
        const overallTimeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error("Audio initialization timed out after 15 seconds."));
            }, 15000);
        });

        // Race the main initialization against the timeout
        await Promise.race([
            (async () => {
                // Stage 1: Always attempt to unlock audio.
                console.log("Forcing multiple unlock strategies for debugging.");
                await attemptMultipleAudioUnlocks();

                // Stage 2: Initialize Tone.js with retry logic.
                await initializeToneWithRetry();

                // Stage 3: Create sampler and wait for samples to load.
                console.log("Creating and configuring sampler...");
                const sampleUrls = getSampleUrls();
                pianoState.sampler = new Tone.Sampler({
                    urls: sampleUrls,
                    release: 1,
                    baseUrl: "/static/samples/",
                    onload: () => console.log("All samples loaded successfully."),
                    onerror: (error) => console.error("Sample loading error:", error)
                }).toDestination();

                await Tone.loaded();
                console.log("Sampler is ready!");

                // Stage 4: Final setup and validation.
                pianoState.ctxStarted = true;
                pianoState.samplerReady = true;
                initializeSpectrumVisualizer();

                const isValid = await validateAudioSystem();
                if (!isValid) {
                    throw new Error("Audio system validation failed after setup.");
                }
            })(),
            overallTimeoutPromise
        ]);

        // --- Success Path ---
        clearTimeout(timeoutId);
        setAudioStatus('ready');
        initializeAudioControls();
        processDeferredAction();

        const instrument = document.getElementById("instrument");
        if (instrument) {
            instrument.focus();
        }
        window.dispatchEvent(new Event('audioReady'));
        return true;

    } catch (error) {
        // --- Error Path ---
        console.error("A critical error occurred during audio initialization:", error);
        clearTimeout(timeoutId); // Ensure timeout is cleared on error
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
        // Strategy 1: Play a silent HTML audio element.
        async () => {
            const unlockAudio = document.getElementById("unlock-audio");
            if (unlockAudio) {
                try {
                    await unlockAudio.play();
                    console.log("Unlock Strategy: Native audio element played successfully.");
                    return true;
                } catch (e) {
                    console.warn("Unlock Strategy: Native audio play failed.", e.name);
                    return false;
                }
            }
            return false;
        },
        // Strategy 2: Create and play a silent buffer with the Web Audio API.
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
                console.log("Unlock Strategy: Web Audio API buffer played successfully.");
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

            // Handle specific mobile browser state where context is 'interrupted'.
            if (Tone.context.state === 'interrupted') {
                console.log("Context was interrupted, attempting resume...");
                await Tone.context.resume();
            }

            // Final check to ensure the context is running.
            if (Tone.context.state !== 'running') {
                throw new Error(`Audio context is in an unexpected state: ${Tone.context.state}`);
            }

            return; // Success, exit the loop.

        } catch (error) {
            console.warn(`Tone.js start attempt ${attempt} of ${maxRetries} failed:`, error);
            if (attempt === maxRetries) {
                throw new Error("Failed to start Tone.js after multiple retries.");
            }
            // Wait with an increasing backoff before the next retry.
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
  const volumeSlider = document.getElementById('volumeSlider'); // Changed from 'volumeControl'
  
  if (volumeSlider) {
    // Convert 0-100 range to dB range (-20 to 0)
    function percentToDb(percent) {
      if (percent === 0) return -Infinity; // Complete silence
      return (percent / 100) * 20 - 20; // Maps 100% to 0dB, 1% to -19.8dB
    }
    
    function dbToPercent(db) {
      if (db === -Infinity) return 0;
      return Math.max(0, Math.min(100, (db + 20) / 20 * 100));
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

/**
 * Get unlock status information (for UI updates)
 * @returns {Object} Unlock status info
 */
export function getUnlockStatus() {
  return {
    wasPreviouslyUnlocked: wasAudioPreviouslyUnlocked(),
    isFreshUnlock: isUnlockStatusFresh(),
    canOptimizeUnlock: isUnlockStatusFresh()
  };
}

/**
 * Reset unlock status (for testing)
 */
export function resetUnlockStatus() {
  clearUnlockStatus();
  console.log('Audio unlock status reset');
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
  getUnlockStatus,
  resetUnlockStatus,
};