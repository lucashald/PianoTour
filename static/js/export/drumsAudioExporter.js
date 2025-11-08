// audioExporter.js
// Handles exporting score playback as downloadable audio files
// Uses EXACT same scheduling logic as scorePlayback.js

import { drumsState } from "../core/appState.js";
import { Instrument } from "../core/audioManager.js";

// ===================================================================
// Constants (COPIED FROM scorePlayback.js)
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

const SAMPLE_RATE = 44100; // CD quality

// ===================================================================
// Tie Map Building (COPIED FROM scorePlayback.js)
// ===================================================================

/**
 * Builds a simple map of tie relationships for audio sustain
 * EXACT COPY from scorePlayback.js
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
    
    const beatsPerMeasure = drumsState.timeSignature.numerator;
    currentTime += beatsPerMeasure;
  });
  
  // Process ties
  measures.forEach(measure => {
    measure.forEach(note => {
      if (note.tie?.type === 'start' && note.tie?.endNoteId) {
        const startDetails = noteDetails.get(note.id);
        const endDetails = noteDetails.get(note.tie.endNoteId);
        
        if (startDetails && endDetails) {
          let totalDuration = startDetails.duration + endDetails.duration;
          let currentEndId = note.tie.endNoteId;
          let currentEndNote = measures
            .flat()
            .find(n => n.id === currentEndId);
          
          // Follow tie chain
          while (currentEndNote?.tie?.type === 'continue' && currentEndNote?.tie?.endNoteId) {
            const nextEndDetails = noteDetails.get(currentEndNote.tie.endNoteId);
            if (nextEndDetails) {
              totalDuration += nextEndDetails.duration;
              currentEndId = currentEndNote.tie.endNoteId;
              currentEndNote = measures.flat().find(n => n.id === currentEndId);
            } else {
              break;
            }
          }
          
          tieMap.set(note.id, {
            isStart: true,
            totalDuration: totalDuration,
            endNoteId: currentEndId
          });
          
          // Mark intermediate and end notes
          let markId = note.tie.endNoteId;
          let markNote = measures.flat().find(n => n.id === markId);
          
          while (markNote) {
            const isEnd = markNote.id === currentEndId;
            tieMap.set(markNote.id, {
              isEnd: true,
              isChainStart: false,
              startNoteId: note.id
            });
            
            if (isEnd || !markNote.tie?.endNoteId) break;
            markId = markNote.tie.endNoteId;
            markNote = measures.flat().find(n => n.id === markId);
          }
        }
      }
    });
  });
  
  return tieMap;
}

// ===================================================================
// Main Export Function
// ===================================================================

/**
 * Exports the current score as a WAV audio file
 */
export async function exportScoreAsAudio(measures, bpm = 120, filename = null) {
  if (!measures || measures.length === 0) {
    throw new Error("No measures to export");
  }

  console.log("Starting audio export...");
  console.log(`Measures: ${measures.length}, BPM: ${bpm}`);

  // Calculate total duration - EXACT same as scorePlayback.js calculates
  const secondsPerBeat = 60 / bpm;
  const beatsPerMeasure = drumsState.timeSignature.numerator;
  const totalBeats = measures.length * beatsPerMeasure;
  const scoreDuration = totalBeats * secondsPerBeat;
  
  // Add small padding to ensure last notes are fully rendered
  const duration = scoreDuration + 1.0; // 1 second padding for safety
  
  console.log(`Total duration: ${duration.toFixed(2)}s`);

  try {
    // Create offline context
    const offlineContext = new Tone.OfflineContext(
      2, // stereo
      duration,
      SAMPLE_RATE
    );

    // Set up audio chain in offline context
    const { sampler, envelope, effects } = await setupOfflineAudioChain(offlineContext, measures, bpm);

    // Render audio
    console.log("Rendering audio...");
    const buffer = await offlineContext.render();
    console.log("Audio rendered successfully");

    // Convert to WAV and download
    const wavBlob = bufferToWave(buffer, buffer.length);
    downloadAudioFile(wavBlob, filename || generateFilename());

    console.log("Export complete!");
  } catch (error) {
    console.error("Export failed:", error);
    throw error;
  }
}

// ===================================================================
// Audio Setup Functions
// ===================================================================

async function setupOfflineAudioChain(offlineContext, measures, bpm) {
  const instrument = drumsState.instrument || "drums";
  const envelopeSettings = drumsState.envelope
    ? drumsState.envelope.getSettings()
    : Instrument.getPreset("drums").envelopeSettings;

  console.log("Setting up audio chain...");

  // Create sampler
  const sampler = await createOfflineSampler(offlineContext, instrument);

  // Create envelope
  const envelope = createOfflineEnvelope(offlineContext, envelopeSettings);

  // Create effects
  const effects = await createOfflineEffects(offlineContext, envelopeSettings.effects);

  // Connect: sampler -> envelope -> effects -> destination
  sampler.connect(envelope);
  let lastNode = envelope;
  effects.forEach((effect) => {
    lastNode.connect(effect);
    lastNode = effect;
  });
  lastNode.toDestination();

  // Schedule all notes
  scheduleNotesForOffline(offlineContext, measures, bpm, sampler, envelope);

  return { sampler, envelope, effects };
}

async function createOfflineSampler(offlineContext, instrument) {
  const sampleUrls = Instrument.getSampleUrls(instrument);
  const baseUrl = Instrument.getBaseUrl(instrument);

  return new Promise((resolve, reject) => {
    const sampler = new Tone.Sampler({
      urls: sampleUrls,
      baseUrl: baseUrl,
      context: offlineContext,
      onload: () => {
        console.log("Samples loaded");
        setTimeout(() => resolve(sampler), 100);
      },
      onerror: (error) => {
        console.error("Sample loading failed:", error);
        reject(error);
      },
    });
  });
}

function createOfflineEnvelope(offlineContext, settings) {
  return new Tone.AmplitudeEnvelope({
    attack: settings.attack || 0.01,
    decay: settings.decay || 0.3,
    sustain: settings.sustain || 0.8,
    release: settings.release || 1.2,
    context: offlineContext,
  });
}

async function createOfflineEffects(offlineContext, effectsConfig) {
  const effects = [];
  const effectPromises = [];

  if (!effectsConfig) return effects;

  // Reverb
  if (effectsConfig.reverb && effectsConfig.reverb.enabled) {
    const reverb = new Tone.Reverb({
      decay: (effectsConfig.reverb.roomSize || 0.3) * 10,
      wet: effectsConfig.reverb.wet || 0.2,
      context: offlineContext,
    });
    effects.push(reverb);
    effectPromises.push(reverb.generate());
  }

  // Compression
  if (effectsConfig.compression && effectsConfig.compression.enabled) {
    const compressor = new Tone.Compressor({
      threshold: effectsConfig.compression.threshold || -20,
      ratio: effectsConfig.compression.ratio || 8,
      attack: effectsConfig.compression.attack || 0.003,
      release: effectsConfig.compression.release || 0.1,
      context: offlineContext,
    });
    effects.push(compressor);
  }

  // EQ
  if (effectsConfig.eq && effectsConfig.eq.enabled) {
    const eq = new Tone.EQ3({
      low: effectsConfig.eq.low || 0,
      mid: effectsConfig.eq.mid || 0,
      high: effectsConfig.eq.high || 0,
      context: offlineContext,
    });
    effects.push(eq);
  }

  await Promise.all(effectPromises);

  return effects;
}

// ===================================================================
// Note Scheduling (EXACT COPY from scorePlayback.js with Transport)
// ===================================================================

/**
 * This is the EXACT scheduling logic from scorePlayback.js
 * Modified for offline context (no Transport wrapper needed)
 */
function scheduleNotesForOffline(offlineContext, measures, bpm, sampler, envelope) {
  const secondsPerBeat = 60 / bpm;
  const beatsPerMeasure = drumsState.timeSignature.numerator;
  
  // Build tie map (EXACT same as scorePlayback.js)
  const tieMap = buildTieMap(measures);

  let currentTransportTime = 0;
  let maxEndTime = 0;

  // EXACT loop structure from scorePlayback.js
  measures.forEach((measure, measureIndex) => {
    let trebleMeasureOffset = 0;
    let bassMeasureOffset = 0;

    const trebleNotes = measure.filter((n) => n.clef === "treble");
    const bassNotes = measure.filter((n) => n.clef === "bass");

    // Schedule Treble Notes
    trebleNotes.forEach((note) => {
      const tieInfo = tieMap.get(note.id);
      trebleMeasureOffset += scheduleNoteForOffline(
        note,
        measureIndex,
        note.id,
        currentTransportTime,
        trebleMeasureOffset,
        secondsPerBeat,
        sampler,
        envelope,
        tieInfo
      );
    });

    // Schedule Bass Notes
    bassNotes.forEach((note) => {
      const tieInfo = tieMap.get(note.id);
      bassMeasureOffset += scheduleNoteForOffline(
        note,
        measureIndex,
        note.id,
        currentTransportTime,
        bassMeasureOffset,
        secondsPerBeat,
        sampler,
        envelope,
        tieInfo
      );
    });

    // Calculate max end time
    const measureEndTime =
      currentTransportTime + Math.max(trebleMeasureOffset, bassMeasureOffset) * secondsPerBeat;
    if (measureEndTime > maxEndTime) {
      maxEndTime = measureEndTime;
    }

    currentTransportTime += beatsPerMeasure * secondsPerBeat;
  });

  console.log(`Scheduled ${measures.flat().filter(n => !n.isRest).length} notes`);
}

/**
 * Schedule a single note - EXACT logic from scorePlayback.js
 * Using direct time scheduling for offline context
 */
function scheduleNoteForOffline(
  note,
  measureIndex,
  noteId,
  currentTransportTime,
  clefOffset,
  secondsPerBeat,
  sampler,
  envelope,
  tieInfo
) {
  const beatDuration = DURATION_TO_BEATS[note.duration];
  if (!beatDuration) {
    console.warn(`Unknown duration: ${note.duration}. Cannot schedule note.`);
    return 0;
  }

  const noteDurationInSeconds = beatDuration * secondsPerBeat;
  const noteStartTime = currentTransportTime + (clefOffset * secondsPerBeat);

  if (!note.isRest) {
    const notesToPlay = note.name
      .replace(/[()]/g, "")
      .split(" ")
      .filter(Boolean);

    // Get the performed duration from the note (defaults to 0.85 if not set)
    const performedDuration = note.performedDuration || drumsState.staccatoTime || 0.85;
    
    // Get the velocity from the note (defaults to 100 if not set)
    const velocity = note.velocity || drumsState.velocity || 100;

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

      // Direct scheduling for offline context
      notesToPlay.forEach((noteName) => {
        sampler.triggerAttackRelease(noteName, audioDurationInSeconds, noteStartTime, velocity / 127);
      });

      envelope.triggerAttack(noteStartTime);
      envelope.triggerRelease(noteStartTime + audioDurationInSeconds);
    }
  }

  return beatDuration;
}

// ===================================================================
// WAV Conversion
// ===================================================================

function bufferToWave(audioBuffer, length) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  const data = new DataView(
    new ArrayBuffer(44 + length * numberOfChannels * bytesPerSample)
  );

  // Write WAV header
  writeString(data, 0, "RIFF");
  data.setUint32(4, 36 + length * numberOfChannels * bytesPerSample, true);
  writeString(data, 8, "WAVE");
  writeString(data, 12, "fmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, format, true);
  data.setUint16(22, numberOfChannels, true);
  data.setUint32(24, sampleRate, true);
  data.setUint32(28, sampleRate * blockAlign, true);
  data.setUint16(32, blockAlign, true);
  data.setUint16(34, bitDepth, true);
  writeString(data, 36, "data");
  data.setUint32(40, length * numberOfChannels * bytesPerSample, true);

  // Write audio data
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
      data.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([data], { type: "audio/wav" });
}

function writeString(dataView, offset, string) {
  for (let i = 0; i < string.length; i++) {
    dataView.setUint8(offset + i, string.charCodeAt(i));
  }
}

// ===================================================================
// File Download
// ===================================================================

function downloadAudioFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function generateFilename() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
  return `composition-${dateStr}-${timeStr}.wav`;
}

// ===================================================================
// UI Integration Functions
// ===================================================================

export function showExportProgress(message = "Rendering audio...") {
  const overlay = document.createElement("div");
  overlay.id = "export-progress-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  const box = document.createElement("div");
  box.style.cssText = `
    background: white;
    padding: 30px 40px;
    border-radius: 8px;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  `;

  const spinner = document.createElement("div");
  spinner.style.cssText = `
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #007bff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
  `;

  const text = document.createElement("p");
  text.textContent = message;
  text.style.cssText = `
    margin: 0;
    font-size: 16px;
    color: #333;
  `;

  const style = document.createElement("style");
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  box.appendChild(spinner);
  box.appendChild(text);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  return overlay;
}

export function hideExportProgress() {
  const overlay = document.getElementById("export-progress-overlay");
  if (overlay) {
    overlay.remove();
  }
}

export function showExportSuccess(filename) {
  const notification = document.createElement("div");
  notification.textContent = `Exported: ${filename}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #28a745;
    color: white;
    padding: 15px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    z-index: 10001;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.transition = "opacity 0.3s";
    notification.style.opacity = "0";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

export function showExportError(error) {
  const notification = document.createElement("div");
  notification.textContent = `❌ Export failed: ${error.message}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #dc3545;
    color: white;
    padding: 15px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    z-index: 10001;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.transition = "opacity 0.3s";
    notification.style.opacity = "0";
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}