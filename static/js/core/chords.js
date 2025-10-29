// chords.js - Simple chord database with guitar tuning integration
import { setGuitarTuning, getCurrentTuningNotes, getPresetTunings } from '../instrument/guitarInstrument.js';
import { getKeySignature, DIATONIC_SCALES } from './note-data.js';
let chordsDatabase = null;

/**
 * Load the chord database from JSON file
 * @returns {Promise<Object>} The loaded chord database
 */
async function loadChordDatabase() {
    if (chordsDatabase === null) {
        try {
            const response = await fetch('./static/js/core/chord_database.json');
            if (!response.ok) {
                throw new Error(`Failed to load chord database: ${response.status}`);
            }
            chordsDatabase = await response.json();
            console.log(`Loaded chord database with ${Object.keys(chordsDatabase).length} chords`);
        } catch (error) {
            console.error('❌ Error loading chord database:', error);
            throw error;
        }
    }
    return chordsDatabase;
}

/**
 * Initialize the chord database
 * @returns {Promise<boolean>} True if successful
 */
async function initializeChordDatabase() {
    try {
        await loadChordDatabase();
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize chord database:', error);
        return false;
    }
}

/**
 * Get available tunings from the database
 * @returns {Promise<Array>} Array of tuning names
 */
async function getAvailableTunings() {
    await loadChordDatabase();
    
    const tunings = new Set();
    
    // Add tunings from chord database
    for (const chordData of Object.values(chordsDatabase || {})) {
        const chordTunings = chordData.tunings || {};
        Object.keys(chordTunings).forEach(tuning => tunings.add(tuning));
    }
    
    // Also add preset tunings from guitarInstrument (even if no chords available)
    try {
        const presetTunings = getPresetTunings();
        Object.keys(presetTunings).forEach(tuning => tunings.add(tuning));
    } catch (error) {
        console.warn('Could not get preset tunings:', error);
    }
    
    return Array.from(tunings).sort();
}

/**
 * Change guitar tuning and update display
 * @param {string} tuningName - Name of the tuning
 * @returns {Promise<boolean>} True if successful
 */
async function changeGuitarTuning(tuningName) {
    try {
        console.log(`Changing guitar tuning to: ${tuningName}`);
        
        // Try to set the tuning using guitarInstrument
        const success = setGuitarTuning(tuningName);
        
        if (success) {
            const currentNotes = getCurrentTuningNotes();
            console.log(`Guitar tuning changed to ${tuningName}:`, currentNotes);
            
            // Trigger a custom event that the UI can listen to
            window.dispatchEvent(new CustomEvent('guitarTuningChanged', {
                detail: { tuning: tuningName, notes: currentNotes }
            }));
            
            return true;
        } else {
            console.error(`❌ Failed to set tuning: ${tuningName}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Error changing guitar tuning:', error);
        return false;
    }
}

async function getBestFingering(chordName, tuning = "standard") {
    await loadChordDatabase();
    
    // Map the tuning name to database format
    const dbTuningName = mapTuningName(tuning);
    
    // Fallback fingering if nothing else works
    const fallbackFingering = {
        frets: [0, 0, 0, 0, 0, 0],
        fingers: [0, 0, 0, 0, 0, 0],
        id: "FALLBACK",
        isFallback: true,
        chordName,
        tuning: dbTuningName
    };
    
    if (!chordsDatabase || !chordsDatabase[chordName]) {
        console.warn(`⚠️  Chord "${chordName}" not found in database`);
        return fallbackFingering;
    }
    
    const chord = chordsDatabase[chordName];
    const fingerings = chord.tunings?.[dbTuningName] || [];
    
    if (!fingerings || fingerings.length === 0) {
        console.warn(`⚠️  No fingerings found for "${chordName}" in ${dbTuningName} tuning`);
        return fallbackFingering;
    }
    
    // Get the best fingering (ID "0" should be first, but let's be safe)
    let bestFingering = fingerings.find(f => f.id === "0") || fingerings[0];
    
    // Add metadata
    bestFingering = {
        ...bestFingering,
        chordName,
        tuning: dbTuningName,
        displayName: chord.displayName || chordName,
        notes: chord.notes || [],
        priority: bestFingering.id
    };
    
    return bestFingering;
}

/**
 * Look up a chord in the database
 * @param {string} chordName - The name of the chord (e.g., "C", "Am", "D7")
 * @returns {Promise<Object|null>} The chord data or null if not found
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
 * @param {string} tuning - The tuning name (guitar preset name)
 * @returns {Promise<Array>} Array of fingering objects
 */
async function getChordFingerings(chordName, tuning = "standard") {
    const chord = await getChord(chordName);
    
    if (!chord) {
        return [];
    }
    
    // Map the tuning name to database format
    const dbTuningName = mapTuningName(tuning);
    
    return chord.tunings?.[dbTuningName] || [];
}

/**
 * Get all available chord names
 * @returns {Promise<Array>} Array of chord names
 */
async function getAllChordNames() {
    await loadChordDatabase();
    return Object.keys(chordsDatabase || {});
}

/**
 * Get all available chord names with their display names
 * @returns {Promise<Array>} Array of objects with {symbol, displayName}
 */
async function getAllChordDisplayNames() {
    await loadChordDatabase();
    
    if (!chordsDatabase) {
        console.warn('Chord database not loaded, returning empty array');
        return [];
    }
    
    const chordList = [];
    
    for (const [symbol, chordData] of Object.entries(chordsDatabase)) {
        chordList.push({
            symbol: symbol,
            displayName: chordData.displayName || symbol
        });
    }
    
    // Sort by display name for better user experience
    chordList.sort((a, b) => a.displayName.localeCompare(b.displayName));
    
    console.log(`Retrieved ${chordList.length} chord display names`);
    return chordList;
}

/**
 * Get chord count
 * @returns {Promise<number>} Number of chords in database
 */
async function getChordCount() {
    await loadChordDatabase();
    return Object.keys(chordsDatabase || {}).length;
}

/**
 * Search for chords by partial name match
 * @param {string} searchTerm - Partial chord name
 * @returns {Promise<Array>} Array of matching chord names
 */
async function searchChords(searchTerm) {
    const allChords = await getAllChordNames();
    const term = searchTerm.toLowerCase();
    
    return allChords.filter(chordName => 
        chordName.toLowerCase().includes(term)
    );
}

/**
 * Get a random chord from the database
 * @param {string} tuning - Optional tuning filter
 * @returns {Promise<Object|null>} Random chord data with best fingering
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
        fingering: await getBestFingering(randomChordName, randomTuning)
    };
}

/**
 * Validate a fingering array
 * @param {Array} frets - Array of fret numbers (null for muted strings)
 * @returns {boolean} True if valid
 */
function isValidFingering(frets) {
    return Array.isArray(frets) && 
           frets.length === 6 && 
           frets.every(fret => fret === null || (Number.isInteger(fret) && fret >= 0));
}

/**
 * Format fingering for display
 * @param {Array} frets - Fret array
 * @returns {string} Formatted string (e.g., "x32010")
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
 * @returns {Array} Frets in guitar order
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
 * @returns {Array} Frets in database order
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
 * @returns {Promise<string>} Formatted notes string
 */
async function getChordNotes(chordName) {
    const chord = await getChord(chordName);
    
    if (!chord || !chord.notes) {
        return '';
    }
    
    return chord.notes.join(', ');
}

/**
 * Create a mapping between guitar preset names and database tuning names
 * @returns {Object} Mapping object
 */
function createTuningNameMapping() {
    return {
        // Guitar preset name -> Database tuning name
        'standard': 'standard',
        'dropD': 'drop_d',
        'openG': 'open_g', 
        'openD': 'open_d',
        'openE': 'open_e',
        'dadgad': 'dadgad',
    };
}

/**
 * Convert guitar preset tuning name to database tuning name
 * @param {string} presetName - Guitar preset name
 * @returns {string} Database tuning name
 */
function mapTuningName(presetName) {
    const mapping = createTuningNameMapping();
    const mapped = mapping[presetName] || presetName;
    console.log(`Mapping tuning: ${presetName} -> ${mapped}`);
    return mapped;
}

/**
 * Get current guitar tuning information
 * @returns {Object} Current tuning info
 */
function getCurrentGuitarTuning() {
    try {
        return {
            notes: getCurrentTuningNotes(),
            presets: getPresetTunings()
        };
    } catch (error) {
        console.warn('Could not get current guitar tuning:', error);
        return {
            notes: ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'], // Standard tuning fallback
            presets: {}
        };
    }
}

// Add this function to the chords.js file
/**
 * Get chord by scale degree using comprehensive chord database
 * @param {number} degree - Scale degree (1-7)
 * @param {string} keySignature - Optional key signature, uses current if not provided
 * @param {string} tuning - Optional tuning for fingering, defaults to 'standard'
 * @returns {Promise<Object|null>} Enhanced chord object with database fingerings
 */
async function getGuitarChordByDegree(degree = 1, keySignature = null, tuning = 'standard') {
  // Validate degree
  if (degree < 1 || degree > 7) {
    console.warn(`Invalid scale degree ${degree}. Must be 1-7`);
    return null;
  }

  // Use provided key signature or fall back to current key signature
  const keyToUse = keySignature || getKeySignature();
  const scaleData = DIATONIC_SCALES[keyToUse];

  if (!scaleData) {
    console.warn(`Scale data not found for key: ${keyToUse}`);
    return null;
  }

  // Get chord info directly from pre-calculated arrays
  const chordRoot = scaleData.chordRoots[degree - 1];
  const quality = scaleData.qualities[degree - 1];

  // Build chord name based on quality
  let chordSymbol = chordRoot;
  switch (quality) {
    case "min": 
      chordSymbol += "m"; 
      break;
    case "dom7": 
      chordSymbol += "7"; 
      break;
    case "dim": 
      chordSymbol += "dim"; 
      break;
    // "maj" gets no suffix
  }

  try {
    // Look up in comprehensive chord database
    const chordData = await getChord(chordSymbol);
    
    if (!chordData) {
      console.warn(`Chord ${chordSymbol} not found in comprehensive database`);
      return null;
    }

    // Get best fingering for the specified tuning
    const bestFingering = await getBestFingering(chordSymbol, tuning);

    // Return enhanced chord object with database data and fingering
    return {
      ...chordData,
      symbol: chordSymbol,
      degree: degree,
      quality: quality,
      keySignature: keyToUse,
      tuning: tuning,
      frets: bestFingering.frets,
      fingers: bestFingering.fingers,
      isFallback: bestFingering.isFallback,
      fingering: bestFingering
    };

  } catch (error) {
    console.error(`Error looking up chord ${chordSymbol}:`, error);
    return null;
  }
}

/**
 * Get all chords for a scale using comprehensive chord database
 * @param {string} keySignature - Optional key signature, uses current if not provided  
 * @param {string} tuning - Optional tuning for fingerings, defaults to 'standard'
 * @returns {Promise<Array>} Array of chord objects for degrees 1-7
 */
async function getAllScaleChords(keySignature = null, tuning = 'standard') {
  const chords = [];
  
  for (let degree = 1; degree <= 7; degree++) {
    const chord = await getGuitarChordByDegree(degree, keySignature, tuning);
    if (chord) {
      chords.push(chord);
    }
  }
  
  return chords;
}

/**
 * Get chord progression using comprehensive chord database
 * @param {Array<number>} degrees - Array of scale degrees (e.g., [1, 5, 6, 4])
 * @param {string} keySignature - Optional key signature, uses current if not provided
 * @param {string} tuning - Optional tuning for fingerings, defaults to 'standard'
 * @returns {Promise<Array>} Array of chord objects for the progression
 */
async function getChordProgression(degrees, keySignature = null, tuning = 'standard') {
  const progression = [];
  
  for (const degree of degrees) {
    const chord = await getGuitarChordByDegree(degree, keySignature, tuning);
    if (chord) {
      progression.push(chord);
    }
  }
  
  return progression;
}

// Export all functions
export {
    loadChordDatabase,
    initializeChordDatabase,
    getChord,
    getChordFingerings,
    getBestFingering,
    getAvailableTunings,
    getAllChordNames,
    getAllChordDisplayNames,
    getChordCount,
    searchChords,
    getRandomChord,
    isValidFingering,
    formatFingering,
    convertToGuitarOrder,
    convertFromGuitarOrder,
    getChordNotes,
    changeGuitarTuning,
    getCurrentGuitarTuning,
    getChordProgression,
    getAllScaleChords,
    getGuitarChordByDegree
};

// For compatibility with non-module environments
if (typeof window !== 'undefined') {
    window.ChordDatabase = {
        loadChordDatabase,
        initializeChordDatabase,
        getChord,
        getChordFingerings,
        getBestFingering,
        getAvailableTunings,
        getAllChordNames,
        getAllChordDisplayNames,
        getChordCount,
        searchChords,
        getRandomChord,
        isValidFingering,
        formatFingering,
        convertToGuitarOrder,
        convertFromGuitarOrder,
        getChordNotes,
        changeGuitarTuning,
        getCurrentGuitarTuning,
        getChordProgression,
        getAllScaleChords,
        getGuitarChordByDegree
    };
}