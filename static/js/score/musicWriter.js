// musicWriter.js
// This module manages musical score data for any instrument type, including writing, undo, ties, and state synchronization.

// ===================================================================
// Imports
// ===================================================================
import { pianoState } from "../core/appState.js";
import { NOTES_BY_NAME, identifyChordStrict } from '../core/note-data.js';
import { updateNowPlayingDisplay } from '../ui/uiHelpers.js';
import { saveToLocalStorage } from '../utils/ioHelpers.js';

// ===================================================================
// Constants
// ===================================================================

const BEAT_VALUES = { 
    q: 1, h: 2, w: 4, '8': 0.5, '16': 0.25, '32': 0.125,
    'q.': 1.5, 'h.': 3, 'w.': 6, '8.': 0.75, '16.': 0.375, '32.': 0.1875 
};

const AUTOSAVE_KEY = 'autosavedScore';
const MAX_HISTORY = 20;

// ===================================================================
// Internal State
// ===================================================================

let measuresData = [];
let currentIndex = 0;
let currentTrebleBeats = 0;
let currentBassBeats = 0;
let currentPercussionBeats = 0; // Added for drums support

const history = [];
let idCounter = 0;

// Tie management
let tieConnections = new Map(); // Maps noteId -> { type, connectedTo }

// ===================================================================
// Helper Functions
// ===================================================================

function generateUniqueId() {
    return `${Date.now()}-${++idCounter}`;
}

/**
 * Sets the time signature and triggers re-render through callback.
 */
export function setTimeSignature(numerator, denominator, onUpdate = null) {
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

    // Call update callback if provided (for re-rendering)
    if (onUpdate) {
        onUpdate(getMeasures());
    }
    
    // Save to localStorage to persist the change
    saveToLocalStorage();

    console.log(`Time signature set to: ${numerator}/${denominator}`);
    return true;
}

/**
 * Sets the tempo and triggers re-render through callback.
 */
export function setTempo(newTempo, onUpdate = null) {
    if (!Number.isInteger(newTempo) || newTempo < 30 || newTempo > 300) {
        console.warn("setTempo: Invalid tempo provided");
        return false;
    }

    // Update the piano state
    pianoState.tempo = newTempo;

    // Call update callback if provided (for re-rendering)
    if (onUpdate) {
        onUpdate(getMeasures());
    }
    
    // Save to localStorage to persist the change
    saveToLocalStorage();

    console.log("Tempo set to:", newTempo);
    return true;
}

/**
 * Calculates the total beats for each clef within a given measure.
 * Supports treble, bass, percussion, and tab clefs.
 */
function calculateMeasureBeats(measure) {
    console.log('calculateMeasureBeats input: measure =', measure);
    let trebleBeats = 0;
    let bassBeats = 0;
    let percussionBeats = 0;
    let tabBeats = 0;

    measure.forEach(note => {
        const beats = BEAT_VALUES[note.duration] || 0;
        switch (note.clef) {
            case 'treble':
                trebleBeats += beats;
                break;
            case 'bass':
                bassBeats += beats;
                break;
            case 'percussion':
                percussionBeats += beats;
                break;
            case 'tab':
                tabBeats += beats;
                break;
        }
    });
    
    console.log('calculateMeasureBeats output:', { trebleBeats, bassBeats, percussionBeats, tabBeats });
    return { trebleBeats, bassBeats, percussionBeats, tabBeats };
}

function saveStateToHistory() {
    console.log('saveStateToHistory called. History length before:', history.length);
    const currentMeasuresClone = JSON.parse(JSON.stringify(measuresData));
    const currentTiesClone = new Map(tieConnections);
    
    history.push({
        measures: currentMeasuresClone,
        ties: currentTiesClone,
        index: currentIndex,
        trebleBeats: currentTrebleBeats,
        bassBeats: currentBassBeats,
        percussionBeats: currentPercussionBeats
    });
    
    if (history.length > MAX_HISTORY) {
        history.shift();
    }
    console.log('saveStateToHistory output: history length after:', history.length);
}

// ===================================================================
// Tie Management Functions
// ===================================================================

/**
 * Adds a tie between two notes.
 * @param {string} startNoteId - ID of the starting note
 * @param {string} endNoteId - ID of the ending note  
 * @param {string} type - Type of tie ('tie' or 'slur')
 * @returns {boolean} True if tie was added successfully
 */
export function addTieBetweenNotes(startNoteId, endNoteId, type = 'tie') {
    console.log(`addTieBetweenNotes: Adding ${type} from ${startNoteId} to ${endNoteId}`);
    
    // Validate that both notes exist
    const startNote = findNoteById(startNoteId);
    const endNote = findNoteById(endNoteId);
    
    if (!startNote || !endNote) {
        console.warn('addTieBetweenNotes: One or both notes not found');
        return false;
    }

    // For ties (not slurs), notes must have the same pitch
    if (type === 'tie' && startNote.name !== endNote.name) {
        console.warn('addTieBetweenNotes: Cannot tie notes with different pitches');
        return false;
    }

    // Remove any existing ties for these notes
    removeTie(startNoteId);
    removeTie(endNoteId);

    // Add tie data to the start note
    const startNoteData = findNoteDataById(startNoteId);
    const endNoteData = findNoteDataById(endNoteId);
    
    if (startNoteData && endNoteData) {
        startNoteData.tie = {
            type: type,
            startNoteId: startNoteId,
            endNoteId: endNoteId
        };

        // Store the connection for quick lookup
        tieConnections.set(startNoteId, { type, connectedTo: endNoteId });
        tieConnections.set(endNoteId, { type, connectedTo: startNoteId });

        saveStateToHistory();
        console.log(`addTieBetweenNotes: ${type} added successfully`);
        return true;
    }

    return false;
}

/**
 * Removes a tie involving the specified note.
 * @param {string} noteId - ID of the note to remove ties from
 * @returns {boolean} True if a tie was removed
 */
export function removeTie(noteId) {
    console.log(`removeTie: Removing ties for note ${noteId}`);
    
    const connection = tieConnections.get(noteId);
    if (!connection) {
        return false;
    }

    const connectedNoteId = connection.connectedTo;
    
    // Remove tie data from note objects
    const noteData = findNoteDataById(noteId);
    const connectedNoteData = findNoteDataById(connectedNoteId);
    
    if (noteData && noteData.tie) {
        delete noteData.tie;
    }
    if (connectedNoteData && connectedNoteData.tie) {
        delete connectedNoteData.tie;
    }

    // Remove from connections map
    tieConnections.delete(noteId);
    tieConnections.delete(connectedNoteId);

    saveStateToHistory();
    console.log(`removeTie: Tie removed for note ${noteId}`);
    return true;
}

/**
 * Gets all ties for a specific note.
 * @param {string} noteId - ID of the note
 * @returns {object|null} Tie information or null if no ties
 */
export function getTiesForNote(noteId) {
    return tieConnections.get(noteId) || null;
}

/**
 * Gets all tie connections in the score.
 * @returns {Array} Array of tie objects
 */
export function getAllTies() {
    const ties = [];
    const processed = new Set();

    for (const [noteId, connection] of tieConnections) {
        if (!processed.has(noteId)) {
            ties.push({
                type: connection.type,
                startNoteId: noteId,
                endNoteId: connection.connectedTo
            });
            processed.add(noteId);
            processed.add(connection.connectedTo);
        }
    }

    return ties;
}

// ===================================================================
// Helper Functions for Note Finding
// ===================================================================

function findNoteById(noteId) {
    for (let measureIndex = 0; measureIndex < measuresData.length; measureIndex++) {
        const measure = measuresData[measureIndex];
        const note = measure.find(n => n.id === noteId);
        if (note) {
            return { ...note, measureIndex };
        }
    }
    return null;
}

function findNoteDataById(noteId) {
    for (let measureIndex = 0; measureIndex < measuresData.length; measureIndex++) {
        const measure = measuresData[measureIndex];
        const note = measure.find(n => n.id === noteId);
        if (note) {
            return note;
        }
    }
    return null;
}

// ===================================================================
// Core Data Operations
// ===================================================================

function doRemoveNote(measureIndex, noteId) {
    if (!measuresData[measureIndex]) {
        return null;
    }

    const noteIndex = measuresData[measureIndex].findIndex(note => note.id === noteId);
    if (noteIndex === -1) {
        return null;
    }

    // Remove any ties involving this note
    removeTie(noteId);

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
        currentPercussionBeats = updatedBeats.percussionBeats;
    } else {
        currentTrebleBeats = 0;
        currentBassBeats = 0;
        currentPercussionBeats = 0;
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

    // If the name is being changed, strip the chordName and update ties
    if (newNoteData.name && newNoteData.name !== existingNote.name) {
        console.log('Note Data changed');
        let identifiedChord = undefined;
        
        // Parse the name - could be single note "C4" or chord "(C4 E4 G4)"
        if (newNoteData.name.startsWith('(') && newNoteData.name.endsWith(')')) {
            console.log('chord detected');
            const noteNames = newNoteData.name
                .slice(1, -1) // Remove parentheses
                .split(' ');  // Split by spaces
            
            identifiedChord = identifyChordStrict(noteNames) || undefined;
            console.log('chord identified as', identifiedChord);
        }
        
        // If pitch changed, remove any existing ties (since they may no longer be valid)
        if (existingNote.name !== newNoteData.name) {
            removeTie(noteId);
        }
        
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

    const beats = calculateMeasureBeats(tempMeasure);

    // Check for overflow based on instrument type
    const maxBeats = pianoState.timeSignature.numerator;
    if (beats.trebleBeats > maxBeats || beats.bassBeats > maxBeats || beats.percussionBeats > maxBeats) {
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
        currentPercussionBeats = updatedBeats.percussionBeats;
    }

    return true;
}

function doAddNote(measureIndex, noteData, insertBeforeNoteId = null) {
    if (!measuresData[measureIndex]) {
        measuresData[measureIndex] = [];
    }

    const targetMeasure = measuresData[measureIndex];
    let insertIndex = -1;

    if (insertBeforeNoteId !== null) {
        insertIndex = targetMeasure.findIndex(note => note.id === insertBeforeNoteId);
        if (insertIndex === -1) {
            console.warn(`doAddNote: Note with ID ${insertBeforeNoteId} not found. Appending to end.`);
        }
    }

    if (insertIndex === -1) {
        targetMeasure.push(noteData);
    } else {
        targetMeasure.splice(insertIndex, 0, noteData);
    }

    return true;
}

// ===================================================================
// Core Score Management Functions
// ===================================================================

export function undoLastWrite(onUpdate = null) {
    console.log('undoLastWrite called. History length:', history.length);

    if (history.length > 1) {
        history.pop(); // Remove current state
        const prevState = history[history.length - 1]; // Get previous state

        measuresData = JSON.parse(JSON.stringify(prevState.measures));
        tieConnections = new Map(prevState.ties);
        currentIndex = prevState.index;
        currentTrebleBeats = prevState.trebleBeats;
        currentBassBeats = prevState.bassBeats;
        currentPercussionBeats = prevState.percussionBeats;
        
        if (onUpdate) {
            onUpdate(getMeasures());
        }
        saveToLocalStorage();

        updateNowPlayingDisplay('Undid last action');
        console.log('undoLastWrite output: state reverted.');

    } else if (history.length === 1) {
        resetScore(onUpdate);
        updateNowPlayingDisplay('Score reset');
        console.log('undoLastWrite output: score reset (only one state in history).');

    } else {
        updateNowPlayingDisplay('Nothing to undo');
        console.log('undoLastWrite output: no history to undo.');
    }
}

/**
 * Writes a note or rest to the score for any instrument type.
 * @param {object} obj - The note/rest object
 * @param {Function} onUpdate - Callback for triggering re-render
 */
export function writeNote(obj, onUpdate = null) {
    console.log('writeNote input: obj =', obj);

    const { clef, duration, notes, chordName, isRest = false, drumInstrument, string, fret } = obj;
    const beats = BEAT_VALUES[duration];

    // Get current beats for the appropriate clef
    let currentBeatsForClef = 0;
    switch (clef) {
        case 'treble':
            currentBeatsForClef = currentTrebleBeats;
            break;
        case 'bass':
            currentBeatsForClef = currentBassBeats;
            break;
        case 'percussion':
            currentBeatsForClef = currentPercussionBeats;
            break;
        default:
            currentBeatsForClef = currentTrebleBeats;
    }

    // Check for measure overflow
    if (currentBeatsForClef + beats > pianoState.timeSignature.numerator) {
        if (measuresData[currentIndex] && (measuresData[currentIndex].length > 0 || 
            currentTrebleBeats > 0 || currentBassBeats > 0 || currentPercussionBeats > 0)) {
            currentIndex++;
        }
        measuresData[currentIndex] = [];
        currentTrebleBeats = 0;
        currentBassBeats = 0;
        currentPercussionBeats = 0;
        console.log('writeNote: measure advanced due to overflow. New currentIndex:', currentIndex);
    }

    // Format the note based on instrument type
    let formattedName;
    if (isRest) {
        formattedName = 'R';
    } else if (drumInstrument) {
        // For drums, use the drum instrument name
        formattedName = drumInstrument;
    } else if (Array.isArray(notes)) {
        // For pitched instruments with multiple notes (chords)
        formattedName = notes.length > 1
            ? `(${notes.sort((a, b) => NOTES_BY_NAME[a] - NOTES_BY_NAME[b]).join(' ')})`
            : notes[0];
    } else {
        formattedName = notes;
    }

    const newNoteId = generateUniqueId();
    
    const noteEntry = { 
        id: newNoteId,
        name: formattedName, 
        clef, 
        duration, 
        measure: currentIndex, 
        isRest,
        chordName: chordName
    };

    // Add instrument-specific properties
    if (drumInstrument) {
        noteEntry.drumInstrument = drumInstrument;
    }
    if (string !== undefined && fret !== undefined) {
        noteEntry.string = string;
        noteEntry.fret = fret;
    }

    measuresData[currentIndex] ??= []; 
    measuresData[currentIndex].push(noteEntry);

    // Update beat counters
    switch (clef) {
        case 'treble':
            currentTrebleBeats += beats;
            break;
        case 'bass':
            currentBassBeats += beats;
            break;
        case 'percussion':
            currentPercussionBeats += beats;
            break;
    }

    saveStateToHistory();
    updateNowPlayingDisplay(chordName);
    
    if (onUpdate) {
        onUpdate(getMeasures());
    }
    saveToLocalStorage();
    
    console.log(`writeNote output: Note written. Current beats - Treble: ${currentTrebleBeats}, Bass: ${currentBassBeats}, Percussion: ${currentPercussionBeats}`);
}

// ===================================================================
// Editor Functions
// ===================================================================

/**
 * Inserts a new note at a specified position within a measure.
 */
export function addNoteToMeasure(measureIndex, noteData, insertBeforeNoteId = null, onUpdate = null) {
    console.log('addNoteToMeasure input: measureIndex=', measureIndex, 'noteData=', noteData, 'insertBeforeNoteId=', insertBeforeNoteId);

    if (!measuresData[measureIndex]) {
        measuresData[measureIndex] = [];
        console.log(`addNoteToMeasure: Initialized new measure ${measureIndex}.`);
    }

    if (!noteData.id) {
        noteData.id = generateUniqueId();
    }

    const targetMeasure = measuresData[measureIndex];
    let insertIndex = -1;

    if (insertBeforeNoteId !== null) {
        insertIndex = targetMeasure.findIndex(note => note.id === insertBeforeNoteId);
        if (insertIndex === -1) {
            console.warn(`addNoteToMeasure: Note with ID ${insertBeforeNoteId} not found. Appending to end.`);
        }
    }

    const tempMeasure = [...targetMeasure];
    if (insertIndex === -1) {
        tempMeasure.push(noteData);
    } else {
        tempMeasure.splice(insertIndex, 0, noteData);
    }

    const beats = calculateMeasureBeats(tempMeasure);
    const maxBeats = pianoState.timeSignature.numerator;

    let finalMeasureIndex = measureIndex;
    if (beats.trebleBeats > maxBeats || beats.bassBeats > maxBeats || beats.percussionBeats > maxBeats) {
        console.warn(`addNoteToMeasure: Adding note would cause overflow. Creating new measure.`);
        finalMeasureIndex = measuresData.length;
        measuresData[finalMeasureIndex] = [noteData];

        if (measureIndex === currentIndex) {
            currentIndex = finalMeasureIndex;
            const newMeasureBeats = calculateMeasureBeats(measuresData[currentIndex]);
            currentTrebleBeats = newMeasureBeats.trebleBeats;
            currentBassBeats = newMeasureBeats.bassBeats;
            currentPercussionBeats = newMeasureBeats.percussionBeats;
        }
    } else {
        measuresData[measureIndex] = tempMeasure;

        if (measureIndex === currentIndex) {
            const updatedBeats = calculateMeasureBeats(measuresData[currentIndex]);
            currentTrebleBeats = updatedBeats.trebleBeats;
            currentBassBeats = updatedBeats.bassBeats;
            currentPercussionBeats = updatedBeats.percussionBeats;
        }
    }

    saveStateToHistory();
    if (onUpdate) {
        onUpdate(getMeasures());
    }
    saveToLocalStorage();

    console.log(`addNoteToMeasure output: Note added with ID ${noteData.id}.`);
    return {
        noteId: noteData.id,
        measureIndex: finalMeasureIndex,
        clef: noteData.clef
    };
}

/**
 * Removes a note from a specified measure by its ID.
 */
export function removeNoteFromMeasure(measureIndex, noteId, onUpdate = null) {
    console.log('removeNoteFromMeasure input: measureIndex=', measureIndex, 'noteId=', noteId);

    const removedNote = doRemoveNote(measureIndex, noteId);

    if (removedNote) {
        saveStateToHistory();
        if (onUpdate) {
            onUpdate(getMeasures());
        }
        saveToLocalStorage();
        console.log(`removeNoteFromMeasure output: Note with ID ${noteId} removed.`);
    }

    return removedNote;
}

/**
 * Updates an existing note's properties by its ID.
 */
export function updateNoteInMeasure(measureIndex, noteId, newNoteData, onUpdate = null) {
    console.log('updateNoteInMeasure input: measureIndex=', measureIndex, 'noteId=', noteId, 'newNoteData=', newNoteData);

    if (!measuresData[measureIndex]) {
        console.warn(`Attempted to update note in non-existent measure ${measureIndex}.`);
        return false;
    }

    const noteIndex = measuresData[measureIndex].findIndex(note => note.id === noteId);
    if (noteIndex === -1) {
        console.warn(`Attempted to update non-existent note with ID ${noteId}.`);
        return false;
    }

    // Test for overflow
    const tempMeasure = JSON.parse(JSON.stringify(measuresData[measureIndex]));
    const existingNote = tempMeasure[noteIndex];
    const updatedTempNote = { ...existingNote, ...newNoteData };
    tempMeasure[noteIndex] = updatedTempNote;
    const beats = calculateMeasureBeats(tempMeasure);

    const maxBeats = pianoState.timeSignature.numerator;
    if (beats.trebleBeats > maxBeats || beats.bassBeats > maxBeats || beats.percussionBeats > maxBeats) {
        console.warn(`Update would cause measure overflow. Operation cancelled.`);
        updateNowPlayingDisplay("Error: Update would overflow measure!");
        setTimeout(() => updateNowPlayingDisplay(""), 3000);
        return false;
    }

    const success = doUpdateNote(measureIndex, noteId, newNoteData);
    if (success) {
        saveStateToHistory();
        if (onUpdate) {
            onUpdate(getMeasures());
        }
        saveToLocalStorage();
        console.log(`updateNoteInMeasure output: Note with ID ${noteId} updated.`);
    }

    return success;
}

/**
 * Moves a note from one measure to another.
 */
export function moveNoteBetweenMeasures(fromMeasureIndex, fromNoteId, toMeasureIndex, insertBeforeNoteId = null, onUpdate = null) {
    console.log('moveNoteBetweenMeasures input:', { fromMeasureIndex, fromNoteId, toMeasureIndex, insertBeforeNoteId });

    const noteToMove = doRemoveNote(fromMeasureIndex, fromNoteId);
    if (!noteToMove) {
        console.error('Note not found for moving.');
        return false;
    }

    noteToMove.measure = toMeasureIndex;

    while (measuresData.length <= toMeasureIndex) {
        measuresData.push([]);
    }

    doAddNote(toMeasureIndex, noteToMove, insertBeforeNoteId);
    
    saveStateToHistory();
    if (onUpdate) {
        onUpdate(getMeasures());
    }
    saveToLocalStorage();

    console.log(`moveNoteBetweenMeasures output: Note moved successfully.`);
    return true;
}

// ===================================================================
// Score Management Functions
// ===================================================================

export function resetScore(onUpdate = null) {
    console.log('resetScore called.');
    measuresData = [];
    currentIndex = 0;
    currentTrebleBeats = 0;
    currentBassBeats = 0;
    currentPercussionBeats = 0;
    history.length = 0;
    tieConnections.clear();

    saveStateToHistory();
    localStorage.removeItem(AUTOSAVE_KEY);
    updateNowPlayingDisplay('');
    
    if (onUpdate) {
        onUpdate(getMeasures());
    }
    
    console.log("Score reset.");
}

export function processAndSyncScore(loadedData, onUpdate = null) {
    console.log('processAndSyncScore input: loadedData =', loadedData);
    if (!Array.isArray(loadedData) || loadedData.flat().length === 0) {
        console.error("Loaded data is invalid or empty.");
        return false;
    }

    try {
        measuresData = JSON.parse(JSON.stringify(loadedData));
        currentIndex = measuresData.length > 0 ? measuresData.length - 1 : 0;

        // Rebuild tie connections from loaded data
        tieConnections.clear();
        measuresData.forEach(measure => {
            measure.forEach(note => {
                if (note.tie) {
                    tieConnections.set(note.id, { 
                        type: note.tie.type, 
                        connectedTo: note.tie.endNoteId 
                    });
                    tieConnections.set(note.tie.endNoteId, { 
                        type: note.tie.type, 
                        connectedTo: note.id 
                    });
                }
            });
        });

        if (measuresData[currentIndex]) {
            const lastMeasureBeats = calculateMeasureBeats(measuresData[currentIndex]);
            currentTrebleBeats = lastMeasureBeats.trebleBeats;
            currentBassBeats = lastMeasureBeats.bassBeats;
            currentPercussionBeats = lastMeasureBeats.percussionBeats;
        } else {
            currentTrebleBeats = 0;
            currentBassBeats = 0;
            currentPercussionBeats = 0;
        }

        history.length = 0;
        saveStateToHistory();

        if (onUpdate) {
            onUpdate(getMeasures());
        }

        console.log("Score state successfully synchronized.");
        return true;

    } catch (e) {
        console.error("Error processing score:", e);
        return false;
    }
}

export function getMeasures() {
    console.log('getMeasures called. Returning measuresData:', measuresData);
    return measuresData;
}

/**
 * Ensures both bass and treble clefs are at the same position by adding rests.
 */
export function fillRests(onUpdate = null) {
    console.log('fillRests called. Current beats - Treble:', currentTrebleBeats, 'Bass:', currentBassBeats);
    
    if (currentTrebleBeats === currentBassBeats) {
        console.log('fillRests: Clefs already aligned');
        return;
    }
    
    const beatDifference = Math.abs(currentTrebleBeats - currentBassBeats);
    const isBassBehind = currentBassBeats < currentTrebleBeats;
    
    console.log(`fillRests: ${isBassBehind ? 'Bass' : 'Treble'} clef is behind by ${beatDifference} beats`);
    
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
        const numQuarterRests = Math.floor(beatDifference);
        const remainder = beatDifference - numQuarterRests;
        
        for (let i = 0; i < numQuarterRests; i++) {
            writeNote({
                clef: isBassBehind ? "bass" : "treble",
                duration: "q",
                notes: [isBassBehind ? "D3" : "B4"],
                chordName: "Rest",
                isRest: true
            }, onUpdate);
        }
        
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
            }, onUpdate);
        }
        return;
    }
    
    writeNote({
        clef: isBassBehind ? "bass" : "treble",
        duration: restDuration,
        notes: [isBassBehind ? "D3" : "B4"],
        chordName: "Rest",
        isRest: true
    }, onUpdate);
    
    console.log(`fillRests: Added ${restDuration} rest to ${isBassBehind ? 'bass' : 'treble'} clef`);
}

console.log("✓ musicWriter.js loaded successfully");