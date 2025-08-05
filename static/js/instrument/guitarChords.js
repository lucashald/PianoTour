// guitarChords.js - Enhanced Guitar Chord Database with Tombatossals Integration
// This file provides comprehensive chord data, multiple fingering positions, and SVG chord diagram rendering

// ===================================================================
// Comprehensive Chord Database (Tombatossals Format)
// ===================================================================
import {
  ALL_NOTE_INFO,
  BLACK_KEY_WIDTH,
  CHORD_STRUCTURES,
  DURATION_THRESHOLDS,
  MAJOR_DIATONIC_LABELS,
  MINOR_DIATONIC_LABELS,
  NOTES_BY_MIDI,
  NOTES_BY_NAME,
  notesByMidiKeyAware,
  WHITE_KEY_WIDTH,
  getChordByDegree
} from "../core/note-data.js";
const CHORDS_DATABASE = {
  // === MAJOR CHORDS ===
  'C': {
    key: 'C',
    suffix: '',
    positions: [
      {
        frets: 'x32010',
        fingers: '032010',
        difficulty: 2
      },
      {
        frets: '332010',
        fingers: '332010',
        barres: [3],
        difficulty: 4
      },
      {
        frets: 'x35553',
        fingers: '013331',
        barres: [5],
        difficulty: 4
      }
    ]
  },
  'C#': {
    key: 'C#',
    suffix: '',
    positions: [
      {
        frets: 'x43121',
        fingers: '043121',
        barres: [1],
        difficulty: 4
      },
      {
        frets: '443121',
        fingers: '443121',
        barres: [1, 4],
        difficulty: 5
      }
    ]
  },
  'D': {
    key: 'D',
    suffix: '',
    positions: [
      {
        frets: 'xx0232',
        fingers: '000132',
        difficulty: 2
      },
      {
        frets: 'x54232',
        fingers: '043121',
        difficulty: 3
      },
      {
        frets: '554232',
        fingers: '554321',
        barres: [5],
        difficulty: 4
      }
    ]
  },
  'D#': {
    key: 'D#',
    suffix: '',
    positions: [
      {
        frets: 'xx1343',
        fingers: '001243',
        difficulty: 3
      },
      {
        frets: '665343',
        fingers: '554321',
        barres: [6],
        difficulty: 4
      }
    ]
  },
  'E': {
    key: 'E',
    suffix: '',
    positions: [
      {
        frets: '022100',
        fingers: '023100',
        difficulty: 1
      },
      {
        frets: 'x79997',
        fingers: '013331',
        barres: [9],
        difficulty: 4
      }
    ]
  },
  'F': {
    key: 'F',
    suffix: '',
    positions: [
      {
        frets: '133211',
        fingers: '134211',
        barres: [1],
        capo: true,
        difficulty: 4
      },
      {
        frets: 'xx3211',
        fingers: '003211',
        barres: [1],
        difficulty: 3
      }
    ]
  },
  'F#': {
    key: 'F#',
    suffix: '',
    positions: [
      {
        frets: '244322',
        fingers: '134211',
        barres: [2],
        capo: true,
        difficulty: 4
      },
      {
        frets: 'xx4322',
        fingers: '004311',
        barres: [2],
        difficulty: 3
      }
    ]
  },
  'G': {
    key: 'G',
    suffix: '',
    positions: [
      {
        frets: '320003',
        fingers: '210003',
        difficulty: 2
      },
      {
        frets: '320033',
        fingers: '210034',
        difficulty: 2
      },
      {
        frets: '355433',
        fingers: '134211',
        barres: [3],
        difficulty: 4
      }
    ]
  },
  'G#': {
    key: 'G#',
    suffix: '',
    positions: [
      {
        frets: '466544',
        fingers: '134211',
        barres: [4],
        capo: true,
        difficulty: 4
      }
    ]
  },
  'A': {
    key: 'A',
    suffix: '',
    positions: [
      {
        frets: 'x02220',
        fingers: '001230',
        difficulty: 2
      },
      {
        frets: '577655',
        fingers: '134211',
        barres: [5],
        capo: true,
        difficulty: 4
      }
    ]
  },
  'A#': {
    key: 'A#',
    suffix: '',
    positions: [
      {
        frets: 'x13331',
        fingers: '013331',
        barres: [3],
        difficulty: 4
      },
      {
        frets: '688766',
        fingers: '134211',
        barres: [6],
        capo: true,
        difficulty: 4
      }
    ]
  },
  'B': {
    key: 'B',
    suffix: '',
    positions: [
      {
        frets: 'x24442',
        fingers: '013331',
        barres: [4],
        difficulty: 4
      },
      {
        frets: '799877',
        fingers: '134211',
        barres: [7],
        capo: true,
        difficulty: 5
      }
    ]
  },

  // === MINOR CHORDS ===
  'Cm': {
    key: 'C',
    suffix: 'm',
    positions: [
      {
        frets: 'x35543',
        fingers: '013421',
        barres: [3],
        difficulty: 4
      },
      {
        frets: '335543',
        fingers: '113421',
        barres: [3],
        difficulty: 4
      }
    ]
  },
  'C#m': {
    key: 'C#',
    suffix: 'm',
    positions: [
      {
        frets: 'x46654',
        fingers: '013421',
        barres: [4],
        difficulty: 4
      }
    ]
  },
  'Dm': {
    key: 'D',
    suffix: 'm',
    positions: [
      {
        frets: 'xx0231',
        fingers: '000231',
        difficulty: 2
      },
      {
        frets: 'x57765',
        fingers: '013421',
        barres: [5],
        difficulty: 4
      }
    ]
  },
  'D#m': {
    key: 'D#',
    suffix: 'm',
    positions: [
      {
        frets: 'xx1342',
        fingers: '001342',
        difficulty: 3
      },
      {
        frets: '668876',
        fingers: '113421',
        barres: [6],
        difficulty: 4
      }
    ]
  },
  'Em': {
    key: 'E',
    suffix: 'm',
    positions: [
      {
        frets: '022000',
        fingers: '023000',
        difficulty: 1
      },
      {
        frets: 'x79987',
        fingers: '013421',
        barres: [7],
        difficulty: 4
      }
    ]
  },
  'Fm': {
    key: 'F',
    suffix: 'm',
    positions: [
      {
        frets: '133111',
        fingers: '134111',
        barres: [1],
        capo: true,
        difficulty: 4
      },
      {
        frets: 'xx3111',
        fingers: '003111',
        barres: [1],
        difficulty: 3
      }
    ]
  },
  'F#m': {
    key: 'F#',
    suffix: 'm',
    positions: [
      {
        frets: '244222',
        fingers: '134111',
        barres: [2],
        capo: true,
        difficulty: 4
      }
    ]
  },
  'Gm': {
    key: 'G',
    suffix: 'm',
    positions: [
      {
        frets: '355333',
        fingers: '134111',
        barres: [3],
        capo: true,
        difficulty: 4
      },
      {
        frets: 'xx5333',
        fingers: '003111',
        barres: [3],
        difficulty: 3
      }
    ]
  },
  'G#m': {
    key: 'G#',
    suffix: 'm',
    positions: [
      {
        frets: '466444',
        fingers: '134111',
        barres: [4],
        capo: true,
        difficulty: 4
      }
    ]
  },
  'Am': {
    key: 'A',
    suffix: 'm',
    positions: [
      {
        frets: 'x02210',
        fingers: '002310',
        difficulty: 2
      },
      {
        frets: '577555',
        fingers: '134111',
        barres: [5],
        capo: true,
        difficulty: 4
      }
    ]
  },
  'A#m': {
    key: 'A#',
    suffix: 'm',
    positions: [
      {
        frets: 'x13321',
        fingers: '013421',
        difficulty: 4
      },
      {
        frets: '688666',
        fingers: '134111',
        barres: [6],
        capo: true,
        difficulty: 4
      }
    ]
  },
  'Bm': {
    key: 'B',
    suffix: 'm',
    positions: [
      {
        frets: 'x24432',
        fingers: '013421',
        difficulty: 4
      },
      {
        frets: '799777',
        fingers: '134111',
        barres: [7],
        capo: true,
        difficulty: 5
      }
    ]
  },

  // === SEVENTH CHORDS ===
  'C7': {
    key: 'C',
    suffix: '7',
    positions: [
      {
        frets: 'x32310',
        fingers: '032410',
        difficulty: 3
      },
      {
        frets: '335353',
        fingers: '113141',
        barres: [3],
        difficulty: 4
      }
    ]
  },
  'D7': {
    key: 'D',
    suffix: '7',
    positions: [
      {
        frets: 'xx0212',
        fingers: '000213',
        difficulty: 2
      },
      {
        frets: '557575',
        fingers: '113141',
        barres: [5],
        difficulty: 4
      }
    ]
  },
  'E7': {
    key: 'E',
    suffix: '7',
    positions: [
      {
        frets: '020100',
        fingers: '020100',
        difficulty: 1
      },
      {
        frets: 'x79797',
        fingers: '013141',
        barres: [7, 9],
        difficulty: 4
      }
    ]
  },
  'F7': {
    key: 'F',
    suffix: '7',
    positions: [
      {
        frets: '131211',
        fingers: '131211',
        barres: [1],
        capo: true,
        difficulty: 4
      }
    ]
  },
  'G7': {
    key: 'G',
    suffix: '7',
    positions: [
      {
        frets: '320001',
        fingers: '320001',
        difficulty: 2
      },
      {
        frets: '353433',
        fingers: '131211',
        barres: [3],
        difficulty: 4
      }
    ]
  },
  'A7': {
    key: 'A',
    suffix: '7',
    positions: [
      {
        frets: 'x02020',
        fingers: '001020',
        difficulty: 2
      },
      {
        frets: '575655',
        fingers: '131211',
        barres: [5],
        difficulty: 4
      }
    ]
  },
  'B7': {
    key: 'B',
    suffix: '7',
    positions: [
      {
        frets: 'x21202',
        fingers: '021304',
        difficulty: 3
      },
      {
        frets: '797877',
        fingers: '131211',
        barres: [7],
        difficulty: 4
      }
    ]
  },

  // === SUSPENDED CHORDS ===
  'Csus2': {
    key: 'C',
    suffix: 'sus2',
    positions: [
      {
        frets: 'x30010',
        fingers: '030010',
        difficulty: 2
      }
    ]
  },
  'Csus4': {
    key: 'C',
    suffix: 'sus4',
    positions: [
      {
        frets: 'x33010',
        fingers: '033010',
        difficulty: 2
      }
    ]
  },
  'Dsus2': {
    key: 'D',
    suffix: 'sus2',
    positions: [
      {
        frets: 'xx0230',
        fingers: '000230',
        difficulty: 2
      }
    ]
  },
  'Dsus4': {
    key: 'D',
    suffix: 'sus4',
    positions: [
      {
        frets: 'xx0233',
        fingers: '000134',
        difficulty: 2
      }
    ]
  },
  'Esus2': {
    key: 'E',
    suffix: 'sus2',
    positions: [
      {
        frets: '024400',
        fingers: '012300',
        difficulty: 2
      }
    ]
  },
  'Esus4': {
    key: 'E',
    suffix: 'sus4',
    positions: [
      {
        frets: '022200',
        fingers: '012200',
        difficulty: 2
      }
    ]
  },
  'Gsus2': {
    key: 'G',
    suffix: 'sus2',
    positions: [
      {
        frets: '300033',
        fingers: '100034',
        difficulty: 2
      }
    ]
  },
  'Gsus4': {
    key: 'G',
    suffix: 'sus4',
    positions: [
      {
        frets: '330033',
        fingers: '110034',
        difficulty: 2
      }
    ]
  },
  'Asus2': {
    key: 'A',
    suffix: 'sus2',
    positions: [
      {
        frets: 'x02200',
        fingers: '001200',
        difficulty: 2
      }
    ]
  },
  'Asus4': {
    key: 'A',
    suffix: 'sus4',
    positions: [
      {
        frets: 'x02230',
        fingers: '001230',
        difficulty: 2
      }
    ]
  }
};

// ===================================================================
// Data Conversion Functions
// ===================================================================

/**
 * Convert tombatossals fret string to array format
 * @param {string} fretsString - String like '320003' or 'x02220'
 * @returns {Array} Array like [3, 2, 0, 0, 0, 3] or [null, 0, 2, 2, 2, 0]
 */
export function convertChordsDbToArray(fretsString) {
  return fretsString.split('').map(char => {
    if (char === 'x') return null;
    const num = parseInt(char, 10);
    return isNaN(num) ? null : num;
  });
}

/**
 * Convert array format to tombatossals fret string
 * @param {Array} fretsArray - Array like [null, 0, 2, 2, 2, 0]
 * @returns {string} String like 'x02220'
 */
export function convertArrayToChordsDb(fretsArray) {
  return fretsArray.map(fret => 
    fret === null || fret === undefined ? 'x' : fret.toString()
  ).join('');
}

/**
 * Calculate chord difficulty based on various factors
 * @param {Object} position - Chord position object
 * @returns {number} Difficulty rating from 1-5
 */
function calculateDifficulty(position) {
  if (position.difficulty) return position.difficulty;
  
  let difficulty = 1;
  const frets = convertChordsDbToArray(position.frets);
  const activeFrets = frets.filter(f => f !== null && f > 0);
  
  // Base difficulty on number of fingers
  difficulty += Math.floor(activeFrets.length / 2);
  
  // Add difficulty for barres
  if (position.barres && position.barres.length > 0) {
    difficulty += 2;
  }
  
  // Add difficulty for capo
  if (position.capo) {
    difficulty += 1;
  }
  
  // Add difficulty for fret span
  if (activeFrets.length > 1) {
    const span = Math.max(...activeFrets) - Math.min(...activeFrets);
    difficulty += Math.floor(span / 3);
  }
  
  return Math.min(Math.max(difficulty, 1), 5);
}

// ===================================================================
// SVG Chord Diagram Renderer
// ===================================================================

export class ChordDiagramRenderer {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      width: options.width || 180,
      height: options.height || 180,
      stringSpacing: options.stringSpacing || 20,
      fretSpacing: options.fretSpacing || 30,
      nutHeight: options.nutHeight || 8,
      dotRadius: options.dotRadius || 8,
      fingerFontSize: options.fingerFontSize || 10,
      labelFontSize: options.labelFontSize || 12,
      showFingers: options.showFingers !== false,
      showTuning: options.showTuning !== false,
      lite: options.lite || true,
      ...options
    };
    
    this.tuning = ['E', 'A', 'D', 'G', 'B', 'E']; // Standard guitar tuning
    this.strings = 6;
    this.fretsOnChord = 4;
  }

  /**
   * Render a chord diagram
   * @param {Object} chordData - Chord data object
   * @param {number} positionIndex - Which position to render (default 0)
   */
  renderChord(chordData, positionIndex = 0) {
    if (!chordData || !chordData.positions || !chordData.positions[positionIndex]) {
      this.container.innerHTML = '<div>No chord data</div>';
      return;
    }

    const position = chordData.positions[positionIndex];
    const frets = convertChordsDbToArray(position.frets);
    const fingers = position.fingers ? convertChordsDbToArray(position.fingers) : null;
    
    const svg = this.createSVG(frets, fingers, position);
    this.container.innerHTML = svg;
  }

  /**
   * Create SVG string for chord diagram
   * @param {Array} frets - Fret positions
   * @param {Array} fingers - Finger positions (optional)
   * @param {Object} position - Position object with additional data
   * @returns {string} SVG string
   */
  createSVG(frets, fingers, position) {
    const { width, height } = this.options;
    const baseFret = position.baseFret || 1;
    const barres = position.barres || [];
    const capo = position.capo || false;
    
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`;
    
    // Background
    svg += `<rect width="${width}" height="${height}" fill="white" stroke="none"/>`;
    
    // Translate to create margins
    svg += '<g transform="translate(40, 30)">';
    
    // Draw neck
    svg += this.drawNeck(baseFret);
    
    // Draw barres first (behind dots)
    if (barres.length > 0) {
      svg += this.drawBarres(frets, barres, capo, baseFret);
    }
    
    // Draw dots
    svg += this.drawDots(frets, fingers, baseFret);
    
    // Draw tuning labels
    if (this.options.showTuning && !this.options.lite) {
      svg += this.drawTuningLabels();
    }
    
    // Draw base fret indicator
    if (baseFret > 1) {
      svg += this.drawBaseFretIndicator(baseFret);
    }
    
    svg += '</g></svg>';
    
    return svg;
  }

  /**
   * Draw the guitar neck (strings and frets)
   */
  drawNeck(baseFret) {
    const { stringSpacing, fretSpacing, nutHeight } = this.options;
    const neckWidth = (this.strings - 1) * stringSpacing;
    const neckHeight = this.fretsOnChord * fretSpacing;
    
    let neck = '';
    
    // Draw frets (horizontal lines)
    for (let i = 0; i <= this.fretsOnChord; i++) {
      const y = i * fretSpacing;
      const strokeWidth = (i === 0 && baseFret === 1) ? nutHeight : 2;
      neck += `<line x1="0" y1="${y}" x2="${neckWidth}" y2="${y}" stroke="#444" stroke-width="${strokeWidth}" stroke-linecap="square"/>`;
    }
    
    // Draw strings (vertical lines)
    for (let i = 0; i < this.strings; i++) {
      const x = i * stringSpacing;
      neck += `<line x1="${x}" y1="0" x2="${x}" y2="${neckHeight}" stroke="#444" stroke-width="2" stroke-linecap="square"/>`;
    }
    
    return neck;
  }

  /**
   * Draw chord dots
   */
  drawDots(frets, fingers, baseFret) {
    const { stringSpacing, fretSpacing, dotRadius, fingerFontSize, showFingers } = this.options;
    let dots = '';
    
    frets.forEach((fret, stringIndex) => {
      if (fret === null || fret === undefined) {
        // Draw X for muted strings
        const x = stringIndex * stringSpacing;
        const y = -15;
        dots += this.drawX(x, y);
      } else if (fret === 0) {
        // Draw O for open strings
        const x = stringIndex * stringSpacing;
        const y = -15;
        dots += this.drawO(x, y);
      } else {
        // Draw dot for fretted notes
        const x = stringIndex * stringSpacing;
        const fretPosition = fret - baseFret + 1;
        const y = (fretPosition - 0.5) * fretSpacing;
        
        dots += `<circle cx="${x}" cy="${y}" r="${dotRadius}" fill="#333" stroke="white" stroke-width="2"/>`;
        
        // Add finger number
        if (showFingers && fingers && fingers[stringIndex] && fingers[stringIndex] > 0) {
          dots += `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="${fingerFontSize}" font-weight="bold" fill="white">${fingers[stringIndex]}</text>`;
        }
      }
    });
    
    return dots;
  }

  /**
   * Draw barre indicators
   */
  drawBarres(frets, barres, capo, baseFret) {
    const { stringSpacing, fretSpacing, dotRadius } = this.options;
    let barreElements = '';
    
    barres.forEach(barreFret => {
      const fretPosition = barreFret - baseFret + 1;
      const y = (fretPosition - 0.5) * fretSpacing;
      
      // Find strings that are part of this barre
      const barreStrings = [];
      frets.forEach((fret, stringIndex) => {
        if (fret === barreFret) {
          barreStrings.push(stringIndex);
        }
      });
      
      if (barreStrings.length > 1) {
        const startX = Math.min(...barreStrings) * stringSpacing;
        const endX = Math.max(...barreStrings) * stringSpacing;
        const width = endX - startX;
        
        // Draw barre background
        barreElements += `<rect x="${startX - dotRadius}" y="${y - dotRadius}" width="${width + 2 * dotRadius}" height="${2 * dotRadius}" rx="${dotRadius}" fill="#333" stroke="white" stroke-width="2"/>`;
        
        // Add capo indicator if needed
        if (capo) {
          barreElements += `<rect x="${startX - dotRadius - 5}" y="${y - dotRadius}" width="${width + 2 * dotRadius + 10}" height="${2 * dotRadius}" rx="4" fill="none" stroke="#666" stroke-width="1" stroke-dasharray="2,2"/>`;
        }
      }
    });
    
    return barreElements;
  }

  /**
   * Draw X symbol for muted strings
   */
  drawX(x, y) {
    const size = 6;
    return `<g stroke="#666" stroke-width="2" stroke-linecap="round">
      <line x1="${x - size}" y1="${y - size}" x2="${x + size}" y2="${y + size}"/>
      <line x1="${x - size}" y1="${y + size}" x2="${x + size}" y2="${y - size}"/>
    </g>`;
  }

  /**
   * Draw O symbol for open strings
   */
  drawO(x, y) {
    return `<circle cx="${x}" cy="${y}" r="6" fill="none" stroke="#666" stroke-width="2"/>`;
  }

  /**
   * Draw tuning labels
   */
  drawTuningLabels() {
    const { stringSpacing, labelFontSize } = this.options;
    const y = -35;
    let labels = '';
    
    this.tuning.forEach((note, index) => {
      const x = index * stringSpacing;
      labels += `<text x="${x}" y="${y}" text-anchor="middle" font-size="${labelFontSize}" fill="#666">${note}</text>`;
    });
    
    return labels;
  }

  /**
   * Draw base fret indicator
   */
  drawBaseFretIndicator(baseFret) {
    const { fretSpacing, labelFontSize } = this.options;
    const x = -25;
    const y = fretSpacing * 0.5;
    
    return `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="${labelFontSize}" font-weight="bold" fill="#333">${baseFret}fr</text>`;
  }
}

// ===================================================================
// Enhanced Chord Management
// ===================================================================

export class EnhancedChordDatabase {
  constructor() {
    this.chordsDb = CHORDS_DATABASE;
    this.convertedChords = this.convertDatabase();
  }

  convertDatabase() {
    const converted = {};
    
    Object.entries(this.chordsDb).forEach(([chordName, chordData]) => {
      converted[chordName] = {
        ...chordData,
        displayName: chordName,
        positions: chordData.positions.map(pos => ({
          ...pos,
          fretsArray: convertChordsDbToArray(pos.frets),
          fingersArray: pos.fingers ? convertChordsDbToArray(pos.fingers) : null,
          difficulty: calculateDifficulty(pos)
        }))
      };
    });
    
    return converted;
  }

  getChord(chordName) {
    return this.convertedChords[chordName];
  }

  getChordPositions(chordName) {
    const chord = this.getChord(chordName);
    return chord ? chord.positions : [];
  }

  getAllChords() {
    return Object.keys(this.convertedChords);
  }

  getChordsByType(suffix = '') {
    return Object.keys(this.convertedChords).filter(name => 
      this.convertedChords[name].suffix === suffix
    );
  }

  searchChords(query) {
    const lowerQuery = query.toLowerCase();
    return Object.keys(this.convertedChords).filter(name =>
      name.toLowerCase().includes(lowerQuery)
    );
  }
}

// ===================================================================
// Enhanced Chord Groups
// ===================================================================

export const ENHANCED_CHORD_GROUPS = {
  'Basic Major': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  'Basic Minor': ['Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm'],
  'Sharp Major': ['C#', 'D#', 'F#', 'G#', 'A#'],
  'Sharp Minor': ['C#m', 'D#m', 'F#m', 'G#m', 'A#m'],
  'Seventh': ['C7', 'D7', 'E7', 'F7', 'G7', 'A7', 'B7'],
  'Suspended 2nd': ['Csus2', 'Dsus2', 'Esus2', 'Gsus2', 'Asus2'],
  'Suspended 4th': ['Csus4', 'Dsus4', 'Esus4', 'Gsus4', 'Asus4'],
  'Beginner Friendly': ['C', 'D', 'E', 'G', 'A', 'Am', 'Em', 'Dm'],
  'Intermediate': ['F', 'Bm', 'C7', 'G7', 'A7'],
  'Advanced': ['F#', 'G#', 'A#', 'C#', 'D#']
};

// ===================================================================
// Backward Compatibility Functions
// ===================================================================

// Create instance of enhanced database
const enhancedDb = new EnhancedChordDatabase();

/**
 * Get chord frets in array format (backward compatibility)
 * @param {string} chordName - Name of the chord
 * @param {number} positionIndex - Which position to get (default 0)
 * @returns {Array|null} Fret array or null
 */
export function getChordFrets(chordName, positionIndex = 0) {
  const chord = enhancedDb.getChord(chordName);
  if (!chord || !chord.positions[positionIndex]) return null;
  return chord.positions[positionIndex].fretsArray;
}

/**
 * Get chords by group name (backward compatibility)
 * @param {string} groupName - Name of the group
 * @returns {Array} Array of chord names
 */
export function getChordsByGroup(groupName) {
  return ENHANCED_CHORD_GROUPS[groupName] || [];
}

/**
 * Get chord object with all positions
 * @param {string} chordName - Name of the chord
 * @returns {Object|null} Chord object or null
 */
export function getChordObject(chordName) {
  return enhancedDb.getChord(chordName);
}

/**
 * Get all available chord names
 * @returns {Array} Array of all chord names
 */
export function getAllChordNames() {
  return enhancedDb.getAllChords();
}

/**
 * Search for chords by name
 * @param {string} query - Search query
 * @returns {Array} Array of matching chord names
 */
export function searchChords(query) {
  return enhancedDb.searchChords(query);
}

/**
 * Get difficulty rating for a chord position
 * @param {string} chordName - Name of the chord
 * @param {number} positionIndex - Which position to check
 * @returns {number} Difficulty rating 1-5
 */
export function getChordDifficulty(chordName, positionIndex = 0) {
  const chord = enhancedDb.getChord(chordName);
  if (!chord || !chord.positions[positionIndex]) return 0;
  return chord.positions[positionIndex].difficulty;
}

// ===================================================================
// Exports (maintain backward compatibility)
// ===================================================================

// Legacy exports for backward compatibility
export const GUITAR_CHORDS = Object.fromEntries(
  Object.entries(CHORDS_DATABASE).map(([name, data]) => [
    name, 
    convertChordsDbToArray(data.positions[0].frets)
  ])
);

export const CHORD_GROUPS = ENHANCED_CHORD_GROUPS;

// Default export
export default enhancedDb;