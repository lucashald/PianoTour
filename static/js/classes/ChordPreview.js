import { pianoState } from '../core/appState.js';
import { CHORD_DEFINITIONS, CHORD_GROUPS } from '../core/note-data.js';

export class ChordPreview {
    constructor(elementId, options = {}) {
        this.elementId = elementId;
        this.clef = options.clef || 'treble';
        this.chord = options.chord || []; // Can be chord name string or array of notes
        this.width = options.width || 200;
        this.height = options.height || 150;
        this.spaceAboveStaffLn = options.spaceAboveStaffLn || 3; // Default to 3
        
        // Internal state for beams and ties
        this.vexflowNotes = [];
        this.vexflowBeams = [];
        this.tieGroups = [];
        this.vexflowIndexByNoteId = {};
    }

    /**
     * Resolves a chord name or note array to an array of note names
     * @param {string|string[]} chord - Chord name (e.g., "C") or array of notes (e.g., ['C4', 'E4', 'G4'])
     * @returns {string[]} - Array of note names for the specified clef, or empty array if not found
     */
    resolveChord(chord) {
        if (!chord) return [];
        
        // If it's an array, return it as-is
        if (Array.isArray(chord)) {
            return chord;
        }
        
        // If it's a string, look it up in CHORD_DEFINITIONS
        if (typeof chord === 'string') {
            // Check if chord exists in CHORD_DEFINITIONS
            if (!(chord in CHORD_DEFINITIONS)) {
                console.error(`ChordPreview: Chord "${chord}" not found in CHORD_DEFINITIONS`);
                console.log('Available chords:', Object.keys(CHORD_DEFINITIONS).slice(0, 20), '...');
                return [];
            }
            
            const chordDef = CHORD_DEFINITIONS[chord];
            if (!chordDef) {
                console.error(`ChordPreview: Chord definition for "${chord}" is null or undefined`);
                return [];
            }
            
            // Return notes for the appropriate clef
            const notes = this.clef === 'bass' ? chordDef.bass : chordDef.treble;
            if (!notes || notes.length === 0) {
                console.error(`ChordPreview: No ${this.clef} notes found for chord "${chord}"`);
                return [];
            }
            
            return notes;
        }
        
        return [];
    }

    /**
     * Renders the chord with the specified clef
     * @param {string|string[]} chord - Optional chord name or note array (overrides constructor chord)
     */
    render(chord = null) {
        if (chord !== null) {
            this.chord = chord;
        }

        const notes = this.resolveChord(this.chord);
        
        if (notes.length === 0) {
            console.warn('ChordPreview: No notes to render');
            return;
        }

        const element = document.getElementById(this.elementId);
        if (!element) {
            console.error(`ChordPreview: Element #${this.elementId} not found!`);
            return;
        }

        element.innerHTML = "";
        this.resetInternalState();

        if (typeof Vex === "undefined" || !Vex.Flow) {
            element.innerHTML = '<div class="error">VexFlow library not loaded.</div>';
            return;
        }

        const renderer = new Vex.Flow.Renderer(element, Vex.Flow.Renderer.Backends.SVG);
        renderer.resize(this.width, this.height);
        const context = renderer.getContext();
        this.context = context;

        const stave = new Vex.Flow.Stave(10, 0, this.width - 20, {
            space_above_staff_ln: this.spaceAboveStaffLn
        });
        stave.addClef(this.clef);
        stave.setContext(context).draw();

        const keys = notes.map(note => this.noteToVexFlowKey(note));
        
        const vexNote = new Vex.Flow.StaveNote({
            keys: keys,
            duration: pianoState.quantize,
            clef: this.clef
        });

        // Apply accidentals
        keys.forEach((key, index) => {
            if (key.includes('#')) {
                vexNote.addModifier(new Vex.Flow.Accidental('#'), index);
            } else if (key.includes('b') && !key.startsWith('B')) {
                vexNote.addModifier(new Vex.Flow.Accidental('b'), index);
            }
        });

        this.vexflowNotes.push(vexNote);

        const voice = new Vex.Flow.Voice({ num_beats: 4, beat_value: 4 });
        voice.setStrict(false);
        voice.addTickables([vexNote]);

        new Vex.Flow.Formatter().joinVoices([voice]).format([voice], this.width - 60);
        voice.draw(context, stave);

        // Draw beams and ties
        this.drawAllBeams();
        this.drawTies();
    }

    /**
     * Renders multiple notes (for beaming/tying purposes)
     * @param {object[]} notesData - Array of note data objects with id, name, duration, tie info
     */
    renderNotes(notesData) {
        const element = document.getElementById(this.elementId);
        if (!element) {
            console.error(`ChordPreview: Element #${this.elementId} not found!`);
            return;
        }

        element.innerHTML = "";
        this.resetInternalState();

        if (typeof Vex === "undefined" || !Vex.Flow) {
            element.innerHTML = '<div class="error">VexFlow library not loaded.</div>';
            return;
        }

        const renderer = new Vex.Flow.Renderer(element, Vex.Flow.Renderer.Backends.SVG);
        renderer.resize(this.width, this.height);
        const context = renderer.getContext();
        this.context = context;

        const stave = new Vex.Flow.Stave(10, 0, this.width - 20, {
            space_above_staff_ln: this.spaceAboveStaffLn
        });
        
        stave.addClef(this.clef);
        stave.setContext(context).draw();

        if (notesData.length === 0) {
            return;
        }

        const vexNotes = this.createVexFlowNotes(notesData);
        this.vexflowNotes = vexNotes;

        // Create beams for beamable notes
        this.vexflowBeams = this.createBeamsForNotes(vexNotes, notesData);

        // Process ties
        this.processTies(notesData);

        const voice = new Vex.Flow.Voice({ num_beats: 4, beat_value: 4 });
        voice.setStrict(false);
        voice.addTickables(vexNotes);

        new Vex.Flow.Formatter().joinVoices([voice]).format([voice], this.width - 60);
        voice.draw(context, stave);

        this.drawAllBeams();
        this.drawTies();
    }

    /**
     * Creates VexFlow notes from note data
     */
    createVexFlowNotes(notesData) {
        const vexNotes = [];

        notesData.forEach((noteData, index) => {
            let vexNote;

            if (noteData.isRest) {
                const duration = noteData.duration.replace(/r$/, '');
                vexNote = this.createVexFlowNoteWithDots({
                    keys: this.clef === 'treble' ? ['D/5'] : ['F/3'],
                    duration: `${duration}r`,
                    clef: this.clef
                });
            } else {
                let keys;
                if (noteData.name && noteData.name.startsWith('(') && noteData.name.endsWith(')')) {
                    keys = this._parseChordString(noteData.name);
                } else {
                    keys = [this.noteToVexFlowKey(noteData.name)];
                }

                vexNote = this.createVexFlowNoteWithDots({
                    keys: keys,
                    duration: noteData.duration,
                    clef: this.clef
                });

                // Apply accidentals
                keys.forEach((key, keyIndex) => {
                    if (key.includes('#')) {
                        vexNote.addModifier(new Vex.Flow.Accidental('#'), keyIndex);
                    } else if (key.includes('b') && !key.startsWith('B')) {
                        vexNote.addModifier(new Vex.Flow.Accidental('b'), keyIndex);
                    }
                });
            }

            vexNotes.push(vexNote);
            if (noteData.id) {
                this.vexflowIndexByNoteId[noteData.id] = { vexflowIndex: index };
            }
        });

        return vexNotes;
    }

    /**
     * Creates a VexFlow note with proper dotted duration handling
     */
    createVexFlowNoteWithDots(noteOptions) {
        const isDotted = noteOptions.duration.includes('.');
        const baseDuration = noteOptions.duration.replace('.', '');

        const cleanOptions = {
            ...noteOptions,
            duration: baseDuration
        };

        const vexNote = new Vex.Flow.StaveNote(cleanOptions);

        if (isDotted) {
            const dot = new Vex.Flow.Dot();
            vexNote.addModifier(dot, 0);
        }

        return vexNote;
    }

    /**
     * Parses a chord string like "(C4 E4 G4)" into VexFlow keys
     */
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

    /**
     * Checks if a note can be beamed
     */
    isBeamableNote(vexNote) {
        if (!vexNote || vexNote.isRest()) return false;

        const duration = vexNote.getDuration();
        const beamableDurations = ['8', '16', '32', '64', '128'];
        return beamableDurations.includes(duration);
    }

    /**
     * Creates beams for beamable notes
     */
    createBeamsForNotes(vexNotes, notesData) {
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
     * Processes tie information from notes data
     */
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

    /**
     * Draws all beams
     */
    drawAllBeams() {
        if (this.vexflowBeams.length > 0 && this.context) {
            this.vexflowBeams.forEach(beam => beam.setContext(this.context).draw());
        }
    }

    /**
     * Draws all ties
     */
    drawTies() {
        if (!this.context) return;

        this.tieGroups.forEach(tie => {
            const startInfo = this.vexflowIndexByNoteId[tie.startNoteId];
            const endInfo = this.vexflowIndexByNoteId[tie.endNoteId];

            if (startInfo && endInfo) {
                const startVexNote = this.vexflowNotes[startInfo.vexflowIndex];
                const endVexNote = this.vexflowNotes[endInfo.vexflowIndex];

                if (startVexNote && endVexNote) {
                    if (tie.type === 'tie') {
                        const staveTie = new Vex.Flow.StaveTie({
                            first_note: startVexNote,
                            last_note: endVexNote,
                            first_indices: [0],
                            last_indices: [0]
                        });
                        staveTie.setContext(this.context).draw();
                    } else if (tie.type === 'slur') {
                        const curve = new Vex.Flow.Curve(startVexNote, endVexNote, {
                            x_shift: -1,
                            y_shift: 10,
                            position: Vex.Flow.Stem.UP,
                            position_end: Vex.Flow.Stem.UP,
                        });
                        curve.setContext(this.context).draw();
                    }
                }
            } else {
                console.warn(`ChordPreview: Could not find start/end notes for tie:`, tie);
            }
        });
    }

    /**
     * Converts a note name like 'C4' or 'F#3' to VexFlow format 'C/4' or 'F#/3'
     * Also handles double sharps (C##) and double flats (Cbb)
     */
    noteToVexFlowKey(note) {
        // Handle double sharps and double flats by converting to enharmonic equivalents
        const enharmonicMap = {
            'C##': 'D',
            'D##': 'E',
            'E##': 'F#',
            'F##': 'G#',
            'G##': 'A',
            'A##': 'B',
            'B##': 'C',
            'Cbb': 'Bb',
            'Dbb': 'C',
            'Ebb': 'D',
            'Fbb': 'Eb',
            'Gbb': 'F',
            'Abb': 'G',
            'Bbb': 'A'
        };

        // First try to match with the standard regex (single accidentals)
        let noteRegex = /^([A-G][#b]?)(\d+)$/;
        let match = note.match(noteRegex);

        if (match) {
            const [, noteName, octave] = match;
            return `${noteName}/${octave}`;
        }

        // Try to match double accidentals
        noteRegex = /^([A-G]#{2}|[A-G]b{2})(\d+)$/;
        match = note.match(noteRegex);

        if (match) {
            const [, noteWithAccidental, octave] = match;
            const enharmonic = enharmonicMap[noteWithAccidental];
            
            if (enharmonic) {
                return `${enharmonic}/${octave}`;
            }
        }

        // Check if it's already in VexFlow format
        if (note.includes('/')) {
            return note;
        }

        console.error(`ChordPreview: Invalid note format: ${note}`);
        return 'C/4';
    }

    /**
     * Updates the chord and re-renders
     * @param {string|string[]} chord - Chord name or array of notes
     */
    setChord(chord) {
        this.chord = chord;
        this.render();
    }

    /**
     * Updates the clef and re-renders
     */
    setClef(clef) {
        this.clef = clef;
        this.render();
    }

    /**
     * Clears the rendered content
     */
    clear() {
        const element = document.getElementById(this.elementId);
        if (element) {
            element.innerHTML = "";
        }
        this.resetInternalState();
    }

    /**
     * Resets internal state
     */
    resetInternalState() {
        this.vexflowNotes = [];
        this.vexflowBeams = [];
        this.tieGroups = [];
        this.vexflowIndexByNoteId = {};
        this.context = null;
    }
}