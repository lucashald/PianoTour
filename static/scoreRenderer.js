// scoreRenderer.js
// This module handles rendering the musical score using VexFlow.
// Simplified: Direct styling for selected note/measure/playback, no stored original styles.

import { getMeasures } from './scoreWriter.js';
import { NOTES_BY_MIDI, NOTES_BY_NAME, ALL_NOTE_INFO } from './note-data.js';
import { pianoState } from './appState.js'; // ADD THIS LINE
import { addPlaybackHighlight, clearPlaybackHighlight, clearAllHighlights, highlightSelectedMeasure, clearMeasureHighlight, resetAllNoteStyles, highlightSelectedNote, clearSelectedNoteHighlight } from './scoreHighlighter.js';
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
let dragStartPosition = null; // { x, y } in client coordinates. Used to track initial mouse down.
let isDragging = false; // True if a drag operation has officially begun (moved past threshold)
let originalNoteData = null; // Store the original note's data from `getMeasures()` for drag operation
let originalVexFlowNoteBBox = null; // Store the bounding box of the VexFlow note at drag start

// Event Listener Internal State for Drag/Click Detection (used within enableScoreInteraction)
let mouseDownInitialPos = null; // Stores {x, y} of the initial mousedown for drag/click differentiation
let mouseDownNoteTarget = null; // Stores noteInfo if mousedown occurred on a note
let hasMouseMovedSinceMousedown = false; // Tracks if mouse has moved beyond threshold since mousedown

// Dynamic Y-calibration variables
const STAFF_LINE_SPACING = 10; // This remains a constant for the physical spacing of staff lines
let TREBLE_CLEF_G4_Y = 100; // Default approximate Y for G4, will be calibrated dynamically
let BASS_CLEF_F3_Y = 227;   // Default approximate Y for F3, will be calibrated dynamically

// Drag threshold to differentiate between click and drag
const DRAG_THRESHOLD = 5; // pixels

// ===================================================================
// Core Rendering & Interaction
// ===================================================================


export function drawAll(measures) {
console.log("drawAll: START");
const out = document.getElementById('score');
if (!out) {
console.error("drawAll: Score rendering element #score not found!");
return;
}

out.innerHTML = '';
vexflowNoteMap = [];
measureXPositions = [];
vexflowStaveMap = [];
vexflowIndexByNoteId = {}; // Clear the ID mapping

const measureWidth = 340;
const measureCount = measures.length > 0 ? measures.length : 1;

if (typeof Vex === 'undefined' || !Vex.Flow) {
console.error("drawAll: VexFlow library not loaded.");
return;
}

try {
vexFlowFactory = new Vex.Flow.Factory({
renderer: { elementId: 'score', width: measureWidth * measureCount + 20, height: 300 }
});
vfContext = vexFlowFactory.getContext();
const score = vexFlowFactory.EasyScore();
let currentX = 20;

for (let i = 0; i < measureCount; i++) {
measureXPositions.push(currentX);
const measure = measures[i] || [];
const trebleNotesData = measure.filter(n => n.clef === 'treble');
const bassNotesData = measure.filter(n => n.clef === 'bass');

vexflowNoteMap[i] = { treble: [], bass: [] };

const trebleSpec = trebleNotesData.length ? trebleNotesData.map(n => `${n.name}/${n.duration}${n.isRest ? '/r' : ''}`).join(', ') : 'B4/1/r';
const bassSpec = bassNotesData.length ? bassNotesData.map(n => `${n.name}/${n.duration}${n.isRest ? '/r' : ''}`).join(', ') : 'D3/1/r';

const trebleVexNotes = score.notes(trebleSpec, { clef: 'treble' });
const bassVexNotes = score.notes(bassSpec, { clef: 'bass' });
vexflowNoteMap[i].treble = trebleVexNotes;
vexflowNoteMap[i].bass = bassVexNotes;

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

const system = vexFlowFactory.System({ x: currentX, width: measureWidth, spaceBetweenStaves: 10 });
const staveTreble = system.addStave({ voices: [score.voice(trebleVexNotes).setStrict(false)] });
const staveBass = system.addStave({ voices: [score.voice(bassVexNotes).setStrict(false)] });
vexflowStaveMap[i] = { treble: staveTreble, bass: staveBass };

if (i === 0) {
staveTreble.addClef('treble').addTimeSignature('4/4');
staveBass.addClef('bass').addTimeSignature('4/4');
system.addConnector('brace');
system.addConnector('singleLeft');
}
if (i === measureCount - 1) {
system.addConnector('boldDoubleRight');
}
currentX += measureWidth;
}

vexFlowFactory.draw();
console.log("drawAll: VexFlow drawing complete.");

if (pianoState.currentSelectedMeasure !== -1) {
console.log(`drawAll: Restoring measure highlight for measure ${pianoState.currentSelectedMeasure}`);
highlightSelectedMeasure(pianoState.currentSelectedMeasure); 
}
if (pianoState.currentSelectedNote) {
console.log(`drawAll: Restoring selected note highlight for note`, pianoState.currentSelectedNote);
highlightSelectedNote(pianoState.currentSelectedNote.measureIndex, pianoState.currentSelectedNote.clef, pianoState.currentSelectedNote.noteId);
}
if (pianoState.currentPlaybackNote) {
console.log(`drawAll: Restoring playback highlight for note`, pianoState.currentPlaybackNote);
addPlaybackHighlight(pianoState.currentPlaybackNote.measureIndex, pianoState.currentPlaybackNote.clef, pianoState.currentPlaybackNote.noteId, '#FFD700'); 
}

const scoreWrap = document.getElementById('scoreWrap');
if (scoreWrap) scoreWrap.scrollLeft = scoreWrap.scrollWidth;

} catch (e) {
console.error("drawAll: VexFlow rendering error:", e);
}
console.log("drawAll: END");
}

/**
* A safe redraw that preserves the current selection and all highlight states.
*/
export function safeRedraw() {
console.log('safeRedraw: Called. Triggering full drawAll.');
const scoreData = getMeasures();
// drawAll now explicitly handles re-applying pianoState.currentSelectedMeasure, pianoState.currentSelectedNote, and pianoState.currentPlaybackNote
drawAll(scoreData);
console.log("safeRedraw: ✓ Completed with highlights preserved");
}
export function enableScoreInteraction(onMeasureClick, onNoteClick) {
console.log("enableScoreInteraction: Attaching unified event listeners.");
const scoreElement = document.getElementById('score');
if (!scoreElement) {
console.error("enableScoreInteraction: Score element not found.");
return;
}

let mouseDownInitialPos = null; // Stores {x, y} of the initial mousedown for drag/click differentiation
let mouseDownNoteTarget = null; // Stores noteInfo if mousedown occurred on a note
let hasMouseMovedSinceMousedown = false; // Tracks if mouse has moved beyond threshold since mousedown
let isDraggingInitiated = false; // Internal flag to track if drag has begun for this sequence

// Mouse Down Listener
scoreElement.addEventListener('mousedown', (event) => {
if (event.button !== 0) return; // Only left-click

const rect = scoreElement.getBoundingClientRect();
const x = event.clientX - rect.left;
const y = event.clientY - rect.top;

// Reset state for a new interaction sequence
mouseDownInitialPos = { x, y };
mouseDownNoteTarget = detectNoteClick(x, y); // Check if a note was under the initial click
hasMouseMovedSinceMousedown = false;
isDragging = false; // Reset global dragging flag
isDraggingInitiated = false; // Reset internal flag for this interaction sequence
});

// Mouse Move Listener
scoreElement.addEventListener('mousemove', (event) => {
if (!mouseDownInitialPos) return; // No mousedown event initiated interaction

const rect = scoreElement.getBoundingClientRect();
const currentX = event.clientX - rect.left;
const currentY = event.clientY - rect.top;

const distance = Math.sqrt(
Math.pow(currentX - mouseDownInitialPos.x, 2) + Math.pow(currentY - mouseDownInitialPos.y, 2)
);

// If movement exceeds threshold and a drag hasn't been confirmed yet
if (distance > DRAG_THRESHOLD && !isDraggingInitiated) {
hasMouseMovedSinceMousedown = true; // Indicate movement occurred
// Only initiate drag if an *existing* note was clicked (noteId is not null)
if (mouseDownNoteTarget && mouseDownNoteTarget.noteId !== null) { 
isDraggingInitiated = true; // Set internal flag
isDragging = true; // Confirm global dragging state
startDrag(mouseDownNoteTarget, mouseDownInitialPos);
scoreElement.style.cursor = 'grabbing';
event.preventDefault(); // Prevent default browser actions that interfere with dragging.
console.log("enableScoreInteraction: Drag initiated on existing note, preventing default.");
}
}

// Continue drag feedback only if a drag has been initiated (isDragging is true)
if (isDraggingInitiated && draggedNote) { 
const targetMeasureIndex = detectMeasureClick(currentX, currentY);
if (targetMeasureIndex !== -1 && targetMeasureIndex !== pianoState.currentSelectedMeasure) {
highlightSelectedMeasure(targetMeasureIndex);
} else if (targetMeasureIndex === -1 && pianoState.currentSelectedMeasure !== -1) {
clearMeasureHighlight(); 
}
}
});

// Mouse Up Listener
scoreElement.addEventListener('mouseup', (event) => {
if (!mouseDownInitialPos) return; // No mousedown event initiated interaction

const rect = scoreElement.getBoundingClientRect();
const endX = event.clientX - rect.left;
const endY = event.clientY - rect.top;

if (isDraggingInitiated) { // A drag operation was confirmed and completed
console.log("enableScoreInteraction: Drag operation confirmed and completed.");
completeDrag(endX, endY);
scoreElement.style.cursor = 'default'; // Restore default cursor
} else { // It was a click (no significant movement or drag initiated)
if (mouseDownNoteTarget && mouseDownNoteTarget.noteId !== null && !hasMouseMovedSinceMousedown) {
// A pure click on an *existing* note (noteId is not null)
console.log("enableScoreInteraction: Pure click on EXISTING note detected, triggering onNoteClick.");
onNoteClick(mouseDownNoteTarget.measureIndex, mouseDownNoteTarget.clef, mouseDownNoteTarget.noteId);
} else if (mouseDownNoteTarget && mouseDownNoteTarget.noteId === null && !hasMouseMovedSinceMousedown) {
// A pure click on an *empty space* (VexFlow element without linear data match)
// This scenario should now select the measure, as per user request.
console.log("enableScoreInteraction: Pure click on EMPTY SPACE detected (VexFlow element without linear data match). Triggering onMeasureClick.");
const measureIndex = mouseDownNoteTarget.measureIndex; // The measure was already identified by detectNoteClick
if (measureIndex !== -1) {
onMeasureClick(measureIndex, false); // Select the measure containing the empty space
} else {
// This case should ideally not be reached if mouseDownNoteTarget exists with measureIndex.
console.warn("enableScoreInteraction: Empty space click with no valid measureIndex. Deselecting all.");
resetAllNoteStyles();
}
} else if (!mouseDownNoteTarget && !hasMouseMovedSinceMousedown) {
// A pure click on the *measure background* (not on a note or VexFlow element)
console.log("enableScoreInteraction: Pure click on MEASURE BACKGROUND detected, triggering onMeasureClick.");
const measureIndex = detectMeasureClick(mouseDownInitialPos.x, mouseDownInitialPos.y);
if (measureIndex !== -1) {
onMeasureClick(measureIndex, false); // Select the measure
} else {
console.log("enableScoreInteraction: Clicked outside any measure or note. Deselecting all.");
resetAllNoteStyles(); 
}
} else {
// Mouseup detected, but not a clear click or confirmed drag (moved slightly but below threshold, or no note target).
console.log("enableScoreInteraction: Mouseup detected, not a clear click or confirmed drag. Resetting state.");
}
}

// Reset all interaction state variables regardless of outcome
mouseDownInitialPos = null;
mouseDownNoteTarget = null;
hasMouseMovedSinceMousedown = false;
isDragging = false; 
isDraggingInitiated = false; 
draggedNote = null;
dragStartPosition = null;
originalNoteData = null;
originalVexFlowNoteBBox = null;
});
}


function startDrag(noteInfo, initialClickPos) {
console.log("startDrag: Initializing drag state.");
draggedNote = noteInfo; 
dragStartPosition = initialClickPos; 

const measures = getMeasures();
const targetMeasure = measures[noteInfo.measureIndex];

// Find the note by ID instead of using index
let foundNote = null;
if (targetMeasure && noteInfo.noteId) {
foundNote = targetMeasure.find(note => note.id === noteInfo.noteId);
}

if (foundNote) {
originalNoteData = { ...foundNote }; 
} else {
console.warn("startDrag: Original note data not found in measures model. Using fallback data.");
originalNoteData = { name: 'C4', clef: 'treble', duration: 'q', isRest: false, measure: noteInfo.measureIndex }; 
}

const vexflowIndex = vexflowIndexByNoteId[noteInfo.noteId];
const vexNote = vexflowNoteMap[noteInfo.measureIndex]?.[noteInfo.clef]?.[vexflowIndex];
if (vexNote) {
originalVexFlowNoteBBox = vexNote.getBoundingBox();
} else {
console.warn("startDrag: VexFlow note for BBox not found. BBox fallback active.");
originalVexFlowNoteBBox = { x: initialClickPos.x, y: initialClickPos.y, w: 10, h: 10 };
}

console.log('startDrag: Drag state initialized for note:', draggedNote);
}

function completeDrag(currentX, currentY) {
    console.log("completeDrag: Processing drag completion.");
    if (!draggedNote || !originalNoteData) {
        console.warn("completeDrag: Called without active dragged note or original data. Aborting.");
        return;
    }

    const targetMeasureIndex = detectMeasureClick(currentX, currentY);
    if (targetMeasureIndex === -1) {
        console.log('completeDrag: Dropped outside valid measure area. Drag operation cancelled.');
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
        console.log(`completeDrag: Clef change detected: from ${originalNoteData.clef} to ${newClef}`);
    }

    if (!originalNoteData.isRest && originalVexFlowNoteBBox) {
        const calculatedNewPitchMIDI = calculateAbsolutePitchFromY(currentY, newClef);

        const newNoteInfo = ALL_NOTE_INFO.find(n => n.midi === calculatedNewPitchMIDI);
        if (newNoteInfo) {
            newPitchName = newNoteInfo.name;
        } else {
            console.warn(`completeDrag: Could not find note name for MIDI ${calculatedNewPitchMIDI}. Keeping original pitch name as fallback.`);
            newPitchName = originalNoteData.name; 
        }

        if (newPitchName !== originalNoteData.name || (clefChanged && NOTES_BY_NAME[originalNoteData.name] !== calculatedNewPitchMIDI)) {
            pitchChanged = true;
            console.log(`completeDrag: Pitch change detected: from ${originalNoteData.name} to ${newPitchName} in ${newClef} clef.`);
        }
    } else if (originalNoteData.isRest) {
        newPitchName = "R"; 
        console.log("completeDrag: Dragged a rest. Pitch name remains R.");
    }

    let insertBeforeNoteId = null; 
    const currentMeasuresData = getMeasures();
    const targetMeasureNotes = currentMeasuresData[targetMeasureIndex]?.filter(n => n.clef === newClef);

    if (targetMeasureNotes && targetMeasureNotes.length > 0) {
        const measureStartX = measureXPositions[targetMeasureIndex];
        const relativeDropX = currentX - measureStartX; 

        const vexFlowNotesInTargetClef = vexflowNoteMap[targetMeasureIndex]?.[newClef];

        if (vexFlowNotesInTargetClef) {
            for (let i = 0; i < vexFlowNotesInTargetClef.length; i++) {
                const vexFlowNote = vexFlowNotesInTargetClef[i];
                const noteBBox = vexFlowNote.getBoundingBox();
                if (noteBBox && (noteBBox.x + noteBBox.w / 2 - measureStartX) > relativeDropX) {
                    insertBeforeNoteId = targetMeasureNotes[i].id;
                    console.log(`completeDrag: Determined insertion before note ID ${insertBeforeNoteId} at VexFlow clef index ${i}.`);
                    break;
                }
            }
        }
    }
    console.log('completeDrag: Insert before note ID:', insertBeforeNoteId || 'Append to end');

    document.dispatchEvent(new CustomEvent('noteDropped', {
        detail: {
            fromMeasureIndex: draggedNote.measureIndex,
            fromNoteId: draggedNote.noteId, 
            toMeasureIndex: targetMeasureIndex,
            insertBeforeNoteId: insertBeforeNoteId, 
            clefChanged: clefChanged,
            pitchChanged: pitchChanged,
            newClef: newClef,
            newPitch: newPitchName 
        },
    }));
    console.log('completeDrag: Dispatched noteDropped event with details:', {
        fromMeasureIndex: draggedNote.measureIndex,
        fromNoteId: draggedNote.noteId,
        toMeasureIndex: targetMeasureIndex,
        insertBeforeNoteId: insertBeforeNoteId,
        clefChanged: clefChanged,
        pitchChanged: pitchChanged,
        newClef: newClef,
        newPitch: newPitchName
    });
}

/**
* Calculates the absolute MIDI pitch value based on Y coordinate and clef, using dynamic calibration.
* @param {number} y - The Y coordinate on the score (pixel value).
* @param {string} clef - The clef ('treble' or 'bass').
* @returns {number} The MIDI pitch value (clamped between 21 and 108).
*/
function calculateAbsolutePitchFromY(y, clef) {
let referenceY;
let referenceMidi;

if (clef === 'treble') {
referenceY = TREBLE_CLEF_G4_Y;
referenceMidi = 67; // G4 MIDI note number
} else if (clef === 'bass') {
referenceY = BASS_CLEF_F3_Y;
referenceMidi = 53; // F3 MIDI note number
} else {
console.warn('calculateAbsolutePitchFromY: Unknown clef:', clef, 'Defaulting to C4 (MIDI 60) for pitch calculation.');
return 60; // Fallback if clef is unrecognized
}

// Calculate semitone difference based on Y position.
// In VexFlow, a change of STAFF_LINE_SPACING (10px) typically represents a musical interval of a step (2 semitones).
const pixelsPerSemitone = STAFF_LINE_SPACING / 2; // 5 pixels per semitone
const deltaY = referenceY - y; // Positive deltaY means `y` is higher on the screen (lower pixel value), which corresponds to a higher pitch.
const semitoneChange = Math.round(deltaY / pixelsPerSemitone);

const absolutePitchMIDI = referenceMidi + semitoneChange;

// Clamp the resulting MIDI pitch to the standard piano range (A0 to C8)
const clampedPitchMIDI = Math.max(21, Math.min(108, absolutePitchMIDI));

console.log(`calculateAbsolutePitchFromY: Y=${y}, clef=${clef}, RefY=${referenceY}, RefMIDI=${referenceMidi}, deltaY=${deltaY}, semitones=${semitoneChange}, ResultMIDI=${absolutePitchMIDI} (clamped: ${clampedPitchMIDI})`);

return clampedPitchMIDI;
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
function calculatePitchChange(originalNoteName, originalClef, originalNoteY, currentY, targetClef) {
// Convert the original note name to its MIDI value.
const originalPitchMIDI = NOTES_BY_NAME[originalNoteName];
if (originalPitchMIDI === undefined) {
console.warn(`calculatePitchChange: Original note MIDI not found for ${originalNoteName}. Cannot calculate accurate pitch change.`);
return { originalPitch: -1, newPitch: -1, semitoneChange: 0, clefChange: false };
}

// Calculate the new MIDI pitch based on the current Y position and the detected target clef.
const newPitchMIDI = calculateAbsolutePitchFromY(currentY, targetClef);

return {
originalPitch: originalPitchMIDI,
newPitch: newPitchMIDI,
semitoneChange: newPitchMIDI - originalPitchMIDI, // Difference in semitones
clefChange: originalClef !== targetClef // Boolean indicating if the clef changed
};
}

/**
* Determines the clef region based on the Y coordinate of a point on the score.
* This function uses dynamically calibrated Y values for a more accurate distinction between staves.
* @param {number} y - The Y coordinate (pixel value) on the score.
* @returns {string} 'treble' or 'bass'.
*/
function detectClefRegion(y) {
// A dynamically determined midpoint between the two staves is used for accurate clef detection.
// This midpoint is calculated using the calibrated Y positions of G4 and F3.
// This assumes G4 and F3 are rendered somewhere in the first measure for calibration.
const MID_STAFFS_Y_THRESHOLD = (TREBLE_CLEF_G4_Y + BASS_CLEF_F3_Y) / 2;

// If the Y coordinate is above or at the midpoint, it's considered part of the treble clef region.
if (y <= MID_STAFFS_Y_THRESHOLD) {
return 'treble';
} 
// Otherwise, it's considered part of the bass clef region.
else {
return 'bass';
}
}
function convertVexFlowIndexToLinearIndex(measureIndex, clef, vexflowIndex) {
const measuresData = getMeasures(); // Get the most up-to-date measures data
const measureData = measuresData[measureIndex];
if (!measureData) {
console.warn(`convertVexFlowIndexToLinearIndex: No measure data found for index ${measureIndex}.`);
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

console.warn(`convertVexFlowIndexToLinearIndex: Could not find linear index for VexFlow index ${vexflowIndex} in measure ${measureIndex}, clef ${clef}.`);
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
if (!measureData || linearIndex < 0 || linearIndex >= measureData.length || measureData[linearIndex].clef !== clef) {
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
console.log('detectNoteClick: Input x:', x, 'y:', y);
const measuresData = getMeasures(); 

for (let measureIndex = 0; measureIndex < measuresData.length; measureIndex++) {
const currentMeasureData = measuresData[measureIndex] || [];

for (let i = 0; i < currentMeasureData.length; i++) {
const noteData = currentMeasureData[i];
const clef = noteData.clef;
const noteId = noteData.id;

// Get VexFlow index from the pre-built mapping
const vexflowNoteIndex = vexflowIndexByNoteId[noteId];

if (vexflowNoteIndex !== undefined && vexflowNoteMap[measureIndex]?.[clef]?.[vexflowNoteIndex]) {
const vexflowNote = vexflowNoteMap[measureIndex][clef][vexflowNoteIndex];
const bbox = vexflowNote.getBoundingBox();

if (bbox && x >= bbox.x && x <= bbox.x + bbox.w && y >= bbox.y && y <= bbox.y + bbox.h) {
console.log('detectNoteClick: Existing note found and mapped:', { measureIndex, clef, noteId, originalNoteData: noteData, vexflowIndex: vexflowNoteIndex });
return { 
measureIndex: measureIndex, 
clef: clef, 
noteId: noteId,
originalNoteData: noteData, 
vexflowIndex: vexflowNoteIndex 
};
}
}
}
}

const clickedMeasureIndex = detectMeasureClick(x, y);

if (clickedMeasureIndex !== -1) {
const clefRegion = detectClefRegion(y); 
console.log(`detectNoteClick: Clicked on Measure Background: Measure ${clickedMeasureIndex}, Clef Region ${clefRegion}.`);

return { 
measureIndex: clickedMeasureIndex, 
clef: clefRegion, 
noteId: null, 
originalNoteData: null, 
vexflowIndex: -1 
};
}

console.log('detectNoteClick: No note or measure background found at given coordinates.');
return null; 
}



/**
* Detects which measure was clicked or interacted with based on X, Y coordinates.
* This function assumes a fixed measure width and a defined vertical range for the score area.
* @param {number} x - The X coordinate of the event (relative to the score element).
* @param {number} y - The Y coordinate of the event (relative to the score element).
* @returns {number} The measure index (0-indexed) if a measure is detected, or -1 if the coordinates are outside any measure's bounds.
*/
function detectMeasureClick(x, y) {
const measureWidth = 340; // Assumed fixed width for a single measure in your layout.
const scoreTopY = 20;    // Approximate top Y coordinate of the overall score area (where staves begin).
const scoreBottomY = 280; // Approximate bottom Y coordinate of the overall score area (where staves end).

// First, perform a quick check to see if the click is within the vertical bounds of the score area.
if (y < scoreTopY || y > scoreBottomY) {
return -1; // The Y coordinate is outside the vertical range where measures exist, so return -1 immediately.
}

// Iterate through the stored X positions of each measure.
// `measureXPositions` holds the starting X coordinate for each measure.
for (let i = 0; i < measureXPositions.length; i++) {
const measureStartX = measureXPositions[i];
// Check if the event's X coordinate falls within the horizontal bounds of the current measure.
if (x >= measureStartX && x <= measureStartX + measureWidth) {
return i; // Return the index of the detected measure.
}
}
return -1; // If the loop completes without finding a measure, the X coordinate is not within any measure.
}

/**
* Scrolls the score container horizontally to bring a specific measure into view.
* It attempts to center the target measure within the scrollable area.
* @param {number} measureIndex - The index of the measure to scroll to.
*/
export function scrollToMeasure(measureIndex) {
const scoreWrap = document.getElementById('scoreWrap'); // The HTML element acting as the scrollable container for the score.
const measureWidth = 340; // The fixed width of a single measure in pixels.

// Ensure the scrollable container exists and the target measure's X position is known.
if (scoreWrap && measureXPositions[measureIndex] !== undefined) {
// Calculate the target scroll position.
// This calculation aims to place the center of the target measure at the center of the scrollable viewport.
const targetScrollLeft = Math.max(
0, // Ensures the scroll position does not go below zero (leftmost edge).
measureXPositions[measureIndex] - (scoreWrap.clientWidth / 2) + (measureWidth / 2)
);

// Apply the calculated scroll position with smooth animation.
scoreWrap.scrollTo({
left: targetScrollLeft,
behavior: 'smooth'
});
console.log(`scrollToMeasure: Scrolled to measure ${measureIndex}.`);
} else {
console.warn(`scrollToMeasure: Cannot scroll to measure ${measureIndex}. Score wrapper element or measure position not found.`);
}
}

// --- Getters for external modules ---
// These functions provide read-only access to internal rendering data structures.
// They allow other modules (e.g., for playback synchronization, analysis, or debugging) to query the current rendered state of the score.
export function getVexFlowNoteMap() { return vexflowNoteMap; }
export function getMeasureXPositions() { return measureXPositions; }
export function getVexFlowStaveMap() { return vexflowStaveMap; }
export function getVexFlowContext() { return vfContext; }
export function getVexFlowFactory() { return vexFlowFactory; }
export function getVexflowIndexByNoteId() { return vexflowIndexByNoteId; }

console.log("✓ scoreRenderer.js loaded successfully");