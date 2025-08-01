// guitarChords.js - Guitar chord definitions
export const GUITAR_CHORDS = {
  // Major chords
  'C': [0, 1, 0, 2, 3, 0],
  'C#': [1, 2, 1, 3, 4, 1], 
  'D': [2, 3, 2, 4, 5, 2],
  'D#': [3, 4, 3, 5, 6, 3],
  'E': [0, 0, 1, 2, 2, 0],
  'F': [1, 1, 2, 3, 3, 1],
  'F#': [2, 2, 3, 4, 4, 2],
  'G': [3, 0, 0, 0, 2, 3],
  'G#': [4, 1, 1, 1, 3, 4],
  'A': [0, 2, 2, 2, 0, 0],
  'A#': [1, 3, 3, 3, 1, 1],
  'B': [2, 4, 4, 4, 2, 2],

  // Minor chords
  'Cm': [3, 4, 5, 5, 3, 3],
  'C#m': [4, 5, 6, 6, 4, 4],
  'Dm': [null, null, 0, 2, 3, 1],
  'D#m': [6, 7, 8, 8, 6, 6],
  'Em': [0, 0, 0, 2, 2, 0],
  'Fm': [1, 1, 1, 3, 3, 1],
  'F#m': [2, 2, 2, 4, 4, 2],
  'Gm': [3, 3, 3, 5, 5, 3],
  'G#m': [4, 4, 4, 6, 6, 4],
  'Am': [0, 1, 2, 2, 0, 0],
  'A#m': [1, 2, 3, 3, 1, 1],
  'Bm': [2, 3, 4, 4, 2, 2],

  // Seventh chords
  'C7': [0, 1, 3, 2, 3, 0],
  'D7': [2, 3, 2, 4, 5, 2],
  'E7': [0, 3, 1, 0, 2, 0],
  'F7': [1, 1, 2, 1, 3, 1],
  'G7': [1, 0, 0, 0, 2, 3],
  'A7': [0, 2, 0, 2, 0, 0],
  'B7': [2, 4, 2, 4, 2, 2],

  // Add more chord variations as needed
};

export const CHORD_GROUPS = {
  'Major': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  'Minor': ['Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm'],
  'Seventh': ['C7', 'D7', 'E7', 'F7', 'G7', 'A7', 'B7'],
  'Sharp Major': ['C#', 'D#', 'F#', 'G#', 'A#'],
  'Sharp Minor': ['C#m', 'D#m', 'F#m', 'G#m', 'A#m']
};

export function getChordFrets(chordName) {
  return GUITAR_CHORDS[chordName] || null;
}

export function getChordsByGroup(groupName) {
  return CHORD_GROUPS[groupName] || [];
}