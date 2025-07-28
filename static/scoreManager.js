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
 * @property {ProcessedMeasure[]} measures - An array of processed measures.
 * @property {string} keySignature - The key signature of the score (e.g., 'C', 'G', 'Bb').
 * @property {number} tempo - The tempo in BPM.
 * @property {{numerator: number, denominator: number}} timeSignature - The time signature.
 * @property {string} instrument - The instrument name.
 * @property {number} midiChannel - The MIDI channel for playback.
 * @property {boolean} isMinorChordMode - Flag for minor chord mode.
 * // Add any other global score properties
 */

/**
 * Web Worker script as a string. This script will be executed in a separate thread.
 * It's responsible for parsing the JSON and performing heavy data processing.
 */
const workerScriptContent = `
    self.onmessage = (event) => {
        const { command, fileContent, fileName } = event.data;

        if (command === 'processScore') {
            try {
                // Initial progress report for parsing
                self.postMessage({ type: 'progress', payload: { current: 0, total: 2, message: \`Parsing \${fileName}...\` } });

                const loadedData = JSON.parse(fileContent);
                const rawMeasuresData = loadedData.measures || loadedData; // Handle direct array or object with measures key

                if (!Array.isArray(rawMeasuresData)) {
                    throw new Error('Invalid score format: "measures" property is missing or not an array.');
                }

                const totalMeasures = rawMeasuresData.length;
                const processedMeasures = [];
                const processingChunkSize = 50; // Process 50 measures before reporting progress

                // Simulate heavy processing for each measure
                for (let i = 0; i < totalMeasures; i++) {
                    const measure = rawMeasuresData[i];
                    if (!Array.isArray(measure)) {
                        console.warn(\`Measure \${i} is not an array. Skipping.\`);
                        processedMeasures.push([]); // Add an empty measure or handle as error
                        continue;
                    }

                    const processedMeasure = measure.map(note => {
                        // --- START: Your actual Note Processing Logic Here ---
                        // This is where you would validate, sanitize, and transform each note object.
                        // Example: Ensure required fields exist, set defaults, calculate MIDI numbers, etc.
                        const cleanedNote = {
                            id: note.id || \`note-\${i}-\${Date.now() + Math.random()}\`, // Generate if missing
                            name: typeof note.name === 'string' ? note.name : 'C4', // Default
                            clef: typeof note.clef === 'string' ? note.clef : 'treble', // Default
                            duration: typeof note.duration === 'string' ? note.duration : 'q', // Default to quarter
                            isRest: typeof note.isRest === 'boolean' ? note.isRest : false,
                            // Add other properties with robust validation/defaults
                            midiNumber: note.midiNumber || null, // You'd likely calculate this based on name/octave
                            stemDirection: note.stemDirection || null,
                        };
                        // More complex validation/transformation could go here, e.g.,
                        // if (!isValidNoteName(cleanedNote.name)) cleanedNote.name = 'C4';
                        // if (!isValidDuration(cleanedNote.duration)) cleanedNote.duration = 'q';

                        return cleanedNote;
                        // --- END: Your actual Note Processing Logic Here ---
                    });
                    processedMeasures.push(processedMeasure);

                    if ((i + 1) % processingChunkSize === 0 || (i + 1) === totalMeasures) {
                        self.postMessage({ type: 'progress', payload: { current: (i + 1), total: totalMeasures, message: 'Processing score data...' } });
                    }
                }

                // Default values for score metadata
                const defaultScoreData = {
                    keySignature: 'C',
                    tempo: 120,
                    timeSignature: { numerator: 4, denominator: 4 },
                    instrument: 'piano',
                    midiChannel: 0,
                    isMinorChordMode: false,
                };

                // Merge loaded data with defaults, prioritizing loaded data
                const finalScoreMetadata = {
                    keySignature: loadedData.keySignature || defaultScoreData.keySignature,
                    tempo: typeof loadedData.tempo === 'number' ? loadedData.tempo : defaultScoreData.tempo,
                    timeSignature: {
                        numerator: typeof loadedData.timeSignature?.numerator === 'number' ? loadedData.timeSignature.numerator : defaultScoreData.timeSignature.numerator,
                        denominator: typeof loadedData.timeSignature?.denominator === 'number' ? loadedData.timeSignature.denominator : defaultScoreData.timeSignature.denominator,
                    },
                    instrument: typeof loadedData.instrument === 'string' ? loadedData.instrument : defaultScoreData.instrument,
                    midiChannel: typeof loadedData.midiChannel === 'number' ? loadedData.midiChannel : defaultScoreData.midiChannel,
                    isMinorChordMode: typeof loadedData.isMinorChordMode === 'boolean' ? loadedData.isMinorChordMode : defaultScoreData.isMinorChordMode,
                };


                // Send processed data back to the main thread
                self.postMessage({
                    type: 'scoreProcessed',
                    payload: {
                        measures: processedMeasures,
                        ...finalScoreMetadata // Spread the validated metadata
                    }
                });

            } catch (error) {
                console.error('Error in score processor worker:', error);
                self.postMessage({ type: 'error', payload: { message: error.message, stack: error.stack } });
            }
        }
    };
`;

// Create a Blob URL for the worker script
const workerBlob = new Blob([workerScriptContent], { type: 'application/javascript' });
const workerBlobURL = URL.createObjectURL(workerBlob);

let scoreProcessorWorker = null; // Single worker instance

/**
 * Processes a raw JSON string containing score data into a clean, structured object.
 * This function uses a Web Worker to perform heavy parsing and data cleaning in the background,
 * preventing the main thread from blocking.
 *
 * It provides progress updates via an optional callback.
 *
 * @param {string} jsonString - The raw JSON string representing the score.
 * @param {Object} [options] - Optional settings for processing.
 * @param {function(current: number, total: number, message: string): void} [options.onProgress] - Callback for progress updates.
 * @returns {Promise<CleanScore>} A promise that resolves with the cleaned score object.
 * @throws {Error} If Web Workers are not supported or if processing fails.
 */
export async function processJsonScore(jsonString, options = {}) {
    const { onProgress } = options;

    return new Promise((resolve, reject) => {
        if (!window.Worker) {
            const error = new Error('Web Workers are not supported in this browser. Cannot process large file efficiently.');
            console.error(error);
            // In a fallback scenario, you might try a synchronous parse here,
            // but it's explicitly against the goal of avoiding "too many ticks".
            return reject(error);
        }

        // Terminate any existing worker to prevent multiple workers running
        if (scoreProcessorWorker) {
            scoreProcessorWorker.terminate();
            scoreProcessorWorker = null;
            console.log('Terminated existing score processor worker.');
        }

        // Create a new Web Worker instance using the Blob URL
        scoreProcessorWorker = new Worker(workerBlobURL);

        // Listen for messages from the worker
        scoreProcessorWorker.onmessage = (event) => {
            const { type, payload } = event.data;

            switch (type) {
                case 'progress':
                    if (onProgress) {
                        onProgress(payload.current, payload.total, payload.message);
                    }
                    break;
                case 'scoreProcessed':
                    console.log('Score processing complete in worker.');
                    resolve(payload); // Resolve the promise with the cleaned score object
                    // Clean up the worker and its URL
                    scoreProcessorWorker.terminate();
                    scoreProcessorWorker = null;
                    URL.revokeObjectURL(workerBlobURL);
                    break;
                case 'error':
                    console.error('Error from score processor worker:', payload);
                    // Clean up the worker and its URL on error
                    scoreProcessorWorker.terminate();
                    scoreProcessorWorker = null;
                    URL.revokeObjectURL(workerBlobURL);
                    reject(new Error(`Score processing failed: ${payload.message}`));
                    break;
            }
        };

        // Handle worker errors (e.g., script parsing error)
        scoreProcessorWorker.onerror = (errorEvent) => {
            console.error('Web Worker general error:', errorEvent);
            // Clean up the worker and its URL on error
            scoreProcessorWorker.terminate();
            scoreProcessorWorker = null;
            URL.revokeObjectURL(workerBlobURL);
            reject(new Error(`A critical Web Worker error occurred during score processing: ${errorEvent.message || 'Unknown error'}`));
        };

        // Send the raw JSON string to the worker for processing
        scoreProcessorWorker.postMessage({
            command: 'processScore',
            fileContent: jsonString,
            fileName: 'loaded-score.json' // A placeholder name for progress messages
        });
    });
}