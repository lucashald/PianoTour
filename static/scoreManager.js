// static/scoreManager.js

// This file aims to provide a single, robust function to process raw JSON score data.
// It handles large files by using a Web Worker internally to prevent UI blocking.
// It also includes basic validation and error handling.

/**
 * Type definition for a processed Note object.
 * Adjust these properties to match your application's exact `Note` structure.
 * @typedef {Object} ProcessedNote
 * @property {string} id - Unique identifier for the note.
 * @property {string} name - The note name (e.g., 'C4', 'D#5').
 * @property {string} clef - The clef for the note (e.g., 'treble', 'bass').
 * @property {string} duration - The duration string (e.g., 'q', '8', 'w').
 * @property {boolean} isRest - True if the note is a rest.
 * @property {number} [measure] - Measure index for the note.
 * @property {string} [chordName] - Chord name (set to "Rest" for rests).
 * @property {number} [midiNumber] - MIDI number for the note (e.g., 60 for C4).
 * @property {number} [stemDirection] - Optional: VexFlow stem direction.
 * // Add any other properties relevant to your application's note representation
 */

/**
 * Type definition for a processed Measure object.
 * @typedef {ProcessedNote[]} ProcessedMeasure - An array of ProcessedNote objects.
 */

/**
 * Type definition for the final cleaned Score object.
 * @typedef {Object} CleanScore
 * @property {string} id - Unique score identifier
 * @property {string} name - Score name/filename
 * @property {ProcessedMeasure[]} measures - An array of processed measures.
 * @property {string} keySignature - The key signature of the score (e.g., 'C', 'G', 'Bb').
 * @property {number} tempo - The tempo in BPM.
 * @property {{numerator: number, denominator: number}} timeSignature - The time signature.
 * @property {string} instrument - The instrument name.
 * @property {number} midiChannel - The MIDI channel for playback.
 * @property {boolean} isMinorChordMode - Flag for minor chord mode.
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} modifiedAt - Last modification timestamp
 * @property {number} fileSize - Original file size in bytes
 * // Add any other global score properties
 */

/**
 * Valid durations based on your DURATIONS export
 * Note: No dotted whole notes (w.) allowed, and rests use the same duration keys with isRest: true
 */
const VALID_DURATIONS = {
    'w': { name: 'Whole', beatValue: 4 },
    'h.': { name: 'Dotted Half', beatValue: 3 },
    'h': { name: 'Half', beatValue: 2 },
    'q.': { name: 'Dotted Quarter', beatValue: 1.5 },
    'q': { name: 'Quarter', beatValue: 1 },
    '8.': { name: 'Dotted Eighth', beatValue: 0.75 },
    '8': { name: 'Eighth', beatValue: 0.5 },
    '16.': { name: 'Dotted Sixteenth', beatValue: 0.375 },
    '16': { name: 'Sixteenth', beatValue: 0.25 },
    '32.': { name: 'Dotted Thirty-second', beatValue: 0.1875 },
    '32': { name: 'Thirty-second', beatValue: 0.125 }
};

/**
 * Web Worker script as a string. This script will be executed in a separate thread.
 * It's responsible for parsing the JSON and performing heavy data processing.
 */
const workerScriptContent = `
    // Valid durations with beat values (in 4/4 time)
    const VALID_DURATIONS = {
        'w': { name: 'Whole', beatValue: 4 },
        'h.': { name: 'Dotted Half', beatValue: 3 },
        'h': { name: 'Half', beatValue: 2 },
        'q.': { name: 'Dotted Quarter', beatValue: 1.5 },
        'q': { name: 'Quarter', beatValue: 1 },
        '8.': { name: 'Dotted Eighth', beatValue: 0.75 },
        '8': { name: 'Eighth', beatValue: 0.5 },
        '16.': { name: 'Dotted Sixteenth', beatValue: 0.375 },
        '16': { name: 'Sixteenth', beatValue: 0.25 },
        '32.': { name: 'Dotted Thirty-second', beatValue: 0.1875 },
        '32': { name: 'Thirty-second', beatValue: 0.125 }
    };

    // Validation utilities within worker
    function isValidNoteName(name) {
        const notePattern = /^[A-G][#b]?[0-9]$/;
        return typeof name === 'string' && notePattern.test(name);
    }

    function isValidDuration(duration) {
        return VALID_DURATIONS.hasOwnProperty(duration);
    }

    function isValidClef(clef) {
        const validClefs = ['treble', 'bass', 'alto', 'tenor'];
        return validClefs.includes(clef);
    }

    function validateTimeSignature(timeSignature) {
        if (!timeSignature || typeof timeSignature !== 'object') {
            return false;
        }
        return typeof timeSignature.numerator === 'number' && 
               typeof timeSignature.denominator === 'number' &&
               timeSignature.numerator > 0 && 
               timeSignature.denominator > 0;
    }

    function calculateBeatsPerMeasure(timeSignature) {
        // Calculate how many quarter note beats per measure
        return (timeSignature.numerator * 4) / timeSignature.denominator;
    }

    function validateMeasureBeats(measure, beatsPerMeasure) {
        let totalBeats = 0;
        for (const note of measure) {
            const duration = VALID_DURATIONS[note.duration];
            if (duration) {
                totalBeats += duration.beatValue;
            }
        }
        return { totalBeats, isValid: totalBeats <= beatsPerMeasure };
    }

    function splitMeasureIfNeeded(measure, beatsPerMeasure, measureIndex) {
        const validation = validateMeasureBeats(measure, beatsPerMeasure);
        
        if (validation.isValid) {
            return [measure]; // No splitting needed
        }

        // Split the measure
        const measures = [];
        let currentMeasure = [];
        let currentBeats = 0;

        for (let i = 0; i < measure.length; i++) {
            const note = measure[i];
            const duration = VALID_DURATIONS[note.duration];
            const noteBeats = duration ? duration.beatValue : 1; // Default to quarter note

            // If adding this note would exceed the limit, start a new measure
            if (currentBeats + noteBeats > beatsPerMeasure && currentMeasure.length > 0) {
                // Fill remainder with rest if needed
                const remainingBeats = beatsPerMeasure - currentBeats;
                if (remainingBeats > 0) {
                    const restDuration = findBestDurationForBeats(remainingBeats);
                    currentMeasure.push({
                        id: \`auto-rest-\${measureIndex}-\${measures.length}\`,
                        name: note.clef === 'bass' ? 'D3' : 'B4',
                        clef: note.clef,
                        duration: restDuration,
                        measure: measureIndex + measures.length,
                        isRest: true,
                        chordName: 'Rest'
                    });
                }
                measures.push(currentMeasure);
                currentMeasure = [];
                currentBeats = 0;
            }

            currentMeasure.push({
                ...note,
                measure: measureIndex + measures.length
            });
            currentBeats += noteBeats;
        }

        // Add final measure
        if (currentMeasure.length > 0) {
            const remainingBeats = beatsPerMeasure - currentBeats;
            if (remainingBeats > 0) {
                const lastNote = currentMeasure[currentMeasure.length - 1];
                const restDuration = findBestDurationForBeats(remainingBeats);
                currentMeasure.push({
                    id: \`auto-rest-\${measureIndex}-final\`,
                    name: lastNote.clef === 'bass' ? 'D3' : 'B4',
                    clef: lastNote.clef,
                    duration: restDuration,
                    measure: measureIndex + measures.length,
                    isRest: true,
                    chordName: 'Rest'
                });
            }
            measures.push(currentMeasure);
        }

        return measures.length > 0 ? measures : [[]];
    }

    function findBestDurationForBeats(beats) {
        // Find the best duration that fits within the beat count
        const sortedDurations = Object.entries(VALID_DURATIONS)
            .sort((a, b) => b[1].beatValue - a[1].beatValue); // Sort by beat value, descending

        for (const [duration, info] of sortedDurations) {
            if (info.beatValue <= beats) {
                return duration;
            }
        }
        return '32'; // Fallback to thirty-second note
    }

    function validateNote(note, measureIndex, noteIndex) {
        const errors = [];
        
        if (!note || typeof note !== 'object') {
            errors.push(\`Measure \${measureIndex}, Note \${noteIndex}: Invalid note object\`);
            return { isValid: false, errors, note: null };
        }

        const validatedNote = {
            id: note.id || \`note-\${measureIndex}-\${noteIndex}-\${Date.now()}\`,
            name: isValidNoteName(note.name) ? note.name : (note.clef === 'bass' ? 'D3' : 'B4'),
            clef: isValidClef(note.clef) ? note.clef : 'treble',
            duration: isValidDuration(note.duration) ? note.duration : 'q',
            measure: typeof note.measure === 'number' ? note.measure : measureIndex,
            isRest: typeof note.isRest === 'boolean' ? note.isRest : false,
            chordName: note.isRest ? 'Rest' : (note.chordName || undefined),
            midiNumber: typeof note.midiNumber === 'number' ? note.midiNumber : null,
            stemDirection: typeof note.stemDirection === 'number' ? note.stemDirection : null,
        };

        // Remove chordName if it's not a rest and wasn't originally provided
        if (!validatedNote.isRest && !note.chordName) {
            delete validatedNote.chordName;
        }

        // Warn about corrections made
        if (note.name !== validatedNote.name) {
            errors.push(\`Measure \${measureIndex}, Note \${noteIndex}: Invalid note name '\${note.name}' corrected to '\${validatedNote.name}'\`);
        }
        if (note.clef !== validatedNote.clef) {
            errors.push(\`Measure \${measureIndex}, Note \${noteIndex}: Invalid clef '\${note.clef}' corrected to '\${validatedNote.clef}'\`);
        }
        if (note.duration !== validatedNote.duration) {
            errors.push(\`Measure \${measureIndex}, Note \${noteIndex}: Invalid duration '\${note.duration}' corrected to '\${validatedNote.duration}'\`);
        }
        // Special validation for old-style rest durations
        if (note.duration && note.duration.endsWith('r') && note.duration !== validatedNote.duration) {
            errors.push(\`Measure \${measureIndex}, Note \${noteIndex}: Old rest duration '\${note.duration}' converted to '\${validatedNote.duration}' with isRest: true\`);
        }

        return { isValid: errors.length === 0, errors, note: validatedNote };
    }

    self.onmessage = (event) => {
        const { command, fileContent, fileName, scoreId } = event.data;

        if (command === 'processScore') {
            try {
                // Initial progress report
                self.postMessage({ 
                    type: 'progress', 
                    payload: { current: 0, total: 5, message: \`Parsing \${fileName}...\`, scoreId } 
                });

                const loadedData = JSON.parse(fileContent);
                const rawMeasuresData = loadedData.measures || loadedData;

                if (!Array.isArray(rawMeasuresData)) {
                    throw new Error('Invalid score format: "measures" property is missing or not an array.');
                }

                self.postMessage({ 
                    type: 'progress', 
                    payload: { current: 1, total: 5, message: 'Validating score structure...', scoreId } 
                });

                const totalMeasures = rawMeasuresData.length;
                let processedMeasures = [];
                const validationErrors = [];
                const processingChunkSize = 50;

                // Default metadata with validation
                const defaultMetadata = {
                    keySignature: 'C',
                    tempo: 120,
                    timeSignature: { numerator: 4, denominator: 4 },
                    instrument: 'piano',
                    midiChannel: 0,
                    isMinorChordMode: false,
                };

                const metadata = {
                    keySignature: typeof loadedData.keySignature === 'string' ? loadedData.keySignature : defaultMetadata.keySignature,
                    tempo: typeof loadedData.tempo === 'number' && loadedData.tempo > 0 ? loadedData.tempo : defaultMetadata.tempo,
                    timeSignature: validateTimeSignature(loadedData.timeSignature) ? loadedData.timeSignature : defaultMetadata.timeSignature,
                    instrument: typeof loadedData.instrument === 'string' ? loadedData.instrument : defaultMetadata.instrument,
                    midiChannel: typeof loadedData.midiChannel === 'number' ? loadedData.midiChannel : defaultMetadata.midiChannel,
                    isMinorChordMode: typeof loadedData.isMinorChordMode === 'boolean' ? loadedData.isMinorChordMode : defaultMetadata.isMinorChordMode,
                };

                // Calculate beats per measure based on time signature
                const beatsPerMeasure = calculateBeatsPerMeasure(metadata.timeSignature);

                self.postMessage({ 
                    type: 'progress', 
                    payload: { current: 2, total: 5, message: 'Processing and validating measures...', scoreId } 
                });

                // Process and validate each measure
                for (let i = 0; i < totalMeasures; i++) {
                    const measure = rawMeasuresData[i];
                    
                    if (!Array.isArray(measure)) {
                        validationErrors.push(\`Measure \${i} is not an array. Adding empty measure.\`);
                        processedMeasures.push([]);
                        continue;
                    }

                    const validatedMeasure = [];
                    const measureIssues = [];

                    // Validate each note in the measure
                    for (let j = 0; j < measure.length; j++) {
                        const validation = validateNote(measure[j], i, j);
                        validationErrors.push(...validation.errors);
                        if (validation.note) {
                            validatedMeasure.push(validation.note);
                        }
                    }

                    // Check if measure needs to be split due to too many beats
                    if (validatedMeasure.length > 0) {
                        const splitMeasures = splitMeasureIfNeeded(validatedMeasure, beatsPerMeasure, i);
                        if (splitMeasures.length > 1) {
                            validationErrors.push(\`Measure \${i}: Split into \${splitMeasures.length} measures due to exceeding \${beatsPerMeasure} beats\`);
                        }
                        processedMeasures.push(...splitMeasures);
                    } else {
                        // Empty measure - add a whole rest
                        processedMeasures.push([{
                            id: \`rest-\${i}-0\`,
                            name: 'B4',
                            clef: 'treble',
                            duration: 'w',
                            measure: i,
                            isRest: true,
                            chordName: 'Rest'
                        }]);
                        validationErrors.push(\`Measure \${i}: Empty measure, added whole rest\`);
                    }

                    // Report progress
                    if ((i + 1) % processingChunkSize === 0 || (i + 1) === totalMeasures) {
                        self.postMessage({ 
                            type: 'progress', 
                            payload: { 
                                current: 2 + ((i + 1) / totalMeasures), 
                                total: 5, 
                                message: 'Processing and validating measures...', 
                                scoreId 
                            } 
                        });
                    }
                }

                // Final validation - ensure all measures have proper beat counts
                self.postMessage({ 
                    type: 'progress', 
                    payload: { current: 4, total: 5, message: 'Final validation...', scoreId } 
                });

                // Update measure indices to be sequential after splitting
                let measureIndex = 0;
                processedMeasures = processedMeasures.map(measure => {
                    return measure.map(note => ({
                        ...note,
                        measure: measureIndex
                    }));
                }).map(measure => {
                    measureIndex++;
                    return measure;
                });

                // Final progress update
                self.postMessage({ 
                    type: 'progress', 
                    payload: { current: 5, total: 5, message: 'Finalizing score...', scoreId } 
                });

                // Send processed data back
                self.postMessage({
                    type: 'scoreProcessed',
                    payload: {
                        scoreId,
                        measures: processedMeasures,
                        metadata,
                        validationErrors,
                        originalSize: fileContent.length
                    }
                });

            } catch (error) {
                console.error('Error in score processor worker:', error);
                self.postMessage({ 
                    type: 'error', 
                    payload: { 
                        message: error.message, 
                        stack: error.stack, 
                        scoreId: event.data.scoreId 
                    } 
                });
            }
        }
    };
`;

// Score Manager Class
class ScoreManager {
    constructor() {
        this.scores = new Map(); // Store multiple scores by ID
        this.activeScoreId = null;
        this.workers = new Map(); // Track workers by score ID
        this.eventListeners = new Map(); // Event system for score updates
        this.maxConcurrentWorkers = 3;
        this.workerQueue = [];
        
        // Initialize cleanup on page unload
        window.addEventListener('beforeunload', () => this.cleanup());
    }

    // Event system for score updates
    addEventListener(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    removeEventListener(event, callback) {
        if (this.eventListeners.has(event)) {
            const callbacks = this.eventListeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emitEvent(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    // Generate unique score ID
    generateScoreId() {
        return `score_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Process a score with validation and progress tracking
    async processScore(jsonString, options = {}) {
        const {
            fileName = 'untitled.json',
            onProgress,
            validateOnly = false,
            priority = 'normal'
        } = options;

        if (!window.Worker) {
            throw new Error('Web Workers are not supported in this browser. Cannot process large files efficiently.');
        }

        const scoreId = this.generateScoreId();
        
        return new Promise((resolve, reject) => {
            const processTask = () => {
                const workerBlob = new Blob([workerScriptContent], { type: 'application/javascript' });
                const workerBlobURL = URL.createObjectURL(workerBlob);
                const worker = new Worker(workerBlobURL);
                
                this.workers.set(scoreId, worker);

                const startTime = Date.now();

                worker.onmessage = (event) => {
                    const { type, payload } = event.data;

                    switch (type) {
                        case 'progress':
                            if (onProgress) {
                                onProgress(payload.current, payload.total, payload.message);
                            }
                            this.emitEvent('scoreProgress', { scoreId, ...payload });
                            break;

                        case 'scoreProcessed':
                            const processingTime = Date.now() - startTime;
                            
                            const cleanScore = {
                                id: scoreId,
                                name: fileName,
                                measures: payload.measures,
                                metadata: payload.metadata,
                                createdAt: new Date(),
                                modifiedAt: new Date(),
                                fileSize: payload.originalSize,
                                processingTime,
                                validationErrors: payload.validationErrors || []
                            };

                            if (!validateOnly) {
                                this.scores.set(scoreId, cleanScore);
                                if (!this.activeScoreId) {
                                    this.activeScoreId = scoreId;
                                }
                            }

                            this.cleanup(scoreId);
                            URL.revokeObjectURL(workerBlobURL);
                            this.emitEvent('scoreProcessed', cleanScore);
                            resolve(cleanScore);
                            break;

                        case 'error':
                            this.cleanup(scoreId);
                            URL.revokeObjectURL(workerBlobURL);
                            this.emitEvent('scoreError', { scoreId, error: payload });
                            reject(new Error(`Score processing failed: ${payload.message}`));
                            break;
                    }
                };

                worker.onerror = (errorEvent) => {
                    this.cleanup(scoreId);
                    URL.revokeObjectURL(workerBlobURL);
                    const error = new Error(`Web Worker error: ${errorEvent.message || 'Unknown error'}`);
                    this.emitEvent('scoreError', { scoreId, error });
                    reject(error);
                };

                // Send processing command
                worker.postMessage({
                    command: 'processScore',
                    fileContent: jsonString,
                    fileName,
                    scoreId
                });
            };

            // Queue management for concurrent workers
            if (this.workers.size >= this.maxConcurrentWorkers) {
                this.workerQueue.push({ processTask, priority, scoreId });
                this.emitEvent('scoreQueued', { scoreId, queuePosition: this.workerQueue.length });
            } else {
                processTask();
            }
        });
    }

    // Process the next item in the worker queue
    processQueue() {
        if (this.workerQueue.length > 0 && this.workers.size < this.maxConcurrentWorkers) {
            // Sort by priority (high -> normal -> low)
            this.workerQueue.sort((a, b) => {
                const priorityOrder = { high: 3, normal: 2, low: 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            });

            const { processTask } = this.workerQueue.shift();
            processTask();
        }
    }

    // Validate a score without storing it
    async validateScore(jsonString, options = {}) {
        return this.processScore(jsonString, { ...options, validateOnly: true });
    }

    // Get a score by ID
    getScore(scoreId) {
        return this.scores.get(scoreId);
    }

    // Get all scores
    getAllScores() {
        return Array.from(this.scores.values());
    }

    // Get active score
    getActiveScore() {
        return this.activeScoreId ? this.scores.get(this.activeScoreId) : null;
    }

    // Set active score
    setActiveScore(scoreId) {
        if (this.scores.has(scoreId)) {
            const oldActiveId = this.activeScoreId;
            this.activeScoreId = scoreId;
            this.emitEvent('activeScoreChanged', { 
                oldScoreId: oldActiveId, 
                newScoreId: scoreId,
                score: this.scores.get(scoreId)
            });
            return true;
        }
        return false;
    }

    // Update score metadata
    updateScoreMetadata(scoreId, metadata) {
        const score = this.scores.get(scoreId);
        if (score) {
            score.metadata = { ...score.metadata, ...metadata };
            score.modifiedAt = new Date();
            this.emitEvent('scoreUpdated', score);
            return true;
        }
        return false;
    }

    // Update score measures
    updateScoreMeasures(scoreId, measures) {
        const score = this.scores.get(scoreId);
        if (score) {
            score.measures = measures;
            score.modifiedAt = new Date();
            this.emitEvent('scoreUpdated', score);
            return true;
        }
        return false;
    }

    // Rename a score
    renameScore(scoreId, newName) {
        const score = this.scores.get(scoreId);
        if (score) {
            const oldName = score.name;
            score.name = newName;
            score.modifiedAt = new Date();
            this.emitEvent('scoreRenamed', { scoreId, oldName, newName });
            return true;
        }
        return false;
    }

    // Delete a score
    deleteScore(scoreId) {
        const score = this.scores.get(scoreId);
        if (score) {
            this.scores.delete(scoreId);
            
            // If this was the active score, set a new active score or null
            if (this.activeScoreId === scoreId) {
                const remainingScores = this.getAllScores();
                this.activeScoreId = remainingScores.length > 0 ? remainingScores[0].id : null;
            }
            
            this.emitEvent('scoreDeleted', { scoreId, score });
            return true;
        }
        return false;
    }

    // Clone a score
    cloneScore(scoreId, newName = null) {
        const originalScore = this.scores.get(scoreId);
        if (originalScore) {
            const newScoreId = this.generateScoreId();
            const clonedScore = {
                ...JSON.parse(JSON.stringify(originalScore)), // Deep clone
                id: newScoreId,
                name: newName || `${originalScore.name} (Copy)`,
                createdAt: new Date(),
                modifiedAt: new Date()
            };
            
            this.scores.set(newScoreId, clonedScore);
            this.emitEvent('scoreCloned', { originalScoreId: scoreId, newScoreId, score: clonedScore });
            return clonedScore;
        }
        return null;
    }

    // Get score statistics
    getScoreStats(scoreId) {
        const score = this.scores.get(scoreId);
        if (!score) return null;

        const stats = {
            measureCount: score.measures.length,
            noteCount: 0,
            restCount: 0,
            clefDistribution: { treble: 0, bass: 0, alto: 0, tenor: 0 },
            durationDistribution: {},
            avgNotesPerMeasure: 0,
            totalBeats: 0
        };

        score.measures.forEach(measure => {
            measure.forEach(note => {
                stats.noteCount++;
                if (note.isRest) {
                    stats.restCount++;
                }
                stats.clefDistribution[note.clef] = (stats.clefDistribution[note.clef] || 0) + 1;
                stats.durationDistribution[note.duration] = (stats.durationDistribution[note.duration] || 0) + 1;
                
                // Calculate total beats
                const durationInfo = VALID_DURATIONS[note.duration];
                if (durationInfo) {
                    stats.totalBeats += durationInfo.beatValue;
                }
            });
        });

        stats.avgNotesPerMeasure = stats.measureCount > 0 ? stats.noteCount / stats.measureCount : 0;

        return stats;
    }

    // Export score to JSON
    exportScore(scoreId) {
        const score = this.scores.get(scoreId);
        if (score) {
            return JSON.stringify({
                keySignature: score.metadata.keySignature,
                tempo: score.metadata.tempo,
                timeSignature: score.metadata.timeSignature,
                instrument: score.metadata.instrument,
                midiChannel: score.metadata.midiChannel,
                isMinorChordMode: score.metadata.isMinorChordMode,
                measures: score.measures
            }, null, 2);
        }
        return null;
    }

    // Cleanup worker and resources
    cleanup(scoreId = null) {
        if (scoreId) {
            // Clean up specific worker
            const worker = this.workers.get(scoreId);
            if (worker) {
                worker.terminate();
                this.workers.delete(scoreId);
                this.processQueue(); // Process next item in queue
            }
        } else {
            // Clean up all workers
            this.workers.forEach(worker => worker.terminate());
            this.workers.clear();
            this.workerQueue.length = 0;
        }
    }

    // Get processing status
    getProcessingStatus() {
        return {
            activeWorkers: this.workers.size,
            queuedTasks: this.workerQueue.length,
            maxConcurrentWorkers: this.maxConcurrentWorkers,
            loadedScores: this.scores.size,
            activeScoreId: this.activeScoreId
        };
    }
}

// Create singleton instance
const scoreManager = new ScoreManager();

// Export convenience functions for backward compatibility
export async function processJsonScore(jsonString, options = {}) {
    return scoreManager.processScore(jsonString, options);
}
export function validateJsonScore(jsonString, options = {}) {
   return scoreManager.validateScore(jsonString, options);
}

// Export the manager instance and all its methods
export {
   scoreManager,
   scoreManager as default
};

// Also export individual methods for convenience
export const {
   getScore,
   getAllScores,
   getActiveScore,
   setActiveScore,
   updateScoreMetadata,
   updateScoreMeasures,
   renameScore,
   deleteScore,
   cloneScore,
   getScoreStats,
   exportScore,
   getProcessingStatus,
   addEventListener,
   removeEventListener
} = scoreManager;

// Export the valid durations for use by other modules
export { VALID_DURATIONS };

console.log("✓ Enhanced scoreManager.js loaded successfully");