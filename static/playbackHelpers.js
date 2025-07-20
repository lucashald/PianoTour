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
  diatonicChordQualities,
  chordDefinitions,
  DURATION_THRESHOLDS,
  notesByMidiKeyAware,
} from "./note-data.js";

// Import UI painting functions
import {
  paintChord,
  paintChordOnTheFly,
  getChord,
} from "./instrumentHelpers.js";
import { writeNote } from "./scoreWriter.js";

/**
 * Initializes the Tone.js audio context, loads the sampler, removes the UI gate,
 * and sets the application state to "unlocked". This is the single, authoritative
 * function for making the app interactive.
 * @returns {Promise<boolean>} True if successful, false if an error occurred.
 */
export async function startAudio() {
  // If the app is already unlocked, do nothing.
  if (pianoState.isUnlocked) return true;

  try {
    // First play the native audio to unlock iOS
    await document.getElementById("unlock-audio").play();

    // 1. Start Tone.js audio context
    await Tone.start();
    pianoState.ctxStarted = true;
    console.log("Tone.js audio context started.");
    // 2. Determine which samples to use based on instrument
    let sampleUrls;
    if (window.CURRENT_INSTRUMENT === "guitar") {
      sampleUrls = {
        "F#2": "nylonf42.wav",
        G2: "nylonf43.wav",
        C3: "nylonf48.wav",
        F3: "nylonf53.wav",
        "A#3": "nylonf58.wav",
        D4: "nylonf62.wav",
        "G#4": "nylonf68.wav",
        "C#5": "nylonf73.wav",
        G5: "nylonf79.wav",
      };
    } else if (window.CURRENT_INSTRUMENT === "cello") {
      sampleUrls = {
        "A#3": "Cello_A#3.wav",
        "A#4": "Cello_A#4.wav",
        "A#5": "Cello_A#5.wav",
        "A#6": "Cello_A#6.wav",
        "C#3": "Cello_C#3.wav",
        "C#4": "Cello_C#4.wav",
        "C#5": "Cello_C#5.wav",
        "C#6": "Cello_C#6.wav",
        "C#7": "Cello_C#7.wav",
        E3: "Cello_E3.wav",
        E4: "Cello_E4.wav",
        E5: "Cello_E5.wav",
        E6: "Cello_E6.wav",
        E7: "Cello_E7.wav",
        G3: "Cello_G3.wav",
        G4: "Cello_G4.wav",
        G5: "Cello_G5.wav",
        G6: "Cello_G6.wav",
      };
    } else if (window.CURRENT_INSTRUMENT === "sax") {
      sampleUrls = {
        A2: "TSAX45-2.wav",
        "A#2": "TSAX46.wav",
        B2: "TSAX47.wav",
        "C#3": "TSAX49.wav",
        "D#3": "TSAX51.wav",
        E3: "TSAX52-2.wav",
        F3: "TSAX53-3.wav",
        "F#3": "TSAX54.wav",
        G3: "TSAX55-2.wav",
        A3: "TSAX57.wav",
        "A#3": "TSAX58-2.wav",
        B3: "TSAX59.wav",
        C4: "TSAX60-3.wav",
        "C#4": "TSAX61.wav",
        D4: "TSAX62-2.wav",
        "D#4": "TSAX63.wav",
        F4: "TSAX65-2.wav",
        "F#4": "TSAX66.wav",
        G4: "TSAX67-3.wav",
        "G#4": "TSAX68.wav",
        A4: "TSAX69-3.wav",
        B4: "TSAX71-2.wav",
        C5: "TSAX72.wav",
        "D#5": "TSAX75.wav",
        "F#5": "TSAX78-2.wav",
        G5: "TSAX79.wav",
        "G#5": "TSAX80-2.wav",
        "A#5": "TSAX82-2.wav",
        B5: "TSAX83.wav",
        C6: "TSAX84-2.wav",
      };
    } else {
      sampleUrls = {
        C2: "SteinwayD_m_C2_L.wav",
        D2: "SteinwayD_m_D2_L.wav",
        E2: "SteinwayD_m_E2_L.wav",
        "F#2": "SteinwayD_m_F#2_L.wav",
        "G#2": "SteinwayD_m_G#2_L.wav",
        "A#2": "SteinwayD_m_A#2_L.wav",
        C3: "SteinwayD_m_C3_L.wav",
        D3: "SteinwayD_m_D3_L.wav",
        E3: "SteinwayD_m_E3_L.wav",
        "F#3": "SteinwayD_m_F#3_L.wav",
        "G#3": "SteinwayD_m_G#3_L.wav",
        "A#3": "SteinwayD_m_A#3_L.wav",
        C4: "SteinwayD_m_C4_L.wav",
        D4: "SteinwayD_m_D4_L.wav",
        E4: "SteinwayD_m_E4_L.wav",
        "F#4": "SteinwayD_m_F#4_L.wav",
        "G#4": "SteinwayD_m_G#4_L.wav",
        "A#4": "SteinwayD_m_A#4_L.wav",
        C5: "SteinwayD_m_C5_L.wav",
        "F#5": "SteinwayD_m_F#5_L.wav",
        C6: "SteinwayD_m_C6_L.wav",
      };
    }

    // 3. Create and load the audio sampler
    pianoState.sampler = new Tone.Sampler({
      urls: sampleUrls,
      release: 1,
      baseUrl: "/static/samples/",
    }).toDestination();

    await Tone.loaded();
    pianoState.samplerReady = true;
    console.log("Sampler is ready!");

    // 4. Update the global state to indicate the app is unlocked
    pianoState.isUnlocked = true;

    return true; // Signal success
  } catch (error) {
    console.error("Error during audio initialization:", error);
    pianoState.isUnlocked = false; // Ensure state is correct on failure
    return false; // Signal failure
  }
}

/**
 * Triggers or releases notes on the Tone.js sampler.
 * @param {string|string[]} note - The note name(s) (e.g., "C4", ["C4", "E4", "G4"]).
 * @param {boolean} on - True to trigger attack, false to trigger release.
 * @param {number} [velocity=100] - MIDI velocity (1-127).
 */
export function trigger(note, on, velocity = 100) {
  if (!pianoState.samplerReady) return;
  if (on) {
    pianoState.sampler.triggerAttack(note, Tone.now(), velocity / 127);
  } else {
    pianoState.sampler.triggerRelease(note);
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
  // Handle score writing if enabled
  if (chordData.writeToScore) {
    console.log("Writing chord to score:", chordData);
    const heldTime = performance.now() - chordData.startTime;

    // FIX: Updated quantization logic to include dotted notes.
    // Checks must be in order from longest to shortest duration.
    let duration = "q"; // Default to quarter note
    if (heldTime >= DURATION_THRESHOLDS.w) duration = "w";
    else if (heldTime >= DURATION_THRESHOLDS["h."]) duration = "h.";
    else if (heldTime >= DURATION_THRESHOLDS.h) duration = "h";
    else if (heldTime >= DURATION_THRESHOLDS["q."]) duration = "q.";
    // The default remains 'q'

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
// MIDI Event Handlers (Fixed)
// ===================================================================

/**
 * Handles incoming MIDI Note On messages.
 * @param {number} midiNoteNumber - The MIDI note number (0-127).
 * @param {number} velocity - The note velocity (1-127).
 * @param {number} channel - The MIDI channel (0-15).
 */
export function handleMidiNoteOn(midiNoteNumber, velocity, channel) {
  console.log(
    `MIDI Note On: Channel ${channel}, Note ${midiNoteNumber}, Velocity ${velocity}`
  );

  // Channel 8 (MIDI channel 9 in user terms) is reserved for diatonic chords
  // Note: Using channel 8 instead of 9 to avoid percussion channel conflict
  if (channel === 9) {
    // Map MIDI note number to a diatonic degree (1-7)
    // Assuming MIDI notes 36-42 correspond to degrees 1-7
    const degree = midiNoteNumber - 35;
    if (degree >= 1 && degree <= 7) {
      console.log(`Playing diatonic chord: degree ${degree}`);
      // Use the unified playDiatonicChord function with score writing enabled
      playDiatonicChord(degree, `midi_${midiNoteNumber}`, true);
    } else {
      console.warn(
        `Invalid diatonic degree: ${degree} (from MIDI note ${midiNoteNumber})`
      );
    }
    return;
  }

  // Handle standard note presses
  const keyEl = pianoState.noteEls[midiNoteNumber];
  if (keyEl) {
    startKey(keyEl, "sharp", velocity);
  } else {
    console.warn(`No key element found for MIDI note ${midiNoteNumber}`);
  }
}

/**
 * Handles incoming MIDI Note Off messages.
 * @param {number} midiNoteNumber - The MIDI note number (0-127).
 * @param {number} velocity - The note velocity (1-127).
 * @param {number} channel - The MIDI channel (0-15).
 */
export function handleMidiNoteOff(midiNoteNumber, velocity, channel) {
  console.log(
    `MIDI Note Off: Channel ${channel}, Note ${midiNoteNumber}, Velocity ${velocity}`
  );

  // Handle diatonic chord release from channel 8
  if (channel === 9) {
    const chordKey = `midi_${midiNoteNumber}`;
    const activeChord = pianoState.activeDiatonicChords[chordKey];
    if (activeChord) {
      console.log(`Stopping diatonic chord: ${chordKey}`);
      // Use the unified stopDiatonicChord function which handles score writing
      stopDiatonicChord(chordKey);
    } else {
      console.warn(`No active diatonic chord found for key: ${chordKey}`);
    }
    return;
  }

  // Handle standard note release
  const activeNote = pianoState.activeNotes[midiNoteNumber];
  const keyEl = pianoState.noteEls[midiNoteNumber];

  if (keyEl && activeNote) {
    // Stop the sound and visual feedback
    stopKey(keyEl);

    // --- Score Writing Logic ---
    const noteInfo = NOTES_BY_MIDI[midiNoteNumber];
    if (!noteInfo) return;

    const heldTime = performance.now() - activeNote.startTime;

    // FIX: Updated quantization logic to include dotted notes.
    // Checks must be in order from longest to shortest duration.
    let duration = "q"; // Default to quarter note
    if (heldTime >= DURATION_THRESHOLDS.w) duration = "w";
    else if (heldTime >= DURATION_THRESHOLDS["h."]) duration = "h.";
    else if (heldTime >= DURATION_THRESHOLDS.h) duration = "h";
    else if (heldTime >= DURATION_THRESHOLDS["q."]) duration = "q.";
    // The default remains 'q'

    const noteNameForScore =
      activeNote.spelling === "flat" && noteInfo.flatName
        ? noteInfo.flatName
        : noteInfo.name;
    const clef = noteInfo.midi < 60 ? "bass" : "treble";

    writeNote({
      clef,
      duration,
      notes: [noteNameForScore],
      chordName: noteNameForScore, // For single notes, the chordName is just the note name
    });
  } else if (!keyEl) {
    console.warn(`No key element found for MIDI note ${midiNoteNumber}`);
  } else if (!activeNote) {
    console.warn(`No active note found for MIDI note ${midiNoteNumber}`);
  }
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
