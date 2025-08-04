// DrumRenderer.js - VexFlow-based renderer for drum notation

/**
 * Drum-specific renderer that handles:
 * - Percussion clef notation on single staff
 * - Drum-specific noteheads (x, circle, triangle, slash)
 * - Proper drum positioning on staff lines
 * - Drum techniques and articulations
 * - Playback highlighting
 */
export class DrumRenderer {
    constructor(config = {}) {
        // Configuration
        this.containerId = config.containerId || 'drums-score';
        this.containerElement = null;

        // Layout configuration
        this.measureWidth = config.measureWidth || 340;
        this.staffHeight = config.staffHeight || 120;
        this.marginTop = config.marginTop || 20;
        this.marginLeft = config.marginLeft || 20;

        // VexFlow objects
        this.vexFlowFactory = null;
        this.vfContext = null;
        this.vexFlowNoteMap = []; // [measureIndex] = notes array
        this.measureXPositions = [];
        this.vexFlowStaveMap = []; // [measureIndex] = stave
        this.vexFlowIndexByNoteId = {}; // noteId -> { measureIndex, vexFlowIndex }

        // Highlighting state
        this.currentHighlights = new Set();
        
        // State
        this.isInitialized = false;

        this._initialize();
    }

    // ===================================================================
    // Public API
    // ===================================================================

    /**
     * Main render method - renders the complete drum score
     */
    render(measures = []) {
        console.log('🥁 DrumRenderer: Starting render with', measures.length, 'measures');

        if (!this.isInitialized) {
            console.error('DrumRenderer not initialized');
            return;
        }

        this._clearPreviousRender();
        
        if (measures.length === 0) {
            this._renderEmptyScore();
            return;
        }

        try {
            this._setupCanvas(measures.length);
            this._renderMeasures(measures);
            this._drawEverything();
            this._scrollToEnd();
            
            console.log('✅ Drum render complete');
        } catch (error) {
            console.error('❌ Drum render error:', error);
        }
    }

    /**
     * Scroll to a specific measure
     */
    scrollToMeasure(measureIndex) {
        if (!this.measureXPositions[measureIndex]) {
            console.warn(`Measure ${measureIndex} position not found`);
            return;
        }

        const scoreWrap = this.containerElement.parentElement;
        if (!scoreWrap) return;

        const targetX = this.measureXPositions[measureIndex];
        const scrollLeft = Math.max(0, targetX - scoreWrap.clientWidth / 2 + this.measureWidth / 2);

        scoreWrap.scrollTo({
            left: scrollLeft,
            behavior: 'smooth'
        });

        console.log(`🥁 Scrolled to measure ${measureIndex}`);
    }

    /**
     * Highlight a note for playback
     */
    highlightNote(measureIndex, noteId, color = '#76B595') {
        const noteInfo = this.vexFlowIndexByNoteId[noteId];
        if (!noteInfo) {
            console.warn(`Note ${noteId} not found for highlighting`);
            return;
        }

        try {
            this._applyNoteHighlight(noteInfo, color);
            this.currentHighlights.add(noteId);
        } catch (error) {
            console.error('Error highlighting note:', error);
        }
    }

    /**
     * Clear all highlights
     */
    clearHighlights() {
        this.currentHighlights.forEach(noteId => {
            const noteInfo = this.vexFlowIndexByNoteId[noteId];
            if (noteInfo) {
                this._clearNoteHighlight(noteInfo);
            }
        });
        this.currentHighlights.clear();
    }

    /**
     * Dispose and clean up
     */
    dispose() {
        this._clearPreviousRender();
        this.currentHighlights.clear();
        this.isInitialized = false;
    }

    // ===================================================================
    // Private Methods - Initialization
    // ===================================================================

    _initialize() {
        if (typeof Vex === 'undefined' || !Vex.Flow) {
            console.error('VexFlow library not available');
            return;
        }

        this.containerElement = document.getElementById(this.containerId);
        if (!this.containerElement) {
            console.error('Drum score container not found:', this.containerId);
            return;
        }

        this.isInitialized = true;
        console.log('🥁 DrumRenderer initialized');
    }

    _clearPreviousRender() {
        if (this.containerElement) {
            this.containerElement.innerHTML = '';
        }
        
        this.vexFlowNoteMap = [];
        this.measureXPositions = [];
        this.vexFlowStaveMap = [];
        this.vexFlowIndexByNoteId = {};
        this.currentHighlights.clear();
    }

    _renderEmptyScore() {
        this._setupCanvas(1);
        this._renderEmptyMeasure(0);
        this._drawEverything();
    }

    // ===================================================================
    // Private Methods - Canvas Setup
    // ===================================================================

    _setupCanvas(measureCount) {
        const totalWidth = measureCount * this.measureWidth + this.marginLeft * 2;
        const totalHeight = this.staffHeight + this.marginTop * 2;

        this.vexFlowFactory = new Vex.Flow.Factory({
            renderer: {
                elementId: this.containerId,
                width: totalWidth,
                height: totalHeight
            }
        });

        this.vfContext = this.vexFlowFactory.getContext();
        console.log(`🥁 Canvas setup: ${totalWidth}x${totalHeight} for ${measureCount} measures`);
    }

    // ===================================================================
    // Private Methods - Measure Rendering
    // ===================================================================

    _renderMeasures(measures) {
        let currentX = this.marginLeft;

        measures.forEach((measure, measureIndex) => {
            this.measureXPositions[measureIndex] = currentX;
            this._renderMeasure(measure, measureIndex, currentX);
            currentX += this.measureWidth;
        });
    }

    _renderMeasure(measureNotes, measureIndex, x) {
        const notes = [];
        
        // Initialize note map for this measure
        this.vexFlowNoteMap[measureIndex] = [];

        // Create stave for this measure
        const stave = this._createStave(x, this.marginTop, measureIndex);
        this.vexFlowStaveMap[measureIndex] = stave;

        // Convert measure notes to VexFlow notes
        measureNotes.forEach((noteData, noteIndex) => {
            const vexNote = this._createVexNote(noteData);
            if (vexNote) {
                notes.push(vexNote);
                this.vexFlowNoteMap[measureIndex].push(vexNote);
                this._indexVexNote(noteData.id, measureIndex, noteIndex);
            }
        });

        // Handle empty measures
        if (notes.length === 0) {
            this._addRestToEmptyMeasure(measureIndex);
            return;
        }

        // Format and render voice
        this._formatAndRenderVoice(measureIndex, notes, stave);
    }

    _renderEmptyMeasure(measureIndex) {
        const x = this.marginLeft;
        this.measureXPositions[measureIndex] = x;
        
        const stave = this._createStave(x, this.marginTop, measureIndex);
        this.vexFlowStaveMap[measureIndex] = stave;
        
        this._addRestToEmptyMeasure(measureIndex);
    }

    // ===================================================================
    // Private Methods - Stave Creation
    // ===================================================================

    _createStave(x, y, measureIndex) {
        const stave = new Vex.Flow.Stave(x, y, this.measureWidth);
        
        // Add percussion clef and time signature to first measure
        if (measureIndex === 0) {
            stave.addClef('percussion');
            stave.addTimeSignature('4/4');
            // Optional: Add tempo marking
            // stave.setTempo({ duration: 'q', bpm: 120 }, -27);
        }

        // Add barlines
        if (measureIndex === 0) {
            stave.setBegBarType(Vex.Flow.Barline.type.SINGLE);
        }

        return stave;
    }

    // ===================================================================
    // Private Methods - Note Creation
    // ===================================================================

    _createVexNote(noteData) {
        if (noteData.isRest) {
            return new Vex.Flow.StaveNote({
                keys: ['B/4'], // Standard rest position
                duration: `${noteData.duration}r`,
                clef: 'percussion'
            });
        }

        // Create drum note with proper keys and notehead
        const vexNote = new Vex.Flow.StaveNote({
            keys: noteData.keys || ['B/4'], // Fallback to B/4 if keys not specified
            duration: noteData.duration,
            clef: 'percussion',
            stem_direction: noteData.stemDirection || Vex.Flow.StaveNote.STEM_UP
        });

        // Set custom notehead if specified
        if (noteData.notehead && noteData.notehead !== 'normal') {
            try {
                // Apply custom notehead to all note heads
                noteData.keys.forEach((key, index) => {
                    vexNote.setKeyStyle(index, { 
                        shadowColor: null,
                        shadowBlur: 0,
                        fillStyle: 'black',
                        strokeStyle: 'black'
                    });
                });

                // Set the note head type
                this._setCustomNotehead(vexNote, noteData.notehead);
            } catch (error) {
                console.warn('Error setting custom notehead:', error);
            }
        }

        // Apply modifiers (articulations, annotations, etc.)
        this._applyModifiers(vexNote, noteData);

        return vexNote;
    }

    _setCustomNotehead(vexNote, noteheadType) {
        // VexFlow custom noteheads
        const noteheadMap = {
            'x': 'x1', // Cross notehead
            'circle_x': 'circleX', // Circle with X
            'triangle': 'triangleUp', // Triangle
            'slash': 'slash', // Slash notehead
            'diamond': 'diamond' // Diamond
        };

        const vfNotehead = noteheadMap[noteheadType];
        if (vfNotehead) {
            try {
                // This is a simplified approach - VexFlow's notehead system is complex
                // In a production system, you might need to use custom glyphs
                vexNote.setKeyStyle(0, { notehead: vfNotehead });
            } catch (error) {
                console.warn(`Could not set notehead ${noteheadType}:`, error);
            }
        }
    }

    _applyModifiers(vexNote, noteData) {
        if (!noteData.modifiers || noteData.modifiers.length === 0) {
            return;
        }

        noteData.modifiers.forEach((modifier, index) => {
            try {
                switch (modifier.type) {
                    case 'articulation':
                        const articulation = new Vex.Flow.Articulation(modifier.symbol);
                        if (modifier.position) {
                            articulation.setPosition(modifier.position);
                        }
                        vexNote.addModifier(articulation, 0);
                        break;

                    case 'annotation':
                        const annotation = new Vex.Flow.Annotation(modifier.text);
                        if (modifier.justification) {
                            annotation.setJustification(modifier.justification);
                        }
                        if (modifier.verticalJustification) {
                            annotation.setVerticalJustification(modifier.verticalJustification);
                        }
                        annotation.setFont({ family: 'Arial', size: 10, weight: 'bold' });
                        vexNote.addModifier(annotation, 0);
                        break;

                    case 'tremolo':
                        if (modifier.strokes) {
                            const tremolo = new Vex.Flow.Tremolo(modifier.strokes);
                            vexNote.addModifier(tremolo, 0);
                        }
                        break;

                    case 'stroke':
                        const stroke = new Vex.Flow.Stroke(modifier.symbol);
                        vexNote.addModifier(stroke, 0);
                        break;

                    default:
                        console.warn('Unknown modifier type:', modifier.type);
                }
            } catch (error) {
                console.error('Error applying modifier:', error, modifier);
            }
        });
    }

    // ===================================================================
    // Private Methods - Voice Formatting and Rendering
    // ===================================================================

    _formatAndRenderVoice(measureIndex, notes, stave) {
        try {
            // Create voice
            const voice = new Vex.Flow.Voice({
                num_beats: 4,
                beat_value: 4
            }).setStrict(false);

            voice.addTickables(notes);

            // Format the voice
            const formatter = new Vex.Flow.Formatter();
            formatter.joinVoices([voice]);
            formatter.formatToStave([voice], stave);

            // Draw stave first
            stave.setContext(this.vfContext).draw();

            // Draw voice
            voice.draw(this.vfContext, stave);

        } catch (error) {
            console.error('Error rendering drum voice:', error);
            
            // Fallback: at least draw the stave
            try {
                stave.setContext(this.vfContext).draw();
            } catch (staveError) {
                console.error('Error drawing stave:', staveError);
            }
        }
    }

    _addRestToEmptyMeasure(measureIndex) {
        const restNote = new Vex.Flow.StaveNote({
            keys: ['B/4'],
            duration: 'wr', // Whole rest
            clef: 'percussion'
        });

        const stave = this.vexFlowStaveMap[measureIndex];
        if (!stave) return;

        this.vexFlowNoteMap[measureIndex] = [restNote];
        this._formatAndRenderVoice(measureIndex, [restNote], stave);
    }

    // ===================================================================
    // Private Methods - Highlighting
    // ===================================================================

    _applyNoteHighlight(noteInfo, color) {
        const { measureIndex, vexFlowIndex } = noteInfo;
        const notes = this.vexFlowNoteMap[measureIndex];
        
        if (!notes || !notes[vexFlowIndex]) {
            console.warn('Note not found for highlighting:', noteInfo);
            return;
        }

        const vexNote = notes[vexFlowIndex];
        
        // Apply highlight style
        const highlightStyle = {
            fillStyle: color,
            strokeStyle: color,
            shadowColor: color,
            shadowBlur: 10
        };

        try {
            vexNote.setStyle(highlightStyle);
            
            // Force redraw - this is tricky with VexFlow
            // In a full implementation, you might need to re-render the measure
            if (vexNote.drawWithStyle) {
                vexNote.drawWithStyle();
            }
        } catch (error) {
            console.error('Error applying highlight:', error);
        }
    }

    _clearNoteHighlight(noteInfo) {
        const { measureIndex, vexFlowIndex } = noteInfo;
        const notes = this.vexFlowNoteMap[measureIndex];
        
        if (!notes || !notes[vexFlowIndex]) {
            return;
        }

        const vexNote = notes[vexFlowIndex];
        
        // Reset to default style
        const defaultStyle = {
            fillStyle: '#000000',
            strokeStyle: '#000000',
            shadowColor: null,
            shadowBlur: 0
        };

        try {
            vexNote.setStyle(defaultStyle);
            if (vexNote.drawWithStyle) {
                vexNote.drawWithStyle();
            }
        } catch (error) {
            console.error('Error clearing highlight:', error);
        }
    }

    // ===================================================================
    // Private Methods - Utilities
    // ===================================================================

    _indexVexNote(noteId, measureIndex, vexFlowIndex) {
        this.vexFlowIndexByNoteId[noteId] = {
            measureIndex,
            vexFlowIndex
        };
    }

    _drawEverything() {
        // VexFlow factory handles the drawing automatically
        console.log('🥁 Drawing complete');
    }

    _scrollToEnd() {
        const scoreWrap = this.containerElement.parentElement;
        if (scoreWrap) {
            setTimeout(() => {
                scoreWrap.scrollLeft = scoreWrap.scrollWidth;
            }, 100);
        }
    }

    // ===================================================================
    // Advanced Drum Notation Methods
    // ===================================================================

    /**
     * Create a custom drum legend/key showing what each line represents
     */
    createDrumLegend() {
        const legendData = [
            { instrument: 'Crash Cymbal', position: 'A/5', notehead: 'x' },
            { instrument: 'Hi-Hat', position: 'G/5', notehead: 'x' },
            { instrument: 'High Tom', position: 'D/5', notehead: 'x' },
            { instrument: 'Snare', position: 'C/5', notehead: 'x' },
            { instrument: 'Mid Tom', position: 'B/4', notehead: 'x' },
            { instrument: 'Low Tom', position: 'A/4', notehead: 'x' },
            { instrument: 'Kick Drum', position: 'F/4', notehead: 'x' }
        ];

        // This would create a visual legend showing drum positions
        // Implementation would depend on where you want to display it
        return legendData;
    }

    /**
     * Get optimal staff position for a drum instrument
     */
    getOptimalDrumPosition(drumInstrument) {
        // Standard drum kit positioning on percussion staff
        const drumPositions = {
            // Cymbals (top)
            crashCymbal: 'A/5',
            rideCymbal: 'F/5',
            splashCymbal: 'G/5',
            chinaCymbal: 'E/5',
            
            // Hi-Hats
            hiHatClosed: 'G/5',
            hiHatOpen: 'G/5',
            hiHatPedal: 'F/4',
            
            // Toms
            highTom: 'D/5',
            midTom: 'B/4',
            lowTom: 'A/4',
            floorTom: 'F/4',
            
            // Snare
            snare: 'C/5',
            sideStick: 'C/5',
            rimshot: 'C/5',
            
            // Kick
            kick: 'E/4',
            bassKick: 'E/4',
            
            // Percussion
            cowbell: 'G#/5',
            clap: 'D/5',
            conga: 'A#/4',
            bongos: 'G#/4',
            bongoLow: 'F#/4',
            claves: 'A/4'
        };

        return drumPositions[drumInstrument] || 'B/4'; // Default position
    }

    // ===================================================================
    // Getters for External Access
    // ===================================================================

    getVexFlowNoteMap() {
        return this.vexFlowNoteMap;
    }

    getMeasureXPositions() {
        return this.measureXPositions;
    }

    getVexFlowStaveMap() {
        return this.vexFlowStaveMap;
    }

    getVexFlowContext() {
        return this.vfContext;
    }

    getVexFlowFactory() {
        return this.vexFlowFactory;
    }

    getVexFlowIndexByNoteId() {
        return this.vexFlowIndexByNoteId;
    }
}

export default DrumRenderer;