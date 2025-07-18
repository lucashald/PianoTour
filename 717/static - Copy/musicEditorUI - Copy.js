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
    enableNoteDragDrop,
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

function parseSingleNoteName(noteName) {
    if (!noteName) return { letter: 'C', accidental: '', octave: '4' };
    const match = noteName.match(/^([A-G])([#b]?)([0-9]?)$/i);
    if (match) {
        return {
            letter: match[1].toUpperCase(),
            accidental: match[2] || '',
            octave: match[3] || '',
        };
    }
    console.warn(`Could not fully parse note name: ${noteName}`);
    return { letter: noteName.charAt(0).toUpperCase(), accidental: '', octave: noteName.slice(-1) };
}

// ===================================================================
// UI Rendering Functions
// ===================================================================

/**
 * Renders the editor UI and updates the score's visual highlights.
 * This function no longer calls drawAll, relying on non-destructive highlighting functions.
 */
function renderNoteEditBox() {
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
    document.getElementById('editorNextBtn').disabled = false; // Always allow adding a new measure

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
        btn.dataset.vexflowNoteIndex = notesInClef.indexOf(note);
        btn.textContent = note.isRest ? "Rest" : note.name;
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
    if (editorSelectedNoteIndex !== null && currentMeasure[editorSelectedNoteIndex]) {
        editorExpandedEditor.classList.remove('hidden');
        const selectedNote = currentMeasure[editorSelectedNoteIndex];
        const isRest = selectedNote.isRest;
        
        document.getElementById('editorSelectedNoteDisplay').textContent = isRest ? "Rest" : selectedNote.name;
        document.getElementById('editorToggleClef').textContent = selectedNote.clef === 'treble' ? 'Treble' : 'Bass';
        document.getElementById('editorDurationDropdown').value = selectedNote.duration;

        if (isRest) {
            document.getElementById('editorNoteLetter').value = 'R';
            document.getElementById('editorAccidentalDropdown').value = '';
            document.getElementById('editorOctaveDropdown').value = '4';
        } else {
            const { letter, accidental, octave } = parseSingleNoteName(selectedNote.name);
            document.getElementById('editorNoteLetter').value = letter;
            document.getElementById('editorAccidentalDropdown').value = accidental;
            document.getElementById('editorOctaveDropdown').value = octave;
        }

        document.getElementById('editorNoteLetter').disabled = isRest;
        document.getElementById('editorAccidentalDropdown').disabled = isRest;
        document.getElementById('editorOctaveDropdown').disabled = isRest;
    } else {
        editorExpandedEditor.classList.add('hidden');
        editorSelectedNoteIndex = null;
    }

    // --- Update Score Highlighting using Refactored Functions ---
    // This simplified flow replaces all the previous clear/add logic.
    highlightSelectedMeasure(editorSelectedMeasureIndex);
    if (editorSelectedNoteIndex !== null && currentMeasure[editorSelectedNoteIndex]) {
        const note = currentMeasure[editorSelectedNoteIndex];
        const notesInClef = currentMeasure.filter(n => n.clef === note.clef);
        const vexflowIndex = notesInClef.indexOf(note);
        highlightSelectedNote(editorSelectedMeasureIndex, note.clef, vexflowIndex);
    }
}

/**
 * Handles changing the current measure.
 * @param {number} newMeasureIndex - The index of the measure to switch to.
 */
function changeMeasure(newMeasureIndex) {
    const measures = getMeasures();
    if (newMeasureIndex >= 0 && newMeasureIndex <= measures.length) {
        editorSelectedMeasureIndex = newMeasureIndex;
        editorSelectedNoteIndex = null;
        renderNoteEditBox();
        scrollToMeasure(editorSelectedMeasureIndex);
    }
}

// ===================================================================
// Handlers for Direct Score Interaction
// ===================================================================

/**
 * Handles the logic when an editor note selection event occurs.
 * @param {number} measureIndex - The measure index of the note.
 * @param {string} clef - The clef of the note.
 * @param {number} vexflowIndex - The VexFlow-internal index of the note.
 */
function handleEditorNoteSelectClick(measureIndex, clef, vexflowIndex) {
    editorSelectedMeasureIndex = measureIndex;
    const currentMeasureNotes = getMeasures()[measureIndex] || [];
    
    let actualNoteLinearIndex = -1;
    let notesInClefCount = 0;

    for (let i = 0; i < currentMeasureNotes.length; i++) {
        if (currentMeasureNotes[i].clef === clef) {
            if (notesInClefCount === vexflowIndex) {
                actualNoteLinearIndex = i;
                break;
            }
            notesInClefCount++;
        }
    }

    if (actualNoteLinearIndex !== -1) {
        editorSelectedNoteIndex = editorSelectedNoteIndex === actualNoteLinearIndex ? null : actualNoteLinearIndex;
        renderNoteEditBox();
    } else {
        console.warn(`Could not find linear index for VexFlow index ${vexflowIndex}`);
    }
}

/**
 * Handles a click event on a measure in the score display.
 * @param {number} measureIndex
 * @param {boolean} wasNoteClicked
 */
function handleMeasureClick(measureIndex, wasNoteClicked) {
    // If the click was not on a note, deselect any currently selected note.
    if (!wasNoteClicked) {
        editorSelectedNoteIndex = null;
    }
    // Update the selected measure and re-render everything.
    editorSelectedMeasureIndex = measureIndex;
    renderNoteEditBox();
    scrollToMeasure(measureIndex);
}

/**
 * Handles a click event on a note in the score display.
 * @param {number} measureIndex
 * @param {string} clef
 * @param {number} noteIndexInVexFlowArray
 */
function handleNoteClick(measureIndex, clef, noteIndexInVexFlowArray) {
    handleEditorNoteSelectClick(measureIndex, clef, noteIndexInVexFlowArray);
    scrollToMeasure(measureIndex);
}

// ===================================================================
// Initialization Function (Exported)
// ===================================================================

/**
 * Initializes the music editor UI and attaches all event listeners.
 */
export function initializeMusicEditor() {
    renderNoteEditBox();
    enableScoreInteraction(handleMeasureClick, handleNoteClick);
    enableNoteDragDrop();

    // --- Event Delegation for UI Controls ---
    const editorContainer = document.getElementById('editorContainer');
    if (!editorContainer) return;

    editorContainer.addEventListener('click', (event) => {
        const target = event.target;

        // --- Measure Navigation ---
        if (target.id === 'editorPrevBtn') changeMeasure(editorSelectedMeasureIndex - 1);
        if (target.id === 'editorNextBtn') changeMeasure(editorSelectedMeasureIndex + 1);

        // --- Note Actions (Initial View) ---
        if (target.classList.contains('add-note-initial')) {
            const insertAfterLinearIndex = parseInt(target.dataset.originalIndex, 10);
            const newClef = target.dataset.clef;
            const newNote = { name: "C4", clef: newClef, duration: "q", isRest: false };
            addNoteToMeasure(editorSelectedMeasureIndex, newNote, insertAfterLinearIndex + 1);
            editorSelectedNoteIndex = insertAfterLinearIndex + 1;
            renderNoteEditBox();
        }
        if (target.classList.contains('editor-note-select')) {
            const vexflowIndex = parseInt(target.dataset.vexflownoteindex, 10);
            handleEditorNoteSelectClick(editorSelectedMeasureIndex, target.dataset.clef, vexflowIndex);
        }

        // --- Expanded Editor Actions ---
        if (target.id === 'editorToggleClef') {
            const note = getMeasures()[editorSelectedMeasureIndex]?.[editorSelectedNoteIndex];
            if (note) updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { clef: note.clef === 'treble' ? 'bass' : 'treble' });
            renderNoteEditBox();
        }
        if (target.id === 'editorToggleRest') {
            const note = getMeasures()[editorSelectedMeasureIndex]?.[editorSelectedNoteIndex];
            if (note) updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { isRest: !note.isRest });
            renderNoteEditBox();
        }
        if (target.id === 'editorRemoveNote') {
            removeNoteFromMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex);
            editorSelectedNoteIndex = null;
            renderNoteEditBox();
        }
        // Move note buttons can be added here following the same pattern
    });

    editorContainer.addEventListener('change', (event) => {
        const target = event.target;
        const note = getMeasures()[editorSelectedMeasureIndex]?.[editorSelectedNoteIndex];
        if (!note) return;
        
        let newName = note.name;
        const currentNoteParts = parseSingleNoteName(newName);

        switch (target.id) {
            case 'editorNumberInput':
                const newMeasureNum = parseInt(target.value, 10);
                if (!isNaN(newMeasureNum) && newMeasureNum >= 1) changeMeasure(newMeasureNum - 1);
                break;
            case 'editorNoteLetter':
                if (target.value.toUpperCase() === 'R') {
                    updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { isRest: true });
                } else {
                    newName = `${target.value}${currentNoteParts.accidental}${currentNoteParts.octave}`;
                    updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { name: newName, isRest: false });
                }
                break;
            case 'editorAccidentalDropdown':
                newName = `${currentNoteParts.letter}${target.value}${currentNoteParts.octave}`;
                updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { name: newName });
                break;
            case 'editorOctaveDropdown':
                newName = `${currentNoteParts.letter}${currentNoteParts.accidental}${target.value}`;
                updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { name: newName });
                break;
            case 'editorDurationDropdown':
                updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteIndex, { duration: target.value });
                break;
        }
        renderNoteEditBox();
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

    console.log("✓ musicEditorUI.js initialized successfully");
}