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

// Import spectrum visualization functions
import {
  initializeSpectrum,
  connectSpectrumToAudio,
  startSpectrumVisualization,
  stopSpectrumVisualization,
  destroySpectrum,
} from "./spectrum.js";

import { handleMidiNoteOn, handleMidiNoteOff } from "./midi-controller.js";
// ===================================================================
// Module Variables
// ===================================================================

// Spectrum state tracking
let spectrumInitialized = false;
let spectrumActive = false;

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
  if (pianoState.isUnlocked) return true;

  try {
    // First play the native audio to unlock iOS
    await document.getElementById("unlock-audio").play(); // 1. Start Tone.js audio context

    await Tone.start();
    pianoState.ctxStarted = true;
    console.log("Tone.js audio context started."); // 2. Determine which samples to use based on instrument
    let sampleUrls;
    if (pianoState.instrument === "guitar") {
      // The guitar samples are already reasonably sparse.
      // We'll just remove G2 since it's only one semitone from F#2.
      // The remaining samples are all 5-6 semitones apart.
      sampleUrls = {
        "F#2": "nylonf42.wav",
        // G2: "nylonf43.wav", // Redundant: Only 1 semitone from F#2
        C3: "nylonf48.wav",
        F3: "nylonf53.wav",
        "A#3": "nylonf58.wav",
        D4: "nylonf62.wav",
        "G#4": "nylonf68.wav",
        "C#5": "nylonf73.wav",
        G5: "nylonf79.wav",
      };
    } else if (pianoState.instrument === "cello") {
      // The original cello samples were very dense (every 3 semitones).
      // We can keep roughly half of them, spaced about 6 semitones apart,
      // which provides good coverage while significantly reducing load time.
      sampleUrls = {
        "A#3": "Cello_A#3.wav",
        "A#4": "Cello_A#4.wav",
        "A#5": "Cello_A#5.wav",
        "A#6": "Cello_A#6.wav",
        // "C#3": "Cello_C#3.wav",
        // "C#4": "Cello_C#4.wav",
        // "C#5": "Cello_C#5.wav",
        // "C#6": "Cello_C#6.wav",
        // "C#7": "Cello_C#7.wav",
        E3: "Cello_E3.wav",
        E4: "Cello_E4.wav",
        E5: "Cello_E5.wav",
        E6: "Cello_E6.wav",
        // E7: "Cello_E7.wav", // Top range can be covered by E6
        // "G3": "Cello_G3.wav",
        // "G4": "Cello_G4.wav",
        // "G5": "Cello_G5.wav",
        // "G6": "Cello_G6.wav",
      };
    } else if (pianoState.instrument === "sax") {
      // The sax samples were extremely dense, sometimes only 1 semitone apart.
      // We'll keep one sample every 4-5 semitones (a major third / perfect fourth).
      sampleUrls = {
        A2: "TSAX45-2.wav",
        // "A#2": "TSAX46.wav",
        // B2: "TSAX47.wav",
        "C#3": "TSAX49.wav",
        // "D#3": "TSAX51.wav",
        // E3: "TSAX52-2.wav",
        F3: "TSAX53-3.wav",
        // "F#3": "TSAX54.wav",
        // G3: "TSAX55-2.wav",
        A3: "TSAX57.wav",
        // "A#3": "TSAX58-2.wav",
        // B3: "TSAX59.wav",
        C4: "TSAX60-3.wav",
        // "C#4": "TSAX61.wav",
        D4: "TSAX62-2.wav",
        // "D#4": "TSAX63.wav",
        F4: "TSAX65-2.wav",
        // "F#4": "TSAX66.wav",
        // G4: "TSAX67-3.wav",
        "G#4": "TSAX68.wav",
        A4: "TSAX69-3.wav",
        // B4: "TSAX71-2.wav",
        C5: "TSAX72.wav",
        // "D#5": "TSAX75.wav",
        "F#5": "TSAX78-2.wav",
        // G5: "TSAX79.wav",
        // "G#5": "TSAX80-2.wav",
        "A#5": "TSAX82-2.wav",
        // B5: "TSAX83.wav",
        C6: "TSAX84-2.wav",
      };
    } else {
      // The default piano samples were sampled every 2 semitones in the bass/mids.
      // We can optimize this by keeping samples every 3-4 semitones.
      sampleUrls = {
        C2: "SteinwayD_m_C2_L.wav",
        // D2: "SteinwayD_m_D2_L.wav",
        E2: "SteinwayD_m_E2_L.wav",
        // "F#2": "SteinwayD_m_F#2_L.wav",
        "G#2": "SteinwayD_m_G#2_L.wav",
        // "A#2": "SteinwayD_m_A#2_L.wav",
        C3: "SteinwayD_m_C3_L.wav",
        // D3: "SteinwayD_m_D3_L.wav",
        E3: "SteinwayD_m_E3_L.wav",
        // "F#3": "SteinwayD_m_F#3_L.wav",
        "G#3": "SteinwayD_m_G#3_L.wav",
        // "A#3": "SteinwayD_m_A#3_L.wav",
        C4: "SteinwayD_m_C4_L.wav",
        // D4: "SteinwayD_m_D4_L.wav",
        E4: "SteinwayD_m_E4_L.wav",
        "F#4": "SteinwayD_m_F#4_L.wav", // Keep this one for the upper-mid range
        // "G#4": "SteinwayD_m_G#4_L.wav",
        "A#4": "SteinwayD_m_A#4_L.wav",
        C5: "SteinwayD_m_C5_L.wav",
        "F#5": "SteinwayD_m_F#5_L.wav", // Larger jump is ok in high register
        C6: "SteinwayD_m_C6_L.wav",
      };
    } // 3. Create and load the audio sampler

    pianoState.sampler = new Tone.Sampler({
      urls: sampleUrls,
      release: 1,
      baseUrl: "/static/samples/",
    }).toDestination();

    await Tone.loaded();
    pianoState.samplerReady = true;
    console.log("Sampler is ready!"); // 4. NEW: Initialize spectrum visualizer

    initializeSpectrumVisualizer(); // 5. Update the global state to indicate the app is unlocked

    pianoState.isUnlocked = true;

    return true; // Signal success
  } catch (error) {
    console.error("Error during audio initialization:", error);
    pianoState.isUnlocked = false; // Ensure state is correct on failure
    return false; // Signal failure
  }
}

// ===================================================================
// NEW SPECTRUM HELPER FUNCTIONS
// ===================================================================

/**
 * Initializes the spectrum visualizer
 */
function initializeSpectrumVisualizer() {
  try {
    // Check if spectrum container exists in the DOM
    const spectrumContainer = document.getElementById("spectrum");
    if (!spectrumContainer) {
      console.log("Spectrum container not found - spectrum disabled");
      return;
    } // Initialize spectrum with improved options for better upper frequency detection

    const spectrumOptions = {
      fftSize: 4096, // Higher resolution for better frequency precision
      smoothingTimeConstant: 0.8,
      canvasHeight: 120,
      backgroundColor: "#000000",
      colorScheme: "blue fire",
      showGrid: false,
      showLabels: false,
      minDb: -90, // More sensitive to weak signals
      maxDb: -5, // Higher ceiling for strong signals
      enableFrequencyGain: true, // Boost higher frequencies
      debugMode: false, // Set to true to see frequency analysis in console
    };

    initializeSpectrum(spectrumOptions);
    spectrumInitialized = true; // Connect to the sampler if it exists

    if (pianoState.sampler) {
      connectSpectrumToAudio(pianoState.sampler);
      console.log("Spectrum connected to piano sampler");
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

/**
 * Triggers or releases notes on the Tone.js sampler.
 * @param {string|string[]} note - The note name(s) (e.g., "C4", ["C4", "E4", "G4"]).
 * @param {boolean} on - True to trigger attack, false to trigger release.
 * @param {number} [velocity=100] - MIDI velocity (1-127).
 */
export function trigger(note, on, velocity = 100) {
  if (!pianoState.samplerReady) return;

  if (on) {
    pianoState.sampler.triggerAttack(note, Tone.now(), velocity / 127); // NEW: Start spectrum visualization when notes are played

    startSpectrumIfReady();
  } else {
    pianoState.sampler.triggerRelease(note); // Check if any notes are still active

    const hasActiveNotes =
      Object.keys(pianoState.activeNotes).length > 0 ||
      Object.keys(pianoState.activeDiatonicChords).length > 0; // NEW: Stop spectrum if no notes are active (with small delay)

    if (!hasActiveNotes) {
      setTimeout(() => {
        const stillHasActiveNotes =
          Object.keys(pianoState.activeNotes).length > 0 ||
          Object.keys(pianoState.activeDiatonicChords).length > 0;
        if (!stillHasActiveNotes) {
          stopSpectrumIfActive();
        }
      }, 100); // Small delay to handle rapid note changes
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
  } // Play the chord

  trigger(notesForPlayback, true);
  paintChordOnTheFly({ notes: notesForPlayback }); // NEW: Start spectrum when chord begins

  if (spectrumInitialized) {
    startSpectrumIfReady();
  } // Store chord data consistently for both input methods

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
  if (!chordData) return; // Stop the audio

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
  } // NEW: Check if spectrum should stop after chord ends

  setTimeout(() => {
    const hasActiveNotes =
      Object.keys(pianoState.activeNotes).length > 0 ||
      Object.keys(pianoState.activeDiatonicChords).length > 0;
    if (!hasActiveNotes) {
      stopSpectrumIfActive();
    }
  }, 100); // Handle score writing if enabled

  if (chordData.writeToScore) {
    console.log("Writing chord to score:", chordData);
    const heldTime = performance.now() - chordData.startTime; // FIX: Updated quantization logic to include dotted notes. // Checks must be in order from longest to shortest duration.

    let duration = "q"; // Default to quarter note
    if (heldTime >= DURATION_THRESHOLDS.w) duration = "w";
    else if (heldTime >= DURATION_THRESHOLDS["h."]) duration = "h.";
    else if (heldTime >= DURATION_THRESHOLDS.h) duration = "h";
    else if (heldTime >= DURATION_THRESHOLDS["q."]) duration = "q."; // The default remains 'q' // Use the notes directly from chord data instead of looking them up again
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
  } // Handle visual repainting

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
