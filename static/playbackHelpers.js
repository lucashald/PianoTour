// playbackHelpers.js
// This file contains all functions related to audio playback using Tone.js.

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
  DIATONIC_CHORD_QUALITIES,
  CHORD_DEFINITIONS,
  DURATION_THRESHOLDS,
  notesByMidiKeyAware,
  getScaleNotes,
  getPitchClass,
  getInterval,
  transposeNote,
  getOctave,
} from "./note-data.js";

// Import UI painting functions
import {
  paintChord,
  paintChordOnTheFly,
  getChord,
} from "./instrumentHelpers.js";
import { writeNote } from "./scoreWriter.js";

// Import spectrum visualization functions - SIMPLIFIED
import {
  startSpectrumVisualization,
  stopSpectrumVisualization,
} from "./spectrum.js";

import { handleMidiNoteOn, handleMidiNoteOff } from "./midi-controller.js";

import audioManager from "./audioManager.js";

// ===================================================================
// Core Audio Functions
// ===================================================================

/**
 * Initializes the Tone.js audio context, loads the sampler, removes the UI gate,
 * and sets the application state to "unlocked". This is the single, authoritative
 * function for making the app interactive.
 * @returns {Promise<boolean>} True if successful, false if an error occurred.
 */
export async function startAudio() {
  // If the app is already unlocked, do nothing.
  if (audioManager.isAudioReady()) return true;

  try {
    // Audio initialization is now handled by audioManager.initializeAudio()
    // This function will primarily be responsible for initiating that process.
    // The actual starting of Tone.js context and sampler loading is in audioManager.
    console.warn("startAudio() in playbackHelpers is deprecated. Use audioManager.unlockAndExecute() instead.");
    return await audioManager.unlockAndExecute(() => { /* no-op, just ensure audio is ready */ });
  } catch (error) {
    console.error("Error during audio initialization through playbackHelpers.startAudio:", error);
    return false; // Signal failure
  }
}

// ===================================================================
// Core Playback Functions
// ===================================================================

/**
 * Triggers or releases notes on the Tone.js sampler.
 * @param {string|string[]} note - The note name(s) (e.g., "C4", ["C4", "E4", "G4"]).
 * @param {boolean} on - True to trigger attack, false to trigger release.
 * @param {number} [velocity=100] - MIDI velocity (1-127).
 */
export function trigger(note, on, velocity = 100) {
  if (!audioManager.isAudioReady()) return;

  if (on) {
    pianoState.sampler.triggerAttack(note, Tone.now(), velocity / 127);
    startSpectrumVisualization(); // ✅ SIMPLIFIED
  } else {
    pianoState.sampler.triggerRelease(note);

    // Check if any notes are still active
    const hasActiveNotes =
      Object.keys(pianoState.activeNotes).length > 0 ||
      Object.keys(pianoState.activeDiatonicChords).length > 0;

    // Stop spectrum if no notes are active
    if (!hasActiveNotes) {
      stopSpectrumVisualization(); // ✅ Let spectrum handle its own timing
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
  const noteNameToTrigger = noteInfo.name; // Use key-signature-aware name

  trigger(noteNameToTrigger, false);
  delete el.dataset.playing;
  el.classList.remove("pressed");
  delete pianoState.activeNotes[midi];
}

export function playDiatonicChord(degree, key, writeToScore = true) {
  const isInChordMode = pianoState.isMajorChordMode || pianoState.isMinorChordMode;
  const localMode = isInChordMode
    ? pianoState.isMajorChordMode ? "major" : "minor"
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

  const qualityKey = DIATONIC_CHORD_QUALITIES[localMode][degree];
  const chordDef = UNIFIED_CHORD_DEFINITIONS[qualityKey];
  if (!chordDef) {
    console.warn(`No chord definition found for qualityKey: ${qualityKey}`);
    return;
  }

  // REPLACED: Use our scale function instead of Tonal
  const scaleNotes = getScaleNotes(getPitchClass(localTonic), localMode);
  if (!scaleNotes?.length) {
    console.warn(`Could not get scale for ${localTonic} ${localMode}`);
    return;
  }

  const rootPitchClass = scaleNotes[degree - 1];
  
  // REPLACED: Use our interval function
  const intervalSemitones = getInterval(getPitchClass(localTonic), rootPitchClass);
  
  // REPLACED: Use our transpose function  
  const actualRootNoteNameWithOctave = transposeNote(localTonic, intervalSemitones);
  
  const specificChordKey = getPitchClass(actualRootNoteNameWithOctave) + (chordDef.suffix || "");
  const predefinedChord = CHORD_DEFINITIONS[specificChordKey];
  let notesForPlayback = [];
  let clefForPlayback = "treble";
  let chordNameForDisplay = predefinedChord?.displayName || specificChordKey;

  if (!predefinedChord || (!predefinedChord.treble?.length && !predefinedChord.bass?.length)) {
    console.warn(`Predefined chord not found for ${specificChordKey}. Deriving for playback.`);
    const rootMidi = NOTES_BY_NAME[actualRootNoteNameWithOctave];
    if (rootMidi === undefined) return;
    notesForPlayback = chordDef.intervals
      .map((interval) => NOTES_BY_MIDI[rootMidi + interval]?.name)
      .filter(Boolean);
    if (notesForPlayback.length > 0 && 
        Math.min(...notesForPlayback.map((n) => NOTES_BY_NAME[n])) < 60) {
      clefForPlayback = "bass";
    }
  } else {
    // REPLACED: Use our octave function
    const tonicOctave = getOctave(localTonic);
    notesForPlayback = tonicOctave >= 4 || !predefinedChord.bass.length
      ? predefinedChord.treble
      : predefinedChord.bass;
    if (!notesForPlayback.length) {
      notesForPlayback = predefinedChord.treble.length
        ? predefinedChord.treble
        : predefinedChord.bass;
    }
    if (notesForPlayback.length > 0 && 
        Math.min(...notesForPlayback.map((n) => NOTES_BY_NAME[n])) < 60) {
      clefForPlayback = "bass";
    }
  }

  if (notesForPlayback.length === 0) {
    console.warn(`No notes determined for playback for ${specificChordKey}.`);
    return;
  }
  // Play the chord
  trigger(notesForPlayback, true);
  paintChordOnTheFly({ notes: notesForPlayback });

  // Store chord data consistently for both input methods
  pianoState.activeDiatonicChords[key] = {
    key: specificChordKey,
    clef: clefForPlayback,
    displayName: chordNameForDisplay,
    notes: notesForPlayback,
    startTime: performance.now(),
    writeToScore, // Flag to determine if this should be written to score
  };
}

/**
 * Unified function to stop a diatonic chord and handle score writing.
 * @param {string|number} key - The unique identifier used when the chord was played.
 */
export function stopDiatonicChord(key) {
  const chordData = pianoState.activeDiatonicChords[key];
  if (!chordData) return;

  // Stop the audio
  if (chordData.notes?.length) {
    trigger(chordData.notes, false);
  } else {
    // Fallback to predefined chord lookup
    const predefinedChord = CHORD_DEFINITIONS[chordData.key];
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

  // Handle score writing if enabled
  if (chordData.writeToScore) {
    console.log("Writing chord to score:", chordData);
    const heldTime = performance.now() - chordData.startTime;

    let duration = "q"; // Default to quarter note
    if (heldTime >= DURATION_THRESHOLDS.w) duration = "w";
    else if (heldTime >= DURATION_THRESHOLDS["h."]) duration = "h.";
    else if (heldTime >= DURATION_THRESHOLDS.h) duration = "h";
    else if (heldTime >= DURATION_THRESHOLDS["q."]) duration = "q.";

    // Use the notes directly from chord data instead of looking them up again
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

  // Handle visual repainting
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

/**
 * Triggers attack and release for notes with a specific duration
 * @param {string|string[]} note - The note name(s) (e.g., "C4", ["C4", "E4", "G4"])
 * @param {string} duration - Duration key from DURATION_THRESHOLDS (e.g., "q", "h", "w")
 * @param {number} [velocity=100] - MIDI velocity (1-127)
 */
export function triggerAttackRelease(note, duration = "q", velocity = 100) {
  if (!audioManager.isAudioReady()) return;

  const durationMs = DURATION_THRESHOLDS[duration] || DURATION_THRESHOLDS.q;

  // Create a unique key for tracking this specific triggerAttackRelease call
  const attackReleaseKey = `attackRelease_${Date.now()}_${Math.random()}`;

  // Trigger attack immediately
  pianoState.sampler.triggerAttack(note, Tone.now(), velocity / 127);

  // Start spectrum visualization when notes are played
  startSpectrumVisualization(); // ✅ SIMPLIFIED

  // Add to activeDiatonicChords to track this note for spectrum purposes
  pianoState.activeDiatonicChords[attackReleaseKey] = {
    notes: Array.isArray(note) ? note : [note],
    startTime: performance.now(),
    isAttackRelease: true // Flag to identify this type
  };

  // Schedule release after the specified duration
  setTimeout(() => {
    pianoState.sampler.triggerRelease(note);

    // Remove this specific attackRelease from tracking
    delete pianoState.activeDiatonicChords[attackReleaseKey];

    // Check if any notes are still active
    const hasActiveNotes =
      Object.keys(pianoState.activeNotes).length > 0 ||
      Object.keys(pianoState.activeDiatonicChords).length > 0;

    // Stop spectrum if no notes are active (spectrum handles its own timing)
    if (!hasActiveNotes) {
      stopSpectrumVisualization(); // ✅ Let spectrum handle decay timing
    }
  }, durationMs);
}