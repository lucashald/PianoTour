// printRenderer.js
// Print-optimized score rendering using the core scoreRenderer logic
// This module arranges measures into systems (lines) suitable for printing

import { pianoState } from "../core/appState.js";
import {
  getCurrentVexFlowKeySignature,
} from "../core/note-data.js";
import { populateChordNames } from "./scoreWriter.js";

// Print layout constants
export let displayChordName = true;
export function setDisplayChordName(value) { displayChordName = value; }
const MEASURES_PER_LINE = 2;
const MEASURE_WIDTH = 340; // Match scoreRenderer.js measure width
const SYSTEM_HEIGHT = 250;
const SYSTEM_Y_START = 20;

/**
 * Renders the score in a print-optimized layout with multiple systems
 * @param {string} containerId - ID of the container element to render into
 * @param {Array} measures - Array of measure data
 */
export async function drawAllPrint(containerId, measures) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('drawAllPrint: Container element not found:', containerId);
    return;
  }

  container.innerHTML = '';

  if (!measures || measures.length === 0) {
    container.innerHTML = '<div class="message">No measures to render.</div>';
    return;
  }

  // Ensure all notes have chordName populated (use short symbol form for annotations)
  populateChordNames(measures, true);

  if (typeof Vex === 'undefined' || !Vex.Flow) {
    console.error('drawAllPrint: VexFlow library not loaded.');
    container.innerHTML = '<div class="message error">VexFlow library not loaded.</div>';
    return;
  }

  const totalMeasures = measures.length;
  const systemCount = Math.ceil(totalMeasures / MEASURES_PER_LINE);

  // Storage for ties and beams (similar to scoreRenderer.js)
  const tieGroups = [];
  const vexflowBeams = [];
  const vexflowNoteMap = [];
  const vexflowIndexByNoteId = {};

  // Group measures into systems (lines)
  for (let systemIndex = 0; systemIndex < systemCount; systemIndex++) {
    const startMeasure = systemIndex * MEASURES_PER_LINE;
    const endMeasure = Math.min(startMeasure + MEASURES_PER_LINE, totalMeasures);
    const systemMeasures = measures.slice(startMeasure, endMeasure);
    const measuresInThisSystem = systemMeasures.length;

    // Create container for this system
    const systemDiv = document.createElement('div');
    systemDiv.className = 'score-system';
    systemDiv.id = `system-${systemIndex}`;
    container.appendChild(systemDiv);

    try {
      // Always use full line width so partial systems have proper note spacing
      const systemWidth = MEASURE_WIDTH * MEASURES_PER_LINE + 40;
      const factory = new Vex.Flow.Factory({
        renderer: {
          elementId: systemDiv.id,
          width: systemWidth,
          height: SYSTEM_HEIGHT,
        },
      });

      const context = factory.getContext();
      const score = factory.EasyScore();
      let currentX = 20;

      // Collect all voices for accidental application
      const allVoices = [];

      // Render each measure in this system
      for (let i = 0; i < measuresInThisSystem; i++) {
        const absoluteMeasureIndex = startMeasure + i;
        const measure = systemMeasures[i];

        const trebleNotesData = measure.filter(n => n.clef === 'treble');
        const bassNotesData = measure.filter(n => n.clef === 'bass');

        // Initialize storage for this measure
        vexflowNoteMap[absoluteMeasureIndex] = { treble: [], bass: [] };

        // Helper to get VexFlow duration (remove dots from rests)
        const getVexFlowDuration = (note) => {
          if (note.isRest && note.duration.includes('.')) {
            return note.duration.replace('.', '');
          }
          return note.duration;
        };

        // Build note specs
        const trebleSpec = trebleNotesData.length
          ? trebleNotesData.map(n => `${n.name}/${getVexFlowDuration(n)}${n.isRest ? '/r' : ''}`).join(', ')
          : 'B4/1/r';

        const bassSpec = bassNotesData.length
          ? bassNotesData.map(n => `${n.name}/${getVexFlowDuration(n)}${n.isRest ? '/r' : ''}`).join(', ')
          : 'D3/1/r';

        const trebleVexNotes = score.notes(trebleSpec, { clef: 'treble' });
        const bassVexNotes = score.notes(bassSpec, { clef: 'bass' });

        // Add chord name annotations
        if (displayChordName) {
          trebleNotesData.forEach((noteData, idx) => {
            if (noteData.chordName && trebleVexNotes[idx]) {
              const annotation = new Vex.Flow.Annotation(noteData.chordName)
                .setFont({ family: 'Arial', size: 12, weight: 'bold' })
                .setVerticalJustification(Vex.Flow.Annotation.VerticalJustify.BOTTOM);
              trebleVexNotes[idx].addModifier(annotation, 0);
            }
          });
          bassNotesData.forEach((noteData, idx) => {
            if (noteData.chordName && bassVexNotes[idx]) {
              const annotation = new Vex.Flow.Annotation(noteData.chordName)
                .setFont({ family: 'Arial', size: 12, weight: 'bold' })
                .setVerticalJustification(Vex.Flow.Annotation.VerticalJustify.BOTTOM);
              bassVexNotes[idx].addModifier(annotation, 0);
            }
          });
        }

        vexflowNoteMap[absoluteMeasureIndex].treble = trebleVexNotes;
        vexflowNoteMap[absoluteMeasureIndex].bass = bassVexNotes;

        // Create beams if beaming is enabled
        if (pianoState.enableBeaming) {
          vexflowBeams[absoluteMeasureIndex] = {};
          if (trebleNotesData.length > 0) {
            vexflowBeams[absoluteMeasureIndex].treble = createBeamsForNotes(trebleVexNotes, trebleNotesData);
          }
          if (bassNotesData.length > 0) {
            vexflowBeams[absoluteMeasureIndex].bass = createBeamsForNotes(bassVexNotes, bassNotesData);
          }
        }

        // Process ties for this measure
        if (trebleNotesData.length > 0) {
          processTies(trebleNotesData, tieGroups);
        }
        if (bassNotesData.length > 0) {
          processTies(bassNotesData, tieGroups);
        }

        // Build ID to VexFlow index mapping
        trebleNotesData.forEach((noteData, vexflowIndex) => {
          if (noteData.id) {
            vexflowIndexByNoteId[noteData.id] = {
              measureIndex: absoluteMeasureIndex,
              clef: 'treble',
              index: vexflowIndex
            };
          }
        });

        bassNotesData.forEach((noteData, vexflowIndex) => {
          if (noteData.id) {
            vexflowIndexByNoteId[noteData.id] = {
              measureIndex: absoluteMeasureIndex,
              clef: 'bass',
              index: vexflowIndex
            };
          }
        });

        const trebleVoice = score.voice(trebleVexNotes).setStrict(false);
        const bassVoice = score.voice(bassVexNotes).setStrict(false);
        allVoices.push(trebleVoice, bassVoice);

        // Create system — use full line width for partial systems
        const effectiveMeasureWidth = measuresInThisSystem < MEASURES_PER_LINE
          ? MEASURE_WIDTH * MEASURES_PER_LINE
          : MEASURE_WIDTH;
        const system = factory.System({
          x: currentX,
          y: SYSTEM_Y_START,
          width: effectiveMeasureWidth,
          spaceBetweenStaves: 10,
        });

        const staveTreble = system.addStave({ voices: [trebleVoice] });
        const staveBass = system.addStave({ voices: [bassVoice] });

        // Add clef, key signature, time signature on first measure of each system
        if (i === 0) {
          const timeSignature = `${pianoState.timeSignature.numerator}/${pianoState.timeSignature.denominator}`;
          staveTreble.addClef('treble').addTimeSignature(timeSignature);
          staveBass.addClef('bass').addTimeSignature(timeSignature);

          const keySignature = getCurrentVexFlowKeySignature();
          staveTreble.addKeySignature(keySignature);
          staveBass.addKeySignature(keySignature);

          system.addConnector('brace');
          system.addConnector('singleLeft');

          // Add tempo on first system only
          if (systemIndex === 0) {
            staveTreble.setTempo({ duration: 'q', bpm: pianoState.tempo }, -27);
          }
        }

        // Add end bar on last measure of entire score
        if (absoluteMeasureIndex === totalMeasures - 1) {
          system.addConnector('boldDoubleRight');
        }

        currentX += MEASURE_WIDTH;
      }

      // Apply accidentals based on key signature
      const keySignature = getCurrentVexFlowKeySignature();
      Vex.Flow.Accidental.applyAccidentals(allVoices, keySignature);

      // Draw the system
      factory.draw();

      // Draw beams for this system
      if (pianoState.enableBeaming) {
        for (let i = 0; i < measuresInThisSystem; i++) {
          const absoluteMeasureIndex = startMeasure + i;
          const measureBeams = vexflowBeams[absoluteMeasureIndex];
          if (measureBeams && context) {
            if (measureBeams.treble && measureBeams.treble.length > 0) {
              measureBeams.treble.forEach(beam => beam.setContext(context).draw());
            }
            if (measureBeams.bass && measureBeams.bass.length > 0) {
              measureBeams.bass.forEach(beam => beam.setContext(context).draw());
            }
          }
        }
      }

      // Draw ties for this system
      drawTies(context, tieGroups, vexflowNoteMap, vexflowIndexByNoteId);

    } catch (error) {
      console.error(`Error rendering system ${systemIndex}:`, error);
      systemDiv.innerHTML = `<div class="error">Error rendering measures ${startMeasure + 1}-${endMeasure}: ${error.message}</div>`;
    }
  }
}

/**
 * Creates beams for a set of notes
 * @param {Array} vexNotes - VexFlow note objects
 * @param {Array} notesData - Original note data
 * @returns {Array} Array of VexFlow beam objects
 */
function createBeamsForNotes(vexNotes, notesData) {
  if (vexNotes.length < 2) {
    return [];
  }

  const beams = Vex.Flow.Beam.generateBeams(vexNotes, {
    beam_rests: false,
    maintain_stem_directions: true,
    groups: []
  });

  return beams;
}

/**
 * Processes tie data from note objects
 * @param {Array} notesData - Array of note data objects
 * @param {Array} tieGroups - Array to store tie information
 */
function processTies(notesData, tieGroups) {
  notesData.forEach((noteData) => {
    if (noteData.tie) {
      if (noteData.tie.startNoteId && noteData.tie.endNoteId) {
        // Check if this tie already exists
        const tieExists = tieGroups.some(existingTie =>
          existingTie.startNoteId === noteData.tie.startNoteId &&
          existingTie.endNoteId === noteData.tie.endNoteId
        );

        if (!tieExists) {
          tieGroups.push({
            type: noteData.tie.type || 'tie',
            startNoteId: noteData.tie.startNoteId,
            endNoteId: noteData.tie.endNoteId
          });
        }
      }
    }
  });
}

/**
 * Draws all ties and slurs
 * @param {Object} context - VexFlow rendering context
 * @param {Array} tieGroups - Array of tie information
 * @param {Array} vexflowNoteMap - Map of VexFlow notes by measure
 * @param {Object} vexflowIndexByNoteId - Map of note IDs to their positions
 */
function drawTies(context, tieGroups, vexflowNoteMap, vexflowIndexByNoteId) {
  if (tieGroups.length === 0) return;

  // Build a lookup map from note ID to VexFlow note object
  const vexNotesById = {};

  for (const noteId in vexflowIndexByNoteId) {
    const noteInfo = vexflowIndexByNoteId[noteId];
    const vexNote = vexflowNoteMap[noteInfo.measureIndex]?.[noteInfo.clef]?.[noteInfo.index];
    if (vexNote) {
      vexNotesById[noteId] = vexNote;
    }
  }

  // Draw each tie/slur
  tieGroups.forEach(tie => {
    const startVexNote = vexNotesById[tie.startNoteId];
    const endVexNote = vexNotesById[tie.endNoteId];

    if (startVexNote && endVexNote) {
      if (tie.type === 'tie') {
        const staveTie = new Vex.Flow.StaveTie({
          first_note: startVexNote,
          last_note: endVexNote,
          first_indices: [0],
          last_indices: [0]
        });
        staveTie.setContext(context).draw();
      } else if (tie.type === 'slur') {
        const curve = new Vex.Flow.Curve(startVexNote, endVexNote, {
          x_shift: -1,
          y_shift: 10,
          position: Vex.Flow.Stem.UP,
          position_end: Vex.Flow.Stem.UP,
        });
        curve.setContext(context).draw();
      }
    } else {
      console.warn('Could not find start/end notes for tie:', tie);
    }
  });
}
