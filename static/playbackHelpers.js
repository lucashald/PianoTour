// playbackHelpers.js
// This file contains all functions related to audio playback using Tone.js.

// ===================================================================
// Imports
// ===================================================================

// Import the centralized state object
import { pianoState } from './appState.js';

// Import musical data and constants
import {
    NOTES_BY_MIDI, NOTES_BY_NAME, UNIFIED_CHORD_DEFINITIONS,
    diatonicChordQualities, chordDefinitions, DURATION_THRESHOLDS, notesByMidiKeyAware
} from './note-data.js';

// Import UI painting functions
import { paintChord, paintChordOnTheFly, getChord } from './instrumentHelpers.js';
import { writeNote } from './scoreWriter.js';

/**
 * Initializes the Tone.js audio context, loads the sampler, removes the UI gate,
 * and sets the application state to "unlocked". This is the single, authoritative
 * function for making the app interactive.
 * @returns {Promise<boolean>} True if successful, false if an error occurred.
 */
export async function startAudio() {
    // If the app is already unlocked, do nothing.
    if (pianoState.isUnlocked) return true;

    try {
        // 1. Start Tone.js audio context
        await Tone.start();
        pianoState.ctxStarted = true;
        console.log("Tone.js audio context started.");

        // 2. Create and load the audio sampler
        pianoState.sampler = new Tone.Sampler({
            urls: { 'C3': 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', 'A3': 'A3.mp3', 'C4': 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', 'A4': 'A4.mp3' },
            release: 1,
            baseUrl: 'https://tonejs.github.io/audio/salamander/'
        }).toDestination();

        await Tone.loaded();
        pianoState.samplerReady = true;
        console.log("Sampler is ready!");

        // 4. Update the global state to indicate the app is unlocked
        pianoState.isUnlocked = true;
        
        return true; // Signal success

    } catch (error) {
        console.error("Error during audio initialization:", error);
        pianoState.isUnlocked = false; // Ensure state is correct on failure
        return false; // Signal failure
    }
}

/**
 * Triggers or releases notes on the Tone.js sampler.
 * @param {string|string[]} note - The note name(s) (e.g., "C4", ["C4", "E4", "G4"]).
 * @param {boolean} on - True to trigger attack, false to trigger release.
 * @param {number} [velocity=100] - MIDI velocity (1-127).
 */
export function trigger(note, on, velocity = 100) {
    if (!pianoState.samplerReady) return;
    if (on) {
        pianoState.sampler.triggerAttack(note, Tone.now(), velocity / 127);
    } else {
        pianoState.sampler.triggerRelease(note);
    }
}

/**
 * Starts a single piano key's sound and visual feedback.
 * @param {HTMLElement} el - The SVG element of the key.
 * @param {number} [velocity=100] - MIDI velocity.
 */
export function startKey(el, velocity = 100) {
    const midi = el.dataset.midi;
    console.log('startKey: midi =', midi);
    if (!midi || el.dataset.playing) return;

    const noteInfo = notesByMidiKeyAware(midi);
    console.log('startKey: noteInfo =', noteInfo);
    if (!noteInfo) return;

    const noteName = noteInfo.name;
    console.log('startKey: noteName =', noteName);
    console.log('startKey: calling trigger with', noteName);

    el.dataset.playing = 'note';
    el.classList.add('pressed');
    trigger(noteName, true, velocity);

    const spelling = pianoState.keySignatureType === 'b' ? 'flat' : 'sharp';
    pianoState.activeNotes[midi] = { el, spelling, startTime: performance.now() };
}

/**
 * Stops a single piano key's sound and visual feedback.
 * @param {HTMLElement} el - The SVG element of the key.
 */
export function stopKey(el) {
    const midi = el.dataset.midi;
    if (!midi || !el.dataset.playing) return;
    const activeNote = pianoState.activeNotes[midi];
    if (!activeNote) return;

    const noteInfo = notesByMidiKeyAware(midi);
    const noteNameToTrigger = noteInfo.name; // Use key-signature-aware name

    trigger(noteNameToTrigger, false);
    delete el.dataset.playing;
    el.classList.remove('pressed');
    delete pianoState.activeNotes[midi];
}

// ===================================================================
// Diatonic Chord Playback (Unified)
// ===================================================================

/**
 * Unified function to play a diatonic chord based on a scale degree.
 * Works for both MIDI controller and keyboard/mouse inputs.
 * @param {number} degree - The scale degree (1-7).
 * @param {string|number} key - The unique identifier for this chord instance.
 * @param {boolean} [writeToScore=true] - Whether to prepare for score writing.
 */
export function playDiatonicChord(degree, key, writeToScore = true) {
    const isInChordMode = pianoState.isMajorChordMode || pianoState.isMinorChordMode;
    const localMode = isInChordMode ? (pianoState.isMajorChordMode ? 'major' : 'minor') : 'major';
    const spaceMidi = pianoState.keyMap[' '];
    if (!spaceMidi && !isInChordMode) return;

    const localTonic = isInChordMode ? pianoState.scaleTonic : NOTES_BY_MIDI[spaceMidi]?.name;
    if (!localTonic) {
        console.warn("No local tonic defined to play diatonic chord.");
        return;
    }

    const qualityKey = diatonicChordQualities[localMode][degree];
    const chordDef = UNIFIED_CHORD_DEFINITIONS[qualityKey];
    if (!chordDef) {
        console.warn(`No chord definition found for qualityKey: ${qualityKey}`);
        return;
    }

    const scale = Tonal.Scale.get(`${Tonal.Note.pitchClass(localTonic)} ${localMode}`);
    if (!scale?.notes?.length) {
        console.warn(`Could not get scale for ${localTonic} ${localMode}`);
        return;
    }

    const rootPitchClassTonal = scale.notes[degree - 1];
    const intervalToRoot = Tonal.Interval.distance(Tonal.Note.pitchClass(localTonic), rootPitchClassTonal);
    const actualRootNoteNameWithOctave = Tonal.Note.transpose(localTonic, intervalToRoot);
    const specificChordKey = Tonal.Note.pitchClass(actualRootNoteNameWithOctave) + (chordDef.suffix || '');
    const predefinedChord = chordDefinitions[specificChordKey];
    let notesForPlayback = [];
    let clefForPlayback = 'treble';
    let chordNameForDisplay = predefinedChord?.displayName || specificChordKey;

    if (!predefinedChord || (!predefinedChord.treble?.length && !predefinedChord.bass?.length)) {
        console.warn(`Predefined chord not found for ${specificChordKey}. Deriving for playback.`);
        const rootMidi = NOTES_BY_NAME[actualRootNoteNameWithOctave];
        if (rootMidi === undefined) return;
        notesForPlayback = chordDef.intervals.map(interval => NOTES_BY_MIDI[rootMidi + interval]?.name).filter(Boolean);
        if (notesForPlayback.length > 0 && Math.min(...notesForPlayback.map(n => NOTES_BY_NAME[n])) < 60) {
            clefForPlayback = 'bass';
        }
    } else {
        const tonicOctave = Tonal.Note.octave(localTonic);
        notesForPlayback = (tonicOctave >= 4 || !predefinedChord.bass.length) ? predefinedChord.treble : predefinedChord.bass;
        if (!notesForPlayback.length) {
            notesForPlayback = predefinedChord.treble.length ? predefinedChord.treble : predefinedChord.bass;
        }
        if (notesForPlayback.length > 0 && Math.min(...notesForPlayback.map(n => NOTES_BY_NAME[n])) < 60) {
            clefForPlayback = 'bass';
        }
    }

    if (notesForPlayback.length === 0) {
        console.warn(`No notes determined for playback for ${specificChordKey}.`);
        return;
    }

    // Play the chord
    trigger(notesForPlayback, true);
    paintChordOnTheFly({ notes: notesForPlayback });

    // Store chord data consistently for both input methods
    pianoState.activeDiatonicChords[key] = {
        key: specificChordKey,
        clef: clefForPlayback,
        displayName: chordNameForDisplay,
        notes: notesForPlayback,
        startTime: performance.now(),
        writeToScore // Flag to determine if this should be written to score
    };
}

/**
 * Unified function to stop a diatonic chord and handle score writing.
 * @param {string|number} key - The unique identifier used when the chord was played.
 */
/**
 * Unified function to stop a diatonic chord and handle score writing.
 * @param {string|number} key - The unique identifier used when the chord was played.
 */
export function stopDiatonicChord(key) {
    const chordData = pianoState.activeDiatonicChords[key];
    if (!chordData) return;

    // Stop the audio
    if (chordData.notes?.length) {
        trigger(chordData.notes, false);
    } else {
        // Fallback to predefined chord lookup
        const predefinedChord = chordDefinitions[chordData.key];
        if (predefinedChord) {
            let notesForRelease = (chordData.clef === 'bass' && predefinedChord.bass?.length) ? predefinedChord.bass : predefinedChord.treble;
            if (!notesForRelease?.length) {
                notesForRelease = predefinedChord.treble?.length ? predefinedChord.treble : predefinedChord.bass;
            }
            if (notesForRelease?.length) {
                trigger(notesForRelease, false);
            }
        }
    }
    // Handle score writing if enabled
    if (chordData.writeToScore) {
        console.log('Writing chord to score:', chordData);
        const heldTime = performance.now() - chordData.startTime;
        
        // FIX: Updated quantization logic to include dotted notes.
        // Checks must be in order from longest to shortest duration.
        let duration = 'q'; // Default to quarter note
        if (heldTime >= DURATION_THRESHOLDS.w) duration = 'w';
        else if (heldTime >= DURATION_THRESHOLDS['h.']) duration = 'h.';
        else if (heldTime >= DURATION_THRESHOLDS.h) duration = 'h';
        else if (heldTime >= DURATION_THRESHOLDS['q.']) duration = 'q.';
        // The default remains 'q'

        // Use the notes directly from chord data instead of looking them up again
        if (chordData.notes && chordData.notes.length > 0) {
            console.log('About to write note:', {
                clef: chordData.clef,
                duration,
                notes: chordData.notes,
                chordName: chordData.displayName
            });
            writeNote({
                clef: chordData.clef,
                duration,
                notes: chordData.notes,
                chordName: chordData.displayName
            });
        } else {
            console.warn('No notes found in chord data for score writing');
        }
    }
    
    // Handle visual repainting
    if (Object.keys(pianoState.activeDiatonicChords).length <= 1 && (pianoState.isMajorChordMode || pianoState.isMinorChordMode)) {
        paintChord();
    }

    delete pianoState.activeDiatonicChords[key];
}

// ===================================================================
// MIDI Event Handlers (Fixed)
// ===================================================================

/**
 * Handles incoming MIDI Note On messages.
 * @param {number} midiNoteNumber - The MIDI note number (0-127).
 * @param {number} velocity - The note velocity (1-127).
 * @param {number} channel - The MIDI channel (0-15).
 */
export function handleMidiNoteOn(midiNoteNumber, velocity, channel) {
    console.log(`MIDI Note On: Channel ${channel}, Note ${midiNoteNumber}, Velocity ${velocity}`);
    
    // Channel 8 (MIDI channel 9 in user terms) is reserved for diatonic chords
    // Note: Using channel 8 instead of 9 to avoid percussion channel conflict
    if (channel === 9) {
        // Map MIDI note number to a diatonic degree (1-7)
        // Assuming MIDI notes 36-42 correspond to degrees 1-7
        const degree = midiNoteNumber - 35;
        if (degree >= 1 && degree <= 7) {
            console.log(`Playing diatonic chord: degree ${degree}`);
            // Use the unified playDiatonicChord function with score writing enabled
            playDiatonicChord(degree, `midi_${midiNoteNumber}`, true);
        } else {
            console.warn(`Invalid diatonic degree: ${degree} (from MIDI note ${midiNoteNumber})`);
        }
        return;
    }

    // Handle standard note presses
    const keyEl = pianoState.noteEls[midiNoteNumber];
    if (keyEl) {
        startKey(keyEl, 'sharp', velocity);
    } else {
        console.warn(`No key element found for MIDI note ${midiNoteNumber}`);
    }
}

/**
 * Handles incoming MIDI Note Off messages.
 * @param {number} midiNoteNumber - The MIDI note number (0-127).
 * @param {number} velocity - The note velocity (1-127).
 * @param {number} channel - The MIDI channel (0-15).
 */
export function handleMidiNoteOff(midiNoteNumber, velocity, channel) {
    console.log(`MIDI Note Off: Channel ${channel}, Note ${midiNoteNumber}, Velocity ${velocity}`);
    
    // Handle diatonic chord release from channel 8
    if (channel === 9) {
        const chordKey = `midi_${midiNoteNumber}`;
        const activeChord = pianoState.activeDiatonicChords[chordKey];
        if (activeChord) {
            console.log(`Stopping diatonic chord: ${chordKey}`);
            // Use the unified stopDiatonicChord function which handles score writing
            stopDiatonicChord(chordKey);
        } else {
            console.warn(`No active diatonic chord found for key: ${chordKey}`);
        }
        return;
    }

    // Handle standard note release
    const activeNote = pianoState.activeNotes[midiNoteNumber];
    const keyEl = pianoState.noteEls[midiNoteNumber];

    if (keyEl && activeNote) {
        // Stop the sound and visual feedback
        stopKey(keyEl);

        // --- Score Writing Logic ---
        const noteInfo = NOTES_BY_MIDI[midiNoteNumber];
        if (!noteInfo) return;

        const heldTime = performance.now() - activeNote.startTime;
        
        // FIX: Updated quantization logic to include dotted notes.
        // Checks must be in order from longest to shortest duration.
        let duration = 'q'; // Default to quarter note
        if (heldTime >= DURATION_THRESHOLDS.w) duration = 'w';
        else if (heldTime >= DURATION_THRESHOLDS['h.']) duration = 'h.';
        else if (heldTime >= DURATION_THRESHOLDS.h) duration = 'h';
        else if (heldTime >= DURATION_THRESHOLDS['q.']) duration = 'q.';
        // The default remains 'q'

        const noteNameForScore = (activeNote.spelling === 'flat' && noteInfo.flatName) ? noteInfo.flatName : noteInfo.name;
        const clef = noteInfo.midi < 60 ? 'bass' : 'treble';
        
        writeNote({
            clef,
            duration,
            notes: [noteNameForScore],
            chordName: noteNameForScore // For single notes, the chordName is just the note name
        });
    } else if (!keyEl) {
        console.warn(`No key element found for MIDI note ${midiNoteNumber}`);
    } else if (!activeNote) {
        console.warn(`No active note found for MIDI note ${midiNoteNumber}`);
    }
}

// ===================================================================
// Keyboard/Mouse Diatonic Chord Handlers (Updated)
// ===================================================================

/**
 * Handles diatonic chord playing from keyboard numbers 1-7 or mouse clicks.
 * @param {number} degree - The scale degree (1-7).
 * @param {string} inputSource - Identifier for the input source (e.g., 'keyboard_1', 'mouse_click').
 */
export function playDiatonicChordFromUI(degree, inputSource) {
    playDiatonicChord(degree, inputSource, true);
}

/**
 * Handles diatonic chord stopping from keyboard numbers 1-7 or mouse clicks.
 * @param {string} inputSource - Identifier for the input source used when starting the chord.
 */
export function stopDiatonicChordFromUI(inputSource) {
    stopDiatonicChord(inputSource);
}