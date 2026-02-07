// playalong.js
// Play-along mode: practice playing a loaded score with accuracy and timing feedback.
// Reuses existing score rendering, playback, and MIDI infrastructure.

import { pianoState } from '../core/appState.js';
import { NOTES_BY_MIDI, NOTES_BY_NAME, notesByMidiKeyAware } from '../core/note-data.js';
import { initMidi, setMidiCallbacks } from '../instrument/midi-controller.js';
import { trigger } from '../instrument/playbackHelpers.js';
import audioManager from '../core/audioManager.js';
import { getMeasures } from '../score/scoreWriter.js';
import { drawAll, scrollToMeasure } from '../score/scoreRenderer.js';
import {
  addPlaybackHighlight,
  clearAllHighlights,
  setVexFlowNoteStyle,
} from '../score/scoreHighlighter.js';
import { getVexflowIndexByNoteId } from '../score/scoreRenderer.js';

// ===================================================================
// Constants
// ===================================================================

const DURATION_TO_BEATS = {
  w: 4, 'w.': 6,
  h: 2, 'h.': 3,
  q: 1, 'q.': 1.5,
  '8': 0.5, '8.': 0.75,
  '16': 0.25, '16.': 0.375,
  '32': 0.125, '32.': 0.1875,
};

const HIGHLIGHT_WAITING = '#4A90D9';   // Blue - waiting for input
const HIGHLIGHT_CORRECT = '#76B595';   // Green - correct
const HIGHLIGHT_INCORRECT = '#D88368'; // Peach - incorrect
const HIGHLIGHT_DEFAULT = '#000000';   // Black - default

// Timing tolerance (fraction of beat duration)
const TIMING_PERFECT = 0.15;
const TIMING_GOOD = 0.35;
const TIMING_OK = 0.6;

// ===================================================================
// State
// ===================================================================

let practiceMode = 'both';  // 'notes', 'timing', 'both'
let isRunning = false;
let isPaused = false;

// Score traversal
let flatNotes = [];         // Flattened list of non-rest notes from the score
let currentNoteIndex = 0;   // Current note the user should play
let sessionStats = { correct: 0, incorrect: 0, total: 0, timingScore: 0, timingTotal: 0 };

// Timing tracking
let expectedNoteTime = 0;   // When the current note should be played (performance.now)
let practiceStartTime = 0;  // When practice session started
let tempoMs = 500;          // Milliseconds per beat (derived from tempo)

// Active keys tracking (to prevent double triggers)
let activePlayalongKeys = new Set();

// Timing mode state
let timingInterval = null;
let lastAdvanceTime = 0;

// ===================================================================
// Score Flattening
// ===================================================================

/**
 * Flattens the measures array into a sequential list of notes for practice.
 * Each entry includes the note data, measure index, and timing offset.
 */
function flattenScore(measures) {
  const flat = [];
  let cumulativeBeats = 0;

  measures.forEach((measure, measureIndex) => {
    // Process treble and bass separately, sorted by clef offset
    const trebleNotes = measure.filter(n => n.clef === 'treble');
    const bassNotes = measure.filter(n => n.clef === 'bass');

    let trebleOffset = 0;
    let bassOffset = 0;

    trebleNotes.forEach(note => {
      const beats = DURATION_TO_BEATS[note.duration] || 0;
      if (!note.isRest) {
        flat.push({
          note,
          measureIndex,
          beatOffset: cumulativeBeats + trebleOffset,
          duration: beats,
          noteNames: parseNoteNames(note.name),
        });
      }
      trebleOffset += beats;
    });

    bassNotes.forEach(note => {
      const beats = DURATION_TO_BEATS[note.duration] || 0;
      if (!note.isRest) {
        flat.push({
          note,
          measureIndex,
          beatOffset: cumulativeBeats + bassOffset,
          duration: beats,
          noteNames: parseNoteNames(note.name),
        });
      }
      bassOffset += beats;
    });

    cumulativeBeats += pianoState.timeSignature.numerator;
  });

  // Sort by beat offset so simultaneous notes from different clefs are grouped
  flat.sort((a, b) => a.beatOffset - b.beatOffset);
  return flat;
}

/**
 * Parses a note name string into an array of individual note names.
 * Handles single notes "C4" and chords "(C4 E4 G4)".
 */
function parseNoteNames(name) {
  if (!name) return [];
  const cleaned = name.replace(/[()]/g, '').trim();
  return cleaned.split(/\s+/).filter(Boolean);
}

// ===================================================================
// Note Matching
// ===================================================================

/**
 * Checks if a played MIDI note matches the expected note(s).
 * Returns true if the played note matches any of the expected notes.
 */
function doesNoteMatch(playedMidi, expectedNoteNames) {
  const playedInfo = NOTES_BY_MIDI[playedMidi];
  if (!playedInfo) return false;

  const playedName = playedInfo.name.toUpperCase();
  const playedPitch = playedInfo.pitchClass.toUpperCase();
  const playedFlat = playedInfo.flatName ? playedInfo.flatName.toUpperCase() : null;

  for (const expected of expectedNoteNames) {
    const expUpper = expected.toUpperCase();
    // Match by full name (C4) or pitch class only (C) for flexibility
    if (playedName === expUpper || playedPitch === expUpper) return true;
    // Also match enharmonic equivalents (C#4 = Db4)
    if (playedFlat && playedFlat === expUpper) return true;
    // Check if expected has a flat equivalent
    const expMidi = NOTES_BY_NAME[expected];
    if (expMidi !== undefined && expMidi === playedMidi) return true;
  }
  return false;
}

/**
 * Calculate timing accuracy score.
 * Returns a value between 0 and 1 where 1 is perfect timing.
 */
function calculateTimingScore(actualTime, expectedTime, beatDurationMs) {
  const timeDiff = Math.abs(actualTime - expectedTime);
  const fraction = timeDiff / beatDurationMs;

  if (fraction <= TIMING_PERFECT) return 1.0;
  if (fraction <= TIMING_GOOD) return 0.75;
  if (fraction <= TIMING_OK) return 0.5;
  return 0.25;
}

function getTimingLabel(score) {
  if (score >= 1.0) return 'Perfect!';
  if (score >= 0.75) return 'Great';
  if (score >= 0.5) return 'Good';
  return 'Off';
}

// ===================================================================
// Visual Feedback
// ===================================================================

function highlightCurrentNote() {
  if (currentNoteIndex >= flatNotes.length) return;
  const entry = flatNotes[currentNoteIndex];
  addPlaybackHighlight(entry.measureIndex, entry.note.clef, entry.note.id, HIGHLIGHT_WAITING);
  scrollToMeasure(entry.measureIndex, true);
}

function showNoteResult(entry, color) {
  const vexflowIndex = getVexflowIndexByNoteId()[entry.note.id];
  if (vexflowIndex !== undefined) {
    const style = {
      fillStyle: color,
      strokeStyle: color,
      shadowColor: color === HIGHLIGHT_CORRECT ? color : null,
      shadowBlur: color === HIGHLIGHT_CORRECT ? 10 : 0,
    };
    setVexFlowNoteStyle(entry.measureIndex, entry.note.clef, vexflowIndex, style);
  }
}

function resetNoteStyle(entry) {
  const vexflowIndex = getVexflowIndexByNoteId()[entry.note.id];
  if (vexflowIndex !== undefined) {
    setVexFlowNoteStyle(entry.measureIndex, entry.note.clef, vexflowIndex, {
      fillStyle: HIGHLIGHT_DEFAULT,
      strokeStyle: HIGHLIGHT_DEFAULT,
      shadowColor: null,
      shadowBlur: 0,
    });
  }
}

// ===================================================================
// UI Updates
// ===================================================================

function updateStatsDisplay() {
  const correctEl = document.getElementById('playalong-correct');
  const incorrectEl = document.getElementById('playalong-incorrect');
  const totalEl = document.getElementById('playalong-total');
  const accuracyEl = document.getElementById('playalong-accuracy');
  const timingEl = document.getElementById('playalong-timing');
  const progressEl = document.getElementById('playalong-progress');

  if (correctEl) correctEl.textContent = sessionStats.correct;
  if (incorrectEl) incorrectEl.textContent = sessionStats.incorrect;
  if (totalEl) totalEl.textContent = sessionStats.total;

  if (accuracyEl) {
    const pct = sessionStats.total > 0
      ? Math.round((sessionStats.correct / sessionStats.total) * 100)
      : 0;
    accuracyEl.textContent = `${pct}%`;
  }

  if (timingEl) {
    const avg = sessionStats.timingTotal > 0
      ? Math.round((sessionStats.timingScore / sessionStats.timingTotal) * 100)
      : 0;
    timingEl.textContent = `${avg}%`;
  }

  if (progressEl) {
    const progress = flatNotes.length > 0
      ? Math.round((currentNoteIndex / flatNotes.length) * 100)
      : 0;
    progressEl.textContent = `${currentNoteIndex}/${flatNotes.length} (${progress}%)`;
  }
}

function updateStatusMessage(message, className) {
  const el = document.getElementById('playalong-status');
  if (el) {
    el.textContent = message;
    el.className = 'playalong-status ' + (className || '');
  }
}

function updateExpectedNote() {
  const el = document.getElementById('playalong-expected');
  if (!el) return;
  if (currentNoteIndex < flatNotes.length) {
    const entry = flatNotes[currentNoteIndex];
    const displayName = entry.note.chordName || entry.note.name;
    el.textContent = displayName;
  } else {
    el.textContent = '—';
  }
}

// ===================================================================
// Practice Flow
// ===================================================================

function advanceToNextNote() {
  // Reset style of previous note after a short delay
  if (currentNoteIndex < flatNotes.length) {
    const prevEntry = flatNotes[currentNoteIndex];
    setTimeout(() => resetNoteStyle(prevEntry), 800);
  }

  currentNoteIndex++;
  updateStatsDisplay();
  updateExpectedNote();

  if (currentNoteIndex >= flatNotes.length) {
    completePractice();
    return;
  }

  highlightCurrentNote();

  // Update expected timing for timing/both modes
  if (practiceMode === 'timing' || practiceMode === 'both') {
    const entry = flatNotes[currentNoteIndex];
    expectedNoteTime = practiceStartTime + (entry.beatOffset * tempoMs);
  }
}

function processPlayedNote(midiNoteNumber, velocity) {
  if (!isRunning || isPaused || currentNoteIndex >= flatNotes.length) return;

  const entry = flatNotes[currentNoteIndex];
  const now = performance.now();
  let noteCorrect = true;
  let timingScore = 1.0;

  // Check note accuracy (for 'notes' and 'both' modes)
  if (practiceMode === 'notes' || practiceMode === 'both') {
    noteCorrect = doesNoteMatch(midiNoteNumber, entry.noteNames);
  }

  // Check timing accuracy (for 'timing' and 'both' modes)
  if (practiceMode === 'timing' || practiceMode === 'both') {
    timingScore = calculateTimingScore(now, expectedNoteTime, tempoMs);
    sessionStats.timingScore += timingScore;
    sessionStats.timingTotal++;
  }

  // Update stats
  sessionStats.total++;
  if (noteCorrect) {
    sessionStats.correct++;
    showNoteResult(entry, HIGHLIGHT_CORRECT);

    const timingLabel = (practiceMode === 'timing' || practiceMode === 'both')
      ? ` — ${getTimingLabel(timingScore)}`
      : '';
    updateStatusMessage(`✓ Correct${timingLabel}`, 'playalong-status--correct');
  } else {
    sessionStats.incorrect++;
    showNoteResult(entry, HIGHLIGHT_INCORRECT);

    const expectedDisplay = entry.note.chordName || entry.note.name;
    updateStatusMessage(`✗ Expected: ${expectedDisplay}`, 'playalong-status--incorrect');
  }

  // In notes-only mode, always advance (even on wrong note, for learning flow)
  // In timing mode, always advance (we care about timing, any note is accepted)
  // In both mode, advance on correct note
  if (practiceMode === 'notes' || practiceMode === 'timing' || noteCorrect) {
    advanceToNextNote();
  }
}

function completePractice() {
  isRunning = false;
  stopTimingMode();

  const accuracy = sessionStats.total > 0
    ? Math.round((sessionStats.correct / sessionStats.total) * 100)
    : 0;
  const timing = sessionStats.timingTotal > 0
    ? Math.round((sessionStats.timingScore / sessionStats.timingTotal) * 100)
    : 0;

  let message = `🎉 Practice complete! Note accuracy: ${accuracy}%`;
  if (practiceMode === 'timing' || practiceMode === 'both') {
    message += ` | Timing: ${timing}%`;
  }
  updateStatusMessage(message, 'playalong-status--complete');

  // Update button states
  const startBtn = document.getElementById('playalong-start-btn');
  const stopBtn = document.getElementById('playalong-stop-btn');
  if (startBtn) startBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = true;
}

// ===================================================================
// Timing Mode (auto-advance with metronome timing)
// ===================================================================

function startTimingMode() {
  if (practiceMode !== 'timing') return;

  // In timing-only mode, auto-advance through notes at tempo
  // and user just needs to press any key in time
  timingInterval = setInterval(() => {
    if (!isRunning || isPaused) return;
    const now = performance.now();
    if (currentNoteIndex < flatNotes.length) {
      const entry = flatNotes[currentNoteIndex];
      const noteEndTime = practiceStartTime + ((entry.beatOffset + entry.duration) * tempoMs);
      if (now >= noteEndTime) {
        // Time expired for this note without input — mark as missed
        sessionStats.total++;
        sessionStats.incorrect++;
        showNoteResult(entry, HIGHLIGHT_INCORRECT);
        updateStatusMessage('✗ Missed!', 'playalong-status--incorrect');
        advanceToNextNote();
      }
    }
  }, 50);
}

function stopTimingMode() {
  if (timingInterval) {
    clearInterval(timingInterval);
    timingInterval = null;
  }
}

// ===================================================================
// MIDI Handlers (play-along specific — no score writing)
// ===================================================================

function handlePlayalongNoteOn(midiNoteNumber, velocity, channel) {
  if (activePlayalongKeys.has(midiNoteNumber)) return;
  activePlayalongKeys.add(midiNoteNumber);

  // Play audio feedback using existing trigger
  const noteInfo = NOTES_BY_MIDI[midiNoteNumber];
  if (noteInfo) {
    trigger(noteInfo.name, true, velocity);
  }

  // Highlight the played key visually
  const keyEl = pianoState.noteEls[midiNoteNumber];
  if (keyEl) {
    keyEl.classList.add('pressed');
  }

  // Process for practice scoring
  processPlayedNote(midiNoteNumber, velocity);
}

function handlePlayalongNoteOff(midiNoteNumber, velocity, channel) {
  activePlayalongKeys.delete(midiNoteNumber);

  // Stop audio
  const noteInfo = NOTES_BY_MIDI[midiNoteNumber];
  if (noteInfo) {
    trigger(noteInfo.name, false);
  }

  // Remove visual highlight
  const keyEl = pianoState.noteEls[midiNoteNumber];
  if (keyEl) {
    keyEl.classList.remove('pressed');
  }
}

// ===================================================================
// Session Control
// ===================================================================

function startPractice() {
  const measures = getMeasures();
  if (!measures || measures.length === 0 || measures.every(m => m.length === 0)) {
    updateStatusMessage('No score loaded. Please load a score first.', 'playalong-status--incorrect');
    return;
  }

  // Get mode from UI
  const modeSelect = document.getElementById('playalong-mode');
  if (modeSelect) {
    practiceMode = modeSelect.value;
  }

  // Reset state
  sessionStats = { correct: 0, incorrect: 0, total: 0, timingScore: 0, timingTotal: 0 };
  currentNoteIndex = 0;
  activePlayalongKeys.clear();
  isRunning = true;
  isPaused = false;

  // Flatten the score
  flatNotes = flattenScore(measures);
  if (flatNotes.length === 0) {
    updateStatusMessage('Score has no playable notes.', 'playalong-status--incorrect');
    return;
  }

  // Calculate timing
  const bpm = pianoState.tempo || 120;
  tempoMs = 60000 / bpm; // ms per beat
  practiceStartTime = performance.now();
  expectedNoteTime = practiceStartTime + (flatNotes[0].beatOffset * tempoMs);

  // Clear highlights and redraw
  clearAllHighlights();
  drawAll(measures);

  // Update UI
  updateStatsDisplay();
  updateExpectedNote();
  highlightCurrentNote();
  updateStatusMessage('Playing along... play the highlighted notes!', 'playalong-status--active');

  // Update button states
  const startBtn = document.getElementById('playalong-start-btn');
  const stopBtn = document.getElementById('playalong-stop-btn');
  if (startBtn) startBtn.disabled = true;
  if (stopBtn) stopBtn.disabled = false;

  // Start timing auto-advance if in timing mode
  startTimingMode();
}

function stopPractice() {
  isRunning = false;
  isPaused = false;
  stopTimingMode();
  clearAllHighlights();
  activePlayalongKeys.clear();

  // Release any active audio
  activePlayalongKeys.forEach(midi => {
    const noteInfo = NOTES_BY_MIDI[midi];
    if (noteInfo) trigger(noteInfo.name, false);
  });

  updateStatusMessage('Practice stopped.', '');

  const startBtn = document.getElementById('playalong-start-btn');
  const stopBtn = document.getElementById('playalong-stop-btn');
  if (startBtn) startBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = true;

  // Redraw score clean
  const measures = getMeasures();
  if (measures) drawAll(measures);
}

// ===================================================================
// Keyboard Input (computer keyboard fallback)
// ===================================================================

function setupKeyboardInput() {
  document.addEventListener('keydown', (e) => {
    if (!isRunning || isPaused) return;

    // Map some keyboard keys to MIDI notes for testing without a MIDI controller
    const keyMap = pianoState.keyMap;
    const midi = keyMap[e.key];
    if (midi !== undefined && !activePlayalongKeys.has(midi)) {
      handlePlayalongNoteOn(midi, 100, 0);
    }
  });

  document.addEventListener('keyup', (e) => {
    const keyMap = pianoState.keyMap;
    const midi = keyMap[e.key];
    if (midi !== undefined) {
      handlePlayalongNoteOff(midi, 0, 0);
    }
  });
}

// ===================================================================
// Event Listeners
// ===================================================================

function setupEventListeners() {
  const startBtn = document.getElementById('playalong-start-btn');
  const stopBtn = document.getElementById('playalong-stop-btn');
  const midiBtn = document.getElementById('playalong-midi-btn');
  const settingsHeader = document.getElementById('playalong-settings-header');
  const settingsBody = document.getElementById('playalong-settings-body');

  startBtn?.addEventListener('click', () => {
    audioManager.unlockAndExecute(() => {
      startPractice();
    });
  });

  stopBtn?.addEventListener('click', () => {
    stopPractice();
  });

  midiBtn?.addEventListener('click', () => {
    setMidiCallbacks({
      onNoteOn: handlePlayalongNoteOn,
      onNoteOff: handlePlayalongNoteOff,
    });

    audioManager.unlockAndExecute(() => {
      initMidi();
      const midiStatus = document.getElementById('playalong-midi-status');
      if (midiStatus) {
        midiStatus.textContent = 'MIDI connected!';
        midiStatus.className = 'playalong-midi-status playalong-midi-status--connected';
      }
      midiBtn.disabled = true;
    });
  });

  // Settings toggle
  settingsHeader?.addEventListener('click', () => {
    if (settingsBody.style.display === 'none') {
      settingsBody.style.display = 'block';
      settingsHeader.classList.remove('collapsed');
    } else {
      settingsBody.style.display = 'none';
      settingsHeader.classList.add('collapsed');
    }
  });
}

// ===================================================================
// Initialization
// ===================================================================

export function initializePlayalong() {
  setupEventListeners();
  setupKeyboardInput();

  // Set MIDI callbacks for play-along mode (no score writing)
  setMidiCallbacks({
    onNoteOn: handlePlayalongNoteOn,
    onNoteOff: handlePlayalongNoteOff,
  });

  // Initial UI state
  const stopBtn = document.getElementById('playalong-stop-btn');
  if (stopBtn) stopBtn.disabled = true;

  updateStatsDisplay();
  updateStatusMessage('Load a score and press Start to begin practicing.', '');
}
