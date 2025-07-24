// scoreRenderer.js
// This module handles rendering the musical score using VexFlow.
// Enhanced HTML5 + Touch Drag and Drop with full dragend capabilities

import { getMeasures, addNoteToMeasure } from "./scoreWriter.js";
import {
  NOTES_BY_MIDI,
  NOTES_BY_NAME,
  ALL_NOTE_INFO,
  KEY_SIGNATURES,
  getCurrentVexFlowKeySignature,
} from "./note-data.js";
import { pianoState } from "./appState.js";
import {
  addPlaybackHighlight,
  clearPlaybackHighlight,
  clearAllHighlights,
  highlightSelectedMeasure,
  clearMeasureHighlight,
  resetAllNoteStyles,
  highlightSelectedNote,
  clearSelectedNoteHighlight,
} from "./scoreHighlighter.js";
import { saveToLocalStorage } from './ioHelpers.js';

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

// --- Enhanced Drag and Drop State ---
let dragPreview = null;
let isDraggingNote = false;
let touchDragData = null;
let touchStartPos = null;
let isTouchDragging = false;

// Dynamic Y-calibration variables
const STAFF_LINE_SPACING = 10;
let TREBLE_CLEF_G4_Y = null;
let BASS_CLEF_F3_Y = null;
let STAFF_LINE_SPACING_ACTUAL = null;
let TREBLE_STAFF_TOP_Y = null;
let TREBLE_STAFF_BOTTOM_Y = null;
let BASS_STAFF_TOP_Y = null;
let BASS_STAFF_BOTTOM_Y = null;

// Drag threshold for touch
const DRAG_THRESHOLD = 5;

// Detect if device supports touch
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Staff position to note mappings
const TREBLE_STAFF_POSITIONS = [
  { position: -2, note: "C6", type: "ledger" },
  { position: -1.5, note: "B5", type: "ledger-space" },
  { position: -1, note: "A5", type: "ledger" },
  { position: -0.5, note: "G5", type: "ledger-space" },
  { position: 0, note: "F5", type: "line" },
  { position: 0.5, note: "E5", type: "space" },
  { position: 1, note: "D5", type: "line" },
  { position: 1.5, note: "C5", type: "space" },
  { position: 2, note: "B4", type: "line" },
  { position: 2.5, note: "A4", type: "space" },
  { position: 3, note: "G4", type: "line" },
  { position: 3.5, note: "F4", type: "space" },
  { position: 4, note: "E4", type: "line" },
  { position: 4.5, note: "D4", type: "space" },
  { position: 5, note: "C4", type: "ledger" },
  { position: 5.5, note: "B3", type: "ledger-space" },
  { position: 6, note: "A3", type: "ledger" },
];

const BASS_STAFF_POSITIONS = [
  { position: -3, note: "E4", type: "ledger" },
  { position: -2.5, note: "D4", type: "ledger-space" },
  { position: -2, note: "C4", type: "ledger" },
  { position: -1.5, note: "B3", type: "space" },
  { position: -1, note: "A3", type: "ledger" },
  { position: -0.5, note: "G3", type: "space" },
  { position: 0, note: "A3", type: "line" },
  { position: 0.5, note: "G3", type: "space" },
  { position: 1, note: "F3", type: "line" },
  { position: 1.5, note: "E3", type: "space" },
  { position: 2, note: "D3", type: "line" },
  { position: 2.5, note: "C3", type: "space" },
  { position: 3, note: "B2", type: "line" },
  { position: 3.5, note: "A2", type: "space" },
  { position: 4, note: "G2", type: "line" },
  { position: 4.5, note: "F2", type: "space" },
  { position: 5, note: "E2", type: "ledger" },
  { position: 5.5, note: "D2", type: "ledger-space" },
  { position: 6, note: "C2", type: "ledger" },
];

// ===================================================================
// Core Rendering Functions
// ===================================================================
function calibrateStaffPositions() {
  console.log("Calibrating staff positions...");
  const trebleStave = vexflowStaveMap[0]?.treble;
  const bassStave = vexflowStaveMap[0]?.bass;

  if (trebleStave) {
    TREBLE_STAFF_TOP_Y = trebleStave.getYForLine(0);
    TREBLE_STAFF_BOTTOM_Y = trebleStave.getYForLine(4);
    const staffHeight = TREBLE_STAFF_BOTTOM_Y - TREBLE_STAFF_TOP_Y;
    STAFF_LINE_SPACING_ACTUAL = staffHeight / 4;
    console.log(`Treble staff: top=${TREBLE_STAFF_TOP_Y}, bottom=${TREBLE_STAFF_BOTTOM_Y}, spacing=${STAFF_LINE_SPACING_ACTUAL}`);
  }

  if (bassStave) {
    BASS_STAFF_TOP_Y = bassStave.getYForLine(0);
    BASS_STAFF_BOTTOM_Y = bassStave.getYForLine(4);
    console.log(`Bass staff: top=${BASS_STAFF_TOP_Y}, bottom=${BASS_STAFF_BOTTOM_Y}`);
  }
}

function findNearestStaffPosition(y, clef) {
  const stave = vexflowStaveMap[0]?.[clef];
  if (!stave) {
    console.warn("No stave found for clef:", clef);
    return {
      position: clef === "treble" ? 3 : 1,
      note: clef === "treble" ? "G4" : "F3",
      y: y,
      type: "line"
    };
  }

  const positions = clef === "treble" ? TREBLE_STAFF_POSITIONS : BASS_STAFF_POSITIONS;
  let nearest = null;
  let minDistance = Infinity;

  for (const pos of positions) {
    const posY = stave.getYForLine(pos.position);
    const distance = Math.abs(y - posY);

    if (distance < minDistance) {
      minDistance = distance;
      nearest = { ...pos, y: posY };
    }
  }

  return nearest || {
    position: clef === "treble" ? 3 : 1,
    note: clef === "treble" ? "G4" : "F3",
    y: y,
    type: "line"
  };
}

export function setKeySignature(keySignature) {
  if (!keySignature || typeof keySignature !== "string") {
    console.warn("setKeySignature: Invalid key signature provided");
    return false;
  }

  const keyData = KEY_SIGNATURES[keySignature];
  if (!keyData) {
    console.warn(`setKeySignature: Unknown key signature "${keySignature}"`);
    return false;
  }

  pianoState.keySignature = keyData.displayName;
  pianoState.keySignatureType = keyData.type;
  safeRedraw();
  saveToLocalStorage();

  console.log(`Key signature set to: ${keyData.displayName} (type: ${keyData.type})`);
  return true;
}

export function drawAll(measures) {
  console.log("drawAll: START");
  const out = document.getElementById("score");
  if (!out) {
    console.error("drawAll: Score rendering element #score not found!");
    return;
  }

  out.innerHTML = "";
  vexflowNoteMap = [];
  measureXPositions = [];
  vexflowStaveMap = [];
  vexflowIndexByNoteId = {};

  const measureWidth = 340;
  const measureCount = measures.length > 0 ? measures.length : 1;

  if (typeof Vex === "undefined" || !Vex.Flow) {
    console.error("drawAll: VexFlow library not loaded.");
    return;
  }

  try {
    vexFlowFactory = new Vex.Flow.Factory({
      renderer: {
        elementId: "score",
        width: measureWidth * measureCount + 20,
        height: 300,
      },
    });
    vfContext = vexFlowFactory.getContext();
    const score = vexFlowFactory.EasyScore();
    let currentX = 20;

    const allVoices = [];

    for (let i = 0; i < measureCount; i++) {
      measureXPositions.push(currentX);
      const measure = measures[i] || [];
      const trebleNotesData = measure.filter((n) => n.clef === "treble");
      const bassNotesData = measure.filter((n) => n.clef === "bass");

      vexflowNoteMap[i] = { treble: [], bass: [] };

      const trebleSpec = trebleNotesData.length
        ? trebleNotesData.map((n) => `${n.name}/${n.duration}${n.isRest ? "/r" : ""}`).join(", ")
        : "B4/1/r";
      const bassSpec = bassNotesData.length
        ? bassNotesData.map((n) => `${n.name}/${n.duration}${n.isRest ? "/r" : ""}`).join(", ")
        : "D3/1/r";

      const trebleVexNotes = score.notes(trebleSpec, { clef: "treble" });
      const bassVexNotes = score.notes(bassSpec, { clef: "bass" });
      vexflowNoteMap[i].treble = trebleVexNotes;
      vexflowNoteMap[i].bass = bassVexNotes;

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

      const system = vexFlowFactory.System({
        x: currentX,
        width: measureWidth,
        spaceBetweenStaves: 10,
      });

      const trebleVoice = score.voice(trebleVexNotes).setStrict(false);
      const bassVoice = score.voice(bassVexNotes).setStrict(false);
      allVoices.push(trebleVoice, bassVoice);

      const staveTreble = system.addStave({ voices: [trebleVoice] });
      const staveBass = system.addStave({ voices: [bassVoice] });
      vexflowStaveMap[i] = { treble: staveTreble, bass: staveBass };

      if (i === 0) {
        staveTreble.addClef("treble").addTimeSignature("4/4");
        staveBass.addClef("bass").addTimeSignature("4/4");
        system.addConnector("brace");
        system.addConnector("singleLeft");
        const keySignature = getCurrentVexFlowKeySignature();
        staveTreble.addKeySignature(keySignature);
        staveBass.addKeySignature(keySignature);
      }
      if (i === measureCount - 1) {
        system.addConnector("boldDoubleRight");
      }
      currentX += measureWidth;
    }

    const keySignature = getCurrentVexFlowKeySignature();
    Vex.Flow.Accidental.applyAccidentals(allVoices, keySignature);

    vexFlowFactory.draw();
    console.log("drawAll: VexFlow drawing complete.");

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
    for (const noteKey of pianoState.currentPlaybackNotes) {
      const [measureIndex, clef, noteId] = noteKey.split('-');
      const measureIdx = parseInt(measureIndex);
      addPlaybackHighlight(measureIdx, clef, noteId, "#FFD700");
    }

    const scoreWrap = document.getElementById("scoreWrap");
    if (scoreWrap) scoreWrap.scrollLeft = scoreWrap.scrollWidth;

    // Dispatch event to notify that score was redrawn
    document.dispatchEvent(new CustomEvent('scoreRedrawn'));

    // CRITICAL: Setup draggable notes after rendering
    setupExistingNotesAsDraggable();
  } catch (e) {
    console.error("drawAll: VexFlow rendering error:", e);
  }
  calibrateStaffPositions();
  console.log("drawAll: END");
}

export function safeRedraw() {
  console.log("safeRedraw: Called. Triggering full drawAll.");
  const scoreData = getMeasures();
  drawAll(scoreData);
  console.log("safeRedraw: ✓ Completed with highlights preserved");
}

function calculateAbsolutePitchFromY(y, clef) {
  const nearest = findNearestStaffPosition(y, clef);
  if (!nearest) {
    console.warn("Could not find nearest staff position, using fallback");
    return 60;
  }

  console.log(`Snapped Y=${y} to position ${nearest.position} (${nearest.note}) at Y=${nearest.y}`);
  const midi = NOTES_BY_NAME[nearest.note];
  if (midi === undefined) {
    console.error("Unknown note name:", nearest.note);
    return 60;
  }
  return midi;
}

function detectClefRegion(y) {
  if (!TREBLE_STAFF_BOTTOM_Y || !BASS_STAFF_TOP_Y) {
    const midpointY = (TREBLE_CLEF_G4_Y || 100) + ((BASS_CLEF_F3_Y || 227) - (TREBLE_CLEF_G4_Y || 100)) / 2;
    return y < midpointY ? "treble" : "bass";
  }

  const gapMidpoint = TREBLE_STAFF_BOTTOM_Y + (BASS_STAFF_TOP_Y - TREBLE_STAFF_BOTTOM_Y) / 2;
  return y < gapMidpoint ? "treble" : "bass";
}

function detectNoteClick(x, y) {
  console.log("detectNoteClick: Input x:", x, "y:", y);
  const measuresData = getMeasures();
  for (let measureIndex = 0; measureIndex < measuresData.length; measureIndex++) {
    const currentMeasureData = measuresData[measureIndex] || [];

    for (let i = 0; i < currentMeasureData.length; i++) {
      const noteData = currentMeasureData[i];
      const clef = noteData.clef;
      const noteId = noteData.id;
      const vexflowNoteIndex = vexflowIndexByNoteId[noteId];

      if (vexflowNoteIndex !== undefined && vexflowNoteMap[measureIndex]?.[clef]?.[vexflowNoteIndex]) {
        const vexflowNote = vexflowNoteMap[measureIndex][clef][vexflowNoteIndex];
        const bbox = vexflowNote.getBoundingBox();

        if (bbox && x >= bbox.x && x <= bbox.x + bbox.w && y >= bbox.y && y <= bbox.y + bbox.h) {
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

function detectMeasureClick(x, y) {
  const measureWidth = 340;
  for (let i = 0; i < measureXPositions.length; i++) {
    const measureStartX = measureXPositions[i];
    if (x >= measureStartX && x <= measureStartX + measureWidth) {
      return i;
    }
  }
  return -1;
}

export function scrollToMeasure(measureIndex) {
  const scoreWrap = document.getElementById("scoreWrap");
  const measureWidth = 340;

  if (scoreWrap && measureXPositions[measureIndex] !== undefined) {
    const targetScrollLeft = Math.max(0, measureXPositions[measureIndex] - scoreWrap.clientWidth / 2 + measureWidth / 2);
    scoreWrap.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
    console.log(`scrollToMeasure: Scrolled to measure ${measureIndex}.`);
  } else {
    console.warn(`scrollToMeasure: Cannot scroll to measure ${measureIndex}.`);
  }
}

// ===================================================================
// ENHANCED HTML5 + TOUCH DRAG AND DROP SYSTEM
// ===================================================================

export function enableScoreInteraction(onMeasureClick, onNoteClick) {
  console.log("enableScoreInteraction: Setting up enhanced drag and drop.");
  const scoreElement = document.getElementById("score");
  if (!scoreElement) {
    console.error("enableScoreInteraction: Score element not found.");
    return;
  }

  setupUnifiedDropZone(scoreElement, onMeasureClick, onNoteClick);
  setupExistingNotesAsDraggable();
}

function setupUnifiedDropZone(scoreElement, onMeasureClick, onNoteClick) {
  // HTML5 Drag Events
  scoreElement.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    showDragPreview(e, 'html5');
  });

  scoreElement.addEventListener('dragenter', (e) => {
    e.preventDefault();
    scoreElement.classList.add('drag-over');
  });

  scoreElement.addEventListener('dragleave', (e) => {
    if (!scoreElement.contains(e.relatedTarget)) {
      scoreElement.classList.remove('drag-over');
      hideDragPreview();
    }
  });

  scoreElement.addEventListener('drop', (e) => {
    e.preventDefault();
    scoreElement.classList.remove('drag-over');
    hideDragPreview();
    handleScoreDrop(e, 'html5');
  });

  // Touch Events for Mobile
  scoreElement.addEventListener('touchmove', (e) => {
    if (isTouchDragging && touchDragData) {
      e.preventDefault();
      const touch = e.touches[0];
      showDragPreview({ clientX: touch.clientX, clientY: touch.clientY }, 'touch');
    }
  }, { passive: false });

  scoreElement.addEventListener('touchend', (e) => {
    if (isTouchDragging && touchDragData) {
      e.preventDefault();
      const touch = e.changedTouches[0];
      handleScoreDrop({ clientX: touch.clientX, clientY: touch.clientY }, 'touch');
      endTouchDrag();
    }
  });

  // Click/Tap Events
  const handleClickOrTap = (e) => {
    if (isDraggingNote || isTouchDragging) return;

    let clientX, clientY;
    if (e.type === 'touchend') {
      if (e.changedTouches.length === 0) return;
      const touch = e.changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = scoreElement.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const noteTarget = detectNoteClick(x, y);
    if (noteTarget && noteTarget.noteId) {
      onNoteClick(noteTarget.measureIndex, noteTarget.clef, noteTarget.noteId);
    } else {
      const measureIndex = detectMeasureClick(x, y);
      if (measureIndex !== -1) {
        onMeasureClick(measureIndex, false);
      }
    }
  };

  scoreElement.addEventListener('click', handleClickOrTap);
  scoreElement.addEventListener('touchend', handleClickOrTap);
}

function setupExistingNotesAsDraggable() {
  const measures = getMeasures();
  console.log('Setting up draggable notes for', measures.length, 'measures');

  // Wait a short time for VexFlow to fully render the SVG elements
  setTimeout(() => {
    for (let measureIndex = 0; measureIndex < measures.length; measureIndex++) {
      const measure = measures[measureIndex] || [];
      console.log(`Measure ${measureIndex}: ${measure.length} notes`);

      for (let i = 0; i < measure.length; i++) {
        const noteData = measure[i];
        const vexflowIndex = vexflowIndexByNoteId[noteData.id];
        const vexNote = vexflowNoteMap[measureIndex]?.[noteData.clef]?.[vexflowIndex];

        if (vexNote) {
          // Try to find the SVG element for this note
          const noteElement = findNoteElement(vexNote, noteData, measureIndex);

          console.log(`Note ${noteData.id} (${noteData.name}):`, {
            vexflowIndex,
            hasVexNote: !!vexNote,
            hasElement: !!noteElement
          });

          if (noteElement) {
            // Make draggable
            noteElement.draggable = true;
            noteElement.style.cursor = 'grab';
            noteElement.dataset.noteId = noteData.id;
            noteElement.dataset.measureIndex = measureIndex;
            noteElement.dataset.clef = noteData.clef;

            console.log(`✓ Made note ${noteData.name} draggable`);

            setupHTML5DragEvents(noteElement, noteData, measureIndex);
            setupTouchDragEvents(noteElement, noteData, measureIndex);
          } else {
            console.warn(`✗ Could not find SVG element for note ${noteData.name}`);
          }
        }
      }
    }
  }, 100); // Small delay to ensure SVG is fully rendered
}

/**
 * Finds the SVG element for a VexFlow note
 */
function findNoteElement(vexNote, noteData, measureIndex) {
  const scoreElement = document.getElementById("score");
  if (!scoreElement) return null;

  try {
    // Method 1: Try to get element from VexFlow note attributes
    if (vexNote.attrs && vexNote.attrs.el) {
      return vexNote.attrs.el;
    }

    // Method 2: Try to find by VexFlow's internal element
    if (vexNote.elem) {
      return vexNote.elem;
    }

    // Method 3: Search for SVG elements that might represent this note
    const svgElements = scoreElement.querySelectorAll('g.vf-stavenote, g.vf-note, path, circle, ellipse');

    // Try to find by position - get the note's rendered position
    if (vexNote.getAbsoluteX && vexNote.getYs) {
      const noteX = vexNote.getAbsoluteX();
      const noteYs = vexNote.getYs();
      const noteY = noteYs[0]; // First note head position

      // Find SVG elements near this position
      for (const element of svgElements) {
        const rect = element.getBoundingClientRect();
        const scoreRect = scoreElement.getBoundingClientRect();

        const elementX = rect.left - scoreRect.left + rect.width / 2;
        const elementY = rect.top - scoreRect.top + rect.height / 2;

        // Check if this element is close to the note position (within 20px)
        if (Math.abs(elementX - noteX) < 20 && Math.abs(elementY - noteY) < 20) {
          return element;
        }
      }
    }

    // Method 4: Create a wrapper div around the note area
    const bbox = vexNote.getBoundingBox();
    if (bbox) {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = `
        position: absolute;
        left: ${bbox.x}px;
        top: ${bbox.y}px;
        width: ${bbox.w}px;
        height: ${bbox.h}px;
        background: transparent;
        z-index: 10;
        pointer-events: auto;
      `;

      scoreElement.appendChild(wrapper);
      return wrapper;
    }

  } catch (error) {
    console.warn('Error finding note element:', error);
  }

  return null;
}

function setupHTML5DragEvents(noteElement, noteData, measureIndex) {
  noteElement.addEventListener('dragstart', (e) => {
    isDraggingNote = true;
    noteElement.style.cursor = 'grabbing';
    noteElement.dataset.dragStartTime = Date.now().toString();

    const dragData = {
      type: 'existing-note',
      fromMeasureIndex: measureIndex,
      fromNoteId: noteData.id,
      fromClef: noteData.clef,
      originalNoteData: noteData
    };

    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
    createMusicalDragImage(e, noteData);

    console.log('HTML5 drag started for existing note:', dragData);
  });

  // Enhanced dragend with full capabilities
  noteElement.addEventListener('dragend', (e) => {
    console.log('🏁 Enhanced drag operation completed');

    const dropEffect = e.dataTransfer.dropEffect;
    console.log('Drop effect:', dropEffect);

    switch (dropEffect) {
      case 'move':
        handleSuccessfulMove(noteElement, noteData);
        break;
      case 'copy':
        handleSuccessfulCopy(noteElement, noteData);
        break;
      case 'none':
        handleFailedDrop(noteElement, noteData);
        break;
      default:
        handleUnknownDrop(noteElement, noteData);
    }

    performAdvancedCleanup(noteElement);
    logDragOperation(noteData, dropEffect, e);
    provideFeedbackToUser(dropEffect, noteData);
    updateApplicationState(dropEffect, noteData);
  });
}

function setupTouchDragEvents(noteElement, noteData, measureIndex) {
  let touchStartTime = 0;

  noteElement.addEventListener('touchstart', (e) => {
    touchStartTime = Date.now();
    touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    touchDragData = {
      type: 'existing-note',
      fromMeasureIndex: measureIndex,
      fromNoteId: noteData.id,
      fromClef: noteData.clef,
      originalNoteData: noteData,
      element: noteElement
    };
  }, { passive: true });

  noteElement.addEventListener('touchmove', (e) => {
    if (!touchDragData || isTouchDragging) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);
    const timeDelta = Date.now() - touchStartTime;

    if ((deltaX > 10 || deltaY > 10) && timeDelta > 100) {
      e.preventDefault();
      startTouchDrag();
    }
  }, { passive: false });

  noteElement.addEventListener('touchend', (e) => {
    if (!isTouchDragging) {
      touchDragData = null;
      touchStartPos = null;
    }
  });
}

export function setupPaletteDrag() {
  const paletteNotes = document.querySelectorAll('.palette-note');
  console.log(`🎨 Setting up unified drag for ${paletteNotes.length} palette notes`);

  paletteNotes.forEach(note => {
    note.draggable = true;
    note.style.cursor = 'grab';

    note.addEventListener('dragstart', (e) => {
      setupPaletteHTML5Drag(e, note);
    });

    note.addEventListener('dragend', (e) => {
      const dropEffect = e.dataTransfer.dropEffect;

      note.style.cursor = 'grab';
      note.classList.remove('dragging');

      // Provide feedback for palette drops too
      const type = note.dataset.type;
      const duration = note.dataset.duration;
      provideFeedbackToUser(dropEffect, { name: `${duration} ${type}`, isRest: type === 'rest' });

      console.log('Palette drag ended with effect:', dropEffect);
    });

    setupPaletteTouchEvents(note);
  });
}

function setupPaletteHTML5Drag(event, note) {
  note.style.cursor = 'grabbing';
  note.classList.add('dragging');

  const type = note.dataset.type;
  const duration = note.dataset.duration;

  const dragData = {
    type: 'palette-note',
    noteType: type,
    duration: duration
  };

  event.dataTransfer.setData('application/json', JSON.stringify(dragData));
  event.dataTransfer.effectAllowed = 'copy';
  createPaletteDragImage(event, type, duration);

  console.log('🎯 HTML5 drag started from palette:', dragData);
}

function setupPaletteTouchEvents(note) {
  let touchStartTime = 0;

  note.addEventListener('touchstart', (e) => {
    touchStartTime = Date.now();
    touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    const type = note.dataset.type;
    const duration = note.dataset.duration;

    touchDragData = {
      type: 'palette-note',
      noteType: type,
      duration: duration,
      element: note
    };
  }, { passive: true });

  note.addEventListener('touchmove', (e) => {
    if (!touchDragData || isTouchDragging) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);
    const timeDelta = Date.now() - touchStartTime;

    if ((deltaX > 10 || deltaY > 10) && timeDelta > 100) {
      e.preventDefault();
      startTouchDrag();
      note.classList.add('dragging');
    }
  }, { passive: false });

  note.addEventListener('touchend', (e) => {
    if (!isTouchDragging) {
      touchDragData = null;
      touchStartPos = null;
    }
  });
}

function startTouchDrag() {
  isTouchDragging = true;
  document.body.style.cursor = 'grabbing';

  if (touchDragData.element) {
    touchDragData.element.style.opacity = '0.5';
  }

  console.log('Touch drag started:', touchDragData);
}

function endTouchDrag() {
  // Simulate dragend behavior for touch
  if (touchDragData.type === 'existing-note') {
    // For touch, we assume successful move if dropped on score
    handleSuccessfulMove(touchDragData.element, touchDragData.originalNoteData);
  }

  isTouchDragging = false;
  document.body.style.cursor = 'default';

  if (touchDragData.element) {
    touchDragData.element.style.opacity = '1';
    touchDragData.element.classList.remove('dragging');
  }

  touchDragData = null;
  touchStartPos = null;
  hideDragPreview();

  console.log('Touch drag ended');
}

// Enhanced dragend handlers
function handleSuccessfulMove(noteElement, noteData) {
  console.log('✅ Note successfully moved:', noteData.name);
  showSuccessAnimation(noteElement);
  saveToLocalStorage();
}

function handleSuccessfulCopy(noteElement, noteData) {
  console.log('📋 Note successfully copied:', noteData.name);
  showCopyAnimation(noteElement);
}

function handleFailedDrop(noteElement, noteData) {
  console.log('❌ Drop failed - note returned to original position');
  animateSnapBack(noteElement);
  showToastNotification(`Cannot drop ${noteData.name} there`, 'error');
}

function handleUnknownDrop(noteElement, noteData) {
  console.log('❓ Unknown drop result');
  handleFailedDrop(noteElement, noteData);
}

function performAdvancedCleanup(noteElement) {
  noteElement.style.opacity = '';
  noteElement.style.transform = '';
  noteElement.style.boxShadow = '';
  noteElement.classList.remove('dragging', 'drag-source');

  delete noteElement.dataset.dragStartTime;
  delete noteElement.dataset.dragStartPosition;

  document.body.style.cursor = '';
  noteElement.style.cursor = 'grab';

  isDraggingNote = false;
  hideDragPreview();
  clearMeasureHighlight();
}

function logDragOperation(noteData, dropEffect, event) {
  const dragEndData = {
    timestamp: Date.now(),
    noteId: noteData.id,
    noteName: noteData.name,
    dropEffect: dropEffect,
    dragDuration: Date.now() - (parseInt(event.target.dataset.dragStartTime) || Date.now()),
    isTouch: isTouchDevice
  };

  console.log('📊 Drag operation logged:', dragEndData);
}

function provideFeedbackToUser(dropEffect, noteData) {
  const messages = {
    'move': `✅ ${noteData.name} moved successfully`,
    'copy': `📋 ${noteData.name} copied successfully`, 
    'none': `❌ Cannot drop ${noteData.name} there`,
    'link': `🔗 ${noteData.name} linked successfully`
  };

  const message = messages[dropEffect] || `❓ ${noteData.name} - unknown result`;
  showToastNotification(message, dropEffect === 'none' ? 'error' : 'success');
}

function updateApplicationState(dropEffect, noteData) {
  if (dropEffect === 'move' || dropEffect === 'copy') {
    // Could add to undo stack here
    console.log(`Application state updated for ${dropEffect} operation`);
  }
}

function showSuccessAnimation(element) {
  element.style.transition = 'transform 0.3s ease';
  element.style.transform = 'scale(1.1)';

  setTimeout(() => {
    element.style.transform = 'scale(1)';
    setTimeout(() => {
      element.style.transition = '';
    }, 300);
  }, 150);
}

function showCopyAnimation(element) {
  element.style.transition = 'opacity 0.2s ease';
  element.style.opacity = '0.5';

  setTimeout(() => {
    element.style.opacity = '1';
    setTimeout(() => {
      element.style.transition = '';
    }, 200);
  }, 100);
}

function animateSnapBack(element) {
  element.style.animation = 'shake 0.5s ease-in-out';
  setTimeout(() => {
    element.style.animation = '';
  }, 500);
}

function showToastNotification(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'error' ? '#ff6b6b' : '#51cf66'};
    color: white;
    padding: 12px 16px;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    transition: opacity 0.3s ease;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    font-weight: 500;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

function createMusicalDragImage(event, noteData) {
  const dragImage = document.createElement('div');
  dragImage.style.cssText = `
    position: absolute;
    top: -1000px;
    background: rgba(255, 255, 255, 0.95);
    border: 2px solid #333;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 24px;
    pointer-events: none;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    display: flex;
    flex-direction: column;
    align-items: center;
  `;

  const symbols = {
    'w': '𝅝', 'h': '𝅗𝅥', 'q': '♩', '8': '♪', '16': '𝅘𝅥𝅯',
    'w.': '𝅝.', 'h.': '𝅗𝅥.', 'q.': '♩.', '8.': '♪.', '16.': '𝅘𝅥𝅯.'
  };

  const restSymbols = {
    'w': '𝄻', 'h': '𝄼', 'q': '𝄽', '8': '𝄾', '16': '𝄿',
    'w.': '𝄻.', 'h.': '𝄼.', 'q.': '𝄽.', '8.': '𝄾.', '16.': '𝄿.'
  };

  if (noteData.isRest) {
    dragImage.innerHTML = `
      <div style="font-size: 28px;">${restSymbols[noteData.duration] || '𝄽'}</div>
      <div style="font-size: 12px; margin-top: 4px; color: #666;">Rest</div>
    `;
  } else {
    dragImage.innerHTML = `
      <div style="font-size: 28px;">${symbols[noteData.duration] || '♩'}</div>
      <div style="font-size: 12px; margin-top: 4px; color: #666;">${noteData.name}</div>
    `;
  }

  document.body.appendChild(dragImage);
  event.dataTransfer.setDragImage(dragImage, 20, 20);

  setTimeout(() => {
    if (document.body.contains(dragImage)) {
      document.body.removeChild(dragImage);
    }
  }, 0);
}

function createPaletteDragImage(event, type, duration) {
  const dragImage = document.createElement('div');
  dragImage.style.cssText = `
    position: absolute;
    top: -1000px;
    background: rgba(34, 197, 94, 0.95);
    color: white;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: bold;
    pointer-events: none;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  `;

  const durationNames = {
    'w': 'Whole', 'h': 'Half', 'q': 'Quarter', '8': '8th', '16': '16th',
    'w.': 'Dotted Whole', 'h.': 'Dotted Half', 'q.': 'Dotted Quarter',
    '8.': 'Dotted 8th', '16.': 'Dotted 16th'
  };

  const displayName = durationNames[duration] || duration;
  dragImage.textContent = type === 'rest' ? `${displayName} Rest` : `${displayName} Note`;
  document.body.appendChild(dragImage);

  event.dataTransfer.setDragImage(dragImage, 10, 10);

  setTimeout(() => {
    if (document.body.contains(dragImage)) {
      document.body.removeChild(dragImage);
    }
  }, 0);
}

function showDragPreview(event, eventType) {
  const scoreElement = document.getElementById("score");
  const rect = scoreElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  let dragData;
  if (eventType === 'html5') {
    try {
      dragData = JSON.parse(event.dataTransfer.getData('application/json'));
    } catch (e) {
      dragData = { type: 'unknown' };
    }
  } else if (eventType === 'touch') {
    dragData = touchDragData || { type: 'unknown' };
  }

  const clef = detectClefRegion(y);
  const nearest = findNearestStaffPosition(y, clef);

  if (nearest) {
    let previewText;
    if (dragData.type === 'palette-note') {
      previewText = dragData.noteType === 'rest' ? 'Rest' : nearest.note;
    } else if (dragData.type === 'existing-note') {
      previewText = dragData.originalNoteData?.isRest ? 'Rest' : nearest.note;
    } else {
      previewText = nearest.note;
    }

    updateDragPreview(x, nearest.y, previewText, dragData.type === 'palette-note');
  }

  const targetMeasureIndex = detectMeasureClick(x, y);
  if (targetMeasureIndex !== -1) {
    if (targetMeasureIndex !== pianoState.currentSelectedMeasure) {
      highlightSelectedMeasure(targetMeasureIndex);
    }
  } else {
    if (pianoState.currentSelectedMeasure !== -1) {
      clearMeasureHighlight();
    }
  }
}

function updateDragPreview(x, snapY, noteName, isPaletteNote = false) {
  if (!dragPreview) {
    dragPreview = document.createElement('div');
    dragPreview.id = 'drag-snap-preview';
    dragPreview.style.cssText = `
      position: absolute;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 12px;
      font-weight: bold;
      pointer-events: none;
      z-index: 1000;
      transition: all 0.1s ease-out;
    `;
    document.getElementById("score").appendChild(dragPreview);
  }

  dragPreview.style.left = `${x - 20}px`;
  dragPreview.style.top = `${snapY - 10}px`;
  dragPreview.textContent = noteName;
  dragPreview.style.display = 'block';

  if (isPaletteNote) {
    dragPreview.style.background = 'rgba(34, 197, 94, 0.3)';
    dragPreview.style.border = '2px solid #22c55e';
    dragPreview.style.color = '#22c55e';
  } else {
    dragPreview.style.background = 'rgba(59, 130, 246, 0.3)';
    dragPreview.style.border = '2px solid #3b82f6';
    dragPreview.style.color = '#3b82f6';
  }
}

function hideDragPreview() {
  if (dragPreview) {
    dragPreview.style.display = 'none';
  }
}

function handleScoreDrop(event, eventType) {
  const scoreElement = document.getElementById("score");
  const rect = scoreElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  let dragData;
  if (eventType === 'html5') {
    try {
      dragData = JSON.parse(event.dataTransfer.getData('application/json'));
    } catch (e) {
      console.warn('Could not parse drag data:', e);
      return;
    }
  } else if (eventType === 'touch') {
    dragData = touchDragData;
    if (!dragData) {
      console.warn('No touch drag data available');
      return;
    }
  }

  console.log(`${eventType.toUpperCase()} drop detected:`, { x, y, dragData });

  const targetMeasureIndex = detectMeasureClick(x, y);
  const newClef = detectClefRegion(y);
  const nearestPosition = findNearestStaffPosition(y, newClef);

  console.log('Drop analysis:', {
    targetMeasureIndex,
    newClef,
    nearestPosition: nearestPosition?.note,
    coordinates: { x, y }
  });

  // FIXED: Always allow drops on score, let the drop handler validate
  if (dragData.type === 'palette-note') {
    handlePaletteNoteDrop(dragData, targetMeasureIndex, newClef, nearestPosition, x, y);
  } else if (dragData.type === 'existing-note') {
    handleExistingNoteDrop(dragData, targetMeasureIndex, newClef, nearestPosition, x, y);
  }
}

function handlePaletteNoteDrop(dragData, targetMeasureIndex, newClef, nearestPosition, x, y) {
  console.log('Handling palette note drop');

  const newPitchName = dragData.noteType === 'rest' ? 'R' : (nearestPosition?.note || 'C4');

  let insertBeforeNoteId = null;

  // FIXED: Allow drops even if targetMeasureIndex is -1 (let drop handler validate)
  if (targetMeasureIndex !== -1) {
    const currentMeasuresData = getMeasures();
    const targetMeasureNotes = currentMeasuresData[targetMeasureIndex]?.filter(n => n.clef === newClef);

    if (targetMeasureNotes && targetMeasureNotes.length > 0) {
      const measureStartX = measureXPositions[targetMeasureIndex];
      const relativeDropX = x - measureStartX;

      const vexFlowNotesInTargetClef = vexflowNoteMap[targetMeasureIndex]?.[newClef];
      if (vexFlowNotesInTargetClef) {
        for (let i = 0; i < vexFlowNotesInTargetClef.length; i++) {
          const vexFlowNote = vexFlowNotesInTargetClef[i];
          const noteBBox = vexFlowNote.getBoundingBox();
          if (noteBBox && noteBBox.x + noteBBox.w / 2 - measureStartX > relativeDropX) {
            insertBeforeNoteId = targetMeasureNotes[i].id;
            break;
          }
        }
      }
    }
  }

  console.log('Dispatching palette note drop event:', {
    isNewNote: true,
    noteType: dragData.noteType,
    duration: dragData.duration,
    toMeasureIndex: targetMeasureIndex,
    insertPosition: insertBeforeNoteId,
    newClef: newClef,
    newPitch: newPitchName,
    dropPosition: { x, y }
  });

  document.dispatchEvent(new CustomEvent("noteDropped", {
    detail: {
      isNewNote: true,
      noteType: dragData.noteType,
      duration: dragData.duration,
      toMeasureIndex: targetMeasureIndex,
      insertPosition: insertBeforeNoteId,
      newClef: newClef,
      newPitch: newPitchName,
      dropPosition: { x, y }
    },
  }));
}

function handleExistingNoteDrop(dragData, targetMeasureIndex, newClef, nearestPosition, x, y) {
  console.log('Handling existing note drop');

  const originalNoteData = dragData.originalNoteData;
  let clefChanged = newClef !== originalNoteData.clef;
  let pitchChanged = false;
  let newPitchName = originalNoteData.name;

  if (!originalNoteData.isRest && nearestPosition) {
    const calculatedNewPitchMIDI = calculateAbsolutePitchFromY(y, newClef);
    const newNoteInfo = ALL_NOTE_INFO.find(n => n.midi === calculatedNewPitchMIDI);

    if (newNoteInfo) {
      newPitchName = newNoteInfo.name;
    } else {
      newPitchName = nearestPosition.note;
    }

    if (newPitchName !== originalNoteData.name || clefChanged) {
      pitchChanged = true;
    }
  } else if (originalNoteData.isRest) {
    newPitchName = "R";
  }

  let insertBeforeNoteId = null;
  if (targetMeasureIndex !== -1) {
    const currentMeasuresData = getMeasures();
    const targetMeasureNotes = currentMeasuresData[targetMeasureIndex]?.filter(n => n.clef === newClef);

    if (targetMeasureNotes && targetMeasureNotes.length > 0) {
      const measureStartX = measureXPositions[targetMeasureIndex];
      const relativeDropX = x - measureStartX;

      const vexFlowNotesInTargetClef = vexflowNoteMap[targetMeasureIndex]?.[newClef];
      if (vexFlowNotesInTargetClef) {
        for (let i = 0; i < vexFlowNotesInTargetClef.length; i++) {
          const vexFlowNote = vexFlowNotesInTargetClef[i];
          const noteBBox = vexFlowNote.getBoundingBox();
          if (noteBBox && noteBBox.x + noteBBox.w / 2 - measureStartX > relativeDropX) {
            insertBeforeNoteId = targetMeasureNotes[i].id;
            break;
          }
        }
      }
    }
  }

  document.dispatchEvent(new CustomEvent("noteDropped", {
    detail: {
      fromMeasureIndex: dragData.fromMeasureIndex,
      fromNoteId: dragData.fromNoteId,
      toMeasureIndex: targetMeasureIndex,
      insertPosition: insertBeforeNoteId,
      clefChanged: clefChanged,
      pitchChanged: pitchChanged,
      newClef: newClef,
      newPitch: newPitchName,
      dropPosition: { x, y }
    },
  }));
}

export function refreshDraggableNotes() {
  setupExistingNotesAsDraggable();
}

// --- Getters for external modules ---
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

// Inject CSS for animations
const dragCSS = `
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

.toast {
  font-family: system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
}
`;

if (!document.getElementById('drag-styles')) {
  const style = document.createElement('style');
  style.id = 'drag-styles';
  style.textContent = dragCSS;
  document.head.appendChild(style);
}

console.log("✓ Enhanced HTML5 + Touch Drag and Drop system loaded successfully");