// spessaSynthBridge.js
// This bridges your existing piano code to the SpessaSynth audio engine.
// It provides the same interface as playbackHelpers.js but uses SpessaSynth.

import { pianoState } from "./appState.js";
import {
  NOTES_BY_MIDI,
  NOTES_BY_NAME,
  UNIFIED_CHORD_DEFINITIONS,
  diatonicChordQualities,
  chordDefinitions,
  DURATION_THRESHOLDS,
  notesByMidiKeyAware,
} from "./note-data.js";
import {
  paintChord,
  paintChordOnTheFly,
} from "./spesInstrumentHelpers.js";
import { writeNote } from "./scoreWriter.js";

// ===================================================================
// SpessaSynth Connection & State
// ===================================================================

let spessaSynth = null;
let spessaSequencer = null;
let isSpessaReady = false;

/**
 * Convert a note name (e.g., "C4") to a MIDI number.
 * @param {string} noteName - The note name like "C4", "F#3", "Bb5".
 * @returns {number} The corresponding MIDI note number (0-127).
 */
function noteNameToMidi(noteName) {
  const midiNum = NOTES_BY_NAME[noteName];
  return midiNum !== undefined ? midiNum : 60; // Default to Middle C if not found
}

// ===================================================================
// Audio Initialization
// ===================================================================

/**
 * Initializes the SpessaSynth audio system.
 * @returns {Promise<boolean>} True if initialization is successful.
 */
async function startAudio() {
  if (isSpessaReady) return true;

  try {
    console.log("🔊 Connecting to SpessaSynth...");

    // Poll for the SpessaSynth manager to become available
    let attempts = 0;
    while (!window.manager?.synth && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!window.manager?.synth) {
      throw new Error("SpessaSynth global manager not found after 5 seconds.");
    }

    spessaSynth = window.manager.synth;
    spessaSequencer = window.manager.seq;

    if (spessaSynth.context.state === 'suspended') {
      await spessaSynth.context.resume();
    }

    // Set default instrument to Acoustic Grand Piano on channel 0
    spessaSynth.controllerChange(0, 0, 0); // Bank select MSB
    spessaSynth.controllerChange(0, 32, 0); // Bank select LSB
    spessaSynth.programChange(0, 0); // Program 0

    isSpessaReady = true;
    pianoState.isUnlocked = true;
    pianoState.ctxStarted = true;
    pianoState.samplerReady = true;

    console.log("✅ SpessaSynth audio bridge ready!");
    return true;

  } catch (error) {
    console.error("❌ SpessaSynth connection failed:", error);
    return false;
  }
}

// ===================================================================
// Core Playback Functions
// ===================================================================

/**
 * Triggers or releases notes using SpessaSynth.
 * @param {string|string[]|number|number[]} notes - A single note or an array of notes (names or MIDI numbers).
 * @param {boolean} on - True to play the note (noteOn), false to stop it (noteOff).
 * @param {number} [velocity=100] - MIDI velocity (1-127).
 * @param {number} [channel=0] - MIDI channel (0-15).
 */
function trigger(notes, on, velocity = 100, channel = 0) {
  if (!isSpessaReady) return;

  const noteArray = Array.isArray(notes) ? notes : [notes];
  const midiVelocity = Math.max(1, Math.min(127, Math.round(velocity)));

  noteArray.forEach(note => {
    const midiNote = typeof note === 'string' ? noteNameToMidi(note) : Math.max(0, Math.min(127, note));
    if (midiNote === undefined) {
        console.warn("Invalid note:", note);
        return;
    }

    try {
      if (on) {
        spessaSynth.noteOn(channel, midiNote, midiVelocity);
      } else {
        spessaSynth.noteOff(channel, midiNote);
      }
    } catch (error) {
      console.error(`Error processing note ${note} (MIDI: ${midiNote}):`, error);
    }
  });
}

/**
 * Starts a single piano key press.
 * @param {HTMLElement} el - The key's HTML element.
 * @param {number} [velocity=100] - MIDI velocity.
 */
function startKey(el, velocity = 100) {
  const midi = parseInt(el.dataset.midi, 10);
  if (!midi || el.dataset.playing) return;

  const noteInfo = notesByMidiKeyAware(midi);
  if (!noteInfo) return;

  el.dataset.playing = "note";
  el.classList.add("pressed");

  trigger(noteInfo.name, true, velocity);

  pianoState.activeNotes[midi] = {
    el,
    startTime: performance.now()
  };
}

/**
 * Stops a single piano key press and handles writing to the score.
 * @param {HTMLElement} el - The key's HTML element.
 */
function stopKey(el) {
  const midi = parseInt(el.dataset.midi, 10);
  if (!midi || !el.dataset.playing) return;

  const activeNote = pianoState.activeNotes[midi];
  if (!activeNote) return;

  const noteInfo = notesByMidiKeyAware(midi);
  trigger(noteInfo.name, false);

  delete el.dataset.playing;
  el.classList.remove("pressed");
  delete pianoState.activeNotes[midi];

  // Score writing logic for single notes
  const heldTime = performance.now() - activeNote.startTime;
  let duration = "q";
  if (heldTime >= DURATION_THRESHOLDS.w) duration = "w";
  else if (heldTime >= DURATION_THRESHOLDS["h."]) duration = "h.";
  else if (heldTime >= DURATION_THRESHOLDS.h) duration = "h";
  else if (heldTime >= DURATION_THRESHOLDS["q."]) duration = "q.";

  const clef = midi < 60 ? "bass" : "treble";
  writeNote({
      clef,
      duration,
      notes: [noteInfo.name],
      chordName: noteInfo.name,
  });
}

// ===================================================================
// Diatonic Chord Functions
// ===================================================================

/**
 * Plays a diatonic chord based on the current scale and degree.
 * @param {number} degree - The scale degree (1-7).
 * @param {string|number} key - A unique identifier for the chord instance.
 * @param {boolean} [writeToScore=true] - Whether to notate the chord upon release.
 */
function playDiatonicChord(degree, key, writeToScore = true) {
  if (!isSpessaReady) return;

  const localMode = pianoState.isMajorChordMode ? "major" : "minor";
  const localTonic = pianoState.scaleTonic;

  if (!localTonic) {
    console.warn("Cannot play diatonic chord: scale tonic is not set.");
    return;
  }

  // This function body appears complex but is not duplicated in the source file.
  // The logic for determining notes, clef, and name remains as-is.
  const scale = window.Tonal.Scale.get(`${window.Tonal.Note.pitchClass(localTonic)} ${localMode}`);
  if (!scale?.notes?.length) return;

  const qualityKey = diatonicChordQualities[localMode][degree];
  const chordDef = UNIFIED_CHORD_DEFINITIONS[qualityKey];
  if (!chordDef) return;

  const rootPitchClass = scale.notes[degree - 1];
  const intervalToRoot = window.Tonal.Interval.distance(window.Tonal.Note.pitchClass(localTonic), rootPitchClass);
  const actualRootNote = window.Tonal.Note.transpose(localTonic, intervalToRoot);
  const specificChordKey = window.Tonal.Note.pitchClass(actualRootNote) + (chordDef.suffix || "");
  const predefinedChord = chordDefinitions[specificChordKey];

  let notesForPlayback = [];
  let clefForPlayback = "treble";

  if (predefinedChord) {
    const tonicOctave = window.Tonal.Note.octave(localTonic);
    notesForPlayback = (tonicOctave >= 4 || !predefinedChord.bass?.length) ? predefinedChord.treble : predefinedChord.bass;
  } else {
    const rootMidi = NOTES_BY_NAME[actualRootNote];
    if (rootMidi !== undefined) {
        notesForPlayback = chordDef.intervals.map(iv => NOTES_BY_MIDI[rootMidi + iv]?.name).filter(Boolean);
    }
  }

  if (notesForPlayback.length === 0) return;

  if (Math.min(...notesForPlayback.map(n => NOTES_BY_NAME[n])) < 60) {
      clefForPlayback = "bass";
  }

  trigger(notesForPlayback, true);
  paintChordOnTheFly({ notes: notesForPlayback });

  pianoState.activeDiatonicChords[key] = {
    key: specificChordKey,
    clef: clefForPlayback,
    displayName: predefinedChord?.displayName || specificChordKey,
    notes: notesForPlayback,
    startTime: performance.now(),
    writeToScore
  };
}

/**
 * Stops a diatonic chord and handles writing it to the score.
 * @param {string|number} key - The unique identifier for the chord instance.
 */
function stopDiatonicChord(key) {
  const chordData = pianoState.activeDiatonicChords[key];
  if (!chordData) return;

  if (chordData.notes?.length) {
    trigger(chordData.notes, false);
  }

  if (chordData.writeToScore && chordData.notes?.length) {
    const heldTime = performance.now() - chordData.startTime;
    let duration = "q";
    if (heldTime >= DURATION_THRESHOLDS.w) duration = "w";
    else if (heldTime >= DURATION_THRESHOLDS["h."]) duration = "h.";
    else if (heldTime >= DURATION_THRESHOLDS.h) duration = "h";
    else if (heldTime >= DURATION_THRESHOLDS["q."]) duration = "q.";

    writeNote({
      clef: chordData.clef,
      duration,
      notes: chordData.notes,
      chordName: chordData.displayName,
    });
  }

  if (Object.keys(pianoState.activeDiatonicChords).length <= 1 && (pianoState.isMajorChordMode || pianoState.isMinorChordMode)) {
    paintChord();
  }

  delete pianoState.activeDiatonicChords[key];
}

function playDiatonicChordFromUI(degree, inputSource) {
  playDiatonicChord(degree, inputSource, true);
}

function stopDiatonicChordFromUI(inputSource) {
  stopDiatonicChord(inputSource);
}

// ===================================================================
// MIDI Event Handlers
// ===================================================================

function handleMidiNoteOn(midiNoteNumber, velocity, channel) {
  // Channel 9 (programmers count from 0) is often drums, but used here for chords.
  if (channel === 9) {
    const degree = midiNoteNumber - 35; // Map MIDI 36-42 to degrees 1-7
    if (degree >= 1 && degree <= 7) {
      playDiatonicChord(degree, `midi_${midiNoteNumber}`, true);
    }
  } else {
    const keyEl = pianoState.noteEls[midiNoteNumber];
    if (keyEl) {
      startKey(keyEl, velocity);
    }
  }
}

function handleMidiNoteOff(midiNoteNumber, velocity, channel) {
  if (channel === 9) {
    stopDiatonicChord(`midi_${midiNoteNumber}`);
  } else {
    const keyEl = pianoState.noteEls[midiNoteNumber];
    if (keyEl) {
      stopKey(keyEl); // Score writing is handled within stopKey
    }
  }
}

// ===================================================================
// Instrument & Utility Functions
// ===================================================================

/**
 * Changes the instrument for a given channel.
 * @param {number} program - MIDI program number (0-127).
 * @param {number} [channel=0] - MIDI channel (0-15).
 */
function changeProgram(program, channel = 0) {
  if (isSpessaReady) {
    spessaSynth.programChange(channel, program);
    console.log(`🎼 Program changed to ${program} on channel ${channel}`);
  }
}

/** Sets up a default palette of instruments on different channels. */
function setupInstrumentPrograms() {
  if (!isSpessaReady) return;
  // Ch 0: Piano, Ch 1: Guitar, Ch 2: Cello, Ch 3: Sax
  changeProgram(0, 0);   // Acoustic Grand Piano
  changeProgram(24, 1);  // Acoustic Guitar (Nylon)
  changeProgram(42, 2);  // Cello
  changeProgram(66, 3);  // Tenor Sax
}

/** Emergency stop all sounding notes on all channels. */
function stopAllNotes() {
  if (isSpessaReady) {
    for (let channel = 0; channel < 16; channel++) {
      spessaSynth.controllerChange(channel, 123, 0); // All Notes Off MIDI CC
    }
    console.log("🛑 All notes stopped.");
  }
}

/** Verifies the connection by playing and stopping a C Major chord. */
function testSpessaSynth() {
  if (!isSpessaReady) {
    console.error("❌ SpessaSynth not ready for test.");
    return;
  }
  console.log("🧪 Testing SpessaSynth connection...");
  const testChord = ["C4", "E4", "G4"];
  trigger(testChord, true, 80);
  setTimeout(() => trigger(testChord, false), 1000);
}

// ===================================================================
// Getters & Status
// ===================================================================

/** @returns {boolean} True if SpessaSynth is connected and ready. */
const isReady = () => isSpessaReady;

/** @returns {object|null} The raw SpessaSynth synth instance. */
const getSynth = () => spessaSynth;

/** @returns {object|null} The raw SpessaSynth sequencer instance. */
const getSequencer = () => spessaSequencer;

// ===================================================================
// Exports & Debugging Interface
// ===================================================================

export {
  // Core audio functions
  startAudio,
  trigger,
  startKey,
  stopKey,

  // Chord functions
  playDiatonicChord,
  stopDiatonicChord,
  playDiatonicChordFromUI,
  stopDiatonicChordFromUI,

  // MIDI event handlers
  handleMidiNoteOn,
  handleMidiNoteOff,

  // Utility functions
  isReady,
  getSynth,
  getSequencer,
  stopAllNotes,
  changeProgram,
  setupInstrumentPrograms,
  testSpessaSynth
};

// Expose functions to the console for easier debugging
window.spessaBridge = {
  isReady,
  getSynth,
  getSequencer,
  trigger,
  startKey,
  stopKey,
  playDiatonicChord,
  stopDiatonicChord,
  handleMidiNoteOn,
  handleMidiNoteOff,
  changeProgram,
  setupInstrumentPrograms,
  stopAllNotes,
  testSpessaSynth,
  get isSpessaReady() { return isSpessaReady; }, // Getter for live state
};

console.log("🎹 SpessaSynth bridge loaded.");