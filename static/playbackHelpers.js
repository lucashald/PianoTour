// playbackHelpers.js
// This file contains all functions related to audio playback using Tone.js,
// now delegating core audio initialization to audioManager.js.

// ===================================================================
// Imports
// ===================================================================

// Import the centralized state object
import { pianoState } from "./appState.js";

// Import musical data and constants
import {
  NOTES_BY_MIDI,
  NOTES_BY_NAME,
  UNIFIED_CHORD_DEFINITIONS,
  diatonicChordQualities,
  chordDefinitions,
  DURATION_THRESHOLDS,
  notesByMidiKeyAware,
} from "./note-data.js";

// Import UI painting functions (still needed as they are UI-specific)
import {
  paintChord,
  paintChordOnTheFly,
  getChord,
} from "./instrumentHelpers.js"; // This might need adjustment if instrumentHelpers also calls startAudio directly
import { writeNote } from "./scoreWriter.js";

// Import spectrum visualization functions (still handled here for now)
import {
  initializeSpectrum,
  connectSpectrumToAudio,
  startSpectrumVisualization,
  stopSpectrumVisualization,
  destroySpectrum,
} from "./spectrum.js";

// IMPORT audioManager for its core functions
import audioManager from "./audioManager.js"; // <--- NEW IMPORT

// Import MIDI functions (still handled here)
import { handleMidiNoteOn, handleMidiNoteOff } from "./midi-controller.js";

// ===================================================================
// Module Variables
// ===================================================================

// Spectrum state tracking
let spectrumInitialized = false;
let spectrumActive = false;

// ===================================================================
// Core Audio Functions (Refactored)
// ===================================================================

/**
 * Ensures the Tone.js audio context is started and the sampler is loaded.
 * This function now delegates to audioManager.unlockAndExecute.
 * It does NOT directly start Tone.js or load samples.
 * @returns {Promise<boolean>} True if successful, false if an error occurred.
 */
export async function startAudio() {
  console.log("playbackHelpers: startAudio called, delegating to audioManager.unlockAndExecute");

  // Define a dummy action that runs when audioManager confirms readiness.
  // The actual "action" of playing a note is handled by trigger(), startKey(), etc.,
  // which will be called AFTER unlockAndExecute resolves.
  const dummyAction = () => {
    console.log("playbackHelpers: audioManager reported ready!");
    // At this point, Tone.js is started and the sampler is loaded.
    pianoState.samplerReady = true; // Update local state here based on audioManager's success
    initializeSpectrumVisualizer(); // Initialize spectrum now that audio context is active
  };

  // Use audioManager's unlockAndExecute. It will handle the Tone.start(),
  // sampler loading, and ensuring the audio context is running.
  const success = await audioManager.unlockAndExecute(dummyAction);

  // Note: pianoState.isUnlocked status will be managed by audioManager's audioStatus
  // For compatibility, you might set a derived state here,
  // or refactor pianoState.isUnlocked to be tied directly to audioManager's isAudioReady.
  pianoState.isUnlocked = audioManager.isAudioReady(); // Set based on audioManager's determined state

  return success;
}


/**
 * Triggers or releases notes on the Tone.js sampler.
 * This function now assumes pianoState.sampler is available because startAudio
 * (via audioManager) ensures it.
 * @param {string|string[]} note - The note name(s) (e.g., "C4", ["C4", "E4", "G4"]).
 * @param {boolean} on - True to trigger attack, false to trigger release.
 * @param {number} [velocity=100] - MIDI velocity (1-127).
 */
export function trigger(note, on, velocity = 100) {
  // Check if audioManager's state indicates sampler is ready
  if (!audioManager.isAudioReady() || !pianoState.sampler) {
    console.warn("Audio not ready or sampler not initialized. Cannot trigger note:", note);
    return;
  }

  if (on) {
    pianoState.sampler.triggerAttack(note, Tone.now(), velocity / 127);
    startSpectrumIfReady();
  } else {
    pianoState.sampler.triggerRelease(note);
    const hasActiveNotes =
      Object.keys(pianoState.activeNotes).length > 0 ||
      Object.keys(pianoState.activeDiatonicChords).length > 0;
    if (!hasActiveNotes) {
      setTimeout(() => {
        const stillHasActiveNotes =
          Object.keys(pianoState.activeNotes).length > 0 ||
          Object.keys(pianoState.activeDiatonicChords).length > 0;
        if (!stillHasActiveNotes) {
          stopSpectrumIfActive();
        }
      }, 100);
    }
  }
}

/**
 * Starts a single piano key's sound and visual feedback.
 * @param {HTMLElement} el - The SVG element of the key.
 * @param {number} [velocity=100] - MIDI velocity.
 */
export function startKey(el, velocity = 100) {
  const midi = el.dataset.midi;
  console.log("startKey: midi =", midi);
  if (!midi || el.dataset.playing) return;

  const noteInfo = notesByMidiKeyAware(midi);
  console.log("startKey: noteInfo =", noteInfo);
  if (!noteInfo) return;

  const noteName = noteInfo.name;
  console.log("startKey: noteName =", noteName);
  console.log("startKey: calling trigger with", noteName);

  el.dataset.playing = "note";
  el.classList.add("pressed");
  trigger(noteName, true, velocity);

  const spelling = pianoState.keySignatureType === "b" ? "flat" : "sharp";
  pianoState.activeNotes[midi] = { el, spelling, startTime: performance.now() };
}

/**
 * Stops a single piano key's sound and visual feedback.
 * @param {HTMLElement} el - The SVG element of the key.
 */
export function stopKey(el) {
  const midi = el.dataset.midi;
  if (!midi || !el.dataset.playing) return;
  const activeNote = pianoState.activeNotes[midi];
  if (!activeNote) return;

  const noteInfo = notesByMidiKeyAware(midi);
  const noteNameToTrigger = noteInfo.name;

  trigger(noteNameToTrigger, false);
  delete el.dataset.playing;
  el.classList.remove("pressed");
  delete pianoState.activeNotes[midi];
}

// ===================================================================
// NEW SPECTRUM HELPER FUNCTIONS (Adjusted connection to sampler)
// ===================================================================

/**
 * Initializes the spectrum visualizer
 */
function initializeSpectrumVisualizer() {
  // Only initialize if audioManager reports ready and Tone.js context is running
  if (!audioManager.isAudioReady() || Tone.context.state !== 'running') {
      console.warn("Skipping Spectrum initialization: Audio not ready or context not running.");
      return;
  }

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

    // Connect to the sampler, which is now managed by audioManager and available in pianoState
    if (pianoState.sampler) {
      connectSpectrumToAudio(pianoState.sampler);
      console.log("Spectrum connected to piano sampler");
    } else {
      console.warn("Cannot connect spectrum: pianoState.sampler is null.");
    }
  } catch (error) {
    console.error("Error initializing spectrum:", error);
    spectrumInitialized = false;
  }
}

/**
 * Starts spectrum visualization when audio begins
 */
export function startSpectrumIfReady() {
  if (spectrumInitialized && !spectrumActive) {
    startSpectrumVisualization();
    spectrumActive = true;
  }
}

/**
 * Stops spectrum visualization when audio ends
 */
export function stopSpectrumIfActive() {
  if (spectrumActive) {
    stopSpectrumVisualization();
    spectrumActive = false;
  }
}

// ===================================================================
// Diatonic Chord Playback (Unified)
// ===================================================================

/**
 * Unified function to play a diatonic chord based on a scale degree.
 * Works for both MIDI controller and keyboard/mouse inputs.
 * @param {number} degree - The scale degree (1-7).
 * @param {string|number} key - The unique identifier for this chord instance.
 * @param {boolean} [writeToScore=true] - Whether to prepare for score writing.
 */
export function playDiatonicChord(degree, key, writeToScore = true) {
  // This function now assumes audio is ready, or relies on the caller
  // (e.g., handleKeyDown in instrumentHelpers) to ensure audio is unlocked
  // via audioManager.unlockAndExecute before calling this.
  if (!audioManager.isAudioReady() || !pianoState.sampler) {
    console.warn("Audio not ready for chord playback. Cannot play diatonic chord.");
    return;
  }

  const isInChordMode =
    pianoState.isMajorChordMode || pianoState.isMinorChordMode;
  const localMode = isInChordMode
    ? pianoState.isMajorChordMode
      ? "major"
      : "minor"
    : "major";
  const spaceMidi = pianoState.keyMap[" "];
  if (!spaceMidi && !isInChordMode) return;

  const localTonic = isInChordMode
    ? pianoState.scaleTonic
    : NOTES_BY_MIDI[spaceMidi]?.name;
  if (!localTonic) {
    console.warn("No local tonic defined to play diatonic chord.");
    return;
  }

  const qualityKey = diatonicChordQualities[localMode][degree];
  const chordDef = UNIFIED_CHORD_DEFINITIONS[qualityKey];
  if (!chordDef) {
    console.warn(`No chord definition found for qualityKey: ${qualityKey}`);
    return;
  }

  const scale = Tonal.Scale.get(
    `${Tonal.Note.pitchClass(localTonic)} ${localMode}`
  );
  if (!scale?.notes?.length) {
    console.warn(`Could not get scale for ${localTonic} ${localMode}`);
    return;
  }

  const rootPitchClassTonal = scale.notes[degree - 1];
  const intervalToRoot = Tonal.Interval.distance(
    Tonal.Note.pitchClass(localTonic),
    rootPitchClassTonal
  );
  const actualRootNoteNameWithOctave = Tonal.Note.transpose(
    localTonic,
    intervalToRoot
  );
  const specificChordKey =
    Tonal.Note.pitchClass(actualRootNoteNameWithOctave) +
    (chordDef.suffix || "");
  const predefinedChord = chordDefinitions[specificChordKey];
  let notesForPlayback = [];
  let clefForPlayback = "treble";
  let chordNameForDisplay = predefinedChord?.displayName || specificChordKey;

  if (
    !predefinedChord ||
    (!predefinedChord.treble?.length && !predefinedChord.bass?.length)
  ) {
    console.warn(
      `Predefined chord not found for ${specificChordKey}. Deriving for playback.`
    );
    const rootMidi = NOTES_BY_NAME[actualRootNoteNameWithOctave];
    if (rootMidi === undefined) return;
    notesForPlayback = chordDef.intervals
      .map((interval) => NOTES_BY_MIDI[rootMidi + interval]?.name)
      .filter(Boolean);
    if (
      notesForPlayback.length > 0 &&
      Math.min(...notesForPlayback.map((n) => NOTES_BY_NAME[n])) < 60
    ) {
      clefForPlayback = "bass";
    }
  } else {
    const tonicOctave = Tonal.Note.octave(localTonic);
    notesForPlayback =
      tonicOctave >= 4 || !predefinedChord.bass.length
        ? predefinedChord.treble
        : predefinedChord.bass;
    if (!notesForPlayback.length) {
      notesForPlayback = predefinedChord.treble.length
        ? predefinedChord.treble
        : predefinedChord.bass;
    }
    if (
      notesForPlayback.length > 0 &&
      Math.min(...notesForPlayback.map((n) => NOTES_BY_NAME[n])) < 60
    ) {
      clefForPlayback = "bass";
    }
  }

  if (notesForPlayback.length === 0) {
    console.warn(`No notes determined for playback for ${specificChordKey}.`);
    return;
  }
  
  trigger(notesForPlayback, true);
  paintChordOnTheFly({ notes: notesForPlayback });

  if (spectrumInitialized) {
    startSpectrumIfReady();
  }

  pianoState.activeDiatonicChords[key] = {
    key: specificChordKey,
    clef: clefForPlayback,
    displayName: chordNameForDisplay,
    notes: notesForPlayback,
    startTime: performance.now(),
    writeToScore,
  };
}

/**
 * Unified function to stop a diatonic chord and handle score writing.
 * @param {string|number} key - The unique identifier used when the chord was played.
 */
export function stopDiatonicChord(key) {
  const chordData = pianoState.activeDiatonicChords[key];
  if (!chordData) return;

  if (chordData.notes?.length) {
    trigger(chordData.notes, false);
  } else {
    const predefinedChord = chordDefinitions[chordData.key];
    if (predefinedChord) {
      let notesForRelease =
        chordData.clef === "bass" && predefinedChord.bass?.length
          ? predefinedChord.bass
          : predefinedChord.treble;
      if (!notesForRelease?.length) {
        notesForRelease = predefinedChord.treble?.length
          ? predefinedChord.treble
          : predefinedChord.bass;
      }
      if (notesForRelease?.length) {
        trigger(notesForRelease, false);
      }
    }
  }

  setTimeout(() => {
    const hasActiveNotes =
      Object.keys(pianoState.activeNotes).length > 0 ||
      Object.keys(pianoState.activeDiatonicChords).length > 0;
    if (!hasActiveNotes) {
      stopSpectrumIfActive();
    }
  }, 100);

  if (chordData.writeToScore) {
    console.log("Writing chord to score:", chordData);
    const heldTime = performance.now() - chordData.startTime;

    let duration = "q";
    if (heldTime >= DURATION_THRESHOLDS.w) duration = "w";
    else if (heldTime >= DURATION_THRESHOLDS["h."]) duration = "h.";
    else if (heldTime >= DURATION_THRESHOLDS.h) duration = "h";
    else if (heldTime >= DURATION_THRESHOLDS["q."]) duration = "q.";
    
    if (chordData.notes && chordData.notes.length > 0) {
      console.log("About to write note:", {
        clef: chordData.clef,
        duration,
        notes: chordData.notes,
        chordName: chordData.displayName,
      });
      writeNote({
        clef: chordData.clef,
        duration,
        notes: chordData.notes,
        chordName: chordData.displayName,
      });
    } else {
      console.warn("No notes found in chord data for score writing");
    }
  }

  if (
    Object.keys(pianoState.activeDiatonicChords).length <= 1 &&
    (pianoState.isMajorChordMode || pianoState.isMinorChordMode)
  ) {
    paintChord();
  }

  delete pianoState.activeDiatonicChords[key];
}

// ===================================================================
// Keyboard/Mouse Diatonic Chord Handlers (Updated)
// ===================================================================

/**
 * Handles diatonic chord playing from keyboard numbers 1-7 or mouse clicks.
 * @param {number} degree - The scale degree (1-7).
 * @param {string} inputSource - Identifier for the input source (e.g., 'keyboard_1', 'mouse_click').
 */
export function playDiatonicChordFromUI(degree, inputSource) {
  playDiatonicChord(degree, inputSource, true);
}

/**
 * Handles diatonic chord stopping from keyboard numbers 1-7 or mouse clicks.
 * @param {string} inputSource - Identifier for the input source used when starting the chord.
 */
export function stopDiatonicChordFromUI(inputSource) {
  stopDiatonicChord(inputSource);
}

// ===================================================================
// Cleanup Function
// ===================================================================

/**
 * Cleans up spectrum resources when the app is being destroyed
 */
export function cleanupSpectrum() {
  if (spectrumInitialized) {
    destroySpectrum();
    spectrumInitialized = false;
    spectrumActive = false;
  }
}

// Optional: Add window beforeunload event to clean up
window.addEventListener("beforeunload", cleanupSpectrum);