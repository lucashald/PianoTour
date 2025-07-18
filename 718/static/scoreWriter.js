// scoreWriter.js
// This module manages the musical score data, including writing, undo, and state synchronization.

// ===================================================================
// Imports
// ===================================================================

import { NOTES_BY_NAME } from './note-data.js'; // Needed for note name to MIDI mapping for sorting and internal consistency
import { drawAll } from './scoreRenderer.js';
import { updateNowPlayingDisplay } from './uiHelpers.js';

// ===================================================================
// Constants
// ===================================================================

const BEAT_VALUES = { q: 1, h: 2, w: 4, '8': 0.5, '16': 0.25, '32': 0.125,
'q.': 1.5, 'h.': 3, 'w.': 6, '8.': 0.75, '16.': 0.375, '32.': 0.1875 };
const AUTOSAVE_KEY = 'autosavedScore';
const MEASURE_CAPACITY_BEATS = 4; // Assuming 4/4 time signature for measure capacity

// ===================================================================
// Internal State
// ===================================================================

let measuresData = [];
let currentIndex = 0;
// currentTrebleBeats and currentBassBeats are now primarily used by writeNote for auto-advancing measures
let currentTrebleBeats = 0;
let currentBassBeats = 0;

const history = [];
const MAX_HISTORY = 20;

// ===================================================================
// Helper Functions
// ===================================================================

/**
* Calculates the total beats for treble and bass clefs within a given measure.
* This function is used to ensure data integrity by calculating beats on demand.
* @param {Array} measure - An array of note objects for a single measure.
* @returns {{trebleBeats: number, bassBeats: number}} Object with total beats for each clef.
*/
function calculateMeasureBeats(measure) {
console.log('calculateMeasureBeats input: measure =', measure);
let trebleBeats = 0;
let bassBeats = 0;

measure.forEach(note => {
const beats = BEAT_VALUES[note.duration] || 0;
if (note.clef === 'treble') {
trebleBeats += beats;
} else if (note.clef === 'bass') {
bassBeats += beats;
}
});
console.log('calculateMeasureBeats output:', { trebleBeats, bassBeats });
return { trebleBeats, bassBeats };
}

function saveStateToHistory() {
console.log('saveStateToHistory called. History length before:', history.length);
const currentMeasuresClone = JSON.parse(JSON.stringify(measuresData));
history.push({
measures: currentMeasuresClone,
index: currentIndex,
trebleBeats: currentTrebleBeats, // These are still relevant for writeNote's internal logic
bassBeats: currentBassBeats      // These are still relevant for writeNote's internal logic
});
if (history.length > MAX_HISTORY) {
history.shift();
}
console.log('saveStateToHistory output: history length after:', history.length);
}

// ===================================================================
// Core Score Management Functions
// ===================================================================

export function undoLastWrite() {
console.log('undoLastWrite called. History length:', history.length);
if (history.length > 1) {
history.pop();
const prevState = history[history.length - 1];

measuresData = JSON.parse(JSON.stringify(prevState.measures));
currentIndex = prevState.index;
currentTrebleBeats = prevState.trebleBeats;
currentBassBeats = prevState.bassBeats;

drawAll(measuresData);
updateNowPlayingDisplay('');
localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(measuresData));
console.log('undoLastWrite output: state reverted.');
} else if (history.length === 1) {
resetScore();
console.log('undoLastWrite output: score reset (only one state in history).');
} else {
console.log('undoLastWrite output: no history to undo.');
}
}

function generateUniqueId() {
return Date.now().toString(); // Returns a string like "1678886400000"
}

/**
* Writes a note or rest to the score. This function handles auto-advancing measures
* based on the running beat count for each clef.
* @param {object} obj - The note/rest object { clef, duration, notes, chordName, isRest }.
* - notes: Array of note names (e.g., ['C4']) or a single note for single notes
* For chords, it's an array of note names (e.g., ['C4', 'E4', 'G4']).
* - clef: 'treble' or 'bass'
* - duration: 'q', 'h', 'w', etc.
* - chordName: The display name of the chord (e.g., 'C Major', 'Am7') or single note name.
* - isRest: boolean, true if it's a rest.
*/
export function writeNote(obj) {
console.log('writeNote input: obj =', obj);
saveStateToHistory();

const { clef, duration, notes, chordName, isRest = false } = obj;
const beats = BEAT_VALUES[duration];

const currentBeatsForClef = clef === 'treble' ? currentTrebleBeats : currentBassBeats;

// If adding the new note would overflow the measure for its specific clef,
// advance to the next measure for both staves.
if (currentBeatsForClef + beats > MEASURE_CAPACITY_BEATS) {
// Only advance if the current measure has any notes in it.
// This prevents creating empty measures if the first note already overflows.
if (measuresData[currentIndex] && (measuresData[currentIndex].length > 0 || currentTrebleBeats > 0 || currentBassBeats > 0)) {
currentIndex++;
}
measuresData[currentIndex] = []; // Initialize new measure
currentTrebleBeats = 0;
currentBassBeats = 0;
console.log('writeNote: measure advanced due to overflow. New currentIndex:', currentIndex);
}

// Ensure `notes` are always an array before mapping
const notesArray = Array.isArray(notes) ? notes : [notes];

// Format for VexFlow: chords are `(N1 O1 N2 O2 ...)` (space-separated notes inside parentheses)
// Single notes are just "Nn"
const formattedName = notesArray.length > 1
? `(${notesArray.sort((a, b) => NOTES_BY_NAME[a] - NOTES_BY_NAME[b]).join(' ')})`
: notesArray[0];

// Generate a unique ID for the new note entry
const newNoteId = generateUniqueId(); 

const noteEntry = { 
id: newNoteId, // Add the unique ID here
name: formattedName, 
clef, 
duration, 
measure: currentIndex, 
isRest 
};

measuresData[currentIndex] ??= []; 
measuresData[currentIndex].push(noteEntry);

if (clef === 'treble') {
currentTrebleBeats += beats;
} else {
currentBassBeats += beats;
}

updateNowPlayingDisplay(chordName);
localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(measuresData));
drawAll(measuresData);
console.log(`writeNote output: Note written. Beats status - Treble: ${currentTrebleBeats}, Bass: ${currentBassBeats}. measuresData:`, measuresData);
}
/**
* Adds a new note at a specified position within a measure.
* This function checks for measure overflow and creates a new measure if necessary.
* @param {number} measureIndex - The index of the measure to modify.
* @param {object} noteData - The note object to insert.
* @param {string|null} [insertBeforeNoteId=null] - The ID of the note to insert before. If null, appends to end.
 * If the ID is not found, it appends to the end.
*/
export function addNoteToMeasure(measureIndex, noteData, insertBeforeNoteId = null) {
console.log('addNoteToMeasure input: measureIndex=', measureIndex, 'noteData=', noteData, 'insertBeforeNoteId=', insertBeforeNoteId);
saveStateToHistory();

// Ensure the target measure exists
if (!measuresData[measureIndex]) {
measuresData[measureIndex] = [];
console.log(`addNoteToMeasure: Initialized new measure ${measureIndex}.`);
}

const newNoteBeats = BEAT_VALUES[noteData.duration] || 0;
const targetMeasure = measuresData[measureIndex];

    let insertIndex = -1; // Default to append
    if (insertBeforeNoteId !== null) {
        insertIndex = targetMeasure.findIndex(note => note.id === insertBeforeNoteId);
        if (insertIndex === -1) {
            console.warn(`addNoteToMeasure: Note with ID ${insertBeforeNoteId} not found in measure ${measureIndex}. Appending to end.`);
        }
    }

// Create a temporary measure array including the new note at the proposed position
const tempMeasure = [...targetMeasure];
if (insertIndex === -1) { // If -1, append
tempMeasure.push(noteData);
console.log(`addNoteToMeasure: Preparing to append note to measure ${measureIndex}.`);
} else { // Insert at specific position
tempMeasure.splice(insertIndex, 0, noteData);
console.log(`addNoteToMeasure: Preparing to insert note at index ${insertIndex} in measure ${measureIndex}.`);
}

const { trebleBeats, bassBeats } = calculateMeasureBeats(tempMeasure);

// Check if adding the note would cause an overflow in either clef
if (trebleBeats > MEASURE_CAPACITY_BEATS || bassBeats > MEASURE_CAPACITY_BEATS) {
console.warn(`Adding note to measure ${measureIndex} would cause overflow. Creating new measure.`);

// Find the next available measure index
const nextMeasureIndex = measuresData.length; // This will append a new measure at the end

// Add the new measure to measuresData
measuresData[nextMeasureIndex] = [noteData]; // New note goes into the new measure

// Update currentIndex to the new measure
currentIndex = nextMeasureIndex;

// Recalculate current beats for the new measure (which only contains the new note)
const newMeasureBeats = calculateMeasureBeats(measuresData[currentIndex]);
currentTrebleBeats = newMeasureBeats.trebleBeats;
currentBassBeats = newMeasureBeats.bassBeats;

} else {
// If no overflow, insert the note into the current measure
measuresData[measureIndex] = tempMeasure; // Replace the original measure with the modified temporary one
// If we are editing the current active measure, update the running beat totals
if (measureIndex === currentIndex) {
const updatedBeats = calculateMeasureBeats(measuresData[currentIndex]);
currentTrebleBeats = updatedBeats.trebleBeats;
currentBassBeats = updatedBeats.bassBeats;
}
}

drawAll(measuresData);
localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(measuresData));
console.log(`addNoteToMeasure output: Note added. Current beats - Treble: ${currentTrebleBeats}, Bass: ${currentBassBeats}. measuresData:`, measuresData);
    return noteData.id; // Return the ID of the newly added note
}

/**
* Removes a note from a specified measure by its ID.
* @param {number} measureIndex - The index of the measure to modify.
* @param {string} noteId - The ID of the note to remove.
* @returns {object|null} The removed note object, or null if not found.
*/
export function removeNoteFromMeasure(measureIndex, noteId) {
console.log('removeNoteFromMeasure input: measureIndex=', measureIndex, 'noteId=', noteId);
saveStateToHistory();
    if (!measuresData[measureIndex]) {
        console.warn(`Attempted to remove note from non-existent measure ${measureIndex}.`);
        return null;
    }

    const noteIndex = measuresData[measureIndex].findIndex(note => note.id === noteId);

if (noteIndex !== -1) {
const removedNote = measuresData[measureIndex].splice(noteIndex, 1)[0]; // Remove the note

// If the measure becomes empty, remove it (unless it's the very first measure)
if (measuresData[measureIndex].length === 0 && measureIndex > 0) {
measuresData.splice(measureIndex, 1);
// Adjust currentIndex if the removed measure was before or at the current index
if (currentIndex >= measureIndex) {
currentIndex = Math.max(0, currentIndex - 1);
}
console.log(`removeNoteFromMeasure: Measure ${measureIndex} is now empty and removed.`);
}

// Recalculate current beats for the measure that was modified/is now current
if (measuresData[currentIndex]) {
const updatedBeats = calculateMeasureBeats(measuresData[currentIndex]);
currentTrebleBeats = updatedBeats.trebleBeats;
currentBassBeats = updatedBeats.bassBeats;
} else { // If all measures were removed
currentTrebleBeats = 0;
currentBassBeats = 0;
currentIndex = 0;
measuresData[0] = []; // Ensure at least one empty measure exists
console.log(`removeNoteFromMeasure: All measures removed, starting fresh.`);
}

drawAll(measuresData);
localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(measuresData));
console.log(`removeNoteFromMeasure output: Note with ID ${noteId} removed from measure ${measureIndex}. Removed note:`, removedNote);
return removedNote;
} else {
console.warn(`Attempted to remove non-existent note with ID ${noteId} at measure ${measureIndex}.`);
console.log('removeNoteFromMeasure output: null (note not found)');
return null;
}
}

/**
* Updates an existing note's properties by its ID. This function prevents updates
* that would cause a measure to exceed its beat capacity.
* @param {number} measureIndex - The index of the measure containing the note.
* @param {string} noteId - The ID of the note to update.
* @param {object} newNoteData - An object containing the new properties for the note.
* @returns {boolean} True if the update was successful, false otherwise.
*/
export function updateNoteInMeasure(measureIndex, noteId, newNoteData) {
console.log('updateNoteInMeasure input: measureIndex=', measureIndex, 'noteId=', noteId, 'newNoteData=', newNoteData);
    if (!measuresData[measureIndex]) {
        console.warn(`Attempted to update note in non-existent measure ${measureIndex}.`);
        return false;
    }

    const noteIndex = measuresData[measureIndex].findIndex(note => note.id === noteId);

if (noteIndex === -1) {
console.warn(`Attempted to update non-existent note with ID ${noteId} at measure ${measureIndex}.`);
console.log('updateNoteInMeasure output: false (note not found)');
return false;
}

// Create a temporary copy of the measure with the proposed update
const tempMeasure = JSON.parse(JSON.stringify(measuresData[measureIndex]));
const existingNote = tempMeasure[noteIndex];

// Apply proposed changes to the temporary note
const updatedTempNote = { ...existingNote, ...newNoteData };

// Replace the note in the temporary measure
tempMeasure[noteIndex] = updatedTempNote;

const { trebleBeats, bassBeats } = calculateMeasureBeats(tempMeasure);

// Check if the update would cause an overflow
if (trebleBeats > MEASURE_CAPACITY_BEATS || bassBeats > MEASURE_CAPACITY_BEATS) {
console.warn(`Update to note with ID ${noteId} at measure ${measureIndex} would cause measure overflow. Operation cancelled.`);
// Optionally, provide UI feedback to the user here (e.g., a temporary message)
updateNowPlayingDisplay("Error: Update would overflow measure!");
setTimeout(() => updateNowPlayingDisplay(""), 3000); // Clear message after 3 seconds
console.log('updateNoteInMeasure output: false (overflow prevented)');
return false;
}

// If no overflow, proceed with the actual update
saveStateToHistory(); // Save state before the valid modification
const actualNote = measuresData[measureIndex][noteIndex];
Object.assign(actualNote, updatedTempNote); // Apply all changes from updatedTempNote

// If we are editing the current active measure, update the running beat totals
if (measureIndex === currentIndex) {
const updatedBeats = calculateMeasureBeats(measuresData[currentIndex]);
currentTrebleBeats = updatedBeats.trebleBeats;
currentBassBeats = updatedBeats.bassBeats;
}

drawAll(measuresData);
localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(measuresData));
console.log(`updateNoteInMeasure output: Note with ID ${noteId} updated at measure ${measureIndex}. Current beats - Treble: ${currentTrebleBeats}, Bass: ${currentBassBeats}. measuresData:`, measuresData);
return true;
}

export function resetScore() {
console.log('resetScore called.');
measuresData = [];
currentIndex = 0;
currentTrebleBeats = 0;
currentBassBeats = 0;
history.length = 0;
saveStateToHistory();
localStorage.removeItem(AUTOSAVE_KEY);
updateNowPlayingDisplay('');
drawAll(measuresData);
console.log("Score reset.");
}

export function processAndSyncScore(loadedData) {
console.log('processAndSyncScore input: loadedData =', loadedData);
if (!Array.isArray(loadedData) || loadedData.flat().length === 0) {
console.error("Loaded data is invalid or empty. Cannot process.");
console.log('processAndSyncScore output: false (invalid data)');
return false;
}

try {
measuresData = JSON.parse(JSON.stringify(loadedData));
currentIndex = measuresData.length > 0 ? measuresData.length - 1 : 0;

// Recalculate current beats based on the last measure of loaded data
if (measuresData[currentIndex]) {
const lastMeasureBeats = calculateMeasureBeats(measuresData[currentIndex]);
currentTrebleBeats = lastMeasureBeats.trebleBeats;
currentBassBeats = lastMeasureBeats.bassBeats;
} else {
currentTrebleBeats = 0;
currentBassBeats = 0;
}

history.length = 0;
saveStateToHistory();
console.log("Score state successfully synchronized.");
console.log('processAndSyncScore output: true');
return true;

} catch (e) {
console.error("An error occurred while processing the score:", e);
console.log('processAndSyncScore output: false (error)');
return false;
}
}

export function getMeasures() {
console.log('getMeasures called. Returning measuresData:', measuresData);
return measuresData;
}

/**
* Moves a note from one measure to another.
* @param {number} fromMeasureIndex - The index of the source measure.
* @param {string} fromNoteId - The ID of the note to move within the source measure.
* @param {number} toMeasureIndex - The index of the target measure.
* @param {string|null} [insertBeforeNoteId=null] - The ID of the note to insert before in the target measure. If null, appends.
* @returns {boolean} True if the move was successful, false otherwise.
*/
export function moveNoteBetweenMeasures(fromMeasureIndex, fromNoteId, toMeasureIndex, insertBeforeNoteId = null) {
console.log('moveNoteBetweenMeasures input: fromMeasureIndex=', fromMeasureIndex, 'fromNoteId=', fromNoteId, 'toMeasureIndex=', toMeasureIndex, 'insertBeforeNoteId=', insertBeforeNoteId);

// First, find the note to move by its ID and remove it from the source measure.
const noteToMove = removeNoteFromMeasure(fromMeasureIndex, fromNoteId);
if (!noteToMove) {
console.error('Note not found at source for moving (ID:', fromNoteId, ').');
console.log('moveNoteBetweenMeasures output: false');
return false;
}

// Update the note's internal 'measure' property to reflect its new measure (optional, but good for data consistency)
noteToMove.measure = toMeasureIndex;

// Ensure the target measure exists, creating empty measures if necessary to reach it.
while (measuresData.length <= toMeasureIndex) {
measuresData.push([]);
console.log(`moveNoteBetweenMeasures: Created new empty measure at index ${measuresData.length - 1}`);
}

// Add the note to the target measure at the specified insertion point.
addNoteToMeasure(toMeasureIndex, noteToMove, insertBeforeNoteId);

// After moving, the overall score state has changed, so redraw.
// `addNoteToMeasure` already calls `drawAll`, so this might be redundant but ensures consistency.
drawAll(measuresData);
localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(measuresData));
console.log(`moveNoteBetweenMeasures output: true. Note with ID ${fromNoteId} moved successfully.`);
return true;
}

/**
* Enhanced version of addNoteToMeasure that can create new measures if the target measureIndex
 * is beyond the current number of measures.
* @param {number} measureIndex - The index of the measure to modify or create.
* @param {object} note - The note object to insert.
* @param {string|null} [insertBeforeNoteId=null] - The ID of the note to insert before. If null, appends.
* @returns {string|null} The ID of the added note, or null if not added.
*/
export function addNoteToMeasureWithExpansion(measureIndex, note, insertBeforeNoteId = null) {
console.log('addNoteToMeasureWithExpansion input: measureIndex=', measureIndex, 'note=', note, 'insertBeforeNoteId=', insertBeforeNoteId);
// Ensure we have enough measures to reach the target measureIndex
while (measuresData.length <= measureIndex) {
measuresData.push([]);
console.log(`addNoteToMeasureWithExpansion: Created new empty measure at index ${measuresData.length - 1}`);
}

const addedNoteId = addNoteToMeasure(measureIndex, note, insertBeforeNoteId);
console.log('addNoteToMeasureWithExpansion output: Added note ID:', addedNoteId);
return addedNoteId;
}