// uiHelpers.js
// This module contains general UI manipulation functions, like display updates and chord button generation.

// ===================================================================
// Imports
// ===================================================================

import { chordDefinitions, chordGroups, DURATION_THRESHOLDS } from './note-data.js';
import { writeNote } from './scoreWriter.js';
import { trigger } from './playbackHelpers.js';

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

/**
 * Generates the chord buttons dynamically based on chordDefinitions.
 */
export function generateChordButtons() {
    if (typeof chordGroups === 'undefined' || !document.getElementById('chordGroupsContainer')) return;

    const chordGroupsContainer = document.getElementById('chordGroupsContainer');
    chordGroupsContainer.innerHTML = ''; // Clear previous buttons

    chordGroups.forEach(group => {
        const section = document.createElement('div');
        section.className = 'chord-section';
        const heading = document.createElement('h4');
        heading.textContent = group.label;
        section.appendChild(heading);

        const grid = document.createElement('div');
        grid.className = 'chord-grid';

        group.chords.forEach(chordName => {
            const btn = document.createElement('button');
            // REFACTORED: Use the new BEM classes for compact buttons.
            btn.className = 'btn btn--compact'; 

            const chordDefinition = chordDefinitions[chordName];
            if (!chordDefinition) return;
            btn.chordData = chordDefinition;
            btn.textContent = chordDefinition.displayName;
            btn.setAttribute('data-chord', chordName); 

            grid.appendChild(btn);
        });
        section.appendChild(grid);
        chordGroupsContainer.appendChild(section);
    });

    // REFACTORED: Select the newly styled buttons within their container.
    document.querySelectorAll('#chordGroupsContainer .btn').forEach(button => {
        button.addEventListener('pointerdown', function (e) {
            e.preventDefault(); 
            const chordDefinition = this.chordData;
            if (!chordDefinition) return;

            // REFACTORED: Use .is-active for the toggled state.
            document.querySelectorAll('#chordGroupsContainer .btn').forEach(btn => btn.classList.remove('is-active'));
            this.classList.add('is-active');

            updateNowPlayingDisplay(chordDefinition.displayName);

            let notesToPlay = [];
            let clef = '';

            if (chordButtonMode === 1) { notesToPlay = chordDefinition.bass || []; clef = 'bass'; } 
            else if (chordButtonMode === 2) { notesToPlay = chordDefinition.treble || []; clef = 'treble'; }

            if (notesToPlay.length > 0) { // Check if there are notes to play
                trigger(notesToPlay, true);
                this.classList.add('pressed'); // 'pressed' can be a temporary visual state
                const startTime = performance.now();

                this.setPointerCapture(e.pointerId);
                this.dataset.playingChord = 'true';

                const endChordPlay = (eUp) => {
                    if (this.dataset.playingChord === 'true') {
                        trigger(notesToPlay, false);
                        this.classList.remove('pressed');
                        delete this.dataset.playingChord;

                        const heldTime = performance.now() - startTime;
                        let duration = 'q';
                        if (heldTime >= DURATION_THRESHOLDS.w) duration = 'w';
                        else if (heldTime >= DURATION_THRESHOLDS.h) duration = 'h';

                        const chordDisplayName = chordDefinition.displayName;
                        updateNowPlayingDisplay(chordDisplayName); 
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
                // If no notes, treat as a rest to advance the score
                writeNote({ clef, duration: 'q', notes: [], chordName: chordDisplayName, isRest: true });
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
