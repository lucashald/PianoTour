// scoreRenderer.js
// This module handles rendering the musical score using VexFlow.
// Refactored to use a single, unified system for all note highlighting.

import { getMeasures } from './scoreWriter.js';

// ===================================================================
// Global Variables
// ===================================================================

// --- VexFlow Objects & Score Layout ---
let vexflowNoteMap = [];
let measureXPositions = [];
let vexflowStaveMap = [];
let vfContext = null;
let vexFlowFactory = null;

// --- Unified Highlight & State Management System ---
let originalNoteStyles = new Map(); // Map<noteKey, styleObject>
let activeHighlights = new Map(); // Map<noteKey, {type, color, withShadow}>
let currentSelectedMeasure = -1;
let currentSelectedNote = null; // { measureIndex, clef, noteIndex }

// --- Drag and Drop State ---
let draggedNote = null;
let dragStartPosition = null;
let isDragging = false;

// ===================================================================
// Core Rendering & Interaction
// ===================================================================

/**
 * Renders the entire musical score from scratch. This is a destructive operation.
 * @param {Array} measures - The array of measures data from scoreWriter.
 */
export function drawAll(measures) {
    const out = document.getElementById('score');
    if (!out) {
        console.error("Score rendering element #score not found!");
        return;
    }

    out.innerHTML = '';
    vexflowNoteMap = [];
    measureXPositions = [];
    vexflowStaveMap = [];
    originalNoteStyles.clear();
    activeHighlights.clear();

    const measureToRestore = currentSelectedMeasure;
    const noteToRestore = currentSelectedNote;

    const measureWidth = 340;
    const measureCount = measures.length > 0 ? measures.length : 1;

    if (typeof Vex === 'undefined' || !Vex.Flow) {
        console.error("VexFlow library not loaded.");
        return;
    }

    try {
        vexFlowFactory = new Vex.Flow.Factory({
            renderer: { elementId: 'score', width: measureWidth * measureCount + 20, height: 300 }
        });
        vfContext = vexFlowFactory.getContext();
        const score = vexFlowFactory.EasyScore();
        let currentX = 20;

        for (let i = 0; i < measureCount; i++) {
            measureXPositions.push(currentX);
            const measure = measures[i] || [];
            const trebleNotesData = measure.filter(n => n.clef === 'treble');
            const bassNotesData = measure.filter(n => n.clef === 'bass');

            vexflowNoteMap[i] = { treble: [], bass: [] };

            const trebleSpec = trebleNotesData.length ? trebleNotesData.map(n => `${n.name}/${n.duration}${n.isRest ? '/r' : ''}`).join(', ') : 'B4/1/r';
            const bassSpec = bassNotesData.length ? bassNotesData.map(n => `${n.name}/${n.duration}${n.isRest ? '/r' : ''}`).join(', ') : 'D3/1/r';

            const trebleVexNotes = score.notes(trebleSpec, { clef: 'treble' });
            const bassVexNotes = score.notes(bassSpec, { clef: 'bass' });
            vexflowNoteMap[i].treble = trebleVexNotes;
            vexflowNoteMap[i].bass = bassVexNotes;

            const system = vexFlowFactory.System({ x: currentX, width: measureWidth, spaceBetweenStaves: 10 });
            const staveTreble = system.addStave({ voices: [score.voice(trebleVexNotes).setStrict(false)] });
            const staveBass = system.addStave({ voices: [score.voice(bassVexNotes).setStrict(false)] });
            vexflowStaveMap[i] = { treble: staveTreble, bass: staveBass };

            if (i === 0) {
                staveTreble.addClef('treble').addTimeSignature('4/4');
                staveBass.addClef('bass').addTimeSignature('4/4');
                system.addConnector('brace');
                system.addConnector('singleLeft');
            }
            if (i === measureCount - 1) {
                system.addConnector('boldDoubleRight');
            }
            currentX += measureWidth;
        }

        vexFlowFactory.draw();
        storeOriginalStyles();

        // Restore selection state after the full redraw
        if (measureToRestore !== -1) {
            highlightSelectedMeasure(measureToRestore);
        }
        if (noteToRestore) {
            highlightSelectedNote(noteToRestore.measureIndex, noteToRestore.clef, noteToRestore.noteIndex);
        }

        // Scroll to the end by default
        if (scoreWrap) scoreWrap.scrollLeft = scoreWrap.scrollWidth;

    } catch (e) {
        console.error("VexFlow rendering error:", e);
    }
}

/**
 * A safe redraw that preserves the current selection and all highlight states.
 */
export function safeRedraw() {
    console.log('safeRedraw called');
    const capturedHighlights = new Map(activeHighlights);
    const scoreData = getMeasures();

    drawAll(scoreData);

    capturedHighlights.forEach((highlight, noteKey) => {
        const [measureIndex, clef, noteIndex] = noteKey.split('-').map((v, i) => i === 1 ? v : parseInt(v, 10));
        addHighlight(measureIndex, clef, noteIndex, highlight);
    });
    console.log("✓ Safe redraw completed with highlights preserved");
}

/**
 * Sets up mousedown listeners for note and measure selection.
 * @param {function} onMeasureClick Callback: (measureIndex, wasNoteClicked)
 * @param {function} onNoteClick Callback: (measureIndex, clef, noteIndex)
 */
export function enableScoreInteraction(onMeasureClick, onNoteClick) {
    const scoreElement = document.getElementById('score');
    if (!scoreElement) return;

    scoreElement.addEventListener('mousedown', (event) => {
        isDragging = false;
        const rect = scoreElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const noteInfo = detectNoteClick(x, y);
        if (noteInfo) {
            draggedNote = noteInfo;
            dragStartPosition = { x: event.offsetX, y: event.offsetY };
            onNoteClick(noteInfo.measureIndex, noteInfo.clef, noteInfo.noteIndex);
            onMeasureClick(noteInfo.measureIndex, true);
            return;
        }

        const measureIndex = detectMeasureClick(x, y);
        if (measureIndex !== -1) {
            onMeasureClick(measureIndex, false);
        }
    });
}

// ===================================================================
// Unified Highlighting System
// ===================================================================

/**
 * Applies a highlight to a single note. This is the primary function for all note highlights.
 * @param {number} measureIndex
 * @param {string} clef
 * @param {number} noteIndex
 * @param {object} options - { type: string, color: string, withShadow?: boolean }
 */
export function addHighlight(measureIndex, clef, noteIndex, options) {
    const noteKey = `${measureIndex}-${clef}-${noteIndex}`;
    const { type, color, withShadow = false } = options;

    activeHighlights.set(noteKey, { type, color, withShadow });

    const style = {
        fillStyle: color,
        strokeStyle: color,
        shadowColor: withShadow ? color : null,
        shadowBlur: withShadow ? 15 : 0,
    };

    setVexFlowNoteStyle(measureIndex, clef, noteIndex, style);
}

/**
 * Removes any highlight from a single note, restoring its original style.
 * @param {number} measureIndex
 * @param {string} clef
 * @param {number} noteIndex
 */
export function removeHighlight(measureIndex, clef, noteIndex) {
    const noteKey = `${measureIndex}-${clef}-${noteIndex}`;
    if (!activeHighlights.has(noteKey)) return;

    activeHighlights.delete(noteKey);
    const originalStyle = originalNoteStyles.get(noteKey) || {
        fillStyle: '#000000',
        strokeStyle: '#000000',
        shadowColor: null,
        shadowBlur: 0
    };
    setVexFlowNoteStyle(measureIndex, clef, noteIndex, originalStyle);
}

/**
 * Clears highlights from the score. Can clear all or only those of a specific type.
 * @param {object} [options={}] - { type?: string }
 */
export function clearHighlights(options = {}) {
    const { type } = options;
    const keysToRemove = [];

    activeHighlights.forEach((highlight, noteKey) => {
        if (!type || highlight.type === type) {
            keysToRemove.push(noteKey);
        }
    });

    keysToRemove.forEach(noteKey => {
        const [measureIndex, clef, noteIndex] = noteKey.split('-').map((v, i) => i === 1 ? v : parseInt(v, 10));
        // Use the internal map to remove the highlight, then restore style
        activeHighlights.delete(noteKey);
        const originalStyle = originalNoteStyles.get(noteKey) || { fillStyle: '#000000', strokeStyle: '#000000', shadowColor: null, shadowBlur: 0 };
        setVexFlowNoteStyle(measureIndex, clef, noteIndex, originalStyle);
    });
}

/**
 * Consolidated function for applying styles to a VexFlow note non-destructively.
 * @param {number} measureIndex
 * @param {string} clef
 * @param {number} noteIndex
 * @param {object} style - The VexFlow style object { fillStyle, strokeStyle, shadowColor, shadowBlur }.
 */
function setVexFlowNoteStyle(measureIndex, clef, noteIndex, style) {
    const note = vexflowNoteMap[measureIndex]?.[clef]?.[noteIndex];
    if (!note) {
        console.warn(`Note not found at ${measureIndex}-${clef}-${noteIndex}. Cannot set style.`);
        return;
    }

    const context = note.getContext();
    try {
        note.setStyle(style);
        context.shadowColor = style.shadowColor || null;
        context.shadowBlur = style.shadowBlur || 0;
        note.drawWithStyle();
        context.shadowColor = null;
        context.shadowBlur = 0;
    } catch (e) {
        console.error("Error applying note style:", e);
    }
}

/**
 * Store original COLOR styles for all notes so they can be restored later.
 * This function now correctly ignores shadow properties, which are not stored on the note.
 */
function storeOriginalStyles() {
    console.log('storeOriginalStyles called');
    vexflowNoteMap.forEach((measure, measureIndex) => {
        ['treble', 'bass'].forEach(clef => {
            measure[clef]?.forEach((note, noteIndex) => {
                const noteKey = `${measureIndex}-${clef}-${noteIndex}`;
                const style = note.getStyle() || {};

                // Only store fillStyle and strokeStyle. Do not attempt to store shadow properties.
                originalNoteStyles.set(noteKey, {
                    fillStyle: style.fillStyle || '#000000',
                    strokeStyle: style.strokeStyle || '#000000',
                });
            });
        });
    });
    console.log('storeOriginalStyles output: styles stored');
}

// ===================================================================
// Selected Element Highlighting (Wrappers around the Unified System)
// ===================================================================

/**
 * Highlights a selected measure with green notes and a background overlay.
 * @param {number} measureIndex
 */
export function highlightSelectedMeasure(measureIndex) {
    if (measureIndex < 0 || measureIndex >= vexflowNoteMap.length) return;

    clearHighlights({ type: 'measure' });
    clearMeasureHighlight();

    currentSelectedMeasure = measureIndex;
    addMeasureHighlightOverlay(measureIndex);

    ['treble', 'bass'].forEach(clef => {
        vexflowNoteMap[measureIndex]?.[clef]?.forEach((_note, noteIndex) => {
            const noteKey = `${measureIndex}-${clef}-${noteIndex}`;
            const existingHighlight = activeHighlights.get(noteKey);
            if (!existingHighlight || existingHighlight.type !== 'selection') {
                addHighlight(measureIndex, clef, noteIndex, {
                    type: 'measure',
                    color: '#1db954', // Green
                    withShadow: false
                });
            }
        });
    });
}

/**
 * Highlights a single note as the primary selection (orange).
 * @param {number} measureIndex
 * @param {string} clef
 * @param {number} noteIndex
 */
export function highlightSelectedNote(measureIndex, clef, noteIndex) {
    clearSelectedNoteHighlight();
    currentSelectedNote = { measureIndex, clef, noteIndex };
    removeHighlight(measureIndex, clef, noteIndex); // Remove any 'measure' highlight first
    addHighlight(measureIndex, clef, noteIndex, {
        type: 'selection',
        color: '#ff6b35', // Orange
        withShadow: false
    });
}

/**
 * Clears the highlight from the currently selected note.
 */
export function clearSelectedNoteHighlight() {
    if (!currentSelectedNote) return;

    const { measureIndex, clef, noteIndex } = currentSelectedNote;
    currentSelectedNote = null; // Unset selection first
    removeHighlight(measureIndex, clef, noteIndex);

    // If the cleared note was inside the currently selected measure, restore its green highlight.
    if (measureIndex === currentSelectedMeasure) {
        addHighlight(measureIndex, clef, noteIndex, {
            type: 'measure',
            color: '#1db954', // Green
            withShadow: false
        });
    }
}

/**
 * Clears the DOM-based background highlight for a measure.
 */
export function clearMeasureHighlight() {
    const existingHighlight = document.querySelector('[id^="measure-highlight-"]');
    if (existingHighlight) {
        existingHighlight.remove();
    }
    if (currentSelectedMeasure !== -1) {
        clearHighlights({ type: 'measure' });
        currentSelectedMeasure = -1;
    }
}

/**
 * Adds a DOM overlay to create a background for the selected measure.
 * @param {number} measureIndex
 */
function addMeasureHighlightOverlay(measureIndex) {
    const scoreElement = document.getElementById('score');
    if (!scoreElement) return;

    const overlayId = `measure-highlight-${measureIndex}`;
    const existingOverlay = document.getElementById(overlayId);
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.style.cssText = `
        position: absolute;
        left: ${measureXPositions[measureIndex]}px;
        top: 20px;
        width: 340px;
        height: 260px;
        background-color: rgba(0, 0, 0, 0.08);
        border: 1px solid rgba(0, 0, 0, 0.2);
        pointer-events: none;
        border-radius: 4px;
        box-sizing: border-box;
    `;
    scoreElement.style.position = 'relative';
    scoreElement.appendChild(overlay);
}

// ===================================================================
// Playback Highlighting (Public API for scorePlayback.js)
// ===================================================================

export function addPlaybackHighlight(measureIndex, clef, noteIndex, color) {
    addHighlight(measureIndex, clef, noteIndex, { type: 'playback', color, withShadow: true });
}

export function removePlaybackHighlight(measureIndex, clef, noteIndex) {
    const noteKey = `${measureIndex}-${clef}-${noteIndex}`;
    const currentHighlight = activeHighlights.get(noteKey);
    if (currentHighlight?.type === 'playback') {
        removeHighlight(measureIndex, clef, noteIndex);
    }
}

export function clearAllHighlights() {
    clearHighlights({ type: 'playback' });
}

// ===================================================================
// Utility & Helper Functions
// ===================================================================

/**
 * Fully resets all highlights and selections to their default state.
 */
export function resetAllNoteStyles() {
    clearHighlights();
    clearMeasureHighlight();
    currentSelectedNote = null;
    currentSelectedMeasure = -1;
    console.log('resetAllNoteStyles output: all note styles and highlights reset');
}

function detectNoteClick(x, y) {
    for (let i = 0; i < vexflowNoteMap.length; i++) {
        for (const clef of ['treble', 'bass']) {
            if (vexflowNoteMap[i]?.[clef]) {
                for (let j = 0; j < vexflowNoteMap[i][clef].length; j++) {
                    const note = vexflowNoteMap[i][clef][j];
                    const bbox = note.getBoundingBox();
                    if (bbox && x >= bbox.x && x <= bbox.x + bbox.w && y >= bbox.y && y <= bbox.y + bbox.h) {
                        return { measureIndex: i, clef, noteIndex: j };
                    }
                }
            }
        }
    }
    return null;
}

function detectMeasureClick(x, y) {
    for (let i = 0; i < measureXPositions.length; i++) {
        const measureX = measureXPositions[i];
        if (x >= measureX && x <= measureX + 340 && y >= 20 && y <= 280) {
            return i;
        }
    }
    return -1;
}

export function enableNoteDragDrop() {
    const scoreElement = document.getElementById('score');
    if (!scoreElement) return;

    scoreElement.addEventListener('mousemove', (event) => {
        if (draggedNote && !isDragging) {
            const dx = event.offsetX - dragStartPosition.x;
            const dy = event.offsetY - dragStartPosition.y;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                isDragging = true;
                scoreElement.style.cursor = 'grabbing';
            }
        }
    });

    scoreElement.addEventListener('mouseup', (event) => {
        if (!draggedNote) return;

        if (isDragging) {
            const dropTargetMeasureIndex = detectMeasureClick(event.offsetX, event.offsetY);
            if (dropTargetMeasureIndex !== -1 && dropTargetMeasureIndex !== draggedNote.measureIndex) {
                document.dispatchEvent(new CustomEvent('noteDropped', {
                    detail: {
                        fromMeasureIndex: draggedNote.measureIndex,
                        clef: draggedNote.clef,
                        noteIndex: draggedNote.noteIndex,
                        toMeasureIndex: dropTargetMeasureIndex,
                    },
                }));
            }
        }
        draggedNote = null;
        dragStartPosition = null;
        isDragging = false;
        scoreElement.style.cursor = 'default';
    });
}

export function scrollToMeasure(measureIndex) {
    const scoreWrap = document.getElementById('scoreWrap');
    const measureWidth = 340;
    
    if (scoreWrap && measureXPositions[measureIndex] !== undefined) {
        const targetScrollLeft = Math.max(
            0, 
            measureXPositions[measureIndex] - (scoreWrap.clientWidth / 2) + (measureWidth / 2)
        );
        
        scoreWrap.scrollTo({
            left: targetScrollLeft,
            behavior: 'smooth'
        });
    }
}

// --- Getters for external modules ---
export function getVexFlowNoteMap() { return vexflowNoteMap; }
export function getMeasureXPositions() { return measureXPositions; }
export function getVexFlowStaveMap() { return vexflowStaveMap; }
export function getVexFlowContext() { return vfContext; }
export function getVexFlowFactory() { return vexFlowFactory; }

console.log("✓ scoreRenderer.js (Refactored) loaded successfully");