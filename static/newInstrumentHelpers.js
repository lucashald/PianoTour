// ===================================================================
// Imports
// ===================================================================

import { pianoState } from "./appState.js";
import {
  trigger, // <-- Make sure this is imported
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

/**
 * Initializes the piano application. This is the main entry point.
 * This function now attaches the primary audio unlock listener.
 */
export function initializeInstrumentUI() {
  const instrumentDiv = document.getElementById("instrument");
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

  // ATTACH PRIMARY UNLOCK LISTENER HERE (using click on the main instrument container)
  // This listener calls unlockAndExecute, and its deferred action will play the note and write to score
  const handleInitialInstrumentClick = (e) => {
    e.preventDefault(); // Prevent default browser action for this initial click
    console.log("Initial instrument click/tap detected. Attempting to unlock audio...");

    // Find the clicked key
    const keyEl = e.target.closest(".key");
    if (!keyEl) {
      console.log("Click was not on a piano key, ignoring");
      return;
    }

    const midi = parseInt(keyEl.dataset.midi, 10);
    const noteInfo = notesByMidiKeyAware(midi);
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

      // First, set up the full interaction listeners for future interactions
      pianoState.svg.addEventListener("pointerdown", handleKeyPointerDown);
      activateInstrumentListeners();

      // Now play the note that was clicked
      const isChordMode = pianoState.isMajorChordMode || pianoState.isMinorChordMode;

      // In the playNoteAndWriteToScore function within handleInitialInstrumentClick:

      if (isChordMode) {
        // Handle chord mode
        const quality = pianoState.isMajorChordMode ? "major" : "minor";
        const thirdInterval = quality === "major" ? 4 : 3;
        const newCenterMidi = NOTES_BY_NAME[clickedNoteDetails.noteName] + thirdInterval;
        const newCenterNote = notesByMidiKeyAware(newCenterMidi);
        if (newCenterNote) {
          const chord = getChord(newCenterNote.name, quality);
          if (chord) {
            pianoState.chordCenterNote = newCenterNote.name;
            pianoState.scaleTonic = chord.rootNoteName;
            positionSlider();
            clearChordHi();
            paintChord();
            updateLabels();

            // Play the chord with quarter note duration
            triggerAttackRelease(chord.notes, "q");

            // Write chord to score
            writeNote({
              clef: chord.clef,
              duration: "q",
              notes: chord.notes,
              chordName: chord.name,
            });
          }
        }
      } else {
        // Handle single note mode
        // Play the note with quarter note duration
        triggerAttackRelease([clickedNoteDetails.noteName], "q");

        // Write note to score
        writeNote({
          clef: clickedNoteDetails.clef,
          duration: "q",
          notes: [clickedNoteDetails.noteName],
          chordName: clickedNoteDetails.noteName,
        });
      }

        // Write note to score
        writeNote({
          clef: clickedNoteDetails.clef,
          duration: "q", // Default quarter note duration for clicks
          notes: [clickedNoteDetails.noteName],
          chordName: clickedNoteDetails.noteName,
        });
      }
    };

    // Call unlockAndExecute. It will run playNoteAndWriteToScore when audio is ready.
    audioManager.unlockAndExecute(playNoteAndWriteToScore);
    console.log("Calling unlock and execute with note play functionality");

    // Remove these initial one-time listeners
    instrumentDiv.removeEventListener("click", handleInitialInstrumentClick);
    instrumentDiv.removeEventListener("touchstart", handleInitialInstrumentClick);
  };

  // Attach the one-time click/touchstart listeners to the main instrument container
  instrumentDiv.addEventListener("click", handleInitialInstrumentClick, { once: true });
  instrumentDiv.addEventListener("touchstart", handleInitialInstrumentClick, { once: true, passive: false });

  // Other UI listeners that were already conditional
  document
    .getElementById("toggleLabelsCheckbox")
    ?.addEventListener("change", handleToggleLabelsChange);
  document
    .getElementById("mode-cycle-btn")
    ?.addEventListener("click", handleModeCycleClick);
  window.addEventListener("resize", handleWindowResize);

  console.log("Piano instrument UI initialized.");
}