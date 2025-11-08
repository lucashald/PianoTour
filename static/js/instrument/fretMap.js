// fretMap.js - Interactive Fretboard Manager
// Extracted from fret.html and enhanced for modular integration

// ===================================================================
// Required CSS Classes
// ===================================================================
/*
Add these CSS classes to your stylesheet for proper visual feedback:

.note-marker.playing {
    background-color: var(--color-green-light);
    transform: translate(-50%, -50%) scale(1.2);
    box-shadow: 0 0 10px var(--color-green-medium);
}

.note-marker.sustained {
    background-color: var(--color-yellow-medium);
    border-color: var(--color-yellow-light);
    box-shadow: 0 0 15px var(--color-yellow-medium);
    animation: pulse 1s infinite alternate;
}

@keyframes pulse {
    from { opacity: 0.8; }
    to { opacity: 1; }
}
*/

// ===================================================================
// Imports
// ===================================================================

import { trigger, triggerAttackRelease } from './playbackHelpers.js';
import { pianoState } from '../core/appState.js';
import { NOTES_BY_NAME } from '../core/note-data.js';

// ===================================================================
// Core Fretboard Manager Class
// ===================================================================

export class FretMap {
    constructor() {
        this.allNotes = null;
        this.isInitialized = false;
        this.audioEnabled = true; // Control audio playback
        this.playingNotes = new Set(); // Track currently playing notes
        // Timers for delayed sustained start to distinguish clicks vs holds
        this._sustainTimers = new Map();
        // Recently sustained notes map to timestamp to prevent click-after-sustain double-play
        this._recentSustained = new Map();
        // Playback highlighting state: per-element ref count to avoid flicker during overlaps
        this._playbackCounts = new Map();
    }

    /**
     * Initialize the fretboard interaction system
     * Should be called after the DOM is loaded and fretboard HTML is present
     */
    initialize() {
        // Get all elements with the class 'note-marker' and store them
        this.allNotes = document.querySelectorAll('.note-marker');
        
        if (this.allNotes.length === 0) {

            return false;
        }

        this.setupEventListeners();
        this.isInitialized = true;

        return true;
    }

    /**
     * Set up click event listeners for all note buttons
     */
    setupEventListeners() {
        // Add click event listeners to every note button
        this.allNotes.forEach(noteButton => {
            // Click event for note highlighting and short audio
            // NOTE: we intentionally avoid adding mousedown/mouseup listeners here
            // to prevent duplicate audio when the browser fires both mouse and click events.
            noteButton.addEventListener('click', (event) => {
                this.handleNoteClick(noteButton, event);
            });
        });
    }

    /**
     * Handle click events on note buttons
     * @param {Element} noteButton - The clicked note button
     * @param {Event} event - The click event
     */
    handleNoteClick(noteButton, event) {
        // Get the 'data-note' attribute from the button that was clicked
        const noteToHighlight = noteButton.getAttribute('data-note');
        const isAlreadyHighlighted = noteButton.classList.contains('highlight');

        // Determine a consistent key for this note (same as sustained handlers)
        const fretPosition = noteButton.closest('.fret-position');
        const stringNum = fretPosition ? fretPosition.getAttribute('data-string') : null;
        const fretNum = fretPosition ? fretPosition.getAttribute('data-fret') : null;
        const noteKey = `${stringNum}-${fretNum}`;

        // If this note was recently played as a sustained note, skip the short playback.
        // This covers the case where a user holds (sustain started) and releases — the
        // subsequent click event should not play a short attackRelease as well.
        const RECENT_SUSTAIN_MS = 350;
        const recentTs = this._recentSustained.get(noteKey);
        const now = Date.now();

        if (this.audioEnabled && noteToHighlight) {
            if (this.playingNotes.has(noteKey)) {
                console.log(`FretMap: Skipping short playback for ${noteToHighlight} (sustained active)`);
            } else if (recentTs && (now - recentTs) < RECENT_SUSTAIN_MS) {
                console.log(`FretMap: Skipping short playback for ${noteToHighlight} (recently sustained)`);
                // Clean up old marker
                this._recentSustained.delete(noteKey);
            } else {
                this.playNote(noteButton, noteToHighlight);
            }
        }

        // First, remove the 'highlight' class from all notes to reset the board
        this.clearAllHighlights();

        // If the clicked note was NOT already highlighted, we proceed to highlight its matches
        // This creates a toggle effect: clicking a highlighted note will clear all highlights
        if (!isAlreadyHighlighted) {
            this.highlightNote(noteToHighlight);
        }

        // Dispatch custom event for external listeners
        this.dispatchNoteEvent('noteClick', {
            note: noteToHighlight,
            button: noteButton,
            isHighlighted: !isAlreadyHighlighted,
            originalEvent: event
        });
    }

    /**
     * Handle mouse down events for sustained note playback
     * @param {Element} noteButton - The note button element
     * @param {Event} event - The mouse event
     */
    handleNoteStart(noteButton, event) {
        if (!this.audioEnabled) return;

        const noteName = noteButton.getAttribute('data-note');
        if (!noteName) return;

        // Prevent starting if already playing
        const noteKey = `${noteButton.getAttribute('data-string')}-${noteButton.getAttribute('data-fret')}`;
        if (this.playingNotes.has(noteKey)) return;

        // Delay sustained start slightly to differentiate quick clicks from holds
        // If the user releases before this timeout, the sustained attack won't happen.
        const SUSTAIN_DELAY_MS = 150;
        const timer = setTimeout(() => {
            try {
                const fretPosition = noteButton.closest('.fret-position');
                const stringNum = fretPosition ? fretPosition.getAttribute('data-string') : null;
                const fretNum = fretPosition ? fretPosition.getAttribute('data-fret') : null;
                const midiNote = this.calculateMidiNote(noteName, stringNum, fretNum);

                if (midiNote) {
                    // Use trigger for sustained notes (on = true)
                    trigger(midiNote, true, pianoState.velocity);
                    this.playingNotes.add(noteKey);
                    noteButton.classList.add('sustained');
                    console.log(`FretMap: Started sustained note ${noteName} (${midiNote})`);
                }
            } catch (error) {
                console.warn('FretMap: Error starting sustained note:', error);
            }
            this._sustainTimers.delete(noteKey);
        }, SUSTAIN_DELAY_MS);

        // Store timer so it can be cancelled on mouseup/mouseleave
        this._sustainTimers.set(noteKey, timer);

        // Prevent default to avoid text selection
        event.preventDefault();
    }

    /**
     * Handle mouse up/leave events to stop sustained notes
     * @param {Element} noteButton - The note button element
     * @param {Event} event - The mouse event
     */
    handleNoteEnd(noteButton, event) {
        if (!this.audioEnabled) return;

        const noteName = noteButton.getAttribute('data-note');
        if (!noteName) return;

        const noteKey = `${noteButton.getAttribute('data-string')}-${noteButton.getAttribute('data-fret')}`;
        if (!this.playingNotes.has(noteKey)) return;

        // If there was a pending sustain timer (user released before sustain delay), cancel it
        const pendingTimer = this._sustainTimers.get(noteKey);
        if (pendingTimer) {
            clearTimeout(pendingTimer);
            this._sustainTimers.delete(noteKey);
            // Mark as recently sustained to prevent immediate click playback (mouseup may be followed by click)
            this._recentSustained.set(noteKey, Date.now());
            // No actual sustain was started, just exit
            return;
        }

        try {
            // Calculate MIDI note to stop
            const fretPosition = noteButton.closest('.fret-position');
            const stringNum = fretPosition ? fretPosition.getAttribute('data-string') : null;
            const fretNum = fretPosition ? fretPosition.getAttribute('data-fret') : null;
            const midiNote = this.calculateMidiNote(noteName, stringNum, fretNum);
            
            if (midiNote) {
                // Use trigger to stop the note (on = false)
                trigger(midiNote, false, pianoState.velocity);
                this.playingNotes.delete(noteKey);
                noteButton.classList.remove('sustained');
                // Mark recently sustained so subsequent click doesn't retrigger short playback
                this._recentSustained.set(noteKey, Date.now());
                console.log(`FretMap: Stopped sustained note ${noteName} (${midiNote})`);
            }
        } catch (error) {
            console.warn('FretMap: Error stopping sustained note:', error);
        }
    }

    /**
     * Highlight multiple notes specifically for playback (uses distinct class).
     * Accepts note names with octave, e.g., "C4", "G#3". Highlights all fret positions of each pitch.
     * @param {string[]|string} noteNames
     */
    addPlaybackHighlight(noteNames) {
        const names = Array.isArray(noteNames) ? noteNames : [noteNames];
        names.forEach((n) => {
            const canonical = this._toCanonicalDataNote(n);
            if (!canonical) return;
            const els = document.querySelectorAll(`.note-marker[data-note="${canonical}"]`);
            els.forEach((el) => {
                const count = this._playbackCounts.get(el) || 0;
                if (count === 0) {
                    el.classList.add('playback-highlight');
                }
                this._playbackCounts.set(el, count + 1);
            });
        });
    }

    /**
     * Clear playback highlight. If noteNames are provided, clears only those;
     * otherwise clears all active playback highlights.
     * @param {string[]|string=} noteNames
     */
    clearPlaybackHighlight(noteNames) {
        if (!noteNames) {
            // Clear all
            this._playbackCounts.forEach((_, el) => el.classList.remove('playback-highlight'));
            this._playbackCounts.clear();
            return;
        }
        const names = Array.isArray(noteNames) ? noteNames : [noteNames];
        names.forEach((n) => {
            const canonical = this._toCanonicalDataNote(n);
            if (!canonical) return;
            const els = document.querySelectorAll(`.note-marker[data-note="${canonical}"]`);
            els.forEach((el) => {
                const count = this._playbackCounts.get(el) || 0;
                if (count <= 1) {
                    el.classList.remove('playback-highlight');
                    this._playbackCounts.delete(el);
                } else {
                    this._playbackCounts.set(el, count - 1);
                }
            });
        });
    }

    /**
     * Optional styling hook for playback highlight mode.
     * Currently a no-op placeholder; can be extended to toggle container CSS classes.
     */
    setPlaybackHighlightStyle(/* options */) {
        // Intentionally minimal; styling is handled by CSS class `.playback-highlight`
    }

    /**
     * Convert various note formats (e.g., "C4", "Db5", "F#") to fretboard data-note canonical form.
     * Canonical formats (as used in DOM): naturals: "C", sharps/flats: "C#_Db", "D#_Eb", "F#_Gb", "G#_Ab", "A#_Bb".
     * @param {string} noteName
     * @returns {string|null}
     */
    _toCanonicalDataNote(noteName) {
        if (!noteName) return null;
        const m = String(noteName).trim().match(/^([A-Ga-g])([#b]?)/);
        if (!m) return null;
        const letter = m[1].toUpperCase();
        const accidental = m[2] || '';
        const pitch = letter + accidental;

        const pairs = {
            'C#': 'C#_Db', 'Db': 'C#_Db',
            'D#': 'D#_Eb', 'Eb': 'D#_Eb',
            'F#': 'F#_Gb', 'Gb': 'F#_Gb',
            'G#': 'G#_Ab', 'Ab': 'G#_Ab',
            'A#': 'A#_Bb', 'Bb': 'A#_Bb',
        };
        if (!accidental) return letter;
        return pairs[pitch] || null;
    }

    /**
     * Clear all note highlights on the fretboard
     */
    clearAllHighlights() {
        if (!this.allNotes) return;
        
        this.allNotes.forEach(btn => {
            btn.classList.remove('highlight');
        });
    }

    /**
     * Highlight all instances of a specific note on the fretboard
     * @param {string} noteName - The note to highlight (matches data-note attribute)
     */
    highlightNote(noteName) {
        if (!noteName) return;

        // Find all notes that have the same 'data-note' value
        const notesToMatch = document.querySelectorAll(`[data-note="${noteName}"]`);
        
        // Add the 'highlight' class to all the matching notes
        notesToMatch.forEach(match => {
            match.classList.add('highlight');
        });

        console.log(`FretMap: Highlighted ${notesToMatch.length} instances of note: ${noteName}`);
    }

    /**
     * Highlight multiple notes simultaneously
     * @param {string[]} noteNames - Array of note names to highlight
     */
    highlightNotes(noteNames) {
        if (!Array.isArray(noteNames)) return;

        this.clearAllHighlights();
        noteNames.forEach(noteName => {
            const notesToMatch = document.querySelectorAll(`[data-note="${noteName}"]`);
            notesToMatch.forEach(match => {
                match.classList.add('highlight');
            });
        });
    }

    /**
     * Get all note elements for a specific note name
     * @param {string} noteName - The note name to find
     * @returns {NodeList} All matching note elements
     */
    getNoteElements(noteName) {
        return document.querySelectorAll(`[data-note="${noteName}"]`);
    }

    /**
     * Get the note name from a specific string and fret position
     * @param {number} stringIndex - String index (0-5, where 0 is highest string)
     * @param {number} fretNumber - Fret number (0-12)
     * @returns {string|null} The note name or null if not found
     */
    getNoteAtPosition(stringIndex, fretNumber) {
        // This is a simplified implementation - in a full version,
        // this would calculate based on tuning and fret position
        const selector = `.fretboard > div:nth-child(${(stringIndex * 14) + fretNumber + 2}) .note`;
        const noteElement = document.querySelector(selector);
        return noteElement ? noteElement.getAttribute('data-note') : null;
    }

    /**
     * Dispatch custom events for external listeners
     * @param {string} eventType - The type of event to dispatch
     * @param {Object} detail - Event detail data
     */
    dispatchNoteEvent(eventType, detail) {
        const customEvent = new CustomEvent(`fretMap:${eventType}`, {
            detail: detail,
            bubbles: true
        });
        document.dispatchEvent(customEvent);
    }

    /**
     * Check if the fretboard is initialized
     * @returns {boolean} True if initialized
     */
    isReady() {
        return this.isInitialized && this.allNotes && this.allNotes.length > 0;
    }

    /**
     * Refresh the fretboard (re-scan for note elements)
     * Useful if the fretboard HTML has been dynamically updated
     */
    refresh() {
        console.log('FretMap: Refreshing...');
        return this.initialize();
    }

    // ===================================================================
    // Audio Playback Methods
    // ===================================================================

    /**
     * Play a note with audio feedback
     * @param {Element} noteButton - The note button element
     * @param {string} noteName - The note name to play
     */
    playNote(noteButton, noteName) {
        if (!this.audioEnabled || !noteName) return;

        try {
            // Get the fret position to calculate the correct octave
            const fretPosition = noteButton.closest('.fret-position');
            const stringNum = fretPosition ? fretPosition.getAttribute('data-string') : null;
            const fretNum = fretPosition ? fretPosition.getAttribute('data-fret') : null;

            // Calculate the MIDI note for this fret position
            const midiNote = this.calculateMidiNote(noteName, stringNum, fretNum);
            
            if (midiNote) {
                // Use triggerAttackRelease for a short note
                triggerAttackRelease(midiNote, '8n', pianoState.velocity, false);
                
                console.log(`FretMap: Played ${noteName} (${midiNote}) - String ${stringNum}, Fret ${fretNum}`);
                
                // Add visual feedback
                this.addPlayingFeedback(noteButton);
            }
        } catch (error) {
            console.warn('FretMap: Error playing note:', error);
        }
    }

    /**
     * Calculate the MIDI note for a given fret position
     * @param {string} noteName - The note name (e.g., "C", "F#_Gb")
     * @param {string|number} stringNum - String number (1-6)
     * @param {string|number} fretNum - Fret number (0-24)
     * @returns {string|null} MIDI note name with octave (e.g., "C4", "F#3")
     */
    calculateMidiNote(noteName, stringNum, fretNum) {
        if (!noteName || !stringNum) return null;

        // Parse the note name (handle compound notes like "F#_Gb")
        const cleanNote = this.parseNoteName(noteName);
        if (!cleanNote) return null;

        // Standard guitar tuning open string MIDI notes (string 1-6)
        const openStringMidi = {
            '1': 64, // E4 (high E)
            '2': 59, // B3
            '3': 55, // G3
            '4': 50, // D3
            '5': 45, // A2
            '6': 40  // E2 (low E)
        };

        const openMidi = openStringMidi[stringNum.toString()];
        if (openMidi === undefined) return null;

        // Calculate the MIDI number by adding fret number to open string
        const fretNumber = parseInt(String(fretNum || 0));
        const targetMidi = openMidi + fretNumber;
        
        // Convert MIDI number to note name with octave
        return this.midiToNoteName(targetMidi);
    }

    /**
     * Parse note name to get the primary note
     * @param {string} noteName - Note name like "F#_Gb" or "C"
     * @returns {string|null} Clean note name like "F#" or "C"
     */
    parseNoteName(noteName) {
        if (!noteName) return null;
        
        // Handle compound notes like "F#_Gb" - take the first part
        const parts = noteName.split('_');
        return parts[0] || null;
    }

    /**
     * Convert MIDI number to note name with octave
     * @param {number} midiNumber - MIDI note number
     * @returns {string} Note name with octave (e.g., "C4", "F#3")
     */
    midiToNoteName(midiNumber) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNumber / 12) - 1;
        const noteIndex = midiNumber % 12;
        return noteNames[noteIndex] + octave;
    }

    /**
     * Add visual feedback when a note is played
     * @param {Element} noteButton - The note button element
     */
    addPlayingFeedback(noteButton) {
        // Add a temporary 'playing' class for visual feedback
        noteButton.classList.add('playing');
        
        // Remove the class after a short duration
        setTimeout(() => {
            noteButton.classList.remove('playing');
        }, 200);
    }

    /**
     * Enable or disable audio playback
     * @param {boolean} enabled - Whether audio should be enabled
     */
    setAudioEnabled(enabled) {
        this.audioEnabled = enabled;
        console.log(`FretMap: Audio ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Play a chord (multiple notes)
     * @param {string[]} noteNames - Array of note names to play
     */
    playChord(noteNames) {
        if (!this.audioEnabled || !Array.isArray(noteNames)) return;

        try {
            // Find the first occurrence of each note to get string/fret info
            const midiNotes = [];
            
            noteNames.forEach(noteName => {
                const noteElement = document.querySelector(`[data-note="${noteName}"]`);
                if (noteElement) {
                    const fretPosition = noteElement.closest('.fret-position');
                    const stringNum = fretPosition ? fretPosition.getAttribute('data-string') : null;
                    const fretNum = fretPosition ? fretPosition.getAttribute('data-fret') : null;
                    
                    const midiNote = this.calculateMidiNote(noteName, stringNum, fretNum);
                    if (midiNote) {
                        midiNotes.push(midiNote);
                    }
                }
            });

            if (midiNotes.length > 0) {
                // Play all notes as a chord
                triggerAttackRelease(midiNotes, '2n', pianoState.velocity, false);
                console.log(`FretMap: Played chord:`, midiNotes);
            }
        } catch (error) {
            console.warn('FretMap: Error playing chord:', error);
        }
    }

    /**
     * Stop all currently sustained notes
     */
    stopAllSustainedNotes() {
        this.playingNotes.forEach(noteKey => {
            const [stringNum, fretNum] = noteKey.split('-');
            const noteElement = document.querySelector(`[data-string="${stringNum}"][data-fret="${fretNum}"] .note-marker`);
            if (noteElement) {
                this.handleNoteEnd(noteElement, new Event('manual'));
            }
        });
        
        // Clear the set and remove all sustained classes
        this.playingNotes.clear();
        document.querySelectorAll('.note-marker.sustained').forEach(el => {
            el.classList.remove('sustained');
        });
        
        console.log('FretMap: Stopped all sustained notes');
    }
}

// ===================================================================
// Auto-initialization and Global Instance
// ===================================================================

// Create global instance
let fretMapInstance = null;

/**
 * Get the global FretMap instance
 * @returns {FretMap} The global fretboard instance
 */
export function getFretMap() {
    if (!fretMapInstance) {
        fretMapInstance = new FretMap();
    }
    return fretMapInstance;
}

/**
 * Initialize the fretboard when DOM is ready
 * This maintains compatibility with the original inline script behavior
 */
function initializeFretMap() {
    const fretMap = getFretMap();
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            fretMap.initialize();
        });
    } else {
        // DOM is already loaded
        fretMap.initialize();
    }
}

// Auto-initialize when this module is imported
initializeFretMap();

// ===================================================================
// Utility Functions
// ===================================================================

/**
 * Parse note names that may contain sharps/flats
 * @param {string} noteString - Note string like "F#_Gb" or "C"
 * @returns {Object} Parsed note information
 */
export function parseNoteString(noteString) {
    if (!noteString) return null;
    
    // Handle compound notes like "F#_Gb"
    const parts = noteString.split('_');
    const primaryNote = parts[0];
    const alternateNote = parts[1] || null;
    
    return {
        primary: primaryNote,
        alternate: alternateNote,
        original: noteString
    };
}

/**
 * Check if two note strings represent the same note (enharmonic equivalents)
 * @param {string} note1 - First note string
 * @param {string} note2 - Second note string
 * @returns {boolean} True if they represent the same note
 */
export function areNotesEquivalent(note1, note2) {
    if (note1 === note2) return true;
    
    const parsed1 = parseNoteString(note1);
    const parsed2 = parseNoteString(note2);
    
    if (!parsed1 || !parsed2) return false;
    
    // Check if any combination matches
    return parsed1.primary === parsed2.primary ||
           parsed1.primary === parsed2.alternate ||
           parsed1.alternate === parsed2.primary ||
           parsed1.alternate === parsed2.alternate;
}

// ===================================================================
// Export default instance for convenience
// ===================================================================

export default getFretMap();
