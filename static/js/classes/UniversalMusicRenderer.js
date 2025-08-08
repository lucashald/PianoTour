import { DRUM_INSTRUMENT_MAP } from "../core/drum-data.js";

export class UniversalMusicRenderer {
constructor(elementId, options = {}) {
    this.elementId = elementId;
    this.instrumentType = options.instrumentType || 'piano';
    this.measuresPerSystem = options.measuresPerSystem || 100;
    this.measureWidth = options.measureWidth || 300;
    this.showTablature = options.showTablature !== false;
    this.timeSignature = options.timeSignature || { numerator: 4, denominator: 4 };
    this.tempo = options.tempo || 120;
    this.keySignature = options.keySignature || 'C';

    // Scrolling properties
    this.scrollContainerElementId = options.scrollContainerElementId || this.getDefaultScrollContainer();
    this.autoScroll = options.autoScroll !== false; // Default to true
    this.smoothScroll = options.smoothScroll !== false; // Default to true
    this.disableScrolling = options.disableScrolling === true;

    this.drumInstrumentMap = DRUM_INSTRUMENT_MAP;
}

    /**
     * Gets the default scroll container element ID based on instrument type
     * @returns {string} Element ID for scroll container
     */
    getDefaultScrollContainer() {
        switch (this.instrumentType) {
            case 'drums':
                return 'drums-score-wrap';
            case 'piano':
                return 'scoreWrap';
            case 'guitar':
                return 'guitar-score-wrap';
            default:
                return 'scoreWrap';
        }
    }

    /**
 * Scrolls to a specific measure
 * @param {number} measureIndex - Index of measure to scroll to
 * @param {boolean} smoothScroll - Whether to use smooth scrolling (default: true)
 */
scrollToMeasure(measureIndex, smoothScroll = null) {
    if (this.disableScrolling) {
        console.log('UniversalMusicRenderer: Scrolling is disabled');
        return;
    }

    if (smoothScroll === null) {
        smoothScroll = this.smoothScroll;
    }

    console.log(`UniversalMusicRenderer: Scrolling to measure ${measureIndex}`);
    
    const scrollContainer = document.getElementById(this.scrollContainerElementId);
    if (!scrollContainer) {
        console.warn(`UniversalMusicRenderer: Scroll container #${this.scrollContainerElementId} not found`);
        return;
    }

    if (!this.measureXPositions[measureIndex]) {
        console.warn(`UniversalMusicRenderer: No position data for measure ${measureIndex}`);
        return;
    }

    // Calculate target scroll position (center the measure)
    const targetScrollLeft = Math.max(
        0,
        this.measureXPositions[measureIndex] - 
        scrollContainer.clientWidth / 2 + 
        this.measureWidth / 2
    );

    // Check if we're already close to the target position
    const currentScrollLeft = scrollContainer.scrollLeft;
    const scrollTolerance = 10;
    
    if (Math.abs(currentScrollLeft - targetScrollLeft) <= scrollTolerance) {
        console.log(`UniversalMusicRenderer: Already at measure ${measureIndex}, skipping scroll`);
        return;
    }

    // Perform the scroll
    if (smoothScroll) {
        scrollContainer.scrollTo({
            left: targetScrollLeft,
            behavior: "smooth",
        });
    } else {
        scrollContainer.scrollLeft = targetScrollLeft;
    }
    
    console.log(`UniversalMusicRenderer: Scrolled to measure ${measureIndex} (${smoothScroll ? 'smooth' : 'instant'})`);
}

/**
 * Auto-scrolls to the latest (rightmost) measure
 * @param {boolean} smoothScroll - Whether to use smooth scrolling
 */
autoScrollToLatest(smoothScroll = null) {
    if (this.disableScrolling) {
        console.log('UniversalMusicRenderer: Auto-scroll disabled');
        return;
    }

    if (smoothScroll === null) {
        smoothScroll = this.smoothScroll;
    }

    const lastMeasureIndex = this.measureXPositions.length - 1;
    if (lastMeasureIndex >= 0) {
        this.scrollToMeasure(lastMeasureIndex, smoothScroll);
    }
}

/**
 * Auto-scrolls to the far right of the score
 */
autoScrollToEnd() {
    if (this.disableScrolling) {
        console.log('UniversalMusicRenderer: Auto-scroll to end disabled');
        return;
    }

    const scrollContainer = document.getElementById(this.scrollContainerElementId);
    if (!scrollContainer) {
        console.warn(`UniversalMusicRenderer: Scroll container #${this.scrollContainerElementId} not found`);
        return;
    }

    if (this.smoothScroll) {
        scrollContainer.scrollTo({
            left: scrollContainer.scrollWidth - scrollContainer.clientWidth,
            behavior: "smooth",
        });
    } else {
        scrollContainer.scrollLeft = scrollContainer.scrollWidth - scrollContainer.clientWidth;
    }
    
    console.log('UniversalMusicRenderer: Auto-scrolled to end');
}

    isBeamableNote(vexNote) {
        if (!vexNote || vexNote.isRest()) return false;

        const duration = vexNote.getDuration();
        const beamableDurations = ['8', '16', '32', '64', '128'];
        return beamableDurations.includes(duration);
    }

    createBeamsForNotes(vexNotes, notesData) {
        // Filter to only beamable notes (no rests)
        const beamableNotes = vexNotes.filter(note => this.isBeamableNote(note));
        
        if (beamableNotes.length < 2) {
            return []; // Need at least 2 notes to beam
        }

        // Use VexFlow's generateBeams with maintain_stem_directions
        const beams = Vex.Flow.Beam.generateBeams(beamableNotes, {
            beam_rests: false,                    // Don't beam over rests
            maintain_stem_directions: true,       // ← This preserves individual stem directions!
            groups: []                           // Let VexFlow auto-group by beat
        });

        return beams;
    }
    
    render(measuresData, options = {}) {
        console.log(`UniversalMusicRenderer: Rendering ${this.instrumentType} notation`);

        try {
            switch (this.instrumentType) {
                case 'piano':
                    this.renderMultiSystem(measuresData, options, this.renderPianoSystem.bind(this));
                    break;
                case 'drums':
                    this.renderMultiSystem(measuresData, options, this.renderDrumsSystem.bind(this));
                    break;
                case 'guitar':
                    this.renderMultiSystem(measuresData, options, this.renderGuitarSystem.bind(this));
                    break;
                default:
                    throw new Error(`Unknown instrument type: ${this.instrumentType}`);
            }
        } catch (error) {
            console.error(`UniversalMusicRenderer: Rendering error:`, error);
            const element = document.getElementById(this.elementId);
            if (element) {
                element.innerHTML = `<div class="error">Rendering error: ${error.message}</div>`;
            }
        }
    }

renderMultiSystem(measuresData, options, renderSystemFunc) {
    console.log(`UniversalMusicRenderer: Rendering multi-system ${this.instrumentType} notation`);

    const element = document.getElementById(this.elementId);
    if (!element) {
        console.error(`UniversalMusicRenderer: Element #${this.elementId} not found!`);
        return;
    }

    element.innerHTML = "";
    this.resetInternalState();

    if (typeof Vex === "undefined" || !Vex.Flow) {
        element.innerHTML = '<div class="error">VexFlow library not loaded.</div>';
        return;
    }

    const measureCount = measuresData.length;
    
    // ← ADD THIS: Handle unlimited measures per system
    const isUnlimitedMeasures = this.measuresPerSystem === null || this.measuresPerSystem === 0;
    const effectiveMeasuresPerSystem = isUnlimitedMeasures ? measureCount : this.measuresPerSystem;
    const totalSystems = isUnlimitedMeasures ? 1 : Math.ceil(measureCount / this.measuresPerSystem);

    console.log(`UniversalMusicRenderer: ${isUnlimitedMeasures ? 'Unlimited' : effectiveMeasuresPerSystem} measures per system, ${totalSystems} total systems`);

    // Reset measure positions
    this.measureXPositions = [];
    const allVoices = [];

    for (let systemIndex = 0; systemIndex < totalSystems; systemIndex++) {
        const startMeasureIndex = systemIndex * effectiveMeasuresPerSystem;
        const endMeasureIndex = isUnlimitedMeasures ? measureCount : Math.min(startMeasureIndex + effectiveMeasuresPerSystem, measureCount);
        const systemMeasures = measuresData.slice(startMeasureIndex, endMeasureIndex);
        const measuresInSystem = systemMeasures.length;

        const systemDiv = document.createElement('div');
        const systemDivId = `${this.elementId}-system-${systemIndex}`;
        systemDiv.id = systemDivId;
        
        // ← MODIFY THIS: Calculate width based on actual measures in system
        const systemWidth = this.measureWidth * measuresInSystem + 80;
        systemDiv.style.width = `${systemWidth}px`;
        element.appendChild(systemDiv);

        let height;
        if (this.instrumentType === 'piano') {
            height = 300;
        } else if (this.instrumentType === 'drums') {
            height = 150;
        } else if (this.instrumentType === 'guitar') {
            height = this.showTablature ? 280 : 200;
        }

        const factory = new Vex.Flow.Factory({
            renderer: {
                elementId: systemDiv.id,
                width: systemWidth,
                height: height,
            },
        });
        const context = factory.getContext();
        this.vexFlowFactories.push(factory);
        this.vfContexts.push(context);

        // Pass systemIndex and track positions
        const systemVoices = renderSystemFunc(systemMeasures, factory, context, startMeasureIndex, measureCount, totalSystems, systemIndex);
        
        if (systemVoices && Array.isArray(systemVoices)) {
            allVoices.push(...systemVoices);
        }
    }

    if (allVoices.length > 0) {
        Vex.Flow.Accidental.applyAccidentals(allVoices, this.keySignature);
    }

    this.drawAllBeams();
    this.drawTies();

    // ← MODIFY THIS: Only auto-scroll if scrolling is enabled
    if (!this.disableScrolling && this.autoScroll && measureCount > 0) {
        // Use setTimeout to ensure DOM is updated
        setTimeout(() => {
            this.autoScrollToLatest();
        }, 100);
    }

    console.log(`UniversalMusicRenderer: ${this.instrumentType} rendering complete.`);
}

    renderPianoSystem(systemMeasures, factory, context, startMeasureIndex, measureCount, totalSystems, systemIndex) {
        let currentX = 20;
        const systemVoices = [];

        for (let i = 0; i < systemMeasures.length; i++) {
            const globalIndex = startMeasureIndex + i;
            const measure = systemMeasures[i];

            // Track measure X position
            this.measureXPositions[globalIndex] = currentX;

            this.vexflowNoteMap[globalIndex] = { treble: [], bass: [] };

            const trebleStave = new Vex.Flow.Stave(currentX, 40, this.measureWidth);
            if (globalIndex === 0) { 
                trebleStave.setTempo({ duration: 'q', bpm: this.tempo }, -20); 
            }
            const bassStave = new Vex.Flow.Stave(currentX, 160, this.measureWidth);

            if (i === 0) {
                trebleStave.addClef('treble').addKeySignature(this.keySignature);
                trebleStave.addTimeSignature(`${this.timeSignature.numerator}/${this.timeSignature.denominator}`);
                bassStave.addClef('bass').addKeySignature(this.keySignature);
                bassStave.addTimeSignature(`${this.timeSignature.numerator}/${this.timeSignature.denominator}`);
            }

            trebleStave.setContext(context).draw();
            bassStave.setContext(context).draw();
            
            // Add initial connectors only for the first measure of the first system
            if (i === 0) {
              const brace = new Vex.Flow.StaveConnector(trebleStave, bassStave);
              brace.setType(Vex.Flow.StaveConnector.type.BRACE);
              brace.setContext(context).draw();
              const connector = new Vex.Flow.StaveConnector(trebleStave, bassStave);
              connector.setType(Vex.Flow.StaveConnector.type.SINGLE_LEFT);
              connector.setContext(context).draw();
            }

            // Add end connectors to the last measure of each system
            if (i === systemMeasures.length - 1) {
              const connectorType = systemIndex === totalSystems - 1 ? Vex.Flow.StaveConnector.type.BOLD_DOUBLE_RIGHT : Vex.Flow.StaveConnector.type.SINGLE_RIGHT;
              const connector = new Vex.Flow.StaveConnector(trebleStave, bassStave);
              connector.setType(connectorType);
              connector.setContext(context).draw();
            }

const formatterWidth = trebleStave.getNoteEndX() - trebleStave.getNoteStartX() - 20; // 20px right padding
            
            // Filter notes by clef
            const trebleNotesData = measure.filter(n => n.clef === 'treble');
            const bassNotesData = measure.filter(n => n.clef === 'bass');

            if (trebleNotesData.length > 0) {
                const trebleVexNotes = this.createVexFlowNotes(trebleNotesData, globalIndex, 'treble');
                this.vexflowNoteMap[globalIndex].treble = trebleVexNotes;
                this.vexflowBeams[globalIndex] = this.vexflowBeams[globalIndex] || {};
                this.vexflowBeams[globalIndex].treble = this.createBeamsForNotes(trebleVexNotes, trebleNotesData);
                this.processTies(trebleNotesData);

                const trebleVoice = this.createVoice(trebleVexNotes);
                systemVoices.push(trebleVoice);
                factory.Formatter().joinVoices([trebleVoice]).format([trebleVoice], formatterWidth);
                trebleVoice.draw(context, trebleStave);
            }

            if (bassNotesData.length > 0) {
                const bassVexNotes = this.createVexFlowNotes(bassNotesData, globalIndex, 'bass');
                this.vexflowNoteMap[globalIndex].bass = bassVexNotes;
                this.vexflowBeams[globalIndex] = this.vexflowBeams[globalIndex] || {};
                this.vexflowBeams[globalIndex].bass = this.createBeamsForNotes(bassVexNotes, bassNotesData);
                this.processTies(bassNotesData);

                const bassVoice = this.createVoice(bassVexNotes);
                systemVoices.push(bassVoice);
                factory.Formatter().joinVoices([bassVoice]).format([bassVoice], formatterWidth);
                bassVoice.draw(context, bassStave);
            }

            this.vexflowStaveMap[globalIndex] = { treble: trebleStave, bass: bassStave };
            currentX += this.measureWidth;
        }

        return systemVoices;
    }

    renderDrumsSystem(systemMeasures, factory, context, startMeasureIndex, measureCount, totalSystems, systemIndex) {
        let currentX = 20;
        const systemVoices = [];

        for (let i = 0; i < systemMeasures.length; i++) {
            const globalIndex = startMeasureIndex + i;
            const measureNotesData = systemMeasures[i];
            
            // Track measure X position
            this.measureXPositions[globalIndex] = currentX;
            
            const stave = new Vex.Flow.Stave(currentX, 40, this.measureWidth);
            
            if (i === 0) {
                stave.addClef('percussion').addKeySignature(this.keySignature);
                stave.addTimeSignature(`${this.timeSignature.numerator}/${this.timeSignature.denominator}`);
                if (globalIndex === 0) { 
                    stave.setTempo({ duration: 'q', bpm: this.tempo }, -27); 
                }
            }

            if (i === systemMeasures.length - 1) {
                const endBarType = systemIndex === totalSystems - 1 
                    ? Vex.Flow.Barline.type.END 
                    : Vex.Flow.Barline.type.DOUBLE;
                stave.setEndBarType(endBarType);
            }

            stave.setContext(context).draw();

            const formatterWidth = stave.getNoteEndX() - stave.getNoteStartX() - 20; // 20px right padding
            const vexNotesForMeasure = this.renderDrumNotes(measureNotesData, globalIndex);

            this.vexflowBeams[globalIndex] = this.createBeamsForNotes(vexNotesForMeasure, measureNotesData);
            this.processTies(measureNotesData);

            const voice = this.createVoice(vexNotesForMeasure);
            systemVoices.push(voice);
            factory.Formatter().joinVoices([voice]).format([voice], formatterWidth);
            voice.draw(context, stave);

            this.vexflowStaveMap[globalIndex] = stave;
            currentX += this.measureWidth;
        }

        return systemVoices;
    }

    renderGuitarSystem(systemMeasures, factory, context, startMeasureIndex, measureCount) {
        let currentX = 20;

        for (let i = 0; i < systemMeasures.length; i++) {
            const globalIndex = startMeasureIndex + i;
            const measureNotesData = systemMeasures[i];
            
            // Track measure X position
            this.measureXPositions[globalIndex] = currentX;
            
            const staveWidth = (i === 0 && systemMeasures.length > 1) ? this.measureWidth + 60 : this.measureWidth;

            const standardStave = new Vex.Flow.Stave(currentX, 50, staveWidth);
            let tabStave = null;

            if (this.showTablature) {
                tabStave = new Vex.Flow.TabStave(currentX, 150, staveWidth);
                tabStave.addTabGlyph();
            }

            if (i === 0) {
                standardStave.addClef('treble').addKeySignature(this.keySignature);
                standardStave.addTimeSignature(`${this.timeSignature.numerator}/${this.timeSignature.denominator}`);
                standardStave.setTempo({ duration: 'q', bpm: this.tempo }, -30);
                if (tabStave) {
                    tabStave.addClef('treble');
                    tabStave.addTimeSignature(`${this.timeSignature.numerator}/${this.timeSignature.denominator}`);
                }
            }

            if (globalIndex === measureCount - 1) {
                standardStave.setEndBarType(Vex.Flow.Barline.type.END);
                if (tabStave) tabStave.setEndBarType(Vex.Flow.Barline.type.END);
            } else if (i === systemMeasures.length - 1) {
                standardStave.setEndBarType(Vex.Flow.Barline.type.DOUBLE);
                if (tabStave) tabStave.setEndBarType(Vex.Flow.Barline.type.DOUBLE);
            }

            standardStave.setContext(context).draw();
            if (tabStave) tabStave.setContext(context).draw();

            if (this.showTablature) {
                const connector = new Vex.Flow.StaveConnector(standardStave, tabStave);
                connector.setType(Vex.Flow.StaveConnector.type.BRACKET);
                connector.setContext(context).draw();
            }

            this.vexflowNoteMap[globalIndex] = { treble: [], tab: [] };

            const { standardNotes, tabNotes } = this.convertGuitarNotes(measureNotesData, globalIndex);
            this.vexflowNoteMap[globalIndex].treble = standardNotes;
            this.vexflowNoteMap[globalIndex].tab = tabNotes;

            this.vexflowBeams[globalIndex] = this.createBeamsForNotes(standardNotes, measureNotesData);
            this.processTies(measureNotesData);
            
            const formatterWidth = standardStave.getNoteStartX() - standardStave.getX() + standardStave.getNoteEndX() - standardStave.getNoteStartX();

            if (standardNotes.length > 0) {
                const standardVoice = this.createVoice(standardNotes);

                if (this.showTablature && tabNotes.length > 0) {
                    const tabVoice = this.createVoice(tabNotes);
                    factory.Formatter().joinVoices([standardVoice, tabVoice]).format([standardVoice, tabVoice], formatterWidth);
                    standardVoice.draw(context, standardStave);
                    tabVoice.draw(context, tabStave);
                } else {
                    factory.Formatter().joinVoices([standardVoice]).format([standardVoice], formatterWidth);
                    standardVoice.draw(context, standardStave);
                }
            }

            this.vexflowStaveMap[globalIndex] = { standard: standardStave, tab: tabStave };
            currentX += staveWidth;
        }
    }
    
    renderDrumNotes(notesData, measureIndex) {
        const vexNotes = [];
        this.vexflowNoteMap[measureIndex] = { percussion: [] };
        notesData.forEach((noteData, index) => {
            let vexNote;
            
if (noteData.isRest) {
    vexNote = new Vex.Flow.StaveNote({ 
        keys: ['B/4'], 
        duration: `${noteData.duration.replace(/r$/, '')}r`, // Remove any existing 'r' first
        clef: 'percussion' 
    });
            } else if (noteData.isChord) {
                // Handle drum chords
                const { notes, duration } = noteData;

                const keys = notes.map((n) => {
                    const instrumentProps = this.drumInstrumentMap[n.drumInstrument];
                    if (!instrumentProps) {
                        console.warn(`Unknown drum instrument in chord: ${n.drumInstrument}. Skipping note ID: ${noteData.id}`);
                        return 'B/4';
                    }
                    return instrumentProps.keys[0];
                });
                
                const noteHeads = notes.map((n) => {
                    const instrumentProps = this.drumInstrumentMap[n.drumInstrument];
                    return { type: instrumentProps.notehead };
                });

                const stemDirection = notes[0].stemDirection || Vex.Flow.Stem.UP;

                vexNote = new Vex.Flow.StaveNote({
                    keys,
                    duration,
                    stem_direction: stemDirection,
                    note_heads: noteHeads,
                    clef: 'percussion'
                });

                // Apply modifiers from the first note's instrument
                const firstInstrumentProps = this.drumInstrumentMap[notes[0].drumInstrument];
                if (firstInstrumentProps.modifiers && firstInstrumentProps.modifiers.length > 0) {
                    firstInstrumentProps.modifiers.forEach((mod) => {
                        if (mod.type === "articulation") {
                            const articulation = new Vex.Flow.Articulation(mod.symbol);
                            if (mod.position) {
                                const positionMap = {
                                    "above": Vex.Flow.Modifier.Position.ABOVE,
                                    "below": Vex.Flow.Modifier.Position.BELOW
                                };
                                articulation.setPosition(positionMap[mod.position]);
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

                if (noteData.chordName) {
                    const annotation = new Vex.Flow.Annotation(noteData.chordName)
                        .setFont({ family: 'Arial', size: 12, weight: 'bold' })
                        .setVerticalJustification(Vex.Flow.Annotation.VerticalJustify.BOTTOM);
                    vexNote.addModifier(annotation, 0);
                }
            } else {
                // Handle single drum notes
                const { drumInstrument, duration } = noteData;
                const instrumentProps = this.drumInstrumentMap[drumInstrument];

                if (!instrumentProps) {
                    console.warn(`Unknown drum instrument: ${drumInstrument}`);
                    return;
                }

                const noteOptions = {
                    keys: instrumentProps.keys,
                    duration: duration,
                    stem_direction: instrumentProps.stemDirection,
                    clef: 'percussion'
                };

                if (instrumentProps.notehead && instrumentProps.notehead !== 'normal') {
                    noteOptions.type = instrumentProps.notehead;
                }

                vexNote = new Vex.Flow.StaveNote(noteOptions);

                if (instrumentProps.modifiers && instrumentProps.modifiers.length > 0) {
                    instrumentProps.modifiers.forEach((mod) => {
                        if (mod.type === "articulation") {
                            const articulation = new Vex.Flow.Articulation(mod.symbol);
                            if (mod.position) {
                                const positionMap = {
                                    "above": Vex.Flow.Modifier.Position.ABOVE,
                                    "below": Vex.Flow.Modifier.Position.BELOW
                                };
                                articulation.setPosition(positionMap[mod.position]);
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

                if (noteData.chordName) {
                    const annotation = new Vex.Flow.Annotation(noteData.chordName)
                        .setFont({ family: 'Arial', size: 12, weight: 'bold' })
                        .setVerticalJustification(Vex.Flow.Annotation.VerticalJustify.BOTTOM);
                    vexNote.addModifier(annotation, 0);
                }
            }

            vexNotes.push(vexNote);
            this.vexflowNoteMap[measureIndex].percussion.push(vexNote);
            this.vexflowIndexByNoteId[noteData.id] = { 
                measureIndex, 
                clef: 'percussion', 
                vexflowIndex: vexNotes.length - 1 
            };
        });

        if (vexNotes.length === 0) {
            vexNotes.push(new Vex.Flow.StaveNote({ 
                keys: ['B/4'], 
                duration: 'wr', 
                clef: 'percussion' 
            }));
        }
        return vexNotes;
    }

    // Parses a string like "(C4 E4 G4)" into an array of strings like ["C/4", "E/4", "G/4"]
    _parseChordString(chordString) {
        if (typeof chordString !== 'string' || !chordString.startsWith('(')) {
            return [this.noteToVexFlowKey(chordString)];
        }

        return chordString.slice(1, -1).split(' ').map(note => {
            const noteRegex = /^([A-G][#b]?)(\d+)$/;
            const match = note.match(noteRegex);
            if (match) {
                return `${match[1]}/${match[2]}`;
            }
            console.warn(`Invalid note found in chord string: ${note}`);
            return 'C/4';
        });
    }

    createVexFlowNotes(notesData, measureIndex, clef) {
        const vexNotes = [];
        notesData.forEach((noteData, index) => {
            let vexNote;
if (noteData.isRest) {
    vexNote = new Vex.Flow.StaveNote({
        keys: clef === 'treble' ? ['D/5'] : ['F/3'],
        duration: `${noteData.duration.replace(/r$/, '')}r`, // Remove any existing 'r' first
        clef: clef
    });
            } else {
                let keys;
                if (noteData.name.startsWith('(') && noteData.name.endsWith(')')) {
                    keys = this._parseChordString(noteData.name);
                } else {
                    keys = [this.noteToVexFlowKey(noteData.name)];
                }

                vexNote = this.createNoteWithModifiers(
                    keys,
                    noteData.duration,
                    Vex.Flow.Stem.AUTO,
                    'normal',
                    clef,
                    null,
                    noteData.chordName
                );
            }
            vexNotes.push(vexNote);
            this.vexflowIndexByNoteId[noteData.id] = { measureIndex, clef, vexflowIndex: vexNotes.length - 1 };
        });

        if (vexNotes.length === 0) {
            vexNotes.push(new Vex.Flow.StaveNote({
                keys: clef === 'treble' ? ['D/5'] : ['F/3'],
                duration: 'wr',
                clef: clef
            }));
        }
        return vexNotes;
    }

    createNoteWithModifiers(keys, duration, stemDirection, noteheadType, clef, modifiers, chordName) {
        const noteOptions = {
            keys,
            duration,
            stem_direction: stemDirection,
            clef
        };

        if (noteheadType && noteheadType !== 'normal') {
            noteOptions.type = noteheadType;
        }

        const vexNote = new Vex.Flow.StaveNote(noteOptions);

        if (modifiers && modifiers.length > 0) {
            modifiers.forEach((mod) => {
                if (mod.type === "articulation") {
                    const articulation = new Vex.Flow.Articulation(mod.symbol);
                    if (mod.position) {
                        articulation.setPosition(mod.position === 'above' ? Vex.Flow.Modifier.Position.ABOVE : Vex.Flow.Modifier.Position.BELOW);
                    }
                    vexNote.addModifier(articulation, 0);
                } else if (mod.type === "annotation") {
                    const annotation = new Vex.Flow.Annotation(mod.text).setFont({ family: "Arial", size: 10, weight: "bold" });
                    if (mod.justification) {
                        annotation.setJustification(mod.justification);
                    }
                    vexNote.addModifier(annotation, 0);
                }
            });
        }

        if (chordName) {
            const annotation = new Vex.Flow.Annotation(chordName)
                .setFont({ family: 'Arial', size: 12, weight: 'bold' })
                .setVerticalJustification(Vex.Flow.Annotation.VerticalJustify.BOTTOM);
            vexNote.addModifier(annotation, 0);
        }
        return vexNote;
    }

    convertGuitarNotes(measureNotesData, measureIndex) {
        const standardNotes = [];
        const tabNotes = [];

        measureNotesData.forEach((noteData, index) => {
            const { string, fret, duration, isRest, name, chordName } = noteData;

            if (isRest) {
                standardNotes.push(new Vex.Flow.StaveNote({
                    keys: ['D/5'],
                    duration: `${duration}r`,
                    clef: 'treble'
                }));
                if (this.showTablature) {
                    tabNotes.push(new Vex.Flow.TabNote({ positions: [], duration: `${duration}r` }));
                }
            } else {
                let noteNames;
                let tabPositions = [];

                if (name && name.startsWith('(') && name.endsWith(')')) {
                    noteNames = this._parseChordString(name);
                } else {
                    noteNames = name ? [this.noteToVexFlowKey(name)] : null;
                }

                if (string !== undefined && fret !== undefined) {
                    if (Array.isArray(string)) {
                        for (let i = 0; i < string.length; i++) {
                            tabPositions.push({ str: string[i], fret: fret[i].toString() });
                            if (!noteNames) {
                                noteNames = [this.noteToVexFlowKey(this.stringToNote(string[i], fret[i]))];
                            } else {
                                noteNames.push(this.noteToVexFlowKey(this.stringToNote(string[i], fret[i])));
                            }
                        }
                    } else {
                        tabPositions.push({ str: string, fret: fret.toString() });
                        if (!noteNames) {
                            noteNames = [this.noteToVexFlowKey(this.stringToNote(string, fret))];
                        }
                    }
                } else if (!noteNames) {
                    console.warn('Guitar note missing note name or string/fret information:', noteData);
                    return;
                }

                const vexNote = this.createNoteWithModifiers(
                    noteNames,
                    duration,
                    Vex.Flow.Stem.AUTO,
                    'normal',
                    'treble',
                    null,
                    chordName
                );

                standardNotes.push(vexNote);
                this.vexflowIndexByNoteId[noteData.id] = { measureIndex, clef: 'treble', vexflowIndex: standardNotes.length - 1 };

                if (this.showTablature && tabPositions.length > 0) {
                    const tabNote = new Vex.Flow.TabNote({
                        positions: tabPositions,
                        duration: duration
                    });
                    tabNotes.push(tabNote);
                    this.vexflowIndexByNoteId[noteData.id] = { measureIndex, clef: 'tab', vexflowIndex: tabNotes.length - 1 };
                }
            }
        });

        if (standardNotes.length === 0) {
            standardNotes.push(new Vex.Flow.StaveNote({ keys: ['D/5'], duration: 'wr', clef: 'treble' }));
            if (this.showTablature) {
                tabNotes.push(new Vex.Flow.TabNote({ positions: [], duration: 'wr' }));
            }
        }
        return { standardNotes, tabNotes };
    }

    createVoice(notes) {
        const voice = new Vex.Flow.Voice({
            num_beats: this.timeSignature.numerator,
            beat_value: this.timeSignature.denominator
        });
        voice.setStrict(false);
        voice.addTickables(notes);
        return voice;
    }

    drawAllBeams() {
        this.vexflowBeams.forEach((measureBeams, index) => {
            const context = this.vfContexts[Math.floor(index / this.measuresPerSystem)];
            if (measureBeams && context) {
                if (typeof measureBeams === 'object' && (measureBeams.treble || measureBeams.bass)) {
                    if (measureBeams.treble && measureBeams.treble.length > 0) {
                        measureBeams.treble.forEach(beam => beam.setContext(context).draw());
                    }
                    if (measureBeams.bass && measureBeams.bass.length > 0) {
                        measureBeams.bass.forEach(beam => beam.setContext(context).draw());
                    }
                } else if (Array.isArray(measureBeams) && measureBeams.length > 0) {
                    measureBeams.forEach(beam => beam.setContext(context).draw());
                }
            }
        });
    }

    processTies(notesData) {
        notesData.forEach((noteData) => {
            if (noteData.tie) {
                if (noteData.tie.startNoteId && noteData.tie.endNoteId) {
                    this.tieGroups.push({
                        type: noteData.tie.type || 'tie',
                        startNoteId: noteData.tie.startNoteId,
                        endNoteId: noteData.tie.endNoteId
                    });
                }
            }
        });
    }

    drawTies() {
        const vexNotesById = {};
        for (const id in this.vexflowIndexByNoteId) {
            const info = this.vexflowIndexByNoteId[id];
            const vexNote = this.vexflowNoteMap[info.measureIndex][info.clef][info.vexflowIndex];
            vexNotesById[id] = vexNote;
        }

        this.tieGroups.forEach(tie => {
            const startVexNote = vexNotesById[tie.startNoteId];
            const endVexNote = vexNotesById[tie.endNoteId];

            if (startVexNote && endVexNote) {
                const startIndex = this.vexflowIndexByNoteId[tie.startNoteId].measureIndex;
                const context = this.vfContexts[Math.floor(startIndex / this.measuresPerSystem)];

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
                console.warn(`Could not find start/end notes for tie:`, tie);
            }
        });
    }

    stringToNote(stringNumber, fret) {
        const stringIndex = stringNumber - 1;
        const openNote = this.guitarConfig.standardTuning[stringIndex];
        return this.transposeNote(openNote, fret);
    }

    transposeNote(note, semitones) {
        const noteRegex = /([A-G])([#b]?)(\d+)/;
        const match = note.match(noteRegex);
        if (!match) return note;

        const [, noteName, accidental, octave] = match;
        const noteValues = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
        const accidentalValue = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;

        let midiNote = noteValues[noteName] + accidentalValue + (parseInt(octave) * 12);
        midiNote += semitones;

        const newOctave = Math.floor(midiNote / 12);
        const newNoteValue = midiNote % 12;
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        return noteNames[newNoteValue] + newOctave;
    }

    noteToVexFlowKey(note) {
        const noteRegex = /^([A-G][#b]?)(\d+)$/;
        const match = note.match(noteRegex);

        if (match) {
            const [, noteName, octave] = match;
            return `${noteName}/${octave}`;
        }

        if (note.includes('/')) {
            return note;
        }

        console.error(`Invalid note format: ${note}`);
        return 'C/4';
    }

    clear() {
        const element = document.getElementById(this.elementId);
        if (element) {
            element.innerHTML = "";
        }
        this.resetInternalState();
    }

    resetInternalState() {
        this.vexFlowFactories = [];
        this.vfContexts = [];
        this.vexflowNoteMap = [];
        this.vexflowStaveMap = [];
        this.vexflowIndexByNoteId = {};
        this.vexflowBeams = [];
        this.tieGroups = [];
        this.measureXPositions = []; // Added for scrolling
    }
}