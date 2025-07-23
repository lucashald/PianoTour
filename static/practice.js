// practice.js
// Note identification quiz functionality

// Import note data and playback functions
import { NOTES_BY_MIDI } from './note-data.js';
import { trigger, startAudio } from './playbackHelpers.js';
import { pianoState } from './appState.js';
import { initMidi, setMidiCallbacks } from './midi-controller.js';

const { Factory, StaveConnector, EasyScore, System } = Vex.Flow;

// Define your landmark notes
const LANDMARK_NOTE_NAMES = ['C2', 'C3', 'C4', 'C5', 'C6', 'G4', 'G5', 'F2', 'F3'];

// --- Game State ---
let correctCount = 0;
let incorrectCount = 0;
let currentNote;
let practiceNotes = [];
let midiAccess = null;
let noteIsBeingChecked = false;

// --- Core Functions ---

function drawNote(note) {
  const vfOutput = document.getElementById('vf-output');
  vfOutput.innerHTML = '';
  const vf = new Factory({ renderer: { elementId: 'vf-output', width: 220, height: 250 } });
  const score = vf.EasyScore();
  const system = vf.System({ x: 20, width: 200, spaceBetweenStaves: 10 });

  const noteNameToDraw = note.name;
  const clef = note.midi < 60 ? 'bass' : 'treble';

  let trebleNotes = 'B4/1/r';
  let bassNotes = 'D3/1/r';

  if (clef === 'treble') {
    trebleNotes = `${noteNameToDraw}/q`;
  } else {
    bassNotes = `${noteNameToDraw}/q`;
  }
  
  const trebleVoice = score.voice(score.notes(trebleNotes, { clef: 'treble' })).setStrict(false);
  const bassVoice = score.voice(score.notes(bassNotes, { clef: 'bass' })).setStrict(false);

  system.addStave({ voices: [trebleVoice] }).addClef('treble').addTimeSignature('4/4');
  system.addStave({ voices: [bassVoice] }).addClef('bass').addTimeSignature('4/4');
  system.addConnector().setType(StaveConnector.type.BRACE);
  system.addConnector().setType(StaveConnector.type.SINGLE_LEFT);
  system.addConnector().setType(StaveConnector.type.BOLD_DOUBLE_RIGHT);

  vf.draw();
}

function playNote(midiNumber, duration = 0.5) {
  const noteInfo = NOTES_BY_MIDI[midiNumber];
  if (!noteInfo) return;
  
  // Use trigger from playbackHelpers to play the note
  trigger(noteInfo.name, true);
  
  // Stop the note after the specified duration
  setTimeout(() => {
    trigger(noteInfo.name, false);
  }, duration * 1000);
}

function updatePracticeNotes() {
  const octaveSelectorsEl = document.getElementById('octave-selectors');
  const useAccidentalsEl = document.getElementById('useAccidentals');
  const useLandmarkNotesEl = document.getElementById('useLandmarkNotes');

  const selectedOctaves = [...octaveSelectorsEl.querySelectorAll('input:checked')].map(input => input.value);
  const useAccidentals = useAccidentalsEl.checked;
  const useLandmarkNotes = useLandmarkNotesEl.checked;
  
  let allPossibleNotes = Object.values(NOTES_BY_MIDI);

  if (useLandmarkNotes) {
    practiceNotes = allPossibleNotes.filter(note =>
      LANDMARK_NOTE_NAMES.includes(note.name)
    );
  } else {
    practiceNotes = allPossibleNotes.filter(note => {
      const octave = note.name.slice(-1);
      if (!selectedOctaves.includes(octave)) {
        return false;
      }

      if (note.isBlack) {
        return useAccidentals;
      }
      
      return true;
    });
  }

  octaveSelectorsEl.querySelectorAll('input').forEach(input => {
      input.disabled = useLandmarkNotes;
      if (useLandmarkNotes) input.checked = false;
  });
  useAccidentalsEl.disabled = useLandmarkNotes;
  if (useLandmarkNotes) useAccidentalsEl.checked = false;
}

function loadRandomNote() {
  const vfOutput = document.getElementById('vf-output');
  const guessInput = document.getElementById('guessInput');
  const resultMessage = document.getElementById('resultMessage');

  if (practiceNotes.length === 0) {
      vfOutput.innerHTML = '<div class="text-muted">No notes selected. Please change your settings.</div>';
      guessInput.disabled = true;
      return;
  }
  
  guessInput.disabled = false;
  noteIsBeingChecked = false;
  currentNote = practiceNotes[Math.floor(Math.random() * practiceNotes.length)];
  drawNote(currentNote);
  resultMessage.textContent = '\u00A0';
  resultMessage.className = 'result-message';
  guessInput.value = '';
  guessInput.focus();
}

function updateAndLoadNewNote() {
    updatePracticeNotes();
    loadRandomNote();
}

function generateOctaveSelectors() {
    const octaveSelectorsEl = document.getElementById('octave-selectors');
    const allOctaves = [...new Set(Object.values(NOTES_BY_MIDI).map(n => n.name.slice(-1)))].sort();
    
    allOctaves.forEach(octave => {
        const div = document.createElement('div');
        div.className = 'form-check';

        const input = document.createElement('input');
        input.className = 'form-check-input';
        input.type = 'checkbox';
        input.id = `octave${octave}`;
        input.value = octave;
        if (octave === '3' || octave === '4') {
            input.checked = true;
        }

        const label = document.createElement('label');
        label.className = 'form-check-label';
        label.htmlFor = `octave${octave}`;
        label.textContent = octave;
        
        div.appendChild(input);
        div.appendChild(label);
        octaveSelectorsEl.appendChild(div);
    });
}

function checkAnswer(guess) {
    const resultMessage = document.getElementById('resultMessage');
    const correctCountEl = document.getElementById('correctCount');
    const incorrectCountEl = document.getElementById('incorrectCount');

    if (!currentNote || !guess || noteIsBeingChecked) return;
    noteIsBeingChecked = true;

    // Create aliases for both full note name and pitch class only
    const aliases = [
        currentNote.name.toLowerCase(),           // Full name (e.g., "c4")
        currentNote.pitchClass.toLowerCase()      // Pitch class only (e.g., "c")
    ];
    
    // Add flat name aliases if they exist
    if (currentNote.flatName) {
        aliases.push(currentNote.flatName.toLowerCase());                    // Full flat name (e.g., "db4")
        aliases.push(currentNote.flatName.slice(0, -1).toLowerCase());      // Flat pitch class (e.g., "db")
    }

    if (aliases.includes(guess.toLowerCase())) {
        correctCount++;
        resultMessage.textContent = 'Correct!';
        resultMessage.className = 'result-message text-success';
    } else {
        incorrectCount++;
        const answer = currentNote.flatName ? `${currentNote.name} / ${currentNote.flatName}` : currentNote.name;
        resultMessage.textContent = `Incorrect. The answer was ${answer}`;
        resultMessage.className = 'result-message text-danger';
    }
    correctCountEl.textContent = correctCount;
    incorrectCountEl.textContent = incorrectCount;
    setTimeout(loadRandomNote, 1500);
}

// --- MIDI Functions ---
function handleMidiNoteOn(midiNoteNumber, velocity, channel) {
    console.log(`MIDI Note On: ${midiNoteNumber}, velocity: ${velocity}, channel: ${channel}`);
    
    // Get the note info for this MIDI number
    const noteInfo = NOTES_BY_MIDI[midiNoteNumber];
    if (noteInfo) {
        // Use the pitch class (note name without octave) for MIDI input
        // This matches how the original code worked
        checkAnswer(noteInfo.pitchClass);
    }
}

function handleMidiNoteOff(midiNoteNumber, velocity, channel) {
    // We don't need to do anything on note off for the quiz
    console.log(`MIDI Note Off: ${midiNoteNumber}, velocity: ${velocity}, channel: ${channel}`);
}

function onMIDISuccess(midiAccess) {
    console.log("MIDI ready!");
    const midiStatus = document.getElementById('midiStatus');
    const midiButton = document.getElementById('midiButton');
    
    midiStatus.textContent = 'MIDI device connected successfully!';
    midiStatus.className = 'text-success';
    midiButton.disabled = true;
}

function onMIDIFailure() {
    console.log('Could not access your MIDI devices.');
    const midiStatus = document.getElementById('midiStatus');
    midiStatus.textContent = 'Failed to access MIDI devices.';
    midiStatus.className = 'text-danger';
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    const guessForm = document.getElementById('guessForm');
    const guessInput = document.getElementById('guessInput');
    const playNoteButton = document.getElementById('playNoteButton');
    const midiButton = document.getElementById('midiButton');
    const practiceSettingsHeader = document.getElementById('practiceSettingsHeader');
    const practiceSettingsBody = document.getElementById('practiceSettingsBody');
    const octaveSelectorsEl = document.getElementById('octave-selectors');
    const useAccidentalsEl = document.getElementById('useAccidentals');
    const useLandmarkNotesEl = document.getElementById('useLandmarkNotes');

    guessForm.addEventListener('submit', function(event) {
      event.preventDefault();
      const guess = guessInput.value.trim();
      checkAnswer(guess);
    });

    playNoteButton.addEventListener('click', () => {
      if (currentNote) {
        playNote(currentNote.midi);
      }
    });

    midiButton.addEventListener('click', () => {
        // Set up MIDI callbacks first
        setMidiCallbacks({
            onNoteOn: handleMidiNoteOn,
            onNoteOff: handleMidiNoteOff
        });
        
        // Then initialize MIDI
        initMidi();
        
        // Update UI to show we're trying to connect
        const midiStatus = document.getElementById('midiStatus');
        midiStatus.textContent = 'Connecting to MIDI devices...';
        midiStatus.className = 'text-muted';
    });

    // Manual Toggle for Practice Settings
    practiceSettingsHeader.addEventListener('click', () => {
        if (practiceSettingsBody.style.display === 'none') {
            practiceSettingsBody.style.display = 'block';
            practiceSettingsHeader.classList.remove('collapsed');
        } else {
            practiceSettingsBody.style.display = 'none';
            practiceSettingsHeader.classList.add('collapsed');
        }
    });

    // Settings change listeners
    useLandmarkNotesEl.addEventListener('change', updateAndLoadNewNote);
    [...octaveSelectorsEl.querySelectorAll('input'), useAccidentalsEl].forEach(el => {
        el.addEventListener('change', updateAndLoadNewNote);
    });
}

// --- Initialization ---
function initializePractice() {
    const practiceSettingsHeader = document.getElementById('practiceSettingsHeader');
    const practiceSettingsBody = document.getElementById('practiceSettingsBody');
    
    generateOctaveSelectors();
    setupEventListeners();
    updatePracticeNotes();
    loadRandomNote();

    // Initial state: hide the body and set the header to 'collapsed'
    practiceSettingsBody.style.display = 'none';
    practiceSettingsHeader.classList.add('collapsed');
}

// Initialize when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    initializePractice();
    startAudio();
});