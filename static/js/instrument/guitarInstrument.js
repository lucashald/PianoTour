// guitarInstrument.js - Virtual Guitar Integration for Piano Tour
import { pianoState } from "../core/appState.js";
import { createChordPalette, createGuitarControls, createRegeneratePaletteButton } from "../ui/guitarUI.js";
import audioManager from "../core/audioManager.js";
import { NOTES_BY_NAME, DURATION_THRESHOLDS, splitNotesIntoClefs } from "../core/note-data.js";
import { trigger, triggerAttackRelease } from "./playbackHelpers.js";
import { writeNote, fillRests } from "../score/scoreWriter.js";

console.log('🎸 Loading guitarInstrument.js module...');

// Guitar-specific constants
const FRET_COUNT = 20;
const STRING_COUNT = 6;

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

    // Create wrapper for palette and controls
    const wrapper = document.createElement('div');
    wrapper.className = 'chord-palette-wrapper';

    // Create and append chord palette
    const chordPalette = createChordPalette(guitarInstance);
    wrapper.appendChild(chordPalette);
    
    // Create and append regenerate button
    const regenerateButton = createRegeneratePaletteButton(guitarInstance, chordPalette);
    wrapper.appendChild(regenerateButton);
    
    container.appendChild(wrapper);
    
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
  59, // B3           - STRING 2
  55, // G3           - STRING 3
  50, // D3           - STRING 4
  45, // A2           - STRING 5
  40  // E2 (low E)  - STRING 6, thickest
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

    // NEW: Timing tracking for score writing
    this.activeStrings = {}; // Track individual string timing
    this.activeStrum = null; // Track strum timing
    this.playingStrings = {}; // Track which strings are currently playing audio

    this.init();
  }

  init() {
    if (!this.container) {
      console.error('❌ Guitar container not found');
      return;
    }
    this.createFretboard();
    this.setupSilentEventListeners(); // Only set up non-audio listeners initially
    this.updateStringLabels();
    
    // NEW: Set up basic audio unlock listeners if audio isn't ready
    if (!audioManager.isAudioReady()) {
      this.setupBasicAudioUnlockListeners();
    } else {
      this.setupAudioEventListeners();
    }
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
    
    // Only add visual hover effects, no click listeners yet
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

    // Only add visual hover effects, no functionality listeners yet
    button.addEventListener('mouseenter', () => button.classList.add('hover'));
    button.addEventListener('mouseleave', () => button.classList.remove('hover'));

    return button;
  }

  // NEW: Setup basic listeners for audio unlock (called after elements are created)
  setupBasicAudioUnlockListeners() {
    console.log('🎸 Setting up basic audio unlock listeners...');
    
    // Attach to individual string buttons
    const stringButtons = this.stringLabelsContainer.querySelectorAll('.string-button');
    console.log('Found string buttons:', stringButtons);
    stringButtons.forEach(button => {
      button.addEventListener('click', handleInitialGuitar);
    });
    
    // Attach to strum area
    console.log('Found strum area:', this.strumArea);
    if (this.strumArea) {
      this.strumArea.addEventListener('click', handleInitialGuitar);
    }
    
    console.log(`🎸 Basic listeners attached to ${stringButtons.length} string buttons and strum area`);
  }

  // Set up listeners that don't make sound (safe to call immediately)
  setupSilentEventListeners() {
    // Fretboard clicking for finger positioning - these don't make sound
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
  }

  // Set up listeners that DO make sound (call only after audio is ready)
  setupAudioEventListeners() {
    console.log('🎸 Setting up audio event listeners...');
    
    // String button mousedown/mouseup for playing and timing
    this.stringLabelsContainer.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('string-button')) {
        e.target.classList.add('active');
        const stringNum = parseInt(e.target.classList[1].split('-')[1]);
        this.startStringButtonPress(stringNum);
        this.pluckString(stringNum); // Start the note
      }
    });

    this.stringLabelsContainer.addEventListener('mouseup', (e) => {
      if (e.target.classList.contains('string-button')) {
        e.target.classList.remove('active');
        const stringNum = parseInt(e.target.classList[1].split('-')[1]);
        this.endStringButtonPress(stringNum);
        this.stopString(stringNum); // Stop the note
      }
    });

    // Prevent context menu on right click to allow proper mouse events
    this.stringLabelsContainer.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Strum area mousedown/mouseup
    this.strumArea.addEventListener('mousedown', () => this.startStrum('down'));
    this.strumArea.addEventListener('mouseup', () => this.endStrum());

    // Prevent context menu on strum area
    this.strumArea.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  // NEW: Start string button press with timing
  startStringButtonPress(stringNum) {
    const note = this.getStringNote(stringNum);
    this.activeStrings[stringNum] = {
      startTime: performance.now(),
      note: note
    };
  }

  // Enhanced endStringButtonPress method
  endStringButtonPress(stringNum) {
    const activeString = this.activeStrings[stringNum];
    if (!activeString) return;

    const heldTime = performance.now() - activeString.startTime;
    let duration = "q";
    if (heldTime >= DURATION_THRESHOLDS.w) duration = "w";
    else if (heldTime >= DURATION_THRESHOLDS.h) duration = "h";

    // Use the same clef splitting logic for consistency
    const clefGroups = splitNotesIntoClefs([activeString.note]);
    
    // Since it's a single note, there will only be one clef group
    const group = clefGroups[0];
    writeNote({
      clef: group.clef,
      duration,
      notes: group.notes,
      chordName: activeString.note,
    });

    delete this.activeStrings[stringNum];
  }

  setFret(stringNum, fret) {
    const stringIndex = stringNum - 1;
    this.clearFingerPosition(stringNum);
    guitarState.currentFrets[stringIndex] = fret;

    if (fret > 0) {
      this.showFingerPosition(stringNum, fret);
    }
    this.updateStringLabel(stringNum);
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

  // Updated pluckString method - starts the note
  pluckString(stringNum) {
    const stringIndex = stringNum - 1;
    if (guitarState.mutedStrings[stringIndex]) {
      return;
    }

    const note = this.getStringNote(stringNum);
    if (audioManager.isAudioReady()) {
      trigger([note], true);
      this.playingStrings[stringNum] = note; // Track that this string is playing
    }
    this.highlightString(stringNum);
  }

  // NEW: Stop a specific string
  stopString(stringNum) {
    if (this.playingStrings[stringNum]) {
      const note = this.playingStrings[stringNum];
      trigger([note], false);
      delete this.playingStrings[stringNum];
    }
  }

  highlightString(stringNum) {
    const stringElement = this.stringElements[stringNum];
    if (stringElement) {
      stringElement.classList.add('active');
      setTimeout(() => stringElement.classList.remove('active'), 1400);
    }
  }

  // NEW: Start strum method
  startStrum(direction = 'down') {0
    if (!audioManager.isAudioReady()) {
      return;
    }

    // Track strum timing
    this.activeStrum = {
      startTime: performance.now(),
      notes: this.getCurrentNotes(),
      direction: direction
    };

    const strumDelay = 10;
    const strings = direction === 'down' ? [6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6];

    // Start all strings in the strum
    strings.forEach((stringNum, index) => {
      setTimeout(() => this.pluckString(stringNum), index * strumDelay);
    });
  }

  // NEW: End strum method
  endStrum() {
    if (!this.activeStrum) return;

    // Stop all currently playing strings
    Object.keys(this.playingStrings).forEach(stringNum => {
      this.stopString(parseInt(stringNum));
    });

    const heldTime = performance.now() - this.activeStrum.startTime;
    let duration = "q";
    if (heldTime >= DURATION_THRESHOLDS.w) duration = "w";
    else if (heldTime >= DURATION_THRESHOLDS.h) duration = "h";

    // Split notes between clefs
    const clefGroups = splitNotesIntoClefs(this.activeStrum.notes);
    
    // Make sure both clefs are aligned before writing
    fillRests();
    
    // Write each clef group as a separate entry
    clefGroups.forEach(group => {
      writeNote({
        clef: group.clef,
        duration,
        notes: group.notes,
        chordName: group.notes.length === 1 ? group.notes[0] : `Guitar Strum (${group.clef})`,
      });
    });

    this.activeStrum = null;
  }

  // Legacy strum method for backward compatibility
  strum(direction = 'down') {
    this.startStrum(direction);
    // Auto-end after a quarter note duration for legacy calls
    setTimeout(() => this.endStrum(), 1400);
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

    // Use a new mapping to ensure frets are set correctly from string 1 to 6
    fretArray.forEach((fret, index) => {
      if (fret !== null && fret !== undefined) {
        const stringNum = index + 1; // Correctly maps array index to string number
        this.setFret(stringNum, fret);
      }
    });
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


// NEW: Audio unlock functions (similar to piano)
export function handleInitialGuitar(e) {
  e.stopPropagation();
  e.preventDefault();
  
  // Check if click was on a string button or strum area
  const stringButton = e.target.closest(".string-button");
  const strumArea = e.target.closest(".strum-area");
  
  if (!stringButton && !strumArea) {
    console.log("Click was not on a guitar string button or strum area, ignoring");
    return;
  }

  console.log('🎸 Initial guitar interaction for audio unlock...');

  // Store the click details for the deferred action
  let clickedDetails = null;
  
  if (stringButton) {
    const stringNum = parseInt(stringButton.classList[1].split('-')[1]);
    const note = window.guitarInstance ? window.guitarInstance.getStringNote(stringNum) : 'E4';
    clickedDetails = {
      type: 'string',
      stringNum: stringNum,
      notes: [note] // Convert to array for consistent handling
    };
  } else if (strumArea) {
    const notes = window.guitarInstance ? window.guitarInstance.getCurrentNotes() : ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
    clickedDetails = {
      type: 'strum',
      notes: notes
    };
  }

  // Define the deferred action: play what was clicked and write to score
  const playGuitarAndWriteToScore = () => {
    console.log('🎸 Audio is ready! Playing guitar and writing to score:', clickedDetails);

    // Activate the more advanced listeners for future interactions
    addAdvancedGuitarListeners();

    // Use splitNotesIntoClefs to determine proper clef assignment
    const clefGroups = splitNotesIntoClefs(clickedDetails.notes);

    // Play the clicked element
    if (clickedDetails.type === 'string') {
      // Single note - play immediately, don't let triggerAttackRelease write to score
      triggerAttackRelease(clickedDetails.notes, "q", 100, false); // writeToScore = false
      
      // Highlight the string that was clicked
      if (window.guitarInstance) {
        window.guitarInstance.highlightString(clickedDetails.stringNum);
      }
      
      // Write to score manually using proper clef
      const group = clefGroups[0]; // Single note will have one clef group
      writeNote({
        clef: group.clef,
        duration: "q",
        notes: group.notes,
        chordName: group.notes[0],
      });
      
    } else if (clickedDetails.type === 'strum') {
      // Strum - play with delay between strings, don't let triggerAttackRelease write to score
      clickedDetails.notes.forEach((note, index) => {
        setTimeout(() => triggerAttackRelease([note], "q", 100, false), index * 10); // writeToScore = false
      });
      
      // Highlight all strings that are being strummed
      if (window.guitarInstance) {
        // Highlight strings 6 to 1 (down strum) with the same timing as the audio
        const strings = [6, 5, 4, 3, 2, 1];
        strings.forEach((stringNum, index) => {
          // Only highlight strings that aren't muted
          const stringIndex = stringNum - 1;
          if (!guitarState.mutedStrings[stringIndex]) {
            setTimeout(() => {
              window.guitarInstance.highlightString(stringNum);
            }, index * 10);
          }
        });
      }
      
      // Write to score manually using proper clef splitting
      fillRests();
      clefGroups.forEach(group => {
        writeNote({
          clef: group.clef,
          duration: "q",
          notes: group.notes,
          chordName: group.notes.length === 1 ? group.notes[0] : `Guitar Strum (${group.clef})`,
        });
      });
    }
  };

  // Call unlockAndExecute
  audioManager.unlockAndExecute(playGuitarAndWriteToScore);
  console.log('🎸 Calling unlock and execute with guitar functionality');
}

// Simplified initialize function
export function initializeGuitar(containerSelector = '#instrument') {
    console.log('🎸 Initializing Guitar Instrument...');
    
    const container = document.querySelector(containerSelector);
    if (!container) {
        console.error(`Guitar container not found: ${containerSelector}`);
        return null;
    }

    // Create guitar instance (this now handles its own listener setup)
    const guitar = new GuitarInstrument(container.id || containerSelector.replace('#', ''));
    
    // Store globally for other modules to access
    window.guitarInstance = guitar;
    
    console.log('✅ Guitar instrument initialized');
    return guitar;
}

// Updated advanced listeners function
export function addAdvancedGuitarListeners() {
  console.log('🎸 Adding advanced guitar listeners...');
  
  if (window.guitarInstance) {
    // Remove basic listeners first
    const stringButtons = window.guitarInstance.stringLabelsContainer.querySelectorAll('.string-button');
    stringButtons.forEach(button => {
      button.removeEventListener('click', handleInitialGuitar);
    });
    
    if (window.guitarInstance.strumArea) {
      window.guitarInstance.strumArea.removeEventListener('click', handleInitialGuitar);
    }
    
    // Add advanced listeners
    window.guitarInstance.setupAudioEventListeners();
  }
  
  console.log('🎸 Advanced listeners activated, basic listeners removed');
}

console.log('✅ GuitarInstrument class defined');

export { GuitarInstrument, guitarState };