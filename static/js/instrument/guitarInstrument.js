// guitarInstrument.js - Virtual Guitar Integration for Piano Tour
import { pianoState } from "../core/appState.js";
import { createChordPalette, createGuitarControls } from "../ui/guitarUI.js";
import audioManager from "../core/audioManager.js";
import { NOTES_BY_NAME } from "../core/note-data.js";
import { trigger } from "./playbackHelpers.js";

console.log('🎸 Loading guitarInstrument.js module...');

// Guitar-specific constants
const FRET_COUNT = 20;
const STRING_COUNT = 6;

// Functions

// guitarInstrument.js

/**
 * Initialize just the guitar instrument
 * @param {string} containerSelector - CSS selector for guitar container
 * @returns {GuitarInstrument|null} Guitar instance or null if container not found
 */
export function initializeGuitar(containerSelector = '#instrument') {
    console.log('🎸 Initializing Guitar Instrument...');
    
    const container = document.querySelector(containerSelector);
    if (!container) {
        console.error(`Guitar container not found: ${containerSelector}`);
        return null;
    }

    // Create guitar instance
    const guitar = new GuitarInstrument(container.id || containerSelector.replace('#', ''));
    
    // Store globally for other modules to access
    window.guitarInstance = guitar;
    
    console.log('✅ Guitar instrument initialized');
    return guitar;
}

/**
 * Initialize chord palette
 * @param {string} containerSelector - Where to render the palette
 * @param {GuitarInstrument} guitarInstance - Guitar to connect to (optional)
 * @returns {HTMLElement|null} Chord palette element
 */
export function initializeChordPalette(containerSelector, guitarInstance = window.guitarInstance) {
    console.log('🎵 Initializing Chord Palette...');
    
    const container = document.querySelector(containerSelector);
    if (!container) {
        console.error(`Chord palette container not found: ${containerSelector}`);
        return null;
    }

    // Create and append chord palette
    const chordPalette = createChordPalette(guitarInstance);
    container.appendChild(chordPalette);
    
    console.log('✅ Chord palette initialized');
    return chordPalette;
}

/**
 * Initialize guitar controls
 * @param {string} containerSelector - Where to render the controls
 * @param {GuitarInstrument} guitarInstance - Guitar to control (optional)
 * @returns {HTMLElement|null} Controls element
 */
export function initializeGuitarControls(containerSelector, guitarInstance = window.guitarInstance) {
    console.log('🎛️ Initializing Guitar Controls...');
    
    const container = document.querySelector(containerSelector);
    if (!container) {
        console.error(`Guitar controls container not found: ${containerSelector}`);
        return null;
    }

    // Create and append guitar controls
    const guitarControls = createGuitarControls(guitarInstance);
    container.appendChild(guitarControls);
    
    console.log('✅ Guitar controls initialized');
    return guitarControls;
}

// Standard guitar tuning (MIDI numbers) - Indexed 0-5 for strings 1-6 (thinnest to thickest)
const GUITAR_TUNING = [
  64, // E4 (high E) - STRING 1, thinnest
  59, // B3           - STRING 2
  55, // G3           - STRING 3
  50, // D3           - STRING 4
  45, // A2           - STRING 5
  40  // E2 (low E)  - STRING 6, thickest
];

console.log('🎸 Guitar tuning loaded:', GUITAR_TUNING);

// Convert MIDI to note name
function midiToNoteName(midiNumber) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNumber / 12) - 1;
  const noteIndex = midiNumber % 12;
  const result = noteNames[noteIndex] + octave;
  return result;
}

// Guitar fretboard state - Indexed 0-5 for strings 1-6 (thinnest to thickest)
const guitarState = {
  currentFrets: [0, 0, 0, 0, 0, 0], // Current fret for each string (0 = open)
  mutedStrings: [false, false, false, false, false, false],
  sustainMode: false
};

console.log('🎸 Initial guitar state:', guitarState);

class GuitarInstrument {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.fretboardElement = null;
    this.stringElements = [];
    this.fingerElements = [];
    this.stringLabelsContainer = null;
    this.strumArea = null;
    this.isPlayingChord = false;

    this.init();
  }

  init() {
    if (!this.container) {
      console.error('❌ Guitar container not found');
      return;
    }
    this.createFretboard();
    this.setupEventListeners();
    this.updateStringLabels();
  }

  createFretboard() {
    const guitarWrapper = document.createElement('div');
    guitarWrapper.className = 'guitar-wrapper';

    this.fretboardElement = document.createElement('div');
    this.fretboardElement.className = 'guitar-fretboard';

    // Strings 6 to 1 (top to bottom)
    for (let stringIndex = 5; stringIndex >= 0; stringIndex--) {
      this.createString(this.fretboardElement, stringIndex);
    }

    this.createStrumArea(this.fretboardElement);
    this.stringLabelsContainer = this.createStringLabelsContainer();

    guitarWrapper.appendChild(this.fretboardElement);
    guitarWrapper.appendChild(this.stringLabelsContainer);
    this.container.appendChild(guitarWrapper);
  }

  createString(container, stringIndex) {
    const stringNum = stringIndex + 1;
    const stringContainer = document.createElement('div');
    stringContainer.className = `guitar-string-container string-${stringNum}`;
    
    const stringLine = this.createStringLine(stringNum);
    stringContainer.appendChild(stringLine);

    for (let fret = 0; fret <= FRET_COUNT; fret++) {
      const fretPosition = this.createFretPosition(stringNum, fret);
      stringContainer.appendChild(fretPosition);
    }

    container.appendChild(stringContainer);
    this.stringElements[stringNum] = stringContainer;
  }

  createStringLine(stringNum) {
    const line = document.createElement('div');
    line.className = `guitar-string-line string-line-${stringNum}`;
    return line;
  }

  getStringThickness(stringNum) {
    const thicknesses = { 6: 4, 5: 3.5, 4: 3, 3: 2.5, 2: 2, 1: 1.5 };
    return thicknesses[stringNum];
  }

  createFretPosition(stringNum, fret) {
    const position = document.createElement('div');
    position.className = `fret-position string-${stringNum} fret-${fret}`;
    position.dataset.string = stringNum;
    position.dataset.fret = fret;
    
    // Calculate widths and positions for CSS variables
    const fretWidth = this.calculateFretWidth(fret);
    const leftPosition = this.calculateFretPosition(fret);

    // Set CSS custom properties (variables)
    position.style.setProperty('--fret-width', `${fretWidth}%`);
    position.style.setProperty('--fret-left-position', `${leftPosition}%`);

    if (fret === 0) {
      position.classList.add('fret-nut');
    } else {
      position.classList.add('fret');
      // Add hover event for standard frets
      position.addEventListener('mouseenter', () => position.classList.add('hover'));
      position.addEventListener('mouseleave', () => position.classList.remove('hover'));
    }

    return position;
  }

  calculateFretWidth(fret) {
    const ratio = Math.pow(2, 1 / 12);
    const baseWidth = 90;
    if (fret === 0) return 5;
    const fretPosition = (ratio - 1) / Math.pow(ratio, fret * 0.3);
    return (fretPosition * baseWidth);
  }

  calculateFretPosition(fret) {
    if (fret === 0) return 0;
    const ratio = Math.pow(2, 1 / 12);
    const baseWidth = 90;
    let position = 5;
    for (let i = 1; i < fret; i++) {
      const fretWidth = (ratio - 1) / Math.pow(ratio, i * 0.3);
      position += fretWidth * baseWidth;
    }
    return position;
  }

  createStrumArea(container) {
    this.strumArea = document.createElement('div');
    this.strumArea.className = 'strum-area';
    this.strumArea.innerHTML = '<span>STRUM</span>';
    
    this.strumArea.addEventListener('mouseenter', () => this.strumArea.classList.add('hover'));
    this.strumArea.addEventListener('mouseleave', () => this.strumArea.classList.remove('hover'));

    container.appendChild(this.strumArea);
  }

  createStringLabelsContainer() {
    const labelsContainer = document.createElement('div');
    labelsContainer.className = 'string-labels-container';
    // Create buttons for strings 6 to 1 (top to bottom)
    for (let stringNum = 6; stringNum >= 1; stringNum--) {
      const button = this.createStringButton(stringNum);
      labelsContainer.appendChild(button);
    }
    return labelsContainer;
  }

  createStringButton(stringNum) {
    const button = document.createElement('button');
    button.className = `string-button string-${stringNum}`;
    button.innerHTML = `${stringNum} - ${this.getStringNote(stringNum)}`;

    button.addEventListener('mouseenter', () => button.classList.add('hover'));
    button.addEventListener('mouseleave', () => button.classList.remove('hover'));
    button.addEventListener('mousedown', () => button.classList.add('active'));
    button.addEventListener('mouseup', () => button.classList.remove('active'));

    return button;
  }
  
  setupEventListeners() {
    this.fretboardElement.addEventListener('click', (e) => {
      const target = e.target.closest('.fret-position');
      if (target) {
        const stringNum = parseInt(target.dataset.string);
        const fret = parseInt(target.dataset.fret);
        this.setFret(stringNum, fret);
        e.stopPropagation();
      }
    });

    this.fretboardElement.addEventListener('click', (e) => {
      const target = e.target.closest('.finger-position');
      if (target) {
        const stringNum = parseInt(target.dataset.string);
        this.setFret(stringNum, 0);
        e.stopPropagation(); 
      }
    });

    this.stringLabelsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('string-button')) {
        const stringNum = parseInt(e.target.classList[1].split('-')[1]);
        this.pluckString(stringNum);
      }
    });

    this.strumArea.addEventListener('click', () => this.strum('down'));

  }

  setFret(stringNum, fret) {
    const stringIndex = stringNum - 1;
    this.clearFingerPosition(stringNum);
    guitarState.currentFrets[stringIndex] = fret;

    if (fret > 0) {
      this.showFingerPosition(stringNum, fret);
    }
    this.updateStringLabel(stringNum);
    if (!this.isPlayingChord) {
      this.pluckString(stringNum);
    }
  }

  clearFingerPosition(stringNum) {
    const existingFinger = this.fretboardElement.querySelector(
      `.finger-position[data-string="${stringNum}"]`
    );
    if (existingFinger) {
      existingFinger.remove();
    }
  }

  showFingerPosition(stringNum, fret) {
    const fretElement = this.fretboardElement.querySelector(
      `.fret-position.string-${stringNum}.fret-${fret}`
    );

    if (fretElement) {
      const finger = document.createElement('div');
      finger.className = 'finger-position';
      finger.dataset.string = stringNum;
      finger.dataset.fret = fret;
      fretElement.appendChild(finger);
    } else {
      console.error(`❌ Fret element not found for string ${stringNum}, fret ${fret}`);
    }
  }

  getStringNote(stringNum, fret = null) {
    const stringIndex = stringNum - 1;
    const currentFret = fret !== null ? fret : guitarState.currentFrets[stringIndex];
    const baseMidi = GUITAR_TUNING[stringIndex];
    const noteMidi = baseMidi + currentFret;
    return midiToNoteName(noteMidi);
  }

  updateStringLabel(stringNum) {
    const button = this.stringLabelsContainer.querySelector(`.string-button.string-${stringNum}`);
    if (button) {
      const note = this.getStringNote(stringNum);
      button.innerHTML = `${stringNum} - ${note}`;
    }
  }

  updateStringLabels() {
    for (let i = 1; i <= STRING_COUNT; i++) {
      this.updateStringLabel(i);
    }
  }

  pluckString(stringNum) {
    const stringIndex = stringNum - 1;
    if (guitarState.mutedStrings[stringIndex]) {
      return;
    }

    const note = this.getStringNote(stringNum);
    if (audioManager.isAudioReady()) {
      trigger([note], true);

      if (!guitarState.sustainMode) {
        setTimeout(() => trigger([note], false), 250);
      }
    } else {
      console.warn('⚠️ Audio manager not ready');
    }
    this.highlightString(stringNum);
  }

  highlightString(stringNum) {
    const stringElement = this.stringElements[stringNum];
    if (stringElement) {
      stringElement.classList.add('active');
      setTimeout(() => stringElement.classList.remove('active'), 1200);
    }
  }

  strum(direction = 'down') {
    const strumDelay = 10;
    const strings = direction === 'down' ? [6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6];

    strings.forEach((stringNum, index) => {
      setTimeout(() => this.pluckString(stringNum), index * strumDelay);
    });
  }

  toggleStringMute(stringNum) {
    const stringIndex = stringNum - 1;
    guitarState.mutedStrings[stringIndex] = !guitarState.mutedStrings[stringIndex];
    this.updateStringLabel(stringNum);
  }

  /**
   * Sets a chord based on an array of fret positions.
   * Note: The input array should be indexed from string 1 (thinnest) to 6 (thickest).
   * e.g., A C major chord would be `[0, 1, 0, 2, 3, 0]` for strings E, B, G, D, A, E.
   * @param {number[]} fretArray - An array of fret numbers for each string, from 1 to 6.
   */
  setChord(fretArray) {
    this.isPlayingChord = true;

    // Use a new mapping to ensure frets are set correctly from string 1 to 6
    fretArray.forEach((fret, index) => {
      if (fret !== null && fret !== undefined) {
        const stringNum = index + 1; // Correctly maps array index to string number
        this.setFret(stringNum, fret);
      }
    });

    this.isPlayingChord = false;
    setTimeout(() => this.strum('down'), 100);
  }

  getCurrentNotes() {
    const notes = [];
    for (let i = 1; i <= STRING_COUNT; i++) {
      if (!guitarState.mutedStrings[i - 1]) {
        notes.push(this.getStringNote(i));
      }
    }
    return notes;
  }
}

console.log('✅ GuitarInstrument class defined');

export { GuitarInstrument, guitarState };