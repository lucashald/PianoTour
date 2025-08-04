// GuitarInstrument.js - Guitar-specific instrument implementation

import { BaseInstrument } from './BaseInstrument.js';
import { GuitarRenderer } from './GuitarRenderer.js';

/**
 * Guitar instrument implementation with support for:
 * - Standard notation and tablature
 * - Chord shapes and progressions
 * - Fret and string positions
 * - Guitar-specific techniques (bends, slides, etc.)
 */
export class GuitarInstrument extends BaseInstrument {
    // Guitar-specific constants
    static get STRINGS() {
        return {
            E_HIGH: { number: 1, openNote: 'E4', name: 'High E' },
            B: { number: 2, openNote: 'B3', name: 'B' },
            G: { number: 3, openNote: 'G3', name: 'G' },
            D: { number: 4, openNote: 'D3', name: 'D' },
            A: { number: 5, openNote: 'A2', name: 'A' },
            E_LOW: { number: 6, openNote: 'E2', name: 'Low E' }
        };
    }

    static get FRET_RANGE() {
        return { min: 0, max: 24 }; // 0 = open string
    }

    static get CHORD_SHAPES() {
        return {
            // Major chords
            C: { name: 'C Major', frets: [0, 1, 0, 2, 3, -1], fingers: [0, 1, 0, 2, 3, 0] },
            D: { name: 'D Major', frets: [2, 2, 3, 2, -1, -1], fingers: [1, 1, 3, 2, 0, 0] },
            E: { name: 'E Major', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
            F: { name: 'F Major', frets: [1, 1, 3, 3, 2, 1], fingers: [1, 1, 3, 4, 2, 1] },
            G: { name: 'G Major', frets: [3, 2, 0, 0, 3, 3], fingers: [3, 2, 0, 0, 4, 4] },
            A: { name: 'A Major', frets: [0, 2, 2, 2, 0, -1], fingers: [0, 1, 2, 3, 0, 0] },
            B: { name: 'B Major', frets: [2, 2, 4, 4, 4, 2], fingers: [1, 1, 2, 3, 4, 1] },

            // Minor chords
            Am: { name: 'A Minor', frets: [0, 1, 2, 2, 0, -1], fingers: [0, 1, 2, 3, 0, 0] },
            Dm: { name: 'D Minor', frets: [1, 3, 2, 0, -1, -1], fingers: [1, 4, 2, 0, 0, 0] },
            Em: { name: 'E Minor', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 1, 2, 0, 0, 0] },
            Fm: { name: 'F Minor', frets: [1, 1, 3, 3, 1, 1], fingers: [1, 1, 3, 4, 1, 1] },
            Gm: { name: 'G Minor', frets: [3, 3, 5, 5, 4, 3], fingers: [1, 1, 3, 4, 2, 1] },

            // Seventh chords
            G7: { name: 'G7', frets: [1, 2, 0, 0, 3, 3], fingers: [1, 2, 0, 0, 4, 4] },
            C7: { name: 'C7', frets: [0, 1, 3, 2, 3, -1], fingers: [0, 1, 4, 2, 3, 0] },
            D7: { name: 'D7', frets: [2, 1, 2, 2, -1, -1], fingers: [2, 1, 3, 3, 0, 0] },
            E7: { name: 'E7', frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
            A7: { name: 'A7', frets: [0, 2, 0, 2, 0, -1], fingers: [0, 2, 0, 3, 0, 0] },
        };
    }

    static get TECHNIQUES() {
        return {
            NORMAL: 'normal',
            BEND: 'bend',
            SLIDE: 'slide',
            HAMMER_ON: 'hammer-on',
            PULL_OFF: 'pull-off',
            VIBRATO: 'vibrato',
            MUTE: 'mute',
            HARMONIC: 'harmonic'
        };
    }

    constructor(config = {}) {
        super({
            instrumentType: BaseInstrument.TYPES.GUITAR,
            defaultTempo: config.defaultTempo || 120,
            storageKey: 'autosaved-guitar-score',
            selectors: {
                scoreContainer: '#guitar-score',
                scoreWrap: '#guitar-score-wrap',
                playButton: '#play-guitar-score-btn',
                stopButton: '#stop-guitar-score-btn',
                clearButton: '#clear-guitar-score-btn',
                undoButton: '#undo-guitar-btn',
                addMeasureButton: '#add-guitar-measure-btn',
                // Guitar-specific selectors
                fretSelector: '#guitar-fret-selector',
                stringSelector: '#guitar-string-selector',
                chordButtons: '.guitar-chord-btn',
                techniqueSelector: '#guitar-technique-selector',
                tabModeToggle: '#guitar-tab-mode-toggle',
                ...config.selectors
            },
            ...config
        });

        // Guitar-specific state
        this.selectedFret = 0;
        this.selectedString = 1;
        this.selectedTechnique = GuitarInstrument.TECHNIQUES.NORMAL;
        this.selectedDuration = 'q';
        this.showTablature = true;
        this.showStandardNotation = true;

        // UI state
        this.activeFretButtons = new Set();
        this.selectedChord = null;
        this.chordMode = false; // Single notes vs chord mode

        console.log('🎸 Guitar instrument created');
    }

    // ===================================================================
    // Abstract Method Implementations
    // ===================================================================

    initializeRenderer() {
        this.renderingEngine = new GuitarRenderer({
            container: this.selectors.scoreContainer,
            showTablature: this.showTablature,
            showStandardNotation: this.showStandardNotation
        });
    }

    createNoteData(params) {
        const {
            fret = this.selectedFret,
            string = this.selectedString,
            duration = this.selectedDuration,
            technique = this.selectedTechnique,
            isRest = false,
            isChord = false,
            chordShape = null
        } = params;

        // Validate parameters
        if (!isRest) {
            if (fret < GuitarInstrument.FRET_RANGE.min || fret > GuitarInstrument.FRET_RANGE.max) {
                throw new Error(`Fret ${fret} out of range`);
            }
            if (string < 1 || string > 6) {
                throw new Error(`String ${string} out of range`);
            }
        }

        const noteData = {
            id: this._generateNoteId(),
            instrumentType: 'guitar',
            duration,
            isRest,
            technique,
            timestamp: Date.now()
        };

        if (isChord && chordShape) {
            // Chord note
            noteData.isChord = true;
            noteData.chordName = chordShape.name;
            noteData.chordShape = chordShape;
            noteData.notes = this._chordShapeToNotes(chordShape);
        } else if (!isRest) {
            // Single note
            noteData.fret = fret;
            noteData.string = string;
            noteData.note = this._fretToNote(string, fret);
            noteData.notes = [noteData.note]; // For compatibility with audio engine
        }

        return noteData;
    }

    validateNoteData(noteData) {
        if (!noteData || typeof noteData !== 'object') {
            return false;
        }

        // Check required fields
        if (!noteData.duration || !noteData.technique) {
            return false;
        }

        // Validate duration
        const validDurations = ['w', 'h', 'q', '8', '16', '32', 'h.', 'q.', '8.', '16.', '32.'];
        if (!validDurations.includes(noteData.duration)) {
            return false;
        }

        // Validate technique
        if (!Object.values(GuitarInstrument.TECHNIQUES).includes(noteData.technique)) {
            return false;
        }

        if (!noteData.isRest) {
            if (noteData.isChord) {
                // Validate chord data
                return noteData.chordShape && noteData.notes && Array.isArray(noteData.notes);
            } else {
                // Validate single note data
                if (typeof noteData.fret !== 'number' || typeof noteData.string !== 'number') {
                    return false;
                }
                if (noteData.fret < 0 || noteData.fret > 24) {
                    return false;
                }
                if (noteData.string < 1 || noteData.string > 6) {
                    return false;
                }
            }
        }

        return true;
    }

    playNote(noteData, velocity = 1, time = undefined) {
        if (!this.audioEngine.isReady) {
            console.warn('Audio engine not ready');
            return;
        }

        if (noteData.isRest) {
            return; // Nothing to play for rests
        }

        const playTime = time || Tone.now();

        try {
            if (noteData.isChord && noteData.notes) {
                // Play all notes in the chord
                noteData.notes.forEach(note => {
                    this.audioEngine.triggerAttack(note, playTime, velocity * 0.8); // Slightly quieter for chords
                });
            } else if (noteData.note) {
                // Play single note
                this.audioEngine.triggerAttack(noteData.note, playTime, velocity);
            }

            // Handle guitar-specific techniques
            this._applyTechnique(noteData, playTime, velocity);

        } catch (error) {
            console.error('Error playing guitar note:', error);
        }
    }

    stopNote(noteData, time = undefined) {
        if (!this.audioEngine.isReady || noteData.isRest) {
            return;
        }

        const stopTime = time || Tone.now();

        try {
            if (noteData.isChord && noteData.notes) {
                noteData.notes.forEach(note => {
                    this.audioEngine.triggerRelease(note, stopTime);
                });
            } else if (noteData.note) {
                this.audioEngine.triggerRelease(noteData.note, stopTime);
            }
        } catch (error) {
            console.error('Error stopping guitar note:', error);
        }
    }

    getInstrumentEventHandlers() {
        return {
            // Fret selection
            [this.selectors.fretSelector]: {
                event: 'change',
                callback: this._handleFretSelection
            },

            // String selection  
            [this.selectors.stringSelector]: {
                event: 'change',
                callback: this._handleStringSelection
            },

            // Guitar technique selection
            [this.selectors.techniqueSelector]: {
                event: 'change',
                callback: this._handleTechniqueSelection
            },

            // Tablature mode toggle
            [this.selectors.tabModeToggle]: {
                event: 'change',
                callback: this._handleTabModeToggle
            },

            // Duration buttons (delegate to common handler)
            '[data-guitar-duration]': {
                event: 'click',
                callback: this._handleDurationSelection
            },

            // Add single note button
            '#add-guitar-note-btn': this._handleAddNote,

            // Chord mode toggle
            '#guitar-chord-mode-btn': this._handleChordModeToggle,

            // Rest button
            '#add-guitar-rest-btn': this._handleAddRest
        };
    }

    // ===================================================================
    // Guitar-Specific Public Methods
    // ===================================================================

    /**
     * Add a chord to the score
     */
    addChord(chordName, duration = this.selectedDuration) {
        const chordShape = GuitarInstrument.CHORD_SHAPES[chordName];
        if (!chordShape) {
            console.error(`Unknown chord: ${chordName}`);
            return null;
        }

        const chordNote = this.createNoteData({
            duration,
            isChord: true,
            chordShape
        });

        return this.addNote(undefined, chordNote);
    }

    /**
     * Set guitar-specific playing technique
     */
    setTechnique(technique) {
        if (!Object.values(GuitarInstrument.TECHNIQUES).includes(technique)) {
            console.error(`Invalid technique: ${technique}`);
            return false;
        }

        this.selectedTechnique = technique;
        this._updateTechniqueUI();
        return true;
    }

    /**
     * Set fret position
     */
    setFret(fret) {
        if (fret < GuitarInstrument.FRET_RANGE.min || fret > GuitarInstrument.FRET_RANGE.max) {
            console.error(`Fret ${fret} out of range`);
            return false;
        }

        this.selectedFret = fret;
        this._updateFretUI();
        return true;
    }

    /**
     * Set string selection
     */
    setString(string) {
        if (string < 1 || string > 6) {
            console.error(`String ${string} out of range`);
            return false;
        }

        this.selectedString = string;
        this._updateStringUI();
        return true;
    }

    /**
     * Toggle between single note and chord mode
     */
    toggleChordMode() {
        this.chordMode = !this.chordMode;
        this._updateChordModeUI();
        this._emitEvent('chordModeChanged', { chordMode: this.chordMode });
    }

    /**
     * Get available chord shapes
     */
    getAvailableChords() {
        return Object.keys(GuitarInstrument.CHORD_SHAPES);
    }

    /**
     * Get note name for a fret position on a string
     */
    getFretNote(string, fret) {
        return this._fretToNote(string, fret);
    }

    // ===================================================================
    // Private Methods - Conversion Utilities
    // ===================================================================

    _fretToNote(string, fret) {
        const stringData = Object.values(GuitarInstrument.STRINGS).find(s => s.number === string);
        if (!stringData) {
            throw new Error(`Invalid string: ${string}`);
        }

        // Convert open string note to MIDI number, add fret offset
        const openNote = stringData.openNote;
        const midiBase = this._noteToMidi(openNote);
        const targetMidi = midiBase + fret;

        return this._midiToNote(targetMidi);
    }

    _chordShapeToNotes(chordShape) {
        const notes = [];
        chordShape.frets.forEach((fret, index) => {
            if (fret >= 0) { // -1 means don't play this string
                const string = 6 - index; // Reverse order (low E to high E)
                const note = this._fretToNote(string, fret);
                notes.push(note);
            }
        });
        return notes;
    }

    _noteToMidi(note) {
        // Simple conversion - in a real implementation you'd want a more robust converter
        const noteMap = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4,
            'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9,
            'A#': 10, 'Bb': 10, 'B': 11
        };

        const match = note.match(/^([A-G][#b]?)(\d+)$/);
        if (!match) throw new Error(`Invalid note: ${note}`);

        const [, noteName, octave] = match;
        return (parseInt(octave) + 1) * 12 + noteMap[noteName];
    }

    _midiToNote(midi) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const note = noteNames[midi % 12];
        return `${note}${octave}`;
    }

    // ===================================================================
    // Private Methods - Technique Handling
    // ===================================================================

    _applyTechnique(noteData, time, velocity) {
        switch (noteData.technique) {
            case GuitarInstrument.TECHNIQUES.BEND:
                this._applyBend(noteData, time, velocity);
                break;
            case GuitarInstrument.TECHNIQUES.SLIDE:
                this._applySlide(noteData, time, velocity);
                break;
            case GuitarInstrument.TECHNIQUES.VIBRATO:
                this._applyVibrato(noteData, time, velocity);
                break;
            case GuitarInstrument.TECHNIQUES.MUTE:
                // Muted notes are shorter and quieter
                break;
            default:
                // Normal playing - no special processing needed
                break;
        }
    }

    _applyBend(noteData, time, velocity) {
        // Implement bend effect - pitch envelope
        // This would require more advanced Tone.js techniques
        console.log('🎸 Applying bend technique');
    }

    _applySlide(noteData, time, velocity) {
        // Implement slide effect - pitch glide
        console.log('🎸 Applying slide technique');
    }

    _applyVibrato(noteData, time, velocity) {
        // Implement vibrato effect - pitch modulation
        console.log('🎸 Applying vibrato technique');
    }

    // ===================================================================
    // Private Methods - Event Handlers
    // ===================================================================

    _handleFretSelection(event) {
        const fret = parseInt(event.target.value);
        this.setFret(fret);
    }

    _handleStringSelection(event) {
        const string = parseInt(event.target.value);
        this.setString(string);
    }

    _handleTechniqueSelection(event) {
        const technique = event.target.value;
        this.setTechnique(technique);
    }

    _handleDurationSelection(event) {
        this.selectedDuration = event.target.dataset.guitarDuration;
        this._updateDurationUI();
    }

    _handleTabModeToggle(event) {
        this.showTablature = event.target.checked;
        if (this.renderingEngine) {
            this.renderingEngine.setShowTablature(this.showTablature);
        }
        this.render();
    }

    _handleAddNote() {
        if (this.chordMode && this.selectedChord) {
            this.addChord(this.selectedChord);
        } else {
            const noteData = this.createNoteData({
                fret: this.selectedFret,
                string: this.selectedString,
                duration: this.selectedDuration,
                technique: this.selectedTechnique
            });
            this.addNote(undefined, noteData);
        }
    }

    _handleAddRest() {
        const restData = this.createNoteData({
            duration: this.selectedDuration,
            isRest: true
        });
        this.addNote(undefined, restData);
    }

    _handleChordModeToggle() {
        this.toggleChordMode();
    }

    _handleChordSelection(chordName) {
        this.selectedChord = chordName;
        this._updateChordUI();

        // If we're in chord mode, add the chord immediately
        if (this.chordMode) {
            this.addChord(chordName);
        }
    }

    // ===================================================================
    // Private Methods - UI Updates
    // ===================================================================

    _updateFretUI() {
        const fretSelector = document.querySelector(this.selectors.fretSelector);
        if (fretSelector) {
            fretSelector.value = this.selectedFret;
        }

        // Update fret display
        const fretDisplay = document.querySelector('#guitar-fret-display');
        if (fretDisplay) {
            fretDisplay.textContent = this.selectedFret === 0 ? 'Open' : `Fret ${this.selectedFret}`;
        }
    }

    _updateStringUI() {
        const stringSelector = document.querySelector(this.selectors.stringSelector);
        if (stringSelector) {
            stringSelector.value = this.selectedString;
        }

        // Update string display
        const stringDisplay = document.querySelector('#guitar-string-display');
        if (stringDisplay) {
            const stringInfo = Object.values(GuitarInstrument.STRINGS).find(s => s.number === this.selectedString);
            stringDisplay.textContent = stringInfo ? `${stringInfo.name} (${stringInfo.openNote})` : `String ${this.selectedString}`;
        }
    }

    _updateTechniqueUI() {
        const techniqueSelector = document.querySelector(this.selectors.techniqueSelector);
        if (techniqueSelector) {
            techniqueSelector.value = this.selectedTechnique;
        }
    }

    _updateDurationUI() {
        // Remove active class from all duration buttons
        document.querySelectorAll('[data-guitar-duration]').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to selected duration
        const selectedBtn = document.querySelector(`[data-guitar-duration="${this.selectedDuration}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }
    }

    _updateChordModeUI() {
        const chordModeBtn = document.querySelector('#guitar-chord-mode-btn');
        if (chordModeBtn) {
            chordModeBtn.classList.toggle('active', this.chordMode);
            chordModeBtn.textContent = this.chordMode ? 'Chord Mode' : 'Single Notes';
        }

        // Show/hide chord palette
        const chordPalette = document.querySelector('#guitar-chord-palette');
        if (chordPalette) {
            chordPalette.style.display = this.chordMode ? 'block' : 'none';
        }
    }

    _updateChordUI() {
        document.querySelectorAll('.guitar-chord-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        if (this.selectedChord) {
            const selectedBtn = document.querySelector(`[data-chord="${this.selectedChord}"]`);
            if (selectedBtn) {
                selectedBtn.classList.add('active');
            }
        }
    }

    // ===================================================================
    // Initialization Setup
    // ===================================================================

    async initialize() {
        await super.initialize();

        // Set up chord buttons
        this._setupChordButtons();

        // Initialize UI state
        this._updateFretUI();
        this._updateStringUI();
        this._updateTechniqueUI();
        this._updateDurationUI();
        this._updateChordModeUI();

        console.log('🎸 Guitar instrument fully initialized');
    }

    _setupChordButtons() {
        // Create chord buttons if they don't exist
        const chordPalette = document.querySelector('#guitar-chord-palette');
        if (chordPalette) {
            Object.entries(GuitarInstrument.CHORD_SHAPES).forEach(([chordName, chordData]) => {
                const button = document.createElement('button');
                button.className = 'guitar-chord-btn';
                button.dataset.chord = chordName;
                button.textContent = chordName;
                button.title = chordData.name;
                
                button.addEventListener('click', () => {
                    this._handleChordSelection(chordName);
                });

                chordPalette.appendChild(button);
            });
        }
    }
}

export default GuitarInstrument;