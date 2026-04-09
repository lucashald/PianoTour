// pianoChordDiagram.js
// Renders a mini SVG piano keyboard with chord notes highlighted

import { normalizeNoteName } from '../core/note-data.js';

const WK_W = 18;   // white key width (px)
const WK_H = 60;   // white key height (px)
const BK_W = 12;   // black key width (px)
const BK_H = 38;   // black key height (px)

const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// Black keys defined by which white-key boundary they sit on (rightKeyIdx * WK_W - BK_W/2)
const BLACK_KEY_INFO = [
  { rightKeyIdx: 1, note: 'C#', enharmonic: 'Db' },
  { rightKeyIdx: 2, note: 'D#', enharmonic: 'Eb' },
  { rightKeyIdx: 4, note: 'F#', enharmonic: 'Gb' },
  { rightKeyIdx: 5, note: 'G#', enharmonic: 'Ab' },
  { rightKeyIdx: 6, note: 'A#', enharmonic: 'Bb' },
];

const HIGHLIGHT_COLOR = '#467089';

let _chordDb = null;

let _loadPromise = null;

async function _loadDb() {
  if (_chordDb) return _chordDb;
  // Deduplicate concurrent calls — only one fetch runs at a time
  if (!_loadPromise) {
    _loadPromise = fetch('/static/js/core/chord_database.json')
      .then(res => {
        if (!res.ok) throw new Error(`chord_database.json fetch failed: ${res.status}`);
        return res.json();
      })
      .then(data => {
        _chordDb = data;
        _loadPromise = null;
        return data;
      })
      .catch(err => {
        _loadPromise = null; // allow retry on next call
        throw err;
      });
  }
  return _loadPromise;
}

/**
 * Returns pitch classes for a chord symbol, e.g. "Am" → ["A", "C", "E"].
 * Returns null if the chord is not found in the database or on any error.
 * @param {string} chordName
 * @returns {Promise<string[]|null>}
 */
export async function getChordPitchClasses(chordName) {
  try {
    const db = await _loadDb();
    if (db[chordName]?.notes) return db[chordName].notes;
    const key = Object.keys(db).find(k => k.toLowerCase() === chordName.toLowerCase());
    return key && db[key].notes ? db[key].notes : null;
  } catch (err) {
    console.error('pianoChordDiagram: failed to look up', chordName, err);
    return null;
  }
}

/**
 * Builds an inline SVG string of a 2-octave piano keyboard with specified keys highlighted.
 * Accepts note names with octave numbers ("F4", "A4", "C5") and highlights them at their
 * correct positions across the two octaves.
 * @param {string[]} notes - e.g. ["F4", "A4", "C5"]
 * @returns {string} SVG markup
 */
export function buildPianoSVG(notes) {
  // Normalize each note (handles double sharps/flats) and split into pitch class + octave
  const parsed = notes.map(n => {
    const norm = normalizeNoteName(n);
    const octaveMatch = norm.match(/\d+$/);
    return {
      pitchClass: norm.replace(/\d+$/, ''),
      octave: octaveMatch ? parseInt(octaveMatch[0]) : null,
    };
  });

  // Start the diagram at the lowest octave present in the notes
  const knownOctaves = parsed.map(p => p.octave).filter(o => o !== null);
  const startOctave = knownOctaves.length > 0 ? Math.min(...knownOctaves) : 4;

  const OCTAVES = 2;
  const TOTAL_W = WK_W * 7 * OCTAVES;

  // Build highlighted sets: octave-specific wins; pitch-class-only is fallback
  const withOctave = new Set(parsed.filter(p => p.octave !== null).map(p => p.pitchClass + p.octave));
  const pitchOnly  = new Set(parsed.filter(p => p.octave === null).map(p => p.pitchClass));

  function isHighlighted(pitchClass, octave) {
    return withOctave.has(pitchClass + octave) || pitchOnly.has(pitchClass);
  }

  let rects = '';

  for (let oct = 0; oct < OCTAVES; oct++) {
    const octaveNum = startOctave + oct;
    const xOff = oct * 7 * WK_W;

    // White keys
    WHITE_NOTES.forEach((note, i) => {
      const fill = isHighlighted(note, octaveNum) ? HIGHLIGHT_COLOR : 'white';
      rects += `<rect x="${xOff + i * WK_W}" y="0" width="${WK_W}" height="${WK_H}" fill="${fill}" stroke="#555" stroke-width="0.5"/>`;
    });

    // Black keys (drawn after white keys so they render on top)
    BLACK_KEY_INFO.forEach(({ rightKeyIdx, note, enharmonic }) => {
      const lit = isHighlighted(note, octaveNum) || isHighlighted(enharmonic, octaveNum);
      const fill = lit ? HIGHLIGHT_COLOR : '#222';
      const x = xOff + rightKeyIdx * WK_W - BK_W / 2;
      rects += `<rect x="${x}" y="0" width="${BK_W}" height="${BK_H}" fill="${fill}" stroke="#555" stroke-width="0.5"/>`;
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TOTAL_W}" height="${WK_H}" viewBox="0 0 ${TOTAL_W} ${WK_H}" style="display:block">${rects}</svg>`;
}
