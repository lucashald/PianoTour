// scoreHighlighter.js


// ===================================================================
// INDIVIDUAL NOTE HIGHLIGHTING
// ===================================================================

export function highlightSelectedNote(measureIndex, clef, noteId) {
console.log(`highlightSelectedNote: Highlighting note: M${measureIndex}, C${clef}, ID${noteId}`);
clearSelectedNoteHighlight();

if (currentPlaybackNote && 
currentPlaybackNote.measureIndex === measureIndex &&
currentPlaybackNote.clef === clef &&
currentPlaybackNote.noteId === noteId) {
console.log("highlightSelectedNote: Clearing conflicting playback highlight for target note.");
clearPlaybackHighlight(); 
}

currentSelectedNote = { measureIndex, clef, noteId }; 

const vexflowIndex = vexflowIndexByNoteId[noteId];
if (vexflowIndex === undefined) {
console.warn(`highlightSelectedNote: Cannot highlight note: VexFlow index not found for noteId ${noteId}.`);
return;
}

const selectionStyle = {
fillStyle: '#ff6b35', 
strokeStyle: '#ff6b35', 
shadowColor: null,    
shadowBlur: 0
};

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



export function highlightSelectedMeasure(measureIndex) {
console.log("highlightSelectedMeasure: Highlighting measure", measureIndex);
if (measureIndex < 0 || measureIndex >= vexflowNoteMap.length) {
console.warn(`highlightSelectedMeasure: Invalid measure index: ${measureIndex}.`);
return;
}

clearMeasureHighlight(); 

currentSelectedMeasure = measureIndex; 

addMeasureHighlightOverlay(measureIndex);

const measureNotes = getMeasures()[measureIndex] || [];
measureNotes.forEach((noteData) => {
const vexflowIndex = vexflowIndexByNoteId[noteData.id];
if (vexflowIndex === undefined) {
console.warn(`highlightSelectedMeasure: VexFlow index not found for note ID ${noteData.id}. Skipping note highlight in measure.`);
return;
}

const measureStyle = {
fillStyle: '#1db954', 
strokeStyle: '#1db954', 
shadowColor: null,
shadowBlur: 0
};

setVexFlowNoteStyle(measureIndex, noteData.clef, vexflowIndex, measureStyle);
});

if (currentSelectedNote && currentSelectedNote.measureIndex === measureIndex) {
console.log(`highlightSelectedMeasure: Re-applying selected note highlight within newly highlighted measure.`);
highlightSelectedNote(currentSelectedNote.measureIndex, currentSelectedNote.clef, currentSelectedNote.noteId);
}
}

export function clearMeasureHighlight() {
console.log("clearMeasureHighlight: Clearing measure highlight.");
if (currentSelectedMeasure === -1) {
console.log("clearMeasureHighlight: No measure currently selected to clear.");
return; 
}

const existingOverlay = document.querySelector('[id^="measure-highlight-"]');
if (existingOverlay) {
existingOverlay.remove();
console.log(`clearMeasureHighlight: Removed DOM overlay for measure ${currentSelectedMeasure}.`);
}

const previouslySelectedMeasureNotes = getMeasures()[currentSelectedMeasure] || [];
previouslySelectedMeasureNotes.forEach((noteData) => {
const vexflowIndex = vexflowIndexByNoteId[noteData.id];
if (vexflowIndex !== undefined) {
const defaultStyle = {
fillStyle: '#000000', 
strokeStyle: '#000000',
shadowColor: null,
shadowBlur: 0
};
setVexFlowNoteStyle(currentSelectedMeasure, noteData.clef, vexflowIndex, defaultStyle);
}
});

if (currentSelectedNote && currentSelectedNote.measureIndex === currentSelectedMeasure) {
console.log(`clearMeasureHighlight: Re-applying selected note highlight after measure clear.`);
highlightSelectedNote(currentSelectedNote.measureIndex, currentSelectedNote.clef, currentSelectedNote.noteId);
}

currentSelectedMeasure = -1; 
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
* @param {string} noteId - The unique ID of the note.
* @param {string} color - The color for the playback highlight (e.g., '#FFD700' for gold).
*/
export function addPlaybackHighlight(measureIndex, clef, noteId, color) {
console.log(`addPlaybackHighlight: Highlighting playback note: M${measureIndex}, C${clef}, ID${noteId}`);
// 1. Clear any existing playback highlight first to ensure only one note is highlighted for playback at a time.
clearPlaybackHighlight();

currentPlaybackNote = { measureIndex, clef, noteId }; // Update the tracking variable for the active playback note.

// Convert to VexFlow index to target the specific VexFlow note object.
const vexflowIndex = vexflowIndexByNoteId[noteId];
if (vexflowIndex === undefined) {
console.warn(`addPlaybackHighlight: Cannot add playback highlight: VexFlow index not found for measure ${measureIndex}, clef ${clef}, noteId ${noteId}.`);
return;
}

const playbackStyle = {
fillStyle: color,      // The specified playback color
strokeStyle: color,    // Matching stroke color
shadowColor: color,    // Playback often has a shadow/glow effect
shadowBlur: 15,        // Blur radius for the shadow
};

setVexFlowNoteStyle(measureIndex, clef, vexflowIndex, playbackStyle);

// IMPORTANT: If the playback note is *also* the currently selected individual note,
// we need to re-apply the orange selection highlight immediately after.
// This ensures that the orange selection color visually overrides the playback color.
if (currentSelectedNote && 
currentSelectedNote.measureIndex === measureIndex &&
currentSelectedNote.clef === clef &&
currentSelectedNote.noteId === noteId) {
console.log("addPlaybackHighlight: Playback note is also selected. Re-applying selection highlight to override playback.");
highlightSelectedNote(measureIndex, clef, noteId); // Calls highlightSelectedNote to re-apply orange.
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

const { measureIndex, clef, noteId } = currentPlaybackNote; // Get details of the playback note to clear.
const vexflowIndex = vexflowIndexByNoteId[noteId];

if (vexflowIndex !== undefined) {
let styleToRestore;

// Determine the correct style to restore based on the highlighting precedence:
// 1. Is it the currently selected individual note? (Orange takes highest precedence)
if (currentSelectedNote && 
currentSelectedNote.measureIndex === measureIndex &&
currentSelectedNote.clef === clef &&
currentSelectedNote.noteId === noteId) {
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
clearMeasureHighlight();      // Clears measure highlight and its overlay, restoring notes to black/selection.
clearPlaybackHighlight();     // Clears playback highlight, restoring to black/selection/measure color.

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
*/function setVexFlowNoteStyle(measureIndex, clef, vexflowIndex, style) {
const note = vexflowNoteMap[measureIndex]?.[clef]?.[vexflowIndex];
if (!note) {
console.warn(`Note not found at ${measureIndex}-${clef}-${vexflowIndex}. Cannot set style.`);
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