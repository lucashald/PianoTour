// drumsScoreWriter.js
// This module manages the drum score data, including writing, undo, and state synchronization.

// ===================================================================
// Imports
// ===================================================================
import { drumsState } from "../core/appState.js";
import { updateNowPlayingDisplay } from '../ui/uiHelpers.js';
// import { saveToLocalStorage } from '../utils/ioHelpers.js'; // This import is no longer needed if saveDrums handles it directly
import { drawAll as drawAllDrums } from './drumRenderer.js';
import { DRUM_INSTRUMENT_MAP } from '../core/drum-data.js';

// ===================================================================
// Constants
// ===================================================================

const BEAT_VALUES = {
    w: 4, "w.": 6,          // Whole, Dotted Whole
    h: 2, "h.": 3,          // Half, Dotted Half
    q: 1, "q.": 1.5,        // Quarter, Dotted Quarter
    "8": 0.5, "8.": 0.75,   // Eighth, Dotted Eighth
    "16": 0.25, "16.": 0.375, // Sixteenth, Dotted Sixteenth
    "32": 0.125, "32.": 0.1875 // Thirty-second, Dotted Thirty-second
};

export const AUTOSAVE_KEY = 'autosavedDrumScore'; // Exported for external use
const MAX_HISTORY = 20;

// ===================================================================
// Internal State
// ===================================================================

let measuresData = [];
let currentIndex = 0; // This tracks the *active* measure for new additions
let currentDrumBeats = 0;
let idCounter = 0;

const history = [];

// ===================================================================
// Helper Functions
// ===================================================================

/**
 * Calculates the total beats for a given measure.
 * @param {Array} measure - An array of note objects for a single measure.
 * @returns {number} Total beats for the measure.
 */
function calculateMeasureBeats(measure) {
    if (!Array.isArray(measure)) {
        console.warn('calculateMeasureBeats: Invalid measure provided', measure);
        return 0;
    }
    
    let totalBeats = 0;
    measure.forEach(note => {
        if (!note || !note.duration) {
            console.warn('calculateMeasureBeats: Invalid note found', note);
            return;
        }
        
        const beats = BEAT_VALUES[note.duration];
        if (beats === undefined) {
            console.warn(`calculateMeasureBeats: Unknown duration "${note.duration}" for note:`, note);
            return;
        }
        
        totalBeats += beats;
    });
    
    return totalBeats;
}

/**
 * Converts a duration string to its numeric beat value.
 * @param {string} duration - Duration string like "q", "h", "8", etc.
 * @returns {number} Numeric beat value.
 */
function durationToBeats(duration) {
    const beats = BEAT_VALUES[duration];
    if (beats === undefined) {
        console.warn(`durationToBeats: Unknown duration "${duration}"`);
        return 0;
    }
    return beats;
}

/**
 * Gets the maximum beats allowed per measure based on time signature.
 * @returns {number} Maximum beats per measure.
*/
function getMaxBeatsPerMeasure() {
    return drumsState.timeSignature.numerator;
}

/**
 * Saves the current state to history for undo functionality.
 */
function saveStateToHistory() {
    const currentMeasuresClone = JSON.parse(JSON.stringify(measuresData));
    history.push({
        measures: currentMeasuresClone,
        index: currentIndex,
        beats: currentDrumBeats
    });
    
    if (history.length > MAX_HISTORY) {
        history.shift();
    }
}

/**
 * Generates a unique ID for notes.
 * @returns {string} Unique ID.
 */
function generateUniqueId() {
    return `drum-${Date.now()}-${++idCounter}`;
}

/**
 * Updates the current measure beats count.
 * @param {number} measureIndex - Index of the measure to calculate beats for.
 */
function updateCurrentDrumBeats(measureIndex) {
    if (measureIndex === currentIndex && measuresData[currentIndex]) {
        currentDrumBeats = calculateMeasureBeats(measuresData[currentIndex]);
    }
}

/**
 * Ensures a measure exists at the given index.
 * If measuresData is empty, it initializes the first measure.
 * @param {number} measureIndex - Index of the measure.
 */
function ensureMeasureExists(measureIndex) {
    if (measuresData.length === 0) {
        measuresData.push([]);
        console.log("ensureMeasureExists: Initialized first measure (index 0).");
    }
    while (!measuresData[measureIndex]) {
        measuresData.push([]);
        console.log(`ensureMeasureExists: Added new empty measure at index ${measuresData.length - 1}.`);
    }
}

// ===================================================================
// Core Data Operations
// ===================================================================

/**
 * Internal function to add a note without side effects.
 * This function handles deciding which measure to add the note to.
 * @param {number|null|undefined} explicitMeasureIndex - Optional: If provided, attempts to add to this measure. Otherwise, uses `currentIndex`.
 * @param {object} noteData - Note data object.
 * @param {string|null} insertBeforeNoteId - Optional ID to insert before.
 * @returns {boolean} Success status.
 */
function doAddNote(explicitMeasureIndex, noteData, insertBeforeNoteId = null) {
    console.log(`--- doAddNote Call Start ---`);
    console.log(`Input: explicitMeasureIndex=${explicitMeasureIndex}, noteData=`, noteData, `insertBeforeNoteId=${insertBeforeNoteId}`);
    console.log(`Initial global state: currentDrumBeats=${currentDrumBeats}, currentIndex=${currentIndex}, measuresData length=${measuresData.length}`);

    try {
        // Determine the actual measure index to operate on
        // If explicitMeasureIndex is provided (e.g., for `addDrumMeasure` or drag/drop to a specific measure), use it.
        // Otherwise, use the internally tracked `currentIndex`.
        const actualTargetMeasureIndex = (explicitMeasureIndex !== undefined && explicitMeasureIndex !== null)
                                        ? explicitMeasureIndex
                                        : currentIndex;
        console.log(`Actual measure index for operation: ${actualTargetMeasureIndex}`);


        // Validate inputs
        if (!noteData || !noteData.drumInstrument || !noteData.duration) {
            console.error('doAddNote: Invalid note data provided', noteData);
            return false;
        }

        // Ensure measure exists at the actual operation index
        ensureMeasureExists(actualTargetMeasureIndex);
        console.log(`After ensureMeasureExists, measuresData[${actualTargetMeasureIndex}] exists:`, measuresData[actualTargetMeasureIndex]);

        // Generate unique ID if not provided
        if (!noteData.id) {
            noteData.id = generateUniqueId();
            console.log(`Generated new note ID: ${noteData.id}`);
        }

        // Get instrument properties
        const instrumentProps = DRUM_INSTRUMENT_MAP[noteData.drumInstrument];
        if (!instrumentProps) {
            console.error(`doAddNote: Unknown drum instrument: ${noteData.drumInstrument}`);
            return false;
        }

        // Validate duration
        const noteBeatValue = durationToBeats(noteData.duration);
        if (noteBeatValue === 0) {
            console.error(`doAddNote: Invalid duration: ${noteData.duration}`);
            return false;
        }
        console.log(`Note duration "${noteData.duration}" corresponds to ${noteBeatValue} beats.`);

        // Construct the complete note object
        const noteToInsert = {
            id: noteData.id,
            drumInstrument: noteData.drumInstrument,
            duration: noteData.duration,
            isRest: noteData.isRest || false,
            measure: actualTargetMeasureIndex, // Initial measure property (might change if overflow)
            keys: instrumentProps.keys,
            notehead: instrumentProps.notehead,
            stemDirection: instrumentProps.stemDirection,
            modifiers: noteData.modifiers || instrumentProps.modifiers || []
        };
        console.log(`Constructed noteToInsert:`, noteToInsert);

        const targetMeasure = measuresData[actualTargetMeasureIndex];
        let insertIndex = targetMeasure.length;

        // Find insertion position if specified
        if (insertBeforeNoteId !== null) {
            const foundIndex = targetMeasure.findIndex(note => note.id === insertBeforeNoteId);
            if (foundIndex !== -1) {
                insertIndex = foundIndex;
                console.log(`Note ID ${insertBeforeNoteId} found at index ${foundIndex}. Inserting at ${insertIndex}.`);
            } else {
                console.warn(`doAddNote: Note ID ${insertBeforeNoteId} not found in measure ${actualTargetMeasureIndex}. Appending to end.`);
            }
        }
        console.log(`Insertion index for target measure: ${insertIndex}`);

        // Create temporary measure to test for overflow
        const tempMeasure = [...targetMeasure]; // Create a shallow copy
        tempMeasure.splice(insertIndex, 0, noteToInsert);
        
        console.log(`Temporary measure for overflow check:`, tempMeasure);

        const totalBeatsAfterInsert = calculateMeasureBeats(tempMeasure);
        const maxBeats = getMaxBeatsPerMeasure();

        console.log(`Calculated totalBeatsAfterInsert for tempMeasure: ${totalBeatsAfterInsert}`);
        console.log(`Max beats allowed per measure (time signature numerator): ${maxBeats}`);

        // Check for measure overflow
        if (totalBeatsAfterInsert > maxBeats) {
            // Create new measure at the end
            const newMeasureIndex = measuresData.length;
            noteToInsert.measure = newMeasureIndex; // Update the measure property of the note
            measuresData.push([noteToInsert]); // Add the note to the new measure

            // Update current index and beats to reflect the newly created measure
            currentIndex = newMeasureIndex;
            currentDrumBeats = noteBeatValue; // The new measure starts with just this note

            console.log(`New measure created at index ${newMeasureIndex}.`);
            console.log(`Updated global state: currentIndex=${currentIndex}, currentDrumBeats=${currentDrumBeats}`);
            return true;
        } else {
            // No overflow, insert into existing measure
            measuresData[actualTargetMeasureIndex].splice(insertIndex, 0, noteToInsert);
            console.log(`Note inserted into existing measure ${actualTargetMeasureIndex}. Current state of measuresData[${actualTargetMeasureIndex}]:`, measuresData[actualTargetMeasureIndex]);

            // Update current measure beats if this is the current measure being modified
            if (actualTargetMeasureIndex === currentIndex) {
                currentDrumBeats = totalBeatsAfterInsert;
                console.log(`Updated currentDrumBeats for measure ${actualTargetMeasureIndex} (which is current index): ${currentDrumBeats}`);
            } else {
                 console.log(`Note added to measure ${actualTargetMeasureIndex}, but it's not the current index (${currentIndex}). currentDrumBeats not updated for this operation.`);
                 // If a note is added to a non-current measure (e.g., via drag/drop to an earlier measure)
                 // currentDrumBeats should still reflect the actual currentIndex's beats.
                 // It's good that we're not updating currentDrumBeats here for a non-current measure.
            }

            updateNowPlayingDisplay(noteToInsert.drumInstrument);
            handleSideEffects();
            console.log(`--- doAddNote Call End (Note added to existing measure) ---`);
            return true;
        }
    } catch (error) {
        console.error('doAddNote: Error adding note', error);
        console.log(`--- doAddNote Call End (Error) ---`);
        return false;
    }
}

/**
 * Internal function to remove a note without side effects.
 * @param {number} measureIndex - Measure index.
 * @param {string} noteId - Note ID to remove.
 * @returns {object|null} Removed note or null.
 */
function doRemoveNote(measureIndex, noteId) {
    try {
        if (!measuresData[measureIndex]) {
            console.warn(`doRemoveNote: Measure ${measureIndex} does not exist`);
            return null;
        }

        const noteIndex = measuresData[measureIndex].findIndex(note => note.id === noteId);
        if (noteIndex === -1) {
            console.warn(`doRemoveNote: Note ID ${noteId} not found in measure ${measureIndex}`);
            return null;
        }

        const removedNote = measuresData[measureIndex].splice(noteIndex, 1)[0];

        // Handle empty measure cleanup
        if (measuresData[measureIndex].length === 0) {
            if (measureIndex > 0) {
                // Remove empty measure (except first one)
                measuresData.splice(measureIndex, 1);
                // Adjust currentIndex if the measure removed was the current one or before it
                if (currentIndex >= measureIndex) {
                    currentIndex = Math.max(0, currentIndex - 1);
                }
                console.log(`doRemoveNote: Empty measure ${measureIndex} removed`);
            } else if (measureIndex === 0 && measuresData.length === 1) {
                // Clear first and only measure
                measuresData[0] = [];
                console.log(`doRemoveNote: First and only measure cleared`);
            }
        }

        // Update current measure beats for the (potentially new) current index
        updateCurrentDrumBeats(currentIndex);

        // If current measure was removed and measuresData is now empty, reset currentIndex to 0
        // and ensure the first measure exists for future additions.
        if (!measuresData[currentIndex] || measuresData.length === 0) {
            currentIndex = 0;
            ensureMeasureExists(0); // Ensure at least one empty measure exists
            currentDrumBeats = 0; // Reset beats if measuresData is now empty or points to a cleared measure
        }

        return removedNote;
    } catch (error) {
        console.error('doRemoveNote: Error removing note', error);
        return null;
    }
}

/**
 * Internal function to update a note without side effects.
 * @param {number} measureIndex - Measure index.
 * @param {string} noteId - Note ID to update.
 * @param {object} newNoteData - New note data.
 * @returns {boolean} Success status.
 */
function doUpdateNote(measureIndex, noteId, newNoteData) {
    try {
        if (!measuresData[measureIndex]) {
            console.warn(`doUpdateNote: Measure ${measureIndex} does not exist`);
            return false;
        }

        const noteIndex = measuresData[measureIndex].findIndex(note => note.id === noteId);
        if (noteIndex === -1) {
            console.warn(`doUpdateNote: Note ID ${noteId} not found in measure ${measureIndex}`);
            return false;
        }

        // Create temporary measure to test for overflow
        const tempMeasure = JSON.parse(JSON.stringify(measuresData[measureIndex]));
        const existingNote = tempMeasure[noteIndex];
        
        // Get instrument properties if drum instrument changed
        let instrumentProps = {};
        if (newNoteData.drumInstrument) {
            instrumentProps = DRUM_INSTRUMENT_MAP[newNoteData.drumInstrument];
            if (!instrumentProps) {
                console.error(`doUpdateNote: Unknown drum instrument: ${newNoteData.drumInstrument}`);
                return false;
            }
        }

        // Create updated note
        const updatedNote = {
            ...existingNote,
            ...newNoteData,
            ...instrumentProps
        };

        tempMeasure[noteIndex] = updatedNote;

        const totalBeats = calculateMeasureBeats(tempMeasure);
        const maxBeats = getMaxBeatsPerMeasure();

        // Check for overflow
        if (totalBeats > maxBeats) {
            console.warn(`doUpdateNote: Update would cause overflow (${totalBeats} > ${maxBeats}). Operation cancelled.`);
            updateNowPlayingDisplay("Error: Update would overflow measure!");
            setTimeout(() => updateNowPlayingDisplay(""), 3000);
            return false;
        }

        // Apply the update
        Object.assign(measuresData[measureIndex][noteIndex], updatedNote);

        // Update current measure beats if this is the current measure
        if (measureIndex === currentIndex) {
            currentDrumBeats = totalBeats;
        }

        return true;
    } catch (error) {
        console.error('doUpdateNote: Error updating note', error);
        return false;
    }
}

/**
 * Handles side effects after data operations.
 */
function handleSideEffects() {
    try {
        drawAllDrums(measuresData);
        // saveToLocalStorage(AUTOSAVE_KEY, measuresData); // This was the old way, now saveDrums will be called explicitly
        saveDrums(); // Call the new saveDrums function
    } catch (error) {
        console.error('handleSideEffects: Error handling side effects', error);
    }
}

// ===================================================================
// Public API Functions
// ===================================================================

/**
 * Adds a note to the specified measure.
 * If measureIndex is null/undefined, the note is added to the currently active measure (`currentIndex`).
 * @param {number|null|undefined} measureIndex - Optional: Target measure index. If null/undefined, uses internal current index.
 * @param {object} noteData - Note data object.
 * @param {string|null} insertBeforeNoteId - Optional note ID to insert before.
 * @returns {object|null} Result object with noteId and measureIndex, or null on failure.
 */
export function addNoteToMeasure(measureIndex, noteData, insertBeforeNoteId = null) {
    // Note: measureIndex parameter now allows null/undefined to indicate "add to current"
    console.log('addNoteToMeasure: Adding note', { measureIndex, noteData, insertBeforeNoteId });
    
    saveStateToHistory();
    
    // Pass the potentially null/undefined measureIndex to the internal doAddNote
    const success = doAddNote(measureIndex, noteData, insertBeforeNoteId);
    
    if (success) {
        handleSideEffects();
        // Determine the actual measure where the note was placed for the return value
        const actualMeasureIndex = (measureIndex !== undefined && measureIndex !== null)
                                    ? measureIndex
                                    : currentIndex;
        console.log(`addNoteToMeasure: Success. Current beats: ${currentDrumBeats}. Actual measure index where note was placed: ${actualMeasureIndex}`);
        return { noteId: noteData.id, measureIndex: actualMeasureIndex };
    } else {
        console.warn('addNoteToMeasure: Failed to add note');
        // Revert history on failure
        if (history.length > 0) history.pop();
        return null;
    }
}

/**
 * Removes a note from the specified measure.
 * @param {number} measureIndex - Measure index.
 * @param {string} noteId - Note ID to remove.
 * @returns {object|null} Removed note object or null.
 */
export function removeNoteFromMeasure(measureIndex, noteId) {
    console.log('removeNoteFromMeasure: Removing note', { measureIndex, noteId });
    
    saveStateToHistory();
    
    const removedNote = doRemoveNote(measureIndex, noteId);
    
    if (removedNote) {
        handleSideEffects();
        console.log('removeNoteFromMeasure: Success');
    } else {
        console.log('removeNoteFromMeasure: Note not found');
    }
    
    return removedNote;
}

/**
 * Updates a note in the specified measure.
 * @param {number} measureIndex - Measure index.
 * @param {string} noteId - Note ID to update.
 * @param {object} newNoteData - New note data.
 * @returns {boolean} Success status.
 */
export function updateNoteInMeasure(measureIndex, noteId, newNoteData) {
    console.log('updateNoteInMeasure: Updating note', { measureIndex, noteId, newNoteData });
    
    saveStateToHistory();
    
    const success = doUpdateNote(measureIndex, noteId, newNoteData);
    
    if (success) {
        handleSideEffects();
        console.log('updateNoteInMeasure: Success');
    } else {
        console.warn('updateNoteInMeasure: Failed to update note');
        // Revert history on failure
        if (history.length > 0) history.pop();
    }
    
    return success;
}

/**
 * Moves a note between measures.
 * @param {number} fromMeasureIndex - Source measure index.
 * @param {string} fromNoteId - Source note ID.
 * @param {number} toMeasureIndex - Target measure index.
 * @param {string|null} insertBeforeNoteId - Optional note ID to insert before.
 * @returns {boolean} Success status.
 */
export function moveNoteBetweenMeasures(fromMeasureIndex, fromNoteId, toMeasureIndex, insertBeforeNoteId = null) {
    console.log('moveNoteBetweenMeasures: Moving note', { fromMeasureIndex, fromNoteId, toMeasureIndex, insertBeforeNoteId });
    
    saveStateToHistory();
    
    const noteToMove = doRemoveNote(fromMeasureIndex, fromNoteId);
    if (!noteToMove) {
        console.error('moveNoteBetweenMeasures: Source note not found');
        if (history.length > 0) history.pop();
        return false;
    }

    // Update measure property before adding to target
    noteToMove.measure = toMeasureIndex; // Set the measure property for the note
    const success = doAddNote(toMeasureIndex, noteToMove, insertBeforeNoteId); // Explicitly add to toMeasureIndex
    
    if (success) {
        handleSideEffects();
        console.log('moveNoteBetweenMeasures: Success');
        return true;
    } else {
        console.error('moveNoteBetweenMeasures: Failed to add to target. Rolling back.');
        // Rollback: re-add to original position
        noteToMove.measure = fromMeasureIndex; // Restore original measure property
        doAddNote(fromMeasureIndex, noteToMove, null); // Re-add to original measure
        if (history.length > 0) history.pop(); // Remove the state saved for the failed move
        handleSideEffects();
        return false;
    }
}

/**
 * Undoes the last operation.
 */
export function undoLastWrite() {
    console.log('undoLastWrite: Attempting undo. History length:', history.length);

    if (history.length > 1) {
        history.pop(); // Remove current state
        const prevState = history[history.length - 1];

        measuresData = JSON.parse(JSON.stringify(prevState.measures));
        currentIndex = prevState.index;
        currentDrumBeats = prevState.beats;

        handleSideEffects();
        updateNowPlayingDisplay('Undid last action');
        console.log('undoLastWrite: Success');
    } else if (history.length === 1) {
        resetDrumScore(); // If only one state, reset to initial empty state
        updateNowPlayingDisplay('Score reset');
        console.log('undoLastWrite: Score reset (only one state in history)');
    } else {
        updateNowPlayingDisplay('Nothing to undo');
        console.log('undoLastWrite: No history to undo');
    }
}

/**
 * Resets the entire score.
 */
export function resetDrumScore() {
    console.log('resetDrumScore: Resetting score');
    
    measuresData = [];
    currentIndex = 0;
    currentDrumBeats = 0;
    history.length = 0;

    // Save initial empty state
    ensureMeasureExists(0); // Ensure at least the first measure exists
    saveStateToHistory();

    localStorage.removeItem(AUTOSAVE_KEY);
    updateNowPlayingDisplay('');
    drawAllDrums(measuresData);
    
    console.log('resetDrumScore: Complete');
}

/**
 * Processes and synchronizes loaded score data.
 * @param {Array} loadedData - The loaded score data.
 * @returns {boolean} Success status.
 */
export function processAndSyncScore(loadedData) {
    console.log('processAndSyncScore: Processing data', loadedData);
    
    if (!Array.isArray(loadedData) || loadedData.flat().length === 0) {
        console.warn('processAndSyncScore: Invalid data. Initializing empty score.');
        measuresData = [[]]; // Initialize with an empty first measure
        currentIndex = 0;
        currentDrumBeats = 0;
        history.length = 0;
        saveStateToHistory();
        return true;
    }

    try {
        measuresData = JSON.parse(JSON.stringify(loadedData));
        // Set currentIndex to the last measure, or 0 if measuresData is empty
        currentIndex = measuresData.length > 0 ? measuresData.length - 1 : 0;

        // Recalculate current beats for the current index
        if (measuresData[currentIndex]) {
            currentDrumBeats = calculateMeasureBeats(measuresData[currentIndex]);
        } else {
            currentDrumBeats = 0;
        }

        history.length = 0;
        saveStateToHistory();

        console.log('processAndSyncScore: Success');
        return true;
    } catch (error) {
        console.error('processAndSyncScore: Error processing data', error);
        return false;
    }
}

/**
 * Gets the current drum measures data.
 * @returns {Array} Current measures data.
 */
export function getDrumMeasures() {
    return measuresData;
}

/**
 * Gets the index of the current active drum measure.
 * @returns {number} Current measure index.
 */
export function getCurrentDrumMeasureIndex() {
    return currentIndex;
}

/**
 * Saves the current drum score to local storage.
 * This function is now the dedicated way to save drum scores.
 */
export function saveDrums() {
    console.log("Attempting to save drum score to local storage...");
    try {
        const drumScoreToSave = getDrumMeasures(); // Get the current drum measures data
        const drumScoreJSON = JSON.stringify(drumScoreToSave); // Convert to JSON string
        localStorage.setItem(AUTOSAVE_KEY, drumScoreJSON); // Save using the defined key
        console.log("✅ Drum score saved successfully to local storage.");
    } catch (error) {
        console.error("❌ Error saving drum score to local storage:", error);
    }
}


// ===================================================================
// Event Listeners (These remain the same, as they dispatch, not directly call)
// ===================================================================

// Event listener for notes added from drum renderer (e.g., drag and drop onto a specific measure)
document.addEventListener("addDrumNoteToScore", (event) => {
    // This event assumes the measureIndex is explicitly provided (e.g., from a drag-and-drop target)
    const { measureIndex, noteData, insertBeforeNoteId } = event.detail;
    addNoteToMeasure(measureIndex, noteData, insertBeforeNoteId);
});

// Event listener for notes moved/updated by drag from drum renderer
document.addEventListener("drumNoteDropped", (event) => {
    const { fromMeasureIndex, fromNoteId, toMeasureIndex, insertBeforeNoteId, drumInstrumentChanged, newDrumInstrument } = event.detail;

    const originalNote = getDrumMeasures()[fromMeasureIndex]?.find(n => n.id === fromNoteId);
    if (!originalNote) {
        console.warn("drumNoteDropped: Original note not found for ID:", fromNoteId);
        return;
    }

    // Handle different types of operations
    if (fromMeasureIndex === toMeasureIndex && !drumInstrumentChanged) {
        // Simple reordering within measure - remove and re-add at new position
        removeNoteFromMeasure(fromMeasureIndex, fromNoteId);
        addNoteToMeasure(toMeasureIndex, { ...originalNote, id: originalNote.id }, insertBeforeNoteId);
    } else if (fromMeasureIndex !== toMeasureIndex) {
        // Move to different measure
        const updatedNoteData = { ...originalNote };
        if (drumInstrumentChanged) {
            updatedNoteData.drumInstrument = newDrumInstrument;
        }
        // moveNoteBetweenMeasures handles both remove and add
        moveNoteBetweenMeasures(fromMeasureIndex, fromNoteId, toMeasureIndex, insertBeforeNoteId);
    } else {
        // Same measure, instrument changed (or other property update)
        const updatedNoteData = { ...originalNote };
        if (drumInstrumentChanged) {
            updatedNoteData.drumInstrument = newDrumInstrument;
        }
        updateNoteInMeasure(fromMeasureIndex, fromNoteId, updatedNoteData);
    }
});
