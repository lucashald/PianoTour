// scoreEditor.js
// This module handles the interactive UI for editing notes within a measure.
// REFACTORED to use the new BEM HTML structure and now includes slur support.

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
import { addNoteToMeasure, getMeasures, removeNoteFromMeasure, setTempo, setTimeSignature, placeNote, createTie, removeTie, createSlur, removeSlur, updateNoteInMeasure, insertMeasure, deleteMeasure, duplicateMeasure, moveMeasureToEnd, splitNote, transposeScore } from '../score/scoreWriter.js';

// ===================================================================
// Internal State
// ===================================================================

let editorSelectedNoteId = null; // ID of the currently selected note
let editorSelectedMeasureIndex = 0;
let editorSelectedClef = 'treble';
let slurMode = false; // Track if we're in slur creation mode
let slurStartNoteId = null; // Track the first note for slur creation

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

/**
 * Finds the next note in the same clef for tie/slur operations
 * @param {number} measureIndex - Current measure index
 * @param {string} noteId - Current note ID
 * @param {boolean} samePitchOnly - If true, only find notes with same pitch (for ties)
 * @returns {object|null} {measureIndex, noteId} of target note or null if not found
 */
function findNextNoteInClef(measureIndex, noteId, samePitchOnly = false) {
    const measures = getMeasures();
    const currentMeasure = measures[measureIndex];
    if (!currentMeasure) return null;

    const currentNote = currentMeasure.find(note => note.id === noteId);
    if (!currentNote || currentNote.isRest) return null;

    // Find the position of the current note
    const currentNoteIndex = currentMeasure.findIndex(note => note.id === noteId);
    if (currentNoteIndex === -1) return null;

    // Look for the next note in the same clef in the current measure
    for (let i = currentNoteIndex + 1; i < currentMeasure.length; i++) {
        const note = currentMeasure[i];
        if (note.clef === currentNote.clef && !note.isRest) {
            if (!samePitchOnly || note.name === currentNote.name) {
                return { measureIndex, noteId: note.id };
            }
        }
    }

    // If not found in current measure, look in the next measure
    if (measureIndex + 1 < measures.length) {
        const nextMeasure = measures[measureIndex + 1];
        for (const note of nextMeasure) {
            if (note.clef === currentNote.clef && !note.isRest) {
                if (!samePitchOnly || note.name === currentNote.name) {
                    return { measureIndex: measureIndex + 1, noteId: note.id };
                }
            }
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
        return;
    }

    // Check if this note already has a tie
    if (selectedNote.tie && selectedNote.tie.type === 'tie') {
        console.log('Note already has a tie');
        return;
    }

    const targetNote = findNextNoteInClef(editorSelectedMeasureIndex, editorSelectedNoteId, true);
    
    if (targetNote) {
        const success = createTie(editorSelectedNoteId, targetNote.noteId, 'tie');
        if (success) {
            console.log(`Tie created from ${editorSelectedNoteId} to ${targetNote.noteId}`);
            renderNoteEditBox(false);
        } else {
            console.warn('Failed to create tie');
        }
    } else {
        console.log('No suitable note found to tie to (must be same pitch in same clef)');
    }
}

/**
 * Handles slur creation - manual mode where user selects start and end notes
 */
function handleAddSlur() {
    if (!editorSelectedNoteId) {
        console.warn('No note selected for slurring');
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
        console.warn('Cannot slur rests');
        return;
    }

    if (!slurMode) {
        // Start slur mode - user will select the second note
        slurMode = true;
        slurStartNoteId = editorSelectedNoteId;
        console.log('Slur mode activated. Select the end note for the slur.');
        updateSlurModeUI(true);
    } else {
        // Complete the slur
        if (slurStartNoteId && slurStartNoteId !== editorSelectedNoteId) {
            const success = createSlur(slurStartNoteId, editorSelectedNoteId, 'slur');
            if (success) {
                console.log(`Slur created from ${slurStartNoteId} to ${editorSelectedNoteId}`);
                renderNoteEditBox(false);
            } else {
                console.warn('Failed to create slur');
            }
        } else {
            console.warn('Invalid slur selection');
        }
        
        // Exit slur mode
        slurMode = false;
        slurStartNoteId = null;
        updateSlurModeUI(false);
    }
}

/**
 * Handles automatic slur creation (finds next note automatically)
 */
function handleAddAutoSlur() {
    if (!editorSelectedNoteId) {
        console.warn('No note selected for slurring');
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
        console.warn('Cannot slur rests');
        return;
    }

    // Check if this note already has a slur
    if (selectedNote.tie && selectedNote.tie.type === 'slur') {
        console.log('Note already has a slur');
        return;
    }

    const targetNote = findNextNoteInClef(editorSelectedMeasureIndex, editorSelectedNoteId, false);
    
    if (targetNote) {
        const success = createSlur(editorSelectedNoteId, targetNote.noteId, 'slur');
        if (success) {
            console.log(`Auto slur created from ${editorSelectedNoteId} to ${targetNote.noteId}`);
            renderNoteEditBox(false);
        } else {
            console.warn('Failed to create auto slur');
        }
    } else {
        console.log('No suitable note found to slur to');
    }
}

/**
 * Handles duplicating the currently selected note/chord
 */
function handleDuplicateNote() {
    if (!editorSelectedNoteId) {
        console.warn('No note selected for duplication');
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

    // Find the note that comes after the selected note in the same clef
    const currentNoteIndex = currentMeasure.findIndex(note => note.id === editorSelectedNoteId);
    let insertBeforeNoteId = null;

    // Look for the next note in the same clef
    for (let i = currentNoteIndex + 1; i < currentMeasure.length; i++) {
        if (currentMeasure[i].clef === selectedNote.clef) {
            insertBeforeNoteId = currentMeasure[i].id;
            break;
        }
    }

    // Create a copy of the note with all its properties
    const duplicatedNote = {
        name: selectedNote.name,
        clef: selectedNote.clef,
        duration: selectedNote.duration,
        isRest: selectedNote.isRest,
        performedDuration: selectedNote.performedDuration,
        velocity: selectedNote.velocity
    };

    // Preserve chordName if it exists
    if (selectedNote.chordName) {
        duplicatedNote.chordName = selectedNote.chordName;
    }

    // Add the duplicated note
    const result = addNoteToMeasure(editorSelectedMeasureIndex, duplicatedNote, insertBeforeNoteId);

    if (result) {
        console.log(`Note duplicated: ${result.noteId}`);
        // Automatically select the newly duplicated note
        handleEditorNoteSelectClick(result.measureIndex, result.clef, result.noteId);
    } else {
        console.warn('Failed to duplicate note');
    }
}

/**
 * Handles removing ties or slurs from the selected note
 */
function handleRemoveTie() {
    if (!editorSelectedNoteId) {
        console.warn('No note selected for tie/slur removal');
        return;
    }

    const measures = getMeasures();
    const currentMeasure = measures[editorSelectedMeasureIndex];
    if (!currentMeasure) return;

    const selectedNote = currentMeasure.find(note => note.id === editorSelectedNoteId);
    if (!selectedNote || !selectedNote.tie) {
        console.log('No ties or slurs found to remove');
        return;
    }

    let removed = 0;
    if (selectedNote.tie.type === 'slur') {
        removed = removeSlur(editorSelectedNoteId);
        if (removed > 0) {
            console.log(`Removed slur affecting ${removed} notes`);
        }
    } else {
        removed = removeTie(editorSelectedNoteId);
        if (removed > 0) {
            console.log(`Removed ${removed} tie references`);
        }
    }

    if (removed > 0) {
        renderNoteEditBox(false);
    }
}

/**
 * Updates UI to show slur mode status
 */
function updateSlurModeUI(isActive) {
    const slurBtn = document.getElementById('editorAddSlur');
    const cancelSlurBtn = document.getElementById('editorCancelSlur');
    
    if (slurBtn) {
        slurBtn.classList.toggle('btn--warning', isActive);
        slurBtn.textContent = isActive ? 'Select End Note' : 'Add Slur';
    }
    
    if (cancelSlurBtn) {
        cancelSlurBtn.style.display = isActive ? 'inline-block' : 'none';
    }
    
    // Update the expanded editor display
    const editorExpandedEditor = document.getElementById('editorExpandedEditor');
    if (editorExpandedEditor) {
        editorExpandedEditor.classList.toggle('slur-mode', isActive);
    }
}

/**
 * Cancels slur creation mode
 */
function cancelSlurMode() {
    slurMode = false;
    slurStartNoteId = null;
    updateSlurModeUI(false);
    console.log('Slur mode cancelled');
}

// ===================================================================
// Measure Action Handlers
// ===================================================================

/**
 * Moves the current measure to the end of the score
 */
function handleMoveMeasureToEnd() {
    const measures = getMeasures();
    if (measures.length <= 1) {
        console.log('Cannot move: only one measure exists');
        return;
    }
    
    const newIndex = moveMeasureToEnd(editorSelectedMeasureIndex);
    if (newIndex !== false) {
        changeMeasure(newIndex);
    }
}

/**
 * Adds a new empty measure after the current one
 */
function handleAddMeasureAfter() {
    const newIndex = insertMeasure(editorSelectedMeasureIndex);
    changeMeasure(newIndex);
}

/**
 * Duplicates the current measure
 */
function handleDuplicateMeasure() {
    const newIndex = duplicateMeasure(editorSelectedMeasureIndex);
    if (newIndex !== false) {
        changeMeasure(newIndex);
    }
}

/**
 * Deletes the current measure
 */
function handleDeleteMeasure() {
    const measures = getMeasures();
    if (measures.length <= 1) {
        console.log('Cannot delete: must have at least one measure');
        return;
    }
    
    const wasLastMeasure = editorSelectedMeasureIndex >= measures.length - 1;
    const success = deleteMeasure(editorSelectedMeasureIndex);
    
    if (success) {
        // Navigate to previous measure if we deleted the last one
        if (wasLastMeasure) {
            changeMeasure(editorSelectedMeasureIndex - 1);
        } else {
            // Stay on the same index (which now contains the next measure)
            renderNoteEditBox(false);
        }
    }
}

/**
 * Transposes the currently selected note by a number of semitones
 * @param {number} semitones - Number of semitones to transpose (positive = up, negative = down)
 */
function transposeSelectedNote(semitones) {
    if (!editorSelectedNoteId) {
        console.warn('No note selected for transposition');
        return;
    }

    const measures = getMeasures();
    const currentMeasure = measures[editorSelectedMeasureIndex];
    if (!currentMeasure) return;

    const selectedNote = currentMeasure.find(note => note.id === editorSelectedNoteId);
    if (!selectedNote || selectedNote.isRest) {
        console.warn('Cannot transpose: note not found or is a rest');
        return;
    }

    // Transpose the note name(s)
    const transposedName = transposeChord(selectedNote.name, semitones);
    
    if (transposedName === selectedNote.name) {
        console.warn('Transpose failed or note is at range limit');
        return;
    }

    // Update the note
    updateNoteInMeasure(editorSelectedMeasureIndex, editorSelectedNoteId, { name: transposedName });
    renderNoteEditBox(false);
}

// ===================================================================
// CONTEXT MENU
// ===================================================================

/**
 * Builds the context menu DOM based on what was right-clicked.
 * @param {object} detail - The scoreContextMenu event detail.
 * @returns {HTMLElement} The context menu element.
 */
function buildContextMenu(detail) {
    const menu = document.createElement('div');
    menu.className = 'editor-context-menu';
    menu.id = 'editorContextMenu';

    if (detail.noteTarget && detail.noteTarget.noteId !== null) {
        console.log('context-menu: Building note context menu');
        buildNoteContextMenu(menu, detail);
    } else if (detail.measureIndex !== -1) {
        console.log('context-menu: Building measure context menu');
        buildMeasureContextMenu(menu, detail);
    }

    return menu;
}

/**
 * Populates the context menu with note-specific items.
 */
function buildNoteContextMenu(menu, detail) {
    const { measureIndex, clef, noteId } = detail.noteTarget;
    const measures = getMeasures();
    const note = measures[measureIndex]?.find(n => n.id === noteId);
    if (!note) return;

    // Header
    const header = document.createElement('div');
    header.className = 'editor-context-menu__header';
    header.textContent = `Note: ${note.name} (${note.duration})`;
    menu.appendChild(header);

    addSeparator(menu);

    // Basic actions
    addMenuItem(menu, 'Remove Note', () => {
        removeNoteFromMeasure(editorSelectedMeasureIndex, editorSelectedNoteId);
        editorSelectedNoteId = null;
        renderNoteEditBox(false);
    });
    addMenuItem(menu, 'Duplicate Note', () => handleDuplicateNote());
    addMenuItem(menu, 'Split Note', () => {
        if (editorSelectedNoteId) {
            const result = splitNote(editorSelectedMeasureIndex, editorSelectedNoteId);
            if (result) editorSelectedNoteId = result.firstNoteId;
            renderNoteEditBox(false);
        }
    });
    addMenuItem(menu, note.isRest ? 'Make Note' : 'Make Rest', () => {
        const newIsRest = !note.isRest;
        placeNote(editorSelectedMeasureIndex, note.id, editorSelectedMeasureIndex, { isRest: newIsRest });
        renderNoteEditBox(false);
    });
    addMenuItem(menu, 'Toggle Clef', () => {
        placeNote(editorSelectedMeasureIndex, note.id, editorSelectedMeasureIndex, { clef: note.clef === 'treble' ? 'bass' : 'treble' });
        renderNoteEditBox(false);
    });

    addSeparator(menu);

    // Transpose submenu
    addSubmenu(menu, 'Transpose', [
        { label: 'Semitone Up', action: () => transposeSelectedNote(1) },
        { label: 'Semitone Down', action: () => transposeSelectedNote(-1) },
        { label: 'Octave Up', action: () => transposeSelectedNote(12) },
        { label: 'Octave Down', action: () => transposeSelectedNote(-12) },
    ]);

    // Ties & Slurs submenu
    addSubmenu(menu, 'Ties & Slurs', [
        { label: 'Add Tie', action: () => handleAddTie() },
        { label: 'Add Slur', action: () => handleAddSlur() },
        { label: 'Remove Tie/Slur', action: () => handleRemoveTie() },
    ]);

    addSeparator(menu);

    // Insert actions
    addMenuItem(menu, 'Insert Note Before', () => {
        const newNote = { name: "C4", clef: note.clef, duration: pianoState.quantize, isRest: false };
        const result = addNoteToMeasure(editorSelectedMeasureIndex, newNote, noteId);
        if (result) handleEditorNoteSelectClick(result.measureIndex, result.clef, result.noteId);
    });
    addMenuItem(menu, 'Insert Note After', () => {
        // Find the note after the current one to use as insertBefore target
        const currentMeasure = measures[measureIndex] || [];
        const noteIndex = currentMeasure.findIndex(n => n.id === noteId);
        const insertBeforeId = noteIndex < currentMeasure.length - 1 ? currentMeasure[noteIndex + 1].id : null;
        const newNote = { name: "C4", clef: note.clef, duration: pianoState.quantize, isRest: false };
        const result = addNoteToMeasure(editorSelectedMeasureIndex, newNote, insertBeforeId);
        if (result) handleEditorNoteSelectClick(result.measureIndex, result.clef, result.noteId);
    });
}

/**
 * Populates the context menu with measure-specific items.
 */
function buildMeasureContextMenu(menu, detail) {
    const header = document.createElement('div');
    header.className = 'editor-context-menu__header';
    header.textContent = `Measure ${detail.measureIndex + 1}`;
    menu.appendChild(header);

    addSeparator(menu);

    addMenuItem(menu, 'Add Measure After', () => handleAddMeasureAfter());
    addMenuItem(menu, 'Duplicate Measure', () => handleDuplicateMeasure());
    addMenuItem(menu, 'Move to End', () => handleMoveMeasureToEnd());
    addMenuItem(menu, 'Delete Measure', () => handleDeleteMeasure());

    addSeparator(menu);

    // Transpose Score submenu
    addSubmenu(menu, 'Transpose Score', [
        { label: 'Semitone Up', action: () => { transposeScore(1); renderNoteEditBox(false); } },
        { label: 'Semitone Down', action: () => { transposeScore(-1); renderNoteEditBox(false); } },
        { label: 'Octave Up', action: () => { transposeScore(12); renderNoteEditBox(false); } },
        { label: 'Octave Down', action: () => { transposeScore(-12); renderNoteEditBox(false); } },
    ]);
}

/**
 * Adds a clickable menu item to the context menu.
 */
function addMenuItem(menu, label, action) {
    const item = document.createElement('div');
    item.className = 'editor-context-menu__item';
    item.textContent = label;
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        hideContextMenu();
        action();
    });
    menu.appendChild(item);
}

/**
 * Adds a separator line to the context menu.
 */
function addSeparator(menu) {
    const sep = document.createElement('div');
    sep.className = 'editor-context-menu__separator';
    menu.appendChild(sep);
}

/**
 * Adds a submenu (hover-to-expand) to the context menu.
 * @param {HTMLElement} menu - Parent menu element.
 * @param {string} label - Submenu trigger label.
 * @param {Array<{label: string, action: Function}>} items - Submenu items.
 */
function addSubmenu(menu, label, items) {
    const wrapper = document.createElement('div');
    wrapper.className = 'editor-context-menu__submenu-wrapper';

    const trigger = document.createElement('div');
    trigger.className = 'editor-context-menu__item editor-context-menu__item--has-submenu';
    trigger.textContent = label;
    wrapper.appendChild(trigger);

    const submenu = document.createElement('div');
    submenu.className = 'editor-context-menu__submenu';

    items.forEach(({ label: itemLabel, action }) => {
        const item = document.createElement('div');
        item.className = 'editor-context-menu__item';
        item.textContent = itemLabel;
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            hideContextMenu();
            action();
        });
        submenu.appendChild(item);
    });

    wrapper.appendChild(submenu);
    menu.appendChild(wrapper);
}

/**
 * Shows the context menu at the given screen coordinates, adjusting for viewport overflow.
 */
function showContextMenu(clientX, clientY, menu) {
    hideContextMenu();
    document.body.appendChild(menu);

    // Position initially to measure dimensions
    menu.style.left = `${clientX}px`;
    menu.style.top = `${clientY}px`;

    // Adjust for viewport overflow
    const rect = menu.getBoundingClientRect();
    let x = clientX;
    let y = clientY;
    if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8;
    if (x < 0) x = 8;
    if (y < 0) y = 8;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Check submenus for right-edge overflow and flip if needed
    const submenus = menu.querySelectorAll('.editor-context-menu__submenu');
    submenus.forEach(sub => {
        // Temporarily show to measure
        sub.style.display = 'block';
        const subRect = sub.getBoundingClientRect();
        sub.style.display = '';
        if (subRect.right > window.innerWidth) {
            sub.classList.add('editor-context-menu__submenu--flip-left');
        }
    });

    console.log('context-menu: Menu shown at', x, y);
}

/**
 * Removes any existing context menu from the DOM.
 */
function hideContextMenu() {
    const existing = document.getElementById('editorContextMenu');
    if (existing) {
        existing.remove();
        console.log('context-menu: Menu hidden');
    }
}

function renderNoteEditBox(smoothScroll = true) {
    const measures = getMeasures();
    if (editorSelectedMeasureIndex >= measures.length) {
        editorSelectedMeasureIndex = Math.max(0, measures.length - 1);
    }
    const currentMeasure = measures[editorSelectedMeasureIndex] || [];
    const selectedNote = editorSelectedNoteId !== null ? currentMeasure.find(note => note.id === editorSelectedNoteId) : null;

    // Only update sidebar DOM if the editor sidebar exists
    const hasSidebar = !!document.getElementById('editorContainer');
    if (hasSidebar) {
        renderSidebarNoteList(currentMeasure, selectedNote);
        renderSidebarNoteEditor(currentMeasure, selectedNote);
        updateSlurModeUI(slurMode);
    }

    // Highlighting and scroll — works on any route
    highlightSelectedMeasure(editorSelectedMeasureIndex);
    if (selectedNote) {
        highlightSelectedNote(editorSelectedMeasureIndex, selectedNote.clef, selectedNote.id);
        pianoState.currentSelectedNote = {
            measureIndex: editorSelectedMeasureIndex,
            clef: selectedNote.clef,
            noteId: selectedNote.id
        };
    } else {
        clearSelectedNoteHighlight();
        pianoState.currentSelectedNote = null;
        editorSelectedNoteId = null;
    }
    scrollToMeasure(editorSelectedMeasureIndex, smoothScroll);
}

/**
 * Updates the sidebar note list buttons (treble/bass containers, measure nav).
 * Only called when the sidebar DOM exists.
 */
function renderSidebarNoteList(currentMeasure, selectedNote) {
    const measures = getMeasures();

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

        // Add tie/slur indicators if note has them
        if (note.tie) {
            if (note.tie.type === 'slur') {
                buttonText += ' ⌒s'; // slur indicator
                btn.classList.add('note-with-slur');
            } else {
                buttonText += ' ⌒'; // tie indicator
                btn.classList.add('note-with-tie');
            }
        }

        // Highlight if this is the slur start note
        if (slurMode && note.id === slurStartNoteId) {
            btn.classList.add('slur-start-note');
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
}

/**
 * Updates the expanded note editor panel (pitch, duration, velocity controls).
 * Only called when the sidebar DOM exists.
 */
function renderSidebarNoteEditor(currentMeasure, selectedNote) {
    const editorExpandedEditor = document.getElementById('editorExpandedEditor');
    const singleNoteControls = document.getElementById('singleNoteControls');
    const chordNotesEditor = document.getElementById('chordNotesEditor');
    const chordNotesContainer = document.getElementById('chordNotesContainer');

    if (selectedNote) {
        editorExpandedEditor.classList.remove('hidden');
        const isSelectedNoteRest = selectedNote.isRest;
        const isSelectedNoteChord = isChord(selectedNote.name);

        document.getElementById('editorSelectedNoteDisplay').textContent = isSelectedNoteRest ? "Rest" : (isSelectedNoteChord ? `Chord (${parseChord(selectedNote.name).length})` : selectedNote.name);
        document.getElementById('editorToggleClef').textContent = selectedNote.clef === 'treble' ? 'Treble' : 'Bass';
        document.getElementById('editorDurationDropdown').value = selectedNote.duration;

        // Update performed duration slider (stored as 0-1, displayed as 0-100%)
        const performedDurationSlider = document.getElementById('editorPerformedDuration');
        const performedDurationValue = document.getElementById('editorPerformedDurationValue');
        if (performedDurationSlider && performedDurationValue) {
            const pdValue = Math.round((selectedNote.performedDuration ?? 0.8) * 100);
            performedDurationSlider.value = pdValue;
            performedDurationValue.textContent = `${pdValue}%`;
        }

        // Update velocity slider (stored as 0-127)
        const velocitySlider = document.getElementById('editorVelocity');
        const velocityValue = document.getElementById('editorVelocityValue');
        if (velocitySlider && velocityValue) {
            const velValue = selectedNote.velocity ?? 100;
            velocitySlider.value = velValue;
            velocityValue.textContent = velValue;
        }

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
    }
}

// ===================================================================
// Handlers & Event Listeners
// ===================================================================

function handleEditorNoteSelectClick(measureIndex, clef, noteId) {
    editorSelectedMeasureIndex = measureIndex;
    
    if (slurMode && noteId !== null) {
        // If in slur mode, complete the slur
        if (slurStartNoteId && slurStartNoteId !== noteId) {
            const success = createSlur(slurStartNoteId, noteId, 'slur');
            if (success) {
                console.log(`Slur created from ${slurStartNoteId} to ${noteId}`);
            } else {
                console.warn('Failed to create slur');
            }
        }
        // Exit slur mode
        slurMode = false;
        slurStartNoteId = null;
        updateSlurModeUI(false);
        // Select the end note
        editorSelectedNoteId = noteId;
        renderNoteEditBox();
        return;
    }
    
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

    // Update measure display in the UI
    const measureDisplay = document.getElementById('editorSelectedMeasureDisplay');
    if (measureDisplay) {
        measureDisplay.textContent = newMeasureIndex + 1; // Display 1-based index
    }

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
        placeNote(editorSelectedMeasureIndex, selectedNote.id, editorSelectedMeasureIndex, { isRest: true, name: "R" });
    } else if (chordNotes.length === 1 && isChord(selectedNote.name)) {
        placeNote(editorSelectedMeasureIndex, selectedNote.id, editorSelectedMeasureIndex, { name: chordNotes[0], isRest: false });
    } else {
        placeNote(editorSelectedMeasureIndex, selectedNote.id, editorSelectedMeasureIndex, { name: formatChord(chordNotes), isRest: false });
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
    placeNote(editorSelectedMeasureIndex, selectedNote.id, editorSelectedMeasureIndex, { name: formatChord(currentChordNotes), isRest: false });
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
        placeNote(editorSelectedMeasureIndex, selectedNote.id, editorSelectedMeasureIndex, { name: formatChord(currentChordNotes) });
    } else {
        placeNote(editorSelectedMeasureIndex, selectedNote.id, editorSelectedMeasureIndex, { isRest: true, name: "R" });
    }
    renderNoteEditBox(false);
}

// ===================================================================
// Clef Selection (for palette)
// ===================================================================

/**
 * Get the currently selected clef for palette operations
 * @returns {string} - 'treble' or 'bass'
 */
export function getSelectedClef() {
    return editorSelectedClef;
}

/**
 * Set the selected clef for palette operations
 * @param {string} clef - 'treble' or 'bass'
 */
export function setSelectedClef(clef) {
    if (clef === 'treble' || clef === 'bass') {
        editorSelectedClef = clef;
        console.log(`Selected clef set to: ${clef}`);
    } else {
        console.warn(`Invalid clef: ${clef}`);
    }
}

/**
 * Toggle between treble and bass clef
 * @returns {string} - The new clef value
 */
export function toggleSelectedClef() {
    editorSelectedClef = editorSelectedClef === 'treble' ? 'bass' : 'treble';
    console.log(`Toggled to: ${editorSelectedClef}`);
    return editorSelectedClef;
}

// ===================================================================
// Initialization Functions (Exported)
// ===================================================================

/**
 * Initializes score interaction: click/select callbacks, drag-and-drop handling,
 * Delete key listener, and noteAddedToScore listener.
 * This can be called by any route that has a rendered score.
 */
export function initializeScoreInteraction() {
    console.log('context-menu: initializeScoreInteraction() called');
    enableScoreInteraction(
        (measureIndex, wasNoteClicked) => changeMeasure(measureIndex, !wasNoteClicked),
        handleEditorNoteSelectClick
    );

    // Handle notes dropped onto the score (drag-and-drop from palette or within score)
    document.addEventListener('noteDropped', (event) => {
        const {
            fromMeasureIndex,
            fromNoteId,
            toMeasureIndex,
            insertBeforeNoteId,
            clefChanged,
            pitchChanged,
            newClef,
            newPitch,
            chordAnchor,
            droppedData
        } = event.detail;

        // Handle chord drops
        if (droppedData && droppedData.startsWith('application/chord:')) {
            try {
                const chordData = JSON.parse(droppedData.replace('application/chord:', ''));
                const chordObj = chordData.chord;
                const chordDisplayName = chordData.displayName;

                // Determine which notes to use based on the target clef
                const targetClef = newClef || 'treble'; // Default to treble if not specified
                const notesToUse = getChordNotesForClef(chordObj, targetClef);

                if (notesToUse.length === 0) {
                    console.warn('No suitable notes found for chord in target clef');
                    return;
                }

                // Create the chord note
                const chordNote = {
                    name: formatChordForScore(notesToUse, chordDisplayName),
                    clef: targetClef,
                    duration: pianoState.quantize,
                    isRest: false,
                    chordName: chordDisplayName // Store the original chord name
                };

                // Add the chord to the measure
                const result = addNoteToMeasure(toMeasureIndex, chordNote, insertBeforeNoteId);
                if (result) {
                    // Dispatch event to automatically select and scroll to the new note
                    const event = new CustomEvent('noteAddedToScore', {
                        detail: result
                    });
                    document.dispatchEvent(event);
                }

                console.log(`Added ${chordDisplayName} chord to ${targetClef} clef:`, notesToUse);
                return;

            } catch (error) {
                console.error('Failed to parse chord drop data:', error);
                // Fall through to regular note handling
            }
        }

        // Existing note drop handling code...
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
                        const chordNotes = parseChord(originalNote.name);
                        // Use top or bottom note as anchor based on where user grabbed
                        const anchorNote = chordAnchor === 'top' ? chordNotes[chordNotes.length - 1] : chordNotes[0];
                        const anchorNoteMidi = NOTES_BY_NAME[anchorNote];
                        const newPitchMidi = NOTES_BY_NAME[newPitch];
                        if (anchorNoteMidi !== undefined && newPitchMidi !== undefined) {
                            const semitoneChange = newPitchMidi - anchorNoteMidi;
                            noteToMove.name = transposeChord(originalNote.name, semitoneChange);
                        }
                    } else {
                        noteToMove.name = newPitch;
                    }
                }
                addNoteToMeasure(toMeasureIndex, noteToMove, insertBeforeNoteId);
                editorSelectedMeasureIndex = toMeasureIndex;
                editorSelectedNoteId = noteToMove.id;
            }
        } else if (insertBeforeNoteId || clefChanged || pitchChanged) {
            // Same measure: repositioning OR property changes
            const updatedNoteData = {};
            if (clefChanged) updatedNoteData.clef = newClef;
            if (pitchChanged && !originalNote.isRest) {
                if (isChord(originalNote.name)) {
                    const chordNotes = parseChord(originalNote.name);
                    // Use top or bottom note as anchor based on where user grabbed
                    const anchorNote = chordAnchor === 'top' ? chordNotes[chordNotes.length - 1] : chordNotes[0];
                    const anchorNoteMidi = NOTES_BY_NAME[anchorNote];
                    const newPitchMidi = NOTES_BY_NAME[newPitch];
                    if (anchorNoteMidi !== undefined && newPitchMidi !== undefined) {
                        const semitoneChange = newPitchMidi - anchorNoteMidi;
                        updatedNoteData.name = transposeChord(originalNote.name, semitoneChange);
                    }
                } else {
                    updatedNoteData.name = newPitch;
                }
            }

            if (insertBeforeNoteId && insertBeforeNoteId !== fromNoteId) {
                // Actually repositioning - use placeNote
                placeNote(fromMeasureIndex, fromNoteId, toMeasureIndex, updatedNoteData, insertBeforeNoteId);
            } else {
                // Just updating properties in same position - use updateNoteInMeasure
                updateNoteInMeasure(fromMeasureIndex, fromNoteId, updatedNoteData);
            }
            editorSelectedNoteId = fromNoteId;
        }
        renderNoteEditBox(false);
    });

    // Delete key listener to remove selected note
    document.addEventListener('keydown', (event) => {
        // Only handle Delete key with no modifiers
        if (event.key !== 'Delete' || event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) {
            return;
        }

        // Return early if no note is selected
        if (editorSelectedNoteId === null) {
            return;
        }

        // Don't interfere if user is typing in an input field
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT')) {
            return;
        }

        event.preventDefault();
        removeNoteFromMeasure(editorSelectedMeasureIndex, editorSelectedNoteId);
        editorSelectedNoteId = null;
        renderNoteEditBox(false);
    });

    // Listen for notes added from the palette and automatically select them
    document.addEventListener('noteAddedToScore', (event) => {
        const { noteId, measureIndex, clef } = event.detail;
        if (noteId && measureIndex !== undefined && clef) {
            // Automatically select the newly added note
            handleEditorNoteSelectClick(measureIndex, clef, noteId);
        }
    });

    // Listen for right-click context menu events from the score
    document.addEventListener('scoreContextMenu', (event) => {
        const { clientX, clientY, noteTarget, measureIndex } = event.detail;
        console.log('context-menu: scoreContextMenu received', { noteTarget, measureIndex });

        // If slur mode is active, show cancel option instead of normal menu
        if (slurMode) {
            const menu = document.createElement('div');
            menu.className = 'editor-context-menu';
            menu.id = 'editorContextMenu';
            addMenuItem(menu, 'Cancel Slur', () => {
                slurMode = false;
                slurStartNoteId = null;
                updateSlurModeUI(false);
                console.log('context-menu: Slur mode cancelled via context menu');
            });
            showContextMenu(clientX, clientY, menu);
            return;
        }

        // Select the right-clicked note or measure first (but don't toggle-off an already selected note)
        if (noteTarget && noteTarget.noteId !== null) {
            if (editorSelectedNoteId !== noteTarget.noteId) {
                handleEditorNoteSelectClick(noteTarget.measureIndex, noteTarget.clef, noteTarget.noteId);
            }
        } else if (measureIndex !== -1) {
            changeMeasure(measureIndex);
        }

        const menu = buildContextMenu(event.detail);
        if (menu.children.length > 0) {
            showContextMenu(clientX, clientY, menu);
        }
    });

    // Close context menu on click outside
    document.addEventListener('click', (event) => {
        const menu = document.getElementById('editorContextMenu');
        if (menu && !menu.contains(event.target)) {
            hideContextMenu();
        }
    });

    // Close context menu on Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') hideContextMenu();
    });

    console.log('context-menu: initializeScoreInteraction() complete');
}

/**
 * Initializes the editor sidebar: renders the note edit box, wires up
 * editorContainer event delegation (click, input, change), and populates
 * duration/octave dropdowns. Only relevant on routes with a sidebar.
 */
export function initializeEditorSidebar() {
    console.log('context-menu: initializeEditorSidebar() called');
    renderNoteEditBox(false); // Initial render without smooth scroll

    const editorContainer = document.getElementById('editorContainer');
    if (!editorContainer) {
        console.error("context-menu: Editor container with ID 'editorContainer' not found. Cannot initialize sidebar.");
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
            const newNote = { name: "C4", clef: newClef, duration: pianoState.quantize, isRest: false };
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
            if (note) placeNote(editorSelectedMeasureIndex, note.id, editorSelectedMeasureIndex, { clef: note.clef === 'treble' ? 'bass' : 'treble' });
            renderNoteEditBox(false);
        }
if (target.id === 'editorToggleRest') {
    const measures = getMeasures();
    const note = measures[editorSelectedMeasureIndex]?.find(n => n.id === editorSelectedNoteId);
    if (note) {
        const newIsRest = !note.isRest;
        placeNote(editorSelectedMeasureIndex, note.id, editorSelectedMeasureIndex, { isRest: newIsRest });
    }
    renderNoteEditBox(false);
}

        if (target.id === 'editorSplitNote') {
            if (editorSelectedNoteId) {
                const result = splitNote(editorSelectedMeasureIndex, editorSelectedNoteId);
                if (result) {
                    // Keep the first note selected after split
                    editorSelectedNoteId = result.firstNoteId;
                }
                renderNoteEditBox(false);
            }
        }

        // Transpose selected note handlers
        if (target.id === 'editorTransposeNoteSemitoneUp') {
            if (editorSelectedNoteId) {
                transposeSelectedNote(1);
            }
        }
        if (target.id === 'editorTransposeNoteSemitoneDown') {
            if (editorSelectedNoteId) {
                transposeSelectedNote(-1);
            }
        }
        if (target.id === 'editorTransposeNoteOctaveUp') {
            if (editorSelectedNoteId) {
                transposeSelectedNote(12);
            }
        }
        if (target.id === 'editorTransposeNoteOctaveDown') {
            if (editorSelectedNoteId) {
                transposeSelectedNote(-12);
            }
        }

        // Tie and Slur handlers
        if (target.id === 'editorAddTie') {
            handleAddTie();
        }
        if (target.id === 'editorAddSlur') {
            handleAddSlur();
        }
        if (target.id === 'editorAddAutoSlur') {
            handleAddAutoSlur();
        }
        if (target.id === 'editorRemoveTie') {
            handleRemoveTie();
        }
        if (target.id === 'editorCancelSlur') {
            cancelSlurMode();
        }
        if (target.id === 'editorDuplicateNote') {
            handleDuplicateNote();
        }
        if (target.id === 'addNoteToChordBtn') addNoteToChordUI();
        if (target.classList.contains('remove-chord-note-btn')) {
            const noteIndex = parseInt(target.dataset.noteIndex, 10);
            removeNoteFromChordUI(noteIndex);
        }

        // Measure action handlers
        if (target.id === 'editorMoveToEnd') {
            handleMoveMeasureToEnd();
        }
        if (target.id === 'editorAddMeasureAfter') {
            handleAddMeasureAfter();
        }
        if (target.id === 'editorDuplicateMeasure') {
            handleDuplicateMeasure();
        }
        if (target.id === 'editorDeleteMeasure') {
            handleDeleteMeasure();
        }

        // Transpose handlers
        if (target.id === 'editorTransposeSemitoneUp') {
            transposeScore(1);
            renderNoteEditBox(false);
        }
        if (target.id === 'editorTransposeSemitoneDown') {
            transposeScore(-1);
            renderNoteEditBox(false);
        }
        if (target.id === 'editorTransposeOctaveUp') {
            transposeScore(12);
            renderNoteEditBox(false);
        }
        if (target.id === 'editorTransposeOctaveDown') {
            transposeScore(-12);
            renderNoteEditBox(false);
        }
    });

    // Handle real-time slider value display updates (input fires while dragging)
    editorContainer.addEventListener('input', (event) => {
        const target = event.target;

        if (target.id === 'editorPerformedDuration') {
            const valueDisplay = document.getElementById('editorPerformedDurationValue');
            if (valueDisplay) valueDisplay.textContent = `${target.value}%`;
        }

        if (target.id === 'editorVelocity') {
            const valueDisplay = document.getElementById('editorVelocityValue');
            if (valueDisplay) valueDisplay.textContent = target.value;
        }
    });

    editorContainer.addEventListener('change', (event) => {
    const target = event.target;

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
    } else if (target.id === 'editorPerformedDuration') {
        const performedDuration = parseInt(target.value, 10) / 100; // Convert from 0-100 to 0-1
        updateNoteInMeasure(editorSelectedMeasureIndex, selectedNote.id, { performedDuration });
        const valueDisplay = document.getElementById('editorPerformedDurationValue');
        if (valueDisplay) valueDisplay.textContent = `${target.value}%`;
    } else if (target.id === 'editorVelocity') {
        const velocity = parseInt(target.value, 10);
        updateNoteInMeasure(editorSelectedMeasureIndex, selectedNote.id, { velocity });
        const valueDisplay = document.getElementById('editorVelocityValue');
        if (valueDisplay) valueDisplay.textContent = target.value;
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

    console.log('context-menu: initializeEditorSidebar() complete');
}

/**
 * Convenience wrapper that initializes both score interaction and the editor sidebar.
 * Called by routes that have the full editor UI (e.g. /editor).
 */
export function initializeMusicEditor() {
    console.log('context-menu: initializeMusicEditor() called — initializing both score interaction and sidebar');
    initializeScoreInteraction();
    initializeEditorSidebar();
}

// Add this to your note-data.js or scoreEditor.js
export function getChordNotesForClef(chordObj, targetClef) {
    if (!chordObj || !chordObj.treble || !chordObj.bass) {
        console.warn('Invalid chord object for clef selection');
        return [];
    }
    
    // If the target clef has notes, use them
    if (targetClef === 'treble' && chordObj.treble.length > 0) {
        return chordObj.treble;
    } else if (targetClef === 'bass' && chordObj.bass.length > 0) {
        return chordObj.bass;
    }
    
    // Fallback: if the target clef is empty, use the other clef
    if (targetClef === 'treble') {
        return chordObj.bass.length > 0 ? chordObj.bass : [];
    } else {
        return chordObj.treble.length > 0 ? chordObj.treble : [];
    }
}

function formatChordForScore(noteNames, chordDisplayName) {
    if (!noteNames || noteNames.length === 0) return null;
    
    // If it's a single note, return it directly
    if (noteNames.length === 1) {
        return noteNames[0];
    }
    
    // For multiple notes, format as a chord
    return `(${noteNames.join(' ')})`;
}