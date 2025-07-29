// keyboardHelpers.js
import { pianoState } from "../core/appState.js";
import audioManager from "../core/audioManager.js";
import {
  DURATION_THRESHOLDS,
  getChordByDegree,
  notesByMidiKeyAware
} from "../core/note-data.js";
import { writeNote } from "../score/scoreWriter.js";
import { addAdvancedKeyboardListeners, addInstrumentDraggingListeners } from "../ui/listenerManager.js";
import {
  clearChordHi,
  clearHi,
  paintChord,
  paintChordOnTheFly,
} from "./instrumentHelpers.js";
import {
  startKey,
  stopKey,
  trigger,
  triggerAttackRelease,
} from "./playbackHelpers.js";
/**
 * Get a chord based on the current key signature and scale degree
 * @param {number} [degree=1] - Scale degree (1-7), defaults to 1 (tonic)
 * @returns {Object|null} Chord object from CHORD_DEFINITIONS or null if not found
 */
/**
 * Handles keydown events. This function now assumes audio is ready.
 * It will return early if audio is not ready.
 */
// Add this constant at the top of the file
// Add this constant at the top of the file
const ALL_HANDLED_KEYS = {
  // Chord keys - regular numbers
  '1': { type: 'chord', degree: 1, useBass: false },
  '2': { type: 'chord', degree: 2, useBass: false },
  '3': { type: 'chord', degree: 3, useBass: false },
  '4': { type: 'chord', degree: 4, useBass: false },
  '5': { type: 'chord', degree: 5, useBass: false },
  '6': { type: 'chord', degree: 6, useBass: false },
  '7': { type: 'chord', degree: 7, useBass: false },
  
  // Chord keys - shifted symbols (bass voicing)
  '!': { type: 'chord', degree: 1, useBass: true },
  '@': { type: 'chord', degree: 2, useBass: true },
  '#': { type: 'chord', degree: 3, useBass: true },
  '$': { type: 'chord', degree: 4, useBass: true },
  '%': { type: 'chord', degree: 5, useBass: true },
  '^': { type: 'chord', degree: 6, useBass: true },
  '&': { type: 'chord', degree: 7, useBass: true },
  
  // Rest keys
  'z': { type: 'rest', clef: 'bass' },
  'x': { type: 'rest', clef: 'treble' },
  
  // Black Keys keys
  'q': { type: 'piano' },
  'w': { type: 'piano' },
  'e': { type: 'piano' },
  'r': { type: 'piano' },
  't': { type: 'piano' },
  'u': { type: 'piano' },
  'i': { type: 'piano' },
  'o': { type: 'piano' },
  'p': { type: 'piano' },

  // White keys
  'a': { type: 'piano' },
  's': { type: 'piano' },
  'd': { type: 'piano' },
  'f': { type: 'piano' },
  'g': { type: 'piano' },
  'h': { type: 'piano' },
  ' ': { type: 'piano' }, // spacebar
  'j': { type: 'piano' },
  'k': { type: 'piano' },
  'l': { type: 'piano' },
  ';': { type: 'piano' },
};

export function handleKeyDown(e) {
  if (!audioManager.isAudioReady()) {
    console.warn("Audio not ready for keyboard input.");
    return;
  }

  if (e.repeat) return;
  
  // Ignore modifier keys
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
    return;
  }
  
  const k = e.key.toLowerCase();
  console.log(`handleKeyDown: "${e.key}" (lowercase: "${k}")`);
  
  // Check if it's a key we handle
  const handledKey = ALL_HANDLED_KEYS[k];
  
  if (!handledKey) {
    console.log(`Ignoring unhandled key: "${k}"`);
    return;
  }
  
  // Only proceed if this specific key isn't already held
  if (pianoState.held.has(k)) {
    console.log(`Key "${k}" already held, ignoring`);
    return;
  }

  e.preventDefault();

  // Handle based on key type
  if (handledKey.type === 'chord') {
    console.log(`Processing chord key: "${k}" (degree ${handledKey.degree}, ${handledKey.useBass ? 'bass' : 'treble'})`);
    pianoState.held.set(k, null);
    playScaleChord(handledKey.degree, k, true, handledKey.useBass);
    if (pianoState.activeDiatonicChords[k]) {
      pianoState.activeDiatonicChords[k].startTime = performance.now();
    }
  } else if (handledKey.type === 'rest') {
    console.log(`Processing rest key: "${k}" (${handledKey.clef})`);
    pianoState.held.set(k, null);
    pianoState.activeRests[k] = {
      startTime: performance.now(),
      clef: handledKey.clef,
    };
  } else if (handledKey.type === 'piano') {
    console.log(`Processing piano key: "${k}"`);
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
  // Ignore modifier keys
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
    console.log(`Ignoring modifier key release: "${e.key}"`);
    return;
  }
  
  console.log("Clearing chord and key highlights in handleKeyUp");
  clearChordHi();
  clearHi();

  const k = e.key.toLowerCase();
  console.log(`handleKeyUp called with key: "${e.key}", lowercase: "${k}"`);
  
  // Check if it's a key we handle
  const handledKey = ALL_HANDLED_KEYS[k];
  
  if (!handledKey) {
    console.log(`Ignoring unhandled key release: "${k}"`);
    return;
  }
  
  if (!pianoState.held.has(k)) {
    console.log(`Key "${k}" not found in held keys, returning`);
    return;
  }

  console.log(`Key "${k}" found in held keys, processing release...`);

  if (handledKey.type === 'chord') {
    console.log(`Chord key release detected: "${e.key}" (degree ${handledKey.degree})`);
    stopScaleChord(k);
  } else if (handledKey.type === 'rest') {
    console.log(`Rest key release detected: "${k}"`);
    const restData = pianoState.activeRests[k];
    if (restData) {
      const heldTime = performance.now() - restData.startTime;
      console.log(`Rest held for ${heldTime}ms`);
      
      let duration = "q";
      if (heldTime >= DURATION_THRESHOLDS.w) duration = "w";
      else if (heldTime >= DURATION_THRESHOLDS.h) duration = "h";

      console.log(`Writing rest with duration: ${duration}, clef: ${restData.clef}`);
      const restPositionNote = restData.clef === "bass" ? "D3" : "B4";
      writeNote({
        clef: restData.clef,
        duration,
        notes: [restPositionNote],
        chordName: "Rest",
        isRest: true,
      });
      delete pianoState.activeRests[k];
    } else {
      console.warn(`No rest data found for key "${k}"`);
    }
  } else if (handledKey.type === 'piano') {
    console.log(`Piano key release detected: "${k}"`);
    const actualMidi = pianoState.held.get(k);
    console.log(`Actual MIDI for key "${k}": ${actualMidi}`);
    
    const keyEl = pianoState.noteEls[actualMidi];
    if (keyEl && keyEl.dataset.playing === "note") {
      const heldTime = performance.now() - parseFloat(keyEl.dataset.startTime);
      console.log(`Piano key held for ${heldTime}ms`);
      
      let duration = "q";
      if (heldTime >= DURATION_THRESHOLDS.w) duration = "w";
      else if (heldTime >= DURATION_THRESHOLDS.h) duration = "h";

      const noteInfo = notesByMidiKeyAware(actualMidi);
      const noteNameForScore = noteInfo.name;
      const clef = noteInfo.midi < 60 ? "bass" : "treble";

      console.log(`Writing note: ${noteNameForScore}, duration: ${duration}, clef: ${clef}`);
      stopKey(keyEl);
      writeNote({
        clef,
        duration,
        notes: [noteNameForScore],
        chordName: noteNameForScore,
      });
    } else {
      console.warn(`No valid key element found for MIDI ${actualMidi} or not currently playing`);
    }
  }
  
  console.log(`Removing "${k}" and "${e.key}" from held keys`);
  pianoState.held.delete(k);
  pianoState.held.delete(e.key);
}

export function handleInitialKeyboard(e) {
  e.stopPropagation();
  e.preventDefault();
  if (e.repeat) return;
  
  // Ignore modifier keys
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
    console.log(`Ignoring modifier key: "${e.key}"`);
    return;
  }
  
  const k = e.key.toLowerCase();
  console.log(`handleInitialKeyboard called with key: "${e.key}", lowercase: "${k}"`);

  // Check if it's a key we handle
  const handledKey = ALL_HANDLED_KEYS[k];
  
  if (!handledKey) {
    console.log(`Ignoring unhandled key: "${k}"`);
    return;
  }

  // Handle chord keys
  if (handledKey.type === 'chord') {
    console.log(`Chord key detected: "${e.key}" (degree ${handledKey.degree}, ${handledKey.useBass ? 'bass' : 'treble'})`);

    const unlockAction = () => {
      console.log("Audio unlocked via chord key. Setting up advanced listeners.");
      addAdvancedKeyboardListeners();
      addInstrumentDraggingListeners();

      // Get the chord object
      const chord = getChordByDegree(handledKey.degree);
      if (!chord) {
        console.warn(`No chord found for degree ${handledKey.degree}`);
        return;
      }

      // Choose voicing based on useBass parameter
      console.log("Chord object:", chord);
      const chordNotes = handledKey.useBass ? chord.bass : chord.treble;
      const chordName = chord.displayName;
      console.log(`Selected voicing - chordName: ${chordName}, notes:`, chordNotes, `(${handledKey.useBass ? 'bass' : 'treble'})`);

      if (chordNotes && chordNotes.length > 0) {
        console.log(`Calling triggerAttackRelease for chord: ${chordName}, notes: ${JSON.stringify(chordNotes)}`);
        triggerAttackRelease(chordNotes, "q", 100, true, chordName);
        
        // Clear chord highlights after a brief delay to allow the chord to play
        setTimeout(() => {
          clearChordHi();
          clearHi();
        }, 250);
      } else {
        console.warn(`No notes found for chord ${chordName} (${handledKey.useBass ? 'bass' : 'treble'})`);
      }
    };

    console.log("Calling audioManager.unlockAndExecute for chord");
    audioManager.unlockAndExecute(unlockAction);
    return;
  }

  // Handle piano keys
  if (handledKey.type === 'piano') {
    console.log(`Piano key "${k}" detected`);
    const baseMidi = pianoState.keyMap[k];
    let targetMidi = baseMidi;

    // Handle shift for sharp/flat (if next note is black)
    const nextNote = notesByMidiKeyAware(baseMidi + 1);
    if (e.shiftKey && nextNote?.isBlack) {
      targetMidi = baseMidi + 1;
      console.log(`Shift key detected, using sharp/flat: ${baseMidi} -> ${targetMidi}`);
    }

    const noteInfo = notesByMidiKeyAware(targetMidi);
    if (!noteInfo) {
      console.warn(`No note info found for MIDI ${targetMidi}`);
      return;
    }

    const keyDetails = {
      midi: targetMidi,
      noteName: noteInfo.name,
      clef: noteInfo.midi < 60 ? "bass" : "treble"
    };

    console.log("Piano key details:", keyDetails);

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

    console.log("Calling audioManager.unlockAndExecute for piano note");
    audioManager.unlockAndExecute(unlockAction);
    return;
  }

  // Handle rest keys (if needed for initial keyboard)
  if (handledKey.type === 'rest') {
    console.log(`Rest key detected: "${k}" - not typically handled in initial keyboard`);
    // You might want to add rest handling here if needed
  }
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