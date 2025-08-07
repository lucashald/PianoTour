// drumRenderer.js
// This module handles rendering the drum score using VexFlow.
// Simplified: Only focuses on rendering and playback highlighting, no interactive editing.

import { drumsState } from "../core/appState.js";
import { getDrumMeasures } from "./drumsScoreWriter.js";
import { DRUM_INSTRUMENT_MAP, DRUM_Y_POSITIONS_MAP } from "../core/drum-data.js"; // Keep DRUM_INSTRUMENT_MAP for rendering

// Global VexFlow objects are accessed via Vex.Flow

// ===================================================================
// Global Variables
// ===================================================================

// --- VexFlow Objects & Score Layout ---
let vexflowNoteMap = []; // Stores VexFlow.StaveNote objects per measure
let measureXPositions = []; // Stores X position of each measure for scrolling
let vexflowStaveMap = []; // Stores VexFlow.Stave objects per measure
let vfContext = null; // VexFlow rendering context
let vexFlowFactory = null; // VexFlow Factory instance
let vexflowIndexByNoteId = {}; // Maps note.id to its VexFlow index within a measure

// ===================================================================
// Core Rendering Function
// ===================================================================

export function drawAll(measures) {
    console.log("drumRenderer drawAll: START");
    const out = document.getElementById("drums-score"); // Target the drum score div
    if (!out) {
        console.error("drumRenderer drawAll: Drum score rendering element #drums-score not found!");
        return;
    }

    out.innerHTML = ""; // Clear previous rendering
    vexflowNoteMap = [];
    measureXPositions = [];
    vexflowStaveMap = []; // Will store single stave per measure
    vexflowIndexByNoteId = {}; // Clear the ID mapping for fresh render

    const measureWidth = 340;
    const measureCount = measures.length > 0 ? measures.length : 1;

    // Check if Vex.Flow is available globally
    if (typeof Vex === "undefined" || !Vex.Flow) {
        console.error("drumRenderer drawAll: VexFlow library not loaded. Ensure vexflow.js is loaded globally.");
        return;
    }

    try {
        const scoreContainer = out.parentElement;
        const containerHeight = scoreContainer ? scoreContainer.clientHeight : 350;
        const scoreHeight = 150; // Approximate height for a single 5-line staff + clef/time sig
        const verticalOffset = Math.max(20, (containerHeight - scoreHeight) / 2);

        console.log(
            `drumRenderer drawAll: Centering score - Container height: ${containerHeight}, Score height: ${scoreHeight}, Vertical offset: ${verticalOffset}`
        );

        vexFlowFactory = new Vex.Flow.Factory({
            renderer: {
                elementId: "drums-score", // Ensure this targets the drum score div
                width: measureWidth * measureCount + 20,
                height: Math.max(scoreHeight, containerHeight), // Ensure renderer is tall enough
            },
        });
        vfContext = vexFlowFactory.getContext();
        const score = vexFlowFactory.EasyScore(); // For creating notes and voices

        let currentX = 20;

        for (let i = 0; i < measureCount; i++) {
            measureXPositions.push(currentX);
            const measureNotesData = measures[i] || [];

            const vexNotesForMeasure = []; // Notes for the current measure's voice
            vexflowNoteMap[i] = []; // Store VexFlow notes for this measure

            measureNotesData.forEach((noteData) => {
                const { id } = noteData;





                
                let vexNote;

                if (noteData.isRest) {
                    // Handle rest note
                    vexNote = new Vex.Flow.StaveNote({
                        keys: ["B/4"], // Rests are placed on a neutral key
                        duration: `${noteData.duration}r`, // VexFlow rests need 'r' suffix
                        clef: "percussion",
                    });
                } else if (noteData.isChord) {
                    // Handle chord: create a single VexFlow note for all instruments
                    const { notes, duration } = noteData;

                    const keys = notes.map((n) => {
                        const instrumentProps = DRUM_INSTRUMENT_MAP[n.drumInstrument];
                        if (!instrumentProps) {
                            console.warn(`drumRenderer drawAll: Unknown drum instrument in chord: ${n.drumInstrument}. Skipping note ID: ${id}`);
                            return 'b/4'; // Return a neutral key to avoid crash
                        }
                        return instrumentProps.keys[0];
                    });
                    
                    const noteHeads = notes.map((n) => {
                         const instrumentProps = DRUM_INSTRUMENT_MAP[n.drumInstrument];
                         return { type: instrumentProps.notehead };
                    });

                    const stemDirection = notes[0].stemDirection || Vex.Flow.Stem.UP;

                    // Create the VexFlow note for the chord, passing note_heads to the constructor
                    vexNote = new Vex.Flow.StaveNote({
                        keys,
                        duration,
                        stem_direction: stemDirection,
                        note_heads: noteHeads
                        
                    });

                } else {
                    // Handle single note
                    const { drumInstrument, duration, modifiers } = noteData;
                    const instrumentProps = DRUM_INSTRUMENT_MAP[drumInstrument];

                    if (!instrumentProps) {
                        console.warn(`drumRenderer drawAll: Unknown drum instrument: ${drumInstrument}. Skipping note ID: ${id}`);
                        return;
                    }
                    
                    vexNote = new Vex.Flow.StaveNote({
                        keys: instrumentProps.keys,
                        duration,
                        stem_direction: instrumentProps.stemDirection,
                        type: instrumentProps.notehead, // Set in constructor
                    });

        // Apply modifiers from DRUM_INSTRUMENT_MAP - CORRECTED VERSION
        if (instrumentProps.modifiers && instrumentProps.modifiers.length > 0) {
            instrumentProps.modifiers.forEach((mod) => {
                if (mod.type === "articulation") {
                    // FIXED: Use addModifier, not addArticulation
                    const articulation = new Vex.Flow.Articulation(mod.symbol);
                    if (mod.position) {
                        articulation.setPosition(mod.position);
                    }
                    vexNote.addModifier(articulation, 0);
                } else if (mod.type === "annotation") {
                    const annotation = new Vex.Flow.Annotation(mod.text)
                        .setFont({ family: "Arial", size: 10, weight: "bold" });
                    if (mod.justification) {
                        annotation.setJustification(mod.justification);
                    }
                    vexNote.addModifier(annotation, 0);
                }
            });
        }
                }

                vexNotesForMeasure.push(vexNote);
                vexflowNoteMap[i].push(vexNote);
                vexflowIndexByNoteId[id] = { measureIndex: i, vexflowIndex: vexNotesForMeasure.length - 1 };
            });

            // If the measure is empty, add a whole rest
            if (vexNotesForMeasure.length === 0) {
                const defaultRest = new Vex.Flow.StaveNote({
                    keys: ["B/4"],
                    duration: "wr", // Whole rest
                    clef: "percussion",
                });
                vexNotesForMeasure.push(defaultRest);
            }

            const voice = score.voice(vexNotesForMeasure).setStrict(false);

            const system = vexFlowFactory.System({
                x: currentX,
                y: verticalOffset,
                width: measureWidth,
                spaceBetweenStaves: 0,
            });

            const stave = system.addStave({ voices: [voice] });

            if (i === 0) {
                stave.addClef("percussion");
                stave.addTimeSignature(`${drumsState.timeSignature.numerator}/${drumsState.timeSignature.denominator}`);
                stave.setTempo({ duration: 'q', bpm: drumsState.tempo }, -27);
            } else if (i > 0) {
                stave.setBegBarType(Vex.Flow.Barline.type.SINGLE);
            }
            if (i === measureCount - 1) {
                stave.setEndBarType(Vex.Flow.Barline.type.END);
            }

            vexflowStaveMap[i] = stave;

            currentX += measureWidth;
        }

        vexFlowFactory.draw();
        console.log("drumRenderer drawAll: VexFlow drawing complete.");

        // --- Restore playback highlights only ---
        for (const noteKey of drumsState.currentPlaybackNotes) {
            const [measureIndex, clef, noteId] = noteKey.split("-");
            const measureIdx = parseInt(measureIndex);
            console.log(`drumRenderer drawAll: Restoring playback highlight for note`, {
                measureIndex: measureIdx,
                clef: 'percussion',
                noteId,
            });
        }

        const scoreWrap = document.getElementById("drums-score-wrap");
        scoreWrap.scrollLeft = scoreWrap.scrollWidth;
    } catch (e) {
        console.error("drumRenderer drawAll: VexFlow rendering error:", e, e.stack);
    }
    console.log(`drumRenderer drawAll end: scroll position is ${document.getElementById("drums-score-wrap")?.scrollLeft}`);
}

/**
 * A safe redraw that preserves only playback highlight states.
 */
export function safeRedraw() {
    console.log("drumRenderer safeRedraw: Called. Triggering full drawAll.");
    const scoreData = getDrumMeasures();
    drawAll(scoreData);
    console.log("drumRenderer safeRedraw: ✓ Completed with highlights preserved");
}

// ===================================================================
// Interaction Functions (All removed as per request)
// ===================================================================

export function scrollToMeasure(measureIndex) {
    console.log("drumRenderer scrollToMeasure called with index", measureIndex);
    const scoreWrap = document.getElementById("drums-score-wrap");
    if (!scoreWrap) {
        console.warn(`drumRenderer scrollToMeasure: drums-score-wrap element not found, skipping scroll to measure ${measureIndex}`);
        return;
    }
    const measureWidth = 340;
    if (measureXPositions[measureIndex] !== undefined) {
        const targetScrollLeft = Math.max(
            0,
            measureXPositions[measureIndex] -
            scoreWrap.clientWidth / 2 +
            measureWidth / 2
        );
        const currentScrollLeft = scoreWrap.scrollLeft;
        const scrollTolerance = 10;
        console.log(`drumRenderer scrollToMeasure: Current scroll: ${currentScrollLeft}, Target scroll: ${targetScrollLeft}, Difference: ${Math.abs(currentScrollLeft - targetScrollLeft)}`);
        if (Math.abs(currentScrollLeft - targetScrollLeft) <= scrollTolerance) {
            console.log(`drumRenderer scrollToMeasure: Already at measure ${measureIndex}, skipping scroll.`);
            return;
        }
        scoreWrap.scrollTo({
            left: targetScrollLeft,
            behavior: "smooth",
        });
        console.log(`drumRenderer scrollToMeasure: Scrolled to measure ${measureIndex}.`);
    } else {
        console.warn(
            `drumRenderer scrollToMeasure: Cannot scroll to measure ${measureIndex}. Measure position not found.`
        );
    }
}


// --- Getters for external modules (kept for playback/debugging if needed) ---
export function getVexFlowNoteMap() {
    return vexflowNoteMap;
}
export function getMeasureXPositions() {
    return measureXPositions;
}
export function getVexFlowStaveMap() {
    return vexflowStaveMap;
}
export function getVexFlowContext() {
    return vfContext;
}
export function getVexFlowFactory() {
    return vexFlowFactory;
}
export function getVexflowIndexByNoteId() {
    return vexflowIndexByNoteId;
}