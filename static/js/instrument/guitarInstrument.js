// guitarInstrument.js - Virtual Guitar Integration for Piano Tour
import { pianoState } from "../core/appState.js";
import { createChordPalette, initializeGuitarControls } from "../ui/guitarUI.js";
import audioManager from "../core/audioManager.js";
import { NOTES_BY_NAME, DURATION_THRESHOLDS, splitNotesIntoClefs, identifyChord, notesByMidiKeyAware } from "../core/note-data.js";
import { trigger, triggerAttackRelease } from "./playbackHelpers.js";
import { writeNote, fillRests } from "../score/scoreWriter.js";
import { addAdvancedGuitarListeners } from "../ui/listenerManager.js";
import * as ChordDB from '/static/js/core/chords.js';

// Guitar-specific constants
const FRET_COUNT = 20;
const STRING_COUNT = 6;

// Drag-strum tuning constants
const DRAG_STRUM_STORAGE_KEY = 'guitar-drag-strum';
// Movement below this (in px) counts as a tap, so a plain click still strums
const DRAG_STRUM_TAP_THRESHOLD_PX = 6;
// Pointer speed (px per ms) treated as a full-force rake
const DRAG_STRUM_MAX_SPEED = 2.0;
// Slowest rake still plays at this fraction of the current velocity setting
const DRAG_STRUM_MIN_VELOCITY_RATIO = 0.55;
// Anything in the instrument panel that owns its own click. A pointerdown on
// one of these is left alone rather than starting a rake - that includes the
// piano keys, since the keyboard above the fretboard is live on this page.
const DRAG_STRUM_IGNORED_TARGETS = [
  'button',
  'input',
  'select',
  'a',
  'label',
  '.btn',
  '.key',
  '.fret-position',
  '.finger-position',
  '.chord-diagram-container',
  '.guitar-control-panel'
].join(', ');

// Standard guitar tuning (MIDI numbers) - Indexed 0-5 for strings 1-6 (thinnest to thickest)
// Changed from const to let so it can be modified
let GUITAR_TUNING = [
  64, // E4 (high E) - STRING 1, thinnest
  59, // B3           - STRING 2
  55, // G3           - STRING 3
  50, // D3           - STRING 4
  45, // A2           - STRING 5
  40  // E2 (low E)  - STRING 6, thickest
];

const PRESET_TUNINGS = {
  standard: [64, 59, 55, 50, 45, 40],       // E4, B3, G3, D3, A2, E2
  drop_d: [64, 59, 55, 50, 45, 38],         // E4, B3, G3, D3, A2, D2
  open_g: [62, 59, 55, 50, 43, 38],         // D4, B3, G3, D3, G2, D2
  open_d: [62, 57, 54, 50, 45, 38],         // D4, A3, F#3, D3, A2, D2
  open_e: [64, 59, 56, 52, 47, 40],         // E4, B3, G#3, E3, B2, E2
  dadgad: [62, 57, 55, 50, 45, 38],         // D4, A3, G3, D3, A2, D2
};

// Convert MIDI to note name
function midiToNoteName(midiNumber) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNumber / 12) - 1;
  const noteIndex = midiNumber % 12;
  const result = noteNames[noteIndex] + octave;
  return result;
}

/**
 * Read the saved drag-strum preference. On by default - only an explicit
 * opt-out in the settings panel turns it off, so "never chosen" means on
 * rather than falling through to false.
 * @returns {boolean}
 */
function loadDragStrumPreference() {
  try {
    const saved = localStorage.getItem(DRAG_STRUM_STORAGE_KEY);
    return saved === null ? true : saved === 'true';
  } catch (error) {
    console.warn('Could not read drag-strum preference:', error);
    return true;
  }
}

// Guitar fretboard state - Indexed 0-5 for strings 1-6 (thinnest to thickest)
const guitarState = {
  currentFrets: [0, 0, 0, 0, 0, 0], // Current fret for each string (0 = open)
  mutedStrings: [false, false, false, false, false, false],
  sustainMode: false,
  dragStrumEnabled: loadDragStrumPreference()
};

/**
 * Set guitar tuning
 * @param {Array|string} tuning - Array of 6 MIDI numbers or preset name
 * @returns {boolean} Success
 */
function setGuitarTuning(tuning) {
  let newTuning;
  
  if (typeof tuning === 'string') {
    // Use preset tuning
    if (PRESET_TUNINGS[tuning]) {
      newTuning = [...PRESET_TUNINGS[tuning]];
      console.log(`Setting guitar to ${tuning} tuning:`, newTuning.map(midi => midiToNoteName(midi)));
    } else {
      console.error(`❌ Unknown preset tuning: ${tuning}`);
      console.log('Available presets:', Object.keys(PRESET_TUNINGS));
      return false;
    }
  } else if (Array.isArray(tuning)) {
    // Use custom tuning array
    if (tuning.length !== 6) {
      console.error('❌ Tuning must have exactly 6 strings');
      return false;
    }
    
    // Validate MIDI numbers (reasonable range for guitar)
    const validRange = tuning.every(midi => 
      Number.isInteger(midi) && midi >= 24 && midi <= 84
    );
    
    if (!validRange) {
      console.error('❌ Invalid MIDI numbers in tuning (must be integers between 24-84)');
      return false;
    }
    
    newTuning = [...tuning];
  } else {
    console.error('❌ Tuning must be an array of MIDI numbers or preset name');
    return false;
  }
  
  // Update the tuning
  GUITAR_TUNING = newTuning;
  
  // Update any existing guitar instance
  if (window.guitarInstance) {
    window.guitarInstance.updateAfterTuningChange();
  }
  
  return true;
}

/**
 * Get current guitar tuning
 * @returns {Array} Current tuning as MIDI numbers
 */
function getCurrentTuning() {
  return [...GUITAR_TUNING];
}

/**
 * Get current tuning as note names
 * @returns {Array} Current tuning as note names
 */
function getCurrentTuningNotes() {
  return GUITAR_TUNING.map(midi => midiToNoteName(midi));
}

function getCurrentTuningPreset() {
    try {
        const currentNotes = getCurrentTuningNotes();
        const presetTunings = getPresetTunings();
        
        // Compare current tuning against all presets
        for (const [presetName, tuningData] of Object.entries(presetTunings)) {
            if (arraysEqual(currentNotes, tuningData.notes)) {
                return presetName;
            }
        }
        
        // If no preset matches, return "custom"
        return "custom";
        
    } catch (error) {
        console.warn('Could not determine current tuning preset:', error);
        return "standard"; // Safe fallback
    }
}

/**
 * Helper function to compare two arrays for equality
 * @param {Array} arr1 
 * @param {Array} arr2 
 * @returns {boolean}
 */
function arraysEqual(arr1, arr2) {
    return Array.isArray(arr1) && Array.isArray(arr2) && 
           arr1.length === arr2.length && 
           arr1.every((val, index) => val === arr2[index]);
}

/**
 * Get available preset tunings
 * @returns {Object} Object with preset names and their tunings
 */
function getPresetTunings() {
  const presets = {};
  for (const [name, tuning] of Object.entries(PRESET_TUNINGS)) {
    presets[name] = {
      midi: [...tuning],
      notes: tuning.map(midi => midiToNoteName(midi))
    };
  }
  return presets;
}

class GuitarInstrument {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.fretboardElement = null;
    this.stringElements = [];
    this.fingerElements = [];
    this.stringLabelsContainer = null;
    this.strumArea = null;
    this.isPlayingChord = false;
    this.controlPanelVisible = false;

    // NEW: Timing tracking for score writing
    this.activeStrings = {}; // Track individual string timing
    this.activeStrum = null; // Track strum timing
    this.playingStrings = {}; // Track which strings are currently playing audio

    // Drag-strum gesture state (null when no gesture is in progress)
    this.dragStrum = null;
    // Element the drag gesture is bound to and captured on
    this.gestureRoot = null;
    // Guard so audio listeners are only ever bound once
    this.audioListenersBound = false;
    // Per-string highlight timers so rapid re-plucks don't cut each other short
    this.highlightTimers = {};

    this.init();
  }

  init() {
    if (!this.container) {
      console.error('❌ Guitar container not found');
      return;
    }
    this.createFretboard();
    this.setupSilentEventListeners(); // Only set up non-audio listeners initially
    // Drag-strum listeners are safe to bind now - they no-op until the mode is
    // switched on AND audio is ready.
    this.setupDragStrumListeners();
    this.syncDragStrumControl();
    this.updateStringLabels();
    
    // NEW: Set up basic audio unlock listeners if audio isn't ready
    if (!audioManager.isAudioReady()) {
      this.setupBasicAudioUnlockListeners();
    } else {
      this.setupAudioEventListeners();
    }
  }

  // NEW: Method to update guitar after tuning change
  updateAfterTuningChange() {
    console.log('Updating guitar display after tuning change');
    
    // Clear all current finger positions
    for (let stringNum = 1; stringNum <= STRING_COUNT; stringNum++) {
      this.clearFingerPosition(stringNum);
      guitarState.currentFrets[stringNum - 1] = 0;
      guitarState.mutedStrings[stringNum - 1] = false;
    }
    
    // Update all string labels with new tuning
    this.updateStringLabels();
    
    console.log('Guitar updated for new tuning:', getCurrentTuningNotes());
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
    this.updateStrumAreaAffordance();
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
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'string-button-container';
  
  const button = document.createElement('button');
  button.className = `string-button string-${stringNum}`;
  button.innerHTML = `${stringNum} - ${this.getStringNote(stringNum)}`;
  
  // Create mute toggle button
  const muteButton = document.createElement('button');
  muteButton.className = `mute-button mute-${stringNum}`;
  muteButton.innerHTML = 'M';
  muteButton.title = `Toggle mute for string ${stringNum}`;
  
  // Add visual hover effects
  button.addEventListener('mouseenter', () => button.classList.add('hover'));
  button.addEventListener('mouseleave', () => button.classList.remove('hover'));
  
  buttonContainer.appendChild(button);
  buttonContainer.appendChild(muteButton);
  
  return buttonContainer;
}

  // NEW: Setup basic listeners for audio unlock (called after elements are created)
  setupBasicAudioUnlockListeners() {
    
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
  }

  // Set up listeners that don't make sound (safe to call immediately)
  setupSilentEventListeners() {
    // Fretboard clicking for finger positioning - these don't make sound
    this.setupMuteListeners();

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
  // This can be reached both from init() and from addAdvancedGuitarListeners()
  // after the audio unlock, so make sure we never double-bind.
  if (this.audioListenersBound) return;
  this.audioListenersBound = true;

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

  // Strum area mousedown/mouseup - skipped while drag-strum owns the gesture
  this.strumArea.addEventListener('mousedown', () => {
    if (guitarState.dragStrumEnabled) return;
    this.startStrum('down');
  });
  this.strumArea.addEventListener('mouseup', () => {
    if (guitarState.dragStrumEnabled) return;
    this.endStrum();
  });

  // Prevent context menu on strum area
  this.strumArea.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
}

// Define setupMuteListeners as its own separate method
setupMuteListeners() {
  const muteButtons = this.stringLabelsContainer.querySelectorAll('.mute-button');
  muteButtons.forEach(button => {
    const stringNum = parseInt(button.className.match(/mute-(\d+)/)[1]);
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleStringMute(stringNum);
    });
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
  const container = this.stringLabelsContainer.querySelector(`.string-button-container:has(.string-${stringNum})`);
  if (container) {
    const button = container.querySelector(`.string-button.string-${stringNum}`);
    const muteButton = container.querySelector(`.mute-button.mute-${stringNum}`);
    const stringIndex = stringNum - 1;
    const isMuted = guitarState.mutedStrings[stringIndex];
    
    if (button) {
      const note = isMuted ? 'X' : this.getStringNote(stringNum);
      button.innerHTML = `${stringNum} - ${note}`;
      button.classList.toggle('muted', isMuted);
    }
    
    if (muteButton) {
      muteButton.classList.toggle('active', isMuted);
      muteButton.innerHTML = isMuted ? 'X' : 'M';
    }
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
    if (!stringElement) return;

    // Restart the animation cleanly if this string is already lit, otherwise a
    // fast re-pluck inherits the old timer and cuts the glow short.
    if (this.highlightTimers[stringNum]) {
      clearTimeout(this.highlightTimers[stringNum]);
      stringElement.classList.remove('active');
      void stringElement.offsetWidth; // force reflow so the animation replays
    }

    stringElement.classList.add('active');
    this.highlightTimers[stringNum] = setTimeout(() => {
      stringElement.classList.remove('active');
      delete this.highlightTimers[stringNum];
    }, 1400);
  }

  // NEW: Start strum method
  startStrum(direction = 'down') {
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

    const heldTime = performance.now() - this.activeStrum.startTime;
    let duration = "q";
    if (heldTime >= DURATION_THRESHOLDS.w) duration = "w";
    else if (heldTime >= DURATION_THRESHOLDS.h) duration = "h";

    // Split notes between clefs
    const clefGroups = splitNotesIntoClefs(this.activeStrum.notes);
    const identifiedChord = identifyChord(this.activeStrum.notes, false);
    // Make sure both clefs are aligned before writing
    fillRests();
    
    // Write each clef group as a separate entry
    clefGroups.forEach(group => {
      writeNote({
        clef: group.clef,
        duration,
        notes: group.notes,
        chordName: identifiedChord,
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

  // ==================================================================
  // Drag-to-strum
  //
  // Opt-in gesture mode. Instead of the strum bar acting as a button that
  // always rakes all six strings, dragging across it plucks exactly the
  // strings the pointer crosses, in the order it crosses them, at a velocity
  // taken from how fast you moved. Reversing direction mid-press ends the
  // current stroke and starts a new one, so up-down-up patterns land on the
  // score as separate chords.
  // ==================================================================

  /**
   * Turn drag-strum mode on or off.
   * @param {boolean} enabled
   */
  setDragStrumEnabled(enabled) {
    const isEnabled = !!enabled;
    guitarState.dragStrumEnabled = isEnabled;

    try {
      localStorage.setItem(DRAG_STRUM_STORAGE_KEY, String(isEnabled));
    } catch (error) {
      console.warn('Could not save drag-strum preference:', error);
    }

    // Abandon whichever gesture the other mode had in flight, so a mode switch
    // mid-press can't leave a dangling strum waiting to be written.
    this.cancelDragStrum();
    this.activeStrum = null;

    this.updateStrumAreaAffordance();
    this.syncDragStrumControl();
    console.log(`Drag-to-strum: ${isEnabled ? 'ON' : 'OFF'}`);
  }

  /**
   * Point the settings-panel checkbox at the real state. The panel is
   * server-rendered so it can't know the saved preference on its own.
   */
  syncDragStrumControl() {
    const checkbox = document.getElementById('toggleDragStrumCheckbox');
    if (checkbox) {
      checkbox.checked = guitarState.dragStrumEnabled;
    }
  }

  /**
   * Keep the strum bar's look and label in sync with the current mode.
   */
  updateStrumAreaAffordance() {
    if (!this.strumArea) return;

    const isEnabled = guitarState.dragStrumEnabled;
    this.strumArea.classList.toggle('drag-mode', isEnabled);
  }

  /**
   * Bind the gesture on the whole instrument panel rather than just the strum
   * bar, so a rake can begin in the dead space around the instrument and pass
   * through the strings. Falls back to the guitar's own container if the panel
   * isn't there.
   */
  setupDragStrumListeners() {
    if (!this.strumArea) return;

    this.gestureRoot =
      (this.container && this.container.closest('.instrument-panel')) ||
      this.container ||
      this.strumArea;

    this.gestureRoot.addEventListener('pointerdown', (e) => this.onStrumPointerDown(e));
    this.gestureRoot.addEventListener('pointermove', (e) => this.onStrumPointerMove(e));
    this.gestureRoot.addEventListener('pointerup', (e) => this.onStrumPointerUp(e));
    this.gestureRoot.addEventListener('pointercancel', (e) => this.onStrumPointerCancel(e));
  }

  /**
   * Decide whether a pointerdown is allowed to begin a rake.
   * @returns {boolean|null} true for the strum bar, false for panel dead space,
   *                         null when the press should be left alone entirely
   */
  classifyStrumOrigin(e) {
    if (e.target.closest('.strum-area')) return true;

    // Everything below is the desktop-only widening. Touch keeps the strum bar
    // as its only origin, so page scrolling over the panel still works.
    if (e.pointerType === 'touch') return null;
    if (e.target.closest(DRAG_STRUM_IGNORED_TARGETS)) return null;

    return false;
  }

  onStrumPointerDown(e) {
    if (!guitarState.dragStrumEnabled) return;
    // Before the first unlock, let the existing click -> handleInitialGuitar
    // path run instead. Otherwise the gesture would write silent notes.
    if (!audioManager.isAudioReady()) return;

    const fromStrumBar = this.classifyStrumOrigin(e);
    if (fromStrumBar === null) return;

    e.preventDefault();

    // Capture so the rake keeps tracking once the pointer moves off its origin.
    try {
      this.gestureRoot.setPointerCapture(e.pointerId);
    } catch (error) {
      // Capture is a nicety, not a requirement - carry on without it.
    }

    const fretboardRect = this.fretboardElement.getBoundingClientRect();

    this.dragStrum = {
      pointerId: e.pointerId,
      fromStrumBar,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
      lastY: e.clientY,
      lastTime: performance.now(),
      stringCenters: this.measureStringCenters(),
      xMin: fretboardRect.left,
      xMax: fretboardRect.right,
      stroke: null,
      strokeCount: 0
    };
  }

  onStrumPointerMove(e) {
    const gesture = this.dragStrum;
    if (!gesture || e.pointerId !== gesture.pointerId) return;

    e.preventDefault();

    const y = e.clientY;
    const now = performance.now();
    const dy = y - gesture.lastY;

    // Only rake while the pointer is actually over the fretboard. Without this,
    // a vertical drag in the dead space beside the instrument would strum
    // strings the pointer never visually touched.
    const overFretboard = e.clientX >= gesture.xMin && e.clientX <= gesture.xMax;

    const crossed = overFretboard
      ? this.findCrossedStrings(gesture.stringCenters, gesture.lastY, y)
      : [];
    if (crossed.length) {
      const velocity = this.velocityFromSpeed(Math.abs(dy), now - gesture.lastTime);
      const direction = dy > 0 ? 'down' : 'up';
      crossed.forEach(entry => this.registerDragPluck(entry.stringNum, direction, velocity));
    }

    gesture.lastY = y;
    gesture.lastTime = now;
  }

  onStrumPointerUp(e) {
    const gesture = this.dragStrum;
    if (!gesture || e.pointerId !== gesture.pointerId) return;

    e.preventDefault();
    this.flushDragStroke();

    const travelled = Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY);
    // Only the strum bar taps to strum. A click in the panel's dead space
    // should do nothing at all.
    const wasTap = gesture.fromStrumBar
      && gesture.strokeCount === 0
      && travelled < DRAG_STRUM_TAP_THRESHOLD_PX;

    this.releaseStrumPointer(gesture.pointerId);
    this.dragStrum = null;

    // A plain press on the bar should still behave like the classic button,
    // including holding it for a longer note. startStrum stamps its own start
    // time, which would measure a zero-length press here, so hand it the real
    // one from the gesture.
    if (wasTap) {
      this.startStrum('down');
      if (this.activeStrum) {
        this.activeStrum.startTime = gesture.startTime;
      }
      this.endStrum();
    }
  }

  onStrumPointerCancel(e) {
    const gesture = this.dragStrum;
    if (!gesture || e.pointerId !== gesture.pointerId) return;

    this.flushDragStroke();
    this.releaseStrumPointer(gesture.pointerId);
    this.dragStrum = null;
  }

  releaseStrumPointer(pointerId) {
    try {
      if (this.gestureRoot && this.gestureRoot.hasPointerCapture(pointerId)) {
        this.gestureRoot.releasePointerCapture(pointerId);
      }
    } catch (error) {
      // Already released or never captured - nothing to do.
    }
  }

  /**
   * Abandon an in-flight drag gesture, writing whatever it has so far.
   */
  cancelDragStrum() {
    if (!this.dragStrum) return;

    this.flushDragStroke();
    this.releaseStrumPointer(this.dragStrum.pointerId);
    this.dragStrum = null;
  }

  /**
   * Measure where each string sits on screen right now, top to bottom.
   * Taken once per gesture so pointermove stays layout-thrash free, and so a
   * resize between gestures is picked up automatically.
   * @returns {Array<{stringNum: number, y: number}>}
   */
  measureStringCenters() {
    const centers = [];

    for (let stringNum = 1; stringNum <= STRING_COUNT; stringNum++) {
      const element = this.stringElements[stringNum];
      if (!element) continue;

      const rect = element.getBoundingClientRect();
      centers.push({ stringNum, y: rect.top + rect.height / 2 });
    }

    return centers.sort((a, b) => a.y - b.y);
  }

  /**
   * Which strings sit between two pointer positions, in order of travel.
   * The range is half-open so a string on the boundary of two consecutive
   * move events is only counted once.
   * @param {Array<{stringNum: number, y: number}>} centers
   * @param {number} fromY
   * @param {number} toY
   */
  findCrossedStrings(centers, fromY, toY) {
    if (fromY === toY) return [];

    const low = Math.min(fromY, toY);
    const high = Math.max(fromY, toY);
    const crossed = centers.filter(entry => entry.y > low && entry.y <= high);

    return toY > fromY ? crossed : crossed.reverse();
  }

  /**
   * Map pointer speed onto a MIDI velocity, scaled against the current
   * velocity setting so this still respects the user's overall level.
   * @param {number} distance - pixels travelled
   * @param {number} elapsedMs
   * @returns {number} velocity 1-127
   */
  velocityFromSpeed(distance, elapsedMs) {
    const base = pianoState.velocity || 100;
    const speed = distance / Math.max(elapsedMs, 1);
    const ratio = Math.min(1, speed / DRAG_STRUM_MAX_SPEED);
    const scaled = base * (DRAG_STRUM_MIN_VELOCITY_RATIO + (1 - DRAG_STRUM_MIN_VELOCITY_RATIO) * ratio);

    return Math.max(1, Math.min(127, Math.round(scaled)));
  }

  /**
   * Record one crossed string against the current stroke, starting a new
   * stroke when the rake reverses direction.
   */
  registerDragPluck(stringNum, direction, velocity) {
    const gesture = this.dragStrum;
    if (!gesture) return;

    if (gesture.stroke && gesture.stroke.direction !== direction) {
      this.flushDragStroke();
    }

    if (!gesture.stroke) {
      gesture.stroke = {
        direction,
        notes: [],
        startTime: performance.now()
      };
    }

    const note = this.dragPluck(stringNum, velocity);
    if (note) {
      gesture.stroke.notes.push(note);
    }
  }

  /**
   * Sound one string as part of a rake. Unlike pluckString this uses
   * attack-release, since a rake has no matching mouseup per string.
   * @returns {string|null} the note played, or null if the string is muted
   */
  dragPluck(stringNum, velocity) {
    const stringIndex = stringNum - 1;
    if (guitarState.mutedStrings[stringIndex]) return null;

    const note = this.getStringNote(stringNum);
    if (audioManager.isAudioReady()) {
      triggerAttackRelease([note], "h", velocity, false);
    }
    this.highlightString(stringNum);

    return note;
  }

  /**
   * Write the current stroke to the score as a single chord.
   */
  flushDragStroke() {
    const gesture = this.dragStrum;
    if (!gesture || !gesture.stroke) return;

    const stroke = gesture.stroke;
    gesture.stroke = null;

    // An all-muted stroke makes no sound, so it gets no notation either.
    if (!stroke.notes.length) return;

    gesture.strokeCount++;

    const heldTime = performance.now() - stroke.startTime;
    let duration = "q";
    if (heldTime >= DURATION_THRESHOLDS.w) duration = "w";
    else if (heldTime >= DURATION_THRESHOLDS.h) duration = "h";

    const clefGroups = splitNotesIntoClefs(stroke.notes);
    const identifiedChord = identifyChord(stroke.notes, false);

    fillRests();

    clefGroups.forEach(group => {
      writeNote({
        clef: group.clef,
        duration,
        notes: group.notes,
        chordName: identifiedChord,
      });
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
setChord(fretData) {
  let fretArray;
  let muteArray = [false, false, false, false, false, false];
  
  if (typeof fretData === 'string') {
    fretArray = fretData.split('').map((fret, index) => {
      if (fret === 'x' || fret === 'X') {
        muteArray[index] = true;
        return 0; // Set to open but will be muted
      }
      return parseInt(fret, 10);
    });
  } else if (Array.isArray(fretData)) {
    fretArray = fretData;
  } else {
    console.error('setChord expects a string or array');
    return;
  }

  const reversedArray = [...fretArray].reverse();
  const reversedMuteArray = [...muteArray].reverse();
  
  reversedArray.forEach((fret, index) => {
    if (fret !== null && fret !== undefined) {
      const stringNum = index + 1;
      this.setFret(stringNum, fret);
      
      // Set mute state
      const stringIndex = stringNum - 1;
      guitarState.mutedStrings[stringIndex] = reversedMuteArray[index];
    }
  });
  
  this.updateStringLabels();
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

async showControlPanel() {
    // Get the DOM elements
    const chordContainer = document.getElementById('chord-container');
    const controlPanel = document.querySelector('.guitar-control-panel');
    
    // Early return if elements don't exist
    if (!chordContainer) {
        console.warn('Chord container element not found');
        return false;
    }
    
    if (!controlPanel) {
        console.warn('Guitar control panel element not found');
        return false;
    }
    
    // Initialize controlPanelVisible if it doesn't exist
    if (this.controlPanelVisible === undefined) {
        this.controlPanelVisible = false;
    }
    
    // Toggle the visibility
    this.controlPanelVisible = !this.controlPanelVisible;
    
    if (this.controlPanelVisible) {
        // Show control panel, hide chord container
        chordContainer.classList.add('hidden');
        controlPanel.classList.remove('hidden');
        console.log('Guitar control panel shown');
    } else {
        // Hide control panel, show chord container
        // Switch back to standard tuning for chord container compatibility
        try {
            await ChordDB.changeGuitarTuning('standard');
            console.log('Switched back to standard tuning for chord container');
        } catch (error) {
            console.warn('Could not switch to standard tuning:', error);
        }
        
        chordContainer.classList.remove('hidden');
        controlPanel.classList.add('hidden');
        console.log('Chord container shown');
    }
    
    return this.controlPanelVisible;
}
}

export function handleInitialGuitar(e, actionData = null) {
  e.stopPropagation();
  e.preventDefault();

  // Store the click details for the deferred action
  let clickedDetails = null;
  
  // If actionData is provided, use it directly
  if (actionData) {
    clickedDetails = actionData;
  } else {
    // Otherwise, detect from DOM elements (existing logic)
    const stringButton = e.target.closest(".string-button");
    const strumArea = e.target.closest(".strum-area");
    
    if (!stringButton && !strumArea) {
      console.log("Click was not on a guitar interactive element, ignoring");
      return;
    }
    
    if (stringButton) {
      const stringNum = parseInt(stringButton.classList[1].split('-')[1]);
      const note = window.guitarInstance ? window.guitarInstance.getStringNote(stringNum) : 'E4';
      clickedDetails = {
        type: 'string',
        stringNum: stringNum,
        notes: [note]
      };
    } else if (strumArea) {
      const notes = window.guitarInstance ? window.guitarInstance.getCurrentNotes() : ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
      clickedDetails = {
        type: 'strum',
        direction: 'down',
        notes: notes
      };
    }
  }

  // Rest of the function remains the same...
  const playGuitarAndWriteToScore = () => {
    console.log('Audio is ready! Playing guitar and writing to score:', clickedDetails);

    addAdvancedGuitarListeners();

    const identifiedChord = identifyChord(clickedDetails.notes);
    const clefGroups = splitNotesIntoClefs(clickedDetails.notes);

    if (clickedDetails.type === 'string') {
      triggerAttackRelease(clickedDetails.notes, "h", pianoState.velocity, false);
      
      if (window.guitarInstance) {
        window.guitarInstance.highlightString(clickedDetails.stringNum);
      }
      
      const group = clefGroups[0];
      writeNote({
        clef: group.clef,
        duration: pianoState.quantize,
        notes: group.notes,
        chordName: group.notes[0],
      });
      
    } else if (clickedDetails.type === 'strum' || clickedDetails.type === 'palette') {
      clickedDetails.notes.forEach((note, index) => {
        setTimeout(() => triggerAttackRelease([note], "h", pianoState.velocity, false), index * 10);
      });
      
      if (window.guitarInstance) {
        const strings = clickedDetails.direction === 'up' ? [1, 2, 3, 4, 5, 6] : [6, 5, 4, 3, 2, 1];
        strings.forEach((stringNum, index) => {
          const stringIndex = stringNum - 1;
          if (!guitarState.mutedStrings[stringIndex]) {
            setTimeout(() => {
              window.guitarInstance.highlightString(stringNum);
            }, index * 10);
          }
        });
      }
      
      fillRests();
      clefGroups.forEach(group => {
        writeNote({
          clef: group.clef,
          duration: pianoState.quantize,
          notes: group.notes,
          chordName: identifiedChord,
        });
      });
    }
  };

  audioManager.unlockAndExecute(playGuitarAndWriteToScore);
}

// Simplified initialize function
export function initializeGuitar(containerSelector = '#instrument') {
    
    const container = document.querySelector(containerSelector);
    if (!container) {
        console.error(`Guitar container not found: ${containerSelector}`);
        return null;
    }

    // Create guitar instance (this now handles its own listener setup)
    const guitar = new GuitarInstrument(container.id || containerSelector.replace('#', ''));
    
    // Store globally for other modules to access
    window.guitarInstance = guitar;
    

    return guitar;
}

export { 
  GuitarInstrument, 
  guitarState, 
  setGuitarTuning, 
  getCurrentTuning, 
  getCurrentTuningNotes, 
  getPresetTunings,
  getCurrentTuningPreset
};