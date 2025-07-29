// appState.js
// This file serves as the central location for the application's state.

// Centralized state object for all mutable variables
export const pianoState = {
    // UI Interaction State
    toggleLabels: false,
    isMajorChordMode: false,
    isMinorChordMode: false,
    chordButtonMode: 0, // 0: Hidden, 1: Bass, 2: Treble

        // In your pianoState initialization, add:
    isDragging: false,
    currentlyPlayingKeys: new Set(), // Track drag-playing keys
    lastDraggedKey: null, // Prevent rapid retriggering

    // Musical State (Instrument-specific)
    keySignature: 'C',
    keySignatureType: '#', // Enharmonic preference
    isMinorKey: false,
    tempo: 120,
    timeSignature: {
        numerator: 4,
        denominator: 4
    },
    instrument: 'piano',
    midiChannel: '0',
    chordCenterNote: 'E4', // Default chord center for chord mode
    scaleTonic: 'C4',      // Default scale tonic for diatonic chords
    baseIdx: 0,            // Starting index for the playable piano view
    keyMap: {},            // Maps keyboard characters to MIDI notes
    held: new Map(),       // Tracks currently held computer keyboard keys

    // Active Note/Chord Tracking (Instrument-specific)
    activeDiatonicChords: {}, // Tracks currently held diatonic chords (from number keys)
    activeNotes: {},          // Tracks currently held individual notes (from mouse/keyboard)
    activeRests: {},          // Tracks currently held rest keys (z/x)
    hi: [],                   // Highlighted keys (single note mode)
    chordHi: [],              // Highlighted keys (chord mode)

    // Tone.js Audio State
    sampler: null,
    ctxStarted: false,
    samplerReady: false,

    // DOM Element References (set during initialization)
    noteEls: {},       // Map MIDI number to its SVG key element
    labelEls: {},      // Map MIDI number to its label SVG group
    svg: null,         // Main SVG piano element
    gw: null,          // SVG group for white keys
    gb: null,          // SVG group for black keys
    overlay: null,     // Hand overlay (slider) element
    gate: null,        // Gate/Unlock screen element
    isUnlocked: false,
	
	// Track user selections and playback.
	currentSelectedMeasure: -1,
    currentSelectedNote: null, // { measureIndex, clef, noteId }
    currentPlaybackNotes: new Set(),
};