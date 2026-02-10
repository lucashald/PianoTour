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
  getDurationThresholds,
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
  paintChordOnTheFly,
  updateKeyVisuals
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
 * @param {number} [velocity=pianoState.velocity] - MIDI velocity (1-127).
 */
 
export function trigger(note, on, velocity, useEnvelope = true) {
  if (!audioManager.isAudioReady() || !pianoState.sampler) return;

  // Use pianoState.velocity if no velocity is passed
  const effectiveVelocity = velocity !== undefined ? velocity : pianoState.velocity;
  const normalizedVelocity = Math.min(1, Math.max(0, effectiveVelocity / 127));
  const notes = Array.isArray(note) ? note : [note];
  const now = Tone.now(); // Get current time

  // Pass array directly to sampler for better PolySynth handling
  if (on) {
    pianoState.sampler.triggerAttack(notes, now, normalizedVelocity);
    
    if (pianoState.envelope && useEnvelope) {
      pianoState.envelope.triggerAttack(now);
    }
  } else {
    pianoState.sampler.triggerRelease(notes, now);
    
    if (pianoState.envelope && useEnvelope) {
      pianoState.envelope.triggerRelease(now);
    }
  }

  // Update visual state
  updateKeyVisuals(notes, on);
}

/**
 * Starts a single piano key's sound and visual feedback.
 * @param {HTMLElement} el - The SVG element of the key.
 * @param {number} [velocity] - MIDI velocity. If undefined, uses pianoState.velocity.
 */
export function startKey(el, velocity) {
  const midi = el.dataset.midi;
  
  // Use pianoState.velocity if no velocity is passed
  const effectiveVelocity = velocity !== undefined ? velocity : pianoState.velocity;
  
  // FIXED: Check for any existing playing state, not just "note"
  if (!midi || el.dataset.playing) {
    console.log("startKey: blocked - already playing or no midi");
    return;
  }

  const noteInfo = notesByMidiKeyAware(midi);
  console.log("startKey: noteInfo =", noteInfo);
  if (!noteInfo) return;

  const noteName = noteInfo.name;
  console.log("startKey: noteName =", noteName);

  // FIXED: Set playing state BEFORE triggering to prevent double calls
  el.dataset.playing = "note";
  el.dataset.startTime = performance.now().toString();
  // el.classList.add("pressed"); // Handled by trigger
  
  trigger(noteName, true, effectiveVelocity);
  
  const spelling = pianoState.keySignatureType === "b" ? "flat" : "sharp";
  pianoState.activeNotes[midi] = { 
    el, 
    spelling, 
    startTime: performance.now() 
  };

  console.log("startKey: completed for", noteName);
}

export function stopKey(el) {
  const midi = el.dataset.midi;
  console.log("stopKey: midi =", midi, "playing =", el.dataset.playing);
  
  // FIXED: Only proceed if midi exists
  if (!midi) {
    console.log("stopKey: blocked - no midi");
    return;
  }
  
  // Check active notes instead of relying solely on element state (which might be lost on redraws)
  const activeNote = pianoState.activeNotes[midi];
  
  if (!activeNote) {
    // Clean up element state if it got desynced
    if (el.dataset.playing) {
        delete el.dataset.playing;
        delete el.dataset.startTime;
        el.classList.remove("pressed");
    }
    console.log("stopKey: no active note found");
    return;
  }

  const noteInfo = notesByMidiKeyAware(midi);
  const noteNameToTrigger = noteInfo.name;

  // FIXED: Clear state on the element passed AND the stored element
  delete el.dataset.playing;
  delete el.dataset.startTime;
  // el.classList.remove("pressed"); // Handled by trigger
  
  // Also clear the stored element if different
  if (activeNote.el && activeNote.el !== el) {
      delete activeNote.el.dataset.playing;
      delete activeNote.el.dataset.startTime;
      // activeNote.el.classList.remove("pressed"); // Handled by trigger
  }
  
  delete pianoState.activeNotes[midi];

  trigger(noteNameToTrigger, false);
  console.log("stopKey: completed for", noteNameToTrigger);
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
  // paintChordOnTheFly({ notes: notesForPlayback }); // Handled by trigger

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

    let duration = pianoState.quantize; // Default to quarter note
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

export function triggerAttackRelease(note, duration = pianoState.quantize, velocity, writeToScore = true, chordName = null) {
  if (!audioManager.isAudioReady()) return;

  // Use pianoState.velocity if no velocity is passed
  const effectiveVelocity = velocity !== undefined ? velocity : pianoState.velocity;
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

  const durationInSeconds = durationMs / 1000;
  const now = Tone.now();

  // Trigger envelope: attack → decay → sustain (for note duration) → release
  if (pianoState.envelope) {
    pianoState.envelope.triggerAttack(now);
    pianoState.envelope.triggerRelease(now + durationInSeconds);
  }

  // Trigger sampler with note duration (sampler handles release phase)
  pianoState.sampler.triggerAttackRelease(note, durationInSeconds, now, effectiveVelocity / 127);

  // Update visual state immediately
  updateKeyVisuals(notesArray, true);

  // Store chord data
  pianoState.activeDiatonicChords[attackReleaseKey] = {
    notes: notesArray,
    clef: clefForPlayback,
    displayName: displayName,
    startTime: performance.now(),
    writeToScore: writeToScore,
    isAttackRelease: true,
    isChord: isChord
  };

  // FIXED: Longer cleanup delay to account for envelope release
  const envelopeReleaseTime = 300;
  const cleanupDelay = durationMs + envelopeReleaseTime;

  setTimeout(() => {
    const chordData = pianoState.activeDiatonicChords[attackReleaseKey];
    if (!chordData) {
      console.warn(`⚠️ No chord data found for key: ${attackReleaseKey}`);
      return;
    }

    // Handle score writing if enabled
    if (chordData.writeToScore) {
      writeNote({
        clef: chordData.clef,
        duration: duration,
        notes: chordData.notes,
        chordName: chordData.displayName,
      });
    }

    // Remove this specific attackRelease from tracking
    delete pianoState.activeDiatonicChords[attackReleaseKey];

    // Handle visual cleanup for chords
    if (isChord) {
      updateKeyVisuals(notesArray, false);

      setTimeout(() => {
        const remainingChords = Object.keys(pianoState.activeDiatonicChords).length;
        if (remainingChords === 0 && (pianoState.isMajorChordMode || pianoState.isMinorChordMode)) {
          paintChord();
        }
      }, 50);
    } else {
      // Also cleanup for single notes (since trigger doesn't handle release for triggerAttackRelease automatically)
      updateKeyVisuals(notesArray, false);
    }

    // Final spectrum cleanup check
    setTimeout(() => {
      const hasActiveNotes =
        Object.keys(pianoState.activeNotes).length > 0 ||
        Object.keys(pianoState.activeDiatonicChords).length > 0;

      if (!hasActiveNotes) {
        stopSpectrumVisualization();
      }
    }, 10);

  }, cleanupDelay);
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
  // paintChordOnTheFly({ notes: notesForPlayback }); // Handled by trigger

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
    const duration = calculateDuration(heldTime);

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

// ===================================================================
// Chord Batching System
// ===================================================================
// Collects near-simultaneous note events and groups them as chords.
// Used by MIDI input (where hardware sends chord notes sequentially)
// and available for any other input path that needs it.

const CHORD_WINDOW_MS = 50;
let noteOnBatchTimer = null;
let noteOffBatchTimer = null;
const pendingNoteOns = new Map();   // midi → { keyEl, velocity }
const pendingNoteOffs = new Map();  // midi → { keyEl, activeNote }

// Track chord groups so we can write one score entry when all notes release
// groupId → { midiNotes: Set, startTime, releasedNotes: Map<midi, noteInfo> }
const activeChordGroups = new Map();
let nextGroupId = 0;
// Reverse lookup: midi → groupId
const midiToGroup = new Map();

/**
 * Calculate duration from held time, respecting tempo and fixed-duration mode.
 * Shared helper so every input path uses the same logic.
 * @param {number} heldTimeMs - How long the note/chord was held in milliseconds.
 * @returns {string} VexFlow duration string (e.g. "q", "h.", "w").
 */
export function calculateDuration(heldTimeMs) {
  if (pianoState.toggleFixedDuration) {
    return pianoState.quantize;
  }
  const thresholds = getDurationThresholds(pianoState.tempo);
  if (heldTimeMs >= thresholds.w)        return "w";
  if (heldTimeMs >= thresholds["h."])    return "h.";
  if (heldTimeMs >= thresholds.h)        return "h";
  if (heldTimeMs >= thresholds["q."])    return "q.";
  if (heldTimeMs >= thresholds.q)        return "q";
  if (heldTimeMs >= thresholds["8."])    return "8.";
  return "8";
}

/**
 * Queue a Note On into the chord batch. After CHORD_WINDOW_MS of silence
 * the batch is flushed: all collected notes are started together and
 * registered as a chord group.
 * @param {HTMLElement} keyEl - The piano key DOM element.
 * @param {number} velocity - MIDI velocity (1-127).
 */
export function batchNoteOn(keyEl, velocity) {
  const midi = parseInt(keyEl.dataset.midi, 10);
  pendingNoteOns.set(midi, { keyEl, velocity });

  if (noteOnBatchTimer !== null) clearTimeout(noteOnBatchTimer);
  noteOnBatchTimer = setTimeout(flushNoteOnBatch, CHORD_WINDOW_MS);
}

function flushNoteOnBatch() {
  noteOnBatchTimer = null;
  if (pendingNoteOns.size === 0) return;

  const groupId = nextGroupId++;
  const midiNotes = new Set();

  for (const [midi, { keyEl, velocity }] of pendingNoteOns) {
    startKey(keyEl, velocity);
    midiNotes.add(midi);
    midiToGroup.set(midi, groupId);
  }

  activeChordGroups.set(groupId, {
    midiNotes,
    startTime: performance.now(),
    releasedNotes: new Map(), // midi → { noteName, clef }
  });

  pendingNoteOns.clear();
  console.log(`Chord group ${groupId} started with MIDI notes: [${[...midiNotes].join(", ")}]`);
}

/**
 * Queue a Note Off into the chord batch. After CHORD_WINDOW_MS the batch
 * is flushed: notes are stopped and, once every note in the chord group
 * has been released, a single writeNote() call is made.
 * @param {HTMLElement} keyEl - The piano key DOM element.
 */
export function batchNoteOff(keyEl) {
  const midi = parseInt(keyEl.dataset.midi, 10);
  const activeNote = pianoState.activeNotes[midi];
  if (!activeNote) {
    console.log(`batchNoteOff: no active note for MIDI ${midi}`);
    return;
  }
  pendingNoteOffs.set(midi, { keyEl, activeNote });

  if (noteOffBatchTimer !== null) clearTimeout(noteOffBatchTimer);
  noteOffBatchTimer = setTimeout(flushNoteOffBatch, CHORD_WINDOW_MS);
}

function flushNoteOffBatch() {
  noteOffBatchTimer = null;
  if (pendingNoteOffs.size === 0) return;

  for (const [midi, { keyEl }] of pendingNoteOffs) {
    const noteInfo = notesByMidiKeyAware(midi);
    const noteName = noteInfo ? noteInfo.name : null;
    const clef = midi < 60 ? "bass" : "treble";

    // Stop audio + clear element/activeNotes state
    stopKey(keyEl);

    // Record this release in the chord group
    const groupId = midiToGroup.get(midi);
    if (groupId !== undefined) {
      const group = activeChordGroups.get(groupId);
      if (group && noteName) {
        group.releasedNotes.set(midi, { noteName, clef });

        // Check if every note in the group has been released
        if (group.releasedNotes.size >= group.midiNotes.size) {
          finalizeChordGroup(groupId, group);
        }
      }
    } else if (noteName) {
      // Ungrouped single note (started before batching was active)
      const heldTime = performance.now() - (parseFloat(keyEl.dataset.startTime) || performance.now());
      const duration = calculateDuration(heldTime);
      writeNote({ clef, duration, notes: [noteName], chordName: noteName });
      console.log(`Ungrouped note released: ${noteName} (${duration}) in ${clef} clef`);
    }
  }

  pendingNoteOffs.clear();
}

function finalizeChordGroup(groupId, group) {
  const heldTime = performance.now() - group.startTime;
  const duration = calculateDuration(heldTime);

  // Sort notes by MIDI number for consistent ordering
  const sortedEntries = [...group.releasedNotes.entries()].sort((a, b) => a[0] - b[0]);
  const noteNames = sortedEntries.map(([, info]) => info.noteName);
  // Clef based on lowest note
  const lowestMidi = sortedEntries[0][0];
  const clef = lowestMidi < 60 ? "bass" : "treble";

  const chordName = noteNames.length === 1 ? noteNames[0] : noteNames.join("/");

  writeNote({ clef, duration, notes: noteNames, chordName });
  console.log(`Chord group ${groupId} finalized: [${noteNames.join(", ")}] (${duration}) in ${clef} clef`);

  // Clean up
  for (const midi of group.midiNotes) {
    midiToGroup.delete(midi);
  }
  activeChordGroups.delete(groupId);
}