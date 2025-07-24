// musicEditorUI.js
// This module handles the interactive UI for editing notes within a measure.
// REFACTORED to use the new BEM HTML structure and handle chordName property.

// ===================================================================
// Imports
// ===================================================================
import { pianoState } from "./appState.js";
import { getMeasures, addNoteToMeasure, removeNoteFromMeasure, updateNoteInMeasure, moveNoteBetweenMeasures } from './scoreWriter.js';
import {
    drawAll,
    scrollToMeasure,
    enableScoreInteraction,
} from './scoreRenderer.js';
import { DURATIONS, NOTES_BY_NAME, ALL_NOTE_INFO } from './note-data.js';
import {
    highlightSelectedMeasure,
    highlightSelectedNote,
    clearSelectedNoteHighlight,
} from './scoreHighlighter.js';

// ===================================================================
// Internal State
// ===================================================================

let editorSelectedNoteId = null; // ID of the currently selected note
let editorSelectedMeasureIndex = 0;

// ===================================================================
// Helper Functions
// ===================================================================

function isChord(noteName) {
    return noteName && noteName.startsWith('(') && noteName.endsWith(')');
}

function parseChord(chordString) {
    if (!isChord(chordString)) {
        return [chordString];
    }
    return chordString.substring(1, chordString.length - 1).split(' ').filter(Boolean);
}

function formatChord(noteArray) {
    if (!Array.isArray(noteArray) || noteArray.length === 0) {
        return '';
    }
    const uniqueNotes = [...new Set(noteArray)].sort();
    return uniqueNotes.length > 1 ? `(${uniqueNotes.join(' ')})` : uniqueNotes[0];
}

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
    const letter = noteName.charAt(0).toUpperCase();
    const accidentalMatch = noteName.match(/[#b]/);
    const accidental = accidentalMatch ? accidentalMatch[0] : '';
    const octaveMatch = noteName.match(/[0-9]+/);
    const octave = octaveMatch ? octaveMatch[0] : '';
    return { letter, accidental, octave };
}

/**
 * Transposes a chord by a given number of semitones
 * @param {string} chordString - The chord in format "(C4 E4 G4)" or single note "C4"
 * @param {number} semitones - Number of semitones to transpose (positive = up, negative = down)
 * @returns {string} - Transposed chord in same format
 */
function transposeChord(chordString, semitones) {
    if (semitones === 0) return chordString;

    const notes = parseChord(chordString);
    const transposedNotes = notes.map(noteName => {
        const originalMidi = NOTES_BY_NAME[noteName];
        if (originalMidi === undefined) {
            console.warn(`transposeChord: Unknown note ${noteName}, keeping unchanged`);
            return noteName;
        }

        const newMidi = originalMidi + semitones;
        const newNoteInfo = ALL_NOTE_INFO.find(info => info.midi === newMidi);
        if (!newNoteInfo) {
            console.warn(`transposeChord: MIDI ${newMidi} out of range, keeping ${noteName} unchanged`);
            return noteName;
        }

        return newNoteInfo.name;
    });

    return formatChord(transposedNotes);
}

/**
 * Gets display text for a note, preferring chordName over name
 * @param {Object} note - The note object
 * @returns {string} - Display text
 */
function getNoteDisplayText(note) {
    if (note.isRest) return "Rest";
    if (note.chordName && note.chordName !== note.name) {
        return note.chordName;
    }
    if (isChord(note.name)) {
        return `Chord (${parseChord(note.name).length})`;
    }
    return note.name;
}

// ===================================================================
// UI Rendering Functions
// ===================================================================

function renderNoteEditBox() {
    const measures = getMeasures();
    if (editorSelectedMeasureIndex >= measures.length) {
        editorSelectedMeasureIndex = Math.max(0, measures.length - 1);
    }
    const currentMeasure = measures[editorSelectedMeasureIndex] || [];

    const measureNumberInput = document.getElementById('editorNumberInput');
    if (measureNumberInput) {
        measureNumberInput.value = editorSelectedMeasureIndex + 1;
        measureNumberInput.max = measures.length > 0 ? measures.length : 1;
    }
    document.getElementById('editorPrevBtn').disabled = editorSelectedMeasureIndex <= 0;
    document.getElementById('editorNextBtn').disabled = false;

    const trebleNotesContainer = document.getElementById('editorTrebleNotesContainer');
    const bassNotesContainer = document.getElementById('editorBassNotesContainer');
    trebleNotesContainer.innerHTML = '';
    bassNotesContainer.innerHTML = '';

    const createAddButton = (clef, originalIndex) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn--compact btn--info add-note-initial';
        btn.dataset.originalIndex = originalIndex;
        btn.dataset.clef = clef;
        btn.textContent = '+';
        return btn;
    };

    const createNoteButton = (note) => {
        const btn = document.createElement('button');
        btn.className = `btn btn--compact editor-note-select note-duration-${note.duration.replace('.', 'dot')}`;
        btn.dataset.noteId = note.id;
        btn.dataset.clef = note.clef;
        btn.textContent = getNoteDisplayText(note);
        if (note.id === editorSelectedNoteId) {
            btn.classList.add('active-note-select');
        }
        return btn;
    };

    const addInitialButtonToContainer = (container, clef) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'button-group';
        wrapper.appendChild(createAddButton(clef, -1));
        container.appendChild(wrapper);
    };

    addInitialButtonToContainer(trebleNotesContainer, 'treble');
    addInitialButtonToContainer(bassNotesContainer, 'bass');

    currentMeasure.forEach((note, noteIndex) => {
        const container = note.clef === 'treble' ? trebleNotesContainer : bassNotesContainer;
        const noteWrapper = document.createElement('div');
        noteWrapper.className = 'button-group';
        noteWrapper.appendChild(createNoteButton(note));
        noteWrapper.appendChild(createAddButton(note.clef, noteIndex));
        container.appendChild(noteWrapper);
    });

    const editorExpandedEditor = document.getElementById('editorExpandedEditor');
    const singleNoteControls = document.getElementById('singleNoteControls');
    const chordNotesEditor = document.getElementById('chordNotesEditor');
    const chordNotesContainer = document.getElementById('chordNotesContainer');
    const selectedNote = editorSelectedNoteId !== null ? currentMeasure.find(note => note.id === editorSelectedNoteId) : null;

    if (selectedNote) {
        editorExpandedEditor.classList.remove('hidden');
        const isSelectedNoteRest = selectedNote.isRest;
        const isSelectedNoteChord = isChord(selectedNote.name);

        document.getElementById('editorSelectedNoteDisplay').textContent = getNoteDisplayText(selectedNote);
        document.getElementById('editorToggleClef').textContent = selectedNote.clef === 'treble' ? 'Treble' : 'Bass';
        document.getElementById('editorDurationDropdown').value = selectedNote.duration;

        if (isSelectedNoteRest) {
            singleNoteControls.classList.remove('hidden');
            chordNotesEditor.classList.add('hidden');
            document.getElementById('editorNoteLetter').value = 'R';
            document.getElementById('editorAccidentalDropdown').value = '';
            document.getElementById('editorOctaveDropdown').value = '';
            document.getElementById('editorNoteLetter').disabled = true;
            document.getElementById('editorAccidentalDropdown').disabled = true;
            document.getElementById('editorOctaveDropdown').disabled = true;
        } else if (isSelectedNoteChord) {
            singleNoteControls.classList.add('hidden');
            chordNotesEditor.classList.remove('hidden');
            chordNotesContainer.innerHTML = '';
            const individualChordNotes = parseChord(selectedNote.name);
            individualChordNotes.forEach((noteName, noteIndex) => {
                const noteParts = parseSingleNoteName(noteName);
                const noteDiv = document.createElement('div');
                noteDiv.className = 'chord-note-item control-group';
                noteDiv.innerHTML = `
                    <label>Note ${noteIndex + 1}:</label>
                    <select class="chord-note-letter dropdown-select" data-note-index="${noteIndex}"><option value="C">C</option><option value="D">D</option><option value="E">E</option><option value="F">F</option><option value="G">G</option><option value="A">A</option><option value="B">B</option></select>
                    <select class="chord-note-accidental dropdown-select" data-note-index="${noteIndex}"><option value="">None</option><option value="#">#</option><option value="b">b</option></select>
                    <select class="chord-note-octave dropdown-select" data-note-index="${noteIndex}"><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option></select>
                    <button class="btn btn--compact btn--danger remove-chord-note-btn" data-note-index="${noteIndex}">x</button>
                `;
                chordNotesContainer.appendChild(noteDiv);
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
        editorSelectedNoteId = null;
    }

    highlightSelectedMeasure(editorSelectedMeasureIndex);
    if (selectedNote) {
        highlightSelectedNote(editorSelectedMeasureIndex, selectedNote.clef, selectedNote.id);
    } else {
        clearSelectedNoteHighlight();
        pianoState.currentSelectedNote = null;
    }
}

function changeMeasure(newMeasureIndex) {
    const measures = getMeasures();
    if (newMeasureIndex >= 0 && newMeasureIndex <= measures.length) {
        editorSelectedMeasureIndex = newMeasureIndex;
        editorSelectedNoteId = null;
        renderNoteEditBox();
        scrollToMeasure(editorSelectedMeasureIndex);
    }
}

// ===================================================================
// Handlers & Event Listeners
// ===================================================================

function handleEditorNoteSelectClick(measureIndex, clef, noteId) {
    editorSelectedMeasureIndex = measureIndex;
    if (noteId === null) {
        editorSelectedNoteId = null;
        clearSelectedNoteHighlight();
        renderNoteEditBox();
        return;
    }
    const currentMeasureNotes = getMeasures()[measureIndex] || [];
    const foundNote = currentMeasureNotes.find(note => note.id === noteId);
    if (!foundNote || foundNote.clef !== clef) {
        editorSelectedNoteId = null;
        clearSelectedNoteHighlight();
        renderNoteEditBox();
        return;
    }
    editorSelectedNoteId = (editorSelectedNoteId === noteId) ? null : noteId;
    renderNoteEditBox();
}

function handleMeasureClick(measureIndex, wasNoteClicked) {
    if (!wasNoteClicked) {
        editorSelectedNoteId = null;
        clearSelectedNoteHighlight();
    }
    editorSelectedMeasureIndex = measureIndex;
    renderNoteEditBox();
    scrollToMeasure(measureIndex);
}

function handleNoteClick(measureIndex, clef, noteId) {
    handleEditorNoteSelectClick(measureIndex, clef, noteId);
    scrollToMeasure(measureIndex);
}

function updateChordFromUI() {
    const measures = getMeasures();
    const currentMeasure = measures[editorSelectedMeasureIndex];
    if (!currentMeasure || editorSelectedNoteId === null) return;
    const selectedNote = currentMeasure.find(note => note.id === editorSelectedNoteId);
    if (!selectedNote) return;

    const chordNotes = [];
    document.querySelectorAll('#chordNotesContainer .chord-note-item').forEach(item => {
        const letter = item.querySelector('.chord-note-letter').value;
        const accidental = item.querySelector('.chord-note-accidental').value;
        const octave = item.querySelector('.chord-note-octave').value;
        if (letter && octave) chordNotes.push(`${letter}${accidental}${octave}`);
    });

    if (chordNotes.length === 0) {
        updateNoteInMeasure(editorSelectedMeasureIndex, selectedNote.id, { isRest: true, name: "R" });
    } else if (chordNotes.length === 1 && isChord(selectedNote.name)) {
        updateNoteInMeasure(editorSelectedMeasureIndex, selectedNote.id, { name: chordNotes[0], isRest: false });
    } else {
        updateNoteInMeasure(editorSelectedMeasureIndex, selectedNote.id, { name: formatChord(chordNotes), isRest: false });
    }
    renderNoteEditBox();
}

function addNoteToChordUI() {
    const measures = getMeasures();
    const currentMeasure = measures[editorSelectedMeasureIndex];
    if (!currentMeasure || editorSelectedNoteId === null) return;
    const selectedNote = currentMeasure.find(note => note.id === editorSelectedNoteId);
    if (!selectedNote) return;
    let currentChordNotes = isChord(selectedNote.name) ? parseChord(selectedNote.name) : [selectedNote.name];
    currentChordNotes.push('C4');
    updateNoteInMeasure(editorSelectedMeasureIndex, selectedNote.id, { name: formatChord(currentChordNotes), isRest: false });
    renderNoteEditBox();
}

function removeNoteFromChordUI(noteIndexToRemove) {
    const measures = getMeasures();
    const currentMeasure = measures[editorSelectedMeasureIndex];
    if (!currentMeasure || editorSelectedNoteId === null) return;
    const selectedNote = currentMeasure.find(note => note.id === editorSelectedNoteId);
    if (!selectedNote) return;
    let currentChordNotes = isChord(selectedNote.name) ? parseChord(selectedNote.name) : [selectedNote.name];
    if (currentChordNotes.length > 1) {
        currentChordNotes.splice(noteIndexToRemove, 1);
        updateNoteInMeasure(editorSelectedMeasureIndex, selectedNote.id, { name: formatChord(currentChordNotes) });
    } else {
        updateNoteInMeasure(editorSelectedMeasureIndex, selectedNote.id, { isRest: true, name: "R" });
    }
    renderNoteEditBox();
}

// ===================================================================
// Initialization Function (Exported)
// ===================================================================

export function initializeMusicEditor() {
    renderNoteEditBox();
    enableScoreInteraction(handleMeasureClick, handleNoteClick);

    // FIX: Target the correct container for event delegation
    const editorContainer = document.getElementById('editorContainer');
    if (!editorContainer) {
        console.error("Editor container with ID 'editorContainer' not found. Cannot initialize editor.");
        return;
    }

    editorContainer.addEventListener('click', (event) => {
        const target = event.target.closest('button');
        if (!target) return;

        if (target.id === 'editorPrevBtn') changeMeasure(editorSelectedMeasureIndex - 1);
        if (target.id === 'editorNextBtn') changeMeasure(editorSelectedMeasureIndex + 1);

        if (target.classList.contains('add-note-initial')) {
            const insertAfterLinearIndex = parseInt(target.dataset.originalIndex, 10);
            const newClef = target.dataset.clef;
            const newNote = { name: "C4", clef: newClef, duration: "q", isRest: false };
            const addedNoteId = addNoteToMeasure(editorSelectedMeasureIndex, newNote, insertAfterLinearIndex + 1);
            editorSelectedNoteId = addedNoteId;
            renderNoteEditBox();
        }
        if (target.classList.contains('editor-note-select')) {
            const noteId = target.dataset.noteId;
            const clef = target.dataset.clef;
            handleEditorNoteSelectClick(editorSelectedMeasureIndex, clef, noteId);
        }

        if (target.id === 'editorRemoveNote') {
            removeNoteFromMeasure(editorSelectedMeasureIndex, editorSelectedNoteId);
            editorSelectedNoteId = null;
            renderNoteEditBox();
        }
        if (target.id === 'editorToggleClef') {
            const measures = getMeasures();
            const note = measures[editorSelectedMeasureIndex]?.find(n => n.id === editorSelectedNoteId);
            if (note) updateNoteInMeasure(editorSelectedMeasureIndex, note.id, { clef: note.clef === 'treble' ? 'bass' : 'treble' });
            renderNoteEditBox();
        }
        if (target.id === 'editorToggleRest') {
            const measures = getMeasures();
            const note = measures[editorSelectedMeasureIndex]?.find(n => n.id === editorSelectedNoteId);
            if (note) {
                const newIsRest = !note.isRest;
                let newName = newIsRest ? "R" : (note.isRest ? "C4" : note.name);
                updateNoteInMeasure(editorSelectedMeasureIndex, note.id, { isRest: newIsRest, name: newName });
            }
            renderNoteEditBox();
        }
        if (target.id === 'editorMoveToPrevMeasure') {
            if (editorSelectedNoteId !== null && editorSelectedMeasureIndex > 0) {
                moveNoteBetweenMeasures(editorSelectedMeasureIndex, editorSelectedNoteId, editorSelectedMeasureIndex - 1);
                editorSelectedNoteId = null;
                renderNoteEditBox();
            }
        }
        if (target.id === 'editorMoveToNextMeasure') {
            if (editorSelectedNoteId !== null) {
                moveNoteBetweenMeasures(editorSelectedMeasureIndex, editorSelectedNoteId, editorSelectedMeasureIndex + 1);
                editorSelectedNoteId = null;
                renderNoteEditBox();
            }
        }

        if (target.id === 'addNoteToChordBtn') addNoteToChordUI();
        if (target.classList.contains('remove-chord-note-btn')) {
            const noteIndex = parseInt(target.dataset.noteIndex, 10);
            removeNoteFromChordUI(noteIndex);
        }
    });

    editorContainer.addEventListener('change', (event) => {
        const target = event.target;
        const measures = getMeasures();
        const currentMeasure = measures[editorSelectedMeasureIndex];
        if (!currentMeasure || editorSelectedNoteId === null) return;
        const selectedNote = currentMeasure.find(note => note.id === editorSelectedNoteId);
        if (!selectedNote) return;

        if (selectedNote.isRest) {
            if (target.id === 'editorDurationDropdown') {
                updateNoteInMeasure(editorSelectedMeasureIndex, selectedNote.id, { duration: target.value });
            }
            renderNoteEditBox();
            return;
        }

        if (['editorNoteLetter', 'editorAccidentalDropdown', 'editorOctaveDropdown'].includes(target.id)) {
            let newLetter = document.getElementById('editorNoteLetter').value;
            if (newLetter === 'R') {
                updateNoteInMeasure(editorSelectedMeasureIndex, selectedNote.id, { isRest: true, name: "R" });
            } else {
                let newAccidental = document.getElementById('editorAccidentalDropdown').value;
                let newOctave = document.getElementById('editorOctaveDropdown').value;
                updateNoteInMeasure(editorSelectedMeasureIndex, selectedNote.id, { name: `${newLetter}${newAccidental}${newOctave}`, isRest: false });
            }
        } else if (target.id === 'editorDurationDropdown') {
            updateNoteInMeasure(editorSelectedMeasureIndex, selectedNote.id, { duration: target.value });
        } else if (target.id === 'editorNumberInput') {
            const newMeasureNum = parseInt(target.value, 10);
            if (!isNaN(newMeasureNum) && newMeasureNum >= 1) changeMeasure(newMeasureNum - 1);
        } else if (target.matches('.chord-note-letter, .chord-note-accidental, .chord-note-octave')) {
            updateChordFromUI();
            return;
        }
        renderNoteEditBox();
    });

    document.addEventListener('noteDropped', (event) => {
        const { fromMeasureIndex, fromNoteId, toMeasureIndex, insertPosition, clefChanged, pitchChanged, newClef, newPitch } = event.detail;
        const measures = getMeasures();
        const originalNote = measures[fromMeasureIndex]?.find(note => note.id === fromNoteId);
        if (!originalNote) return;

        if (fromMeasureIndex !== toMeasureIndex) {
            // Moving between measures - maintain chord structure
            const noteToMove = removeNoteFromMeasure(fromMeasureIndex, fromNoteId);
            if (noteToMove) {
                if (clefChanged) noteToMove.clef = newClef;
                if (pitchChanged && !originalNote.isRest) {
                    // Handle chord transposition
                    if (isChord(originalNote.name)) {
                        const originalFirstNoteMidi = NOTES_BY_NAME[parseChord(originalNote.name)[0]];
                        const newPitchMidi = NOTES_BY_NAME[newPitch];
                        if (originalFirstNoteMidi !== undefined && newPitchMidi !== undefined) {
                            const semitoneChange = newPitchMidi - originalFirstNoteMidi;
                            noteToMove.name = transposeChord(originalNote.name, semitoneChange);
                        }
                    } else {
                        noteToMove.name = newPitch;
                    }
                }
                addNoteToMeasure(toMeasureIndex, noteToMove, insertPosition);
                editorSelectedMeasureIndex = toMeasureIndex;
                editorSelectedNoteId = noteToMove.id;
            }
        } else if (clefChanged || pitchChanged) {
            // Same measure, just changing properties
            const updatedNoteData = {};
            if (clefChanged) updatedNoteData.clef = newClef;
            if (pitchChanged && !originalNote.isRest) {
                if (isChord(originalNote.name)) {
                    const originalFirstNoteMidi = NOTES_BY_NAME[parseChord(originalNote.name)[0]];
                    const newPitchMidi = NOTES_BY_NAME[newPitch];
                    if (originalFirstNoteMidi !== undefined && newPitchMidi !== undefined) {
                        const semitoneChange = newPitchMidi - originalFirstNoteMidi;
                        updatedNoteData.name = transposeChord(originalNote.name, semitoneChange);
                    }
                } else {
                    updatedNoteData.name = newPitch;
                }
            }
            updateNoteInMeasure(fromMeasureIndex, fromNoteId, updatedNoteData);
            editorSelectedNoteId = fromNoteId;
        }
        renderNoteEditBox();
        scrollToMeasure(editorSelectedMeasureIndex);
    });

    const durationDropdown = document.getElementById('editorDurationDropdown');
    if (durationDropdown) {
        durationDropdown.innerHTML = ''; // Clear existing options before populating
        DURATIONS.forEach(duration => {
            const option = document.createElement('option');
            option.value = duration.key;
            option.textContent = duration.name;
            durationDropdown.appendChild(option);
        });
    }

    const octaveDropdown = document.getElementById('editorOctaveDropdown');
    if (octaveDropdown) {
        octaveDropdown.innerHTML = '';
        for (let i = 2; i <= 7; i++) {
            const option = document.createElement('option');
            option.value = i.toString();
            option.textContent = i.toString();
            octaveDropdown.appendChild(option);
        }
    }
    console.log("✓ musicEditorUI.js initialized successfully");
}