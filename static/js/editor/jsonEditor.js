/**
 * JSON Editor for Piano Tour
 * Handles JSON editing, validation, auto-fixing, and integration with Piano Tour score system
 */

let jsonEditor;
let getMeasures, processAndSyncScore, drawAll;
let setKeySignature, setTimeSignature, setTempo;
let pianoState;

/**
 * Initialize the JSON Editor
 * @param {Object} modules - Piano Tour modules imported from the template
 */
export async function initializeJSONEditor(modules) {
    try {
        console.log('🎼 JSON Editor initializing...');

        // Store imported modules
        ({ 
            getMeasures, 
            processAndSyncScore, 
            drawAll, 
            setKeySignature, 
            setTimeSignature, 
            setTempo,
            pianoState 
        } = modules);

        // Initialize CodeMirror
        const textarea = document.getElementById('jsonEditor');
        if (!textarea) {
            throw new Error('JSON editor textarea not found');
        }

        jsonEditor = CodeMirror.fromTextArea(textarea, {
            mode: { name: "javascript", json: true },
            theme: "default",
            lineNumbers: true,
            matchBrackets: true,
            indentUnit: 2,
            smartIndent: true
        });

        // Setup event listeners
        setupEventListeners();

        // Auto-load score during initialization (localStorage or default)
        await loadScoreOnInit();

        console.log('✅ JSON Editor initialized successfully');

    } catch (error) {
        console.error('❌ Failed to initialize JSON Editor:', error);
        showOutput("❌ Failed to initialize editor: " + error.message, "error");
        throw error;
    }
}

/**
 * Load score during initialization - localStorage first, then default
 */
async function loadScoreOnInit() {
    try {
        console.log('🔄 Loading score for JSON editor...');
        showOutput("🔄 Loading saved score...", "warning");

        // Try localStorage first
        const savedScore = await tryLoadFromLocalStorage();
        if (savedScore) {
            loadScoreData(savedScore, "from saved data");
            return;
        }

        // Fall back to default empty score
        console.log('📝 No saved score found, loading default...');
        loadDefaultScore();

    } catch (error) {
        console.warn('⚠️ Error loading score, using default:', error);
        loadDefaultScore();
    }
}

/**
 * Try to load score from localStorage
 * @returns {Promise<Object|null>} Parsed score data or null
 */
async function tryLoadFromLocalStorage() {
    try {
        const savedScoreJSON = localStorage.getItem("autosavedScore");
        if (!savedScoreJSON) {
            return null;
        }

        const savedData = JSON.parse(savedScoreJSON);

        // Extract measures from saved data
        const measures = Array.isArray(savedData) ? savedData : savedData.measures;

        if (!measures || measures.length === 0) {
            return null;
        }

        return buildScoreData(measures, savedData);

    } catch (error) {
        console.warn('Failed to load from localStorage:', error);
        return null;
    }
}

/**
 * Build complete score data object using current Piano Tour state
 * @param {Array} measures - Array of measures
 * @param {Object} existingData - Existing data to merge (optional)
 * @returns {Object} Complete score data
 */
function buildScoreData(measures, existingData = {}) {
    return {
        measures: measures,
        keySignature: existingData.keySignature || (pianoState ? pianoState.keySignature : "C"),
        tempo: existingData.tempo || (pianoState ? pianoState.tempo : 120),
        timeSignature: existingData.timeSignature || (pianoState ? pianoState.timeSignature : {
            numerator: 4,
            denominator: 4
        }),
        instrument: existingData.instrument || (pianoState ? pianoState.instrument : "piano"),
        midiChannel: existingData.midiChannel || (pianoState ? pianoState.midiChannel : "0"),
        metadata: {
            createdAt: existingData.metadata?.createdAt || new Date().toISOString(),
            source: "Piano Tour Editor",
            loadedAt: new Date().toISOString()
        }
    };
}

/**
 * Load score data into the editor
 * @param {Object} scoreData - Score data to load
 * @param {string} source - Description of data source
 */
function loadScoreData(scoreData, source) {
    const jsonString = JSON.stringify(scoreData, null, 2);
    jsonEditor.setValue(jsonString);
    const loadMessage = [
        `✅ Loaded score ${source}`,
        `- ${scoreData.measures.length} measures`,
        `- Key: ${scoreData.keySignature}`,
        `- Tempo: ${scoreData.tempo} BPM`,
        `- Ready for editing`
    ].join('\n');

    showOutput(loadMessage, "success");
}

/**
 * Load default empty score using current Piano Tour state
 */
function loadDefaultScore() {
    const defaultScore = {
        measures: [],
        keySignature: pianoState ? pianoState.keySignature : "C",
        tempo: pianoState ? pianoState.tempo : 120,
        timeSignature: pianoState ? pianoState.timeSignature : {
            numerator: 4,
            denominator: 4
        },
        instrument: pianoState ? pianoState.instrument : "piano",
        midiChannel: pianoState ? pianoState.midiChannel : "0",
        metadata: {
            createdAt: new Date().toISOString(),
            source: "Piano Tour Editor - Default"
        }
    };

    const jsonString = JSON.stringify(defaultScore, null, 2);
    jsonEditor.setValue(jsonString);

    showOutput("📝 Loaded default empty score with current Piano Tour settings.", "success");
}

/**
 * Setup event listeners for buttons and keyboard shortcuts
 */
function setupEventListeners() {
    // Button event listeners - make loadCurrentScore async
    const buttons = [
        { id: 'formatJSONBtn', handler: formatJSON },
        { id: 'validateJSONBtn', handler: validateJSON },
        { id: 'autoFixJSONBtn', handler: autoFixJSON },
        { id: 'loadCurrentScoreBtn', handler: async () => await loadCurrentScore() }, // Made async
        { id: 'applyToScoreBtn', handler: async () => await applyToScore() } // Made async too for consistency
    ];

    buttons.forEach(({ id, handler }) => {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('click', handler);
        }
    });

    // Keyboard shortcuts
    jsonEditor.setOption("extraKeys", {
        "Ctrl-S": async function() {
            await applyToScore();
            return false;
        },
        "Ctrl-L": async function() {
            await loadCurrentScore();
            return false;
        },
        "Ctrl-Alt-F": function() {
            autoFixJSON();
            return false;
        }
    });
}

/**
 * Format JSON with proper indentation
 */
function formatJSON() {
    try {
        const content = jsonEditor.getValue();
        const parsed = JSON.parse(content);
        const formatted = JSON.stringify(parsed, null, 2);
        jsonEditor.setValue(formatted);
        showOutput("✓ JSON formatted successfully!", "success");
    } catch (error) {
        showOutput("Cannot format - JSON has syntax errors. Try Auto-Fix first.", "error");
    }
}

/**
 * Validate JSON and provide Piano Tour specific feedback
 */
function validateJSON() {
    try {
        const content = jsonEditor.getValue();
        const parsed = JSON.parse(content);

        // Piano Tour specific validation
        const measures = parsed.measures || [];
        const tempo = parsed.tempo || 120;
        const keySignature = parsed.keySignature || "C";
        const timeSignature = parsed.timeSignature || { numerator: 4, denominator: 4 };

        // Count notes across all measures
        let totalNotes = 0;
        let totalRests = 0;

        measures.forEach(measure => {
            if (Array.isArray(measure)) {
                measure.forEach(note => {
                    if (note.isRest) {
                        totalRests++;
                    } else {
                        totalNotes++;
                    }
                });
            }
        });

        const validationReport = [
            `✓ Valid Piano Tour JSON!`,
            `- ${measures.length} measures`,
            `- ${totalNotes} notes, ${totalRests} rests`,
            `- Tempo: ${tempo} BPM`,
            `- Key: ${keySignature}`,
            `- Time Signature: ${timeSignature.numerator}/${timeSignature.denominator}`
        ].join('\n');

        showOutput(validationReport, "success");

    } catch (error) {
        const errorDetails = [
            `✗ Invalid JSON: ${error.message}`,
            ``,
            `🚀 Use Auto-Fix to repair common issues automatically.`,
            `🔍 Use Ctrl+F to find specific errors in large files.`
        ].join('\n');

        showOutput(errorDetails, "error");
    }
}

/**
 * Auto-fix common JSON issues using jsonrepair library
 */
function autoFixJSON() {
    try {
        const content = jsonEditor.getValue();

        if (!content.trim()) {
            showOutput("Editor is empty - nothing to fix.", "warning");
            return;
        }

        showOutput("🔧 Auto-fixing JSON...", "warning");

        // Use jsonrepair library (must be loaded globally)
        if (typeof JSONRepair === 'undefined') {
            throw new Error("JSONRepair library not loaded. Please refresh the page.");
        }

        const fixed = JSONRepair.jsonrepair(content);
        jsonEditor.setValue(fixed);

        // Validate the result
        const parsed = JSON.parse(fixed);

        // Format it nicely
        const formatted = JSON.stringify(parsed, null, 2);
        jsonEditor.setValue(formatted);

        const successMessage = [
            "🚀 JSON auto-fixed successfully!",
            "✓ Missing brackets/commas added",
            "✓ Quotes corrected", 
            "✓ Formatted and ready for Piano Tour"
        ].join('\n');

        showOutput(successMessage, "success");

    } catch (error) {
        const errorMessage = [
            `❌ Auto-fix failed: ${error.message}`,
            ``,
            `Try:`,
            `- Use Find/Replace (Ctrl+H) for manual fixes`,
            `- Check for severely malformed structure`,
            `- Start with a simpler JSON structure`
        ].join('\n');

        showOutput(errorMessage, "error");
    }
}
/**
 * Manually reload the current Piano Tour score from localStorage
 */
async function loadCurrentScore() {
    try {
        showOutput("🔄 Refreshing from saved data...", "warning");

        // Load from localStorage or current Piano Tour state
        const savedScore = await tryLoadFromLocalStorage(); // Added await here
        if (savedScore) {
            loadScoreData(savedScore, "refreshed from saved data");
        } else {
            // Use current Piano Tour state if no saved data
            const currentScore = buildScoreData([]);
            loadScoreData(currentScore, "from current Piano Tour settings");
        }

    } catch (error) {
        console.error('Error loading current score:', error);
        showOutput("❌ Failed to refresh score: " + error.message, "error");
    }
}

/**
 * Apply the edited JSON back to the Piano Tour score with metadata handling
 */
async function applyToScore() {
    try {
        const content = jsonEditor.getValue();
        const parsed = JSON.parse(content);

        if (!parsed.measures || !Array.isArray(parsed.measures)) {
            throw new Error("JSON must contain a 'measures' array");
        }

        // Validate measure structure before applying
        validateMeasureStructure(parsed.measures);

        showOutput("🔄 Applying to Piano Tour...", "warning");

        // Apply the processed score using the same logic as file loading
        await applyProcessedScore({
            measures: parsed.measures,
            metadata: {
                keySignature: parsed.keySignature || "C",
                tempo: parsed.tempo || 120,
                timeSignature: parsed.timeSignature || { numerator: 4, denominator: 4 },
                instrument: parsed.instrument || "piano",
                midiChannel: parsed.midiChannel || "0",
                isMinorChordMode: parsed.isMinorChordMode || false
            },
            name: "JSON Editor"
        });

    } catch (error) {
        console.error('Error applying to score:', error);
        const errorMessage = [
            `❌ Failed to apply to score: ${error.message}`,
            ``,
            `Common issues:`,
            `- Invalid note names or durations`,
            `- Missing required fields (name, clef, duration)`,
            `- Malformed measure structure`
        ].join('\n');

        showOutput(errorMessage, "error");
    }
}

/**
 * Apply processed score with metadata handling (adapted from your existing function)
 */
async function applyProcessedScore(processedScore) {
    try {
        console.log('Applying processed score from JSON Editor:', processedScore.name);

        // CRITICAL: Set time signature and tempo BEFORE processing measures
        const timeSignature = processedScore.metadata.timeSignature;
        const tempo = processedScore.metadata.tempo;
        const keySignature = processedScore.metadata.keySignature;

        console.log(`Setting time signature to ${timeSignature.numerator}/${timeSignature.denominator} and tempo to ${tempo} before processing...`);

        // Apply time signature and tempo
        if (!setTimeSignature(timeSignature.numerator, timeSignature.denominator)) {
            console.warn('Failed to set time signature, using default 4/4');
            setTimeSignature(4, 4);
        }
        if (!setTempo(tempo)) {
            console.warn('Failed to set tempo, using default 120 BPM');
            setTempo(120);
        }

        // Apply measures to scoreWriter (now with correct time signature set)
        if (processAndSyncScore(processedScore.measures)) {

            // Apply key signature
            if (setKeySignature(keySignature)) {
                console.log(`Key signature set to: ${keySignature}`);
            } else {
                console.warn('Failed to set key signature, using C major');
                setKeySignature('C');
            }

            // Update piano state with loaded metadata
            if (pianoState) {
                pianoState.tempo = processedScore.metadata.tempo;
                pianoState.instrument = processedScore.metadata.instrument;
                pianoState.midiChannel = processedScore.metadata.midiChannel;
                pianoState.isMinorChordMode = processedScore.metadata.isMinorChordMode || false;
            }

            // Re-render the score
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    try {
                        drawAll(getMeasures());
                        console.log(`Score rendered successfully with time signature ${timeSignature.numerator}/${timeSignature.denominator}`);
                        resolve();
                    } catch (renderError) {
                        console.error('Rendering error:', renderError);
                        showOutput('Score applied but rendering failed. The data may be too complex.', 'warning');
                        resolve();
                    }
                });
            });

            const successMessage = [
                `✅ Applied to Piano Tour score!`,
                `- ${processedScore.measures.length} measures processed`,
                `- Key: ${keySignature}, Tempo: ${tempo} BPM`,
                `- Time Signature: ${timeSignature.numerator}/${timeSignature.denominator}`,
                `- Score updated and rendered`
            ].join('\n');

            showOutput(successMessage, "success");

            console.log("JSON applied successfully to Piano Tour.");
        } else {
            throw new Error("Could not apply the processed score data to scoreWriter");
        }

    } catch (error) {
        console.error('Error applying processed score:', error);
        throw error;
    }
}

/**
 * Validate the structure of measures array
 * @param {Array} measures - Array of measures to validate
 */
function validateMeasureStructure(measures) {
    measures.forEach((measure, measureIndex) => {
        if (!Array.isArray(measure)) {
            throw new Error(`Measure ${measureIndex} must be an array`);
        }

        measure.forEach((note, noteIndex) => {
            if (typeof note !== 'object' || note === null) {
                throw new Error(`Note ${noteIndex} in measure ${measureIndex} must be an object`);
            }

            // Check required fields
            const requiredFields = ['name', 'clef', 'duration'];
            requiredFields.forEach(field => {
                if (!(field in note)) {
                    throw new Error(`Note ${noteIndex} in measure ${measureIndex} missing required field: ${field}`);
                }
            });

            // Validate clef values
            if (!['treble', 'bass'].includes(note.clef)) {
                throw new Error(`Invalid clef "${note.clef}" in measure ${measureIndex}, note ${noteIndex}`);
            }
        });
    });
}

/**
 * Display output message with appropriate styling
 * @param {string} message - Message to display
 * @param {string} type - Message type (success, error, warning)
 */
function showOutput(message, type) {
    const output = document.getElementById('jsonOutput');
    if (output) {
        output.textContent = message;
        output.className = 'json-output ' + type;
    }
}

/**
 * Get the current JSON content from the editor
 * @returns {string} Current JSON content
 */
export function getCurrentJSON() {
    return jsonEditor ? jsonEditor.getValue() : '';
}

/**
 * Set JSON content in the editor
 * @param {string} content - JSON content to set
 */
export function setJSON(content) {
    if (jsonEditor) {
        jsonEditor.setValue(content);
    }
}

/**
 * Focus the JSON editor
 */
export function focusEditor() {
    if (jsonEditor) {
        jsonEditor.focus();
    }
}