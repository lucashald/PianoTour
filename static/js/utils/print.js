// print.js
// Simplified score renderer optimized for printing
// Now uses the UniversalMusicRenderer class for multi-system layout

import { UniversalMusicRenderer } from '../classes/UniversalMusicRenderer.js';

// Configuration
const MEASURES_PER_SYSTEM = 3;
const MEASURE_WIDTH = 340;

/**
 * Renders the score in a print-friendly multi-system layout
 * by leveraging the UniversalMusicRenderer class.
 * @param {Array} measures - Array of measure data from getMeasures()
 * @param {Object} options - Options to pass to the renderer (e.g., instrument type)
 */
export function renderPrintScore(measures, options = {}) {
    console.log("renderPrintScore: START");
    const out = document.getElementById("score");
    if (!out) {
        console.error("renderPrintScore: Score rendering element #score not found!");
        return;
    }

    out.innerHTML = "";

    if (typeof Vex === "undefined" || !Vex.Flow) {
        out.innerHTML = '<div class="error">VexFlow library not loaded.</div>';
        console.error("renderPrintScore: VexFlow library not loaded.");
        return;
    }

    try {
        const renderer = new UniversalMusicRenderer("score", {
            measuresPerSystem: MEASURES_PER_SYSTEM,
            measureWidth: MEASURE_WIDTH,
            // Merge additional options, ensuring they don't overwrite the print-specific ones
            ...options
        });
        renderer.render(measures);
        console.log("renderPrintScore: All systems rendered successfully.");
    } catch (e) {
        console.error("renderPrintScore: Rendering error:", e);
        out.innerHTML = `<div class="error">Rendering error: ${e.message}</div>`;
    }

    console.log("renderPrintScore: END");
}

console.log("✓ print.js loaded successfully");