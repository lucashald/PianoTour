// chords.js
import { initializeGuitar, GuitarInstrument, guitarState } from '../instrument/guitarInstrument.js';

let chordsDatabase = null;
let guitarInstance = null;

// Load the chord database
async function loadChordDatabase() {
    if (chordsDatabase === null) {
        try {
            const response = await fetch('./static/js/core/ultimate_chord_database.json');
            if (!response.ok) {
                throw new Error(`Failed to load chord database: ${response.status}`);
            }
            chordsDatabase = await response.json();
            console.log(`✅ Loaded chord database with ${Object.keys(chordsDatabase).length} chords`);
        } catch (error) {
            console.error('❌ Error loading chord database:', error);
            throw error;
        }
    }
    return chordsDatabase;
}

// Initialize guitar instrument
async function initializeGuitarInstrument(containerId = 'instrument') {
    if (!guitarInstance) {
        try {
            guitarInstance = initializeGuitar(`#${containerId}`);
            if (guitarInstance) {
                console.log('✅ Guitar instrument integrated with chord database');
            } else {
                console.warn('⚠️  Guitar instrument not available - continuing without guitar integration');
            }
        } catch (error) {
            console.warn('⚠️  Could not initialize guitar instrument:', error);
        }
    }
    return guitarInstance;
}

/**
 * Get available tunings from the database
 * @returns {Array} - Array of tuning names
 */
async function getAvailableTunings() {
    await loadChordDatabase();
    
    const tunings = new Set();
    
    for (const chordData of Object.values(chordsDatabase || {})) {
        const chordTunings = chordData.tunings || {};
        Object.keys(chordTunings).forEach(tuning => tunings.add(tuning));
    }
    
    return Array.from(tunings).sort();
}

/**
 * Get the best fingering for a chord in a specific tuning
 * Priority: ID "0" (best) > ID "1" > etc. > fallback
 * @param {string} chordName - The chord name
 * @param {string} tuning - The tuning name (default: "standard")
 * @param {boolean} setOnGuitar - Whether to automatically set the chord on the guitar (default: true)
 * @returns {Object} - Fingering object with frets, fingers, and metadata
 */
async function getBestFingering(chordName, tuning = "standard", setOnGuitar = true) {
    await loadChordDatabase();
    
    // Fallback fingering if nothing else works
    const fallbackFingering = {
        frets: [0, 0, 0, 0, 0, 0],
        fingers: [0, 0, 0, 0, 0, 0],
        id: "FALLBACK",
        isFallback: true,
        chordName,
        tuning
    };
    
    if (!chordsDatabase || !chordsDatabase[chordName]) {
        console.warn(`⚠️  Chord "${chordName}" not found in database`);
        if (setOnGuitar && guitarInstance) {
            const guitarOrderFrets = convertToGuitarOrder(fallbackFingering.frets);
            guitarInstance.setChord(guitarOrderFrets);
        }
        return fallbackFingering;
    }
    
    const chord = chordsDatabase[chordName];
    const fingerings = chord.tunings?.[tuning] || [];
    
    if (!fingerings || fingerings.length === 0) {
        console.warn(`⚠️  No fingerings found for "${chordName}" in ${tuning} tuning`);
        if (setOnGuitar && guitarInstance) {
            const guitarOrderFrets = convertToGuitarOrder(fallbackFingering.frets);
            guitarInstance.setChord(guitarOrderFrets);
        }
        return fallbackFingering;
    }
    
    // Get the best fingering (ID "0" should be first, but let's be safe)
    let bestFingering = fingerings.find(f => f.id === "0") || fingerings[0];
    
    // Add metadata
    bestFingering = {
        ...bestFingering,
        chordName,
        tuning,
        displayName: chord.displayName || chordName,
        notes: chord.notes || [],
        priority: bestFingering.id
    };
    
    // Automatically set on guitar if enabled and guitar is available
    if (setOnGuitar && guitarInstance && tuning === 'standard') {
        try {
            const guitarOrderFrets = convertToGuitarOrder(bestFingering.frets);
            guitarInstance.setChord(guitarOrderFrets);
            console.log(`🎸 Set ${chordName} on guitar:`, guitarOrderFrets);
        } catch (error) {
            console.warn('⚠️  Could not set chord on guitar:', error);
        }
    }
    
    return bestFingering;
}

/**
 * Look up a chord in the database
 * @param {string} chordName - The name of the chord (e.g., "C", "Am", "D7")
 * @returns {Object|null} - The chord data or null if not found
 */
async function getChord(chordName) {
    await loadChordDatabase();
    
    if (!chordsDatabase) {
        throw new Error('Chord database not loaded');
    }
    
    // Direct lookup
    if (chordsDatabase[chordName]) {
        return {
            name: chordName,
            ...chordsDatabase[chordName]
        };
    }
    
    // Try case-insensitive lookup
    const normalizedName = chordName.toLowerCase();
    for (const [key, value] of Object.entries(chordsDatabase)) {
        if (key.toLowerCase() === normalizedName) {
            return {
                name: key,
                ...value
            };
        }
    }
    
    return null;
}

/**
 * Get all fingerings for a specific tuning
 * @param {string} chordName - The chord name
 * @param {string} tuning - The tuning name (default: "standard")
 * @returns {Array} - Array of fingering objects
 */
async function getChordFingerings(chordName, tuning = "standard") {
    const chord = await getChord(chordName);
    
    if (!chord) {
        return [];
    }
    
    return chord.tunings?.[tuning] || [];
}

/**
 * Get all available chord names
 * @returns {Array} - Array of chord names
 */
async function getAllChordNames() {
    await loadChordDatabase();
    return Object.keys(chordsDatabase || {});
}

/**
 * Search for chords by partial name match
 * @param {string} searchTerm - Partial chord name
 * @returns {Array} - Array of matching chord names
 */
async function searchChords(searchTerm) {
    const allChords = await getAllChordNames();
    const term = searchTerm.toLowerCase();
    
    return allChords.filter(chordName => 
        chordName.toLowerCase().includes(term)
    );
}

/**
 * Set a chord by name on the guitar
 * @param {string} chordName - The chord name
 * @param {string} tuning - The tuning name (default: "standard")
 * @returns {Object} - The fingering that was set
 */
async function setChordOnGuitar(chordName, tuning = "standard") {
    if (!guitarInstance) {
        console.warn('⚠️  Guitar instance not available');
        return null;
    }
    
    const fingering = await getBestFingering(chordName, tuning, true); // setOnGuitar=true
    return fingering;
}

/**
 * Get a random chord from the database
 * @param {string} tuning - Optional tuning filter
 * @returns {Object} - Random chord data with best fingering
 */
async function getRandomChord(tuning = null) {
    await loadChordDatabase();
    
    let availableChords = Object.keys(chordsDatabase || {});
    
    // Filter by tuning if specified
    if (tuning) {
        availableChords = availableChords.filter(chordName => {
            const chord = chordsDatabase[chordName];
            return chord.tunings && chord.tunings[tuning];
        });
    }
    
    if (availableChords.length === 0) {
        return null;
    }
    
    const randomChordName = availableChords[Math.floor(Math.random() * availableChords.length)];
    const randomTuning = tuning || 'standard';
    
    return {
        chordName: randomChordName,
        fingering: await getBestFingering(randomChordName, randomTuning, false) // Don't auto-set
    };
}

/**
 * Validate a fingering array
 * @param {Array} frets - Array of fret numbers (null for muted strings)
 * @returns {boolean} - True if valid
 */
function isValidFingering(frets) {
    return Array.isArray(frets) && 
           frets.length === 6 && 
           frets.every(fret => fret === null || (Number.isInteger(fret) && fret >= 0));
}

/**
 * Format fingering for display
 * @param {Array} frets - Fret array
 * @returns {string} - Formatted string (e.g., "x32010")
 */
function formatFingering(frets) {
    if (!isValidFingering(frets)) {
        return 'Invalid';
    }
    
    return frets.map(fret => fret === null ? 'x' : fret.toString()).join('');
}

/**
 * Convert our database fret order to guitar fret order
 * Our DB: [low_E, A, D, G, B, high_E] (strings 6,5,4,3,2,1)
 * Guitar: [high_E, B, G, D, A, low_E] (strings 1,2,3,4,5,6)
 * @param {Array} databaseFrets - Frets in database order
 * @returns {Array} - Frets in guitar order
 */
function convertToGuitarOrder(databaseFrets) {
    if (!Array.isArray(databaseFrets) || databaseFrets.length !== 6) {
        return [0, 0, 0, 0, 0, 0];
    }
    
    // Reverse the array to convert from our format to guitar format
    return databaseFrets.slice().reverse();
}

/**
 * Convert guitar fret order to our database order
 * @param {Array} guitarFrets - Frets in guitar order
 * @returns {Array} - Frets in database order
 */
function convertFromGuitarOrder(guitarFrets) {
    if (!Array.isArray(guitarFrets) || guitarFrets.length !== 6) {
        return [0, 0, 0, 0, 0, 0];
    }
    
    // Reverse the array to convert from guitar format to our format
    return guitarFrets.slice().reverse();
}

/**
 * Get chord notes as a formatted string
 * @param {string} chordName - The chord name
 * @returns {string} - Formatted notes string
 */
async function getChordNotes(chordName) {
    const chord = await getChord(chordName);
    
    if (!chord || !chord.notes) {
        return '';
    }
    
    return chord.notes.join(', ');
}

/**
 * Initialize the chord system with guitar integration
 * @param {string} guitarContainerId - ID of the container for the guitar
 * @returns {Promise<Object>} - Initialization result
 */
async function initializeChordSystem(guitarContainerId = 'instrument') {
    try {
        // Load database first
        await loadChordDatabase();
        
        // Initialize guitar instrument
        await initializeGuitarInstrument(guitarContainerId);
        
        return {
            success: true,
            database: !!chordsDatabase,
            guitar: !!guitarInstance,
            chordCount: chordsDatabase ? Object.keys(chordsDatabase).length : 0
        };
    } catch (error) {
        console.error('❌ Error initializing chord system:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Export all functions
export {
    loadChordDatabase,
    initializeChordSystem,
    initializeGuitarInstrument,
    getChord,
    getChordFingerings,
    getBestFingering,
    getAvailableTunings,
    getAllChordNames,
    searchChords,
    setChordOnGuitar,
    getRandomChord,
    isValidFingering,
    formatFingering,
    convertToGuitarOrder,
    convertFromGuitarOrder,
    getChordNotes
};

// For compatibility with non-module environments
if (typeof window !== 'undefined') {
    window.ChordDatabase = {
        loadChordDatabase,
        initializeChordSystem,
        getChord,
        getChordFingerings,
        getBestFingering,
        getAvailableTunings,
        getAllChordNames,
        searchChords,
        setChordOnGuitar,
        getRandomChord,
        isValidFingering,
        formatFingering,
        convertToGuitarOrder,
        convertFromGuitarOrder,
        getChordNotes
    };
}