"""Keys: parsing, estimating from notes, and spelling pitches for a key."""

import re
from collections import defaultdict

from .model import Key

NATURAL = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
LETTERS = "CDEFGAB"
ACCIDENTAL = {"": 0, "n": 0, "#": 1, "##": 2, "b": -1, "bb": -2}
SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

# Accidentals in the key signature: positive = sharps, negative = flats.
MAJOR_SIG = {"C": 0, "G": 1, "D": 2, "A": 3, "E": 4, "B": 5, "F#": 6, "C#": 7,
             "F": -1, "Bb": -2, "Eb": -3, "Ab": -4, "Db": -5, "Gb": -6, "Cb": -7}
MINOR_SIG = {"A": 0, "E": 1, "B": 2, "F#": 3, "C#": 4, "G#": 5, "D#": 6, "A#": 7,
             "D": -1, "G": -2, "C": -3, "F": -4, "Bb": -5, "Eb": -6, "Ab": -7}
# Majors with no key signature of their own (PianoTour reads these as flats).
MAJOR_ENHARMONIC = {"A#": "Bb", "D#": "Eb", "G#": "Ab"}

# Tonic spelling per pitch class when a key is estimated rather than given.
MAJOR_BY_PC = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
MINOR_BY_PC = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"]

NOTE_RE = re.compile(r"^([A-G])(##|bb|#|b|n)?(-?\d+)$")


def note_to_midi(name):
    m = NOTE_RE.match(name.strip())
    if not m:
        raise ValueError(f"bad note name {name!r}")
    letter, acc, octave = m.groups()
    return (int(octave) + 1) * 12 + NATURAL[letter] + ACCIDENTAL[acc or ""]


def parse_key(text, minor=False):
    """"G", "Em", "Bb minor", "F# Major" -> Key. `minor` is PianoTour's isMinorChordMode."""
    raw = (text or "C").strip()
    m = re.match(r"^([A-Ga-g])(#|b|\s*sharp|\s*flat)?\s*(m|min|minor|maj|major)?$", raw, re.I)
    if not m:
        raise ValueError(f"unknown key {text!r}")
    acc = (m.group(2) or "").strip().lower()
    acc = {"sharp": "#", "flat": "b"}.get(acc, acc)
    tonic = m.group(1).upper() + acc
    quality = (m.group(3) or "").lower()
    is_minor = minor or quality in ("m", "min", "minor")
    if not is_minor:
        tonic = MAJOR_ENHARMONIC.get(tonic, tonic)
    table = MINOR_SIG if is_minor else MAJOR_SIG
    if tonic not in table:
        raise ValueError(f"unknown key {text!r}")
    return Key(tonic, is_minor)


def signature(key):
    return (MINOR_SIG if key.minor else MAJOR_SIG)[key.tonic]


def spelling_table(key):
    """Pitch class -> (letter, accidental) for every pitch class in this key."""
    sig = signature(key)
    sharps = set("FCGDAEB"[:sig]) if sig > 0 else set()
    flats = set("BEADGCF"[:-sig]) if sig < 0 else set()

    table = {}
    letter_acc = {}
    for letter in LETTERS:
        acc = 1 if letter in sharps else -1 if letter in flats else 0
        letter_acc[letter] = acc
        table[(NATURAL[letter] + acc) % 12] = (letter, acc)

    if key.minor:
        # Raised 7th (harmonic minor): G# in A minor, C# in D minor.
        seventh = LETTERS[(LETTERS.index(key.tonic[0]) + 6) % 7]
        acc = letter_acc[seventh] + 1
        table[(NATURAL[seventh] + acc) % 12] = (seventh, acc)

    # Out-of-key notes: the usual chromatic spelling by scale degree, as
    # (semitones above the tonic) -> (degree, raise or lower that degree's note).
    # Major: #1 b3 #4 #5 b7 (C# Eb F# G# Bb in C). Minor: b2 #3 #4 #6 (Bb C# D# F# in A minor).
    chromatic = ({1: (2, -1), 4: (3, 1), 6: (4, 1), 9: (6, 1)} if key.minor
                 else {1: (1, 1), 3: (3, -1), 6: (4, 1), 8: (5, 1), 10: (7, -1)})
    tonic_index = LETTERS.index(key.tonic[0])
    tonic_pc = (NATURAL[key.tonic[0]] + ACCIDENTAL[key.tonic[1:]]) % 12
    for offset, (degree, shift) in chromatic.items():
        pc = (tonic_pc + offset) % 12
        if pc in table:
            continue
        letter = LETTERS[(tonic_index + degree - 1) % 7]
        acc = letter_acc[letter] + shift
        if abs(acc) <= 1 and (NATURAL[letter] + acc) % 12 == pc:
            table[pc] = (letter, acc)

    # Anything left (or that would need a double accidental): plain sharps or flats.
    names = SHARP_NAMES if sig >= 0 else FLAT_NAMES
    for pc in range(12):
        if pc not in table:
            name = names[pc]
            table[pc] = (name[0], ACCIDENTAL[name[1:]])
    return table


def spell_pitch(midi, table):
    letter, acc = table[midi % 12]
    octave = (midi - NATURAL[letter] - acc) // 12 - 1
    mark = {-2: "bb", -1: "b", 0: "", 1: "#", 2: "##"}[acc]
    return f"{letter}{mark}{octave}"


def spell_score(score):
    table = spelling_table(score.key)
    for measure in score.measures:
        for events in measure.staves.values():
            for e in events:
                e.names = [spell_pitch(p, table) for p in e.pitches]


# Krumhansl-Kessler key profiles.
MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]


def _correlation(xs, ys):
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = (sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys)) ** 0.5
    return num / den if den else 0.0


def estimate_key(notes):
    """Best-matching key for [(pitch, duration_beats), ...], weighted by duration."""
    weights = defaultdict(float)
    for pitch, dur in notes:
        weights[pitch % 12] += float(dur)
    hist = [weights[pc] for pc in range(12)]
    if not any(hist):
        return Key("C")
    best = None
    for tonic in range(12):
        rotated = hist[tonic:] + hist[:tonic]
        for minor, profile in ((False, MAJOR_PROFILE), (True, MINOR_PROFILE)):
            r = _correlation(rotated, profile)
            if best is None or r > best[0]:
                best = (r, tonic, minor)
    _, tonic, minor = best
    return Key((MINOR_BY_PC if minor else MAJOR_BY_PC)[tonic], minor)
