// scoreEditor.js
// This module handles the interactive UI for editing notes within a measure.
// REFACTORED to use the new BEM HTML structure.

// ===================================================================
// Imports
// ===================================================================
import { pianoState } from "../core/appState.js";
import { ALL_NOTE_INFO, DURATIONS, NOTES_BY_NAME } from '../core/note-data.js';
import {
    clearSelectedNoteHighlight,
    highlightSelectedMeasure,
    highlightSelectedNote,
} from '../score/scoreHighlighter.js';
import {
    enableScoreInteraction,
    scrollToMeasure
} from '../score/scoreRenderer.js';
import { addNoteToMeasure, getMeasures, moveNoteBetweenMeasures, removeNoteFromMeasure, setTempo, setTimeSignature, updateNoteInMeasure, createTie } from '../score/scoreWriter.js';

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
    return noteArray.length > 1 ? `(${noteArray.join(' ')})` : noteArray[0];
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

function renderNoteEditBox(smoothScroll = true) {
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

    const createAddButton = (clef, insertBeforeNoteId = null) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn--compact btn--info add-note-initial';
        btn.dataset.insertBeforeNoteId = insertBeforeNoteId; // null means append to end
        btn.dataset.clef = clef;
        btn.textContent = '+';
        return btn;
    };

    const createNoteButton = (note) => {
        const btn = document.createElement('button');
        btn.className = `btn btn--compact editor-note-select note-duration-${note.duration.replace('.', 'dot')}`;
        btn.dataset.noteId = note.id;
        btn.dataset.clef = note.clef;

        // Determine button text with priority: chordName > existing logic
        let buttonText;
        if (note.isRest) {
            buttonText = "Rest";
        } else if (note.chordName) {
            // Use the chord name if available
            buttonText = note.chordName;
        } else if (isChord(note.name)) {
            // Fallback to existing chord logic
            buttonText = `Chord (${parseChord(note.name).length})`;
        } else {
            // Single note
            buttonText = note.name;
        }

        btn.textContent = buttonText;

        if (note.id === editorSelectedNoteId) {
            btn.classList.add('active-note-select');
        }
        return btn;
    };

    // Separate notes by clef for easier processing
    const trebleNotes = currentMeasure.filter(note => note.clef === 'treble');
    const bassNotes = currentMeasure.filter(note => note.clef === 'bass');

    // Render treble clef notes
    // Add initial + button for treble (before first note)
    const initialTrebleWrapper = document.createElement('div');
    initialTrebleWrapper.className = 'button-group';
    initialTrebleWrapper.appendChild(createAddButton('treble', trebleNotes[0]?.id || null));
    trebleNotesContainer.appendChild(initialTrebleWrapper);

    trebleNotes.forEach((note, index) => {
        const noteWrapper = document.createElement('div');
        noteWrapper.className = 'button-group';
        noteWrapper.appendChild(createNoteButton(note));
        // Add button after this note (before next note, or at end)
        const nextNoteId = trebleNotes[index + 1]?.id || null;
        noteWrapper.appendChild(createAddButton('treble', nextNoteId));
        trebleNotesContainer.appendChild(noteWrapper);
    });

    // Render bass clef notes
    // Add initial + button for bass (before first note)
    const initialBassWrapper = document.createElement('div');
    initialBassWrapper.className = 'button-group';
    initialBassWrapper.appendChild(createAddButton('bass', bassNotes[0]?.id || null));
    bassNotesContainer.appendChild(initialBassWrapper);

    bassNotes.forEach((note, index) => {
        const noteWrapper = document.createElement('div');
        noteWrapper.className = 'button-group';
        noteWrapper.appendChild(createNoteButton(note));
        // Add button after this note (before next note, or at end)
        const nextNoteId = bassNotes[index + 1]?.id || null;
        noteWrapper.appendChild(createAddButton('bass', nextNoteId));
        bassNotesContainer.appendChild(noteWrapper);
    });

// End

    const editorExpandedEditor = document.getElementById('editorExpandedEditor');
    const singleNoteControls = document.getElementById('singleNoteControls');
    const chordNotesEditor = document.getElementById('chordNotesEditor');
    const chordNotesContainer = document.getElementById('chordNotesContainer');
    const selectedNote = editorSelectedNoteId !== null ? currentMeasure.find(note => note.id === editorSelectedNoteId) : null;

    if (selectedNote) {
        editorExpandedEditor.classList.remove('hidden');
        const isSelectedNoteRest = selectedNote.isRest;
        const isSelectedNoteChord = isChord(selectedNote.name);

        document.getElementById('editorSelectedNoteDisplay').textContent = isSelectedNoteRest ? "Rest" : (isSelectedNoteChord ? `Chord (${parseChord(selectedNote.name).length})` : selectedNote.name);
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
    scrollToMeasure(editorSelectedMeasureIndex, smoothScroll); // Don't animate scroll
    console.log('scrolling to', editorSelectedMeasureIndex)
}

// ===================================================================
// Handlers & Event Listeners
// ===================================================================

function handleEditorNoteSelectClick(measureIndex, clef, noteId) {
    editorSelectedMeasureIndex = measureIndex;
    if (noteId === null) {
        editorSelectedNoteId = null;
        renderNoteEditBox();
        return;
    }
    const currentMeasureNotes = getMeasures()[measureIndex] || [];
    const foundNote = currentMeasureNotes.find(note => note.id === noteId);
    if (!foundNote || foundNote.clef !== clef) {
        editorSelectedNoteId = null;
        renderNoteEditBox();
        return;
    }
    editorSelectedNoteId = (editorSelectedNoteId === noteId) ? null : noteId;
    renderNoteEditBox();
}

function changeMeasure(newMeasureIndex, clearSelectedNote = true) {
    console.log('changeMeasure called', newMeasureIndex, clearSelectedNote);
    const measures = getMeasures();

    // Bounds checking
    if (newMeasureIndex < 0 || newMeasureIndex > measures.length) {
        return;
    }

    // Update measure index
    editorSelectedMeasureIndex = newMeasureIndex;

    // Re-render UI
    renderNoteEditBox();
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
    renderNoteEditBox(false);
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
    renderNoteEditBox(false);
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
    renderNoteEditBox(false);
}

/**
 * Finds the next note of the same pitch and clef to tie to
 * @param {number} measureIndex - Current measure index
 * @param {string} noteId - Current note ID
 * @returns {object|null} {measureIndex, noteId} of target note or null if not found
 */
function findNextNotesToTie(measureIndex, noteId) {
    const measures = getMeasures();
    const currentMeasure = measures[measureIndex];
    if (!currentMeasure) return null;

    const currentNote = currentMeasure.find(note => note.id === noteId);
    if (!currentNote || currentNote.isRest) return null;

    // First, check for the next note in the same measure and clef
    const notesInSameClef = currentMeasure.filter(note => note.clef === currentNote.clef);
    const currentIndex = notesInSameClef.findIndex(note => note.id === noteId);
    
    if (currentIndex !== -1 && currentIndex < notesInSameClef.length - 1) {
        const nextNote = notesInSameClef[currentIndex + 1];
        if (nextNote.name === currentNote.name && !nextNote.isRest) {
            return { measureIndex, noteId: nextNote.id };
        }
    }

    // If not found in same measure, check subsequent measures
    for (let i = measureIndex + 1; i < measures.length; i++) {
        const measure = measures[i];
        if (!measure) continue;

        const firstNoteInClef = measure.find(note => 
            note.clef === currentNote.clef && 
            note.name === currentNote.name && 
            !note.isRest
        );

        if (firstNoteInClef) {
            return { measureIndex: i, noteId: firstNoteInClef.id };
        }
    }

    return null;
}

/**
 * Handles creating a tie from the currently selected note
 */
function handleAddTie() {
    if (!editorSelectedNoteId) {
        console.warn('No note selected for tying');
        return;
    }

    const measures = getMeasures();
    const currentMeasure = measures[editorSelectedMeasureIndex];
    if (!currentMeasure) return;

    const selectedNote = currentMeasure.find(note => note.id === editorSelectedNoteId);
    if (!selectedNote) {
        console.warn('Selected note not found');
        return;
    }

    if (selectedNote.isRest) {
        console.warn('Cannot tie rests');
        // You could show a user message here
        return;
    }

    // Check if this note already has a tie
    if (selectedNote.tie) {
        console.log('Note already has a tie');
        // You could show a user message or remove the existing tie
        return;
    }

    const targetNote = findNextNotesToTie(editorSelectedMeasureIndex, editorSelectedNoteId);
    
    if (targetNote) {
        const success = createTie(editorSelectedNoteId, targetNote.noteId, 'tie');
        if (success) {
            console.log(`Tie created from ${editorSelectedNoteId} to ${targetNote.noteId}`);
            renderNoteEditBox(false);
        } else {
            console.warn('Failed to create tie');
        }
    } else {
        console.log('No suitable note found to tie to');
        // You could show a user message here
    }
}

// ===================================================================
// Initialization Function (Exported)
// ===================================================================

export function initializeMusicEditor() {
    renderNoteEditBox(false); // Initial render without smooth scroll
    enableScoreInteraction(
        (measureIndex, wasNoteClicked) => changeMeasure(measureIndex, !wasNoteClicked),
        handleEditorNoteSelectClick
    );

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
            const insertBeforeNoteId = target.dataset.insertBeforeNoteId === 'null' ? null : target.dataset.insertBeforeNoteId;
            const newClef = target.dataset.clef;
            const newNote = { name: "C4", clef: newClef, duration: "q", isRest: false };
            const addedNoteResult = addNoteToMeasure(editorSelectedMeasureIndex, newNote, insertBeforeNoteId);

            if (addedNoteResult) {
                // Automatically select the newly added note
                handleEditorNoteSelectClick(addedNoteResult.measureIndex, addedNoteResult.clef, addedNoteResult.noteId);
            }
        }
        
        if (target.classList.contains('editor-note-select')) {
            const noteId = target.dataset.noteId;
            const clef = target.dataset.clef;
            handleEditorNoteSelectClick(editorSelectedMeasureIndex, clef, noteId);
        }

        if (target.id === 'editorRemoveNote') {
            removeNoteFromMeasure(editorSelectedMeasureIndex, editorSelectedNoteId);
            editorSelectedNoteId = null;
            renderNoteEditBox(false);
        }
        if (target.id === 'editorToggleClef') {
            const measures = getMeasures();
            const note = measures[editorSelectedMeasureIndex]?.find(n => n.id === editorSelectedNoteId);
            if (note) updateNoteInMeasure(editorSelectedMeasureIndex, note.id, { clef: note.clef === 'treble' ? 'bass' : 'treble' });
            renderNoteEditBox(false);
        }
        if (target.id === 'editorToggleRest') {
            const measures = getMeasures();
            const note = measures[editorSelectedMeasureIndex]?.find(n => n.id === editorSelectedNoteId);
            if (note) {
                const newIsRest = !note.isRest;
                let newName = newIsRest ? "R" : (note.isRest ? "C4" : note.name);
                updateNoteInMeasure(editorSelectedMeasureIndex, note.id, { isRest: newIsRest, name: newName });
            }
            renderNoteEditBox(false);
        }
        if (target.id === 'editorMoveToPrevMeasure') {
            if (editorSelectedNoteId !== null && editorSelectedMeasureIndex > 0) {
                moveNoteBetweenMeasures(editorSelectedMeasureIndex, editorSelectedNoteId, editorSelectedMeasureIndex - 1);
                editorSelectedNoteId = null;
                renderNoteEditBox(false);
            }
        }
        if (target.id === 'editorMoveToNextMeasure') {
            if (editorSelectedNoteId !== null) {
                moveNoteBetweenMeasures(editorSelectedMeasureIndex, editorSelectedNoteId, editorSelectedMeasureIndex + 1);
                editorSelectedNoteId = null;
                renderNoteEditBox(false);
            }
        }

        if (target.id === 'editorAddTie') {
            handleAddTie();
        }

        if (target.id === 'addNoteToChordBtn') addNoteToChordUI();
        if (target.classList.contains('remove-chord-note-btn')) {
            const noteIndex = parseInt(target.dataset.noteIndex, 10);
            removeNoteFromChordUI(noteIndex);
        }
    });
    

    editorContainer.addEventListener('change', (event) => {
    const target = event.target;
    
    // Handle tempo changes
    if (target.id === 'tempo-input') {
        const newTempo = parseInt(target.value, 10);
        if (!isNaN(newTempo) && newTempo >= 60 && newTempo <= 300) {
            setTempo(newTempo);
        }
        return;
    }
    
    // Handle time signature changes
    if (target.id === 'time-signature-numerator' || target.id === 'time-signature-denominator') {
        const numerator = parseInt(document.getElementById('time-signature-numerator').value, 10);
        const denominator = parseInt(document.getElementById('time-signature-denominator').value, 10);
        
        if (!isNaN(numerator) && !isNaN(denominator) && numerator >= 1 && denominator >= 2) {
            setTimeSignature(numerator, denominator);
            console.log("Setting time signature", numerator, denominator)
        }
        return;
    }
    
    // Handle measure navigation
    if (target.id === 'editorNumberInput') {
        const newMeasureNum = parseInt(target.value, 10);
        if (!isNaN(newMeasureNum) && newMeasureNum >= 1) {
            changeMeasure(newMeasureNum - 1);
        }
        return;
    }
    
    // Handle chord note changes
    if (target.matches('.chord-note-letter, .chord-note-accidental, .chord-note-octave')) {
        updateChordFromUI();
        return;
    }
    
    // Handle note editing - existing logic
    const measures = getMeasures();
    const currentMeasure = measures[editorSelectedMeasureIndex];
    if (!currentMeasure || editorSelectedNoteId === null) return;
    
    const selectedNote = currentMeasure.find(note => note.id === editorSelectedNoteId);
    if (!selectedNote) return;

    if (selectedNote.isRest) {
        if (target.id === 'editorDurationDropdown') {
            updateNoteInMeasure(editorSelectedMeasureIndex, selectedNote.id, { duration: target.value });
        }
        renderNoteEditBox(false);
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
    }
    
    renderNoteEditBox(false);
});

    document.addEventListener('noteDropped', (event) => {
        // Fix: Use insertBeforeNoteId instead of insertPosition
        const { fromMeasureIndex, fromNoteId, toMeasureIndex, insertBeforeNoteId, clefChanged, pitchChanged, newClef, newPitch } = event.detail;
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
                // Fix: Use insertBeforeNoteId instead of insertPosition
                addNoteToMeasure(toMeasureIndex, noteToMove, insertBeforeNoteId);
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
        renderNoteEditBox(false);
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
    console.log("✓ scoreEditor.js initialized successfully");
}
