// uiHelpers.js
// This module contains general UI manipulation functions, like display updates and chord button generation.

// ===================================================================
// Imports
// ===================================================================

import { pianoState } from '../core/appState.js';
import audioManager, { unlockAndExecute } from '../core/audioManager.js';
import { CHORD_DEFINITIONS, CHORD_GROUPS, ALL_NOTE_INFO, getDurationThresholds, getKeySignature } from '../core/note-data.js';
import { trigger } from '../instrument/playbackHelpers.js';
import { setKeySignature } from '../score/scoreRenderer.js';
import { writeNote } from '../score/scoreWriter.js';
import { createChordDiagrams, createChordPalette } from './guitarUI.js';
import { audioSettingsController } from './audioSettings.js';
import { ChordPreview } from '../classes/ChordPreview.js';
import { paintChordOnTheFly, clearChordHi } from '../instrument/instrumentHelpers.js';

// ===================================================================
// UI Update Functions
// ===================================================================

// Track current active toast and its timeout to prevent stacking
let currentToast = null;
let currentToastTimeout = null;

/**
 * Generic toast notification helper
 * Only one toast is displayed at a time; new toasts replace the current one and reset the timer
 * @param {string} message - The message to display
 * @param {Object} options - Configuration options
 * @param {string} options.type - Type of toast: 'success', 'error', 'info', 'warning' (default: 'info')
 * @param {number} options.duration - Duration in milliseconds before fade out (default: 3000)
 * @param {string} options.backgroundColor - Custom background color (overrides type-based color)
 * @param {string} options.textColor - Custom text color (default: white for success/error/info, #212529 for warning)
 * @returns {HTMLElement} - The notification element
 */
export function showToast(message, options = {}) {
    const {
        type = 'info',
        duration = 3000,
        backgroundColor = null,
        textColor = null
    } = options;

    // Default colors by type using CSS custom properties
    const colorMap = {
        'success': { bg: 'var(--color-green-medium)', text: 'var(--color-text-primary)' },
        'error': { bg: 'var(--color-peach-medium)', text: 'var(--color-text-primary)' },
        'info': { bg: 'var(--color-blue-medium)', text: 'var(--color-text-primary)' },
        'warning': { bg: 'var(--color-gold-medium)', text: 'var(--color-text-primary)' }
    };

    const colors = colorMap[type] || colorMap.info;
    const bgColor = backgroundColor || colors.bg;
    const txtColor = textColor || colors.text;

    // Clear any existing toast timeout
    if (currentToastTimeout) {
        clearTimeout(currentToastTimeout);
    }

    // If a toast already exists, update it instead of creating a new one
    if (currentToast && currentToast.parentNode) {
        currentToast.textContent = message;
        currentToast.style.background = bgColor;
        currentToast.style.color = txtColor;
        currentToast.style.opacity = '1';
        currentToast.style.transform = 'translateY(0)';
    } else {
        // Create new toast element
        currentToast = document.createElement('div');
        currentToast.textContent = message;
        currentToast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: ${txtColor};
            padding: 12px 16px;
            border-radius: var(--border-radius);
            font-size: var(--font-size-sm);
            font-weight: 500;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
            transform: translateY(-20px);
            opacity: 0;
        `;

        document.body.appendChild(currentToast);

        // Animate in
        setTimeout(() => {
            if (currentToast) {
                currentToast.style.opacity = '1';
                currentToast.style.transform = 'translateY(0)';
            }
        }, 10);
    }

    // Fade out and remove after duration
    currentToastTimeout = setTimeout(() => {
        if (currentToast) {
            currentToast.style.opacity = '0';
            currentToast.style.transform = 'translateY(-20px)';
            currentToastTimeout = setTimeout(() => {
                if (currentToast && currentToast.parentNode) {
                    currentToast.remove();
                }
                currentToast = null;
            }, 300);
        }
    }, duration);

    return currentToast;
}

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

/**
 * Calculates the appropriate spaceAboveStaffLn value based on the chord's note range
 * @param {string[]} notes - Array of note strings like ['C4', 'E4', 'G4']
 * @param {string} clef - The clef type ('treble' or 'bass')
 * @returns {number} - spaceAboveStaffLn value between 0 and 6
 */
function getSpacingForChord(notes, clef) {
    if (!notes || notes.length === 0) {
        console.log('getSpacingForChord: No notes provided, returning default 3');
        return 3;
    }

    // Get MIDI numbers for each note
    const midiNumbers = notes.map(note => {
        const noteInfo = ALL_NOTE_INFO.find(info => info.name === note);
        return noteInfo ? noteInfo.midi : null;
    }).filter(midi => midi !== null);

    if (midiNumbers.length === 0) {
        console.log('getSpacingForChord: Could not find MIDI numbers for notes, returning default 3');
        return 3;
    }

    const highestMidi = Math.max(...midiNumbers);
    const lowestMidi = Math.min(...midiNumbers);

    console.group(`getSpacingForChord - ${clef} clef`);
    console.log('Notes:', notes);
    console.log('MIDI numbers:', midiNumbers);
    console.log('Highest MIDI:', highestMidi, `(${ALL_NOTE_INFO.find(n => n.midi === highestMidi)?.name || 'unknown'})`);
    console.log('Lowest MIDI:', lowestMidi, `(${ALL_NOTE_INFO.find(n => n.midi === lowestMidi)?.name || 'unknown'})`);

    let spacing;

    if (clef === 'treble') {
        if (highestMidi >= 84) {
            spacing = 5;
        } else if (highestMidi >= 83 && lowestMidi <= 59) {
            spacing = 4;
        } else if (lowestMidi <= 58) {
            spacing = 2;
        } else {
            spacing = 3;
        }
    } else {
        if (lowestMidi <= 39) {
            spacing = 1;
        } else if (lowestMidi <= 40 ) {
            spacing = 2;
        } else if (highestMidi >= 59 ) {
            spacing = 4;
        } else {
            spacing = 3;
        }
    }

    console.log('Final spacing value:', spacing);
    console.groupEnd();

    return spacing;
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
            e.stopPropagation(); 
            const chordDefinition = this.chordData;
            if (!chordDefinition) return;

            document.querySelectorAll('#CHORD_GROUPSContainer .btn').forEach(btn => btn.classList.remove('is-active'));
            this.classList.add('is-active');

            updateNowPlayingDisplay(chordDefinition.displayName);

            let notesToPlay = [];
            let clef = '';

            if (chordButtonMode === 1) { notesToPlay = chordDefinition.bass || []; clef = 'bass'; } 
            else if (chordButtonMode === 2) { notesToPlay = chordDefinition.treble || []; clef = 'treble'; }

            // paintChordOnTheFly({ notes: notesToPlay }); // Handled by trigger

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
                        // clearChordHi(); // Handled by trigger
                        delete this.dataset.playingChord;

                        const heldTime = performance.now() - startTime;
                        const thresholds = getDurationThresholds(pianoState.tempo);
                        let duration = '8';
                        if (pianoState.toggleFixedDuration) {
                            duration = pianoState.quantize;
                        } else if (heldTime >= thresholds.w) duration = 'w';
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
                // When chord has no notes for this clef, write as rest
                // Use standard rest position: B4 for treble, D3 for bass
                const restPosition = clef === 'bass' ? 'D3' : 'B4';
                writeNote({ clef: clef || 'treble', duration: pianoState.quantize, notes: [restPosition], chordName: chordDisplayName, isRest: true });
                document.getElementById('instrument')?.focus();
            }
        }); 
    });
    chordButtonsGenerated = true;
}

export function generateChordPreviewButtons(clef = 'treble') {
    if (typeof CHORD_GROUPS === 'undefined' || !document.getElementById('CHORD_GROUPSContainer')) return;

    const CHORD_GROUPSContainer = document.getElementById('CHORD_GROUPSContainer');
    CHORD_GROUPSContainer.innerHTML = ''; // Clear previous buttons

    const previewsToRender = []; // Store preview info to render after DOM is updated

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

            const chordDefinition = CHORD_DEFINITIONS[resolvedChordName];
            if (!chordDefinition) return;

            // Create chord item wrapper
            const chordItem = document.createElement('div');
            chordItem.className = 'chord-preview-item';
            chordItem.setAttribute('data-chord', resolvedChordName);

            // Add label above preview
            const label = document.createElement('div');
            label.className = 'chord-preview-label';
            label.textContent = chordDefinition.displayName;
            chordItem.appendChild(label);

            // Create preview container (the preview will BE the button)
            const previewContainer = document.createElement('div');
            previewContainer.className = 'chord-preview-button';
            previewContainer.id = `preview-${resolvedChordName}-${clef}`;
            chordItem.appendChild(previewContainer);

            grid.appendChild(chordItem);

            // Calculate appropriate spacing based on chord's note range
            const notesToUse = clef === 'bass' ? chordDefinition.bass : chordDefinition.treble;
            const spacing = getSpacingForChord(notesToUse, clef);

            // Store preview info to render later
            previewsToRender.push({
                elementId: `preview-${resolvedChordName}-${clef}`,
                chordName: resolvedChordName,
                chordDefinition: chordDefinition,
                clef: clef,
                spaceAboveStaffLn: spacing
            });
        });
        section.appendChild(grid);
        CHORD_GROUPSContainer.appendChild(section);
    });

    // NOW render all previews after entire DOM structure is in place
    previewsToRender.forEach(previewInfo => {
        const preview = new ChordPreview(previewInfo.elementId, {
            clef: previewInfo.clef,
            width: 150,
            height: 100,
            spaceAboveStaffLn: previewInfo.spaceAboveStaffLn
        });
        preview.render(previewInfo.chordName);

        // Add click/pointer handler to the chord item container (includes label and preview)
        const chordItem = document.querySelector(`[data-chord="${previewInfo.chordName}"]`);
        if (chordItem) {
            chordItem.style.cursor = 'pointer';
            chordItem.addEventListener('pointerdown', function (e) {
                e.preventDefault();
                e.stopPropagation();
                const chordDefinition = previewInfo.chordDefinition;

                document.querySelectorAll('#CHORD_GROUPSContainer .chord-preview-item').forEach(item => {
                    item.classList.remove('is-active');
                });
                this.classList.add('is-active');

                updateNowPlayingDisplay(chordDefinition.displayName);

                let notesToPlay = [];
                let selectedClef = '';

                if (chordButtonMode === 1) { notesToPlay = chordDefinition.bass || []; selectedClef = 'bass'; } 
                else if (chordButtonMode === 2) { notesToPlay = chordDefinition.treble || []; selectedClef = 'treble'; }

                // paintChordOnTheFly({ notes: notesToPlay }); // Handled by trigger

                if (notesToPlay.length > 0) {
                    if (audioManager.isAudioReady()) {
                        trigger(notesToPlay, true);
                        this.classList.add('pressed');
                    }
                    
                    const startTime = performance.now();
                    this.setPointerCapture(e.pointerId);
                    this.dataset.playingChord = 'true';

                    const endChordPlay = (eUp) => {
                        if (this.dataset.playingChord === 'true') {
                            if (audioManager.isAudioReady()) {
                                trigger(notesToPlay, false);
                                this.classList.remove('pressed');
                            }
                            // clearChordHi(); // Handled by trigger
                            delete this.dataset.playingChord;

                            const heldTime = performance.now() - startTime;
                            const thresholds = getDurationThresholds(pianoState.tempo);
                            let duration = '8';
                            if (pianoState.toggleFixedDuration) {
                                duration = pianoState.quantize;
                            } else if (heldTime >= thresholds.w) duration = 'w';
                            else if (heldTime >= thresholds["h."]) duration = 'h.';
                            else if (heldTime >= thresholds.h) duration = 'h';
                            else if (heldTime >= thresholds["q."]) duration = 'q.';
                            else if (heldTime >= thresholds.q) duration = 'q';
                            else if (heldTime >= thresholds["8."]) duration = '8.';

                            const chordDisplayName = chordDefinition.displayName;
                            updateNowPlayingDisplay(chordDisplayName);
                            writeNote({ clef: selectedClef, duration, notes: notesToPlay, chordName: chordDisplayName });

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
                    // When chord has no notes for this clef, write as rest
                    // Use standard rest position: B4 for treble, D3 for bass
                    const restPosition = selectedClef === 'bass' ? 'D3' : 'B4';
                    writeNote({ clef: selectedClef, duration: pianoState.quantize, notes: [restPosition], chordName: chordDisplayName, isRest: true });
                    document.getElementById('instrument')?.focus();
                }
            });
        }
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
            generateChordPreviewButtons('bass');
            break;
        case 2:
            toggleButtonSpan.textContent = 'Treble Chords';
            chordButtonsContainer.classList.remove('hidden');
            e.currentTarget.classList.add('is-active');
            generateChordPreviewButtons('treble');
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
        generateChordPreviewButtons();
        await createChordDiagrams('.chord-container', currentKey);
        // createChordPalette will use window.guitarInstance as default if not provided
        await createChordPalette(undefined, currentKey);
    }
}

/**
 * Apply key change with consistent UX feedback and menu updates
 * @param {string} keyName - The key signature to change to
 * @returns {boolean} - True if key change was successful
 */
function applyKeyChange(keyName) {
    if (!setKeySignature(keyName)) {
        return false;
    }
    
    updateUI(`Key: ${getKeySignature()}`, {
        updateKeySignature: true,
        regenerateChords: true
    });
    
    // Show success feedback
    showToast(`Key changed to ${getKeySignature()}`, { type: 'success' });
    
    // Update menu states and close menus
    updateKeyMenuActiveState();
    const dropdown = document.getElementById('playback-menu-dropdown');
    const submenu = document.getElementById('key-submenu');
    if (dropdown) dropdown.classList.add('hidden');
    if (submenu) submenu.classList.add('hidden');
    
    return true;
}

export function handleKeySignatureClick(e) {
    // Define the cycling order for display names (circle of fifths)
    const keyOrder = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];

    const currentIndex = keyOrder.indexOf(pianoState.keySignature);
    const nextIndex = (currentIndex + 1) % keyOrder.length;
    const nextKey = keyOrder[nextIndex];

    applyKeyChange(nextKey);
}

export function toggleIsMinorKey() {
    pianoState.isMinorKey = !pianoState.isMinorKey;
    
    // Update key menu display names
    updateKeyMenuActiveState();
    updateUI(`Key: ${getKeySignature()}`, {
        updateKeySignature: true,
        regenerateChords: true
    });
    
    // Show feedback for mode change
    showToast(`Key changed to ${getKeySignature()}`, { type: 'success' });
}

export function openSidePanel() {
    const sidePanel = document.getElementById('sidePanel');
    if (sidePanel) {
        sidePanel.classList.add('open');
    }
}

export function closeSidePanel() {
    const sidePanel = document.getElementById('sidePanel');
    if (sidePanel) {
        sidePanel.classList.remove('open');
    }
}

export function toggleSidePanel() {
    const sidePanel = document.getElementById('sidePanel');
    if (sidePanel?.classList.contains('open')) {
        closeSidePanel();
    } else {
        openSidePanel();
    }
}

export function initSidebarToggle() {
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const closeBtn = document.getElementById('sidebarCloseBtn');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleSidePanel);
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', closeSidePanel);
    }
}

// Legacy function for backwards compatibility
export function show_side_panel() {
    toggleSidePanel();
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
    
    // Use closest to handle clicks on child elements (img, span)
    const button = e.target.closest('.key-option');
    if (!button) return;
    
    const keyName = button.dataset.key;
    if (!keyName) return;
    
    applyKeyChange(keyName);
}

function updateKeyMenuActiveState() {
    const options = document.querySelectorAll('.key-option');
    options.forEach(option => {
        // Update active state
        if (option.dataset.key === pianoState.keySignature) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
        
        // Update display name based on major/minor mode
        const keyNameSpan = option.querySelector('.key-name');
        if (keyNameSpan) {
            const displayName = pianoState.isMinorKey ? option.dataset.minor : option.dataset.major;
            if (displayName) {
                keyNameSpan.textContent = displayName;
            }
        }
    });
    
    // Update the key mode toggle text in the dropdown
    const keyModeToggleText = document.getElementById('key-mode-toggle-text');
    if (keyModeToggleText) {
        keyModeToggleText.textContent = pianoState.isMinorKey ? 'Minor' : 'Major';
    }
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

/**
 * Gets the current clef mode
 * @returns {string} - 'bass' or 'treble' based on current mode
 */
export function getCurrentChordClef() {
    if (chordButtonMode === 1) return 'bass';
    if (chordButtonMode === 2) return 'treble';
    return 'treble'; // Default fallback
}

// Handle Synth Submenu Toggle
document.addEventListener('click', (e) => {
    const synthMenuBtn = document.getElementById('synth-menu-btn');
    // Use closest because the click might be on the img or text inside the button
    const targetBtn = e.target.closest('#synth-menu-btn');
    
    if (targetBtn) {
        e.preventDefault();
        e.stopPropagation();
        const submenu = document.getElementById('synth-submenu');
        if (submenu) {
            submenu.classList.toggle('hidden');
        }
    } else {
        // Close synth submenu if clicking elsewhere
        const synthSubmenu = document.getElementById('synth-submenu');
        if (synthSubmenu && !synthSubmenu.contains(e.target)) {
             // Only close if we are not clicking the button (handled above)
             // And if we are active?
             // Actually, if we click "Piano", handleInstrumentSelect closes everything.
             // If we click empty space in instrument menu?
             // Let's just leave it open unless clicked again or instrument selected.
        }
    }
});
