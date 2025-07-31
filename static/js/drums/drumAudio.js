// drumAudio.js
// This file centralizes all drum-related audio and playback logic.

// ===================================================================
// Imports
// ===================================================================
import { drumsState, pianoState } from "../core/appState.js";
import { DRUM_INSTRUMENT_MAP } from "../core/drum-data.js";
import { NOTES_BY_NAME } from "../core/note-data.js";
import audioManager from "../core/audioManager.js";
import { trigger } from "../instrument/playbackHelpers.js";
import { addPlaybackHighlight } from "../score/scoreHighlighter.js"; // Only for piano
import {
  scrollToMeasure,
  safeRedraw,
} from "./drumRenderer.js";
import {
  getDrumMeasures,
  addNoteToMeasure,
  getCurrentDrumMeasureIndex,
  resetScore as resetDrumScore,
  undoLastWrite as undoDrumLastWrite,
} from "./drumsScoreWriter.js";
import { getMeasures } from "../score/scoreWriter.js";
import { updateNowPlayingDisplay } from "../ui/uiHelpers.js";
import {
  initializeSpectrum,
  connectSpectrumToAudio,
  startSpectrumVisualization,
  stopSpectrumVisualization,
} from "../ui/spectrum.js";

// ===================================================================
// Constants
// ===================================================================

const DRUM_SAMPLE_BASE_URL = "/static/samples/drums/";

// Using note names as keys (following audioManager.js pattern)
const DRUM_SAMPLE_URLS = {
  "C2": "kick.wav",          // Kick (MIDI 36)
  "D2": "snare.wav",          // Snare (MIDI 38)
  "F#2": "hi-hat.wav",        // Hi-hat closed (MIDI 42)
  "A#2": "open-hat.wav",      // Hi-hat open (MIDI 46)
  "C#3": "crash.wav",         // Crash (MIDI 49)
  "D#3": "ride.wav",          // Ride (MIDI 51)
  "C3": "high-tom.wav",       // Tom high (MIDI 48)
  "A2": "low-tom.wav",        // Tom low (MIDI 45)
  "B1": "kick.wav",           // Kick 2 (MIDI 35) - Mapped to the same kick as MIDI 36
  "E2": "snare.wav",          // Snare 2 (MIDI 40) - Mapped to the same snare as MIDI 38
  "D3": "high-tom.wav",       // Tom mid (MIDI 50) - Mapped to high-tom as no specific "mid-tom" file was provided
  "D#2": "clap.wav",          // Clap 2 (MIDI 39)
  "G3": "cymbal.wav",
  "G#3": "cowbell.wav",
};

// Mapping from MIDI numbers to note names for drum triggering
const DRUM_MIDI_TO_NOTE = {
  35: "B1",   // Bass Drum 2
  36: "C2",   // Bass Drum 1 (Kick)
  37: "C#2",  // Side Stick (Rim shot)
  38: "D2",   // Acoustic Snare
  39: "D#2",  // Hand Clap (fixed from "Clap 2")
  40: "E2",   // Electric Snare
  41: "F2",   // Low Floor Tom
  42: "F#2",  // Closed Hi-hat
  43: "G2",   // High Floor Tom
  44: "G#2",  // Pedal Hi-hat
  45: "A2",   // Low Tom
  46: "A#2",  // Open Hi-hat
  47: "B2",   // Low-Mid Tom
  48: "C3",   // Hi-Mid Tom (Tom high)
  49: "C#3",  // Crash Cymbal 1
  50: "D3",   // High Tom (Tom mid)
  51: "D#3",  // Ride Cymbal 1
  52: "E3",   // Chinese Cymbal
  53: "F3",   // Ride Bell
  54: "F#3",  // Tambourine
  55: "G3",   // Splash Cymbal
  56: "G#3",  // Cowbell
  57: "A3",   // Crash Cymbal 2
  58: "A#3",  // Vibraslap
  59: "B3",   // Ride Cymbal 2
  60: "C4",   // Hi Bongo
  61: "C#4",  // Low Bongo
  62: "D4",   // Mute Hi Conga
  63: "D#4",  // Open Hi Conga
  64: "E4",   // Low Conga
  65: "F4",   // High Timbale
  66: "F#4",  // Low Timbale
  67: "G4",   // High Agogo
  68: "G#4",  // Low Agogo
  69: "A4",   // Cabasa
  70: "A#4",  // Maracas
  71: "B4",   // Short Whistle
  72: "C5",   // Long Whistle
  73: "C#5",  // Short Guiro
  74: "D5",   // Long Guiro
  75: "D#5",  // Claves
  76: "E5",   // Hi Wood Block
  77: "F5",   // Low Wood Block
  78: "F#5",  // Mute Cuica
  79: "G5",   // Open Cuica
  80: "G#5",  // Mute Triangle
  81: "A5",   // Open Triangle
  82: "A#5",  // Shaker
  83: "B5",   // Jingle Bell
  84: "C6",   // Bell Tree
  85: "C#6",  // Castanets
  86: "D6",   // Mute Surdo
  87: "D#6",  // Open Surdo
};

const DURATION_TO_BEATS = {
  w: 4, "w.": 6,
  h: 2, "h.": 3,
  q: 1, "q.": 1.5,
  "8": 0.5, "8.": 0.75,
  "16": 0.25, "16.": 0.375,
  "32": 0.125, "32.": 0.1875,
};

// ===================================================================
// Internal State Variables
// ===================================================================

let deferredDrumAction = null;
let spectrumInitialized = false;
let spectrumActive = false;
let selectedDrumDuration = "q";

// ===================================================================
// Utility Functions for Drum Button Management
// ===================================================================

/**
 * Finds the drum button element for a given drum instrument
 * @param {string} drumInstrument - The drum instrument name
 * @returns {Element|null} - The drum button element or null if not found
 */
function findDrumButton(drumInstrument) {
  return document.querySelector(`[data-drum="${drumInstrument}"]`);
}

/**
 * Sets the active state of a drum button
 * @param {string} drumInstrument - The drum instrument name
 * @param {boolean} isActive - Whether to add or remove the active class
 */
function setDrumButtonActive(drumInstrument, isActive) {
  const drumButton = findDrumButton(drumInstrument);
  if (drumButton) {
    if (isActive) {
      drumButton.classList.add('active');
    } else {
      drumButton.classList.remove('active');
    }
  }
}

/**
 * Clears all active drum button states
 */
function clearAllActiveDrumButtons() {
  document.querySelectorAll('[data-drum].active').forEach(btn => {
    btn.classList.remove('active');
  });
}

// ===================================================================
// Core Audio Management Functions
// ===================================================================

/**
 * Initializes the drum-specific audio state in `drumsState`.
 */
export function initializeDrumAudioState() {
  if (!drumsState.audioStatus) {
    drumsState.audioStatus = "uninitialized";
    drumsState.sampler = null;
    drumsState.activeDrumNotes = new Set();
  }
}

function setDrumAudioStatus(newStatus) {
  console.log(`🥁 Drum audio status: ${drumsState.audioStatus} → ${newStatus}`);
  drumsState.audioStatus = newStatus;
}

function processDeferredDrumAction() {
  if (deferredDrumAction) {
    console.log("🥁 Processing deferred drum action");
    const action = deferredDrumAction;
    deferredDrumAction = null;
    try {
      action();
    } catch (error) {
      console.error("❌ Error executing deferred drum action:", error);
    }
  }
}

export function isDrumAudioReady() {
  return drumsState.audioStatus === 'ready';
}

function initializeSpectrumVisualizer() {
  try {
    const spectrumContainer = document.getElementById("spectrum");
    if (!spectrumContainer) {
      console.log("🥁 Spectrum container not found - spectrum disabled for drums");
      return;
    }

    const spectrumOptions = {
      fftSize: 4096,
      smoothingTimeConstant: 0.8,
      canvasHeight: 120,
      backgroundColor: "#000000",
      colorScheme: "blue fire",
      showGrid: false,
      showLabels: false,
      minDb: -90,
      maxDb: -5,
      enableFrequencyGain: true,
      debugMode: false,
    };

    initializeSpectrum(spectrumOptions);
    spectrumInitialized = true;

    if (drumsState.sampler) {
      connectSpectrumToAudio(drumsState.sampler);
      console.log("🥁 Spectrum connected to drum sampler");
    }
  } catch (error) {
    console.error("❌ Error initializing drum spectrum:", error);
    spectrumInitialized = false;
  }
}

function startSpectrumIfReadyDrum() {
  if (spectrumInitialized && !spectrumActive) {
    startSpectrumVisualization();
    spectrumActive = true;
    console.log("🥁 Drum spectrum visualization started");
  }
}

function stopSpectrumVisualizationDrum() {
  if (spectrumActive) {
    stopSpectrumVisualization();
    spectrumActive = false;
    console.log("🥁 Drum spectrum visualization stopped");
  }
}

async function attemptMultipleDrumAudioUnlocks() {
  const unlockAudio = document.getElementById("unlock-audio");
  if (unlockAudio) {
    try {
      await unlockAudio.play();
      console.log("🥁 Unlock Strategy: Native audio element played successfully.");
      return;
    } catch (e) {
      console.warn("🥁 Unlock Strategy: Native audio play failed.", e.name);
    }
  }

  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
    const buffer = audioContext.createBuffer(1, 1, 22050);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
    setTimeout(() => audioContext.close(), 500);
    console.log("🥁 Unlock Strategy: Web Audio API buffer played successfully.");
  } catch (e) {
    console.warn("🥁 Unlock Strategy: Web Audio API unlock failed.", e.name);
  }
}

async function initializeToneWithRetryDrum(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await Tone.start();
      console.log(`✅ Tone.js for drums started successfully on attempt ${attempt}.`);
      if (Tone.context.state === 'interrupted') {
        console.log("🥁 Context was interrupted, attempting resume...");
        await Tone.context.resume();
      }
      if (Tone.context.state !== 'running') {
        throw new Error(`🥁 Audio context is in an unexpected state: ${Tone.context.state}`);
      }
      return;
    } catch (error) {
      console.warn(`⚠️ Tone.js drum start attempt ${attempt} of ${maxRetries} failed:`, error);
      if (attempt === maxRetries) {
        throw new Error("❌ Failed to start Tone.js for drums after multiple retries.");
      }
      await new Promise(resolve => setTimeout(resolve, 300 * attempt));
    }
  }
}

async function initializeDrumSampler() {
  console.log("🥁 Creating and configuring drum sampler...");
  drumsState.sampler = new Tone.Sampler({
    urls: DRUM_SAMPLE_URLS,
    release: 1,
    baseUrl: DRUM_SAMPLE_BASE_URL,
    onload: () => console.log("✅ All drum samples loaded successfully."),
    onerror: (error) => console.error("❌ Drum sample loading error:", error),
  }).toDestination();

  await Tone.loaded();
  console.log("🥁 Drum Sampler is ready!");
}

async function validateDrumAudioSystem() {
  try {
    if (Tone.context.state !== "running") {
      console.error("❌ Drum Validation failed: Context not running");
      return false;
    }
    if (!drumsState.sampler) {
      console.error("❌ Drum Validation failed: No sampler");
      return false;
    }
    return true;
  } catch (error) {
    console.error("❌ Drum audio validation error:", error);
    return false;
  }
}

async function initializeDrumAudio() {
  let timeoutId;
  try {
    setDrumAudioStatus("loading");
    console.log("🥁 Initializing drum audio components.");

    const overallTimeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("🥁 Drum audio initialization timed out after 15 seconds."));
      }, 15000);
    });

    await Promise.race([
      (async () => {
        await attemptMultipleDrumAudioUnlocks();
        await initializeToneWithRetryDrum();
        await initializeDrumSampler();
        initializeSpectrumVisualizer();
        const isValid = await validateDrumAudioSystem();
        if (!isValid) {
          throw new Error("🥁 Drum audio system validation failed after setup.");
        }
      })(),
      overallTimeoutPromise,
    ]);

    clearTimeout(timeoutId);
    setDrumAudioStatus("ready");
    processDeferredDrumAction();
    window.dispatchEvent(new Event("drumAudioReady"));
    return true;
  } catch (error) {
    console.error("❌ A critical error occurred during drum audio initialization:", error);
    clearTimeout(timeoutId);
    setDrumAudioStatus("error");
    deferredDrumAction = null;
    return false;
  }
}

export async function unlockAndExecuteDrum(newAction) {
  console.log('🥁 UnlockAndExecuteDrum called, current status:', drumsState.audioStatus);

  if (Tone.context && Tone.context.state !== 'running') {
    console.log(`🥁 Attempting to resume Drum AudioContext. Current state: ${Tone.context.state}`);
    try {
      await Tone.context.resume();
      console.log(`🥁 Drum AudioContext resumed. New state: ${Tone.context.state}`);
    } catch (e) {
      console.warn("⚠️ Failed to resume Drum AudioContext during unlock:", e);
    }
  }

  if (drumsState.audioStatus === "ready") {
    console.log("✅ Drum audio already ready, executing action immediately");
    try {
      newAction();
      return true;
    } catch (error) {
      console.error("❌ Error executing immediate drum action:", error);
      return false;
    }
  }

  deferredDrumAction = newAction;
  console.log("🥁 Deferred drum action stored.");

  if (drumsState.audioStatus === "loading") {
    console.log("🥁 Drum audio currently loading, action deferred.");
    return new Promise((resolve) => {
      const checkReady = setInterval(() => {
        if (drumsState.audioStatus === "ready") {
          clearInterval(checkReady);
          resolve(true);
        } else if (drumsState.audioStatus === "error") {
          clearInterval(checkReady);
          deferredDrumAction = null;
          resolve(false);
        }
      }, 50);
    });
  }

  console.log("🥁 Starting drum audio initialization with deferred action.");
  const success = await initializeDrumAudio();

  if (!success) {
    deferredDrumAction = null;
  }
  return success;
}

// ===================================================================
// Core Playback Functions
// ===================================================================

export function triggerDrum(drumInstrument, on, velocity = 1) {
  if (!isDrumAudioReady()) return;

  const instrumentProps = DRUM_INSTRUMENT_MAP[drumInstrument];
  if (!instrumentProps || typeof instrumentProps.midi !== 'number') {
    console.warn(`🥁 Cannot play unknown drum instrument or no valid MIDI number defined: ${drumInstrument}`);
    return;
  }
  
  const midiNumber = instrumentProps.midi;
  const noteToPlay = DRUM_MIDI_TO_NOTE[midiNumber];
  
  if (!noteToPlay) {
    console.warn(`🥁 No note mapping for MIDI ${midiNumber} (${drumInstrument})`);
    return;
  }

  if (on) {
    drumsState.sampler.triggerAttack(noteToPlay, Tone.now(), velocity);
    drumsState.activeDrumNotes.add(drumInstrument);
    setDrumButtonActive(drumInstrument, true);
    startSpectrumIfReadyDrum();
  } else {
    drumsState.sampler.triggerRelease(noteToPlay);
    drumsState.activeDrumNotes.delete(drumInstrument);
    setDrumButtonActive(drumInstrument, false);

    if (drumsState.activeDrumNotes.size === 0) {
      setTimeout(() => {
        if (drumsState.activeDrumNotes.size === 0) {
          stopSpectrumVisualizationDrum();
        }
      }, 500);
    }
  }
}

// ===================================================================
// DUET PLAYBACK - The main function that plays both piano and drums
// ===================================================================

/**
 * Handles duet playback - plays both piano and drum scores simultaneously
 */
export function handleDrumPlayback() {
  const playBtn = document.getElementById('play-drums-score-btn');

  if (Tone.Transport.state === "started") {
    // Stop playback
    Tone.Transport.stop();
    Tone.Transport.cancel();
    clearAllActiveDrumButtons(); // Clear drum button active states
    safeRedraw();

    
    // Release all notes
    if (drumsState.sampler && drumsState.sampler.releaseAll) {
      drumsState.sampler.releaseAll();
    }
    
    setTimeout(() => {
      drumsState.activeDrumNotes.clear();
      stopSpectrumVisualizationDrum();
    }, 1000);
    return;
  }

  // Get both scores
  const drumMeasures = getDrumMeasures();
  const pianoMeasures = getMeasures();
  const hasDrumScore = drumMeasures && drumMeasures.length > 0;
  const hasPianoScore = pianoMeasures && pianoMeasures.length > 0;

  if (!hasDrumScore && !hasPianoScore) {
    console.warn('🎵 No drum or piano measures to play');
    return;
  }

  console.log(`🎵 Starting duet playback - Drums: ${hasDrumScore ? 'Yes' : 'No'}, Piano: ${hasPianoScore ? 'Yes' : 'No'}`);

  const startDuetPlayback = () => {
    try {
      const tempo = drumsState.tempo || 120;
      
      // Setup transport
      Tone.Transport.stop();
      Tone.Transport.cancel();
      Tone.Transport.position = 0;
      Tone.Transport.bpm.value = tempo;
      clearAllActiveDrumButtons(); // Clear all drum button states

      // Schedule drum events
      if (hasDrumScore) {
        console.log('🥁 Scheduling drum events');
        scheduleDrumEvents(drumMeasures, tempo);
        startSpectrumIfReadyDrum();
      }

      // Schedule piano events
      if (hasPianoScore) {
        console.log('🎹 Scheduling piano events');
        schedulePianoEvents(pianoMeasures, tempo);
      }

      // Start transport
      Tone.Transport.start();
      
      console.log('🎵 Duet playback started!');
    } catch (error) {
      console.error('❌ Error starting duet playback:', error);
    }
  };

  // Ensure both audio systems are ready
  const drumAudioReady = isDrumAudioReady();
  const pianoAudioReady = audioManager.isAudioReady();

  if (hasDrumScore && !drumAudioReady) {
    unlockAndExecuteDrum(() => {
      if (hasPianoScore && !pianoAudioReady) {
        audioManager.unlockAndExecute(startDuetPlayback);
      } else {
        startDuetPlayback();
      }
    });
  } else if (hasPianoScore && !pianoAudioReady) {
    audioManager.unlockAndExecute(startDuetPlayback);
  } else {
    startDuetPlayback();
  }
}

/**
 * Schedule drum events on the Transport
 */
function scheduleDrumEvents(drumMeasures, bpm) {
  let currentTransportTime = 0;
  const beatsPerMeasure = drumsState.timeSignature.numerator;
  const secondsPerBeat = 60 / bpm;

  drumMeasures.forEach((measure, measureIndex) => {
    // Schedule measure scrolling
    Tone.Transport.scheduleOnce((time) => {
      Tone.Draw.schedule(() => {
        scrollToMeasure(measureIndex);
      }, time);
    }, currentTransportTime);

    let measureOffset = 0;

    measure.forEach((note) => {
      const beatDuration = DURATION_TO_BEATS[note.duration];
      if (beatDuration === undefined) {
        console.error(`Unknown duration: ${note.duration}`);
        return;
      }

      const noteDurationInSeconds = beatDuration * secondsPerBeat;
      const noteStartTime = currentTransportTime + measureOffset;

      if (!note.isRest) {
        // Schedule note on
        Tone.Transport.scheduleOnce((time) => {
          triggerDrum(note.drumInstrument, true, 1);
        }, noteStartTime);

        // Schedule UI update
        Tone.Transport.scheduleOnce((time) => {
          Tone.Draw.schedule(() => {
            updateNowPlayingDisplay(note.drumInstrument);
          }, time);
        }, noteStartTime);

        // Schedule note off
        const noteEndTime = noteStartTime + noteDurationInSeconds;
        Tone.Transport.scheduleOnce((time) => {
          triggerDrum(note.drumInstrument, false);
        }, noteEndTime);
      }

      measureOffset += noteDurationInSeconds;
    });

    currentTransportTime += beatsPerMeasure * secondsPerBeat;
  });
}

/**
 * Schedule piano events on the Transport
 */
function schedulePianoEvents(pianoMeasures, bmp) {
  console.log('🎹 Scheduling piano events directly');
  
  let currentTransportTime = 0;
  const beatsPerMeasure = 4; // Assuming 4/4 time
  const secondsPerBeat = 60 / bmp;
  
  // Piano note duration mapping
  const PIANO_DURATION_TO_BEATS = {
    w: 4, "w.": 6,
    h: 2, "h.": 3,
    q: 1, "q.": 1.5,
    "8": 0.5, "8.": 0.75,
    "16": 0.25, "16.": 0.375,
    "32": 0.125, "32.": 0.1875,
  };

  pianoMeasures.forEach((measure, measureIndex) => {
    let trebleMeasureOffset = 0;
    let bassMeasureOffset = 0;

    // Filter notes by clef
    const trebleNotes = measure.filter((n) => n.clef === "treble");
    const bassNotes = measure.filter((n) => n.clef === "bass");

    // Function to schedule a piano note
    const schedulePianoNote = (note, measureOffset) => {
      const beatDuration = PIANO_DURATION_TO_BEATS[note.duration];
      if (beatDuration === undefined) {
        console.error(`Unknown piano duration: ${note.duration}`);
        return 0;
      }

      const noteDurationInSeconds = beatDuration * secondsPerBeat;
      const noteStartTime = currentTransportTime + measureOffset;

      if (!note.isRest) {
        const notesToPlay = note.name
          .replace(/[()]/g, "")
          .split(" ")
          .filter(Boolean);

        // Schedule note on
        Tone.Transport.scheduleOnce((time) => {
          trigger(notesToPlay, true);
        }, noteStartTime);

        // Schedule note off
        Tone.Transport.scheduleOnce((time) => {
          trigger(notesToPlay, false);
        }, noteStartTime + noteDurationInSeconds);

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
        }, noteStartTime + noteDurationInSeconds);

        // Schedule score highlighting (for piano only)
        Tone.Transport.scheduleOnce((time) => {
          Tone.Draw.schedule(() => {
            addPlaybackHighlight(measureIndex, note.clef, note.id, "#76B595");
          }, time);
        }, noteStartTime);
      }

      return noteDurationInSeconds;
    };

    // Schedule treble notes
    trebleNotes.forEach((note) => {
      trebleMeasureOffset += schedulePianoNote(note, trebleMeasureOffset);
    });

    // Schedule bass notes
    bassNotes.forEach((note) => {
      bassMeasureOffset += schedulePianoNote(note, bassMeasureOffset);
    });

    currentTransportTime += beatsPerMeasure * secondsPerBeat;
  });
}

// ===================================================================
// UI Event Handlers
// ===================================================================

let selectedDrumDurationElement = null;

export function initializeDrumAudioListeners() {
  document.querySelectorAll('[data-duration]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (selectedDrumDurationElement) {
        selectedDrumDurationElement.classList.remove('btn--active');
      }
      e.currentTarget.classList.add('btn--active');
      selectedDrumDuration = e.currentTarget.dataset.duration;
      selectedDrumDurationElement = e.currentTarget;
      console.log(`🥁 Selected drum duration: ${selectedDrumDuration}`);
    });
  });

  selectedDrumDurationElement = document.getElementById('drum-quarter-btn');
  if (selectedDrumDurationElement) {
    selectedDrumDurationElement.classList.add('btn--active');
  }

  document.querySelectorAll('[data-drum]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const drumType = e.currentTarget.dataset.drum;

      unlockAndExecuteDrum(() => {
        // Trigger drum sound and visual feedback
        triggerDrum(drumType, true);
        setTimeout(() => triggerDrum(drumType, false), 200);

        const drumNoteData = {
          drumInstrument: drumType,
          duration: selectedDrumDuration,
          isRest: drumType === "rest",
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        };
        addNoteToMeasure(undefined, drumNoteData);

        const currentDrumMeasureIdx = getCurrentDrumMeasureIndex();
        if (typeof scrollToMeasure === 'function') {
          scrollToMeasure(currentDrumMeasureIdx);
        }
        console.log(`🥁 Added ${drumType} to drum score via button.`);
      });
    });
  });

  document.getElementById('clear-drum-score-btn')?.addEventListener('click', () => {
    resetDrumScore();
    clearAllActiveDrumButtons();
    console.log('🥁 Drum score cleared.');
  });

  document.getElementById('undo-drum-btn')?.addEventListener('click', () => {
    undoDrumLastWrite();
    console.log('🥁 Drum undo performed.');
  });

  document.getElementById('add-drum-measure-btn')?.addEventListener('click', () => {
    addDrumMeasureInternal();
    console.log('🥁 Drum measure added.');
  });

  function addDrumMeasureInternal() {
    const newMeasureIndex = getDrumMeasures().length;
    const restNote = {
      drumInstrument: "rest",
      duration: "w",
      isRest: true,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    };
    addNoteToMeasure(newMeasureIndex, restNote);
    if (typeof scrollToMeasure === 'function') {
      scrollToMeasure(newMeasureIndex);
    }
  }

  // Pattern buttons remain the same...
}

export function setupDrumPlaybackButton() {
  const playDrumBtn = document.getElementById('play-drums-score-btn');
  if (!playDrumBtn) {
    console.warn('🥁 Play drums button not found');
    return;
  }

  playDrumBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleDrumPlayback();
  });
}

export function initializeDrumAudioModule() {
  initializeDrumAudioState();
  initializeDrumAudioListeners();
  setupDrumPlaybackButton();
  console.log("🥁 Drum Audio Module initialized.");
}