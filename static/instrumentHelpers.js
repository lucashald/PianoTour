// instrumentHelpers.js

// ===================================================================
// Imports
// ===================================================================

import { pianoState } from "./appState.js"; 
import {
  trigger,
  triggerAttackRelease, 
  startKey,
  stopKey,
  playDiatonicChord,
  stopDiatonicChord,
} from "./playbackHelpers.js"; 
import {
  NOTES_BY_MIDI,
  NOTES_BY_NAME,
  WHITE_KEY_WIDTH,
  BLACK_KEY_WIDTH,
  ALL_NOTE_INFO,
  majorDiatonicLabels,
  minorDiatonicLabels,
  CHORD_STRUCTURES,
  DURATION_THRESHOLDS,
  chordDefinitions,
  notesByMidiKeyAware,
} from "./note-data.js"; 
import { writeNote } from "./scoreWriter.js"; 
import { updateNowPlayingDisplay } from "./uiHelpers.js"; 

// NEW: Import audioManager for its core unlock functionality
import audioManager from "./audioManager.js"; 

// ===================================================================
// Constants (derived from imported data)
// ===================================================================

const WHITE_KEYS_IN_VIEW = ["a", "s", "d", "f", " ", "j", "k", "l", ";"];
const NS = "http://www.w3.org/2000/svg";
const allNotes = ALL_NOTE_INFO;
const whiteNoteMidis = ALL_NOTE_INFO.filter((n) => !n.isBlack).map(
  (n) => n.midi
);

const rightmostNote = ALL_NOTE_INFO.reduce((max, note) => (note.x > max.x ? note : max), ALL_NOTE_INFO[0]);
const rightmostKeyWidth = rightmostNote.isBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH;
const TOTAL_SVG_WIDTH = rightmostNote.x + rightmostKeyWidth;

const MIN_MIDI = 21; // A0
const MAX_MIDI = 108; // C8
const flattenerKeys = new Set([
  "q",
  "w",
  "e",
  "r",
  "t",
  "u",
  "i",
  "o",
  "p",
  "g",
]);

// ===================================================================
// Music Theory & Data Processing Helpers (Instrument-specific)
// ===================================================================

/**
 * Creates the mapping between keyboard characters and MIDI notes.
 * @param {number} baseIdx - The starting index in the whiteNoteMidis array.
 * @returns {object} The newly constructed keyMap object.
 */
function buildMap(baseIdx) {
  const keyMap = {};
  WHITE_KEYS_IN_VIEW.forEach((k, i) => {
    if (whiteNoteMidis[baseIdx + i]) {
      keyMap[k] = whiteNoteMidis[baseIdx + i];
    }
  });

  const keyModifiers = {
    a: { flatKey: "q" },
    s: { flatKey: "w" },
    d: { flatKey: "e" },
    f: { flatKey: "r" },
    " ": { flatKey: "t" },
    j: { flatKey: "u" },
    k: { flatKey: "i" },
    l: { flatKey: "o" },
    ";": { flatKey: "p" },
  };

  for (const baseKeyChar in keyModifiers) {
    const modifier = keyModifiers[baseKeyChar];
    const baseMidi = keyMap[baseKeyChar];
    if (baseMidi === undefined) continue;

    const flatMidi = baseMidi - 1;
    if (NOTES_BY_MIDI[flatMidi]?.isBlack) {
      if (modifier.flatKey) keyMap[modifier.flatKey] = flatMidi;
    }
  }
  keyMap["h"] = keyMap[" "];
  keyMap["g"] = keyMap["t"];
  return keyMap;
}

/**
 * Calculates the notes of a triad based on a center note and quality.
 * @param {string} centerNoteName - The name of the center note (e.g., 'E4').
 * @param {string} quality - 'major' or 'minor'.
 * @returns {object|null} A chord object or null if invalid.
 */
export function getChord(centerNoteName, quality) {
  const structure = CHORD_STRUCTURES[quality];
  if (!structure) return null;
  const centerMidi = NOTES_BY_NAME[centerNoteName];
  if (centerMidi === undefined) return null;

  const chordMidiNotes = [
    centerMidi + structure.rootOffset,
    centerMidi,
    centerMidi + structure.fifthOffset,
  ];
  if (chordMidiNotes.some((midi) => !NOTES_BY_MIDI[midi])) return null;

  const chordNoteNames = chordMidiNotes.map((midi) => NOTES_BY_MIDI[midi].name);
  const rootNoteInfo = NOTES_BY_MIDI[chordMidiNotes[0]];
  const chordName = rootNoteInfo.pitchClass + (quality === "minor" ? "m" : "");
  const clef = chordMidiNotes[0] < 60 ? "bass" : "treble";
  return {
    notes: chordNoteNames,
    quality,
    clef,
    name: chordName,
    rootNoteName: rootNoteInfo.name,
  };
}

/**
 * Finds the nearest valid center note for a chord.
 * @param {number} startMidi - The MIDI number to start searching from.
 * @param {string} quality - 'major' or 'minor'.
 * @returns {string|null} The note name of the nearest valid center.
 */
function findNearestValidCenterNote(startMidi, quality) {
  const startNote = notesByMidiKeyAware(startMidi);
  if (startNote && getChord(startNote.name, quality)) {
    return startNote.name;
  }
  for (let i = 1; i <= 12; i++) {
    const downMidi = startMidi - i;
    const downNote = notesByMidiKeyAware(downMidi);
    if (downMidi >= MIN_MIDI && downNote && getChord(downNote.name, quality)) {
      return downNote.name;
    }
    const upMidi = startMidi + i;
    const upNote = notesByMidiKeyAware(upMidi);
    if (upMidi <= MAX_MIDI && upNote && getChord(upNote.name, quality)) {
      return upNote.name;
    }
  }
  return null;
}

// ===================================================================
// UI & DOM Manipulation Helpers (Instrument-specific)
// ===================================================================

/**
 * Draws a text label on a specific key of the SVG piano.
 * @param {number} midi - The MIDI number of the key.
 * @param {string} labelText - The text to display on the label.
 */
function drawLabelOnKey(midi, labelText) {
  const keyEl = pianoState.noteEls[midi];
  const keyData = NOTES_BY_MIDI[midi];
  if (!keyEl || !keyData) return;

  const group = document.createElementNS(NS, "g");
  const labelWidth = 14,
    labelHeight = 14;
  const centerX =
    keyData.x + (keyData.isBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH) / 2;
  const y = keyData.isBlack ? 80 - labelHeight - 2 : 120 - labelHeight - 2;

  const bg = document.createElementNS(NS, "rect");
  bg.setAttribute("x", centerX - labelWidth / 2);
  bg.setAttribute("y", y);
  bg.setAttribute("width", labelWidth);
  bg.setAttribute("height", labelHeight);
  bg.setAttribute("rx", 3);
  bg.setAttribute("ry", 3);
  bg.setAttribute("fill", "#eee");
  bg.setAttribute("stroke", "#ccc");

  const text = document.createElementNS(NS, "text");
  text.setAttribute("x", centerX);
  text.setAttribute("y", y + labelHeight * 0.8);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("fill", "#333");
  text.setAttribute("font-family", "monospace");
  text.setAttribute("font-size", "12");
  text.textContent = labelText;

  group.append(bg, text);
  (keyData.isBlack ? pianoState.gb : pianoState.gw).appendChild(group);

  pianoState.labelEls[midi] = { group };
}

/**
 * Positions the hand overlay (slider) based on current piano mode.
 */
function positionSlider() {
  const svgRect = pianoState.svg.getBoundingClientRect();
  if (svgRect.width === 0) return;
  const scale = svgRect.width / TOTAL_SVG_WIDTH;
  const isChordMode =
    pianoState.isMajorChordMode || pianoState.isMinorChordMode;

  let startX, endX;

  if (isChordMode) {
    const quality = pianoState.isMajorChordMode ? "major" : "minor";
    const chord = getChord(pianoState.chordCenterNote, quality);
    if (!chord) return;

    const midis = chord.notes.map((n) => NOTES_BY_NAME[n]);
    const minNote = NOTES_BY_MIDI[Math.min(...midis)];
    const maxNote = NOTES_BY_MIDI[Math.max(...midis)];
    if (!minNote || !maxNote) return;

    startX = minNote.x;
    endX = maxNote.x + (maxNote.isBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH);
  } else {
    const startNote = NOTES_BY_MIDI[whiteNoteMidis[pianoState.baseIdx]];
    const endNote = NOTES_BY_MIDI[whiteNoteMidis[pianoState.baseIdx + 8]];
    if (!startNote || !endNote) return;
    startX = startNote.x;
    endX = endNote.x + WHITE_KEY_WIDTH;
  }

  pianoState.overlay.style.left = `${startX * scale}px`;
  pianoState.overlay.style.width = `${(endX - startX) * scale}px`;
}

// ===================================================================
// Label and Highlight Painting Logic
// ===================================================================

/** Clears all labels from the piano keys. */
function clearLabels() {
  Object.values(pianoState.labelEls).forEach((item) => item.group.remove());
  pianoState.labelEls = {};
}

/** Creates labels for the mapped computer keyboard keys. */
function createMappedKeyLabels() {
  const labellableKeyMap = { ...pianoState.keyMap };
  delete labellableKeyMap["g"];
  delete labellableKeyMap["h"];
  Object.entries(labellableKeyMap).forEach(([k, m]) =>
    drawLabelOnKey(m, k.toUpperCase())
  );
}

/** Creates diatonic chord labels (Roman numerals). */
function createDiatonicLabels() {
  const rootMidi = NOTES_BY_NAME[pianoState.scaleTonic];
  if (rootMidi === undefined) return;
  const map = pianoState.isMajorChordMode
    ? majorDiatonicLabels
    : minorDiatonicLabels;

  // Only create labels for notes that exist on the piano
  map.intervals.forEach((interval, i) => {
    const targetMidi = rootMidi + interval;
    // Check if the MIDI note exists in our piano range and has a corresponding key element
    if (NOTES_BY_MIDI[targetMidi] && pianoState.noteEls[targetMidi]) {
      drawLabelOnKey(targetMidi, map.labels[i]);
    }
  });
}

/** Updates the labels displayed on the piano keys based on the current mode. */
function updateLabels() {
  clearLabels();
  if (!pianoState.toggleLabels) return;

  if (pianoState.isMajorChordMode || pianoState.isMinorChordMode) {
    createDiatonicLabels();
  } else {
    createMappedKeyLabels();
  }
}

/** Clears single-note mode highlights from piano keys. */
function clearHi() {
  pianoState.hi.forEach((m) =>
    pianoState.noteEls[m]?.classList.remove(
      "left-white",
      "left-black",
      "middle",
      "right-white",
      "right-black"
    )
  );
  pianoState.hi = [];
}

/** Paints highlights on keys for single-note mode. */
function paint() {
  clearHi();
  const centerMidi = whiteNoteMidis[pianoState.baseIdx + 4];
  const lw = whiteNoteMidis.slice(pianoState.baseIdx, pianoState.baseIdx + 4);
  const rw = whiteNoteMidis.slice(
    pianoState.baseIdx + 5,
    pianoState.baseIdx + 9
  );
  const lb = Object.values(pianoState.keyMap).filter(
    (m) => m > lw[0] && m < lw[3] && NOTES_BY_MIDI[m]?.isBlack
  );
  const rb = Object.values(pianoState.keyMap).filter(
    (m) => m > rw[0] && m < rw[3] && NOTES_BY_MIDI[m]?.isBlack
  );

  const addClass = (cls) => (m) => pianoState.noteEls[m]?.classList.add(cls);
  lw.forEach(addClass("left-white"));
  rw.forEach(addClass("right-white"));
  lb.forEach(addClass("left-black"));
  rb.forEach(addClass("right-black"));
  pianoState.noteEls[centerMidi]?.classList.add("middle");
  pianoState.hi = [...lw, ...rw, ...lb, ...rb, centerMidi];
}

/** Clears chord mode highlights from piano keys. */
function clearChordHi() {
  pianoState.chordHi.forEach((m) =>
    pianoState.noteEls[m]?.classList.remove(
      "chord-root",
      "chord-third",
      "chord-fifth"
    )
  );
  pianoState.chordHi = [];
}

/** Paints highlights on keys for the current chord mode. */
export function paintChord() {
  clearHi();
  const quality = pianoState.isMajorChordMode ? "major" : "minor";
  const chord = getChord(pianoState.chordCenterNote, quality);
  if (!chord) return;

  const midis = chord.notes.map((n) => NOTES_BY_NAME[n]).filter(Boolean);
  if (midis[0] !== undefined)
    pianoState.noteEls[midis[0]]?.classList.add("chord-root");
  if (midis[1] !== undefined)
    pianoState.noteEls[midis[1]]?.classList.add("chord-third");
  if (midis[2] !== undefined)
    pianoState.noteEls[midis[2]]?.classList.add("chord-fifth");
  pianoState.chordHi = midis;
}

/** Temporarily paints a chord on the keys for immediate feedback. */
export function paintChordOnTheFly(chord) {
  clearHi();
  clearChordHi();
  const midis = chord.notes.map((n) => NOTES_BY_NAME[n]).filter(Boolean);
  if (midis[0] !== undefined)
    pianoState.noteEls[midis[0]]?.classList.add("chord-root");
  if (midis[1] !== undefined)
    pianoState.noteEls[midis[1]]?.classList.add("chord-third");
  if (midis[2] !== undefined)
    pianoState.noteEls[midis[2]]?.classList.add("chord-fifth");
  pianoState.chordHi = midis;
}

// ===================================================================
// Event Handlers (Enhanced with Click-and-Drag)
// ===================================================================

/** Handles window resize event. */
function handleWindowResize() {
  positionSlider();
}

/** Handles changes between single note and chord modes. */
function handleChordModeChange() {
  clearHi();
  clearChordHi();
  const isChordMode =
    pianoState.isMajorChordMode || pianoState.isMinorChordMode;
  pianoState.overlay.classList.toggle("chord-mode", isChordMode);

  if (isChordMode) {
    const tonicMidi = NOTES_BY_NAME[pianoState.scaleTonic];
    if (tonicMidi !== undefined) {
      const thirdInterval = pianoState.isMajorChordMode ? 4 : 3;
      const centerMidi = tonicMidi + thirdInterval;
      if (NOTES_BY_MIDI[centerMidi]) {
        pianoState.chordCenterNote = NOTES_BY_MIDI[centerMidi].name;
      }
    }
    paintChord();
  } else {
    pianoState.keyMap = buildMap(pianoState.baseIdx);
    paint();
  }
  positionSlider();
  updateLabels();
}

/**
 * Determines which piano key is at a given mouse X-coordinate for SLIDER control.
 * Uses coordinate mapping and allows imprecise movements outside the keyboard area.
 * @param {number} mouseX - The mouse's X position relative to the SVG element.
 * @param {number} scale - The scaling factor of the SVG.
 * @returns {object|null} The note object for the found key.
 */
function findKeyForSlider(mouseX, scale) {
  const clampedMouseX = Math.max(0, Math.min(TOTAL_SVG_WIDTH, mouseX / scale));
  const searchKeys = allNotes.slice().sort((a, b) => b.isBlack - a.isBlack);

  for (const keyData of searchKeys) {
    const keyWidth = keyData.isBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH;
    if (clampedMouseX >= keyData.x && clampedMouseX <= keyData.x + keyWidth) {
      return keyData;
    }
  }
  return null;
}

/**
 * Determines which piano key is at a given pointer position for PLAYING NOTES.
 * Uses precise DOM hit detection that respects SVG layering.
 * @param {number} clientX - The pointer's X position relative to the viewport.
 * @param {number} clientY - The pointer's Y position relative to the viewport.
 * @returns {object|null} The note object for the found key.
 */
function findKeyForPlayer(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);

  if (element && element.classList.contains('key')) {
    const midi = parseInt(element.dataset.midi, 10);
    return NOTES_BY_MIDI[midi] || null;
  }

  return null;
}

/** * Handles pointer move for click-and-drag functionality
 */
function handlePointerMove(e) {
  // Only process if audio is ready AND isDragging is true
  if (!audioManager.isAudioReady() || !pianoState.isDragging) return; 

  e.preventDefault(); // Prevent default browser drag behavior
  const foundKey = findKeyForPlayer(e.clientX, e.clientY);

  const isChordMode = pianoState.isMajorChordMode || pianoState.isMinorChordMode;

  if (isChordMode) {
    // Chord mode - drag functionality is not implemented, just return
    return;

  } else {
    const currentlyTouchedKeys = new Set();

    if (foundKey) {
      currentlyTouchedKeys.add(foundKey.midi);
    }

    currentlyTouchedKeys.forEach(midi => {
      if (!pianoState.currentlyPlayingKeys.has(midi)) {
        const keyEl = pianoState.noteEls[midi];
        if (keyEl) {
          keyEl.classList.add("pressed", "drag-playing");
          keyEl.dataset.playing = "drag";

          const noteInfo = notesByMidiKeyAware(midi);
          if (noteInfo) {
            trigger([noteInfo.name], true);
          }
        }
      }
    });

    pianoState.currentlyPlayingKeys.forEach(midi => {
      if (!currentlyTouchedKeys.has(midi)) {
        const keyEl = pianoState.noteEls[midi];
        if (keyEl) {
          keyEl.classList.remove("pressed", "drag-playing");
          const noteInfo = notesByMidiKeyAware(midi);
          if (noteInfo && keyEl.dataset.playing === "drag") {
            trigger([noteInfo.name], false);
          }
          keyEl.dataset.playing = "";
        }
      }
    });

    pianoState.currentlyPlayingKeys = currentlyTouchedKeys;
  }
}

/** Handles the start of a drag event on the hand overlay (slider). */
function startSliderDrag(e) {
  // Only activate slider drag if audio is ready
  if (!audioManager.isAudioReady()) {
    console.warn("Audio not ready to start slider drag.");
    return;
  }

  pianoState.overlay.setPointerCapture(e.pointerId);
  let rafId = null;
  const isChordMode =
    pianoState.isMajorChordMode || pianoState.isMinorChordMode;
  if (!isChordMode) paint();

  const handleSliderMove = (ev) => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const svgRect = pianoState.svg.getBoundingClientRect();
      const mouseX = ev.clientX - svgRect.left;
      const scale = svgRect.width / TOTAL_SVG_WIDTH;
      const foundKey = findKeyForSlider(mouseX, scale);
      if (!foundKey) {
        rafId = null;
        return;
      }

      if (isChordMode) {
        const quality = pianoState.isMajorChordMode ? "major" : "minor";
        const nearestValidNoteName = findNearestValidCenterNote(
          foundKey.midi,
          quality
        );
        if (
          nearestValidNoteName &&
          nearestValidNoteName !== pianoState.chordCenterNote
        ) {
          const prospectiveChord = getChord(nearestValidNoteName, quality);
          if (prospectiveChord) {
            pianoState.chordCenterNote = nearestValidNoteName;
            pianoState.scaleTonic = prospectiveChord.rootNoteName;
            positionSlider();
            clearChordHi();
            paintChord();
            updateLabels();
          }
        }
      } else {
        let anchorMidi = foundKey.isBlack ? foundKey.midi - 1 : foundKey.midi;
        const anchorIndex = whiteNoteMidis.indexOf(anchorMidi);
        const newBaseIdx = Math.max(
          0,
          Math.min(
            whiteNoteMidis.length - WHITE_KEYS_IN_VIEW.length,
            anchorIndex - 4
          )
        );
        if (newBaseIdx !== pianoState.baseIdx) {
          pianoState.baseIdx = newBaseIdx;
          positionSlider();
          pianoState.keyMap = buildMap(newBaseIdx);
          paint();
          updateLabels();
        }
      }
      rafId = null;
    });
  };

  const endSliderDrag = () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (isChordMode) updateLabels();
    clearHi();
    pianoState.overlay.releasePointerCapture(e.pointerId);
    document.removeEventListener("pointermove", handleSliderMove);
  };

  document.addEventListener("pointermove", handleSliderMove);
  document.addEventListener("pointerup", endSliderDrag, { once: true });
}

/**
 * NEW: Stop all drag-playing notes
 */
function stopAllDragNotes() {
  pianoState.currentlyPlayingKeys.forEach((midi) => {
    const keyEl = pianoState.noteEls[midi];
    if (keyEl) {
      keyEl.classList.remove("pressed", "drag-playing");
      const noteInfo = notesByMidiKeyAware(midi);
      if (noteInfo && keyEl.dataset.playing === "drag") {
        trigger([noteInfo.name], false);
      }
      keyEl.dataset.playing = "";
    }
  });
  pianoState.currentlyPlayingKeys.clear();
}

/**
 * NEW: Stop all drag-playing chords
 */
function stopAllDragChords() {
  pianoState.currentlyPlayingKeys.forEach((midi) => {
    const keyEl = pianoState.noteEls[midi];
    if (keyEl) {
      keyEl.classList.remove("pressed", "drag-playing");
      keyEl.dataset.playing = "";
    }
  });
  pianoState.currentlyPlayingKeys.clear();
  clearChordHi();
}

/**
 * Handles pointerdown events on SVG piano keys.
 * This function no longer defers the action itself, but assumes audio is ready.
 * It will return early if audio is not ready.
 */
function handleKeyPointerDown(e) {
  // Crucial: Only proceed if audio is already ready.
  // The initial unlock is now handled by the .instrument-panel__keyboard click listener.
  if (!audioManager.isAudioReady()) {
    console.warn("Audio not ready for direct key interaction.");
    return;
  }

  e.preventDefault(); // Prevent default browser behavior like text selection/scrolling
  const keyEl = e.target.closest(".key");
  if (!keyEl) return;

  // Initialize drag state (now that audio is confirmed ready)
  pianoState.isDragging = true;
  pianoState.lastDraggedKey = null;

  let targetMidi = parseInt(keyEl.dataset.midi, 10);
  if (e.shiftKey) {
    const potentialSharpMidi = targetMidi + 1;
    const potentialSharpNote = notesByMidiKeyAware(potentialSharpMidi);
    if (potentialSharpNote?.isBlack) {
      targetMidi = potentialSharpMidi;
    }
  }
  const finalKeyEl = pianoState.noteEls[targetMidi];
  if (!finalKeyEl) return;

  const isChordMode = pianoState.isMajorChordMode || pianoState.isMinorChordMode;

  if (isChordMode) {
    const quality = pianoState.isMajorChordMode ? "major" : "minor";
    const noteInfo = notesByMidiKeyAware(finalKeyEl.dataset.midi);
    const noteName = noteInfo?.name;
    if (!noteName) return;
    const thirdInterval = quality === "major" ? 4 : 3;
    const newCenterMidi = NOTES_BY_NAME[noteName] + thirdInterval;
    const newCenterNote = notesByMidiKeyAware(newCenterMidi);
    if (!newCenterNote) return;
    const chord = getChord(newCenterNote.name, quality);
    if (!chord) return;
    pianoState.chordCenterNote = newCenterNote.name;
    pianoState.scaleTonic = chord.rootNoteName;
    positionSlider();
    clearChordHi();
    paintChord();
    updateLabels();
    const startTime = performance.now();
    pianoState.activeNotes[finalKeyEl.dataset.midi] = {
      el: finalKeyEl,
      startTime: startTime,
      chordData: chord,
    };
    trigger(chord.notes, true);
    finalKeyEl.classList.add("pressed");
    finalKeyEl.setPointerCapture(e.pointerId);

    const handleKeyPointerUp = () => {
      pianoState.isDragging = false;
      stopAllDragChords();

      const heldTime = performance.now() - startTime;
      let duration = "q";
      if (heldTime >= DURATION_THRESHOLDS.w) duration = "w";
      else if (heldTime >= DURATION_THRESHOLDS.h) duration = "h";
      trigger(chord.notes, false);
      finalKeyEl.classList.remove("pressed");
      if (finalKeyEl.hasPointerCapture(e.pointerId)) { // Check if still has capture
        finalKeyEl.releasePointerCapture(e.pointerId);
      }
      delete pianoState.activeNotes[finalKeyEl.dataset.midi];
      writeNote({
        clef: chord.clef,
        duration,
        notes: chord.notes,
        chordName: chord.name,
      });
    };
    finalKeyEl.addEventListener("pointerup", handleKeyPointerUp, {
      once: true,
    });
    finalKeyEl.addEventListener("pointercancel", handleKeyPointerUp, {
      once: true,
    });
  } else {
    // Single note mode
    startKey(finalKeyEl);
    finalKeyEl.setPointerCapture(e.pointerId);
    const startTime = performance.now();

    const handleKeyPointerUp = () => {
      pianoState.isDragging = false;
      stopAllDragNotes();

      stopKey(finalKeyEl);
      if (finalKeyEl.hasPointerCapture(e.pointerId)) { // Check if still has capture
        finalKeyEl.releasePointerCapture(e.pointerId);
      }
      const heldTime = performance.now() - startTime;
      let duration = "q";
      if (heldTime >= DURATION_THRESHOLDS.w) duration = "w";
      else if (heldTime >= DURATION_THRESHOLDS.h) duration = "h";
      const noteInfo = notesByMidiKeyAware(targetMidi);
      const noteNameForScore = noteInfo.name;
      const clef = noteInfo.midi < 60 ? "bass" : "treble";
      writeNote({
        clef,
        duration,
        notes: [noteNameForScore],
        chordName: noteNameForScore,
      });
    };
    finalKeyEl.addEventListener("pointerup", handleKeyPointerUp, {
      once: true,
      });
         finalKeyEl.addEventListener("pointercancel", handleKeyPointerUp, {
           once: true,
         });
       }

       // Trigger initial move to handle the current position.
       // This assumes handlePointerMove will respect pianoState.isDragging set above.
       handlePointerMove(e);
      }

      /**
      * Handles keydown events. This function now assumes audio is ready.
      * It will return early if audio is not ready.
      */
      function handleKeyDown(e) {
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
         playDiatonicChord(parseInt(e.key, 10), k);
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

      function handleKeyUp(e) {
       // This function assumes audio is ready, like handleKeyDown.
       // No need for audioManager.isAudioReady() check here, as keydown would have handled it.
       clearChordHi();
       clearHi();

       const k = e.key.toLowerCase();
       if (!pianoState.held.has(k)) return;

       if (["1", "2", "3", "4", "5", "6", "7"].includes(e.key)) {
         stopDiatonicChord(k);
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

      // ===================================================================
      // Exported Functions
      // ===================================================================

      export function handleToggleLabelsChange(e) {
       pianoState.toggleLabels = e.target.checked;
       updateLabels();
       const buttonElement = e.target.parentElement;

       if (e.target.checked) {
         buttonElement.classList.add("is-active");
       } else {
         buttonElement.classList.remove("is-active");
       }
      }

      /** Handles cycling through the different playing modes. */
      export function handleModeCycleClick(e) {
       if (!pianoState.isMajorChordMode && !pianoState.isMinorChordMode) {
         pianoState.isMajorChordMode = true;
         e.target.textContent = "Major Chords";
       } else if (pianoState.isMajorChordMode) {
         pianoState.isMajorChordMode = false;
         pianoState.isMinorChordMode = true;
         e.target.textContent = "Minor Chords";
       } else {
         pianoState.isMinorChordMode = false;
         e.target.textContent = "Single Note";
       }
       handleChordModeChange();
      }


// Define all listener functions.
let instrumentDiv; // Module-level variable

function addBasicListeners() {
//instrumentDiv.addEventListener("touchstart", handleInitial, { 
  //once: true, 
  //passive: false 
//});
instrumentDiv.addEventListener("pointerdown", handleInitial, { 
  once: true, 
  passive: false 
});
instrumentDiv.addEventListener("click", handleInitial, { 
  once: true 
});
}

function addAdvancedListeners() {
      pianoState.svg.addEventListener("pointerdown", handleKeyPointerDown);
      pianoState.svg.addEventListener("pointermove", handlePointerMove);
      pianoState.svg.addEventListener("selectstart", (e) => e.preventDefault());
      pianoState.svg.addEventListener("contextmenu", (e) => e.preventDefault());
      pianoState.overlay.addEventListener("pointerdown", startSliderDrag);

      // Keydown/keyup listeners for computer keyboard
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("keyup", handleKeyUp);
      // Remove the initial one-time listeners
    instrumentDiv.removeEventListener("click", handleInitial);
    instrumentDiv.removeEventListener("pointerdown", handleInitial);
    instrumentDiv.removeEventListener("touchstart", handleInitial);
}

function addButtonListeners() {
 document
   .getElementById("toggleLabelsCheckbox")
   ?.addEventListener("change", handleToggleLabelsChange);
 document
   .getElementById("mode-cycle-btn")
   ?.addEventListener("click", handleModeCycleClick);
 window.addEventListener("resize", handleWindowResize);

 console.log("Piano instrument UI initialized.");
}

function addDraggingListeners() {
   // Global pointer up to ensure drag state is cleared
      document.addEventListener("pointerup", () => {
        if (pianoState.isDragging) {
          pianoState.isDragging = false;
          stopAllDragNotes();
          stopAllDragChords();
        }
      });
      // Handle pointer leaving the piano area
      pianoState.svg.addEventListener("pointerleave", () => {
        if (pianoState.isDragging) {
          stopAllDragNotes();
          stopAllDragChords();
        }
      });
}
// end of listener functions

// Initial click function
function handleInitial(e) {
  e.stopPropagation();
  e.preventDefault();
  const keyEl = e.target.closest(".key");
  if (!keyEl) {
     console.log("Click was not on a piano key, ignoring");
     return;
   }

   const midi = parseInt(keyEl.dataset.midi, 10); // midi value of pressed key.
   const noteInfo = notesByMidiKeyAware(midi); // gets the note name based on the note value and key signature.
   if (!noteInfo) {
     console.log("Could not find note info for MIDI", midi);
     return;
   }

   console.log("Initial click on key:", noteInfo.name);

   // Store the note details for the deferred action
   const clickedNoteDetails = {
     midi: midi,
     noteName: noteInfo.name,
     clef: noteInfo.midi < 60 ? "bass" : "treble"
   };

   // Define the deferred action: play the note and write to score
   const playNoteAndWriteToScore = () => {
     console.log("Audio is ready! Playing note and writing to score:", clickedNoteDetails.noteName);

     // Activate the more advanced listeners for future interactions
     addAdvancedListeners();
     addDraggingListeners();

   // Play the clicked note.
     triggerAttackRelease([clickedNoteDetails.noteName], "q");

     // Write note to score
       writeNote({
         clef: clickedNoteDetails.clef,
         duration: "q",
         notes: [clickedNoteDetails.noteName],
       });
   }

   // Call unlockAndExecute. It will run playNoteAndWriteToScore when audio is ready.
   audioManager.unlockAndExecute(playNoteAndWriteToScore);
   console.log("Calling unlock and execute with note play functionality");
  
}

/**
* Initializes the piano application. This is the main entry point.
* This function now attaches the primary audio unlock listener.
*/
export function initializeInstrumentUI() {
 instrumentDiv = document.getElementById("instrument");
 if (!instrumentDiv) {
   console.error("Element #instrument not found!");
   return;
 }

 // Clear existing piano elements if re-initializing (e.g., after cleanup)
 while (instrumentDiv.firstChild) {
     instrumentDiv.removeChild(instrumentDiv.firstChild);
 }
 pianoState.noteEls = {}; // Clear old references

 // Create SVG and key groups
 pianoState.svg = document.createElementNS(NS, "svg");
 pianoState.svg.setAttribute("viewBox", `0 0 ${TOTAL_SVG_WIDTH} 120`);
 pianoState.gw = document.createElementNS(NS, "g");
 pianoState.gb = document.createElementNS(NS, "g");
 pianoState.svg.append(pianoState.gw, pianoState.gb);

 // Create SVG key elements
 allNotes.forEach((note) => {
   const r = document.createElementNS(NS, "rect");
   r.dataset.midi = note.midi;
   r.setAttribute("x", note.x);
   r.setAttribute("y", 0);
   if (note.isBlack) {
     r.setAttribute("width", BLACK_KEY_WIDTH);
     r.setAttribute("height", 80);
     r.setAttribute("class", "black key");
     pianoState.gb.appendChild(r);
   } else {
     r.setAttribute("width", WHITE_KEY_WIDTH);
     r.setAttribute("height", 120);
     r.setAttribute("class", "white key");
     pianoState.gw.appendChild(r);
   }
   pianoState.noteEls[note.midi] = r;
 });

 // Create overlay element
 pianoState.overlay = document.createElement("div");
 pianoState.overlay.id = "handOverlay";
 instrumentDiv.append(pianoState.svg, pianoState.overlay);

 // Set initial state and UI
 pianoState.baseIdx = whiteNoteMidis.indexOf(NOTES_BY_NAME["F3"]);
 pianoState.keyMap = buildMap(pianoState.baseIdx);
 positionSlider();
 updateLabels();
 if (!audioManager.isAudioReady()) {
   addBasicListeners();
 } else {
   addAdvancedListeners();
 }
 addButtonListeners();
}
