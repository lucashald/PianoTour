// paletteHelpers.js
// Handles palette interactions for both drag mode and click mode

import { pianoState } from '../core/appState.js';
import { setPaletteDragState } from '../score/scoreRenderer.js';
import { writeNote } from '../score/scoreWriter.js';
import { getChordByDegree } from '../core/note-data.js';
import { triggerAttackRelease } from '../instrument/playbackHelpers.js';

/**
 * Handle palette item click in click mode (non-drag mode)
 * Immediately plays the note/chord and writes it to the score
 */
function handlePaletteClick(event) {
    const item = event.currentTarget;
    const type = item.dataset.type;
    const duration = item.dataset.duration || pianoState.quantize;
    const degree = item.dataset.degree;
    const intervalType = item.dataset.interval;
    
    // Visual feedback - briefly highlight the clicked item
    item.classList.add('palette-note-selected');
    setTimeout(() => {
        item.classList.remove('palette-note-selected');
    }, 200);
    
    if (type === 'rest') {
        // Write a rest to the score (no sound to play)
        handleRestClick(duration);
    } else if (type === 'chord') {
        // Handle chord - get the chord object and play/write it
        handleChordClick(item, degree, duration);
    } else if (type === 'interval') {
        // Handle interval - intervals need a root note, so just set the mode
        // For now, we'll skip intervals in click mode since they need a target note
        console.log(`Interval ${intervalType} selected - use drag mode for intervals`);
    } else if (type === 'note') {
        // Handle note duration click - this sets the duration for subsequent keyboard input
        // Since we don't know what note to play, just update the quantize
        pianoState.quantize = duration;
        updateQuantizeButtonDisplay(duration);
        console.log(`Note duration set to: ${duration}`);
    }
}

/**
 * Handle rest palette item click - writes a rest to the score
 */
function handleRestClick(duration) {
    // Determine clef based on current selection or default to treble
    
    writeNote({
        clef: 'treble',
        duration: duration,
        notes: ['B4'],
        chordName: "Rest",
        isRest: true
    });
    
    console.log(`Rest written: duration=${duration}, clef=${clef}`);
}

/**
 * Handle chord palette item click - plays and writes the chord
 */
function handleChordClick(item, degree, duration) {
    let chordObj = null;
    
    if (degree) {
        // Diatonic chord (I, ii, iii, IV, V, vi, vii°)
        chordObj = getChordByDegree(parseInt(degree), pianoState.keySignature);
    } else if (item.id === 'searchResultButton') {
        // Search result chord
        chordObj = window.chordAutocomplete?.selectedChordObj;
    }
    
    if (!chordObj) {
        console.warn('No chord object found for click');
        return;
    }
    
    // Determine which clef to use based on the chord's note range
    // Use treble if treble notes exist, otherwise bass
    const notesToUse = chordObj.treble?.length > 0 ? chordObj.treble : chordObj.bass;
    
    if (!notesToUse || notesToUse.length === 0) {
        console.warn('No notes found in chord object');
        return;
    }
    
    // Play and write the chord using triggerAttackRelease
    // writeToScore=true will handle writing to the score
    triggerAttackRelease(
        notesToUse,
        duration,
        pianoState.velocity,
        true,  // writeToScore
        chordObj.displayName
    );
    
    console.log(`Chord played and written: ${chordObj.displayName}, notes=${notesToUse.join(' ')}, duration=${duration}`);
}

/**
 * Update the quantize button display
 */
function updateQuantizeButtonDisplay(duration) {
    const quantizeBtn = document.getElementById('quantize-btn');
    if (!quantizeBtn) return;
    
    const noteImages = {
        '32': '/static/images/16th-up.png',  // No 32nd image, use 16th
        '16': '/static/images/16th-up.png',
        '16.': '/static/images/16th-up.png',
        '8': '/static/images/8th-up.png',
        '8.': '/static/images/dotted-8th-up.png',
        'q': '/static/images/quarter-up.png',
        'q.': '/static/images/dotted-quarter-up.png',
        'h': '/static/images/half-up.png',
        'h.': '/static/images/dotted-half-up.png',
        'w': '/static/images/whole.png'
    };
    
    const imgSrc = noteImages[duration];
    if (imgSrc) {
        const img = quantizeBtn.querySelector('img');
        if (img) {
            img.src = imgSrc;
        }
    }
}

/**
 * Setup palette events based on togglePaletteDragMode
 * @param {boolean} useDragMode - Whether to use drag mode (true) or click mode (false)
 */
export function setupPaletteInteractions(useDragMode = pianoState.togglePaletteDragMode) {
    const paletteNotes = document.querySelectorAll('.palette-note');
    
    paletteNotes.forEach(note => {
        // Remove existing event listeners by cloning and replacing
        const newNote = note.cloneNode(true);
        note.parentNode.replaceChild(newNote, note);
        
        const type = newNote.dataset.type;
        const isChordPaletteItem = newNote.closest('.chord-palette') !== null;
        const isSearchResultButton = newNote.id === 'searchResultButton';
        
        // Update the chordAutocomplete reference if this is the search result button
        if (isSearchResultButton && window.chordAutocomplete) {
            window.chordAutocomplete.searchResultButton = newNote;
        }
        
        if (useDragMode) {
            // Drag mode - enable dragging
            newNote.setAttribute('draggable', 'true');
            newNote.classList.remove('palette-click-mode');
            newNote.classList.remove('hidden');
            
            // For chord palette items, add click handler to update search result
            if (isChordPaletteItem && type === 'chord' && newNote.dataset.degree) {
                newNote.addEventListener('click', (e) => {
                    const degree = parseInt(e.currentTarget.dataset.degree);
                    const chordObj = getChordByDegree(degree, getRelativeKey());
                    if (window.chordAutocomplete) {
                        window.chordAutocomplete.selectChord(chordObj.displayName, chordObj);
                    }
                });
            }
            
            newNote.addEventListener('dragstart', (event) => {
                const type = event.currentTarget.dataset.type;
                const duration = event.currentTarget.dataset.duration;
                const degree = event.currentTarget.dataset.degree;
                const intervalType = event.currentTarget.dataset.interval;
                
                // Handle interval elements
                if (type === 'interval') {
                    const intervalData = {
                        intervalType: intervalType
                    };
                    event.dataTransfer.setData('application/interval', JSON.stringify(intervalData));
                    setPaletteDragState(true, type, duration);
                } else if (type === 'chord') {
                    // Handle chord elements
                    let chordObj;
                    if (degree) {
                        chordObj = getChordByDegree(parseInt(degree), pianoState.keySignature);
                    } else if (event.currentTarget.id === 'searchResultButton') {
                        chordObj = window.chordAutocomplete?.selectedChordObj;
                    }
                    
                    if (chordObj) {
                        event.dataTransfer.setData('text/plain', chordObj.displayName);
                        event.dataTransfer.setData('application/chord', JSON.stringify({
                            type: 'diatonic-chord',
                            chord: chordObj,
                            degree: degree,
                            displayName: chordObj.displayName
                        }));
                    }
                    setPaletteDragState(true, type, duration);
                } else {
                    // Handle notes and rests
                    setPaletteDragState(true, type, duration);
                    event.dataTransfer.setData('text/plain', type);
                }
            });
            
            newNote.addEventListener('dragend', (event) => {
                console.log("Palette dragend detected, cleaning up");
                setPaletteDragState(false, null, null);
            });
        } else {
            // Click mode - disable dragging, use click handlers
            newNote.setAttribute('draggable', 'false');
            newNote.classList.add('palette-click-mode');
            
            // Hide intervals in click mode since they need a target note
            if (type === 'interval') {
                newNote.classList.add('hidden');
            }
            
            // For chord palette items, also update the search result when clicked
            if (isChordPaletteItem && type === 'chord' && newNote.dataset.degree) {
                newNote.addEventListener('click', (e) => {
                    const degree = parseInt(e.currentTarget.dataset.degree);
                    const chordObj = getChordByDegree(degree, pianoState.keySignature);
                    if (window.chordAutocomplete) {
                        window.chordAutocomplete.selectChord(chordObj.displayName, chordObj);
                    }
                });
            }
            
            newNote.addEventListener('click', handlePaletteClick);
        }
    });
}

/**
 * Toggle between drag mode and click mode
 */
export function togglePaletteMode() {
    pianoState.togglePaletteDragMode = !pianoState.togglePaletteDragMode;
    setupPaletteInteractions(pianoState.togglePaletteDragMode);
    return pianoState.togglePaletteDragMode;
}

/**
 * Initialize palette interactions based on current state
 */
export function initializePaletteInteractions() {
    setupPaletteInteractions(pianoState.togglePaletteDragMode);
}
