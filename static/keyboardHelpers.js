// keyboardHelpers.js
import {
  NOTES_BY_MIDI,
  NOTES_BY_NAME,
  WHITE_KEY_WIDTH,
  BLACK_KEY_WIDTH,
  ALL_NOTE_INFO,
  MAJOR_DIATONIC_LABELS,
  MINOR_DIATONIC_LABELS,
  CHORD_STRUCTURES,
  DURATION_THRESHOLDS,
  CHORD_DEFINITIONS,
  notesByMidiKeyAware,
  getKeySignature,
  DIATONIC_SCALES,
  getChordByDegree,
} from "./note-data.js";
import { writeNote } from "./scoreWriter.js"; 
import { updateNowPlayingDisplay } from "./uiHelpers.js"; 
import { pianoState } from "./appState.js"; 
import {
  trigger,
  triggerAttackRelease, 
  startKey,
  stopKey,
} from "./playbackHelpers.js";
import {
  clearChordHi,
  clearHi,
  paintChordOnTheFly,
  paintChord,
} from "./instrumentHelpers.js";
import audioManager from "./audioManager.js";
import { addBasicKeyboardListeners, addAdvancedKeyboardListeners, addBasicInstrumentListeners, addAdvancedInstrumentListeners, addButtonListeners, addInstrumentDraggingListeners } from "./listenerManager.js";
/**
 * Get a chord based on the current key signature and scale degree
 * @param {number} [degree=1] - Scale degree (1-7), defaults to 1 (tonic)
 * @returns {Object|null} Chord object from CHORD_DEFINITIONS or null if not found
 */
/**
 * Get a chord based on the current key signature and scale degree
 * @param {number} [degree=1] - Scale degree (1-7), defaults to 1 (tonic)
 * @returns {Object|null} Chord object from CHORD_DEFINITIONS or null if not found
 */
/**
 * Handles keydown events. This function now assumes audio is ready.
 * It will return early if audio is not ready.
 */
export function handleKeyDown(e) {
  // Crucial: Only proceed if audio is already ready.
  // The initial unlock is now handled by the .instrument-panel__keyboard click listener.
  if (!audioManager.isAudioReady()) {
    console.warn("Audio not ready for keyboard input.");
    return;
  }

  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (pianoState.held.has(k)) return;

  if (["1", "2", "3", "4", "5", "6", "7"].includes(e.key)) {
    e.preventDefault();
    pianoState.held.set(k, null);
    const degree = parseInt(e.key, 10);
    const useBass = e.shiftKey; // Shift+1-7 uses bass voicing
    playScaleChord(degree, k, true, useBass);
    if (pianoState.activeDiatonicChords[k]) {
      pianoState.activeDiatonicChords[k].startTime = performance.now();
    }
  } else if (k === "z" || k === "x") {
    e.preventDefault();
    pianoState.held.set(k, null);
    pianoState.activeRests[k] = {
      startTime: performance.now(),
      clef: k === "z" ? "bass" : "treble",
    };
    return;
  } else if (pianoState.keyMap[k] !== undefined) {
    e.preventDefault();
    const baseMidi = pianoState.keyMap[k];
    let targetMidi = baseMidi;
    const nextNote = notesByMidiKeyAware(baseMidi + 1);
    if (e.shiftKey && nextNote?.isBlack) {
      targetMidi = baseMidi + 1;
    }
    const keyEl = pianoState.noteEls[targetMidi];
    if (keyEl) {
      pianoState.held.set(k, targetMidi);
      keyEl.dataset.startTime = performance.now();
      startKey(keyEl);
    }
  }
}

export function handleKeyUp(e) {
  // This function assumes audio is ready, like handleKeyDown.
  // No need for audioManager.isAudioReady() check here, as keydown would have handled it.
  clearChordHi();
  clearHi();

  const k = e.key.toLowerCase();
  if (!pianoState.held.has(k)) return;

  if (["1", "2", "3", "4", "5", "6", "7"].includes(e.key)) {
    stopScaleChord(k);
  } else if (k === "z" || k === "x") {
    const restData = pianoState.activeRests[k];
    if (restData) {
      const heldTime = performance.now() - restData.startTime;
      let duration = "q";
      if (heldTime >= DURATION_THRESHOLDS.w) duration = "w";
      else if (heldTime >= DURATION_THRESHOLDS.h) duration = "h";

      const restPositionNote = restData.clef === "bass" ? "D3" : "B4";
      writeNote({
        clef: restData.clef,
        duration,
        notes: [restPositionNote],
        chordName: "Rest",
        isRest: true,
      });
      delete pianoState.activeRests[k];
    }
  } else if (pianoState.keyMap[k] !== undefined) {
    const actualMidi = pianoState.held.get(k);
    const keyEl = pianoState.noteEls[actualMidi];
    if (keyEl && keyEl.dataset.playing === "note") {
      const heldTime = performance.now() - parseFloat(keyEl.dataset.startTime);
      let duration = "q";
      if (heldTime >= DURATION_THRESHOLDS.w) duration = "w";
      else if (heldTime >= DURATION_THRESHOLDS.h) duration = "h";

      const noteInfo = notesByMidiKeyAware(actualMidi);
      const noteNameForScore = noteInfo.name;
      const clef = noteInfo.midi < 60 ? "bass" : "treble";

      stopKey(keyEl);
      writeNote({
        clef,
        duration,
        notes: [noteNameForScore],
        chordName: noteNameForScore,
      });
    }
  }
  pianoState.held.delete(k);
  pianoState.held.delete(e.key);
}

export function handleInitialKeyboard(e) {
  e.stopPropagation();
  e.preventDefault();
  if (e.repeat) return;
  const k = e.key.toLowerCase();

  // Handle chord keys (1-7)
  if (["1", "2", "3", "4", "5", "6", "7"].includes(e.key)) {
    const degree = parseInt(e.key, 10);
    const useBass = e.shiftKey;

    const unlockAction = () => {
      console.log("Audio unlocked via chord key. Setting up advanced listeners.");
      addAdvancedKeyboardListeners();
      addInstrumentDraggingListeners();

      // Get the chord object
      const chord = getChordByDegree(degree);
      if (!chord) {
        console.warn(`No chord found for degree ${degree}`);
        return;
      }

      // Choose voicing based on useBass parameter
      const chordNotes = useBass ? chord.bass : chord.treble;
      const chordName = chord.displayName;

      if (chordNotes && chordNotes.length > 0) {
        console.log(`Calling triggerAttackRelease for chord: ${chordName}, notes: ${JSON.stringify(chordNotes)}`);
        triggerAttackRelease(chordNotes, "q", 100, true, chordName);
        
        // Clear chord highlights after a brief delay to allow the chord to play
        setTimeout(() => {
          clearChordHi();
          clearHi();
        }, 250);
      } else {
        console.warn(`No notes found for chord ${chordName} (${useBass ? 'bass' : 'treble'})`);
      }
    };

    audioManager.unlockAndExecute(unlockAction);
    return;
  }

  // Handle piano keys
  if (pianoState.keyMap[k] === undefined) return;

  const baseMidi = pianoState.keyMap[k];
  let targetMidi = baseMidi;

  // Handle shift for sharp/flat (if next note is black)
  const nextNote = notesByMidiKeyAware(baseMidi + 1);
  if (e.shiftKey && nextNote?.isBlack) {
    targetMidi = baseMidi + 1;
  }

  const noteInfo = notesByMidiKeyAware(targetMidi);
  if (!noteInfo) return;

  const keyDetails = {
    midi: targetMidi,
    noteName: noteInfo.name,
    clef: noteInfo.midi < 60 ? "bass" : "treble"
  };

  const unlockAction = () => {
    console.log("Audio unlocked via keyboard. Setting up advanced listeners.");
    addAdvancedKeyboardListeners();
    addInstrumentDraggingListeners();

    console.log(`Calling triggerAttackRelease for note: ${keyDetails.noteName}`);
    triggerAttackRelease([keyDetails.noteName], "q", 100, true, keyDetails.noteName);
    
    // Clear highlights after a brief delay for single notes too
    setTimeout(() => {
      clearChordHi();
      clearHi();
    }, 250);
  };

  audioManager.unlockAndExecute(unlockAction);
}

/**
 * Play a diatonic chord using the new getChordByDegree function
 * @param {number} degree - Scale degree (1-7)
 * @param {string} key - Key identifier for tracking
 * @param {boolean} writeToScore - Whether to write to score when released
 * @param {boolean} useBass - Whether to use bass voicing (shift key pressed)
 */
function playScaleChord(degree, key, writeToScore = true, useBass = false) {
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
function stopScaleChord(key) {
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