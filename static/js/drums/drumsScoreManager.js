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
    // Valid durations with beat values (normalized to quarter note beats)
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
        if (typeof name !== 'string') return false;
        
        // Handle chord notation: (D4 F#4) or (B1 F#2 B2 F#3 B3 B3)
        if (name.startsWith('(') && name.endsWith(')')) {
            const noteNames = name.slice(1, -1).split(' ').filter(n => n.trim());
            // All individual notes in the chord must be valid, and we need at least one note
            return noteNames.length > 0 && noteNames.every(noteName => {
                const singleNotePattern = /^[A-G][#b]?[0-9]$/;
                return singleNotePattern.test(noteName.trim());
            });
        }
        
        // Handle single note: C4, F#4, etc.
        const singleNotePattern = /^[A-G][#b]?[0-9]$/;
        return singleNotePattern.test(name);
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
               timeSignature.denominator > 0 &&
               timeSignature.numerator <= 32 && 
               timeSignature.denominator <= 32;
    }

    function calculateBeatsPerMeasure(timeSignature) {
        // Calculate how many quarter note beats per measure
        // e.g., 4/4 = 4 beats, 3/4 = 3 beats, 6/8 = 3 beats, 12/8 = 6 beats
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
        
        // Allow slight tolerance for floating point precision
        const tolerance = 0.001;
        return { 
            totalBeats: Math.round(totalBeats * 1000) / 1000, // Round to 3 decimal places
            isValid: totalBeats <= beatsPerMeasure + tolerance,
            overflow: Math.max(0, totalBeats - beatsPerMeasure)
        };
    }

    function findBestDurationForBeats(beats) {
        // Find the best duration that fits within the beat count
        const tolerance = 0.001;
        const sortedDurations = Object.entries(VALID_DURATIONS)
            .sort((a, b) => b[1].beatValue - a[1].beatValue); // Sort by beat value, descending

        for (const [duration, info] of sortedDurations) {
            if (info.beatValue <= beats + tolerance) {
                return duration;
            }
        }
        return '32'; // Fallback to thirty-second note
    }

    function splitMeasureIfNeeded(measure, beatsPerMeasure, measureIndex) {
        const validation = validateMeasureBeats(measure, beatsPerMeasure);
        
        if (validation.isValid) {
            return [measure]; // No splitting needed
        }

        // Split the measure into valid chunks
        const measures = [];
        let currentMeasure = [];
        let currentBeats = 0;
        const tolerance = 0.001;

        for (let i = 0; i < measure.length; i++) {
            const note = measure[i];
            const duration = VALID_DURATIONS[note.duration];
            const noteBeats = duration ? duration.beatValue : 1; // Default to quarter note

            // If adding this note would exceed the limit, start a new measure
            if (currentBeats + noteBeats > beatsPerMeasure + tolerance && currentMeasure.length > 0) {
                // Fill remainder with rest if there's a significant gap
                const remainingBeats = beatsPerMeasure - currentBeats;
                if (remainingBeats > 0.1) { // Only add rest if gap is meaningful
                    const restDuration = findBestDurationForBeats(remainingBeats);
                    const restNote = currentMeasure.find(n => n.clef) || note; // Get clef from existing note
                    currentMeasure.push({
                        id: \`auto-rest-\${measureIndex}-\${measures.length}-\${Date.now()}\`,
                        name: restNote.clef === 'bass' ? 'D3' : 'B4',
                        clef: restNote.clef || 'treble',
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

            // Add the note to current measure
            currentMeasure.push({
                ...note,
                measure: measureIndex + measures.length
            });
            currentBeats += noteBeats;
        }

        // Handle the final measure
        if (currentMeasure.length > 0) {
            const remainingBeats = beatsPerMeasure - currentBeats;
            if (remainingBeats > 0.1) { // Only add rest if gap is meaningful
                const lastNote = currentMeasure[currentMeasure.length - 1];
                const restDuration = findBestDurationForBeats(remainingBeats);
                currentMeasure.push({
                    id: \`auto-rest-\${measureIndex}-final-\${Date.now()}\`,
                    name: lastNote.clef === 'bass' ? 'D3' : 'B4',
                    clef: lastNote.clef || 'treble',
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

    function validateNote(note, measureIndex, noteIndex) {
        const errors = [];
        
        if (!note || typeof note !== 'object') {
            errors.push(\`Measure \${measureIndex}, Note \${noteIndex}: Invalid note object\`);
            return { isValid: false, errors, note: null };
        }

        // Handle note name validation and correction
        let correctedName = note.name;
        let nameChanged = false;
        
        if (!isValidNoteName(note.name)) {
            // Provide better fallback based on clef
            correctedName = note.clef === 'bass' ? 'D3' : 'B4';
            nameChanged = true;
            
            // Provide specific error messages for different types of invalid names
            if (typeof note.name === 'string') {
                if (note.name.startsWith('(') && note.name.endsWith(')')) {
                    errors.push(\`Measure \${measureIndex}, Note \${noteIndex}: Invalid chord notation '\${note.name}' - check note names within parentheses\`);
                } else {
                    errors.push(\`Measure \${measureIndex}, Note \${noteIndex}: Invalid note name '\${note.name}' corrected to '\${correctedName}'\`);
                }
            } else {
                errors.push(\`Measure \${measureIndex}, Note \${noteIndex}: Note name must be a string, got \${typeof note.name}\`);
            }
        }

        // Handle duration validation and correction
        let correctedDuration = note.duration;
        let durationChanged = false;
        
        if (!isValidDuration(note.duration)) {
            durationChanged = true;
            
            // Special handling for dotted whole notes
            if (note.duration === 'w.') {
                correctedDuration = 'w'; // Convert dotted whole to whole note
                errors.push(\`Measure \${measureIndex}, Note \${noteIndex}: Dotted whole note 'w.' converted to 'w' (VexFlow doesn't support dotted whole notes)\`);
            } 
            // Handle old-style rest durations
            else if (typeof note.duration === 'string' && note.duration.endsWith('r')) {
                const baseDuration = note.duration.slice(0, -1);
                if (isValidDuration(baseDuration)) {
                    correctedDuration = baseDuration;
                    errors.push(\`Measure \${measureIndex}, Note \${noteIndex}: Old rest duration '\${note.duration}' converted to '\${correctedDuration}' with isRest: true\`);
                } else {
                    correctedDuration = 'q';
                    errors.push(\`Measure \${measureIndex}, Note \${noteIndex}: Invalid rest duration '\${note.duration}' corrected to '\${correctedDuration}'\`);
                }
            }
            // Handle other invalid durations
            else {
                correctedDuration = 'q'; // Default fallback
                errors.push(\`Measure \${measureIndex}, Note \${noteIndex}: Invalid duration '\${note.duration}' corrected to '\${correctedDuration}'\`);
            }
        }

        // Handle clef validation
        let correctedClef = note.clef;
        if (!isValidClef(note.clef)) {
            correctedClef = 'treble';
            errors.push(\`Measure \${measureIndex}, Note \${noteIndex}: Invalid clef '\${note.clef}' corrected to '\${correctedClef}'\`);
        }

        // Handle rest flag - for old-style rest durations, force isRest to true
        let correctedIsRest = typeof note.isRest === 'boolean' ? note.isRest : false;
        if (typeof note.duration === 'string' && note.duration.endsWith('r')) {
            correctedIsRest = true;
        }

        const validatedNote = {
            id: note.id || \`note-\${measureIndex}-\${noteIndex}-\${Date.now()}\`,
            name: correctedName,
            clef: correctedClef,
            duration: correctedDuration,
            measure: typeof note.measure === 'number' ? note.measure : measureIndex,
            isRest: correctedIsRest,
            chordName: correctedIsRest ? 'Rest' : (note.chordName || undefined),
            midiNumber: typeof note.midiNumber === 'number' ? note.midiNumber : null,
            stemDirection: typeof note.stemDirection === 'number' ? note.stemDirection : null,
        };

        // Remove chordName if it's not a rest and wasn't originally provided
        if (!validatedNote.isRest && !note.chordName) {
            delete validatedNote.chordName;
        }

        // Clean up null/undefined values
        Object.keys(validatedNote).forEach(key => {
            if (validatedNote[key] === null || validatedNote[key] === undefined) {
                if (key !== 'midiNumber' && key !== 'stemDirection' && key !== 'chordName') {
                    delete validatedNote[key];
                }
            }
        });

        return { 
            isValid: errors.length === 0, 
            errors, 
            note: validatedNote,
            corrected: nameChanged || durationChanged
        };
    }

    function validateMeasure(measure, measureIndex, beatsPerMeasure) {
        if (!Array.isArray(measure)) {
            return {
                isValid: false,
                errors: [\`Measure \${measureIndex} is not an array\`],
                validatedMeasure: [],
                needsSplit: false
            };
        }

        const validatedNotes = [];
        const errors = [];
        let hasCorrections = false;

        // Validate each note
        for (let j = 0; j < measure.length; j++) {
            const validation = validateNote(measure[j], measureIndex, j);
            errors.push(...validation.errors);
            if (validation.corrected) {
                hasCorrections = true;
            }
            if (validation.note) {
                validatedNotes.push(validation.note);
            }
        }

        // Check beat count
        const beatValidation = validateMeasureBeats(validatedNotes, beatsPerMeasure);
        const needsSplit = !beatValidation.isValid;

        if (needsSplit) {
            errors.push(\`Measure \${measureIndex}: Contains \${beatValidation.totalBeats} beats, exceeds limit of \${beatsPerMeasure} beats\`);
        }

        return {
            isValid: errors.length === 0 && !needsSplit,
            errors,
            validatedMeasure: validatedNotes,
            needsSplit,
            hasCorrections,
            totalBeats: beatValidation.totalBeats
        };
    }

    self.onmessage = (event) => {
        const { command, fileContent, fileName, scoreId } = event.data;

        if (command === 'processScore') {
            try {
                // Initial progress report
                self.postMessage({ 
                    type: 'progress', 
                    payload: { current: 0, total: 6, message: \`Parsing \${fileName}...\`, scoreId } 
                });

                const loadedData = JSON.parse(fileContent);
                const rawMeasuresData = loadedData.measures || loadedData;

                if (!Array.isArray(rawMeasuresData)) {
                    throw new Error('Invalid score format: "measures" property is missing or not an array.');
                }

                self.postMessage({ 
                    type: 'progress', 
                    payload: { current: 1, total: 6, message: 'Validating metadata...', scoreId } 
                });

                // Default metadata with enhanced validation
                const defaultMetadata = {
                    keySignature: 'C',
                    tempo: 120,
                    timeSignature: { numerator: 4, denominator: 4 },
                    instrument: 'piano',
                    midiChannel: 0,
                    isMinorChordMode: false,
                };

                const metadata = {
                    keySignature: typeof loadedData.keySignature === 'string' && loadedData.keySignature.length > 0 
                        ? loadedData.keySignature : defaultMetadata.keySignature,
                    tempo: typeof loadedData.tempo === 'number' && loadedData.tempo >= 20 && loadedData.tempo <= 300 
                        ? loadedData.tempo : defaultMetadata.tempo,
                    timeSignature: validateTimeSignature(loadedData.timeSignature) 
                        ? loadedData.timeSignature : defaultMetadata.timeSignature,
                    instrument: typeof loadedData.instrument === 'string' && loadedData.instrument.length > 0 
                        ? loadedData.instrument : defaultMetadata.instrument,
                    midiChannel: typeof loadedData.midiChannel === 'number' && loadedData.midiChannel >= 0 && loadedData.midiChannel <= 15 
                        ? loadedData.midiChannel : defaultMetadata.midiChannel,
                    isMinorChordMode: typeof loadedData.isMinorChordMode === 'boolean' 
                        ? loadedData.isMinorChordMode : defaultMetadata.isMinorChordMode,
                };

                // Calculate beats per measure based on time signature
                const beatsPerMeasure = calculateBeatsPerMeasure(metadata.timeSignature);

                self.postMessage({ 
                    type: 'progress', 
                    payload: { current: 2, total: 6, message: \`Processing \${rawMeasuresData.length} measures...\`, scoreId } 
                });

                const totalMeasures = rawMeasuresData.length;
                let processedMeasures = [];
                const validationErrors = [];
                const processingChunkSize = Math.max(10, Math.floor(totalMeasures / 20)); // Dynamic chunk size
                let correctionCount = 0;
                let splitCount = 0;

                // Process and validate each measure
                for (let i = 0; i < totalMeasures; i++) {
                    const measure = rawMeasuresData[i];
                    const measureValidation = validateMeasure(measure, i, beatsPerMeasure);
                    
                    validationErrors.push(...measureValidation.errors);
                    if (measureValidation.hasCorrections) {
                        correctionCount++;
                    }

                    if (measureValidation.validatedMeasure.length > 0) {
                        if (measureValidation.needsSplit) {
                            const splitMeasures = splitMeasureIfNeeded(measureValidation.validatedMeasure, beatsPerMeasure, i);
                            if (splitMeasures.length > 1) {
                                splitCount++;
                                validationErrors.push(\`Measure \${i}: Split into \${splitMeasures.length} measures due to beat overflow\`);
                            }
                            processedMeasures.push(...splitMeasures);
                        } else {
                            processedMeasures.push(measureValidation.validatedMeasure);
                        }
                    } else {
                        // Empty measure - add a whole rest or appropriate rest for time signature
                        const restDuration = beatsPerMeasure >= 4 ? 'w' : beatsPerMeasure >= 2 ? 'h' : 'q';
                        processedMeasures.push([{
                            id: \`rest-\${i}-0-\${Date.now()}\`,
                            name: 'B4',
                            clef: 'treble',
                            duration: restDuration,
                            measure: i,
                            isRest: true,
                            chordName: 'Rest'
                        }]);
                        validationErrors.push(\`Measure \${i}: Empty measure, added \${VALID_DURATIONS[restDuration].name.toLowerCase()} rest\`);
                    }

                    // Report progress more frequently for large files
                    if ((i + 1) % processingChunkSize === 0 || (i + 1) === totalMeasures) {
                        const progressPercent = ((i + 1) / totalMeasures) * 2; // Scale to 0-2 for step 2-4
                        self.postMessage({ 
                            type: 'progress', 
                            payload: { 
                                current: 2 + progressPercent, 
                                total: 6, 
                                message: \`Processing measures... (\${i + 1}/\${totalMeasures})\`, 
                                scoreId 
                            } 
                        });
                    }
                }

                // Update measure indices and final validation
                self.postMessage({ 
                    type: 'progress', 
                    payload: { current: 5, total: 6, message: 'Finalizing and indexing...', scoreId } 
                });

                // Update measure indices to be sequential after splitting
                let measureIndex = 0;
                processedMeasures = processedMeasures.map(measure => {
                    const updatedMeasure = measure.map(note => ({
                        ...note,
                        measure: measureIndex
                    }));
                    measureIndex++;
                    return updatedMeasure;
                });

                // Final progress update
                self.postMessage({ 
                    type: 'progress', 
                    payload: { current: 6, total: 6, message: 'Processing complete!', scoreId } 
                });

                // Add summary to validation errors
                if (correctionCount > 0 || splitCount > 0) {
                    const summaryParts = [];
                    if (correctionCount > 0) summaryParts.push(\`\${correctionCount} measures corrected\`);
                    if (splitCount > 0) summaryParts.push(\`\${splitCount} measures split\`);
                    validationErrors.unshift(\`Processing Summary: \${summaryParts.join(', ')}\`);
                }

                // Send processed data back
                self.postMessage({
                    type: 'scoreProcessed',
                    payload: {
                        scoreId,
                        measures: processedMeasures,
                        metadata,
                        validationErrors,
                        originalSize: fileContent.length,
                        stats: {
                            originalMeasures: totalMeasures,
                            finalMeasures: processedMeasures.length,
                            correctionCount,
                            splitCount,
                            beatsPerMeasure
                        }
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