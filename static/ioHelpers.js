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

        // Debug: Log the data structure
        console.log("Raw server response:", jsonDataFromServer);

        // The server now returns data with proper VexFlow note names already
        // No need for MIDI number conversion - use the data directly
        if (processAndSyncScore(jsonDataFromServer)) {
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
        tempo: pianoState.tempo,
        timeSignature: {
            numerator: pianoState.timeSignature.numerator,
            denominator: pianoState.timeSignature.denominator
        },
        instrument: pianoState.instrument,
        midiChannel: pianoState.midiChannel,
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

    console.log(`Score saved successfully with key signature: ${pianoState.keySignature}, tempo: ${pianoState.tempo}, time signature: ${pianoState.timeSignature.numerator}/${pianoState.timeSignature.denominator}`);
}

/**
 * Converts the current score to VexFlow JSON format
 * and sends it to the /convert-to-midi endpoint to generate a MIDI file.
 */
export function exportMidi() {
    console.log("Starting MIDI export...");

    // Transform the application's score data into VexFlow JSON format
    const vexflowJson = {
        keySignature: "C",  // You might want to make this configurable
        tempo: 120,         // You might want to make this configurable
        timeSignature: {
            numerator: 4,
            denominator: 4
        },
        instrument: "piano",
        midiChannel: "0",
        measures: getMeasures().map((measure, measureIndex) => {
            return measure.map((note, noteIndex) => {
                return {
                    id: `note-${measureIndex}-${noteIndex}`,
                    name: note.name,  // VexFlow format: "C4" or "(C4 E4 G4)"
                    clef: note.clef,
                    duration: note.duration,
                    measure: measureIndex,
                    isRest: note.isRest
                };
            });
        })
    };

    fetch('/convert-to-midi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vexflowJson)
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
    // When "Load Score" is clicked, it programmatically clicks the hidden file input.
    document.getElementById('load-score-btn')?.addEventListener('click', (e) => {
        document.getElementById('file-loader-input')?.click();
        document.getElementById('instrument')?.focus();
    });

    // When a file is selected in the input, the main handler runs.
    document.getElementById('file-loader-input')?.addEventListener('change', (e) => {
        handleFileLoad(e);
        document.getElementById('instrument')?.focus();
    });

    // Attach listeners to the other buttons.
    document.getElementById('save-score-btn')?.addEventListener('click', (e) => {
        saveScoreToFile(e);
        document.getElementById('instrument')?.focus();
    });
    
    console.log("File handlers initialized.");
}

export function saveToLocalStorage() {
    const scoreData = {
        measures: getMeasures(), // Use public API instead of internal measuresData
        keySignature: pianoState.keySignature,
        isMinorChordMode: pianoState.isMinorChordMode
    };
    localStorage.setItem('autosavedScore', JSON.stringify(scoreData)); // You'll also need the AUTOSAVE_KEY constant
    console.log('saveToLocalStorage: Saved complete score state to localStorage');
}