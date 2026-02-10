// keyboardHelpers.js
import { pianoState } from "../core/appState.js";
import audioManager from "../core/audioManager.js";
import {
  getDurationThresholds,
  getChordByDegree,
  notesByMidiKeyAware
} from "../core/note-data.js";
import { writeNote } from "../score/scoreWriter.js";
import { addAdvancedKeyboardListeners, addInstrumentDraggingListeners } from "../ui/listenerManager.js";
import {
  batchNoteOn,
  batchNoteOff,
  playScaleChord,
  stopScaleChord,
  triggerAttackRelease,
} from "./playbackHelpers.js";
import { handleNoteOn as playAlongNoteOn, handleNoteOff as playAlongNoteOff } from "../score/playAlongController.js";
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
  'y': { type: 'piano' },
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
    console.warn("Audio not ready for direct key interaction. Attempting to re-unlock...");
    handleInitialKeyboard(e);
    return;
  }

  if (e.repeat) return;
  
  // Ignore modifier keys
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
    return;
  }
  
  // Ignore any key combination with Ctrl, Alt, or Meta (allow browser shortcuts to work)
  if (e.ctrlKey || e.altKey || e.metaKey) {
    console.log(`Ignoring key with modifier: "${e.key}" (ctrl: ${e.ctrlKey}, alt: ${e.altKey}, meta: ${e.metaKey})`);
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

  e.stopPropagation();
  e.preventDefault();

  // Play-Along Mode: route piano key input to the play-along controller
  if (pianoState.playAlong?.active && handledKey.type === 'piano') {
    const baseMidi = pianoState.keyMap[k];
    let targetMidi = baseMidi;
    const nextNote = notesByMidiKeyAware(baseMidi + 1);
    if (e.shiftKey && nextNote?.isBlack) {
      targetMidi = baseMidi + 1;
    }
    pianoState.held.set(k, targetMidi);
    playAlongNoteOn(targetMidi, 100);
    return;
  }

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
      batchNoteOn(keyEl, pianoState.velocity);
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
  // clearChordHi(); // Handled by trigger/updateKeyVisuals
  // clearHi();

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

  // Play-Along Mode: route piano key release to the play-along controller
  if (pianoState.playAlong?.active && handledKey.type === 'piano') {
    const actualMidi = pianoState.held.get(k);
    if (actualMidi !== undefined) {
      playAlongNoteOff(actualMidi);
    }
    pianoState.held.delete(k);
    pianoState.held.delete(e.key);
    return;
  }

  if (handledKey.type === 'chord') {
    console.log(`Chord key release detected: "${e.key}" (degree ${handledKey.degree})`);
    stopScaleChord(k);
  } else if (handledKey.type === 'rest') {
    console.log(`Rest key release detected: "${k}"`);
    const restData = pianoState.activeRests[k];
    if (restData) {
      const heldTime = performance.now() - restData.startTime;
      console.log(`Rest held for ${heldTime}ms`);
      
      const thresholds = getDurationThresholds(pianoState.tempo);
      // Rests don't support dotted durations in our VexFlow implementation
      let duration = "8";
      if (pianoState.toggleFixedDuration) {
        duration = pianoState.quantize.replace('.', ''); // Remove dot if quantize is dotted
      } else if (heldTime >= thresholds.w) duration = "w";
      else if (heldTime >= thresholds.h) duration = "h";
      else if (heldTime >= thresholds.q) duration = "q";

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
    const keyEl = pianoState.noteEls[actualMidi];
    if (keyEl) {
      batchNoteOff(keyEl);
    } else {
      console.warn(`No key element found for MIDI ${actualMidi}`);
    }
  }
  
  console.log(`Removing "${k}" and "${e.key}" from held keys`);
  pianoState.held.delete(k);
  pianoState.held.delete(e.key);
}

export function handleInitialKeyboard(e) {
  if (e.repeat) return;
  
  // Ignore modifier keys
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
    console.log(`Ignoring modifier key: "${e.key}"`);
    return;
  }
  
  // Ignore any key combination with Ctrl, Alt, or Meta (allow browser shortcuts to work)
  if (e.ctrlKey || e.altKey || e.metaKey) {
    console.log(`Ignoring key with modifier: "${e.key}" (ctrl: ${e.ctrlKey}, alt: ${e.altKey}, meta: ${e.metaKey})`);
    return;
  }
  
  const k = e.key.toLowerCase();


  // Check if it's a key we handle
  const handledKey = ALL_HANDLED_KEYS[k];
  
  if (!handledKey) {
    console.log(`Ignoring unhandled key: "${k}"`, 'allowing browser default behavior');
    return;
  }

  // Only prevent default for keys we actually handle
  e.stopPropagation();
  e.preventDefault();

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
        triggerAttackRelease(chordNotes, pianoState.quantize, pianoState.velocity, true, chordName);
        
        // Visual cleanup is handled by triggerAttackRelease
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
      triggerAttackRelease([keyDetails.noteName], pianoState.quantize, pianoState.velocity, true, keyDetails.noteName);
      
      // Visual cleanup is handled by triggerAttackRelease
    };

    console.log("Calling audioManager.unlockAndExecute for piano note");
    audioManager.unlockAndExecute(unlockAction);
    return;
  }

  // Handle rest keys (if needed for initial keyboard)
  if (handledKey.type === 'rest') {

    // You might want to add rest handling here if needed
  }
}

/**
 * Starts a rest for the given clef (for button press)
 * @param {string} clef - 'bass' or 'treble'
 * @returns {number} - The start time for duration calculation
 */
export function startRest(clef) {
  const key = clef === 'bass' ? 'bass-rest-btn' : 'treble-rest-btn';
  const startTime = performance.now();
  pianoState.activeRests[key] = {
    startTime,
    clef,
  };
  return startTime;
}

/**
 * Ends a rest for the given clef (for button release) and writes it to the score
 * @param {string} clef - 'bass' or 'treble'
 */
export function endRest(clef) {
  const key = clef === 'bass' ? 'bass-rest-btn' : 'treble-rest-btn';
  const restData = pianoState.activeRests[key];
  
  if (!restData) {
    console.warn(`No rest data found for ${clef}`);
    return;
  }
  
  const heldTime = performance.now() - restData.startTime;
  const thresholds = getDurationThresholds(pianoState.tempo);
  
  // Rests don't support dotted durations in our VexFlow implementation
  // Use only non-dotted durations
  let duration = pianoState.quantize.replace('.', ''); // Remove dot if quantize is dotted
  if (heldTime >= thresholds.w) duration = "w";
  else if (heldTime >= thresholds.h) duration = "h";
  else if (heldTime >= thresholds.q) duration = "q";
  else if (heldTime >= thresholds["8"]) duration = "8";
  
  const restPositionNote = clef === "bass" ? "D3" : "B4";
  writeNote({
    clef,
    duration,
    notes: [restPositionNote],
    chordName: "Rest",
    isRest: true,
  });
  
  delete pianoState.activeRests[key];
}
