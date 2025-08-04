// DrumInstrument.js - Drum kit instrument implementation

import { BaseInstrument } from './BaseInstrument.js';
import { DrumRenderer } from './DrumRenderer.js';

/**
 * Drum instrument implementation with support for:
 * - Full drum kit (kick, snare, hi-hats, toms, cymbals, percussion)
 * - Percussion notation on single staff
 * - Drum-specific techniques and articulations
 * - MIDI note mapping for realistic drum sounds
 */
export class DrumInstrument extends BaseInstrument {
    // Drum instrument definitions with VexFlow properties
    static get DRUM_INSTRUMENTS() {
        return {
            // Kicks
            kick: {
                name: 'Kick Drum',
                midi: 36,
                keys: ['C/5'],
                notehead: 'x',
                stemDirection: Vex.Flow.StaveNote.STEM_DOWN,
                sampleFile: 'kick.wav'
            },
            bassKick: {
                name: 'Bass Kick',
                midi: 35,
                keys: ['B/4'],
                notehead: 'x',
                stemDirection: Vex.Flow.StaveNote.STEM_DOWN,
                sampleFile: 'BOXKICK.wav'
            },

            // Snares
            snare: {
                name: 'Acoustic Snare',
                midi: 38,
                keys: ['C/5'],
                notehead: 'x',
                stemDirection: Vex.Flow.StaveNote.STEM_UP,
                sampleFile: 'snare.wav'
            },
            sideStick: {
                name: 'Side Stick',
                midi: 37,
                keys: ['C/5'],
                notehead: 'slash',
                stemDirection: Vex.Flow.StaveNote.STEM_UP,
                sampleFile: 'sidestick.wav'
            },
            rimshot: {
                name: 'Rimshot',
                midi: 40,
                keys: ['C/5'],
                notehead: 'x',
                stemDirection: Vex.Flow.StaveNote.STEM_UP,
                sampleFile: 'rim.wav',
                modifiers: [{
                    type: 'annotation',
                    text: 'R',
                    justification: Vex.Flow.Annotation.Justify.LEFT
                }]
            },

            // Hi-Hats
            hiHatClosed: {
                name: 'Hi-Hat Closed',
                midi: 42,
                keys: ['G/5'],
                notehead: 'x',
                stemDirection: Vex.Flow.StaveNote.STEM_UP,
                sampleFile: 'hi-hat.wav',
                modifiers: [{
                    type: 'articulation',
                    symbol: 'a+',
                    position: Vex.Flow.Modifier.Position.ABOVE
                }]
            },
            hiHatOpen: {
                name: 'Hi-Hat Open',
                midi: 46,
                keys: ['G/5'],
                notehead: 'circle_x',
                stemDirection: Vex.Flow.StaveNote.STEM_UP,
                sampleFile: 'open-hat.wav',
                modifiers: [{
                    type: 'articulation',
                    symbol: 'ao',
                    position: Vex.Flow.Modifier.Position.ABOVE
                }]
            },
            hiHatPedal: {
                name: 'Hi-Hat Pedal',
                midi: 44,
                keys: ['F/4'],
                notehead: 'x',
                stemDirection: Vex.Flow.StaveNote.STEM_DOWN,
                sampleFile: 'hi-hat.wav'
            },

            // Toms
            highTom: {
                name: 'High Tom',
                midi: 48,
                keys: ['D/5'],
                notehead: 'x',
                stemDirection: Vex.Flow.StaveNote.STEM_UP,
                sampleFile: 'high-tom.wav'
            },
            midTom: {
                name: 'Mid Tom',
                midi: 47,
                keys: ['B/4'],
                notehead: 'x',
                stemDirection: Vex.Flow.StaveNote.STEM_UP,
                sampleFile: 'MIDTOM.wav'
            },
            lowTom: {
                name: 'Low Tom',
                midi: 45,
                keys: ['A/4'],
                notehead: 'x',
                stemDirection: Vex.Flow.StaveNote.STEM_UP,
                sampleFile: 'low-tom.wav'
            },
            floorTom: {
                name: 'Floor Tom',
                midi: 41,
                keys: ['F/4'],
                notehead: 'x',
                stemDirection: Vex.Flow.StaveNote.STEM_DOWN,
                sampleFile: 'low-tom.wav'
            },

            // Cymbals
            crashCymbal: {
                name: 'Crash Cymbal',
                midi: 49,
                keys: ['A/5'],
                notehead: 'x',
                stemDirection: Vex.Flow.StaveNote.STEM_UP,
                sampleFile: 'crash.wav'
            },
            rideCymbal: {
                name: 'Ride Cymbal',
                midi: 51,
                keys: ['F/5'],
                notehead: 'x',
                stemDirection: Vex.Flow.StaveNote.STEM_UP,
                sampleFile: 'ride.wav'
            },
            splashCymbal: {
                name: 'Splash Cymbal',
                midi: 55,
                keys: ['G/5'],
                notehead: 'x',
                stemDirection: Vex.Flow.StaveNote.STEM_UP,
                sampleFile: 'cymbal.wav'
            },
            chinaCymbal: {
                name: 'China Cymbal',
                midi: 52,
                keys: ['E/5'],
                notehead: 'x',
                stemDirection: Vex.Flow.StaveNote.STEM_UP,
                sampleFile: 'crash.wav',
                modifiers: [{
                    type: 'annotation',
                    text: 'Ch',
                    justification: Vex.Flow.Annotation.Justify.LEFT
                }]
            },

            // Percussion
            clap: {
                name: 'Hand Clap',
                midi: 39,
                keys: ['D/5'],
                notehead: 'triangle',
                stemDirection: Vex.Flow.StaveNote.STEM_UP,
                sampleFile: 'clap.wav'
            },
            cowbell: {
                name: 'Cowbell',
                midi: 56,
                keys: ['G#/5'],
                notehead: 'triangle',
                stemDirection: Vex.Flow.StaveNote.STEM_UP,
                sampleFile: 'cowbell.wav'
            },
            conga: {
                name: 'Conga',
                midi: 62,
                keys: ['A#/4'],
                notehead: 'x',
                stemDirection: Vex.Flow.StaveNote.STEM_UP,
                sampleFile: 'conga.wav'
            },
            bongos: {
                name: 'High Bongo',
                midi: 60,
                keys: ['G#/4'],
                notehead: 'x',
                stemDirection: Vex.Flow.StaveNote.STEM_UP,
                sampleFile: 'BONGOHI.wav'
            },
            bongoLow: {
                name: 'Low Bongo',
                midi: 61,
                keys: ['F#/4'],
                notehead: 'x',
                stemDirection: Vex.Flow.StaveNote.STEM_UP,
                sampleFile: 'BONGOLO.wav'
            },
            claves: {
                name: 'Claves',
                midi: 75,
                keys: ['A/4'],
                notehead: 'x',
                stemDirection: Vex.Flow.StaveNote.STEM_UP,
                sampleFile: 'claves.wav'
            }
        };
    }

    // MIDI to note name mapping for audio playback
    static get MIDI_TO_NOTE() {
        return {
            35: "B1",   // Bass Drum 2
            36: "C2",   // Bass Drum 1 (Kick)
            37: "C#2",  // Side Stick
            38: "D2",   // Acoustic Snare
            39: "D#2",  // Hand Clap
            40: "E2",   // Electric Snare/Rimshot
            41: "F2",   // Low Floor Tom
            42: "F#2",  // Closed Hi-hat
            43: "G2",   // High Floor Tom
            44: "G#2",  // Pedal Hi-hat
            45: "A2",   // Low Tom
            46: "A#2",  // Open Hi-hat
            47: "B2",   // Low-Mid Tom
            48: "C3",   // Hi-Mid Tom
            49: "C#3",  // Crash Cymbal 1
            50: "D3",   // High Tom
            51: "D#3",  // Ride Cymbal 1
            52: "E3",   // Chinese Cymbal
            55: "G3",   // Splash Cymbal
            56: "G#3",  // Cowbell
            60: "C4",   // Hi Bongo
            61: "C#4",  // Low Bongo
            62: "D4",   // Mute Hi Conga
            75: "D#5",  // Claves
        };
    }

    // Drum techniques
    static get TECHNIQUES() {
        return {
            NORMAL: 'normal',
            ACCENT: 'accent',
            GHOST: 'ghost',
            FLAM: 'flam',
            ROLL: 'roll',
            CHOKE: 'choke'
        };
    }

    constructor(config = {}) {
        super({
            instrumentType: BaseInstrument.TYPES.DRUMS,
            defaultTempo: config.defaultTempo || 120,
            storageKey: 'autosaved-drum-score',
            selectors: {
                scoreContainer: '#drums-score',
                scoreWrap: '#drums-score-wrap',
                playButton: '#play-drums-score-btn',
                stopButton: '#stop-drums-score-btn',
                clearButton: '#clear-drum-score-btn',
                undoButton: '#undo-drum-btn',
                addMeasureButton: '#add-drum-measure-btn',
                // Drum-specific selectors
                drumButtons: '[data-drum]',
                durationButtons: '[data-duration]',
                techniqueSelector: '#drum-technique-selector',
                velocitySlider: '#drum-velocity-slider',
                ...config.selectors
            },
            ...config
        });

        // Drum-specific state
        this.selectedDrumInstrument = 'snare';
        this.selectedDuration = 'q';
        this.selectedTechnique = DrumInstrument.TECHNIQUES.NORMAL;
        this.selectedVelocity = 1.0;

        // UI state tracking
        this.activeDrumButtons = new Set();
        this.selectedDurationElement = null;

        console.log('🥁 Drum instrument created');
    }

    // ===================================================================
    // Abstract Method Implementations
    // ===================================================================

    initializeRenderer() {
        this.renderingEngine = new DrumRenderer({
            container: this.selectors.scoreContainer
        });
    }

    createNoteData(params) {
        const {
            drumInstrument = this.selectedDrumInstrument,
            duration = this.selectedDuration,
            technique = this.selectedTechnique,
            velocity = this.selectedVelocity,
            isRest = false,
            modifiers = []
        } = params;

        // Validate drum instrument
        if (!isRest && !DrumInstrument.DRUM_INSTRUMENTS[drumInstrument]) {
            throw new Error(`Unknown drum instrument: ${drumInstrument}`);
        }

        const noteData = {
            id: this._generateNoteId(),
            instrumentType: 'drums',
            drumInstrument,
            duration,
            technique,
            velocity,
            isRest,
            modifiers: [...modifiers],
            timestamp: Date.now()
        };

        if (!isRest) {
            // Add instrument-specific properties from the drum map
            const instrumentProps = DrumInstrument.DRUM_INSTRUMENTS[drumInstrument];
            noteData.keys = instrumentProps.keys;
            noteData.notehead = instrumentProps.notehead;
            noteData.stemDirection = instrumentProps.stemDirection;
            noteData.midi = instrumentProps.midi;
            noteData.sampleFile = instrumentProps.sampleFile;

            // Add default modifiers from instrument definition
            if (instrumentProps.modifiers) {
                noteData.modifiers.push(...instrumentProps.modifiers);
            }

            // Add technique-specific modifiers
            this._addTechniqueModifiers(noteData);
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
        if (!Object.values(DrumInstrument.TECHNIQUES).includes(noteData.technique)) {
            return false;
        }

        // Validate drum instrument (if not a rest)
        if (!noteData.isRest) {
            if (!noteData.drumInstrument || !DrumInstrument.DRUM_INSTRUMENTS[noteData.drumInstrument]) {
                return false;
            }
        }

        // Validate velocity
        if (typeof noteData.velocity !== 'number' || noteData.velocity < 0 || noteData.velocity > 1) {
            return false;
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
        const actualVelocity = (velocity || 1) * (noteData.velocity || 1);

        try {
            // Get the note name for this drum's MIDI number
            const midiNote = DrumInstrument.MIDI_TO_NOTE[noteData.midi];
            if (!midiNote) {
                console.warn(`No MIDI mapping for drum: ${noteData.drumInstrument}`);
                return;
            }

            // Trigger the drum sound
            this.audioEngine.triggerAttack(midiNote, playTime, actualVelocity);

            // Apply technique-specific effects
            this._applyDrumTechnique(noteData, playTime, actualVelocity);

            // Visual feedback
            this._setDrumButtonActive(noteData.drumInstrument, true);
            
            // Auto-release after a short time for visual feedback
            setTimeout(() => {
                this._setDrumButtonActive(noteData.drumInstrument, false);
            }, 200);

        } catch (error) {
            console.error('Error playing drum note:', error);
        }
    }

    stopNote(noteData, time = undefined) {
        if (!this.audioEngine.isReady || noteData.isRest) {
            return;
        }

        const stopTime = time || Tone.now();

        try {
            const midiNote = DrumInstrument.MIDI_TO_NOTE[noteData.midi];
            if (midiNote) {
                this.audioEngine.triggerRelease(midiNote, stopTime);
            }

            // Clear visual feedback
            this._setDrumButtonActive(noteData.drumInstrument, false);
        } catch (error) {
            console.error('Error stopping drum note:', error);
        }
    }

    getInstrumentEventHandlers() {
        return {
            // Drum pad buttons
            [this.selectors.drumButtons]: {
                event: 'click',
                callback: this._handleDrumButtonClick
            },

            // Duration selection buttons
            [this.selectors.durationButtons]: {
                event: 'click',
                callback: this._handleDurationSelection
            },

            // Technique selector
            [this.selectors.techniqueSelector]: {
                event: 'change',
                callback: this._handleTechniqueSelection
            },

            // Velocity slider
            [this.selectors.velocitySlider]: {
                event: 'input',
                callback: this._handleVelocityChange
            },

            // Rest button
            '#add-drum-rest-btn': this._handleAddRest
        };
    }

    // ===================================================================
    // Drum-Specific Public Methods
    // ===================================================================

    /**
     * Set the selected drum instrument
     */
    setDrumInstrument(drumInstrument) {
        if (!DrumInstrument.DRUM_INSTRUMENTS[drumInstrument]) {
            console.error(`Invalid drum instrument: ${drumInstrument}`);
            return false;
        }

        this.selectedDrumInstrument = drumInstrument;
        this._updateDrumUI();
        return true;
    }

    /**
     * Set drum playing technique
     */
    setTechnique(technique) {
        if (!Object.values(DrumInstrument.TECHNIQUES).includes(technique)) {
            console.error(`Invalid technique: ${technique}`);
            return false;
        }

        this.selectedTechnique = technique;
        this._updateTechniqueUI();
        return true;
    }

    /**
     * Set note velocity/dynamics
     */
    setVelocity(velocity) {
        if (velocity < 0 || velocity > 1) {
            console.error(`Velocity must be between 0 and 1, got: ${velocity}`);
            return false;
        }

        this.selectedVelocity = velocity;
        this._updateVelocityUI();
        return true;
    }

    /**
     * Set note duration
     */
    setDuration(duration) {
        const validDurations = ['w', 'h', 'q', '8', '16', '32', 'h.', 'q.', '8.', '16.', '32.'];
        if (!validDurations.includes(duration)) {
            console.error(`Invalid duration: ${duration}`);
            return false;
        }

        this.selectedDuration = duration;
        this._updateDurationUI();
        return true;
    }

    /**
     * Get available drum instruments
     */
    getAvailableDrumInstruments() {
        return Object.keys(DrumInstrument.DRUM_INSTRUMENTS);
    }

    /**
     * Get drum instrument info
     */
    getDrumInstrumentInfo(drumInstrument) {
        return DrumInstrument.DRUM_INSTRUMENTS[drumInstrument] || null;
    }

    /**
     * Play a drum pattern (multiple drums simultaneously)
     */
    playDrumPattern(pattern, startTime = undefined) {
        const playTime = startTime || Tone.now();
        
        pattern.forEach((drumInstrument, index) => {
            if (drumInstrument && drumInstrument !== 'rest') {
                // Slight offset for each drum to avoid phase issues
                const offsetTime = playTime + (index * 0.001);
                const noteData = this.createNoteData({ drumInstrument });
                this.playNote(noteData, 1, offsetTime);
            }
        });
    }

    // ===================================================================
    // Private Methods - Technique Handling
    // ===================================================================

    _addTechniqueModifiers(noteData) {
        switch (noteData.technique) {
            case DrumInstrument.TECHNIQUES.ACCENT:
                noteData.modifiers.push({
                    type: 'articulation',
                    symbol: 'a>',
                    position: Vex.Flow.Modifier.Position.ABOVE
                });
                break;
            case DrumInstrument.TECHNIQUES.GHOST:
                noteData.modifiers.push({
                    type: 'annotation',
                    text: '( )',
                    justification: Vex.Flow.Annotation.Justify.CENTER
                });
                break;
            case DrumInstrument.TECHNIQUES.FLAM:
                noteData.modifiers.push({
                    type: 'articulation',
                    symbol: 'a^',
                    position: Vex.Flow.Modifier.Position.ABOVE
                });
                break;
            case DrumInstrument.TECHNIQUES.ROLL:
                noteData.modifiers.push({
                    type: 'tremolo',
                    strokes: 3
                });
                break;
            case DrumInstrument.TECHNIQUES.CHOKE:
                noteData.modifiers.push({
                    type: 'annotation',
                    text: 'o',
                    justification: Vex.Flow.Annotation.Justify.RIGHT
                });
                break;
        }
    }

    _applyDrumTechnique(noteData, time, velocity) {
        switch (noteData.technique) {
            case DrumInstrument.TECHNIQUES.ACCENT:
                // Accent is handled by increased velocity in the caller
                break;
            case DrumInstrument.TECHNIQUES.GHOST:
                // Ghost note - very quiet, handled by reduced velocity
                break;
            case DrumInstrument.TECHNIQUES.FLAM:
                // Play a very quick grace note before the main note
                const flamTime = time - 0.02; // 20ms before
                const midiNote = DrumInstrument.MIDI_TO_NOTE[noteData.midi];
                if (midiNote) {
                    this.audioEngine.triggerAttack(midiNote, flamTime, velocity * 0.7);
                }
                break;
            case DrumInstrument.TECHNIQUES.ROLL:
                // Implement roll as rapid repeated hits
                for (let i = 1; i <= 4; i++) {
                    const rollTime = time + (i * 0.05); // 50ms apart
                    const rollVelocity = velocity * (0.8 - i * 0.1); // Decreasing velocity
                    const midiNoteRoll = DrumInstrument.MIDI_TO_NOTE[noteData.midi];
                    if (midiNoteRoll) {
                        this.audioEngine.triggerAttack(midiNoteRoll, rollTime, rollVelocity);
                    }
                }
                break;
            case DrumInstrument.TECHNIQUES.CHOKE:
                // Quick cutoff after short sustain
                const midiNoteChoke = DrumInstrument.MIDI_TO_NOTE[noteData.midi];
                if (midiNoteChoke) {
                    setTimeout(() => {
                        this.audioEngine.triggerRelease(midiNoteChoke, time + 0.1);
                    }, 100);
                }
                break;
        }
    }

    // ===================================================================
    // Private Methods - Event Handlers
    // ===================================================================

    _handleDrumButtonClick(event) {
        const drumInstrument = event.target.dataset.drum;
        if (!drumInstrument) return;

        if (drumInstrument === 'rest') {
            this._handleAddRest();
            return;
        }

        // Set as selected instrument
        this.setDrumInstrument(drumInstrument);

        // Play the drum sound for immediate feedback
        const noteData = this.createNoteData({ drumInstrument });
        this.playNote(noteData, this.selectedVelocity);

        // Add to score
        const noteId = this.addNote(undefined, noteData);
        if (noteId) {
            console.log(`🥁 Added ${drumInstrument} to score`);
        }
    }

    _handleDurationSelection(event) {
        const duration = event.target.dataset.duration;
        if (duration) {
            this.setDuration(duration);
        }
    }

    _handleTechniqueSelection(event) {
        const technique = event.target.value;
        this.setTechnique(technique);
    }

    _handleVelocityChange(event) {
        const velocity = parseFloat(event.target.value) / 100; // Convert 0-100 to 0-1
        this.setVelocity(velocity);
    }

    _handleAddRest() {
        const restData = this.createNoteData({
            duration: this.selectedDuration,
            isRest: true
        });
        
        const noteId = this.addNote(undefined, restData);
        if (noteId) {
            console.log(`🥁 Added rest (${this.selectedDuration}) to score`);
        }
    }

    // ===================================================================
    // Private Methods - UI Updates
    // ===================================================================

    _setDrumButtonActive(drumInstrument, isActive) {
        const button = document.querySelector(`[data-drum="${drumInstrument}"]`);
        if (button) {
            if (isActive) {
                button.classList.add('active');
                this.activeDrumButtons.add(drumInstrument);
            } else {
                button.classList.remove('active');
                this.activeDrumButtons.delete(drumInstrument);
            }
        }
    }

    _updateDrumUI() {
        // Update selected drum button
        document.querySelectorAll('[data-drum]').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        const selectedBtn = document.querySelector(`[data-drum="${this.selectedDrumInstrument}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('selected');
        }

        // Update drum info display
        const drumInfo = document.querySelector('#drum-info-display');
        if (drumInfo) {
            const instrumentInfo = DrumInstrument.DRUM_INSTRUMENTS[this.selectedDrumInstrument];
            drumInfo.textContent = instrumentInfo ? instrumentInfo.name : this.selectedDrumInstrument;
        }
    }

    _updateDurationUI() {
        // Remove active class from all duration buttons
        document.querySelectorAll('[data-duration]').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to selected duration
        const selectedBtn = document.querySelector(`[data-duration="${this.selectedDuration}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('active');
            this.selectedDurationElement = selectedBtn;
        }
    }

    _updateTechniqueUI() {
        const techniqueSelector = document.querySelector(this.selectors.techniqueSelector);
        if (techniqueSelector) {
            techniqueSelector.value = this.selectedTechnique;
        }
    }

    _updateVelocityUI() {
        const velocitySlider = document.querySelector(this.selectors.velocitySlider);
        if (velocitySlider) {
            velocitySlider.value = Math.round(this.selectedVelocity * 100);
        }

        const velocityDisplay = document.querySelector('#drum-velocity-display');
        if (velocityDisplay) {
            velocityDisplay.textContent = Math.round(this.selectedVelocity * 100) + '%';
        }
    }

    // ===================================================================
    // Initialization Setup
    // ===================================================================

    async initialize() {
        await super.initialize();

        // Initialize UI state
        this._updateDrumUI();
        this._updateDurationUI();
        this._updateTechniqueUI();
        this._updateVelocityUI();

        // Set default duration button as active
        if (!this.selectedDurationElement) {
            const quarterBtn = document.querySelector('[data-duration="q"]');
            if (quarterBtn) {
                quarterBtn.classList.add('active');
                this.selectedDurationElement = quarterBtn;
            }
        }

        console.log('🥁 Drum instrument fully initialized');
    }

    // ===================================================================
    // Pattern and Fill Methods
    // ===================================================================

    /**
     * Add a basic rock beat pattern
     */
    addRockBeat() {
        const pattern = [
            { drumInstrument: 'kick', duration: 'q' },
            { drumInstrument: 'hiHatClosed', duration: '8' },
            { drumInstrument: 'hiHatClosed', duration: '8' },
            { drumInstrument: 'snare', duration: 'q' },
            { drumInstrument: 'hiHatClosed', duration: '8' },
            { drumInstrument: 'hiHatClosed', duration: '8' }
        ];

        pattern.forEach(noteParams => {
            const noteData = this.createNoteData(noteParams);
            this.addNote(undefined, noteData);
        });

        console.log('🥁 Added rock beat pattern');
    }

    /**
     * Add a fill pattern
     */
    addFill(fillType = 'basic') {
        const fills = {
            basic: [
                { drumInstrument: 'snare', duration: '16' },
                { drumInstrument: 'snare', duration: '16' },
                { drumInstrument: 'highTom', duration: '16' },
                { drumInstrument: 'midTom', duration: '16' },
                { drumInstrument: 'lowTom', duration: '8' },
                { drumInstrument: 'crashCymbal', duration: 'q' }
            ],
            tomFill: [
                { drumInstrument: 'highTom', duration: '8' },
                { drumInstrument: 'midTom', duration: '8' },
                { drumInstrument: 'lowTom', duration: '8' },
                { drumInstrument: 'floorTom', duration: '8' }
            ]
        };

        const pattern = fills[fillType] || fills.basic;
        pattern.forEach(noteParams => {
            const noteData = this.createNoteData(noteParams);
            this.addNote(undefined, noteData);
        });

        console.log(`🥁 Added ${fillType} fill pattern`);
    }
}

export default DrumInstrument;