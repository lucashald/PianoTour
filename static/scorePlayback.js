// scorePlayback.js

// ===================================================================
// Imports
// ===================================================================

import { pianoState } from './appState.js'; // Access to sampler, noteEls
import { startAudio, trigger } from './playbackHelpers.js'; // Re-use trigger function
import { NOTES_BY_NAME } from './note-data.js'; // Needed for note name to MIDI mapping
import { getMeasures } from './scoreWriter.js'; // Needed for stopPlayback to reset the score display
import { safeRedraw, scrollToMeasure } from './scoreRenderer.js'; // For visual score updates and scrolling
import { addPlaybackHighlight, clearPlaybackHighlight, clearAllHighlights } from './scoreHighlighter.js';

// ===================================================================
// Constants
// ===================================================================

// DURATION_TO_TONE is not actively used but is fixed for future use.
const DURATION_TO_TONE = { 
'w': '1n', 'w.': '1n.',
'h': '2n', 'h.': '2n.',
'q': '4n', 'q.': '4n.',
'8': '8n', '8.': '8n.',
'16': '16n', '16.': '16n.',
'32': '32n', '32.': '32n.'
};
// FIX: Added beat values for dotted notes. This is the critical fix.
const DURATION_TO_BEATS = { 
'w': 4, 'w.': 6,
'h': 2, 'h.': 3,
'q': 1, 'q.': 1.5,
'8': 0.5, '8.': 0.75,
'16': 0.25, '16.': 0.375,
'32': 0.125, '32.': 0.1875 
};
const PLAYBACK_HIGHLIGHT_COLOR = '#1db954'; // A standard highlight color

// ===================================================================
// Internal State for Playback
// ===================================================================

// Track the last measure scrolled to, to prevent erratic scrolling during playback.
let lastScrolledMeasureIndex = -1;
// Track notes that are currently highlighted by playback (to ensure they are unhighlighted on stop)
let currentPlayingVexFlowNotes = new Set(); 

// ===================================================================
// Playback Functions
// ===================================================================

/**
* Schedules individual note events (audio, piano key, score highlight) for playback.
* @param {object} note - The note object from the measure.
* @param {number} measureIndex - The index of the current measure.
* @param {string} noteId - The ID of the note.
* @param {number} currentTransportTime - The base transport time for the current measure.
* @param {number} clefOffset - The accumulated time offset for the current clef within the measure.
* @param {number} secondsPerBeat - The duration of one beat in seconds.
*/
function scheduleNoteEvents(note, measureIndex, noteId, currentTransportTime, clefOffset, secondsPerBeat) {
const beatDuration = DURATION_TO_BEATS[note.duration];

// Add a check for unknown durations to prevent crashes
if (beatDuration === undefined) {
console.error(`Unknown duration: ${note.duration}. Cannot schedule note.`);
return 0; // Return 0 duration to avoid breaking the rest of the playback
}

const noteDurationInSeconds = beatDuration * secondsPerBeat;

const noteStartTime = currentTransportTime + clefOffset;
const noteKey = `${measureIndex}-${note.clef}-${noteId}`; // Unique key for Set

if (!note.isRest) {
const notesToPlay = note.name.replace(/[()]/g, '').split(' ').filter(Boolean);

// Schedule the "note on" event (audio)
Tone.Transport.scheduleOnce(time => {
trigger(notesToPlay, true);
}, noteStartTime);

// Schedule piano key highlighting
Tone.Transport.scheduleOnce(time => {
notesToPlay.forEach(n => {
const midi = NOTES_BY_NAME[n];
if (midi && pianoState.noteEls[midi]) {
Tone.Draw.schedule(() => {
pianoState.noteEls[midi].classList.add('pressed');
}, time);
}
});
}, noteStartTime);

// Schedule score note highlighting
Tone.Transport.scheduleOnce(time => {
Tone.Draw.schedule(() => {
addPlaybackHighlight(measureIndex, note.clef, noteId, PLAYBACK_HIGHLIGHT_COLOR);
currentPlayingVexFlowNotes.add(noteKey); // Add to the set
}, time);
}, noteStartTime);

const noteEndTime = noteStartTime + noteDurationInSeconds;

// Schedule the "note off" event (audio)
Tone.Transport.scheduleOnce(time => {
trigger(notesToPlay, false);
}, noteEndTime);

// Schedule piano key un-highlighting
Tone.Transport.scheduleOnce(time => {
notesToPlay.forEach(n => {
const midi = NOTES_BY_NAME[n];
if (midi && pianoState.noteEls[midi]) {
Tone.Draw.schedule(() => {
pianoState.noteEls[midi].classList.remove('pressed');
}, time);
}
});
}, noteEndTime);

// Schedule score note un-highlighting
Tone.Transport.scheduleOnce(time => {
Tone.Draw.schedule(() => {
clearPlaybackHighlight(measureIndex, note.clef, noteId);
currentPlayingVexFlowNotes.delete(noteKey); // Remove from the set
}, time);
}, noteEndTime);
}

return noteDurationInSeconds; // Return duration to update offset
}


/**
* Schedules the entire score for playback using Tone.js and provides visual feedback.
*
* This function clears any previous playback schedule, sets the tempo, and then
* iterates through each measure of the score. It schedules "note on" and "note off"
* events for both the audio and the visual highlighting of the piano keys and score.
*
* @param {Array} measures - The array of measures containing the score data.
* @param {number} [bpm=120] - The tempo for playback in beats per minute.
*/
export function playScore(measures, bpm = 120) {
if (!pianoState.samplerReady) {
console.warn("Sampler is not ready. Cannot play score.");
return;
}

// 1. Stop any previous playback and clear the transport schedule.
Tone.Transport.stop();
Tone.Transport.cancel();
Tone.Transport.position = 0;
lastScrolledMeasureIndex = -1;
// Clear the set of currently playing notes for a new playback session
currentPlayingVexFlowNotes.clear();
clearAllHighlights(); // Ensure score is clean before starting

// 2. Set the tempo for the playback.
Tone.Transport.bpm.value = bpm;

let maxEndTime = 0;

// 3. Iterate through each measure to schedule all notes and visual feedback.
let currentTransportTime = 0; // Use seconds instead of beats
const beatsPerMeasure = 4; // Assuming 4/4 time signature
const secondsPerBeat = 60 / bpm; // Convert BPM to seconds per beat

measures.forEach((measure, measureIndex) => {
// Schedule scroll event for the beginning of each measure
Tone.Transport.scheduleOnce(time => {
if (measureIndex !== lastScrolledMeasureIndex) {
// Wrap scroll in Tone.Draw to ensure it's synchronized with the visual timeline
Tone.Draw.schedule(() => {
scrollToMeasure(measureIndex);
lastScrolledMeasureIndex = measureIndex;
}, time);
}
}, currentTransportTime);

let trebleMeasureOffset = 0; // In seconds
let bassMeasureOffset = 0;   // In seconds

// We use 'noteIndex' for array iteration here, as it's a positional reference within the filtered array.
const trebleNotes = measure.filter(n => n.clef === 'treble');
const bassNotes = measure.filter(n => n.clef === 'bass');

// --- Schedule Treble Notes ---
trebleNotes.forEach(note => {
trebleMeasureOffset += scheduleNoteEvents(
note,
measureIndex,
note.id, // Pass noteId here
currentTransportTime,
trebleMeasureOffset,
secondsPerBeat
);
});

// --- Schedule Bass Notes ---
bassNotes.forEach(note => {
bassMeasureOffset += scheduleNoteEvents(
note,
measureIndex,
note.id, // Pass noteId here
currentTransportTime,
bassMeasureOffset,
secondsPerBeat
);
});

// Ensure maxEndTime covers both clefs' durations within the measure
const measureEndTime = currentTransportTime + Math.max(trebleMeasureOffset, bassMeasureOffset);
if (measureEndTime > maxEndTime) {
maxEndTime = measureEndTime;
}

currentTransportTime += beatsPerMeasure * secondsPerBeat;
});

if (maxEndTime > 0) {
// Schedule a final stop event and clear all highlights
Tone.Transport.scheduleOnce(() => {
stopPlayback();
}, maxEndTime + 0.1); // Add a small buffer
}

console.log("Score playback has been scheduled. Call Tone.Transport.start() to play.");
}

/**
* Stops Tone.js transport and clears all scheduled events.
* Also resets visual states like piano key presses and score highlights.
*/
export function stopPlayback() {
Tone.Transport.stop(); // Stop the Tone.js transport
Tone.Transport.cancel(); // Clear all scheduled events
lastScrolledMeasureIndex = -1; // Reset scroll tracking

// Release all currently playing notes on the sampler
if (pianoState.samplerReady && pianoState.sampler) {
if (pianoState.sampler.releaseAll) {
pianoState.sampler.releaseAll();
} else {
// Fallback for older Tone.js versions if releaseAll doesn't exist
for (let midi = 21; midi <= 108; midi++) {
try {
pianoState.sampler.triggerRelease(Tone.Frequency(midi, "midi").toNote());
} catch (e) {
// Ignore errors for notes that aren't currently playing
}
}
}
}

// Clear any visual "pressed" states from the piano keys
Object.values(pianoState.noteEls).forEach(el => {
el.classList.remove('pressed');
});
console.log("Playback stopped.");

// Ensure all highlight rectangles are removed from the score
clearAllHighlights();
safeRedraw();
}

export function initializePlayer() {
// Play Score Button
document.getElementById('play-score-btn')?.addEventListener('click', async (e) => {
e.preventDefault();
const audioReady = await startAudio(); // Ensure audio is on before playing
if (audioReady) {
playScore(getMeasures());
Tone.Transport.start();
}
});

// Stop Playback Button
document.getElementById('stop-score-btn')?.addEventListener('click', (e) => {
e.preventDefault();
stopPlayback();
});

// Connect MIDI Button
document.getElementById('connect-midi-btn')?.addEventListener('click', (e) => {
e.preventDefault();
// Calls the unlock function defined in index.html via the pianoState object
pianoState.unlock();
});
}