// uiHelpers.js
// This module contains general UI manipulation functions, like display updates and chord button generation.

// ===================================================================
// Imports
// ===================================================================

import { pianoState } from '../core/appState.js';
import audioManager from '../core/audioManager.js';
import { CHORD_DEFINITIONS, CHORD_GROUPS, DURATION_THRESHOLDS, getKeySignature } from '../core/note-data.js';
import { trigger } from '../instrument/playbackHelpers.js';
import { setKeySignature } from '../score/scoreRenderer.js';
import { writeNote } from '../score/scoreWriter.js';

// ===================================================================
// UI Update Functions
// ===================================================================

/**
 * Updates the text content of the "now playing" display.
 * @param {string} name - The text to display.
 */
export function updateNowPlayingDisplay(name) {
    const displayElement = document.getElementById('nowPlayingDisplay');
    if (!displayElement) {
        console.error('ERROR: #nowPlayingDisplay element not found in DOM!');
        return;
    }
    displayElement.textContent = name || '';
}

// ===================================================================
// Chord Button Generation and Interaction
// ===================================================================

let chordButtonMode = 0; // 0: Hidden, 1: Bass, 2: Treble
let chordButtonsGenerated = false;

// Helper function to resolve chord name based on key signature
function resolveChordName(chordName) {
    // Extract the root note and quality
    const match = chordName.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return chordName;

    const [, root, quality] = match;

    // Check for enharmonic equivalents
    const enharmonicPairs = [
        ['A#', 'Bb'], ['C#', 'Db'], ['D#', 'Eb'], 
        ['F#', 'Gb'], ['G#', 'Ab']
    ];

    for (const [sharp, flat] of enharmonicPairs) {
        if (root === sharp || root === flat) {
            // Choose based on key signature type
            const preferredRoot = pianoState.keySignatureType === 'b' ? flat : sharp;
            const preferredChordName = preferredRoot + quality;

            // Return the preferred version if it exists in CHORD_DEFINITIONS
            if (CHORD_DEFINITIONS[preferredChordName]) {
                return preferredChordName;
            }
        }
    }

    return chordName; // Return original if no enharmonic equivalent found
}


export function generateChordButtons() {
    if (typeof CHORD_GROUPS === 'undefined' || !document.getElementById('CHORD_GROUPSContainer')) return;

    const CHORD_GROUPSContainer = document.getElementById('CHORD_GROUPSContainer');
    CHORD_GROUPSContainer.innerHTML = ''; // Clear previous buttons

    CHORD_GROUPS.forEach(group => {
        const section = document.createElement('div');
        section.className = 'chord-section';
        const heading = document.createElement('h4');
        heading.textContent = group.label;
        section.appendChild(heading);

        const grid = document.createElement('div');
        grid.className = 'chord-grid';

        group.chords.forEach(chordName => {
            const btn = document.createElement('button');
            btn.className = 'btn btn--compact';

            // Resolve chord name based on current key signature
            const resolvedChordName = resolveChordName(chordName);
            const chordDefinition = CHORD_DEFINITIONS[resolvedChordName];
            if (!chordDefinition) return;

            btn.chordData = chordDefinition;
            btn.textContent = chordDefinition.displayName;
            btn.setAttribute('data-chord', resolvedChordName); 

            grid.appendChild(btn);
        });
        section.appendChild(grid);
        CHORD_GROUPSContainer.appendChild(section);
    });

    document.querySelectorAll('#CHORD_GROUPSContainer .btn').forEach(button => {
        button.addEventListener('pointerdown', function (e) {
            e.preventDefault(); 
            const chordDefinition = this.chordData;
            if (!chordDefinition) return;

            document.querySelectorAll('#CHORD_GROUPSContainer .btn').forEach(btn => btn.classList.remove('is-active'));
            this.classList.add('is-active');

            updateNowPlayingDisplay(chordDefinition.displayName);

            let notesToPlay = [];
            let clef = '';

            if (chordButtonMode === 1) { notesToPlay = chordDefinition.bass || []; clef = 'bass'; } 
            else if (chordButtonMode === 2) { notesToPlay = chordDefinition.treble || []; clef = 'treble'; }

            if (notesToPlay.length > 0) {
                // Only play audio if audio is ready
                if (audioManager.isAudioReady()) {
                    trigger(notesToPlay, true);
                    this.classList.add('pressed');
                }
                
                const startTime = performance.now();
                this.setPointerCapture(e.pointerId);
                this.dataset.playingChord = 'true';

                const endChordPlay = (eUp) => {
                    if (this.dataset.playingChord === 'true') {
                        // Only stop audio if audio is ready
                        if (audioManager.isAudioReady()) {
                            trigger(notesToPlay, false);
                            this.classList.remove('pressed');
                        }
                        delete this.dataset.playingChord;

                        const heldTime = performance.now() - startTime;
                        let duration = 'q';
                        if (heldTime >= DURATION_THRESHOLDS.w) duration = 'w';
                        else if (heldTime >= DURATION_THRESHOLDS.h) duration = 'h';

                        const chordDisplayName = chordDefinition.displayName;
                        updateNowPlayingDisplay(chordDisplayName); 
                        // Always write to score regardless of audio state
                        writeNote({ clef, duration, notes: notesToPlay, chordName: chordDisplayName });

                        this.releasePointerCapture(eUp.pointerId);
                        this.removeEventListener('pointerup', endChordPlay);
                        this.removeEventListener('pointercancel', endChordPlay);
                    }
                };
                this.addEventListener('pointerup', endChordPlay, { once: true });
                this.addEventListener('pointercancel', endChordPlay, { once: true });
            } else {
                const chordDisplayName = chordDefinition.displayName;
                updateNowPlayingDisplay(chordDisplayName);
                // Always write to score regardless of audio state
                writeNote({ clef, duration: 'q', notes: [], chordName: chordDisplayName, isRest: true });
                document.getElementById('instrument')?.focus();
            }
        }); 
    });
    chordButtonsGenerated = true;
}

export function handleChordDisplayToggle(e) {
    e.preventDefault();
    const chordButtonsContainer = document.getElementById('chordButtons');
    const toggleButtonSpan = e.currentTarget.querySelector('span');

    chordButtonMode = (chordButtonMode + 1) % 3; // Cycle 0, 1, 2

    switch (chordButtonMode) {
        case 0:
            toggleButtonSpan.textContent = 'Show Chords';
            chordButtonsContainer.classList.add('hidden');
            // REFACTORED: Use .is-active for state management
            e.currentTarget.classList.remove('is-active');
            break;
        case 1:
            toggleButtonSpan.textContent = 'Bass Chords';
            chordButtonsContainer.classList.remove('hidden');
            // REFACTORED: Use .is-active for state management
            e.currentTarget.classList.add('is-active');
            if (!chordButtonsGenerated) { generateChordButtons(); }
            break;
        case 2:
            toggleButtonSpan.textContent = 'Treble Chords';
            chordButtonsContainer.classList.remove('hidden');
            // REFACTORED: Use .is-active for state management
            e.currentTarget.classList.add('is-active');
            if (!chordButtonsGenerated) { generateChordButtons(); }
            break;
    }
}
/**
 * General UI feedback function for providing user feedback on various operations
 * @param {string} message - The message to display to the user
 * @param {Object} options - Optional configuration for additional UI updates
 * @param {boolean} options.updateKeySignature - Whether to update the key signature button (default: false)
 * @param {boolean} options.regenerateChords - Whether to regenerate chord buttons (default: false)
 */
export function updateUI(message, options = {}) {
    // Always update the now playing display with the message
    updateNowPlayingDisplay(message);

    // Always update the minor/major key button text
    const minorKeyText = document.getElementById('minor-key-text');
    if (minorKeyText) {
        minorKeyText.textContent = pianoState.isMinorKey ? "Minor" : "Major";
    }

    // Handle key signature button update if requested
    if (options.updateKeySignature) {
        const keySignatureButton = document.getElementById('key-signature-btn');
        if (keySignatureButton) {
            keySignatureButton.textContent = getKeySignature();
        } else {
            console.warn('Key signature button (#key-signature-btn) not found for UI update');
        }
    }

    // Regenerate chord buttons if requested
    if (options.regenerateChords) {
        generateChordButtons();
    }
}

export function handleKeySignatureClick(e) {
    // Define the cycling order for display names (circle of fifths)
    const keyOrder = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];

    const currentIndex = keyOrder.indexOf(pianoState.keySignature);
    const nextIndex = (currentIndex + 1) % keyOrder.length;
    const nextKey = keyOrder[nextIndex];

    // Use the new setKeySignature function (but it won't update the button)
    if (setKeySignature(nextKey)) {
        updateUI(`Key: ${pianoState.keySignature}`, {
            updateKeySignature: true,
            regenerateChords: true
        });
    }
}

export function toggleIsMinorKey() {
    pianoState.isMinorKey = !pianoState.isMinorKey;
    updateUI(getKeySignature(), {
        updateKeySignature: true,
        regenerateChords: true
    });
}