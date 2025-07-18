// scoreRenderer.js
// This module handles rendering the musical score using VexFlow.
// Simplified: Direct styling for selected note/measure/playback, no stored original styles.

import { getMeasures } from './scoreWriter.js';
import { NOTES_BY_MIDI, NOTES_BY_NAME, ALL_NOTE_INFO } from './note-data.js'; // Needed for pitch calculations

// ===================================================================
// Global Variables
// ===================================================================

// --- VexFlow Objects & Score Layout ---
let vexflowNoteMap = [];
let measureXPositions = [];
let vexflowStaveMap = [];
let vfContext = null;
let vexFlowFactory = null;

// --- Highlighting State ---
// We only need to track what's currently highlighted
let currentSelectedMeasure = -1; // Index of the currently selected measure
let currentSelectedNote = null; // { measureIndex, clef, noteIndex } of the currently selected note
let currentPlaybackNote = null; // { measureIndex, clef, noteIndex } of the note currently being played

// --- Drag and Drop State ---
let draggedNote = null; // { measureIndex, clef, noteIndex, originalNoteData, vexflowIndex }
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
let BASS_CLEF_F3_Y = 227;   // Default approximate Y for F3, will be calibrated dynamically

// Drag threshold to differentiate between click and drag
const DRAG_THRESHOLD = 5; // pixels

// ===================================================================
// Core Rendering & Interaction
// ===================================================================

/**
 * Renders the entire musical score from scratch. This is a destructive operation.
 * @param {Array} measures - The array of measures data from scoreWriter.
 */
export function drawAll(measures) {
    console.log("drawAll: START");
    const out = document.getElementById('score');
    if (!out) {
        console.error("drawAll: Score rendering element #score not found!");
        return;
    }

    // Clear previous rendering artifacts and reset VexFlow maps
    out.innerHTML = '';
    vexflowNoteMap = [];
    measureXPositions = [];
    vexflowStaveMap = [];

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

            // Ensure rests for empty clefs to maintain measure structure
            const trebleSpec = trebleNotesData.length ? trebleNotesData.map(n => `${n.name}/${n.duration}${n.isRest ? '/r' : ''}`).join(', ') : 'B4/1/r';
            const bassSpec = bassNotesData.length ? bassNotesData.map(n => `${n.name}/${n.duration}${n.isRest ? '/r' : ''}`).join(', ') : 'D3/1/r';

            const trebleVexNotes = score.notes(trebleSpec, { clef: 'treble' });
            const bassVexNotes = score.notes(bassSpec, { clef: 'bass' });
            vexflowNoteMap[i].treble = trebleVexNotes;
            vexflowNoteMap[i].bass = bassVexNotes;

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
        
        // Re-apply highlighting states AFTER the entire score is drawn and calibrated.
        // This order is crucial for correct visual layering and persistence.
        if (currentSelectedMeasure !== -1) {
            console.log(`drawAll: Restoring measure highlight for measure ${currentSelectedMeasure}`);
            highlightSelectedMeasure(currentSelectedMeasure); // This will also handle its overlay
        }
        if (currentSelectedNote) {
            console.log(`drawAll: Restoring selected note highlight for note`, currentSelectedNote);
            highlightSelectedNote(currentSelectedNote.measureIndex, currentSelectedNote.clef, currentSelectedNote.noteIndex);
        }
        if (currentPlaybackNote) {
            console.log(`drawAll: Restoring playback highlight for note`, currentPlaybackNote);
            // Assuming a default playback color; adjust as needed
            addPlaybackHighlight(currentPlaybackNote.measureIndex, currentPlaybackNote.clef, currentPlaybackNote.noteIndex, '#FFD700'); 
        }

        // Scroll to the end by default
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
    // drawAll now explicitly handles re-applying currentSelectedMeasure, currentSelectedNote, and currentPlaybackNote
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
            // Only initiate drag if an *existing* note was clicked (noteIndex is not -1)
            if (mouseDownNoteTarget && mouseDownNoteTarget.noteIndex !== -1) { 
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
            if (targetMeasureIndex !== -1 && targetMeasureIndex !== currentSelectedMeasure) {
                highlightSelectedMeasure(targetMeasureIndex);
            } else if (targetMeasureIndex === -1 && currentSelectedMeasure !== -1) {
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
            if (mouseDownNoteTarget && mouseDownNoteTarget.noteIndex !== -1 && !hasMouseMovedSinceMousedown) {
                // A pure click on an *existing* note (noteIndex is not -1)
                console.log("enableScoreInteraction: Pure click on EXISTING note detected, triggering onNoteClick.");
                onNoteClick(mouseDownNoteTarget.measureIndex, mouseDownNoteTarget.clef, mouseDownNoteTarget.noteIndex);
            } else if (mouseDownNoteTarget && mouseDownNoteTarget.noteIndex === -1 && !hasMouseMovedSinceMousedown) {
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

// --- Core Drag and Drop Functions ---
/**
 * Initiates the internal state for a note drag operation.
 * Called when a mousedown on a note is followed by movement beyond the DRAG_THRESHOLD.
 * @param {object} noteInfo - The detected note at mousedown.
 * @param {object} initialClickPos - The {x, y} coordinates of the mousedown.
 */
function startDrag(noteInfo, initialClickPos) {
    console.log("startDrag: Initializing drag state.");
    draggedNote = noteInfo; // Store details of the note being dragged
    dragStartPosition = initialClickPos; // Store the exact starting pixel coordinates
    
    // Get the full original note data from the scoreWriter's model
    const measures = getMeasures();
    const targetMeasure = measures[noteInfo.measureIndex];
    if (targetMeasure && targetMeasure[noteInfo.noteIndex]) {
        originalNoteData = { ...targetMeasure[noteInfo.noteIndex] }; // Create a shallow copy
    } else {
        console.warn("startDrag: Original note data not found in measures model. Using fallback data.");
        originalNoteData = { name: 'C4', clef: 'treble', duration: 'q', isRest: false, measure: noteInfo.measureIndex }; // Safe fallback
    }

    // Get VexFlow note's bounding box for visual positioning reference during drag (e.g., for a ghost note)
    const vexflowIndex = convertLinearIndexToVexFlowIndex(
        noteInfo.measureIndex, noteInfo.clef, noteInfo.noteIndex
    );
    const vexNote = vexflowNoteMap[noteInfo.measureIndex]?.[noteInfo.clef]?.[vexflowIndex];
    if (vexNote) {
        originalVexFlowNoteBBox = vexNote.getBoundingBox();
    } else {
        console.warn("startDrag: VexFlow note for BBox not found. BBox fallback active.");
        // Fallback bounding box, might not be accurate for visual feedback
        originalVexFlowNoteBBox = { x: initialClickPos.x, y: initialClickPos.y, w: 10, h: 10 };
    }
    
    // Optionally: Add visual feedback here like hiding the original note or drawing a ghost.
    // clearSelectedNoteHighlight(); // Clear selection highlight if note is dragged
    // clearMeasureHighlight();      // Ensure measure highlight is handled for visual clarity during drag
    // (These clear calls should be managed carefully to avoid flickering if a ghost note is used)

    console.log('startDrag: Drag state initialized for note:', draggedNote);
}

/**
 * Completes a drag operation, calculates the new note parameters, and dispatches an event.
 * @param {number} currentX - The X coordinate of the mouseup (final drop position).
 * @param {number} currentY - The Y coordinate of the mouseup (final drop position).
 */
function completeDrag(currentX, currentY) {
    console.log("completeDrag: Processing drag completion.");
    if (!draggedNote || !originalNoteData) {
        console.warn("completeDrag: Called without active dragged note or original data. Aborting.");
        return;
    }
    
    // Determine the target measure where the note was dropped
    const targetMeasureIndex = detectMeasureClick(currentX, currentY);
    if (targetMeasureIndex === -1) {
        console.log('completeDrag: Dropped outside valid measure area. Drag operation cancelled.');
        // Revert any visual changes for the dragged note (e.g., remove ghost, show original).
        return;
    }

    let clefChanged = false;
    let pitchChanged = false;
    let newClef = originalNoteData.clef; // Start with original clef
    let newPitchName = originalNoteData.name; // Start with original note name

    // Determine the clef for the new position based on the final Y coordinate
    const potentialNewClef = detectClefRegion(currentY);
    if (potentialNewClef && potentialNewClef !== originalNoteData.clef) { // Check for `potentialNewClef` being defined (not null/undefined)
        clefChanged = true;
        newClef = potentialNewClef;
        console.log(`completeDrag: Clef change detected: from ${originalNoteData.clef} to ${newClef}`);
    }

    // Determine the new pitch, but only if it's not a rest
    if (!originalNoteData.isRest && originalVexFlowNoteBBox) {
        // Calculate the new MIDI pitch from the current drop Y and the determined new clef
        const calculatedNewPitchMIDI = calculateAbsolutePitchFromY(currentY, newClef);
        
        // Find the corresponding note name (e.g., C4, D#5) for the calculated MIDI pitch
        const newNoteInfo = ALL_NOTE_INFO.find(n => n.midi === calculatedNewPitchMIDI);
        if (newNoteInfo) {
            newPitchName = newNoteInfo.name;
        } else {
            console.warn(`completeDrag: Could not find note name for MIDI ${calculatedNewPitchMIDI}. Keeping original pitch name as fallback.`);
            newPitchName = originalNoteData.name; 
        }

        // Pitch is considered changed if the new note name is different OR the clef changed (which implies a different octave/MIDI value).
        // The second part of the condition handles cases like C4 treble to C3 bass - same letter, different actual pitch.
        if (newPitchName !== originalNoteData.name || (clefChanged && NOTES_BY_NAME[originalNoteData.name] !== calculatedNewPitchMIDI)) {
            pitchChanged = true;
            console.log(`completeDrag: Pitch change detected: from ${originalNoteData.name} to ${newPitchName} in ${newClef} clef.`);
        }
    } else if (originalNoteData.isRest) {
        newPitchName = "R"; // Rests do not have pitch names, so it remains 'R'
        console.log("completeDrag: Dragged a rest. Pitch name remains R.");
    }
    
    // Determine the precise horizontal insertion position within the target measure
    let insertPosition = -1; // Default to appending at the end of the clef's section in the target measure
    const currentMeasuresData = getMeasures();
    const targetMeasureNotes = currentMeasuresData[targetMeasureIndex]?.filter(n => n.clef === newClef);

    if (targetMeasureNotes && targetMeasureNotes.length > 0) {
        const measureStartX = measureXPositions[targetMeasureIndex];
        const relativeDropX = currentX - measureStartX; // X coordinate relative to the start of the target measure

        const vexFlowNotesInTargetClef = vexflowNoteMap[targetMeasureIndex]?.[newClef];

        if (vexFlowNotesInTargetClef) {
            for (let i = 0; i < vexFlowNotesInTargetClef.length; i++) {
                const vexFlowNote = vexFlowNotesInTargetClef[i];
                const noteBBox = vexFlowNote.getBoundingBox();
                // Check if the dropX is before the center of the current note
                if (noteBBox && (noteBBox.x + noteBBox.w / 2 - measureStartX) > relativeDropX) {
                    // Find the linear index (within the scoreWriter's measure array) of the note we are inserting *before*.
                    insertPosition = currentMeasuresData[targetMeasureIndex].indexOf(targetMeasureNotes[i]);
                    console.log(`completeDrag: Determined insertion position before existing note at VexFlow clef index ${i}, linear index ${insertPosition}.`);
                    break;
                }
            }
        }
    }
    console.log('completeDrag: Calculated insertion position:', insertPosition === -1 ? 'Append to end' : insertPosition);

    // Dispatch a custom event to notify other modules (e.g., scoreWriter) about the completed drag-and-drop operation
    document.dispatchEvent(new CustomEvent('noteDropped', {
        detail: {
            fromMeasureIndex: draggedNote.measureIndex,
            fromNoteIndex: draggedNote.noteIndex, // Original linear index within its measure
            toMeasureIndex: targetMeasureIndex,
            insertPosition: insertPosition, // Linear index to insert at in the target measure (or -1 to append)
            clefChanged: clefChanged,
            pitchChanged: pitchChanged,
            newClef: newClef,
            newPitch: newPitchName // The new note name (e.g., "C4")
        },
    }));
    console.log('completeDrag: Dispatched noteDropped event with details:', {
        fromMeasureIndex: draggedNote.measureIndex,
        fromNoteIndex: draggedNote.noteIndex,
        toMeasureIndex: targetMeasureIndex,
        insertPosition: insertPosition,
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

// ===================================================================
// INDIVIDUAL NOTE HIGHLIGHTING
// ===================================================================

/**
 * Highlights a single selected note with an orange color.
 * This function ensures visual precedence: it clears any previously selected note highlight,
 * and also clears any active playback highlight on the target note so that the orange selection is visible.
 * @param {number} measureIndex - The index of the measure the note is in.
 * @param {string} clef - The clef of the note ('treble' or 'bass').
 * @param {number} noteIndex - The linear index of the note within its measure's data array.
 */
export function highlightSelectedNote(measureIndex, clef, noteIndex) {
    console.log(`highlightSelectedNote: Highlighting note: M${measureIndex}, C${clef}, N${noteIndex}`);
    // 1. Clear any *previously selected* note highlight to ensure only one note is selected at a time.
    clearSelectedNoteHighlight();

    // 2. Clear any *active playback* highlight on the *target note itself*, if it exists,
    // to ensure the orange selection always takes visual precedence over playback.
    if (currentPlaybackNote && 
        currentPlaybackNote.measureIndex === measureIndex &&
        currentPlaybackNote.clef === clef &&
        currentPlaybackNote.noteIndex === noteIndex) {
        console.log("highlightSelectedNote: Clearing conflicting playback highlight for target note.");
        clearPlaybackHighlight(); // This action will reset the playback note's color to its appropriate background.
    }

    currentSelectedNote = { measureIndex, clef, noteIndex }; // Update the tracking variable for the currently selected note.
    
    // Convert the linear note index to the VexFlow-internal index to style the VexFlow object.
    const vexflowIndex = convertLinearIndexToVexFlowIndex(measureIndex, clef, noteIndex);
    if (vexflowIndex === -1) {
        console.warn(`highlightSelectedNote: Cannot highlight note: VexFlow index not found for measure ${measureIndex}, clef ${clef}, linear noteIndex ${noteIndex}.`);
        return;
    }
    
    const selectionStyle = {
        fillStyle: '#ff6b35', // Orange color for selection
        strokeStyle: '#ff6b35', // Orange stroke
        shadowColor: null,    // No shadow for selection highlight
        shadowBlur: 0
    };
    
    // Apply the selection style directly to the VexFlow note.
    setVexFlowNoteStyle(measureIndex, clef, vexflowIndex, selectionStyle);
}

/**
 * Clears the currently selected individual note highlight.
 * It restores the note's style to black by default, or to the measure highlight color (green) if its containing measure is also selected.
 */
export function clearSelectedNoteHighlight() {
    console.log("clearSelectedNoteHighlight: Clearing selected note highlight.");
    if (!currentSelectedNote) {
        console.log("clearSelectedNoteHighlight: No note currently selected to clear.");
        return; // No note is currently selected, so nothing to clear.
    }
    
    const { measureIndex, clef, noteIndex } = currentSelectedNote; // Get details of the note to be cleared.
    
    // Convert to VexFlow index to target the specific VexFlow note object.
    const vexflowIndex = convertLinearIndexToVexFlowIndex(measureIndex, clef, noteIndex);
    if (vexflowIndex !== -1) {
        let styleToRestore;
        // Determine the appropriate style to restore based on current highlighting state layering:
        if (measureIndex === currentSelectedMeasure) {
            // If the note's measure is still selected, restore the note to the measure highlight color (green).
            styleToRestore = {
                fillStyle: '#1db954', // Green (measure highlight color)
                strokeStyle: '#1db954',
                shadowColor: null,
                shadowBlur: 0
            };
            console.log(`clearSelectedNoteHighlight: Restoring note to measure highlight color.`);
        } else {
            // Otherwise, restore the note to its default black color.
            styleToRestore = {
                fillStyle: '#000000', // Black (default note color)
                strokeStyle: '#000000',
                shadowColor: null,
                shadowBlur: 0
            };
            console.log(`clearSelectedNoteHighlight: Restoring note to default black color.`);
        }
        
        // Apply the determined style to the VexFlow note.
        setVexFlowNoteStyle(measureIndex, clef, vexflowIndex, styleToRestore);
    }
    
    currentSelectedNote = null; // Clear the tracking variable, indicating no note is now individually selected.
}

// ===================================================================
// MEASURE HIGHLIGHTING
// ===================================================================
export function highlightSelectedMeasure(measureIndex) {
    console.log("highlightSelectedMeasure: Highlighting measure", measureIndex);
    // Basic validation for the measure index.
    if (measureIndex < 0 || measureIndex >= vexflowNoteMap.length) {
        console.warn(`highlightSelectedMeasure: Invalid measure index: ${measureIndex}.`);
        return;
    }
    
    // CRITICAL: Always clear the previous measure highlight. This ensures:
    // 1. That only one measure is highlighted at a time.
    // 2. Correct re-drawing/re-application of the highlight after a full score redraw (`drawAll` calls this).
    // 3. The correct removal of the old overlay and notes styling.
    clearMeasureHighlight(); 
    
    currentSelectedMeasure = measureIndex; // Update the global tracking variable for the newly selected measure.
    
    // Add the DOM overlay that provides the background highlight for the measure.
    addMeasureHighlightOverlay(measureIndex);
    
    // Iterate through all notes in the selected measure and apply the green highlight style.
    const measureNotes = getMeasures()[measureIndex] || [];
    measureNotes.forEach((noteData, linearIndex) => {
        // Convert to VexFlow index to target the specific note.
        const vexflowIndex = convertLinearIndexToVexFlowIndex(measureIndex, noteData.clef, linearIndex);
        if (vexflowIndex === -1) {
            console.warn(`highlightSelectedMeasure: VexFlow index not found for note at M${measureIndex}, L${linearIndex}. Skipping note highlight in measure.`);
            return;
        }
        
        const measureStyle = {
            fillStyle: '#1db954', // Green color for measure highlight
            strokeStyle: '#1db954', // Green stroke
            shadowColor: null,
            shadowBlur: 0
        };
        
        setVexFlowNoteStyle(measureIndex, noteData.clef, vexflowIndex, measureStyle);
    });

    // If there is an *individual note currently selected* that falls within this *newly highlighted measure*,
    // re-apply its specific (orange) highlight. This ensures that the orange individual note selection
    // visually overrides the green measure highlight on that particular note.
    if (currentSelectedNote && currentSelectedNote.measureIndex === measureIndex) {
        console.log(`highlightSelectedMeasure: Re-applying selected note highlight within newly highlighted measure.`);
        highlightSelectedNote(currentSelectedNote.measureIndex, currentSelectedNote.clef, currentSelectedNote.noteIndex);
    }
}

/**
 * Clears the currently highlighted measure.
 * This involves removing its transparent DOM overlay and restoring all notes within that measure
 * to their default black color, while correctly preserving any active individual note selection highlight.
 */
export function clearMeasureHighlight() {
    console.log("clearMeasureHighlight: Clearing measure highlight.");
    if (currentSelectedMeasure === -1) {
        console.log("clearMeasureHighlight: No measure currently selected to clear.");
        return; // No measure is currently selected, so nothing to clear.
    }
    
    // Remove the DOM overlay associated with the previously selected measure.
    const existingOverlay = document.querySelector('[id^="measure-highlight-"]');
    if (existingOverlay) {
        existingOverlay.remove();
        console.log(`clearMeasureHighlight: Removed DOM overlay for measure ${currentSelectedMeasure}.`);
    }
    
    // Iterate through all notes in the *previously* selected measure (using `currentSelectedMeasure` before it's reset)
    // and restore them to their default (black) style.
    const previouslySelectedMeasureNotes = getMeasures()[currentSelectedMeasure] || [];
    previouslySelectedMeasureNotes.forEach((noteData, linearIndex) => {
        const vexflowIndex = convertLinearIndexToVexFlowIndex(currentSelectedMeasure, noteData.clef, linearIndex);
        if (vexflowIndex !== -1) {
            const defaultStyle = {
                fillStyle: '#000000', // Black (default note color)
                strokeStyle: '#000000',
                shadowColor: null,
                shadowBlur: 0
            };
            setVexFlowNoteStyle(currentSelectedMeasure, noteData.clef, vexflowIndex, defaultStyle);
        }
    });

    // If there was an individual note selected within the *recently cleared* measure,
    // its orange highlight would have been overridden by the black restoration above.
    // We need to re-apply its orange highlight to ensure visual continuity.
    if (currentSelectedNote && currentSelectedNote.measureIndex === currentSelectedMeasure) {
        console.log(`clearMeasureHighlight: Re-applying selected note highlight after measure clear.`);
        highlightSelectedNote(currentSelectedNote.measureIndex, currentSelectedNote.clef, currentSelectedNote.noteIndex);
    }
    
    currentSelectedMeasure = -1; // Reset the tracking variable after processing
}

/**
 * Adds a transparent DOM overlay to create a background highlight for the specified measure.
 * This overlay is positioned absolutely behind the VexFlow canvas elements.
 * @param {number} measureIndex - The index of the measure to add the overlay to.
 */
function addMeasureHighlightOverlay(measureIndex) {
    const scoreElement = document.getElementById('score');
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
        console.log(`addMeasureHighlightOverlay: Removed existing overlay with ID ${overlayId}.`);
    }

    const overlay = document.createElement('div');
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
    scoreElement.style.position = 'relative';
    scoreElement.appendChild(overlay);
    console.log(`addMeasureHighlightOverlay: Added overlay for measure ${measureIndex}.`);
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
 * @param {number} noteIndex - The linear index of the note within its measure's data array.
 * @param {string} color - The color for the playback highlight (e.g., '#FFD700' for gold).
 */
export function addPlaybackHighlight(measureIndex, clef, noteIndex, color) {
    console.log(`addPlaybackHighlight: Highlighting playback note: M${measureIndex}, C${clef}, N${noteIndex}`);
    // 1. Clear any existing playback highlight first to ensure only one note is highlighted for playback at a time.
    clearPlaybackHighlight();
    
    currentPlaybackNote = { measureIndex, clef, noteIndex }; // Update the tracking variable for the active playback note.

    // Convert to VexFlow index to target the specific VexFlow note object.
    const vexflowIndex = convertLinearIndexToVexFlowIndex(measureIndex, clef, noteIndex);
    if (vexflowIndex === -1) {
        console.warn(`addPlaybackHighlight: Cannot add playback highlight: VexFlow index not found for measure ${measureIndex}, clef ${clef}, linear noteIndex ${noteIndex}.`);
        return;
    }

    const playbackStyle = {
        fillStyle: color,      // The specified playback color
        strokeStyle: color,    // Matching stroke color
        shadowColor: color,    // Playback often has a shadow/glow effect
        shadowBlur: 15,        // Blur radius for the shadow
    };

    setVexFlowNoteStyle(measureIndex, clef, vexflowIndex, playbackStyle);

    // IMPORTANT: If the playback note is *also* the currently selected individual note,
    // we need to re-apply the orange selection highlight immediately after.
    // This ensures that the orange selection color visually overrides the playback color.
    if (currentSelectedNote && 
        currentSelectedNote.measureIndex === measureIndex &&
        currentSelectedNote.clef === clef &&
        currentSelectedNote.noteIndex === noteIndex) {
        console.log("addPlaybackHighlight: Playback note is also selected. Re-applying selection highlight to override playback.");
        highlightSelectedNote(measureIndex, clef, noteIndex); // Calls highlightSelectedNote to re-apply orange.
    }
}

/**
 * Removes the playback highlight from the currently played note.
 * It restores the note's style based on existing highlights: to orange if selected, green if its measure is selected, or black by default.
 */
export function clearPlaybackHighlight() {
    console.log("clearPlaybackHighlight: Clearing playback highlight.");
    if (!currentPlaybackNote) {
        console.log("clearPlaybackHighlight: No playback note currently active to clear.");
        return; // No playback note is currently active.
    }

    const { measureIndex, clef, noteIndex } = currentPlaybackNote; // Get details of the playback note to clear.
    const vexflowIndex = convertLinearIndexToVexFlowIndex(measureIndex, clef, noteIndex);

    if (vexflowIndex !== -1) {
        let styleToRestore;

        // Determine the correct style to restore based on the highlighting precedence:
        // 1. Is it the currently selected individual note? (Orange takes highest precedence)
        if (currentSelectedNote && 
            currentSelectedNote.measureIndex === measureIndex &&
            currentSelectedNote.clef === clef &&
            currentSelectedNote.noteIndex === noteIndex) {
            styleToRestore = {
                fillStyle: '#ff6b35', // Orange (selected note color)
                strokeStyle: '#ff6b35',
                shadowColor: null,
                shadowBlur: 0
            };
            console.log(`clearPlaybackHighlight: Restoring note to selected note color.`);
        } 
        // 2. Is its containing measure currently selected? (Green takes next precedence)
        else if (measureIndex === currentSelectedMeasure) {
            styleToRestore = {
                fillStyle: '#1db954', // Green (measure highlight color)
                strokeStyle: '#1db954',
                shadowColor: null,
                shadowBlur: 0
            };
            console.log(`clearPlaybackHighlight: Restoring note to measure highlight color.`);
        } 
        // 3. Otherwise, restore to default black (lowest precedence).
        else {
            styleToRestore = {
                fillStyle: '#000000', // Black (default note color)
                strokeStyle: '#000000',
                shadowColor: null,
                shadowBlur: 0
            };
            console.log(`clearPlaybackHighlight: Restoring note to default black color.`);
        }
        
        setVexFlowNoteStyle(measureIndex, clef, vexflowIndex, styleToRestore);
    }
    currentPlaybackNote = null; // Clear the tracking variable for the playback note.
}

/**
 * Clears all currently active playback highlights. (This currently just calls `clearPlaybackHighlight`
 * which handles the single active playback note).
 */
export function clearAllHighlights() {
    console.log("clearAllHighlights: Request to clear all playback highlights.");
    clearPlaybackHighlight(); // Effectively clears the single currently active playback highlight.
}

// ===================================================================
// UTILITY & HELPER FUNCTIONS
// ===================================================================

/**
 * Fully resets all highlights and selections to their default state.
 * This function is called when the score is reset or needs a clean slate.
 */
export function resetAllNoteStyles() {
    console.log("resetAllNoteStyles: Resetting all highlighting states.");
    // Call clearing functions in a specific order (from highest to lowest visual priority)
    // to ensure correct state transitions for notes that might have multiple highlights.
    clearSelectedNoteHighlight(); // Clears note selection and restores to black/measure color.
    clearMeasureHighlight();      // Clears measure highlight and its overlay, restoring notes to black/selection.
    clearPlaybackHighlight();     // Clears playback highlight, restoring to black/selection/measure color.

    // Ensure all internal tracking variables are explicitly reset to their initial state.
    currentSelectedNote = null;
    currentSelectedMeasure = -1;
    currentPlaybackNote = null;

    console.log('resetAllNoteStyles output: All note styles and highlights reset successfully.');
}

/**
 * Consolidated function for applying styles to a VexFlow note non-destructively.
 * This function interacts directly with the VexFlow note object and its rendering context.
 * @param {number} measureIndex
 * @param {string} clef
 * @param {number} vexflowNoteIndex - The VexFlow-internal index of the note.
 * @param {object} style - The VexFlow style object { fillStyle, strokeStyle, shadowColor, shadowBlur }.
 */function setVexFlowNoteStyle(measureIndex, clef, noteIndex, style) {
    const note = vexflowNoteMap[measureIndex]?.[clef]?.[noteIndex];
    if (!note) {
        console.warn(`Note not found at ${measureIndex}-${clef}-${noteIndex}. Cannot set style.`);
        return;
    }

    const context = note.getContext();
    try {
        note.setStyle(style); // This sets fillStyle and strokeStyle on the note itself
        
        // These lines are crucial: They set the shadow properties on the canvas context.
        context.shadowColor = style.shadowColor || null;
        context.shadowBlur = style.shadowBlur || 0;
        
        note.drawWithStyle(); // This tells VexFlow to redraw *this specific note* using the current context settings.
        
        // These lines immediately reset the context properties, but crucially,
        // they do so *after* note.drawWithStyle() has already performed its drawing operation.
        context.shadowColor = null;
        context.shadowBlur = 0;
    } catch (e) {
        console.error("Error applying note style:", e);
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
    const measuresData = getMeasures(); // Get the most up-to-date data model

    // 1. Try to find if an actual *existing* note (from measuresData) was clicked.
    // Iterate through your measuresData to find existing notes and check their VexFlow bounding boxes.
    for (let measureIndex = 0; measureIndex < measuresData.length; measureIndex++) {
        const currentMeasureData = measuresData[measureIndex] || [];

        for (let linearIndex = 0; linearIndex < currentMeasureData.length; linearIndex++) {
            const noteData = currentMeasureData[linearIndex];
            const clef = noteData.clef;

            // Get the corresponding VexFlow note for this linear data note.
            // This ensures we only check bounding boxes for notes that explicitly exist in your data model.
            const vexflowNoteIndex = convertLinearIndexToVexFlowIndex(measureIndex, clef, linearIndex);
            
            if (vexflowNoteIndex !== -1 && vexflowNoteMap[measureIndex]?.[clef]?.[vexflowNoteIndex]) {
                const vexflowNote = vexflowNoteMap[measureIndex][clef][vexflowNoteIndex];
                const bbox = vexflowNote.getBoundingBox();

                if (bbox && x >= bbox.x && x <= bbox.x + bbox.w && y >= bbox.y && y <= bbox.y + bbox.h) {
                    // Success: This click is on an *existing* note in your data model.
                    console.log('detectNoteClick: Existing note found and mapped:', { measureIndex, clef, noteIndex: linearIndex, originalNoteData: noteData, vexflowIndex: vexflowNoteIndex });
                    return { 
                        measureIndex: measureIndex, 
                        clef: clef, 
                        noteIndex: linearIndex, // This is the correct LINEAR index for musicEditorUI.js
                        originalNoteData: noteData, 
                        vexflowIndex: vexflowNoteIndex // The VexFlow index of the clicked visual element
                    };
                }
            }
        }
    }

    // 2. If no *existing* note was clicked, check if a general measure background was clicked.
    // This restores the "click empty area to select measure" functionality.
    const clickedMeasureIndex = detectMeasureClick(x, y);

    if (clickedMeasureIndex !== -1) {
        // A measure background was clicked (not an explicit note).
        // Determine the clef region to provide context if a new note were to be added here.
        const clefRegion = detectClefRegion(y); 
        console.log(`detectNoteClick: Clicked on Measure Background: Measure ${clickedMeasureIndex}, Clef Region ${clefRegion}.`);
        
        return { 
            measureIndex: clickedMeasureIndex, 
            clef: clefRegion, // Provide the clef context
            noteIndex: -1, // Indicates no existing linear note was clicked.
            originalNoteData: null, 
            vexflowIndex: -1 // No specific VexFlow index for a general background click.
        };
    }

    // 3. If neither an existing note nor a measure background was clicked, return null.
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
    const scoreTopY = 20;    // Approximate top Y coordinate of the overall score area (where staves begin).
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

console.log("✓ scoreRenderer.js loaded successfully");