// scorePlayback.js

// ===================================================================
// Imports
// ===================================================================

import { pianoState } from "../core/appState.js";
import audioManager, { startSpectrumIfReady } from "../core/audioManager.js";
import { NOTES_BY_NAME } from "../core/note-data.js";
import { trigger } from "../instrument/playbackHelpers.js";
import { stopSpectrumVisualization } from "../ui/spectrum.js";
import { updateNowPlayingDisplay } from "../ui/uiHelpers.js";
import {
  addPlaybackHighlight,
  clearAllHighlights,
  setVexFlowNoteStyle,
} from "./scoreHighlighter.js";
import { getVexflowIndexByNoteId, safeRedraw, scrollToMeasure } from "./scoreRenderer.js";
import { getMeasures } from "./scoreWriter.js";
import { initMidiWhenReady } from "../instrument/midi-controller.js";

// ===================================================================
// Constants
// ===================================================================

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

const PLAYBACK_HIGHLIGHT_COLOR = "#76B595";

// ===================================================================
// Internal State for Playback
// ===================================================================

let lastScrolledMeasureIndex = -1;
let currentPlayingVexFlowNotes = new Set();

// ===================================================================
// Tie Analysis Functions (simplified - only for audio sustain)
// ===================================================================

/**
 * Builds a simple map of tie relationships for audio sustain
 * @param {Array} measures - All measures in the score
 * @returns {Map} noteId -> tieInfo object
 */
function buildTieMap(measures) {
  const tieMap = new Map();
  
  // Build note details map first
  const noteDetails = new Map();
  let currentTime = 0;
  
  measures.forEach((measure, measureIndex) => {
    let trebleTime = currentTime;
    let bassTime = currentTime;
    
    measure.forEach(note => {
      const noteTime = note.clef === 'treble' ? trebleTime : bassTime;
      const beatDuration = DURATION_TO_BEATS[note.duration] || 0;
      
      noteDetails.set(note.id, {
        note,
        measureIndex,
        startTime: noteTime,
        duration: beatDuration
      });
      
      if (note.clef === 'treble') {
        trebleTime += beatDuration;
      } else {
        bassTime += beatDuration;
      }
    });
    
    currentTime += pianoState.timeSignature.numerator;
  });
  
  // Collect tie relationships (only for audio sustain)
  measures.forEach((measure, measureIndex) => {
    measure.forEach(note => {
      if (note.tie && note.tie.type === 'tie' && note.tie.startNoteId && note.tie.endNoteId) {
        const startId = note.tie.startNoteId;
        const endId = note.tie.endNoteId;
        
        if (!tieMap.has(startId)) {
          tieMap.set(startId, { isStart: false, isEnd: false });
        }
        if (!tieMap.has(endId)) {
          tieMap.set(endId, { isStart: false, isEnd: false });
        }
        
        const startInfo = tieMap.get(startId);
        startInfo.isStart = true;
        startInfo.endNoteId = endId;
        
        const endInfo = tieMap.get(endId);
        endInfo.isEnd = true;
        endInfo.startNoteId = startId;
      }
    });
  });
  
  // Calculate total durations for tied note chains
  tieMap.forEach((tieInfo, noteId) => {
    if (tieInfo.isStart && !tieInfo.totalDuration) {
      const chain = [];
      let currentNoteId = noteId;
      
      while (currentNoteId && tieMap.has(currentNoteId)) {
        const currentTieInfo = tieMap.get(currentNoteId);
        const noteDetail = noteDetails.get(currentNoteId);
        if (noteDetail) {
          chain.push({
            noteId: currentNoteId,
            duration: noteDetail.duration,
            note: noteDetail.note
          });
        }
        
        currentNoteId = currentTieInfo.endNoteId;
        if (!currentNoteId || chain.some(item => item.noteId === currentNoteId)) {
          break;
        }
      }
      
      const totalDuration = chain.reduce((sum, item) => sum + item.duration, 0);
      
      chain.forEach(item => {
        const info = tieMap.get(item.noteId);
        if (info) {
          info.totalDuration = totalDuration;
          info.chainLength = chain.length;
          info.isChainStart = item.noteId === noteId;
        }
      });
    }
  });
  
  return tieMap;
}

// ===================================================================
// Playback Functions
// ===================================================================

/**
 * Schedules individual note events using performedDuration and velocity from note data
 */
function scheduleNoteEvents(
  note,
  measureIndex,
  noteId,
  currentTransportTime,
  clefOffset,
  secondsPerBeat,
  tieInfo = null
) {
  const beatDuration = DURATION_TO_BEATS[note.duration];

  if (beatDuration === undefined) {
    console.error(`Unknown duration: ${note.duration}. Cannot schedule note.`);
    return 0;
  }

  const noteDurationInSeconds = beatDuration * secondsPerBeat;
  const noteStartTime = currentTransportTime + clefOffset;
  const noteKey = `${measureIndex}-${note.clef}-${noteId}`;

  if (!note.isRest) {
    const notesToPlay = note.name
      .replace(/[()]/g, "")
      .split(" ")
      .filter(Boolean);

    // Get the performed duration from the note (defaults to 0.75 if not set)
    const performedDuration = note.performedDuration || pianoState.staccatoTime || 0.75;
    
    // Get the velocity from the note (defaults to 100 if not set)
    const velocity = note.velocity || pianoState.velocity || 100;

    // For ties: only trigger audio on the first note, sustain for full tied duration
    const shouldTriggerAudio = !tieInfo || !tieInfo.isEnd || tieInfo.isChainStart;
    
    if (shouldTriggerAudio) {
      // Calculate audio duration based on performed duration
      let audioDurationInSeconds;
      
      if (tieInfo && tieInfo.totalDuration) {
        // For tied notes, sustain for the full tied duration
        audioDurationInSeconds = tieInfo.totalDuration * secondsPerBeat;
      } else {
        // For regular notes, use performedDuration (can exceed 1.0 for sustain/pedal effects)
        audioDurationInSeconds = noteDurationInSeconds * performedDuration;
      }

      // Schedule the "note on" event
      Tone.Transport.scheduleOnce((time) => {
        trigger(notesToPlay, true, velocity, true);
        startSpectrumIfReady();

        pianoState.activeDiatonicChords[noteKey] = {
          notes: notesToPlay,
          startTime: performance.now(),
          isPlayback: true
        };
      }, noteStartTime);

      // Schedule piano key highlighting
      Tone.Transport.scheduleOnce((time) => {
        notesToPlay.forEach((n) => {
          const midi = NOTES_BY_NAME[n];
          if (midi && pianoState.noteEls[midi]) {
            Tone.Draw.schedule(() => {
              pianoState.noteEls[midi].classList.add("pressed");
            }, time);
          }
        });
      }, noteStartTime);

      // Schedule the "note off" event
      const noteEndTime = noteStartTime + audioDurationInSeconds;
      
      Tone.Transport.scheduleOnce((time) => {
        trigger(notesToPlay, false, velocity, true);
        delete pianoState.activeDiatonicChords[noteKey];

        setTimeout(() => {
          const hasActiveNotes =
            Object.keys(pianoState.activeNotes).length > 0 ||
            Object.keys(pianoState.activeDiatonicChords).length > 0;

          if (!hasActiveNotes) {
            stopSpectrumVisualization();
          }
        }, 1000);
      }, noteEndTime);

      // Schedule piano key un-highlighting
      Tone.Transport.scheduleOnce((time) => {
        notesToPlay.forEach((n) => {
          const midi = NOTES_BY_NAME[n];
          if (midi && pianoState.noteEls[midi]) {
            Tone.Draw.schedule(() => {
              pianoState.noteEls[midi].classList.remove("pressed");
            }, time);
          }
        });
      }, noteEndTime);
    }

    // Always schedule score highlighting for each note
    Tone.Transport.scheduleOnce((time) => {
      Tone.Draw.schedule(() => {
        addPlaybackHighlight(
          measureIndex,
          note.clef,
          noteId,
          PLAYBACK_HIGHLIGHT_COLOR
        );

        const displayName = note.chordName || note.name;
        // Show tied indicator if applicable
        const indicator = (tieInfo && tieInfo.isEnd && !tieInfo.isChainStart) ? " (tied)" : "";
        updateNowPlayingDisplay(displayName + indicator);
        currentPlayingVexFlowNotes.add(noteKey);
      }, time);
    }, noteStartTime);

    // Schedule visual un-highlighting (based on written duration, not performed duration)
    const visualEndTime = noteStartTime + noteDurationInSeconds;
    Tone.Transport.scheduleOnce((time) => {
      Tone.Draw.schedule(() => {
        pianoState.currentPlaybackNotes.delete(noteKey);

        const vexflowIndex = getVexflowIndexByNoteId()[noteId];
        if (vexflowIndex !== undefined) {
          let styleToRestore;

          if (
            pianoState.currentSelectedNote &&
            pianoState.currentSelectedNote.measureIndex === measureIndex &&
            pianoState.currentSelectedNote.clef === note.clef &&
            pianoState.currentSelectedNote.noteId === noteId
          ) {
            styleToRestore = {
              fillStyle: "#D88368",
              strokeStyle: "#D88368",
              shadowColor: null,
              shadowBlur: 0,
            };
          } else if (measureIndex === pianoState.currentSelectedMeasure) {
            styleToRestore = {
              fillStyle: "#76B595",
              strokeStyle: "#76B595",
              shadowColor: null,
              shadowBlur: 0,
            };
          } else {
            styleToRestore = {
              fillStyle: "#000000",
              strokeStyle: "#000000",
              shadowColor: null,
              shadowBlur: 0,
            };
          }

          setVexFlowNoteStyle(measureIndex, note.clef, vexflowIndex, styleToRestore);
        }

        currentPlayingVexFlowNotes.delete(noteKey);
      }, time);
    }, visualEndTime);
  }

  return noteDurationInSeconds;
}

/**
 * Schedules the entire score for playback using note.performedDuration and note.velocity
 */
export function playScore(measures, bpm = pianoState.tempo) {
  if (!audioManager.isAudioReady()) {
    console.warn("Sampler is not ready. Cannot play score.");
    return;
  } else if (Tone.Transport.state === "started") {
    console.warn("Score is already playing.");
    return;
  }

  // Stop any previous playback and clear the transport schedule
  Tone.Transport.stop();
  Tone.Transport.cancel();
  Tone.Transport.position = 0;
  lastScrolledMeasureIndex = -1;

  // Clear the set of currently playing notes for a new playback session
  currentPlayingVexFlowNotes.clear();
  pianoState.currentPlaybackNotes.clear();

  // Clear any existing playback notes from activeDiatonicChords
  Object.keys(pianoState.activeDiatonicChords).forEach(key => {
    if (pianoState.activeDiatonicChords[key].isPlayback) {
      delete pianoState.activeDiatonicChords[key];
    }
  });

  clearAllHighlights();
  startSpectrumIfReady();

  // Build tie map (only for audio sustain, not articulation)
  const tieMap = buildTieMap(measures);
  console.log("Tie map built:", tieMap);

  // Set the tempo for the playback
  Tone.Transport.bpm.value = bpm;
  let maxEndTime = 0;

  // Iterate through each measure to schedule all notes and visual feedback
  let currentTransportTime = 0;
  const beatsPerMeasure = pianoState.timeSignature.numerator;
  const secondsPerBeat = 60 / bpm;

  measures.forEach((measure, measureIndex) => {
    // Schedule scroll event for the beginning of each measure
    Tone.Transport.scheduleOnce((time) => {
      if (measureIndex !== lastScrolledMeasureIndex) {
        Tone.Draw.schedule(() => {
          scrollToMeasure(measureIndex);
          lastScrolledMeasureIndex = measureIndex;
        }, time);
      }
    }, currentTransportTime);

    let trebleMeasureOffset = 0;
    let bassMeasureOffset = 0;

    const trebleNotes = measure.filter((n) => n.clef === "treble");
    const bassNotes = measure.filter((n) => n.clef === "bass");

    // Schedule Treble Notes
    trebleNotes.forEach((note) => {
      const tieInfo = tieMap.get(note.id);
      trebleMeasureOffset += scheduleNoteEvents(
        note,
        measureIndex,
        note.id,
        currentTransportTime,
        trebleMeasureOffset,
        secondsPerBeat,
        tieInfo
      );
    });

    // Schedule Bass Notes
    bassNotes.forEach((note) => {
      const tieInfo = tieMap.get(note.id);
      bassMeasureOffset += scheduleNoteEvents(
        note,
        measureIndex,
        note.id,
        currentTransportTime,
        bassMeasureOffset,
        secondsPerBeat,
        tieInfo
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
    }, maxEndTime + 0.1);
  }

  console.log("Score playback scheduled using note performedDuration and velocity properties.");
}

/**
 * Stops Tone.js transport and clears all scheduled events.
 */
export function stopPlayback() {
  Tone.Transport.stop();
  Tone.Transport.cancel();
  lastScrolledMeasureIndex = -1;

  // Release all currently playing notes on the sampler
  if (audioManager.isAudioReady() && pianoState.sampler) {
    if (pianoState.sampler.releaseAll) {
      pianoState.sampler.releaseAll();
    } else {
      for (let midi = 21; midi <= 108; midi++) {
        try {
          pianoState.sampler.triggerRelease(
            Tone.Frequency(midi, "midi").toNote()
          );
        } catch (e) {
          // Ignore errors for notes that aren't currently playing
        }
      }
    }
  }

  // Also release envelope if it exists
  if (pianoState.envelope) {
    pianoState.envelope.triggerRelease();
  }

  // Clear any visual "pressed" states from the piano keys
  Object.values(pianoState.noteEls).forEach((el) => {
    el.classList.remove("pressed");
  });

  // Mark playback notes for cleanup after release time
  const playbackNotesToClear = [];
  Object.keys(pianoState.activeDiatonicChords).forEach(key => {
    if (pianoState.activeDiatonicChords[key].isPlayback) {
      playbackNotesToClear.push(key);
    }
  });

  // Schedule cleanup of playback notes after release time
  if (playbackNotesToClear.length > 0) {
    setTimeout(() => {
      playbackNotesToClear.forEach(key => {
        delete pianoState.activeDiatonicChords[key];
      });

      const hasActiveNotes =
        Object.keys(pianoState.activeNotes).length > 0 ||
        Object.keys(pianoState.activeDiatonicChords).length > 0;

      if (!hasActiveNotes) {
        stopSpectrumVisualization();
      }
    }, 1000);
  } else {
    stopSpectrumVisualization();
  }

  console.log("Playback stopped.");
  clearAllHighlights();
  safeRedraw();
}

export function initializePlayer() {
  // Play Score Button
  document
    .getElementById("play-score-btn")
    ?.addEventListener("click", async (e) => {
      e.preventDefault();
      e.preventDefault();
      document.getElementById("instrument")?.focus();
      
      const playAction = () => {
        playScore(getMeasures());
        Tone.Transport.start();
      };

      const audioStarted = await audioManager.unlockAndExecute(playAction);
      if (!audioStarted) {
        console.warn("Could not start audio for playback. Please ensure user interaction has occurred.");
      }
    });

  // Stop Playback Button
  document.getElementById("stop-score-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.preventDefault();
    document.getElementById("instrument")?.focus();
    stopPlayback();
  });

  // Connect MIDI Button
  document
    .getElementById("connect-midi-btn")
    ?.addEventListener("click", (e) => {
      e.preventDefault();
      e.preventDefault();
      document.getElementById("instrument")?.focus();
      audioManager.unlockAndExecute(() => { 
        console.log("MIDI connection audio unlocked.");
        startSpectrumIfReady();
        initMidiWhenReady();
      });
    });
}