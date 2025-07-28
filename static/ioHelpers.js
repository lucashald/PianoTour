// ioHelpers.js - Fixed file loading implementation

import { pianoState } from './appState.js';
import { getMeasures, processAndSyncScore } from './scoreWriter.js';
import { drawAll, setKeySignature } from './scoreRenderer.js';
import { updateUI } from './uiHelpers.js';

// Simple file handling - no bells and whistles
export function initializeFileHandlers() {
    const fileInput = document.getElementById('load-file');
    const loadButton = document.getElementById('load-score-btn');
    const saveButton = document.getElementById('save-score-btn');
    const exportMidiButton = document.getElementById('export-midi-btn');
    const saveLocalButton = document.getElementById('save-local-btn');

    // Load button opens file dialog
    loadButton?.addEventListener('click', () => {
        fileInput?.click();
    });

    // File input handles file selection
    fileInput?.addEventListener('change', async () => {
        const [file] = fileInput.files;
       
        if (file) {
            console.log(`Loading file: ${file.name}`);
            await handleFile(file);
        }
    });

    // Save button
    saveButton?.addEventListener('click', () => {
        saveScoreToFile();
    });

    // Export MIDI button
    exportMidiButton?.addEventListener('click', () => {
        exportMidi();
    });

    // Save to localStorage button
    saveLocalButton?.addEventListener('click', () => {
        saveToLocalStorage();
    });

    console.log("Minimal file handlers initialized.");
}

// Handle the selected file
export async function handleFile(file) {
    const fileExtension = file.name.split('.').pop().toLowerCase();

    try {
        if (fileExtension === 'json') {
            await loadJsonFile(file);
        } else if (fileExtension === 'mid' || fileExtension === 'midi') {
            await loadMidiFile(file);
        } else {
            alert(`Unsupported file type: .${fileExtension}\nPlease select a .json or .mid file.`);
        }
    } catch (error) {
        console.error('Error loading file:', error);
        alert(`Failed to load file: ${error.message}`);
    }
}

// Load JSON file
async function loadJsonFile(file) {
    try {
        const text = await file.text();
        const loadedData = JSON.parse(text);
        const measuresData = loadedData.measures || loadedData;

        if (processAndSyncScore(measuresData)) {
            const keySignatureToLoad = loadedData.keySignature || 'C';
           
            if (setKeySignature(keySignatureToLoad)) {
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
           
            drawAll(getMeasures());
            console.log("JSON file loaded successfully.");
        } else {
            throw new Error("Could not process the score data");
        }
    } catch (error) {
        // Handle JSON parsing errors specifically
        if (error instanceof SyntaxError) {
            throw new Error(`Unexpected token ${error.message.split(' ').slice(-1)[0]}`);
        }
        throw error;
    }
}

// Load MIDI file
async function loadMidiFile(file) {
    const formData = new FormData();
    formData.append('midiFile', file);
   
    try {
        const response = await fetch('/convert-to-json', {
            method: 'POST',
            body: formData
        });
       
        if (!response.ok) {
            // Handle different types of server errors
            if (response.status === 500) {
                throw new Error(`Server error: ${response.status}`);
            }
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const jsonDataFromServer = await response.json();
        console.log("Raw server response:", jsonDataFromServer);

        if (processAndSyncScore(jsonDataFromServer)) {
            drawAll(getMeasures());
            console.log("MIDI file loaded successfully.");
        } else {
            throw new Error("Could not process the converted MIDI data");
        }
    } catch (error) {
        // Handle fetch errors (network issues, etc.)
        if (error.message.includes('fetch')) {
            throw new Error('Server exploded');
        }
        throw error;
    }
}

// Save current score to JSON file
export function saveScoreToFile() {
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

    const dataStr = JSON.stringify(scoreData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
   
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-song.json';
    a.click();
   
    URL.revokeObjectURL(url);
    console.log("Score saved successfully.");
}

// Export MIDI (keeping this simple too)
export function exportMidi() {
    const vexflowJson = {
        keySignature: pianoState.keySignature,
        tempo: pianoState.tempo,
        timeSignature: {
            numerator: pianoState.timeSignature.numerator,
            denominator: pianoState.timeSignature.denominator
        },
        instrument: pianoState.instrument,
        midiChannel: pianoState.midiChannel,
        measures: getMeasures().map((measure, measureIndex) => {
            return measure.map((note, noteIndex) => {
                return {
                    id: `note-${measureIndex}-${noteIndex}`,
                    name: note.name,
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
            throw new Error('Failed to export MIDI file.');
        }
        return response.blob();
    })
    .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'my-song.mid';
        a.click();
        URL.revokeObjectURL(url);
        console.log("MIDI exported successfully.");
    })
    .catch(error => {
        console.error('MIDI export failed:', error);
        alert('Failed to export MIDI file.');
    });
}

// Simple localStorage save
export function saveToLocalStorage() {
    const scoreData = {
        measures: getMeasures(),
        keySignature: pianoState.keySignature,
        isMinorChordMode: pianoState.isMinorChordMode
    };
    localStorage.setItem('autosavedScore', JSON.stringify(scoreData));
    console.log('Score autosaved to localStorage');
}