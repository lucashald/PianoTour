// audioManager.js
// Unified audio initialization and gate management system with single deferred action

// ===================================================================
// Imports
// ===================================================================

import { pianoState } from "./appState.js";
// Tone is loaded globally via script tag

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
 * Get the gate element from DOM
 * @returns {HTMLElement|null}
 */
function getGateElement() {
  return document.getElementById('gate');
}

/**
 * Check if gate should be visible based on audio status
 * @returns {boolean}
 */
export function isGateVisible() {
  return pianoState.audioStatus !== 'ready';
}

/**
 * Check if audio is fully ready
 * @returns {boolean}
 */
export function isAudioReady() {
  return pianoState.audioStatus === 'ready';
}

/**
 * Update gate visibility based on current audio status
 */
function updateGateVisibility() {
  const gate = getGateElement();
  if (!gate) return;

  if (isGateVisible()) {
    // Update gate content based on status
    if (pianoState.audioStatus === 'loading') {
      gate.innerHTML = '<p>Loading instrument samples...</p>';
    } else if (pianoState.audioStatus === 'error') {
      gate.innerHTML = '<p>Audio initialization failed. <button onclick="window.retryAudio()">Try Again</button></p>';
    } else {
      gate.innerHTML = '<p>Click or press Space to begin</p>';
    }
    gate.style.display = 'flex';
  } else {
    gate.remove();
  }
}

/**
 * Transition to a new audio status
 * @param {string} newStatus - The new status to transition to
 */
function setAudioStatus(newStatus) {
  console.log(`Audio status: ${pianoState.audioStatus} → ${newStatus}`);
  pianoState.audioStatus = newStatus;
  updateGateVisibility();

  // Update loading cursor
  if (newStatus === 'loading' && deferredAction) {
    setLoadingCursor(true);
  } else {
    setLoadingCursor(false);
  }
}

// ===================================================================
// Deferred Action Management (Single Action Only)
// ===================================================================

// Store only one deferred action
let deferredAction = null;

/**
 * Set loading cursor state
 * @param {boolean} loading - Whether to show loading cursor
 */
function setLoadingCursor(loading) {
  if (loading) {
    document.body.style.cursor = 'wait';
    // Also set on specific elements that might override body cursor
    const instrument = document.getElementById('instrument');
    if (instrument) instrument.style.cursor = 'wait';
  } else {
    document.body.style.cursor = '';
    const instrument = document.getElementById('instrument');
    if (instrument) instrument.style.cursor = '';
  }
}

/**
 * Process the deferred action if one exists
 */
function processDeferredAction() {
  if (deferredAction) {
    console.log('Processing deferred action');
    const action = deferredAction;
    deferredAction = null;
    setLoadingCursor(false);

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

/**
 * Get sample URLs based on the current instrument
 * @returns {Object} Map of note names to sample file names
 */
function getSampleUrls() {
  const instrument = pianoState.instrument || 'piano';

  switch (instrument) {
    case 'guitar':
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

    case 'cello':
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

    case 'sax':
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

    default: // piano
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
  try {
    // Transition to loading state
    setAudioStatus('loading');

    // Play silent audio to unlock iOS
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
    console.log("Tone.js audio context started");

    // Handle iOS-specific issues
    if (Tone.context.state === 'interrupted') {
      console.log("iOS interrupted state detected, attempting to resume...");
      await Tone.context.resume();
    }

    // Verify context is truly running
    if (Tone.context.state !== 'running') {
      throw new Error(`Audio context in unexpected state: ${Tone.context.state}`);
    }

    // Create and configure sampler
    const sampleUrls = getSampleUrls();
    pianoState.sampler = new Tone.Sampler({
      urls: sampleUrls,
      release: 1,
      baseUrl: "/static/samples/",
      onload: () => {
        console.log("All samples loaded successfully");
      },
      onerror: (error) => {
        console.error("Sample loading error:", error);
      }
    }).toDestination();

    // Wait for all samples to load
    await Tone.loaded();
    console.log("Sampler is ready!");

    // Perform final validation
    const isValid = await validateAudioSystem();
    if (!isValid) {
      throw new Error("Audio validation failed");
    }

    // Everything successful - transition to ready
    setAudioStatus('ready');

    // Process any deferred action
    processDeferredAction();

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
    setAudioStatus('error');

    // Clear deferred action on error
    deferredAction = null;
    setLoadingCursor(false);

    // Store error for potential retry
    pianoState.lastAudioError = error;

    return false;
  }
}

/**
 * Validate that the audio system is truly ready
 * @returns {Promise<boolean>}
 */
async function validateAudioSystem() {
  try {
    // Check context state
    if (Tone.context.state !== 'running') {
      console.error("Validation failed: Context not running");
      return false;
    }

    // Check sampler exists and is connected
    if (!pianoState.sampler) {
      console.error("Validation failed: No sampler");
      return false;
    }

    // Optional: Test silent note to ensure audio path works
    // Commented out to avoid any sound during init
    // pianoState.sampler.triggerAttackRelease("C2", "32n", undefined, 0.001);

    return true;

  } catch (error) {
    console.error("Audio validation error:", error);
    return false;
  }
}

// ===================================================================
// User Interaction Handlers
// ===================================================================

/**
 * Handle user interaction to unlock audio
 * @param {Event} event - The triggering event
 */
export async function handleAudioUnlock(event) {
  // Prevent default if needed
  if (event && event.preventDefault) {
    event.preventDefault();
  }

  // Don't do anything if already initializing or ready
  if (pianoState.audioStatus === 'loading' || pianoState.audioStatus === 'ready') {
    return;
  }

  // Initialize audio
  const success = await initializeAudio();

  return success;
}

/**
 * Unlock audio and execute a deferred action
 * @param {Function} newAction - Action to execute once audio is ready
 * @param {boolean} replaceExisting - Whether to replace existing deferred action (default: true)
 * @returns {Promise<boolean>} Whether the action was executed
 */
export async function unlockAndExecute(newAction, replaceExisting = true) {
  console.log('UnlockAndExecute called, current status:', pianoState.audioStatus);

  // If already ready, just run the action
  if (pianoState.audioStatus === 'ready') {
    console.log('Audio already ready, executing action immediately');
    newAction();
    return true;
  }

  // Store deferred action (replacing any existing one by default)
  if (replaceExisting || !deferredAction) {
    deferredAction = newAction;
    console.log(replaceExisting ? 'Deferred action replaced' : 'Deferred action stored');
  } else {
    console.log('Deferred action ignored - one already pending');
    return false;
  }

  // Show loading cursor
  setLoadingCursor(true);

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
          deferredAction = null;
          setLoadingCursor(false);
          resolve(false);
        }
      }, 50);
    });
  }

  // Initialize audio
  console.log('Starting audio initialization with deferred action');
  const success = await initializeAudio();

  if (!success) {
    deferredAction = null;
    setLoadingCursor(false);
  }

  return success;
}

/**
 * Retry audio initialization after an error
 */
export async function retryAudioInitialization() {
  console.log("Retrying audio initialization...");

  // Reset status
  setAudioStatus('uninitialized');

  // Clear any previous error
  delete pianoState.lastAudioError;

  // Clear any deferred action
  deferredAction = null;
  setLoadingCursor(false);

  // Try again
  return handleAudioUnlock();
}

// Make retry function globally available for the error button
window.retryAudio = retryAudioInitialization;

// ===================================================================
// Gate Management
// ===================================================================

/**
 * Create and attach the gate element to the DOM
 * @param {HTMLElement} parentElement - The element to append the gate to
 */
export function createGate(parentElement) {
  // Don't create if already exists
  if (getGateElement()) return;

  const gate = document.createElement("div");
  gate.id = "gate";
  gate.tabIndex = 0;
  gate.innerHTML = '<p>Click or press Space to begin</p>';

  // Attach event listeners
  gate.addEventListener("click", handleAudioUnlock, { once: true });
  gate.addEventListener("touchstart", handleAudioUnlock, { once: true, passive: false });

  parentElement.appendChild(gate);

  // Update visibility based on current status
  updateGateVisibility();
}

/**
 * Attach keyboard listener for spacebar unlock
 */
export function attachKeyboardUnlock() {
  const handleSpaceUnlock = (event) => {
    if (event.code === 'Space' && isGateVisible()) {
      event.preventDefault();
      handleAudioUnlock(event);
    }
  };

  window.addEventListener('keydown', handleSpaceUnlock, { once: true });
}

/**
 * Attach unlock listener to additional elements (like controls)
 * @param {string} selector - CSS selector for elements
 */
export function attachControlsUnlock(selector = '.controls') {
  const controls = document.querySelector(selector);
  if (!controls) return;

  const handleControlsClick = (event) => {
    if (isGateVisible()) {
      event.preventDefault();
      handleAudioUnlock(event);
    }
  };

  controls.addEventListener('click', handleControlsClick, { once: true });
  controls.addEventListener('touchstart', handleControlsClick, { once: true, passive: false });
}

// ===================================================================
// iOS-Specific Handling
// ===================================================================

/**
 * Monitor for iOS-specific audio issues
 */
export function monitorIOSAudioState() {
  if (!Tone.context) return;

  // Monitor for sample rate changes (Bluetooth issues)
  const originalSampleRate = Tone.context.sampleRate;

  Tone.context.onstatechange = () => {
    // Handle interrupted state
    if (Tone.context.state === 'interrupted') {
      console.warn("iOS audio interrupted, attempting recovery...");
      Tone.context.resume();
    }

    // Check for sample rate changes
    if (Tone.context.sampleRate !== originalSampleRate) {
      console.warn(`Sample rate changed: ${originalSampleRate} → ${Tone.context.sampleRate}`);
      // In future, might need to recreate audio context here
    }
  };
}

// ===================================================================
// Public API
// ===================================================================

/**
 * Initialize the audio manager system
 */
export function initializeAudioManager() {
  // Initialize state
  initializeAudioState();

  // Start monitoring iOS issues
  monitorIOSAudioState();

  // Attach keyboard unlock
  attachKeyboardUnlock();

  console.log("Audio manager initialized");
}

/**
 * Clean up audio resources
 */
export function cleanupAudio() {
  // Clear any pending deferred action
  deferredAction = null;
  setLoadingCursor(false);

  if (pianoState.sampler) {
    pianoState.sampler.dispose();
    pianoState.sampler = null;
  }

  setAudioStatus('uninitialized');

  console.log('Audio resources cleaned up');
}

// ===================================================================
// Exports Summary
// ===================================================================

export default {
  // Initialization
  initializeAudioManager,
  initializeAudioState,

  // Gate management
  createGate,
  attachKeyboardUnlock,
  attachControlsUnlock,

  // Audio control
  handleAudioUnlock,
  unlockAndExecute,
  retryAudioInitialization,
  cleanupAudio,

  // State queries
  isGateVisible,
  isAudioReady,

  // iOS monitoring
  monitorIOSAudioState
};