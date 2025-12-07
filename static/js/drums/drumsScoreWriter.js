// drumsScoreWriter.js
// This module manages the drum score data, including writing, undo, state synchronization, and tie support.

// ===================================================================
// Imports
// ===================================================================
import { drumsState } from "../core/appState.js";
import { updateNowPlayingDisplay } from '../ui/uiHelpers.js';
import { UniversalMusicRenderer } from '../classes/UniversalMusicRenderer.js';
import { DRUM_INSTRUMENT_MAP } from '../core/drum-data.js';

// ===================================================================
// Constants
// ===================================================================

const BEAT_VALUES = {
    h: 2, "h.": 3,          // Half, Dotted Half
    q: 1, "q.": 1.5,        // Quarter, Dotted Quarter
    "8": 0.5, "8.": 0.75,   // Eighth, Dotted Eighth
    "16": 0.25, "16.": 0.375, // Sixteenth, Dotted Sixteenth
    "32": 0.125, "32.": 0.1875 // Thirty-second, Dotted Thirty-second
};

const BEATS_TO_DURATION = {
    4: "w", 2: "h", 3: "h.", 1: "q", 1.5: "q.",
    0.5: "8", 0.75: "8.", 0.25: "16", 0.375: "16.",
    0.125: "32", 0.1875: "32."
};

export const AUTOSAVE_KEY = 'autosavedDrumScore';
const MAX_HISTORY = 20;

// ===================================================================
// Internal State
// ===================================================================

let sharedDrumRenderer = null;
let measuresData = [];
let currentIndex = 0; // Tracks the active measure for new additions
let currentDrumBeats = 0;
let idCounter = 0;

const history = [];

// ===================================================================
// Helper Functions
// ===================================================================

/**
 * Calculates the total beats for a given measure.
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
 * Converts beat values back to duration strings
 */
function beatsToDuration(beats) {
    return BEATS_TO_DURATION[beats] || null;
}

/**
 * Gets the maximum beats allowed per measure based on time signature.
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
 */
function generateUniqueId() {
    return `drum-${Date.now()}-${++idCounter}`;
}

/**
 * Updates the current measure beats count.
 */
function updateCurrentDrumBeats(measureIndex) {
    if (measureIndex === currentIndex && measuresData[currentIndex]) {
        currentDrumBeats = calculateMeasureBeats(measuresData[currentIndex]);
    }
}

/**
 * Ensures a measure exists at the given index.
 */
function ensureMeasureExists(measureIndex) {
    if (!measuresData.length) {
        measuresData.push([]);
        currentIndex = 0;
    }
    while (!measuresData[measureIndex]) {
        measuresData.push([]);
    }
}

// ===================================================================
// Duration and Tie Helper Functions
// ===================================================================

/**
 * Splits a duration into two parts based on available space
 */
function splitDuration(originalDuration, availableBeats) {
    const totalBeats = durationToBeats(originalDuration);
    
    if (totalBeats <= availableBeats) {
        return null; // No split needed
    }
    
    const remainingBeats = totalBeats - availableBeats;
    
    // Find valid durations for both parts
    const firstDuration = beatsToDuration(availableBeats);
    const secondDuration = beatsToDuration(remainingBeats);
    
    if (firstDuration && secondDuration) {
        return { firstDuration, secondDuration };
    }
    
    // If we can't find exact matches, try combinations
    return findBestDurationSplit(availableBeats, remainingBeats);
}

/**
 * Finds the best way to split beats into valid durations
 */
function findBestDurationSplit(firstBeats, secondBeats) {
    // List of valid beat values in descending order
    const validBeats = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.375, 0.25, 0.1875, 0.125];
    
    // Try to find the largest duration that fits in the first part
    for (const beats of validBeats) {
        if (beats <= firstBeats) {
            const firstDuration = beatsToDuration(beats);
            if (firstDuration) {
                // For the second part, try to find a matching duration
                const secondDuration = beatsToDuration(secondBeats);
                if (secondDuration) {
                    return { firstDuration, secondDuration };
                }
                
                // If second part doesn't have an exact match, use the largest possible
                for (const secondBeat of validBeats) {
                    if (secondBeat <= secondBeats) {
                        const fallbackSecond = beatsToDuration(secondBeat);
                        if (fallbackSecond) {
                            return { firstDuration, secondDuration: fallbackSecond };
                        }
                    }
                }
            }
        }
    }
    
    return null; // Can't split effectively
}

/**
 * Creates tie information between two notes
 */
function createTieData(startNoteId, endNoteId) {
    return {
        type: 'tie',
        startNoteId: startNoteId,
        endNoteId: endNoteId
    };
}

/**
 * Get or create the shared drum renderer instance
 */
function getDrumRenderer() {
    if (!sharedDrumRenderer) {
        sharedDrumRenderer = new UniversalMusicRenderer('drums-score', {
            instrumentType: 'drums',
            timeSignature: drumsState.timeSignature,
            tempo: drumsState.tempo,
            keySignature: drumsState.keySignature || 'C'
        });
    } else {
        // Update settings on existing renderer
        sharedDrumRenderer.timeSignature = drumsState.timeSignature;
        sharedDrumRenderer.tempo = drumsState.tempo;
        sharedDrumRenderer.keySignature = drumsState.keySignature || 'C';
    }
    return sharedDrumRenderer;
}

/**
 * Handles side effects after data operations.
 */
function handleSideEffects() {
    try {
        const renderer = getDrumRenderer();
        renderer.render(measuresData);
        saveDrums();
    } catch (error) {
        console.error('handleSideEffects: Error handling side effects', error);
    }
}

// ===================================================================
// Core Data Operations (No history saving - that's done by callers)
// ===================================================================

/**
 * Internal function to add a note or chord without side effects.
 */
function doAddNote(explicitMeasureIndex, noteData, insertBeforeNoteId = null) {
    try {
        const actualTargetMeasureIndex = (explicitMeasureIndex !== undefined && explicitMeasureIndex !== null)
            ? explicitMeasureIndex
            : currentIndex;

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
        
        // Check for a chord OR a single note in an array
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
            // Handle both single-note objects AND single-note arrays
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
            } else {
                console.warn(`doAddNote: Note ID ${insertBeforeNoteId} not found. Appending to end.`);
            }
        }

        const tempMeasure = [...targetMeasure];
        tempMeasure.splice(insertIndex, 0, objectToInsert);

        const totalBeatsAfterInsert = calculateMeasureBeats(tempMeasure);
        const maxBeats = getMaxBeatsPerMeasure();

        if (totalBeatsAfterInsert > maxBeats) {
            // Calculate available space in current measure
            const currentMeasureBeats = calculateMeasureBeats(targetMeasure);
            const availableBeats = maxBeats - currentMeasureBeats;
            
            // Try to split the duration
            const splitResult = splitDuration(objectToInsert.duration, availableBeats);
            
            if (splitResult && availableBeats > 0) {
                // Create the first part (fits in current measure)
                const firstPartId = generateUniqueId();
                const secondPartId = generateUniqueId();
                
                const firstPart = {
                    ...objectToInsert,
                    id: firstPartId,
                    duration: splitResult.firstDuration,
                    tie: createTieData(firstPartId, secondPartId)
                };
                
                // Update chord notes if applicable
                if (firstPart.isChord) {
                    firstPart.notes = firstPart.notes.map(note => ({
                        ...note,
                        id: firstPartId,
                        duration: splitResult.firstDuration
                    }));
                }
                
                // Create the second part (goes to next measure)
                const secondPart = {
                    ...objectToInsert,
                    id: secondPartId,
                    duration: splitResult.secondDuration,
                    measure: measuresData.length // Next measure index
                };
                
                // Update chord notes if applicable
                if (secondPart.isChord) {
                    secondPart.notes = secondPart.notes.map(note => ({
                        ...note,
                        id: secondPartId,
                        duration: splitResult.secondDuration,
                        measure: measuresData.length
                    }));
                }
                
                // Add first part to current measure
                measuresData[actualTargetMeasureIndex].splice(insertIndex, 0, firstPart);
                
                // Create new measure with second part
                measuresData.push([secondPart]);
                currentIndex = measuresData.length - 1;
                currentDrumBeats = durationToBeats(splitResult.secondDuration);
                
                return true;
            } else {
                // Fallback: create new measure with entire note (original behavior)
                const newMeasureIndex = measuresData.length;
                if (objectToInsert.isChord) {
                    objectToInsert.notes.forEach(n => n.measure = newMeasureIndex);
                } else {
                    objectToInsert.measure = newMeasureIndex;
                }
                measuresData.push([objectToInsert]);
                currentIndex = newMeasureIndex;
                currentDrumBeats = noteBeatValue;
                console.log(`New measure created at index ${newMeasureIndex} (could not split note)`);
                return true;
            }
        } else {
            measuresData[actualTargetMeasureIndex].splice(insertIndex, 0, objectToInsert);
            if (actualTargetMeasureIndex === currentIndex) {
                currentDrumBeats = totalBeatsAfterInsert;
            }
            return true;
        }

    } catch (error) {
        console.error('doAddNote: Error adding note/chord', error);
        return false;
    }
}

/**
 * Internal function to remove a note without side effects.
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

        // Handle tied notes - if this note has a tie, we should consider removing the tied note too

        if (measuresData[measureIndex].length === 0) {
            if (measureIndex > 0) {
                measuresData.splice(measureIndex, 1);
                if (currentIndex >= measureIndex) {
                    currentIndex = Math.max(0, currentIndex - 1);
                }
            } else if (measureIndex === 0 && measuresData.length === 1) {
                measuresData[0] = [];
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
                tie: existingNote.tie // Preserve existing ties
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
                instrumentProps = {};
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

// ===================================================================
// Public API Functions
// ===================================================================

/**
 * Adds a note to the specified measure.
 */
export function addNoteToMeasure(measureIndex, noteData, insertBeforeNoteId = null) {
    const success = doAddNote(measureIndex, noteData, insertBeforeNoteId);

    if (success) {
        saveStateToHistory();
        handleSideEffects();
        const actualMeasureIndex = (measureIndex !== undefined && measureIndex !== null) ? measureIndex : currentIndex;
        return { noteId: noteData.id, measureIndex: actualMeasureIndex };
    } else {
        console.warn('addNoteToMeasure: Failed to add note');
        return null;
    }
}

/**
 * Removes a note from the specified measure.
 */
export function removeNoteFromMeasure(measureIndex, noteId) {
    const removedNote = doRemoveNote(measureIndex, noteId);

    if (removedNote) {
        saveStateToHistory();
        handleSideEffects();
    }

    return removedNote;
}

/**
 * Updates a note in the specified measure.
 */
export function updateNoteInMeasure(measureIndex, noteId, newNoteData) {
    const success = doUpdateNote(measureIndex, noteId, newNoteData);

    if (success) {
        saveStateToHistory();
        handleSideEffects();
    } else {
        console.warn('updateNoteInMeasure: Failed to update note');
    }

    return success;
}

/**
 * Moves a note between measures.
 */
export function placeNote(fromMeasureIndex, fromNoteId, toMeasureIndex, insertBeforeNoteId = null) {
    const noteToMove = doRemoveNote(fromMeasureIndex, fromNoteId);
    if (!noteToMove) {
        console.error('placeNote: Source note not found');
        return false;
    }

    if (noteToMove.isChord) {
        noteToMove.notes.forEach(note => note.measure = toMeasureIndex);
    } else {
        noteToMove.measure = toMeasureIndex;
    }

    const success = doAddNote(toMeasureIndex, noteToMove, insertBeforeNoteId);

    if (success) {
        saveStateToHistory();
        handleSideEffects();
        return true;
    } else {
        console.error('placeNote: Failed to add to target. Rolling back.');
        // Rollback
        if (noteToMove.isChord) {
            noteToMove.notes.forEach(note => note.measure = fromMeasureIndex);
        } else {
            noteToMove.measure = fromMeasureIndex;
        }
        doAddNote(fromMeasureIndex, noteToMove, null);
        handleSideEffects();
        return false;
    }
}

/**
 * Legacy function for writing notes - kept for backwards compatibility
 */
export function writeNote(obj) {
    const { drumInstrument, duration, isRest = false } = obj;

    const noteData = {
        drumInstrument,
        duration,
        isRest,
        performedDuration: drumsState.staccatoTime,
        velocity: drumsState.velocity
    };

    const result = addNoteToMeasure(currentIndex, noteData, null);
    
    if (result) {
        updateNowPlayingDisplay(isRest ? 'Rest' : drumInstrument);
    }
}

/**
 * Undoes the last operation.
 */
export function undoLastWrite() {
    if (history.length > 1) {
        history.pop(); // Remove current state
        const prevState = history[history.length - 1]; // Get previous state

        measuresData = JSON.parse(JSON.stringify(prevState.measures));
        currentIndex = prevState.index;
        currentDrumBeats = prevState.beats;

        handleSideEffects();
        updateNowPlayingDisplay('Undid last action');
    } else if (history.length === 1) {
        resetDrumScore();
        updateNowPlayingDisplay('Score reset');
    } else {
        updateNowPlayingDisplay('Nothing to undo');
    }
}

/**
 * Resets the entire score.
 */
export function resetDrumScore() {
    measuresData = [];
    currentIndex = 0;
    currentDrumBeats = 0;
    history.length = 0;

    ensureMeasureExists(0);
    saveStateToHistory();

    localStorage.removeItem(AUTOSAVE_KEY);
    updateNowPlayingDisplay('');
    handleSideEffects();
}

/**
 * Processes and synchronizes loaded score data.
 */
export function processAndSyncScore(loadedData) {
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

        return true;
    } catch (error) {
        console.error('processAndSyncScore: Error processing data', error);
        return false;
    }
}

/**
 * Gets the current drum measures data.
 */
export function getDrumMeasures() {
    return measuresData;
}

/**
 * Gets the index of the current active drum measure.
 */
export function getCurrentDrumMeasureIndex() {
    return currentIndex;
}

/**
 * Saves the current drum score to local storage.
 */
export function saveDrums() {
    try {
        const drumScoreToSave = getDrumMeasures();
        const drumScoreJSON = JSON.stringify(drumScoreToSave);
        localStorage.setItem(AUTOSAVE_KEY, drumScoreJSON);
    } catch (error) {
        console.error("❌ Error saving drum score to local storage:", error);
    }
}

/**
 * Sets the time signature and redraws the score.
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

    drumsState.timeSignature.numerator = numerator;
    drumsState.timeSignature.denominator = denominator;

    const renderer = getDrumRenderer();
    renderer.render(measuresData, true);
    
    saveDrums();

    return true;
}

/**
 * Sets the tempo and redraws the score.
 */
export function setTempo(newTempo) {
    if (!Number.isInteger(newTempo) || newTempo < 30 || newTempo > 300) {
        console.warn("setTempo: Invalid tempo provided");
        return false;
    }

    drumsState.tempo = newTempo;

    const renderer = getDrumRenderer();
    renderer.render(measuresData, true);
    
    saveDrums();

    return true;
}

/**
 * Updates the performedDuration of all notes in the score
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
        const renderer = getDrumRenderer();
        renderer.render(measuresData, true);
        saveDrums();
    }
    
    return notesUpdated;
}

/**
 * Legacy function - alias for resetDrumScore
 */
export function resetScore() {
    resetDrumScore();
}

// ===================================================================
// Event Listeners
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

    // Handle different scenarios
    if (fromMeasureIndex === toMeasureIndex && !drumInstrumentChanged) {
        // Reordering within the same measure
        removeNoteFromMeasure(fromMeasureIndex, fromNoteId);
        addNoteToMeasure(toMeasureIndex, { ...originalNote, id: originalNote.id }, insertBeforeNoteId);
    } else if (fromMeasureIndex !== toMeasureIndex) {
        // Moving between measures
        const updatedNoteData = { ...originalNote };
        if (drumInstrumentChanged) {
            updatedNoteData.drumInstrument = newDrumInstrument;
        }
        placeNote(fromMeasureIndex, fromNoteId, toMeasureIndex, insertBeforeNoteId);
    } else {
        // Just changing the instrument in the same measure
        const updatedNoteData = { ...originalNote };
        if (drumInstrumentChanged) {
            updatedNoteData.drumInstrument = newDrumInstrument;
        }
        updateNoteInMeasure(fromMeasureIndex, fromNoteId, updatedNoteData);
    }
});