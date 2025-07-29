// playbackHelpers.js
// This file contains all functions related to audio playback using Tone.js.

// ===================================================================
// Imports
// ===================================================================

// Import the centralized state object
import { pianoState } from "../core/appState.js";

// Import musical data and constants
import {
  CHORD_DEFINITIONS,
  DIATONIC_CHORD_QUALITIES,
  DURATION_THRESHOLDS,
  getChordByDegree,
  getInterval,
  getOctave,
  getPitchClass,
  getScaleNotes,
  NOTES_BY_MIDI,
  NOTES_BY_NAME,
  notesByMidiKeyAware,
  transposeNote,
  UNIFIED_CHORD_DEFINITIONS
} from "../core/note-data.js";

// Import UI painting functions
import { writeNote } from "../score/scoreWriter.js";
import {
  paintChord,
  paintChordOnTheFly
} from "./instrumentHelpers.js";

// Import spectrum visualization functions - SIMPLIFIED
import {
  startSpectrumVisualization,
  stopSpectrumVisualization,
} from "../ui/spectrum.js";


import audioManager from "../core/audioManager.js";

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
export function triggerAttackRelease(note, duration = "q", velocity = 100, writeToScore = true, chordName = null) {
  if (!audioManager.isAudioReady()) return;

  const durationMs = DURATION_THRESHOLDS[duration] || DURATION_THRESHOLDS.q;
  const notesArray = Array.isArray(note) ? note : [note];

  // Create a unique key for tracking this specific triggerAttackRelease call
  const attackReleaseKey = `attackRelease_${Date.now()}_${Math.random()}`;

  // Determine if this is a chord (multiple notes)
  const isChord = notesArray.length > 1;

  // Determine clef based on the lowest note
  const lowestMidi = Math.min(...notesArray.map(n => NOTES_BY_NAME[n] || 60));
  const clefForPlayback = lowestMidi < 60 ? "bass" : "treble";

  // Generate display name if not provided
  let displayName = chordName;
  if (!displayName) {
    if (isChord) {
      const rootNote = notesArray[0];
      const rootPitchClass = rootNote.replace(/\d+/, '');
      displayName = rootPitchClass;
    } else {
      displayName = notesArray[0];
    }
  }

  console.log(`🎵 Starting triggerAttackRelease: ${displayName}, duration: ${duration} (${durationMs}ms)`);

  // IMPROVEMENT 1: Use Tone.js triggerAttackRelease with proper duration conversion
  // Make sure we're using seconds, not milliseconds
  const durationInSeconds = durationMs / 1000;
  pianoState.sampler.triggerAttackRelease(note, durationInSeconds, Tone.now(), velocity / 127);

  // Start spectrum visualization when notes are played
  startSpectrumVisualization();

  // IMPROVEMENT 2: Paint chord visualization immediately for chords
  if (isChord) {
    paintChordOnTheFly({ notes: notesArray });
  }

  // Store chord data following the same pattern as playScaleChord
  pianoState.activeDiatonicChords[attackReleaseKey] = {
    notes: notesArray,
    clef: clefForPlayback,
    displayName: displayName,
    startTime: performance.now(),
    writeToScore: writeToScore,
    isAttackRelease: true,
    isChord: isChord
  };

  console.log(`📊 Active chords after adding: ${Object.keys(pianoState.activeDiatonicChords).length}`);

  // IMPROVEMENT 3: Schedule cleanup to happen slightly AFTER the audio finishes
  // Add a small buffer to ensure Tone.js has finished releasing
  const cleanupDelay = durationMs + 50; // Add 50ms buffer

  setTimeout(() => {
    console.log(`🔇 triggerAttackRelease timeout fired for: ${displayName}`);

    // Get the chord data for potential score writing
    const chordData = pianoState.activeDiatonicChords[attackReleaseKey];

    if (!chordData) {
      console.warn(`⚠️ No chord data found for key: ${attackReleaseKey}`);
      return;
    }

    // Handle score writing if enabled
    if (chordData.writeToScore) {
      console.log(`📝 Writing ${isChord ? 'chord' : 'note'} to score:`, displayName);

      writeNote({
        clef: chordData.clef,
        duration: duration,
        notes: chordData.notes,
        chordName: chordData.displayName,
      });
    }

    // Remove this specific attackRelease from tracking
    delete pianoState.activeDiatonicChords[attackReleaseKey];
    console.log(`📊 Active chords after removing: ${Object.keys(pianoState.activeDiatonicChords).length}`);

    // IMPROVEMENT 4: Handle visual cleanup more aggressively for chords
    if (isChord) {
      // Clear chord highlights immediately
      if (typeof clearChordHi === 'function') {
        clearChordHi();
      }

      // Then restore after a brief moment
      setTimeout(() => {
        const remainingChords = Object.keys(pianoState.activeDiatonicChords).length;
        console.log(`🎨 Checking visual cleanup, remaining chords: ${remainingChords}`);

        if (remainingChords === 0 && (pianoState.isMajorChordMode || pianoState.isMinorChordMode)) {
          console.log(`🎨 Restoring chord highlighting`);
          paintChord();
        }
      }, 50); // Reduced delay
    }

    // IMPROVEMENT 5: More aggressive spectrum cleanup check
    // Use a small delay to ensure all cleanup has happened
    setTimeout(() => {
      const hasActiveNotes =
        Object.keys(pianoState.activeNotes).length > 0 ||
        Object.keys(pianoState.activeDiatonicChords).length > 0;

      console.log(`🔍 Final check for active notes/chords:`, {
        activeNotes: Object.keys(pianoState.activeNotes).length,
        activeDiatonicChords: Object.keys(pianoState.activeDiatonicChords).length,
        hasActiveNotes
      });

      // Stop spectrum if no notes are active
      if (!hasActiveNotes) {
        console.log(`📊 Stopping spectrum visualization (final check)`);
        stopSpectrumVisualization();
      }
    }, 10); // Small delay for final check

  }, cleanupDelay); // Use the buffered cleanup delay

  console.log(`⏰ Scheduled cleanup in ${cleanupDelay}ms for: ${displayName}`);
}

export function playScaleChord(degree, key, writeToScore = true, useBass = false) {
  // Get chord directly from our new function
  const chord = getChordByDegree(degree);
  if (!chord) {
    console.warn(`No chord found for scale degree ${degree}`);
    return;
  }

  // Choose voicing based on useBass parameter
  const notesForPlayback = useBass ? chord.bass : chord.treble;
  const clefForPlayback = useBass ? "bass" : "treble";

  if (!notesForPlayback || notesForPlayback.length === 0) {
    console.warn(`No ${useBass ? 'bass' : 'treble'} notes found for chord ${chord.displayName}`);
    return;
  }

  // Play the chord
  trigger(notesForPlayback, true);
  paintChordOnTheFly({ notes: notesForPlayback });

  // Store chord data for release handling
  pianoState.activeDiatonicChords[key] = {
    chord: chord,
    clef: clefForPlayback,
    displayName: chord.displayName,
    notes: notesForPlayback,
    startTime: performance.now(),
    writeToScore: writeToScore,
  };

  console.log(`Playing diatonic chord degree ${degree}: ${chord.displayName} (${useBass ? 'bass' : 'treble'})`);
}

/**
 * Unified function to stop a diatonic chord and handle score writing.
 * @param {string|number} key - The unique identifier used when the chord was played.
 */
export function stopScaleChord(key) {
  const chordData = pianoState.activeDiatonicChords[key];
  if (!chordData) return;

  // Stop the audio
  if (chordData.notes?.length) {
    trigger(chordData.notes, false);
  }

  // Handle score writing if enabled
  if (chordData.writeToScore) {
    console.log("Writing chord to score:", chordData.displayName);
    const heldTime = performance.now() - chordData.startTime;

    let duration = "q"; // Default to quarter note
    if (heldTime >= DURATION_THRESHOLDS.w) duration = "w";
    else if (heldTime >= DURATION_THRESHOLDS["h."]) duration = "h.";
    else if (heldTime >= DURATION_THRESHOLDS.h) duration = "h";
    else if (heldTime >= DURATION_THRESHOLDS["q."]) duration = "q.";

    writeNote({
      clef: chordData.clef,
      duration: duration,
      notes: chordData.notes,
      chordName: chordData.displayName,
    });
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