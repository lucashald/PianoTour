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
  "kick": {
    name: "Kick Drum",
    keys: ["F/4"], // VexFlow key for rendering (bass clef F3)
    notehead: "x",
    stemDirection: 1, // Down
    midi: 36, // General MIDI Standard for Kick Drum 1 (Acoustic Bass Drum)
    filename: "kick.wav", // Path to your cleaned kick drum sample
  },
  "snare": {
    name: "Snare Drum",
    keys: ["C/5"],
    notehead: "x",
    stemDirection: 1,
    midi: 38, // General MIDI Standard for Acoustic Snare
    filename: "snare.wav", // Path to your cleaned snare drum sample
  },
  "hihat-closed": {
    name: "Closed Hi-Hat",
    keys: ["G#/5"], // VexFlow key for rendering (treble clef C5)
    notehead: "x",
    stemDirection: -1, // Up
    modifiers: [], // Articulation for closed hi-hat
    midi: 42, // General MIDI Standard for Closed Hi-Hat
    filename: "hihat-closed.wav", // Path to your cleaned closed hi-hat sample
  },
  "hihat-open": {
    name: "Open Hi-Hat",
    keys: ["G/5"],
    notehead: "x",
    stemDirection: -1,
    modifiers: [], // Articulation for open hi-hat
    midi: 46, // General MIDI Standard for Open Hi-Hat
    filename: "hihat-open.wav", // Path to your cleaned open hi-hat sample
  },
  "crash": {
    name: "Crash Cymbal",
    keys: ["A/5"], // Typically above staff, C6 is common for Crash 1
    notehead: "x",
    stemDirection: -1,
    midi: 49, // General MIDI Standard for Crash Cymbal 1
    filename: "crash.wav", // Path to your cleaned crash cymbal sample
  },
  "ride": {
    name: "Ride Cymbal",
    keys: ["G/5"], // Typically above staff, G5 is common for Ride 1
    notehead: "x",
    stemDirection: -1,
    midi: 51, // General MIDI Standard for Ride Cymbal 1
    filename: "ride.wav", // Path to your cleaned ride cymbal sample
  },
  "tom-high": {
    name: "High Tom",
    keys: ["E/5"],
    notehead: "x",
    stemDirection: -1,
    midi: 48, // General MIDI Standard for High Tom
    filename: "high-tom.wav", // Path to your cleaned high tom sample
  },
  "tom-low": {
    name: "Low Tom",
    keys: ["A/4"], // Often on E4 or D4
    notehead: "x",
    stemDirection: 1,
    midi: 45, // General MIDI Standard for Low Tom
    filename: "low-tom.wav", // Path to your cleaned low tom sample
  },
  "clap": {
    name: "Clap",
    keys: ["D/4"], // A common position for clap, adjust if needed
    notehead: "x",
    stemDirection: 1,
    midi: 39, // Hand Clap
    filename: "clap.wav", // Path to your cleaned clap sample
  },
  "cowbell": {
    name: "Cowbell",
    keys: ["E/5"], // A common position for cowbell
    notehead: "x",
    stemDirection: 1,
    midi: 56, // Cowbell
    filename: "cowbell.wav", // Path to your cleaned cowbell sample
  },
  "conga": {
    name: "Conga",
    keys: ["A/4"], // A common position for conga (High Conga)
    notehead: "x",
    stemDirection: 1,
    midi: 62, // High Conga
    filename: "conga.wav", // Path to your cleaned conga sample
  },
  "shaker": {
    name: "Shaker",
    keys: ["D/5"], // A common position for shaker
    notehead: "x",
    stemDirection: -1,
    midi: 82, // Shaker (or other percussion if more specific is needed)
    filename: "shaker.wav", // Path to your cleaned shaker sample
  },
  "cymbal": {
    name: "Cymbal",
    keys: ["B/5"],
    notehead: "x",
    stemDirection: -1,
    midi: 55, // Ride Cymbal 2, or a general crash/cymbal sound
    filename: "cymbal.wav",
  },
  "rest": {
    name: "Rest",
    keys: ["B/4"], // Default VexFlow key for rests (will be overridden by duration 'r' suffix)
    notehead: "r", // Not directly used as a notehead, but indicates a rest.
    stemDirection: 0,
    midi: null, // Rests do not have a MIDI number
  },
  "bass-kick": {
    name: "Bass Kick",
    keys: ["E/4"], // Lower than standard kick to differentiate, if needed
    notehead: "x",
    stemDirection: 1,
    midi: 35, // Acoustic Bass Drum (lower octave alternative)
    filename: "BOXKICK.wav",
  },
  "sidestick": {
    name: "Stick",
    keys: ["C/6"], // Often placed high on the staff
    notehead: "x",
    stemDirection: -1,
    midi: 37, // Side Stick
    filename: "sidestick.wav",
  },
  "rimshot": {
    name: "Rimshot",
    keys: ["C/4"], // Same as snare, but can be differentiated with modifiers
    notehead: "x",
    stemDirection: 1,
    midi: 40, // Electric Snare (often used for rimshot if no specific rimshot MIDI)
    filename: "rim.wav",
  },
  "tom-mid": {
    name: "Mid Tom",
    keys: ["D/5"], // Between low and high tom
    notehead: "x",
    stemDirection: -1,
    midi: 47, // Low-Mid Tom
    filename: "MIDTOM.wav",
  },
  "bongo-low": {
    name: "Low Bongo",
    keys: ["A/3"], // Low percussion
    notehead: "x",
    stemDirection: 1,
    midi: 61, // Low Bongo
    filename: "BONGOLO.wav",
  },
  "bongo-high": {
    name: "High Bongo",
    keys: ["C/4"], // High percussion
    notehead: "x",
    stemDirection: 1,
    midi: 60, // High Bongo
    filename: "BONGOHI.wav",
  },
  "claves": {
    name: "Claves",
    keys: ["G/4"], // Common position for claves
    notehead: "x",
    stemDirection: 1,
    midi: 75, // Claves
    filename: "claves.wav",
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