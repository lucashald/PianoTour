// scoreRenderer.js
// This module handles rendering the musical score using VexFlow.
// Simplified: Direct styling for selected note/measure/playback, no stored original styles.
//     new StaveNote({ keys: ['g/3'], duration: '8' }).addModifier(
//      new Annotation('Chord Name').setVerticalJustification(Annotation.VerticalJustify.BOTTOM)
import { pianoState } from "../core/appState.js"; // ADD THIS LINE
import {
  ALL_NOTE_INFO,
  getCurrentVexFlowKeySignature,
  getNoteImagePath,
  KEY_SIGNATURES,
  NOTE_IMAGE_MAP,
  NOTE_STEM_DIRECTIONS,
  NOTES_BY_NAME,
  createIntervalChord,
  applyKeySignatureCorrection
} from "../core/note-data.js";
import { saveToLocalStorage } from "../utils/ioHelpers.js";
import { updateUI } from "../ui/uiHelpers.js";
import {
  addPlaybackHighlight,
  clearMeasureHighlight,
  highlightSelectedMeasure,
  highlightSelectedNote
} from "./scoreHighlighter.js";
import { addNoteToMeasure, getMeasures } from "./scoreWriter.js"; // Updated import
Object.values(NOTE_IMAGE_MAP).forEach(imagePath => {
  const img = new Image();
  img.src = imagePath;
});
// ===================================================================
// Global Variables
// ===================================================================

// --- VexFlow Objects & Score Layout ---
let vexflowNoteMap = [];
let measureXPositions = [];
let vexflowStaveMap = [];
let vfContext = null;
let vexFlowFactory = null;
let vexflowIndexByNoteId = {};

// --- Drag and Drop State ---
let draggedNote = null; // { measureIndex, clef, noteId, originalNoteData, vexflowIndex }
let chordAnchorPosition = 'bottom'; // 'top' or 'bottom' - which part of chord was grabbed
let dragStartPosition = null; // { x, y } in client coordinates. Used to track initial mouse down.
let isDragging = false; // True if a drag operation has officially begun (moved past threshold)
let originalNoteData = null; // Store the original note's data from `getMeasures()` for drag operation
let originalVexFlowNoteBBox = null; // Store the bounding box of the VexFlow note at drag start

// NEW: Palette Drag State
let isPaletteDrag = false;
let paletteDragType = null;

// Event Listener Internal State for Drag/Click Detection (used within enableScoreInteraction)
let mouseDownInitialPos = null; // Stores {x, y} of the initial mousedown for drag/click differentiation
let mouseDownNoteTarget = null; // Stores noteInfo if mousedown occurred on a note
let hasMouseMovedSinceMousedown = false; // Tracks if mouse has moved beyond threshold since mousedown

// Dynamic Y-calibration variables
const STAFF_LINE_SPACING = 10; // This remains a constant for the physical spacing of staff lines

// NEW:
let TREBLE_CLEF_G4_Y = null; // Will be calibrated
let BASS_CLEF_F3_Y = null; // Will be calibrated
let STAFF_LINE_SPACING_ACTUAL = null; // Actual measured spacing
let TREBLE_STAFF_TOP_Y = null;
let TREBLE_STAFF_BOTTOM_Y = null;
let BASS_STAFF_TOP_Y = null;
let BASS_STAFF_BOTTOM_Y = null;

let vexflowBeams = []; // Store beams for each measure

// --- Tie State ---
let tieGroups = []; // Store tie information for drawing

// Drag threshold to differentiate between click and drag
const DRAG_THRESHOLD = 5; // pixels

// Staff position to note mappings
// Positions are numbered from top (0) to bottom, including ledger lines
const TREBLE_STAFF_POSITIONS = [
  { position: -3, note: "E6", type: "ledger" },
  { position: -2.5, note: "D6", type: "ledger-space" },
  { position: -2, note: "C6", type: "ledger" },
  { position: -1.5, note: "B5", type: "ledger-space" },
  { position: -1, note: "A5", type: "ledger" },
  { position: -0.5, note: "G5", type: "ledger-space" },
  { position: 0, note: "F5", type: "line" }, // Top line
  { position: 0.5, note: "E5", type: "space" },
  { position: 1, note: "D5", type: "line" },
  { position: 1.5, note: "C5", type: "space" },
  { position: 2, note: "B4", type: "line" }, // Middle Line
  { position: 2.5, note: "A4", type: "space" },
  { position: 3, note: "G4", type: "line" },
  { position: 3.5, note: "F4", type: "space" },
  { position: 4, note: "E4", type: "line" }, // Bottom line
  { position: 4.5, note: "D4", type: "space" },
  { position: 5, note: "C4", type: "ledger" },
  { position: 5.5, note: "B3", type: "ledger-space" },
  { position: 6, note: "A3", type: "ledger" },
];

const BASS_STAFF_POSITIONS = [
  { position: -3, note: "E4", type: "ledger" },
  { position: -2.5, note: "D4", type: "ledger-space" },
  { position: -2, note: "C4", type: "ledger" },
  { position: -0.5, note: "B3", type: "space" },
  { position: 0, note: "A3", type: "line" }, // Top line
  { position: 0.5, note: "G3", type: "space" },
  { position: 1, note: "F3", type: "line" },
  { position: 1.5, note: "E3", type: "space" },
  { position: 2, note: "D3", type: "line" },
  { position: 2.5, note: "C3", type: "space" },
  { position: 3, note: "B2", type: "line" }, //middle line
  { position: 3.5, note: "A2", type: "space" }, //
  { position: 4, note: "G2", type: "line" }, // Bottom line
  { position: 4.5, note: "F2", type: "space" },
  { position: 5, note: "E2", type: "ledger" },
  { position: 5.5, note: "D2", type: "ledger-space" },
  { position: 6, note: "C2", type: "ledger" },
];

function logNotePositions() {
  const testNotes = ["C4", "E5", "G4", "B4", "D5", "F5"];

  for (
    let measureIndex = 0;
    measureIndex < vexflowNoteMap.length;
    measureIndex++
  ) {
    const measure = getMeasures()[measureIndex];
    if (!measure) continue;

    measure.forEach((note, i) => {
      if (testNotes.includes(note.name) && !note.isRest) {
        const vexflowIndex = vexflowIndexByNoteId[note.id];
        const vexNote =
          vexflowNoteMap[measureIndex]?.[note.clef]?.[vexflowIndex];
        if (vexNote) {
          const bbox = vexNote.getBoundingBox();
          const centerY = bbox.y + bbox.h / 2;
        }
      }
    });
  }
}
function calibrateStaffPositions() {

  // Get first measure's staves
  const trebleStave = vexflowStaveMap[0]?.treble;
  const bassStave = vexflowStaveMap[0]?.bass;

  if (trebleStave) {
    TREBLE_STAFF_TOP_Y = trebleStave.getYForLine(0);
    TREBLE_STAFF_BOTTOM_Y = trebleStave.getYForLine(4);
    const staffHeight = TREBLE_STAFF_BOTTOM_Y - TREBLE_STAFF_TOP_Y;
    STAFF_LINE_SPACING_ACTUAL = staffHeight / 4;
  }

  if (bassStave) {
    BASS_STAFF_TOP_Y = bassStave.getYForLine(0);
    BASS_STAFF_BOTTOM_Y = bassStave.getYForLine(4);
  }

  // Log the vertical centering info
  const scoreContainer = document.getElementById("score")?.parentElement;
  const containerHeight = scoreContainer ? scoreContainer.clientHeight : 350;
  const verticalOffset = Math.max(20, (containerHeight - 300) / 2);
}
/**
 * Finds the nearest staff position (line or space) for a given Y coordinate
 * @param {number} y - Y coordinate
 * @param {string} clef - 'treble' or 'bass'
 * @returns {{position: number, note: string, y: number}} The nearest position info
 */
function findNearestStaffPosition(y, clef) {
  const stave = vexflowStaveMap[0]?.[clef];
  if (!stave) {
    console.warn("No stave found for clef:", clef);
    return null;
  }

  const positions =
    clef === "treble" ? TREBLE_STAFF_POSITIONS : BASS_STAFF_POSITIONS;
  let nearest = null;
  let minDistance = Infinity;

  // Check each possible position
  for (const pos of positions) {
    // Calculate the Y coordinate for this position
    const posY = stave.getYForLine(pos.position);
    const distance = Math.abs(y - posY);

    if (distance < minDistance) {
      minDistance = distance;
      nearest = {
        ...pos,
        y: posY,
      };
    }
  }

  return nearest;
}

function calibrateTrebleStaff(stave) {
  try {
    // In VexFlow, lines are numbered 0-4 from top to bottom
    // Treble clef: E5(0), C5(1), A4(2), F4(3), D4(4)
    // G4 sits between lines 2 and 3

    const topLineY = stave.getYForLine(0);
    const bottomLineY = stave.getYForLine(4);

    TREBLE_STAFF_TOP_Y = topLineY;
    TREBLE_STAFF_BOTTOM_Y = bottomLineY;

    // G4 is on the second line from bottom (line 3.5 in VexFlow terms)
    TREBLE_CLEF_G4_Y = stave.getYForLine(3);

    // Calculate actual line spacing
    const staffHeight = bottomLineY - topLineY;
    STAFF_LINE_SPACING_ACTUAL = staffHeight / 4; // 5 lines = 4 spaces
  } catch (error) {
    console.error("Error calibrating treble staff:", error);
  }
}

function calibrateBassStaff(stave) {
  try {
    // Bass clef: G3(0), E3(1), C3(2), A2(3), F2(4)
    // F3 is between lines 0 and 1

    const topLineY = stave.getYForLine(0);
    const bottomLineY = stave.getYForLine(4);

    BASS_STAFF_TOP_Y = topLineY;
    BASS_STAFF_BOTTOM_Y = bottomLineY;
    BASS_CLEF_F3_Y = stave.getYForLine(1);
  } catch (error) {
    console.error("Error calibrating bass staff:", error);
  }
}

function getStaffLineYPosition(noteName, clef) {
  const stave = vexflowStaveMap[0]?.[clef];
  if (!stave) return null;

  // Convert note name to line number
  const lineNumber = noteToLineNumber(noteName, clef);
  if (lineNumber === null) return null;

  return stave.getYForLine(lineNumber);
}

/**
 * Sets the key signature and updates all related UI elements.
 * @param {string} keySignature - The key signature (e.g., 'F', 'F Major', 'Dm', 'D minor')
 * @returns {boolean} True if successful, false if invalid key signature
 */
export function setKeySignature(keySignature) {
  if (!keySignature || typeof keySignature !== "string") {
    console.warn("setKeySignature: Invalid key signature provided");
    return false;
  }

  // Look up the key signature data
  const keyData = KEY_SIGNATURES[keySignature];
  if (!keyData) {
    console.warn(`setKeySignature: Unknown key signature "${keySignature}"`);
    return false;
  }

  // Check if the key signature is already set to this value (normalized comparison)
  const currentKeyData = KEY_SIGNATURES[pianoState.keySignature];
  if (currentKeyData && keyData.displayName === currentKeyData.displayName) {
    return true; // Already set, no need to redraw
  }

  // Update the piano state
  pianoState.keySignature = keyData.displayName;
  pianoState.keySignatureType = keyData.type;

  // Redraw the score with new key signature
  safeRedraw();
  saveToLocalStorage();

  // Update UI to reflect the key signature change
  updateUI(`Key signature: ${keyData.displayName}`, {
    updateKeySignature: true,
    regenerateChords: false, // Don't regenerate chords here; caller can do it if needed
  });

  return true;
}

export function drawAll(measures, noScroll = false) {
  
  const out = document.getElementById("score");
  if (!out) {
    console.error("drawAll: Score rendering element #score not found!");
    return;
  }

  out.innerHTML = "";
  vexflowNoteMap = [];
  measureXPositions = [];
  vexflowStaveMap = [];
  vexflowIndexByNoteId = {}; // Clear the ID mapping
  vexflowBeams = []; // Clear beams array
  tieGroups = []; // Clear ties array

  const measureWidth = 340;
  const measureCount = measures.length > 0 ? measures.length : 1;

  if (typeof Vex === "undefined" || !Vex.Flow) {
    console.error("drawAll: VexFlow library not loaded.");
    return;
  }

  try {
    // Calculate vertical centering
    const scoreContainer = out.parentElement; // Should be .score-viewer__container
    const containerHeight = scoreContainer ? scoreContainer.clientHeight : 350;
    const scoreHeight = 300; // Height of the VexFlow score
    const verticalOffset = Math.max(20, (containerHeight - scoreHeight) / 2);

    vexFlowFactory = new Vex.Flow.Factory({
      renderer: {
        elementId: "score",
        width: measureWidth * measureCount + 20,
        height: Math.max(scoreHeight, containerHeight), // Ensure renderer is tall enough
      },
    });
    vfContext = vexFlowFactory.getContext();
    const score = vexFlowFactory.EasyScore();
    let currentX = 20;

    // ADD THIS: Collect all voices for applyAccidentals
    const allVoices = [];

    for (let i = 0; i < measureCount; i++) {
      measureXPositions.push(currentX);
      const measure = measures[i] || [];
      const trebleNotesData = measure.filter((n) => n.clef === "treble");
      const bassNotesData = measure.filter((n) => n.clef === "bass");

      vexflowNoteMap[i] = { treble: [], bass: [] };

      const trebleSpec = trebleNotesData.length
        ? trebleNotesData
            .map((n) => `${n.name}/${n.duration}${n.isRest ? "/r" : ""}`)
            .join(", ")
        : "B4/1/r";
      const bassSpec = bassNotesData.length
        ? bassNotesData
            .map((n) => `${n.name}/${n.duration}${n.isRest ? "/r" : ""}`)
            .join(", ")
        : "D3/1/r";

      console.log(`beatcount: measure ${i} VexFlow specs`, {
        measureIndex: i,
        trebleSpec,
        bassSpec,
        trebleNotesCount: trebleNotesData.length,
        bassNotesCount: bassNotesData.length
      });

      const trebleVexNotes = score.notes(trebleSpec, { clef: "treble" });
      const bassVexNotes = score.notes(bassSpec, { clef: "bass" });
      vexflowNoteMap[i].treble = trebleVexNotes;
      vexflowNoteMap[i].bass = bassVexNotes;

      // NEW: Create beams for this measure if beaming is enabled
      if (pianoState.enableBeaming) {
        vexflowBeams[i] = {};
        if (trebleNotesData.length > 0) {
          vexflowBeams[i].treble = createBeamsForNotes(trebleVexNotes, trebleNotesData);
        }
        if (bassNotesData.length > 0) {
          vexflowBeams[i].bass = createBeamsForNotes(bassVexNotes, bassNotesData);
        }
      }

      // NEW: Process ties for this measure
      if (trebleNotesData.length > 0) {
        processTies(trebleNotesData);
      }
      if (bassNotesData.length > 0) {
        processTies(bassNotesData);
      }

      // Build ID to VexFlow index mapping
      trebleNotesData.forEach((noteData, vexflowIndex) => {
        if (noteData.id) {
          vexflowIndexByNoteId[noteData.id] = vexflowIndex;
        }
      });

      bassNotesData.forEach((noteData, vexflowIndex) => {
        if (noteData.id) {
          vexflowIndexByNoteId[noteData.id] = vexflowIndex;
        }
      });

      // Create system with vertical offset for centering
      const system = vexFlowFactory.System({
        x: currentX,
        y: verticalOffset, // ADD THIS: Apply vertical centering
        width: measureWidth,
        spaceBetweenStaves: 10,
      });

      // ADD THIS: Store the voices so we can apply accidentals
      console.log(`beatcount: measure ${i} creating voices`, {
        measureIndex: i,
        trebleVexNotesLength: trebleVexNotes.length,
        bassVexNotesLength: bassVexNotes.length
      });
      const trebleVoice = score.voice(trebleVexNotes).setStrict(false);
      const bassVoice = score.voice(bassVexNotes).setStrict(false);
      allVoices.push(trebleVoice, bassVoice);

      const staveTreble = system.addStave({ voices: [trebleVoice] });
      const staveBass = system.addStave({ voices: [bassVoice] });
      vexflowStaveMap[i] = { treble: staveTreble, bass: staveBass };
      
      function formatTimeSignature() {
        return `${pianoState.timeSignature.numerator}/${pianoState.timeSignature.denominator}`;
      }
      function formatTempo() {
        return pianoState.tempo;
      }
      
      if (i === 0) {
        const timeSignature = formatTimeSignature();
        const tempo = formatTempo();
        staveTreble.addClef("treble").addTimeSignature(timeSignature);
        staveBass.addClef("bass").addTimeSignature(timeSignature);
        system.addConnector("brace");
        system.addConnector("singleLeft");
        const keySignature = getCurrentVexFlowKeySignature();
        staveTreble.addKeySignature(keySignature);
        staveBass.addKeySignature(keySignature);
        staveTreble.setTempo({ duration: 'q', bpm: pianoState.tempo }, -27);
      }
      
      if (i === measureCount - 1) {
        system.addConnector("boldDoubleRight");
      }
      
      currentX += measureWidth;
    }

    // ADD THIS: Apply accidentals based on key signature BEFORE rendering
    const keySignature = getCurrentVexFlowKeySignature();
    Vex.Flow.Accidental.applyAccidentals(allVoices, keySignature);

    vexFlowFactory.draw();

    // NEW: Draw beams after the main score is drawn
    if (pianoState.enableBeaming) {
      drawAllBeams();
    }

    // NEW: Draw ties after beams
    drawTies();

    if (pianoState.currentSelectedMeasure !== -1) {
      highlightSelectedMeasure(pianoState.currentSelectedMeasure);
    }
    
    if (pianoState.currentSelectedNote) {
      highlightSelectedNote(
        pianoState.currentSelectedNote.measureIndex,
        pianoState.currentSelectedNote.clef,
        pianoState.currentSelectedNote.noteId
      );
    }
    
    // NEW: Restore all notes from the playback Set
    for (const noteKey of pianoState.currentPlaybackNotes) {
      const [measureIndex, clef, noteId] = noteKey.split("-");
      const measureIdx = parseInt(measureIndex);
      addPlaybackHighlight(measureIdx, clef, noteId, "#FFD700");
    }

    const scoreWrap = document.getElementById("scoreWrap");
    if (!noScroll) {
      scoreWrap.scrollLeft = scoreWrap.scrollWidth - scoreWrap.clientWidth;
    }
  } catch (e) {
    console.error("drawAll: VexFlow rendering error:", e);
  }
  
  calibrateStaffPositions();
}

/**
 * A safe redraw that preserves the current selection and all highlight states.
 */
export function safeRedraw(beaming = false) {
  const scoreData = getMeasures();
  drawAll(scoreData, false, beaming);
}

export function enableScoreInteraction(onMeasureClick, onNoteClick) {
  const scoreElement = document.getElementById("score");
  if (!scoreElement) {
    console.error("enableScoreInteraction: Score element not found.");
    return;
  }

  let mouseDownInitialPos = null;
  let mouseDownNoteTarget = null;
  let hasMouseMovedSinceMousedown = false;
  let isDraggingInitiated = false;

  // Cleanup function
  function resetDragState() {
    mouseDownInitialPos = null;
    mouseDownNoteTarget = null;
    hasMouseMovedSinceMousedown = false;
    isDraggingInitiated = false;
    isDragging = false;
    draggedNote = null;
    scoreElement.style.cursor = "default";
    clearDragPreview();
  }

  // Mouse Down
  scoreElement.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();

    const rect = scoreElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    mouseDownInitialPos = { x, y };
    mouseDownNoteTarget = detectNoteClick(x, y);
    hasMouseMovedSinceMousedown = false;
    isDraggingInitiated = false;
  });

  // Mouse Move
  scoreElement.addEventListener("mousemove", (event) => {
    if (!mouseDownInitialPos) return;

    const rect = scoreElement.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    // Check for drag initiation
    if (!isDraggingInitiated) {
      const distance = Math.sqrt(
        Math.pow(currentX - mouseDownInitialPos.x, 2) +
        Math.pow(currentY - mouseDownInitialPos.y, 2)
      );
      
      if (distance > DRAG_THRESHOLD && mouseDownNoteTarget && mouseDownNoteTarget.noteId !== null) {
        hasMouseMovedSinceMousedown = true;
        isDraggingInitiated = true;
        isDragging = true;
        startDrag(mouseDownNoteTarget, mouseDownInitialPos);
        scoreElement.style.cursor = "none";
      }
    }

    // Handle drag preview
    if (isDraggingInitiated) {
      const targetMeasureIndex = detectMeasureClick(currentX, currentY);
      if (targetMeasureIndex !== -1) {
        highlightSelectedMeasure(targetMeasureIndex);
      }

      const clef = detectClefRegion(currentY);
      const nearest = findNearestStaffPosition(currentY, clef);
      if (nearest) {
        // Apply key signature correction to preview note
        const rawMIDI = NOTES_BY_NAME[nearest.note];
        const correctedMIDI = applyKeySignatureCorrection(rawMIDI, pianoState.keySignature);
        const correctedNoteInfo = ALL_NOTE_INFO.find(n => n.midi === correctedMIDI);
        const previewNoteName = correctedNoteInfo ? correctedNoteInfo.name : nearest.note;
        updateDragPreview(currentX, nearest.y, previewNoteName);
      }
    }
  });

  // Mouse Up
  document.addEventListener("mouseup", (event) => {
    if (!mouseDownInitialPos) return;

    const scoreRect = scoreElement.getBoundingClientRect();
    const isOnScore = (
      event.clientX >= scoreRect.left &&
      event.clientX <= scoreRect.right &&
      event.clientY >= scoreRect.top &&
      event.clientY <= scoreRect.bottom
    );

    if (isOnScore && isDraggingInitiated) {
      // Complete drag
      const endX = event.clientX - scoreRect.left;
      const endY = event.clientY - scoreRect.top;
      completeDrag(endX, endY);
    } else if (isOnScore && !hasMouseMovedSinceMousedown) {
      // Handle click
      const endX = event.clientX - scoreRect.left;
      const endY = event.clientY - scoreRect.top;
      
      if (mouseDownNoteTarget && mouseDownNoteTarget.noteId !== null) {
        onNoteClick(
          mouseDownNoteTarget.measureIndex,
          mouseDownNoteTarget.clef,
          mouseDownNoteTarget.noteId
        );
      } else {
        const measureIndex = detectMeasureClick(endX, endY);
        if (measureIndex !== -1) {
          onMeasureClick(measureIndex, false);
        }
      }
    }

    resetDragState();
  });

  // Palette drops
  scoreElement.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  scoreElement.addEventListener("drop", (event) => {
    event.preventDefault();
    const rect = scoreElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    handlePaletteDrop(x, y, event);
  });
}

function handlePaletteDrop(endX, endY, event) {
  clearDragPreview();

  // Check for interval data in the drag event
  const intervalData = event ? event.dataTransfer.getData('application/interval') : null;
  
  if (intervalData) {
    try {
      const parsedIntervalData = JSON.parse(intervalData);
      
      const targetMeasureIndex = detectMeasureClick(endX, endY);
      if (targetMeasureIndex === -1) {
        return;
      }

      const clef = detectClefRegion(endY);
      const nearestPosition = findNearestStaffPosition(endY, clef);
      if (!nearestPosition) {
        console.warn("handlePaletteDrop: Could not determine staff position for interval drop.");
        return;
      }

      // Create interval chord using drop position as root
      const rootNoteName = nearestPosition.note;
      const intervalChord = createIntervalChord(rootNoteName, parsedIntervalData.intervalType);
      
      if (!intervalChord) {
        console.warn("handlePaletteDrop: Could not create interval chord.");
        return;
      }
      
      // Create the interval note
      const intervalNote = {
        name: `(${intervalChord.treble.join(' ')})`,
        clef: clef,
        duration: pianoState.quantize,
        isRest: false,
        chordName: intervalChord.displayName
      };

      const result = addNoteToMeasure(targetMeasureIndex, intervalNote);
      if (result) {
        // Dispatch event to automatically select and scroll to the new note
        const event = new CustomEvent('noteAddedToScore', {
          detail: result
        });
        document.dispatchEvent(event);
      }
      return;
      
    } catch (error) {
      console.error('Failed to parse interval drop data:', error);
    }
  }

  // Check for chord data in the drag event
  const chordData = event ? event.dataTransfer.getData('application/chord') : null;
  
  if (chordData) {
    // Handle chord drop
    try {
      const parsedChordData = JSON.parse(chordData);
      const chordObj = parsedChordData.chord;
      const chordDisplayName = parsedChordData.displayName;
      
      const targetMeasureIndex = detectMeasureClick(endX, endY);
      if (targetMeasureIndex === -1) {
        return;
      }

      const clef = detectClefRegion(endY);
      const notesToUse = getChordNotesForClef(chordObj, clef);
      
      if (notesToUse.length === 0) {
        console.warn('No suitable notes found for chord in target clef');
        return;
      }
      
      // Create the chord note
      const chordNote = {
        name: formatChordForScore(notesToUse, chordDisplayName),
        clef: clef,
        duration: pianoState.quantize,
        isRest: false,
        chordName: chordDisplayName
      };

      // Add the chord to the measure
      const result = addNoteToMeasure(targetMeasureIndex, chordNote);
      if (result) {
        // Dispatch event to automatically select and scroll to the new note
        const event = new CustomEvent('noteAddedToScore', {
          detail: result
        });
        document.dispatchEvent(event);
      }
      return;
      
    } catch (error) {
      console.error('Failed to parse chord drop data:', error);
    }
  }

  // Original palette drop logic for non-chord items
  const targetMeasureIndex = detectMeasureClick(endX, endY);
  if (targetMeasureIndex === -1) {
    return;
  }

  const clef = detectClefRegion(endY);
  const nearestPosition = findNearestStaffPosition(endY, clef);
  if (!nearestPosition) {
    console.warn("handlePaletteDrop: Could not determine staff position for the drop.");
    return;
  }

  // For rests, always use standard positions (B4 for treble, D3 for bass)
  // For notes, apply key signature correction to the dropped note
  const isRest = paletteDragType === "rest";
  let newNoteName;
  
  if (isRest) {
    // Rests always go at standard staff positions
    newNoteName = clef === 'bass' ? 'D3' : 'B4';
  } else {
    // Apply key signature correction for notes
    const rawMIDI = NOTES_BY_NAME[nearestPosition.note];
    const correctedMIDI = applyKeySignatureCorrection(rawMIDI, pianoState.keySignature);
    const correctedNoteInfo = ALL_NOTE_INFO.find(n => n.midi === correctedMIDI);
    newNoteName = correctedNoteInfo ? correctedNoteInfo.name : nearestPosition.note;
  }

  // Create the new note object
  const newNote = {
    name: newNoteName,
    clef: clef,
    duration: pianoState.quantize,
    isRest: isRest,
    measure: targetMeasureIndex,
    id: Date.now().toString(),
  };

  if (paletteDragType === "major" || paletteDragType === "minor") {
  }

  const result = addNoteToMeasure(targetMeasureIndex, newNote);
  if (result) {
    // Dispatch event to automatically select and scroll to the new note
    const event = new CustomEvent('noteAddedToScore', {
      detail: result
    });
    document.dispatchEvent(event);
  }
}

function updateDragPreview(x, snapY, noteName) {
// Early exit if we're not actually dragging
  if (!isDragging && !isPaletteDrag) {
    clearDragPreview();
    return;
  }

  let preview = document.getElementById("drag-snap-preview");
  // Get the duration from the original note being dragged
  const durationText = originalNoteData ? originalNoteData.duration : pianoState.quantize;
  const isRest = paletteDragType === "rest";
  const imagePath = getNoteImagePath(durationText, noteName, isRest);
  
  // Determine stem direction for proper note head alignment
  // The SVG images are 120x120 with note heads at specific positions:
  // - Up-stem notes: note head center at approximately (23, 80)
  // - Down-stem notes: note head center at approximately (23, 65)
  // - Whole notes: note head center at approximately (25.5, 80)
  // - Rests: centered at approximately (60, 60)
  const stemDirection = NOTE_STEM_DIRECTIONS[noteName] || 'up';
  const isWhole = durationText === 'w' || durationText === 'w.';
  
  // Note head center positions in the 120x120 SVG
  let noteHeadX, noteHeadY;
  if (isRest) {
    noteHeadX = 60; // Rests are centered
    noteHeadY = 60;
  } else if (isWhole) {
    noteHeadX = 25.5; // Whole note head center
    noteHeadY = 80;
  } else if (stemDirection === 'down') {
    noteHeadX = 23; // Down stem note head center
    noteHeadY = 65;
  } else {
    noteHeadX = 23; // Up stem note head center
    noteHeadY = 80;
  }
  
  if (!preview) {
    preview = document.createElement("div");
    preview.id = "drag-snap-preview";
    preview.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: 1000;
      transition: top 0.1s ease-out;
    `;
    document.getElementById("score").appendChild(preview);
  }

  const isOnLine = snapY % 10 === 0;

  // Container is 48x48, image is displayed at full 120x120 size
  // We offset the image so the note head center aligns with the container center (24, 24)
  const imgLeft = 24 - noteHeadX;
  const imgTop = 24 - noteHeadY;

  
  if (isOnLine) {
    // Staff line - red line has higher z-index than note circle
    preview.innerHTML = `
      <div style="position: relative; width: 120px; height: 3px;">
        <!-- Note circle with lower z-index -->
        <div style="
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255, 255, 255, 0.33);
          border-radius: 50%;
          width: 48px;
          height: 48px;
          overflow: hidden;
          z-index: 1;
        ">
          <img src="${imagePath}" alt="${durationText}" style="
            position: absolute;
            left: ${imgLeft}px;
            top: ${imgTop}px;
            width: 120px; 
            height: 120px; 
          ">
        </div>
        
        <!-- Note name label - outside the clipped container -->
        <div style="
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(12px, 8px);
          background: rgba(216, 131, 104, 0.9);
          color: white;
          font-size: 10px;
          font-weight: bold;
          padding: 1px 4px;
          border-radius: 3px;
          line-height: 1;
          z-index: 3;
        ">${noteName}</div>
        
        <!-- Red line with higher z-index -->
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          width: 100%; 
          height: 3px; 
          background: rgba(216, 131, 104, 0.9);
          border-radius: 2px;
          z-index: 2;
        "></div>
      </div>
    `;
  } else {
    // Space - dashed line split around the note circle
    preview.innerHTML = `
      <div style="position: relative; width: 120px; height: 0px;">
        <!-- Left dashed line -->
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          width: 36px; 
          height: 0px; 
          border-top: 3px dashed rgba(41, 123, 81, 0.8);
          z-index: 1;
        "></div>
        
        <!-- Right dashed line -->
        <div style="
          position: absolute;
          top: 0;
          right: 0;
          width: 36px; 
          height: 0px; 
          border-top: 3px dashed rgba(41, 123, 81, 0.8);
          z-index: 1;
        "></div>
        
        <!-- Note circle with higher z-index -->
        <div style="
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255, 255, 255, 0.33);
          border-radius: 50%;
          width: 48px;
          height: 48px;
          overflow: hidden;
          z-index: 2;
        ">
          <img src="${imagePath}" alt="${durationText}" style="
            position: absolute;
            left: ${imgLeft}px;
            top: ${imgTop}px;
            width: 120px; 
            height: 120px; 
          ">
        </div>
        
        <!-- Note name label - outside the clipped container -->
        <div style="
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(12px, 8px);
          background: rgba(41, 123, 81, 0.9);
          color: white;
          font-size: 10px;
          font-weight: bold;
          padding: 1px 4px;
          border-radius: 3px;
          line-height: 1;
          z-index: 3;
        ">${noteName}</div>
      </div>
    `;
  }
  
  preview.style.left = `${x - 60}px`;
  preview.style.top = `${snapY - 1}px`;
  preview.style.display = "block";
}

//end drag preview




/**
 * Clears the drag preview element
 */
function clearDragPreview() {
  const preview = document.getElementById("drag-snap-preview");
  if (preview) {
    preview.style.display = "none";
  }
}

function startDrag(noteInfo, initialClickPos) {
  draggedNote = noteInfo;
  dragStartPosition = initialClickPos;
  const measures = getMeasures();
  const targetMeasure = measures[noteInfo.measureIndex];

  // Find the note by ID instead of using index
  let foundNote = null;
  if (targetMeasure && noteInfo.noteId) {
    foundNote = targetMeasure.find((note) => note.id === noteInfo.noteId);
  }

  if (foundNote) {
    originalNoteData = { ...foundNote };
  } else {
    console.warn(
      "startDrag: Original note data not found in measures model. Using fallback data."
    );
    originalNoteData = {
      name: "C4",
      clef: "treble",
      duration: "q",
      isRest: false,
      measure: noteInfo.measureIndex,
    };
  }

  const vexflowIndex = vexflowIndexByNoteId[noteInfo.noteId];
  const vexNote =
    vexflowNoteMap[noteInfo.measureIndex]?.[noteInfo.clef]?.[vexflowIndex];
  if (vexNote) {
    originalVexFlowNoteBBox = vexNote.getBoundingBox();
    
    // Determine if user clicked on top or bottom of the chord
    const noteKeys = vexNote.getKeys();
    
    if (noteKeys && noteKeys.length > 1) {
      // Use VexFlow's getNoteHeadBounds() to get actual notehead Y positions
      // This excludes stems, flags, and other decorations
      const noteHeadBounds = vexNote.getNoteHeadBounds?.();
      if (noteHeadBounds && noteHeadBounds.y_top !== undefined && noteHeadBounds.y_bottom !== undefined) {
        // Determine anchor based on which notehead the click is closer to
        const distFromTop = Math.abs(initialClickPos.y - noteHeadBounds.y_top);
        const distFromBottom = Math.abs(initialClickPos.y - noteHeadBounds.y_bottom);
        chordAnchorPosition = distFromTop < distFromBottom ? 'top' : 'bottom';
      } else {
        // Fallback to bbox midpoint if getNoteHeadBounds not available
        const bboxMid = originalVexFlowNoteBBox.y + originalVexFlowNoteBBox.h / 2;
        chordAnchorPosition = initialClickPos.y < bboxMid ? 'top' : 'bottom';
      }
    } else {
      // Single note - no need for top/bottom logic
      chordAnchorPosition = 'bottom';
    }
  } else {
    console.warn("startDrag: VexFlow note for BBox not found. BBox fallback active.");
    originalVexFlowNoteBBox = {
      x: initialClickPos.x,
      y: initialClickPos.y,
      w: 10,
      h: 10,
    };
    chordAnchorPosition = 'bottom';
  }
}

function completeDrag(currentX, currentY) {

  // NEW: Check for palette drag
  if (isPaletteDrag) {
    handlePaletteDrop(currentX, currentY);
    return;
  }

  if (!draggedNote || !originalNoteData) {
    console.warn(
      "completeDrag: Called without active dragged note or original data. Aborting."
    );
    return;
  }

  const targetMeasureIndex = detectMeasureClick(currentX, currentY);
  if (targetMeasureIndex === -1) {
    return;
  }

  let clefChanged = false;
  let pitchChanged = false;
  let newClef = originalNoteData.clef;
  let newPitchName = originalNoteData.name;

  const potentialNewClef = detectClefRegion(currentY);
  if (potentialNewClef && potentialNewClef !== originalNoteData.clef) {
    clefChanged = true;
    newClef = potentialNewClef;
  }

  if (!originalNoteData.isRest && originalVexFlowNoteBBox) {
    const rawPitchMIDI = calculateAbsolutePitchFromY(
      currentY,
      newClef
    );

    // Apply key signature correction to snap to appropriate accidentals
    const correctedPitchMIDI = applyKeySignatureCorrection(rawPitchMIDI, pianoState.keySignature);

    const newNoteInfo = ALL_NOTE_INFO.find(
      (n) => n.midi === correctedPitchMIDI
    );
    if (newNoteInfo) {
      newPitchName = newNoteInfo.name;
    } else {
      console.warn(
        `completeDrag: Could not find note name for MIDI ${correctedPitchMIDI}. Keeping original pitch name as fallback.`
      );
      newPitchName = originalNoteData.name;
    }

    if (
      newPitchName !== originalNoteData.name ||
      (clefChanged &&
        NOTES_BY_NAME[originalNoteData.name] !== correctedPitchMIDI)
    ) {
      pitchChanged = true;
    }
  } else if (originalNoteData.isRest) {
    newPitchName = "R";
  }

  let insertBeforeNoteId = null;
  const currentMeasuresData = getMeasures();
  const targetMeasureNotes = currentMeasuresData[targetMeasureIndex]?.filter(
    (n) => n.clef === newClef
  );

  if (targetMeasureNotes && targetMeasureNotes.length > 0) {
    const measureStartX = measureXPositions[targetMeasureIndex];
    const relativeDropX = currentX - measureStartX;

    const vexFlowNotesInTargetClef =
      vexflowNoteMap[targetMeasureIndex]?.[newClef];

    if (vexFlowNotesInTargetClef) {
      for (let i = 0; i < vexFlowNotesInTargetClef.length; i++) {
        const vexFlowNote = vexFlowNotesInTargetClef[i];
        const noteBBox = vexFlowNote.getBoundingBox();
        if (
          noteBBox &&
          noteBBox.x + noteBBox.w / 2 - measureStartX > relativeDropX
        ) {
          insertBeforeNoteId = targetMeasureNotes[i].id;
          break;
        }
      }
    }
  }

  document.dispatchEvent(
    new CustomEvent("noteDropped", {
      detail: {
        fromMeasureIndex: draggedNote.measureIndex,
        fromNoteId: draggedNote.noteId,
        toMeasureIndex: targetMeasureIndex,
        insertBeforeNoteId: insertBeforeNoteId,
        clefChanged: clefChanged,
        pitchChanged: pitchChanged,
        newClef: newClef,
        newPitch: newPitchName,
        chordAnchor: chordAnchorPosition,
      },
    })
  );
}
/**
 * Calculates the MIDI pitch value based on Y coordinate and clef using snap-to-position
 * @param {number} y - The Y coordinate on the score (pixel value)
 * @param {string} clef - The clef ('treble' or 'bass')
 * @returns {number} The MIDI pitch value
 */
function calculateAbsolutePitchFromY(y, clef) {
  const nearest = findNearestStaffPosition(y, clef);

  if (!nearest) {
    console.warn("Could not find nearest staff position, using fallback");
    return 60; // Middle C fallback
  }

  // Convert note name to MIDI
  const midi = NOTES_BY_NAME[nearest.note];
  if (midi === undefined) {
    console.error("Unknown note name:", nearest.note);
    return 60;
  }

  return midi;
}

/**
 * Calculates the pitch change object based on drag.
 * This function is used to determine the conceptual change in pitch during a drag operation.
 * @param {string} originalNoteName - The original note name (e.g., 'C4').
 * @param {string} originalClef - The original clef ('treble' or 'bass').
 * @param {number} originalNoteY - The original Y position of the note's center from VexFlow bbox. (This parameter is now mostly illustrative, as `calculateAbsolutePitchFromY` uses `currentY` directly).
 * @param {number} currentY - The current Y position of the cursor.
 * @param {string} targetClef - The target clef ('treble' or 'bass').
 * @returns {object} Object with originalPitch (MIDI), newPitch (MIDI), semitoneChange, and clefChange.
 */
function calculatePitchChange(
  originalNoteName,
  originalClef,
  originalNoteY,
  currentY,
  targetClef
) {
  // Convert the original note name to its MIDI value.
  const originalPitchMIDI = NOTES_BY_NAME[originalNoteName];
  if (originalPitchMIDI === undefined) {
    console.warn(
      `calculatePitchChange: Original note MIDI not found for ${originalNoteName}. Cannot calculate accurate pitch change.`
    );
    return {
      originalPitch: -1,
      newPitch: -1,
      semitoneChange: 0,
      clefChange: false,
    };
  }

  // Calculate the new MIDI pitch based on the current Y position and the detected target clef.
  const newPitchMIDI = calculateAbsolutePitchFromY(currentY, targetClef);

  return {
    originalPitch: originalPitchMIDI,
    newPitch: newPitchMIDI,
    semitoneChange: newPitchMIDI - originalPitchMIDI, // Difference in semitones
    clefChange: originalClef !== targetClef, // Boolean indicating if the clef changed
  };
}

/**
 * Determines the clef region based on the Y coordinate of a point on the score.
 * This function uses dynamically calibrated Y values for a more accurate distinction between staves.
 * @param {number} y - The Y coordinate (pixel value) on the score.
 * @returns {string} 'treble' or 'bass'.
 */
function detectClefRegion(y) {
  if (!TREBLE_STAFF_BOTTOM_Y || !BASS_STAFF_TOP_Y) {
    // Fallback to old logic if not calibrated
    const midpointY =
      (TREBLE_CLEF_G4_Y || 100) +
      ((BASS_CLEF_F3_Y || 227) - (TREBLE_CLEF_G4_Y || 100)) / 2;
    return y < midpointY ? "treble" : "bass";
  }

  // Use actual staff boundaries
  const gapMidpoint =
    TREBLE_STAFF_BOTTOM_Y + (BASS_STAFF_TOP_Y - TREBLE_STAFF_BOTTOM_Y) / 2;
  return y < gapMidpoint ? "treble" : "bass";
}

function convertVexFlowIndexToLinearIndex(measureIndex, clef, vexflowIndex) {
  const measuresData = getMeasures(); // Get the most up-to-date measures data
  const measureData = measuresData[measureIndex];
  if (!measureData) {
    console.warn(
      `convertVexFlowIndexToLinearIndex: No measure data found for index ${measureIndex}.`
    );
    return -1;
  }

  let clefNoteCount = 0;

  for (let i = 0; i < measureData.length; i++) {
    const note = measureData[i];
    if (note.clef === clef) {
      if (clefNoteCount === vexflowIndex) {
        return i;
      }
      clefNoteCount++;
    }
  }

  console.warn(
    `convertVexFlowIndexToLinearIndex: Could not find linear index for VexFlow index ${vexflowIndex} in measure ${measureIndex}, clef ${clef}.`
  );
  return -1;
}

/**
 * Converts a linear index from the scoreWriter's measure data array to its VexFlow clef-specific index.
 * This is the inverse operation of `convertVexFlowIndexToLinearIndex`, useful when you have data model index
 * and need to target the corresponding VexFlow object.
 * @param {number} measureIndex - The index of the measure the note is in.
 * @param {string} clef - The clef of the note ('treble' or 'bass').
 * @param {number} linearIndex - The linear index of the note in the `measuresData[measureIndex]` array.
 * @returns {number} The VexFlow-internal index of the note within its clef's array (e.g., vexflowNoteMap[measureIndex][clef][result]), or -1 if not found/mismatched.
 */
function convertLinearIndexToVexFlowIndex(measureIndex, clef, linearIndex) {
  const measureData = getMeasures()[measureIndex];
  // Basic validation: Check if measureData exists, linearIndex is within bounds, and the clef of the note at that index matches.
  if (
    !measureData ||
    linearIndex < 0 ||
    linearIndex >= measureData.length ||
    measureData[linearIndex].clef !== clef
  ) {
    return -1; // Invalid input or clef mismatch for the specified note.
  }

  let clefNoteCount = 0;
  // Count how many notes of the given clef appear *before* the specified linearIndex.
  // This count will be the VexFlow-internal index for the note at linearIndex.
  for (let i = 0; i < linearIndex; i++) {
    if (measureData[i].clef === clef) {
      clefNoteCount++;
    }
  }
  // If the note at linearIndex matches the clef (which was checked in the initial `if` condition),
  // then `clefNoteCount` now represents its VexFlow-internal index within its clef's array.
  return clefNoteCount;
}

function detectNoteClick(x, y) {
  const measuresData = getMeasures();
  for (
    let measureIndex = 0;
    measureIndex < measuresData.length;
    measureIndex++
  ) {
    const currentMeasureData = measuresData[measureIndex] || [];

    for (let i = 0; i < currentMeasureData.length; i++) {
      const noteData = currentMeasureData[i];
      const clef = noteData.clef;
      const noteId = noteData.id;

      // Get VexFlow index from the pre-built mapping
      const vexflowNoteIndex = vexflowIndexByNoteId[noteId];

      if (
        vexflowNoteIndex !== undefined &&
        vexflowNoteMap[measureIndex]?.[clef]?.[vexflowNoteIndex]
      ) {
        const vexflowNote =
          vexflowNoteMap[measureIndex][clef][vexflowNoteIndex];
        const bbox = vexflowNote.getBoundingBox();

        if (
          bbox &&
          x >= bbox.x &&
          x <= bbox.x + bbox.w &&
          y >= bbox.y &&
          y <= bbox.y + bbox.h
        ) {
          return {
            measureIndex: measureIndex,
            clef: clef,
            noteId: noteId,
            originalNoteData: noteData,
            vexflowIndex: vexflowNoteIndex,
          };
        }
      }
    }
  }

  const clickedMeasureIndex = detectMeasureClick(x, y);

  if (clickedMeasureIndex !== -1) {
    const clefRegion = detectClefRegion(y);
    return {
      measureIndex: clickedMeasureIndex,
      clef: clefRegion,
      noteId: null,
      originalNoteData: null,
      vexflowIndex: -1,
    };
  }

  return null;
}
/**
 * Detects which measure was clicked or interacted with based on X, Y coordinates.
 * This function assumes a fixed measure width and accounts for vertical centering.
 * @param {number} x - The X coordinate of the event (relative to the score element).
 * @param {number} y - The Y coordinate of the event (relative to the score element).
 * @returns {number} The measure index (0-indexed) if a measure is detected, or -1 if the coordinates are outside any measure's bounds.
 */
function detectMeasureClick(x, y) {
  const measureWidth = 340;

  // Calculate the current vertical offset (same logic as in drawAll)
  const scoreContainer = document.getElementById("score")?.parentElement;
  const containerHeight = scoreContainer ? scoreContainer.clientHeight : 350;
  const scoreHeight = 300;
  const verticalOffset = Math.max(20, (containerHeight - scoreHeight) / 2);

  // Use calibrated bounds if available, otherwise use calculated values with offset
  const scoreTopY = TREBLE_STAFF_TOP_Y || verticalOffset + 20;
  const scoreBottomY = BASS_STAFF_BOTTOM_Y || verticalOffset + 280;

  // Define margins to allow for drops on ledger lines both above and below the staves.
  const topMargin = 50;
  const bottomMargin = 50;

  // Check if the drop is within the adjusted vertical bounds of the score.
  if (y < scoreTopY - topMargin || y > scoreBottomY + bottomMargin) {
    return -1; // Return -1 if the drop is outside the valid vertical area.
  }



  // Iterate through the stored X positions of each measure.
  for (let i = 0; i < measureXPositions.length; i++) {
    const measureStartX = measureXPositions[i];
    // Check if the event's X coordinate falls within the horizontal bounds of the current measure.
    if (x >= measureStartX && x <= measureStartX + measureWidth) {
      return i; // Return the index of the detected measure.
    }
  }

  return -1; // If the loop completes, the drop was not within any measure's horizontal bounds.
}
/**
 * Scrolls the score container horizontally to bring a specific measure into view.
 * It attempts to center the target measure within the scrollable area.
 * @param {number} measureIndex - The index of the measure to scroll to.
 */

export function scrollToMeasure(measureIndex, smoothScroll = true) {
  const scoreWrap = document.getElementById("scoreWrap");
  
  // Add this safety check
  if (!scoreWrap) {
    console.warn(`scrollToMeasure: scoreWrap element not found, skipping scroll to measure ${measureIndex}`);
    return;
  }
  
  const measureWidth = 340;

  if (measureXPositions[measureIndex] !== undefined) {
    // Calculate the target scroll position
    const targetScrollLeft = Math.max(
      0,
      measureXPositions[measureIndex] -
        scoreWrap.clientWidth / 2 +
        measureWidth / 2
    );

    // Check if we're already at the target scroll position
    const currentScrollLeft = scoreWrap.scrollLeft;
    const scrollTolerance = 10;
    
    if (Math.abs(currentScrollLeft - targetScrollLeft) <= scrollTolerance) {
      return;
    }

    if (smoothScroll) {
      scoreWrap.scrollTo({
        left: targetScrollLeft,
        behavior: "smooth",
      });
    } else {
      // Instant scroll
      scoreWrap.scrollLeft = targetScrollLeft;
    }
    
  } else {
    console.warn(
      `scrollToMeasure: Cannot scroll to measure ${measureIndex}. Measure position not found.`
    );
  }
}

// end scrolltomeasure function

function createBeamsForNotes(vexNotes, notesData) {
    if (vexNotes.length < 2) {
        return []; // Need at least 2 notes to potentially beam
    }

    // DON'T filter here - let VexFlow see the full context
    const beams = Vex.Flow.Beam.generateBeams(vexNotes, {
        beam_rests: false,                    // Don't beam over rests
        maintain_stem_directions: true,       // Preserve individual stem directions
        groups: []                           // Let VexFlow auto-group by beat
    });

    return beams;
}

/**
 * Draws all stored beams for all measures
 */
function drawAllBeams() {
  if (!pianoState.enableBeaming) return;
  
  vexflowBeams.forEach((measureBeams, index) => {
    if (measureBeams && vfContext) {
      if (typeof measureBeams === 'object' && (measureBeams.treble || measureBeams.bass)) {
        // Handle separate treble and bass beams
        if (measureBeams.treble && measureBeams.treble.length > 0) {
          measureBeams.treble.forEach(beam => beam.setContext(vfContext).draw());
        }
        if (measureBeams.bass && measureBeams.bass.length > 0) {
          measureBeams.bass.forEach(beam => beam.setContext(vfContext).draw());
        }
      } else if (Array.isArray(measureBeams) && measureBeams.length > 0) {
        // Handle array of beams
        measureBeams.forEach(beam => beam.setContext(vfContext).draw());
      }
    }
  });
}

/**
 * Processes tie data from note objects and stores them for later rendering
 * @param {Array} notesData - Array of note data objects that may contain tie information
 */
function processTies(notesData) {
  notesData.forEach((noteData) => {
    if (noteData.tie) {
      if (noteData.tie.startNoteId && noteData.tie.endNoteId) {
        // Check if this tie already exists in tieGroups (avoid duplicates)
        const tieExists = tieGroups.some(existingTie => 
          existingTie.startNoteId === noteData.tie.startNoteId && 
          existingTie.endNoteId === noteData.tie.endNoteId
        );
        
        if (!tieExists) {
          tieGroups.push({
            type: noteData.tie.type || 'tie',
            startNoteId: noteData.tie.startNoteId,
            endNoteId: noteData.tie.endNoteId
          });
        }
      }
    }
  });
}

/**
 * Draws all stored ties and slurs
 */
function drawTies() {
  if (tieGroups.length === 0) return;

  // Build a lookup map from note ID to VexFlow note object
  const vexNotesById = {};
  for (const id in vexflowIndexByNoteId) {
    const vexflowIndex = vexflowIndexByNoteId[id];
    
    // Find the note in the measures data to get its measure index and clef
    const measuresData = getMeasures();
    let foundNote = null;
    let measureIndex = -1;
    let clef = null;

    for (let i = 0; i < measuresData.length; i++) {
      const measure = measuresData[i];
      for (const note of measure) {
        if (note.id === id) {
          foundNote = note;
          measureIndex = i;
          clef = note.clef;
          break;
        }
      }
      if (foundNote) break;
    }

    if (foundNote && measureIndex !== -1 && clef) {
      const vexNote = vexflowNoteMap[measureIndex]?.[clef]?.[vexflowIndex];
      if (vexNote) {
        vexNotesById[id] = vexNote;
      }
    }
  }

  // Draw each tie/slur
  tieGroups.forEach(tie => {
    const startVexNote = vexNotesById[tie.startNoteId];
    const endVexNote = vexNotesById[tie.endNoteId];

    if (startVexNote && endVexNote) {
      if (tie.type === 'tie') {
        const staveTie = new Vex.Flow.StaveTie({
          first_note: startVexNote,
          last_note: endVexNote,
          first_indices: [0],
          last_indices: [0]
        });
        staveTie.setContext(vfContext).draw();
      } else if (tie.type === 'slur') {
        const curve = new Vex.Flow.Curve(startVexNote, endVexNote, {
          x_shift: -1,
          y_shift: 10,
          position: Vex.Flow.Stem.UP,
          position_end: Vex.Flow.Stem.UP,
        });
        curve.setContext(vfContext).draw();
      }
    } else {
      console.warn(`Could not find start/end notes for tie:`, tie);
    }
  });
}

export function setPaletteDragState(isDragging, type, duration) {
  isPaletteDrag = isDragging;
  paletteDragType = type;
  if (duration) {
    pianoState.quantize = duration;
  }
  
  // If we're ending a palette drag, clean up immediately
  if (!isDragging) {
    const scoreElement = document.getElementById("score");
    if (scoreElement) {
      scoreElement.style.cursor = "default";
      clearDragPreview();
    }
  }
}

// --- Getters for external modules ---
// These functions provide read-only access to internal rendering data structures.
// They allow other modules (e.g., for playback synchronization, analysis, or debugging) to query the current rendered state of the score.
export function getVexFlowNoteMap() {
  return vexflowNoteMap;
}
export function getMeasureXPositions() {
  return measureXPositions;
}
export function getVexFlowStaveMap() {
  return vexflowStaveMap;
}
export function getVexFlowContext() {
  return vfContext;
}
export function getVexFlowFactory() {
  return vexFlowFactory;
}
export function getVexflowIndexByNoteId() {
  return vexflowIndexByNoteId;
}

// Add this to your note-data.js or scoreEditor.js
export function getChordNotesForClef(chordObj, targetClef) {
    if (!chordObj || !chordObj.treble || !chordObj.bass) {
        console.warn('Invalid chord object for clef selection');
        return [];
    }
    
    // If the target clef has notes, use them
    if (targetClef === 'treble' && chordObj.treble.length > 0) {
        return chordObj.treble;
    } else if (targetClef === 'bass' && chordObj.bass.length > 0) {
        return chordObj.bass;
    }
    
    // Fallback: if the target clef is empty, use the other clef
    if (targetClef === 'treble') {
        return chordObj.bass.length > 0 ? chordObj.bass : [];
    } else {
        return chordObj.treble.length > 0 ? chordObj.treble : [];
    }
}

function formatChordForScore(noteNames, chordDisplayName) {
    if (!noteNames || noteNames.length === 0) return null;
    
    // If it's a single note, return it directly
    if (noteNames.length === 1) {
        return noteNames[0];
    }
    
    // For multiple notes, format as a chord
    return `(${noteNames.join(' ')})`;
}