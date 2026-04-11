// scoreWriter.js
// This module manages the musical score data, including writing, undo, and state synchronization.

// ===================================================================
// Imports
// ===================================================================
import { pianoState } from "../core/appState.js";
import { NOTES_BY_NAME, identifyChordStrict, transposeNote } from '../core/note-data.js';
import { updateNowPlayingDisplay } from '../ui/uiHelpers.js';
import { saveToLocalStorage } from '../utils/ioHelpers.js';
import { drawAll, scrollToMeasure } from './scoreRenderer.js';
import { humanizeNote, humanizeDuration } from '../utils/velocityHumanizer.js';
// ===================================================================
// Constants
// ===================================================================

const BEAT_VALUES = { q: 1, h: 2, w: 4, '8': 0.5, '16': 0.25, '32': 0.125,
'q.': 1.5, 'h.': 3, '8.': 0.75, '16.': 0.375, '32.': 0.1875 };
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

// Write queue to prevent race conditions during rapid note entry
let writeQueue = [];
let isProcessingQueue = false;

function processWriteQueue() {
    if (isProcessingQueue) return;

    isProcessingQueue = true;

    while (writeQueue.length > 0) {
        const noteData = writeQueue.shift();
        try {
            const result = writeNoteInternal(noteData);

            // Dispatch event with the note information if note was successfully added
            if (result) {
                const event = new CustomEvent('noteAddedToScore', {
                    detail: result
                });
                document.dispatchEvent(event);
            }
        } catch (error) {
            console.error('Error processing note write:', error);
        }
    }

    isProcessingQueue = false;
}

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

  return true;
}

/**
* Calculates the total beats for treble and bass clefs within a given measure.
* This function is used to ensure data integrity by calculating beats on demand.
* @param {Array} measure - An array of note objects for a single measure.
* @returns {{trebleBeats: number, bassBeats: number}} Object with total beats for each clef.
*/
function calculateMeasureBeats(measure) {
    let trebleBeats = 0;
    let bassBeats = 0;

    console.log('beatcount: calculateMeasureBeats starting', { measureLength: measure.length });

    measure.forEach(note => {
        const beats = BEAT_VALUES[note.duration] || 0;
        if (note.clef === 'treble') {
            trebleBeats += beats;
            console.log('beatcount: treble note added', { duration: note.duration, beats, totalTrebleBeats: trebleBeats });
        } else if (note.clef === 'bass') {
            bassBeats += beats;
            console.log('beatcount: bass note added', { duration: note.duration, beats, totalBassBeats: bassBeats });
        }
    });
    console.log('beatcount: calculateMeasureBeats result', { trebleBeats, bassBeats });
    return { trebleBeats, bassBeats };
}

function saveStateToHistory() {
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
    }

    // Recalculate current beats
    if (measuresData[currentIndex]) {
        console.log('beatcount: recalculating beats after note removal', { currentIndex });
        const updatedBeats = calculateMeasureBeats(measuresData[currentIndex]);
        currentTrebleBeats = updatedBeats.trebleBeats;
        currentBassBeats = updatedBeats.bassBeats;
        console.log('beatcount: updated currentBeats', { currentTrebleBeats, currentBassBeats });
    } else {
        console.log('beatcount: resetting beats - no measure at currentIndex', { currentIndex });
        currentTrebleBeats = 0;
        currentBassBeats = 0;
        currentIndex = 0;
        measuresData[0] = [];
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

    // If the name is being changed, update the chordName with fallback logic
    if (newNoteData.name && newNoteData.name !== existingNote.name) {
        let chordName = undefined;
        
        // Parse the name - could be single note "C4" or chord "(C4 E4 G4)"
        if (newNoteData.name.startsWith('(') && newNoteData.name.endsWith(')')) {
            // It's a chord - extract the note names
            const noteNames = newNoteData.name
                .slice(1, -1) // Remove parentheses
                .split(' ');  // Split by spaces
            
            // Try to identify the chord
            chordName = identifyChordStrict(noteNames);
            
            // If no chord identified, use the formatted note names as fallback
            if (!chordName) {
                chordName = newNoteData.name; // Use the full formatted name like "(C4 E4 G4)"
            }
        } else {
            // It's a single note - use the note name directly
            chordName = newNoteData.name;
        }
        
        // Special handling for rests
        if (newNoteData.isRest) {
            chordName = "Rest";
        }
        
        newNoteData = { 
            ...newNoteData, 
            chordName: chordName 
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
        console.log('beatcount: updating current beats after note update', { measureIndex });
        const updatedBeats = calculateMeasureBeats(measuresData[currentIndex]);
        currentTrebleBeats = updatedBeats.trebleBeats;
        currentBassBeats = updatedBeats.bassBeats;
        console.log('beatcount: currentBeats after update', { currentTrebleBeats, currentBassBeats });
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

    } else if (history.length === 1) {
        resetScore();

        // Provide visual feedback that the score was reset
        updateNowPlayingDisplay('Score reset');

    } else {
        // Provide visual feedback that there's nothing to undo
        updateNowPlayingDisplay('Nothing to undo');
    }
}

export function writeNote(obj) {
    // Don't write notes to the score during play-along mode
    // Input will be handled by the play-along controller instead
    if (pianoState.playAlong?.active) {
        return;
    }

    // Queue the write and process sequentially to prevent race conditions
    // Note: Due to the queue processing, we cannot directly return the result
    // The result will be available through the noteAddedToScore event
    writeQueue.push(obj);
    processWriteQueue();
}

function writeNoteInternal(obj) {

    const { clef, duration, notes, chordName, isRest = false } = obj;
    const beats = BEAT_VALUES[duration];

    console.log('beatcount: writeNoteInternal starting', {
        clef,
        duration,
        beats,
        currentTrebleBeats,
        currentBassBeats,
        currentIndex,
        timeSignatureNumerator: pianoState.timeSignature.numerator
    });

    // Ensure `notes` are always an array and create formatted name
    const notesArray = Array.isArray(notes) ? notes : [notes];
    let formattedName = notesArray.length > 1
        ? `(${notesArray.sort((a, b) => NOTES_BY_NAME[a] - NOTES_BY_NAME[b]).join(' ')})`
        : notesArray[0];
    
    // For rests, ensure we have a valid position name for VexFlow rendering
    // Use B4 for treble, D3 for bass (standard rest positions)
    if (isRest && (!formattedName || formattedName === 'rest')) {
        formattedName = clef === 'bass' ? 'D3' : 'B4';
    }

    // Determine the display name - use chordName if provided, otherwise try to identify chord, otherwise use note name(s)
    let displayName = chordName;
    if (!displayName && !isRest) {
        // Try to identify chord if multiple notes
        if (notesArray.length > 1) {
            displayName = identifyChordStrict(notesArray) || formattedName;
        } else {
            // For single notes, just use the note name
            displayName = notesArray[0];
        }
    } else if (!displayName && isRest) {
        displayName = "Rest";
    }

    const currentBeatsForClef = clef === 'treble' ? currentTrebleBeats : currentBassBeats;
    const availableBeats = pianoState.timeSignature.numerator - currentBeatsForClef;

    console.log('beatcount: checking overflow', {
        clef,
        currentBeatsForClef,
        availableBeats,
        beats,
        wouldOverflow: beats > availableBeats
    });

    // Check if the note would overflow and if it can be split with a tie
    if (availableBeats > 0 && beats > availableBeats && !isRest) {
        console.log('beatcount: attempting to split note with tie', { availableBeats, beats });
        const splitResult = splitNoteForTie(duration, availableBeats);
        
        if (splitResult) {
            
            // Create first note (fits in current measure)
            const firstNoteId = generateUniqueId();
            const firstNoteEntry = { 
                id: firstNoteId,
                name: formattedName, 
                clef, 
                duration: splitResult.firstDuration, 
                measure: currentIndex, 
                isRest: false,
                chordName: displayName,
                performedDuration: humanizeDuration(),
                velocity: humanizeNote()
            };

            measuresData[currentIndex] ??= []; 
            measuresData[currentIndex].push(firstNoteEntry);

            // Update beats for current measure
            if (clef === 'treble') {
                currentTrebleBeats += BEAT_VALUES[splitResult.firstDuration];
                console.log('beatcount: updated treble beats after first tied note', { currentTrebleBeats });
            } else {
                currentBassBeats += BEAT_VALUES[splitResult.firstDuration];
                console.log('beatcount: updated bass beats after first tied note', { currentBassBeats });
            }

            // Advance to next measure
            currentIndex++;
            measuresData[currentIndex] = [];
            currentTrebleBeats = 0;
            currentBassBeats = 0;
            console.log('beatcount: advanced to next measure for tied note', { currentIndex });

            // Create second note (in new measure)
            const secondNoteId = generateUniqueId();
            const secondNoteEntry = {
                id: secondNoteId,
                name: formattedName,
                clef,
                duration: splitResult.secondDuration,
                measure: currentIndex,
                isRest: false,
                chordName: displayName,
                performedDuration: humanizeDuration(),
                velocity: humanizeNote()
            };

            measuresData[currentIndex].push(secondNoteEntry);

            // Update beats for new measure
            if (clef === 'treble') {
                currentTrebleBeats += BEAT_VALUES[splitResult.secondDuration];
                console.log('beatcount: updated treble beats after second tied note', { currentTrebleBeats });
            } else {
                currentBassBeats += BEAT_VALUES[splitResult.secondDuration];
                console.log('beatcount: updated bass beats after second tied note', { currentBassBeats });
            }

            // Create the tie between the two notes
            createTieBetweenNotes(firstNoteId, secondNoteId, 'tie');

            // Save history and handle side effects
            saveStateToHistory();
            updateNowPlayingDisplay(`${displayName} (tied)`);
            handleSideEffects();

            // Return the second note info (the note in the new measure)
            return {
                noteId: secondNoteId,
                measureIndex: currentIndex,
                clef: clef
            };
        }
    }

    // If we can't split or don't need to split, use original logic
    if (currentBeatsForClef + beats > pianoState.timeSignature.numerator) {
        console.log('beatcount: note would overflow measure, advancing to next', {
            currentBeatsForClef,
            beats,
            sum: currentBeatsForClef + beats,
            numerator: pianoState.timeSignature.numerator
        });
        // Only advance if the current measure has any notes in it
        if (measuresData[currentIndex] && (measuresData[currentIndex].length > 0 || currentTrebleBeats > 0 || currentBassBeats > 0)) {
            currentIndex++;
            console.log('beatcount: advanced to new measure', { currentIndex });
        }
        measuresData[currentIndex] = [];
        currentTrebleBeats = 0;
        currentBassBeats = 0;
        console.log('beatcount: reset beats for new measure', { currentTrebleBeats, currentBassBeats });
    }

    const newNoteId = generateUniqueId(); 
    const noteEntry = { 
        id: newNoteId,
        name: formattedName, 
        clef, 
        duration, 
        measure: currentIndex, 
        isRest,
        chordName: displayName,
        performedDuration: humanizeDuration(),
        velocity: humanizeNote()
    };

    measuresData[currentIndex] ??= [];
    measuresData[currentIndex].push(noteEntry);

    if (clef === 'treble') {
        currentTrebleBeats += beats;
        console.log('beatcount: added treble note to measure', {
            currentIndex,
            beats,
            currentTrebleBeats,
            noteId: newNoteId
        });
    } else {
        currentBassBeats += beats;
        console.log('beatcount: added bass note to measure', {
            currentIndex,
            beats,
            currentBassBeats,
            noteId: newNoteId
        });
    }

    console.log('beatcount: writeNoteInternal completed', {
        currentIndex,
        currentTrebleBeats,
        currentBassBeats
    });

    saveStateToHistory();
    updateNowPlayingDisplay(displayName);
    handleSideEffects();

    // Return the note information
    return {
        noteId: newNoteId,
        measureIndex: currentIndex,
        clef: clef
    };
}
// ===================================================================
// Editor Functions
// ===================================================================

export function addNoteToMeasure(measureIndex, noteData, insertBeforeNoteId = null) {

    // Ensure the target measure exists
    if (!measuresData[measureIndex]) {
        measuresData[measureIndex] = [];
    }

    // Generate unique ID for the note if it doesn't have one
    if (!noteData.id) {
        noteData.id = generateUniqueId();
    }

    // Add default performedDuration and velocity if not present
    if (noteData.performedDuration === undefined) {
        noteData.performedDuration = humanizeDuration();
    }
    if (noteData.velocity === undefined) {
        noteData.velocity = humanizeNote();
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
    } else {
        tempMeasure.splice(insertIndex, 0, noteData);
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
            console.log('beatcount: updating beats after overflow in addNoteToMeasure', { currentIndex });
            const newMeasureBeats = calculateMeasureBeats(measuresData[currentIndex]);
            currentTrebleBeats = newMeasureBeats.trebleBeats;
            currentBassBeats = newMeasureBeats.bassBeats;
            console.log('beatcount: currentBeats after overflow in addNoteToMeasure', { currentTrebleBeats, currentBassBeats });
        }
    } else {
        // No overflow, insert normally
        measuresData[measureIndex] = tempMeasure;

        // Update current beats if editing the current measure
        if (measureIndex === currentIndex) {
            console.log('beatcount: updating beats in addNoteToMeasure', { measureIndex });
            const updatedBeats = calculateMeasureBeats(measuresData[currentIndex]);
            currentTrebleBeats = updatedBeats.trebleBeats;
            currentBassBeats = updatedBeats.bassBeats;
            console.log('beatcount: currentBeats after addNoteToMeasure', { currentTrebleBeats, currentBassBeats });
        }
    }

    // Ensure the note's measure property is correctly set to the final measure
    noteData.measure = finalMeasureIndex;

    // Save history and handle side effects
    saveStateToHistory();
    drawAll(measuresData, true);
    saveToLocalStorage();

    return {
        noteId: noteData.id,
        measureIndex: finalMeasureIndex,
        clef: noteData.clef
    };
}

// ===================================================================
// Measure Management Functions
// ===================================================================

/**
 * Re-numbers the `measure` property on all notes to match their array position.
 * Call this after inserting, deleting, or moving measures.
 */
function renumberMeasures() {
    measuresData.forEach((measure, measureIndex) => {
        if (Array.isArray(measure)) {
            measure.forEach(note => {
                note.measure = measureIndex;
            });
        }
    });
}

/**
 * Inserts a new measure after the specified index.
 * @param {number} afterMeasureIndex - The index after which to insert (0-based). Use -1 to insert at the beginning.
 * @param {Array} newMeasureData - Optional array of notes for the new measure (defaults to empty)
 * @returns {number} The index of the newly inserted measure
 */
export function insertMeasure(afterMeasureIndex, newMeasureData = []) {
    const insertAtIndex = afterMeasureIndex + 1;
    
    // Ensure the new measure data has proper note structure
    const preparedMeasure = newMeasureData.map(note => ({
        ...note,
        id: note.id || generateUniqueId(),
        measure: insertAtIndex
    }));
    
    // Insert the new measure into the array
    measuresData.splice(insertAtIndex, 0, preparedMeasure);
    
    // Re-number all measures after the insertion point
    renumberMeasures();
    
    saveStateToHistory();
    drawAll(measuresData, true);
    saveToLocalStorage();
    
    console.log(`Inserted new measure at index ${insertAtIndex}`);
    return insertAtIndex;
}

/**
 * Deletes a measure at the specified index.
 * @param {number} measureIndex - The index of the measure to delete (0-based)
 * @returns {boolean} True if successful, false if not
 */
export function deleteMeasure(measureIndex) {
    // Don't allow deleting if it's the only measure
    if (measuresData.length <= 1) {
        console.warn('Cannot delete the only measure');
        return false;
    }
    
    // Validate index
    if (measureIndex < 0 || measureIndex >= measuresData.length) {
        console.warn(`Invalid measure index: ${measureIndex}`);
        return false;
    }
    
    // Remove ties for all notes in the measure being deleted
    const measureToDelete = measuresData[measureIndex];
    if (Array.isArray(measureToDelete)) {
        measureToDelete.forEach(note => {
            if (note.id) {
                removeTiesForNote(note.id);
            }
        });
    }
    
    // Remove the measure
    measuresData.splice(measureIndex, 1);
    
    // Re-number all remaining measures
    renumberMeasures();
    
    saveStateToHistory();
    drawAll(measuresData, true);
    saveToLocalStorage();
    
    console.log(`Deleted measure at index ${measureIndex}`);
    return true;
}

/**
 * Duplicates a measure and inserts the copy after the original.
 * @param {number} measureIndex - The index of the measure to duplicate (0-based)
 * @returns {number|false} The index of the new duplicated measure, or false if failed
 */
export function duplicateMeasure(measureIndex) {
    // Validate index
    if (measureIndex < 0 || measureIndex >= measuresData.length) {
        console.warn(`Invalid measure index: ${measureIndex}`);
        return false;
    }
    
    const originalMeasure = measuresData[measureIndex];
    if (!Array.isArray(originalMeasure)) {
        console.warn(`Measure at index ${measureIndex} is not valid`);
        return false;
    }
    
    // Deep clone the measure and generate new IDs for all notes
    const duplicatedNotes = originalMeasure.map(note => ({
        ...note,
        id: generateUniqueId(), // New unique ID for the duplicated note
        tie: undefined // Don't copy ties - they reference specific note IDs
    }));
    
    // Insert after the original measure
    const newIndex = insertMeasure(measureIndex, duplicatedNotes);
    
    console.log(`Duplicated measure ${measureIndex} to new measure ${newIndex}`);
    return newIndex;
}

/**
 * Moves a measure to the end of the score.
 * @param {number} measureIndex - The index of the measure to move (0-based)
 * @returns {number|false} The new index of the moved measure, or false if failed
 */
export function moveMeasureToEnd(measureIndex) {
    // Validate index
    if (measureIndex < 0 || measureIndex >= measuresData.length) {
        console.warn(`Invalid measure index: ${measureIndex}`);
        return false;
    }
    
    // If it's already at the end, nothing to do
    if (measureIndex === measuresData.length - 1) {
        console.log('Measure is already at the end');
        return measureIndex;
    }
    
    // Remove the measure from its current position
    const [movedMeasure] = measuresData.splice(measureIndex, 1);
    
    // Add it to the end
    measuresData.push(movedMeasure);
    
    // Re-number all measures
    renumberMeasures();
    
    saveStateToHistory();
    drawAll(measuresData, true);
    saveToLocalStorage();
    
    const newIndex = measuresData.length - 1;
    console.log(`Moved measure from index ${measureIndex} to ${newIndex}`);
    return newIndex;
}

// ===================================================================
// Note Manipulation Functions
// ===================================================================

/**
 * Mapping of durations to their split equivalents.
 * Each duration splits into two notes of the smaller duration.
 */
const SPLIT_DURATION_MAP = {
    'w':   'h',      // whole → 2 halves
    'h':   'q',      // half → 2 quarters
    'q':   '8',      // quarter → 2 eighths
    '8':   '16',     // eighth → 2 sixteenths
    '16':  '32',     // sixteenth → 2 thirty-seconds
    '32':  null,     // can't split
    'h.':  'q.',     // dotted half → 2 dotted quarters
    'q.':  '8.',     // dotted quarter → 2 dotted eighths
    '8.':  '16.',    // dotted eighth → 2 dotted sixteenths
    '16.': '32.',    // dotted sixteenth → 2 dotted thirty-seconds
    '32.': null      // can't split
};

/**
 * Splits a note into two notes of half the duration.
 * The original note keeps its ID and becomes the first note.
 * A new note is created immediately after with a new ID.
 * Ties involving the original note are removed.
 * 
 * @param {number} measureIndex - The measure containing the note
 * @param {string} noteId - The ID of the note to split
 * @returns {object|false} { firstNoteId, secondNoteId } on success, false if can't split
 */
export function splitNote(measureIndex, noteId) {
    // Validate measure
    if (!measuresData[measureIndex]) {
        console.warn(`splitNote: Invalid measure index ${measureIndex}`);
        return false;
    }
    
    // Find the note
    const measure = measuresData[measureIndex];
    const noteIndex = measure.findIndex(n => n.id === noteId);
    if (noteIndex === -1) {
        console.warn(`splitNote: Note ${noteId} not found in measure ${measureIndex}`);
        return false;
    }
    
    const originalNote = measure[noteIndex];
    const newDuration = SPLIT_DURATION_MAP[originalNote.duration];
    
    // Check if this duration can be split
    if (!newDuration) {
        console.warn(`splitNote: Cannot split duration '${originalNote.duration}' - already at minimum`);
        return false;
    }
    
    // Remove any ties involving this note
    removeTiesForNote(noteId);
    
    // Update the original note's duration
    originalNote.duration = newDuration;
    
    // Create the second note as a copy with new ID
    const secondNote = {
        ...originalNote,
        id: generateUniqueId(),
        duration: newDuration,
        tie: undefined  // Don't copy ties
    };
    
    // Insert the second note right after the original
    measure.splice(noteIndex + 1, 0, secondNote);
    
    saveStateToHistory();
    drawAll(measuresData, true);
    saveToLocalStorage();
    
    console.log(`Split note ${noteId} (${originalNote.duration}) into two ${newDuration} notes`);
    return {
        firstNoteId: originalNote.id,
        secondNoteId: secondNote.id
    };
}

/**
* Removes a note from a specified measure by its ID.
* Also removes any ties involving this note.
*/
export function removeNoteFromMeasure(measureIndex, noteId) {

    // Remove ties first
    removeTiesForNote(noteId);

    const removedNote = doRemoveNote(measureIndex, noteId);

    if (removedNote) {
        saveStateToHistory();
        drawAll(measuresData, true);
        saveToLocalStorage();
    }

    return removedNote;
}

/**
* Updates an existing note's properties by its ID.
* Removes any existing ties involving this note.
*/
export function updateNoteInMeasure(measureIndex, noteId, newNoteData) {

    // Remove ties when note is updated (since the note characteristics might change)
    removeTiesForNote(noteId);

    // Rest of the existing updateNoteInMeasure logic...
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

    const success = doUpdateNote(measureIndex, noteId, newNoteData);
    if (success) {
        saveStateToHistory();
        drawAll(measuresData, true);
        saveToLocalStorage();
        // Scroll to the updated note so user can see the change
        scrollToMeasure(measureIndex, true);
    }

    return success;
}


/**
 * Places a note at a specific position in the score.
 * Can handle: adding new notes, moving existing notes between/within measures, and updating during move.
 * @param {number|null} fromMeasureIndex - Source measure index (null for new notes)
 * @param {string|null} fromNoteId - Source note ID (null for new notes)  
 * @param {number} toMeasureIndex - Target measure index
 * @param {object} noteData - Note data (required for new notes, optional updates for existing)
 * @param {string|null} insertBeforeNoteId - ID of note to insert before (null to append)
 * @returns {object|boolean} {noteId, measureIndex} on success, false on failure
 */
export function placeNote(fromMeasureIndex, fromNoteId, toMeasureIndex, noteData, insertBeforeNoteId = null) {

    let noteToPlace = noteData;

    // Remove existing note if source is specified
    if (fromMeasureIndex !== null && fromMeasureIndex !== undefined && 
        fromNoteId !== null && fromNoteId !== undefined) {
        
        // Remove ties when note is moved/repositioned
        removeTiesForNote(fromNoteId);
        
        const existingNote = doRemoveNote(fromMeasureIndex, fromNoteId);
        if (!existingNote) {
            console.error('placeNote: Note not found at source (ID:', fromNoteId, ')');
            return false;
        }
        
        // Merge existing note with any updates
        noteToPlace = { ...existingNote, ...noteData };
    }

    // Apply chord name generation logic
    noteToPlace = applyChordNameGeneration(noteToPlace);

    // Ensure note has required properties
    if (!noteToPlace.id) {
        noteToPlace.id = generateUniqueId();
    }
    noteToPlace.measure = toMeasureIndex;

    // Ensure target measure exists
    while (measuresData.length <= toMeasureIndex) {
        measuresData.push([]);
    }

    // Pre-check for overflow before adding
    if (!wouldOverflowAfterAdd(toMeasureIndex, noteToPlace, insertBeforeNoteId)) {
        console.warn('placeNote: Adding note would cause measure overflow. Operation cancelled.');
        updateNowPlayingDisplay("Error: Placement would overflow measure!");
        setTimeout(() => updateNowPlayingDisplay(""), 3000);
        return false;
    }

    // Place the note at the target position
    const success = doAddNote(toMeasureIndex, noteToPlace, insertBeforeNoteId);
    
    if (!success) {
        console.error('placeNote: Failed to add note to target measure');
        return false;
    }

    // Update current beats if we modified the current measure
    if (toMeasureIndex === currentIndex) {
        console.log('beatcount: updating beats after placeNote', { toMeasureIndex });
        const updatedBeats = calculateMeasureBeats(measuresData[currentIndex]);
        currentTrebleBeats = updatedBeats.trebleBeats;
        currentBassBeats = updatedBeats.bassBeats;
        console.log('beatcount: currentBeats after placeNote', { currentTrebleBeats, currentBassBeats });
    }

    // Handle side effects
    saveStateToHistory();
    drawAll(measuresData, true);
    saveToLocalStorage();

    return {
        noteId: noteToPlace.id,
        measureIndex: toMeasureIndex
    };
}

/**
 * Populates or corrects the chordName field on every note in the given measures.
 * Uses identifyChordStrict to identify chords; falls back to the note's name.
 * @param {Array} [measures] - Array of measures to process. Defaults to internal measuresData.
 * @param {boolean} [useSymbol=false] - If true, uses short chord symbol (e.g. "Cmaj6") instead of displayName.
 */
export function populateChordNames(measures, useSymbol = false) {
    const target = measures || measuresData;
    target.forEach(measure => {
        if (!Array.isArray(measure)) return;
        measure.forEach((note, i) => {
            const updated = applyChordNameGeneration(note, useSymbol);
            measure[i] = updated;
        });
    });
}

/**
 * Applies chord name generation logic
 */
function applyChordNameGeneration(noteData, useSymbol = false) {
    const processedData = { ...noteData };

    // If we have a name, generate the appropriate chordName
    if (processedData.name) {
        let chordName = undefined;

        // Parse the name - could be single note "C4" or chord "(C4 E4 G4)"
        if (processedData.name.startsWith('(') && processedData.name.endsWith(')')) {
            // It's a chord - extract the note names
            const noteNames = processedData.name
                .slice(1, -1) // Remove parentheses
                .split(' ');  // Split by spaces

            // Try to identify the chord
            chordName = identifyChordStrict(noteNames, useSymbol);
            
            // If no chord identified, use the formatted note names as fallback
            if (!chordName) {
                chordName = processedData.name;
            }
        } else {
            // It's a single note - use the note name directly
            chordName = processedData.name;
        }
        
        // Special handling for rests
        if (processedData.isRest) {
            chordName = useSymbol ? null : "Rest";
        }
        
        processedData.chordName = chordName;
    }

    return processedData;
}

/**
 * Checks if adding a note would cause measure overflow
 */
function wouldOverflowAfterAdd(measureIndex, noteToAdd, insertBeforeNoteId) {
    // Create a temporary measure to test overflow
    const tempMeasure = measuresData[measureIndex] ? 
        JSON.parse(JSON.stringify(measuresData[measureIndex])) : [];
    
    // Find insertion position
    let insertIndex = tempMeasure.length; // Default to end
    if (insertBeforeNoteId) {
        const beforeIndex = tempMeasure.findIndex(note => note.id === insertBeforeNoteId);
        if (beforeIndex !== -1) {
            insertIndex = beforeIndex;
        }
    }
    
    // Insert the note into temp measure
    tempMeasure.splice(insertIndex, 0, noteToAdd);
    
    // Check for overflow
    const { trebleBeats, bassBeats } = calculateMeasureBeats(tempMeasure);
    
    return trebleBeats <= pianoState.timeSignature.numerator && 
           bassBeats <= pianoState.timeSignature.numerator;
}


export function resetScore() {
    measuresData = [];
    currentIndex = 0;
    currentTrebleBeats = 0;
    currentBassBeats = 0;
    history.length = 0;
    pianoState.title = '';

    // Save the initial empty state so the first note can be undone
    saveStateToHistory();

    saveToLocalStorage();
    updateNowPlayingDisplay('');
    drawAll(measuresData);
}

export function processAndSyncScore(loadedData) {
    if (!Array.isArray(loadedData) || loadedData.flat().length === 0) {
        console.error("Loaded data is invalid or empty. Cannot process.");
        return false;
    }

    try {
        measuresData = JSON.parse(JSON.stringify(loadedData));
        currentIndex = measuresData.length > 0 ? measuresData.length - 1 : 0;

        // Populate or correct chordName on every note
        populateChordNames();

        // Validate and restore ties from loaded data
        validateAndRestoreTies();

        // Recalculate current beats based on the last measure of loaded data
        if (measuresData[currentIndex]) {
            console.log('beatcount: recalculating beats from loaded data', { currentIndex });
            const lastMeasureBeats = calculateMeasureBeats(measuresData[currentIndex]);
            currentTrebleBeats = lastMeasureBeats.trebleBeats;
            currentBassBeats = lastMeasureBeats.bassBeats;
            console.log('beatcount: beats from loaded data', { currentTrebleBeats, currentBassBeats });
        } else {
            console.log('beatcount: no measure found, resetting beats');
            currentTrebleBeats = 0;
            currentBassBeats = 0;
        }

        history.length = 0;
        // Save the loaded state as the initial state for undo
        saveStateToHistory();

        saveToLocalStorage();

        return true;

    } catch (e) {
        console.error("An error occurred while processing the score:", e);
        return false;
    }
}

export function getMeasures() {
    return measuresData;
}

/**
 * Ensures both bass and treble clefs are at the same position by adding rests to whichever is behind
 * This allows simultaneous notes in different clefs to align properly
 */
export function fillRests() {
  
  // If they're already equal, no rests needed
  if (currentTrebleBeats === currentBassBeats) {
    return;
  }
  
  // Determine which clef is behind and by how much
  const beatDifference = Math.abs(currentTrebleBeats - currentBassBeats);
  const isBassBehind = currentBassBeats < currentTrebleBeats;
  
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
}


// ===================================================================
// Tie Management Functions
// ===================================================================

/**
 * Splits a note duration into two parts for tying across measures
 * @param {string} duration - Original duration (e.g., 'h', 'q', '8')
 * @param {number} availableBeats - How many beats are available in current measure
 * @returns {object|null} {firstDuration, secondDuration} or null if can't split
 */
function splitNoteForTie(duration, availableBeats) {
    console.log('beatcount: splitNoteForTie called', { duration, availableBeats });

    // Check if ties are enabled
    if (!pianoState.enableTies) {
        console.log('beatcount: ties disabled, cannot split');
        return null;
    }

    const totalBeats = BEAT_VALUES[duration];
    if (!totalBeats || availableBeats >= totalBeats) {
        console.log('beatcount: no split needed', { totalBeats, availableBeats });
        return null; // No split needed
    }

    const remainingBeats = totalBeats - availableBeats;
    console.log('beatcount: calculating split', { totalBeats, availableBeats, remainingBeats });

    // Find the best duration values for each part
    const firstDuration = findBestDuration(availableBeats);
    const secondDuration = findBestDuration(remainingBeats);

    console.log('beatcount: split result', { firstDuration, secondDuration });

    if (firstDuration && secondDuration) {
        console.log('beatcount: returning split', { firstDuration, secondDuration });
        return { firstDuration, secondDuration };
    }

    console.log('beatcount: could not find valid durations for split');
    return null;
}

/**
 * Finds the best duration string for a given number of beats
 * @param {number} beats - Number of beats
 * @returns {string|null} Duration string or null if no exact match
 */
function findBestDuration(beats) {
    console.log('beatcount: findBestDuration called with beats:', beats);

    // Find exact matches first
    for (const [duration, value] of Object.entries(BEAT_VALUES)) {
        if (value === beats) {
            console.log('beatcount: found exact match:', duration, 'for', beats, 'beats');
            return duration;
        }
    }

    console.log('beatcount: no exact match found for', beats, 'beats');
    return null;
}

/**
 * Validates and restores ties from loaded score data
 * Ensures that both notes in a tie relationship exist
 * @returns {object} Statistics about restored ties {total, valid, invalid}
 */
function validateAndRestoreTies() {
    const stats = { total: 0, valid: 0, invalid: 0 };
    
    // Build a map of all note IDs for quick lookup
    const noteIdMap = new Map();
    measuresData.forEach((measure, measureIndex) => {
        if (measure) {
            measure.forEach(note => {
                if (note.id) {
                    noteIdMap.set(note.id, { measureIndex, note });
                }
            });
        }
    });
    
    // Validate all ties
    measuresData.forEach(measure => {
        if (measure) {
            measure.forEach(note => {
                if (note.tie) {
                    stats.total++;
                    
                    // Check if both notes in the tie exist
                    const startExists = noteIdMap.has(note.tie.startNoteId);
                    const endExists = noteIdMap.has(note.tie.endNoteId);
                    
                    if (startExists && endExists) {
                        stats.valid++;
                    } else {
                        stats.invalid++;
                        console.warn(`Invalid tie found: start=${note.tie.startNoteId} (${startExists}), end=${note.tie.endNoteId} (${endExists}). Removing.`);
                        delete note.tie;
                    }
                }
            });
        }
    });
    
    return stats;
}

/**
 * Removes all ties involving a specific note
 * @param {string} noteId - ID of the note whose ties should be removed
 */
function removeTiesForNote(noteId) {
    let tiesRemoved = 0;
    
    // Go through all measures and remove tie information
    measuresData.forEach(measure => {
        if (measure) {
            measure.forEach(note => {
                if (note.tie) {
                    // If this note is involved in the tie, remove the tie
                    if (note.tie.startNoteId === noteId || note.tie.endNoteId === noteId) {
                        delete note.tie;
                        tiesRemoved++;
                    }
                }
            });
        }
    });
    
    return tiesRemoved;
}

/**
 * Creates a tie between two notes
 * @param {string} startNoteId - ID of the first note
 * @param {string} endNoteId - ID of the second note
 * @param {string} type - Type of tie ('tie' or 'slur')
 */
function createTieBetweenNotes(startNoteId, endNoteId, type = 'tie') {
    // Find and update the start note
    let startNoteFound = false;
    let endNoteFound = false;
    
    measuresData.forEach(measure => {
        if (measure) {
            measure.forEach(note => {
                if (note.id === startNoteId) {
                    note.tie = {
                        type: type,
                        startNoteId: startNoteId,
                        endNoteId: endNoteId
                    };
                    startNoteFound = true;
                }
                if (note.id === endNoteId) {
                    // End note can also store tie info for reference
                    note.tie = {
                        type: type,
                        startNoteId: startNoteId,
                        endNoteId: endNoteId
                    };
                    endNoteFound = true;
                }
            });
        }
    });
    
    return startNoteFound && endNoteFound;
}

/**
 * Creates a tie between two existing notes
 * @param {string} startNoteId - ID of the first note
 * @param {string} endNoteId - ID of the second note
 * @param {string} type - Type of connection ('tie' or 'slur')
 * @returns {boolean} True if tie was created successfully
 */
export function createTie(startNoteId, endNoteId, type = 'tie') {
    const success = createTieBetweenNotes(startNoteId, endNoteId, type);
    if (success) {
        saveStateToHistory();
        drawAll(measuresData, true);
        saveToLocalStorage();
    }
    return success;
}

/**
 * Removes ties involving a specific note
 * @param {string} noteId - ID of the note
 * @returns {number} Number of ties removed
 */
export function removeTie(noteId) {
    const removed = removeTiesForNote(noteId);
    if (removed > 0) {
        saveStateToHistory();
        drawAll(measuresData, true);
        saveToLocalStorage();
    }
    return removed;
}
function doAddNote(measureIndex, noteData, insertBeforeNoteId = null) {
    
    if (!measuresData[measureIndex]) {
        measuresData[measureIndex] = [];
    }

    const targetMeasure = measuresData[measureIndex];
    let insertIndex = -1;

    if (insertBeforeNoteId !== null) {
        insertIndex = targetMeasure.findIndex(note => note.id === insertBeforeNoteId);
    }

    if (insertIndex === -1) {
        targetMeasure.push(noteData);
    } else {
        targetMeasure.splice(insertIndex, 0, noteData);
    }

    // Update current beats if this is the current measure
    if (measureIndex === currentIndex) {
        console.log('beatcount: updating current beats in doAddNote', { measureIndex });
        const updatedBeats = calculateMeasureBeats(measuresData[currentIndex]);
        currentTrebleBeats = updatedBeats.trebleBeats;
        currentBassBeats = updatedBeats.bassBeats;
        console.log('beatcount: currentBeats after doAddNote', { currentTrebleBeats, currentBassBeats });
    }

    return true;
}

/**
 * Creates a slur between two existing notes and updates intermediate notes to legato
 * The last note in the slur keeps its normal articulation for phrase separation
 * @param {string} startNoteId - ID of the first note
 * @param {string} endNoteId - ID of the second note
 * @param {string} type - Type of connection ('tie' or 'slur')
 * @returns {boolean} True if slur was created successfully
 */
export function createSlur(startNoteId, endNoteId, type = 'slur') {
    // Find the start and end notes
    let startNote = null;
    let endNote = null;
    let startMeasureIndex = -1;
    let endMeasureIndex = -1;
    
    measuresData.forEach((measure, measureIndex) => {
        if (measure) {
            measure.forEach(note => {
                if (note.id === startNoteId) {
                    startNote = note;
                    startMeasureIndex = measureIndex;
                }
                if (note.id === endNoteId) {
                    endNote = note;
                    endMeasureIndex = measureIndex;
                }
            });
        }
    });
    
    if (!startNote || !endNote) {
        console.warn(`createSlur: Could not find start note ${startNoteId} or end note ${endNoteId}`);
        return false;
    }
    
    if (startNote.clef !== endNote.clef) {
        console.warn(`createSlur: Cannot create slur between different clefs`);
        return false;
    }
    
    // Find all notes between start and end in the same clef
    const notesToSlur = [];
    let foundStart = false;
    
    for (let measureIndex = startMeasureIndex; measureIndex <= endMeasureIndex; measureIndex++) {
        const measure = measuresData[measureIndex];
        if (measure) {
            measure.forEach(note => {
                if (note.clef === startNote.clef) {
                    if (note.id === startNoteId) {
                        foundStart = true;
                    }
                    
                    if (foundStart) {
                        notesToSlur.push(note);
                    }
                    
                    if (note.id === endNoteId) {
                        foundStart = false; // Stop collecting
                    }
                }
            });
        }
    }
    
    // Create the slur connection between start and end notes
    const success = createTieBetweenNotes(startNoteId, endNoteId, type);
    
    if (success) {
        // Update notes in the slur to use legato timing EXCEPT the last note
        notesToSlur.forEach((note, index) => {
            if (index < notesToSlur.length - 1) {
                // All notes except the last one get legato timing (smooth connection)
                note.performedDuration = pianoState.legatoTime;
            }
            // Last note keeps its current performedDuration (usually staccato for phrase separation)
        });
        
        saveStateToHistory();
        drawAll(measuresData, true);
        saveToLocalStorage();
    }
    
    return success;
}

/**
 * Removes a slur and resets all involved notes back to staccato timing
 * @param {string} noteId - ID of any note involved in the slur
 * @returns {number} Number of notes updated
 */
export function removeSlur(noteId) {
    let slurFound = false;
    let startNoteId = null;
    let endNoteId = null;
    let clef = null;
    
    // Find the slur information
    measuresData.forEach(measure => {
        if (measure) {
            measure.forEach(note => {
                if (note.id === noteId && note.tie && note.tie.type === 'slur') {
                    startNoteId = note.tie.startNoteId;
                    endNoteId = note.tie.endNoteId;
                    clef = note.clef;
                    slurFound = true;
                }
            });
        }
    });
    
    if (!slurFound) {
        console.warn(`removeSlur: No slur found for note ${noteId}`);
        return 0;
    }
    
    // Find all notes in the slur and reset them to staccato
    const notesToUpdate = [];
    let foundStart = false;
    
    measuresData.forEach(measure => {
        if (measure) {
            measure.forEach(note => {
                if (note.clef === clef) {
                    if (note.id === startNoteId) {
                        foundStart = true;
                    }
                    
                    if (foundStart) {
                        notesToUpdate.push(note);
                    }
                    
                    if (note.id === endNoteId) {
                        foundStart = false;
                    }
                }
            });
        }
    });
    
    // Reset all notes to staccato timing
    notesToUpdate.forEach(note => {
        note.performedDuration = pianoState.staccatoTime;
    });
    
    // Remove the slur tie information
    const tiesRemoved = removeTiesForNote(noteId);
    
    if (tiesRemoved > 0) {
        saveStateToHistory();
        drawAll(measuresData, true);
        saveToLocalStorage();
    }
    
    return notesToUpdate.length;
}

/**
 * Updates the performedDuration of all notes in the score
 * @param {number} newPerformedDuration - New performed duration (0.0 to 1.0)
 * @returns {number} Number of notes updated
 */
export function updateAllNotesPerformedDuration(newPerformedDuration) {
    let notesUpdated = 0;
    
    measuresData.forEach(measure => {
        if (measure) {
            measure.forEach(note => {
                note.performedDuration = newPerformedDuration;
                notesUpdated++;
            });
        }
    });
    
    if (notesUpdated > 0) {
        saveStateToHistory();
        drawAll(measuresData, true);
        saveToLocalStorage();
    }
    
    return notesUpdated;
}

/**
 * Transposes all notes in the score by a given number of semitones.
 * 
 * Handles:
 * - Single notes and chords in both treble and bass clefs
 * - Rests (left unchanged)
 * - Out-of-range validation (warns if notes go outside C2-C8 range)
 * - Updates all note names while preserving other properties
 * 
 * @param {number} semitones - Number of semitones to transpose
 *                              Positive = up, Negative = down
 *                              Use ±1 for semitone, ±12 for octave
 * @returns {object} - { success: boolean, message: string, outOfRange: array }
 */
export function transposeScore(semitones) {
    if (measuresData.length === 0) {
        console.warn('transposeScore: No notes to transpose.');
        return { success: false, message: 'No score to transpose', outOfRange: [] };
    }

    if (semitones === 0) {
        return { success: true, message: 'No transposition needed (0 semitones)', outOfRange: [] };
    }

    const outOfRangeNotes = [];
    let transposedNoteCount = 0;

    // Iterate through all measures
    for (let measureIndex = 0; measureIndex < measuresData.length; measureIndex++) {
        const measure = measuresData[measureIndex];

        if (!Array.isArray(measure)) continue;

        // Iterate through all notes in the measure
        for (let noteIndex = 0; noteIndex < measure.length; noteIndex++) {
            const note = measure[noteIndex];

            // Skip rests
            if (note.isRest) {
                continue;
            }

            // Handle single notes
            if (!isChord(note.name)) {
                const transposed = transposeNote(note.name, semitones);
                
                // Check if transposed note is within valid range (C2 = MIDI 36, C8 = MIDI 108)
                const transposedMidi = NOTES_BY_NAME[transposed];
                if (transposedMidi === undefined || transposedMidi < 36 || transposedMidi > 108) {
                    outOfRangeNotes.push({
                        original: note.name,
                        measure: measureIndex,
                        clef: note.clef
                    });
                } else {
                    note.name = transposed;
                    transposedNoteCount++;
                }
            } else {
                // Handle chords - transpose each note in the chord
                const chordNotes = parseChord(note.name);
                const transposedChordNotes = [];
                let allInRange = true;

                for (const chordNote of chordNotes) {
                    const transposed = transposeNote(chordNote, semitones);
                    const transposedMidi = NOTES_BY_NAME[transposed];

                    if (transposedMidi === undefined || transposedMidi < 36 || transposedMidi > 108) {
                        allInRange = false;
                        break;
                    }

                    transposedChordNotes.push(transposed);
                }

                if (allInRange) {
                    note.name = formatChord(transposedChordNotes);
                    transposedNoteCount++;
                } else {
                    outOfRangeNotes.push({
                        original: note.name,
                        measure: measureIndex,
                        clef: note.clef
                    });
                }
            }
        }
    }

    // Build result message
    let message = `Transposed ${transposedNoteCount} note(s)`;
    if (semitones > 0) {
        if (semitones === 12) message += ' up 1 octave';
        else if (semitones === 1) message += ' up 1 semitone';
        else message += ` up ${semitones} semitone(s)`;
    } else {
        if (semitones === -12) message += ' down 1 octave';
        else if (semitones === -1) message += ' down 1 semitone';
        else message += ` down ${Math.abs(semitones)} semitone(s)`;
    }

    if (outOfRangeNotes.length > 0) {
        message += ` (⚠️ ${outOfRangeNotes.length} note(s) out of range)`;
    }

    // Save to history and re-render
    saveStateToHistory();
    drawAll(measuresData);
    saveToLocalStorage();
    updateNowPlayingDisplay(message);

    return {
        success: transposedNoteCount > 0,
        message: message,
        outOfRange: outOfRangeNotes,
        transposedCount: transposedNoteCount
    };
}

/**
 * Helper: Check if a note name is a chord (format: "(C4 E4 G4)")
 */
function isChord(noteName) {
    return noteName && noteName.startsWith('(') && noteName.endsWith(')');
}

/**
 * Helper: Parse chord string into array of note names
 */
function parseChord(chordString) {
    if (!isChord(chordString)) {
        return [chordString];
    }
    return chordString.substring(1, chordString.length - 1).split(' ').filter(Boolean);
}

/**
 * Helper: Format array of note names into chord string
 */
function formatChord(noteArray) {
    if (!Array.isArray(noteArray) || noteArray.length === 0) {
        return '';
    }
    return noteArray.length > 1 
        ? `(${noteArray.join(' ')})` 
        : noteArray[0];
}