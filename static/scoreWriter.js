// scoreWriter.js
// This module manages the musical score data, including writing, undo, and state synchronization.

// ===================================================================
// Imports
// ===================================================================

import { NOTES_BY_NAME } from './note-data.js'; // Needed for note name to MIDI mapping for sorting and internal consistency
import { drawAll } from './scoreRenderer.js';
import { updateNowPlayingDisplay } from './uiHelpers.js';
import { saveToLocalStorage } from './ioHelpers.js';

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
        bassBeats: currentBassBeats      // These are still relevant for writeNote's internal logic
    });
    if (history.length > MAX_HISTORY) {
        history.shift();
    }
    console.log('saveStateToHistory output: history length after:', history.length);
}

// Counter to ensure truly unique IDs even for rapid note additions
let idCounter = 0;

function generateUniqueId() {
    // Combine timestamp with counter to guarantee uniqueness
    return `${Date.now()}-${++idCounter}`;
}

// ===================================================================
// Core Data Operations (No side effects)
// ===================================================================

function doRemoveNote(measureIndex, noteId) {
    if (!measuresData[measureIndex]) {
        return null;
    }

    const noteIndex = measuresData[measureIndex].findIndex(note => note.id === noteId);
    if (noteIndex === -1) {
        return null;
    }

    const removedNote = measuresData[measureIndex].splice(noteIndex, 1)[0];

    // Handle empty measure cleanup
    if (measuresData[measureIndex].length === 0 && measureIndex > 0) {
        measuresData.splice(measureIndex, 1);
        if (currentIndex >= measureIndex) {
            currentIndex = Math.max(0, currentIndex - 1);
        }
        console.log(`doRemoveNote: Measure ${measureIndex} is now empty and removed.`);
    }

    // Recalculate current beats
    if (measuresData[currentIndex]) {
        const updatedBeats = calculateMeasureBeats(measuresData[currentIndex]);
        currentTrebleBeats = updatedBeats.trebleBeats;
        currentBassBeats = updatedBeats.bassBeats;
    } else {
        currentTrebleBeats = 0;
        currentBassBeats = 0;
        currentIndex = 0;
        measuresData[0] = [];
        console.log(`doRemoveNote: All measures removed, starting fresh.`);
    }

    return removedNote;
}

function doAddNote(measureIndex, noteData, insertBeforeNoteId = null) {
    // Ensure the target measure exists
    if (!measuresData[measureIndex]) {
        measuresData[measureIndex] = [];
        console.log(`doAddNote: Initialized new measure ${measureIndex}.`);
    }

    const targetMeasure = measuresData[measureIndex];
    let insertIndex = -1;

    if (insertBeforeNoteId !== null) {
        insertIndex = targetMeasure.findIndex(note => note.id === insertBeforeNoteId);
        if (insertIndex === -1) {
            console.warn(`doAddNote: Note with ID ${insertBeforeNoteId} not found in measure ${measureIndex}. Appending to end.`);
        }
    }

    // Create temporary measure for overflow checking
    const tempMeasure = [...targetMeasure];
    if (insertIndex === -1) {
        tempMeasure.push(noteData);
        console.log(`doAddNote: Preparing to append note to measure ${measureIndex}.`);
    } else {
        tempMeasure.splice(insertIndex, 0, noteData);
        console.log(`doAddNote: Preparing to insert note at index ${insertIndex} in measure ${measureIndex}.`);
    }

    const { trebleBeats, bassBeats } = calculateMeasureBeats(tempMeasure);

    // Handle overflow by creating new measure
    if (trebleBeats > MEASURE_CAPACITY_BEATS || bassBeats > MEASURE_CAPACITY_BEATS) {
        console.warn(`Adding note to measure ${measureIndex} would cause overflow. Creating new measure.`);
        const nextMeasureIndex = measuresData.length;
        measuresData[nextMeasureIndex] = [noteData];
        currentIndex = nextMeasureIndex;
        const newMeasureBeats = calculateMeasureBeats(measuresData[currentIndex]);
        currentTrebleBeats = newMeasureBeats.trebleBeats;
        currentBassBeats = newMeasureBeats.bassBeats;
    } else {
        // No overflow, insert normally
        measuresData[measureIndex] = tempMeasure;
        if (measureIndex === currentIndex) {
            const updatedBeats = calculateMeasureBeats(measuresData[currentIndex]);
            currentTrebleBeats = updatedBeats.trebleBeats;
            currentBassBeats = updatedBeats.bassBeats;
        }
    }

    return noteData.id;
}

function doUpdateNote(measureIndex, noteId, newNoteData) {
    if (!measuresData[measureIndex]) {
        return false;
    }

    const noteIndex = measuresData[measureIndex].findIndex(note => note.id === noteId);
    if (noteIndex === -1) {
        return false;
    }

    // Create a temporary copy to test for overflow
    const tempMeasure = JSON.parse(JSON.stringify(measuresData[measureIndex]));
    const existingNote = tempMeasure[noteIndex];
    const updatedTempNote = { ...existingNote, ...newNoteData };
    tempMeasure[noteIndex] = updatedTempNote;

    const { trebleBeats, bassBeats } = calculateMeasureBeats(tempMeasure);

    // Check for overflow
    if (trebleBeats > MEASURE_CAPACITY_BEATS || bassBeats > MEASURE_CAPACITY_BEATS) {
        return false; // Overflow would occur
    }

    // Apply the update
    const actualNote = measuresData[measureIndex][noteIndex];
    Object.assign(actualNote, updatedTempNote);

    // Update current beats if editing the current measure
    if (measureIndex === currentIndex) {
        const updatedBeats = calculateMeasureBeats(measuresData[currentIndex]);
        currentTrebleBeats = updatedBeats.trebleBeats;
        currentBassBeats = updatedBeats.bassBeats;
    }

    return true;
}

// ===================================================================
// Helper Function for Side Effects
// ===================================================================

function handleSideEffects() {
    drawAll(measuresData);
    saveToLocalStorage();
}

// ===================================================================
// Core Score Management Functions
// ===================================================================

export function undoLastWrite() {
    console.log('undoLastWrite called. History length:', history.length);

    if (history.length > 1) {
        history.pop(); // Remove current state
        const prevState = history[history.length - 1]; // Get previous state

        measuresData = JSON.parse(JSON.stringify(prevState.measures));
        currentIndex = prevState.index;
        currentTrebleBeats = prevState.trebleBeats;
        currentBassBeats = prevState.bassBeats;
        handleSideEffects();

        // Provide visual feedback that undo was successful
        updateNowPlayingDisplay('Undid last action');
        console.log('undoLastWrite output: state reverted.');

    } else if (history.length === 1) {
        resetScore();

        // Provide visual feedback that the score was reset
        updateNowPlayingDisplay('Score reset');
        console.log('undoLastWrite output: score reset (only one state in history).');

    } else {
        // Provide visual feedback that there's nothing to undo
        updateNowPlayingDisplay('Nothing to undo');
        console.log('undoLastWrite output: no history to undo.');
    }
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
        isRest,
        chordName: chordName
    };

    measuresData[currentIndex] ??= []; 
    measuresData[currentIndex].push(noteEntry);

    if (clef === 'treble') {
        currentTrebleBeats += beats;
    } else {
        currentBassBeats += beats;
    }

    // Save history AFTER the change is made, so undo can restore to current state
    saveStateToHistory();

    updateNowPlayingDisplay(chordName);
    handleSideEffects();
    console.log(`writeNote output: Note written. Beats status - Treble: ${currentTrebleBeats}, Bass: ${currentBassBeats}. measuresData:`, measuresData);
}

// ===================================================================
// Public API Functions (Handle side effects)
// ===================================================================

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

    const addedNoteId = doAddNote(measureIndex, noteData, insertBeforeNoteId);

    // Save history AFTER the change is made
    saveStateToHistory();
    handleSideEffects();

    console.log(`addNoteToMeasure output: Note added. Current beats - Treble: ${currentTrebleBeats}, Bass: ${currentBassBeats}.`);
    return addedNoteId;
}

/**
* Removes a note from a specified measure by its ID.
* @param {number} measureIndex - The index of the measure to modify.
* @param {string} noteId - The ID of the note to remove.
* @returns {object|null} The removed note object, or null if not found.
*/
export function removeNoteFromMeasure(measureIndex, noteId) {
    console.log('removeNoteFromMeasure input: measureIndex=', measureIndex, 'noteId=', noteId);

    const removedNote = doRemoveNote(measureIndex, noteId);

    if (removedNote) {
        // Save history AFTER the change is made
        saveStateToHistory();
        handleSideEffects();
        console.log(`removeNoteFromMeasure output: Note with ID ${noteId} removed from measure ${measureIndex}. Removed note:`, removedNote);
    } else {
        console.log('removeNoteFromMeasure output: null (note not found)');
    }

    return removedNote;
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

    // Check if update would cause overflow BEFORE making changes
    if (!measuresData[measureIndex]) {
        console.warn(`Attempted to update note in non-existent measure ${measureIndex}.`);
        return false;
    }

    const noteIndex = measuresData[measureIndex].findIndex(note => note.id === noteId);
    if (noteIndex === -1) {
        console.warn(`Attempted to update non-existent note with ID ${noteId} at measure ${measureIndex}.`);
        return false;
    }

    // Test for overflow using a temporary copy
    const tempMeasure = JSON.parse(JSON.stringify(measuresData[measureIndex]));
    const existingNote = tempMeasure[noteIndex];
    const updatedTempNote = { ...existingNote, ...newNoteData };
    tempMeasure[noteIndex] = updatedTempNote;
    const { trebleBeats, bassBeats } = calculateMeasureBeats(tempMeasure);

    if (trebleBeats > MEASURE_CAPACITY_BEATS || bassBeats > MEASURE_CAPACITY_BEATS) {
        console.warn(`Update to note with ID ${noteId} at measure ${measureIndex} would cause measure overflow. Operation cancelled.`);
        updateNowPlayingDisplay("Error: Update would overflow measure!");
        setTimeout(() => updateNowPlayingDisplay(""), 3000);
        return false;
    }

    // Make the change
    const success = doUpdateNote(measureIndex, noteId, newNoteData);
    if (success) {
        // Save history AFTER the change is made
        saveStateToHistory();
        handleSideEffects();
        console.log(`updateNoteInMeasure output: Note with ID ${noteId} updated at measure ${measureIndex}. Current beats - Treble: ${currentTrebleBeats}, Bass: ${currentBassBeats}.`);
    }

    return success;
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

    // Do the move operation using core functions (no side effects)
    const noteToMove = doRemoveNote(fromMeasureIndex, fromNoteId);
    if (!noteToMove) {
        console.error('Note not found at source for moving (ID:', fromNoteId, ').');
        console.log('moveNoteBetweenMeasures output: false');
        return false;
    }

    // Update the note's measure property
    noteToMove.measure = toMeasureIndex;

    // Ensure the target measure exists
    while (measuresData.length <= toMeasureIndex) {
        measuresData.push([]);
        console.log(`moveNoteBetweenMeasures: Created new empty measure at index ${measuresData.length - 1}`);
    }

    // Add the note to the target measure
    doAddNote(toMeasureIndex, noteToMove, insertBeforeNoteId);

    // Save history AFTER the complete move operation is done
    saveStateToHistory();

    // Handle side effects once at the end
    handleSideEffects();

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

export function resetScore() {
    console.log('resetScore called.');
    measuresData = [];
    currentIndex = 0;
    currentTrebleBeats = 0;
    currentBassBeats = 0;
    history.length = 0;

    // Save the initial empty state so the first note can be undone
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
        // Save the loaded state as the initial state for undo
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