// instrumentHelpers.js
// This file contains all core piano instrument logic, UI manipulation, and event handlers.

// ===================================================================
// Imports
// ===================================================================

import { pianoState } from './appState.js';
import { startAudio, trigger, startKey, stopKey, playDiatonicChord, stopDiatonicChord } from './playbackHelpers.js';
import { NOTES_BY_MIDI, NOTES_BY_NAME, WHITE_KEY_WIDTH, BLACK_KEY_WIDTH, ALL_NOTE_INFO,
    majorDiatonicLabels, minorDiatonicLabels, CHORD_STRUCTURES, DURATION_THRESHOLDS,
    chordDefinitions, notesByMidiKeyAware
} from './note-data.js';
import { writeNote } from './scoreWriter.js';
import { updateNowPlayingDisplay } from './uiHelpers.js';

// ===================================================================
// Constants (derived from imported data)
// ===================================================================

const WHITE_KEYS_IN_VIEW = ['a', 's', 'd', 'f', ' ', 'j', 'k', 'l', ';'];
const NS = 'http://www.w3.org/2000/svg';
const allNotes = ALL_NOTE_INFO;
const whiteNoteMidis = ALL_NOTE_INFO.filter(n => !n.isBlack).map(n => n.midi);
const TOTAL_SVG_WIDTH = (whiteNoteMidis.length) * WHITE_KEY_WIDTH;
const MIN_MIDI = 21; // A0
const MAX_MIDI = 108; // C8
const flattenerKeys = new Set(['q','w','e','r','t','u','i','o','p','g']);

// ===================================================================
// Music Theory & Data Processing Helpers (Instrument-specific)
// ===================================================================

/**
 * Creates the mapping between keyboard characters and MIDI notes.
 * @param {number} baseIdx - The starting index in the whiteNoteMidis array.
 * @returns {object} The newly constructed keyMap object.
 */
function buildMap(baseIdx) {
    const keyMap = {};
    WHITE_KEYS_IN_VIEW.forEach((k, i) => {
        if (whiteNoteMidis[baseIdx + i]) {
            keyMap[k] = whiteNoteMidis[baseIdx + i];
        }
    });

    const keyModifiers = {
        'a': { flatKey: 'q' }, 's': { flatKey: 'w' }, 'd': { flatKey: 'e' },
        'f': { flatKey: 'r' }, ' ': { flatKey: 't' }, 'j': { flatKey: 'u' },
        'k': { flatKey: 'i' }, 'l': { flatKey: 'o' }, ';': { flatKey: 'p' }
    };

    for (const baseKeyChar in keyModifiers) {
        const modifier = keyModifiers[baseKeyChar];
        const baseMidi = keyMap[baseKeyChar];
        if (baseMidi === undefined) continue;

        const flatMidi = baseMidi - 1;
        if (NOTES_BY_MIDI[flatMidi]?.isBlack) {
            if (modifier.flatKey) keyMap[modifier.flatKey] = flatMidi;
        }
    }
    keyMap['h'] = keyMap[' '];
    keyMap['g'] = keyMap['t'];
    return keyMap;
}

/**
 * Calculates the notes of a triad based on a center note and quality.
 * @param {string} centerNoteName - The name of the center note (e.g., 'E4').
 * @param {string} quality - 'major' or 'minor'.
 * @returns {object|null} A chord object or null if invalid.
 */
export function getChord(centerNoteName, quality) {
    const structure = CHORD_STRUCTURES[quality];
    if (!structure) return null;
    const centerMidi = NOTES_BY_NAME[centerNoteName];
    if (centerMidi === undefined) return null;

    const chordMidiNotes = [centerMidi + structure.rootOffset, centerMidi, centerMidi + structure.fifthOffset];
    if (chordMidiNotes.some(midi => !NOTES_BY_MIDI[midi])) return null;

    const chordNoteNames = chordMidiNotes.map(midi => NOTES_BY_MIDI[midi].name);
    const rootNoteInfo = NOTES_BY_MIDI[chordMidiNotes[0]];
    const chordName = rootNoteInfo.pitchClass + (quality === 'minor' ? 'm' : '');
    const clef = chordMidiNotes[0] < 60 ? 'bass' : 'treble';
    return { notes: chordNoteNames, quality, clef, name: chordName, rootNoteName: rootNoteInfo.name };
}

/**
 * Finds the nearest valid center note for a chord.
 * @param {number} startMidi - The MIDI number to start searching from.
 * @param {string} quality - 'major' or 'minor'.
 * @returns {string|null} The note name of the nearest valid center.
 */
function findNearestValidCenterNote(startMidi, quality) {
    const startNote = notesByMidiKeyAware(startMidi);
    if (startNote && getChord(startNote.name, quality)) {
        return startNote.name;
    }
    for (let i = 1; i <= 12; i++) {
        const downMidi = startMidi - i;
        const downNote = notesByMidiKeyAware(downMidi);
        if (downMidi >= MIN_MIDI && downNote && getChord(downNote.name, quality)) {
            return downNote.name;
        }
        const upMidi = startMidi + i;
        const upNote = notesByMidiKeyAware(upMidi);
        if (upMidi <= MAX_MIDI && upNote && getChord(upNote.name, quality)) {
            return upNote.name;
        }
    }
    return null;
}

// ===================================================================
// UI & DOM Manipulation Helpers (Instrument-specific)
// ===================================================================

/**
 * Draws a text label on a specific key of the SVG piano.
 * @param {number} midi - The MIDI number of the key.
 * @param {string} labelText - The text to display on the label.
 */
function drawLabelOnKey(midi, labelText) {
    const keyEl = pianoState.noteEls[midi];
    const keyData = NOTES_BY_MIDI[midi];
    if (!keyEl || !keyData) return;

    const group = document.createElementNS(NS, 'g');
    const labelWidth = 14, labelHeight = 14;
    const centerX = keyData.x + ((keyData.isBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH) / 2);
    const y = keyData.isBlack ? 80 - labelHeight - 2 : 120 - labelHeight - 2;

    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('x', centerX - labelWidth / 2);
    bg.setAttribute('y', y);
    bg.setAttribute('width', labelWidth);
    bg.setAttribute('height', labelHeight);
    bg.setAttribute('rx', 3);
    bg.setAttribute('ry', 3);
    bg.setAttribute('fill', '#eee');
    bg.setAttribute('stroke', '#ccc');

    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', centerX);
    text.setAttribute('y', y + labelHeight * 0.8);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', '#333');
    text.setAttribute('font-family', 'monospace');
    text.setAttribute('font-size', '12');
    text.textContent = labelText;

    group.append(bg, text);
    (keyData.isBlack ? pianoState.gb : pianoState.gw).appendChild(group);

    pianoState.labelEls[midi] = { group };
}

/**
 * Determines which piano key is at a given mouse X-coordinate.
 * @param {number} mouseX - The mouse's X position relative to the SVG element.
 * @param {number} scale - The scaling factor of the SVG.
 * @returns {object|null} The note object for the found key.
 */
function findKeyAtPosition(mouseX, scale) {
    const clampedMouseX = Math.max(0, Math.min(TOTAL_SVG_WIDTH, mouseX / scale));
    const searchKeys = allNotes.slice().sort((a, b) => b.isBlack - a.isBlack);

    for (const keyData of searchKeys) {
        const keyWidth = keyData.isBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH;
        if (clampedMouseX >= keyData.x && clampedMouseX <= keyData.x + keyWidth) {
            return keyData;
        }
    }
    return null;
}

/**
 * Positions the hand overlay (slider) based on current piano mode.
 */
function positionSlider() {
    const svgRect = pianoState.svg.getBoundingClientRect();
    if (svgRect.width === 0) return;
    const scale = svgRect.width / TOTAL_SVG_WIDTH;
    const isChordMode = pianoState.isMajorChordMode || pianoState.isMinorChordMode;

    let startX, endX;

    if (isChordMode) {
        const quality = pianoState.isMajorChordMode ? 'major' : 'minor';
        const chord = getChord(pianoState.chordCenterNote, quality);
        if (!chord) return;

        const midis = chord.notes.map(n => NOTES_BY_NAME[n]);
        const minNote = NOTES_BY_MIDI[Math.min(...midis)];
        const maxNote = NOTES_BY_MIDI[Math.max(...midis)];
        if (!minNote || !maxNote) return;

        startX = minNote.x;
        endX = maxNote.x + (maxNote.isBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH);
    } else {
        const startNote = NOTES_BY_MIDI[whiteNoteMidis[pianoState.baseIdx]];
        const endNote = NOTES_BY_MIDI[whiteNoteMidis[pianoState.baseIdx + 8]];
        if (!startNote || !endNote) return;
        startX = startNote.x;
        endX = endNote.x + WHITE_KEY_WIDTH;
    }

    pianoState.overlay.style.left = `${startX * scale}px`;
    pianoState.overlay.style.width = `${(endX - startX) * scale}px`;
}


// ===================================================================
// Label and Highlight Painting Logic
// ===================================================================

/** Clears all labels from the piano keys. */
function clearLabels() {
    Object.values(pianoState.labelEls).forEach(item => item.group.remove());
    pianoState.labelEls = {};
}

/** Creates labels for the mapped computer keyboard keys. */
function createMappedKeyLabels() {
    const labellableKeyMap = { ...pianoState.keyMap };
    delete labellableKeyMap['g'];
    delete labellableKeyMap['h'];
    Object.entries(labellableKeyMap).forEach(([k, m]) => drawLabelOnKey(m, k.toUpperCase()));
}

/** Creates diatonic chord labels (Roman numerals). */
function createDiatonicLabels() {
    const rootMidi = NOTES_BY_NAME[pianoState.scaleTonic];
    if (rootMidi === undefined) return;
    const map = pianoState.isMajorChordMode ? majorDiatonicLabels : minorDiatonicLabels;

    // Only create labels for notes that exist on the piano
    map.intervals.forEach((interval, i) => {
        const targetMidi = rootMidi + interval;
        // Check if the MIDI note exists in our piano range and has a corresponding key element
        if (NOTES_BY_MIDI[targetMidi] && pianoState.noteEls[targetMidi]) {
            drawLabelOnKey(targetMidi, map.labels[i]);
        }
    });
}

/** Updates the labels displayed on the piano keys based on the current mode. */
function updateLabels() {
    clearLabels();
    if (!pianoState.toggleLabels) return;

    if (pianoState.isMajorChordMode || pianoState.isMinorChordMode) {
        createDiatonicLabels();
    } else {
        createMappedKeyLabels();
    }
}

/** Clears single-note mode highlights from piano keys. */
function clearHi() {
    pianoState.hi.forEach(m => pianoState.noteEls[m]?.classList.remove('left-white', 'left-black', 'middle', 'right-white', 'right-black'));
    pianoState.hi = [];
}

/** Paints highlights on keys for single-note mode. */
function paint() {
    clearHi();
    const centerMidi = whiteNoteMidis[pianoState.baseIdx + 4];
    const lw = whiteNoteMidis.slice(pianoState.baseIdx, pianoState.baseIdx + 4);
    const rw = whiteNoteMidis.slice(pianoState.baseIdx + 5, pianoState.baseIdx + 9);
    const lb = Object.values(pianoState.keyMap).filter(m => m > lw[0] && m < lw[3] && NOTES_BY_MIDI[m]?.isBlack);
    const rb = Object.values(pianoState.keyMap).filter(m => m > rw[0] && m < rw[3] && NOTES_BY_MIDI[m]?.isBlack);

    const addClass = (cls) => (m) => pianoState.noteEls[m]?.classList.add(cls);
    lw.forEach(addClass('left-white'));
    rw.forEach(addClass('right-white'));
    lb.forEach(addClass('left-black'));
    rb.forEach(addClass('right-black'));
    pianoState.noteEls[centerMidi]?.classList.add('middle');
    pianoState.hi = [...lw, ...rw, ...lb, ...rb, centerMidi];
}

/** Clears chord mode highlights from piano keys. */
function clearChordHi() {
    pianoState.chordHi.forEach(m => pianoState.noteEls[m]?.classList.remove('chord-root', 'chord-third', 'chord-fifth'));
    pianoState.chordHi = [];
}

/** Paints highlights on keys for the current chord mode. */
export function paintChord() {
    clearHi();
    const quality = pianoState.isMajorChordMode ? 'major' : 'minor';
    const chord = getChord(pianoState.chordCenterNote, quality);
    if (!chord) return;

    const midis = chord.notes.map(n => NOTES_BY_NAME[n]).filter(Boolean);
    if (midis[0] !== undefined) pianoState.noteEls[midis[0]]?.classList.add('chord-root');
    if (midis[1] !== undefined) pianoState.noteEls[midis[1]]?.classList.add('chord-third');
    if (midis[2] !== undefined) pianoState.noteEls[midis[2]]?.classList.add('chord-fifth');
    pianoState.chordHi = midis;
}

/** Temporarily paints a chord on the keys for immediate feedback. */
export function paintChordOnTheFly(chord) {
    clearHi();
    clearChordHi();
    const midis = chord.notes.map(n => NOTES_BY_NAME[n]).filter(Boolean);
    if (midis[0] !== undefined) pianoState.noteEls[midis[0]]?.classList.add('chord-root');
    if (midis[1] !== undefined) pianoState.noteEls[midis[1]]?.classList.add('chord-third');
    if (midis[2] !== undefined) pianoState.noteEls[midis[2]]?.classList.add('chord-fifth');
    pianoState.chordHi = midis;
}

// ===================================================================
// Event Handlers
// ===================================================================

/** Handles window resize event. */
function handleWindowResize() {
    positionSlider();
}

/** Handles the start of a drag event on the hand overlay (slider). */
function startSliderDrag(e) {
    pianoState.overlay.setPointerCapture(e.pointerId);
    let rafId = null;
    const isChordMode = pianoState.isMajorChordMode || pianoState.isMinorChordMode;
    if (!isChordMode) paint();

    const handleSliderMove = (ev) => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            const svgRect = pianoState.svg.getBoundingClientRect();
            const mouseX = ev.clientX - svgRect.left;
            const scale = svgRect.width / TOTAL_SVG_WIDTH;
            const foundKey = findKeyAtPosition(mouseX, scale);
            if (!foundKey) { rafId = null; return; }

            if (isChordMode) {
                const quality = pianoState.isMajorChordMode ? 'major' : 'minor';
                const nearestValidNoteName = findNearestValidCenterNote(foundKey.midi, quality);
                if (nearestValidNoteName && nearestValidNoteName !== pianoState.chordCenterNote) {
                    const prospectiveChord = getChord(nearestValidNoteName, quality);
                    if(prospectiveChord){
                        pianoState.chordCenterNote = nearestValidNoteName;
                        pianoState.scaleTonic = prospectiveChord.rootNoteName;
                        positionSlider();
                        clearChordHi();
                        paintChord();
                        updateLabels();
                    }
                }
            } else {
                let anchorMidi = foundKey.isBlack ? foundKey.midi - 1 : foundKey.midi;
                const anchorIndex = whiteNoteMidis.indexOf(anchorMidi);
                const newBaseIdx = Math.max(0, Math.min(whiteNoteMidis.length - WHITE_KEYS_IN_VIEW.length, anchorIndex - 4));
                if (newBaseIdx !== pianoState.baseIdx) {
                    pianoState.baseIdx = newBaseIdx;
                    positionSlider();
                    pianoState.keyMap = buildMap(newBaseIdx);
                    paint();
                    updateLabels();
                }
            }
            rafId = null;
        });
    };

    const endSliderDrag = () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (isChordMode) updateLabels();
        clearHi();
        pianoState.overlay.releasePointerCapture(e.pointerId);
        document.removeEventListener('pointermove', handleSliderMove);
    };

    document.addEventListener('pointermove', handleSliderMove);
    document.addEventListener('pointerup', endSliderDrag, { once: true });
}

/** Handles changes between single note and chord modes. */
function handleChordModeChange() {
    clearHi();
    clearChordHi();
    const isChordMode = pianoState.isMajorChordMode || pianoState.isMinorChordMode;
    pianoState.overlay.classList.toggle('chord-mode', isChordMode);

    if (isChordMode) {
        const tonicMidi = NOTES_BY_NAME[pianoState.scaleTonic];
        if (tonicMidi !== undefined) {
            const thirdInterval = pianoState.isMajorChordMode ? 4 : 3;
            const centerMidi = tonicMidi + thirdInterval;
            if (NOTES_BY_MIDI[centerMidi]) {
                pianoState.chordCenterNote = NOTES_BY_MIDI[centerMidi].name;
            }
        }
        paintChord();
    } else {
        pianoState.keyMap = buildMap(pianoState.baseIdx);
        paint();
    }
    positionSlider();
    updateLabels();
}

/** Handles pointerdown events on SVG piano keys. */
function handleKeyPointerDown(e) {
    const keyEl = e.target.closest('.key');
    if (!keyEl) return;
    let targetMidi = parseInt(keyEl.dataset.midi, 10);
    // Determine if shift-clicking a white key to get its sharp black key
    if (e.shiftKey) {
        const potentialSharpMidi = targetMidi + 1;
        const potentialSharpNote = notesByMidiKeyAware(potentialSharpMidi);
        console.log('potentialSharpMidi:', potentialSharpMidi);
        console.log('potentialSharpNote:', potentialSharpNote);
        if (potentialSharpNote?.isBlack) {
            targetMidi = potentialSharpMidi;
        }
    }
    const finalKeyEl = pianoState.noteEls[targetMidi];
    if (!finalKeyEl) return;
    const isChordMode = pianoState.isMajorChordMode || pianoState.isMinorChordMode;
    if (isChordMode) {
        const quality = pianoState.isMajorChordMode ? 'major' : 'minor';
        const noteInfo = notesByMidiKeyAware(finalKeyEl.dataset.midi);
        const noteName = noteInfo?.name;
        if (!noteName) return; // Ensure a valid noteName
        const thirdInterval = quality === 'major' ? 4 : 3;
        const newCenterMidi = NOTES_BY_NAME[noteName] + thirdInterval;
        const newCenterNote = notesByMidiKeyAware(newCenterMidi);
        if (!newCenterNote) return;
        const chord = getChord(newCenterNote.name, quality);
        if (!chord) return;
        pianoState.chordCenterNote = newCenterNote.name;
        pianoState.scaleTonic = noteName;
        positionSlider();
        clearChordHi();
        paintChord();
        updateLabels();
        // Store start time for chord held duration
        const startTime = performance.now();
        // Store the full chord object including its clef, notes, name for later use in writeNote
        pianoState.activeNotes[finalKeyEl.dataset.midi] = { el: finalKeyEl, startTime: startTime, chordData: chord };
        trigger(chord.notes, true);
        finalKeyEl.classList.add('pressed');
        finalKeyEl.setPointerCapture(e.pointerId);
        const handleKeyPointerUp = () => {
            const heldTime = performance.now() - startTime;
            let duration = 'q';
            if (heldTime >= DURATION_THRESHOLDS.w) duration = 'w';
            else if (heldTime >= DURATION_THRESHOLDS.h) duration = 'h';
            trigger(chord.notes, false);
            finalKeyEl.classList.remove('pressed');
            finalKeyEl.releasePointerCapture(e.pointerId);
            delete pianoState.activeNotes[finalKeyEl.dataset.midi];
            // Pass the chordData (which includes clef and notes) directly to writeNote
            writeNote({ clef: chord.clef, duration, notes: chord.notes, chordName: chord.name });
        };
        finalKeyEl.addEventListener('pointerup', handleKeyPointerUp, { once: true });
        finalKeyEl.addEventListener('pointercancel', handleKeyPointerUp, { once: true });
    } else { // Single note mode
        startKey(finalKeyEl);
        finalKeyEl.setPointerCapture(e.pointerId);
        const startTime = performance.now(); // Track start time for duration
        const handleKeyPointerUp = () => {
            stopKey(finalKeyEl);
            finalKeyEl.releasePointerCapture(e.pointerId);
            const heldTime = performance.now() - startTime;
            let duration = 'q';
            if (heldTime >= DURATION_THRESHOLDS.w) duration = 'w';
            else if (heldTime >= DURATION_THRESHOLDS.h) duration = 'h';
            const noteInfo = notesByMidiKeyAware(targetMidi);
            const noteNameForScore = noteInfo.name;
            const clef = noteInfo.midi < 60 ? 'bass' : 'treble';
            writeNote({ clef, duration, notes: [noteNameForScore], chordName: noteNameForScore });
        };
        finalKeyEl.addEventListener('pointerup', handleKeyPointerUp, { once: true });
        finalKeyEl.addEventListener('pointercancel', handleKeyPointerUp, { once: true });
    }
}

function handleKeyDown(e) {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (pianoState.held.has(k)) return;

    if (['1','2','3','4','5','6','7'].includes(e.key)) {
        e.preventDefault();
        pianoState.held.set(k, null); // No MIDI for chord keys
        playDiatonicChord(parseInt(e.key, 10), k);
        if (pianoState.activeDiatonicChords[k]) {
            pianoState.activeDiatonicChords[k].startTime = performance.now();
        }
    } else if (k === 'z' || k === 'x') {
        e.preventDefault();
        pianoState.held.set(k, null); // No MIDI for rest keys
        pianoState.activeRests[k] = { startTime: performance.now(), clef: k === 'z' ? 'bass' : 'treble' };
        return;
    } else if (pianoState.keyMap[k] !== undefined) {
        e.preventDefault();
        const baseMidi = pianoState.keyMap[k];
        let targetMidi = baseMidi;
        const nextNote = notesByMidiKeyAware(baseMidi + 1);
        if (e.shiftKey && nextNote?.isBlack) {
            targetMidi = baseMidi + 1;
        }
        const keyEl = pianoState.noteEls[targetMidi];
        if (keyEl) {
            pianoState.held.set(k, targetMidi); // Store the actual MIDI played
            keyEl.dataset.startTime = performance.now();
            startKey(keyEl);
        }
    }
}

function handleKeyUp(e) {
    clearChordHi();
    clearHi();

    const k = e.key.toLowerCase();
    if (!pianoState.held.has(k)) return;

    if (['1', '2', '3', '4', '5', '6', '7'].includes(e.key)) {
        stopDiatonicChord(k);
    } else if (k === 'z' || k === 'x') {
        const restData = pianoState.activeRests[k];
        if (restData) {
            const heldTime = performance.now() - restData.startTime;
            let duration = 'q';
            if (heldTime >= DURATION_THRESHOLDS.w) duration = 'w';
            else if (heldTime >= DURATION_THRESHOLDS.h) duration = 'h';

            const restPositionNote = restData.clef === 'bass' ? 'D3' : 'B4';
            writeNote({ clef: restData.clef, duration, notes: [restPositionNote], chordName: 'Rest', isRest: true });
            delete pianoState.activeRests[k];
        }
    } else if (pianoState.keyMap[k] !== undefined) {
        const actualMidi = pianoState.held.get(k); // Get the actual MIDI that was played
        const keyEl = pianoState.noteEls[actualMidi];
        if (keyEl && keyEl.dataset.playing === 'note') {
            const heldTime = performance.now() - parseFloat(keyEl.dataset.startTime);
            let duration = 'q';
            if (heldTime >= DURATION_THRESHOLDS.w) duration = 'w';
            else if (heldTime >= DURATION_THRESHOLDS.h) duration = 'h';

            const noteInfo = notesByMidiKeyAware(actualMidi);
            const noteNameForScore = noteInfo.name;
            const clef = noteInfo.midi < 60 ? 'bass' : 'treble';

            stopKey(keyEl);
            writeNote({ clef, duration, notes: [noteNameForScore], chordName: noteNameForScore });
        }
    }
    pianoState.held.delete(k);
    pianoState.held.delete(e.key);
}

/** Activates all event listeners for the instrument. */
function activateInstrumentListeners() {
    pianoState.svg.addEventListener('pointerdown', handleKeyPointerDown);
    pianoState.overlay.addEventListener('pointerdown', startSliderDrag);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

/** Unlocks audio and removes the gate. */
async function unlock() {
    // Call the single authoritative function to start audio.
    const audioStarted = await startAudio();

    // If successful, perform UI-specific setup that makes the piano playable.
    if (audioStarted) {
        if (pianoState.gate?.isConnected) {
            pianoState.gate.remove();
        }
        document.getElementById('instrument')?.focus();
        paint();
        activateInstrumentListeners();
    }
}

/** Handles initial pointerdown to unlock audio. */
function handleControlsPointerDown() {
    if (pianoState.gate.isConnected) unlock();
}

/** Handles spacebar keydown to unlock audio. */
function handleSpacebarUnlock(e) {
    if (e.code === 'Space' && pianoState.gate.isConnected) {
        unlock();
        e.preventDefault();
        window.removeEventListener('keydown', handleSpacebarUnlock);
    }
}

// ===================================================================
// Exported Functions
// ===================================================================

export function handleToggleLabelsChange(e) {
    pianoState.toggleLabels = e.target.checked;
    updateLabels();
    const buttonElement = e.target.parentElement; 

    // Add or remove the .is-active class based on the checkbox state
    if (e.target.checked) {
        buttonElement.classList.add('is-active');
    } else {
        buttonElement.classList.remove('is-active');
    }
}

/** Handles cycling through the different playing modes. */
export function handleModeCycleClick(e) {
    if (!pianoState.isMajorChordMode && !pianoState.isMinorChordMode) {
        pianoState.isMajorChordMode = true;
        e.target.textContent = 'Major Key';
    } else if (pianoState.isMajorChordMode) {
        pianoState.isMajorChordMode = false;
        pianoState.isMinorChordMode = true;
        e.target.textContent = 'Minor Key';
    } else {
        pianoState.isMinorChordMode = false;
        e.target.textContent = 'Single Note';
    }
    handleChordModeChange();
}


/**
 * Initializes the piano application. This is the main entry point.
 */
export function initializeInstrumentUI() {
    const instrumentDiv = document.getElementById('instrument');
    if (!instrumentDiv) { console.error("Element #instrument not found!"); return; }

    // Create SVG and key groups
    pianoState.svg = document.createElementNS(NS, 'svg');
    pianoState.svg.setAttribute('viewBox', `0 0 ${TOTAL_SVG_WIDTH} 120`);
    pianoState.gw = document.createElementNS(NS, 'g');
    pianoState.gb = document.createElementNS(NS, 'g');
    pianoState.svg.append(pianoState.gw, pianoState.gb);

    // Create SVG key elements
    allNotes.forEach(note => {
        const r = document.createElementNS(NS, 'rect');
        r.dataset.midi = note.midi;
        r.setAttribute('x', note.x);
        r.setAttribute('y', 0);
        if (note.isBlack) {
            r.setAttribute('width', BLACK_KEY_WIDTH);
            r.setAttribute('height', 80);
            r.setAttribute('class', 'black key');
            pianoState.gb.appendChild(r);
        } else {
            r.setAttribute('width', WHITE_KEY_WIDTH);
            r.setAttribute('height', 120);
            r.setAttribute('class', 'white key');
            pianoState.gw.appendChild(r);
        }
        pianoState.noteEls[note.midi] = r;
    });

    // Create overlay and gate elements
    pianoState.overlay = document.createElement('div');
    pianoState.overlay.id = 'handOverlay';
    pianoState.gate = document.createElement('div');
    pianoState.gate.id = 'gate';
    pianoState.gate.innerHTML = '<p>Click or press Space to begin</p>';
    pianoState.gate.tabIndex = 0;
    instrumentDiv.append(pianoState.svg, pianoState.overlay, pianoState.gate);

    // Set initial state and UI
    pianoState.baseIdx = whiteNoteMidis.indexOf(NOTES_BY_NAME['F3']);
    pianoState.keyMap = buildMap(pianoState.baseIdx);
    positionSlider();
    updateLabels();

    // Attach initial event listeners
    pianoState.gate.addEventListener('pointerdown', unlock, { once: true });
    document.querySelector('.controls')?.addEventListener('pointerdown', handleControlsPointerDown, { once: true });
    window.addEventListener('keydown', handleSpacebarUnlock, { once: true });
    document.getElementById('toggleLabelsCheckbox')?.addEventListener('change', handleToggleLabelsChange);
    document.getElementById('mode-cycle-btn')?.addEventListener('click', handleModeCycleClick);
    window.addEventListener('resize', handleWindowResize);

    console.log("Piano instrument UI initialized.");
}