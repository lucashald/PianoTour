#!/usr/bin/env python3
"""
VexFlow Music Icon Generator - Python + Selenium
Generates SVG icons for musical notation using VexFlow
"""

import os
import json
from pathlib import Path

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / 'static' / 'images' / 'svg' / 'vexflow'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print('\n🎵 VexFlow Music Icon Generator')
print('=' * 50)
print(f'Output directory: {OUTPUT_DIR}\n')

# HTML template for generating icons
HTML_TEMPLATE = '''<!DOCTYPE html>
<html>
<head>
<script src="https://cdn.jsdelivr.net/npm/vexflow@4.2.2/build/cjs/vexflow.js"></script>
</head>
<body>
    <div id="output"></div>
    <script>
        const {{ Renderer, Stave, StaveNote, Voice, Formatter, Dot, Accidental, 
                Beam, Tuplet, Articulation, Ornament }} = Vex.Flow;

        function generateIcon(iconName, renderFn) {{
            try {{
                const div = document.getElementById('output');
                div.innerHTML = '';
                
                const renderer = new Renderer(div, Renderer.Backends.SVG);
                renderer.resize(80, 80);
                const context = renderer.getContext();
                
                renderFn(context, div);
                
                const svg = div.querySelector('svg');
                if (svg) {{
                    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                    window.lastSVG = svg.outerHTML;
                    window.lastName = '{iconName}';
                }} else {{
                    console.error('No SVG found for ' + iconName);
                }}
            }} catch(e) {{
                console.error('Error generating {iconName}: ' + e.message);
            }}
        }}
        
        // Note icons
        function createNoteIcon(duration, stemDir, dotted) {{
            return (context, div) => {{
                const stave = new Stave(0, 10, 80);
                stave.setContext(context);
                const note = new StaveNote({{
                    keys: ['b/4'],
                    duration: dotted ? duration + 'd' : duration,
                    stem_direction: stemDir
                }});
                if (dotted) {{
                    Dot.buildAndAttach([note], {{ all: true }});
                }}
                Formatter.FormatAndDraw(context, stave, [note]);
            }};
        }}
        
        // Rest icons
        function createRestIcon(duration, dotted) {{
            return (context, div) => {{
                const stave = new Stave(0, 10, 80);
                stave.setContext(context);
                const rest = new StaveNote({{
                    keys: ['b/4'],
                    duration: (dotted ? duration + 'd' : duration) + 'r'
                }});
                if (dotted) {{
                    Dot.buildAndAttach([rest], {{ all: true }});
                }}
                Formatter.FormatAndDraw(context, stave, [rest]);
            }};
        }}
        
        // Clef icons
        function createClefIcon(clefType) {{
            return (context, div) => {{
                const stave = new Stave(0, 0, 80);
                stave.addClef(clefType);
                stave.setContext(context).draw();
            }};
        }}
        
        // Time signature icons
        function createTimeSignatureIcon(timeSig) {{
            return (context, div) => {{
                const stave = new Stave(0, 0, 80);
                stave.addTimeSignature(timeSig);
                stave.setContext(context).draw();
            }};
        }}
        
        // Key signature icons
        function createKeySignatureIcon(key) {{
            return (context, div) => {{
                const stave = new Stave(0, 0, 120);
                const renderer = new Renderer(div, Renderer.Backends.SVG);
                renderer.resize(120, 80);
                const ctx = renderer.getContext();
                stave.addClef('treble');
                stave.addKeySignature(key);
                stave.setContext(ctx).draw();
                window.lastSVG = div.querySelector('svg').outerHTML;
            }};
        }}
        
        // Clef icons
        function createClefIcon(clefType) {{
            return (context, div) => {{
                const stave = new Stave(0, 0, 80);
                stave.addClef(clefType);
                stave.setContext(context).draw();
            }};
        }}
        
        window.allIcons = {{
            // Notes stem up
            ...{{{', '.join([f"'note-whole-up': createNoteIcon('w', 1, false), 'note-whole-up-dotted': createNoteIcon('w', 1, true), 'note-half-up': createNoteIcon('h', 1, false), 'note-half-up-dotted': createNoteIcon('h', 1, true), 'note-quarter-up': createNoteIcon('q', 1, false), 'note-quarter-up-dotted': createNoteIcon('q', 1, true), 'note-eighth-up': createNoteIcon('8', 1, false), 'note-eighth-up-dotted': createNoteIcon('8', 1, true), 'note-16th-up': createNoteIcon('16', 1, false), 'note-16th-up-dotted': createNoteIcon('16', 1, true), 'note-32nd-up': createNoteIcon('32', 1, false), 'note-32nd-up-dotted': createNoteIcon('32', 1, true)"] * 0)}}}},
            // Notes stem down
            ...{{{', '.join([f"'note-half-down': createNoteIcon('h', -1, false), 'note-half-down-dotted': createNoteIcon('h', -1, true), 'note-quarter-down': createNoteIcon('q', -1, false), 'note-quarter-down-dotted': createNoteIcon('q', -1, true), 'note-eighth-down': createNoteIcon('8', -1, false), 'note-eighth-down-dotted': createNoteIcon('8', -1, true), 'note-16th-down': createNoteIcon('16', -1, false), 'note-16th-down-dotted': createNoteIcon('16', -1, true), 'note-32nd-down': createNoteIcon('32', -1, false), 'note-32nd-down-dotted': createNoteIcon('32', -1, true)"] * 0)}}}},
            // Rests
            'rest-whole': createRestIcon('w', false),
            'rest-whole-dotted': createRestIcon('w', true),
            'rest-half': createRestIcon('h', false),
            'rest-half-dotted': createRestIcon('h', true),
            'rest-quarter': createRestIcon('q', false),
            'rest-quarter-dotted': createRestIcon('q', true),
            'rest-eighth': createRestIcon('8', false),
            'rest-eighth-dotted': createRestIcon('8', true),
            'rest-16th': createRestIcon('16', false),
            'rest-16th-dotted': createRestIcon('16', true),
            'rest-32nd': createRestIcon('32', false),
            'rest-32nd-dotted': createRestIcon('32', true),
            // Clefs
            'clef-treble': createClefIcon('treble'),
            'clef-bass': createClefIcon('bass'),
            'clef-alto': createClefIcon('alto'),
            'clef-tenor': createClefIcon('tenor'),
            'clef-percussion': createClefIcon('percussion'),
            // Time signatures
            'time-4-4': createTimeSignatureIcon('4/4'),
            'time-3-4': createTimeSignatureIcon('3/4'),
            'time-2-4': createTimeSignatureIcon('2/4'),
            'time-6-8': createTimeSignatureIcon('6/8'),
            'time-2-2': createTimeSignatureIcon('2/2'),
            'time-3-8': createTimeSignatureIcon('3/8'),
            'time-5-4': createTimeSignatureIcon('5/4'),
            'time-7-8': createTimeSignatureIcon('7/8'),
            'time-C': createTimeSignatureIcon('C'),
            'time-Ccut': createTimeSignatureIcon('C|'),
            // Key signatures
            'key-C': createKeySignatureIcon('C'),
            'key-G': createKeySignatureIcon('G'),
            'key-D': createKeySignatureIcon('D'),
            'key-A': createKeySignatureIcon('A'),
            'key-E': createKeySignatureIcon('E'),
            'key-B': createKeySignatureIcon('B'),
            'key-Fsharp': createKeySignatureIcon('F#'),
            'key-Csharp': createKeySignatureIcon('C#'),
            'key-F': createKeySignatureIcon('F'),
            'key-Bflat': createKeySignatureIcon('Bb'),
            'key-Eflat': createKeySignatureIcon('Eb'),
            'key-Aflat': createKeySignatureIcon('Ab'),
            'key-Dflat': createKeySignatureIcon('Db'),
            'key-Gflat': createKeySignatureIcon('Gb'),
            'key-Cflat': createKeySignatureIcon('Cb'),
        }};
        
        window.iconNames = Object.keys(window.allIcons);
        window.currentIndex = 0;
        
        function generateNext() {{
            if (window.currentIndex >= window.iconNames.length) {{
                console.log('GENERATION_COMPLETE');
                return;
            }}
            const name = window.iconNames[window.currentIndex];
            console.log('GENERATING:' + name);
            generateIcon(name, window.allIcons[name]);
            window.currentIndex++;
        }}
        
        window.generateNext = generateNext;
        generateNext();
    </script>
</body>
</html>
'''

# Write template to temp file
temp_html = OUTPUT_DIR.parent / 'icon-generator-temp.html'
with open(temp_html, 'w') as f:
    f.write(HTML_TEMPLATE)

print('Created temporary HTML file for icon generation.')
print(f'Open this file in a browser: {temp_html.as_posix()}')
print('\nInstructions:')
print('1. Open the HTML file in a web browser')
print('2. Open the browser console (F12)')
print('3. Run: generateNext() repeatedly or use a loop')
print('\nAlternatively, the HTML browser generator is available at:')
print('scripts/generate-music-icons.html')
print('=' * 50 + '\n')
