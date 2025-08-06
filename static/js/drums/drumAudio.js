// drumAudio.js
// Simplified drum audio management using shared infrastructure

// ===================================================================
// Imports
// ===================================================================
import { drumsState, pianoState } from "../core/appState.js";
import { DRUM_INSTRUMENT_MAP } from "../core/drum-data.js";
import { NOTES_BY_NAME } from "../core/note-data.js";
import audioManager from "../core/audioManager.js";
import { trigger } from "../instrument/playbackHelpers.js";
import { addPlaybackHighlight, clearAllHighlights } from "../score/scoreHighlighter.js";
import { scrollToMeasure } from "./drumRenderer.js";
import {
    getDrumMeasures,
    addNoteToMeasure,
    getCurrentDrumMeasureIndex,
    resetDrumScore,
    undoLastWrite as undoDrumLastWrite,
} from "./drumsScoreWriter.js";
import { getMeasures } from "../score/scoreWriter.js";
import { safeRedraw } from "../score/scoreRenderer.js";
import { updateNowPlayingDisplay } from "../ui/uiHelpers.js";

// ===================================================================
// Drum-Specific Constants
// ===================================================================

const DRUM_SAMPLE_BASE_URL = "/static/samples/drums/";

const DRUM_SAMPLE_URLS = {
    // Kicks
    "C2": "kick.wav",
    "B1": "BOXKICK.wav",
    // Snares  
    "D2": "snare.wav",
    "C#2": "sidestick.wav",
    "F2": "rim.wav",
    // Hi-Hats
    "F#2": "hi-hat.wav",
    "A#2": "open-hat.wav",
    // Toms
    "A2": "low-tom.wav",
    "B2": "MIDTOM.wav",
    "C3": "high-tom.wav",
    // Cymbals
    "C#3": "crash.wav",
    "D#3": "ride.wav",
    "G3": "cymbal.wav",
    // Hand Percussion
    "D#2": "clap.wav",
    "G#3": "cowbell.wav",
    "A#3": "conga.wav",
    "F#3": "BONGOLO.wav",
    "G#4": "BONGOHI.wav",
    "A4": "claves.wav",
};

const DRUM_MIDI_TO_NOTE = {
    35: "B1", 36: "C2", 37: "C#2", 38: "D2", 39: "D#2", 40: "E2",
    41: "F2", 42: "F#2", 43: "G2", 44: "G#2", 45: "A2", 46: "A#2",
    47: "B2", 48: "C3", 49: "C#3", 50: "D3", 51: "D#3", 52: "E3",
    53: "F3", 54: "F#3", 55: "G3", 56: "G#3", 57: "A3", 58: "A#3",
    59: "B3", 60: "C4", 61: "C#4", 62: "D4", 63: "D#4", 64: "E4",
    65: "F4", 66: "F#4", 67: "G4", 68: "G#4", 69: "A4", 70: "A#4",
    71: "B4", 72: "C5", 73: "C#5", 74: "D5", 75: "D#5", 76: "E5",
    77: "F5", 78: "F#5", 79: "G5", 80: "G#5", 81: "A5", 82: "A#5",
    83: "B5", 84: "C6", 85: "C#6", 86: "D6", 87: "D#6",
};

const DURATION_TO_BEATS = {
    w: 4, "w.": 6, h: 2, "h.": 3, q: 1, "q.": 1.5,
    "8": 0.5, "8.": 0.75, "16": 0.25, "16.": 0.375,
    "32": 0.125, "32.": 0.1875,
};

// ===================================================================
// Internal State
// ===================================================================
let selectedDrumDuration = "q";
let lastScrolledDrumMeasureIndex = -1;
let drumSampler = null; // Separate sampler for drums

// ===================================================================
// Drum Button Management
// ===================================================================
function findDrumButton(drumInstrument) {
    return document.querySelector(`[data-drum="${drumInstrument}"]`);
}

function setDrumButtonActive(drumInstrument, isActive) {
    const drumButton = findDrumButton(drumInstrument);
    if (drumButton) {
        drumButton.classList.toggle('active', isActive);
    }
}

function clearAllActiveDrumButtons() {
    document.querySelectorAll('[data-drum].active').forEach(btn => {
        btn.classList.remove('active');
    });
}

// ===================================================================
// Core Drum Functions
// ===================================================================

/**
 * Initialize drum-specific audio state
 */
export function initializeDrumAudioState() {
    if (!drumsState.audioStatus) {
        drumsState.audioStatus = "uninitialized";
        drumsState.activeDrumNotes = new Set();
    }
}

/**
 * Check if drum audio is ready
 */
export function isDrumAudioReady() {
    return audioManager.isAudioReady() && drumSampler;
}

/**
 * Initialize drum sampler and connect to spectrum
 */
async function initializeDrumSampler() {
    if (drumSampler) return drumSampler;
    
    console.log("🥁 Creating drum sampler...");
    
    drumSampler = new Tone.Sampler({
        urls: DRUM_SAMPLE_URLS,
        release: 1,
        baseUrl: DRUM_SAMPLE_BASE_URL,
        onload: () => console.log("✅ Drum samples loaded"),
        onerror: (error) => console.error("❌ Drum sample error:", error),
    }).toDestination();

    await Tone.loaded();
    
    // Connect drum sampler to spectrum visualization
    try {
        const { connectSpectrumToAudio } = await import("../ui/spectrum.js");
        connectSpectrumToAudio(drumSampler);
        console.log("🥁 Drum sampler connected to spectrum");
    } catch (error) {
        console.warn("🥁 Could not connect drums to spectrum:", error);
    }
    
    console.log("🥁 Drum sampler ready!");
    return drumSampler;
}

/**
 * Trigger drum sound using shared infrastructure
 */
export function triggerDrum(drumInstrument, on, velocity = 1) {
    if (!audioManager.isAudioReady()) {
        console.warn("🥁 Audio not ready");
        return;
    }

    const instrumentProps = DRUM_INSTRUMENT_MAP[drumInstrument];
    if (!instrumentProps || typeof instrumentProps.midi !== 'number') {
        console.warn(`🥁 Unknown drum instrument: ${drumInstrument}`);
        return;
    }
    
    const midiNumber = instrumentProps.midi;
    const noteToPlay = DRUM_MIDI_TO_NOTE[midiNumber];
    
    if (!noteToPlay || !drumSampler) {
        console.warn(`🥁 No note mapping for ${drumInstrument}`);
        return;
    }

    if (on) {
        // Use the drum sampler directly for drums
        drumSampler.triggerAttack(noteToPlay, Tone.now(), velocity);
        drumsState.activeDrumNotes.add(drumInstrument);
        setDrumButtonActive(drumInstrument, true);
        audioManager.startSpectrumIfReady(); // Use shared spectrum
    } else {
        drumSampler.triggerRelease(noteToPlay);
        drumsState.activeDrumNotes.delete(drumInstrument);
        setDrumButtonActive(drumInstrument, false);
    }
}

/**
 * Unlock drum audio using shared audioManager
 */
export async function unlockAndExecuteDrum(action) {
    console.log('🥁 Unlocking drum audio...');
    
    // Use shared audio manager unlock
    const success = await audioManager.unlockAndExecute(async () => {
        // Initialize drum sampler after shared audio is ready
        await initializeDrumSampler();
        // Execute the actual action
        action();
    });

    return success;
}

/**
 * Stop drum playback
 */
export function stopDrumPlayback() {
    console.log("🥁 Stopping drum playback...");
    
    Tone.Transport.stop();
    Tone.Transport.cancel();
    lastScrolledDrumMeasureIndex = -1;

    if (drumSampler && drumSampler.releaseAll) {
        drumSampler.releaseAll();
    }

    // Release all piano notes too if they exist
    if (pianoState.sampler && pianoState.sampler.releaseAll) {
        pianoState.sampler.releaseAll();
    }

    clearAllActiveDrumButtons();
    drumsState.activeDrumNotes.clear();
    updateNowPlayingDisplay('');
    clearAllHighlights();
    safeRedraw();
}

// ===================================================================
// Playback Functions
// ===================================================================

/**
 * Handle drum/duet playback - plays both piano and drum scores simultaneously
 */
export function handleDrumPlayback() {
    if (Tone.Transport.state === "started") {
        stopDrumPlayback();
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

    const startDuetPlayback = async () => {
        try {
            // Ensure both audio systems are ready
            if (!drumSampler) {
                await initializeDrumSampler();
            }

            const tempo = drumsState.tempo || 120;
            
            Tone.Transport.stop();
            Tone.Transport.cancel();
            Tone.Transport.position = 0;
            Tone.Transport.bpm.value = tempo;
            clearAllActiveDrumButtons();

            // Schedule drum events
            if (hasDrumScore) {
                console.log('🥁 Scheduling drum events');
                scheduleDrumEvents(drumMeasures, tempo);
            }

            // Schedule piano events
            if (hasPianoScore) {
                console.log('🎹 Scheduling piano events');
                schedulePianoEvents(pianoMeasures, tempo);
            }

            // Calculate total playback time and schedule stop
            let maxPlaybackTime = 0;
            if (hasDrumScore) {
                maxPlaybackTime = Math.max(maxPlaybackTime, calculateTotalDrumPlaybackDuration(drumMeasures, tempo));
            }
            if (hasPianoScore) {
                maxPlaybackTime = Math.max(maxPlaybackTime, calculateTotalPianoPlaybackDuration(pianoMeasures, tempo));
            }

            if (maxPlaybackTime > 0) {
                Tone.Transport.scheduleOnce(() => {
                    stopDrumPlayback();
                }, maxPlaybackTime + 0.1); // Add a small buffer
            }

            Tone.Transport.start();
            console.log('🎵 Duet playback started!');
        } catch (error) {
            console.error('❌ Error starting duet playback:', error);
        }
    };

    // Use shared unlock system for both instruments
    unlockAndExecuteDrum(startDuetPlayback);
}

/**
 * Calculate total drum playback duration
 */
function calculateTotalDrumPlaybackDuration(drumMeasures, bpm) {
    let totalTime = 0;
    const beatsPerMeasure = drumsState.timeSignature.numerator;
    const secondsPerBeat = 60 / bpm;

    drumMeasures.forEach(measure => {
        totalTime += beatsPerMeasure * secondsPerBeat;
    });
    return totalTime;
}

/**
 * Calculate total piano playback duration
 */
function calculateTotalPianoPlaybackDuration(pianoMeasures, bpm) {
    let totalTime = 0;
    const beatsPerMeasure = pianoState.timeSignature.numerator; // Assuming pianoState.timeSignature exists
    const secondsPerBeat = 60 / bpm;

    pianoMeasures.forEach(measure => {
        totalTime += beatsPerMeasure * secondsPerBeat;
    });
    return totalTime;
}

/**
 * Schedule drum events
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

            scheduleNoteOrChord(note, noteStartTime, noteDurationInSeconds);
            measureOffset += noteDurationInSeconds;
        });

        currentTransportTime += beatsPerMeasure * secondsPerBeat;
    });
}

/**
 * Schedule piano events on the Transport
 */
function schedulePianoEvents(pianoMeasures, bpm) {
    console.log('🎹 Scheduling piano events directly');
    
    let currentTransportTime = 0;
    const beatsPerMeasure = 4; // Assuming 4/4 time
    const secondsPerBeat = 60 / bpm;
    
    pianoMeasures.forEach((measure, measureIndex) => {
        let trebleMeasureOffset = 0;
        let bassMeasureOffset = 0;

        // Filter notes by clef
        const trebleNotes = measure.filter((n) => n.clef === "treble");
        const bassNotes = measure.filter((n) => n.clef === "bass");

        // Function to schedule a piano note
        const schedulePianoNote = (note, measureOffset) => {
            const beatDuration = DURATION_TO_BEATS[note.duration];
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
                        if (midi && pianoState.noteEls && pianoState.noteEls[midi]) {
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
                        if (midi && pianoState.noteEls && pianoState.noteEls[midi]) {
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

/**
 * Schedule individual drum note or chord
 */
function scheduleNoteOrChord(note, noteStartTime, noteDurationInSeconds) {
    if (note.isRest) return;

    if (note.isChord) {
        note.notes.forEach(individualNote => {
            scheduleIndividualNote(individualNote, noteStartTime, noteDurationInSeconds);
        });
    } else {
        scheduleIndividualNote(note, noteStartTime, noteDurationInSeconds);
    }
}

function scheduleIndividualNote(note, noteStartTime, noteDurationInSeconds) {
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
    Tone.Transport.scheduleOnce((time) => {
        triggerDrum(note.drumInstrument, false);
    }, noteStartTime + noteDurationInSeconds);
}

// ===================================================================
// UI Event Handlers
// ===================================================================

export function initializeDrumAudioListeners() {
    // Duration buttons
    document.querySelectorAll('[data-duration]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('[data-duration]').forEach(b => 
                b.classList.remove('btn--active')
            );
            e.currentTarget.classList.add('btn--active');
            selectedDrumDuration = e.currentTarget.dataset.duration;
            console.log(`🥁 Selected duration: ${selectedDrumDuration}`);
        });
    });

    // Set initial duration
    const quarterBtn = document.getElementById('drum-quarter-btn');
    if (quarterBtn) {
        quarterBtn.classList.add('btn--active');
    }

    // Drum instrument buttons
    document.querySelectorAll('[data-drum]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const drumType = e.currentTarget.dataset.drum;

            unlockAndExecuteDrum(() => {
                // Trigger drum sound
                triggerDrum(drumType, true);
                setTimeout(() => triggerDrum(drumType, false), 200);

                // Add to score
                const drumNoteData = {
                    drumInstrument: drumType,
                    duration: selectedDrumDuration,
                    isRest: drumType === "rest",
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                };
                addNoteToMeasure(undefined, drumNoteData);

                // Scroll to current measure
                const currentMeasureIdx = getCurrentDrumMeasureIndex();
                scrollToMeasure(currentMeasureIdx);
                console.log(`🥁 Added ${drumType} to score`);
            });
        });
    });

    // Control buttons
    document.getElementById('clear-drum-score-btn')?.addEventListener('click', () => {
        resetDrumScore();
        clearAllActiveDrumButtons();
        console.log('🥁 Score cleared');
    });

    document.getElementById('undo-drum-btn')?.addEventListener('click', () => {
        undoDrumLastWrite();
        console.log('🥁 Undo performed');
    });

    document.getElementById('add-drum-measure-btn')?.addEventListener('click', () => {
        const newMeasureIndex = getDrumMeasures().length;
        const restNote = {
            drumInstrument: "rest",
            duration: "w",
            isRest: true,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        };
        addNoteToMeasure(newMeasureIndex, restNote);
        scrollToMeasure(newMeasureIndex);
        console.log('🥁 Measure added');
    });
}

export function setupDrumPlaybackButton() {
    const playBtn = document.getElementById('play-drums-score-btn');
    if (!playBtn) {
        console.warn('🥁 Play button not found');
        return;
    }

    playBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleDrumPlayback(); // This now handles duet playback automatically
    });
}

export function initializeDrumAudioModule() {
    initializeDrumAudioState();
    initializeDrumAudioListeners();
    setupDrumPlaybackButton();
    console.log("🥁 Drum Audio Module initialized (using shared infrastructure)");
}