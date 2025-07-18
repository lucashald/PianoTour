
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