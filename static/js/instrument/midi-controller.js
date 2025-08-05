// midi-controller.js
// Focused on MIDI I/O only, delegates audio to playbackHelpers.js

// Imports
import { pianoState } from "../core/appState.js";
import {
  playDiatonicChord,
  startKey,
  stopDiatonicChord,
  stopKey,
} from "./playbackHelpers.js";
import {
  DURATION_THRESHOLDS,
  NOTES_BY_MIDI,
  notesByMidiKeyAware,
} from "../core/note-data.js";
import { writeNote } from "../score/scoreWriter.js";
import { clearHi, clearChordHi } from "./instrumentHelpers.js";
import { playScaleChord, stopScaleChord } from "./keyboardHelpers.js";

// Global MIDI state
let midiAccess = null;
let onMidiNoteOnCallback = null;
let onMidiNoteOffCallback = null;
let onMidiControlChangeCallback = null;
let onMidiPitchBendCallback = null;

/**
 * Sets the callback functions for MIDI events
 */
export function setMidiCallbacks(callbacks) {
    onMidiNoteOnCallback = callbacks.onNoteOn || null;
    onMidiNoteOffCallback = callbacks.onNoteOff || null;
    onMidiControlChangeCallback = callbacks.onControlChange || null;
    onMidiPitchBendCallback = callbacks.onPitchBend || null;
    console.log("MIDI callbacks set successfully.");
}

/**
 * Handles incoming MIDI messages
 */
function handleMidiMessage(event) {
    const data = event.data;
    const statusByte = data[0];
    const data1 = data[1];
    const data2 = data[2];
    const channel = statusByte & 0x0F;

    console.log(`Raw MIDI: Status: 0x${statusByte.toString(16).padStart(2, '0')}, Data1: ${data1}, Data2: ${data2}, Channel: ${channel}`);

    // Note On (0x90-0x9F)
    if (statusByte >= 0x90 && statusByte <= 0x9F) {
        const midiNoteNumber = data1;
        const velocity = data2;
        if (velocity > 0) {
            console.log(`MIDI: Note On - Channel: ${channel}, Note: ${midiNoteNumber}, Velocity: ${velocity}`);
            if (onMidiNoteOnCallback) {
                try {
                    onMidiNoteOnCallback(midiNoteNumber, velocity, channel);
                } catch (error) {
                    console.error("Error in Note On callback:", error);
                }
            }
        } else {
            // Note On with velocity 0 = Note Off
            console.log(`MIDI: Note Off (from Note On v=0) - Channel: ${channel}, Note: ${midiNoteNumber}`);
            if (onMidiNoteOffCallback) {
                try {
                    onMidiNoteOffCallback(midiNoteNumber, velocity, channel);
                } catch (error) {
                    console.error("Error in Note Off callback:", error);
                }
            }
        }
    }
    // Note Off (0x80-0x8F)
    else if (statusByte >= 0x80 && statusByte <= 0x8F) {
        const midiNoteNumber = data1;
        const velocity = data2;
        console.log(`MIDI: Note Off - Channel: ${channel}, Note: ${midiNoteNumber}, Velocity: ${velocity}`);
        if (onMidiNoteOffCallback) {
            try {
                onMidiNoteOffCallback(midiNoteNumber, velocity, channel);
            } catch (error) {
                console.error("Error in Note Off callback:", error);
            }
        }
    }
    // Control Change (0xB0-0xBF)
    else if (statusByte >= 0xB0 && statusByte <= 0xBF) {
        const controllerNumber = data1;
        const controllerValue = data2;
        console.log(`MIDI: Control Change - Channel: ${channel}, Controller: ${controllerNumber}, Value: ${controllerValue}`);
        if (onMidiControlChangeCallback) {
            try {
                onMidiControlChangeCallback(controllerNumber, controllerValue, channel);
            } catch (error) {
                console.error("Error in Control Change callback:", error);
            }
        }
    }
    // Pitch Bend (0xE0-0xEF)
    else if (statusByte >= 0xE0 && statusByte <= 0xEF) {
        const pitchBendValue = (data2 << 7) | data1;
        console.log(`MIDI: Pitch Bend - Channel: ${channel}, Value: ${pitchBendValue}`);
        if (onMidiPitchBendCallback) {
            try {
                onMidiPitchBendCallback(pitchBendValue, channel);
            } catch (error) {
                console.error("Error in Pitch Bend callback:", error);
            }
        }
    }
}

/**
 * Attaches MIDI listeners to all input devices
 */
function attachMidiListeners() {
    if (!midiAccess) {
        console.warn("attachMidiListeners: MIDIAccess object is not available.");
        return;
    }
    
    let inputCount = 0;
    midiAccess.inputs.forEach(input => {
        input.onmidimessage = handleMidiMessage;
        inputCount++;
        console.log(`Attached MIDI message listener to input: "${input.name}" (ID: ${input.id})`);
    });
    
    if (inputCount === 0) {
        console.warn("No MIDI input devices found.");
    } else {
        console.log(`Successfully attached listeners to ${inputCount} MIDI input device(s).`);
    }
}

/**
 * Success callback for navigator.requestMIDIAccess()
 */
function onMIDISuccess(access) {
    midiAccess = access;
    console.log("MIDI access granted successfully.");
    
    console.log("Available MIDI inputs:");
    midiAccess.inputs.forEach(input => {
        console.log(`- ${input.name} (ID: ${input.id}, State: ${input.state})`);
    });
    
    console.log("Available MIDI outputs:");
    midiAccess.outputs.forEach(output => {
        console.log(`- ${output.name} (ID: ${output.id}, State: ${output.state})`);
    });
    
    attachMidiListeners();
    
    midiAccess.onstatechange = (event) => {
        console.log(`MIDI device state change: ${event.port.name} (${event.port.type}) - ${event.port.state}`);
        if (event.port.type === 'input') {
            attachMidiListeners();
        }
    };
}

/**
 * Error callback for navigator.requestMIDIAccess()
 */
function onMIDIFailure(error) {
    console.error(`Failed to get MIDI access: ${error.name} - ${error.message}`);
    
    if (error.name === 'SecurityError') {
        console.error("This might be due to CORS restrictions or the page not being served over HTTPS.");
    } else if (error.name === 'NotSupportedError') {
        console.error("Web MIDI API is not supported in this browser.");
    }
}

/**
 * Initiates MIDI access request
 */
export function initMidi() {
    if (navigator.requestMIDIAccess) {
        console.log("initMidi: Requesting Web MIDI API access...");
        navigator.requestMIDIAccess({ sysex: false })
            .then(onMIDISuccess)
            .catch(onMIDIFailure);
    } else {
        console.warn("initMidi: Web MIDI API is not supported in this browser.");
        console.warn("Try using Chrome, Edge, or Opera. Firefox does not support Web MIDI API.");
    }
}

/**
 * Gets current MIDI access object (for debugging)
 */
export function getMidiAccess() {
    return midiAccess;
}

/**
 * Lists all connected MIDI devices (for debugging)
 */
export function listMidiDevices() {
    if (!midiAccess) {
        console.log("MIDI not initialized yet.");
        return;
    }
    
    console.log("=== MIDI Device List ===");
    console.log("Inputs:");
    midiAccess.inputs.forEach(input => {
        console.log(`  - ${input.name} (ID: ${input.id}, State: ${input.state})`);
    });
    
    console.log("Outputs:");
    midiAccess.outputs.forEach(output => {
        console.log(`  - ${output.name} (ID: ${output.id}, State: ${output.state})`);
    });
}

// ===================================================================
// MIDI EVENT HANDLERS (delegate to playbackHelpers.js)
// ===================================================================

/**
 * MIDI Note On handler - delegates to playbackHelpers.js
 */
export function handleMidiNoteOn(midiNoteNumber, velocity, channel) {
    console.log(`MIDI Note On: Channel ${channel}, Note ${midiNoteNumber}, Velocity ${velocity}`);

    // Check if audio system is ready
    if (pianoState.audioStatus !== 'ready') {
        console.warn("MIDI input ignored - audio not ready. Audio status:", pianoState.audioStatus);
        return;
    }

    // Channel 9 (MIDI channel 10) for diatonic chords
    if (channel === 9) {
        const degree = midiNoteNumber - 35; // Map MIDI notes 36-42 to degrees 1-7
        if (degree >= 1 && degree <= 7) {
            console.log(`Playing diatonic chord: degree ${degree}`);
            playScaleChord(degree, `midi_${midiNoteNumber}`, true);
        } else {
            console.warn(`Invalid diatonic degree: ${degree} (from MIDI note ${midiNoteNumber})`);
        }
        return;
    }

    // Handle individual notes
    const keyEl = pianoState.noteEls[midiNoteNumber];
    if (keyEl) {
        // Check for duplicate note on
        if (keyEl.dataset.playing === 'true') {
            console.log(`Note ${midiNoteNumber} already playing, ignoring duplicate MIDI Note On`);
            return;
        }
        
        // Delegate to playbackHelpers.js - it handles the envelope properly
        startKey(keyEl, velocity);
    } else {
        console.warn(`No key element found for MIDI note ${midiNoteNumber}`);
    }
}

/**
 * MIDI Note Off handler - delegates to playbackHelpers.js with score writing
 */
export function handleMidiNoteOff(midiNoteNumber, velocity, channel) {
    console.log(`MIDI Note Off: Channel ${channel}, Note ${midiNoteNumber}, Velocity ${velocity}`);

    // Check if audio system is ready
    if (pianoState.audioStatus !== 'ready') {
        console.warn("MIDI input ignored - audio not ready. Audio status:", pianoState.audioStatus);
        return;
    }

    // Clear highlights (like keyboard does)
    clearChordHi();
    clearHi();

    // Handle diatonic chords (Channel 9)
    if (channel === 9) {
        const chordKey = `midi_${midiNoteNumber}`;
        const activeChord = pianoState.activeDiatonicChords[chordKey];
        if (activeChord) {
            console.log(`Stopping diatonic chord: degree ${midiNoteNumber - 35}`);
            stopScaleChord(chordKey);
        }
        return;
    }

    // Handle individual notes
    const activeNote = pianoState.activeNotes[midiNoteNumber];
    const keyEl = pianoState.noteEls[midiNoteNumber];

    if (keyEl && activeNote) {
        // Calculate duration before stopping (since stopKey will clear activeNote)
        const heldTime = performance.now() - activeNote.startTime;
        let duration = 'q'; // Default quarter note
        if (heldTime >= DURATION_THRESHOLDS.w) duration = 'w';
        else if (heldTime >= DURATION_THRESHOLDS['h.']) duration = 'h.';
        else if (heldTime >= DURATION_THRESHOLDS.h) duration = 'h';
        else if (heldTime >= DURATION_THRESHOLDS['q.']) duration = 'q.';

        // Get note info for score writing
        const noteInfo = NOTES_BY_MIDI[midiNoteNumber];
        const noteInfoKeyAware = notesByMidiKeyAware(midiNoteNumber);
        const noteNameForScore = noteInfoKeyAware ? noteInfoKeyAware.name : noteInfo.name;
        const clef = noteInfo.midi < 60 ? 'bass' : 'treble';

        // Delegate audio stopping to playbackHelpers.js - it handles envelope properly
        stopKey(keyEl);

        // Write to score after audio is stopped
        if (noteInfo) {
            writeNote({ 
                clef, 
                duration, 
                notes: [noteNameForScore], 
                chordName: noteNameForScore 
            });
            console.log(`MIDI Note Off processed: ${noteNameForScore} (${duration}) in ${clef} clef`);
        }
    } else {
        if (!keyEl) {
            console.warn(`No key element found for MIDI note ${midiNoteNumber}`);
        }
        if (!activeNote) {
            console.log(`No active note found for MIDI note ${midiNoteNumber} - may have already been released`);
        }
    }

}

// ===================================================================
// INITIALIZATION AND MONITORING
// ===================================================================

/**
 * Initialize MIDI with proper callbacks
 */
export function initMidiWithCallbacks() {
    if (!navigator.requestMIDIAccess) {
        console.warn("Web MIDI API not supported in this browser. Try Chrome, Edge, or Opera.");
        return;
    }

    console.log("Initializing MIDI controller support...");

    // Set up callbacks that delegate to our handlers
    setMidiCallbacks({
        onNoteOn: handleMidiNoteOn,
        onNoteOff: handleMidiNoteOff,
        onControlChange: (controller, value, channel) => {
            console.log(`MIDI CC: Controller ${controller}, Value ${value}, Channel ${channel}`);
            // Add control change handling here if needed
        },
        onPitchBend: (value, channel) => {
            console.log(`MIDI Pitch Bend: Value ${value}, Channel ${channel}`);
            // Add pitch bend handling here if needed
        }
    });

    // Initialize MIDI access
    initMidi();
}

/**
 * Monitor MIDI and audio state
 */
export function monitorMidiState() {
    const state = {
        audioStatus: pianoState.audioStatus,
        midiAccess: !!getMidiAccess(),
        activeNotes: Object.keys(pianoState.activeNotes).length,
        activeDiatonicChords: Object.keys(pianoState.activeDiatonicChords).length
    };
    
    console.table(state);
    return state;
}

/**
 * Safe MIDI initialization that waits for audio to be ready
 */
export function initMidiWhenReady() {
    const checkAndInit = () => {
        if (pianoState.audioStatus === 'ready') {
            console.log("Audio is ready, initializing MIDI...");
            initMidiWithCallbacks();
            
            // Add debug functions to global scope
            window.midiDebug = {
                monitor: monitorMidiState,
                listDevices: listMidiDevices,
                getMidiAccess: getMidiAccess
            };
            
            console.log("MIDI debug functions available at window.midiDebug");
        } else {
            console.log(`Waiting for audio to be ready. Current status: ${pianoState.audioStatus}`);
            setTimeout(checkAndInit, 500);
        }
    };
    
    checkAndInit();
}