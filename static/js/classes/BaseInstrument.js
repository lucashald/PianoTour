// BaseInstrument.js - Abstract base class for all instruments

import { AudioEngine } from './AudioEngine.js';

/**
 * Abstract base class that defines the common interface and shared functionality
 * for all musical instruments in the application
 */
export class BaseInstrument {
    // Instrument types
    static get TYPES() {
        return {
            PIANO: 'piano',
            DRUMS: 'drums',
            GUITAR: 'guitar',
            CELLO: 'cello',
            SAX: 'sax'
        };
    }

    // Playback states
    static get PLAYBACK_STATES() {
        return {
            STOPPED: 'stopped',
            PLAYING: 'playing',
            PAUSED: 'paused'
        };
    }

    constructor(config = {}) {
        // Validate required config
        if (!config.instrumentType) {
            throw new Error('instrumentType is required in config');
        }

        // Core configuration
        this.instrumentType = config.instrumentType;
        this.instrumentId = config.instrumentId || `${this.instrumentType}-${Date.now()}`;
        this.storageKey = config.storageKey || `autosaved-${this.instrumentType}-score`;
        
        // UI selectors - can be overridden by specific instruments
        this.selectors = {
            scoreContainer: config.scoreContainer || `#${this.instrumentType}-score`,
            scoreWrap: config.scoreWrap || `#${this.instrumentType}-score-wrap`,
            playButton: config.playButton || `#play-${this.instrumentType}-score-btn`,
            stopButton: config.stopButton || `#stop-${this.instrumentType}-score-btn`,
            clearButton: config.clearButton || `#clear-${this.instrumentType}-score-btn`,
            undoButton: config.undoButton || `#undo-${this.instrumentType}-btn`,
            addMeasureButton: config.addMeasureButton || `#add-${this.instrumentType}-measure-btn`,
            ...config.selectors
        };

        // State management
        this.isInitialized = false;
        this.playbackState = BaseInstrument.PLAYBACK_STATES.STOPPED;
        this.currentTempo = config.defaultTempo || 120;
        this.timeSignature = config.defaultTimeSignature || { numerator: 4, denominator: 4 };

        // Score data
        this.measures = [];
        this.currentMeasureIndex = 0;
        this.selectedNote = null;
        this.selectedMeasure = -1;

        // History for undo functionality
        this.history = [];
        this.maxHistoryLength = config.maxHistoryLength || 20;

        // Audio engine
        this.audioEngine = config.audioEngine || new AudioEngine({
            defaultInstrument: this.instrumentType,
            instrumentId: this.instrumentId,
            storagePrefix: `${this.instrumentType}-audio`
        });

        // Event listeners tracking
        this._eventListeners = new Map();
        this._boundMethods = new Map();

        // Rendering state
        this.renderingEngine = null; // Will be set by subclasses
        this.lastScrolledMeasureIndex = -1;

        // Playback tracking
        this.scheduledEvents = new Set();
        this.activeNotes = new Set();

        // Initialize
        this._initialize();
    }

    // ===================================================================
    // Abstract Methods - Must be implemented by subclasses
    // ===================================================================

    /**
     * Initialize instrument-specific rendering engine
     * @abstract
     */
    initializeRenderer() {
        throw new Error('initializeRenderer() must be implemented by subclasses');
    }

    /**
     * Create a note data object for this instrument
     * @abstract
     * @param {Object} noteParams - Note parameters
     * @returns {Object} Note data object
     */
    createNoteData(noteParams) {
        throw new Error('createNoteData() must be implemented by subclasses');
    }

    /**
     * Validate note data for this instrument
     * @abstract
     * @param {Object} noteData - Note data to validate
     * @returns {boolean} True if valid
     */
    validateNoteData(noteData) {
        throw new Error('validateNoteData() must be implemented by subclasses');
    }

    /**
     * Play a single note
     * @abstract
     * @param {Object} noteData - Note data
     * @param {number} velocity - Velocity (0-1)
     * @param {number} time - When to play (Tone.js time)
     */
    playNote(noteData, velocity = 1, time = undefined) {
        throw new Error('playNote() must be implemented by subclasses');
    }

    /**
     * Stop a single note
     * @abstract
     * @param {Object} noteData - Note data
     * @param {number} time - When to stop (Tone.js time)
     */
    stopNote(noteData, time = undefined) {
        throw new Error('stopNote() must be implemented by subclasses');
    }

    /**
     * Get instrument-specific UI event handlers
     * @abstract
     * @returns {Object} Event handlers map
     */
    getInstrumentEventHandlers() {
        throw new Error('getInstrumentEventHandlers() must be implemented by subclasses');
    }

    // ===================================================================
    // Public API - Initialization and Lifecycle
    // ===================================================================

    /**
     * Initialize the instrument
     */
    async initialize() {
        if (this.isInitialized) {
            console.warn(`${this.instrumentType} already initialized`);
            return;
        }

        console.log(`🎵 Initializing ${this.instrumentType} instrument`);

        try {
            // Initialize audio engine
            await this.audioEngine.setInstrument(this.instrumentType);

            // Initialize renderer
            this.initializeRenderer();

            // Set up event handlers
            this._setupEventHandlers();

            // Load saved score if exists
            await this.loadSavedScore();

            // Initial render
            this.render();

            this.isInitialized = true;
            this._emitEvent('initialized');

            console.log(`✅ ${this.instrumentType} instrument initialized`);

        } catch (error) {
            console.error(`❌ Failed to initialize ${this.instrumentType}:`, error);
            this._emitEvent('initializationError', { error });
            throw error;
        }
    }

    /**
     * Dispose of the instrument and clean up resources
     */
    dispose() {
        console.log(`🧹 Disposing ${this.instrumentType} instrument`);

        this.stopPlayback();
        this._removeEventHandlers();
        
        if (this.audioEngine) {
            this.audioEngine.dispose();
        }
        
        if (this.renderingEngine && this.renderingEngine.dispose) {
            this.renderingEngine.dispose();
        }

        this.measures = [];
        this.history = [];
        this._eventListeners.clear();
        this._boundMethods.clear();
        this.scheduledEvents.clear();
        this.activeNotes.clear();

        this.isInitialized = false;
        this._emitEvent('disposed');
    }

    // ===================================================================
    // Public API - Score Management
    // ===================================================================

    /**
     * Add a note to the score
     */
    addNote(measureIndex, noteData, insertBeforeNoteId = null) {
        if (!this.validateNoteData(noteData)) {
            console.error('Invalid note data:', noteData);
            return null;
        }

        this._saveStateToHistory();

        try {
            const actualMeasureIndex = measureIndex !== undefined ? measureIndex : this.currentMeasureIndex;
            this._ensureMeasureExists(actualMeasureIndex);

            // Generate ID if not provided
            if (!noteData.id) {
                noteData.id = this._generateNoteId();
            }

            const measure = this.measures[actualMeasureIndex];
            let insertIndex = measure.length;

            // Find insertion position if specified
            if (insertBeforeNoteId) {
                const foundIndex = measure.findIndex(note => note.id === insertBeforeNoteId);
                if (foundIndex !== -1) {
                    insertIndex = foundIndex;
                }
            }

            // Check for measure overflow
            if (this._wouldOverflowMeasure(actualMeasureIndex, noteData, insertIndex)) {
                // Create new measure
                const newMeasureIndex = this.measures.length;
                this._ensureMeasureExists(newMeasureIndex);
                this.measures[newMeasureIndex].push(noteData);
                this.currentMeasureIndex = newMeasureIndex;
            } else {
                // Insert into existing measure
                measure.splice(insertIndex, 0, noteData);
                if (actualMeasureIndex === this.currentMeasureIndex) {
                    // Update current measure tracking as needed
                }
            }

            this._handleSideEffects();
            this._emitEvent('noteAdded', { noteData, measureIndex: actualMeasureIndex });

            return noteData.id;

        } catch (error) {
            console.error('Error adding note:', error);
            // Revert history on failure
            if (this.history.length > 0) this.history.pop();
            return null;
        }
    }

    /**
     * Remove a note from the score
     */
    removeNote(measureIndex, noteId) {
        this._saveStateToHistory();

        try {
            if (!this.measures[measureIndex]) {
                console.warn(`Measure ${measureIndex} does not exist`);
                return null;
            }

            const noteIndex = this.measures[measureIndex].findIndex(note => note.id === noteId);
            if (noteIndex === -1) {
                console.warn(`Note ${noteId} not found in measure ${measureIndex}`);
                return null;
            }

            const removedNote = this.measures[measureIndex].splice(noteIndex, 1)[0];

            // Clean up empty measures (except first one)
            if (this.measures[measureIndex].length === 0 && measureIndex > 0) {
                this.measures.splice(measureIndex, 1);
                if (this.currentMeasureIndex >= measureIndex) {
                    this.currentMeasureIndex = Math.max(0, this.currentMeasureIndex - 1);
                }
            }

            this._handleSideEffects();
            this._emitEvent('noteRemoved', { noteId, measureIndex, removedNote });

            return removedNote;

        } catch (error) {
            console.error('Error removing note:', error);
            return null;
        }
    }

    /**
     * Update a note in the score
     */
    updateNote(measureIndex, noteId, newNoteData) {
        if (!this.validateNoteData(newNoteData)) {
            console.error('Invalid note data for update:', newNoteData);
            return false;
        }

        this._saveStateToHistory();

        try {
            if (!this.measures[measureIndex]) {
                console.warn(`Measure ${measureIndex} does not exist`);
                return false;
            }

            const noteIndex = this.measures[measureIndex].findIndex(note => note.id === noteId);
            if (noteIndex === -1) {
                console.warn(`Note ${noteId} not found in measure ${measureIndex}`);
                return false;
            }

            // Check if update would cause overflow
            const tempMeasure = [...this.measures[measureIndex]];
            tempMeasure[noteIndex] = { ...tempMeasure[noteIndex], ...newNoteData };

            if (this._wouldMeasureOverflow(tempMeasure)) {
                console.warn('Update would cause measure overflow');
                this.history.pop(); // Remove saved state
                return false;
            }

            // Apply update
            Object.assign(this.measures[measureIndex][noteIndex], newNoteData);

            this._handleSideEffects();
            this._emitEvent('noteUpdated', { noteId, measureIndex, newNoteData });

            return true;

        } catch (error) {
            console.error('Error updating note:', error);
            if (this.history.length > 0) this.history.pop();
            return false;
        }
    }

    /**
     * Clear the entire score
     */
    clearScore() {
        this._saveStateToHistory();
        
        this.measures = [];
        this.currentMeasureIndex = 0;
        this.selectedNote = null;
        this.selectedMeasure = -1;

        this._ensureMeasureExists(0);
        this._handleSideEffects();
        this._emitEvent('scoreCleared');

        console.log(`${this.instrumentType} score cleared`);
    }

    /**
     * Undo the last operation
     */
    undo() {
        if (this.history.length <= 1) {
            console.log('Nothing to undo');
            return false;
        }

        this.history.pop(); // Remove current state
        const prevState = this.history[this.history.length - 1];

        this.measures = JSON.parse(JSON.stringify(prevState.measures));
        this.currentMeasureIndex = prevState.currentMeasureIndex;

        this._handleSideEffects();
        this._emitEvent('undoPerformed');

        console.log('Undo performed');
        return true;
    }

    // ===================================================================
    // Public API - Playback Control
    // ===================================================================

    /**
     * Start playback of the score
     */
    async startPlayback() {
        if (this.playbackState === BaseInstrument.PLAYBACK_STATES.PLAYING) {
            console.warn('Playback already in progress');
            return;
        }

        if (this.measures.length === 0 || this.measures.every(m => m.length === 0)) {
            console.warn('No score to play');
            return;
        }

        console.log(`▶️ Starting ${this.instrumentType} playback`);

        try {
            const startPlayback = async () => {
                this.playbackState = BaseInstrument.PLAYBACK_STATES.PLAYING;
                await this._schedulePlayback();
                Tone.Transport.start();
                this._emitEvent('playbackStarted');
            };

            await this.audioEngine.unlockAndExecute(startPlayback);

        } catch (error) {
            console.error('Error starting playback:', error);
            this.playbackState = BaseInstrument.PLAYBACK_STATES.STOPPED;
            this._emitEvent('playbackError', { error });
        }
    }

    /**
     * Stop playback
     */
    stopPlayback() {
        if (this.playbackState === BaseInstrument.PLAYBACK_STATES.STOPPED) {
            return;
        }

        console.log(`⏹️ Stopping ${this.instrumentType} playback`);

        Tone.Transport.stop();
        Tone.Transport.cancel();

        // Release all notes
        this.audioEngine.releaseAll();
        this.activeNotes.clear();

        // Clear scheduled events
        this.scheduledEvents.clear();

        // Reset state
        this.playbackState = BaseInstrument.PLAYBACK_STATES.STOPPED;
        this.lastScrolledMeasureIndex = -1;

        // Clear any visual feedback
        this._clearPlaybackHighlights();

        this._emitEvent('playbackStopped');
    }

    // ===================================================================
    // Public API - Rendering
    // ===================================================================

    /**
     * Render the score
     */
    render() {
        if (!this.renderingEngine) {
            console.warn('No rendering engine available');
            return;
        }

        try {
            this.renderingEngine.render(this.measures);
            this._emitEvent('rendered');
        } catch (error) {
            console.error('Render error:', error);
            this._emitEvent('renderError', { error });
        }
    }

    /**
     * Scroll to a specific measure
     */
    scrollToMeasure(measureIndex) {
        if (!this.renderingEngine || !this.renderingEngine.scrollToMeasure) {
            return;
        }

        try {
            this.renderingEngine.scrollToMeasure(measureIndex);
            this.lastScrolledMeasureIndex = measureIndex;
            this._emitEvent('scrolledToMeasure', { measureIndex });
        } catch (error) {
            console.error('Scroll error:', error);
        }
    }

    // ===================================================================
    // Public API - State Management
    // ===================================================================

    /**
     * Save score to localStorage
     */
    saveScore() {
        try {
            const scoreData = {
                measures: this.measures,
                currentMeasureIndex: this.currentMeasureIndex,
                tempo: this.currentTempo,
                timeSignature: this.timeSignature,
                savedAt: Date.now()
            };

            localStorage.setItem(this.storageKey, JSON.stringify(scoreData));
            this._emitEvent('scoreSaved');
            console.log(`${this.instrumentType} score saved`);
            return true;
        } catch (error) {
            console.error('Error saving score:', error);
            return false;
        }
    }

    /**
     * Load score from localStorage
     */
    async loadSavedScore() {
        try {
            const savedData = localStorage.getItem(this.storageKey);
            if (!savedData) {
                // Initialize with empty score
                this._ensureMeasureExists(0);
                return false;
            }

            const scoreData = JSON.parse(savedData);
            this.measures = scoreData.measures || [];
            this.currentMeasureIndex = scoreData.currentMeasureIndex || 0;
            this.currentTempo = scoreData.tempo || this.currentTempo;
            this.timeSignature = scoreData.timeSignature || this.timeSignature;

            // Ensure we have at least one measure
            if (this.measures.length === 0) {
                this._ensureMeasureExists(0);
            }

            this._emitEvent('scoreLoaded', { scoreData });
            console.log(`${this.instrumentType} score loaded`);
            return true;

        } catch (error) {
            console.error('Error loading score:', error);
            this._ensureMeasureExists(0);
            return false;
        }
    }

    // ===================================================================
    // Public API - Event System
    // ===================================================================

    addEventListener(event, callback) {
        if (!this._eventListeners.has(event)) {
            this._eventListeners.set(event, []);
        }
        this._eventListeners.get(event).push(callback);
    }

    removeEventListener(event, callback) {
        if (this._eventListeners.has(event)) {
            const callbacks = this._eventListeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    // ===================================================================
    // Protected Methods - For subclass use
    // ===================================================================

    /**
     * Get beats per measure based on time signature
     */
    getBeatsPerMeasure() {
        return this.timeSignature.numerator;
    }

    /**
     * Convert duration string to beat value
     */
    durationToBeats(duration) {
        const BEAT_VALUES = {
            w: 4, "w.": 6,
            h: 2, "h.": 3,
            q: 1, "q.": 1.5,
            "8": 0.5, "8.": 0.75,
            "16": 0.25, "16.": 0.375,
            "32": 0.125, "32.": 0.1875
        };
        return BEAT_VALUES[duration] || 1;
    }

    /**
     * Calculate total beats in a measure
     */
    calculateMeasureBeats(measure) {
        return measure.reduce((total, note) => {
            return total + this.durationToBeats(note.duration || 'q');
        }, 0);
    }

    // ===================================================================
    // Private Methods
    // ===================================================================

    _initialize() {
        // Set up initial state
        this._saveStateToHistory();
        console.log(`🔧 ${this.instrumentType} base initialization complete`);
    }

    _setupEventHandlers() {
        // Common event handlers
        this._addEventHandler('click', this.selectors.playButton, () => this.startPlayback());
        this._addEventHandler('click', this.selectors.stopButton, () => this.stopPlayback());  
        this._addEventHandler('click', this.selectors.clearButton, () => this.clearScore());
        this._addEventHandler('click', this.selectors.undoButton, () => this.undo());
        this._addEventHandler('click', this.selectors.addMeasureButton, () => this._addEmptyMeasure());

        // Get instrument-specific handlers
        const instrumentHandlers = this.getInstrumentEventHandlers();
        for (const [selector, handler] of Object.entries(instrumentHandlers)) {
            if (typeof handler === 'function') {
                this._addEventHandler('click', selector, handler);
            } else if (handler.event && handler.callback) {
                this._addEventHandler(handler.event, selector, handler.callback);
            }
        }
    }

    _addEventHandler(eventType, selector, handler) {
        const element = document.querySelector(selector);
        if (!element) {
            console.warn(`Element not found for selector: ${selector}`);
            return;
        }

        const boundHandler = handler.bind(this);
        element.addEventListener(eventType, boundHandler);
        
        // Track for cleanup
        const key = `${eventType}:${selector}`;
        this._boundMethods.set(key, { element, eventType, handler: boundHandler });
    }

    _removeEventHandlers() {
        this._boundMethods.forEach(({ element, eventType, handler }) => {
            element.removeEventListener(eventType, handler);
        });
        this._boundMethods.clear();
    }

    _ensureMeasureExists(measureIndex) {
        while (this.measures.length <= measureIndex) {
            this.measures.push([]);
        }
    }

    _addEmptyMeasure() {
        const newMeasureIndex = this.measures.length;
        this._ensureMeasureExists(newMeasureIndex);
        this.currentMeasureIndex = newMeasureIndex;
        this.render();
        this.scrollToMeasure(newMeasureIndex);
        this._emitEvent('measureAdded', { measureIndex: newMeasureIndex });
    }

    _generateNoteId() {
        return `${this.instrumentType}-note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    }

    _saveStateToHistory() {
        const state = {
            measures: JSON.parse(JSON.stringify(this.measures)),
            currentMeasureIndex: this.currentMeasureIndex
        };

        this.history.push(state);

        if (this.history.length > this.maxHistoryLength) {
            this.history.shift();
        }
    }

    _handleSideEffects() {
        this.render();
        this.saveScore();
    }

    _wouldOverflowMeasure(measureIndex, newNote, insertIndex) {
        const measure = [...this.measures[measureIndex]];
        measure.splice(insertIndex, 0, newNote);
        return this._wouldMeasureOverflow(measure);
    }

    _wouldMeasureOverflow(measure) {
        const totalBeats = this.calculateMeasureBeats(measure);
        const maxBeats = this.getBeatsPerMeasure();
        return totalBeats > maxBeats;
    }

    async _schedulePlayback() {
        if (!window.Tone) {
            throw new Error('Tone.js not available');
        }

        Tone.Transport.stop();
        Tone.Transport.cancel();
        Tone.Transport.position = 0;
        Tone.Transport.bpm.value = this.currentTempo;

        const secondsPerBeat = 60 / this.currentTempo;
        const beatsPerMeasure = this.getBeatsPerMeasure();
        let currentTime = 0;

        // Schedule playback events for each measure
        this.measures.forEach((measure, measureIndex) => {
            // Schedule measure scroll
            Tone.Transport.scheduleOnce((time) => {
                Tone.Draw.schedule(() => {
                    this.scrollToMeasure(measureIndex);
                }, time);
            }, currentTime);

            // Schedule notes in this measure
            let measureOffset = 0;
            measure.forEach(note => {
                const noteStartTime = currentTime + measureOffset;
                const noteDuration = this.durationToBeats(note.duration) * secondsPerBeat;

                if (!note.isRest) {
                    // Schedule note on
                    Tone.Transport.scheduleOnce((time) => {
                        this.playNote(note, 1, time);
                        this.activeNotes.add(note.id);
                    }, noteStartTime);

                    // Schedule note off
                    Tone.Transport.scheduleOnce((time) => {
                        this.stopNote(note, time);
                        this.activeNotes.delete(note.id);
                    }, noteStartTime + noteDuration);
                }

                measureOffset += noteDuration;
            });

            currentTime += beatsPerMeasure * secondsPerBeat;
        });

        // Schedule final stop
        Tone.Transport.scheduleOnce(() => {
            this.stopPlayback();
        }, currentTime + 0.1);
    }

    _clearPlaybackHighlights() {
        // To be implemented by subclasses if they have visual feedback
    }

    _emitEvent(eventName, data = {}) {
        const callbacks = this._eventListeners.get(eventName) || [];
        callbacks.forEach(callback => {
            try {
                callback({ ...data, instrument: this });
            } catch (error) {
                console.error(`Error in ${eventName} callback:`, error);
            }
        });

        // Also emit as DOM event
        window.dispatchEvent(new CustomEvent(`instrument.${eventName}`, {
            detail: { ...data, instrument: this }
        }));
    }
}

export default BaseInstrument;