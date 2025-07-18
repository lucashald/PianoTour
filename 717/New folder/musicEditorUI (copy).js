// musicEditorUI.js
// This module handles the interactive UI for editing notes within a measure.
// REFACTORED to use the unified highlighting system from scoreRenderer.js

// ===================================================================
// Imports
// ===================================================================

import { getMeasures, addNoteToMeasure, removeNoteFromMeasure, updateNoteInMeasure, moveNoteBetweenMeasures } from './scoreWriter.js';
import {
    drawAll,
    scrollToMeasure,
    enableScoreInteraction,
    highlightSelectedMeasure,
    highlightSelectedNote,
    clearSelectedNoteHighlight,
} from './scoreRenderer.js';
import { DURATIONS } from './note-data.js';

// ===================================================================
// Internal State
// ===================================================================

let editorSelectedNoteIndex = null; // Linear index within the current measure's notes array
let editorSelectedMeasureIndex = 0;

// ===================================================================
// Helper Functions
// ===================================================================

/**
 * Checks if a note name string represents a chord.
 * @param {string} noteName - The name property of a note object.
 * @returns {boolean} True if it's a chord, false otherwise.
 */
function isChord(noteName) {
    console.log('isChord input:', noteName);
    const result = noteName && noteName.startsWith('(') && noteName.endsWith(')');
    console.log('isChord output:', result);
    return result;
}

/**
 * Parses a chord string into an array of individual note names.
 * e.g., "(C4 E4 G4)" becomes ["C4", "E4", "G4"]
 * @param {string} chordString - The chord name string.
 * @returns {Array<string>} An array of individual note name strings.
 */
function parseChord(chordString) {
    console.log('parseChord input:', chordString);
    if (!isChord(chordString)) {
        console.warn('parseChord received non-chord string:', chordString);
        return [chordString]; // Return as a single note if not a chord format
    }
    const notes = chordString.substring(1, chordString.length - 1).split(' ').filter(Boolean);
    console.log('parseChord output:', notes);
    return notes;
}

/**
 * Formats an array of individual note names back into a chord string.
 * e.g., ["C4", "E4", "G4"] becomes "(C4 E4 G4)"
 * @param {Array<string>} noteArray - An array of individual note name strings.
 * @returns {string} The formatted chord string.
 */
function formatChord(noteArray) {
    console.log('formatChord input:', noteArray);
    if (!Array.isArray(noteArray) || noteArray.length === 0) {
        return '';
    }
    // Sort notes for consistent VexFlow rendering
    // This requires a NOTES_BY_NAME mapping which is available in note-data.js
    // For simplicity, we'll assume sorting is handled by scoreWriter when it formats.
    // Here, just join them.
    const uniqueNotes = [...new Set(noteArray)].sort(); // Remove duplicates and sort
    const result = uniqueNotes.length > 1 ? `(${uniqueNotes.join(' ')})` : uniqueNotes[0];
    console.log('formatChord output:', result);
    return result;
}

/**
 * Parses a single note name (e.g., "C#4") into its components.
 * @param {string} noteName - The full note name.
 * @returns {{letter: string, accidental: string, octave: string}}
 */
function parseSingleNoteName(noteName) {
    console.log('parseSingleNoteName input:', noteName);
    if (!noteName) return { letter: 'C', accidental: '', octave: '4' };
    const match = noteName.match(/^([A-G])([#b]?)([0-9]?)$/i);
    if (match) {
        const result = {
            letter: match[1].toUpperCase(),
            accidental: match[2] || '',
            octave: match[3] || '',
        };
        console.log('parseSingleNoteName output:', result);
        return result;
    }
    console.warn(`Could not fully parse note name: ${noteName}`);
    // Fallback for malformed note names, try to extract basic parts
    const letter = noteName.charAt(0).toUpperCase();
    const accidentalMatch = noteName.match(/[#b]/);
    const accidental = accidentalMatch ? accidentalMatch[0] : '';
    const octaveMatch = noteName.match(/[0-9]+/);
    const octave = octaveMatch ? octaveMatch[0] : '';

    const result = { letter, accidental, octave };
    console.log('parseSingleNoteName fallback output:', result);
    return result;
}

// ===================================================================
// UI Rendering Functions
// ===================================================================

/**
 * Renders the editor UI and updates the score's visual highlights.
 * This function no longer calls drawAll, relying on non-destructive highlighting functions.
 */
function renderNoteEditBox() {
    console.log('renderNoteEditBox called. Current selected measure:', editorSelectedMeasureIndex, 'note:', editorSelectedNoteIndex);
    const measures = getMeasures();

    if (editorSelectedMeasureIndex >= measures.length) {
        editorSelectedMeasureIndex = Math.max(0, measures.length - 1);
    }

    const currentMeasure = measures[editorSelectedMeasureIndex] || [];

    // --- Update Measure Navigation UI ---
    const measureNumberInput = document.getElementById('editorNumberInput');
    if (measureNumberInput) {
        measureNumberInput.value = editorSelectedMeasureIndex + 1;
        measureNumberInput.max = measures.length > 0 ? measures.length : 1;
    }
    document.getElementById('editorPrevBtn').disabled = editorSelectedMeasureIndex <= 0;
    // Always allow going to the "next" measure, which might create a new one.
    document.getElementById('editorNextBtn').disabled = false;

    // --- Render Note Buttons ---
    const trebleNotesContainer = document.getElementById('editorTrebleNotesContainer');
    const bassNotesContainer = document.getElementById('editorBassNotesContainer');
    trebleNotesContainer.innerHTML = '';
    bassNotesContainer.innerHTML = '';

    const createAddButton = (clef, originalIndex) => {
        const btn = document.createElement('button');
        btn.className = 'control-button bg-blue-500 hover:bg-blue-600 add-note-initial';
        btn.dataset.originalIndex = originalIndex;
        btn.dataset.clef = clef;
        btn.textContent = '+';
        return btn;
    };

    const createNoteButton = (note, linearIndex) => {
        const btn = document.createElement('button');
        btn.className = `control-button editor-note-select note-duration-${note.duration.replace('.', 'dot')}`;
        btn.dataset.originalIndex = linearIndex;
        btn.dataset.clef = note.clef;

        const notesInClef = currentMeasure.filter(n => n.clef === note.clef);
        // Find the VexFlow index for the note
        // This assumes `note` object reference equality or a unique identifier
        btn.dataset.vexflowNoteIndex = notesInClef.findIndex(n => n === note);
        
        btn.textContent = note.isRest ? "Rest" : (isChord(note.name) ? `Chord (${parseChord(note.name).length})` : note.name);
        
        if (linearIndex === editorSelectedNoteIndex) {
            btn.classList.add('active-note-select');
        }
        return btn;
    };

    const addInitialButtonToContainer = (container, clef) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'flex-items-center-gap-1';
        wrapper.appendChild(createAddButton(clef, -1));
        container.appendChild(wrapper);
    };
    
    addInitialButtonToContainer(trebleNotesContainer, 'treble');
    addInitialButtonToContainer(bassNotesContainer, 'bass');

    currentMeasure.forEach((note, linearIndex) => {
        const container = note.clef === 'treble' ? trebleNotesContainer : bassNotesContainer;
        const noteWrapper = document.createElement('div');
        noteWrapper.className = 'flex-items-center-gap-1';

        noteWrapper.appendChild(createNoteButton(note, linearIndex));
        noteWrapper.appendChild(createAddButton(note.clef, linearIndex));

        container.appendChild(noteWrapper);
    });

    // --- Update Expanded Editor ---
    const editorExpandedEditor = document.getElementById('editorExpandedEditor');
    const singleNoteControls = document.getElementById('singleNoteControls');
    const chordNotesEditor = document.getElementById('chordNotesEditor');
    const chordNotesContainer = document.getElementById('chordNotesContainer');

    if (editorSelectedNoteIndex !== null && currentMeasure[editorSelectedNoteIndex]) {
        editorExpandedEditor.classList.remove('hidden');
        const selectedNote = currentMeasure[editorSelectedNoteIndex];
        const isSelectedNoteRest = selectedNote.isRest;
        const isSelectedNoteChord = isChord(selectedNote.name);

        document.getElementById('editorSelectedNoteDisplay').textContent = isSelectedNoteRest ? "Rest" : (isSelectedNoteChord ? `Chord (${parseChord(selectedNote.name).length})` : selectedNote.name);
        document.getElementById('editorToggleClef').textContent = selectedNote.clef === 'treble' ? 'Treble' : 'Bass';
        document.getElementById('editorDurationDropdown').value = selectedNote.duration;

        // Toggle visibility of single note vs. chord controls
        if (isSelectedNoteRest) {
            singleNoteControls.classList.remove('hidden');
            chordNotesEditor.classList.add('hidden');
            document.getElementById('editorNoteLetter').value = 'R';
            document.getElementById('editorAccidentalDropdown').value = '';
            document.getElementById('editorOctaveDropdown').value = ''; // Rests don't have octaves
            document.getElementById('editorNoteLetter').disabled = true;
            document.getElementById('editorAccidentalDropdown').disabled = true;
            document.getElementById('editorOctaveDropdown').disabled = true;
        } else if (isSelectedNoteChord) {
            singleNoteControls.classList.add('hidden');
            chordNotesEditor.classList.remove('hidden');
            document.getElementById('editorNoteLetter').disabled = true;
            document.getElementById('editorAccidentalDropdown').disabled = true;
            document.getElementById('editorOctaveDropdown').disabled = true;
            
            // Populate chord notes editor
            chordNotesContainer.innerHTML = '';
            const individualChordNotes = parseChord(selectedNote.name);
            individualChordNotes.forEach((noteName, idx) => {
                const noteParts = parseSingleNoteName(noteName);
                const noteDiv = document.createElement('div');
                noteDiv.className = 'chord-note-item control-group';
                noteDiv.innerHTML = `
                    <label>Note ${idx + 1}:</label>
                    <select class="chord-note-letter" data-note-index="${idx}">
                        <option value="C">C</option><option value="D">D</option><option value="E">E</option>
                        <option value="F">F</option><option value="G">G</option><option value="A">A</option>
                        <option value="B">B</option>
                    </select>
                    <select class="chord-note-accidental" data-note-index="${idx}">
                        <option value="">None</option><option value="#">#</option><option value="b">b</option>
                    </select>
                    <select class="chord-note-octave" data-note-index="${idx}">
                        <option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option>
                    </select>
                    <button class="remove-chord-note-btn" data-note-index="${idx}">x</button>
                `;
                chordNotesContainer.appendChild(noteDiv);

                // Set values
                noteDiv.querySelector('.chord-note-letter').value = noteParts.letter;
                noteDiv.querySelector('.chord-note-accidental').value = noteParts.accidental;
                noteDiv.querySelector('.chord-note-octave').value = noteParts.octave;
            });

        } else { // Single note
            singleNoteControls.classList.remove('hidden');
            chordNotesEditor.classList.add('hidden');
            const { letter, accidental, octave } = parseSingleNoteName(selectedNote.name);
            document.getElementById('editorNoteLetter').value = letter;
            document.getElementById('editorAccidentalDropdown').value = accidental;
            document.getElementById('editorOctaveDropdown').value = octave;
            document.getElementById('editorNoteLetter').disabled = false;
            document.getElementById('editorAccidentalDropdown').disabled = false;
            document.getElementById('editorOctaveDropdown').disabled = false;
        }

    } else {
        editorExpandedEditor.classList.add('hidden');
        editorSelectedNoteIndex = null;
    }

    // --- Update Score Highlighting using Refactored Functions ---
    // Ensure measure is always highlighted if selected, regardless of note selection
    highlightSelectedMeasure(editorSelectedMeasureIndex);
    console.log("edit box rendered, highlighting measure");

    // Then, if a note is selected, highlight it distinctly
    if (editorSelectedNoteIndex !== null && currentMeasure[editorSelectedNoteIndex]) {
        const note = currentMeasure[editorSelectedNoteIndex];
        const notesInClef = currentMeasure.filter(n => n.clef === note.clef);
        const vexflowIndex = notesInClef.indexOf(note); // This assumes note object identity
        if (vexflowIndex !== -1) {
            highlightSelectedNote(editorSelectedMeasureIndex, note.clef, vexflowIndex);
        } else {
            console.warn("Could not find VexFlow index for selected note during highlighting. Re-rendering score.");
            // Fallback: If for some reason we lose reference, force a full redraw.
            drawAll(measures);
            highlightSelectedMeasure(editorSelectedMeasureIndex);
        }
    } else {
        // If no note is selected, clear any lingering note highlight
        clearSelectedNoteHighlight();
    }
    console.log('renderNoteEditBox completed.');
}

/**
 * Handles changing the current measure.
 * @param {number} newMeasureIndex - The index of the measure to switch to.
 */
function changeMeasure(newMeasureIndex) {
    console.log('changeMeasure called with index:', newMeasureIndex);
    const measures = getMeasures();
    if (newMeasureIndex >= 0 && newMeasureIndex <= measures.length) {
        editorSelectedMeasureIndex = newMeasureIndex;
        editorSelectedNoteIndex = null; // Deselect any note when changing measure
        renderNoteEditBox();
        scrollToMeasure(editorSelectedMeasureIndex);
    }
    console.log('changeMeasure completed. New selected measure:', editorSelectedMeasureIndex);
}

// ===================================================================
// Handlers for Direct Score Interaction
// ===================================================================
function handleEditorNoteSelectClick(measureIndex, clef, noteId) {
    console.log('handleEditorNoteSelectClick called with measure:', measureIndex, 'clef:', clef, 'noteId:', noteId);

    editorSelectedMeasureIndex = measureIndex; // Always update the selected measure

    if (noteId === null) {
        // This indicates a click on an empty space or measure background.
        // We should deselect any currently selected note and ensure the measure is highlighted.
        console.log('handleEditorNoteSelectClick: Click on empty space or measure background detected. Deselecting note.');
        editorSelectedNoteId = null; // Clear any existing note selection
        clearSelectedNoteHighlight(); // Ensure visual clear
        renderNoteEditBox(); // Re-render to reflect the deselection and measure highlight
        return; // Exit, as no specific note needs to be selected/edited
    }

    // If we reach here, `noteId` is a valid ID for an existing note.
    const currentMeasureNotes = getMeasures()[measureIndex] || [];

    // Validate that the note actually exists with this ID
    const foundNote = currentMeasureNotes.find(note => note.id === noteId);
    if (!foundNote || foundNote.clef !== clef) {
        console.warn(`handleEditorNoteSelectClick: Invalid or mismatched note data for ID ${noteId} in measure ${measureIndex}, clef ${clef}. Deselecting note.`);
        editorSelectedNoteId = null;
        clearSelectedNoteHighlight();
        renderNoteEditBox();
        return;
    }

    // Toggle selection: if the clicked note is already selected, deselect it.
    // Otherwise, select the new note.
    editorSelectedNoteId = (editorSelectedNoteId === noteId) ? null : noteId;
    console.log('Editor selected note ID:', editorSelectedNoteId);

    renderNoteEditBox(); // Re-render the UI to reflect the new selection state
}

/**
 * Handles a click event on a measure in the score display.
 * @param {number} measureIndex
 * @param {boolean} wasNoteClicked - True if the click originated from a note, false otherwise.
 */
function handleMeasureClick(measureIndex, wasNoteClicked) {
    console.log('handleMeasureClick called with measure:', measureIndex, 'wasNoteClicked:', wasNoteClicked);
    // If the click was not on a note, deselect any currently selected note.
    if (!wasNoteClicked) {
        editorSelectedNoteId = null;
        clearSelectedNoteHighlight(); // Explicitly clear note highlight if no note was clicked
    }
    // Always update the selected measure and re-render everything.
    editorSelectedMeasureIndex = measureIndex;
    renderNoteEditBox();
    scrollToMeasure(measureIndex);
}

/**
 * Handles a click event on a note in the score display.
 * @param {number} measureIndex
 * @param {string} clef
 * @param {string} noteId
 */
function handleNoteClick(measureIndex, clef, noteId) {
    console.log('handleNoteClick called with measure:', measureIndex, 'clef:', clef, 'noteId:', noteId);
    handleEditorNoteSelectClick(measureIndex, clef, noteId);
    scrollToMeasure(measureIndex);
}

// ===================================================================
// Chord Editing Logic
// ===================================================================

/**
 * Updates a chord based on the values in the chord notes editor UI.
 */
function updateChordFromUI() {
    console.log('updateChordFromUI called');
    const measures = getMeasures();
    const currentMeasure = measures[editorSelectedMeasureIndex];
    if (!currentMeasure || editorSelectedNoteIndex === null) {
        console.warn('No note selected or measure not found for chord update.');
        return;
    }

    const selectedNote = currentMeasure[editorSelectedNoteIndex];
    const chordNotes = [];
    const chordNoteItems = document.querySelectorAll('#chordNotesContainer .chord-note-item');
    let hasInvalidNotes = false;

    chordNoteItems.forEach(item => {
        const letter = item.querySelector('.chord-note-letter').value;
        const accidental = item.querySelector('.chord-note-accidental').value;
        const octave = item.querySelector('.chord-note-octave').value;
        if (letter && octave) {
            chordNotes.push(`${letter}${accidental}${octave}`);
        } else {
            hasInvalidNotes = true;
            console.warn('Invalid note component found in chord editor:', { letter, accidental, octave });
        }
    });

    if (hasInvalidNotes && chordNotes.length === 0) {
        console.error('Attempted to update chord with no valid notes, converting to rest.');
        updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { isRest: true, name: "R" });
        renderNoteEditBox();
        return;
    }
    
    const newName = formatChord(chordNotes);
    
    if (chordNotes.length === 1 && isChord(selectedNote.name)) {
        // If only one note remains in a chord, convert it back to a single note.
        console.log('Chord reduced to a single note, converting back to single note type.');
        updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { name: chordNotes[0], isRest: false });
    } else if (chordNotes.length > 0) {
        updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { name: newName, isRest: false });
    } else {
        // If all notes are removed from a chord, convert to a rest.
        console.log('All notes removed from chord, converting to rest.');
        updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { isRest: true, name: "R" });
    }
    renderNoteEditBox();
}

/**
 * Adds a new note field to the chord editor UI.
 */
function addNoteToChordUI() {
    console.log('addNoteToChordUI called');
    const measures = getMeasures();
    const currentMeasure = measures[editorSelectedMeasureIndex];
    if (!currentMeasure || editorSelectedNoteIndex === null) return;

    const selectedNote = currentMeasure[editorSelectedNoteIndex];
    let currentChordNotes = isChord(selectedNote.name) ? parseChord(selectedNote.name) : [selectedNote.name];

    // Add a default note, e.g., C4
    currentChordNotes.push('C4');
    
    updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { name: formatChord(currentChordNotes), isRest: false });
    renderNoteEditBox(); // Re-render to show the new note field
    console.log('addNoteToChordUI completed. New chord notes:', currentChordNotes);
}

/**
 * Removes a note field from the chord editor UI and updates the chord data.
 * @param {number} noteIdxToRemove - The index of the note within the chord's array to remove.
 */
function removeNoteFromChordUI(noteIdxToRemove) {
    console.log('removeNoteFromChordUI called with index:', noteIdxToRemove);
    const measures = getMeasures();
    const currentMeasure = measures[editorSelectedMeasureIndex];
    if (!currentMeasure || editorSelectedNoteIndex === null) return;

    const selectedNote = currentMeasure[editorSelectedNoteIndex];
    let currentChordNotes = isChord(selectedNote.name) ? parseChord(selectedNote.name) : [selectedNote.name];

    if (currentChordNotes.length > 1) {
        currentChordNotes.splice(noteIdxToRemove, 1); // Remove the note
        updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { name: formatChord(currentChordNotes) });
    } else {
        // If only one note is left and it's removed, convert to a rest
        console.log('Last note of chord removed, converting to rest.');
        updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { isRest: true, name: "R" });
    }
    renderNoteEditBox(); // Re-render to update the UI
    console.log('removeNoteFromChordUI completed. Remaining chord notes:', currentChordNotes);
}

// ===================================================================
// Initialization Function (Exported)
// ===================================================================

/**
 * Initializes the music editor UI and attaches all event listeners.
 */
export function initializeMusicEditor() {
    console.log("initializeMusicEditor called.");
    renderNoteEditBox();
    enableScoreInteraction(handleMeasureClick, handleNoteClick);

    // --- Event Delegation for UI Controls ---
    const editorContainer = document.getElementById('editorContainer');
    if (!editorContainer) {
        console.error("Editor container not found!");
        return;
    }

    editorContainer.addEventListener('click', (event) => {
        const target = event.target;
        console.log('Click event on editorContainer. Target ID:', target.id, 'Classes:', target.classList);

        // --- Measure Navigation ---
        if (target.id === 'editorPrevBtn') changeMeasure(editorSelectedMeasureIndex - 1);
        if (target.id === 'editorNextBtn') changeMeasure(editorSelectedMeasureIndex + 1);

        // --- Note Actions (Initial View) ---
        if (target.classList.contains('add-note-initial')) {
            const insertAfterLinearIndex = parseInt(target.dataset.originalIndex, 10);
            const newClef = target.dataset.clef;
            const newNote = { name: "C4", clef: newClef, duration: "q", isRest: false };
            addNoteToMeasure(editorSelectedMeasureIndex, newNote, insertAfterLinearIndex + 1);
            editorSelectedNoteIndex = insertAfterLinearIndex + 1; // Select the newly added note
            renderNoteEditBox();
        }
        if (target.classList.contains('editor-note-select')) {
            const vexflowIndex = parseInt(target.dataset.vexflowNoteIndex, 10);
            const clef = target.dataset.clef;
            handleEditorNoteSelectClick(editorSelectedMeasureIndex, clef, vexflowIndex);
        }

        // --- Expanded Editor Actions (Common) ---
        if (target.id === 'editorRemoveNote') {
            removeNoteFromMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex);
            editorSelectedNoteIndex = null; // Deselect after removal
            renderNoteEditBox();
        }
        if (target.id === 'editorToggleClef') {
            const note = getMeasures()[editorSelectedMeasureIndex]?.[editorSelectedNoteIndex];
            if (note) updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { clef: note.clef === 'treble' ? 'bass' : 'treble' });
            renderNoteEditBox();
        }
        if (target.id === 'editorToggleRest') {
            const note = getMeasures()[editorSelectedMeasureIndex]?.[editorSelectedNoteIndex];
            if (note) {
                // If it's a chord and we toggle to rest, remove individual notes and set to rest
                // If it's a rest and we toggle to note, set a default note
                const newIsRest = !note.isRest;
                let newName = note.name;
                if (newIsRest) {
                    newName = "R";
                } else if (note.isRest) {
                    // When toggling from rest to note, set a default single note
                    newName = "C4"; 
                } // Else, if it's already a note, keep its current name
                updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { isRest: newIsRest, name: newName });
            }
            renderNoteEditBox();
        }
        if (target.id === 'editorMoveToPrevMeasure') {
            if (editorSelectedNoteIndex !== null && editorSelectedMeasureIndex > 0) {
                console.log(`Attempting to move note from measure ${editorSelectedMeasureIndex} to ${editorSelectedMeasureIndex - 1}`);
                moveNoteBetweenMeasures(editorSelectedMeasureIndex, editorSelectedNoteIndex, editorSelectedMeasureIndex - 1);
                editorSelectedNoteIndex = null; // Deselect after move
                renderNoteEditBox();
            } else {
                console.log("Cannot move to previous measure: no note selected or already at first measure.");
            }
        }
        if (target.id === 'editorMoveToNextMeasure') {
            if (editorSelectedNoteIndex !== null) {
                console.log(`Attempting to move note from measure ${editorSelectedMeasureIndex} to ${editorSelectedMeasureIndex + 1}`);
                moveNoteBetweenMeasures(editorSelectedMeasureIndex, editorSelectedNoteIndex, editorSelectedMeasureIndex + 1);
                editorSelectedNoteIndex = null; // Deselect after move
                renderNoteEditBox();
            } else {
                console.log("Cannot move to next measure: no note selected.");
            }
        }

        // --- Chord Specific Actions ---
        if (target.id === 'addNoteToChordBtn') {
            addNoteToChordUI();
        }
        if (target.classList.contains('remove-chord-note-btn')) {
            const noteIdx = parseInt(target.dataset.noteIndex, 10);
            removeNoteFromChordUI(noteIdx);
        }
    });

    editorContainer.addEventListener('change', (event) => {
        const target = event.target;
        const measures = getMeasures();
        const currentMeasure = measures[editorSelectedMeasureIndex];
        if (!currentMeasure || editorSelectedNoteIndex === null) {
            console.warn('No note selected for change event.');
            return;
        }
        
        const selectedNote = currentMeasure[editorSelectedNoteIndex];
        console.log('Change event on editorContainer. Target ID:', target.id, 'Value:', target.value);

        if (selectedNote.isRest) {
            // Only duration can be changed for rests
            if (target.id === 'editorDurationDropdown') {
                updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { duration: target.value });
            }
            renderNoteEditBox();
            return;
        }

        // Handle single note property changes
        if (target.id === 'editorNoteLetter' || 
            target.id === 'editorAccidentalDropdown' || 
            target.id === 'editorOctaveDropdown') {
            
            let newLetter = document.getElementById('editorNoteLetter').value;
            let newAccidental = document.getElementById('editorAccidentalDropdown').value;
            let newOctave = document.getElementById('editorOctaveDropdown').value;

            // Handle "R (Rest)" selection in letter dropdown for single note mode
            if (newLetter === 'R') {
                updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { isRest: true, name: "R" });
            } else {
                const newName = `${newLetter}${newAccidental}${newOctave}`;
                updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { name: newName, isRest: false });
            }
        } else if (target.id === 'editorDurationDropdown') {
            updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { duration: target.value });
        } else if (target.id === 'editorNumberInput') {
            const newMeasureNum = parseInt(target.value, 10);
            if (!isNaN(newMeasureNum) && newMeasureNum >= 1) {
                changeMeasure(newMeasureNum - 1);
            }
        } else if (target.classList.contains('chord-note-letter') ||
                   target.classList.contains('chord-note-accidental') ||
                   target.classList.contains('chord-note-octave')) {
            
            // Handle changes to individual notes within a chord
            updateChordFromUI();
            return; // updateChordFromUI already calls renderNoteEditBox()
        }

        renderNoteEditBox();
    });

    // --- Custom event listener for note drop from scoreRenderer.js ---
    document.addEventListener('noteDropped', (event) => {
        const { fromMeasureIndex, fromNoteIndex, toMeasureIndex, insertPosition, clefChanged, pitchChanged, newClef, newPitch } = event.detail;
        console.log("🎉 noteDropped event received in musicEditorUI.js:", event.detail);

        const measures = getMeasures();
        const originalNote = measures[fromMeasureIndex]?.[fromNoteIndex];

        if (!originalNote) {
            console.error("noteDropped: Original note not found in data model. Cannot process drop.");
            return;
        }

        // Scenario 1: Note moved to a different measure (potentially with clef/pitch change)
        if (fromMeasureIndex !== toMeasureIndex) {
            console.log(`noteDropped: Moving note from measure ${fromMeasureIndex} to ${toMeasureIndex}`);
            // Remove the note from its original position
            const noteToMove = removeNoteFromMeasure(fromMeasureIndex, fromNoteIndex);

            if (noteToMove) {
                // Apply clef and pitch changes to the noteToMove object
                if (clefChanged) {
                    noteToMove.clef = newClef;
                    console.log(`noteDropped: Clef changed to ${newClef}`);
                }
                if (pitchChanged) {
                    noteToMove.name = newPitch;
                    console.log(`noteDropped: Pitch changed to ${newPitch}`);
                }
                // Add to the new measure at the calculated insert position
                addNoteToMeasure(toMeasureIndex, noteToMove, insertPosition);
                editorSelectedMeasureIndex = toMeasureIndex;
                // We need to re-evaluate editorSelectedNoteIndex as the linear indices change after move/remove/add
                // This is a tricky part. For now, deselect the note and rely on measure selection.
                editorSelectedNoteIndex = null; 
                console.log(`noteDropped: Note successfully moved and updated.`);
            } else {
                console.error("noteDropped: Failed to remove original note during move operation.");
            }
        } 
        // Scenario 2: Note dropped within the same measure, but clef or pitch changed
        else if (clefChanged || pitchChanged) {
            console.log(`noteDropped: Updating note within measure ${fromMeasureIndex}. Clef changed: ${clefChanged}, Pitch changed: ${pitchChanged}`);
            const updatedNoteData = {};
            if (clefChanged) {
                updatedNoteData.clef = newClef;
            }
            if (pitchChanged) {
                updatedNoteData.name = newPitch;
            }
            updateNoteInMeasure(fromMeasureIndex, fromNoteIndex, updatedNoteData);
            editorSelectedNoteIndex = fromNoteIndex; // Keep the note selected if it's an in-place edit
            console.log(`noteDropped: Note updated in place with clef ${newClef} and pitch ${newPitch}.`);
        } else {
            console.log("noteDropped: No measure, clef, or pitch change detected. No action taken on data model.");
        }
        
        renderNoteEditBox(); // Re-render the UI to reflect changes
        scrollToMeasure(editorSelectedMeasureIndex); // Ensure the relevant measure is in view
    });


    // Populate duration dropdown once
    const durationDropdown = document.getElementById('editorDurationDropdown');
    if (durationDropdown) {
        DURATIONS.forEach(duration => {
            const option = document.createElement('option');
            option.value = duration.key;
            option.textContent = duration.name;
            durationDropdown.appendChild(option);
        });
    }

    // Populate octave dropdown for single notes
    const octaveDropdown = document.getElementById('editorOctaveDropdown');
    if (octaveDropdown) {
        // Clear existing options, if any
        octaveDropdown.innerHTML = '';
        for (let i = 2; i <= 7; i++) { // From Octave 2 to 7 as per note-data.js
            const option = document.createElement('option');
            option.value = i.toString();
            option.textContent = i.toString();
            octaveDropdown.appendChild(option);
        }
    }

    console.log("✓ musicEditorUI.js initialized successfully");
}