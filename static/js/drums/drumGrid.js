// static/js/drums/drumGrid.js
// Module for handling the drum pattern grid editor

import { drumsState } from "../core/appState.js";
import { addNoteToMeasure, getCurrentDrumMeasureIndex } from "./drumsScoreWriter.js";
import { scrollToMeasure } from "./drumRenderer.js";
import { triggerDrum, unlockAndExecuteDrum } from "./drumAudio.js";

// ===================================================================
// Constants
// ===================================================================

const GRID_INSTRUMENTS = [
    'bass-kick',
    'snare',
    'sidestick', // New instrument
    'hihat-closed', // Added hi hat
    'hihat-open', // Added open hat
    'clap',       // New instrument
    'cowbell',    // Added cowbell
    'bongo-low',  // New instrument
    'bongo-high', // New instrument
    'tom-low',
    'tom-mid',
    'tom-high',
    'crash',
    'ride'
];

const GRID_STEPS = 8; // Changed from 16 to 8
const STEP_DURATION = "8"; // Each step is now an 8th note

// ===================================================================
// Internal State
// ===================================================================

let gridState = {};
let isLooping = false;
let loopIntervalId = null;
let currentStep = 0;

// Initialize empty grid state
GRID_INSTRUMENTS.forEach(instrument => {
    gridState[instrument] = new Array(GRID_STEPS).fill(false);
});

// ===================================================================
// Grid UI Functions
// ===================================================================

/**
 * Toggles the pattern editor visibility
 */
function togglePatternEditor() {
    const content = document.getElementById('patternEditorContent');
    const toggleIcon = document.getElementById('patternToggleIcon');
    const toggleBtn = document.getElementById('patternEditorToggle');

    if (!content || !toggleIcon || !toggleBtn) return;

    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';

    if (isExpanded) {
        content.style.display = 'none';
        toggleIcon.textContent = '▶';
        toggleBtn.setAttribute('aria-expanded', 'false');
    } else {
        content.style.display = 'block';
        toggleIcon.textContent = '▼';
        toggleBtn.setAttribute('aria-expanded', 'true');
    }
}

/**
 * Updates grid state when a checkbox is toggled
 */
function handleCellToggle(checkbox) {
    const instrument = checkbox.dataset.instrument;
    const step = parseInt(checkbox.dataset.step) - 1; // Convert to 0-indexed

    gridState[instrument][step] = checkbox.checked;

    // Play sound feedback when toggling on
    if (checkbox.checked) {
        unlockAndExecuteDrum(() => {
            triggerDrum(instrument, true);
            setTimeout(() => triggerDrum(instrument, false), 100);
        });
    }
}

/**
 * Clears all pattern data
 */
function clearPattern() {
    // Clear the state
    GRID_INSTRUMENTS.forEach(instrument => {
        gridState[instrument] = new Array(GRID_STEPS).fill(false);
    });

    // Clear all checkboxes
    document.querySelectorAll('.pattern-grid__checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });

    console.log('🥁 Pattern cleared');
}

// ===================================================================
// Pattern to Notation Conversion
// ===================================================================

/**
 * Analyzes the grid pattern and converts it to notation.
 * Handles simultaneous notes as chords and uses a fixed duration for all notes.
 */
function analyzePattern() {
    const notationData = [];
    const stepDuration = "8"; // All notes and rests are 8th notes now
    let currentPosition = 0;

    while (currentPosition < GRID_STEPS) {
        const activeInstruments = getActiveInstrumentsAtPosition(currentPosition);

        if (activeInstruments.length > 0) {
            // This is a note (or a chord)
            // Group all active instruments at this position into one notation object
            notationData.push({
                drumInstruments: activeInstruments, // Use an array for a chord
                duration: stepDuration,
                isRest: false,
                position: currentPosition
            });
        } else {
            // This is a rest
            notationData.push({
                duration: stepDuration,
                isRest: true,
                position: currentPosition
            });
        }
        currentPosition++; // Move to the next step
    }

    return notationData;
}

/**
 * Gets all active instruments at a specific step position
 */
function getActiveInstrumentsAtPosition(position) {
    const active = [];
    GRID_INSTRUMENTS.forEach(instrument => {
        if (gridState[instrument][position]) {
            active.push(instrument);
        }
    });
    return active;
}

// ===================================================================
// Add to Score Function
// ===================================================================

/**
 * Converts the current pattern to notation and adds it to the score
 */
function addPatternToScore() {
    const notationData = analyzePattern();

    if (notationData.length === 0) {
        console.log('🥁 Pattern is empty, nothing to add');
        return;
    }

    console.log('🥁 Adding pattern to score:', notationData);

    notationData.forEach(noteData => {
        addNoteToMeasure(undefined, noteData);
    });

    const currentMeasureIdx = getCurrentDrumMeasureIndex();
    if (typeof scrollToMeasure === 'function') {
        scrollToMeasure(currentMeasureIdx);
    }
    
    // NOTE: Removed the call to `clearPattern()` so the pattern is not cleared
    //       after being added to the score.

    console.log('🥁 Pattern added to score');
}

// ===================================================================
// Loop Preview Functions
// ===================================================================

/**
 * Starts or stops the loop preview
 */
function toggleLoopPreview() {
    if (isLooping) {
        stopLoopPreview();
    } else {
        startLoopPreview();
    }
}

/**
 * Starts playing the pattern in a loop
 */
function startLoopPreview() {
    if (isLooping) return;

    const tempo = drumsState.tempo || 120;
    const eighthDuration = (60 / tempo) * 0.5 * 1000; // Duration of one 8th note in ms

    console.log('🥁 Starting loop preview at', tempo, 'BPM');

    unlockAndExecuteDrum(() => {
        isLooping = true;
        currentStep = 0;

        const btnText = document.getElementById('loopPreviewBtnText');
        if (btnText) btnText.textContent = 'Stop Loop';

        playStep();
        loopIntervalId = setInterval(playStep, eighthDuration);
    });
}

/**
 * Stops the loop preview
 */
function stopLoopPreview() {
    if (!isLooping) return;

    isLooping = false;

    if (loopIntervalId) {
        clearInterval(loopIntervalId);
        loopIntervalId = null;
    }

    const btnText = document.getElementById('loopPreviewBtnText');
    if (btnText) btnText.textContent = 'Loop Preview';

    clearPlaybackIndicator();

    console.log('🥁 Loop preview stopped');
}

/**
 * Plays the current step in the loop
 */
function playStep() {
    if (!isLooping) return;

    updatePlaybackIndicator(currentStep);

    const activeInstruments = getActiveInstrumentsAtPosition(currentStep);
    activeInstruments.forEach(instrument => {
        triggerDrum(instrument, true);
        setTimeout(() => triggerDrum(instrument, false), 50);
    });

    currentStep = (currentStep + 1) % GRID_STEPS;
}

/**
 * Updates the visual playback indicator
 */
function updatePlaybackIndicator(step) {
    document.querySelectorAll('.pattern-grid__playback-step').forEach(el => {
        el.classList.remove('active');
    });

    // The data-step attribute is 1-indexed in the HTML
    const currentStepEl = document.querySelector(`.pattern-grid__playback-step[data-step="${step + 1}"]`);
    if (currentStepEl) {
        currentStepEl.classList.add('active');
    }
}

/**
 * Clears the playback indicator
 */
function clearPlaybackIndicator() {
    document.querySelectorAll('.pattern-grid__playback-step').forEach(el => {
        el.classList.remove('active');
    });
}

// ===================================================================
// Initialization
// ===================================================================

/**
 * Initializes the drum grid module
 */
export function initializeDrumGrid() {
    console.log('🥁 Initializing drum grid editor');

    const toggleBtn = document.getElementById('patternEditorToggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', togglePatternEditor);
    }

    const clearBtn = document.getElementById('clearPatternBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearPattern);
    }

    const addBtn = document.getElementById('addPatternToScoreBtn');
    if (addBtn) {
        addBtn.addEventListener('click', addPatternToScore);
    }

    const loopBtn = document.getElementById('loopPreviewBtn');
    if (loopBtn) {
        loopBtn.addEventListener('click', toggleLoopPreview);
    }

    document.querySelectorAll('.pattern-grid__checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            handleCellToggle(e.target);
        });
    });

    window.addEventListener('beforeunload', () => {
        if (isLooping) {
            stopLoopPreview();
        }
    });

    console.log('🥁 Drum grid initialized');
}

// ===================================================================
// Export additional functions that might be needed
// ===================================================================

export {
    clearPattern,
    addPatternToScore,
    toggleLoopPreview,
    stopLoopPreview,
    gridState
};