// print.js
// Simplified score renderer optimized for printing
// Creates multi-system layout with line breaks every 3 measures

import { getCurrentVexFlowKeySignature } from '../core/note-data.js';

// Configuration
const MEASURES_PER_SYSTEM = 3;

/**
 * Renders the score in a print-friendly multi-system layout
 * Each system contains up to 3 measures and is rendered in a separate div
 * @param {Array} measures - Array of measure data from getMeasures()
 */
export function renderPrintScore(measures) {
  console.log("renderPrintScore: START");
  const out = document.getElementById("score");
  if (!out) {
    console.error("renderPrintScore: Score rendering element #score not found!");
    return;
  }

  out.innerHTML = "";

  const measureWidth = 340;
  const measureCount = measures.length > 0 ? measures.length : 1;
  const systemCount = Math.ceil(measureCount / MEASURES_PER_SYSTEM);

  if (typeof Vex === "undefined" || !Vex.Flow) {
    console.error("renderPrintScore: VexFlow library not loaded.");
    return;
  }

  try {
    // Process each system (line of measures)
    for (let systemIndex = 0; systemIndex < systemCount; systemIndex++) {
      const startMeasure = systemIndex * MEASURES_PER_SYSTEM;
      const endMeasure = Math.min(startMeasure + MEASURES_PER_SYSTEM, measureCount);
      const systemMeasures = measures.slice(startMeasure, endMeasure);
      const measuresInSystem = systemMeasures.length;

      // Create div for this system
      const systemDiv = document.createElement('div');
      systemDiv.id = `system-${systemIndex}`;
      out.appendChild(systemDiv);

      // Create VexFlow Factory for this system
      const systemFactory = new Vex.Flow.Factory({
        renderer: {
          elementId: `system-${systemIndex}`,
          width: measureWidth * measuresInSystem + 20,
          height: 200,
        },
      });

      const systemContext = systemFactory.getContext();
      const score = systemFactory.EasyScore();
      const allVoices = []; // Collect voices for accidentals
      let currentX = 20;

      // Process each measure in this system
      for (let localIndex = 0; localIndex < measuresInSystem; localIndex++) {
        const measure = systemMeasures[localIndex];
        const globalIndex = startMeasure + localIndex;

        // Filter notes by clef
        const trebleNotesData = measure.filter((n) => n.clef === "treble");
        const bassNotesData = measure.filter((n) => n.clef === "bass");

        // Build VexFlow note specifications
        const trebleSpec = trebleNotesData.length
          ? trebleNotesData
              .map((n) => `${n.name}/${n.duration}${n.isRest ? "/r" : ""}`)
              .join(", ")
          : "B4/1/r";
        const bassSpec = bassNotesData.length
          ? bassNotesData
              .map((n) => `${n.name}/${n.duration}${n.isRest ? "/r" : ""}`)
              .join(", ")
          : "D3/1/r";

        // Create VexFlow notes and voices
        const trebleVexNotes = score.notes(trebleSpec, { clef: "treble" });
        const bassVexNotes = score.notes(bassSpec, { clef: "bass" });

        const trebleVoice = score.voice(trebleVexNotes).setStrict(false);
        const bassVoice = score.voice(bassVexNotes).setStrict(false);
        allVoices.push(trebleVoice, bassVoice);

        // Create system for this measure
        const system = systemFactory.System({
          x: currentX,
          width: measureWidth,
          spaceBetweenStaves: 10,
        });

        // Add staves to system
        const staveTreble = system.addStave({ voices: [trebleVoice] });
        const staveBass = system.addStave({ voices: [bassVoice] });

        // Add clefs and key signatures to first measure of each system
        if (localIndex === 0) {
          const keySignature = getCurrentVexFlowKeySignature();
          staveTreble.addClef("treble").addKeySignature(keySignature);
          staveBass.addClef("bass").addKeySignature(keySignature);
          system.addConnector("brace");
          system.addConnector("singleLeft");
        }
        
        // Add end connectors to last measure of each system
        if (localIndex === measuresInSystem - 1) {
          if (systemIndex === systemCount - 1) {
            // Last measure of last system
            system.addConnector("boldDoubleRight");
          } else {
            // Last measure of any other system
            system.addConnector("thinDouble");
          }
        }

        currentX += measureWidth;
      }

      // Apply accidentals based on key signature
      const keySignature = getCurrentVexFlowKeySignature();
      Vex.Flow.Accidental.applyAccidentals(allVoices, keySignature);

      // Draw this system
      systemFactory.draw();
      console.log(`renderPrintScore: System ${systemIndex + 1} of ${systemCount} rendered`);
    }

    console.log("renderPrintScore: All systems rendered successfully");
  } catch (e) {
    console.error("renderPrintScore: VexFlow rendering error:", e);
  }

  console.log("renderPrintScore: END");
}

console.log("✓ print.js loaded successfully");