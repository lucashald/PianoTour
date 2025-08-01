// guitarUI.js - Guitar-specific UI components
import { CHORD_GROUPS, getChordFrets } from '../instrument/guitarChords.js';

export function createChordPalette(guitarInstance) {
  const palette = document.createElement('div');
  palette.className = 'guitar-chord-palette';
  palette.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 16px;
    background: #f5f5f5;
    border-radius: 8px;
    margin-bottom: 16px;
  `;

  Object.entries(CHORD_GROUPS).forEach(([groupName, chords]) => {
    const group = createChordGroup(groupName, chords, guitarInstance);
    palette.appendChild(group);
  });

  return palette;
}

function createChordGroup(groupName, chords, guitarInstance) {
  const group = document.createElement('div');
  group.className = 'chord-group';
  group.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 4px;
  `;

  const label = document.createElement('h4');
  label.textContent = groupName;
  label.style.cssText = `
    margin: 0 0 8px 0;
    font-size: 12px;
    color: #666;
    text-transform: uppercase;
  `;
  group.appendChild(label);

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  `;

  chords.forEach(chord => {
    const button = createChordButton(chord, guitarInstance);
    buttonContainer.appendChild(button);
  });

  group.appendChild(buttonContainer);
  return group;
}

function createChordButton(chordName, guitarInstance) {
  const button = document.createElement('button');
  button.textContent = chordName;
  button.className = 'guitar-chord-btn';
  button.style.cssText = `
    padding: 8px 12px;
    background: linear-gradient(to bottom, #fff, #e0e0e0);
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: bold;
    transition: all 0.1s ease;
    min-width: 40px;
  `;

  button.addEventListener('mousedown', () => {
    button.style.transform = 'translateY(2px)';
    button.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2)';
  });

  button.addEventListener('mouseup', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = 'none';
  });

  button.addEventListener('click', () => {
    const frets = getChordFrets(chordName);
    if (frets) {
      guitarInstance.setChord(frets);
      // Auto-strum after setting chord
      setTimeout(() => guitarInstance.strum(), 100);
    }
  });

  return button;
}

export function createGuitarControls(guitarInstance) {
  const controls = document.createElement('div');
  controls.className = 'guitar-controls';
  controls.style.cssText = `
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px;
    background: #f0f0f0;
    border-radius: 8px;
    margin-bottom: 16px;
  `;

  // Strum buttons
  const strumDown = document.createElement('button');
  strumDown.innerHTML = '↓ Strum Down';
  strumDown.className = 'btn btn--secondary';
  strumDown.addEventListener('click', () => guitarInstance.strum('down'));

  const strumUp = document.createElement('button');
  strumUp.innerHTML = '↑ Strum Up';
  strumUp.className = 'btn btn--secondary';
  strumUp.addEventListener('click', () => guitarInstance.strum('up'));

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