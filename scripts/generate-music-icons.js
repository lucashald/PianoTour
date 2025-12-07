/**
 * VexFlow Music Icon Generator - Node.js Script
 * 
 * Generates SVG icons for all musical notation symbols using VexFlow
 * and saves them to the static/images/svg/vexflow/ folder.
 * 
 * Usage: 
 *   npm install vexflow jsdom
 *   node scripts/generate-music-icons.js
 */

import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a virtual DOM environment for VexFlow
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="output"></div></body></html>');
global.document = dom.window.document;
global.window = dom.window;

// Fetch VexFlow from CDN as the library is ESM-based
const vexflowCode = await fetch('https://cdn.jsdelivr.net/npm/vexflow@4.2.6/build/cjs/vexflow.js').then(r => r.text());
eval(vexflowCode);

const { Renderer, Stave, StaveNote, Voice, Formatter, Dot, Accidental, 
        Beam, Tuplet, Articulation, Ornament } = Vex.Flow;

// Output directory
const OUTPUT_DIR = path.join(__dirname, '..', 'static', 'images', 'svg', 'vexflow');

// Icon size configuration
const ICON_WIDTH = 80;
const ICON_HEIGHT = 80;

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}`);
}

function createRenderer(width = ICON_WIDTH, height = ICON_HEIGHT) {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(width, height);
    return { div, renderer, context: renderer.getContext() };
}

function extractAndSaveSVG(div, name) {
    const svg = div.querySelector('svg');
    if (svg) {
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        const svgContent = svg.outerHTML;
        const filePath = path.join(OUTPUT_DIR, `${name}.svg`);
        fs.writeFileSync(filePath, svgContent);
        console.log(`  ✓ ${name}.svg`);
        return true;
    }
    return false;
}

function cleanup(div) {
    if (div && div.parentNode) {
        div.parentNode.removeChild(div);
    }
}

// Generate a single note icon
function generateNoteIcon(duration, stemDirection, dotted = false) {
    const { div, context } = createRenderer();
    
    const durationNames = {
        'w': 'whole',
        'h': 'half',
        'q': 'quarter',
        '8': 'eighth',
        '16': '16th',
        '32': '32nd'
    };

    const stemName = stemDirection === 1 ? 'up' : 'down';
    const dottedName = dotted ? '-dotted' : '';
    const displayDuration = dotted ? duration + 'd' : duration;
    
    try {
        const stave = new Stave(0, 10, ICON_WIDTH);
        stave.setContext(context);
        
        const noteConfig = {
            keys: ["b/4"],
            duration: displayDuration,
            stem_direction: stemDirection
        };
        
        const note = new StaveNote(noteConfig);
        
        if (dotted) {
            Dot.buildAndAttach([note], { all: true });
        }
        
        Formatter.FormatAndDraw(context, stave, [note]);
        
        const name = `note-${durationNames[duration]}-${stemName}${dottedName}`;
        extractAndSaveSVG(div, name);
    } catch (e) {
        console.error(`  ✗ Error generating ${duration} note:`, e.message);
    } finally {
        cleanup(div);
    }
}

// Generate a rest icon
function generateRestIcon(duration, dotted = false) {
    const { div, context } = createRenderer();
    
    const durationNames = {
        'w': 'whole',
        'h': 'half',
        'q': 'quarter',
        '8': 'eighth',
        '16': '16th',
        '32': '32nd'
    };

    const dottedName = dotted ? '-dotted' : '';
    const displayDuration = (dotted ? duration + 'd' : duration) + 'r';
    
    try {
        const stave = new Stave(0, 10, ICON_WIDTH);
        stave.setContext(context);
        
        const rest = new StaveNote({
            keys: ["b/4"],
            duration: displayDuration
        });
        
        if (dotted) {
            Dot.buildAndAttach([rest], { all: true });
        }
        
        Formatter.FormatAndDraw(context, stave, [rest]);
        
        const name = `rest-${durationNames[duration]}${dottedName}`;
        extractAndSaveSVG(div, name);
    } catch (e) {
        console.error(`  ✗ Error generating ${duration} rest:`, e.message);
    } finally {
        cleanup(div);
    }
}

// Generate clef icon
function generateClefIcon(clefType) {
    const { div, context } = createRenderer(ICON_WIDTH, ICON_HEIGHT);
    
    try {
        const stave = new Stave(0, 0, ICON_WIDTH);
        stave.addClef(clefType);
        stave.setContext(context).draw();
        
        const name = `clef-${clefType}`;
        extractAndSaveSVG(div, name);
    } catch (e) {
        console.error(`  ✗ Error generating ${clefType} clef:`, e.message);
    } finally {
        cleanup(div);
    }
}

// Generate time signature icon
function generateTimeSignatureIcon(timeSignature) {
    const { div, context } = createRenderer(ICON_WIDTH, ICON_HEIGHT);
    
    try {
        const stave = new Stave(0, 0, ICON_WIDTH);
        stave.addTimeSignature(timeSignature);
        stave.setContext(context).draw();
        
        const name = `time-${timeSignature.replace('/', '-').replace('|', 'cut')}`;
        extractAndSaveSVG(div, name);
    } catch (e) {
        console.error(`  ✗ Error generating ${timeSignature} time signature:`, e.message);
    } finally {
        cleanup(div);
    }
}

// Generate beamed notes
function generateBeamedNotesIcon(duration, noteCount = 2, stemDirection = 1) {
    const width = ICON_WIDTH + 40;
    const { div, context } = createRenderer(width, ICON_HEIGHT);
    
    const durationNames = {
        '8': 'eighth',
        '16': '16th',
        '32': '32nd'
    };
    
    const stemName = stemDirection === 1 ? 'up' : 'down';
    
    try {
        const stave = new Stave(0, 10, width);
        stave.setContext(context);
        
        const notes = [];
        for (let i = 0; i < noteCount; i++) {
            notes.push(new StaveNote({
                keys: ["b/4"],
                duration: duration,
                stem_direction: stemDirection
            }));
        }
        
        const beam = new Beam(notes);
        
        Formatter.FormatAndDraw(context, stave, notes);
        beam.setContext(context).draw();
        
        const name = `beamed-${durationNames[duration]}-${noteCount}-${stemName}`;
        extractAndSaveSVG(div, name);
    } catch (e) {
        console.error(`  ✗ Error generating beamed ${duration} notes:`, e.message);
    } finally {
        cleanup(div);
    }
}

// Generate triplet icon
function generateTripletIcon(duration = 'q', stemDirection = 1) {
    const width = ICON_WIDTH + 60;
    const height = ICON_HEIGHT + 20;
    const { div, context } = createRenderer(width, height);
    
    const stemName = stemDirection === 1 ? 'up' : 'down';
    const durationNames = {
        'q': 'quarter',
        '8': 'eighth'
    };
    
    try {
        const stave = new Stave(0, 15, width);
        stave.setContext(context);
        
        const notes = [
            new StaveNote({ keys: ["b/4"], duration: duration, stem_direction: stemDirection }),
            new StaveNote({ keys: ["b/4"], duration: duration, stem_direction: stemDirection }),
            new StaveNote({ keys: ["b/4"], duration: duration, stem_direction: stemDirection })
        ];
        
        const tuplet = new Tuplet(notes);
        
        Formatter.FormatAndDraw(context, stave, notes);
        tuplet.setContext(context).draw();
        
        const name = `triplet-${durationNames[duration]}-${stemName}`;
        extractAndSaveSVG(div, name);
    } catch (e) {
        console.error(`  ✗ Error generating triplet:`, e.message);
    } finally {
        cleanup(div);
    }
}

// Generate accidental icon
function generateAccidentalIcon(accidentalType) {
    const { div, context } = createRenderer();
    
    const accidentalNames = {
        '#': 'sharp',
        'b': 'flat',
        'n': 'natural',
        '##': 'double-sharp',
        'bb': 'double-flat'
    };
    
    try {
        const stave = new Stave(0, 10, ICON_WIDTH);
        stave.setContext(context);
        
        const note = new StaveNote({
            keys: ["b/4"],
            duration: "q"
        }).addModifier(new Accidental(accidentalType));
        
        Formatter.FormatAndDraw(context, stave, [note]);
        
        const name = `accidental-${accidentalNames[accidentalType]}`;
        extractAndSaveSVG(div, name);
    } catch (e) {
        console.error(`  ✗ Error generating ${accidentalType} accidental:`, e.message);
    } finally {
        cleanup(div);
    }
}

// Generate key signature icon
function generateKeySignatureIcon(key) {
    const width = ICON_WIDTH + 40;
    const { div, context } = createRenderer(width, ICON_HEIGHT);
    
    try {
        const stave = new Stave(0, 0, width);
        stave.addClef("treble");
        stave.addKeySignature(key);
        stave.setContext(context).draw();
        
        const name = `key-${key.replace('#', 'sharp').replace('b', 'flat')}`;
        extractAndSaveSVG(div, name);
    } catch (e) {
        console.error(`  ✗ Error generating ${key} key signature:`, e.message);
    } finally {
        cleanup(div);
    }
}

// Generate articulation
function generateArticulationIcon(articulation, name) {
    const { div, context } = createRenderer();
    
    try {
        const stave = new Stave(0, 10, ICON_WIDTH);
        stave.setContext(context);
        
        const note = new StaveNote({
            keys: ["b/4"],
            duration: "q"
        });
        
        note.addModifier(new Articulation(articulation).setPosition(3));
        
        Formatter.FormatAndDraw(context, stave, [note]);
        
        extractAndSaveSVG(div, name);
    } catch (e) {
        console.error(`  ✗ Error generating ${name}:`, e.message);
    } finally {
        cleanup(div);
    }
}

// Generate ornament
function generateOrnamentIcon(ornament, name) {
    const { div, context } = createRenderer();
    
    try {
        const stave = new Stave(0, 10, ICON_WIDTH);
        stave.setContext(context);
        
        const note = new StaveNote({
            keys: ["b/4"],
            duration: "q"
        });
        
        note.addModifier(new Ornament(ornament));
        
        Formatter.FormatAndDraw(context, stave, [note]);
        
        extractAndSaveSVG(div, name);
    } catch (e) {
        console.error(`  ✗ Error generating ${name}:`, e.message);
    } finally {
        cleanup(div);
    }
}

// Main generation function
function generateAllIcons() {
    console.log('\n🎵 VexFlow Music Icon Generator');
    console.log('================================\n');
    console.log(`Output directory: ${OUTPUT_DIR}\n`);

    let count = 0;
    const durations = ['w', 'h', 'q', '8', '16', '32'];

    // ===== NOTES (Stem Up) =====
    console.log('📝 Generating Notes (Stem Up)...');
    durations.forEach(dur => {
        if (dur !== 'w') {
            generateNoteIcon(dur, 1, false);
            generateNoteIcon(dur, 1, true);
            count += 2;
        } else {
            generateNoteIcon(dur, 1, false);
            generateNoteIcon(dur, 1, true);
            count += 2;
        }
    });

    // ===== NOTES (Stem Down) =====
    console.log('\n📝 Generating Notes (Stem Down)...');
    durations.forEach(dur => {
        if (dur !== 'w') {
            generateNoteIcon(dur, -1, false);
            generateNoteIcon(dur, -1, true);
            count += 2;
        }
    });

    // ===== RESTS =====
    console.log('\n😴 Generating Rests...');
    durations.forEach(dur => {
        generateRestIcon(dur, false);
        generateRestIcon(dur, true);
        count += 2;
    });

    // ===== BEAMED NOTES =====
    console.log('\n🎶 Generating Beamed Notes...');
    ['8', '16', '32'].forEach(dur => {
        [2, 3, 4].forEach(noteCount => {
            [1, -1].forEach(stem => {
                generateBeamedNotesIcon(dur, noteCount, stem);
                count++;
            });
        });
    });

    // ===== TRIPLETS =====
    console.log('\n🎼 Generating Triplets...');
    ['q', '8'].forEach(dur => {
        [1, -1].forEach(stem => {
            generateTripletIcon(dur, stem);
            count++;
        });
    });

    // ===== CLEFS =====
    console.log('\n🎼 Generating Clefs...');
    ['treble', 'bass', 'alto', 'tenor', 'percussion'].forEach(clef => {
        generateClefIcon(clef);
        count++;
    });

    // ===== TIME SIGNATURES =====
    console.log('\n⏱️ Generating Time Signatures...');
    ['4/4', '3/4', '2/4', '6/8', '2/2', '3/8', '5/4', '7/8', 'C', 'C|'].forEach(time => {
        generateTimeSignatureIcon(time);
        count++;
    });

    // ===== ACCIDENTALS =====
    console.log('\n♯♭ Generating Accidentals...');
    ['#', 'b', 'n', '##', 'bb'].forEach(acc => {
        generateAccidentalIcon(acc);
        count++;
    });

    // ===== KEY SIGNATURES =====
    console.log('\n🔑 Generating Key Signatures...');
    ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'].forEach(key => {
        generateKeySignatureIcon(key);
        count++;
    });

    // ===== ARTICULATIONS =====
    console.log('\n🎯 Generating Articulations...');
    const articulations = [
        ['a.', 'articulation-staccato'],
        ['a-', 'articulation-tenuto'],
        ['a>', 'articulation-accent'],
        ['a^', 'articulation-marcato'],
        ['a@a', 'articulation-fermata'],
        ['ao', 'articulation-harmonic'],
        ['a+', 'articulation-left-hand-pizzicato']
    ];
    articulations.forEach(([code, name]) => {
        generateArticulationIcon(code, name);
        count++;
    });

    // ===== ORNAMENTS =====
    console.log('\n✨ Generating Ornaments...');
    const ornaments = [
        ['mordent', 'ornament-mordent'],
        ['mordent_inverted', 'ornament-mordent-inverted'],
        ['turn', 'ornament-turn'],
        ['turn_inverted', 'ornament-turn-inverted'],
        ['tr', 'ornament-trill'],
        ['upprall', 'ornament-upprall'],
        ['downprall', 'ornament-downprall'],
        ['prallup', 'ornament-prallup'],
        ['pralldown', 'ornament-pralldown']
    ];
    ornaments.forEach(([code, name]) => {
        generateOrnamentIcon(code, name);
        count++;
    });

    console.log('\n================================');
    console.log(`✅ Generated ${count} icons successfully!`);
    console.log(`📁 Saved to: ${OUTPUT_DIR}`);
}

// Run the generator
generateAllIcons();
