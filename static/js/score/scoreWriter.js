// scoreWriter.js
// This module manages the musical score data, including writing, undo, and state synchronization.

// ===================================================================
// Imports
// ===================================================================
import { pianoState } from "../core/appState.js";
import { NOTES_BY_NAME, identifyChordStrict } from '../core/note-data.js'; // Needed for note name to MIDI mapping for sorting and internal consistency
import { updateNowPlayingDisplay } from '../ui/uiHelpers.js';
import { saveToLocalStorage } from '../utils/ioHelpers.js';
import { drawAll } from './scoreRenderer.js';
// ===================================================================
// Constants
// ===================================================================

const BEAT_VALUES = { q: 1, h: 2, w: 4, '8': 0.5, '16': 0.25, '32': 0.125,
'q.': 1.5, 'h.': 3, 'w.': 6, '8.': 0.75, '16.': 0.375, '32.': 0.1875 };
const AUTOSAVE_KEY = 'autosavedScore';

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
 * Sets the time signature and redraws the score.
 * @param {number} numerator - The top number of the time signature (beats per measure)
 * @param {number} denominator - The bottom number of the time signature (note value that gets the beat)
 */
export function setTimeSignature(numerator, denominator) {
  if (!Number.isInteger(numerator) || numerator <= 0) {
    console.warn("setTimeSignature: Invalid numerator provided");
    return false;
  }
  
  if (!Number.isInteger(denominator) || denominator <= 0) {
    console.warn("setTimeSignature: Invalid denominator provided");
    return false;
  }

  // Update the piano state
  pianoState.timeSignature.numerator = numerator;
  pianoState.timeSignature.denominator = denominator;

  // Redraw the score with new time signature
  drawAll(getMeasures(), true);
  
  // Save to localStorage to persist the change
  saveToLocalStorage();

  // Log the change
  console.log(`Time signature set to: ${numerator}/${denominator}`);

  return true;
}


  export function setTempo(newTempo) {
    if (!Number.isInteger(newTempo) || newTempo < 30 || newTempo > 300) {
        console.warn("setTempo: Invalid tempo provided");
        return false;
    }

   // Update the piano state
  pianoState.tempo = newTempo;

  // Redraw the score with new time signature
  drawAll(getMeasures(), true);
  
  // Save to localStorage to persist the change
  saveToLocalStorage();

  // Log the change
  console.log("Tempo set to:", pianoState.timeSignature.tempo);

  return true;
}

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



function doUpdateNote(measureIndex, noteId, newNoteData) {
    if (!measuresData[measureIndex]) {
        return false;
    }

    const noteIndex = measuresData[measureIndex].findIndex(note => note.id === noteId);
    if (noteIndex === -1) {
        return false;
    }

    const existingNote = measuresData[measureIndex][noteIndex];

// If the name is being changed, strip the chordName
if (newNoteData.name && newNoteData.name !== existingNote.name) {
    console.log('Note Data changed');
    let identifiedChord = undefined;
    
    // Parse the name - could be single note "C4" or chord "(C4 E4 G4)"
    if (newNoteData.name.startsWith('(') && newNoteData.name.endsWith(')')) {
        console.log('chord detected');
        // It's a chord - extract the note names
        const noteNames = newNoteData.name
            .slice(1, -1) // Remove parentheses
            .split(' ');  // Split by spaces
        
        identifiedChord = identifyChordStrict(noteNames) || undefined;
        console.log('chord identified as', identifiedChord);
    }
    // If it's a single note, don't try to identify a chord
    
    newNoteData = { 
        ...newNoteData, 
        chordName: identifiedChord 
    };
}

    // Create a temporary copy to test for overflow
    const tempMeasure = JSON.parse(JSON.stringify(measuresData[measureIndex]));
    const tempExistingNote = tempMeasure[noteIndex];
    const updatedTempNote = { ...tempExistingNote, ...newNoteData };
    tempMeasure[noteIndex] = updatedTempNote;

    const { trebleBeats, bassBeats } = calculateMeasureBeats(tempMeasure);

    // Check for overflow
    if (trebleBeats > pianoState.timeSignature.numerator || bassBeats > pianoState.timeSignature.numerator) {
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
    if (currentBeatsForClef + beats > pianoState.timeSignature.numerator) {
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
// Editor Functions
// ===================================================================

/**
* Inserts a new note at a specified position within a measure.
* This function handles ID generation, overflow checking, and creates new measures if needed.
* @param {number} measureIndex - The index of the measure to modify.
* @param {object} noteData - The note object to insert (without ID).
* @param {string|null} [insertBeforeNoteId=null] - The ID of the note to insert before. If null, appends to end.
* @returns {object|null} Object with {noteId, measureIndex, clef} of the added note, or null if not added due to overflow.
*/
export function addNoteToMeasure(measureIndex, noteData, insertBeforeNoteId = null) {
    console.log('addNoteToMeasure input: measureIndex=', measureIndex, 'noteData=', noteData, 'insertBeforeNoteId=', insertBeforeNoteId);

    // Ensure the target measure exists
    if (!measuresData[measureIndex]) {
        measuresData[measureIndex] = [];
        console.log(`addNoteToMeasure: Initialized new measure ${measureIndex}.`);
    }

    // Generate unique ID for the note if it doesn't have one
    if (!noteData.id) {
        noteData.id = generateUniqueId();
    }

    const targetMeasure = measuresData[measureIndex];
    let insertIndex = -1;

    // Find insertion position
    if (insertBeforeNoteId !== null) {
        insertIndex = targetMeasure.findIndex(note => note.id === insertBeforeNoteId);
        if (insertIndex === -1) {
            console.warn(`addNoteToMeasure: Note with ID ${insertBeforeNoteId} not found in measure ${measureIndex}. Appending to end.`);
        }
    }

    // Create temporary measure to test for overflow
    const tempMeasure = [...targetMeasure];
    if (insertIndex === -1) {
        tempMeasure.push(noteData);
        console.log(`addNoteToMeasure: Preparing to append note to measure ${measureIndex}.`);
    } else {
        tempMeasure.splice(insertIndex, 0, noteData);
        console.log(`addNoteToMeasure: Preparing to insert note at index ${insertIndex} in measure ${measureIndex}.`);
    }

    const { trebleBeats, bassBeats } = calculateMeasureBeats(tempMeasure);

    // Handle overflow by creating new measure
    let finalMeasureIndex = measureIndex;
    if (trebleBeats > pianoState.timeSignature.numerator || bassBeats > pianoState.timeSignature.numerator) {
        console.warn(`addNoteToMeasure: Adding note to measure ${measureIndex} would cause overflow. Creating new measure.`);
        finalMeasureIndex = measuresData.length;
        measuresData[finalMeasureIndex] = [noteData];

        // Update currentIndex if this is the current working measure
        if (measureIndex === currentIndex) {
            currentIndex = finalMeasureIndex;
            const newMeasureBeats = calculateMeasureBeats(measuresData[currentIndex]);
            currentTrebleBeats = newMeasureBeats.trebleBeats;
            currentBassBeats = newMeasureBeats.bassBeats;
        }
    } else {
        // No overflow, insert normally
        measuresData[measureIndex] = tempMeasure;

        // Update current beats if editing the current measure
        if (measureIndex === currentIndex) {
            const updatedBeats = calculateMeasureBeats(measuresData[currentIndex]);
            currentTrebleBeats = updatedBeats.trebleBeats;
            currentBassBeats = updatedBeats.bassBeats;
        }
    }

    // Save history and handle side effects
    saveStateToHistory();
    drawAll(measuresData, true);
    saveToLocalStorage();

    console.log(`addNoteToMeasure output: Note added with ID ${noteData.id}. Current beats - Treble: ${currentTrebleBeats}, Bass: ${currentBassBeats}.`);
    return {
        noteId: noteData.id,
        measureIndex: finalMeasureIndex,
        clef: noteData.clef
    };
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
            drawAll(measuresData, true);
    saveToLocalStorage();
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

    if (trebleBeats > pianoState.timeSignature.numerator || bassBeats > pianoState.timeSignature.numerator) {
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
    drawAll(measuresData, true);
    saveToLocalStorage();
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
    drawAll(measuresData, true);
    saveToLocalStorage();

    console.log(`moveNoteBetweenMeasures output: true. Note with ID ${fromNoteId} moved successfully.`);
    return true;
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

/**
 * Ensures both bass and treble clefs are at the same position by adding rests to whichever is behind
 * This allows simultaneous notes in different clefs to align properly
 */
export function fillRests() {
  console.log('fillRests called. Current beats - Treble:', currentTrebleBeats, 'Bass:', currentBassBeats);
  
  // If they're already equal, no rests needed
  if (currentTrebleBeats === currentBassBeats) {
    console.log('fillRests: Clefs already aligned, no rests needed');
    return;
  }
  
  // Determine which clef is behind and by how much
  const beatDifference = Math.abs(currentTrebleBeats - currentBassBeats);
  const isBassBehind = currentBassBeats < currentTrebleBeats;
  
  console.log(`fillRests: ${isBassBehind ? 'Bass' : 'Treble'} clef is behind by ${beatDifference} beats`);
  
  // Convert beat difference to duration
  // Handle common beat values - extend this as needed
  let restDuration;
  if (beatDifference === 4) restDuration = 'w';
  else if (beatDifference === 3) restDuration = 'h.';
  else if (beatDifference === 2) restDuration = 'h';
  else if (beatDifference === 1.5) restDuration = 'q.';
  else if (beatDifference === 1) restDuration = 'q';
  else if (beatDifference === 0.75) restDuration = '8.';
  else if (beatDifference === 0.5) restDuration = '8';
  else if (beatDifference === 0.375) restDuration = '16.';
  else if (beatDifference === 0.25) restDuration = '16';
  else if (beatDifference === 0.1875) restDuration = '32.';
  else if (beatDifference === 0.125) restDuration = '32';
  else {
    // For complex differences, use multiple quarter note rests
    console.warn(`fillRests: Complex beat difference ${beatDifference}, using multiple quarter rests`);
    const numQuarterRests = Math.floor(beatDifference);
    const remainder = beatDifference - numQuarterRests;
    
    // Add the whole note rests first
    for (let i = 0; i < numQuarterRests; i++) {
      writeNote({
        clef: isBassBehind ? "bass" : "treble",
        duration: "q",
        notes: [isBassBehind ? "D3" : "B4"],
        chordName: "Rest",
        isRest: true
      });
    }
    
    // Handle remainder if any
    if (remainder > 0) {
      let remainderDuration;
      if (remainder === 0.5) remainderDuration = '8';
      else if (remainder === 0.75) remainderDuration = '8.';
      else if (remainder === 0.25) remainderDuration = '16';
      else if (remainder === 0.375) remainderDuration = '16.';
      else if (remainder === 0.125) remainderDuration = '32';
      else if (remainder === 0.1875) remainderDuration = '32.';
      else {
        console.warn(`fillRests: Unusual remainder ${remainder}, skipping`);
        return;
      }
      
      writeNote({
        clef: isBassBehind ? "bass" : "treble",
        duration: remainderDuration,
        notes: [isBassBehind ? "D3" : "B4"],
        chordName: "Rest",
        isRest: true
      });
    }
    return;
  }
  
  // Add the rest to catch up the behind clef
  writeNote({
    clef: isBassBehind ? "bass" : "treble",
    duration: restDuration,
    notes: [isBassBehind ? "D3" : "B4"], // Standard rest positions
    chordName: "Rest",
    isRest: true
  });
  
  console.log(`fillRests: Added ${restDuration} rest to ${isBassBehind ? 'bass' : 'treble'} clef`);
}