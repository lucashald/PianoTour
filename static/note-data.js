// THIS FILE IS TOO LONG TO OUTPUT IN CANVAS OR CHAT. IF YOU NEED TO CHANGE IT, TELL THE USER

import { pianoState } from "./appState.js";

const allNoteInfo = [
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
  const noteInfo = allNoteInfo.find((note) => note.midi === midiNumber);
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

  allNoteInfo.forEach((note) => {
    if (!note.isBlack) {
      note.x = whiteKeyX;
      whiteKeyX += WW;
    }
  });

  allNoteInfo.forEach((note) => {
    if (note.isBlack) {
      const prevNote = allNoteInfo.find((n) => n.midi === note.midi - 1);
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
    ALL_NOTE_INFO: allNoteInfo,
  };
};

const {
  NOTES_BY_MIDI,
  NOTES_BY_NAME,
  WW: WHITE_KEY_WIDTH,
  BW: BLACK_KEY_WIDTH,
  ALL_NOTE_INFO,
} = buildNoteData();

// Export the core note data and key dimensions
export {
  NOTES_BY_MIDI,
  NOTES_BY_NAME,
  WHITE_KEY_WIDTH,
  BLACK_KEY_WIDTH,
  ALL_NOTE_INFO,
};

// --- Chord Definitions ---
const chordDefinitions = {
  // C Chords
  C: {
    treble: ["C4", "E4", "G4"],
    bass: ["C3", "E3", "G3"],
    displayName: "C Major",
  },
  Cmaj7: {
    treble: ["C4", "E4", "G4", "B4"],
    bass: ["C2", "E2", "G2", "B2"],
    displayName: "C Major 7th",
  },
  Cmaj6: {
    treble: ["C4", "E4", "G4", "A4"],
    bass: ["C2", "E2", "G2", "A2"],
    displayName: "C Major 6th",
  },
  Cmaj9: {
    treble: ["C4", "E4", "G4", "B4", "D5"],
    bass: ["C2", "E2", "G2", "B2", "D3"],
    displayName: "C Major 9th",
  },
  Cm: {
    treble: ["C4", "Eb4", "G4"],
    bass: ["C3", "Eb3", "G3"],
    displayName: "C Minor",
  },
  Cmin7: {
    treble: ["C4", "Eb4", "G4", "Bb4"],
    bass: ["C2", "Eb2", "G2", "Bb2"],
    displayName: "C Minor 7th",
  },
  Cmin6: {
    treble: ["C4", "Eb4", "G4", "A4"],
    bass: ["C2", "Eb2", "G2", "A2"],
    displayName: "C Minor 6th",
  },
  Cmin9: {
    treble: ["C4", "Eb4", "G4", "Bb4", "D5"],
    bass: ["C2", "Eb2", "G2", "Bb2", "D3"],
    displayName: "C Minor 9th",
  },
  Cdim: {
    treble: ["C4", "Eb4", "Gb4"],
    bass: ["C3", "Eb3", "Gb3"],
    displayName: "C Diminished",
  },
  Cdim7: {
    treble: ["C4", "Eb4", "Gb4", "Bbb4"],
    bass: ["C3", "Eb3", "Gb3", "Bbb3"],
    displayName: "C Diminished 7th",
  },
  Cm7b5: {
    treble: ["C4", "Eb4", "Gb4", "Bb4"],
    bass: ["C3", "Eb3", "Gb3", "Bb3"],
    displayName: "C Half-Diminished 7th",
  },
  Caug: {
    treble: ["C4", "E4", "G#4"],
    bass: ["C3", "E3", "G#3"],
    displayName: "C Augmented",
  },
  Caug7: {
    treble: ["C4", "E4", "G#4", "Bb4"],
    bass: ["C2", "E2", "G#2", "Bb2"],
    displayName: "C Augmented 7th",
  },
  C7: {
    treble: ["C4", "E4", "G4", "Bb4"],
    bass: ["C2", "E2", "G2", "Bb2"],
    displayName: "C Dominant 7th",
  },
  C9: {
    treble: ["C4", "E4", "G4", "Bb4", "D5"],
    bass: ["C2", "E2", "G2", "Bb2", "D3"],
    displayName: "C Dominant 9th",
  },
  Csus4: {
    treble: ["C4", "F4", "G4"],
    bass: ["C3", "F3", "G3"],
    displayName: "C Suspended 4th",
  },
  Csus2: {
    treble: ["C4", "D4", "G4"],
    bass: ["C3", "D3", "G3"],
    displayName: "C Suspended 2nd",
  },

  // C# Chords
  "C#": {
    treble: ["C#4", "E#4", "G#4"],
    bass: ["C#3", "E#3", "G#3"],
    displayName: "C# Major",
  },
  "C#maj7": {
    treble: ["C#4", "E#4", "G#4", "B#4"],
    bass: ["C#2", "E#2", "G#2", "B#2"],
    displayName: "C# Major 7th",
  },
  "C#maj6": {
    treble: ["C#4", "E#4", "G#4", "A#4"],
    bass: ["C#2", "E#2", "G#2", "A#2"],
    displayName: "C# Major 6th",
  },
  "C#maj9": {
    treble: ["C#4", "E#4", "G#4", "B#4", "D#5"],
    bass: ["C#2", "E#2", "G#2", "B#2", "D#3"],
    displayName: "C# Major 9th",
  },
  "C#m": {
    treble: ["C#4", "E4", "G#4"],
    bass: ["C#3", "E3", "G#3"],
    displayName: "C# Minor",
  },
  "C#min7": {
    treble: ["C#4", "E4", "G#4", "B4"],
    bass: ["C#2", "E2", "G#2", "B2"],
    displayName: "C# Minor 7th",
  },
  "C#min6": {
    treble: ["C#4", "E4", "G#4", "A#4"],
    bass: ["C#2", "E2", "G#2", "A#2"],
    displayName: "C# Minor 6th",
  },
  "C#min9": {
    treble: ["C#4", "E4", "G#4", "B4", "D#5"],
    bass: ["C#2", "E2", "G#2", "B2", "D#3"],
    displayName: "C# Minor 9th",
  },
  "C#dim": {
    treble: ["C#4", "E4", "G4"],
    bass: ["C#3", "E3", "G3"],
    displayName: "C# Diminished",
  },
  "C#dim7": {
    treble: ["C#4", "E4", "G4", "Bb4"],
    bass: ["C#3", "E3", "G3", "Bb3"],
    displayName: "C# Diminished 7th",
  },
  "C#m7b5": {
    treble: ["C#4", "E4", "G4", "B4"],
    bass: ["C#3", "E3", "G3", "B3"],
    displayName: "C# Half-Diminished 7th",
  },
  "C#aug": {
    treble: ["C#4", "E#4", "G##4"],
    bass: ["C#3", "E#3", "G##3"],
    displayName: "C# Augmented",
  },
  "C#aug7": {
    treble: ["C#4", "E#4", "G##4", "B4"],
    bass: ["C#2", "E#2", "G##2", "B2"],
    displayName: "C# Augmented 7th",
  },
  "C#7": {
    treble: ["C#4", "E#4", "G#4", "B4"],
    bass: ["C#2", "E#2", "G#2", "B2"],
    displayName: "C# Dominant 7th",
  },
  "C#9": {
    treble: ["C#4", "E#4", "G#4", "B4", "D#5"],
    bass: ["C#2", "E#2", "G#2", "B2", "D#3"],
    displayName: "C# Dominant 9th",
  },
  "C#sus4": {
    treble: ["C#4", "F#4", "G#4"],
    bass: ["C#3", "F#3", "G#3"],
    displayName: "C# Suspended 4th",
  },
  "C#sus2": {
    treble: ["C#4", "D#4", "G#4"],
    bass: ["C#3", "D#3", "G#3"],
    displayName: "C# Suspended 2nd",
  },

  // Db Chords
  Db: {
    treble: ["Db4", "F4", "Ab4"],
    bass: ["Db3", "F3", "Ab3"],
    displayName: "Db Major",
  },
  Dbmaj7: {
    treble: ["Db4", "F4", "Ab4", "C5"],
    bass: ["Db2", "F2", "Ab2", "C3"],
    displayName: "Db Major 7th",
  },
  Dbmaj6: {
    treble: ["Db4", "F4", "Ab4", "Bb4"],
    bass: ["Db2", "F2", "Ab2", "Bb2"],
    displayName: "Db Major 6th",
  },
  Dbmaj9: {
    treble: ["Db4", "F4", "Ab4", "C5", "Eb5"],
    bass: ["Db2", "F2", "Ab2", "C3", "Eb3"],
    displayName: "Db Major 9th",
  },
  Dbm: {
    treble: ["Db4", "Fb4", "Ab4"],
    bass: ["Db3", "Fb3", "Ab3"],
    displayName: "Db Minor",
  },
  Dbmin7: {
    treble: ["Db4", "Fb4", "Ab4", "Cb5"],
    bass: ["Db2", "Fb2", "Ab2", "Cb3"],
    displayName: "Db Minor 7th",
  },
  Dbmin6: {
    treble: ["Db4", "Fb4", "Ab4", "Bb4"],
    bass: ["Db2", "Fb2", "Ab2", "Bb2"],
    displayName: "Db Minor 6th",
  },
  Dbmin9: {
    treble: ["Db4", "Fb4", "Ab4", "Cb5", "Eb5"],
    bass: ["Db2", "Fb2", "Ab2", "Cb3", "Eb3"],
    displayName: "Db Minor 9th",
  },
  Dbdim: {
    treble: ["Db4", "Fb4", "Abb4"],
    bass: ["Db3", "Fb3", "Abb3"],
    displayName: "Db Diminished",
  },
  Dbdim7: {
    treble: ["Db4", "Fb4", "Abb4", "Cbb5"],
    bass: ["Db3", "Fb3", "Abb3", "Cbb4"],
    displayName: "Db Diminished 7th",
  },
  Dbm7b5: {
    treble: ["Db4", "Fb4", "Abb4", "Cb5"],
    bass: ["Db3", "Fb3", "Abb4", "Cb4"],
    displayName: "Db Half-Diminished 7th",
  },
  Dbaug: {
    treble: ["Db4", "F4", "A4"],
    bass: ["Db3", "F3", "A3"],
    displayName: "Db Augmented",
  },
  Dbaug7: {
    treble: ["Db4", "F4", "A4", "Cb5"],
    bass: ["Db2", "F2", "A2", "Cb3"],
    displayName: "Db Augmented 7th",
  },
  Db7: {
    treble: ["Db4", "F4", "Ab4", "Cb5"],
    bass: ["Db2", "F2", "Ab2", "Cb3"],
    displayName: "Db Dominant 7th",
  },
  Db9: {
    treble: ["Db4", "F4", "Ab4", "Cb5", "Eb5"],
    bass: ["Db2", "F2", "Ab2", "Cb3", "Eb3"],
    displayName: "Db Dominant 9th",
  },
  Dbsus4: {
    treble: ["Db4", "Gb4", "Ab4"],
    bass: ["Db3", "Gb3", "Ab3"],
    displayName: "Db Suspended 4th",
  },
  Dbsus2: {
    treble: ["Db4", "Eb4", "Ab4"],
    bass: ["Db3", "Eb3", "Ab3"],
    displayName: "Db Suspended 2nd",
  },

  // D Chords
  D: {
    treble: ["D4", "F#4", "A4"],
    bass: ["D3", "F#3", "A3"],
    displayName: "D Major",
  },
  Dmaj7: {
    treble: ["D4", "F#4", "A4", "C#5"],
    bass: ["D2", "F#2", "A2", "C#3"],
    displayName: "D Major 7th",
  },
  Dmaj6: {
    treble: ["D4", "F#4", "A4", "B4"],
    bass: ["D2", "F#2", "A2", "B2"],
    displayName: "D Major 6th",
  },
  Dmaj9: {
    treble: ["D4", "F#4", "A4", "C#5", "E5"],
    bass: ["D2", "F#2", "A2", "C#3", "E3"],
    displayName: "D Major 9th",
  },
  Dm: {
    treble: ["D4", "F4", "A4"],
    bass: ["D3", "F3", "A3"],
    displayName: "D Minor",
  },
  Dmin7: {
    treble: ["D4", "F4", "A4", "C5"],
    bass: ["D2", "F2", "A2", "C3"],
    displayName: "D Minor 7th",
  },
  Dmin6: {
    treble: ["D4", "F4", "A4", "B4"],
    bass: ["D2", "F2", "A2", "B2"],
    displayName: "D Minor 6th",
  },
  Dmin9: {
    treble: ["D4", "F4", "A4", "C5", "E5"],
    bass: ["D2", "F2", "A2", "C3", "E3"],
    displayName: "D Minor 9th",
  },
  Ddim: {
    treble: ["D4", "F4", "Ab4"],
    bass: ["D3", "F3", "Ab3"],
    displayName: "D Diminished",
  },
  Ddim7: {
    treble: ["D4", "F4", "Ab4", "Cb5"],
    bass: ["D3", "F3", "Ab3", "Cb4"],
    displayName: "D Diminished 7th",
  },
  Dm7b5: {
    treble: ["D4", "F4", "Ab4", "C5"],
    bass: ["D3", "F3", "Ab3", "C4"],
    displayName: "D Half-Diminished 7th",
  },
  Daug: {
    treble: ["D4", "F#4", "A#4"],
    bass: ["D3", "F#3", "A#3"],
    displayName: "D Augmented",
  },
  Daug7: {
    treble: ["D4", "F#4", "A#4", "C5"],
    bass: ["D2", "F#2", "A#2", "C3"],
    displayName: "D Augmented 7th",
  },
  D7: {
    treble: ["D4", "F#4", "A4", "C5"],
    bass: ["D2", "F#2", "A2", "C3"],
    displayName: "D Dominant 7th",
  },
  D9: {
    treble: ["D4", "F#4", "A4", "C5", "E5"],
    bass: ["D2", "F#2", "A2", "C3", "E3"],
    displayName: "D Dominant 9th",
  },
  Dsus4: {
    treble: ["D4", "G4", "A4"],
    bass: ["D3", "G3", "A3"],
    displayName: "D Suspended 4th",
  },
  Dsus2: {
    treble: ["D4", "E4", "A4"],
    bass: ["D3", "E3", "A3"],
    displayName: "D Suspended 2nd",
  },

  // D# Chords
  "D#": {
    treble: ["D#4", "F##4", "A#4"],
    bass: ["D#3", "F##3", "A#3"],
    displayName: "D# Major",
  },
  "D#maj7": {
    treble: ["D#4", "F##4", "A#4", "C##5"],
    bass: ["D#2", "F##2", "A#2", "C##3"],
    displayName: "D# Major 7th",
  },
  "D#maj6": {
    treble: ["D#4", "F##4", "A#4", "B#4"],
    bass: ["D#2", "F##2", "A#2", "B#2"],
    displayName: "D# Major 6th",
  },
  "D#maj9": {
    treble: ["D#4", "F##4", "A#4", "C##5", "E#5"],
    bass: ["D#2", "F##2", "A#2", "C##3", "E#3"],
    displayName: "D# Major 9th",
  },
  "D#m": {
    treble: ["D#4", "F#4", "A#4"],
    bass: ["D#3", "F#3", "A#3"],
    displayName: "D# Minor",
  },
  "D#min7": {
    treble: ["D#4", "F#4", "A#4", "C#5"],
    bass: ["D#2", "F#2", "A#2", "C#3"],
    displayName: "D# Minor 7th",
  },
  "D#min6": {
    treble: ["D#4", "F#4", "A#4", "B#4"],
    bass: ["D#2", "F#2", "A#2", "B#2"],
    displayName: "D# Minor 6th",
  },
  "D#min9": {
    treble: ["D#4", "F#4", "A#4", "C#5", "E#5"],
    bass: ["D#2", "F#2", "A#2", "C#3", "E#3"],
    displayName: "D# Minor 9th",
  },
  "D#dim": {
    treble: ["D#4", "F#4", "A4"],
    bass: ["D#3", "F#3", "A3"],
    displayName: "D# Diminished",
  },
  "D#dim7": {
    treble: ["D#4", "F#4", "A4", "C5"],
    bass: ["D#3", "F#3", "A3", "C4"],
    displayName: "D# Diminished 7th",
  },
  "D#m7b5": {
    treble: ["D#4", "F#4", "A4", "C#5"],
    bass: ["D#3", "F#3", "A3", "C#4"],
    displayName: "D# Half-Diminished 7th",
  },
  "D#aug": {
    treble: ["D#4", "F##4", "A##4"],
    bass: ["D#3", "F##3", "A##3"],
    displayName: "D# Augmented",
  },
  "D#aug7": {
    treble: ["D#4", "F##4", "A##4", "C#5"],
    bass: ["D#2", "F##2", "A##2", "C#3"],
    displayName: "D# Augmented 7th",
  },
  "D#7": {
    treble: ["D#4", "F##4", "A#4", "C#5"],
    bass: ["D#2", "F##2", "A#2", "C#3"],
    displayName: "D# Dominant 7th",
  },
  "D#9": {
    treble: ["D#4", "F##4", "A#4", "C#5", "E#5"],
    bass: ["D#2", "F##2", "A#2", "C#3", "E#3"],
    displayName: "D# Dominant 9th",
  },
  "D#sus4": {
    treble: ["D#4", "G#4", "A#4"],
    bass: ["D#3", "G#3", "A#3"],
    displayName: "D# Suspended 4th",
  },
  "D#sus2": {
    treble: ["D#4", "E#4", "A#4"],
    bass: ["D#3", "E#3", "A#3"],
    displayName: "D# Suspended 2nd",
  },

  // Eb Chords
  Eb: {
    treble: ["Eb4", "G4", "Bb4"],
    bass: ["Eb3", "G3", "Bb3"],
    displayName: "Eb Major",
  },
  Ebmaj7: {
    treble: ["Eb4", "G4", "Bb4", "D5"],
    bass: ["Eb2", "G2", "Bb2", "D3"],
    displayName: "Eb Major 7th",
  },
  Ebmaj6: {
    treble: ["Eb4", "G4", "Bb4", "C5"],
    bass: ["Eb2", "G2", "Bb2", "C3"],
    displayName: "Eb Major 6th",
  },
  Ebmaj9: {
    treble: ["Eb4", "G4", "Bb4", "D5", "F5"],
    bass: ["Eb2", "G2", "Bb2", "D3", "F3"],
    displayName: "Eb Major 9th",
  },
  Ebm: {
    treble: ["Eb4", "Gb4", "Bb4"],
    bass: ["Eb3", "Gb3", "Bb3"],
    displayName: "Eb Minor",
  },
  Ebmin7: {
    treble: ["Eb4", "Gb4", "Bb4", "Db5"],
    bass: ["Eb2", "Gb2", "Bb2", "Db3"],
    displayName: "Eb Minor 7th",
  },
  Ebmin6: {
    treble: ["Eb4", "Gb4", "Bb4", "C5"],
    bass: ["Eb2", "Gb2", "Bb2", "C3"],
    displayName: "Eb Minor 6th",
  },
  Ebmin9: {
    treble: ["Eb4", "Gb4", "Bb4", "Db5", "F5"],
    bass: ["Eb2", "Gb2", "Bb2", "Db3", "F3"],
    displayName: "Eb Minor 9th",
  },
  Ebdim: {
    treble: ["Eb4", "Gb4", "Bbb4"],
    bass: ["Eb3", "Gb3", "Bbb3"],
    displayName: "Eb Diminished",
  },
  Ebdim7: {
    treble: ["Eb4", "Gb4", "Bbb4", "Dbb5"],
    bass: ["Eb3", "Gb3", "Bbb3", "Dbb4"],
    displayName: "Eb Diminished 7th",
  },
  Ebm7b5: {
    treble: ["Eb4", "Gb4", "Bbb4", "Db5"],
    bass: ["Eb3", "Gb3", "Bbb3", "Db4"],
    displayName: "Eb Half-Diminished 7th",
  },
  Ebaug: {
    treble: ["Eb4", "G4", "B4"],
    bass: ["Eb3", "G3", "B3"],
    displayName: "Eb Augmented",
  },
  Ebaug7: {
    treble: ["Eb4", "G4", "B4", "Db5"],
    bass: ["Eb2", "G2", "B2", "Db3"],
    displayName: "Eb Augmented 7th",
  },
  Eb7: {
    treble: ["Eb4", "G4", "Bb4", "Db5"],
    bass: ["Eb2", "G2", "Bb2", "Db3"],
    displayName: "Eb Dominant 7th",
  },
  Eb9: {
    treble: ["Eb4", "G4", "Bb4", "Db5", "F5"],
    bass: ["Eb2", "G2", "Bb2", "Db3", "F3"],
    displayName: "Eb Dominant 9th",
  },
  Ebsus4: {
    treble: ["Eb4", "Ab4", "Bb4"],
    bass: ["Eb3", "Ab3", "Bb3"],
    displayName: "Eb Suspended 4th",
  },
  Ebsus2: {
    treble: ["Eb4", "F4", "Bb4"],
    bass: ["Eb3", "F3", "Bb3"],
    displayName: "Eb Suspended 2nd",
  },

  // E Chords
  E: {
    treble: ["E4", "G#4", "B4"],
    bass: ["E3", "G#3", "B3"],
    displayName: "E Major",
  },
  Emaj7: {
    treble: ["E4", "G#4", "B4", "D#5"],
    bass: ["E2", "G#2", "B2", "D#3"],
    displayName: "E Major 7th",
  },
  Emaj6: {
    treble: ["E4", "G#4", "B4", "C#5"],
    bass: ["E2", "G#2", "B2", "C#3"],
    displayName: "E Major 6th",
  },
  Emaj9: {
    treble: ["E4", "G#4", "B4", "D#5", "F#5"],
    bass: ["E2", "G#2", "B2", "D#3", "F#3"],
    displayName: "E Major 9th",
  },
  Em: {
    treble: ["E4", "G4", "B4"],
    bass: ["E3", "G4", "B3"],
    displayName: "E Minor",
  },
  Emin7: {
    treble: ["E4", "G4", "B4", "D5"],
    bass: ["E2", "G2", "B2", "D3"],
    displayName: "E Minor 7th",
  },
  Emin6: {
    treble: ["E4", "G4", "B4", "C#5"],
    bass: ["E2", "G2", "B2", "C#3"],
    displayName: "E Minor 6th",
  },
  Emin9: {
    treble: ["E4", "G4", "B4", "D5", "F#5"],
    bass: ["E2", "G2", "B2", "D3", "F#3"],
    displayName: "E Minor 9th",
  },
  Edim: {
    treble: ["E4", "G4", "Bb4"],
    bass: ["E3", "G3", "Bb3"],
    displayName: "E Diminished",
  },
  Edim7: {
    treble: ["E4", "G4", "Bb4", "Db5"],
    bass: ["E3", "G3", "Bb3", "Db4"],
    displayName: "E Diminished 7th",
  },
  Em7b5: {
    treble: ["E4", "G4", "Bb4", "D5"],
    bass: ["E3", "G3", "Bb3", "D4"],
    displayName: "E Half-Diminished 7th",
  },
  Eaug: {
    treble: ["E4", "G#4", "B#4"],
    bass: ["E3", "G#3", "B#3"],
    displayName: "E Augmented",
  },
  Eaug7: {
    treble: ["E4", "G#4", "B#4", "D5"],
    bass: ["E2", "G#2", "B#2", "D3"],
    displayName: "E Augmented 7th",
  },
  E7: {
    treble: ["E4", "G#4", "B4", "D5"],
    bass: ["E2", "G#2", "B2", "D3"],
    displayName: "E Dominant 7th",
  },
  E9: {
    treble: ["E4", "G#4", "B4", "D5", "F#5"],
    bass: ["E2", "G#2", "B2", "D3", "F#3"],
    displayName: "E Dominant 9th",
  },
  Esus4: {
    treble: ["E4", "A4", "B4"],
    bass: ["E3", "A3", "B3"],
    displayName: "E Suspended 4th",
  },
  Esus2: {
    treble: ["E4", "F#4", "B4"],
    bass: ["E3", "F#3", "B3"],
    displayName: "E Suspended 2nd",
  },

  // F Chords
  F: {
    treble: ["F4", "A4", "C5"],
    bass: ["F2", "A2", "C3"],
    displayName: "F Major",
  },
  Fmaj7: {
    treble: ["F4", "A4", "C5", "E5"],
    bass: ["F2", "A2", "C3", "E3"],
    displayName: "F Major 7th",
  },
  Fmaj6: {
    treble: ["F4", "A4", "C5", "D5"],
    bass: ["F2", "A2", "C3", "D3"],
    displayName: "F Major 6th",
  },
  Fmaj9: {
    treble: ["F4", "A4", "C5", "E5", "G5"],
    bass: ["F2", "A2", "C3", "E3", "G3"],
    displayName: "F Major 9th",
  },
  Fm: {
    treble: ["F4", "Ab4", "C5"],
    bass: ["F2", "Ab2", "C3"],
    displayName: "F Minor",
  },
  Fmin7: {
    treble: ["F4", "Ab4", "C5", "Eb5"],
    bass: ["F2", "Ab2", "C3", "Eb3"],
    displayName: "F Minor 7th",
  },
  Fmin6: {
    treble: ["F4", "Ab4", "C5", "D5"],
    bass: ["F2", "Ab2", "C3", "D3"],
    displayName: "F Minor 6th",
  },
  Fmin9: {
    treble: ["F4", "Ab4", "C5", "Eb5", "G5"],
    bass: ["F2", "Ab2", "C3", "Eb3", "G3"],
    displayName: "F Minor 9th",
  },
  Fdim: {
    treble: ["F4", "Ab4", "Cb5"],
    bass: ["F3", "Ab3", "Cb4"],
    displayName: "F Diminished",
  },
  Fdim7: {
    treble: ["F4", "Ab4", "Cb5", "Ebb5"],
    bass: ["F3", "Ab3", "Cb4", "Ebb4"],
    displayName: "F Diminished 7th",
  },
  Fm7b5: {
    treble: ["F4", "Ab4", "Cb5", "Eb5"],
    bass: ["F3", "Ab3", "Cb4", "Eb4"],
    displayName: "F Half-Diminished 7th",
  },
  Faug: {
    treble: ["F4", "A4", "C#5"],
    bass: ["F2", "A2", "C#3"],
    displayName: "F Augmented",
  },
  Faug7: {
    treble: ["F4", "A4", "C#5", "Eb5"],
    bass: ["F2", "A2", "C#3", "Eb3"],
    displayName: "F Augmented 7th",
  },
  F7: {
    treble: ["F4", "A4", "C5", "Eb5"],
    bass: ["F2", "A2", "C3", "Eb3"],
    displayName: "F Dominant 7th",
  },
  F9: {
    treble: ["F4", "A4", "C5", "Eb5", "G5"],
    bass: ["F2", "A2", "C3", "Eb3", "G3"],
    displayName: "F Dominant 9th",
  },
  Fsus4: {
    treble: ["F4", "Bb4", "C5"],
    bass: ["F2", "Bb2", "C3"],
    displayName: "F Suspended 4th",
  },
  Fsus2: {
    treble: ["F4", "G4", "C5"],
    bass: ["F2", "G2", "C3"],
    displayName: "F Suspended 2nd",
  },

  // F# Chords
  "F#": {
    treble: ["F#4", "A#4", "C#5"],
    bass: ["F#2", "A#2", "C#3"],
    displayName: "F# Major",
  },
  "F#maj7": {
    treble: ["F#4", "A#4", "C#5", "E#5"],
    bass: ["F#2", "A#2", "C#3", "E#3"],
    displayName: "F# Major 7th",
  },
  "F#maj6": {
    treble: ["F#4", "A#4", "C#5", "D#5"],
    bass: ["F#2", "A#2", "C#3", "D#3"],
    displayName: "F# Major 6th",
  },
  "F#maj9": {
    treble: ["F#4", "A#4", "C#5", "E#5", "G#5"],
    bass: ["F#2", "A#2", "C#3", "E#3", "G#3"],
    displayName: "F# Major 9th",
  },
  "F#m": {
    treble: ["F#4", "A4", "C#5"],
    bass: ["F#2", "A2", "C#3"],
    displayName: "F# Minor",
  },
  "F#min7": {
    treble: ["F#4", "A4", "C#5", "E5"],
    bass: ["F#2", "A2", "C#3", "E3"],
    displayName: "F# Minor 7th",
  },
  "F#min6": {
    treble: ["F#4", "A4", "C#5", "D#5"],
    bass: ["F#2", "A2", "C#3", "D#3"],
    displayName: "F# Minor 6th",
  },
  "F#min9": {
    treble: ["F#4", "A4", "C#5", "E5", "G#5"],
    bass: ["F#2", "A2", "C#3", "E3", "G#3"],
    displayName: "F# Minor 9th",
  },
  "F#dim": {
    treble: ["F#4", "A4", "C5"],
    bass: ["F#3", "A3", "C4"],
    displayName: "F# Diminished",
  },
  "F#dim7": {
    treble: ["F#4", "A4", "C5", "Eb5"],
    bass: ["F#3", "A3", "C4", "Eb4"],
    displayName: "F# Diminished 7th",
  },
  "F#m7b5": {
    treble: ["F#4", "A4", "C5", "E5"],
    bass: ["F#3", "A3", "C4", "E4"],
    displayName: "F# Half-Diminished 7th",
  },
  "F#aug": {
    treble: ["F#4", "A#4", "C##5"],
    bass: ["F#2", "A#2", "C##3"],
    displayName: "F# Augmented",
  },
  "F#aug7": {
    treble: ["F#4", "A#4", "C##5", "E5"],
    bass: ["F#2", "A#2", "C##3", "E3"],
    displayName: "F# Augmented 7th",
  },
  "F#7": {
    treble: ["F#4", "A#4", "C#5", "E5"],
    bass: ["F#2", "A#2", "C#3", "E3"],
    displayName: "F# Dominant 7th",
  },
  "F#9": {
    treble: ["F#4", "A#4", "C#5", "E5", "G#5"],
    bass: ["F#2", "A#2", "C#3", "E3", "G#3"],
    displayName: "F# Dominant 9th",
  },
  "F#sus4": {
    treble: ["F#4", "B4", "C#5"],
    bass: ["F#2", "B2", "C#3"],
    displayName: "F# Suspended 4th",
  },
  "F#sus2": {
    treble: ["F#4", "G#4", "C#5"],
    bass: ["F#2", "G#2", "C#3"],
    displayName: "F# Suspended 2nd",
  },

  // Gb Chords
  Gb: {
    treble: ["Gb4", "Bb4", "Db5"],
    bass: ["Gb2", "Bb2", "Db3"],
    displayName: "Gb Major",
  },
  Gbmaj7: {
    treble: ["Gb4", "Bb4", "Db5", "F5"],
    bass: ["Gb2", "Bb2", "Db3", "F3"],
    displayName: "Gb Major 7th",
  },
  Gbmaj6: {
    treble: ["Gb4", "Bb4", "Db5", "Eb5"],
    bass: ["Gb2", "Bb2", "Db3", "Eb3"],
    displayName: "Gb Major 6th",
  },
  Gbmaj9: {
    treble: ["Gb4", "Bb4", "Db5", "F5", "Ab5"],
    bass: ["Gb2", "Bb2", "Db3", "F3", "Ab3"],
    displayName: "Gb Major 9th",
  },
  Gbm: {
    treble: ["Gb4", "Bbb4", "Db5"],
    bass: ["Gb2", "Bbb2", "Db3"],
    displayName: "Gb Minor",
  },
  Gbmin7: {
    treble: ["Gb4", "Bbb4", "Db5", "Fb5"],
    bass: ["Gb2", "Bbb2", "Db3", "Fb3"],
    displayName: "Gb Minor 7th",
  },
  Gbmin6: {
    treble: ["Gb4", "Bbb4", "Db5", "Eb5"],
    bass: ["Gb2", "Bbb2", "Db3", "Eb3"],
    displayName: "Gb Minor 6th",
  },
  Gbmin9: {
    treble: ["Gb4", "Bbb4", "Db5", "Fb5", "Ab5"],
    bass: ["Gb2", "Bbb2", "Db3", "Fb3", "Ab3"],
    displayName: "Gb Minor 9th",
  },
  Gbdim: {
    treble: ["Gb4", "Bbb4", "Dbb5"],
    bass: ["Gb3", "Bbb3", "Dbb4"],
    displayName: "Gb Diminished",
  },
  Gbdim7: {
    treble: ["Gb4", "Bbb4", "Dbb5", "Fbb5"],
    bass: ["Gb3", "Bbb3", "Dbb4", "Fbb4"],
    displayName: "Gb Diminished 7th",
  },
  Gbm7b5: {
    treble: ["Gb4", "Bbb4", "Dbb5", "Fb5"],
    bass: ["Gb3", "Bbb3", "Dbb4", "Fb4"],
    displayName: "Gb Half-Diminished 7th",
  },
  Gbaug: {
    treble: ["Gb4", "Bb4", "D5"],
    bass: ["Gb2", "Bb2", "D3"],
    displayName: "Gb Augmented",
  },
  Gbaug7: {
    treble: ["Gb4", "Bb4", "D5", "Fb5"],
    bass: ["Gb2", "Bb2", "D3", "Fb3"],
    displayName: "Gb Augmented 7th",
  },
  Gb7: {
    treble: ["Gb4", "Bb4", "Db5", "Fb5"],
    bass: ["Gb2", "Bb2", "Db3", "Fb3"],
    displayName: "Gb Dominant 7th",
  },
  Gb9: {
    treble: ["Gb4", "Bb4", "Db5", "Fb5", "Ab5"],
    bass: ["Gb2", "Bb2", "Db3", "Fb3", "Ab3"],
    displayName: "Gb Dominant 9th",
  },
  Gbsus4: {
    treble: ["Gb4", "Cb5", "Db5"],
    bass: ["Gb2", "Cb3", "Db3"],
    displayName: "Gb Suspended 4th",
  },
  Gbsus2: {
    treble: ["Gb4", "Ab4", "Db5"],
    bass: ["Gb2", "Ab2", "Db3"],
    displayName: "Gb Suspended 2nd",
  },

  // G Chords
  G: {
    treble: ["G4", "B4", "D5"],
    bass: ["G2", "B2", "D3"],
    displayName: "G Major",
  },
  Gmaj7: {
    treble: ["G4", "B4", "D5", "F#5"],
    bass: ["G2", "B2", "D3", "F#3"],
    displayName: "G Major 7th",
  },
  Gmaj6: {
    treble: ["G4", "B4", "D5", "E5"],
    bass: ["G2", "B2", "D3", "E3"],
    displayName: "G Major 6th",
  },
  Gmaj9: {
    treble: ["G4", "B4", "D5", "F#5", "A5"],
    bass: ["G2", "B2", "D3", "F#3", "A3"],
    displayName: "G Major 9th",
  },
  Gm: {
    treble: ["G4", "Bb4", "D5"],
    bass: ["G2", "Bb2", "D3"],
    displayName: "G Minor",
  },
  Gmin7: {
    treble: ["G4", "Bb4", "D5", "F5"],
    bass: ["G2", "Bb2", "D3", "F3"],
    displayName: "G Minor 7th",
  },
  Gmin6: {
    treble: ["G4", "Bb4", "D5", "E5"],
    bass: ["G2", "Bb2", "D3", "E3"],
    displayName: "G Minor 6th",
  },
  Gmin9: {
    treble: ["G4", "Bb4", "D5", "F5", "A5"],
    bass: ["G2", "Bb2", "D3", "F3", "A3"],
    displayName: "G Minor 9th",
  },
  Gdim: {
    treble: ["G4", "Bb4", "Db5"],
    bass: ["G3", "Bb3", "Db4"],
    displayName: "G Diminished",
  },
  Gdim7: {
    treble: ["G4", "Bb4", "Db5", "Fb5"],
    bass: ["G3", "Bb3", "Db4", "Fb4"],
    displayName: "G Diminished 7th",
  },
  Gm7b5: {
    treble: ["G4", "Bb4", "Db5", "F5"],
    bass: ["G3", "Bb3", "Db4", "F4"],
    displayName: "G Half-Diminished 7th",
  },
  Gaug: {
    treble: ["G4", "B4", "D#5"],
    bass: ["G2", "B2", "D#3"],
    displayName: "G Augmented",
  },
  Gaug7: {
    treble: ["G4", "B4", "D#5", "F5"],
    bass: ["G2", "B2", "D#3", "F3"],
    displayName: "G Augmented 7th",
  },
  G7: {
    treble: ["G4", "B4", "D5", "F5"],
    bass: ["G2", "B2", "D3", "F3"],
    displayName: "G Dominant 7th",
  },
  G9: {
    treble: ["G4", "B4", "D5", "F5", "A5"],
    bass: ["G2", "B2", "D3", "F3", "A3"],
    displayName: "G Dominant 9th",
  },
  Gsus4: {
    treble: ["G4", "C5", "D5"],
    bass: ["G2", "C3", "D3"],
    displayName: "G Suspended 4th",
  },
  Gsus2: {
    treble: ["G4", "A4", "D5"],
    bass: ["G2", "A2", "D3"],
    displayName: "G Suspended 2nd",
  },

  // G# Chords
  "G#": {
    treble: ["G#4", "B#4", "D#5"],
    bass: ["G#2", "B#2", "D#3"],
    displayName: "G# Major",
  },
  "G#maj7": {
    treble: ["G#4", "B#4", "D#5", "F##5"],
    bass: ["G#2", "B#2", "D#3", "F##3"],
    displayName: "G# Major 7th",
  },
  "G#maj6": {
    treble: ["G#4", "B#4", "D#5", "E#5"],
    bass: ["G#2", "B#2", "D#3", "E#3"],
    displayName: "G# Major 6th",
  },
  "G#maj9": {
    treble: ["G#4", "B#4", "D#5", "F##5", "A#5"],
    bass: ["G#2", "B#2", "D#3", "F##3", "A#3"],
    displayName: "G# Major 9th",
  },
  "G#m": {
    treble: ["G#4", "B4", "D#5"],
    bass: ["G#2", "B2", "D#3"],
    displayName: "G# Minor",
  },
  "G#min7": {
    treble: ["G#4", "B4", "D#5", "F#5"],
    bass: ["G#2", "B2", "D#3", "F#3"],
    displayName: "G# Minor 7th",
  },
  "G#min6": {
    treble: ["G#4", "B4", "D#5", "E#5"],
    bass: ["G#2", "B2", "D#3", "E#3"],
    displayName: "G# Minor 6th",
  },
  "G#min9": {
    treble: ["G#4", "B4", "D#5", "F#5", "A#5"],
    bass: ["G#2", "B2", "D#3", "F#3", "A#3"],
    displayName: "G# Minor 9th",
  },
  "G#dim": {
    treble: ["G#4", "B4", "D5"],
    bass: ["G#3", "B3", "D4"],
    displayName: "G# Diminished",
  },
  "G#dim7": {
    treble: ["G#4", "B4", "D5", "F5"],
    bass: ["G#3", "B3", "D4", "F4"],
    displayName: "G# Diminished 7th",
  },
  "G#m7b5": {
    treble: ["G#4", "B4", "D5", "F#5"],
    bass: ["G#3", "B3", "D4", "F#4"],
    displayName: "G# Half-Diminished 7th",
  },
  "G#aug": {
    treble: ["G#4", "B#4", "D##5"],
    bass: ["G#2", "B#2", "D##3"],
    displayName: "G# Augmented",
  },
  "G#aug7": {
    treble: ["G#4", "B#4", "D##5", "F#5"],
    bass: ["G#2", "B#2", "D##3", "F#3"],
    displayName: "G# Augmented 7th",
  },
  "G#7": {
    treble: ["G#4", "B#4", "D#5", "F#5"],
    bass: ["G#2", "B#2", "D#3", "F#3"],
    displayName: "G# Dominant 7th",
  },
  "G#9": {
    treble: ["G#4", "B#4", "D#5", "F#5", "A#5"],
    bass: ["G#2", "B#2", "D#3", "F#3", "A#3"],
    displayName: "G# Dominant 9th",
  },
  "G#sus4": {
    treble: ["G#4", "C#5", "D#5"],
    bass: ["G#2", "C#3", "D#3"],
    displayName: "G# Suspended 4th",
  },
  "G#sus2": {
    treble: ["G#4", "A#4", "D#5"],
    bass: ["G#2", "A#2", "D#3"],
    displayName: "G# Suspended 2nd",
  },

  // Ab Chords
  Ab: {
    treble: ["Ab4", "C5", "Eb5"],
    bass: ["Ab2", "C3", "Eb3"],
    displayName: "Ab Major",
  },
  Abmaj7: {
    treble: ["Ab4", "C5", "Eb5", "G5"],
    bass: ["Ab2", "C3", "Eb3", "G3"],
    displayName: "Ab Major 7th",
  },
  Abmaj6: {
    treble: ["Ab4", "C5", "Eb5", "F5"],
    bass: ["Ab2", "C3", "Eb3", "F3"],
    displayName: "Ab Major 6th",
  },
  Abmaj9: {
    treble: ["Ab4", "C5", "Eb5", "G5", "Bb5"],
    bass: ["Ab2", "C3", "Eb3", "G3", "Bb3"],
    displayName: "Ab Major 9th",
  },
  Abm: {
    treble: ["Ab4", "Cb5", "Eb5"],
    bass: ["Ab2", "Cb3", "Eb3"],
    displayName: "Ab Minor",
  },
  Abmin7: {
    treble: ["Ab4", "Cb5", "Eb5", "Gb5"],
    bass: ["Ab2", "Cb3", "Eb3", "Gb3"],
    displayName: "Ab Minor 7th",
  },
  Abmin6: {
    treble: ["Ab4", "Cb5", "Eb5", "F5"],
    bass: ["Ab2", "Cb3", "Eb3", "F3"],
    displayName: "Ab Minor 6th",
  },
  Abmin9: {
    treble: ["Ab4", "Cb5", "Eb5", "Gb5", "Bb5"],
    bass: ["Ab2", "Cb3", "Eb3", "Gb3", "Bb3"],
    displayName: "Ab Minor 9th",
  },
  Abdim: {
    treble: ["Ab4", "Cb5", "Ebb5"],
    bass: ["Ab3", "Cb4", "Ebb4"],
    displayName: "Ab Diminished",
  },
  Abdim7: {
    treble: ["Ab4", "Cb5", "Ebb5", "Gbb5"],
    bass: ["Ab3", "Cb4", "Ebb4", "Gbb4"],
    displayName: "Ab Diminished 7th",
  },
  Abm7b5: {
    treble: ["Ab4", "Cb5", "Ebb5", "Gb5"],
    bass: ["Ab3", "Cb4", "Ebb4", "Gb4"],
    displayName: "Ab Half-Diminished 7th",
  },
  Abaug: {
    treble: ["Ab4", "C5", "E5"],
    bass: ["Ab3", "C3", "E3"],
    displayName: "Ab Augmented",
  },
  Abaug7: {
    treble: ["Ab4", "C5", "E5", "Gb5"],
    bass: ["Ab2", "C3", "E3", "Gb3"],
    displayName: "Ab Augmented 7th",
  },
  Ab7: {
    treble: ["Ab4", "C5", "Eb5", "Gb5"],
    bass: ["Ab2", "C3", "Eb3", "Gb3"],
    displayName: "Ab Dominant 7th",
  },
  Ab9: {
    treble: ["Ab4", "C5", "Eb5", "Gb5", "Bb5"],
    bass: ["Ab2", "C3", "Eb3", "Gb3", "Bb3"],
    displayName: "Ab Dominant 9th",
  },
  Absus4: {
    treble: ["Ab4", "Db5", "Eb5"],
    bass: ["Ab2", "Db3", "Eb3"],
    displayName: "Ab Suspended 4th",
  },
  Absus2: {
    treble: ["Ab4", "Bb4", "Eb5"],
    bass: ["Ab2", "Bb2", "Eb3"],
    displayName: "Ab Suspended 2nd",
  },

  // A Chords
  A: {
    treble: ["A4", "C#5", "E5"],
    bass: ["A2", "C#3", "E3"],
    displayName: "A Major",
  },
  Amaj7: {
    treble: ["A4", "C#5", "E5", "G#5"],
    bass: ["A2", "C#3", "E3", "G#3"],
    displayName: "A Major 7th",
  },
  Amaj6: {
    treble: ["A4", "C#5", "E5", "F#5"],
    bass: ["A2", "C#3", "E3", "F#3"],
    displayName: "A Major 6th",
  },
  Amaj9: {
    treble: ["A4", "C#5", "E5", "G#5", "B5"],
    bass: ["A2", "C#3", "E3", "G#3", "B3"],
    displayName: "A Major 9th",
  },
  Am: {
    treble: ["A4", "C5", "E5"],
    bass: ["A2", "C3", "E3"],
    displayName: "A Minor",
  },
  Amin7: {
    treble: ["A4", "C5", "E5", "G5"],
    bass: ["A2", "C3", "E3", "G3"],
    displayName: "A Minor 7th",
  },
  Amin6: {
    treble: ["A4", "C5", "E5", "F#5"],
    bass: ["A2", "C3", "E3", "F#3"],
    displayName: "A Minor 6th",
  },
  Amin9: {
    treble: ["A4", "C5", "E5", "G5", "B5"],
    bass: ["A2", "C3", "E3", "G3", "B3"],
    displayName: "A Minor 9th",
  },
  Adim: {
    treble: ["A4", "C5", "Eb5"],
    bass: ["A3", "C4", "Eb4"],
    displayName: "A Diminished",
  },
  Adim7: {
    treble: ["A4", "C5", "Eb5", "Gb5"],
    bass: ["A3", "C4", "Eb4", "Gb4"],
    displayName: "A Diminished 7th",
  },
  Am7b5: {
    treble: ["A4", "C5", "Eb5", "G5"],
    bass: ["A3", "C4", "Eb4", "G4"],
    displayName: "A Half-Diminished 7th",
  },
  Aaug: {
    treble: ["A4", "C#5", "E#5"],
    bass: ["A2", "C#3", "E#3"],
    displayName: "A Augmented",
  },
  Aaug7: {
    treble: ["A4", "C#5", "E#5", "G5"],
    bass: ["A2", "C#3", "E#3", "G3"],
    displayName: "A Augmented 7th",
  },
  A7: {
    treble: ["A4", "C#5", "E5", "G5"],
    bass: ["A2", "C#3", "E3", "G3"],
    displayName: "A Dominant 7th",
  },
  A9: {
    treble: ["A4", "C#5", "E5", "G5", "B5"],
    bass: ["A2", "C#3", "E3", "G3", "B3"],
    displayName: "A Dominant 9th",
  },
  Asus4: {
    treble: ["A4", "D5", "E5"],
    bass: ["A2", "D3", "E3"],
    displayName: "A Suspended 4th",
  },
  Asus2: {
    treble: ["A4", "B4", "E5"],
    bass: ["A2", "B2", "E3"],
    displayName: "A Suspended 2nd",
  },

  // A# Chords
  "A#": {
    treble: ["A#4", "C##5", "E#5"],
    bass: ["A#2", "C##3", "E#3"],
    displayName: "A# Major",
  },
  "A#maj7": {
    treble: ["A#4", "C##5", "E#5", "G##5"],
    bass: ["A#2", "C##3", "E#3", "G##3"],
    displayName: "A# Major 7th",
  },
  "A#maj6": {
    treble: ["A#4", "C##5", "E#5", "F##5"],
    bass: ["A#2", "C##3", "E#3", "F##3"],
    displayName: "A# Major 6th",
  },
  "A#maj9": {
    treble: ["A#4", "C##5", "E#5", "G##5", "B#5"],
    bass: ["A#2", "C##3", "E#3", "G##3", "B#3"],
    displayName: "A# Major 9th",
  },
  "A#m": {
    treble: ["A#4", "C#5", "E#5"],
    bass: ["A#2", "C#3", "E#3"],
    displayName: "A# Minor",
  },
  "A#min7": {
    treble: ["A#4", "C#5", "E#5", "G#5"],
    bass: ["A#2", "C#3", "E#3", "G#3"],
    displayName: "A# Minor 7th",
  },
  "A#min6": {
    treble: ["A#4", "C#5", "E#5", "F##5"],
    bass: ["A#2", "C#3", "E#3", "F##3"],
    displayName: "A# Minor 6th",
  },
  "A#min9": {
    treble: ["A#4", "C#5", "E#5", "G#5", "B#5"],
    bass: ["A#2", "C#3", "E#3", "G#3", "B#3"],
    displayName: "A# Minor 9th",
  },
  "A#dim": {
    treble: ["A#4", "C#5", "E5"],
    bass: ["A#3", "C#4", "E4"],
    displayName: "A# Diminished",
  },
  "A#dim7": {
    treble: ["A#4", "C#5", "E5", "G5"],
    bass: ["A#3", "C#4", "E4", "G4"],
    displayName: "A# Diminished 7th",
  },
  "A#m7b5": {
    treble: ["A#4", "C#5", "E5", "G#5"],
    bass: ["A#3", "C#4", "E4", "G#4"],
    displayName: "A# Half-Diminished 7th",
  },
  "A#aug": {
    treble: ["A#4", "C##5", "E##5"],
    bass: ["A#2", "C##3", "E##3"],
    displayName: "A# Augmented",
  },
  "A#aug7": {
    treble: ["A#4", "C##5", "E##5", "G#5"],
    bass: ["A#2", "C##3", "E##3", "G#3"],
    displayName: "A# Augmented 7th",
  },
  "A#7": {
    treble: ["A#4", "C##5", "E#5", "G#5"],
    bass: ["A#2", "C##3", "E#3", "G#3"],
    displayName: "A# Dominant 7th",
  },
  "A#9": {
    treble: ["A#4", "C##5", "E#5", "G#5", "B#5"],
    bass: ["A#2", "C##3", "E#3", "G#3", "B#3"],
    displayName: "A# Dominant 9th",
  },
  "A#sus4": {
    treble: ["A#4", "D#5", "E#5"],
    bass: ["A#2", "D#3", "E#3"],
    displayName: "A# Suspended 4th",
  },
  "A#sus2": {
    treble: ["A#4", "B#4", "E#5"],
    bass: ["A#2", "B#2", "E#3"],
    displayName: "A# Suspended 2nd",
  },

  // Bb Chords
  Bb: {
    treble: ["Bb4", "D5", "F5"],
    bass: ["Bb2", "D3", "F3"],
    displayName: "Bb Major",
  },
  Bbmaj7: {
    treble: ["Bb4", "D5", "F5", "A5"],
    bass: ["Bb2", "D3", "F3", "A3"],
    displayName: "Bb Major 7th",
  },
  Bbmaj6: {
    treble: ["Bb4", "D5", "F5", "G5"],
    bass: ["Bb2", "D3", "F3", "G3"],
    displayName: "Bb Major 6th",
  },
  Bbmaj9: {
    treble: ["Bb4", "D5", "F5", "A5", "C6"],
    bass: ["Bb2", "D3", "F3", "A3", "C4"],
    displayName: "Bb Major 9th",
  },
  Bbm: {
    treble: ["Bb4", "Db5", "F5"],
    bass: ["Bb2", "Db3", "F3"],
    displayName: "Bb Minor",
  },
  Bbmin7: {
    treble: ["Bb4", "Db5", "F5", "Ab5"],
    bass: ["Bb2", "Db3", "F3", "Ab3"],
    displayName: "Bb Minor 7th",
  },
  Bbmin6: {
    treble: ["Bb4", "Db5", "F5", "G5"],
    bass: ["Bb2", "Db3", "F3", "G3"],
    displayName: "Bb Minor 6th",
  },
  Bbmin9: {
    treble: ["Bb4", "Db5", "F5", "Ab5", "C6"],
    bass: ["Bb2", "Db3", "F3", "Ab3", "C4"],
    displayName: "Bb Minor 9th",
  },
  Bbdim: {
    treble: ["Bb4", "Db5", "Fb5"],
    bass: ["Bb3", "Db4", "Fb4"],
    displayName: "Bb Diminished",
  },
  Bbdim7: {
    treble: ["Bb4", "Db5", "Fb5", "Abb5"],
    bass: ["Bb3", "Db4", "Fb4", "Abb4"],
    displayName: "Bb Diminished 7th",
  },
  Bbm7b5: {
    treble: ["Bb4", "Db5", "Fb5", "Ab5"],
    bass: ["Bb3", "Db4", "Fb4", "Ab4"],
    displayName: "Bb Half-Diminished 7th",
  },
  Bbaug: {
    treble: ["Bb4", "D5", "F#5"],
    bass: ["Bb2", "D3", "F#3"],
    displayName: "Bb Augmented",
  },
  Bbaug7: {
    treble: ["Bb4", "D5", "F#5", "Ab5"],
    bass: ["Bb2", "D3", "F#3", "Ab3"],
    displayName: "Bb Augmented 7th",
  },
  Bb7: {
    treble: ["Bb4", "D5", "F5", "Ab5"],
    bass: ["Bb2", "D3", "F3", "Ab3"],
    displayName: "Bb Dominant 7th",
  },
  Bb9: {
    treble: ["Bb4", "D5", "F5", "Ab5", "C6"],
    bass: ["Bb2", "D3", "F3", "Ab3", "C4"],
    displayName: "Bb Dominant 9th",
  },
  Bbsus4: {
    treble: ["Bb4", "Eb5", "F5"],
    bass: ["Bb2", "Eb3", "F3"],
    displayName: "Bb Suspended 4th",
  },
  Bbsus2: {
    treble: ["Bb4", "C5", "F5"],
    bass: ["Bb2", "C3", "F3"],
    displayName: "Bb Suspended 2nd",
  },

  // B Chords
  B: {
    treble: ["B4", "D#5", "F#5"],
    bass: ["B2", "D#3", "F#3"],
    displayName: "B Major",
  },
  Bmaj7: {
    treble: ["B4", "D#5", "F#5", "A#5"],
    bass: ["B2", "D#3", "F#3", "A#3"],
    displayName: "B Major 7th",
  },
  Bmaj6: {
    treble: ["B4", "D#5", "F#5", "G#5"],
    bass: ["B2", "D#3", "F#3", "G#3"],
    displayName: "B Major 6th",
  },
  Bmaj9: {
    treble: ["B4", "D#5", "F#5", "A#5", "C#6"],
    bass: ["B2", "D#3", "F#3", "A#3", "C#4"],
    displayName: "B Major 9th",
  },
  Bm: {
    treble: ["B4", "D5", "F#5"],
    bass: ["B2", "D3", "F#3"],
    displayName: "B Minor",
  },
  Bmin7: {
    treble: ["B4", "D5", "F#5", "A5"],
    bass: ["B2", "D3", "F#3", "A3"],
    displayName: "B Minor 7th",
  },
  Bmin6: {
    treble: ["B4", "D5", "F#5", "G#5"],
    bass: ["B2", "D3", "F#3", "G#3"],
    displayName: "B Minor 6th",
  },
  Bmin9: {
    treble: ["B4", "D5", "F#5", "A5", "C#6"],
    bass: ["B2", "D3", "F#3", "A3", "C#4"],
    displayName: "B Minor 9th",
  },
  Bdim: {
    treble: ["B4", "D5", "F5"],
    bass: ["B3", "D4", "F4"],
    displayName: "B Diminished",
  },
  Bdim7: {
    treble: ["B4", "D5", "F5", "Ab5"],
    bass: ["B3", "D4", "F4", "Ab4"],
    displayName: "B Diminished 7th",
  },
  Bm7b5: {
    treble: ["B4", "D5", "F5", "A5"],
    bass: ["B3", "D4", "F4", "A4"],
    displayName: "B Half-Diminished 7th",
  },
  Baug: {
    treble: ["B4", "D#5", "F##5"],
    bass: ["B2", "D#3", "F##3"],
    displayName: "B Augmented",
  },
  Baug7: {
    treble: ["B4", "D#5", "F##5", "A5"],
    bass: ["B2", "D#3", "F##3", "A3"],
    displayName: "B Augmented 7th",
  },
  B7: {
    treble: ["B4", "D#5", "F#5", "A5"],
    bass: ["B2", "D#3", "F#3", "A3"],
    displayName: "B Dominant 7th",
  },
  B9: {
    treble: ["B4", "D#5", "F#5", "A5", "C#6"],
    bass: ["B2", "D#3", "F#3", "A3", "C#4"],
    displayName: "B Dominant 9th",
  },
  Bsus4: {
    treble: ["B4", "E5", "F#5"],
    bass: ["B2", "E3", "F#3"],
    displayName: "B Suspended 4th",
  },
  Bsus2: {
    treble: ["B4", "C#5", "F#5"],
    bass: ["B2", "C#3", "F#3"],
    displayName: "B Suspended 2nd",
  },

  "C/E": {
    treble: ["E4", "G4", "C5"],
    bass: ["E3", "G3", "C4"],
    displayName: "C Major (1st Inversion)",
  },
  "Db/F": {
    treble: ["F4", "Ab4", "Db5"],
    bass: ["F2", "Ab2", "Db3"],
    displayName: "Db Major (1st Inversion)",
  },
  "D/F#": {
    treble: ["F#4", "A4", "D5"],
    bass: ["F#2", "A2", "D3"],
    displayName: "D Major (1st Inversion)",
  },
  "Eb/G": {
    treble: ["G4", "Bb4", "Eb5"],
    bass: ["G2", "Bb2", "Eb3"],
    displayName: "Eb Major (1st Inversion)",
  },
  "E/G#": {
    treble: ["G#4", "B4", "E5"],
    bass: ["G#2", "B2", "E3"],
    displayName: "E Major (1st Inversion)",
  },
  "F/A": {
    treble: ["A4", "C5", "F5"],
    bass: ["A2", "C3", "F3"],
    displayName: "F Major (1st Inversion)",
  },
  "F#/A#": {
    treble: ["A#4", "C#5", "F#5"],
    bass: ["A#2", "C#3", "F#3"],
    displayName: "F# Major (1st Inversion)",
  },
  "Gb/Bb": {
    treble: ["Bb4", "Db5", "Gb5"],
    bass: ["Bb2", "Db3", "Gb3"],
    displayName: "Gb Major (1st Inversion)",
  },
  "G/B": {
    treble: ["B4", "D5", "G5"],
    bass: ["B2", "D3", "G3"],
    displayName: "G Major (1st Inversion)",
  },
  "Ab/C": {
    treble: ["C5", "Eb5", "Ab5"],
    bass: ["C3", "Eb3", "Ab3"],
    displayName: "Ab Major (1st Inversion)",
  },
  "A/C#": {
    treble: ["C#5", "E5", "A5"],
    bass: ["C#3", "E3", "A3"],
    displayName: "A Major (1st Inversion)",
  },
  "Bb/D": {
    treble: ["D5", "F5", "Bb5"],
    bass: ["D3", "F3", "Bb3"],
    displayName: "Bb Major (1st Inversion)",
  },
  "B/D#": {
    treble: ["D#5", "F#5", "B5"],
    bass: ["D#3", "F#3", "B3"],
    displayName: "B Major (1st Inversion)",
  },
  "C#/E#": {
    treble: ["E#4", "G#4", "C#5"],
    bass: ["E#3", "G#3", "C#4"],
    displayName: "C# Major (1st Inversion)",
  },
  "D#/F##": {
    treble: ["F##4", "A#4", "D#5"],
    bass: ["F##2", "A#2", "D#3"],
    displayName: "D# Major (1st Inversion)",
  },
  "G#/B#": {
    treble: ["B#4", "D#5", "G#5"],
    bass: ["B#2", "D#3", "G#3"],
    displayName: "G# Major (1st Inversion)",
  },
  "A#/C##": {
    treble: ["C##5", "E#5", "A#5"],
    bass: ["C##3", "E#3", "A#3"],
    displayName: "A# Major (1st Inversion)",
  },

  // --- Major Triad: 2nd Inversion ---
  "C/G": {
    treble: ["G4", "C5", "E5"],
    bass: ["G2", "C3", "E3"],
    displayName: "C Major (2nd Inversion)",
  },
  "Db/Ab": {
    treble: ["Ab4", "Db5", "F5"],
    bass: ["Ab2", "Db3", "F3"],
    displayName: "Db Major (2nd Inversion)",
  },
  "D/A": {
    treble: ["A4", "D5", "F#5"],
    bass: ["A2", "D3", "F#3"],
    displayName: "D Major (2nd Inversion)",
  },
  "Eb/Bb": {
    treble: ["Bb4", "Eb5", "G5"],
    bass: ["Bb2", "Eb3", "G3"],
    displayName: "Eb Major (2nd Inversion)",
  },
  "E/B": {
    treble: ["B4", "E5", "G#5"],
    bass: ["B2", "E3", "G#3"],
    displayName: "E Major (2nd Inversion)",
  },
  "F/C": {
    treble: ["C5", "F5", "A5"],
    bass: ["C3", "F3", "A3"],
    displayName: "F Major (2nd Inversion)",
  },
  "F#/C#": {
    treble: ["C#5", "F#5", "A#5"],
    bass: ["C#3", "F#3", "A#3"],
    displayName: "F# Major (2nd Inversion)",
  },
  "Gb/Db": {
    treble: ["Db5", "Gb5", "Bb5"],
    bass: ["Db3", "Gb3", "Bb3"],
    displayName: "Gb Major (2nd Inversion)",
  },
  "G/D": {
    treble: ["D5", "G5", "B5"],
    bass: ["D3", "G3", "B3"],
    displayName: "G Major (2nd Inversion)",
  },
  "Ab/Eb": {
    treble: ["Eb4", "Ab4", "C5"],
    bass: ["Eb3", "Ab3", "C4"],
    displayName: "Ab Major (2nd Inversion)",
  },
  "A/E": {
    treble: ["E4", "A4", "C#5"],
    bass: ["E3", "A3", "C#4"],
    displayName: "A Major (2nd Inversion)",
  },
  "Bb/F": {
    treble: ["F4", "Bb4", "D5"],
    bass: ["F2", "Bb2", "D3"],
    displayName: "Bb Major (2nd Inversion)",
  },
  "B/F#": {
    treble: ["F#4", "B4", "D#5"],
    bass: ["F#2", "B2", "D#3"],
    displayName: "B Major (2nd Inversion)",
  },
  "C#/G#": {
    treble: ["G#4", "C#5", "E#5"],
    bass: ["G#2", "C#3", "E#3"],
    displayName: "C# Major (2nd Inversion)",
  },
  "D#/A#": {
    treble: ["A#4", "D#5", "F##5"],
    bass: ["A#2", "D#3", "F##3"],
    displayName: "D# Major (2nd Inversion)",
  },
  "G#/D#": {
    treble: ["D#5", "G#5", "B#5"],
    bass: ["D#3", "G#3", "B#3"],
    displayName: "G# Major (2nd Inversion)",
  },
  "A#/E#": {
    treble: ["E#5", "A#5", "C##6"],
    bass: ["E#3", "A#3", "C##4"],
    displayName: "A# Major (2nd Inversion)",
  },

  // --- Minor Triad: 1st Inversion ---
  "Cm/Eb": {
    treble: ["Eb4", "G4", "C5"],
    bass: ["Eb3", "G3", "C4"],
    displayName: "C Minor (1st Inversion)",
  },
  "C#m/E": {
    treble: ["E4", "G#4", "C#5"],
    bass: ["E3", "G#3", "C#4"],
    displayName: "C# Minor (1st Inversion)",
  },
  "Dm/F": {
    treble: ["F4", "A4", "D5"],
    bass: ["F2", "A2", "D3"],
    displayName: "D Minor (1st Inversion)",
  },
  "D#m/F#": {
    treble: ["F#4", "A#4", "D#5"],
    bass: ["F#2", "A#2", "D#3"],
    displayName: "D# Minor (1st Inversion)",
  },
  "Ebm/Gb": {
    treble: ["Gb4", "Bb4", "Eb5"],
    bass: ["Gb2", "Bb2", "Eb3"],
    displayName: "Eb Minor (1st Inversion)",
  },
  "Em/G": {
    treble: ["G4", "B4", "E5"],
    bass: ["G2", "B2", "E3"],
    displayName: "E Minor (1st Inversion)",
  },
  "Fm/Ab": {
    treble: ["Ab4", "C5", "F5"],
    bass: ["Ab2", "C3", "F3"],
    displayName: "F Minor (1st Inversion)",
  },
  "F#m/A": {
    treble: ["A4", "C#5", "F#5"],
    bass: ["A2", "C#3", "F#3"],
    displayName: "F# Minor (1st Inversion)",
  },
  "Gm/Bb": {
    treble: ["Bb4", "D5", "G5"],
    bass: ["Bb2", "D3", "G3"],
    displayName: "G Minor (1st Inversion)",
  },
  "G#m/B": {
    treble: ["B4", "D#5", "G#5"],
    bass: ["B2", "D#3", "G#3"],
    displayName: "G# Minor (1st Inversion)",
  },
  "Am/C": {
    treble: ["C5", "E5", "A5"],
    bass: ["C3", "E3", "A3"],
    displayName: "A Minor (1st Inversion)",
  },
  "A#m/C#": {
    treble: ["C#5", "E#5", "A#5"],
    bass: ["C#3", "E#3", "A#3"],
    displayName: "A# Minor (1st Inversion)",
  },
  "Bbm/Db": {
    treble: ["Db5", "F5", "Bb5"],
    bass: ["Db3", "F3", "Bb3"],
    displayName: "Bb Minor (1st Inversion)",
  },
  "Bm/D": {
    treble: ["D5", "F#5", "B5"],
    bass: ["D3", "F#3", "B3"],
    displayName: "B Minor (1st Inversion)",
  },
  "Dbm/Fb": {
    treble: ["Fb4", "Ab4", "Db5"],
    bass: ["Fb2", "Ab2", "Db3"],
    displayName: "Db Minor (1st Inversion)",
  },
  "Gbm/Bbb": {
    treble: ["Bbb4", "Db5", "Gb5"],
    bass: ["Bbb2", "Db3", "Gb3"],
    displayName: "Gb Minor (1st Inversion)",
  },
  "Abm/Cb": {
    treble: ["Cb5", "Eb5", "Ab5"],
    bass: ["Cb3", "Eb3", "Ab3"],
    displayName: "Ab Minor (1st Inversion)",
  },

  // --- Minor Triad: 2nd Inversion ---
  "Cm/G": {
    treble: ["G4", "C5", "Eb5"],
    bass: ["G2", "C3", "Eb3"],
    displayName: "C Minor (2nd Inversion)",
  },
  "C#m/G#": {
    treble: ["G#4", "C#5", "E5"],
    bass: ["G#2", "C#3", "E3"],
    displayName: "C# Minor (2nd Inversion)",
  },
  "Dm/A": {
    treble: ["A4", "D5", "F5"],
    bass: ["A2", "D3", "F3"],
    displayName: "D Minor (2nd Inversion)",
  },
  "D#m/A#": {
    treble: ["A#4", "D#5", "F#5"],
    bass: ["A#2", "D#3", "F#3"],
    displayName: "D# Minor (2nd Inversion)",
  },
  "Ebm/Bb": {
    treble: ["Bb4", "Eb5", "Gb5"],
    bass: ["Bb2", "Eb3", "Gb3"],
    displayName: "Eb Minor (2nd Inversion)",
  },
  "Em/B": {
    treble: ["B4", "E5", "G5"],
    bass: ["B2", "E3", "G3"],
    displayName: "E Minor (2nd Inversion)",
  },
  "Fm/C": {
    treble: ["C5", "F5", "Ab5"],
    bass: ["C3", "F3", "Ab3"],
    displayName: "F Minor (2nd Inversion)",
  },
  "F#m/C#": {
    treble: ["C#5", "F#5", "A5"],
    bass: ["C#3", "F#3", "A3"],
    displayName: "F# Minor (2nd Inversion)",
  },
  "Gm/D": {
    treble: ["D5", "G5", "Bb5"],
    bass: ["D3", "G3", "Bb3"],
    displayName: "G Minor (2nd Inversion)",
  },
  "G#m/D#": {
    treble: ["D#5", "G#5", "B5"],
    bass: ["D#3", "G#3", "B3"],
    displayName: "G# Minor (2nd Inversion)",
  },
  "Am/E": {
    treble: ["E4", "A4", "C5"],
    bass: ["E3", "A3", "C4"],
    displayName: "A Minor (2nd Inversion)",
  },
  "A#m/E#": {
    treble: ["E#5", "A#5", "C#6"],
    bass: ["E#3", "A#3", "C#4"],
    displayName: "A# Minor (2nd Inversion)",
  },
  "Bbm/F": {
    treble: ["F4", "Bb4", "Db5"],
    bass: ["F2", "Bb2", "Db3"],
    displayName: "Bb Minor (2nd Inversion)",
  },
  "Bm/F#": {
    treble: ["F#4", "B4", "D5"],
    bass: ["F#2", "B2", "D3"],
    displayName: "B Minor (2nd Inversion)",
  },
  "Dbm/Ab": {
    treble: ["Ab4", "Db5", "Fb5"],
    bass: ["Ab2", "Db3", "Fb3"],
    displayName: "Db Minor (2nd Inversion)",
  },
  "Gbm/Db": {
    treble: ["Db5", "Gb5", "Bbb5"],
    bass: ["Db3", "Gb3", "Bbb3"],
    displayName: "Gb Minor (2nd Inversion)",
  },
  "Abm/Eb": {
    treble: ["Eb5", "Ab5", "Cb6"],
    bass: ["Eb3", "Ab3", "Cb4"],
    displayName: "Ab Minor (2nd Inversion)",
  },

  "C7/E": {
    treble: ["E4", "Bb4", "C5"],
    bass: ["E3", "Bb3", "C4"],
    displayName: "C Dominant 7th (1st Inv, no 5)",
  },
  "C#7/E#": {
    treble: ["E#4", "B4", "C#5"],
    bass: ["E#3", "B3", "C#4"],
    displayName: "C# Dominant 7th (1st Inv, no 5)",
  },
  "Db7/F": {
    treble: ["F4", "Cb5", "Db5"],
    bass: ["F2", "Cb3", "Db3"],
    displayName: "Db Dominant 7th (1st Inv, no 5)",
  },
  "D7/F#": {
    treble: ["F#4", "C5", "D5"],
    bass: ["F#2", "C3", "D3"],
    displayName: "D Dominant 7th (1st Inv, no 5)",
  },
  "D#7/F##": {
    treble: ["F##4", "C#5", "D#5"],
    bass: ["F##2", "C#3", "D#3"],
    displayName: "D# Dominant 7th (1st Inv, no 5)",
  },
  "Eb7/G": {
    treble: ["G4", "Db5", "Eb5"],
    bass: ["G2", "Db3", "Eb3"],
    displayName: "Eb Dominant 7th (1st Inv, no 5)",
  },
  "E7/G#": {
    treble: ["G#4", "D5", "E5"],
    bass: ["G#2", "D3", "E3"],
    displayName: "E Dominant 7th (1st Inv, no 5)",
  },
  "F7/A": {
    treble: ["A4", "Eb5", "F5"],
    bass: ["A2", "Eb3", "F3"],
    displayName: "F Dominant 7th (1st Inv, no 5)",
  },
  "F#7/A#": {
    treble: ["A#4", "E5", "F#5"],
    bass: ["A#2", "E3", "F#3"],
    displayName: "F# Dominant 7th (1st Inv, no 5)",
  },
  "Gb7/Bb": {
    treble: ["Bb4", "Fb5", "Gb5"],
    bass: ["Bb2", "Fb3", "Gb3"],
    displayName: "Gb Dominant 7th (1st Inv, no 5)",
  },
  "G7/B": {
    treble: ["B4", "F5", "G5"],
    bass: ["B2", "F3", "G3"],
    displayName: "G Dominant 7th (1st Inv, no 5)",
  },
  "G#7/B#": {
    treble: ["B#4", "F#5", "G#5"],
    bass: ["B#2", "F#3", "G#3"],
    displayName: "G# Dominant 7th (1st Inv, no 5)",
  },
  "Ab7/C": {
    treble: ["C5", "Gb5", "Ab5"],
    bass: ["C3", "Gb3", "Ab3"],
    displayName: "Ab Dominant 7th (1st Inv, no 5)",
  },
  "A7/C#": {
    treble: ["C#5", "G5", "A5"],
    bass: ["C#3", "G3", "A3"],
    displayName: "A Dominant 7th (1st Inv, no 5)",
  },
  "A#7/C##": {
    treble: ["C##5", "G#5", "A#5"],
    bass: ["C##3", "G#3", "A#3"],
    displayName: "A# Dominant 7th (1st Inv, no 5)",
  },
  "Bb7/D": {
    treble: ["D5", "Ab5", "Bb5"],
    bass: ["D3", "Ab3", "Bb3"],
    displayName: "Bb Dominant 7th (1st Inv, no 5)",
  },
  "B7/D#": {
    treble: ["D#5", "A5", "B5"],
    bass: ["D#3", "A3", "B3"],
    displayName: "B Dominant 7th (1st Inv, no 5)",
  },
};
export const chordGroups = [
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
      "Bbmmin6",
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

const UNIFIED_CHORD_DEFINITIONS = {
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

export { chordDefinitions, UNIFIED_CHORD_DEFINITIONS };

// --- Diatonic Chord Labels & Qualities (Moved from helperfunctions.js) ---
export const majorDiatonicLabels = {
  intervals: [0, 2, 4, 5, 7, 9, 11],
  labels: ["I", "ii", "iii", "IV", "V", "vi", "7°"],
};
export const minorDiatonicLabels = {
  intervals: [0, 2, 3, 5, 7, 8, 10],
  labels: ["i", "ii°", "III", "iv", "v", "VI", "7"],
};

export const diatonicChordQualities = {
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

// FIX: Added thresholds for dotted notes to allow quantization when recording from performance.
export const DURATION_THRESHOLDS = {
  q: 550,
  "q.": 825,
  h: 1100,
  "h.": 1650,
  w: 2200,
};

export const DURATIONS = [
  // { key: 'w.', name: 'Dotted Whole', beatValue: 6 },
  { key: "w", name: "Whole", beatValue: 4 },
  { key: "h.", name: "Dotted Half", beatValue: 3 },
  { key: "h", name: "Half", beatValue: 2 },
  { key: "q.", name: "Dotted Quarter", beatValue: 1.5 },
  { key: "q", name: "Quarter", beatValue: 1 },
  { key: "8.", name: "Dotted Eighth", beatValue: 0.75 },
  { key: "8", name: "Eighth", beatValue: 0.5 },
  { key: "16.", name: "Dotted Sixteenth", beatValue: 0.375 },
  { key: "16", name: "Sixteenth", beatValue: 0.25 },
  //{ key: '32.', name: 'Dotted Thirty-second', beatValue: 0.1875 },
  //{ key: '32', name: 'Thirty-second', beatValue: 0.125 },
];

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
