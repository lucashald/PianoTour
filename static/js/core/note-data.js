// note-data.js

import { pianoState } from "./appState.js";

// NOTES
const ALL_NOTE_INFO = [
  { midi: 36, name: "C2", pitchClass: "C", isBlack: false },
  { midi: 37, name: "C#2", flatName: "Db2", pitchClass: "C#", isBlack: true },
  { midi: 38, name: "D2", pitchClass: "D", isBlack: false },
  { midi: 39, name: "D#2", flatName: "Eb2", pitchClass: "D#", isBlack: true },
  { midi: 40, name: "E2", pitchClass: "E", isBlack: false },
  { midi: 41, name: "F2", pitchClass: "F", isBlack: false },
  { midi: 42, name: "F#2", flatName: "Gb2", pitchClass: "F#", isBlack: true },
  { midi: 43, name: "G2", pitchClass: "G", isBlack: false },
  { midi: 44, name: "G#2", flatName: "Ab2", pitchClass: "G#", isBlack: true },
  { midi: 45, name: "A2", pitchClass: "A", isBlack: false },
  { midi: 46, name: "A#2", flatName: "Bb2", pitchClass: "A#", isBlack: true },
  { midi: 47, name: "B2", pitchClass: "B", isBlack: false },
  { midi: 48, name: "C3", pitchClass: "C", isBlack: false },
  { midi: 49, name: "C#3", flatName: "Db3", pitchClass: "C#", isBlack: true },
  { midi: 50, name: "D3", pitchClass: "D", isBlack: false },
  { midi: 51, name: "D#3", flatName: "Eb3", pitchClass: "D#", isBlack: true },
  { midi: 52, name: "E3", pitchClass: "E", isBlack: false },
  { midi: 53, name: "F3", pitchClass: "F", isBlack: false },
  { midi: 54, name: "F#3", flatName: "Gb3", pitchClass: "F#", isBlack: true },
  { midi: 55, name: "G3", pitchClass: "G", isBlack: false },
  { midi: 56, name: "G#3", flatName: "Ab3", pitchClass: "G#", isBlack: true },
  { midi: 57, name: "A3", pitchClass: "A", isBlack: false },
  { midi: 58, name: "A#3", flatName: "Bb3", pitchClass: "A#", isBlack: true },
  { midi: 59, name: "B3", pitchClass: "B", isBlack: false },
  { midi: 60, name: "C4", pitchClass: "C", isBlack: false },
  { midi: 61, name: "C#4", flatName: "Db4", pitchClass: "C#", isBlack: true },
  { midi: 62, name: "D4", pitchClass: "D", isBlack: false },
  { midi: 63, name: "D#4", flatName: "Eb4", pitchClass: "D#", isBlack: true },
  { midi: 64, name: "E4", pitchClass: "E", isBlack: false },
  { midi: 65, name: "F4", pitchClass: "F", isBlack: false },
  { midi: 66, name: "F#4", flatName: "Gb4", pitchClass: "F#", isBlack: true },
  { midi: 67, name: "G4", pitchClass: "G", isBlack: false },
  { midi: 68, name: "G#4", flatName: "Ab4", pitchClass: "G#", isBlack: true },
  { midi: 69, name: "A4", pitchClass: "A", isBlack: false },
  { midi: 70, name: "A#4", flatName: "Bb4", pitchClass: "A#", isBlack: true },
  { midi: 71, name: "B4", pitchClass: "B", isBlack: false },
  { midi: 72, name: "C5", pitchClass: "C", isBlack: false },
  { midi: 73, name: "C#5", flatName: "Db5", pitchClass: "C#", isBlack: true },
  { midi: 74, name: "D5", pitchClass: "D", isBlack: false },
  { midi: 75, name: "D#5", flatName: "Eb5", pitchClass: "D#", isBlack: true },
  { midi: 76, name: "E5", pitchClass: "E", isBlack: false },
  { midi: 77, name: "F5", pitchClass: "F", isBlack: false },
  { midi: 78, name: "F#5", flatName: "Gb5", pitchClass: "F#", isBlack: true },
  { midi: 79, name: "G5", pitchClass: "G", isBlack: false },
  { midi: 80, name: "G#5", flatName: "Ab5", pitchClass: "G#", isBlack: true },
  { midi: 81, name: "A5", pitchClass: "A", isBlack: false },
  { midi: 82, name: "A#5", flatName: "Bb5", pitchClass: "A#", isBlack: true },
  { midi: 83, name: "B5", pitchClass: "B", isBlack: false },
  { midi: 84, name: "C6", pitchClass: "C", isBlack: false },
  { midi: 85, name: "C#6", flatName: "Db6", pitchClass: "C#", isBlack: true },
  { midi: 86, name: "D6", pitchClass: "D", isBlack: false },
  { midi: 87, name: "D#6", flatName: "Eb6", pitchClass: "D#", isBlack: true },
  { midi: 88, name: "E6", pitchClass: "E", isBlack: false },
  { midi: 89, name: "F6", pitchClass: "F", isBlack: false },
  { midi: 90, name: "F#6", flatName: "Gb6", pitchClass: "F#", isBlack: true },
  { midi: 91, name: "G6", pitchClass: "G", isBlack: false },
  { midi: 92, name: "G#6", flatName: "Ab6", pitchClass: "G#", isBlack: true },
  { midi: 93, name: "A6", pitchClass: "A", isBlack: false },
  { midi: 94, name: "A#6", flatName: "Bb6", pitchClass: "A#", isBlack: true },
  { midi: 95, name: "B6", pitchClass: "B", isBlack: false },
  { midi: 96, name: "C7", pitchClass: "C", isBlack: false },
];

export function notesByMidiKeyAware(midi) {
  const midiNumber = parseInt(midi, 10); // Convert to number
  const noteInfo = ALL_NOTE_INFO.find((note) => note.midi === midiNumber);
  if (!noteInfo) return null;

  // Get the key signature aware name
  let resolvedName = noteInfo.name; // default to sharp name

  if (pianoState.keySignatureType === "b" && noteInfo.flatName) {
    resolvedName = noteInfo.flatName;
  } else if (pianoState.keySignatureType === "#") {
    resolvedName = noteInfo.name; // already the sharp name
  }

  // Return the full note object with the resolved name
  return {
    ...noteInfo,
    name: resolvedName,
  };
}

const buildNoteData = () => {
  const notesByMidi = {};
  const notesByName = {};
  const WW = 23; // White key width
  const BW = 13; // Black key width
  let whiteKeyX = 0;

  ALL_NOTE_INFO.forEach((note) => {
    if (!note.isBlack) {
      note.x = whiteKeyX;
      whiteKeyX += WW;
    }
  });

  ALL_NOTE_INFO.forEach((note) => {
    if (note.isBlack) {
      const prevNote = ALL_NOTE_INFO.find((n) => n.midi === note.midi - 1);
      if (prevNote) {
        note.x = prevNote.x + WW - BW / 2;
      }
    }
    notesByMidi[note.midi] = note;
    notesByName[note.name] = note.midi;
    if (note.flatName) {
      notesByName[note.flatName] = note.midi;
    }
  });

  return {
    NOTES_BY_MIDI: notesByMidi,
    NOTES_BY_NAME: notesByName,
    WW: WW,
    BW: BW,
    ALL_NOTE_INFO: ALL_NOTE_INFO,
  };
};

const {
  NOTES_BY_MIDI,
  NOTES_BY_NAME,
  WW: WHITE_KEY_WIDTH,
  BW: BLACK_KEY_WIDTH,
} = buildNoteData();

// Map of note durations to their corresponding PNG file paths
export const NOTE_IMAGE_MAP = {
  // Regular notes
  'w': '/static/images/whole.png',
  'h': '/static/images/half-up.png',
  'q': '/static/images/quarter-up.png',
  '8': '/static/images/8th-up.png',
  '16': '/static/images/16th-up.png',
  
  // Dotted notes
  'h.': '/static/images/dotted-half-up.png',
  'q.': '/static/images/dotted-quarter-up.png',
  '8.': '/static/images/dotted-8th-up.png',
  
  // Down stem variants
  'hdown': '/static/images/half-down.png',
  'qdown': '/static/images/quarter-down.png',
  '8down': '/static/images/8th-down.png',
  '16down': '/static/images/16th-down.png'
};

// Note positions with stem directions (combined for all notes)
const NOTE_STEM_DIRECTIONS = {
  // Treble clef - down stems (above and including middle line B4)
  'E6': 'down', 'D6': 'down', 'C6': 'down', 'B5': 'down', 'A5': 'down', 'G5': 'down',
  'F5': 'down', 'E5': 'down', 'D5': 'down', 'C5': 'down', 'B4': 'down',
  
  // Treble clef - up stems (below middle line B4)
  'A4': 'up', 'G4': 'up', 'F4': 'up', 'E4': 'up', 'D4': 'up', 'C4': 'up', 'B3': 'up', 'A3': 'up',
  
  // Bass clef - down stems (above and including middle line B2)
  'G3': 'down', 'F3': 'down', 'E3': 'down', 'D3': 'down', 
  
  // Bass clef - up stems (below middle line B2)
 'C3': 'up', 'B2': 'up', 'A2': 'up', 'G2': 'up', 'F2': 'up', 'E2': 'up', 'D2': 'up', 'C2': 'up'
};

// Helper function to get the correct image path based on note name and duration
export function getNoteImagePath(duration, noteName) {
  // Whole notes don't have stems
  if (duration === 'w') {
    return NOTE_IMAGE_MAP['w'];
  }
  
  // Get stem direction for this note
  const stemDirection = NOTE_STEM_DIRECTIONS[noteName] || 'up'; // Default to up
  
  // Build the correct duration key based on stem direction
  let durationKey = duration;
  if (stemDirection === 'down' && NOTE_IMAGE_MAP[duration + 'down']) {
    durationKey = duration + 'down';
  }
  
  return NOTE_IMAGE_MAP[durationKey] || NOTE_IMAGE_MAP['q'];
}

// Export the core note data and key dimensions
export {
  ALL_NOTE_INFO, BLACK_KEY_WIDTH, NOTES_BY_MIDI,
  NOTES_BY_NAME,
  WHITE_KEY_WIDTH
};

// CHORDS
export const CHORD_DEFINITIONS = {
  // C Chords
  C: {
    notes: ["C", "E", "G"],
    treble: ["C4", "E4", "G4"],
    bass: ["C3", "E3", "G3"],
    displayName: "C Major",
  },
  Cmaj7: {
    notes: ["C", "E", "G", "B"],
    treble: ["C4", "E4", "G4", "B4"],
    bass: ["C2", "E2", "G2", "B2"],
    displayName: "C Major 7th",
  },
  Cmaj6: {
    notes: ["C", "E", "G", "A"],
    treble: ["C4", "E4", "G4", "A4"],
    bass: ["C2", "E2", "G2", "A2"],
    displayName: "C Major 6th",
  },
  Cmaj9: {
    notes: ["C", "E", "G", "B", "D"],
    treble: ["C4", "E4", "G4", "B4", "D5"],
    bass: ["C2", "E2", "G2", "B2", "D3"],
    displayName: "C Major 9th",
  },
  Cm: {
    notes: ["C", "Eb", "G"],
    treble: ["C4", "Eb4", "G4"],
    bass: ["C3", "Eb3", "G3"],
    displayName: "C Minor",
  },
  Cmin7: {
    notes: ["C", "Eb", "G", "Bb"],
    treble: ["C4", "Eb4", "G4", "Bb4"],
    bass: ["C2", "Eb2", "G2", "Bb2"],
    displayName: "C Minor 7th",
  },
  Cmin6: {
    notes: ["C", "Eb", "G", "A"],
    treble: ["C4", "Eb4", "G4", "A4"],
    bass: ["C2", "Eb2", "G2", "A2"],
    displayName: "C Minor 6th",
  },
  Cmin9: {
    notes: ["C", "Eb", "G", "Bb", "D"],
    treble: ["C4", "Eb4", "G4", "Bb4", "D5"],
    bass: ["C2", "Eb2", "G2", "Bb2", "D3"],
    displayName: "C Minor 9th",
  },
  Cdim: {
    notes: ["C", "Eb", "Gb"],
    treble: ["C4", "Eb4", "Gb4"],
    bass: ["C3", "Eb3", "Gb3"],
    displayName: "C Diminished",
  },
  Cdim7: {
    notes: ["C", "Eb", "Gb", "Bbb"],
    treble: ["C4", "Eb4", "Gb4", "Bbb4"],
    bass: ["C3", "Eb3", "Gb3", "Bbb3"],
    displayName: "C Diminished 7th",
  },
  Cm7b5: {
    notes: ["C", "Eb", "Gb", "Bb"],
    treble: ["C4", "Eb4", "Gb4", "Bb4"],
    bass: ["C3", "Eb3", "Gb3", "Bb3"],
    displayName: "C Half-Diminished 7th",
  },
  Caug: {
    notes: ["C", "E", "G#"],
    treble: ["C4", "E4", "G#4"],
    bass: ["C3", "E3", "G#3"],
    displayName: "C Augmented",
  },
  Caug7: {
    notes: ["C", "E", "G#", "Bb"],
    treble: ["C4", "E4", "G#4", "Bb4"],
    bass: ["C2", "E2", "G#2", "Bb2"],
    displayName: "C Augmented 7th",
  },
  C7: {
    notes: ["C", "E", "G", "Bb"],
    treble: ["C4", "E4", "G4", "Bb4"],
    bass: ["C2", "E2", "G2", "Bb2"],
    displayName: "C Dominant 7th",
  },
  C9: {
    notes: ["C", "E", "G", "Bb", "D"],
    treble: ["C4", "E4", "G4", "Bb4", "D5"],
    bass: ["C2", "E2", "G2", "Bb2", "D3"],
    displayName: "C Dominant 9th",
  },
  Csus4: {
    notes: ["C", "F", "G"],
    treble: ["C4", "F4", "G4"],
    bass: ["C3", "F3", "G3"],
    displayName: "C Suspended 4th",
  },
  Csus2: {
    notes: ["C", "D", "G"],
    treble: ["C4", "D4", "G4"],
    bass: ["C3", "D3", "G3"],
    displayName: "C Suspended 2nd",
  },

  // C# Chords
  "C#": {
    notes: ["C#", "E#", "G#"],
    treble: ["C#4", "E#4", "G#4"],
    bass: ["C#3", "E#3", "G#3"],
    displayName: "C# Major",
  },
  "C#alt": {  // Alternative spelling
  notes: ["C#", "F", "G#"],
  treble: ["C#4", "F4", "G#4"],
  bass: ["C#3", "F3", "G#3"],
  displayName: "C# Major",
},
  "C#maj7": {
    notes: ["C#", "E#", "G#", "B#"],
    treble: ["C#4", "E#4", "G#4", "B#4"],
    bass: ["C#2", "E#2", "G#2", "B#2"],
    displayName: "C# Major 7th",
  },
  "C#maj6": {
    notes: ["C#", "E#", "G#", "A#"],
    treble: ["C#4", "E#4", "G#4", "A#4"],
    bass: ["C#2", "E#2", "G#2", "A#2"],
    displayName: "C# Major 6th",
  },
  "C#maj9": {
    notes: ["C#", "E#", "G#", "B#", "D#"],
    treble: ["C#4", "E#4", "G#4", "B#4", "D#5"],
    bass: ["C#2", "E#2", "G#2", "B#2", "D#3"],
    displayName: "C# Major 9th",
  },
  "C#m": {
    notes: ["C#", "E", "G#"],
    treble: ["C#4", "E4", "G#4"],
    bass: ["C#3", "E3", "G#3"],
    displayName: "C# Minor",
  },
  "C#min7": {
    notes: ["C#", "E", "G#", "B"],
    treble: ["C#4", "E4", "G#4", "B4"],
    bass: ["C#2", "E2", "G#2", "B2"],
    displayName: "C# Minor 7th",
  },
  "C#min6": {
    notes: ["C#", "E", "G#", "A#"],
    treble: ["C#4", "E4", "G#4", "A#4"],
    bass: ["C#2", "E2", "G#2", "A#2"],
    displayName: "C# Minor 6th",
  },
  "C#min9": {
    notes: ["C#", "E", "G#", "B", "D#"],
    treble: ["C#4", "E4", "G#4", "B4", "D#5"],
    bass: ["C#2", "E2", "G#2", "B2", "D#3"],
    displayName: "C# Minor 9th",
  },
  "C#dim": {
    notes: ["C#", "E", "G"],
    treble: ["C#4", "E4", "G4"],
    bass: ["C#3", "E3", "G3"],
    displayName: "C# Diminished",
  },
  "C#dim7": {
    notes: ["C#", "E", "G", "Bb"],
    treble: ["C#4", "E4", "G4", "Bb4"],
    bass: ["C#3", "E3", "G3", "Bb3"],
    displayName: "C# Diminished 7th",
  },
  "C#m7b5": {
    notes: ["C#", "E", "G", "B"],
    treble: ["C#4", "E4", "G4", "B4"],
    bass: ["C#3", "E3", "G3", "B3"],
    displayName: "C# Half-Diminished 7th",
  },
  "C#aug": {
    notes: ["C#", "E#", "G##"],
    treble: ["C#4", "E#4", "G##4"],
    bass: ["C#3", "E#3", "G##3"],
    displayName: "C# Augmented",
  },
  "C#aug7": {
    notes: ["C#", "E#", "G##", "B"],
    treble: ["C#4", "E#4", "G##4", "B4"],
    bass: ["C#2", "E#2", "G##2", "B2"],
    displayName: "C# Augmented 7th",
  },
  "C#7": {
    notes: ["C#", "E#", "G#", "B"],
    treble: ["C#4", "E#4", "G#4", "B4"],
    bass: ["C#2", "E#2", "G#2", "B2"],
    displayName: "C# Dominant 7th",
  },
  "C#9": {
    notes: ["C#", "E#", "G#", "B", "D#"],
    treble: ["C#4", "E#4", "G#4", "B4", "D#5"],
    bass: ["C#2", "E#2", "G#2", "B2", "D#3"],
    displayName: "C# Dominant 9th",
  },
  "C#sus4": {
    notes: ["C#", "F#", "G#"],
    treble: ["C#4", "F#4", "G#4"],
    bass: ["C#3", "F#3", "G#3"],
    displayName: "C# Suspended 4th",
  },
  "C#sus2": {
    notes: ["C#", "D#", "G#"],
    treble: ["C#4", "D#4", "G#4"],
    bass: ["C#3", "D#3", "G#3"],
    displayName: "C# Suspended 2nd",
  },

  // Db Chords
  Db: {
    notes: ["Db", "F", "Ab"],
    treble: ["Db4", "F4", "Ab4"],
    bass: ["Db3", "F3", "Ab3"],
    displayName: "Db Major",
  },
  Dbmaj7: {
    notes: ["Db", "F", "Ab", "C"],
    treble: ["Db4", "F4", "Ab4", "C5"],
    bass: ["Db2", "F2", "Ab2", "C3"],
    displayName: "Db Major 7th",
  },
  Dbmaj6: {
    notes: ["Db", "F", "Ab", "Bb"],
    treble: ["Db4", "F4", "Ab4", "Bb4"],
    bass: ["Db2", "F2", "Ab2", "Bb2"],
    displayName: "Db Major 6th",
  },
  Dbmaj9: {
    notes: ["Db", "F", "Ab", "C", "Eb"],
    treble: ["Db4", "F4", "Ab4", "C5", "Eb5"],
    bass: ["Db2", "F2", "Ab2", "C3", "Eb3"],
    displayName: "Db Major 9th",
  },
  Dbm: {
    notes: ["Db", "Fb", "Ab"],
    treble: ["Db4", "Fb4", "Ab4"],
    bass: ["Db3", "Fb3", "Ab3"],
    displayName: "Db Minor",
  },
  Dbmin7: {
    notes: ["Db", "Fb", "Ab", "Cb"],
    treble: ["Db4", "Fb4", "Ab4", "Cb5"],
    bass: ["Db2", "Fb2", "Ab2", "Cb3"],
    displayName: "Db Minor 7th",
  },
  Dbmin6: {
    notes: ["Db", "Fb", "Ab", "Bb"],
    treble: ["Db4", "Fb4", "Ab4", "Bb4"],
    bass: ["Db2", "Fb2", "Ab2", "Bb2"],
    displayName: "Db Minor 6th",
  },
  Dbmin9: {
    notes: ["Db", "Fb", "Ab", "Cb", "Eb"],
    treble: ["Db4", "Fb4", "Ab4", "Cb5", "Eb5"],
    bass: ["Db2", "Fb2", "Ab2", "Cb2", "Eb3"],
    displayName: "Db Minor 9th",
  },
  Dbdim: {
    notes: ["Db", "Fb", "Abb"],
    treble: ["Db4", "Fb4", "Abb4"],
    bass: ["Db3", "Fb3", "Abb3"],
    displayName: "Db Diminished",
  },
  Dbdim7: {
    notes: ["Db", "Fb", "Abb", "Cbb"],
    treble: ["Db4", "Fb4", "Abb4", "Cbb5"],
    bass: ["Db3", "Fb3", "Abb3", "Cbb4"],
    displayName: "Db Diminished 7th",
  },
  Dbm7b5: {
    notes: ["Db", "Fb", "Abb", "Cb"],
    treble: ["Db4", "Fb4", "Abb4", "Cb5"],
    bass: ["Db3", "Fb3", "Abb4", "Cb4"],
    displayName: "Db Half-Diminished 7th",
  },
  Dbaug: {
    notes: ["Db", "F", "A"],
    treble: ["Db4", "F4", "A4"],
    bass: ["Db3", "F3", "A3"],
    displayName: "Db Augmented",
  },
  Dbaug7: {
    notes: ["Db", "F", "A", "Cb"],
    treble: ["Db4", "F4", "A4", "Cb5"],
    bass: ["Db2", "F2", "A2", "Cb3"],
    displayName: "Db Augmented 7th",
  },
  Db7: {
    notes: ["Db", "F", "Ab", "Cb"],
    treble: ["Db4", "F4", "Ab4", "Cb5"],
    bass: ["Db2", "F2", "Ab2", "Cb3"],
    displayName: "Db Dominant 7th",
  },
  Db9: {
    notes: ["Db", "F", "Ab", "Cb", "Eb"],
    treble: ["Db4", "F4", "Ab4", "Cb5", "Eb5"],
    bass: ["Db2", "F2", "Ab2", "Cb3", "Eb3"],
    displayName: "Db Dominant 9th",
  },
  Dbsus4: {
    notes: ["Db", "Gb", "Ab"],
    treble: ["Db4", "Gb4", "Ab4"],
    bass: ["Db3", "Gb3", "Ab3"],
    displayName: "Db Suspended 4th",
  },
  Dbsus2: {
    notes: ["Db", "Eb", "Ab"],
    treble: ["Db4", "Eb4", "Ab4"],
    bass: ["Db3", "Eb3", "Ab3"],
    displayName: "Db Suspended 2nd",
  },

  // D Chords
  D: {
    notes: ["D", "F#", "A"],
    treble: ["D4", "F#4", "A4"],
    bass: ["D3", "F#3", "A3"],
    displayName: "D Major",
  },
  Dmaj7: {
    notes: ["D", "F#", "A", "C#"],
    treble: ["D4", "F#4", "A4", "C#5"],
    bass: ["D2", "F#2", "A2", "C#3"],
    displayName: "D Major 7th",
  },
  Dmaj6: {
    notes: ["D", "F#", "A", "B"],
    treble: ["D4", "F#4", "A4", "B4"],
    bass: ["D2", "F#2", "A2", "B2"],
    displayName: "D Major 6th",
  },
  Dmaj9: {
    notes: ["D", "F#", "A", "C#", "E"],
    treble: ["D4", "F#4", "A4", "C#5", "E5"],
    bass: ["D2", "F#2", "A2", "C#3", "E3"],
    displayName: "D Major 9th",
  },
  Dm: {
    notes: ["D", "F", "A"],
    treble: ["D4", "F4", "A4"],
    bass: ["D3", "F3", "A3"],
    displayName: "D Minor",
  },
  Dmin7: {
    notes: ["D", "F", "A", "C"],
    treble: ["D4", "F4", "A4", "C5"],
    bass: ["D2", "F2", "A2", "C3"],
    displayName: "D Minor 7th",
  },
  Dmin6: {
    notes: ["D", "F", "A", "B"],
    treble: ["D4", "F4", "A4", "B4"],
    bass: ["D2", "F2", "A2", "B2"],
    displayName: "D Minor 6th",
  },
  Dmin9: {
    notes: ["D", "F", "A", "C", "E"],
    treble: ["D4", "F4", "A4", "C5", "E5"],
    bass: ["D2", "F2", "A2", "C3", "E3"],
    displayName: "D Minor 9th",
  },
  Ddim: {
    notes: ["D", "F", "Ab"],
    treble: ["D4", "F4", "Ab4"],
    bass: ["D3", "F3", "Ab3"],
    displayName: "D Diminished",
  },
  Ddim7: {
    notes: ["D", "F", "Ab", "Cb"],
    treble: ["D4", "F4", "Ab4", "Cb5"],
    bass: ["D3", "F3", "Ab3", "Cb4"],
    displayName: "D Diminished 7th",
  },
  Dm7b5: {
    notes: ["D", "F", "Ab", "C"],
    treble: ["D4", "F4", "Ab4", "C5"],
    bass: ["D3", "F3", "Ab3", "C4"],
    displayName: "D Half-Diminished 7th",
  },
  Daug: {
    notes: ["D", "F#", "A#"],
    treble: ["D4", "F#4", "A#4"],
    bass: ["D3", "F#3", "A#3"],
    displayName: "D Augmented",
  },
  Daug7: {
    notes: ["D", "F#", "A#", "C"],
    treble: ["D4", "F#4", "A#4", "C5"],
    bass: ["D2", "F#2", "A#2", "C3"],
    displayName: "D Augmented 7th",
  },
  D7: {
    notes: ["D", "F#", "A", "C"],
    treble: ["D4", "F#4", "A4", "C5"],
    bass: ["D2", "F#2", "A2", "C3"],
    displayName: "D Dominant 7th",
  },
  D9: {
    notes: ["D", "F#", "A", "C", "E"],
    treble: ["D4", "F#4", "A4", "C5", "E5"],
    bass: ["D2", "F#2", "A2", "C3", "E3"],
    displayName: "D Dominant 9th",
  },
  Dsus4: {
    notes: ["D", "G", "A"],
    treble: ["D4", "G4", "A4"],
    bass: ["D3", "G3", "A3"],
    displayName: "D Suspended 4th",
  },
  Dsus2: {
    notes: ["D", "E", "A"],
    treble: ["D4", "E4", "A4"],
    bass: ["D3", "E3", "A3"],
    displayName: "D Suspended 2nd",
  },

  // D# Chords
  "D#": {
    notes: ["D#", "F##", "A#"],
    treble: ["D#4", "F##4", "A#4"],
    bass: ["D#3", "F##3", "A#3"],
    displayName: "D# Major",
  },
  "D#maj7": {
    notes: ["D#", "F##", "A#", "C##"],
    treble: ["D#4", "F##4", "A#4", "C##5"],
    bass: ["D#2", "F##2", "A#2", "C##3"],
    displayName: "D# Major 7th",
  },
  "D#maj6": {
    notes: ["D#", "F##", "A#", "B#"],
    treble: ["D#4", "F##4", "A#4", "B#4"],
    bass: ["D#2", "F##2", "A#2", "B#2"],
    displayName: "D# Major 6th",
  },
  "D#maj9": {
    notes: ["D#", "F##", "A#", "C##", "E#"],
    treble: ["D#4", "F##4", "A#4", "C##5", "E#5"],
    bass: ["D#2", "F##2", "A#2", "C##3", "E#3"],
    displayName: "D# Major 9th",
  },
  "D#m": {
    notes: ["D#", "F#", "A#"],
    treble: ["D#4", "F#4", "A#4"],
    bass: ["D#3", "F#3", "A#3"],
    displayName: "D# Minor",
  },
  "D#min7": {
    notes: ["D#", "F#", "A#", "C#"],
    treble: ["D#4", "F#4", "A#4", "C#5"],
    bass: ["D#2", "F#2", "A#2", "C#3"],
    displayName: "D# Minor 7th",
  },
  "D#min6": {
    notes: ["D#", "F#", "A#", "B#"],
    treble: ["D#4", "F#4", "A#4", "B#4"],
    bass: ["D#2", "F#2", "A#2", "B#2"],
    displayName: "D# Minor 6th",
  },
  "D#min9": {
    notes: ["D#", "F#", "A#", "C#", "E#"],
    treble: ["D#4", "F#4", "A#4", "C#5", "E#5"],
    bass: ["D#2", "F#2", "A#2", "C#3", "E#3"],
    displayName: "D# Minor 9th",
  },
  "D#dim": {
    notes: ["D#", "F#", "A"],
    treble: ["D#4", "F#4", "A4"],
    bass: ["D#3", "F#3", "A3"],
    displayName: "D# Diminished",
  },
  "D#dim7": {
    notes: ["D#", "F#", "A", "C"],
    treble: ["D#4", "F#4", "A4", "C5"],
    bass: ["D#3", "F#3", "A3", "C4"],
    displayName: "D# Diminished 7th",
  },
  "D#m7b5": {
    notes: ["D#", "F#", "A", "C#"],
    treble: ["D#4", "F#4", "A4", "C#5"],
    bass: ["D#3", "F#3", "A3", "C#4"],
    displayName: "D# Half-Diminished 7th",
  },
  "D#aug": {
    notes: ["D#", "F##", "A##"],
    treble: ["D#4", "F##4", "A##4"],
    bass: ["D#3", "F##3", "A##3"],
    displayName: "D# Augmented",
  },
  "D#aug7": {
    notes: ["D#", "F##", "A##", "C#"],
    treble: ["D#4", "F##4", "A##4", "C#5"],
    bass: ["D#2", "F##2", "A##2", "C#3"],
    displayName: "D# Augmented 7th",
  },
  "D#7": {
    notes: ["D#", "F##", "A#", "C#"],
    treble: ["D#4", "F##4", "A#4", "C#5"],
    bass: ["D#2", "F##2", "A#2", "C#3"],
    displayName: "D# Dominant 7th",
  },
  "D#9": {
    notes: ["D#", "F##", "A#", "C#", "E#"],
    treble: ["D#4", "F##4", "A#4", "C#5", "E#5"],
    bass: ["D#2", "F##2", "A#2", "C#3", "E#3"],
    displayName: "D# Dominant 9th",
  },
  "D#sus4": {
    notes: ["D#", "G#", "A#"],
    treble: ["D#4", "G#4", "A#4"],
    bass: ["D#3", "G#3", "A#3"],
    displayName: "D# Suspended 4th",
  },
  "D#sus2": {
    notes: ["D#", "E#", "A#"],
    treble: ["D#4", "E#4", "A#4"],
    bass: ["D#3", "E#3", "A#3"],
    displayName: "D# Suspended 2nd",
  },

  // Eb Chords
  Eb: {
    notes: ["Eb", "G", "Bb"],
    treble: ["Eb4", "G4", "Bb4"],
    bass: ["Eb3", "G3", "Bb3"],
    displayName: "Eb Major",
  },
  Ebmaj7: {
    notes: ["Eb", "G", "Bb", "D"],
    treble: ["Eb4", "G4", "Bb4", "D5"],
    bass: ["Eb2", "G2", "Bb2", "D3"],
    displayName: "Eb Major 7th",
  },
  Ebmaj6: {
    notes: ["Eb", "G", "Bb", "C"],
    treble: ["Eb4", "G4", "Bb4", "C5"],
    bass: ["Eb2", "G2", "Bb2", "C3"],
    displayName: "Eb Major 6th",
  },
  Ebmaj9: {
    notes: ["Eb", "G", "Bb", "D", "F"],
    treble: ["Eb4", "G4", "Bb4", "D5", "F5"],
    bass: ["Eb2", "G2", "Bb2", "D3", "F3"],
    displayName: "Eb Major 9th",
  },
  Ebm: {
    notes: ["Eb", "Gb", "Bb"],
    treble: ["Eb4", "Gb4", "Bb4"],
    bass: ["Eb3", "Gb3", "Bb3"],
    displayName: "Eb Minor",
  },
  Ebmin7: {
    notes: ["Eb", "Gb", "Bb", "Db"],
    treble: ["Eb4", "Gb4", "Bb4", "Db5"],
    bass: ["Eb2", "Gb2", "Bb2", "Db3"],
    displayName: "Eb Minor 7th",
  },
  Ebmin6: {
    notes: ["Eb", "Gb", "Bb", "C"],
    treble: ["Eb4", "Gb4", "Bb4", "C5"],
    bass: ["Eb2", "Gb2", "Bb2", "C3"],
    displayName: "Eb Minor 6th",
  },
  Ebmin9: {
    notes: ["Eb", "Gb", "Bb", "Db", "F"],
    treble: ["Eb4", "Gb4", "Bb4", "Db5", "F5"],
    bass: ["Eb2", "Gb2", "Bb2", "Db3", "F3"],
    displayName: "Eb Minor 9th",
  },
  Ebdim: {
    notes: ["Eb", "Gb", "Bbb"],
    treble: ["Eb4", "Gb4", "Bbb4"],
    bass: ["Eb3", "Gb3", "Bbb3"],
    displayName: "Eb Diminished",
  },
  Ebdim7: {
    notes: ["Eb", "Gb", "Bbb", "Dbb"],
    treble: ["Eb4", "Gb4", "Bbb4", "Dbb5"],
    bass: ["Eb3", "Gb3", "Bbb3", "Dbb4"],
    displayName: "Eb Diminished 7th",
  },
  Ebm7b5: {
    notes: ["Eb", "Gb", "Bbb", "Db"],
    treble: ["Eb4", "Gb4", "Bbb4", "Db5"],
    bass: ["Eb3", "Gb3", "Bbb3", "Db4"],
    displayName: "Eb Half-Diminished 7th",
  },
  Ebaug: {
    notes: ["Eb", "G", "B"],
    treble: ["Eb4", "G4", "B4"],
    bass: ["Eb3", "G3", "B3"],
    displayName: "Eb Augmented",
  },
  Ebaug7: {
    notes: ["Eb", "G", "B", "Db"],
    treble: ["Eb4", "G4", "B4", "Db5"],
    bass: ["Eb2", "G2", "B2", "Db3"],
    displayName: "Eb Augmented 7th",
  },
  Eb7: {
    notes: ["Eb", "G", "Bb", "Db"],
    treble: ["Eb4", "G4", "Bb4", "Db5"],
    bass: ["Eb2", "G2", "Bb2", "Db3"],
    displayName: "Eb Dominant 7th",
  },
  Eb9: {
    notes: ["Eb", "G", "Bb", "Db", "F"],
    treble: ["Eb4", "G4", "Bb4", "Db5", "F5"],
    bass: ["Eb2", "G2", "Bb2", "Db3", "F3"],
    displayName: "Eb Dominant 9th",
  },
  Ebsus4: {
    notes: ["Eb", "Ab", "Bb"],
    treble: ["Eb4", "Ab4", "Bb4"],
    bass: ["Eb3", "Ab3", "Bb3"],
    displayName: "Eb Suspended 4th",
  },
  Ebsus2: {
    notes: ["Eb", "F", "Bb"],
    treble: ["Eb4", "F4", "Bb4"],
    bass: ["Eb3", "F3", "Bb3"],
    displayName: "Eb Suspended 2nd",
  },

  // E Chords
  E: {
    notes: ["E", "G#", "B"],
    treble: ["E4", "G#4", "B4"],
    bass: ["E3", "G#3", "B3"],
    displayName: "E Major",
  },
  "Fb": {
  notes: ["Fb", "Ab", "Cb"],
  treble: ["Fb4", "Ab4", "Cb5"],
  bass: ["Fb3", "Ab3", "Cb4"],
  displayName: "Fb Major",
},
  Emaj7: {
    notes: ["E", "G#", "B", "D#"],
    treble: ["E4", "G#4", "B4", "D#5"],
    bass: ["E2", "G#2", "B2", "D#3"],
    displayName: "E Major 7th",
  },
  Emaj6: {
    notes: ["E", "G#", "B", "C#"],
    treble: ["E4", "G#4", "B4", "C#5"],
    bass: ["E2", "G#2", "B2", "C#3"],
    displayName: "E Major 6th",
  },
  Emaj9: {
    notes: ["E", "G#", "B", "D#", "F#"],
    treble: ["E4", "G#4", "B4", "D#5", "F#5"],
    bass: ["E2", "G#2", "B2", "D#3", "F#3"],
    displayName: "E Major 9th",
  },
  Em: {
    notes: ["E", "G", "B"],
    treble: ["E4", "G4", "B4"],
    bass: ["E3", "G4", "B3"],
    displayName: "E Minor",
  },
  Emin7: {
    notes: ["E", "G", "B", "D"],
    treble: ["E4", "G4", "B4", "D5"],
    bass: ["E2", "G2", "B2", "D3"],
    displayName: "E Minor 7th",
  },
  Emin6: {
    notes: ["E", "G", "B", "C#"],
    treble: ["E4", "G4", "B4", "C#5"],
    bass: ["E2", "G2", "B2", "C#3"],
    displayName: "E Minor 6th",
  },
  Emin9: {
    notes: ["E", "G", "B", "D", "F#"],
    treble: ["E4", "G4", "B4", "D5", "F#5"],
    bass: ["E2", "G2", "B2", "D3", "F#3"],
    displayName: "E Minor 9th",
  },
  Edim: {
    notes: ["E", "G", "Bb"],
    treble: ["E4", "G4", "Bb4"],
    bass: ["E3", "G3", "Bb3"],
    displayName: "E Diminished",
  },
    "B#dim": {
    notes: ["B#", "G", "A#"],
    treble: ["B#4", "G4", "A#4"],
    bass: ["B#3", "G3", "A#3"],
    displayName: "B# Diminished",
  },
  Edim7: {
    notes: ["E", "G", "Bb", "Db"],
    treble: ["E4", "G4", "Bb4", "Db5"],
    bass: ["E3", "G3", "Bb3", "Db4"],
    displayName: "E Diminished 7th",
  },
  Em7b5: {
    notes: ["E", "G", "Bb", "D"],
    treble: ["E4", "G4", "Bb4", "D5"],
    bass: ["E3", "G3", "Bb3", "D4"],
    displayName: "E Half-Diminished 7th",
  },
  Eaug: {
    notes: ["E", "G#", "B#"],
    treble: ["E4", "G#4", "B#4"],
    bass: ["E3", "G#3", "B#3"],
    displayName: "E Augmented",
  },
  Eaug7: {
    notes: ["E", "G#", "B#", "D"],
    treble: ["E4", "G#4", "B#4", "D5"],
    bass: ["E2", "G#2", "B#2", "D3"],
    displayName: "E Augmented 7th",
  },
  E7: {
    notes: ["E", "G#", "B", "D"],
    treble: ["E4", "G#4", "B4", "D5"],
    bass: ["E2", "G#2", "B2", "D3"],
    displayName: "E Dominant 7th",
  },
  E9: {
    notes: ["E", "G#", "B", "D", "F#"],
    treble: ["E4", "G#4", "B4", "D5", "F#5"],
    bass: ["E2", "G#2", "B2", "D3", "F#3"],
    displayName: "E Dominant 9th",
  },
  Esus4: {
    notes: ["E", "A", "B"],
    treble: ["E4", "A4", "B4"],
    bass: ["E3", "A3", "B3"],
    displayName: "E Suspended 4th",
  },
  Esus2: {
    notes: ["E", "F#", "B"],
    treble: ["E4", "F#4", "B4"],
    bass: ["E3", "F#3", "B3"],
    displayName: "E Suspended 2nd",
  },

  // F Chords
  F: {
    notes: ["F", "A", "C"],
    treble: ["F4", "A4", "C5"],
    bass: ["F2", "A2", "C3"],
    displayName: "F Major",
  },
  Fmaj7: {
    notes: ["F", "A", "C", "E"],
    treble: ["F4", "A4", "C5", "E5"],
    bass: ["F2", "A2", "C3", "E3"],
    displayName: "F Major 7th",
  },
  Fmaj6: {
    notes: ["F", "A", "C", "D"],
    treble: ["F4", "A4", "C5", "D5"],
    bass: ["F2", "A2", "C3", "D3"],
    displayName: "F Major 6th",
  },
  Fmaj9: {
    notes: ["F", "A", "C", "E", "G"],
    treble: ["F4", "A4", "C5", "E5", "G5"],
    bass: ["F2", "A2", "C3", "E3", "G3"],
    displayName: "F Major 9th",
  },
  Fm: {
    notes: ["F", "Ab", "C"],
    treble: ["F4", "Ab4", "C5"],
    bass: ["F2", "Ab2", "C3"],
    displayName: "F Minor",
  },
    "E#m": {
    notes: ["E#", "G#", "C"],
    treble: ["E#4", "G#4", "C5"],
    bass: ["E#2", "G#2", "C3"],
    displayName: "E# Minor",
  },
  Fmin7: {
    notes: ["F", "Ab", "C", "Eb"],
    treble: ["F4", "Ab4", "C5", "Eb5"],
    bass: ["F2", "Ab2", "C3", "Eb3"],
    displayName: "F Minor 7th",
  },
  Fmin6: {
    notes: ["F", "Ab", "C", "D"],
    treble: ["F4", "Ab4", "C5", "D5"],
    bass: ["F2", "Ab2", "C3", "D3"],
    displayName: "F Minor 6th",
  },
  Fmin9: {
    notes: ["F", "Ab", "C", "Eb", "G"],
    treble: ["F4", "Ab4", "C5", "Eb5", "G5"],
    bass: ["F2", "Ab2", "C3", "Eb3", "G3"],
    displayName: "F Minor 9th",
  },
  Fdim: {
    notes: ["F", "Ab", "Cb"],
    treble: ["F4", "Ab4", "Cb5"],
    bass: ["F3", "Ab3", "Cb4"],
    displayName: "F Diminished",
  },
    "E#dim": {
    notes: ["E#", "G#", "B"],
    treble: ["E#4", "G#4", "B4"],
    bass: ["E#3", "Ab3", "B4"],
    displayName: "E# Diminished",
  },
  Fdim7: {
    notes: ["F", "Ab", "Cb", "Ebb"],
    treble: ["F4", "Ab4", "Cb5", "Ebb5"],
    bass: ["F3", "Ab3", "Cb4", "Ebb4"],
    displayName: "F Diminished 7th",
  },
  Fm7b5: {
    notes: ["F", "Ab", "Cb", "Eb"],
    treble: ["F4", "Ab4", "Cb5", "Eb5"],
    bass: ["F3", "Ab3", "Cb4", "Eb4"],
    displayName: "F Half-Diminished 7th",
  },
  Faug: {
    notes: ["F", "A", "C#"],
    treble: ["F4", "A4", "C#5"],
    bass: ["F2", "A2", "C#3"],
    displayName: "F Augmented",
  },
  Faug7: {
    notes: ["F", "A", "C#", "Eb"],
    treble: ["F4", "A4", "C#5", "Eb5"],
    bass: ["F2", "A2", "C#3", "Eb3"],
    displayName: "F Augmented 7th",
  },
  F7: {
    notes: ["F", "A", "C", "Eb"],
    treble: ["F4", "A4", "C5", "Eb5"],
    bass: ["F2", "A2", "C3", "Eb3"],
    displayName: "F Dominant 7th",
  },
  F9: {
    notes: ["F", "A", "C", "Eb", "G"],
    treble: ["F4", "A4", "C5", "Eb5", "G5"],
    bass: ["F2", "A2", "C3", "Eb3", "G3"],
    displayName: "F Dominant 9th",
  },
  Fsus4: {
    notes: ["F", "Bb", "C"],
    treble: ["F4", "Bb4", "C5"],
    bass: ["F2", "Bb2", "C3"],
    displayName: "F Suspended 4th",
  },
  Fsus2: {
    notes: ["F", "G", "C"],
    treble: ["F4", "G4", "C5"],
    bass: ["F2", "G2", "C3"],
    displayName: "F Suspended 2nd",
  },

  // F# Chords
  "F#": {
    notes: ["F#", "A#", "C#"],
    treble: ["F#4", "A#4", "C#5"],
    bass: ["F#2", "A#2", "C#3"],
    displayName: "F# Major",
  },
  "F#maj7": {
    notes: ["F#", "A#", "C#", "E#"],
    treble: ["F#4", "A#4", "C#5", "E#5"],
    bass: ["F#2", "A#2", "C#3", "E#3"],
    displayName: "F# Major 7th",
  },
  "F#maj6": {
    notes: ["F#", "A#", "C#", "D#"],
    treble: ["F#4", "A#4", "C#5", "D#5"],
    bass: ["F#2", "A#2", "C#3", "D#3"],
    displayName: "F# Major 6th",
  },
  "F#maj9": {
    notes: ["F#", "A#", "C#", "E#", "G#"],
    treble: ["F#4", "A#4", "C#5", "E#5", "G#5"],
    bass: ["F#2", "A#2", "C#3", "E#3", "G#3"],
    displayName: "F# Major 9th",
  },
  "F#m": {
    notes: ["F#", "A", "C#"],
    treble: ["F#4", "A4", "C#5"],
    bass: ["F#2", "A2", "C#3"],
    displayName: "F# Minor",
  },
  "F#min7": {
    notes: ["F#", "A", "C#", "E"],
    treble: ["F#4", "A4", "C#5", "E5"],
    bass: ["F#2", "A2", "C#3", "E3"],
    displayName: "F# Minor 7th",
  },
  "F#min6": {
    notes: ["F#", "A", "C#", "D#"],
    treble: ["F#4", "A4", "C#5", "D#5"],
    bass: ["F#2", "A2", "C#3", "D#3"],
    displayName: "F# Minor 6th",
  },
  "F#min9": {
    notes: ["F#", "A", "C#", "E", "G#"],
    treble: ["F#4", "A4", "C#5", "E5", "G#5"],
    bass: ["F#2", "A2", "C#3", "E3", "G#3"],
    displayName: "F# Minor 9th",
  },
  "F#dim": {
    notes: ["F#", "A", "C"],
    treble: ["F#4", "A4", "C5"],
    bass: ["F#3", "A3", "C4"],
    displayName: "F# Diminished",
  },
  "F#dim7": {
    notes: ["F#", "A", "C", "Eb"],
    treble: ["F#4", "A4", "C5", "Eb5"],
    bass: ["F#3", "A3", "C4", "Eb4"],
    displayName: "F# Diminished 7th",
  },
  "F#m7b5": {
    notes: ["F#", "A", "C", "E"],
    treble: ["F#4", "A4", "C5", "E5"],
    bass: ["F#3", "A3", "C4", "E4"],
    displayName: "F# Half-Diminished 7th",
  },
  "F#aug": {
    notes: ["F#", "A#", "C##"],
    treble: ["F#4", "A#4", "C##5"],
    bass: ["F#2", "A#2", "C##3"],
    displayName: "F# Augmented",
  },
  "F#aug7": {
    notes: ["F#", "A#", "C##", "E"],
    treble: ["F#4", "A#4", "C##5", "E5"],
    bass: ["F#2", "A#2", "C##3", "E3"],
    displayName: "F# Augmented 7th",
  },
  "F#7": {
    notes: ["F#", "A#", "C#", "E"],
    treble: ["F#4", "A#4", "C#5", "E5"],
    bass: ["F#2", "A#2", "C#3", "E3"],
    displayName: "F# Dominant 7th",
  },
  "F#9": {
    notes: ["F#", "A#", "C#", "E", "G#"],
    treble: ["F#4", "A#4", "C#5", "E5", "G#5"],
    bass: ["F#2", "A#2", "C#3", "E3", "G#3"],
    displayName: "F# Dominant 9th",
  },
  "F#sus4": {
    notes: ["F#", "B", "C#"],
    treble: ["F#4", "B4", "C#5"],
    bass: ["F#2", "B2", "C#3"],
    displayName: "F# Suspended 4th",
  },
  "F#sus2": {
    notes: ["F#", "G#", "C#"],
    treble: ["F#4", "G#4", "C#5"],
    bass: ["F#2", "G#2", "C#3"],
    displayName: "F# Suspended 2nd",
  },

  // Gb Chords
  Gb: {
    notes: ["Gb", "Bb", "Db"],
    treble: ["Gb4", "Bb4", "Db5"],
    bass: ["Gb2", "Bb2", "Db3"],
    displayName: "Gb Major",
  },
  Gbmaj7: {
    notes: ["Gb", "Bb", "Db", "F"],
    treble: ["Gb4", "Bb4", "Db5", "F5"],
    bass: ["Gb2", "Bb2", "Db3", "F3"],
    displayName: "Gb Major 7th",
  },
  Gbmaj6: {
    notes: ["Gb", "Bb", "Db", "Eb"],
    treble: ["Gb4", "Bb4", "Db5", "Eb5"],
    bass: ["Gb2", "Bb2", "Db3", "Eb3"],
    displayName: "Gb Major 6th",
  },
  Gbmaj9: {
    notes: ["Gb", "Bb", "Db", "F", "Ab"],
    treble: ["Gb4", "Bb4", "Db5", "F5", "Ab5"],
    bass: ["Gb2", "Bb2", "Db3", "F3", "Ab3"],
    displayName: "Gb Major 9th",
  },
  Gbm: {
    notes: ["Gb", "Bbb", "Db"],
    treble: ["Gb4", "Bbb4", "Db5"],
    bass: ["Gb2", "Bbb2", "Db3"],
    displayName: "Gb Minor",
  },
  Gbmin7: {
    notes: ["Gb", "Bbb", "Db", "Fb"],
    treble: ["Gb4", "Bbb4", "Db5", "Fb5"],
    bass: ["Gb2", "Bbb2", "Db3", "Fb3"],
    displayName: "Gb Minor 7th",
  },
  Gbmin6: {
    notes: ["Gb", "Bbb", "Db", "Eb"],
    treble: ["Gb4", "Bbb4", "Db5", "Eb5"],
    bass: ["Gb2", "Bbb2", "Db3", "Eb3"],
    displayName: "Gb Minor 6th",
  },
  Gbmin9: {
    notes: ["Gb", "Bbb", "Db", "Fb", "Ab"],
    treble: ["Gb4", "Bbb4", "Db5", "Fb5", "Ab5"],
    bass: ["Gb2", "Bbb2", "Db3", "Fb3", "Ab3"],
    displayName: "Gb Minor 9th",
  },
  Gbdim: {
    notes: ["Gb", "Bbb", "Dbb"],
    treble: ["Gb4", "Bbb4", "Dbb5"],
    bass: ["Gb3", "Bbb3", "Dbb4"],
    displayName: "Gb Diminished",
  },
  Gbdim7: {
    notes: ["Gb", "Bbb", "Dbb", "Fbb"],
    treble: ["Gb4", "Bbb4", "Dbb5", "Fbb5"],
    bass: ["Gb3", "Bbb3", "Dbb4", "Fbb4"],
    displayName: "Gb Diminished 7th",
  },
  Gbm7b5: {
    notes: ["Gb", "Bbb", "Dbb", "Fb"],
    treble: ["Gb4", "Bbb4", "Dbb5", "Fb5"],
    bass: ["Gb3", "Bbb3", "Dbb4", "Fb4"],
    displayName: "Gb Half-Diminished 7th",
  },
  Gbaug: {
    notes: ["Gb", "Bb", "D"],
    treble: ["Gb4", "Bb4", "D5"],
    bass: ["Gb2", "Bb2", "D3"],
    displayName: "Gb Augmented",
  },
  Gbaug7: {
    notes: ["Gb", "Bb", "D", "Fb"],
    treble: ["Gb4", "Bb4", "D5", "Fb5"],
    bass: ["Gb2", "Bb2", "D3", "Fb3"],
    displayName: "Gb Augmented 7th",
  },
  Gb7: {
    notes: ["Gb", "Bb", "Db", "Fb"],
    treble: ["Gb4", "Bb4", "Db5", "Fb5"],
    bass: ["Gb2", "Bb2", "Db3", "Fb3"],
    displayName: "Gb Dominant 7th",
  },
  Gb9: {
    notes: ["Gb", "Bb", "Db", "Fb", "Ab"],
    treble: ["Gb4", "Bb4", "Db5", "Fb5", "Ab5"],
    bass: ["Gb2", "Bb2", "Db3", "Fb3", "Ab3"],
    displayName: "Gb Dominant 9th",
  },
  Gbsus4: {
    notes: ["Gb", "Cb", "Db"],
    treble: ["Gb4", "Cb5", "Db5"],
    bass: ["Gb2", "Cb3", "Db3"],
    displayName: "Gb Suspended 4th",
  },
  Gbsus2: {
    notes: ["Gb", "Ab", "Db"],
    treble: ["Gb4", "Ab4", "Db5"],
    bass: ["Gb2", "Ab2", "Db3"],
    displayName: "Gb Suspended 2nd",
  },

  // G Chords
  G: {
    notes: ["G", "B", "D"],
    treble: ["G4", "B4", "D5"],
    bass: ["G2", "B2", "D3"],
    displayName: "G Major",
  },
  Gmaj7: {
    notes: ["G", "B", "D", "F#"],
    treble: ["G4", "B4", "D5", "F#5"],
    bass: ["G2", "B2", "D3", "F#3"],
    displayName: "G Major 7th",
  },
  Gmaj6: {
    notes: ["G", "B", "D", "E"],
    treble: ["G4", "B4", "D5", "E5"],
    bass: ["G2", "B2", "D3", "E3"],
    displayName: "G Major 6th",
  },
  Gmaj9: {
    notes: ["G", "B", "D", "F#", "A"],
    treble: ["G4", "B4", "D5", "F#5", "A5"],
    bass: ["G2", "B2", "D3", "F#3", "A3"],
    displayName: "G Major 9th",
  },
  Gm: {
    notes: ["G", "Bb", "D"],
    treble: ["G4", "Bb4", "D5"],
    bass: ["G2", "Bb2", "D3"],
    displayName: "G Minor",
  },
  Gmin7: {
    notes: ["G", "Bb", "D", "F"],
    treble: ["G4", "Bb4", "D5", "F5"],
    bass: ["G2", "Bb2", "D3", "F3"],
    displayName: "G Minor 7th",
  },
  Gmin6: {
    notes: ["G", "Bb", "D", "E"],
    treble: ["G4", "Bb4", "D5", "E5"],
    bass: ["G2", "Bb2", "D3", "E3"],
    displayName: "G Minor 6th",
  },
  Gmin9: {
    notes: ["G", "Bb", "D", "F", "A"],
    treble: ["G4", "Bb4", "D5", "F5", "A5"],
    bass: ["G2", "Bb2", "D3", "F3", "A3"],
    displayName: "G Minor 9th",
  },
  Gdim: {
    notes: ["G", "Bb", "Db"],
    treble: ["G4", "Bb4", "Db5"],
    bass: ["G3", "Bb3", "Db4"],
    displayName: "G Diminished",
  },
  Gdim7: {
    notes: ["G", "Bb", "Db", "Fb"],
    treble: ["G4", "Bb4", "Db5", "Fb5"],
    bass: ["G3", "Bb3", "Db4", "Fb4"],
    displayName: "G Diminished 7th",
  },
  Gm7b5: {
    notes: ["G", "Bb", "Db", "F"],
    treble: ["G4", "Bb4", "Db5", "F5"],
    bass: ["G3", "Bb3", "Db4", "F4"],
    displayName: "G Half-Diminished 7th",
  },
  Gaug: {
    notes: ["G", "B", "D#"],
    treble: ["G4", "B4", "D#5"],
    bass: ["G2", "B2", "D#3"],
    displayName: "G Augmented",
  },
  Gaug7: {
    notes: ["G", "B", "D#", "F"],
    treble: ["G4", "B4", "D#5", "F5"],
    bass: ["G2", "B2", "D#3", "F3"],
    displayName: "G Augmented 7th",
  },
  G7: {
    notes: ["G", "B", "D", "F"],
    treble: ["G4", "B4", "D5", "F5"],
    bass: ["G2", "B2", "D3", "F3"],
    displayName: "G Dominant 7th",
  },
  G9: {
    notes: ["G", "B", "D", "F", "A"],
    treble: ["G4", "B4", "D5", "F5", "A5"],
    bass: ["G2", "B2", "D3", "F3", "A3"],
    displayName: "G Dominant 9th",
  },
  Gsus4: {
    notes: ["G", "C", "D"],
    treble: ["G4", "C5", "D5"],
    bass: ["G2", "C3", "D3"],
    displayName: "G Suspended 4th",
  },
  Gsus2: {
    notes: ["G", "A", "D"],
    treble: ["G4", "A4", "D5"],
    bass: ["G2", "A2", "D3"],
    displayName: "G Suspended 2nd",
  },

  // G# Chords
  "G#": {
    notes: ["G#", "B#", "D#"],
    treble: ["G#4", "B#4", "D#5"],
    bass: ["G#2", "B#2", "D#3"],
    displayName: "G# Major",
  },
  "G#maj7": {
    notes: ["G#", "B#", "D#", "F##"],
    treble: ["G#4", "B#4", "D#5", "F##5"],
    bass: ["G#2", "B#2", "D#3", "F##3"],
    displayName: "G# Major 7th",
  },
  "G#maj6": {
    notes: ["G#", "B#", "D#", "E#"],
    treble: ["G#4", "B#4", "D#5", "E#5"],
    bass: ["G#2", "B#2", "D#3", "E#3"],
    displayName: "G# Major 6th",
  },
  "G#maj9": {
    notes: ["G#", "B#", "D#", "F##", "A#"],
    treble: ["G#4", "B#4", "D#5", "F##5", "A#5"],
    bass: ["G#2", "B#2", "D#3", "F##3", "A#3"],
    displayName: "G# Major 9th",
  },
  "G#m": {
    notes: ["G#", "B", "D#"],
    treble: ["G#4", "B4", "D#5"],
    bass: ["G#2", "B2", "D#3"],
    displayName: "G# Minor",
  },
  "G#min7": {
    notes: ["G#", "B", "D#", "F#"],
    treble: ["G#4", "B4", "D#5", "F#5"],
    bass: ["G#2", "B2", "D#3", "F#3"],
    displayName: "G# Minor 7th",
  },
  "G#min6": {
    notes: ["G#", "B", "D#", "E#"],
    treble: ["G#4", "B4", "D#5", "E#5"],
    bass: ["G#2", "B2", "D#3", "E#3"],
    displayName: "G# Minor 6th",
  },
  "G#min9": {
    notes: ["G#", "B", "D#", "F#", "A#"],
    treble: ["G#4", "B4", "D#5", "F#5", "A#5"],
    bass: ["G#2", "B2", "D#3", "F#3", "A#3"],
    displayName: "G# Minor 9th",
  },
  "G#dim": {
    notes: ["G#", "B", "D"],
    treble: ["G#4", "B4", "D5"],
    bass: ["G#3", "B3", "D4"],
    displayName: "G# Diminished",
  },
  "G#dim7": {
    notes: ["G#", "B", "D", "F"],
    treble: ["G#4", "B4", "D5", "F5"],
    bass: ["G#3", "B3", "D4", "F4"],
    displayName: "G# Diminished 7th",
  },
  "G#m7b5": {
    notes: ["G#", "B", "D", "F#"],
    treble: ["G#4", "B4", "D5", "F#5"],
    bass: ["G#3", "B3", "D4", "F#4"],
    displayName: "G# Half-Diminished 7th",
  },
  "G#aug": {
    notes: ["G#", "B#", "D##"],
    treble: ["G#4", "B#4", "D##5"],
    bass: ["G#2", "B#2", "D##3"],
    displayName: "G# Augmented",
  },
  "G#aug7": {
    notes: ["G#", "B#", "D##", "F#"],
    treble: ["G#4", "B#4", "D##5", "F#5"],
    bass: ["G#2", "B#2", "D##3", "F#3"],
    displayName: "G# Augmented 7th",
  },
  "G#7": {
    notes: ["G#", "B#", "D#", "F#"],
    treble: ["G#4", "B#4", "D#5", "F#5"],
    bass: ["G#2", "B#2", "D#3", "F#3"],
    displayName: "G# Dominant 7th",
  },
  "G#9": {
    notes: ["G#", "B#", "D#", "F#", "A#"],
    treble: ["G#4", "B#4", "D#5", "F#5", "A#5"],
    bass: ["G#2", "B#2", "D#3", "F#3", "A#3"],
    displayName: "G# Dominant 9th",
  },
  "G#sus4": {
    notes: ["G#", "C#", "D#"],
    treble: ["G#4", "C#5", "D#5"],
    bass: ["G#2", "C#3", "D#3"],
    displayName: "G# Suspended 4th",
  },
  "G#sus2": {
    notes: ["G#", "A#", "D#"],
    treble: ["G#4", "A#4", "D#5"],
    bass: ["G#2", "A#2", "D#3"],
    displayName: "G# Suspended 2nd",
  },

  // Ab Chords
  Ab: {
    notes: ["Ab", "C", "Eb"],
    treble: ["Ab4", "C5", "Eb5"],
    bass: ["Ab2", "C3", "Eb3"],
    displayName: "Ab Major",
  },
  Abmaj7: {
    notes: ["Ab", "C", "Eb", "G"],
    treble: ["Ab4", "C5", "Eb5", "G5"],
    bass: ["Ab2", "C3", "Eb3", "G3"],
    displayName: "Ab Major 7th",
  },
  Abmaj6: {
    notes: ["Ab", "C", "Eb", "F"],
    treble: ["Ab4", "C5", "Eb5", "F5"],
    bass: ["Ab2", "C3", "Eb3", "F3"],
    displayName: "Ab Major 6th",
  },
  Abmaj9: {
    notes: ["Ab", "C", "Eb", "G", "Bb"],
    treble: ["Ab4", "C5", "Eb5", "G5", "Bb5"],
    bass: ["Ab2", "C3", "Eb3", "G3", "Bb3"],
    displayName: "Ab Major 9th",
  },
  Abm: {
    notes: ["Ab", "Cb", "Eb"],
    treble: ["Ab4", "Cb5", "Eb5"],
    bass: ["Ab2", "Cb3", "Eb3"],
    displayName: "Ab Minor",
  },
  Abmin7: {
    notes: ["Ab", "Cb", "Eb", "Gb"],
    treble: ["Ab4", "Cb5", "Eb5", "Gb5"],
    bass: ["Ab2", "Cb3", "Eb3", "Gb3"],
    displayName: "Ab Minor 7th",
  },
  Abmin6: {
    notes: ["Ab", "Cb", "Eb", "F"],
    treble: ["Ab4", "Cb5", "Eb5", "F5"],
    bass: ["Ab2", "Cb3", "Eb3", "F3"],
    displayName: "Ab Minor 6th",
  },
  Abmin9: {
    notes: ["Ab", "Cb", "Eb", "Gb", "Bb"],
    treble: ["Ab4", "Cb5", "Eb5", "Gb5", "Bb5"],
    bass: ["Ab2", "Cb3", "Eb3", "Gb3", "Bb3"],
    displayName: "Ab Minor 9th",
  },
  Abdim: {
    notes: ["Ab", "Cb", "Ebb"],
    treble: ["Ab4", "Cb5", "Ebb5"],
    bass: ["Ab3", "Cb4", "Ebb4"],
    displayName: "Ab Diminished",
  },
  Abdim7: {
    notes: ["Ab", "Cb", "Ebb", "Gbb"],
    treble: ["Ab4", "Cb5", "Ebb5", "Gbb5"],
    bass: ["Ab3", "Cb4", "Ebb4", "Gbb4"],
    displayName: "Ab Diminished 7th",
  },
  Abm7b5: {
    notes: ["Ab", "Cb", "Ebb", "Gb"],
    treble: ["Ab4", "Cb5", "Ebb5", "Gb5"],
    bass: ["Ab3", "Cb4", "Ebb4", "Gb4"],
    displayName: "Ab Half-Diminished 7th",
  },
  Abaug: {
    notes: ["Ab", "C", "E"],
    treble: ["Ab4", "C5", "E5"],
    bass: ["Ab3", "C3", "E3"],
    displayName: "Ab Augmented",
  },
  Abaug7: {
    notes: ["Ab", "C", "E", "Gb"],
    treble: ["Ab4", "C5", "E5", "Gb5"],
    bass: ["Ab2", "C3", "E3", "Gb3"],
    displayName: "Ab Augmented 7th",
  },
  Ab7: {
    notes: ["Ab", "C", "Eb", "Gb"],
    treble: ["Ab4", "C5", "Eb5", "Gb5"],
    bass: ["Ab2", "C3", "Eb3", "Gb3"],
    displayName: "Ab Dominant 7th",
  },
  Ab9: {
    notes: ["Ab", "C", "Eb", "Gb", "Bb"],
    treble: ["Ab4", "C5", "Eb5", "Gb5", "Bb5"],
    bass: ["Ab2", "C3", "Eb3", "Gb3", "Bb3"],
    displayName: "Ab Dominant 9th",
  },
  Absus4: {
    notes: ["Ab", "Db", "Eb"],
    treble: ["Ab4", "Db5", "Eb5"],
    bass: ["Ab2", "Db3", "Eb3"],
    displayName: "Ab Suspended 4th",
  },
  Absus2: {
    notes: ["Ab", "Bb", "Eb"],
    treble: ["Ab4", "Bb4", "Eb5"],
    bass: ["Ab2", "Bb2", "Eb3"],
    displayName: "Ab Suspended 2nd",
  },

  // A Chords
  A: {
    notes: ["A", "C#", "E"],
    treble: ["A4", "C#5", "E5"],
    bass: ["A2", "C#3", "E3"],
    displayName: "A Major",
  },
  Amaj7: {
    notes: ["A", "C#", "E", "G#"],
    treble: ["A4", "C#5", "E5", "G#5"],
    bass: ["A2", "C#3", "E3", "G#3"],
    displayName: "A Major 7th",
  },
  Amaj6: {
    notes: ["A", "C#", "E", "F#"],
    treble: ["A4", "C#5", "E5", "F#5"],
    bass: ["A2", "C#3", "E3", "F#3"],
    displayName: "A Major 6th",
  },
  Amaj9: {
    notes: ["A", "C#", "E", "G#", "B"],
    treble: ["A4", "C#5", "E5", "G#5", "B5"],
    bass: ["A2", "C#3", "E3", "G#3", "B3"],
    displayName: "A Major 9th",
  },
  Am: {
    notes: ["A", "C", "E"],
    treble: ["A4", "C5", "E5"],
    bass: ["A2", "C3", "E3"],
    displayName: "A Minor",
  },
  Amin7: {
    notes: ["A", "C", "E", "G"],
    treble: ["A4", "C5", "E5", "G5"],
    bass: ["A2", "C3", "E3", "G3"],
    displayName: "A Minor 7th",
  },
  Amin6: {
    notes: ["A", "C", "E", "F#"],
    treble: ["A4", "C5", "E5", "F#5"],
    bass: ["A2", "C3", "E3", "F#3"],
    displayName: "A Minor 6th",
  },
  Amin9: {
    notes: ["A", "C", "E", "G", "B"],
    treble: ["A4", "C5", "E5", "G5", "B5"],
    bass: ["A2", "C3", "E3", "G3", "B3"],
    displayName: "A Minor 9th",
  },
  Adim: {
    notes: ["A", "C", "Eb"],
    treble: ["A4", "C5", "Eb5"],
    bass: ["A3", "C4", "Eb4"],
    displayName: "A Diminished",
  },
  Adim7: {
    notes: ["A", "C", "Eb", "Gb"],
    treble: ["A4", "C5", "Eb5", "Gb5"],
    bass: ["A3", "C4", "Eb4", "Gb4"],
    displayName: "A Diminished 7th",
  },
  Am7b5: {
    notes: ["A", "C", "Eb", "G"],
    treble: ["A4", "C5", "Eb5", "G5"],
    bass: ["A3", "C4", "Eb4", "G4"],
    displayName: "A Half-Diminished 7th",
  },
  Aaug: {
    notes: ["A", "C#", "E#"],
    treble: ["A4", "C#5", "E#5"],
    bass: ["A2", "C#3", "E#3"],
    displayName: "A Augmented",
  },
  Aaug7: {
    notes: ["A", "C#", "E#", "G"],
    treble: ["A4", "C#5", "E#5", "G5"],
    bass: ["A2", "C#3", "E#3", "G3"],
    displayName: "A Augmented 7th",
  },
  A7: {
    notes: ["A", "C#", "E", "G"],
    treble: ["A4", "C#5", "E5", "G5"],
    bass: ["A2", "C#3", "E3", "G3"],
    displayName: "A Dominant 7th",
  },
  A9: {
    notes: ["A", "C#", "E", "G", "B"],
    treble: ["A4", "C#5", "E5", "G5", "B5"],
    bass: ["A2", "C#3", "E3", "G3", "B3"],
    displayName: "A Dominant 9th",
  },
  Asus4: {
    notes: ["A", "D", "E"],
    treble: ["A4", "D5", "E5"],
    bass: ["A2", "D3", "E3"],
    displayName: "A Suspended 4th",
  },
  Asus2: {
    notes: ["A", "B", "E"],
    treble: ["A4", "B4", "E5"],
    bass: ["A2", "B2", "E3"],
    displayName: "A Suspended 2nd",
  },

  // A# Chords
  "A#": {
    notes: ["A#", "C##", "E#"],
    treble: ["A#4", "C##5", "E#5"],
    bass: ["A#2", "C##3", "E#3"],
    displayName: "A# Major",
  },
  "A#maj7": {
    notes: ["A#", "C##", "E#", "G##"],
    treble: ["A#4", "C##5", "E#5", "G##5"],
    bass: ["A#2", "C##3", "E#3", "G##3"],
    displayName: "A# Major 7th",
  },
  "A#maj6": {
    notes: ["A#", "C##", "E#", "F##"],
    treble: ["A#4", "C##5", "E#5", "F##5"],
    bass: ["A#2", "C##3", "E#3", "F##3"],
    displayName: "A# Major 6th",
  },
  "A#maj9": {
    notes: ["A#", "C##", "E#", "G##", "B#"],
    treble: ["A#4", "C##5", "E#5", "G##5", "B#5"],
    bass: ["A#2", "C##3", "E#3", "G##3", "B#3"],
    displayName: "A# Major 9th",
  },
  "A#m": {
    notes: ["A#", "C#", "E#"],
    treble: ["A#4", "C#5", "E#5"],
    bass: ["A#2", "C#3", "E#3"],
    displayName: "A# Minor",
  },
  "A#min7": {
    notes: ["A#", "C#", "E#", "G#"],
    treble: ["A#4", "C#5", "E#5", "G#5"],
    bass: ["A#2", "C#3", "E#3", "G#3"],
    displayName: "A# Minor 7th",
  },
  "A#min6": {
    notes: ["A#", "C#", "E#", "F##"],
    treble: ["A#4", "C#5", "E#5", "F##5"],
    bass: ["A#2", "C#3", "E#3", "F##3"],
    displayName: "A# Minor 6th",
  },
  "A#min9": {
    notes: ["A#", "C#", "E#", "G#", "B#"],
    treble: ["A#4", "C#5", "E#5", "G#5", "B#5"],
    bass: ["A#2", "C#3", "E#3", "G#3", "B#3"],
    displayName: "A# Minor 9th",
  },
  "A#dim": {
    notes: ["A#", "C#", "E"],
    treble: ["A#4", "C#5", "E5"],
    bass: ["A#3", "C#4", "E4"],
    displayName: "A# Diminished",
  },
  "A#dim7": {
    notes: ["A#", "C#", "E", "G"],
    treble: ["A#4", "C#5", "E5", "G5"],
    bass: ["A#3", "C#4", "E4", "G4"],
    displayName: "A# Diminished 7th",
  },
  "A#m7b5": {
    notes: ["A#", "C#", "E", "G#"],
    treble: ["A#4", "C#5", "E5", "G#5"],
    bass: ["A#3", "C#4", "E4", "G#4"],
    displayName: "A# Half-Diminished 7th",
  },
  "A#aug": {
    notes: ["A#", "C##", "E##"],
    treble: ["A#4", "C##5", "E##5"],
    bass: ["A#2", "C##3", "E##3"],
    displayName: "A# Augmented",
  },
  "A#aug7": {
    notes: ["A#", "C##", "E##", "G#"],
    treble: ["A#4", "C##5", "E##5", "G#5"],
    bass: ["A#2", "C##3", "E##3", "G#3"],
    displayName: "A# Augmented 7th",
  },
  "A#7": {
    notes: ["A#", "C##", "E#", "G#"],
    treble: ["A#4", "C##5", "E#5", "G#5"],
    bass: ["A#2", "C##3", "E#3", "G#3"],
    displayName: "A# Dominant 7th",
  },
  "A#9": {
    notes: ["A#", "C##", "E#", "G#", "B#"],
    treble: ["A#4", "C##5", "E#5", "G#5", "B#5"],
    bass: ["A#2", "C##3", "E#3", "G#3", "B#3"],
    displayName: "A# Dominant 9th",
  },
  "A#sus4": {
    notes: ["A#", "D#", "E#"],
    treble: ["A#4", "D#5", "E#5"],
    bass: ["A#2", "D#3", "E#3"],
    displayName: "A# Suspended 4th",
  },
  "A#sus2": {
    notes: ["A#", "B#", "E#"],
    treble: ["A#4", "B#4", "E#5"],
    bass: ["A#2", "B#2", "E#3"],
    displayName: "A# Suspended 2nd",
  },

  // Bb Chords
  Bb: {
    notes: ["Bb", "D", "F"],
    treble: ["Bb4", "D5", "F5"],
    bass: ["Bb2", "D3", "F3"],
    displayName: "Bb Major",
  },
  Bbmaj7: {
    notes: ["Bb", "D", "F", "A"],
    treble: ["Bb4", "D5", "F5", "A5"],
    bass: ["Bb2", "D3", "F3", "A3"],
    displayName: "Bb Major 7th",
  },
  Bbmaj6: {
    notes: ["Bb", "D", "F", "G"],
    treble: ["Bb4", "D5", "F5", "G5"],
    bass: ["Bb2", "D3", "F3", "G3"],
    displayName: "Bb Major 6th",
  },
  Bbmaj9: {
    notes: ["Bb", "D", "F", "A", "C"],
    treble: ["Bb4", "D5", "F5", "A5", "C6"],
    bass: ["Bb2", "D3", "F3", "A3", "C4"],
    displayName: "Bb Major 9th",
  },
  Bbm: {
    notes: ["Bb", "Db", "F"],
    treble: ["Bb4", "Db5", "F5"],
    bass: ["Bb2", "Db3", "F3"],
    displayName: "Bb Minor",
  },
  Bbmin7: {
    notes: ["Bb", "Db", "F", "Ab"],
    treble: ["Bb4", "Db5", "F5", "Ab5"],
    bass: ["Bb2", "Db3", "F3", "Ab3"],
    displayName: "Bb Minor 7th",
  },
  Bbmin6: {
    notes: ["Bb", "Db", "F", "G"],
    treble: ["Bb4", "Db5", "F5", "G5"],
    bass: ["Bb2", "Db3", "F3", "G3"],
    displayName: "Bb Minor 6th",
  },
  Bbmin9: {
    notes: ["Bb", "Db", "F", "Ab", "C"],
    treble: ["Bb4", "Db5", "F5", "Ab5", "C6"],
    bass: ["Bb2", "Db3", "F3", "Ab3", "C4"],
    displayName: "Bb Minor 9th",
  },
  Bbdim: {
    notes: ["Bb", "Db", "Fb"],
    treble: ["Bb4", "Db5", "Fb5"],
    bass: ["Bb3", "Db4", "Fb4"],
    displayName: "Bb Diminished",
  },
  Bbdim7: {
    notes: ["Bb", "Db", "Fb", "Abb"],
    treble: ["Bb4", "Db5", "Fb5", "Abb5"],
    bass: ["Bb3", "Db4", "Fb4", "Abb4"],
    displayName: "Bb Diminished 7th",
  },
  Bbm7b5: {
    notes: ["Bb", "Db", "Fb", "Ab"],
    treble: ["Bb4", "Db5", "Fb5", "Ab5"],
    bass: ["Bb3", "Db4", "Fb4", "Ab4"],
    displayName: "Bb Half-Diminished 7th",
  },
  Bbaug: {
    notes: ["Bb", "D", "F#"],
    treble: ["Bb4", "D5", "F#5"],
    bass: ["Bb2", "D3", "F#3"],
    displayName: "Bb Augmented",
  },
  Bbaug7: {
    notes: ["Bb", "D", "F#", "Ab"],
    treble: ["Bb4", "D5", "F#5", "Ab5"],
    bass: ["Bb2", "D3", "F#3", "Ab3"],
    displayName: "Bb Augmented 7th",
  },
  Bb7: {
    notes: ["Bb", "D", "F", "Ab"],
    treble: ["Bb4", "D5", "F5", "Ab5"],
    bass: ["Bb2", "D3", "F3", "Ab3"],
    displayName: "Bb Dominant 7th",
  },
  Bb9: {
    notes: ["Bb", "D", "F", "Ab", "C"],
    treble: ["Bb4", "D5", "F5", "Ab5", "C6"],
    bass: ["Bb2", "D3", "F3", "Ab3", "C4"],
    displayName: "Bb Dominant 9th",
  },
  Bbsus4: {
    notes: ["Bb", "Eb", "F"],
    treble: ["Bb4", "Eb5", "F5"],
    bass: ["Bb2", "Eb3", "F3"],
    displayName: "Bb Suspended 4th",
  },
  Bbsus2: {
    notes: ["Bb", "C", "F"],
    treble: ["Bb4", "C5", "F5"],
    bass: ["Bb2", "C3", "F3"],
    displayName: "Bb Suspended 2nd",
  },

  // B Chords
  B: {
    notes: ["B", "D#", "F#"],
    treble: ["B4", "D#5", "F#5"],
    bass: ["B2", "D#3", "F#3"],
    displayName: "B Major",
  },
"Cb": {
  notes: ["Cb", "Eb", "Gb"],
  treble: ["Cb5", "Eb5", "Gb5"],
  bass: ["Cb3", "Eb3", "Gb3"],
  displayName: "Cb Major",
},
  Bmaj7: {
    notes: ["B", "D#", "F#", "A#"],
    treble: ["B4", "D#5", "F#5", "A#5"],
    bass: ["B2", "D#3", "F#3", "A#3"],
    displayName: "B Major 7th",
  },
  Bmaj6: {
    notes: ["B", "D#", "F#", "G#"],
    treble: ["B4", "D#5", "F#5", "G#5"],
    bass: ["B2", "D#3", "F#3", "G#3"],
    displayName: "B Major 6th",
  },
  Bmaj9: {
    notes: ["B", "D#", "F#", "A#", "C#"],
    treble: ["B4", "D#5", "F#5", "A#5", "C#6"],
    bass: ["B2", "D#3", "F#3", "A#3", "C#4"],
    displayName: "B Major 9th",
  },
  Bm: {
    notes: ["B", "D", "F#"],
    treble: ["B4", "D5", "F#5"],
    bass: ["B2", "D3", "F#3"],
    displayName: "B Minor",
  },
  Bmin7: {
    notes: ["B", "D", "F#", "A"],
    treble: ["B4", "D5", "F#5", "A5"],
    bass: ["B2", "D3", "F#3", "A3"],
    displayName: "B Minor 7th",
  },
  Bmin6: {
    notes: ["B", "D", "F#", "G#"],
    treble: ["B4", "D5", "F#5", "G#5"],
    bass: ["B2", "D3", "F#3", "G#3"],
    displayName: "B Minor 6th",
  },
  Bmin9: {
    notes: ["B", "D", "F#", "A", "C#"],
    treble: ["B4", "D5", "F#5", "A5", "C#6"],
    bass: ["B2", "D3", "F#3", "A3", "C#4"],
    displayName: "B Minor 9th",
  },
  Bdim: {
    notes: ["B", "D", "F"],
    treble: ["B4", "D5", "F5"],
    bass: ["B3", "D4", "F4"],
    displayName: "B Diminished",
  },
  Bdim7: {
    notes: ["B", "D", "F", "Ab"],
    treble: ["B4", "D5", "F5", "Ab5"],
    bass: ["B3", "D4", "F4", "Ab4"],
    displayName: "B Diminished 7th",
  },
  Bm7b5: {
    notes: ["B", "D", "F", "A"],
    treble: ["B4", "D5", "F5", "A5"],
    bass: ["B3", "D4", "F4", "A4"],
    displayName: "B Half-Diminished 7th",
  },
  Baug: {
    notes: ["B", "D#", "F##"],
    treble: ["B4", "D#5", "F##5"],
    bass: ["B2", "D#3", "F##3"],
    displayName: "B Augmented",
  },
  Baug7: {
    notes: ["B", "D#", "F##", "A"],
    treble: ["B4", "D#5", "F##5", "A5"],
    bass: ["B2", "D#3", "F##3", "A3"],
    displayName: "B Augmented 7th",
  },
  B7: {
    notes: ["B", "D#", "F#", "A"],
    treble: ["B4", "D#5", "F#5", "A5"],
    bass: ["B2", "D#3", "F#3", "A3"],
    displayName: "B Dominant 7th",
  },
  B9: {
    notes: ["B", "D#", "F#", "A", "C#"],
    treble: ["B4", "D#5", "F#5", "A5", "C#6"],
    bass: ["B2", "D#3", "F#3", "A3", "C#4"],
    displayName: "B Dominant 9th",
  },
  Bsus4: {
    notes: ["B", "E", "F#"],
    treble: ["B4", "E5", "F#5"],
    bass: ["B2", "E3", "F#3"],
    displayName: "B Suspended 4th",
  },
  Bsus2: {
    notes: ["B", "C#", "F#"],
    treble: ["B4", "C#5", "F#5"],
    bass: ["B2", "C#3", "F#3"],
    displayName: "B Suspended 2nd",
  },

  "C/E": {
    notes: ["E", "G", "C"],
    treble: ["E4", "G4", "C5"],
    bass: ["E3", "G3", "C4"],
    displayName: "C Major (1st Inversion)",
  },
  "Db/F": {
    notes: ["F", "Ab", "Db"],
    treble: ["F4", "Ab4", "Db5"],
    bass: ["F2", "Ab2", "Db3"],
    displayName: "Db Major (1st Inversion)",
  },
  "D/F#": {
    notes: ["F#", "A", "D"],
    treble: ["F#4", "A4", "D5"],
    bass: ["F#2", "A2", "D3"],
    displayName: "D Major (1st Inversion)",
  },
  "Eb/G": {
    notes: ["G", "Bb", "Eb"],
    treble: ["G4", "Bb4", "Eb5"],
    bass: ["G2", "Bb2", "Eb3"],
    displayName: "Eb Major (1st Inversion)",
  },
  "E/G#": {
    notes: ["G#", "B", "E"],
    treble: ["G#4", "B4", "E5"],
    bass: ["G#2", "B2", "E3"],
    displayName: "E Major (1st Inversion)",
  },
  "F/A": {
    notes: ["A", "C", "F"],
    treble: ["A4", "C5", "F5"],
    bass: ["A2", "C3", "F3"],
    displayName: "F Major (1st Inversion)",
  },
  "F#/A#": {
    notes: ["A#", "C#", "F#"],
    treble: ["A#4", "C#5", "F#5"],
    bass: ["A#2", "C#3", "F#3"],
    displayName: "F# Major (1st Inversion)",
  },
  "Gb/Bb": {
    notes: ["Bb", "Db", "Gb"],
    treble: ["Bb4", "Db5", "Gb5"],
    bass: ["Bb2", "Db3", "Gb3"],
    displayName: "Gb Major (1st Inversion)",
  },
  "G/B": {
    notes: ["B", "D", "G"],
    treble: ["B4", "D5", "G5"],
    bass: ["B2", "D3", "G3"],
    displayName: "G Major (1st Inversion)",
  },
  "Ab/C": {
    notes: ["C", "Eb", "Ab"],
    treble: ["C5", "Eb5", "Ab5"],
    bass: ["C3", "Eb3", "Ab3"],
    displayName: "Ab Major (1st Inversion)",
  },
  "A/C#": {
    notes: ["C#", "E", "A"],
    treble: ["C#5", "E5", "A5"],
    bass: ["C#3", "E3", "A3"],
    displayName: "A Major (1st Inversion)",
  },
  "Bb/D": {
    notes: ["D", "F", "Bb"],
    treble: ["D5", "F5", "Bb5"],
    bass: ["D3", "F3", "Bb3"],
    displayName: "Bb Major (1st Inversion)",
  },
  "B/D#": {
    notes: ["D#", "F#", "B"],
    treble: ["D#5", "F#5", "B5"],
    bass: ["D#3", "F#3", "B3"],
    displayName: "B Major (1st Inversion)",
  },
  "C#/E#": {
    notes: ["E#", "G#", "C#"],
    treble: ["E#4", "G#4", "C#5"],
    bass: ["E#3", "G#3", "C#4"],
    displayName: "C# Major (1st Inversion)",
  },
  "D#/F##": {
    notes: ["F##", "A#", "D#"],
    treble: ["F##4", "A#4", "D#5"],
    bass: ["F##2", "A#2", "D#3"],
    displayName: "D# Major (1st Inversion)",
  },
  "G#/B#": {
    notes: ["B#", "D#", "G#"],
    treble: ["B#4", "D#5", "G#5"],
    bass: ["B#2", "D#3", "G#3"],
    displayName: "G# Major (1st Inversion)",
  },
  "A#/C##": {
    notes: ["C##", "E#", "A#"],
    treble: ["C##5", "E#5", "A#5"],
    bass: ["C##3", "E#3", "A#3"],
    displayName: "A# Major (1st Inversion)",
  },

  // --- Major Triad: 2nd Inversion ---
  "C/G": {
    notes: ["G", "C", "E"],
    treble: ["G4", "C5", "E5"],
    bass: ["G2", "C3", "E3"],
    displayName: "C Major (2nd Inversion)",
  },
  "Db/Ab": {
    notes: ["Ab", "Db", "F"],
    treble: ["Ab4", "Db5", "F5"],
    bass: ["Ab2", "Db3", "F3"],
    displayName: "Db Major (2nd Inversion)",
  },
  "D/A": {
    notes: ["A", "D", "F#"],
    treble: ["A4", "D5", "F#5"],
    bass: ["A2", "D3", "F#3"],
    displayName: "D Major (2nd Inversion)",
  },
  "Eb/Bb": {
    notes: ["Bb", "Eb", "G"],
    treble: ["Bb4", "Eb5", "G5"],
    bass: ["Bb2", "Eb3", "G3"],
    displayName: "Eb Major (2nd Inversion)",
  },
  "E/B": {
    notes: ["B", "E", "G#"],
    treble: ["B4", "E5", "G#5"],
    bass: ["B2", "E3", "G#3"],
    displayName: "E Major (2nd Inversion)",
  },
  "F/C": {
    notes: ["C", "F", "A"],
    treble: ["C5", "F5", "A5"],
    bass: ["C3", "F3", "A3"],
    displayName: "F Major (2nd Inversion)",
  },
  "F#/C#": {
    notes: ["C#", "F#", "A#"],
    treble: ["C#5", "F#5", "A#5"],
    bass: ["C#3", "F#3", "A#3"],
    displayName: "F# Major (2nd Inversion)",
  },
  "Gb/Db": {
    notes: ["Db", "Gb", "Bb"],
    treble: ["Db5", "Gb5", "Bb5"],
    bass: ["Db3", "Gb3", "Bb3"],
    displayName: "Gb Major (2nd Inversion)",
  },
  "G/D": {
    notes: ["D", "G", "B"],
    treble: ["D5", "G5", "B5"],
    bass: ["D3", "G3", "B3"],
    displayName: "G Major (2nd Inversion)",
  },
  "Ab/Eb": {
    notes: ["Eb", "Ab", "C"],
    treble: ["Eb4", "Ab4", "C5"],
    bass: ["Eb3", "Ab3", "C4"],
    displayName: "Ab Major (2nd Inversion)",
  },
  "A/E": {
    notes: ["E", "A", "C#"],
    treble: ["E4", "A4", "C#5"],
    bass: ["E3", "A3", "C#4"],
    displayName: "A Major (2nd Inversion)",
  },
  "Bb/F": {
    notes: ["F", "Bb", "D"],
    treble: ["F4", "Bb4", "D5"],
    bass: ["F2", "Bb2", "D3"],
    displayName: "Bb Major (2nd Inversion)",
  },
  "B/F#": {
    notes: ["F#", "B", "D#"],
    treble: ["F#4", "B4", "D#5"],
    bass: ["F#2", "B2", "D#3"],
    displayName: "B Major (2nd Inversion)",
  },
  "C#/G#": {
    notes: ["G#", "C#", "E#"],
    treble: ["G#4", "C#5", "E#5"],
    bass: ["G#2", "C#3", "E#3"],
    displayName: "C# Major (2nd Inversion)",
  },
  "D#/A#": {
    notes: ["A#", "D#", "F##"],
    treble: ["A#4", "D#5", "F##5"],
    bass: ["A#2", "D#3", "F##3"],
    displayName: "D# Major (2nd Inversion)",
  },
  "G#/D#": {
    notes: ["D#", "G#", "B#"],
    treble: ["D#5", "G#5", "B#5"],
    bass: ["D#3", "G#3", "B#3"],
    displayName: "G# Major (2nd Inversion)",
  },
  "A#/E#": {
    notes: ["E#", "A#", "C##"],
    treble: ["E#5", "A#5", "C##6"],
    bass: ["E#3", "A#3", "C##4"],
    displayName: "A# Major (2nd Inversion)",
  },

  // --- Minor Triad: 1st Inversion ---
  "Cm/Eb": {
    notes: ["Eb", "G", "C"],
    treble: ["Eb4", "G4", "C5"],
    bass: ["Eb3", "G3", "C4"],
    displayName: "C Minor (1st Inversion)",
  },
  "C#m/E": {
    notes: ["E", "G#", "C#"],
    treble: ["E4", "G#4", "C#5"],
    bass: ["E3", "G#3", "C#4"],
    displayName: "C# Minor (1st Inversion)",
  },
  "Dm/F": {
    notes: ["F", "A", "D"],
    treble: ["F4", "A4", "D5"],
    bass: ["F2", "A2", "D3"],
    displayName: "D Minor (1st Inversion)",
  },
  "D#m/F#": {
    notes: ["F#", "A#", "D#"],
    treble: ["F#4", "A#4", "D#5"],
    bass: ["F#2", "A#2", "D#3"],
    displayName: "D# Minor (1st Inversion)",
  },
  "Ebm/Gb": {
    notes: ["Gb", "Bb", "Eb"],
    treble: ["Gb4", "Bb4", "Eb5"],
    bass: ["Gb2", "Bb2", "Eb3"],
    displayName: "Eb Minor (1st Inversion)",
  },
  "Em/G": {
    notes: ["G", "B", "E"],
    treble: ["G4", "B4", "E5"],
    bass: ["G2", "B2", "E3"],
    displayName: "E Minor (1st Inversion)",
  },
  "Fm/Ab": {
    notes: ["Ab", "C", "F"],
    treble: ["Ab4", "C5", "F5"],
    bass: ["Ab2", "C3", "F3"],
    displayName: "F Minor (1st Inversion)",
  },
  "F#m/A": {
    notes: ["A", "C#", "F#"],
    treble: ["A4", "C#5", "F#5"],
    bass: ["A2", "C#3", "F#3"],
    displayName: "F# Minor (1st Inversion)",
  },
  "Gm/Bb": {
    notes: ["Bb", "D", "G"],
    treble: ["Bb4", "D5", "G5"],
    bass: ["Bb2", "D3", "G3"],
    displayName: "G Minor (1st Inversion)",
  },
  "G#m/B": {
    notes: ["B", "D#", "G#"],
    treble: ["B4", "D#5", "G#5"],
    bass: ["B2", "D#3", "G#3"],
    displayName: "G# Minor (1st Inversion)",
  },
  "Am/C": {
    notes: ["C", "E", "A"],
    treble: ["C5", "E5", "A5"],
    bass: ["C3", "E3", "A3"],
    displayName: "A Minor (1st Inversion)",
  },
  "A#m/C#": {
    notes: ["C#", "E#", "A#"],
    treble: ["C#5", "E#5", "A#5"],
    bass: ["C#3", "E#3", "A#3"],
    displayName: "A# Minor (1st Inversion)",
  },
  "Bbm/Db": {
    notes: ["Db", "F", "Bb"],
    treble: ["Db5", "F5", "Bb5"],
    bass: ["Db3", "F3", "Bb3"],
    displayName: "Bb Minor (1st Inversion)",
  },
  "Bm/D": {
    notes: ["D", "F#", "B"],
    treble: ["D5", "F#5", "B5"],
    bass: ["D3", "F#3", "B3"],
    displayName: "B Minor (1st Inversion)",
  },
  "Dbm/Fb": {
    notes: ["Fb", "Ab", "Db"],
    treble: ["Fb4", "Ab4", "Db5"],
    bass: ["Fb2", "Ab2", "Db3"],
    displayName: "Db Minor (1st Inversion)",
  },
  "Gbm/Bbb": {
    notes: ["Bbb", "Db", "Gb"],
    treble: ["Bbb4", "Db5", "Gb5"],
    bass: ["Bbb2", "Db3", "Gb3"],
    displayName: "Gb Minor (1st Inversion)",
  },
  "Abm/Cb": {
    notes: ["Cb", "Eb", "Ab"],
    treble: ["Cb5", "Eb5", "Ab5"],
    bass: ["Cb3", "Eb3", "Ab3"],
    displayName: "Ab Minor (1st Inversion)",
  },

  // --- Minor Triad: 2nd Inversion ---
  "Cm/G": {
    notes: ["G", "C", "Eb"],
    treble: ["G4", "C5", "Eb5"],
    bass: ["G2", "C3", "Eb3"],
    displayName: "C Minor (2nd Inversion)",
  },
  "C#m/G#": {
    notes: ["G#", "C#", "E"],
    treble: ["G#4", "C#5", "E5"],
    bass: ["G#2", "C#3", "E3"],
    displayName: "C# Minor (2nd Inversion)",
  },
  "Dm/A": {
    notes: ["A", "D", "F"],
    treble: ["A4", "D5", "F5"],
    bass: ["A2", "D3", "F3"],
    displayName: "D Minor (2nd Inversion)",
  },
  "D#m/A#": {
    notes: ["A#", "D#", "F#"],
    treble: ["A#4", "D#5", "F#5"],
    bass: ["A#2", "D#3", "F#3"],
    displayName: "D# Minor (2nd Inversion)",
  },
  "Ebm/Bb": {
    notes: ["Bb", "Eb", "Gb"],
    treble: ["Bb4", "Eb5", "Gb5"],
    bass: ["Bb2", "Eb3", "Gb3"],
    displayName: "Eb Minor (2nd Inversion)",
  },
  "Em/B": {
    notes: ["B", "E", "G"],
    treble: ["B4", "E5", "G5"],
    bass: ["B2", "E3", "G3"],
    displayName: "E Minor (2nd Inversion)",
  },
  "Fm/C": {
    notes: ["C", "F", "Ab"],
    treble: ["C5", "F5", "Ab5"],
    bass: ["C3", "F3", "Ab3"],
    displayName: "F Minor (2nd Inversion)",
  },
  "F#m/C#": {
    notes: ["C#", "F#", "A"],
    treble: ["C#5", "F#5", "A5"],
    bass: ["C#3", "F#3", "A3"],
    displayName: "F# Minor (2nd Inversion)",
  },
  "Gm/D": {
    notes: ["D", "G", "Bb"],
    treble: ["D5", "G5", "Bb5"],
    bass: ["D3", "G3", "Bb3"],
    displayName: "G Minor (2nd Inversion)",
  },
  "G#m/D#": {
    notes: ["D#", "G#", "B"],
    treble: ["D#5", "G#5", "B5"],
    bass: ["D#3", "G#3", "B3"],
    displayName: "G# Minor (2nd Inversion)",
  },
  "Am/E": {
    notes: ["E", "A", "C"],
    treble: ["E4", "A4", "C5"],
    bass: ["E3", "A3", "C4"],
    displayName: "A Minor (2nd Inversion)",
  },
  "A#m/E#": {
    notes: ["E#", "A#", "C#"],
    treble: ["E#5", "A#5", "C#6"],
    bass: ["E#3", "A#3", "C#4"],
    displayName: "A# Minor (2nd Inversion)",
  },
  "Bbm/F": {
    notes: ["F", "Bb", "Db"],
    treble: ["F4", "Bb4", "Db5"],
    bass: ["F2", "Bb2", "Db3"],
    displayName: "Bb Minor (2nd Inversion)",
  },
  "Bm/F#": {
    notes: ["F#", "B", "D"],
    treble: ["F#4", "B4", "D5"],
    bass: ["F#2", "B2", "D3"],
    displayName: "B Minor (2nd Inversion)",
  },
  "Dbm/Ab": {
    notes: ["Ab", "Db", "Fb"],
    treble: ["Ab4", "Db5", "Fb5"],
    bass: ["Ab2", "Db3", "Fb3"],
    displayName: "Db Minor (2nd Inversion)",
  },
  "Gbm/Db": {
    notes: ["Db", "Gb", "Bbb"],
    treble: ["Db5", "Gb5", "Bbb5"],
    bass: ["Db3", "Gb3", "Bbb3"],
    displayName: "Gb Minor (2nd Inversion)",
  },
  "Abm/Eb": {
    notes: ["Eb", "Ab", "Cb"],
    treble: ["Eb5", "Ab5", "Cb6"],
    bass: ["Eb3", "Ab3", "Cb4"],
    displayName: "Ab Minor (2nd Inversion)",
  },

  "C7/E": {
    notes: ["E", "Bb", "C"],
    treble: ["E4", "Bb4", "C5"],
    bass: ["E3", "Bb3", "C4"],
    displayName: "C Dominant 7th (1st Inv, no 5)",
  },
  "C#7/E#": {
    notes: ["E#", "B", "C#"],
    treble: ["E#4", "B4", "C#5"],
    bass: ["E#3", "B3", "C#4"],
    displayName: "C# Dominant 7th (1st Inv, no 5)",
  },
  "Db7/F": {
    notes: ["F", "Cb", "Db"],
    treble: ["F4", "Cb5", "Db5"],
    bass: ["F2", "Cb3", "Db3"],
    displayName: "Db Dominant 7th (1st Inv, no 5)",
  },
  "D7/F#": {
    notes: ["F#", "C", "D"],
    treble: ["F#4", "C5", "D5"],
    bass: ["F#2", "C3", "D3"],
    displayName: "D Dominant 7th (1st Inv, no 5)",
  },
  "D#7/F##": {
    notes: ["F##", "C#", "D#"],
    treble: ["F##4", "C#5", "D#5"],
    bass: ["F##2", "C#3", "D#3"],
    displayName: "D# Dominant 7th (1st Inv, no 5)",
  },
  "Eb7/G": {
    notes: ["G", "Db", "Eb"],
    treble: ["G4", "Db5", "Eb5"],
    bass: ["G2", "Db3", "Eb3"],
    displayName: "Eb Dominant 7th (1st Inv, no 5)",
  },
  "E7/G#": {
    notes: ["G#", "D", "E"],
    treble: ["G#4", "D5", "E5"],
    bass: ["G#2", "D3", "E3"],
    displayName: "E Dominant 7th (1st Inv, no 5)",
  },
  "F7/A": {
    notes: ["A", "Eb", "F"],
    treble: ["A4", "Eb5", "F5"],
    bass: ["A2", "Eb3", "F3"],
    displayName: "F Dominant 7th (1st Inv, no 5)",
  },
  "F#7/A#": {
    notes: ["A#", "E", "F#"],
    treble: ["A#4", "E5", "F#5"],
    bass: ["A#2", "E3", "F#3"],
    displayName: "F# Dominant 7th (1st Inv, no 5)",
  },
  "Gb7/Bb": {
    notes: ["Bb", "Fb", "Gb"],
    treble: ["Bb4", "Fb5", "Gb5"],
    bass: ["Bb2", "Fb3", "Gb3"],
    displayName: "Gb Dominant 7th (1st Inv, no 5)",
  },
  "G7/B": {
    notes: ["B", "F", "G"],
    treble: ["B4", "F5", "G5"],
    bass: ["B2", "F3", "G3"],
    displayName: "G Dominant 7th (1st Inv, no 5)",
  },
  "G#7/B#": {
    notes: ["B#", "F#", "G#"],
    treble: ["B#4", "F#5", "G#5"],
    bass: ["B#2", "F#3", "G#3"],
    displayName: "G# Dominant 7th (1st Inv, no 5)",
  },
  "Ab7/C": {
    notes: ["C", "Gb", "Ab"],
    treble: ["C5", "Gb5", "Ab5"],
    bass: ["C3", "Gb3", "Ab3"],
    displayName: "Ab Dominant 7th (1st Inv, no 5)",
  },
  "A7/C#": {
    notes: ["C#", "G", "A"],
    treble: ["C#5", "G5", "A5"],
    bass: ["C#3", "G3", "A3"],
    displayName: "A Dominant 7th (1st Inv, no 5)",
  },
  "A#7/C##": {
    notes: ["C##", "G#", "A#"],
    treble: ["C##5", "G#5", "A#5"],
    bass: ["C##3", "G#3", "A#3"],
    displayName: "A# Dominant 7th (1st Inv, no 5)",
  },
  "Bb7/D": {
    notes: ["D", "Ab", "Bb"],
    treble: ["D5", "Ab5", "Bb5"],
    bass: ["D3", "Ab3", "Bb3"],
    displayName: "Bb Dominant 7th (1st Inv, no 5)",
  },
  "B7/D#": {
    notes: ["D#", "A", "B"],
    treble: ["D#5", "A5", "B5"],
    bass: ["D#3", "A3", "B3"],
    displayName: "B Dominant 7th (1st Inv, no 5)",
  },
};

export const CHORD_GROUPS = [
  {
    label: "Major Triads",
    chords: [
      "C",
      "C#",
      "Db",
      "D",
      "D#",
      "Eb",
      "E",
      "F",
      "F#",
      "Gb",
      "G",
      "G#",
      "Ab",
      "A",
      "A#",
      "Bb",
      "B",
    ],
  },
  {
    label: "Minor Triads",
    chords: [
      "Cm",
      "C#m",
      "Dbm",
      "Dm",
      "D#m",
      "Ebm",
      "Em",
      "Fm",
      "F#m",
      "Gbm",
      "Gm",
      "G#m",
      "Abm",
      "Am",
      "A#m",
      "Bbm",
      "Bm",
    ],
  },
  {
    label: "Major 6th",
    chords: [
      "Cmaj6",
      "C#maj6",
      "Dbmaj6",
      "Dmaj6",
      "D#maj6",
      "Ebmaj6",
      "Emaj6",
      "Fmaj6",
      "F#maj6",
      "Gbmaj6",
      "Gmaj6",
      "G#maj6",
      "Abmaj6",
      "Amaj6",
      "A#maj6",
      "Bbmaj6",
      "Bmaj6",
    ],
  },
  {
    label: "Minor 6th",
    chords: [
      "Cmin6",
      "C#min6",
      "Dbmin6",
      "Dmin6",
      "D#min6",
      "Ebmin6",
      "Emin6",
      "Fmin6",
      "F#min6",
      "Gbmin6",
      "Gmin6",
      "G#min6",
      "Abmin6",
      "Amin6",
      "A#min6",
      "Bbmin6",
      "Bmin6",
    ],
  },
  {
    label: "Suspended 4th",
    chords: [
      "Csus4",
      "C#sus4",
      "Dbsus4",
      "Dsus4",
      "D#sus4",
      "Ebsus4",
      "Esus4",
      "Fsus4",
      "F#sus4",
      "Gbsus4",
      "Gsus4",
      "G#sus4",
      "Absus4",
      "Asus4",
      "A#sus4",
      "Bbsus4",
      "Bsus4",
    ],
  },
  {
    label: "Suspended 2nd",
    chords: [
      "Csus2",
      "C#sus2",
      "Dbsus2",
      "Dsus2",
      "D#sus2",
      "Ebsus2",
      "Esus2",
      "Fsus2",
      "F#sus2",
      "Gbsus2",
      "Gsus2",
      "G#sus2",
      "Absus2",
      "Asus2",
      "A#sus2",
      "Bbsus2",
      "Bsus2",
    ],
  },
  {
    label: "Major 7th",
    chords: [
      "Cmaj7",
      "C#maj7",
      "Dbmaj7",
      "Dmaj7",
      "D#maj7",
      "Ebmaj7",
      "Emaj7",
      "Fmaj7",
      "F#maj7",
      "Gbmaj7",
      "Gmaj7",
      "G#maj7",
      "Abmaj7",
      "Amaj7",
      "A#maj7",
      "Bbmaj7",
      "Bmaj7",
    ],
  },
  {
    label: "Minor 7th",
    chords: [
      "Cmin7",
      "C#min7",
      "Dbmin7",
      "Dmin7",
      "D#min7",
      "Ebmin7",
      "Emin7",
      "Fmin7",
      "F#min7",
      "Gbmin7",
      "Gmin7",
      "G#min7",
      "Abmin7",
      "Amin7",
      "A#min7",
      "Bbmin7",
      "Bmin7",
    ],
  },
  {
    label: "Dominant 7th",
    chords: [
      "C7",
      "C#7",
      "Db7",
      "D7",
      "D#7",
      "Eb7",
      "E7",
      "F7",
      "F#7",
      "Gb7",
      "G7",
      "G#7",
      "Ab7",
      "A7",
      "A#7",
      "Bb7",
      "B7",
    ],
  },
  {
    label: "Augmented Triads",
    chords: [
      "Caug",
      "C#aug",
      "Dbaug",
      "Daug",
      "D#aug",
      "Ebaug",
      "Eaug",
      "Faug",
      "F#aug",
      "Gbaug",
      "Gaug",
      "G#aug",
      "Abaug",
      "Aaug",
      "A#aug",
      "Bbaug",
      "Baug",
    ],
  },
  {
    label: "Diminished Triads",
    chords: [
      "Cdim",
      "C#dim",
      "Dbdim",
      "Ddim",
      "D#dim",
      "Ebdim",
      "Edim",
      "Fdim",
      "F#dim",
      "Gbdim",
      "Gdim",
      "G#dim",
      "Abdim",
      "Adim",
      "A#dim",
      "Bbdim",
      "Bdim",
    ],
  },
  {
    label: "Diminished 7th",
    chords: [
      "Cdim7",
      "C#dim7",
      "Dbdim7",
      "Ddim7",
      "D#dim7",
      "Ebdim7",
      "Edim7",
      "Fdim7",
      "F#dim7",
      "Gbdim7",
      "Gdim7",
      "G#dim7",
      "Abdim7",
      "Adim7",
      "A#dim7",
      "Bbdim7",
      "Bdim7",
    ],
  },
  {
    label: "Half-Diminished 7th",
    chords: [
      "Cm7b5",
      "C#m7b5",
      "Dbm7b5",
      "Dm7b5",
      "D#m7b5",
      "Ebm7b5",
      "Em7b5",
      "Fm7b5",
      "F#m7b5",
      "Gbm7b5",
      "Gm7b5",
      "G#m7b5",
      "Abm7b5",
      "Am7b5",
      "A#m7b5",
      "Bbm7b5",
      "Bm7b5",
    ],
  },
  {
    label: "Major 9th",
    chords: [
      "Cmaj9",
      "C#maj9",
      "Dbmaj9",
      "Dmaj9",
      "D#maj9",
      "Ebmaj9",
      "Emaj9",
      "Fmaj9",
      "F#maj9",
      "Gbmaj9",
      "Gmaj9",
      "G#maj9",
      "Abmaj9",
      "Amaj9",
      "A#maj9",
      "Bbmaj9",
      "Bmaj9",
    ],
  },
  {
    label: "Minor 9th",
    chords: [
      "Cmin9",
      "C#min9",
      "Dbmin9",
      "Dmin9",
      "D#min9",
      "Ebmin9",
      "Emin9",
      "Fmin9",
      "F#min9",
      "Gbmin9",
      "Gmin9",
      "G#min9",
      "Abmin9",
      "Amin9",
      "A#min9",
      "Bbmin9",
      "Bmin9",
    ],
  },
  {
    label: "Dominant 9th",
    chords: [
      "C9",
      "C#9",
      "Db9",
      "D9",
      "D#9",
      "Eb9",
      "E9",
      "F9",
      "F#9",
      "Gb9",
      "G9",
      "G#9",
      "Ab9",
      "A9",
      "A#9",
      "Bb9",
      "B9",
    ],
  },
  {
    label: "Augmented 7th",
    chords: [
      "Caug7",
      "C#aug7",
      "Dbaug7",
      "Daug7",
      "D#aug7",
      "Ebaug7",
      "Eaug7",
      "Faug7",
      "F#aug7",
      "Gbaug7",
      "Gaug7",
      "G#aug7",
      "Abaug7",
      "Aaug7",
      "A#aug7",
      "Bbaug7",
      "Baug7",
    ],
  },
  {
    label: "Dominant 7th (no 5) 1st Inversion",
    chords: [
      "C7/E",
      "C#7/E#",
      "Db7/F",
      "D7/F#",
      "D#7/F##",
      "Eb7/G",
      "E7/G#",
      "F7/A",
      "F#7/A#",
      "Gb7/Bb",
      "G7/B",
      "G#7/B#",
      "Ab7/C",
      "A7/C#",
      "A#7/C##",
      "Bb7/D",
      "B7/D#",
    ],
  },
  {
    label: "Major 1st Inversion",
    chords: [
      "C/E",
      "C#/E#",
      "Db/F",
      "D/F#",
      "D#/F##",
      "Eb/G",
      "E/G#",
      "F/A",
      "F#/A#",
      "Gb/Bb",
      "G/B",
      "G#/B#",
      "Ab/C",
      "A/C#",
      "A#/C##",
      "Bb/D",
      "B/D#",
    ],
  },
  {
    label: "Major 2nd Inversion",
    chords: [
      "C/G",
      "C#/G#",
      "Db/Ab",
      "D/A",
      "D#/A#",
      "Eb/Bb",
      "E/B",
      "F/C",
      "F#/C#",
      "Gb/Db",
      "G/D",
      "G#/D#",
      "Ab/Eb",
      "A/E",
      "A#/E#",
      "Bb/F",
      "B/F#",
    ],
  },
  {
    label: "Minor 1st Inversion",
    chords: [
      "Cm/Eb",
      "C#m/E",
      "Dbm/Fb",
      "Dm/F",
      "D#m/F#",
      "Ebm/Gb",
      "Em/G",
      "Fm/Ab",
      "F#m/A",
      "Gbm/Bbb",
      "Gm/Bb",
      "G#m/B",
      "Abm/Cb",
      "Am/C",
      "A#m/C#",
      "Bbm/Db",
      "Bm/D",
    ],
  },
  {
    label: "Minor 2nd Inversion",
    chords: [
      "Cm/G",
      "C#m/G#",
      "Dbm/Ab",
      "Dm/A",
      "D#m/A#",
      "Ebm/Bb",
      "Em/B",
      "Fm/C",
      "F#m/C#",
      "Gbm/Db",
      "Gm/D",
      "G#m/D#",
      "Abm/Eb",
      "Am/E",
      "A#m/E#",
      "Bbm/F",
      "Bm/F#",
    ],
  },
];

export const UNIFIED_CHORD_DEFINITIONS = {
  // === MAJOR TRIADS ===
  maj: {
    fullName: "Major Triad",
    displayName: "Major",
    suffix: "",
    intervals: [0, 4, 7],
    uiGroup: "Major Triads",
  },
  // === MINOR TRIADS ===
  min: {
    fullName: "Minor Triad",
    displayName: "Minor",
    suffix: "m",
    intervals: [0, 3, 7],
    uiGroup: "Minor Triads",
  },
  // === MAJOR 6TH ===
  maj6: {
    fullName: "Major 6th",
    displayName: "Major 6th",
    suffix: "maj6",
    intervals: [0, 4, 7, 9],
    uiGroup: "Major 6th",
  },
  // === MINOR 6TH ===
  min6: {
    fullName: "Minor 6th",
    displayName: "Minor 6th",
    suffix: "min6",
    intervals: [0, 3, 7, 9],
    uiGroup: "Minor 6th",
  },
  // === SUSPENDED 4TH ===
  sus4: {
    fullName: "Suspended 4th",
    displayName: "Suspended 4th",
    suffix: "sus4",
    intervals: [0, 5, 7],
    uiGroup: "Suspended 4th",
  },
  // === SUSPENDED 2ND ===
  sus2: {
    fullName: "Suspended 2nd",
    displayName: "Suspended 2nd",
    suffix: "sus2",
    intervals: [0, 2, 7],
    uiGroup: "Suspended 2nd",
  },
  // === MAJOR 7TH ===
  maj7: {
    fullName: "Major 7th",
    displayName: "Major 7th",
    suffix: "maj7",
    intervals: [0, 4, 7, 11],
    uiGroup: "Major 7th",
  },
  // === MINOR 7TH ===
  min7: {
    fullName: "Minor 7th",
    displayName: "Minor 7th",
    suffix: "min7",
    intervals: [0, 3, 7, 10],
    uiGroup: "Minor 7th",
  },
  // === DOMINANT 7TH ===
  dom7: {
    fullName: "Dominant 7th",
    displayName: "Dominant 7th",
    suffix: "7",
    intervals: [0, 4, 7, 10],
    uiGroup: "Dominant 7th",
  },
  dom7_no5_inv1: {
    fullName: "Dominant 7th (no 5) 1st Inversion",
    displayName: "Dominant 7th (1st Inv, no 5)",
    suffix: "7(no5)/3",
    intervals: [0, 6, 9],
    uiGroup: "Dominant 7th",
  },
  // === AUGMENTED TRIADS ===
  aug: {
    fullName: "Augmented Triad",
    displayName: "Augmented",
    suffix: "aug",
    intervals: [0, 4, 8],
    uiGroup: "Augmented Triads",
  },
  // === DIMINISHED TRIADS ===
  dim: {
    fullName: "Diminished Triad",
    displayName: "Diminished",
    suffix: "dim",
    intervals: [0, 3, 6],
    uiGroup: "Diminished Triads",
  },
  // === DIMINISHED 7TH ===
  dim7: {
    fullName: "Diminished 7th",
    displayName: "Diminished 7th",
    suffix: "dim7",
    intervals: [0, 3, 6, 9],
    uiGroup: "Diminished 7th",
  },
  // === HALF-DIMINISHED 7TH ===
  m7b5: {
    fullName: "Half-Diminished 7th",
    displayName: "Half-Diminished 7th",
    suffix: "m7b5",
    intervals: [0, 3, 6, 10],
    uiGroup: "Half-Diminished 7th",
  },
  // === MAJOR 9TH ===
  maj9: {
    fullName: "Major 9th",
    displayName: "Major 9th",
    suffix: "maj9",
    intervals: [0, 4, 7, 11, 14],
    uiGroup: "Major 9th",
  },
  // === MINOR 9TH ===
  min9: {
    fullName: "Minor 9th",
    displayName: "Minor 9th",
    suffix: "min9",
    intervals: [0, 3, 7, 10, 14],
    uiGroup: "Minor 9th",
  },
  // === DOMINANT 9TH ===
  dom9: {
    fullName: "Dominant 9th",
    displayName: "Dominant 9th",
    suffix: "9",
    intervals: [0, 4, 7, 10, 14],
    uiGroup: "Dominant 9th",
  },
  // === AUGMENTED 7TH ===
  aug7: {
    fullName: "Augmented 7th",
    displayName: "Augmented 7th",
    suffix: "aug7",
    intervals: [0, 4, 8, 10],
    uiGroup: "Augmented 7th",
  },
  // === MAJOR 1ST INVERSION ===
  maj_inv1: {
    fullName: "Major 1st Inversion",
    displayName: "Major (1st Inversion)",
    suffix: "/3",
    intervals: [0, 3, 8],
    uiGroup: "Major 1st Inversion",
  },
  // === MAJOR 2ND INVERSION ===
  maj_inv2: {
    fullName: "Major 2nd Inversion",
    displayName: "Major (2nd Inversion)",
    suffix: "/5",
    intervals: [0, 5, 9],
    uiGroup: "Major 2nd Inversion",
  },
  // === MINOR 1ST INVERSION ===
  min_inv1: {
    fullName: "Minor 1st Inversion",
    displayName: "Minor (1st Inversion)",
    suffix: "m/b3",
    intervals: [0, 4, 9],
    uiGroup: "Minor 1st Inversion",
  },
  // === MINOR 2ND INVERSION ===
  min_inv2: {
    fullName: "Minor 2nd Inversion",
    displayName: "Minor (2nd Inversion)",
    suffix: "m/5",
    intervals: [0, 5, 8],
    uiGroup: "Minor 2nd Inversion",
  },
};

export const DIATONIC_SCALES = {
  "C": {
    rootNote: "C",
    scaleNotes: ["C", "D", "E", "F", "G", "A", "B"],
    chordRoots: ["C", "D", "E", "F", "G", "A", "B"],
    labels: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
    qualities: ["maj", "min", "min", "maj", "dom7", "min", "dim"]
  },
  "G": {
    rootNote: "G",
    scaleNotes: ["G", "A", "B", "C", "D", "E", "F#"],
    chordRoots: ["G", "A", "B", "C", "D", "E", "F#"],
    labels: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
    qualities: ["maj", "min", "min", "maj", "dom7", "min", "dim"]
  },
  "D": {
    rootNote: "D",
    scaleNotes: ["D", "E", "F#", "G", "A", "B", "C#"],
    chordRoots: ["D", "E", "F#", "G", "A", "B", "C#"],
    labels: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
    qualities: ["maj", "min", "min", "maj", "dom7", "min", "dim"]
  },
  "A": {
    rootNote: "A",
    scaleNotes: ["A", "B", "C#", "D", "E", "F#", "G#"],
    chordRoots: ["A", "B", "C#", "D", "E", "F#", "G#"],
    labels: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
    qualities: ["maj", "min", "min", "maj", "dom7", "min", "dim"]
  },
  "E": {
    rootNote: "E",
    scaleNotes: ["E", "F#", "G#", "A", "B", "C#", "D#"],
    chordRoots: ["E", "F#", "G#", "A", "B", "C#", "D#"],
    labels: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
    qualities: ["maj", "min", "min", "maj", "dom7", "min", "dim"]
  },
  "B": {
    rootNote: "B",
    scaleNotes: ["B", "C#", "D#", "E", "F#", "G#", "A#"],
    chordRoots: ["B", "C#", "D#", "E", "F#", "G#", "A#"],
    labels: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
    qualities: ["maj", "min", "min", "maj", "dom7", "min", "dim"]
  },
  "F#": {
    rootNote: "F#",
    scaleNotes: ["F#", "G#", "A#", "B", "C#", "D#", "E#"],
    chordRoots: ["F#", "G#", "A#", "B", "C#", "D#", "E#"],
    labels: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
    qualities: ["maj", "min", "min", "maj", "dom7", "min", "dim"]
  },
  "Db": {
    rootNote: "Db",
    scaleNotes: ["Db", "Eb", "F", "Gb", "Ab", "Bb", "C"],
    chordRoots: ["Db", "Eb", "F", "Gb", "Ab", "Bb", "C"],
    labels: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
    qualities: ["maj", "min", "min", "maj", "dom7", "min", "dim"]
  },
  "Ab": {
    rootNote: "Ab",
    scaleNotes: ["Ab", "Bb", "C", "Db", "Eb", "F", "G"],
    chordRoots: ["Ab", "Bb", "C", "Db", "Eb", "F", "G"],
    labels: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
    qualities: ["maj", "min", "min", "maj", "dom7", "min", "dim"]
  },
  "Eb": {
    rootNote: "Eb",
    scaleNotes: ["Eb", "F", "G", "Ab", "Bb", "C", "D"],
    chordRoots: ["Eb", "F", "G", "Ab", "Bb", "C", "D"],
    labels: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
    qualities: ["maj", "min", "min", "maj", "dom7", "min", "dim"]
  },
  "Bb": {
    rootNote: "Bb",
    scaleNotes: ["Bb", "C", "D", "Eb", "F", "G", "A"],
    chordRoots: ["Bb", "C", "D", "Eb", "F", "G", "A"],
    labels: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
    qualities: ["maj", "min", "min", "maj", "dom7", "min", "dim"]
  },
  "F": {
    rootNote: "F",
    scaleNotes: ["F", "G", "A", "Bb", "C", "D", "E"],
    chordRoots: ["F", "G", "A", "Bb", "C", "D", "E"],
    labels: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
    qualities: ["maj", "min", "min", "maj", "dom7", "min", "dim"]
  },
  "Am": {
    rootNote: "A",
    scaleNotes: ["A", "B", "C", "D", "E", "F", "G"],
    chordRoots: ["A", "B", "C", "D", "E", "F", "G"],
    labels: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
    qualities: ["min", "dim", "maj", "min", "min", "maj", "maj"]
  },
  "Em": {
    rootNote: "E",
    scaleNotes: ["E", "F#", "G", "A", "B", "C", "D"],
    chordRoots: ["E", "F#", "G", "A", "B", "C", "D"],
    labels: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
    qualities: ["min", "dim", "maj", "min", "min", "maj", "maj"]
  },
  "Bm": {
    rootNote: "B",
    scaleNotes: ["B", "C#", "D", "E", "F#", "G", "A"],
    chordRoots: ["B", "C#", "D", "E", "F#", "G", "A"],
    labels: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
    qualities: ["min", "dim", "maj", "min", "min", "maj", "maj"]
  },
  "F#m": {
    rootNote: "F#",
    scaleNotes: ["F#", "G#", "A", "B", "C#", "D", "E"],
    chordRoots: ["F#", "G#", "A", "B", "C#", "D", "E"],
    labels: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
    qualities: ["min", "dim", "maj", "min", "min", "maj", "maj"]
  },
  "C#m": {
    rootNote: "C#",
    scaleNotes: ["C#", "D#", "E", "F#", "G#", "A", "B"],
    chordRoots: ["C#", "D#", "E", "F#", "G#", "A", "B"],
    labels: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
    qualities: ["min", "dim", "maj", "min", "min", "maj", "maj"]
  },
  "G#m": {
    rootNote: "G#",
    scaleNotes: ["G#", "A#", "B", "C#", "D#", "E", "F#"],
    chordRoots: ["G#", "A#", "B", "C#", "D#", "E", "F#"],
    labels: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
    qualities: ["min", "dim", "maj", "min", "min", "maj", "maj"]
  },
  "Dbm": {
    rootNote: "Db",
    scaleNotes: ["Db", "Eb", "Fb", "Gb", "Ab", "Bbb", "Cb"],
    chordRoots: ["Db", "Eb", "Fb", "Gb", "Ab", "Bbb", "Cb"],
    labels: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
    qualities: ["min", "dim", "maj", "min", "min", "maj", "maj"]
  },
  "Abm": {
    rootNote: "Ab",
    scaleNotes: ["Ab", "Bb", "Cb", "Db", "Eb", "Fb", "Gb"],
    chordRoots: ["Ab", "Bb", "Cb", "Db", "Eb", "Fb", "Gb"],
    labels: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
    qualities: ["min", "dim", "maj", "min", "min", "maj", "maj"]
  },
  "Ebm": {
    rootNote: "Eb",
    scaleNotes: ["Eb", "F", "Gb", "Ab", "Bb", "Cb", "Db"],
    chordRoots: ["Eb", "F", "Gb", "Ab", "Bb", "Cb", "Db"],
    labels: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
    qualities: ["min", "dim", "maj", "min", "min", "maj", "maj"]
  },
  "Bbm": {
    rootNote: "Bb",
    scaleNotes: ["Bb", "C", "Db", "Eb", "F", "Gb", "Ab"],
    chordRoots: ["Bb", "C", "Db", "Eb", "F", "Gb", "Ab"],
    labels: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
    qualities: ["min", "dim", "maj", "min", "min", "maj", "maj"]
  },
  "Fm": {
    rootNote: "F",
    scaleNotes: ["F", "G", "Ab", "Bb", "C", "Db", "Eb"],
    chordRoots: ["F", "G", "Ab", "Bb", "C", "Db", "Eb"],
    labels: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
    qualities: ["min", "dim", "maj", "min", "min", "maj", "maj"]
  },
  "Cm": {
    rootNote: "C",
    scaleNotes: ["C", "D", "Eb", "F", "G", "Ab", "Bb"],
    chordRoots: ["C", "D", "Eb", "F", "G", "Ab", "Bb"],
    labels: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
    qualities: ["min", "dim", "maj", "min", "min", "maj", "maj"]
  },
  "Gm": {
    rootNote: "G",
    scaleNotes: ["G", "A", "Bb", "C", "D", "Eb", "F"],
    chordRoots: ["G", "A", "Bb", "C", "D", "Eb", "F"],
    labels: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
    qualities: ["min", "dim", "maj", "min", "min", "maj", "maj"]
  },
  "Dm": {
    rootNote: "D",
    scaleNotes: ["D", "E", "F", "G", "A", "Bb", "C"],
    chordRoots: ["D", "E", "F", "G", "A", "Bb", "C"],
    labels: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
    qualities: ["min", "dim", "maj", "min", "min", "maj", "maj"]
},
"C#": {
  rootNote: "C#",
  scaleNotes: ["C#", "D#", "E#", "F#", "G#", "A#", "B#"],
  chordRoots: ["C#", "D#", "E#", "F#", "G#", "A#", "B#"],
  labels: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
  qualities: ["maj", "min", "min", "maj", "dom7", "min", "dim"]
},
"Gb": {
  rootNote: "Gb",
  scaleNotes: ["Gb", "Ab", "Bb", "Cb", "Db", "Eb", "F"],
  chordRoots: ["Gb", "Ab", "Bb", "Cb", "Db", "Eb", "F"],
  labels: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
  qualities: ["maj", "min", "min", "maj", "dom7", "min", "dim"]
},
"Cb": {
  rootNote: "Cb",
  scaleNotes: ["Cb", "Db", "Eb", "Fb", "Gb", "Ab", "Bb"],
  chordRoots: ["Cb", "Db", "Eb", "Fb", "Gb", "Ab", "Bb"],
  labels: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
  qualities: ["maj", "min", "min", "maj", "dom7", "min", "dim"]
},
"D#m": {
  rootNote: "D#",
  scaleNotes: ["D#", "E#", "F#", "G#", "A#", "B", "C#"],
  chordRoots: ["D#", "E#", "F#", "G#", "A#", "B", "C#"],
  labels: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
  qualities: ["min", "dim", "maj", "min", "min", "maj", "maj"]
},
"A#m": {
  rootNote: "A#",
  scaleNotes: ["A#", "B#", "C#", "D#", "E#", "F#", "G#"],
  chordRoots: ["A#", "B#", "C#", "D#", "E#", "F#", "G#"],
  labels: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
  qualities: ["min", "dim", "maj", "min", "min", "maj", "maj"]
}
};
  
export const MAJOR_DIATONIC_LABELS = {
  intervals: [0, 2, 4, 5, 7, 9, 11],
  labels: ["I", "ii", "iii", "IV", "V", "vi", "7°"],
};
export const MINOR_DIATONIC_LABELS = {
  intervals: [0, 2, 3, 5, 7, 8, 10],
  labels: ["i", "ii°", "III", "iv", "v", "VI", "7"],
};

export const DIATONIC_CHORD_QUALITIES = {
  major: {
    1: "maj",
    2: "min",
    3: "min",
    4: "maj",
    5: "dom7",
    6: "min",
    7: "dim",
  }, // Corrected 7th degree for major
  minor: {
    1: "min",
    2: "dim",
    3: "maj",
    4: "min",
    5: "min",
    6: "maj",
    7: "maj",
  },
};

export const CHORD_STRUCTURES = {
  major: { rootOffset: -4, fifthOffset: 3 }, // Relative to center note
  minor: { rootOffset: -3, fifthOffset: 4 }, // Relative to center note
};

// TIMING
export const DURATION_THRESHOLDS = {
  q: 550,
  "q.": 825,
  h: 1100,
  "h.": 1650,
  w: 2200,
};

export const DURATIONS = [
  { key: "w", name: "Whole", beatValue: 4 },
  { key: "h.", name: "Dotted Half", beatValue: 3 },
  { key: "h", name: "Half", beatValue: 2 },
  { key: "q.", name: "Dotted Quarter", beatValue: 1.5 },
  { key: "q", name: "Quarter", beatValue: 1 },
  { key: "8.", name: "Dotted Eighth", beatValue: 0.75 },
  { key: "8", name: "Eighth", beatValue: 0.5 },
  { key: "16.", name: "Dotted Sixteenth", beatValue: 0.375 },
  { key: "16", name: "Sixteenth", beatValue: 0.25 },
  { key: '32.', name: 'Dotted Thirty-second', beatValue: 0.1875 },
  { key: '32', name: 'Thirty-second', beatValue: 0.125 },
];

// KEYS AND SCALES
const keySignatures = [
  // Major keys with #s
  {
    displayName: "C",
    accidentals: [],
    type: "#",
    aliases: ["C", "C Major", "C major", "Am", "A minor", "A Minor"],
  },
  {
    displayName: "G",
    accidentals: ["F#"],
    type: "#",
    aliases: ["G", "G Major", "G major", "Em", "E minor", "E Minor"],
  },
  {
    displayName: "D",
    accidentals: ["F#", "C#"],
    type: "#",
    aliases: ["D", "D Major", "D major", "Bm", "B minor", "B Minor"],
  },
  {
    displayName: "A",
    accidentals: ["F#", "C#", "G#"],
    type: "#",
    aliases: [
      "A",
      "A Major",
      "A major",
      "F#m",
      "F# minor",
      "F# Minor",
      "F sharp minor",
      "F sharp Minor",
    ],
  },
  {
    displayName: "E",
    accidentals: ["F#", "C#", "G#", "D#"],
    type: "#",
    aliases: [
      "E",
      "E Major",
      "E major",
      "C#m",
      "C# minor",
      "C# Minor",
      "C sharp minor",
      "C sharp Minor",
    ],
  },
  {
    displayName: "B",
    accidentals: ["F#", "C#", "G#", "D#", "A#"],
    type: "#",
    aliases: [
      "B",
      "B Major",
      "B major",
      "G#m",
      "G# minor",
      "G# Minor",
      "G sharp minor",
      "G sharp Minor",
    ],
  },
  {
    displayName: "F#",
    accidentals: ["F#", "C#", "G#", "D#", "A#", "E#"],
    type: "#",
    aliases: [
      "F#",
      "F# Major",
      "F# major",
      "D#m",
      "D# minor",
      "D# Minor",
      "F sharp",
      "F sharp Major",
      "F sharp major",
      "D sharp minor",
      "D sharp Minor",
    ],
  },
  {
    displayName: "C#",
    accidentals: ["F#", "C#", "G#", "D#", "A#", "E#", "B#"],
    type: "#",
    aliases: [
      "C#",
      "C# Major",
      "C# major",
      "A#m",
      "A# minor",
      "A# Minor",
      "C sharp",
      "C sharp Major",
      "C sharp major",
      "A sharp minor",
      "A sharp Minor",
    ],
  },
  // Major keys with bs
  {
    displayName: "F",
    accidentals: ["Bb"],
    type: "b",
    aliases: ["F", "F Major", "F major", "Dm", "D minor", "D Minor"],
  },
  {
    displayName: "Bb",
    accidentals: ["Bb", "Eb"],
    type: "b",
    aliases: [
      "Bb",
      "Bb Major",
      "Bb major",
      "Gm",
      "G minor",
      "G Minor",
      "B flat",
      "B flat Major",
      "B flat major",
    ],
  },
  {
    displayName: "Eb",
    accidentals: ["Bb", "Eb", "Ab"],
    type: "b",
    aliases: [
      "Eb",
      "Eb Major",
      "Eb major",
      "Cm",
      "C minor",
      "C Minor",
      "E flat",
      "E flat Major",
      "E flat major",
    ],
  },
  {
    displayName: "Ab",
    accidentals: ["Bb", "Eb", "Ab", "Db"],
    type: "b",
    aliases: [
      "Ab",
      "Ab Major",
      "Ab major",
      "Fm",
      "F minor",
      "F Minor",
      "E#m",
      "A flat",
      "A flat Major",
      "A flat major",
    ],
  },
  {
    displayName: "Db",
    accidentals: ["Bb", "Eb", "Ab", "Db", "Gb"],
    type: "b",
    aliases: [
      "Db",
      "Db Major",
      "Db major",
      "Bbm",
      "Bb minor",
      "Bb Minor",
      "D flat",
      "D flat Major",
      "D flat major",
      "B flat minor",
      "B flat Minor",
    ],
  },
  {
    displayName: "Gb",
    accidentals: ["Bb", "Eb", "Ab", "Db", "Gb", "Cb"],
    type: "b",
    aliases: [
      "Gb",
      "Gb Major",
      "Gb major",
      "Ebm",
      "Eb minor",
      "Eb Minor",
      "G flat",
      "G flat Major",
      "G flat major",
      "E flat minor",
      "E flat Minor",
    ],
  },
  {
    displayName: "Cb",
    accidentals: ["Bb", "Eb", "Ab", "Db", "Gb", "Cb", "Fb"],
    type: "b",
    aliases: [
      "Cb",
      "Cb Major",
      "Cb major",
      "Abm",
      "Ab minor",
      "Ab Minor",
      "C flat",
      "C flat Major",
      "C flat major",
      "A flat minor",
      "A flat Minor",
    ],
  },
];
// Generate the lookup table
export const KEY_SIGNATURES = {};
keySignatures.forEach(({ accidentals, type, displayName, aliases }) => {
  const keyData = { accidentals, type, displayName };
  aliases.forEach((alias) => {
    KEY_SIGNATURES[alias] = keyData;
  });
});

/**
 * Strict chord identification - notes must match exactly as-is
 * No normalization, no reordering, no enharmonic conversion
 * 
 * @param {string[]} notes - Array of note names exactly as they should appear
 * @returns {string|null} - Chord display name or null if no exact match
 */
export function identifyChordStrict(notes) {
  if (!notes || notes.length === 0) return null;
  
  // Remove octaves but keep everything else as-is
  const pitchClasses = notes.map(note => note.replace(/\d+/g, ''));
  
  // Search chord definitions for exact match
  for (const [symbol, chord] of Object.entries(CHORD_DEFINITIONS)) {
    // Compare arrays exactly - same order, same spelling
    if (arraysEqual(pitchClasses, chord.notes)) {
      return chord.displayName;
    }
  }
  
  return null;
}

/**
 * Flexible chord identification - normalizes and sorts to find matches
 * Converts flats to sharps, sorts notes, handles inversions
 * 
 * @param {string[]} notes - Array of note names in any order/spelling
 * @returns {string|null} - Chord display name or null if no match
 */
export function identifyChordFlexible(notes) {
  if (!notes || notes.length === 0) return null;
  
  const normalized = notes
    .map(normalizeToSharps)                // Convert flats to sharps (keep octaves)
    .map(note => note.replace(/\d+/g, '')) // THEN remove octaves  
    .filter(note => note !== null)        // Remove any invalid notes
    .sort();                              // Sort alphabetically
  
  if (normalized.length === 0) return null;
  
  // Search chord definitions for a match
  for (const [symbol, chord] of Object.entries(CHORD_DEFINITIONS)) {
    const chordNotes = chord.notes.slice().sort(); // Sort chord notes too
    
    if (arraysEqual(normalized, chordNotes)) {
      return chord.displayName;
    }
  }
  
  return null;
}

// FUNCTIONS
function normalizeToSharps(note) {
  const match = ALL_NOTE_INFO.find(info => info.flatName === note);
  return match ? match.name : note;
}

function arraysEqual(arr1, arr2) {
  return arr1.length === arr2.length && 
         arr1.every((val, index) => val === arr2[index]);
}



/**
 * Get scale notes for a given tonic and mode
 * @param {string} tonic - Root note (e.g., "C", "F#")  
 * @param {string} mode - "major" or "minor"
 * @returns {string[]} - Array of note names in the scale
 */
export function getScaleNotes(tonic, mode) {
  const SCALE_INTERVALS = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10]
  };
  
  const intervals = SCALE_INTERVALS[mode];
  if (!intervals) return [];
  
  // Find the tonic's MIDI number (use middle octave as reference)
  const tonicPitchClass = tonic.replace(/\d+/g, '');
  const referenceTonic = tonicPitchClass + "4"; // C4, F#4, etc.
  const tonicMidi = NOTES_BY_NAME[referenceTonic];
  
  if (tonicMidi === undefined) return [];
  
  return intervals.map(interval => {
    const noteMidi = tonicMidi + interval;
    const noteInfo = NOTES_BY_MIDI[noteMidi];
    return noteInfo ? noteInfo.pitchClass : null;
  }).filter(Boolean);
}

/**
 * Get pitch class from note name (removes octave)
 * @param {string} noteName - Note with or without octave (e.g., "C4", "F#")
 * @returns {string} - Pitch class (e.g., "C", "F#")
 */
export function getPitchClass(noteName) {
  return noteName.replace(/\d+/g, '');
}

/**
 * Get octave from note name
 * @param {string} noteName - Note with octave (e.g., "C4")
 * @returns {number|null} - Octave number or null if no octave
 */
export function getOctave(noteName) {
  const match = noteName.match(/\d+/);
  return match ? parseInt(match[0]) : null;
}

/**
 * Calculate interval between two pitch classes
 * @param {string} fromNote - Starting pitch class
 * @param {string} toNote - Ending pitch class  
 * @returns {number} - Semitones between notes (0-11)
 */
export function getInterval(fromNote, toNote) {
  const fromPitchClass = getPitchClass(fromNote);
  const toPitchClass = getPitchClass(toNote);
  
  // Find MIDI numbers for comparison (use same octave)
  const fromMidi = NOTES_BY_NAME[fromPitchClass + "4"];
  const toMidi = NOTES_BY_NAME[toPitchClass + "4"];
  
  if (fromMidi === undefined || toMidi === undefined) return 0;
  
  let interval = toMidi - fromMidi;
  // Normalize to 0-11 range
  while (interval < 0) interval += 12;
  while (interval > 11) interval -= 12;
  
  return interval;
}

/**
 * Transpose a note by a number of semitones
 * @param {string} noteName - Original note (e.g., "C4")
 * @param {number} semitones - Number of semitones to transpose
 * @returns {string} - Transposed note name
 */
export function transposeNote(noteName, semitones) {
  const originalMidi = NOTES_BY_NAME[noteName];
  if (originalMidi === undefined) return noteName;
  
  const newMidi = originalMidi + semitones;
  const newNoteInfo = NOTES_BY_MIDI[newMidi];
  
  return newNoteInfo ? newNoteInfo.name : noteName;
}

export function getKeySignature() {
  const keySignature = pianoState.keySignature;
  const isMinor = pianoState.isMinorKey;

  // Map minor keys to their relative majors
  const minorToRelativeMajor = {
    "A": "C", // A minor → C major (0 sharps/flats)
    "E": "G", // E minor → G major (1 sharp)
    "B": "D", // B minor → D major (2 sharps)
    "F#": "A", // F# minor → A major (3 sharps)
    "C#": "E", // C# minor → E major (4 sharps)
    "G#": "B", // G# minor → B major (5 sharps)
    "D#": "F#", // D# minor → F# major (6 sharps)
    "A#": "C#", // A# minor → C# major (7 sharps)
    "D": "F", // D minor → F major (1 flat)
    "G": "Bb", // G minor → Bb major (2 flats)
    "C": "Eb", // C minor → Eb major (3 flats)
    "F": "Ab", // F minor → Ab major (4 flats)
    "Bb": "Db", // Bb minor → Db major (5 flats)
    "Eb": "Gb", // Eb minor → Gb major (6 flats)
    "Ab": "Cb", // Ab minor → Cb major (7 flats)
  };

  const majorToRelativeMinor = {
    "C": "Am",   // C major → A minor
    "G": "Em",   // G major → E minor  
    "D": "Bm",   // D major → B minor
    "A": "F#m",  // A major → F# minor
    "E": "C#m",  // E major → C# minor
    "B": "G#m",  // B major → G# minor
    "F#": "D#m", // F# major → D# minor
    "C#": "A#m", // C# major → A# minor
    "F": "Dm",   // F major → D minor
    "Bb": "Gm",  // Bb major → G minor
    "Eb": "Cm",  // Eb major → C minor
    "Ab": "Fm",  // Ab major → F minor
    "Db": "Bbm", // Db major → Bb minor
    "Gb": "Ebm", // Gb major → Eb minor
    "Cb": "Abm", // Cb major → Ab minor
  }

  if (isMinor && majorToRelativeMinor[keySignature]) {
    return majorToRelativeMinor[keySignature];
  }

  return keySignature;
}

export function getCurrentVexFlowKeySignature() {
  const pitchClass = pianoState.keySignature.replace(/\d+$/, ""); // Remove octave
  const isMinor = pianoState.isMinorChordMode;

  // Map minor keys to their relative majors for VexFlow
  const minorToRelativeMajor = {
    A: "C", // A minor → C major (0 sharps/flats)
    E: "G", // E minor → G major (1 sharp)
    B: "D", // B minor → D major (2 sharps)
    "F#": "A", // F# minor → A major (3 sharps)
    "C#": "E", // C# minor → E major (4 sharps)
    "G#": "B", // G# minor → B major (5 sharps)
    "D#": "F#", // D# minor → F# major (6 sharps)
    "A#": "C#", // A# minor → C# major (7 sharps)

    D: "F", // D minor → F major (1 flat)
    G: "Bb", // G minor → Bb major (2 flats)
    C: "Eb", // C minor → Eb major (3 flats)
    F: "Ab", // F minor → Ab major (4 flats)
    Bb: "Db", // Bb minor → Db major (5 flats)
    Eb: "Gb", // Eb minor → Gb major (6 flats)
    Ab: "Cb", // Ab minor → Cb major (7 flats)
  };

  const majorToRelativeMinor = {
    "C": "Am",   // C major → A minor
    "G": "Em",   // G major → E minor  
    "D": "Bm",   // D major → B minor
    "A": "F#m",  // A major → F# minor
    "E": "C#m",  // E major → C# minor
    "B": "G#m",  // B major → G# minor
    "F#": "D#m", // F# major → D# minor
    "C#": "A#m", // C# major → A# minor
    "F": "Dm",   // F major → D minor
    "Bb": "Gm",  // Bb major → G minor
    "Eb": "Cm",  // Eb major → C minor
    "Ab": "Fm",  // Ab major → F minor
    "Db": "Bbm", // Db major → Bb minor
    "Gb": "Ebm", // Gb major → Eb minor
    "Cb": "Abm", // Cb major → Ab minor
  }

  if (isMinor && minorToRelativeMajor[pitchClass]) {
    return minorToRelativeMajor[pitchClass];
  }

  // Handle enharmonic equivalents for major keys
  const enharmonicMap = {
    "A#": "Bb",
    "D#": "Eb", 
    "G#": "Ab",
  };

  return enharmonicMap[pitchClass] || pitchClass;
}

export function getChordByDegree(degree = 1) {
  // Validate degree
  if (degree < 1 || degree > 7) {
    console.warn(`Invalid scale degree ${degree}. Must be 1-7`);
    return null;
  }

  // Get scale data directly
  const keySignature = getKeySignature();
  const scaleData = DIATONIC_SCALES[keySignature];

  if (!scaleData) {
    console.warn(`Scale data not found for key: ${keySignature}`);
    return null;
  }

  // Get chord info directly from pre-calculated arrays
  const chordRoot = scaleData.chordRoots[degree - 1];
  const quality = scaleData.qualities[degree - 1];

  // Build chord name based on quality
  let chordName = chordRoot;
  switch (quality) {
    case "min": 
      chordName += "m"; 
      break;
    case "dom7": 
      chordName += "7"; 
      break;
    case "dim": 
      chordName += "dim"; 
      break;
    // "maj" gets no suffix
  }

  // Look up in CHORD_DEFINITIONS
  if (chordName in CHORD_DEFINITIONS) {
    return CHORD_DEFINITIONS[chordName];
  }

  console.warn(`Chord ${chordName} not found in CHORD_DEFINITIONS`);
  return null;
}

/**
 * Splits an array of notes between bass and treble clefs for optimal notation display
 * @param {string[]} noteNames - Array of note names (e.g., ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'])
 * @returns {Array} Array of clef objects with notes grouped by clef
 */
export function splitNotesIntoClefs(noteNames) {
  // Split point - notes at or above C4 (MIDI 60) go to treble, below go to bass
  const SPLIT_POINT = 60; // C4
  
  const bassNotes = [];
  const trebleNotes = [];
  
  noteNames.forEach(noteName => {
    const midiNumber = NOTES_BY_NAME[noteName];
    if (midiNumber !== undefined) {
      if (midiNumber < SPLIT_POINT) {
        bassNotes.push(noteName);
      } else {
        trebleNotes.push(noteName);
      }
    }
  });
  
  const result = [];
  
  // Add bass clef group if it has notes
  if (bassNotes.length > 0) {
    result.push({
      clef: 'bass',
      notes: bassNotes
    });
  }
  
  // Add treble clef group if it has notes
  if (trebleNotes.length > 0) {
    result.push({
      clef: 'treble', 
      notes: trebleNotes
    });
  }
  
  return result;
}