// scoreHighlighter.js

// ===================================================================
// INDIVIDUAL NOTE HIGHLIGHTING
// ===================================================================

import { pianoState } from "../core/appState.js";
import {
  getMeasureXPositions,
  getVexFlowNoteMap,
  getVexflowIndexByNoteId,
} from "./scoreRenderer.js";
import { getMeasures } from "./scoreWriter.js";

export function highlightSelectedNote(measureIndex, clef, noteId) {
  clearSelectedNoteHighlight();

  // NEW: Check if this note is in the currentPlaybackNotes Set
  const noteKey = `${measureIndex}-${clef}-${noteId}`;
  if (pianoState.currentPlaybackNotes.has(noteKey)) {
    console.log(
      "highlightSelectedNote: Clearing conflicting playback highlight for target note."
    );
    clearPlaybackHighlight();
  }

  pianoState.currentSelectedNote = { measureIndex, clef, noteId };

  const vexflowIndex = getVexflowIndexByNoteId()[noteId];
  if (vexflowIndex === undefined) {
    console.warn(
      `highlightSelectedNote: Cannot highlight note: VexFlow index not found for noteId ${noteId}.`
    );
    return;
  }

  const selectionStyle = {
    fillStyle: "#D88368", // Peach
    strokeStyle: "#D88368",
  };

  setVexFlowNoteStyle(measureIndex, clef, vexflowIndex, selectionStyle);
}

/**
* Clears the currently selected individual note highlight.
* It restores the note's style to black by default, or to the measure highlight color (green) if its containing measure is also selected.
*/
export function clearSelectedNoteHighlight() {
 if (!pianoState.currentSelectedNote) {
    // No currently selected note to clear.
   return;
 }

 const { measureIndex, clef, noteId } = pianoState.currentSelectedNote;

 // Convert to VexFlow index to target the specific VexFlow note object.
 const vexflowIndex = getVexflowIndexByNoteId()[noteId];
 if (vexflowIndex !== undefined) {
   let styleToRestore;

   // Determine the appropriate style to restore based on current highlighting state:
   if (measureIndex === pianoState.currentSelectedMeasure) {
     // If the note's measure is still selected, restore the note to the measure highlight color (green).
     styleToRestore = {
       fillStyle: "#76B595", // Green (measure highlight color)
       strokeStyle: "#76B595",
     };
   } else {
     // Otherwise, restore the note to its default black color.
     styleToRestore = {
       fillStyle: "#000000", // Black (default note color)
       strokeStyle: "#000000",
     };
   }

   // Apply the determined style to the VexFlow note.
   setVexFlowNoteStyle(measureIndex, clef, vexflowIndex, styleToRestore);
 }
}

export function highlightSelectedMeasure(measureIndex) {
  const vexflowNoteMap = getVexFlowNoteMap();
  if (measureIndex < 0 || measureIndex >= vexflowNoteMap.length) {
    console.warn(
      `highlightSelectedMeasure: Invalid measure index: ${measureIndex}.`
    );
    return;
  }

  clearMeasureHighlight();

  pianoState.currentSelectedMeasure = measureIndex;

  addMeasureHighlightOverlay(measureIndex);

  const measureNotes = getMeasures()[measureIndex] || [];
  measureNotes.forEach((noteData) => {
    const vexflowIndex = getVexflowIndexByNoteId()[noteData.id];
    if (vexflowIndex === undefined) {
      console.warn(
        `highlightSelectedMeasure: VexFlow index not found for note ID ${noteData.id}. Skipping note highlight in measure.`
      );
      return;
    }

    const measureStyle = {
      fillStyle: "#76B595",
      strokeStyle: "#76B595",
    };

    setVexFlowNoteStyle(
      measureIndex,
      noteData.clef,
      vexflowIndex,
      measureStyle
    );
  });

  if (
    pianoState.currentSelectedNote &&
    pianoState.currentSelectedNote.measureIndex === measureIndex
  ) {
    highlightSelectedNote(
      pianoState.currentSelectedNote.measureIndex,
      pianoState.currentSelectedNote.clef,
      pianoState.currentSelectedNote.noteId
    );
  }
}

export function clearMeasureHighlight() {
  if (pianoState.currentSelectedMeasure === -1) {
    // No measure currently selected to clear.
    return;
  }

  const existingOverlay = document.querySelector('[id^="measure-highlight-"]');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const previouslySelectedMeasureNotes =
    getMeasures()[pianoState.currentSelectedMeasure] || [];
  previouslySelectedMeasureNotes.forEach((noteData) => {
    const vexflowIndex = getVexflowIndexByNoteId()[noteData.id];
    if (vexflowIndex !== undefined) {
      const defaultStyle = {
        fillStyle: "#000000",
        strokeStyle: "#000000",
      };
      setVexFlowNoteStyle(
        pianoState.currentSelectedMeasure,
        noteData.clef,
        vexflowIndex,
        defaultStyle
      );
    }
  });

  if (
    pianoState.currentSelectedNote &&
    pianoState.currentSelectedNote.measureIndex ===
      pianoState.currentSelectedMeasure
  ) {
    highlightSelectedNote(
      pianoState.currentSelectedNote.measureIndex,
      pianoState.currentSelectedNote.clef,
      pianoState.currentSelectedNote.noteId
    );
  }

  pianoState.currentSelectedMeasure = -1;
}

/**
 * Adds a transparent DOM overlay to create a background highlight for the specified measure.
 * This overlay is positioned absolutely behind the VexFlow canvas elements.
 * @param {number} measureIndex - The index of the measure to add the overlay to.
 */
function addMeasureHighlightOverlay(measureIndex) {
  const scoreElement = document.getElementById("score");
  if (!scoreElement) {
    console.warn("addMeasureHighlightOverlay: Score element not found.");
    return;
  }

  const overlayId = `measure-highlight-${measureIndex}`;
  // Always remove any existing overlay with this ID before adding a new one,
  // to prevent duplicates or stale overlays if highlightSelectedMeasure is called multiple times.
  const existingOverlay = document.getElementById(overlayId);
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const measureXPositions = getMeasureXPositions();
  const overlay = document.createElement("div");
  overlay.id = overlayId;
  overlay.style.cssText = `
position: absolute;
left: ${measureXPositions[measureIndex]}px;
top: 20px; /* Adjust based on your score's vertical positioning */
width: 340px; /* Must match the assumed fixed width of a single measure */
height: 260px; /* Height to cover both staves */
background-color: rgba(0, 0, 0, 0.08); /* Light grey semi-transparent background */
border: 1px solid rgba(0, 0, 0, 0.2); /* Subtle border */
pointer-events: none; /* CRUCIAL: Allows mouse events to pass through this overlay to the notes/staves below */
border-radius: 4px; /* Slightly rounded corners */
box-sizing: border-box; /* Include padding and border in the element's total width and height */
`;
  // Ensure the parent score element is positioned relatively for its absolute children (like this overlay) to render correctly.
  scoreElement.style.position = "relative";
  scoreElement.appendChild(overlay);
}

// ===================================================================
// Playback Highlighting
// ===================================================================

/**
* Applies a playback highlight to a single note. This highlight is typically temporary,
* indicating the note currently being played. It takes visual precedence over measure highlight,
* but can be overridden by individual note selection.
* @param {number} measureIndex - The index of the measure the note is in.
* @param {string} clef - The clef of the note ('treble' or 'bass').
* @param {string} noteId - The unique ID of the note.
* @param {string} color - The color for the playback highlight (e.g., '#FFD700' for gold).
*/
export function addPlaybackHighlight(measureIndex, clef, noteId, color) {

 // NEW: Add to the playback notes Set (don't clear existing ones)
 const noteKey = `${measureIndex}-${clef}-${noteId}`;
 pianoState.currentPlaybackNotes.add(noteKey);

 // Convert to VexFlow index to target the specific VexFlow note object.
 const vexflowIndex = getVexflowIndexByNoteId()[noteId];
 if (vexflowIndex === undefined) {
   console.warn(
     `addPlaybackHighlight: Cannot add playback highlight: VexFlow index not found for measure ${measureIndex}, clef ${clef}, noteId ${noteId}.`
   );
   return;
 }

 const playbackStyle = {
   fillStyle: color,
   strokeStyle: color,
 };

 setVexFlowNoteStyle(measureIndex, clef, vexflowIndex, playbackStyle);

 // IMPORTANT: If the playback note is *also* the currently selected individual note,
 // we need to re-apply the orange selection highlight immediately after.
 // This ensures that the orange selection color visually overrides the playback color.
 if (
   pianoState.currentSelectedNote &&
   pianoState.currentSelectedNote.measureIndex === measureIndex &&
   pianoState.currentSelectedNote.clef === clef &&
   pianoState.currentSelectedNote.noteId === noteId
 ) {
   highlightSelectedNote(measureIndex, clef, noteId);
 }
}

/**
 * Removes the playback highlight from the currently played note.
 * It restores the note's style based on existing highlights: to orange if selected, green if its measure is selected, or black by default.
 */
export function clearPlaybackHighlight() {

  // NEW: Clear all notes from the Set
  for (const noteKey of pianoState.currentPlaybackNotes) {
    const [measureIndex, clef, noteId] = noteKey.split('-');
    const measureIdx = parseInt(measureIndex);

    const vexflowIndex = getVexflowIndexByNoteId()[noteId];
    if (vexflowIndex !== undefined) {
      let styleToRestore;

      // Determine the correct style to restore based on the highlighting precedence:
      // 1. Is it the currently selected individual note? (Orange takes highest precedence)
      if (
        pianoState.currentSelectedNote &&
        pianoState.currentSelectedNote.measureIndex === measureIdx &&
        pianoState.currentSelectedNote.clef === clef &&
        pianoState.currentSelectedNote.noteId === noteId
      ) {
        styleToRestore = {
          fillStyle: "#295570", // Orange (selected note color)
          strokeStyle: "#295570",
        };
      }
      // 2. Is its containing measure currently selected? (Green takes next precedence)
      else if (measureIdx === pianoState.currentSelectedMeasure) {
        styleToRestore = {
          fillStyle: "#76B595", // Green (measure highlight color)
          strokeStyle: "#76B595",
        };
      }
      // 3. Otherwise, restore to default black (lowest precedence).
      else {
        styleToRestore = {
          fillStyle: "#000000", // Black (default note color)
          strokeStyle: "#000000",
        };
      }

      setVexFlowNoteStyle(measureIdx, clef, vexflowIndex, styleToRestore);
    }
  }

  // Clear the Set
  pianoState.currentPlaybackNotes.clear();
}

// ===================================================================
// PLAY-ALONG HIGHLIGHTING
// ===================================================================

const EXPECTED_NOTE_COLOR = '#4A90D9';  // Blue — "play this next"
const CORRECT_NOTE_COLOR = '#76B595';   // Green — correct match

// Track play-along highlighted notes for cleanup
const playAlongHighlightedNotes = new Set();

/**
 * Highlights a note on the score as "expected" (blue) during play-along mode.
 * @param {number} measureIndex
 * @param {string} clef
 * @param {string} noteId
 */
export function addExpectedHighlight(measureIndex, clef, noteId) {
  const vexflowIndex = getVexflowIndexByNoteId()[noteId];
  if (vexflowIndex === undefined) return;

  const style = {
    fillStyle: EXPECTED_NOTE_COLOR,
    strokeStyle: EXPECTED_NOTE_COLOR,
  };

  setVexFlowNoteStyle(measureIndex, clef, vexflowIndex, style);
  playAlongHighlightedNotes.add(`${measureIndex}-${clef}-${noteId}`);
}

/**
 * Highlights a note on the score as "correct" (green) during play-along mode.
 * @param {number} measureIndex
 * @param {string} clef
 * @param {string} noteId
 */
export function addCorrectHighlight(measureIndex, clef, noteId) {
  const vexflowIndex = getVexflowIndexByNoteId()[noteId];
  if (vexflowIndex === undefined) return;

  const style = {
    fillStyle: CORRECT_NOTE_COLOR,
    strokeStyle: CORRECT_NOTE_COLOR,
  };

  setVexFlowNoteStyle(measureIndex, clef, vexflowIndex, style);
  playAlongHighlightedNotes.add(`${measureIndex}-${clef}-${noteId}`);
}

// ===================================================================
// GENERAL UTILITY
// ===================================================================

/**
 * Fully resets all highlights and selections to their default state.
 * This function is called when the score is reset or needs a clean slate.
 */
export function resetAllNoteStyles() {

  const defaultStyle = {
    fillStyle: "#000000",
    strokeStyle: "#000000",
  };

  // Iterate every note in the VexFlow note map and reset to default black.
  // This is intentionally brute-force to avoid tracking bugs.
  const vexflowNoteMap = getVexFlowNoteMap();
  for (let m = 0; m < vexflowNoteMap.length; m++) {
    const measure = vexflowNoteMap[m];
    if (!measure) continue;
    for (const clef of ["treble", "bass"]) {
      const notes = measure[clef];
      if (!notes) continue;
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        if (!note) continue;
        try {
          note.setStyle(defaultStyle);
          note.drawWithStyle();
        } catch (e) {
          // Silently skip notes that can't be redrawn
        }
      }
    }
  }

  // Remove any measure highlight overlay from the DOM
  const existingOverlay = document.querySelector('[id^="measure-highlight-"]');
  if (existingOverlay) existingOverlay.remove();

  // Clear all tracking sets and state
  playAlongHighlightedNotes.clear();
  pianoState.currentPlaybackNotes.clear();
  pianoState.currentSelectedNote = null;
  pianoState.currentSelectedMeasure = -1;
  pianoState.currentPlaybackNote = null;

  console.log(
    "all note styles and highlights reset successfully."
  );
}

/**
 * Resets a single note to black and clears it from play-along highlight tracking.
 * Scans measures to find the note by ID, then resets its style and removes from tracking sets.
 * @param {string} noteId - The unique ID of the note to reset.
 */
export function resetNoteStyle(noteId) {
  const measures = getMeasures();
  let found = false;

  // Scan measures to find the note by ID and get its position
  for (let measureIndex = 0; measureIndex < measures.length; measureIndex++) {
    const measure = measures[measureIndex];
    if (!measure) continue;

    for (const noteData of measure) {
      if (noteData.id === noteId) {
        const clef = noteData.clef;
        const vexflowIndex = getVexflowIndexByNoteId()[noteId];

        if (vexflowIndex !== undefined) {
          const defaultStyle = {
            fillStyle: "#000000",
            strokeStyle: "#000000",
          };
          setVexFlowNoteStyle(measureIndex, clef, vexflowIndex, defaultStyle);
          found = true;
        }

        // Remove from play-along tracking sets
        const noteKey = `${measureIndex}-${clef}-${noteId}`;
        playAlongHighlightedNotes.delete(noteKey);
        pianoState.currentPlaybackNotes.delete(noteKey);

        break;
      }
    }
    if (found) break;
  }

  if (!found) {
    console.warn(`resetNoteStyle: Note with ID ${noteId} not found in measures.`);
  }
}

/**
 * Consolidated function for applying styles to a VexFlow note non-destructively.
 * This function interacts directly with the VexFlow note object and its rendering context.
 * @param {number} measureIndex
 * @param {string} clef
 * @param {number} vexflowNoteIndex - The VexFlow-internal index of the note.
 * @param {object} style - The VexFlow style object { fillStyle, strokeStyle }.
 */
export function setVexFlowNoteStyle(measureIndex, clef, vexflowIndex, style) {
  const vexflowNoteMap = getVexFlowNoteMap();
  const note = vexflowNoteMap[measureIndex]?.[clef]?.[vexflowIndex];
  if (!note) {
    console.warn(
      `Note not found at ${measureIndex}-${clef}-${vexflowIndex}. Cannot set style.`
    );
    return;
  }

  try {
    note.setStyle(style);
    note.drawWithStyle();
  } catch (e) {
    console.error("Error applying note style:", e);
  }
}
