// ioHelpers.js
// This module handles saving, loading, and MIDI I/O for the score.
// It is designed to be initialized once by the main application script.
import { pianoState } from './appState.js';
import { getMeasures, processAndSyncScore } from './scoreWriter.js';
import { NOTES_BY_MIDI, NOTES_BY_NAME, KEY_SIGNATURES } from './note-data.js';
import { drawAll, setKeySignature } from './scoreRenderer.js';
import { updateUI } from './uiHelpers.js';

// --- Core Logic Functions (not exported) ---

/**
 * Handles the file input change event, determines the file type,
 * and calls the appropriate loader function.
 * @param {Event} event The file input change event.
 */
function handleFileLoad(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (fileExtension === 'json') {
        loadScoreFromJson(file);
    } else if (fileExtension === 'mid' || fileExtension === 'midi') {
        loadScoreFromMidi(file);
    } else {
        alert(`Unsupported file type: .${fileExtension}\nPlease select a .json or .mid file.`);
    }
    // Reset the input so the user can load the same file again
    event.target.value = '';
}

/**
 * Converts an array of MIDI numbers to a VexFlow-compatible note name string.
 * @param {number[]} midiNotes - Array of MIDI numbers, e.g., [60] or [48, 52, 55]
 * @returns {string} A VexFlow name, e.g., "C4" or "(C3 E3 G3)"
 */
function convertMidiToName(midiNotes) {
    if (!midiNotes || midiNotes.length === 0) {
        return "";
    }

    const noteNames = midiNotes
        .map(midiNum => NOTES_BY_MIDI[midiNum]?.name) // Safely get the name
        .filter(name => name); // Filter out any undefined names

    if (noteNames.length === 1) {
        return noteNames[0];
    } else {
        // Format for VexFlow chords
        return `(${noteNames.join(' ')})`;
    }
}

/**
 * Sends a MIDI file to the backend for conversion to JSON,
 * then updates the score with the result.
 * @param {File} file The MIDI file to load.
 */
async function loadScoreFromMidi(file) {
    const formData = new FormData();
    formData.append('midiFile', file);
    console.log("Uploading MIDI file for conversion...");
    try {
        const response = await fetch('/convert-to-json', { method: 'POST', body: formData });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server responded with status: ${response.status}`);
        }
        const jsonDataFromServer = await response.json();

        // Convert MIDI numbers from server to note names for VexFlow
        const processedData = jsonDataFromServer.map(measure => {
            return measure.map(note => {
                if (note.isRest) {
                    return note;
                }
                note.name = convertMidiToName(note.midiNotes);
                return note;
            });
        });
        
        // Use the processed data to update the score
        if (processAndSyncScore(processedData)) {
            drawAll(getMeasures());
            console.log("Score successfully loaded from MIDI file.");
        } else {
            alert("Error: Could not process the converted MIDI data.");
        }
    } catch (err) {
        alert(`Failed to load MIDI file: ${err.message}`);
        console.error("MIDI loading error:", err);
    }
}

function loadScoreFromJson(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const loadedData = JSON.parse(e.target.result);
            const measuresData = loadedData.measures || loadedData;

            if (processAndSyncScore(measuresData)) {
                const keySignatureToLoad = loadedData.keySignature || 'C';

                if (setKeySignature(keySignatureToLoad)) {
                    // Clean, simple call - no DOM knowledge needed!
                    updateUI(`Score loaded in the key of ${pianoState.keySignature}`, {
                        updateKeySignature: true,
                        regenerateChords: true
                    });
                } else {
                    setKeySignature('C');
                    updateUI(`Score loaded with invalid key signature, defaulted to C major`, {
                        updateKeySignature: true,
                        regenerateChords: true
                    });
                }
            } else {
                updateUI("Error: Could not load score data");
            }
        } catch (err) {
            updateUI("Error reading JSON file");
            console.error("File loading error:", err);
        }
    };
    reader.readAsText(file);
}


/**
 * Saves the current score data to a .json file.
 */
function saveScoreToFile() {
    console.log("Saving score to JSON file...");

    // Create the data object in the format expected by loadScoreFromJson
    const scoreData = {
        keySignature: pianoState.keySignature,
        measures: getMeasures()
    };

    const data = JSON.stringify(scoreData, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-song.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`Score saved successfully with key signature: ${pianoState.keySignature}`);
}

/**
 * Converts the current score to the backend's expected JSON format
 * and sends it to the /convert-to-midi endpoint to generate a MIDI file.
 */
function exportMidi() {
    console.log("Starting MIDI export...");

    // Helper function to parse VexFlow note names (including chords) into MIDI numbers.
    function parseNotesToMidi(noteName) {
        if (noteName.startsWith('(') && noteName.endsWith(')')) {
            const noteNames = noteName.slice(1, -1).split(' ').map(name => name.trim());
            return noteNames.map(name => NOTES_BY_NAME[name]).filter(midi => midi !== undefined);
        } else {
            const midiNumber = NOTES_BY_NAME[noteName];
            return midiNumber !== undefined ? [midiNumber] : [];
        }
    }

    // Transform the application's score data into the format the backend expects.
    const midiData = getMeasures().map(measure => {
        return measure.map(note => {
            if (note.isRest) {
                return {
                    midiNotes: [],
                    clef: note.clef,
                    duration: note.duration,
                    isRest: true,
                    velocity: note.velocity || 80
                };
            } else {
                const midiNotes = parseNotesToMidi(note.name);
                if (midiNotes.length === 0) {
                    console.warn(`Could not find MIDI number for note: ${note.name}`);
                    return null;
                }
                return {
                    midiNotes: midiNotes,
                    clef: note.clef,
                    duration: note.duration,
                    isRest: false,
                    velocity: note.velocity || 80
                };
            }
        }).filter(note => note !== null);
    });

    fetch('/convert-to-midi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(midiData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'my-song.mid';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        console.log("MIDI file downloaded successfully!");
    })
    .catch(error => {
        console.error('Error exporting MIDI file:', error);
        alert('Failed to export MIDI file. Please check the console for details.');
    });
}


// --- Initializer Function (The only thing you need to export) ---

/**
 * Finds the file control buttons and attaches the correct event listeners.
 * Call this function once from your main application script.
 */
export function initializeFileHandlers() {
    const loadBtn = document.getElementById('load-score-btn');
    const saveBtn = document.getElementById('save-score-btn');
    const exportBtn = document.getElementById('export-midi-btn');
    const fileInput = document.getElementById('file-loader-input');

    if (loadBtn && saveBtn && exportBtn && fileInput) {
        // When "Load Score" is clicked, it programmatically clicks the hidden file input.
        loadBtn.addEventListener('click', () => {
            fileInput.click();
        });

        // When a file is selected in the input, the main handler runs.
        fileInput.addEventListener('change', handleFileLoad);

        // Attach listeners to the other buttons.
        saveBtn.addEventListener('click', saveScoreToFile);
        exportBtn.addEventListener('click', exportMidi);
        
        console.log("File handlers initialized.");
    } else {
        console.warn("Could not find all file handler elements. Ensure the _filehandler.html partial is included in your page.");
    }
}