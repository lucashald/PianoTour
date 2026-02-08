// playAlongController.js
// Core play-along engine: state machine, note matching, scoring, flow control
// Supports two modes:
//   - "wait"  : Pauses at each event until the user plays the correct notes.
//   - "timed" : Plays the score via Tone.Transport; user plays along in real-time
//               and is scored on timing accuracy (perfect / good / early / late / missed).

import { pianoState } from "../core/appState.js";
import { NOTES_BY_MIDI, NOTES_BY_NAME } from "../core/note-data.js";
import { trigger } from "../instrument/playbackHelpers.js";
import audioManager from "../core/audioManager.js";
import { getMeasures } from "./scoreWriter.js";
import { scrollToMeasure } from "./scoreRenderer.js";
import {
  addExpectedHighlight,
  addCorrectHighlight,
  setVexFlowNoteStyle,
  resetAllNoteStyles,
  resetNoteStyle,
} from "./scoreHighlighter.js";
import {
  showPlayAlongHUD,
  hidePlayAlongHUD,
  updateHUD,
  showCompletionModal,
  showTimingRating,
  showCountIn,
  hideCountIn,
} from "../ui/playAlongUI.js";
import {
  setMidiCallbacks,
  handleMidiNoteOn as defaultMidiNoteOn,
  handleMidiNoteOff as defaultMidiNoteOff,
} from "../instrument/midi-controller.js";

// ===================================================================
// Constants
// ===================================================================

const BEAT_VALUES = {
  w: 4, h: 2, "h.": 3, q: 1, "q.": 1.5,
  "8": 0.5, "8.": 0.75, "16": 0.25, "16.": 0.375,
  "32": 0.125, "32.": 0.1875,
};

const STATES = {
  IDLE: "idle",
  COUNTING_IN: "countingIn",
  WAITING_FOR_INPUT: "waitingForInput",
  ADVANCING: "advancing",
  PLAYING: "playing",        // Timed mode: transport running, accepting input
  COMPLETE: "complete",
};

const ADVANCE_DELAY_MS = 150; // Brief visual feedback delay after correct match (wait mode)

// Timing windows for timed mode (in seconds, relative to the scheduled beat)
const TIMING = {
  PERFECT: 0.12,  // +/- 120 ms
  GOOD: 0.30,     // +/- 300 ms
  WINDOW: 0.60,   // +/- 600 ms – outside this is a miss
};

// Count-in: number of beats to count before the session starts
const COUNT_IN_BEATS = 4;

// ===================================================================
// Internal State
// ===================================================================

let savedMidiCallbacks = null;
let advanceTimer = null;
let countInTimer = null;

// Timed mode bookkeeping
let timedEventSchedule = [];   // Array of { event, scheduledTime (seconds) }
let timedCurrentIndex = 0;     // Index into timedEventSchedule for the next expected event
let transportStartWallTime = 0; // performance.now() when Transport started

// ===================================================================
// Note Sequence Building
// ===================================================================

/**
 * Parse note names from a score note's name field.
 * Handles both single notes ("C4") and chords ("(C4 E4 G4)").
 */
function parseNoteNames(noteName) {
  if (!noteName) return [];
  const cleaned = noteName.replace(/[()]/g, "").trim();
  if (!cleaned) return [];
  return cleaned.split(/\s+/).filter(Boolean);
}

/**
 * Convert a note name to its MIDI number using NOTES_BY_NAME lookup.
 */
function noteNameToMidi(name) {
  const midi = NOTES_BY_NAME[name];
  return midi !== undefined ? midi : null;
}

/**
 * Build a flat sequence of individual note entries from the score measures.
 */
function buildNoteSequence(measures) {
  const sequence = [];
  const beatsPerMeasure = pianoState.timeSignature.numerator;
  let absoluteBeat = 0;

  measures.forEach((measure, measureIndex) => {
    let trebleBeat = absoluteBeat;
    let bassBeat = absoluteBeat;

    const trebleNotes = measure.filter((n) => n.clef === "treble");
    const bassNotes = measure.filter((n) => n.clef === "bass");

    trebleNotes.forEach((note) => {
      const beats = BEAT_VALUES[note.duration] || 1;
      const pitches = parseNoteNames(note.name);
      const midiNumbers = pitches.map(noteNameToMidi).filter((m) => m !== null);
      const isTiedEnd = note.tie?.type === "tie" && note.tie?.startNoteId && note.id === note.tie?.endNoteId;

      sequence.push({
        measureIndex,
        clef: "treble",
        noteId: note.id,
        noteName: note.name,
        chordName: note.chordName || note.name,
        pitches,
        midiNumbers,
        duration: note.duration,
        beats,
        beatPosition: trebleBeat,
        isRest: !!note.isRest,
        isChord: pitches.length > 1,
        isTiedEnd,
        velocity: note.velocity || 100,
      });

      trebleBeat += beats;
    });

    bassNotes.forEach((note) => {
      const beats = BEAT_VALUES[note.duration] || 1;
      const pitches = parseNoteNames(note.name);
      const midiNumbers = pitches.map(noteNameToMidi).filter((m) => m !== null);
      const isTiedEnd = note.tie?.type === "tie" && note.tie?.startNoteId && note.id === note.tie?.endNoteId;

      sequence.push({
        measureIndex,
        clef: "bass",
        noteId: note.id,
        noteName: note.name,
        chordName: note.chordName || note.name,
        pitches,
        midiNumbers,
        duration: note.duration,
        beats,
        beatPosition: bassBeat,
        isRest: !!note.isRest,
        isChord: pitches.length > 1,
        isTiedEnd,
        velocity: note.velocity || 100,
      });

      bassBeat += beats;
    });

    absoluteBeat += beatsPerMeasure;
  });

  sequence.sort((a, b) => a.beatPosition - b.beatPosition || (a.clef === "treble" ? -1 : 1));

  return sequence;
}

/**
 * Group notes at the same beat position into simultaneous events.
 */
function groupSimultaneousEvents(noteSequence) {
  const events = [];
  let i = 0;

  while (i < noteSequence.length) {
    const current = noteSequence[i];
    const group = {
      beatPosition: current.beatPosition,
      measureIndex: current.measureIndex,
      trebleNotes: [],
      bassNotes: [],
      allMidiNumbers: new Set(),
      requiredMidiNumbers: new Set(),
      matchedMidiNumbers: new Set(),
      isRest: true,
      isTiedEnd: true,
      displayNames: [],
    };

    while (i < noteSequence.length && noteSequence[i].beatPosition === current.beatPosition) {
      const note = noteSequence[i];

      if (note.clef === "treble") {
        group.trebleNotes.push(note);
      } else {
        group.bassNotes.push(note);
      }

      if (!note.isRest) {
        group.isRest = false;
        note.midiNumbers.forEach((m) => group.allMidiNumbers.add(m));
        group.displayNames.push(note.chordName || note.noteName);
      }

      if (!note.isTiedEnd) {
        group.isTiedEnd = false;
      }

      i++;
    }

    // Determine required MIDI numbers based on clef filter settings
    const settings = pianoState.playAlong.settings;

    if (!group.isRest && !group.isTiedEnd) {
      if (settings.trebleOnly) {
        group.trebleNotes.forEach((n) => {
          if (!n.isRest && !n.isTiedEnd) n.midiNumbers.forEach((m) => group.requiredMidiNumbers.add(m));
        });
      } else if (settings.bassOnly) {
        group.bassNotes.forEach((n) => {
          if (!n.isRest && !n.isTiedEnd) n.midiNumbers.forEach((m) => group.requiredMidiNumbers.add(m));
        });
      } else {
        [...group.trebleNotes, ...group.bassNotes].forEach((n) => {
          if (!n.isRest && !n.isTiedEnd) n.midiNumbers.forEach((m) => group.requiredMidiNumbers.add(m));
        });
      }
    }

    events.push(group);
  }

  return events;
}

// ===================================================================
// State Machine (shared helpers)
// ===================================================================

function getCurrentEvent() {
  const pa = pianoState.playAlong;
  if (pa.currentPosition.eventIndex >= pa.noteSequence.length) return null;
  return pa.noteSequence[pa.currentPosition.eventIndex];
}

function isEventFullyMatched(event) {
  if (event.requiredMidiNumbers.size === 0) return true;
  for (const midi of event.requiredMidiNumbers) {
    if (!event.matchedMidiNumbers.has(midi)) return false;
  }
  return true;
}

// ===================================================================
// Visual Helpers
// ===================================================================

function highlightExpectedNotes(event) {
  if (!event) return;

  const allNotes = [...event.trebleNotes, ...event.bassNotes];
  allNotes.forEach((note) => {
    if (!note.isRest && !note.isTiedEnd) {
      addExpectedHighlight(note.measureIndex, note.clef, note.noteId);
    }
  });

  event.requiredMidiNumbers.forEach((midi) => {
    const keyEl = pianoState.noteEls[midi];
    if (keyEl) {
      keyEl.classList.add("expected");
    }
  });

  if (event.measureIndex !== undefined) {
    scrollToMeasure(event.measureIndex);
  }
}

function clearExpectedKeyHighlights() {
  Object.values(pianoState.noteEls).forEach((el) => {
    el.classList.remove("expected", "correct-flash", "incorrect-flash");
  });
}

function flashCorrectKey(midiNumber) {
  const keyEl = pianoState.noteEls[midiNumber];
  if (keyEl) {
    keyEl.classList.remove("expected");
    keyEl.classList.add("correct-flash");
    setTimeout(() => keyEl.classList.remove("correct-flash"), 300);
  }
}

function flashIncorrectKey(midiNumber) {
  const keyEl = pianoState.noteEls[midiNumber];
  if (keyEl) {
    keyEl.classList.add("incorrect-flash");
    setTimeout(() => keyEl.classList.remove("incorrect-flash"), 400);
  }
}

// ===================================================================
// Scoring Helpers
// ===================================================================

function onCorrectNote(midiNumber) {
  const pa = pianoState.playAlong;
  pa.stats.correct++;
  pa.stats.streak++;
  if (pa.stats.streak > pa.stats.bestStreak) {
    pa.stats.bestStreak = pa.stats.streak;
  }

  flashCorrectKey(midiNumber);
  updateHUD();
}

function onIncorrectNote(midiNumber) {
  const pa = pianoState.playAlong;
  pa.stats.incorrect++;
  pa.stats.streak = 0;

  flashIncorrectKey(midiNumber);
  updateHUD();
}

// ===================================================================
// Wait-Mode Logic
// ===================================================================

function advanceToNextEvent() {
  const pa = pianoState.playAlong;
  const currentEvent = getCurrentEvent();

  if (currentEvent) {
    const allNotes = [...currentEvent.trebleNotes, ...currentEvent.bassNotes];
    allNotes.forEach((note) => {
      if (!note.isRest && !note.isTiedEnd) {
        addCorrectHighlight(note.measureIndex, note.clef, note.noteId);
      }
    });

    if (pa.settings.playAccompaniment) {
      playAccompanimentNotes(currentEvent);
    }
  }

  clearExpectedKeyHighlights();

  pa.state = STATES.ADVANCING;

  if (advanceTimer) clearTimeout(advanceTimer);
  advanceTimer = setTimeout(() => {
    pa.currentPosition.eventIndex++;
    updateHUD();

    skipAutoAdvanceEvents();

    const nextEvent = getCurrentEvent();
    if (nextEvent) {
      pa.state = STATES.WAITING_FOR_INPUT;
      highlightExpectedNotes(nextEvent);
    } else {
      completePlayAlong();
    }
  }, ADVANCE_DELAY_MS);
}

function skipAutoAdvanceEvents() {
  const pa = pianoState.playAlong;

  while (pa.currentPosition.eventIndex < pa.noteSequence.length) {
    const event = pa.noteSequence[pa.currentPosition.eventIndex];
    if (event.isRest || event.isTiedEnd || event.requiredMidiNumbers.size === 0) {
      if (pa.settings.playAccompaniment && !event.isRest) {
        playAccompanimentNotes(event);
      }
      pa.currentPosition.eventIndex++;
    } else {
      break;
    }
  }
}

function playAccompanimentNotes(event) {
  const settings = pianoState.playAlong.settings;
  let accompNotes = [];

  if (settings.trebleOnly) {
    event.bassNotes.forEach((n) => {
      if (!n.isRest) accompNotes.push(...n.pitches);
    });
  } else if (settings.bassOnly) {
    event.trebleNotes.forEach((n) => {
      if (!n.isRest) accompNotes.push(...n.pitches);
    });
  }

  if (accompNotes.length > 0) {
    trigger(accompNotes, true, 70, true);
    setTimeout(() => {
      trigger(accompNotes, false, 70, true);
    }, 500);
  }
}

// ===================================================================
// Timed-Mode Logic
// ===================================================================

/**
 * Build the timed-mode event schedule and pre-schedule Transport events.
 * Each playable event gets a scheduledTime (in Transport seconds).
 * We also schedule audio playback for accompaniment notes.
 */
function buildTimedSchedule(events, measures, bpm, countInOffsetSec = 0) {
  const secondsPerBeat = 60 / bpm;
  const beatsPerMeasure = pianoState.timeSignature.numerator;
  timedEventSchedule = [];
  timedCurrentIndex = 0;

  const settings = pianoState.playAlong.settings;

  // Build schedule from events (which already have beatPosition)
  // Offset all times by the count-in duration so the score starts after the count-in
  events.forEach((event, idx) => {
    const scheduledTime = event.beatPosition * secondsPerBeat + countInOffsetSec;

    // We only track playable (non-rest, non-tied, has required notes) events in the schedule
    if (!event.isRest && !event.isTiedEnd && event.requiredMidiNumbers.size > 0) {
      timedEventSchedule.push({
        event,
        eventIndex: idx,
        scheduledTime,
        resolved: false,   // Has user input been evaluated?
        rating: null,       // 'perfect' | 'good' | 'early' | 'late' | 'missed'
      });
    }
  });

  // Schedule the full score audio playback via Tone.Transport
  // This plays ALL notes in the score (both clefs), regardless of clef filter
  // Offset by count-in so the music starts after the count-in beats
  let currentTransportTime = countInOffsetSec;

  measures.forEach((measure, measureIndex) => {
    // Schedule scroll
    Tone.Transport.scheduleOnce((time) => {
      Tone.Draw.schedule(() => {
        scrollToMeasure(measureIndex);
      }, time);
    }, currentTransportTime);

    let trebleOffset = 0;
    let bassOffset = 0;

    const trebleNotes = measure.filter((n) => n.clef === "treble");
    const bassNotes = measure.filter((n) => n.clef === "bass");

    // Helper to schedule a single note's audio
    const scheduleNote = (note, clefOffset) => {
      const beatDuration = BEAT_VALUES[note.duration] || 1;
      const noteDurationSec = beatDuration * secondsPerBeat;
      const noteStartTime = currentTransportTime + clefOffset;

      if (!note.isRest) {
        const notesToPlay = note.name.replace(/[()]/g, "").split(" ").filter(Boolean);
        const velocity = note.velocity || pianoState.velocity || 100;
        const performedDuration = note.performedDuration || pianoState.staccatoTime || 0.75;
        const audioDurationSec = noteDurationSec * performedDuration;

        // Determine if this note is part of the "accompaniment" (non-required clef)
        // In timed mode, always play non-required notes at lower velocity
        const isAccompaniment =
          (settings.trebleOnly && note.clef === "bass") ||
          (settings.bassOnly && note.clef === "treble");

        const playVelocity = isAccompaniment ? Math.round(velocity * 0.6) : velocity;

        // Note On
        Tone.Transport.scheduleOnce((time) => {
          trigger(notesToPlay, true, playVelocity, true);
        }, noteStartTime);

        // Score highlight
        Tone.Transport.scheduleOnce((time) => {
          Tone.Draw.schedule(() => {
            addExpectedHighlight(measureIndex, note.clef, note.id);
          }, time);
        }, noteStartTime);

        // Note Off
        Tone.Transport.scheduleOnce((time) => {
          trigger(notesToPlay, false, playVelocity, true);
        }, noteStartTime + audioDurationSec);

        // Clear score highlight
        Tone.Transport.scheduleOnce((time) => {
          Tone.Draw.schedule(() => {
            // We'll clear highlights in batch via correctHighlight on match
          }, time);
        }, noteStartTime + noteDurationSec);

        // Highlight expected piano keys for required notes
        // Find if any of these notes are in a required event at this beat position
        const beatPos = (currentTransportTime + clefOffset) / secondsPerBeat;
        const schedEntry = timedEventSchedule.find(
          (s) => Math.abs(s.scheduledTime - (currentTransportTime + clefOffset)) < 0.001 && !s.resolved
        );

        if (schedEntry) {
          Tone.Transport.scheduleOnce((time) => {
            Tone.Draw.schedule(() => {
              // Highlight expected keys
              schedEntry.event.requiredMidiNumbers.forEach((midi) => {
                const keyEl = pianoState.noteEls[midi];
                if (keyEl) keyEl.classList.add("expected");
              });
              // Update HUD expected notes
              pianoState.playAlong.currentPosition.eventIndex = schedEntry.eventIndex;
              updateHUD();
            }, time);
          }, noteStartTime);

          // Schedule miss check after the timing window closes
          Tone.Transport.scheduleOnce((time) => {
            Tone.Draw.schedule(() => {
              checkTimedMiss(schedEntry);
            }, time);
          }, noteStartTime + TIMING.WINDOW + 0.05);
        }
      }

      return noteDurationSec;
    };

    trebleNotes.forEach((note) => {
      trebleOffset += scheduleNote(note, trebleOffset);
    });

    bassNotes.forEach((note) => {
      bassOffset += scheduleNote(note, bassOffset);
    });

    currentTransportTime += beatsPerMeasure * secondsPerBeat;
  });

  // Schedule count-in metronome clicks
  for (let i = 0; i < COUNT_IN_BEATS; i++) {
    const clickTime = i * secondsPerBeat;
    const beatNumber = COUNT_IN_BEATS - i; // 4, 3, 2, 1
    Tone.Transport.scheduleOnce((time) => {
      // Audible click via a short high-pitched trigger
      trigger("C6", true, 60, true);
      setTimeout(() => trigger("C6", false, 60, true), 80);
      Tone.Draw.schedule(() => {
        showCountIn(beatNumber);
      }, time);
    }, clickTime);
  }

  // Hide count-in display when music starts
  Tone.Transport.scheduleOnce((time) => {
    Tone.Draw.schedule(() => {
      hideCountIn();
    }, time);
  }, countInOffsetSec);

  // Schedule completion at the end
  const totalDurationSec = currentTransportTime;
  Tone.Transport.scheduleOnce((time) => {
    Tone.Draw.schedule(() => {
      completePlayAlong();
    }, time);
  }, totalDurationSec + 0.5);
}

/**
 * Check if a timed event was missed (no input within the timing window).
 */
function checkTimedMiss(schedEntry) {
  if (schedEntry.resolved) return; // Already handled

  // Mark as missed
  schedEntry.resolved = true;
  schedEntry.rating = "missed";

  const pa = pianoState.playAlong;
  pa.stats.missed++;
  pa.stats.incorrect++;
  pa.stats.streak = 0;

  // Record timing
  if (!pa.stats.timing) pa.stats.timing = { perfect: 0, good: 0, early: 0, late: 0, missed: 0 };
  pa.stats.timing.missed++;

  // Clear expected key highlights for this event
  schedEntry.event.requiredMidiNumbers.forEach((midi) => {
    const keyEl = pianoState.noteEls[midi];
    if (keyEl) keyEl.classList.remove("expected");
  });

  // Clear expected highlights on the score for all notes in this event
  const allNotes = [...schedEntry.event.trebleNotes, ...schedEntry.event.bassNotes];
  allNotes.forEach((note) => {
    if (!note.isRest && !note.isTiedEnd) {
      resetNoteStyle(note.noteId);
    }
  });

  showTimingRating("missed");
  updateHUD();
}

/**
 * Rate the timing of a user input in timed mode.
 * Returns 'perfect', 'good', 'early', 'late', or null if outside all windows.
 */
function rateTimingAccuracy(inputTimeSec, scheduledTimeSec) {
  const delta = inputTimeSec - scheduledTimeSec; // Negative = early, positive = late
  const absDelta = Math.abs(delta);

  if (absDelta <= TIMING.PERFECT) return "perfect";
  if (absDelta <= TIMING.GOOD) return delta < 0 ? "good" : "good"; // "good" regardless of direction
  if (absDelta <= TIMING.WINDOW) return delta < 0 ? "early" : "late";
  return null; // Outside window
}

/**
 * Get the current Transport time in seconds from wall clock.
 */
function getCurrentTransportTimeSec() {
  if (typeof Tone === "undefined") return 0;
  // Tone.Transport.seconds gives the current position
  return Tone.Transport.seconds;
}

/**
 * Handle note-on in timed mode.
 * Find the nearest unresolved scheduled event and rate timing.
 */
function handleTimedNoteOn(midiNumber, velocity) {
  const pa = pianoState.playAlong;
  if (!pa.active || pa.paused) return;
  if (pa.state === STATES.COUNTING_IN) return; // Ignore input during count-in

  // Play audio feedback
  const noteInfo = NOTES_BY_MIDI[midiNumber];
  if (noteInfo) {
    trigger(noteInfo.name, true, velocity, true);
  }

  const inputTimeSec = getCurrentTransportTimeSec();

  // Search for the best matching unresolved event (closest in time that requires this MIDI note)
  let bestMatch = null;
  let bestDelta = Infinity;

  for (let i = 0; i < timedEventSchedule.length; i++) {
    const entry = timedEventSchedule[i];
    if (entry.resolved) continue;

    // Check if this event requires the played MIDI number
    if (!entry.event.requiredMidiNumbers.has(midiNumber)) continue;

    const delta = Math.abs(inputTimeSec - entry.scheduledTime);
    if (delta < bestDelta && delta <= TIMING.WINDOW) {
      bestDelta = delta;
      bestMatch = entry;
    }
  }

  if (bestMatch) {
    // Match the note within this event
    bestMatch.event.matchedMidiNumbers.add(midiNumber);

    // Check if all required notes for this event are matched
    if (isEventFullyMatched(bestMatch.event)) {
      bestMatch.resolved = true;

      // Rate timing
      const rating = rateTimingAccuracy(inputTimeSec, bestMatch.scheduledTime);
      bestMatch.rating = rating || "late";

      // Update stats
      if (!pa.stats.timing) pa.stats.timing = { perfect: 0, good: 0, early: 0, late: 0, missed: 0 };

      if (rating === "perfect" || rating === "good") {
        pa.stats.correct++;
        pa.stats.streak++;
        if (pa.stats.streak > pa.stats.bestStreak) pa.stats.bestStreak = pa.stats.streak;
        pa.stats.timing[rating]++;
      } else if (rating === "early" || rating === "late") {
        pa.stats.correct++; // Still counts as "hit" but not perfect
        pa.stats.streak++;
        if (pa.stats.streak > pa.stats.bestStreak) pa.stats.bestStreak = pa.stats.streak;
        pa.stats.timing[rating]++;
      } else {
        pa.stats.incorrect++;
        pa.stats.streak = 0;
        pa.stats.timing.late++;
      }

      // Visual feedback
      bestMatch.event.requiredMidiNumbers.forEach((midi) => {
        flashCorrectKey(midi);
        const keyEl = pianoState.noteEls[midi];
        if (keyEl) keyEl.classList.remove("expected");
      });

      // Highlight on score
      const allNotes = [...bestMatch.event.trebleNotes, ...bestMatch.event.bassNotes];
      allNotes.forEach((note) => {
        if (!note.isRest && !note.isTiedEnd) {
          addCorrectHighlight(note.measureIndex, note.clef, note.noteId);
        }
      });

      showTimingRating(bestMatch.rating);
      updateHUD();
    } else {
      // Partial match - flash the key green but don't resolve yet
      flashCorrectKey(midiNumber);
    }
  } else {
    // No matching event found - wrong note
    onIncorrectNote(midiNumber);
  }
}

/**
 * Handle note-off in timed mode.
 */
function handleTimedNoteOff(midiNumber) {
  const noteInfo = NOTES_BY_MIDI[midiNumber];
  if (noteInfo) {
    trigger(noteInfo.name, false, 100, true);
  }
}

// ===================================================================
// Completion
// ===================================================================

function completePlayAlong() {
  const pa = pianoState.playAlong;
  if (pa.state === STATES.COMPLETE) return; // Prevent double-fire

  pa.state = STATES.COMPLETE;

  // In timed mode, stop the Transport
  if (pa.settings.mode === "timed" && typeof Tone !== "undefined") {
    Tone.Transport.stop();
    Tone.Transport.cancel();

    // Release all sampler notes
    if (audioManager.isAudioReady() && pianoState.sampler) {
      if (pianoState.sampler.releaseAll) {
        pianoState.sampler.releaseAll();
      }
    }
  }

  const elapsed = pa.stats.startTime ? (performance.now() - pa.stats.startTime) / 1000 : 0;
  const total = pa.stats.correct + pa.stats.incorrect;
  const accuracy = total > 0 ? Math.round((pa.stats.correct / total) * 100) : 0;

  const results = {
    accuracy,
    correct: pa.stats.correct,
    incorrect: pa.stats.incorrect,
    bestStreak: pa.stats.bestStreak,
    elapsed: Math.round(elapsed),
    totalNotes: pa.stats.totalNotes,
  };

  // Include timing breakdown for timed mode
  if (pa.settings.mode === "timed" && pa.stats.timing) {
    results.timing = { ...pa.stats.timing };
  }

  showCompletionModal(results);

  clearExpectedKeyHighlights();
  resetAllNoteStyles();
}

// ===================================================================
// Input Handling (Wait Mode)
// ===================================================================

/**
 * Handle a note-on event during play-along (wait mode).
 */
export function handleNoteOn(midiNumber, velocity = 100) {
  const pa = pianoState.playAlong;
  if (!pa.active || pa.paused) return;

  // Route to timed mode handler
  if (pa.settings.mode === "timed") {
    handleTimedNoteOn(midiNumber, velocity);
    return;
  }

  // Wait mode
  if (pa.state !== STATES.WAITING_FOR_INPUT) return;

  const noteInfo = NOTES_BY_MIDI[midiNumber];
  if (noteInfo) {
    trigger(noteInfo.name, true, velocity, true);
  }

  pa.activeInputNotes[midiNumber] = {
    timestamp: performance.now(),
    wasUsed: false,
  };

  const currentEvent = getCurrentEvent();
  if (!currentEvent) return;

  if (currentEvent.requiredMidiNumbers.has(midiNumber) && !currentEvent.matchedMidiNumbers.has(midiNumber)) {
    pa.activeInputNotes[midiNumber].wasUsed = true;
    currentEvent.matchedMidiNumbers.add(midiNumber);
    onCorrectNote(midiNumber);

    if (isEventFullyMatched(currentEvent)) {
      advanceToNextEvent();
    }
  } else if (!currentEvent.requiredMidiNumbers.has(midiNumber)) {
    onIncorrectNote(midiNumber);
  }
}

/**
 * Handle a note-off event during play-along.
 */
export function handleNoteOff(midiNumber) {
  const pa = pianoState.playAlong;
  if (!pa.active) return;

  // Route to timed mode handler
  if (pa.settings.mode === "timed") {
    handleTimedNoteOff(midiNumber);
    return;
  }

  const noteInfo = NOTES_BY_MIDI[midiNumber];
  if (noteInfo) {
    trigger(noteInfo.name, false, 100, true);
  }

  delete pa.activeInputNotes[midiNumber];
}

// ===================================================================
// MIDI Callback Wrappers
// ===================================================================

function playAlongMidiNoteOn(midiNoteNumber, velocity, channel) {
  handleNoteOn(midiNoteNumber, velocity);
}

function playAlongMidiNoteOff(midiNoteNumber, velocity, channel) {
  handleNoteOff(midiNoteNumber);
}

// ===================================================================
// Public API: Start / Stop / Pause / Resume / Restart
// ===================================================================

/**
 * Start play-along mode with the current score.
 */
export async function start() {
  const measures = getMeasures();
  if (!measures || measures.length === 0) {
    console.warn("Play-Along: No score loaded.");
    return;
  }

  if (!audioManager.isAudioReady()) {
    console.warn("Play-Along: Audio not ready.");
    const unlocked = await audioManager.unlockAndExecute(() => {});
    if (!unlocked) return;
  }

  const pa = pianoState.playAlong;
  const mode = pa.settings.mode;

  // Build the note sequence
  const rawSequence = buildNoteSequence(measures);
  const events = groupSimultaneousEvents(rawSequence);

  const playableEvents = events.filter((e) => !e.isRest && !e.isTiedEnd && e.requiredMidiNumbers.size > 0);

  pa.noteSequence = events;
  pa.active = true;
  pa.paused = false;
  pa.currentPosition = { measureIndex: 0, eventIndex: 0 };
  pa.activeInputNotes = {};
  pa.stats = {
    correct: 0,
    incorrect: 0,
    missed: 0,
    streak: 0,
    bestStreak: 0,
    startTime: performance.now(),
    totalNotes: playableEvents.length,
  };

  // Add timing stats for timed mode
  if (mode === "timed") {
    pa.stats.timing = { perfect: 0, good: 0, early: 0, late: 0, missed: 0 };
  }

  // Save and swap MIDI callbacks
  savedMidiCallbacks = {
    onNoteOn: defaultMidiNoteOn,
    onNoteOff: defaultMidiNoteOff,
  };
  setMidiCallbacks({
    onNoteOn: playAlongMidiNoteOn,
    onNoteOff: playAlongMidiNoteOff,
  });

  // Stop any existing Transport playback
  if (typeof Tone !== "undefined" && Tone.Transport.state === "started") {
    Tone.Transport.stop();
    Tone.Transport.cancel();
  }

  // Show HUD in live mode
  showPlayAlongHUD(true);
  updateHUD();

  clearExpectedKeyHighlights();
  resetAllNoteStyles();

  if (mode === "timed") {
    // ---- TIMED MODE ----
    pa.state = STATES.COUNTING_IN;

    // Clear Transport and build timed schedule with count-in offset
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = 0;
    Tone.Transport.bpm.value = pianoState.tempo;

    const secondsPerBeat = 60 / pianoState.tempo;
    const countInOffsetSec = COUNT_IN_BEATS * secondsPerBeat;

    buildTimedSchedule(events, measures, pianoState.tempo, countInOffsetSec);

    // Schedule the state transition from COUNTING_IN -> PLAYING
    Tone.Transport.scheduleOnce((time) => {
      Tone.Draw.schedule(() => {
        pa.state = STATES.PLAYING;
      }, time);
    }, countInOffsetSec);

    transportStartWallTime = performance.now();
    Tone.Transport.start();

    console.log(`Play-Along [Timed]: Count-in started, ${pianoState.tempo} BPM, ${playableEvents.length} playable events.`);

  } else {
    // ---- WAIT MODE ----
    pa.state = STATES.COUNTING_IN;

    // Count-in with visual countdown, then start
    const secondsPerBeat = 60 / pianoState.tempo;
    let beat = 0;

    function countInTick() {
      if (beat < COUNT_IN_BEATS) {
        const display = COUNT_IN_BEATS - beat; // 4, 3, 2, 1
        showCountIn(display);
        trigger("C6", true, 60, true);
        setTimeout(() => trigger("C6", false, 60, true), 80);
        beat++;
        countInTimer = setTimeout(countInTick, secondsPerBeat * 1000);
      } else {
        hideCountIn();
        skipAutoAdvanceEvents();

        const firstEvent = getCurrentEvent();
        if (firstEvent) {
          pa.state = STATES.WAITING_FOR_INPUT;
          highlightExpectedNotes(firstEvent);
        } else {
          completePlayAlong();
        }
      }
    }

    countInTick();

    console.log(`Play-Along [Wait]: Count-in started, ${events.length} events (${playableEvents.length} playable).`);
  }
}

/**
 * Stop play-along mode and restore normal operation.
 */
export function stop() {
  const pa = pianoState.playAlong;

  if (advanceTimer) {
    clearTimeout(advanceTimer);
    advanceTimer = null;
  }

  if (countInTimer) {
    clearTimeout(countInTimer);
    countInTimer = null;
  }

  hideCountIn();

  // Stop Transport if in timed mode
  if (pa.settings.mode === "timed" && typeof Tone !== "undefined") {
    Tone.Transport.stop();
    Tone.Transport.cancel();

    if (audioManager.isAudioReady() && pianoState.sampler) {
      if (pianoState.sampler.releaseAll) {
        pianoState.sampler.releaseAll();
      }
    }
  }

  pa.active = false;
  pa.paused = false;
  pa.state = STATES.IDLE;

  // Reset timed state
  timedEventSchedule = [];
  timedCurrentIndex = 0;

  // Restore MIDI callbacks
  if (savedMidiCallbacks) {
    setMidiCallbacks({
      onNoteOn: savedMidiCallbacks.onNoteOn,
      onNoteOff: savedMidiCallbacks.onNoteOff,
    });
    savedMidiCallbacks = null;
  }

  // Release any held notes
  Object.keys(pa.activeInputNotes).forEach((midi) => {
    const noteInfo = NOTES_BY_MIDI[parseInt(midi)];
    if (noteInfo) trigger(noteInfo.name, false, 100, true);
  });
  pa.activeInputNotes = {};

  clearExpectedKeyHighlights();
  resetAllNoteStyles();
  hidePlayAlongHUD();

  // Ensure all play-along tracked notes are cleaned up from tracking sets
  if (pa.noteSequence && pa.noteSequence.length > 0) {
    pa.noteSequence.forEach((event) => {
      const allNotes = [...event.trebleNotes, ...event.bassNotes];
      allNotes.forEach((note) => {
        resetNoteStyle(note.noteId);
      });
    });
  }

  console.log("Play-Along: Stopped.");
}

/**
 * Pause play-along.
 */
export function pause() {
  const pa = pianoState.playAlong;
  if (!pa.active || pa.state === STATES.COMPLETE) return;

  pa.paused = true;

  // Pause Transport in timed mode
  if (pa.settings.mode === "timed" && typeof Tone !== "undefined" && Tone.Transport.state === "started") {
    Tone.Transport.pause();

    // Release all currently sounding notes
    if (audioManager.isAudioReady() && pianoState.sampler) {
      if (pianoState.sampler.releaseAll) {
        pianoState.sampler.releaseAll();
      }
    }
  }

  updateHUD();
  console.log("Play-Along: Paused.");
}

/**
 * Resume from paused state.
 */
export function resume() {
  const pa = pianoState.playAlong;
  if (!pa.active || !pa.paused) return;

  pa.paused = false;

  // Resume Transport in timed mode
  if (pa.settings.mode === "timed" && typeof Tone !== "undefined" && Tone.Transport.state === "paused") {
    Tone.Transport.start();
  }

  updateHUD();
  console.log("Play-Along: Resumed.");
}

/**
 * Restart from the beginning with the same score.
 */
export function restart() {
  stop();
  setTimeout(() => start(), 100);
}

/**
 * Toggle the HUD visibility (show settings panel when not active).
 */
export function toggleHUD() {
  const pa = pianoState.playAlong;
  const hud = document.getElementById("playalong-hud");
  if (!hud) return;

  if (pa.active) {
    // If active, stop
    stop();
  } else if (hud.classList.contains("hidden")) {
    // Show settings
    showPlayAlongHUD(false);
  } else {
    // Start the session
    start();
  }
}

/**
 * Initialize play-along button event listener.
 */
export function initializePlayAlong() {
  // Main Play Along button in the menu bar -- toggles the settings panel
  document.getElementById("playalong-btn")?.addEventListener("click", async (e) => {
    e.preventDefault();
    document.getElementById("instrument")?.focus();

    const pa = pianoState.playAlong;
    if (pa.active) {
      stop();
    } else {
      const hud = document.getElementById("playalong-hud");
      if (hud && !hud.classList.contains("hidden")) {
        hidePlayAlongHUD(); // Toggle off
      } else {
        showPlayAlongHUD(false); // Show settings
      }
    }
  });

  // Start button inside the settings panel
  document.getElementById("playalong-start-btn")?.addEventListener("click", async (e) => {
    e.preventDefault();
    document.getElementById("instrument")?.focus();
    await audioManager.unlockAndExecute(() => start());
  });
}
