// GuitarRenderer.js - VexFlow-based renderer for guitar notation and tablature

/**
 * Guitar-specific renderer that handles:
 * - Standard music notation on treble clef
 * - Guitar tablature (TAB) notation
 * - Chord symbols and diagrams
 * - Guitar-specific techniques (bends, slides, etc.)
 * - Dual-staff layout with proper spacing
 */
export class GuitarRenderer {
    constructor(config = {}) {
        // Configuration
        this.containerId = config.containerId || 'guitar-score';
        this.containerElement = null;
        this.showStandardNotation = config.showStandardNotation !== false; // Default true
        this.showTablature = config.showTablature !== false; // Default true
        this.showChordSymbols = config.showChordSymbols !== false; // Default true

        // Layout configuration
        this.measureWidth = config.measureWidth || 300;
        this.staffHeight = config.staffHeight || 100;
        this.tabHeight = config.tabHeight || 60;
        this.spaceBetweenStaves = config.spaceBetweenStaves || 20;
        this.marginTop = config.marginTop || 20;
        this.marginLeft = config.marginLeft || 20;

        // VexFlow objects
        this.vexFlowFactory = null;
        this.vfContext = null;
        this.vexFlowNoteMap = []; // [measureIndex][staffType] = notes array
        this.measureXPositions = [];
        this.vexFlowStaveMap = []; // [measureIndex] = { standard: stave, tab: stave }
        this.vexFlowIndexByNoteId = {}; // noteId -> { measureIndex, staffType, vexFlowIndex }

        // Guitar-specific data
        this.stringTuning = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']; // Low to high
        this.chordDiagrams = new Map(); // Store chord diagrams for rendering

        // State
        this.currentHighlights = new Set();
        this.isInitialized = false;

        this._initialize();
    }

    // ===================================================================
    // Public API
    // ===================================================================

    /**
     * Main render method - renders the complete score
     */
    render(measures = []) {
        console.log('🎸 GuitarRenderer: Starting render with', measures.length, 'measures');

        if (!this.isInitialized) {
            console.error('GuitarRenderer not initialized');
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
            
            console.log('✅ Guitar render complete');
        } catch (error) {
            console.error('❌ Guitar render error:', error);
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

        console.log(`🎸 Scrolled to measure ${measureIndex}`);
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
     * Toggle tablature display
     */
    setShowTablature(show) {
        this.showTablature = show;
        // Would need to re-render to take effect
    }

    /**
     * Toggle standard notation display
     */
    setShowStandardNotation(show) {
        this.showStandardNotation = show;
        // Would need to re-render to take effect
    }

    /**
     * Dispose and clean up
     */
    dispose() {
        this._clearPreviousRender();
        this.currentHighlights.clear();
        this.chordDiagrams.clear();
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
            console.error('Guitar score container not found:', this.containerId);
            return;
        }

        this.isInitialized = true;
        console.log('🎸 GuitarRenderer initialized');
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
        let totalHeight = this.marginTop * 2;

        // Calculate height based on what we're showing
        if (this.showStandardNotation) {
            totalHeight += this.staffHeight;
        }
        if (this.showTablature) {
            totalHeight += this.tabHeight;
        }
        if (this.showStandardNotation && this.showTablature) {
            totalHeight += this.spaceBetweenStaves;
        }
        if (this.showChordSymbols) {
            totalHeight += 30; // Space for chord symbols
        }

        this.vexFlowFactory = new Vex.Flow.Factory({
            renderer: {
                elementId: this.containerId,
                width: totalWidth,
                height: totalHeight
            }
        });

        this.vfContext = this.vexFlowFactory.getContext();
        console.log(`🎸 Canvas setup: ${totalWidth}x${totalHeight} for ${measureCount} measures`);
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
        const standardNotes = [];
        const tabNotes = [];
        let staveY = this.marginTop;

        // Initialize note maps for this measure
        this.vexFlowNoteMap[measureIndex] = {};

        // Create stave map for this measure
        this.vexFlowStaveMap[measureIndex] = {};

        // Render standard notation stave if enabled
        if (this.showStandardNotation) {
            const standardStave = this._createStandardStave(x, staveY, measureIndex);
            this.vexFlowStaveMap[measureIndex].standard = standardStave;
            
            measureNotes.forEach((noteData, noteIndex) => {
                const vexNote = this._createStandardVexNote(noteData);
                if (vexNote) {
                    standardNotes.push(vexNote);
                    this._indexVexNote(noteData.id, measureIndex, 'standard', noteIndex);
                }
            });

            this.vexFlowNoteMap[measureIndex].standard = standardNotes;
            staveY += this.staffHeight + this.spaceBetweenStaves;
        }

        // Render tablature stave if enabled
        if (this.showTablature) {
            const tabStave = this._createTabStave(x, staveY, measureIndex);
            this.vexFlowStaveMap[measureIndex].tab = tabStave;

            measureNotes.forEach((noteData, noteIndex) => {
                const vexTabNote = this._createTabVexNote(noteData);
                if (vexTabNote) {
                    tabNotes.push(vexTabNote);
                    this._indexVexNote(noteData.id, measureIndex, 'tab', noteIndex);
                }
            });

            this.vexFlowNoteMap[measureIndex].tab = tabNotes;
        }

        // Render chord symbols if enabled
        if (this.showChordSymbols) {
            this._renderChordSymbols(measureNotes, x, measureIndex);
        }

        // Handle empty measures
        if (measureNotes.length === 0) {
            this._addRestToEmptyMeasure(measureIndex);
        }

        // Format and render voices
        this._formatAndRenderVoices(measureIndex, standardNotes, tabNotes);
    }

    _renderEmptyMeasure(measureIndex) {
        const x = this.marginLeft;
        this.measureXPositions[measureIndex] = x;
        
        let staveY = this.marginTop;
        this.vexFlowStaveMap[measureIndex] = {};

        if (this.showStandardNotation) {
            const standardStave = this._createStandardStave(x, staveY, measureIndex);
            this.vexFlowStaveMap[measureIndex].standard = standardStave;
            staveY += this.staffHeight + this.spaceBetweenStaves;
        }

        if (this.showTablature) {
            const tabStave = this._createTabStave(x, staveY, measureIndex);
            this.vexFlowStaveMap[measureIndex].tab = tabStave;
        }

        this._addRestToEmptyMeasure(measureIndex);
    }

    // ===================================================================
    // Private Methods - Stave Creation
    // ===================================================================

    _createStandardStave(x, y, measureIndex) {
        const stave = new Vex.Flow.Stave(x, y, this.measureWidth);
        
        // Add clef and time signature to first measure
        if (measureIndex === 0) {
            stave.addClef('treble');
            stave.addTimeSignature('4/4');
            stave.addKeySignature('C'); // Default to C major
        }

        // Add barlines
        if (measureIndex === 0) {
            stave.setBegBarType(Vex.Flow.Barline.type.SINGLE);
        }

        return stave;
    }

    _createTabStave(x, y, measureIndex) {
        const stave = new Vex.Flow.TabStave(x, y, this.measureWidth);
        
        // Configure tablature
        stave.addTabGlyph();
        
        // Add time signature to first measure
        if (measureIndex === 0) {
            stave.addTimeSignature('4/4');
        }

        return stave;
    }

    // ===================================================================
    // Private Methods - Note Creation
    // ===================================================================

    _createStandardVexNote(noteData) {
        if (noteData.isRest) {
            return new Vex.Flow.StaveNote({
                keys: ['B/4'],
                duration: `${noteData.duration}r`,
                clef: 'treble'
            });
        }

        if (noteData.isChord && noteData.notes) {
            // Create chord in standard notation
            const keys = noteData.notes.map(note => this._noteToVexKey(note));
            const vexNote = new Vex.Flow.StaveNote({
                keys: keys,
                duration: noteData.duration,
                clef: 'treble'
            });

            // Add chord symbol as annotation
            if (noteData.chordName) {
                vexNote.addAnnotation(0, 
                    new Vex.Flow.Annotation(noteData.chordName)
                        .setFont({ family: 'Arial', size: 12, weight: 'bold' })
                        .setVerticalJustification(Vex.Flow.Annotation.VerticalJustify.TOP)
                );
            }

            return vexNote;
        }

        if (noteData.note) {
            // Single note
            const vexNote = new Vex.Flow.StaveNote({
                keys: [this._noteToVexKey(noteData.note)],
                duration: noteData.duration,
                clef: 'treble'
            });

            // Add technique markings
            this._addTechniqueMarkings(vexNote, noteData);

            return vexNote;
        }

        return null;
    }

    _createTabVexNote(noteData) {
        if (noteData.isRest) {
            return new Vex.Flow.TabNote({
                positions: [{ str: 1, fret: 'x' }], // 'x' represents rest
                duration: noteData.duration
            });
        }

        if (noteData.isChord && noteData.chordShape) {
            // Create chord in tablature
            const positions = [];
            noteData.chordShape.frets.forEach((fret, index) => {
                if (fret >= 0) { // -1 means don't play this string
                    positions.push({
                        str: 6 - index, // Reverse string order (6 = low E, 1 = high E)
                        fret: fret.toString()
                    });
                }
            });

            return new Vex.Flow.TabNote({
                positions: positions,
                duration: noteData.duration
            });
        }

        if (noteData.fret !== undefined && noteData.string !== undefined) {
            // Single note in tablature
            const tabNote = new Vex.Flow.TabNote({
                positions: [{
                    str: noteData.string,
                    fret: noteData.fret.toString()
                }],
                duration: noteData.duration
            });

            // Add technique markings for tab
            this._addTabTechniqueMarkings(tabNote, noteData);

            return tabNote;
        }

        return null;
    }

    // ===================================================================
    // Private Methods - Technique Markings
    // ===================================================================

    _addTechniqueMarkings(vexNote, noteData) {
        switch (noteData.technique) {
            case 'bend':
                vexNote.addAnnotation(0,
                    new Vex.Flow.Annotation('B')
                        .setFont({ family: 'Arial', size: 10 })
                        .setVerticalJustification(Vex.Flow.Annotation.VerticalJustify.TOP)
                );
                break;
            case 'slide':
                vexNote.addAnnotation(0,
                    new Vex.Flow.Annotation('/')
                        .setFont({ family: 'Arial', size: 12 })
                );
                break;
            case 'hammer-on':
                vexNote.addAnnotation(0,
                    new Vex.Flow.Annotation('H')
                        .setFont({ family: 'Arial', size: 10 })
                        .setVerticalJustification(Vex.Flow.Annotation.VerticalJustify.TOP)
                );
                break;
            case 'pull-off':
                vexNote.addAnnotation(0,
                    new Vex.Flow.Annotation('P')
                        .setFont({ family: 'Arial', size: 10 })
                        .setVerticalJustification(Vex.Flow.Annotation.VerticalJustify.TOP)
                );
                break;
            case 'vibrato':
                vexNote.addAnnotation(0,
                    new Vex.Flow.Annotation('~')
                        .setFont({ family: 'Arial', size: 12 })
                );
                break;
            case 'mute':
                vexNote.addAnnotation(0,
                    new Vex.Flow.Annotation('X')
                        .setFont({ family: 'Arial', size: 10 })
                        .setVerticalJustification(Vex.Flow.Annotation.VerticalJustify.TOP)
                );
                break;
        }
    }

    _addTabTechniqueMarkings(tabNote, noteData) {
        // Similar to standard notation but adapted for tablature
        switch (noteData.technique) {
            case 'bend':
                // Bends in tab are usually shown with curved lines
                break;
            case 'slide':
                // Slides in tab are shown with slashes between frets
                break;
            case 'hammer-on':
                // Hammer-ons shown with 'h' between notes
                break;
            case 'pull-off':
                // Pull-offs shown with 'p' between notes
                break;
        }
    }

    // ===================================================================
    // Private Methods - Chord Symbols
    // ===================================================================

    _renderChordSymbols(measureNotes, x, measureIndex) {
        let currentX = x;
        const chordY = this.marginTop - 15; // Above the staff

        measureNotes.forEach((noteData, noteIndex) => {
            if (noteData.chordName) {
                // Calculate position within measure
                const noteX = currentX + (noteIndex * (this.measureWidth / measureNotes.length));
                
                // Draw chord symbol
                this.vfContext.setFont('Arial', 12, 'bold');
                this.vfContext.fillText(noteData.chordName, noteX, chordY);
            }

            // Advance position (simplified - would need proper duration calculation)
            currentX += this.measureWidth / measureNotes.length;
        });
    }

    // ===================================================================
    // Private Methods - Voice Formatting and Rendering
    // ===================================================================

    _formatAndRenderVoices(measureIndex, standardNotes, tabNotes) {
        const staves = this.vexFlowStaveMap[measureIndex];

        // Format and render standard notation voice
        if (this.showStandardNotation && standardNotes.length > 0 && staves.standard) {
            try {
                const standardVoice = new Vex.Flow.Voice({
                    num_beats: 4,
                    beat_value: 4
                }).setStrict(false);

                standardVoice.addTickables(standardNotes);

                const formatter = new Vex.Flow.Formatter();
                formatter.joinVoices([standardVoice]);
                formatter.formatToStave([standardVoice], staves.standard);

                standardVoice.draw(this.vfContext, staves.standard);
            } catch (error) {
                console.error('Error rendering standard notation voice:', error);
            }
        }

        // Format and render tablature voice
        if (this.showTablature && tabNotes.length > 0 && staves.tab) {
            try {
                const tabVoice = new Vex.Flow.Voice({
                    num_beats: 4,
                    beat_value: 4
                }).setStrict(false);

                tabVoice.addTickables(tabNotes);

                const formatter = new Vex.Flow.Formatter();
                formatter.joinVoices([tabVoice]);
                formatter.formatToStave([tabVoice], staves.tab);

                tabVoice.draw(this.vfContext, staves.tab);
            } catch (error) {
                console.error('Error rendering tablature voice:', error);
            }
        }

        // Draw the staves themselves
        if (staves.standard) {
            staves.standard.setContext(this.vfContext).draw();
        }
        if (staves.tab) {
            staves.tab.setContext(this.vfContext).draw();
        }
    }

    _addRestToEmptyMeasure(measureIndex) {
        const restNote = {
            id: `empty-rest-${measureIndex}`,
            isRest: true,
            duration: 'w'
        };

        if (this.showStandardNotation) {
            const standardRest = this._createStandardVexNote(restNote);
            if (standardRest) {
                this.vexFlowNoteMap[measureIndex] = this.vexFlowNoteMap[measureIndex] || {};
                this.vexFlowNoteMap[measureIndex].standard = [standardRest];
            }
        }

        if (this.showTablature) {
            const tabRest = this._createTabVexNote(restNote);
            if (tabRest) {
                this.vexFlowNoteMap[measureIndex] = this.vexFlowNoteMap[measureIndex] || {};
                this.vexFlowNoteMap[measureIndex].tab = [tabRest];
            }
        }

        this._formatAndRenderVoices(
            measureIndex,
            this.vexFlowNoteMap[measureIndex]?.standard || [],
            this.vexFlowNoteMap[measureIndex]?.tab || []
        );
    }

    // ===================================================================
    // Private Methods - Highlighting
    // ===================================================================

    _applyNoteHighlight(noteInfo, color) {
        const { measureIndex, staffType, vexFlowIndex } = noteInfo;
        const notes = this.vexFlowNoteMap[measureIndex]?.[staffType];
        
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
            // Force redraw of just this note
            vexNote.drawWithStyle();
        } catch (error) {
            console.error('Error applying highlight:', error);
        }
    }

    _clearNoteHighlight(noteInfo) {
        const { measureIndex, staffType, vexFlowIndex } = noteInfo;
        const notes = this.vexFlowNoteMap[measureIndex]?.[staffType];
        
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
            vexNote.drawWithStyle();
        } catch (error) {
            console.error('Error clearing highlight:', error);
        }
    }

    // ===================================================================
    // Private Methods - Utilities
    // ===================================================================

    _noteToVexKey(note) {
        // Convert note name (e.g., 'A4') to VexFlow key format (e.g., 'A/4')
        const match = note.match(/^([A-G][#b]?)(\d+)$/);
        if (!match) {
            console.warn('Invalid note format:', note);
            return 'C/4'; // Default fallback
        }
        
        const [, noteName, octave] = match;
        return `${noteName}/${octave}`;
    }

    _indexVexNote(noteId, measureIndex, staffType, vexFlowIndex) {
        this.vexFlowIndexByNoteId[noteId] = {
            measureIndex,
            staffType,
            vexFlowIndex
        };
    }

    _drawEverything() {
        // VexFlow handles the actual drawing through the factory
        // This method exists for consistency and future enhancements
        console.log('🎸 Drawing complete');
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

export default GuitarRenderer;