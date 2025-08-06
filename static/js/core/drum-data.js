// core/drum-data.js

// Access VexFlow components directly from the global Vex.Flow object
// assuming it's loaded via a script tag in index.html
// Ensure Vex.Flow is available globally before this module attempts to use it.
const { StaveNote, Stem, Annotation, Articulation, Stroke } = Vex.Flow;

/**
 * DRUM_INSTRUMENT_MAP defines the visual and structural properties for each drum kit element
 * when rendered on a single 5-line percussion staff using VexFlow.
 * The 'keys' property defines the vertical position on the staff using "note/octave" strings (e.g., "F/3" for kick drum).
 * These are string representations of note pitches that VexFlow uses for vertical placement,
 * NOT necessarily their melodic pitch value.
 * 'notehead' defines custom notehead shapes (e.g., 'x', 'triangle').
 * 'stemDirection' defines the stem direction (up or down) using `Stem.UP`, `Stem.DOWN`, `Stem.NONE`.
 * 'modifiers' define VexFlow articulations or custom annotations for specific techniques.
 * 'isRest' indicates if the element is a rest.
 */
// core/drum-data.js
export const DRUM_INSTRUMENT_MAP = {
  "bongo-low": {
    name: "Low Bongo",
    keys: ["D/3"], // Assigned to the lowest available note for low percussion.
    notehead: "x",
    stemDirection: 1,
    midi: 61,
    filename: "BONGOLO.wav",
  },
  "bass-kick": {
    name: "Bass Kick",
    keys: ["E/3"], // Positioned just above the lowest note, distinct from the main kick.
    notehead: "x",
    stemDirection: 1,
    midi: 35,
    filename: "BOXKICK.wav",
  },
  "kick": {
    name: "Kick Drum",
    keys: ["F/3"], // Traditional bass drum position, low on the staff.
    notehead: "x",
    stemDirection: 1,
    midi: 36,
    filename: "kick.wav",
  },
  "rimshot": {
    name: "Rimshot",
    keys: ["G/3"], // Placed distinct from the snare, but in a related lower-mid range.
    notehead: "x",
    stemDirection: 1,
    midi: 40,
    filename: "rim.wav",
  },
  "bongo-high": {
    name: "High Bongo",
    keys: ["A/3"], // Positioned above the low bongo to maintain relative pitch.
    notehead: "x",
    stemDirection: 1,
    midi: 60,
    filename: "BONGOHI.wav",
  },
  "clap": {
    name: "Clap",
    keys: ["B/3"], // A mid-low auxiliary percussion sound.
    notehead: "x",
    stemDirection: 1,
    midi: 39,
    filename: "clap.wav",
  },
  "snare": {
    name: "Snare Drum",
    keys: ["C/4"], // Traditional snare drum position, in the middle of the staff.
    notehead: "x",
    stemDirection: 1,
    midi: 38,
    filename: "snare.wav",
  },
  "conga": {
    name: "Conga",
    keys: ["D/4"], // A mid-range auxiliary percussion sound.
    notehead: "x",
    stemDirection: 1,
    midi: 62,
    filename: "conga.wav",
  },
  "claves": {
    name: "Claves",
    keys: ["E/4"], // Another mid-range auxiliary sound.
    notehead: "x",
    stemDirection: 1,
    midi: 75,
    filename: "claves.wav",
  },
  "tom-low": {
    name: "Low Tom",
    keys: ["F/4"], // The lowest tom, placed above the snare and other lower percussion.
    notehead: "x",
    stemDirection: 1,
    midi: 45,
    filename: "low-tom.wav",
  },
  "tom-mid": {
    name: "Mid Tom",
    keys: ["G/4"], // The middle tom, maintaining relative pitch to other toms.
    notehead: "x",
    stemDirection: -1,
    midi: 47,
    filename: "MIDTOM.wav",
  },
  "tom-high": {
    name: "High Tom",
    keys: ["A/4"], // The highest tom, maintaining relative pitch.
    notehead: "x",
    stemDirection: -1,
    midi: 48,
    filename: "high-tom.wav",
  },
  "rest": {
    name: "Rest",
    keys: ["B/4"], // Default rest position within the specified range.
    notehead: "r",
    stemDirection: 0,
    midi: null,
  },
  "shaker": {
    name: "Shaker",
    keys: ["C/5"], // A higher auxiliary percussion sound.
    notehead: "x",
    stemDirection: -1,
    midi: 82,
    filename: "shaker.wav",
  },
  "cowbell": {
    name: "Cowbell",
    keys: ["D/5"], // Traditionally placed high on the staff.
    notehead: "x",
    stemDirection: 1,
    midi: 56,
    filename: "cowbell.wav",
  },
  "hihat-closed": {
    name: "Closed Hi-Hat",
    keys: ["E/5"], // A unique high position, separate from the open hi-hat.
    notehead: "x",
    stemDirection: -1,
    modifiers: [],
    midi: 42,
    filename: "hihat-closed.wav",
  },
  "hihat-open": {
    name: "Open Hi-Hat",
    keys: ["F/5"], // Placed adjacent to the closed hi-hat for visual grouping.
    notehead: "x",
    stemDirection: -1,
    modifiers: [],
    midi: 46,
    filename: "hihat-open.wav",
  },
  "sidestick": {
    name: "Stick",
    keys: ["G/5"], // Placed high to visually differentiate its "click" sound from the snare.
    notehead: "x",
    stemDirection: -1,
    midi: 37,
    filename: "sidestick.wav",
  },
  "cymbal": {
    name: "Cymbal",
    keys: ["A/5"], // A general cymbal sound, placed high and distinct from crash and ride.
    notehead: "x",
    stemDirection: -1,
    midi: 55,
    filename: "cymbal.wav",
  },
  "crash": {
    name: "Crash Cymbal",
    keys: ["B/5"], // Traditional crash cymbal position, high on the staff.
    notehead: "x",
    stemDirection: -1,
    midi: 49,
    filename: "crash.wav",
  },
  "ride": {
    name: "Ride Cymbal",
    keys: ["C/6"], // Traditional ride cymbal position, the highest note on the staff.
    notehead: "x",
    stemDirection: -1,
    midi: 51,
    filename: "ride.wav",
  },
};

/**
 * DRUM_MIDI_MAP maps the VexFlow 'keys' string (representing vertical staff position)
 * to the corresponding General MIDI (GM) drum note number for audio playback.
 * These are standard GM numbers. Note that some visual "keys" might map to the same
 * MIDI note if they represent the same physical drum sound (e.g., different hi-hat articulations
 * like open/closed/pedal will likely all be "G/4" for visual positioning, but need
 * to map to different MIDI notes for playback). The `drumsScorePlayback.js`
 * will need to use the `drumInstrument` property to determine the *actual* MIDI note to trigger.
 */
export const DRUM_MIDI_MAP = {
    // Standard GM Drum Map (common assignments)
    "F/3": 36, // Bass Drum 1 (often for Kick)
    "C/4": 38, // Acoustic Snare
    "E/4": 48, // High-Mid Tom
    "D/4": 47, // Low-Mid Tom (or Mid Tom)
    "A/3": 43, // Low Tom (or Floor Tom)

    // Hi-Hats - these map to the visual 'keys' but playback needs `drumInstrument` check
    "G/4": 42, // Default: Closed Hi-Hat (MIDI 42) for G/4 visual position
    // Playback will explicitly map drumInstrument to MIDI:
    // "hihat-open" -> MIDI 46
    // "hihat-pedal" -> MIDI 44

    // Cymbals
    "C/5": 49, // Crash Cymbal 1
    "D/5": 55, // Splash Cymbal
    "E/5": 52, // China Cymbal

    // Other Percussion (example mappings, can vary widely)
    "B/4": 81, // Default for rests, won't typically play a sound
    "D/3": 64, // Low Gong (mapped to D/3 for visual clarity)
    "A/4": 75, // High Wood Block (mapped to A/4 for visual clarity)
};

/**
 * DRUM_Y_POSITIONS_MAP maps approximate VexFlow 'keys' (representing vertical staff position)
 * to the corresponding drum instrument keys string. This is used for interactive note placement (drag-and-drop).
 * This map uses the same 'keys' strings as used in `DRUM_INSTRUMENT_MAP` for consistency.
 * The order here implicitly defines the "nearest" instrument when dropping a note vertically.
 */
export const DRUM_Y_POSITIONS_MAP = [
    // Top ledger lines/spaces (higher on staff)
    { instrumentKey: "E/5", drumInstrument: "china" },      // Second ledger line above
    { instrumentKey: "D/5", drumInstrument: "splash" },     // Above first ledger line
    { instrumentKey: "C/5", drumInstrument: "crash" },      // First ledger line above
    { instrumentKey: "C/5", drumInstrument: "triangle" },   // Triangle can also be here

    // Staff lines/spaces (from top to bottom of the 5-line staff)
    { instrumentKey: "G/4", drumInstrument: "ride" },       // Top line/space (Hi-hat/Ride line)
    { instrumentKey: "G/4", drumInstrument: "hihat-closed" }, // Hi-hats and Ride often share the top position
    { instrumentKey: "G/4", drumInstrument: "cowbell" },    // Cowbell also often on top space/line
    { instrumentKey: "F/4", drumInstrument: "tom-high" },   // Second space from top
    { instrumentKey: "E/4", drumInstrument: "tom-mid" },    // Second line from top
    { instrumentKey: "D/4", drumInstrument: "snare" },      // Middle space (Snare drum)
    { instrumentKey: "C/4", drumInstrument: "tom-low" },    // Third line from top
    { instrumentKey: "B/3", drumInstrument: "kick" },       // Bottom space (Kick drum)
    { instrumentKey: "A/3", drumInstrument: "hihat-pedal" },// Hi-Hat pedal (bottom line/space)
    { instrumentKey: "D/3", drumInstrument: "gong" },       // Ledger line below staff for gong
];

console.log("✓ core/drum-data.js loaded successfully");