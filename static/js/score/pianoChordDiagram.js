// pianoChordDiagram.js
// Renders a mini SVG piano keyboard with chord notes highlighted

const WK_W = 18;   // white key width (px)
const WK_H = 60;   // white key height (px)
const BK_W = 12;   // black key width (px)
const BK_H = 38;   // black key height (px)
const PIANO_W = WK_W * 7; // 126px total

const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const BLACK_KEYS = [
  { note: 'C#', enharmonic: 'Db', x: WK_W * 1 - BK_W / 2 },
  { note: 'D#', enharmonic: 'Eb', x: WK_W * 2 - BK_W / 2 },
  { note: 'F#', enharmonic: 'Gb', x: WK_W * 4 - BK_W / 2 },
  { note: 'G#', enharmonic: 'Ab', x: WK_W * 5 - BK_W / 2 },
  { note: 'A#', enharmonic: 'Bb', x: WK_W * 6 - BK_W / 2 },
];

const HIGHLIGHT_COLOR = '#467089';

let _chordDb = null;

async function _loadDb() {
  if (!_chordDb) {
    const res = await fetch('/static/js/core/chord_database.json');
    _chordDb = await res.json();
  }
  return _chordDb;
}

/**
 * Returns pitch classes for a chord symbol, e.g. "Am" → ["A", "C", "E"].
 * Returns null if the chord is not found in the database.
 * @param {string} chordName
 * @returns {Promise<string[]|null>}
 */
export async function getChordPitchClasses(chordName) {
  const db = await _loadDb();
  if (db[chordName]?.notes) return db[chordName].notes;
  const key = Object.keys(db).find(k => k.toLowerCase() === chordName.toLowerCase());
  return key && db[key].notes ? db[key].notes : null;
}

/**
 * Builds an inline SVG string of a mini piano keyboard with specified keys highlighted.
 * @param {string[]} pitchClasses - e.g. ["C", "E", "G"]
 * @returns {string} SVG markup
 */
export function buildPianoSVG(pitchClasses) {
  const highlighted = new Set(pitchClasses);
  let rects = '';

  // White keys (rendered first; black keys painted on top)
  WHITE_NOTES.forEach((note, i) => {
    const fill = highlighted.has(note) ? HIGHLIGHT_COLOR : 'white';
    rects += `<rect x="${i * WK_W}" y="0" width="${WK_W}" height="${WK_H}" fill="${fill}" stroke="#555" stroke-width="0.5"/>`;
  });

  // Black keys
  BLACK_KEYS.forEach(({ note, enharmonic, x }) => {
    const isHighlighted = highlighted.has(note) || highlighted.has(enharmonic);
    const fill = isHighlighted ? HIGHLIGHT_COLOR : '#222';
    rects += `<rect x="${x}" y="0" width="${BK_W}" height="${BK_H}" fill="${fill}" stroke="#555" stroke-width="0.5"/>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PIANO_W}" height="${WK_H}" viewBox="0 0 ${PIANO_W} ${WK_H}" style="display:block">${rects}</svg>`;
}
