// drumIOHelpers.js - File loading and UI interaction only

import { drumsState } from '../core/appState.js';
import { getDrumMeasures, processAndSyncScore as processAndSyncDrumScore, setTempo, setTimeSignature } from './drumsScoreWriter.js';

// Initialize file handlers
export function initializeDrumFileHandlers() {
    const fileInput = document.getElementById('load-drum-file');
    const loadButton = document.getElementById('load-drum-score-btn');
    const saveButton = document.getElementById('save-drum-score-btn');
    const exportMidiButton = document.getElementById('export-drum-midi-btn');

    // Load button opens file dialog
    loadButton?.addEventListener('click', () => {
        fileInput?.click();
    });

    // File input handles file selection
    fileInput?.addEventListener('change', async () => {
        const [file] = fileInput.files;
       
        if (file) {
            console.log(`Loading drum file: ${file.name}`);
            await handleDrumFile(file);
        }
    });

    // Save button
    saveButton?.addEventListener('click', () => {
        saveDrumScoreToFile();
    });

    // Export MIDI button
    exportMidiButton?.addEventListener('click', () => {
        exportDrumToMidi();
    });


}

// File handler - determines file type and routes to appropriate loader
export async function handleDrumFile(file) {
    const fileExtension = file.name.split('.').pop().toLowerCase();

    try {
        if (fileExtension === 'json') {
            await loadDrumJsonFile(file);
        } else if (fileExtension === 'mid' || fileExtension === 'midi') {
            await loadDrumMidiFile(file);
        } else {
            alert(`Unsupported file type: .${fileExtension}\nPlease select a .json or .mid file.`);
        }
    } catch (error) {
        console.error('Error loading drum file:', error);
        
        // Show user-friendly error messages
        let errorMessage = 'Failed to load drum file';
        if (error.message.includes('Unexpected token')) {
            errorMessage = 'Invalid JSON file format';
        } else if (error.message.includes('measures')) {
            errorMessage = 'Invalid drum score structure - missing or invalid measures';
        }
        
        alert(`${errorMessage}: ${error.message}`);
    }
}

async function applyProcessedDrumScore(processedScore) {
    try {
        console.log('Applying processed drum score:', processedScore.name || 'Unnamed');
        
        // Set time signature and tempo BEFORE processing measures
        const timeSignature = processedScore.timeSignature || { numerator: 4, denominator: 4 };
        const tempo = processedScore.tempo || 120;
        console.log(`Setting time signature to ${timeSignature.numerator}/${timeSignature.denominator} and tempo to ${tempo}`);
        
        if (!setTimeSignature(timeSignature.numerator, timeSignature.denominator)) {
            console.warn('⚠️ Failed to set time signature, using default 4/4');
            setTimeSignature(4, 4);
        }

        if (!setTempo(tempo)) {
            console.warn('⚠️ Failed to set tempo, using default 120 BPM');
            setTempo(120);
        }

        // Apply measures to drum score writer
        if (processAndSyncDrumScore(processedScore.measures)) {
            // Update drum state with loaded metadata
            drumsState.tempo = tempo;
            drumsState.timeSignature = timeSignature;
            drumsState.keySignature = processedScore.keySignature || 'C';
            document.dispatchEvent(new CustomEvent('drumScoreLoaded'));
            
        } else {
            throw new Error("Could not apply the processed drum score data");
        }
        
    } catch (error) {
        console.error('❌ Error applying processed drum score:', error);
        throw error;
    }
}


// Load JSON file directly (no scoreManager)
async function loadDrumJsonFile(file) {
    try {
        const text = await file.text();
        console.log(`Processing drum JSON file (${Math.round(text.length/1024)}KB)...`);
        
        const drumScore = JSON.parse(text);
        
        // Validate basic structure
        if (!drumScore.measures || !Array.isArray(drumScore.measures)) {
            throw new Error('Invalid drum score - missing measures array');
        }

        // Apply the drum score
        await applyProcessedDrumScore(drumScore);
        
        // Trigger re-render in drums.html (the calling code should handle this)
        console.log("Drum JSON file loaded successfully.");
        
    } catch (error) {
        // Handle JSON parsing errors specifically
        if (error instanceof SyntaxError) {
            throw new Error(`Invalid JSON format: ${error.message}`);
        }
        throw error;
    }
}


// Load MIDI file and convert to drum score
async function loadDrumMidiFile(file) {
    const formData = new FormData();
    formData.append('midiFile', file);
   
    try {
        console.log('Converting MIDI file to drum score...');
        
        const response = await fetch('/convert-to-json', {
            method: 'POST',
            body: formData
        });
       
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            if (response.status === 500) {
                console.error('Server error during MIDI conversion:', errorData);
                throw new Error('The MIDI file could not be processed. It may be too complex or corrupted.');
            } else if (response.status === 413) {
                throw new Error('The MIDI file is too large to process.');
            } else if (response.status === 400) {
                throw new Error(errorData.error || 'The MIDI file format is not supported.');
            }
            
            throw new Error(errorData.error || `Server error (${response.status}). Please try again.`);
        }

        const convertedData = await response.json();
        console.log("MIDI conversion successful, extracting drum data...", convertedData);

        // Validate structure
        if (!convertedData.measures || !Array.isArray(convertedData.measures)) {
            throw new Error('Invalid server response - missing measures array');
        }

        // Filter and convert to drum-only measures with proper formatting
        const drumScore = extractDrumDataFromMidi(convertedData);

        // Apply the drum score
        await applyProcessedDrumScore(drumScore);
        
        console.log("MIDI file loaded as drum score successfully.");
        
        // Dispatch event to trigger re-render
        document.dispatchEvent(new CustomEvent('drumScoreLoaded'));
        
    } catch (error) {
        console.error('MIDI loading failed:', error);
        
        const userMessage = getUserFriendlyMidiError(error, file);
        alert(userMessage);
        
        throw error;
    }
}

// Helper function to extract drum data from MIDI conversion
function extractDrumDataFromMidi(midiData) {
    // Reverse mapping: MIDI note number to drum instrument
    const MIDI_NOTE_TO_DRUM = {
        36: 'box-kick',
        37: 'sidestick',
        38: 'snare',
        39: 'clap',
        41: 'tom-low',
        42: 'hihat-closed',
        46: 'hihat-open',
        47: 'tom-mid',
        49: 'crash',
        50: 'tom-high',
        51: 'ride',
        56: 'cowbell',
        60: 'bongo-high',
        61: 'bongo-low'
    };
    
    const drumMeasures = [];
    
    for (const measure of midiData.measures) {
        const drumNotes = [];
        
        for (const note of measure) {
            // Check if this is a drum note
            if (!isDrumNote(note)) continue;
            
            // Convert note name (e.g., "C2") to MIDI number
            const midiNumber = convertNoteNameToMidiNumber(note.name);
            
            // Get drum instrument from MIDI number
            const drumInstrument = MIDI_NOTE_TO_DRUM[midiNumber];
            
            if (!drumInstrument) {
                console.warn(`Unknown drum MIDI note: ${note.name} (${midiNumber}), skipping`);
                continue;
            }
            
            // Convert to VexFlow key format with slash (e.g., "F/4")
            const key = convertNoteNameToVexFlowKey(note.name);
            
            // Create drum note in the format your renderer expects
            const drumNote = {
                id: note.id || `imported-${Math.random().toString(36).substr(2, 9)}`,
                drumInstrument: drumInstrument,
                duration: note.duration,
                isRest: note.isRest || false,
                measure: note.measure,
                keys: [key],
                notehead: 'n',
                stemDirection: -1,
                modifiers: []
            };
            
            drumNotes.push(drumNote);
        }
        
        if (drumNotes.length > 0) {
            drumMeasures.push(drumNotes);
        }
    }
    
    return {
        measures: drumMeasures,
        tempo: midiData.tempo || 120,
        timeSignature: midiData.timeSignature || { numerator: 4, denominator: 4 },
        keySignature: midiData.keySignature || 'C',
        name: midiData.name || 'Imported MIDI Drums'
    };
}

// Helper to convert note name like "C2" to MIDI number
function convertNoteNameToMidiNumber(noteName) {
    const noteMap = {
        'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
        'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    
    // Parse note name (e.g., "C2", "F#3")
    const match = noteName.match(/^([A-G][#b]?)(-?\d+)$/);
    if (!match) return null;
    
    const [, note, octaveStr] = match;
    const octave = parseInt(octaveStr);
    
    const midiNumber = (octave + 1) * 12 + noteMap[note];
    return midiNumber;
}

// Helper to convert note name like "C2" to VexFlow key format like "C/2"
function convertNoteNameToVexFlowKey(noteName) {
    // Convert "C2" -> "C/2", "F#3" -> "F#/3", etc.
    const match = noteName.match(/^([A-G][#b]?)(-?\d+)$/);
    if (!match) return "F/4"; // Default fallback
    
    const [, note, octave] = match;
    return `${note}/${octave}`;
}

// Helper to identify if a note is a drum note based on MIDI note number
function isDrumNote(note) {
    // MIDI channel 10 (index 9) is percussion
    // Or if note name is in typical drum range (MIDI 35-81)
    if (note.midiChannel === 9 || note.midiChannel === '9') {
        return true;
    }
    
    // Check if note.name corresponds to drum MIDI notes (C2-A5 range)
    const drumNotePattern = /^[A-G][#b]?[2-5]$/;
    return drumNotePattern.test(note.name);
}

// Generate user-friendly error messages for MIDI
function getUserFriendlyMidiError(error, file) {
    const fileName = file ? file.name : 'MIDI file';
    const fileSize = file ? `(${Math.round(file.size / 1024)}KB)` : '';
    
    let message = `Failed to load ${fileName} ${fileSize}\n\n`;
    
    if (error.message.includes('too many ticks') || error.message.includes('Too many ticks')) {
        message += 'This MIDI file has too many musical elements in individual measures.\n\n';
        message += 'This often happens with:\n';
        message += '• MIDI files with many simultaneous notes\n';
        message += '• Very complex orchestral arrangements\n';
        message += '• Files with extremely short note values\n\n';
        message += 'Try using a simpler MIDI file or one with fewer simultaneous parts.';
        
    } else if (error.message.includes('validation') || error.message.includes('measures')) {
        message += 'The MIDI file structure is too complex for the current system.\n\n';
        message += 'Try:\n';
        message += '• Using a MIDI with simpler notation\n';
        message += '• Reducing the number of tracks before export\n';
        message += '• Using a shorter musical piece';
        
    } else if (error.message.includes('too large')) {
        message += 'This MIDI file is too large to process.\n\n';
        message += 'Try using a smaller MIDI file (under 5MB).';
        
    } else if (error.message.includes('format') || error.message.includes('corrupted')) {
        message += 'The MIDI file appears to be corrupted or in an unsupported format.\n\n';
        message += 'Try:\n';
        message += '• Re-exporting the MIDI from your music software\n';
        message += '• Using Standard MIDI File format\n';
        message += '• Checking the file isn\'t corrupted';
        
    } else if (error.message.includes('Server') || error.message.includes('server')) {
        message += 'There was a server error processing the MIDI file.\n\n';
        message += 'Please try again in a moment, or try a different MIDI file.';
        
    } else {
        message += `Error: ${error.message}\n\n`;
        message += 'The MIDI file could not be loaded. Please try a different file.';
    }
    
    return message;
}

// Save current drum score to JSON file
export function saveDrumScoreToFile() {
    const scoreData = {
        tempo: drumsState.tempo,
        timeSignature: {
            numerator: drumsState.timeSignature.numerator,
            denominator: drumsState.timeSignature.denominator
        },
        keySignature: drumsState.keySignature || 'C',
        instrument: 'drums',
        midiChannel: 9, // Standard MIDI percussion channel
        measures: getDrumMeasures()
    };

    const dataStr = JSON.stringify(scoreData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
   
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drum-score.json';
    a.click();
   
    URL.revokeObjectURL(url);
    console.log("Drum score saved successfully.");
}

// Export drum score to MIDI
export function exportDrumToMidi() {
    // Map drum instruments to GM MIDI note numbers (Channel 10 percussion)
    const DRUM_TO_MIDI_NOTE = {
        'box-kick': 36,      // Bass Drum 1
        'snare': 38,         // Acoustic Snare
        'tom-low': 41,       // Low Floor Tom
        'tom-mid': 47,       // Low-Mid Tom
        'tom-high': 50,      // High Tom
        'sidestick': 37,     // Side Stick
        'hihat-closed': 42,  // Closed Hi-Hat
        'hihat-open': 46,    // Open Hi-Hat
        'crash': 49,         // Crash Cymbal 1
        'ride': 51,          // Ride Cymbal 1
        'bongo-low': 61,     // Low Bongo
        'bongo-high': 60,    // High Bongo
        'clap': 39,          // Hand Clap
        'cowbell': 56        // Cowbell
    };

    // Convert drum measures to MIDI-compatible format
    const drumMidiData = {
        tempo: drumsState.tempo,
        timeSignature: {
            numerator: drumsState.timeSignature.numerator,
            denominator: drumsState.timeSignature.denominator
        },
        keySignature: drumsState.keySignature || 'C',
        instrument: 'drums',
        midiChannel: 9, // MIDI channel 10 (0-indexed as 9) for percussion
        measures: getDrumMeasures().map((measure, measureIndex) => {
            return measure.map((note, noteIndex) => {
                // Convert drumInstrument to MIDI note name
                const midiNoteNumber = DRUM_TO_MIDI_NOTE[note.drumInstrument] || 36;
                const noteName = convertMidiNumberToNoteName(midiNoteNumber);
                
                // Return ONLY the fields the server expects
                return {
                    id: `drum-${measureIndex}-${noteIndex}`,
                    name: noteName,
                    clef: 'bass', // Change from 'percussion' to 'treble'
                    duration: note.duration,
                    measure: measureIndex,
                    isRest: note.isRest
                    // Remove drumInstrument field - server doesn't expect it
                };
            });
        })
    };

    console.log('Exporting drum score to MIDI...', drumMidiData);

    fetch('/convert-to-midi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(drumMidiData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to export drum MIDI file.');
        }
        return response.blob();
    })
    .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'drum-score.mid';
        a.click();
        URL.revokeObjectURL(url);
        console.log("Drum MIDI exported successfully.");
    })
    .catch(error => {
        console.error('MIDI export failed:', error);
        alert('Failed to export drum MIDI file. ' + error.message);
    });
}

// Helper function to convert MIDI note number to note name
function convertMidiNumberToNoteName(midiNumber) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNumber / 12) - 1;
    const noteName = noteNames[midiNumber % 12];
    return `${noteName}${octave}`;
}