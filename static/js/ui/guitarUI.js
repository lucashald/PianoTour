// guitarUI.js - Guitar-specific UI components
import { handleInitialGuitar } from '../instrument/guitarInstrument.js';
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

export function createChordPalette(guitarInstance) {
  const palette = document.createElement('div');
  palette.className = 'guitar-chord-palette';

  // Create buttons for degrees 1-7
  for (let degree = 1; degree <= 7; degree++) {
    const chord = getChordByDegree(degree);
    if (chord) {
      const button = createChordButton(chord, guitarInstance);
      palette.appendChild(button);
    }
  }

  return palette;
}

function createChordButton(chord, guitarInstance) {
  const button = document.createElement('button');
  button.textContent = chord.displayName;
  button.className = 'gbtn btn--compact';

  button.addEventListener('mousedown', () => {
    button.style.transform = 'translateY(2px)';
    button.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2)';
  });

  button.addEventListener('mouseup', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = 'none';
  });

button.addEventListener('click', () => {
  if (chord.frets) {
    // Convert frets string "x32010" to array [null, 3, 2, 0, 1, 0]
    const fretsArray = chord.frets.split('').map(fret => {
      if (fret === 'x') return null; // muted string - will be skipped by setChord
      return parseInt(fret, 10);
    });
    
    guitarInstance.setChord(fretsArray);
    // Auto-strum after setting chord
    setTimeout(() => guitarInstance.strum(), 100);
  }
});

  return button;
}

export function createRegeneratePaletteButton(guitarInstance, paletteElement) {
  const button = document.createElement('button');
  button.innerHTML = 'Regenerate Chords';
  button.className = 'btn btn--primary';
  
  button.addEventListener('click', () => {
    // Clear existing palette
    paletteElement.innerHTML = '';
    
    // Regenerate buttons for degrees 1-7
    for (let degree = 1; degree <= 7; degree++) {
      const chord = getChordByDegree(degree);
      if (chord) {
        const chordButton = createChordButton(chord, guitarInstance);
        paletteElement.appendChild(chordButton);
      }
    }
  });

  return button;
}

export function createGuitarControls(guitarInstance) {
  const controls = document.createElement('div');
  controls.className = 'guitar-controls';

  // Strum Down button - works like strum area
  const strumDown = document.createElement('button');
  strumDown.innerHTML = '↓ Strum Down';
  strumDown.className = 'btn btn--secondary';
  
  strumDown.addEventListener('mousedown', (e) => {
    e.preventDefault();
    strumDown.style.transform = 'translateY(2px)';
    strumDown.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2)';
    guitarInstance.strum('down');
  });

  strumDown.addEventListener('mouseup', () => {
    strumDown.style.transform = 'translateY(0)';
    strumDown.style.boxShadow = 'none';
  });

  strumDown.addEventListener('mouseleave', () => {
    strumDown.style.transform = 'translateY(0)';
    strumDown.style.boxShadow = 'none';
  });

  // Strum Up button - works like strum area
  const strumUp = document.createElement('button');
  strumUp.innerHTML = '↑ Strum Up';
  strumUp.className = 'btn btn--secondary';
  
  strumUp.addEventListener('mousedown', (e) => {
    e.preventDefault();
    strumUp.style.transform = 'translateY(2px)';
    strumUp.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2)';
    guitarInstance.strum('up');
  });

  strumUp.addEventListener('mouseup', () => {
    strumUp.style.transform = 'translateY(0)';
    strumUp.style.boxShadow = 'none';
  });

  strumUp.addEventListener('mouseleave', () => {
    strumUp.style.transform = 'translateY(0)';
    strumUp.style.boxShadow = 'none';
  });

  // Clear chord button
  const clearChord = document.createElement('button');
  clearChord.innerHTML = 'Clear Chord';
  clearChord.className = 'btn btn--danger';
  clearChord.addEventListener('click', () => {
    guitarInstance.setChord([0, 0, 0, 0, 0, 0]);
  });

  controls.appendChild(strumDown);
  controls.appendChild(strumUp);
  controls.appendChild(clearChord);

  return controls;
}