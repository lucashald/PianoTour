// uiHelpers.js
// This module contains general UI manipulation functions, like display updates and chord button generation.

// ===================================================================
// Imports
// ===================================================================

import { pianoState } from '../core/appState.js';
import audioManager, { unlockAndExecute } from '../core/audioManager.js';
import { CHORD_DEFINITIONS, CHORD_GROUPS, getDurationThresholds, getKeySignature } from '../core/note-data.js';
import { trigger } from '../instrument/playbackHelpers.js';
import { setKeySignature } from '../score/scoreRenderer.js';
import { writeNote } from '../score/scoreWriter.js';
import { createChordDiagrams, createChordPalette } from './guitarUI.js';
import { audioSettingsController } from './audioSettings.js';

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
            const resolvedChordName = resolveChordName(chordName);
            
            // Check if we've already added this chord to the grid
            if (grid.querySelector(`[data-chord="${resolvedChordName}"]`)) {
                return; // Skip if already exists
            }

            const btn = document.createElement('button');
            btn.className = 'btn btn--compact';

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
                        const thresholds = getDurationThresholds(pianoState.tempo);
                        let duration = '8';
                        if (heldTime >= thresholds.w) duration = 'w';
                        else if (heldTime >= thresholds["h."]) duration = 'h.';
                        else if (heldTime >= thresholds.h) duration = 'h';
                        else if (heldTime >= thresholds["q."]) duration = 'q.';
                        else if (heldTime >= thresholds.q) duration = 'q';
                        else if (heldTime >= thresholds["8."]) duration = '8.';

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
                writeNote({ clef, duration: pianoState.quantize, notes: [], chordName: chordDisplayName, isRest: true });
                document.getElementById('instrument')?.focus();
            }
        }); 
    });
    chordButtonsGenerated = true;
}

export function handleChordDisplayToggle(e) {
    e.preventDefault();
    
    // Unlock audio when the button is clicked
    audioManager.unlockAndExecute(() => {});

    const chordButtonsContainer = document.getElementById('chordButtons');
    const toggleButtonSpan = e.currentTarget.querySelector('span');

    chordButtonMode = (chordButtonMode + 1) % 3; // Cycle 0, 1, 2

    switch (chordButtonMode) {
        case 0:
            toggleButtonSpan.textContent = 'Show Chords';
            chordButtonsContainer.classList.add('hidden');
            e.currentTarget.classList.remove('is-active');
            break;
        case 1:
            toggleButtonSpan.textContent = 'Bass Chords';
            chordButtonsContainer.classList.remove('hidden');
            e.currentTarget.classList.add('is-active');
            if (!chordButtonsGenerated) { generateChordButtons(); }
            break;
        case 2:
            toggleButtonSpan.textContent = 'Treble Chords';
            chordButtonsContainer.classList.remove('hidden');
            e.currentTarget.classList.add('is-active');
            if (!chordButtonsGenerated) { generateChordButtons(); }
            break;
    }
}

export function handleSettingsDisplayToggle(e) {
    e.preventDefault();
    const audioSettingsContainer = document.getElementById('audio-settings');
    const toggleSettingsSpan = e.currentTarget.querySelector('span');
    if (pianoState.showSettings) {
        audioSettingsContainer.classList.add('hidden');
        toggleSettingsSpan.textContent = 'Show Settings';
    }
    else {
        audioSettingsContainer.classList.remove('hidden');
        toggleSettingsSpan.textContent = 'Hide Settings';
    }
    pianoState.showSettings = !pianoState.showSettings;
}

/**
 * General UI feedback function for providing user feedback on various operations
 * @param {string} message - The message to display to the user
 * @param {Object} options - Optional configuration for additional UI updates
 * @param {boolean} options.updateKeySignature - Whether to update the key signature button (default: false)
 * @param {boolean} options.regenerateChords - Whether to regenerate chord buttons (default: false)
 */
export async function updateUI(message, options = {}) {
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
            keySignatureButton.textContent = `Key: ${getKeySignature()}`;
        } else {
            console.warn('Key signature button (#key-signature-btn) not found for UI update');
        }
    }

    // Regenerate chord buttons if requested
    if (options.regenerateChords) {
        const currentKey = getKeySignature();
        generateChordButtons();
        await createChordDiagrams('.chord-container', currentKey);
        // createChordPalette will use window.guitarInstance as default if not provided
        await createChordPalette(undefined, currentKey);
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
        updateUI(`Key: ${getKeySignature()}`, {
            updateKeySignature: true,
            regenerateChords: true
        });
    }
}

export function toggleIsMinorKey() {
    pianoState.isMinorKey = !pianoState.isMinorKey;
    updateUI(`Key: ${getKeySignature()}`, {
        updateKeySignature: true,
        regenerateChords: true
    });
}

export function show_side_panel() {
    // Toggle the state
    pianoState.show_side_panel = !pianoState.show_side_panel;
    
    // Toggle the CSS class to show/hide the panel
    const sidePanel = document.querySelector('.piano-app__side-panel');
    if (sidePanel) {
        sidePanel.classList.toggle('visible');
    }
}

export function handlePlaybackMenuToggle(e) {
    e.preventDefault();
    const dropdown = document.getElementById('playback-menu-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

// Close dropdown when clicking outside or on an item (but not submenu items)
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('playback-menu-dropdown');
    const button = document.getElementById('playback-menu-btn');
    const instrumentSubmenu = document.getElementById('instrument-submenu');
    const exportSubmenu = document.getElementById('export-submenu');
    const keySubmenu = document.getElementById('key-submenu');
    
    if (dropdown && button && !dropdown.classList.contains('hidden')) {
        // Don't close if clicking on a submenu or its button
        const instrumentMenuBtn = document.getElementById('instrument-menu-btn');
        const exportMenuBtn = document.getElementById('export-menu-btn');
        const keyMenuBtn = document.getElementById('key-menu-btn');
        const isInstrumentInteraction = (instrumentMenuBtn && instrumentMenuBtn.contains(e.target)) ||
                                         (instrumentSubmenu && instrumentSubmenu.contains(e.target));
        const isExportInteraction = (exportMenuBtn && exportMenuBtn.contains(e.target)) ||
                                     (exportSubmenu && exportSubmenu.contains(e.target));
        const isKeyInteraction = (keyMenuBtn && keyMenuBtn.contains(e.target)) ||
                                  (keySubmenu && keySubmenu.contains(e.target));
        
        // Close if clicked outside OR if a non-submenu dropdown item was clicked
        if (!isInstrumentInteraction && !isExportInteraction && !isKeyInteraction) {
            if ((!dropdown.contains(e.target) && !button.contains(e.target)) || 
                (dropdown.contains(e.target) && e.target.classList.contains('dropdown-item') && !e.target.classList.contains('has-submenu'))) {
                dropdown.classList.add('hidden');
                // Also close submenus
                if (instrumentSubmenu) {
                    instrumentSubmenu.classList.add('hidden');
                }
                if (exportSubmenu) {
                    exportSubmenu.classList.add('hidden');
                }
                if (keySubmenu) {
                    keySubmenu.classList.add('hidden');
                }
            }
        }
    }
});

export function handleQuantizeToggle(e) {
    e.preventDefault();
    const options = ['16', '8', 'q', 'h', 'w'];
    const imageMap = {
        'w': 'whole.png',
        'h': 'half-up.png',
        'q': 'quarter-up.png',
        '8': '8th-up.png',
        '16': '16th-up.png'
    };
    
    const currentIndex = options.indexOf(pianoState.quantize);
    const nextIndex = (currentIndex + 1) % options.length;
    pianoState.quantize = options[nextIndex];
    
    const btn = document.getElementById('quantize-btn');
    if (btn) {
        const imgName = imageMap[pianoState.quantize];
        if (imgName) {
            btn.innerHTML = `<img src="/static/images/${imgName}" alt="${pianoState.quantize}" class="quantize-icon">`;
        } else {
            // Fallback for 32 or others
            const labels = { '32': '1/32' };
            btn.textContent = labels[pianoState.quantize] || pianoState.quantize;
        }
    }
}

export function handleInstrumentMenuToggle(e) {
    e.preventDefault();
    e.stopPropagation();
    const submenu = document.getElementById('instrument-submenu');
    if (submenu) {
        submenu.classList.toggle('hidden');
        // Update active state for current instrument
        updateInstrumentMenuActiveState();
    }
    // Close other submenus if open
    const exportSubmenu = document.getElementById('export-submenu');
    if (exportSubmenu) {
        exportSubmenu.classList.add('hidden');
    }
    const keySubmenu = document.getElementById('key-submenu');
    if (keySubmenu) {
        keySubmenu.classList.add('hidden');
    }
}

export function handleExportMenuToggle(e) {
    e.preventDefault();
    e.stopPropagation();
    const submenu = document.getElementById('export-submenu');
    if (submenu) {
        submenu.classList.toggle('hidden');
    }
    // Close other submenus if open
    const instrumentSubmenu = document.getElementById('instrument-submenu');
    if (instrumentSubmenu) {
        instrumentSubmenu.classList.add('hidden');
    }
    const keySubmenu = document.getElementById('key-submenu');
    if (keySubmenu) {
        keySubmenu.classList.add('hidden');
    }
}

export function handleKeyMenuToggle(e) {
    e.preventDefault();
    e.stopPropagation();
    const submenu = document.getElementById('key-submenu');
    if (submenu) {
        submenu.classList.toggle('hidden');
        // Update active state for current key
        updateKeyMenuActiveState();
    }
    // Close other submenus if open
    const instrumentSubmenu = document.getElementById('instrument-submenu');
    if (instrumentSubmenu) {
        instrumentSubmenu.classList.add('hidden');
    }
    const exportSubmenu = document.getElementById('export-submenu');
    if (exportSubmenu) {
        exportSubmenu.classList.add('hidden');
    }
}

export function handleKeySelect(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const keyName = e.target.dataset.key;
    if (!keyName) return;
    
    // Use the setKeySignature function
    if (setKeySignature(keyName)) {
        updateUI(`Key: ${getKeySignature()}`, {
            updateKeySignature: true,
            regenerateChords: true
        });
    }
    
    // Update active state and close menus
    updateKeyMenuActiveState();
    
    // Close both menus
    const dropdown = document.getElementById('playback-menu-dropdown');
    const submenu = document.getElementById('key-submenu');
    if (dropdown) dropdown.classList.add('hidden');
    if (submenu) submenu.classList.add('hidden');
}

function updateKeyMenuActiveState() {
    const options = document.querySelectorAll('.key-option');
    options.forEach(option => {
        if (option.dataset.key === pianoState.keySignature) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}

export async function handleInstrumentSelect(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const instrumentName = e.target.dataset.instrument;
    if (!instrumentName) return;
    
    // Update UI immediately for responsiveness
    const instrumentSelect = document.getElementById('instrumentSelect');
    if (instrumentSelect) {
        instrumentSelect.value = instrumentName;
    }
    
    // Update active state and close menus
    pianoState.instrument = instrumentName; // Update state for UI
    updateInstrumentMenuActiveState();
    
    // Close both menus
    const dropdown = document.getElementById('playback-menu-dropdown');
    const submenu = document.getElementById('instrument-submenu');
    if (dropdown) dropdown.classList.add('hidden');
    if (submenu) submenu.classList.add('hidden');
    
    // Use unlockAndExecute to ensure audio is ready before changing instrument
    try {
        await unlockAndExecute(async () => {
            await audioSettingsController.changeInstrument(instrumentName);
        });
    } catch (error) {
        console.error('Failed to change instrument:', error);
    }
}

function updateInstrumentMenuActiveState() {
    const options = document.querySelectorAll('.instrument-option');
    options.forEach(option => {
        if (option.dataset.instrument === pianoState.instrument) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}