// midi-controller.js
// This file handles all Web MIDI API interactions, including requesting access,
// listening for MIDI input messages, and dispatching them to registered callbacks.

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