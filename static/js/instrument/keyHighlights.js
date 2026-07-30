// keyHighlights.js - Single owner for the "pressed" highlight on piano keys.
//
// Why this exists
// ---------------
// The `pressed` class is currently added and removed from eight different
// places, none of which record what they painted. Releases are unconditional,
// so overlapping sources clear each other's highlights, and the strum paths
// never release at all - they get swept up later by the bulk cleanup in
// stopPlayback(). This module makes that state explicit and reference counted.
//
// Every highlight is tagged with the SOURCE that asked for it. A key stays lit
// until every source holding it has let go, so a guitar strum can clear its own
// keys without darkening a piano key the user is still holding.
//
// Dependency shape
// ----------------
// This is a leaf: it imports appState (which imports nothing) and note-data
// (which imports only appState). Nothing imports it back, so it can be pulled
// into playbackHelpers, instrumentHelpers, guitarInstrument, scorePlayback and
// the drums files without creating an import cycle. Keep it that way - if this
// module ever needs to import a UI or playback module, the dependency belongs
// in the caller instead.
//
// Scope
// -----
// Owns `pressed` only. The chord role classes (chord-root/third/fifth/...) are
// deliberately left alone: they are shared with chord mode via
// pianoState.chordHi, and untangling that ownership is a separate change.

import { pianoState, drumsState } from "../core/appState.js";
import { normalizeNoteName, NOTES_BY_NAME } from "../core/note-data.js";

const PRESSED_CLASS = "pressed";

/**
 * Named sources. Use these rather than raw strings so a typo can't silently
 * create a source that nothing ever clears.
 */
export const KEY_SOURCE = {
  KEYBOARD: "keyboard",       // computer keyboard / mouse on the piano keys
  GUITAR: "guitar",           // guitar strings, strums and rakes
  DRUMS: "drums",             // drum pads
  PLAYBACK: "playback",       // score playback transport
  PLAY_ALONG: "play-along",   // play-along accompaniment
  CHORD: "chord",             // diatonic / scale chord triggers

  // Catch-all for call sites that haven't been given a specific source yet.
  // Sharing one tag reproduces today's behavior for those paths - they can
  // still clear each other - so migrating a path to its own source is a strict
  // improvement that can be done one at a time.
  DEFAULT: "default"
};

/**
 * Which element map to paint into. The piano and the drums keep separate
 * noteEls maps on appState, so callers on the drums page must say so.
 */
export const KEY_TARGET = {
  PIANO: "piano",
  DRUMS: "drums"
};

/**
 * Live state: midi -> Set of source names currently holding that key lit.
 *
 * Keyed by MIDI rather than by element on purpose. initializeInstrumentUI()
 * rebuilds the keyboard and replaces pianoState.noteEls wholesale, which would
 * strand any element references we held. MIDI numbers survive that.
 */
const pressedByMidi = new Map();

/**
 * The midi -> element map for a target.
 * @param {string} target - one of KEY_TARGET
 * @returns {Object<number, Element>}
 */
function resolveKeyElementMap(target) {
  return (target === KEY_TARGET.DRUMS ? drumsState.noteEls : pianoState.noteEls) || {};
}

/**
 * Resolve the SVG key element for a midi number.
 * @param {number} midi
 * @param {string} target - one of KEY_TARGET
 * @returns {Element|null}
 */
function resolveKeyElement(midi, target) {
  return resolveKeyElementMap(target)[midi] || null;
}

/**
 * Accepts note names ("C4", "Bb3"), midi numbers, or a mix of both, and
 * returns a de-duplicated array of midi numbers. Unknown values are dropped.
 * @param {string|number|Array<string|number>} notes
 * @returns {number[]}
 */
export function toMidiList(notes) {
  if (notes === null || notes === undefined) return [];

  const list = Array.isArray(notes) ? notes : [notes];
  const midis = [];

  for (const note of list) {
    let midi;

    if (typeof note === "number") {
      midi = note;
    } else if (typeof note === "string") {
      // A numeric string is a midi number, not a note name.
      midi = /^\d+$/.test(note)
        ? parseInt(note, 10)
        : NOTES_BY_NAME[normalizeNoteName(note)];
    }

    if (Number.isInteger(midi) && !midis.includes(midi)) {
      midis.push(midi);
    }
  }

  return midis;
}

/**
 * Light the given keys on behalf of a source.
 *
 * Calling twice from the same source is a no-op rather than an error, so
 * re-triggering a note that is already sounding won't corrupt the count.
 *
 * @param {string|number|Array<string|number>} notes - note names and/or midis
 * @param {string} source - one of KEY_SOURCE
 * @param {{target?: string}} [options]
 * @returns {number[]} the midis that are now lit by this call
 */
export function addPressed(notes, source, options = {}) {
  const { target = KEY_TARGET.PIANO } = options;
  const midis = toMidiList(notes);

  for (const midi of midis) {
    let holders = pressedByMidi.get(midi);

    if (!holders) {
      holders = new Set();
      pressedByMidi.set(midi, holders);
    }

    holders.add(source);
    resolveKeyElement(midi, target)?.classList.add(PRESSED_CLASS);
  }

  return midis;
}

/**
 * Release the given keys on behalf of a source. The highlight only comes off
 * once no source is holding it.
 *
 * Pass null for `notes` to release everything this source is holding - useful
 * for a strum, which has no natural per-string release, and for replacing the
 * bulk sweeps that currently strip every key on the board.
 *
 * @param {string|number|Array<string|number>|null} notes - null means "all"
 * @param {string} source - one of KEY_SOURCE
 * @param {{target?: string}} [options]
 * @returns {number[]} the midis that actually went dark
 */
export function clearPressed(notes, source, options = {}) {
  const { target = KEY_TARGET.PIANO } = options;

  const midis = notes === null || notes === undefined
    ? [...pressedByMidi.keys()]
    : toMidiList(notes);

  const darkened = [];

  for (const midi of midis) {
    const holders = pressedByMidi.get(midi);
    if (!holders || !holders.delete(source)) continue;

    // Someone else still wants this key lit.
    if (holders.size > 0) continue;

    pressedByMidi.delete(midi);
    resolveKeyElement(midi, target)?.classList.remove(PRESSED_CLASS);
    darkened.push(midi);
  }

  return darkened;
}

/**
 * Unconditionally darken every key, ignoring who is holding what.
 *
 * This is the escape hatch for a hard stop (transport stop, instrument change,
 * panic). Prefer clearPressed(null, source) in normal flow - a blanket clear is
 * what causes one subsystem to wipe another's highlights.
 *
 * Sweeps the whole element map rather than only the tracked keys, because
 * several call sites still add `pressed` directly without going through this
 * module (the drum pads, the keyboard drag handlers, the spessa build). Those
 * would otherwise survive a hard stop that used to clear them.
 *
 * @param {{target?: string}} [options]
 */
export function clearAllPressed(options = {}) {
  const { target = KEY_TARGET.PIANO } = options;

  for (const el of Object.values(resolveKeyElementMap(target))) {
    el?.classList.remove(PRESSED_CLASS);
  }

  pressedByMidi.clear();
}

/**
 * Drop all tracking without touching the DOM.
 *
 * Call after the keyboard is rebuilt (initializeInstrumentUI replaces
 * pianoState.noteEls), where the old elements are gone and the new ones start
 * unpainted, so tracked state would be describing keys that no longer exist.
 */
export function resetPressedTracking() {
  pressedByMidi.clear();
}

/**
 * @param {string|number} note
 * @returns {boolean} whether any source is currently holding this key lit
 */
export function isPressed(note) {
  const [midi] = toMidiList(note);
  return midi !== undefined && pressedByMidi.has(midi);
}

/**
 * @param {string|number} note
 * @returns {string[]} the sources currently holding this key lit
 */
export function getPressedSources(note) {
  const [midi] = toMidiList(note);
  const holders = midi === undefined ? null : pressedByMidi.get(midi);
  return holders ? [...holders] : [];
}

/**
 * @returns {number} how many keys are currently lit
 */
export function getPressedCount() {
  return pressedByMidi.size;
}

/**
 * Plain-object snapshot for debugging: { midi: [sources] }.
 * @returns {Object<number, string[]>}
 */
export function getPressedSnapshot() {
  const snapshot = {};
  for (const [midi, holders] of pressedByMidi) {
    snapshot[midi] = [...holders];
  }
  return snapshot;
}
