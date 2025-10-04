// ioHelpers.js - File loading and UI interaction only

import { pianoState } from '../core/appState.js';
import { scoreManager } from '../score/scoreManager.js';
import { drawAll, setKeySignature } from '../score/scoreRenderer.js';
import { getMeasures, processAndSyncScore, setTempo, setTimeSignature } from '../score/scoreWriter.js';
import { updateUI } from '../ui/uiHelpers.js';

// Progress tracking UI elements
let progressModal = null;
let progressBar = null;
let progressText = null;
let progressDetails = null;

// Initialize file handlers with progress UI
export function initializeFileHandlers() {
    const fileInput = document.getElementById('load-file');
    const loadButton = document.getElementById('load-score-btn');
    const saveButton = document.getElementById('save-score-btn');
    const exportMidiButton = document.getElementById('export-midi-btn');
    const saveLocalButton = document.getElementById('save-local-btn');

    // Create progress modal for file processing
    createProgressModal();

    // Set up scoreManager event listeners
    setupScoreManagerListeners();

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

    console.log("File handlers initialized.");
}

// Create progress modal for file processing feedback
function createProgressModal() {
    // Only create if it doesn't already exist
    if (document.getElementById('file-progress-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'file-progress-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 32px;
        min-width: 400px;
        max-width: 500px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        text-align: center;
    `;

    content.innerHTML = `
        <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px 0; color: #333; font-size: 18px;">Processing Score</h3>
            <p id="progress-text" style="margin: 0; color: #666; font-size: 14px;">Preparing to load...</p>
        </div>
        
        <div style="margin-bottom: 20px;">
            <div style="width: 100%; height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden;">
                <div id="progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); transition: width 0.3s ease;"></div>
            </div>
            <div id="progress-details" style="margin-top: 8px; font-size: 12px; color: #888;"></div>
        </div>

        <div id="validation-summary" style="margin-bottom: 16px; font-size: 12px; color: #ff9800; display: none;">
            <strong>Issues Found:</strong>
            <div id="validation-details" style="margin-top: 4px; text-align: left; max-height: 100px; overflow-y: auto;"></div>
        </div>

        <button id="cancel-loading" style="
            background: #f44336;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            display: none;
        ">Cancel</button>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Store references
    progressModal = modal;
    progressBar = document.getElementById('progress-bar');
    progressText = document.getElementById('progress-text');
    progressDetails = document.getElementById('progress-details');
}

// Show progress modal
function showProgressModal() {
    if (progressModal) {
        progressModal.style.display = 'flex';
        updateProgress(0, 1, 'Starting...');
        hideValidationSummary();
    }
}

// Hide progress modal
function hideProgressModal() {
    if (progressModal) {
        progressModal.style.display = 'none';
        resetProgress();
    }
}

// Update progress display
function updateProgress(current, total, message, details = '') {
    if (!progressBar || !progressText || !progressDetails) return;

    const percentage = Math.round((current / total) * 100);
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = message;
    progressDetails.textContent = details ? `${details} (${current}/${total})` : `${current}/${total}`;
}

// Show validation issues in the modal
function showValidationIssues(issues) {
    const validationSummary = document.getElementById('validation-summary');
    const validationDetails = document.getElementById('validation-details');
    
    if (validationSummary && validationDetails && issues.length > 0) {
        validationDetails.innerHTML = issues.slice(0, 10).map(issue => 
            `<div style="margin-bottom: 2px;">• ${issue}</div>`
        ).join('');
        
        if (issues.length > 10) {
            validationDetails.innerHTML += `<div style="margin-top: 4px; font-style: italic;">... and ${issues.length - 10} more issues</div>`;
        }
        
        validationSummary.style.display = 'block';
    }
}

// Hide validation summary
function hideValidationSummary() {
    const validationSummary = document.getElementById('validation-summary');
    if (validationSummary) {
        validationSummary.style.display = 'none';
    }
}

// Reset progress display
function resetProgress() {
    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.textContent = 'Preparing to load...';
    if (progressDetails) progressDetails.textContent = '';
    hideValidationSummary();
}

// Set up scoreManager event listeners
function setupScoreManagerListeners() {
    // Listen for score processing events
    scoreManager.addEventListener('scoreProgress', (data) => {
        const details = data.message.includes('measures') ? 
            `Processing measure ${data.current} of ${data.total}` : '';
        updateProgress(data.current, data.total, data.message, details);
    });

    scoreManager.addEventListener('scoreProcessed', (score) => {
        console.log('Score processed successfully:', score.name);
        if (score.validationErrors && score.validationErrors.length > 0) {
            console.warn('Validation warnings:', score.validationErrors);
            showValidationIssues(score.validationErrors);
        }
    });

    scoreManager.addEventListener('scoreError', (errorData) => {
        console.error('Score processing error:', errorData.error);
        hideProgressModal();
    });
}

// File handler - determines file type and routes to appropriate loader
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
        hideProgressModal();
        
        // Show user-friendly error messages
        let errorMessage = 'Failed to load file';
        if (error.message.includes('Unexpected token')) {
            errorMessage = 'Invalid JSON file format';
        } else if (error.message.includes('measures')) {
            errorMessage = 'Invalid score structure - missing or invalid measures';
        } else if (error.message.includes('Web Workers')) {
            errorMessage = 'Your browser doesn\'t support large file processing';
        }
        
        alert(`${errorMessage}: ${error.message}`);
    }
}

// Load JSON file using scoreManager
async function loadJsonFile(file) {
    try {
        const text = await file.text();
        console.log(`Processing JSON file (${Math.round(text.length/1024)}KB)...`);
        
        showProgressModal();
        
        // Use scoreManager to process and validate the score
        const processedScore = await scoreManager.processScore(text, {
            fileName: file.name,
            skipBeatValidation: true,
            onProgress: (current, total, message) => {
                updateProgress(current, total, message);
            }
        });

        // Apply the processed score to the application state
        await applyProcessedScore(processedScore);
        
        // Keep modal open briefly if there were validation issues
        if (processedScore.validationErrors && processedScore.validationErrors.length > 0) {
            setTimeout(hideProgressModal, 3000); // Show issues for 3 seconds
        } else {
            hideProgressModal();
        }
        
    } catch (error) {
        // Handle JSON parsing errors specifically
        if (error instanceof SyntaxError) {
            throw new Error(`Unexpected token ${error.message.split(' ').slice(-1)[0]}`);
        }
        throw error;
    }
}

async function applyProcessedScore(processedScore) {
    try {
        console.log('Applying processed score:', processedScore.name);
        
        // CRITICAL: Set time signature and tempo BEFORE processing measures
        const timeSignature = processedScore.metadata.timeSignature;
        const tempo = processedScore.metadata.tempo;
        console.log(`Setting time signature to ${timeSignature.numerator}/${timeSignature.denominator} and tempo to ${tempo} before processing...`);
        
        if (!setTimeSignature(timeSignature.numerator, timeSignature.denominator)) {
            console.warn('Failed to set time signature, using default 4/4');
            setTimeSignature(4, 4);
        }

        if (!setTempo(tempo)) {
            console.warn('Failed to set tempo, using default 120 BPM');  // Fixed this line
            setTempo(120);
        }

        // Apply measures to scoreWriter (now with correct time signature set)
        if (processAndSyncScore(processedScore.measures)) {
            // Apply key signature
            const keySignature = processedScore.metadata.keySignature;
            
            if (setKeySignature(keySignature)) {
                // Update piano state with loaded metadata
                pianoState.tempo = processedScore.metadata.tempo;
                pianoState.instrument = processedScore.metadata.instrument;
                pianoState.midiChannel = processedScore.metadata.midiChannel;
                pianoState.isMinorChordMode = processedScore.metadata.isMinorChordMode;
                
                // Show appropriate success message
                const issueCount = processedScore.validationErrors?.length || 0;
                const message = issueCount > 0 
                    ? `Score loaded with ${issueCount} corrections (${processedScore.measures.length} measures, ${timeSignature.numerator}/${timeSignature.denominator})`
                    : `Score loaded successfully (${processedScore.measures.length} measures, ${timeSignature.numerator}/${timeSignature.denominator})`;
                
                updateUI(message, {
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
           
            // Re-render the score
            updateProgress(1, 1, 'Rendering score...');
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    try {
                        drawAll(getMeasures());
                        console.log(`Score rendered successfully with time signature ${timeSignature.numerator}/${timeSignature.denominator}`);
                        resolve();
                    } catch (renderError) {
                        console.error('Rendering error:', renderError);
                        alert('Score rendering failed. The file may contain complex data that couldn\'t be displayed properly.');
                        resolve();
                    }
                });
            });
            
            console.log("JSON file loaded successfully via scoreManager.");
        } else {
            throw new Error("Could not apply the processed score data to scoreWriter");
        }
        
    } catch (error) {
        console.error('Error applying processed score:', error);
        throw error;
    }
}

// Load MIDI file with scoreManager processing (simplified)
async function loadMidiFile(file) {
    const formData = new FormData();
    formData.append('midiFile', file);
    
    showProgressModal();
    updateProgress(0, 1, 'Converting MIDI file...', 'Server processing');
   
    try {
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

        const vexflowJsonFromServer = await response.json();
        console.log("MIDI conversion successful, processing through scoreManager...");
        
        updateProgress(0.3, 1, 'Processing converted data...', 'Running validation');

        // Server now returns proper VexFlow format - no transformation needed!
        // Just validate it has the required structure
        if (!vexflowJsonFromServer.measures || !Array.isArray(vexflowJsonFromServer.measures)) {
            throw new Error('Invalid server response - missing measures array');
        }

        // Process through scoreManager with splitting disabled for MIDI files
const processedScore = await scoreManager.processScore(JSON.stringify(vexflowJsonFromServer), {
    fileName: file.name.replace('.mid', '.json'),
    disableSplitting: true,  // Disable measure splitting for MIDI files
    onProgress: (current, total, message) => {
        const adjustedCurrent = 0.3 + (current / total) * 0.6;
        updateProgress(adjustedCurrent, 1, message, `Processing measure ${current} of ${total}`);
    }
});

        updateProgress(0.9, 1, 'Applying to score...', 'Almost done');

        // Apply the processed score
        await applyProcessedScore(processedScore);
        
        // Handle validation issues
        if (processedScore.validationErrors && processedScore.validationErrors.length > 0) {
            console.warn('MIDI validation warnings:', processedScore.validationErrors);
            setTimeout(hideProgressModal, 3000);
        } else {
            hideProgressModal();
        }
        
        console.log("MIDI file processed successfully through scoreManager.");
        
    } catch (error) {
        console.error('MIDI loading failed:', error);
        hideProgressModal();
        
        const userMessage = getUserFriendlyMidiError(error, file);
        alert(userMessage);
        
        return false;
    }
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

// Save current score to JSON file
export function saveScoreToFile() {
    const activeScore = scoreManager.getActiveScore();
    
    let scoreData;
    if (activeScore) {
        // Use scoreManager data if available
        scoreData = {
            keySignature: activeScore.metadata.keySignature,
            tempo: activeScore.metadata.tempo,
            timeSignature: activeScore.metadata.timeSignature,
            instrument: activeScore.metadata.instrument,
            midiChannel: activeScore.metadata.midiChannel,
            isMinorChordMode: activeScore.metadata.isMinorChordMode,
            measures: activeScore.measures
        };
    } else {
        // Fallback to current pianoState
        scoreData = {
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
    }

    const dataStr = JSON.stringify(scoreData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
   
    const a = document.createElement('a');
    a.href = url;
    a.download = activeScore ? `${activeScore.name.replace('.json', '')}.json` : 'my-song.json';
    a.click();
   
    URL.revokeObjectURL(url);
    console.log("Score saved successfully.");
}

// Export MIDI
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

// Save to localStorage
export function saveToLocalStorage() {
    const activeScore = scoreManager.getActiveScore();
    
    let scoreData;
    if (activeScore) {
        scoreData = {
            measures: activeScore.measures,
            keySignature: activeScore.metadata.keySignature,
            isMinorChordMode: activeScore.metadata.isMinorChordMode,
            timeSignature: activeScore.metadata.timeSignature
        };
    } else {
        scoreData = {
            measures: getMeasures(),
            keySignature: pianoState.keySignature,
            isMinorChordMode: pianoState.isMinorChordMode,
            timeSignature: {
                numerator: pianoState.timeSignature.numerator,
                denominator: pianoState.timeSignature.denominator
            }
        };
    }
    
    localStorage.setItem('autosavedScore', JSON.stringify(scoreData));
    console.log('Score autosaved to localStorage');
}

// Utility functions for external access
export function getProcessingStatus() {
    return scoreManager.getProcessingStatus();
}

export function getScoreManager() {
    return scoreManager;
}