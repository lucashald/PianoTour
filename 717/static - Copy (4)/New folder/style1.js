
// ===================================================================
// Improved Highlight Functions
// ===================================================================

/**
 * Adds a highlight to a specific note without redrawing the entire score
 */
export function addHighlight(measureIndex, clef, noteIndex, color = '#1db954') {
    const noteKey = `${measureIndex}-${clef}-${noteIndex}`;
    
    // Avoid redundant highlights
    if (highlightedNotes.has(noteKey)) {
        return;
    }
    
    highlightedNotes.add(noteKey);
    
    // Use non-destructive styling
    setVexFlowNoteStyleNonDestructive(measureIndex, clef, noteIndex, {
        fillStyle: color,
        strokeStyle: color
    });
}

/**
 * Removes a highlight from a specific note without redrawing the entire score
 */
export function removeHighlight(measureIndex, clef, noteIndex) {
    const noteKey = `${measureIndex}-${clef}-${noteIndex}`;
    
    // Only remove if it was highlighted
    if (!highlightedNotes.has(noteKey)) {
        return;
    }
    
    highlightedNotes.delete(noteKey);
    
    // Restore original style
    const originalStyle = originalNoteStyles.get(noteKey) || {
        fillStyle: '#000000',
        strokeStyle: '#000000'
    };
    
    setVexFlowNoteStyleNonDestructive(measureIndex, clef, noteIndex, originalStyle);
}

/**
 * Clears all highlights without redrawing the entire score
 */
export function clearAllHighlights() {
    if (highlightedNotes.size === 0) {
        return;
    }
    
    // Clear all highlights using non-destructive method
    highlightedNotes.forEach(noteKey => {
        const [measureIndex, clef, noteIndex] = noteKey.split('-');
        const originalStyle = originalNoteStyles.get(noteKey) || {
            fillStyle: '#000000',
            strokeStyle: '#000000'
        };
        
        setVexFlowNoteStyleNonDestructive(
            parseInt(measureIndex), 
            clef, 
            parseInt(noteIndex), 
            originalStyle
        );
    });
    
    highlightedNotes.clear();
}

/**
 * Batch highlight multiple notes efficiently without redrawing
 */
export function addMultipleHighlights(highlights) {
    highlights.forEach(({measureIndex, clef, noteIndex, color = '#1db954'}) => {
        addHighlight(measureIndex, clef, noteIndex, color);
    });
}

// ===================================================================
// DOM Overlay Highlighting System (Alternative)
// ===================================================================

let highlightOverlays = new Map();

/**
 * Creates a visual overlay highlight that doesn't interfere with VexFlow rendering
 */
export function addHighlightOverlay(measureIndex, clef, noteIndex, color = '#1db954') {
    const overlayId = `highlight-${measureIndex}-${clef}-${noteIndex}`;
    
    // Remove existing overlay if it exists
    removeHighlightOverlay(measureIndex, clef, noteIndex);
    
    if (vexflowNoteMap[measureIndex] && 
        vexflowNoteMap[measureIndex][clef] && 
        vexflowNoteMap[measureIndex][clef][noteIndex]) {
        
        const vexNote = vexflowNoteMap[measureIndex][clef][noteIndex];
        
        try {
            // Get the note's bounding box
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
}

/**
 * Removes a highlight overlay
 */
export function removeHighlightOverlay(measureIndex, clef, noteIndex) {
    const overlayId = `highlight-${measureIndex}-${clef}-${noteIndex}`;
    
    if (highlightOverlays.has(overlayId)) {
        const overlay = highlightOverlays.get(overlayId);
        overlay.remove();
        highlightOverlays.delete(overlayId);
    }
}

/**
 * Clears all highlight overlays
 */
export function clearAllHighlightOverlays() {
    highlightOverlays.forEach(overlay => {
        overlay.remove();
    });
    highlightOverlays.clear();
}

// ===================================================================
// Playback-Safe Highlighting
// ===================================================================

/**
 * Playback-safe highlighting that uses overlays to avoid score collapse
 */
export function addPlaybackHighlight(measureIndex, clef, noteIndex, color = '#1db954') {
    // Use overlay method during playback to avoid score collapse
    addHighlightOverlay(measureIndex, clef, noteIndex, color);
}

/**
 * Removes playback highlight
 */
export function removePlaybackHighlight(measureIndex, clef, noteIndex) {
    removeHighlightOverlay(measureIndex, clef, noteIndex);
}

/**
 * Clears all playback highlights
 */
export function clearAllPlaybackHighlights() {
    clearAllHighlightOverlays();
}


