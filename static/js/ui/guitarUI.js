// guitarUI.js - Guitar-specific UI components
import { handleInitialGuitar } from '../instrument/guitarInstrument.js';
import {
  getChordByDegree
} from "../core/note-data.js";
import audioManager from "../core/audioManager.js";

// ===================================================================
// Helper Functions
// ===================================================================

function convertChordsDbToArray(fretsString) {
  return fretsString.split('').map(fret => {
    if (fret === 'x') return null;
    return parseInt(fret, 10);
  });
}

// ===================================================================
// Chord Palette Functions
// ===================================================================

export function createChordPalette(guitarInstance = window.guitarInstance) {
  const container = document.querySelector('#chord-palette');
  if (!container) {
    console.error('Chord palette container not found: #chord-palette');
    return null;
  }

  if (!guitarInstance) {
    console.error('Guitar instance not found');
    return null;
  }

  // Clear existing content
  container.innerHTML = '';

  // Create buttons for degrees 1-7
  for (let degree = 1; degree <= 7; degree++) {
    const chord = getChordByDegree(degree);
    if (chord) {
      const button = createChordButton(chord, guitarInstance);
      container.appendChild(button);
    }
  }
  
  console.log('✅ Chord palette created');
  return container;
}

function createChordButton(chord, guitarInstance) {
  const button = document.createElement('button');
  button.textContent = chord.displayName;
  button.className = 'btn btn--compact palette-button';

  // Check audio state and add appropriate listener
  if (!audioManager.isAudioReady()) {
    // Audio not ready - use handleInitialGuitar
    button.addEventListener('click', (e) => {
      if (chord.frets && guitarInstance) {
        guitarInstance.setChord(chord.frets);
        const notes = guitarInstance.getCurrentNotes();
        
        handleInitialGuitar(e, {
          type: 'palette',
          chord: chord,
          notes: notes
        });
      }
    });
  } else {
    // Audio ready - use direct functionality
    button.addEventListener('click', () => {
      if (chord.frets) {
        guitarInstance.setChord(chord.frets);
        setTimeout(() => guitarInstance.strum(), 100);
      }
    });
  }

  return button;
}

// ===================================================================
// Guitar Controls
// ===================================================================
export function createGuitarControls(guitarInstance) {
  const container = document.querySelector('#guitar-controls');

    if (!container) {
    console.error('Chord palette container not found: #chord-palette');
    return null;
  }

  if (!guitarInstance) {
    console.error('Guitar instance not found');
    return null;
  }

  // Clear existing content
  container.innerHTML = '';

  // Strum Down button
  const strumDown = document.createElement('button');
  strumDown.innerHTML = '↓ Strum Down';
  strumDown.className = 'btn btn--secondary strum-control-button';
  
  // Strum Up button
  const strumUp = document.createElement('button');
  strumUp.innerHTML = '↑ Strum Up';
  strumUp.className = 'btn btn--secondary strum-control-button';

  // Check audio state and add appropriate listeners
  if (!audioManager.isAudioReady()) {
    // Audio not ready - use handleInitialGuitar
    strumDown.addEventListener('click', (e) => {
      const notes = guitarInstance ? guitarInstance.getCurrentNotes() : ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
      handleInitialGuitar(e, {
        type: 'strum',
        direction: 'down',
        notes: notes
      });
    });
    
    strumUp.addEventListener('click', (e) => {
      const notes = guitarInstance ? guitarInstance.getCurrentNotes() : ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
      handleInitialGuitar(e, {
        type: 'strum',
        direction: 'up',
        notes: notes
      });
    });
  } else {
    // Audio ready - use direct functionality
    strumDown.addEventListener('mousedown', (e) => {
      e.preventDefault();
      guitarInstance.strum('down');
    });
    
    strumUp.addEventListener('mousedown', (e) => {
      e.preventDefault();
      guitarInstance.strum('up');
    });
  }

  // Clear chord button (doesn't need audio)
  const clearChord = document.createElement('button');
  clearChord.innerHTML = 'Clear Chord';
  clearChord.className = 'btn btn--danger';
  clearChord.addEventListener('click', () => {
    guitarInstance.setChord([0, 0, 0, 0, 0, 0]);
  });

  container.appendChild(strumDown);
  container.appendChild(strumUp);
  container.appendChild(clearChord);

  return container;
}

// ===================================================================
// Chord Diagrams
// ===================================================================

export function createChordDiagrams(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) {
    console.log(`Skipping guitar chord diagrams. Container not found: ${containerSelector}`);
    return null;
  }

  // Clear existing content
  container.innerHTML = '';
  
  // Create wrapper for all diagrams
  const diagramsWrapper = document.createElement('div');
  diagramsWrapper.className = 'chord-diagrams-wrapper';

  // Create diagrams for degrees 1-7
  for (let degree = 1; degree <= 7; degree++) {
    const chord = getChordByDegree(degree);
    if (chord) {
      // Create container for this diagram
      const diagramContainer = document.createElement('div');
      diagramContainer.className = 'chord-diagram-container';
      
      // Create the chord diagram renderer
      const renderer = new ChordDiagramRenderer(diagramContainer, {
        width: 140,
        height: 140,
        lite: true,
        showTuning: false
      });
      
      // Convert our chord format to the expected format
      const chordData = {
        key: chord.displayName,
        positions: [{
          frets: chord.frets,
          fingers: chord.fingers,
          baseFret: 1,
          barres: [],
          capo: false
        }]
      };
      
      // Render the chord
      renderer.renderChord(chordData, 0);
      
      // Add to wrapper
      diagramsWrapper.appendChild(diagramContainer);

      diagramContainer.addEventListener('click', () => {
    if (chord.frets) {
      guitarInstance.setChord(chord.frets);
    }
  });
    }
  }

  container.appendChild(diagramsWrapper);
  return diagramsWrapper;
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
    
    const svg = this.createSVG(frets, fingers, position, chordData.key); // Pass chord name
    this.container.innerHTML = svg;
  }

  /**
   * Create SVG string for chord diagram
   * @param {Array} frets - Fret positions
   * @param {Array} fingers - Finger positions (optional)
   * @param {Object} position - Position object with additional data
   * @param {string} chordName - Name of the chord
   * @returns {string} SVG string
   */
  createSVG(frets, fingers, position, chordName) {
  const { width, height, stringSpacing } = this.options;
  const baseFret = position.baseFret || 1;
  const barres = position.barres || [];
  const capo = position.capo || false;
  
  // Calculate actual content dimensions
  const neckWidth = (this.strings - 1) * stringSpacing;
  const contentWidth = neckWidth + 80; // 40px margin on each side
  const contentHeight = height;
  
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${contentWidth} ${contentHeight}">`;
  
  // Background
  svg += `<rect width="${contentWidth}" height="${contentHeight}" fill="white" stroke="none"/>`;
  
  // Center the content horizontally
  const translateX = (contentWidth - neckWidth) / 2;
  svg += `<g transform="translate(${translateX}, 25)">`;
  
  // Draw chord name at the top
  if (chordName) {
    svg += this.drawChordName(chordName);
  } 
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
   * Draw chord name at the top
   */
drawChordName(chordName) {
  const { stringSpacing, labelFontSize } = this.options;
  const centerX = ((this.strings - 1) * stringSpacing) / 2;
  const y = -30; // Changed from -50 to -30
  
  return `<text x="${centerX}" y="${y}" text-anchor="middle" font-size="${labelFontSize + 2}" font-weight="bold" fill="#333">${chordName}</text>`;
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