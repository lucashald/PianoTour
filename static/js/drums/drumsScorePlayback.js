// scorePlayback.js

// ===================================================================
// Imports
// ===================================================================

import { drumsState } from "../core/appState.js";
import audioManager, { startSpectrumIfReady } from "../core/audioManager.js";
import { NOTES_BY_NAME } from "../core/note-data.js";
import { trigger } from "../instrument/playbackHelpers.js";
import { stopSpectrumVisualization } from "../ui/spectrum.js";
import { updateNowPlayingDisplay } from "../ui/uiHelpers.js";
import {
  addPlaybackHighlight,
  clearAllHighlights,
  setVexFlowNoteStyle,
} from "./drumsScoreHighlighter.js";
import { getVexflowIndexByNoteId, safeRedraw, scrollToMeasure } from "./drumRenderer.js";
import { getDrumMeasures } from "./drumsScoreWriter.js";
// ===================================================================
// Constants
// ===================================================================

// DURATION_TO_TONE is not actively used but is fixed for future use.
const DURATION_TO_TONE = {
  w: "1n",
  "w.": "1n.",
  h: "2n",
  "h.": "2n.",
  q: "4n",
  "q.": "4n.",
  8: "8n",
  "8.": "8n.",
  16: "16n",
  "16.": "16n.",
  32: "32n",
  "32.": "32n.",
};
// FIX: Added beat values for dotted notes. This is the critical fix.
const DURATION_TO_BEATS = {
  w: 4,
  "w.": 6,
  h: 2,
  "h.": 3,
  q: 1,
  "q.": 1.5,
  8: 0.5,
  "8.": 0.75,
  16: 0.25,
  "16.": 0.375,
  32: 0.125,
  "32.": 0.1875,
};
const PLAYBACK_HIGHLIGHT_COLOR = "#76B595"; // A standard highlight color

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
function scheduleNoteEvents(
 note,
 measureIndex,
 noteId,
 currentTransportTime,
 clefOffset,
 secondsPerBeat
) {
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
   const notesToPlay = note.name
     .replace(/[()]/g, "")
     .split(" ")
     .filter(Boolean);

   // Schedule the "note on" event (audio + spectrum)
   Tone.Transport.scheduleOnce((time) => {
     trigger(notesToPlay, true);

     // 🎯 NEW: Start spectrum and track this playback note
     startSpectrumIfReady();

     // Track this note as an active playback note for spectrum management
     drumsState.activeDiatonicChords[noteKey] = {
       notes: notesToPlay,
       startTime: performance.now(),
       isDrumPlaying: true // Flag to identify playback notes
     };
   }, noteStartTime);

   // Schedule piano key highlighting
   Tone.Transport.scheduleOnce((time) => {
     notesToPlay.forEach((n) => {
       const midi = NOTES_BY_NAME[n];
       if (midi && drumsState.noteEls[midi]) {
         Tone.Draw.schedule(() => {
           drumsState.noteEls[midi].classList.add("pressed");
         }, time);
       }
     });
   }, noteStartTime);

   // Schedule score note highlighting
   Tone.Transport.scheduleOnce((time) => {
     Tone.Draw.schedule(() => {
       addPlaybackHighlight(
         measureIndex,
         note.clef,
         noteId,
         PLAYBACK_HIGHLIGHT_COLOR
       );

       // NEW: Update nowplaying display with note name
       const displayName = note.chordName || note.name;
       updateNowPlayingDisplay(displayName);

       currentPlayingVexFlowNotes.add(noteKey); // Add to the set
     }, time);
   }, noteStartTime);

   const noteEndTime = noteStartTime + noteDurationInSeconds;

   // Schedule the "note off" event (audio + spectrum management)
   Tone.Transport.scheduleOnce((time) => {
     trigger(notesToPlay, false);

     // 🎯 NEW: Remove from tracking and potentially stop spectrum
     delete drumsState.activeDiatonicChords[noteKey];

     // Account for sampler release time (1 second) before checking spectrum stop
     setTimeout(() => {
       const hasActiveNotes =
         Object.keys(drumsState.activeNotes).length > 0 ||
         Object.keys(drumsState.activeDiatonicChords).length > 0;

       if (!hasActiveNotes) {
         stopSpectrumVisualization();
       }
     }, 1000); // Wait for sampler release time
   }, noteEndTime);

   // Schedule piano key un-highlighting
   Tone.Transport.scheduleOnce((time) => {
     notesToPlay.forEach((n) => {
       const midi = NOTES_BY_NAME[n];
       if (midi && drumsState.noteEls[midi]) {
         Tone.Draw.schedule(() => {
           drumsState.noteEls[midi].classList.remove("pressed");
         }, time);
       }
     });
   }, noteEndTime);

   // NEW: Schedule individual note un-highlighting (remove specific note from Set)
   Tone.Transport.scheduleOnce((time) => {
     Tone.Draw.schedule(() => {
       // Remove this specific note from the Set
       drumsState.currentPlaybackNotes.delete(noteKey);

       // Clear highlight for this specific note
       const vexflowIndex = getVexflowIndexByNoteId()[noteId];
       if (vexflowIndex !== undefined) {
         let styleToRestore;

         // Determine the correct style to restore based on the highlighting precedence:
         // 1. Is it the currently selected individual note? (Orange takes highest precedence)
         if (
           drumsState.currentSelectedNote &&
           drumsState.currentSelectedNote.measureIndex === measureIndex &&
           drumsState.currentSelectedNote.clef === note.clef &&
           drumsState.currentSelectedNote.noteId === noteId
         ) {
           styleToRestore = {
             fillStyle: "#D88368", // Peach (selected note color)
             strokeStyle: "#D88368",
             shadowColor: null,
             shadowBlur: 0,
           };
         }
         // 2. Is its containing measure currently selected? (Green takes next precedence)
         else if (measureIndex === drumsState.currentSelectedMeasure) {
           styleToRestore = {
             fillStyle: "#76B595", // Green (measure highlight color)
             strokeStyle: "#76B595",
             shadowColor: null,
             shadowBlur: 0,
           };
         }
         // 3. Otherwise, restore to default black (lowest precedence).
         else {
           styleToRestore = {
             fillStyle: "#000000", // Black (default note color)
             strokeStyle: "#000000",
             shadowColor: null,
             shadowBlur: 0,
           };
         }

         setVexFlowNoteStyle(measureIndex, note.clef, vexflowIndex, styleToRestore);
       }

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
export function playScore(measures, bpm = drumsState.tempo) {
 if (!audioManager.isAudioReady()) { // REPLACED: drumsState.samplerReady with audioManager.isAudioReady()
   console.warn("Sampler is not ready. Cannot play score.");
   return;
 } else if (Tone.Transport.state === "started") {
   console.warn("Score is already playing.");
   return;
 }

 // 1. Stop any previous playback and clear the transport schedule.
 Tone.Transport.stop();
 Tone.Transport.cancel();
 Tone.Transport.position = 0;
 lastScrolledMeasureIndex = -1;

 // Clear the set of currently playing notes for a new playback session
 currentPlayingVexFlowNotes.clear();

 // NEW: Clear the playback notes Set
 drumsState.currentPlaybackNotes.clear();

 // 🎯 NEW: Clear any existing playback notes from activeDiatonicChords
 Object.keys(drumsState.activeDiatonicChords).forEach(key => {
   if (drumsState.activeDiatonicChords[key].isDrumPlaying) {
     delete drumsState.activeDiatonicChords[key];
   }
 });

 clearAllHighlights(); // Ensure score is clean before starting

 // 🎯 NEW: Start spectrum for playback
 startSpectrumIfReady();

 // 2. Set the tempo for the playback.
 Tone.Transport.bpm.value = bpm;
 let maxEndTime = 0;

 // 3. Iterate through each measure to schedule all notes and visual feedback.
 let currentTransportTime = 0; // Use seconds instead of beats
 const beatsPerMeasure = drumsState.timeSignature.numerator; // Assuming 4/4 time signature
 const secondsPerBeat = 60 / bpm; // Convert BPM to seconds per beat

 measures.forEach((measure, measureIndex) => {
   // Schedule scroll event for the beginning of each measure
   Tone.Transport.scheduleOnce((time) => {
     if (measureIndex !== lastScrolledMeasureIndex) {
       // Wrap scroll in Tone.Draw to ensure it's synchronized with the visual timeline
       Tone.Draw.schedule(() => {
         scrollToMeasure(measureIndex);
         lastScrolledMeasureIndex = measureIndex;
       }, time);
     }
   }, currentTransportTime);

   let trebleMeasureOffset = 0; // In seconds
   let bassMeasureOffset = 0; // In seconds

   // We use 'noteIndex' for array iteration here, as it's a positional reference within the filtered array.
   const trebleNotes = measure.filter((n) => n.clef === "treble");
   const bassNotes = measure.filter((n) => n.clef === "bass");

   // --- Schedule Treble Notes ---
   trebleNotes.forEach((note) => {
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
   bassNotes.forEach((note) => {
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
   const measureEndTime =
     currentTransportTime + Math.max(trebleMeasureOffset, bassMeasureOffset);
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

 console.log(
   "Score playback has been scheduled. Call Tone.Transport.start() to play."
 );
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
  if (audioManager.isAudioReady() && drumsState.sampler) {
    if (drumsState.sampler.releaseAll) {
      drumsState.sampler.releaseAll();
    } else {
      // Fallback for older Tone.js versions if releaseAll doesn't exist
      for (let midi = 21; midi <= 108; midi++) {
        try {
          drumsState.sampler.triggerRelease(
            Tone.Frequency(midi, "midi").toNote()
          );
        } catch (e) {
          // Ignore errors for notes that aren't currently playing
        }
      }
    }
  }

  // Clear any visual "pressed" states from the piano keys
  Object.values(drumsState.noteEls).forEach((el) => {
    el.classList.remove("pressed");
  });

  // 🎯 FIXED: Don't immediately clear playback notes - let them decay naturally
  // Instead, mark them for cleanup after release time
  const playbackNotesToClear = [];
  Object.keys(drumsState.activeDiatonicChords).forEach(key => {
    if (drumsState.activeDiatonicChords[key].isDrumPlaying) {
      playbackNotesToClear.push(key);
    }
  });

  // Schedule cleanup of playback notes after release time
  if (playbackNotesToClear.length > 0) {
    setTimeout(() => {
      playbackNotesToClear.forEach(key => {
        delete drumsState.activeDiatonicChords[key];
      });

      // Check if spectrum should stop after all notes have decayed
      const hasActiveNotes =
        Object.keys(drumsState.activeNotes).length > 0 ||
        Object.keys(drumsState.activeDiatonicChords).length > 0;

      if (!hasActiveNotes) {
        stopSpectrumVisualization();
      }
    }, 1000); // Wait for sampler release time
  } else {
    // No playback notes, safe to stop spectrum immediately
    stopSpectrumVisualization();
  }

  console.log("Playback stopped.");

  // Ensure all highlight rectangles are removed from the score
  clearAllHighlights();
  safeRedraw();
}

export function initializeDrumsPlayer() {
  // Play Score Button
  document
    .getElementById("play-drums-score-btn")
    ?.addEventListener("click", async (e) => {
      e.preventDefault();
      document.getElementById("instrument")?.focus();
      // Directly check if audio is ready, or attempt to unlock and then play.
      // The audioManager.unlockAndExecute function is the single point for this.
      const playAction = () => {
        playScore(getDrumMeasures());
        Tone.Transport.start();
      };

      // Attempt to unlock audio and execute the play action.
      // If audio is already ready, it executes immediately.
      // If not, it initiates loading and executes once ready.
      const audioStarted = await audioManager.unlockAndExecute(playAction);
      if (!audioStarted) {
          console.warn("Could not start audio for playback. Please ensure user interaction has occurred.");
      }
    });
}