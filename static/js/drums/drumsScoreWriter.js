// drumsScoreWriter.js
// This module manages the drum score data, including writing, undo, and state synchronization.

// ===================================================================
// Imports
// ===================================================================
import { drumsState } from "../core/appState.js";
import { updateNowPlayingDisplay } from '../ui/uiHelpers.js';
// import { saveToLocalStorage } from '../utils/ioHelpers.js';
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

        const durationToCheck = note.isChord ? note.notes[0].duration : note.duration;
        const beats = BEAT_VALUES[durationToCheck];

        if (beats === undefined) {
            console.warn(`calculateMeasureBeats: Unknown duration "${durationToCheck}" for note:`, note);
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
 * Internal function to add a note or chord without side effects.
 * This function handles deciding which measure to add the note to.
 * @param {number|null|undefined} explicitMeasureIndex - Optional: If provided, attempts to add to this measure. Otherwise, uses `currentIndex`.
 * @param {object} noteData - Note data object. Can be a single note or a chord.
 * @param {string|null} insertBeforeNoteId - Optional ID to insert before.
 * @returns {boolean} Success status.
 */
function doAddNote(explicitMeasureIndex, noteData, insertBeforeNoteId = null) {
    console.log(`--- doAddNote Call Start ---`);
    console.log(`Input: explicitMeasureIndex=${explicitMeasureIndex}, noteData=`, noteData, `insertBeforeNoteId=${insertBeforeNoteId}`);
    console.log(`Initial global state: currentDrumBeats=${currentDrumBeats}, currentIndex=${currentIndex}, measuresData length=${measuresData.length}`);

    try {
        const actualTargetMeasureIndex = (explicitMeasureIndex !== undefined && explicitMeasureIndex !== null)
            ? explicitMeasureIndex
            : currentIndex;
        console.log(`Actual measure index for operation: ${actualTargetMeasureIndex}`);

        if (!noteData || (!noteData.drumInstrument && !noteData.drumInstruments && !noteData.isRest)) {
            console.error('doAddNote: Invalid note data provided. Missing drumInstrument, drumInstruments, or isRest property.', noteData);
            return false;
        }

        // Handle rests
        if (noteData.isRest) {
            if (!noteData.duration) {
                console.error('doAddNote: Rest note must have a duration.');
                return false;
            }
            const restToInsert = {
                id: noteData.id || generateUniqueId(),
                duration: noteData.duration,
                isRest: true,
                measure: actualTargetMeasureIndex,
            };
            noteData = restToInsert;
        }
        
        // This is the key fix: check for a chord OR a single note in an array
        const isChord = noteData.drumInstruments && Array.isArray(noteData.drumInstruments) && noteData.drumInstruments.length > 1;
        const isSingleNoteInArray = noteData.drumInstruments && Array.isArray(noteData.drumInstruments) && noteData.drumInstruments.length === 1;

        let notesToInsert = [];
        let noteBeatValue = 0;
        let objectToInsert;

        if (noteData.isRest) {
            objectToInsert = noteData;
            noteBeatValue = durationToBeats(noteData.duration);
        } else if (isChord) {
            notesToInsert = noteData.drumInstruments.map(instrument => {
                const instrumentProps = DRUM_INSTRUMENT_MAP[instrument];
                if (!instrumentProps) {
                    throw new Error(`Unknown drum instrument in chord: ${instrument}`);
                }
                noteBeatValue = durationToBeats(noteData.duration);
                return {
                    id: noteData.id || generateUniqueId(),
                    drumInstrument: instrument,
                    duration: noteData.duration,
                    isRest: false,
                    measure: actualTargetMeasureIndex,
                    keys: instrumentProps.keys,
                    notehead: instrumentProps.notehead,
                    stemDirection: instrumentProps.stemDirection,
                    modifiers: noteData.modifiers || instrumentProps.modifiers || []
                };
            });
            objectToInsert = {
                id: notesToInsert[0].id,
                isChord: true,
                notes: notesToInsert,
                duration: notesToInsert[0].duration,
            };
        } else {
            // This block now handles both single-note objects AND single-note arrays
            const instrument = noteData.drumInstrument || noteData.drumInstruments[0];
            const instrumentProps = DRUM_INSTRUMENT_MAP[instrument];
            if (!instrumentProps) {
                console.error(`doAddNote: Unknown drum instrument: ${instrument}`);
                return false;
            }
            noteBeatValue = durationToBeats(noteData.duration);
            objectToInsert = {
                id: noteData.id || generateUniqueId(),
                drumInstrument: instrument,
                duration: noteData.duration,
                isRest: false,
                measure: actualTargetMeasureIndex,
                keys: instrumentProps.keys,
                notehead: instrumentProps.notehead,
                stemDirection: instrumentProps.stemDirection,
                modifiers: noteData.modifiers || instrumentProps.modifiers || []
            };
        }
        
        ensureMeasureExists(actualTargetMeasureIndex);
        const targetMeasure = measuresData[actualTargetMeasureIndex];
        let insertIndex = targetMeasure.length;

        if (insertBeforeNoteId !== null) {
            const foundIndex = targetMeasure.findIndex(note => note.id === insertBeforeNoteId);
            if (foundIndex !== -1) {
                insertIndex = foundIndex;
                console.log(`Note ID ${insertBeforeNoteId} found at index ${foundIndex}. Inserting at ${insertIndex}.`);
            } else {
                console.warn(`doAddNote: Note ID ${insertBeforeNoteId} not found. Appending to end.`);
            }
        }

        const tempMeasure = [...targetMeasure];
        tempMeasure.splice(insertIndex, 0, objectToInsert);

        const totalBeatsAfterInsert = calculateMeasureBeats(tempMeasure);
        const maxBeats = getMaxBeatsPerMeasure();

        if (totalBeatsAfterInsert > maxBeats) {
            const newMeasureIndex = measuresData.length;
            if (objectToInsert.isChord) {
                objectToInsert.notes.forEach(n => n.measure = newMeasureIndex);
            } else {
                objectToInsert.measure = newMeasureIndex;
            }
            measuresData.push([objectToInsert]);
            currentIndex = newMeasureIndex;
            currentDrumBeats = noteBeatValue;
            console.log(`New measure created at index ${newMeasureIndex}.`);
            return true;
        } else {
            measuresData[actualTargetMeasureIndex].splice(insertIndex, 0, objectToInsert);
            if (actualTargetMeasureIndex === currentIndex) {
                currentDrumBeats = totalBeatsAfterInsert;
            }
            updateNowPlayingDisplay(isChord ? 'Chord added' : objectToInsert.drumInstrument);
            handleSideEffects();
            console.log(`--- doAddNote Call End (Note/Chord added to existing measure) ---`);
            return true;
        }

    } catch (error) {
        console.error('doAddNote: Error adding note/chord', error);
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

        if (measuresData[measureIndex].length === 0) {
            if (measureIndex > 0) {
                measuresData.splice(measureIndex, 1);
                if (currentIndex >= measureIndex) {
                    currentIndex = Math.max(0, currentIndex - 1);
                }
                console.log(`doRemoveNote: Empty measure ${measureIndex} removed`);
            } else if (measureIndex === 0 && measuresData.length === 1) {
                measuresData[0] = [];
                console.log(`doRemoveNote: First and only measure cleared`);
            }
        }

        updateCurrentDrumBeats(currentIndex);

        if (!measuresData[currentIndex] || measuresData.length === 0) {
            currentIndex = 0;
            ensureMeasureExists(0);
            currentDrumBeats = 0;
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

        const tempMeasure = JSON.parse(JSON.stringify(measuresData[measureIndex]));
        const existingNote = tempMeasure[noteIndex];

        let instrumentProps = {};
        let updatedNote;
        const isNewNoteChord = newNoteData.drumInstruments && Array.isArray(newNoteData.drumInstruments) && newNoteData.drumInstruments.length > 1;

        if (isNewNoteChord) {
            const notes = newNoteData.drumInstruments.map(instrument => {
                const props = DRUM_INSTRUMENT_MAP[instrument];
                return {
                    id: existingNote.id,
                    drumInstrument: instrument,
                    duration: newNoteData.duration || existingNote.duration,
                    isRest: false,
                    measure: measureIndex,
                    keys: props.keys,
                    notehead: props.notehead,
                    stemDirection: props.stemDirection,
                    modifiers: newNoteData.modifiers || props.modifiers || []
                };
            });
            updatedNote = {
                id: existingNote.id,
                isChord: true,
                notes: notes,
                duration: newNoteData.duration || existingNote.duration,
            };
        } else {
            const instrument = newNoteData.drumInstrument || (newNoteData.drumInstruments ? newNoteData.drumInstruments[0] : null);
            if (instrument) {
                instrumentProps = DRUM_INSTRUMENT_MAP[instrument];
                if (!instrumentProps) {
                    console.error(`doUpdateNote: Unknown drum instrument: ${instrument}`);
                    return false;
                }
            } else {
                instrumentProps = {}; // Ensure it's an object if no instrument is found
            }

            updatedNote = {
                ...existingNote,
                ...newNoteData,
                ...instrumentProps
            };

            // If we're updating a chord to a single note, explicitly remove the chord properties
            if (existingNote.isChord && !isNewNoteChord) {
                updatedNote.isChord = false;
                delete updatedNote.notes;
            }
        }

        tempMeasure[noteIndex] = updatedNote;

        const totalBeats = calculateMeasureBeats(tempMeasure);
        const maxBeats = getMaxBeatsPerMeasure();

        if (totalBeats > maxBeats) {
            console.warn(`doUpdateNote: Update would cause overflow (${totalBeats} > ${maxBeats}). Operation cancelled.`);
            updateNowPlayingDisplay("Error: Update would overflow measure!");
            setTimeout(() => updateNowPlayingDisplay(""), 3000);
            return false;
        }

        Object.assign(measuresData[measureIndex][noteIndex], updatedNote);

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
        saveDrums();
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
    console.log('addNoteToMeasure: Adding note', { measureIndex, noteData, insertBeforeNoteId });

    saveStateToHistory();

    const success = doAddNote(measureIndex, noteData, insertBeforeNoteId);

    if (success) {
        handleSideEffects();
        const actualMeasureIndex = (measureIndex !== undefined && measureIndex !== null) ? measureIndex : currentIndex;
        console.log(`addNoteToMeasure: Success. Current beats: ${currentDrumBeats}. Actual measure index where note was placed: ${actualMeasureIndex}`);
        return { noteId: noteData.id, measureIndex: actualMeasureIndex };
    } else {
        console.warn('addNoteToMeasure: Failed to add note');
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

    if (noteToMove.isChord) {
        noteToMove.notes.forEach(note => note.measure = toMeasureIndex);
    } else {
        noteToMove.measure = toMeasureIndex;
    }

    const success = doAddNote(toMeasureIndex, noteToMove, insertBeforeNoteId);

    if (success) {
        handleSideEffects();
        console.log('moveNoteBetweenMeasures: Success');
        return true;
    } else {
        console.error('moveNoteBetweenMeasures: Failed to add to target. Rolling back.');
        if (noteToMove.isChord) {
            noteToMove.notes.forEach(note => note.measure = fromMeasureIndex);
        } else {
            noteToMove.measure = fromMeasureIndex;
        }
        doAddNote(fromMeasureIndex, noteToMove, null);
        if (history.length > 0) history.pop();
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
        history.pop();
        const prevState = history[history.length - 1];

        measuresData = JSON.parse(JSON.stringify(prevState.measures));
        currentIndex = prevState.index;
        currentDrumBeats = prevState.beats;

        handleSideEffects();
        updateNowPlayingDisplay('Undid last action');
        console.log('undoLastWrite: Success');
    } else if (history.length === 1) {
        resetDrumScore();
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

    ensureMeasureExists(0);
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
        measuresData = [[]];
        currentIndex = 0;
        currentDrumBeats = 0;
        history.length = 0;
        saveStateToHistory();
        return true;
    }

    try {
        measuresData = JSON.parse(JSON.stringify(loadedData));
        currentIndex = measuresData.length > 0 ? measuresData.length - 1 : 0;

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
        const drumScoreToSave = getDrumMeasures();
        const drumScoreJSON = JSON.stringify(drumScoreToSave);
        localStorage.setItem(AUTOSAVE_KEY, drumScoreJSON);
        console.log("✅ Drum score saved successfully to local storage.");
    } catch (error) {
        console.error("❌ Error saving drum score to local storage:", error);
    }
}


// ===================================================================
// Event Listeners (These remain the same, as they dispatch, not directly call)
// ===================================================================

document.addEventListener("addDrumNoteToScore", (event) => {
    const { measureIndex, noteData, insertBeforeNoteId } = event.detail;
    addNoteToMeasure(measureIndex, noteData, insertBeforeNoteId);
});

document.addEventListener("drumNoteDropped", (event) => {
    const { fromMeasureIndex, fromNoteId, toMeasureIndex, insertBeforeNoteId, drumInstrumentChanged, newDrumInstrument } = event.detail;

    const originalNote = getDrumMeasures()[fromMeasureIndex]?.find(n => n.id === fromNoteId);
    if (!originalNote) {
        console.warn("drumNoteDropped: Original note not found for ID:", fromNoteId);
        return;
    }

    if (fromMeasureIndex === toMeasureIndex && !drumInstrumentChanged) {
        removeNoteFromMeasure(fromMeasureIndex, fromNoteId);
        addNoteToMeasure(toMeasureIndex, { ...originalNote, id: originalNote.id }, insertBeforeNoteId);
    } else if (fromMeasureIndex !== toMeasureIndex) {
        const updatedNoteData = { ...originalNote };
        if (drumInstrumentChanged) {
            updatedNoteData.drumInstrument = newDrumInstrument;
        }
        moveNoteBetweenMeasures(fromMeasureIndex, fromNoteId, toMeasureIndex, insertBeforeNoteId);
    } else {
        const updatedNoteData = { ...originalNote };
        if (drumInstrumentChanged) {
            updatedNoteData.drumInstrument = newDrumInstrument;
        }
        updateNoteInMeasure(fromMeasureIndex, fromNoteId, updatedNoteData);
    }
});