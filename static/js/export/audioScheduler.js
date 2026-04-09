// audioScheduler.js
// Shared scheduling logic for both live playback and export

import { pianoState } from "../core/appState.js";
import { NOTES_BY_NAME } from "../core/note-data.js";

// ===================================================================
// Constants
// ===================================================================

export const DURATION_TO_BEATS = {
  w: 4,
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

// ===================================================================
// Tie Map Building (for audio sustain)
// ===================================================================

/**
 * Builds a simple map of tie relationships for audio sustain
 * @param {Array} measures - All measures in the score
 * @returns {Map} noteId -> tieInfo object
 */
export function buildTieMap(measures) {
  const tieMap = new Map();

  // Build note details map and id lookup
  const noteDetails = new Map();
  const noteById = new Map();
  let currentTime = 0;

  measures.forEach((measure, measureIndex) => {
    let trebleTime = currentTime;
    let bassTime = currentTime;

    measure.forEach(note => {
      noteById.set(note.id, note);
      const noteTime = note.clef === 'treble' ? trebleTime : bassTime;
      const noteDuration = DURATION_TO_BEATS[note.duration] || 1;

      noteDetails.set(note.id, {
        time: noteTime,
        duration: noteDuration,
        measure: measureIndex,
        clef: note.clef,
        name: note.name
      });

      if (note.clef === 'treble') {
        trebleTime += noteDuration;
      } else {
        bassTime += noteDuration;
      }
    });

    const beatsPerMeasure = pianoState.timeSignature.numerator;
    currentTime += beatsPerMeasure;
  });

  // Process ties. Each tied pair stores type:'tie' on both notes, with
  // startNoteId/endNoteId identifying the pair. Chain starts are notes
  // where note.id === note.tie.startNoteId and not already part of a chain.
  measures.flat().forEach(note => {
    if (
      note.tie?.type === 'tie' &&
      note.id === note.tie.startNoteId &&
      !tieMap.has(note.id)
    ) {
      const startDetails = noteDetails.get(note.id);
      if (!startDetails) return;

      let totalDuration = startDetails.duration;
      let currentNote = note;
      const chainNoteIds = [];

      // Follow the chain: each end note may itself be the start of the next segment
      while (currentNote.tie?.type === 'tie' && currentNote.tie.endNoteId) {
        const endId = currentNote.tie.endNoteId;
        const endNote = noteById.get(endId);
        const endDetails = noteDetails.get(endId);

        if (!endNote || !endDetails) break;

        totalDuration += endDetails.duration;
        chainNoteIds.push(endId);

        if (endNote.tie?.type === 'tie' && endNote.id === endNote.tie.startNoteId) {
          currentNote = endNote;
        } else {
          break;
        }
      }

      tieMap.set(note.id, {
        isStart: true,
        totalDuration: totalDuration,
      });

      // Mark all subsequent notes in the chain — they should not retrigger audio
      chainNoteIds.forEach(id => {
        tieMap.set(id, {
          isEnd: true,
          startNoteId: note.id,
        });
      });
    }
  });

  return tieMap;
}

// ===================================================================
// Core Scheduling Logic
// ===================================================================

/**
 * Schedules all notes for playback or export
 * @param {Object} options - Configuration object
 * @param {Array} options.measures - Array of measures
 * @param {number} options.bpm - Tempo in beats per minute
 * @param {Object} options.sampler - Tone.Sampler instance
 * @param {Object} options.envelope - Envelope control instance
 * @param {Function} options.scheduleCallback - Function to call for each note
 * @returns {number} Total duration in seconds
 */
export function scheduleAllNotes({
  measures,
  bpm,
  sampler,
  envelope,
  scheduleCallback
}) {
  const secondsPerBeat = 60 / bpm;
  const beatsPerMeasure = pianoState.timeSignature.numerator;
  const tieMap = buildTieMap(measures);
  
  let currentTransportTime = 0;
  let totalNotesScheduled = 0;
  let maxEndTime = 0;

  console\.log\(`[^a-zA-Z0-9`$]+ ?Scheduling ${measures.length} measures at ${bpm} BPM`);
  console.log(`Seconds per beat: ${secondsPerBeat}, Beats per measure: ${beatsPerMeasure}`);

  measures.forEach((measure, measureIndex) => {
    let trebleMeasureOffset = 0;
    let bassMeasureOffset = 0;

    const trebleNotes = measure.filter((n) => n.clef === "treble");
    const bassNotes = measure.filter((n) => n.clef === "bass");

    // Schedule treble notes
    trebleNotes.forEach((note) => {
      const tieInfo = tieMap.get(note.id);
      const noteStartTime = currentTransportTime + trebleMeasureOffset * secondsPerBeat;
      const beatDuration = scheduleNote({
        note,
        noteStartTime,
        secondsPerBeat,
        sampler,
        envelope,
        tieInfo,
        scheduleCallback
      });
      
      trebleMeasureOffset += beatDuration;
      totalNotesScheduled++;
      
      const noteEndTime = noteStartTime + beatDuration * secondsPerBeat;
      if (noteEndTime > maxEndTime) {
        maxEndTime = noteEndTime;
      }
    });

    // Schedule bass notes
    bassNotes.forEach((note) => {
      const tieInfo = tieMap.get(note.id);
      const noteStartTime = currentTransportTime + bassMeasureOffset * secondsPerBeat;
      const beatDuration = scheduleNote({
        note,
        noteStartTime,
        secondsPerBeat,
        sampler,
        envelope,
        tieInfo,
        scheduleCallback
      });
      
      bassMeasureOffset += beatDuration;
      totalNotesScheduled++;
      
      const noteEndTime = noteStartTime + beatDuration * secondsPerBeat;
      if (noteEndTime > maxEndTime) {
        maxEndTime = noteEndTime;
      }
    });

    currentTransportTime += beatsPerMeasure * secondsPerBeat;
  });

  console\.log\(`[^a-zA-Z0-9`$]+ ?Scheduled ${totalNotesScheduled} notes, duration: ${maxEndTime.toFixed(3)}s`);
  
  return maxEndTime;
}

/**
 * Schedules a single note
 * @param {Object} options - Configuration object
 * @returns {number} Beat duration of the note
 */
function scheduleNote({
  note,
  noteStartTime,
  secondsPerBeat,
  sampler,
  envelope,
  tieInfo,
  scheduleCallback
}) {
  const beatDuration = DURATION_TO_BEATS[note.duration] || 1;
  const noteDurationInSeconds = beatDuration * secondsPerBeat;

  if (note.isRest) {
    return beatDuration;
  }

  const notesToPlay = note.name
    .replace(/[()]/g, "")
    .split(" ")
    .filter(Boolean);

  // Get the performed duration from the note (defaults to 0.85 if not set)
  const performedDuration = note.performedDuration || pianoState.staccatoTime || 0.85;
  
  // Get the velocity from the note (defaults to 100 if not set)
  const velocity = note.velocity || pianoState.velocity || 100;
  const normalizedVelocity = velocity / 127;

  // For ties: only trigger audio on the first note, sustain for full tied duration
  const shouldTriggerAudio = !tieInfo || !tieInfo.isEnd || tieInfo.isChainStart;
  
  if (!shouldTriggerAudio) {
    // This is a tied note that shouldn't trigger new audio
    return beatDuration;
  }

  // Calculate audio duration based on performed duration
  let audioDurationInSeconds;
  
  if (tieInfo && tieInfo.totalDuration) {
    // For tied notes, sustain for the full tied duration
    audioDurationInSeconds = tieInfo.totalDuration * secondsPerBeat;
  } else {
    // For regular notes, use performedDuration
    audioDurationInSeconds = noteDurationInSeconds * performedDuration;
  }

  // Call the schedule callback (different for live playback vs export)
  scheduleCallback({
    notesToPlay,
    noteStartTime,
    audioDurationInSeconds,
    velocity: normalizedVelocity,
    sampler,
    envelope
  });

  return beatDuration;
}

// ===================================================================
// Export Utilities
// ===================================================================

/**
 * Calculate the total duration needed for export (including reverb tail)
 */
export function calculateExportDuration(measures, bpm, reverbTailPadding = 3) {
  const secondsPerBeat = 60 / bpm;
  const beatsPerMeasure = pianoState.timeSignature.numerator;
  const totalBeats = measures.length * beatsPerMeasure;
  const scoreDuration = totalBeats * secondsPerBeat;
  
  return scoreDuration + reverbTailPadding;
}