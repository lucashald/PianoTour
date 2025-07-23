// ===================================================================
// Imports
// ===================================================================

// Import the centralized state object
import { pianoState } from "./appState.js";

// Import playback functions
import {
  startKey,
  stopKey,
  playDiatonicChord,
  stopDiatonicChord,
} from "./playbackHelpers.js";

// Import musical data and constants
import {
  NOTES_BY_MIDI,
  DURATION_THRESHOLDS,
  notesByMidiKeyAware,
} from "./note-data.js";

// Import score writing function
import { writeNote } from "./scoreWriter.js";

// Global variable to store the MIDIAccess object once granted.
let midiAccess = null;

// Callback functions that the main application (test.html) will register.
let onMidiNoteOnCallback = null;
let onMidiNoteOffCallback = null;
let onMidiControlChangeCallback = null;
let onMidiPitchBendCallback = null;

/**
 * Sets the callback functions that midi-controller.js will invoke
 * when MIDI messages are received. This is the primary way for your
 * main application to receive MIDI input.
 *
 * @param {object} callbacks - An object containing callback functions.
 * @param {function(number, number, number)} callbacks.onNoteOn - Called for Note On. Params: `midiNoteNumber` (0-127), `velocity` (1-127), `channel` (0-15).
 * @param {function(number, number, number)} callbacks.onNoteOff - Called for Note Off. Params: `midiNoteNumber` (0-127), `velocity` (0-127), `channel` (0-15).
 * @param {function(number, number, number)} [callbacks.onControlChange] - Optional: Called for Control Change. Params: `controllerNumber` (0-127), `controllerValue` (0-127), `channel` (0-15).
 * @param {function(number, number)} [callbacks.onPitchBend] - Optional: Called for Pitch Bend. Params: `pitchBendValue` (0-16383), `channel` (0-15).
 */
export function setMidiCallbacks(callbacks) {
    if (callbacks.onNoteOn && typeof callbacks.onNoteOn === 'function') {
        onMidiNoteOnCallback = callbacks.onNoteOn;
        console.log("MIDI Note On callback registered.");
    } else {
        console.warn("setMidiCallbacks: 'onNoteOn' callback is missing or not a function.");
    }

    if (callbacks.onNoteOff && typeof callbacks.onNoteOff === 'function') {
        onMidiNoteOffCallback = callbacks.onNoteOff;
        console.log("MIDI Note Off callback registered.");
    } else {
        console.warn("setMidiCallbacks: 'onNoteOff' callback is missing or not a function.");
    }

    // Optional callbacks
    onMidiControlChangeCallback = (callbacks.onControlChange && typeof callbacks.onControlChange === 'function') ? callbacks.onControlChange : null;
    onMidiPitchBendCallback = (callbacks.onPitchBend && typeof callbacks.onPitchBend === 'function') ? callbacks.onPitchBend : null;

    console.log("MIDI callbacks set successfully.");
}

/**
 * Handles incoming MIDI messages from connected input devices.
 * This function parses the raw MIDI data and dispatches it to the
 * appropriate registered callback function, now including the channel.
 *
 * @param {MIDIMessageEvent} event - The MIDI message event object.
 */
function handleMidiMessage(event) {
    const data = event.data;
    const statusByte = data[0];
    const data1 = data[1];
    const data2 = data[2];
    const channel = statusByte & 0x0F; // Extract the channel (0-15)

    // Add detailed logging for debugging
    console.log(`Raw MIDI: Status: 0x${statusByte.toString(16).padStart(2, '0')}, Data1: ${data1}, Data2: ${data2}, Channel: ${channel}`);

    // Note On (0x90-0x9F) or Note Off (0x80-0x8F)
    if (statusByte >= 0x90 && statusByte <= 0x9F) {
        const midiNoteNumber = data1;
        const velocity = data2;
        if (velocity > 0) {
            // Note On message
            console.log(`MIDI: Note On - Channel: ${channel}, Note: ${midiNoteNumber}, Velocity: ${velocity}`);
            if (onMidiNoteOnCallback) {
                try {
                    onMidiNoteOnCallback(midiNoteNumber, velocity, channel);
                } catch (error) {
                    console.error("Error in Note On callback:", error);
                }
            } else {
                console.warn("No Note On callback registered");
            }
        } else {
            // Note On with velocity 0 is treated as Note Off
            console.log(`MIDI: Note Off (from Note On v=0) - Channel: ${channel}, Note: ${midiNoteNumber}`);
            if (onMidiNoteOffCallback) {
                try {
                    onMidiNoteOffCallback(midiNoteNumber, velocity, channel);
                } catch (error) {
                    console.error("Error in Note Off callback:", error);
                }
            } else {
                console.warn("No Note Off callback registered");
            }
        }
    } else if (statusByte >= 0x80 && statusByte <= 0x8F) {
        // Note Off message
        const midiNoteNumber = data1;
        const velocity = data2;
        console.log(`MIDI: Note Off - Channel: ${channel}, Note: ${midiNoteNumber}, Velocity: ${velocity}`);
        if (onMidiNoteOffCallback) {
            try {
                onMidiNoteOffCallback(midiNoteNumber, velocity, channel);
            } catch (error) {
                console.error("Error in Note Off callback:", error);
            }
        } else {
            console.warn("No Note Off callback registered");
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
    } else {
        console.log(`MIDI: Unhandled message - Status: 0x${statusByte.toString(16)}, Data1: ${data1}, Data2: ${data2}`);
    }
}

/**
 * Attaches the `handleMidiMessage` listener to all connected MIDI input devices.
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
 * Success callback for `navigator.requestMIDIAccess()`.
 * @param {MIDIAccess} access - The MIDIAccess object from the browser.
 */
function onMIDISuccess(access) {
    midiAccess = access;
    console.log("MIDI access granted successfully.");
    
    // Log available MIDI devices
    console.log("Available MIDI inputs:");
    midiAccess.inputs.forEach(input => {
        console.log(`- ${input.name} (ID: ${input.id}, State: ${input.state})`);
    });
    
    console.log("Available MIDI outputs:");
    midiAccess.outputs.forEach(output => {
        console.log(`- ${output.name} (ID: ${output.id}, State: ${output.state})`);
    });
    
    attachMidiListeners();
    
    // Set up state change listener for hot-plugging devices
    midiAccess.onstatechange = (event) => {
        console.log(`MIDI device state change: ${event.port.name} (${event.port.type}) - ${event.port.state}`);
        if (event.port.type === 'input') {
            attachMidiListeners(); // Re-attach to handle newly connected devices
        }
    };
}

/**
 * Error callback for `navigator.requestMIDIAccess()`.
 * @param {DOMException} error - The error object.
 */
function onMIDIFailure(error) {
    console.error(`Failed to get MIDI access: ${error.name} - ${error.message}`);
    
    // Provide helpful error messages
    if (error.name === 'SecurityError') {
        console.error("This might be due to CORS restrictions or the page not being served over HTTPS.");
    } else if (error.name === 'NotSupportedError') {
        console.error("Web MIDI API is not supported in this browser.");
    }
}

/**
 * Initiates the request for MIDI access from the browser.
 */
export function initMidi() {
    if (navigator.requestMIDIAccess) {
        console.log("initMidi: Requesting Web MIDI API access...");
        navigator.requestMIDIAccess({ sysex: false }) // sysex: false is a good practice unless you need it
            .then(onMIDISuccess)
            .catch(onMIDIFailure);
    } else {
        console.warn("initMidi: Web MIDI API is not supported in this browser.");
        console.warn("Try using Chrome, Edge, or Opera. Firefox does not support Web MIDI API.");
    }
}

/**
 * Gets the current MIDI access object (for debugging)
 * @returns {MIDIAccess|null} The current MIDI access object or null if not initialized
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

// Fixed MIDI Controller Support
// This patch addresses the "Invalid argument(s) to setValueAtTime: null" error

// ===================================================================
// 1. Fixed handleMidiNoteOn function in playbackHelpers.js
// ===================================================================

/**
 * Handles incoming MIDI Note On messages.
 * @param {number} midiNoteNumber - The MIDI note number (0-127).
 * @param {number} velocity - The note velocity (1-127).
 * @param {number} channel - The MIDI channel (0-15).
 */
export function handleMidiNoteOn(midiNoteNumber, velocity, channel) {
  console.log(
    `MIDI Note On: Channel ${channel}, Note ${midiNoteNumber}, Velocity ${velocity}`
  );

  // Check if audio is ready before processing MIDI
  if (!pianoState.isUnlocked || !pianoState.samplerReady || !pianoState.sampler) {
    console.warn("MIDI input ignored - audio not ready. Please click the unlock button first.");
    return;
  }

  // Channel 9 (MIDI channel 10) is reserved for diatonic chords
  if (channel === 9) {
    // Map MIDI note number to a diatonic degree (1-7)
    // Assuming MIDI notes 36-42 correspond to degrees 1-7
    const degree = midiNoteNumber - 35;
    if (degree >= 1 && degree <= 7) {
      console.log(`Playing diatonic chord: degree ${degree}`);
      playDiatonicChord(degree, `midi_${midiNoteNumber}`, true);
    } else {
      console.warn(
        `Invalid diatonic degree: ${degree} (from MIDI note ${midiNoteNumber})`
      );
    }
    return;
  }

  // Handle standard note presses
  const keyEl = pianoState.noteEls[midiNoteNumber];
  if (keyEl) {
    // Check if note is already playing to avoid double-triggering
    if (keyEl.dataset.playing) {
      console.log(`Note ${midiNoteNumber} already playing, ignoring duplicate MIDI Note On`);
      return;
    }
    
    // Call startKey with correct parameters (only el and velocity)
    startKey(keyEl, velocity);
  } else {
    console.warn(`No key element found for MIDI note ${midiNoteNumber}`);
  }
}

/**
 * Enhanced MIDI Note Off handler - combines audio safety checks with full score writing functionality
 * @param {number} midiNoteNumber - The MIDI note number (0-127).
 * @param {number} velocity - The note velocity (1-127).
 * @param {number} channel - The MIDI channel (0-15).
 */
export function handleMidiNoteOff(midiNoteNumber, velocity, channel) {
  console.log(
    `MIDI Note Off: Channel ${channel}, Note ${midiNoteNumber}, Velocity ${velocity}`
  );

  // ===================================================================
  // SAFETY CHECKS (from enhanced version)
  // ===================================================================
  
  // Check if audio is ready before processing
  if (!pianoState.isUnlocked || !pianoState.samplerReady || !pianoState.sampler) {
    console.warn("MIDI input ignored - audio not ready.");
    return;
  }

  // ===================================================================
  // DIATONIC CHORD HANDLING (Channel 9)
  // ===================================================================
  
  if (channel === 9) { // Channel reserved for diatonic chords
    const chordKey = `midi_${midiNoteNumber}`;
    const activeChord = pianoState.activeDiatonicChords[chordKey];
    if (activeChord) {
      console.log(`Stopping diatonic chord: degree ${midiNoteNumber - 35}`);
      stopDiatonicChord(chordKey); // This handles score writing automatically
    } else {
      console.log(`No active diatonic chord found for MIDI note ${midiNoteNumber}`);
    }
    return;
  }

  // ===================================================================
  // INDIVIDUAL NOTE HANDLING (from your current version + enhanced cleanup)
  // ===================================================================
  
  const activeNote = pianoState.activeNotes[midiNoteNumber];
  const keyEl = pianoState.noteEls[midiNoteNumber];

  if (keyEl && activeNote) {
    // === AUDIO CLEANUP ===
    stopKey(keyEl); // This handles Tone.js audio + visual feedback + activeNotes cleanup
    
    // === SCORE WRITING LOGIC ===
    const noteInfo = NOTES_BY_MIDI[midiNoteNumber];
    if (!noteInfo) {
      console.warn(`No note info found for MIDI note ${midiNoteNumber}`);
      return;
    }

    // Calculate duration based on how long the note was held
    const heldTime = performance.now() - activeNote.startTime;
    let duration = 'q'; // Default to quarter note
    if (heldTime >= DURATION_THRESHOLDS.w) duration = 'w';
    else if (heldTime >= DURATION_THRESHOLDS['h.']) duration = 'h.';
    else if (heldTime >= DURATION_THRESHOLDS.h) duration = 'h';
    else if (heldTime >= DURATION_THRESHOLDS['q.']) duration = 'q.';

    // Get the correctly spelled note name using key-signature awareness
    // This automatically handles sharps vs flats based on pianoState.keySignatureType
    const noteInfoKeyAware = notesByMidiKeyAware(midiNoteNumber);
    const noteNameForScore = noteInfoKeyAware ? noteInfoKeyAware.name : noteInfo.name;
    
    // Determine clef based on note pitch
    const clef = noteInfo.midi < 60 ? 'bass' : 'treble';

    // Write to score
    writeNote({ 
      clef, 
      duration, 
      notes: [noteNameForScore], 
      chordName: noteNameForScore 
    });

    console.log(`MIDI Note Off processed: ${noteNameForScore} (${duration}) in ${clef} clef`);
    
  } else {
    // ===================================================================
    // ENHANCED ERROR HANDLING & CLEANUP (from enhanced version)
    // ===================================================================
    
    if (!keyEl) {
      console.warn(`No key element found for MIDI note ${midiNoteNumber}`);
    }
    
    if (!activeNote) {
      console.log(`No active note found for MIDI note ${midiNoteNumber}`);
      
      // Check if there's an orphaned note in our tracking that needs cleanup
      if (pianoState.activeNotes[midiNoteNumber]) {
        console.log(`Found orphaned active note ${midiNoteNumber}, cleaning up`);
        delete pianoState.activeNotes[midiNoteNumber];
        
        // Try to stop the audio directly using key-signature-aware note name
        const noteInfo = notesByMidiKeyAware(midiNoteNumber);
        if (noteInfo && pianoState.sampler) {
          try {
            pianoState.sampler.triggerRelease(noteInfo.name);
            console.log(`Released orphaned note ${noteInfo.name}`);
          } catch (error) {
            console.warn(`Error releasing orphaned note ${noteInfo.name}:`, error);
          }
        }
      }
    }
  }
}

// ===================================================================
// 2. Enhanced MIDI initialization with better error handling
// ===================================================================

/**
 * Enhanced MIDI initialization function
 */
export function initMidiWithErrorHandling() {
  // Check if Web MIDI is supported
  if (!navigator.requestMIDIAccess) {
    console.warn("Web MIDI API not supported in this browser. Try Chrome, Edge, or Opera.");
    return;
  }

  console.log("Initializing MIDI controller support...");

  // Set up MIDI callbacks
  setMidiCallbacks({
    onNoteOn: handleMidiNoteOn,
    onNoteOff: handleMidiNoteOff,
    onControlChange: (controller, value, channel) => {
      console.log(`MIDI CC: Controller ${controller}, Value ${value}, Channel ${channel}`);
      // Add your control change handling here if needed
    },
    onPitchBend: (value, channel) => {
      console.log(`MIDI Pitch Bend: Value ${value}, Channel ${channel}`);
      // Add your pitch bend handling here if needed
    }
  });

  // Initialize MIDI access
  initMidi();
}

// ===================================================================
// 3. Debugging and diagnostic functions
// ===================================================================

/**
 * Test MIDI controller functionality
 */
export function testMidiController() {
  console.log("=== MIDI Controller Test ===");
  
  // Check audio readiness
  console.log("Audio unlocked:", pianoState.isUnlocked);
  console.log("Sampler ready:", pianoState.samplerReady);
  console.log("Sampler exists:", !!pianoState.sampler);
  
  // Check MIDI access
  const midiAccess = getMidiAccess();
  if (midiAccess) {
    console.log("MIDI access granted");
    console.log("Input devices:", midiAccess.inputs.size);
    console.log("Output devices:", midiAccess.outputs.size);
    
    // List all devices
    listMidiDevices();
  } else {
    console.log("No MIDI access");
  }
  
  // Test a note programmatically
  if (pianoState.isUnlocked && pianoState.samplerReady) {
    console.log("Testing note C4 (MIDI 60)...");
    handleMidiNoteOn(60, 80, 0);
    setTimeout(() => {
      handleMidiNoteOff(60, 0, 0);
      console.log("Test complete");
    }, 1000);
  } else {
    console.log("Cannot test note - audio not ready");
  }
}

/**
 * Monitor MIDI controller state
 */
export function monitorMidiState() {
  const state = {
    audioReady: pianoState.isUnlocked && pianoState.samplerReady,
    midiAccess: !!getMidiAccess(),
    activeNotes: Object.keys(pianoState.activeNotes).length,
    activeDiatonicChords: Object.keys(pianoState.activeDiatonicChords).length,
    samplerConnected: !!pianoState.sampler
  };
  
  console.table(state);
  return state;
}

// ===================================================================
// 4. Integration helper for base.html
// ===================================================================

/**
 * Safe MIDI initialization that waits for audio to be ready
 */
export function initMidiWhenReady() {
  const checkAndInit = () => {
    if (pianoState.isUnlocked && pianoState.samplerReady) {
      console.log("Audio is ready, initializing MIDI...");
      initMidiWithErrorHandling();
      
      // Add to global debug object
      window.midiDebug = {
        test: testMidiController,
        monitor: monitorMidiState,
        listDevices: listMidiDevices,
        getMidiAccess: getMidiAccess
      };
      
      console.log("MIDI debug functions available at window.midiDebug");
    } else {
      console.log("Waiting for audio to be ready before initializing MIDI...");
      setTimeout(checkAndInit, 500);
    }
  };
  
  checkAndInit();
}