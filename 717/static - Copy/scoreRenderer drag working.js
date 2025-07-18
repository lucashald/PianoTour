
// scoreRenderer.js
// This module handles rendering the musical score using VexFlow.

// ===================================================================
// Imports
// ===================================================================

// VexFlow is expected to be globally available via CDN in the HTML

// ===================================================================
// Global Variables
// ===================================================================

// Store references to VexFlow notes - array of measures, each containing an array of note objects
let vexflowNoteMap = [];
// Store the X position of each measure for scrolling
let measureXPositions = []; 
// Store references to VexFlow Stave objects
let vexflowStaveMap = []; 
// Store the VexFlow rendering context
let vfContext = null; 
// Store the VexFlow Factory instance
let vexFlowFactory = null; 

let highlightedNotes = new Set(); // Stores noteKeys like "0-treble-0"
// Store original note styles for restoration
let originalNoteStyles = new Map(); // Stores original {fillStyle, strokeStyle} for noteKeys

// NEW: Variables for selected measure/note highlighting
let currentSelectedMeasure = -1; //
let currentSelectedNote = null; // Stores {measureIndex, clef, noteIndex} for the currently selected note (orange)
let notesHighlightedInMeasure = new Set(); // Stores noteKeys for notes highlighted in green (all notes in selected measure)

// Variables for drag and drop
let draggedNote = null;
let dragStartPosition = null;
let isDragging = false; // Flag to indicate if a drag operation is actively happening
let notesHighlightedForPlayback = new Set(); // Stores noteKeys for notes highlighted during playback

// ===================================================================
// Core Rendering Functions
// ===================================================================

/**
 * Renders the musical score using VexFlow.
 * This function will now be careful not to interfere with individual note styles directly
 * unless it's a full redraw.
 * @param {Array} measures - The array of measures to render.
 */


export function drawAll(measures) {
    console.log('drawAll input: measures =', measures);
    const scoreWrap = document.getElementById('scoreWrap');
    const out = document.getElementById('score');
    if (!scoreWrap || !out) {
        console.error("Score rendering elements #scoreWrap or #score not found!");
        return;
    }

    // Clear previous rendering state
    out.innerHTML = ''; // Clear the canvas DOM element
    // Do NOT clear vexflowNoteMap, measureXPositions, vexflowStaveMap here completely
    // if we intend to reuse references for individual note drawing.
    // Instead, rely on the factory's render process to update these.
    vexflowNoteMap = []; // This will be rebuilt by EasyScore/Factory.draw()
    measureXPositions = []; // This will be rebuilt
    vexflowStaveMap = []; // This will be rebuilt

    // Reset highlighting state (the actual visual clearing happens after draw)
    highlightedNotes.clear();
    originalNoteStyles.clear();
    notesHighlightedInMeasure.clear(); // Clear measure highlight tracking

    // Keep currentSelectedMeasure and currentSelectedNote to restore after redraw
    const measureToRestoreHighlight = currentSelectedMeasure;
    const noteToRestoreHighlight = currentSelectedNote;

    const measureWidth = 340;
    const measureCount = measures.length > 0 ? measures.length : 1;

    if (typeof Vex === 'undefined' || !Vex.Flow) {
        console.error("VexFlow library not loaded. Cannot render score.");
        return;
    }

    try {
        vexFlowFactory = new Vex.Flow.Factory({ 
            renderer: { 
                elementId: 'score', 
                width: measureWidth * measureCount + 20, 
                height: 300 
            } 
        });
        vfContext = vexFlowFactory.getContext();
        const score = vexFlowFactory.EasyScore();
        let currentX = 20;

        // Render each measure
        for (let i = 0; i < measureCount; i++) {
            measureXPositions.push(currentX);
            
            const measure = measures[i] || [];
            const trebleNotesData = measure.filter(n => n.clef === 'treble');
            const bassNotesData = measure.filter(n => n.clef === 'bass');

            // Initialize storage for this measure
            vexflowNoteMap[i] = { treble: [], bass: [] };
            vexflowStaveMap[i] = {};

            // Create treble clef notes
            const trebleSpec = trebleNotesData.length
                ? trebleNotesData.map(n => (n.isRest ? `${n.name}/${n.duration}/r` : `${n.name}/${n.duration}`)).join(', ')
                : 'B4/1/r';

            const trebleVexNotes = score.notes(trebleSpec, { clef: 'treble' });
            vexflowNoteMap[i].treble = trebleVexNotes;

            const trebleVoice = score.voice(trebleVexNotes);
            trebleVoice.setStrict(false);

            // Create bass clef notes
            const bassSpec = bassNotesData.length
                ? bassNotesData.map(n => (n.isRest ? `${n.name}/${n.duration}/r` : `${n.name}/${n.duration}`)).join(', ')
                : 'D3/1/r';

            const bassVexNotes = score.notes(bassSpec, { clef: 'bass' });
            vexflowNoteMap[i].bass = bassVexNotes;

            const bassVoice = score.voice(bassVexNotes);
            bassVoice.setStrict(false);

            // Create the system (staff system)
            const system = vexFlowFactory.System({ 
                x: currentX, 
                y: 20, 
                width: measureWidth, 
                spaceBetweenStaves: 10 
            });
            
            try {
                const staveTreble = system.addStave({ voices: [trebleVoice] });
                const staveBass = system.addStave({ voices: [bassVoice] });

                vexflowStaveMap[i].treble = staveTreble;
                vexflowStaveMap[i].bass = staveBass;

                // Add clefs and time signatures to first measure
                if (i === 0) {
                    staveTreble.addClef('treble').addTimeSignature('4/4');
                    staveBass.addClef('bass').addTimeSignature('4/4');
                    system.addConnector().setType(Vex.Flow.StaveConnector.type.BRACE);
                    system.addConnector().setType(Vex.Flow.StaveConnector.type.SINGLE_LEFT);
                }
                
                // Add end barline to last measure
                if (i === measureCount - 1) {
                    system.addConnector().setType(Vex.Flow.StaveConnector.type.BOLD_DOUBLE_RIGHT);
                }
                
                currentX += measureWidth;
            } catch (e) {
                console.error(`VexFlow rendering error in measure ${i}:`, e);
                console.error("Treble spec:", trebleSpec);
                console.error("Bass spec:", bassSpec);
            }
        }
        
        // Draw the complete score
        vexFlowFactory.draw();
        
        // Store original styles for all notes (must be done AFTER draw, as style objects are populated then)
        storeOriginalStyles();
        
        // Scroll to the end by default
        if (scoreWrap) scoreWrap.scrollLeft = scoreWrap.scrollWidth;

        // Restore highlights after full redraw
        // This is crucial because drawAll clears everything.
        // The measure background (black box)
        if (measureToRestoreHighlight !== -1) {
             addMeasureHighlightOverlay(measureToRestoreHighlight);
        }
        // The notes within the highlighted measure (green)
        if (measureToRestoreHighlight !== -1 && vexflowNoteMap[measureToRestoreHighlight]) {
            const notesInMeasure = [];
            if (vexflowNoteMap[measureToRestoreHighlight].treble) {
                notesInMeasure.push(...vexflowNoteMap[measureToRestoreHighlight].treble.map((note, idx) => ({ note, clef: 'treble', noteIndex: idx })));
            }
            if (vexflowNoteMap[measureToRestoreHighlight].bass) {
                notesInMeasure.push(...vexflowNoteMap[measureToRestoreHighlight].bass.map((note, idx) => ({ note, clef: 'bass', noteIndex: idx })));
            }

            notesInMeasure.forEach(({ note, clef, noteIndex }) => {
                // To apply the highlight, we need the measureIndex from musicEditorUI's perspective.
                // We don't have the original `measure[originalIndex]` here, so we apply based on vexflowNoteMap's indices.
                // The `addHighlight` needs the measureIndex, clef, and *its* noteIndex (which is the vexflow internal one).
                addHighlight(measureToRestoreHighlight, clef, noteIndex, '#1db954', false); // Apply green, but don't re-track in highlightNotesSet
            });
        }
        // The single selected note (orange)
        if (noteToRestoreHighlight) {
            highlightSelectedNote(noteToRestoreHighlight.measureIndex, noteToRestoreHighlight.clef, noteToRestoreHighlight.noteIndex);
        }
        
    } catch (e) {
        console.error("VexFlow initialization or rendering error:", e);
        alert("An error occurred while drawing the score. It might be corrupted.");
    }
    console.log('drawAll output: score rendered');
}

/**
 * Enables click interaction on the score canvas to detect measure and note clicks.
 * Now primarily uses 'mousedown' for selection to avoid 'click' event complexities.
 * @param {function} onMeasureClick - Callback for a measure click: function(measureIndex, wasNoteClicked).
 * @param {function} onNoteClick - Callback for a note click: function(measureIndex, clef, noteIndex).
 */
export function detectMeasureClick(x, y) { // ADDED 'export'
    console.log('detectMeasureClick input: x=', x, 'y=', y);
    // Use measureXPositions to determine which measure was clicked
    for (let i = 0; i < measureXPositions.length; i++) {
        const measureX = measureXPositions[i];
        const measureWidth = 340;
        // Assuming measure height is constant, approximately 260px (20 to 280) based on addMeasureHighlightOverlay
        const measureYTop = 20; // Based on VexFlow System Y position
        const measureYBottom = measureYTop + 260; // Based on height in addMeasureHighlightOverlay

        if (x >= measureX && x <= measureX + measureWidth && y >= measureYTop && y <= measureYBottom) {
            console.log('detectMeasureClick output:', i);
            return i;
        }
    }
    console.log('detectMeasureClick output: -1');
    return -1;
}
export function enableScoreInteraction(onMeasureClick, onNoteClick) {
    console.log('enableScoreInteraction called'); //
    const scoreElement = document.getElementById('score'); //
    if (!scoreElement) return; //

    scoreElement.addEventListener('mousedown', (event) => { //
        console.log('Score element mousedown event. Event:', event); //
        isDragging = false; //

        const rect = scoreElement.getBoundingClientRect(); //
        const x = event.clientX - rect.left; //
        const y = event.clientY - rect.top; //
        console.log(`Mousedown coordinates: x=${x}, y=${y}`); //
                
        const noteInfo = detectNoteClick(x, y); //
        if (noteInfo) { //
            console.log(`Detected mousedown on note: Measure ${noteInfo.measureIndex}, Clef ${noteInfo.clef}, Note Index ${noteInfo.noteIndex}`); //
            
            // --- ADD THESE TWO LINES TO ENABLE DRAG INITIATION ---
            draggedNote = noteInfo; //
            dragStartPosition = { x: event.offsetX, y: event.offsetY }; //
            // ----------------------------------------------------

            onNoteClick(noteInfo.measureIndex, noteInfo.clef, noteInfo.noteIndex); //
            onMeasureClick(noteInfo.measureIndex, true); // Pass true for wasNoteClicked
            console.log('enableScoreInteraction output: note mousedown processed, returning.'); //
            // The `return` here is still fine, as the `mousemove` listener for drag will then pick it up.
            return; //
        }

        const measureIndex = detectMeasureClick(x, y); //
        if (measureIndex !== -1) { //
            console.log(`Detected mousedown on measure: ${measureIndex}`); //
            onMeasureClick(measureIndex, false); // Pass false for wasNoteClicked
            console.log('enableScoreInteraction output: measure mousedown processed.'); //
        } else { // This 'else' block's closing brace was missing in your provided snippet.
            console.log('enableScoreInteraction output: no note or measure mousedown detected.'); //
        }
    }); // This closes the 'mousedown' event listener function.

    // Remove the 'click' event listener to prevent double-firing selection
    // The selection logic is now handled by 'mousedown'.
    // If there was an old 'click' listener, make sure it's removed or inactive.
    // We are now only relying on the 'mousedown' listener for initiating selection.
    // The drag/drop 'mouseup' listener will finalize drag or do nothing if no drag.
    // It should NOT re-trigger selection logic.
}
/**
 * Detects which note was clicked based on X, Y coordinates.
 * @param {number} x - X coordinate relative to the score element.
 * @param {number} y - Y coordinate relative to the score element.
 * @returns {object|null} An object { measureIndex, clef, noteIndex } if a note was clicked, otherwise null.
 */
export function detectNoteClick(x, y) {
    console.log('detectNoteClick input: x=', x, 'y=', y);
    // Iterate through all notes to find which one was clicked
    for (let measureIndex = 0; measureIndex < vexflowNoteMap.length; measureIndex++) {
        const measure = vexflowNoteMap[measureIndex];
                
        for (const clef of ['treble', 'bass']) {
            if (measure[clef]) {
                for (let noteIndex = 0; noteIndex < measure[clef].length; noteIndex++) {
                    const vexNote = measure[clef][noteIndex];
                    try {
                        const bbox = vexNote.getBoundingBox();
                        // Log the bbox values for debugging
                        // console.log(`Checking note ${measureIndex}-${clef}-${noteIndex}. BBox:`, bbox, `Click: x=${x}, y=${y}`);

                        // CORRECTED LINE: y <= bbox.y + bbox.h
                        if (bbox && x >= bbox.x && x <= bbox.x + bbox.w && y >= bbox.y && y <= bbox.y + bbox.h) {
                            console.log('detectNoteClick output: Note found!', { measureIndex, clef, noteIndex });
                            return { measureIndex, clef, noteIndex };
                        }
                    } catch (e) {
                        console.warn(`Could not get bounding box for note at measure ${measureIndex}, clef ${clef}, index ${noteIndex}:`, e);
                        // Some notes might not have bounding boxes
                        continue;
                    }
                }
            }
        }
    }
    console.log('detectNoteClick output: null');
    return null;
}

/**
 * Enables drag and drop functionality for notes on the score.
 * This now works in conjunction with the 'mousedown' selection.
 */
export function enableNoteDragDrop() {
    console.log('enableNoteDragDrop called');
    const scoreElement = document.getElementById('score');
    if (!scoreElement) return;

    // The 'mousedown' listener for drag initiation is in enableScoreInteraction.
    // The draggedNote and dragStartPosition are set there if a note is clicked.

    scoreElement.addEventListener('mousemove', (event) => {
        if (draggedNote) {
            const dx = event.offsetX - dragStartPosition.x;
            const dy = event.offsetY - dragStartPosition.y;
                        
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) { // Threshold for drag start
                isDragging = true; // Mark that a drag has started
                scoreElement.style.cursor = 'grabbing';
            }
        }
    });
        
    scoreElement.addEventListener('mouseup', (event) => {
        if (draggedNote) {
            console.log('scoreElement mouseup event. Event:', event);
            removeHighlightOverlay(draggedNote.measureIndex, draggedNote.clef, draggedNote.noteIndex); // Remove drag highlight
            
            if (isDragging) { // Only process as a drop if a drag actually happened
                const dropTargetMeasureIndex = detectMeasureClick(event.offsetX, event.offsetY);
                
                // Check if the drop was valid (on a different measure)
                if (dropTargetMeasureIndex !== -1 && dropTargetMeasureIndex !== draggedNote.measureIndex) {
                    console.log(`Note dropped. From Measure: ${draggedNote.measureIndex}, Note Index: ${draggedNote.noteIndex}, To Measure: ${dropTargetMeasureIndex}`);
                    const noteDropEvent = new CustomEvent('noteDropped', {
                        detail: {
                            fromMeasureIndex: draggedNote.measureIndex,
                            clef: draggedNote.clef, // Include clef for accurate identification
                            noteIndex: draggedNote.noteIndex,
                            toMeasureIndex: dropTargetMeasureIndex
                        }
                    });
                    document.dispatchEvent(noteDropEvent);
                } else {
                    console.log('Note dropped at invalid target or same measure.');
                }
            } else {
                // If it was just a simple click (no drag), the 'mousedown' handler already processed selection.
                // Do nothing here for selection, as it was handled on mousedown.
                console.log('Mouseup without drag detected. Mousedown handler already processed selection.');
            }
                        
            draggedNote = null;
            dragStartPosition = null;
            isDragging = false; // Reset drag flag
            scoreElement.style.cursor = 'default';
        }
        console.log('enableNoteDragDrop output: drag ended');
    });

    // Handle mouseleave/mouseup on document to cancel drag if mouse goes off score
    document.addEventListener('mouseup', (event) => {
        if (draggedNote && isDragging) {
            console.log('Document mouseup: Cancelling drag as cursor left score area.');
            removeHighlightOverlay(draggedNote.measureIndex, draggedNote.clef, draggedNote.noteIndex);
            draggedNote = null;
            dragStartPosition = null;
            isDragging = false;
            scoreElement.style.cursor = 'default';
        }
    });
}

// ===================================================================
// Style Management Functions (Updated for drawWithStyle)
// ===================================================================

/**
 * Store original styles for all notes so they can be restored later
 * This now uses the actual VexFlow note objects after draw.
 */
function storeOriginalStyles() {
    console.log('storeOriginalStyles called');
    vexflowNoteMap.forEach((measure, measureIndex) => {
        ['treble', 'bass'].forEach(clef => {
            if (measure[clef]) {
                measure[clef].forEach((note, noteIndex) => {
                    const noteKey = `${measureIndex}-${clef}-${noteIndex}`;
                    // Store current style or default style
                    originalNoteStyles.set(noteKey, {
                        fillStyle: note.getStyle()?.fillStyle || '#000000', // Use getStyle()
                        strokeStyle: note.getStyle()?.strokeStyle || '#000000' // Use getStyle()
                    });
                });
            }
        });
    });
    console.log('storeOriginalStyles output: styles stored');
}

/**
 * Non-destructive note styling that doesn't clear the entire score.
 * This now calls note.drawWithStyle() for individual redraw.
 * @param {number} measureIndex - The index of the measure.
 * @param {string} clef - The clef ('treble' or 'bass').
 * @param {number} noteIndexInMeasure - The index of the note within its clef's VexFlow array.
 * @param {object} style - The style object { fillStyle, strokeStyle }.
 */
export function setVexFlowNoteStyleNonDestructive(measureIndex, clef, noteIndexInMeasure, style) {
    console.log('setVexFlowNoteStyleNonDestructive input: measureIndex=', measureIndex, 'clef=', clef, 'noteIndexInMeasure=', noteIndexInMeasure, 'style=', style);
    
    if (vexflowNoteMap[measureIndex] && 
        vexflowNoteMap[measureIndex][clef] && 
        vexflowNoteMap[measureIndex][clef][noteIndexInMeasure]) {
        
        const vexNote = vexflowNoteMap[measureIndex][clef][noteIndexInMeasure];
        
        try {
            vexNote.setStyle(style); // Set the style on the VexFlow note object
            vexNote.drawWithStyle(); // Crucially, redraw only this note
            console.log(`✓ Applied style and drew note ${measureIndex}-${clef}-${noteIndexInMeasure}`);
            
        } catch (e) {
            console.error("Error applying note style:", e);
        }
    } else {
        console.warn(`Note not found at ${measureIndex}-${clef}-${noteIndexInMeasure}. Cannot set style.`);
    }
    console.log('setVexFlowNoteStyleNonDestructive output: style applied or warned');
}

/**
 * Original destructive styling function - kept for compatibility but not recommended during playback.
 * This function will now primarily defer to setVexFlowNoteStyleNonDestructive,
 * and will only perform a full redraw if explicitly requested and necessary.
 */
export function setVexFlowNoteStyle(measureIndex, clef, noteIndexInMeasure, style, redraw = true) {
    console.log('setVexFlowNoteStyle input: measureIndex=', measureIndex, 'clef=', clef, 'noteIndexInMeasure=', noteIndexInMeasure, 'style=', style, 'redraw=', redraw);
    
    if (!redraw) {
        // Use non-destructive version when redraw is false
        setVexFlowNoteStyleNonDestructive(measureIndex, clef, noteIndexInMeasure, style);
        return;
    }
    
    // If redraw is true, we still set style non-destructively, then trigger a full draw.
    // This scenario should be rare, as safeRedraw is preferred.
    setVexFlowNoteStyleNonDestructive(measureIndex, clef, noteIndexInMeasure, style);
    
    // Only perform a full redraw if necessary (e.g., if a note's properties change significantly, not just style)
    // For simple style changes, drawWithStyle is sufficient.
    // The previous logic for clearing innerHTML and vfContext.clear() and vexFlowFactory.draw()
    // is essentially what drawAll() does. So, for full redraw, call safeRedraw() or drawAll().
    console.warn("setVexFlowNoteStyle called with redraw=true. Prefer safeRedraw() for full redraws.");
    safeRedraw(); // This will handle full redraw and re-apply highlights
    
    console.log('setVexFlowNoteStyle output: style applied and potentially redrawn');
}

// ===================================================================
// Improved Highlight Functions (Updated to use drawWithStyle)
// ===================================================================

/**
 * Adds a highlight to a specific note without redrawing the entire score.
 * @param {boolean} [trackHighlight=true] - Whether to add this highlight to the `highlightedNotes` set.
 * Set to false for measure-wide highlights that shouldn't be
 * cleared by individual note `removeHighlight` calls.
 */
export function addHighlight(measureIndex, clef, noteIndex, color = '#1db954', trackHighlight = true) {
    console.log('addHighlight input: measureIndex=', measureIndex, 'clef=', clef, 'noteIndex=', noteIndex, 'color=', color, 'trackHighlight=', trackHighlight);
    const noteKey = `${measureIndex}-${clef}-${noteIndex}`;
    
    // Avoid redundant highlights
    if (trackHighlight && notesHighlightedForPlayback.has(noteKey)) { // Using notesHighlightedForPlayback as general tracker
        console.log(`addHighlight: Note ${noteKey} already in general highlightedNotes set. Skipping.`);
        return;
    }
    if (!trackHighlight && notesHighlightedInMeasure.has(noteKey)) { // For measure-wide notes
         console.log(`addHighlight: Note ${noteKey} already in measure-highlightedNotes set. Skipping.`);
         return;
    }
    
    if (trackHighlight) {
        notesHighlightedForPlayback.add(noteKey); // Use this for general/playback highlights
    } else {
        notesHighlightedInMeasure.add(noteKey); // Use this for measure-wide highlights
    }
    
    // Use non-destructive styling
    setVexFlowNoteStyleNonDestructive(measureIndex, clef, noteIndex, {
        fillStyle: color,
        strokeStyle: color
    });
    console.log('addHighlight output: highlight added or skipped');
}

/**
 * Removes a highlight from a specific note without redrawing the entire score.
 */
export function removeHighlight(measureIndex, clef, noteIndex) {
    console.log('removeHighlight input: measureIndex=', measureIndex, 'clef=', clef, 'noteIndex=', noteIndex);
    const noteKey = `${measureIndex}-${clef}-${noteIndex}`;
    
    // Only remove if it was highlighted by the general system or measure system
    let wasHighlighted = false;
    if (notesHighlightedForPlayback.has(noteKey)) {
        notesHighlightedForPlayback.delete(noteKey);
        wasHighlighted = true;
    }
    if (notesHighlightedInMeasure.has(noteKey)) {
        notesHighlightedInMeasure.delete(noteKey);
        wasHighlighted = true;
    }

    if (wasHighlighted) {
        // Restore original style
        const originalStyle = originalNoteStyles.get(noteKey) || {
            fillStyle: '#000000',
            strokeStyle: '#000000'
        };
        
        setVexFlowNoteStyleNonDestructive(measureIndex, clef, noteIndex, originalStyle);
        console.log('removeHighlight output: highlight removed and original style restored.');
    } else {
        console.log('removeHighlight output: note was not highlighted. Skipping.');
    }
}

/**
 * Clears all general highlights (notes highlighted via `addHighlight` with `trackHighlight=true`).
 */
export function clearAllHighlights() { // Renamed from clearAllHighlights to clearPlaybackHighlights if using new naming
    console.log('clearAllHighlights (general/playback) called');
    if (notesHighlightedForPlayback.size === 0) {
        console.log('clearAllHighlights: No general/playback highlights to clear.');
        return;
    }
    
    // Clear all highlights by restoring original styles
    notesHighlightedForPlayback.forEach(noteKey => {
        const [measureIndexStr, clef, noteIndexStr] = noteKey.split('-');
        const measureIndex = parseInt(measureIndexStr);
        const noteIndex = parseInt(noteIndexStr);

        const originalStyle = originalNoteStyles.get(noteKey) || {
            fillStyle: '#000000',
            strokeStyle: '#000000'
        };
        
        setVexFlowNoteStyleNonDestructive(measureIndex, clef, noteIndex, originalStyle);
    });
    
    notesHighlightedForPlayback.clear();
    console.log('clearAllHighlights output: all general/playback highlights cleared');
}

/**
 * Clears all notes highlighted as part of a measure selection.
 */
export function clearMeasureNotesHighlights() {
    console.log('clearMeasureNotesHighlights called');
    if (notesHighlightedInMeasure.size === 0) {
        console.log('clearMeasureNotesHighlights: No measure-wide notes highlights to clear.');
        return;
    }

    notesHighlightedInMeasure.forEach(noteKey => {
        const [measureIndexStr, clef, noteIndexStr] = noteKey.split('-');
        const measureIndex = parseInt(measureIndexStr);
        const noteIndex = parseInt(noteIndexStr);

        const originalStyle = originalNoteStyles.get(noteKey) || {
            fillStyle: '#000000',
            strokeStyle: '#000000'
        };
        
        setVexFlowNoteStyleNonDestructive(measureIndex, clef, noteIndex, originalStyle);
    });

    notesHighlightedInMeasure.clear();
    console.log('clearMeasureNotesHighlights output: all measure-wide note highlights cleared');
}


/**
 * Batch highlight multiple notes efficiently without redrawing
 */
export function addMultipleHighlights(highlights) {
    console.log('addMultipleHighlights input: highlights=', highlights);
    highlights.forEach(({measureIndex, clef, noteIndex, color = '#1db954'}) => {
        // Here, we assume these are general highlights, so trackHighlight=true
        addHighlight(measureIndex, clef, noteIndex, color, true);
    });
    console.log('addMultipleHighlights output: multiple highlights added');
}

// ===================================================================
// DOM Overlay Highlighting System (Alternative)
// ===================================================================

// This system is for general DOM overlays (like playback cursors, drag previews)
// NOT for VexFlow note styling, as we are now using VexFlow's native styling.
// However, the measure background "black box" is still a DOM overlay.

let highlightOverlays = new Map(); // Used for general DOM overlays, not note highlights.

/**
 * Creates a visual overlay highlight that doesn't interfere with VexFlow rendering
 * This is now specifically for non-note-based overlays (like drag preview or future cursor)
 */
export function addHighlightOverlay(measureIndex, clef, noteIndex, color = '#1db954') {
    console.log('addHighlightOverlay input: measureIndex=', measureIndex, 'clef=', clef, 'noteIndex=', noteIndex, 'color=', color);
    const overlayId = `highlight-${measureIndex}-${clef}-${noteIndex}`;
    
    // Remove existing overlay if it exists
    removeHighlightOverlay(measureIndex, clef, noteIndex);
    
    // We get the bounding box of the VexFlow note to position the overlay
    if (vexflowNoteMap[measureIndex] && 
        vexflowNoteMap[measureIndex][clef] && 
        vexflowNoteMap[measureIndex][clef][noteIndex]) {
        
        const vexNote = vexflowNoteMap[measureIndex][clef][noteIndex];
        
        try {
            const bbox = vexNote.getBoundingBox();
            
            if (bbox) {
                const overlay = document.createElement('div');
                overlay.id = overlayId;
                overlay.style.cssText = `
                    position: absolute;
                    background-color: ${color};
                    opacity: 0.3;
                    border-radius: 50%;
                    pointer-events: none;
                    z-index: 1000;
                    left: ${bbox.x - 4}px;
                    top: ${bbox.y - 4}px;
                    width: ${bbox.w + 8}px;
                    height: ${bbox.h + 8}px;
                    transition: opacity 0.1s ease;
                `;
                
                const scoreElement = document.getElementById('score');
                scoreElement.style.position = 'relative';
                scoreElement.appendChild(overlay);
                highlightOverlays.set(overlayId, overlay);
                
                console.log(`✓ Added overlay highlight: ${overlayId}`);
            }
            
        } catch (e) {
            console.error("Error creating overlay highlight:", e);
        }
    }
    console.log('addHighlightOverlay output: overlay added or warned');
}

/**
 * Removes a highlight overlay
 */
export function removeHighlightOverlay(measureIndex, clef, noteIndex) {
    console.log('removeHighlightOverlay input: measureIndex=', measureIndex, 'clef=', clef, 'noteIndex=', noteIndex);
    const overlayId = `highlight-${measureIndex}-${clef}-${noteIndex}`;
    
    if (highlightOverlays.has(overlayId)) {
        const overlay = highlightOverlays.get(overlayId);
        overlay.remove();
        highlightOverlays.delete(overlayId);
        console.log(`✓ Removed overlay highlight: ${overlayId}`);
    }
    console.log('removeHighlightOverlay output: overlay removed or skipped');
}

/**
 * Clears all highlight overlays
 */
export function clearAllHighlightOverlays() {
    console.log('clearAllHighlightOverlays called');
    highlightOverlays.forEach(overlay => {
        overlay.remove();
    });
    highlightOverlays.clear();
    console.log('clearAllHighlightOverlays output: all overlays cleared');
}

// ===================================================================
// Playback-Safe Highlighting
// ===================================================================

/**
 * Playback-safe highlighting that uses overlays to avoid score collapse
 * This will now use the general addHighlight and removeHighlight with a specific color.
 */
export function addPlaybackHighlight(measureIndex, clef, noteIndex, color = '#00f') { // Using blue for playback default
    console.log('addPlaybackHighlight input: measureIndex=', measureIndex, 'clef=', clef, 'noteIndex=', noteIndex, 'color=', color);
    // Use the core addHighlight method, tracking it in notesHighlightedForPlayback
    addHighlight(measureIndex, clef, noteIndex, color, true); // trackHighlight is true here
    console.log('addPlaybackHighlight output: playback highlight added');
}

/**
 * Removes playback highlight
 */
export function removePlaybackHighlight(measureIndex, clef, noteIndex) {
    console.log('removePlaybackHighlight input: measureIndex=', measureIndex, 'clef=', clef, 'noteIndex=', noteIndex);
    // Use the core removeHighlight method, it will check the notesHighlightedForPlayback set
    removeHighlight(measureIndex, clef, noteIndex);
    console.log('removePlaybackHighlight output: playback highlight removed');
}

/**
 * Clears all playback highlights
 */
export function clearAllPlaybackHighlights() {
    console.log('clearAllPlaybackHighlights called');
    // Delegate to the new clearAllHighlights that specifically clears notesHighlightedForPlayback
    clearAllHighlights();
    console.log('clearAllPlaybackHighlights output: all playback highlights cleared');
}

// ===================================================================
// Selected Element Highlighting Functions (Updated)
// ===================================================================

/**
 * Highlights the selected measure visually (using the "black box" DOM overlay as decided).
 * @param {number} measureIndex - The index of the measure to highlight.
 */
export function highlightSelectedMeasure(measureIndex) {
    console.log('highlightSelectedMeasure input: measureIndex =', measureIndex);
    // Clear previous measure background highlight
    clearMeasureHighlight();
        
    if (measureIndex >= 0 && measureIndex < vexflowStaveMap.length) {
        currentSelectedMeasure = measureIndex;
        // Apply the "black box" background using the DOM overlay method
        addMeasureHighlightOverlay(measureIndex);
    }
    console.log('highlightSelectedMeasure output: measure highlight applied or cleared');
}

/**
 * Adds a DOM overlay to highlight an entire measure.
 */
function addMeasureHighlightOverlay(measureIndex) {
    console.log('addMeasureHighlightOverlay input: measureIndex =', measureIndex);
    const scoreElement = document.getElementById('score');
    if (!scoreElement) {
        console.warn("Score element #score not found for overlay highlight.");
        console.log('addMeasureHighlightOverlay output: warning and return');
        return;
    }

    // Ensure the scoreElement has position: relative to correctly position absolute children
    if (scoreElement.style.position !== 'relative') {
        scoreElement.style.position = 'relative';
        console.log('addMeasureHighlightOverlay: Set #score position to relative.');
    }

    const overlayId = `measure-highlight-${measureIndex}`;
    // Remove any existing highlight for this measure first to prevent duplicates
    const existingOverlay = document.getElementById(overlayId);
    if (existingOverlay) {
        existingOverlay.remove();
        console.log(`addMeasureHighlightOverlay: Removed existing overlay for measure ${measureIndex}.`);
    }

    const measureX = measureXPositions[measureIndex];
    const measureWidth = 340; // This constant should be consistent with your VexFlow rendering

    const overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.style.cssText = `
        position: absolute;
        left: ${measureX}px;
        top: 20px; /* Aligns with the top of your VexFlow staves */
        width: ${measureWidth}px;
        height: 260px; /* Consistent height to cover both staves, adjust if needed */
        background-color: rgba(0, 0, 0, 0.2); /* Semi-transparent black for the "black box" */
        border: 2px solid black; /* Solid black border */
        pointer-events: none; /* Allows clicks to pass through to the canvas below */
        z-index: 500; /* Ensure it's above the canvas but below other interactive elements if any */
        border-radius: 4px; /* Optional: adds rounded corners */
        box-sizing: border-box; /* Include padding and border in the element's total width and height */
    `;

    scoreElement.appendChild(overlay);
    console.log('addMeasureHighlightOverlay output: DOM overlay added.');
}

/**
 * Clears any active measure highlight.
 */
export function clearMeasureHighlight() {
    console.log('clearMeasureHighlight called');
    const existingHighlight = document.querySelector('[id^="measure-highlight-"]');
    if (existingHighlight) {
        existingHighlight.remove();
        console.log('clearMeasureHighlight output: highlight cleared (DOM element removed).');
    }
    currentSelectedMeasure = -1;
}

/**
 * Highlights the selected note visually using VexFlow's internal styling.
 * This function also applies a `selected` class to the note.
 * @param {number} measureIndex - The index of the measure the note is in.
 * @param {string} clef - The clef of the note ('treble' or 'bass').
 * @param {number} noteIndex - The index of the note within its clef's VexFlow array.
 */
export function highlightSelectedNote(measureIndex, clef, noteIndex) {
    console.log('highlightSelectedNote input: measureIndex=', measureIndex, 'clef=', clef, 'noteIndex=', noteIndex);
    
    // Clear previous specific note highlight
    clearSelectedNoteHighlight();
        
    currentSelectedNote = { measureIndex, clef, noteIndex };
        
    // Apply contrasting highlight color (orange) using the refined styling method
    setVexFlowNoteStyleNonDestructive(measureIndex, clef, noteIndex, {
        fillStyle: '#ff6b35', // Orange
        strokeStyle: '#ff6b35'
    });

    // Add 'selected' class to the VexFlow note itself for internal tracking (optional but good practice)
    if (vexflowNoteMap[measureIndex] && vexflowNoteMap[measureIndex][clef] && vexflowNoteMap[measureIndex][clef][noteIndex]) {
        vexflowNoteMap[measureIndex][clef][noteIndex].addClass('selected');
        console.log(`VexFlow note ${measureIndex}-${clef}-${noteIndex} given 'selected' class.`);
    }

    console.log('highlightSelectedNote output: note highlight applied');
}

/**
 * Clears any active specific note highlight by restoring its original style
 * and removing the 'selected' class.
 */
export function clearSelectedNoteHighlight() {
    console.log('clearSelectedNoteHighlight called');
    if (currentSelectedNote) {
        const { measureIndex, clef, noteIndex } = currentSelectedNote;
        const noteKey = `${measureIndex}-${clef}-${noteIndex}`;
        
        // Restore original style
        const originalStyle = originalNoteStyles.get(noteKey) || {
            fillStyle: '#000000',
            strokeStyle: '#000000'
        };
        
        setVexFlowNoteStyleNonDestructive(measureIndex, clef, noteIndex, originalStyle);

        // Remove 'selected' class from the VexFlow note
        if (vexflowNoteMap[measureIndex] && vexflowNoteMap[measureIndex][clef] && vexflowNoteMap[measureIndex][clef][noteIndex]) {
            vexflowNoteMap[measureIndex][clef][noteIndex].removeClass('selected');
            console.log(`VexFlow note ${measureIndex}-${clef}-${noteIndex} 'selected' class removed.`);
        }

        currentSelectedNote = null;
        console.log('clearSelectedNoteHighlight output: highlight cleared and original style restored');
    }
}

// ===================================================================
// Scrolling Functions
// ===================================================================

/**
 * Scrolls the score display to the specified measure.
 */
export function scrollToMeasure(measureIndex) {
    console.log('scrollToMeasure input: measureIndex=', measureIndex);
    const scoreWrap = document.getElementById('scoreWrap');
    const measureWidth = 340;
    
    if (scoreWrap && measureXPositions[measureIndex] !== undefined) {
        const targetScrollLeft = Math.max(
            0, 
            measureXPositions[measureIndex] - (scoreWrap.clientWidth / 2) + (measureWidth / 2)
        );
        
        scoreWrap.scrollTo({
            left: targetScrollLeft,
            behavior: 'smooth'
        });
    }
    console.log('scrollToMeasure output: scroll initiated');
}

/**
 * Scrolls to the beginning of the score.
 */
export function scrollToStart() {
    console.log('scrollToStart called');
    const scoreWrap = document.getElementById('scoreWrap');
    if (scoreWrap) {
        scoreWrap.scrollTo({
            left: 0,
            behavior: 'smooth'
        });
    }
    console.log('scrollToStart output: scroll initiated');
}

/**
 * Scrolls to the end of the score.
 */
export function scrollToEnd() {
    console.log('scrollToEnd called');
    const scoreWrap = document.getElementById('scoreWrap');
    if (scoreWrap) {
        scoreWrap.scrollTo({
            left: scoreWrap.scrollWidth,
            behavior: 'smooth'
        });
    }
    console.log('scrollToEnd output: scroll initiated');
}

// ===================================================================
// Utility Functions
// ===================================================================

export function getVexFlowNoteMap() {
    console.log('getVexFlowNoteMap called');
    return vexflowNoteMap;
}

export function getMeasureXPositions() {
    console.log('getMeasureXPositions called');
    return measureXPositions;
}

export function getVexFlowStaveMap() {
    console.log('getVexFlowStaveMap called');
    return vexflowStaveMap;
}

export function getVexFlowContext() {
    console.log('getVexFlowContext called');
    return vfContext;
}

export function getVexFlowFactory() {
    console.log('getVexFlowFactory called');
    return vexFlowFactory;
}

export function isRendererReady() {
    console.log('isRendererReady called');
    return vexFlowFactory !== null && vfContext !== null;
}

// No longer relying on `highlightedNotes` set for general highlighting.
// Replaced with `notesHighlightedForPlayback` for playback, and `notesHighlightedInMeasure` for measure selection.
export function getHighlightedNotes() {
    console.log('getHighlightedNotes called (legacy, use notesHighlightedForPlayback or notesHighlightedInMeasure)');
    return new Set(); // Return empty set or adapt to new tracking if needed elsewhere.
}

/**
 * Safe redraw that preserves highlights
 */
export function safeRedraw() {
    console.log('safeRedraw called');
    if (vexFlowFactory && vfContext) {
        try {
            // Capture which measure was selected and which specific note was selected
            const selectedMeasureToRestore = currentSelectedMeasure;
            const selectedNoteToRestore = currentSelectedNote;
            
            // Clear all highlight *tracking sets* before the full redraw
            notesHighlightedInMeasure.clear();
            notesHighlightedForPlayback.clear();
            currentSelectedMeasure = -1;
            currentSelectedNote = null;

            // Clear and redraw canvas (this will wipe all existing visual styles on notes)
            const scoreElement = document.getElementById('score');
            if (scoreElement) {
                scoreElement.innerHTML = '';
            }
            vfContext.clear();
            vexFlowFactory.draw(); // This will recreate the VexFlow note objects and their default styles

            // Re-capture original styles for all new VexFlow note objects
            storeOriginalStyles();
            
            // Restore measure background highlight (DOM overlay)
            if (selectedMeasureToRestore !== -1) {
                addMeasureHighlightOverlay(selectedMeasureToRestore);
                currentSelectedMeasure = selectedMeasureToRestore; // Restore internal state
            }

            // Re-apply note highlights for the selected measure (green)
            if (selectedMeasureToRestore !== -1 && vexflowNoteMap[selectedMeasureToRestore]) {
                const notesInTargetMeasure = [];
                if (vexflowNoteMap[selectedMeasureToRestore].treble) {
                    vexflowNoteMap[selectedMeasureToRestore].treble.forEach((note, idx) => {
                        notesInTargetMeasure.push({ clef: 'treble', noteIndex: idx });
                    });
                }
                if (vexflowNoteMap[selectedMeasureToRestore].bass) {
                    vexflowNoteMap[selectedMeasureToRestore].bass.forEach((note, idx) => {
                        notesInTargetMeasure.push({ clef: 'bass', noteIndex: idx });
                    });
                }

                notesInTargetMeasure.forEach(({ clef, noteIndex }) => {
                    // Only apply green if it's NOT the orange selected note
                    if (!(selectedNoteToRestore && selectedNoteToRestore.measureIndex === selectedMeasureToRestore && selectedNoteToRestore.clef === clef && selectedNoteToRestore.noteIndex === noteIndex)) {
                         addHighlight(selectedMeasureToRestore, clef, noteIndex, '#1db954', false); // Green, and don't track in general highlights
                    }
                });
            }
            
            // Re-apply the specific selected note highlight (orange)
            if (selectedNoteToRestore) {
                highlightSelectedNote(selectedNoteToRestore.measureIndex, selectedNoteToRestore.clef, selectedNoteToRestore.noteIndex);
            }
            
            console.log("✓ Safe redraw completed with highlights preserved");
            
        } catch (e) {
            console.error("Error during safe redraw:", e);
        }
    }
    console.log('safeRedraw output: redraw completed or errored');
}

export function forceRedraw() {
    console.log('forceRedraw called');
    safeRedraw();
    console.log('forceRedraw output: safeRedraw called');
}

// ===================================================================
// Additional Utility Functions
// ===================================================================

export function getMeasureCount() {
    console.log('getMeasureCount called');
    return vexflowNoteMap.length;
}

export function getNoteCount(measureIndex, clef) {
    console.log('getNoteCount input: measureIndex=', measureIndex, 'clef=', clef);
    if (vexflowNoteMap[measureIndex] && vexflowNoteMap[measureIndex][clef]) {
        return vexflowNoteMap[measureIndex][clef].length;
    }
    return 0;
}

export function noteExists(measureIndex, clef, noteIndex) {
    console.log('noteExists input: measureIndex=', measureIndex, 'clef=', clef, 'noteIndex=', noteIndex);
    return vexflowNoteMap[measureIndex] && 
           vexflowNoteMap[measureIndex][clef] && 
           vexflowNoteMap[measureIndex][clef][noteIndex] !== undefined;
}

export function getNoteInfo(measureIndex, clef, noteIndex) {
    console.log('getNoteInfo input: measureIndex=', measureIndex, 'clef=', clef, 'noteIndex=', noteIndex);
    if (noteExists(measureIndex, clef, noteIndex)) {
        const vexNote = vexflowNoteMap[measureIndex][clef][noteIndex];
        return {
            keys: vexNote.keys,
            duration: vexNote.duration,
            clef: clef,
            measureIndex: measureIndex,
            noteIndex: noteIndex,
            isRest: vexNote.isRest || false,
            style: vexNote.getStyle() || null
        };
    }
    return null;
}

export function resetAllNoteStyles() {
    console.log('resetAllNoteStyles called');
    // Clear all note styles by restoring originals
    // Iterate through all notes in the map and reset their styles
    vexflowNoteMap.forEach((measure, measureIndex) => {
        ['treble', 'bass'].forEach(clef => {
            if (measure[clef]) {
                measure[clef].forEach((note, noteIndex) => {
                    const noteKey = `${measureIndex}-${clef}-${noteIndex}`;
                    const originalStyle = originalNoteStyles.get(noteKey) || {
                        fillStyle: '#000000',
                        strokeStyle: '#000000'
                    };
                    setVexFlowNoteStyleNonDestructive(measureIndex, clef, noteIndex, originalStyle);
                    // Also ensure classes are removed
                    note.removeClass('selected');
                });
            }
        });
    });

    // Clear all internal tracking sets
    notesHighlightedInMeasure.clear();
    notesHighlightedForPlayback.clear();
    currentSelectedNote = null;

    // Clear DOM-based measure highlight
    clearMeasureHighlight();
    currentSelectedMeasure = -1;

    console.log('resetAllNoteStyles output: all note styles and highlights reset');
}

// ===================================================================
// Debug Functions
// ===================================================================

export function debugPlaybackTest() {
    console.log("=== Testing Playback-Safe Highlighting ===");
    
    if (vexflowNoteMap.length > 0) {
        console.log("Testing playback highlighting...");
        
        // Test playback highlight (which uses addHighlight with trackHighlight = true)
        addPlaybackHighlight(0, 'bass', 0, '#00f'); // Using blue for playback

        setTimeout(() => {
            removePlaybackHighlight(0, 'bass', 0);
            console.log("Playback highlight test completed");
        }, 1000);
    }
}

console.log("✓ scoreRenderer.js (fixed version) loaded successfully");