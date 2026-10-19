"""MIDI file -> Score."""

from dataclasses import dataclass, field
from fractions import Fraction

import mido

from .keys import estimate_key, parse_key, spell_score
from .layout import TimedNote, build_measures
from .model import Score

DRUM_CHANNEL = 9  # channel 10 in 1-based numbering


@dataclass
class RawNote:
    track: int
    channel: int
    pitch: int
    start: Fraction
    end: Fraction
    velocity: int


@dataclass
class MidiData:
    notes: list[RawNote]
    parts: list[dict]
    ppq: int = 480
    tempos: list[tuple[Fraction, float]] = field(default_factory=list)
    time_signatures: list[tuple[Fraction, int, int]] = field(default_factory=list)
    keys: list[tuple[Fraction, str]] = field(default_factory=list)


# General MIDI instrument families, 8 programs each.
GM_FAMILIES = ["Piano", "Chromatic percussion", "Organ", "Guitar", "Bass", "Strings",
               "Ensemble", "Brass", "Reed", "Pipe", "Synth lead", "Synth pad",
               "Synth effects", "Ethnic", "Percussive", "Sound effects"]


def read_midi(path):
    """Read every note with its position in beats (ticks / ticks-per-beat).

    Notes are grouped into parts: one per (track, channel). A type-0 file keeps
    every instrument in one track, so channels are what tell them apart.
    """
    try:
        mf = mido.MidiFile(path)
    except (OSError, EOFError, ValueError, KeyError, IndexError) as e:
        raise ValueError(f"not a readable MIDI file: {path} ({e})") from None
    ppq = mf.ticks_per_beat
    data = MidiData(notes=[], parts=[], ppq=ppq)
    track_names, programs = {}, {}

    for t_index, track in enumerate(mf.tracks):
        tick = 0
        open_notes = {}   # (channel, pitch) -> [(start_tick, velocity), ...]
        for msg in track:
            tick += msg.time
            beat = Fraction(tick, ppq)
            if msg.type == "track_name":
                track_names[t_index] = msg.name.strip()
            elif msg.type == "set_tempo":
                data.tempos.append((beat, mido.tempo2bpm(msg.tempo)))
            elif msg.type == "time_signature":
                data.time_signatures.append((beat, msg.numerator, msg.denominator))
            elif msg.type == "key_signature":
                data.keys.append((beat, msg.key))
            elif msg.type == "program_change":
                programs.setdefault((t_index, msg.channel), msg.program)
            elif msg.type == "note_on" and msg.velocity > 0:
                open_notes.setdefault((msg.channel, msg.note), []).append((tick, msg.velocity))
            elif msg.type in ("note_off", "note_on"):
                stack = open_notes.get((msg.channel, msg.note))
                if stack:
                    start_tick, velocity = stack.pop(0)
                    data.notes.append(RawNote(t_index, msg.channel, msg.note,
                                              Fraction(start_tick, ppq), beat, velocity))

    keys = sorted({(n.track, n.channel) for n in data.notes})
    for number, (track, channel) in enumerate(keys):
        data.parts.append(_part_info(number, track, channel, track_names.get(track, ""),
                                     programs.get((track, channel)), data.notes))
    return data


def _part_info(number, track, channel, name, program, notes):
    pitches = [n.pitch for n in notes if (n.track, n.channel) == (track, channel)]
    drums = channel == DRUM_CHANNEL
    return {
        "part": number,
        "track": track,
        "channel": channel + 1,          # 1-based, as people number them
        "name": name,
        "program": program,
        # No program change means program 0, piano, per the MIDI spec.
        "instrument": "Drums" if drums else GM_FAMILIES[(program or 0) // 8],
        "notes": len(pitches),
        "low": min(pitches),
        "high": max(pitches),
        "drums": drums,
    }


# ---- raw data: the parsed file as JSON, for a two-step import ----
#
# The browser gets this from extract(), shows a part picker, and posts it back
# to quantize() with the parts chosen. Nothing is kept on the server between
# the two calls. Notes travel as integer ticks, so nothing is lost on the way.

RAW_FORMAT = "midi_tools/1"
MAX_RAW_NOTES = 500_000


def _seconds(tick, tempos, ppq):
    """Tick -> seconds through the tempo map (120 BPM until the first tempo event)."""
    total, last_tick, bpm = 0.0, 0, 120.0
    for t, b in tempos:
        if t >= tick:
            break
        total += (t - last_tick) / ppq * 60 / bpm
        last_tick, bpm = t, b
    return total + (tick - last_tick) / ppq * 60 / bpm


def to_raw(data):
    """MidiData -> JSON-ready dict.

    Track entries carry the fields PianoTour's track picker reads (index, name,
    instrument, isDrum, noteCount, startMeasure, pitchRange); each "track" is one
    part (track + channel). Notes are [pitch, startTick, endTick, velocity].
    """
    ppq = data.ppq
    tempos = sorted((int(b * ppq), bpm) for b, bpm in data.tempos)
    sigs = sorted((int(b * ppq), n, d) for b, n, d in data.time_signatures)
    n, d = (sigs[0][1], sigs[0][2]) if sigs else (4, 4)
    bar_ticks = ppq * 4 * n // d

    tracks = []
    for p in data.parts:
        notes = sorted(
            [int(x.start * ppq), int(x.end * ppq), x.pitch, x.velocity]
            for x in data.notes if (x.track, x.channel) == (p["track"], p["channel"] - 1)
        )
        tracks.append({
            "index": p["part"],
            "track": p["track"],
            "channel": p["channel"],
            "name": p["name"] or f"Part {p['part'] + 1}",
            "instrument": p["instrument"],
            "program": p["program"],
            "isDrum": p["drums"],
            "noteCount": p["notes"],
            "startMeasure": notes[0][0] // bar_ticks + 1,
            "pitchRange": {"min": p["low"], "max": p["high"]},
            "notes": [[pitch, start, end, vel] for start, end, pitch, vel in notes],
        })

    last_tick = max((int(x.end * ppq) for x in data.notes), default=0)
    return {
        "format": RAW_FORMAT,
        "ppq": ppq,
        "tracks": tracks,
        "tempos": [[t, round(b, 4)] for t, b in tempos],
        "timeSignatures": [list(s) for s in sigs],
        "keys": [[int(b * ppq), k] for b, k in sorted(data.keys)],
        # For display only; quantize() ignores these.
        "tempoMap": [{"time": round(_seconds(t, tempos, ppq), 6), "bpm": round(b, 3)} for t, b in tempos]
                    or [{"time": 0, "bpm": 120}],
        "duration": round(_seconds(last_tick, tempos, ppq), 6),
    }


def _int(value, low, high, what):
    if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
        raise ValueError(f"raw data: bad {what} {value!r}")
    return value


def from_raw(raw):
    """JSON dict from to_raw() -> MidiData. Raw data comes back from a browser,
    so every field is checked before use."""
    if not isinstance(raw, dict) or raw.get("format") != RAW_FORMAT:
        raise ValueError(f"raw data must be a dict from extract() (format {RAW_FORMAT})")
    ppq = _int(raw.get("ppq"), 1, 32767, "ppq")
    max_tick = 2 ** 31

    def items(name, limit):
        value = raw.get(name, [])
        if not isinstance(value, list) or len(value) > limit:
            raise ValueError(f"raw data: bad {name}")
        return value

    data = MidiData(notes=[], parts=[], ppq=ppq)
    for entry in items("tempos", 10_000):
        tick = _int(entry[0], 0, max_tick, "tempo tick")
        bpm = entry[1]
        if isinstance(bpm, bool) or not isinstance(bpm, (int, float)) or not 1 <= bpm <= 1000:
            raise ValueError(f"raw data: bad bpm {bpm!r}")
        data.tempos.append((Fraction(tick, ppq), float(bpm)))
    for entry in items("timeSignatures", 10_000):
        tick = _int(entry[0], 0, max_tick, "time signature tick")
        num = _int(entry[1], 1, 32, "time signature numerator")
        den = _int(entry[2], 1, 32, "time signature denominator")
        if den & (den - 1):
            raise ValueError(f"raw data: time signature denominator {den} isn't a power of 2")
        data.time_signatures.append((Fraction(tick, ppq), num, den))
    for entry in items("keys", 10_000):
        tick = _int(entry[0], 0, max_tick, "key tick")
        if not isinstance(entry[1], str) or len(entry[1]) > 8:
            raise ValueError("raw data: bad key")
        data.keys.append((Fraction(tick, ppq), entry[1]))

    total = 0
    seen = set()
    for t in items("tracks", 512):
        if not isinstance(t, dict):
            raise ValueError("raw data: bad track")
        number = _int(t.get("index"), 0, 511, "track index")
        track = _int(t.get("track"), 0, 65535, "track number")
        channel = _int(t.get("channel"), 1, 16, "channel") - 1
        if number in seen or (track, channel) in seen:
            raise ValueError(f"raw data: track {number} appears twice")
        seen.update({number, (track, channel)})
        notes = t.get("notes")
        if not isinstance(notes, list) or not notes:
            raise ValueError(f"raw data: track {number} has no notes")
        total += len(notes)
        if total > MAX_RAW_NOTES:
            raise ValueError(f"raw data: more than {MAX_RAW_NOTES} notes")
        for note in notes:
            if not isinstance(note, list) or len(note) != 4:
                raise ValueError("raw data: each note is [pitch, startTick, endTick, velocity]")
            pitch = _int(note[0], 0, 127, "pitch")
            start = _int(note[1], 0, max_tick, "start tick")
            end = _int(note[2], start, max_tick, "end tick")
            velocity = _int(note[3], 0, 127, "velocity")
            data.notes.append(RawNote(track, channel, pitch, Fraction(start, ppq), Fraction(end, ppq), velocity))
        name = t.get("name", "")
        program = t.get("program")
        program = _int(program, 0, 127, "program") if program is not None else None
        info = _part_info(number, track, channel, name if isinstance(name, str) else "", program, data.notes)
        data.parts.append(info)
    return data


def extract(path):
    """Step 1 of a two-step import: read the file, return raw data as JSON."""
    return to_raw(read_midi(path))


def inspect(path):
    """Part summary, for choosing which parts to convert."""
    data = read_midi(path)
    return {
        "parts": data.parts,
        "tempo": round(data.tempos[0][1], 2) if data.tempos else 120,
        "timeSignatures": sorted({f"{n}/{d}" for _, n, d in data.time_signatures}),
        "keys": [k for _, k in sorted(data.keys)],
    }


def _round_to(value, grid):
    return (value / grid + Fraction(1, 2)).__floor__() * grid


def midi_to_score(path, **options):
    """Convert a MIDI file into a Score. Options are score_from_data()'s."""
    return score_from_data(read_midi(path), **options)


def quantize(raw, parts=None, **options):
    """Step 2 of a two-step import: raw data from extract() -> Score.
    Options are score_from_data()'s."""
    return score_from_data(from_raw(raw), parts=parts, **options)


def score_from_data(data, parts=None, grid=Fraction(1, 4), split=60, key=None, trim_leading=True,
                    treble=None, bass=None, legato=True):
    """Turn parsed MIDI data into a Score.

    parts:  part numbers from inspect() to use (default: every part that isn't drums).
    treble, bass: part numbers to put on each staff whole, in place of `parts`
            and the pitch split. Use for a melody that dips below middle C.
    legato: hold played notes through short gaps instead of writing tiny rests.
    grid:   quantize grid in beats (1/4 = sixteenth notes); a multiple of 1/8.
    split:  lowest MIDI pitch on the treble staff (60 = middle C).
    key:    key name to spell with; default is the file's key signature, else estimated.
    """
    grid = Fraction(grid)
    if grid <= 0 or grid % Fraction(1, 8):
        raise ValueError("grid must be a multiple of a 32nd note (1/8 beat)")

    warnings = []
    by_number = {p["part"]: p for p in data.parts}
    if treble is not None or bass is not None:
        parts = list(treble or []) + list(bass or [])
    if parts is None:
        chosen = [p for p in data.parts if not p["drums"]]
    else:
        unknown = [n for n in parts if n not in by_number]
        if unknown:
            raise ValueError(f"no part(s) {unknown}; this file has parts 0-{len(data.parts) - 1}")
        chosen = [by_number[n] for n in parts]
        if any(p["drums"] for p in chosen):
            warnings.append("drum parts were skipped; drums aren't pitched notes")
    wanted = {(p["track"], p["channel"] - 1) for p in chosen if not p["drums"]}
    notes = [n for n in data.notes if (n.track, n.channel) in wanted]
    if not notes:
        raise ValueError("no pitched notes in the chosen parts")

    sigs = sorted(data.time_signatures)
    time_sig = (sigs[0][1], sigs[0][2]) if sigs else (4, 4)
    if len({(n, d) for _, n, d in sigs}) > 1:
        warnings.append(f"time signature changes in the file; using {time_sig[0]}/{time_sig[1]} throughout")
    tempos = sorted(data.tempos)
    tempo = tempos[0][1] if tempos else 120.0
    if len({round(b, 2) for _, b in tempos}) > 1:
        warnings.append(f"tempo changes in the file; using {round(tempo)} BPM")

    # Staff per part when the caller says which parts go where; else split by pitch.
    staff_of_part = {}
    if treble is not None or bass is not None:
        for staff, numbers in (("treble", treble or []), ("bass", bass or [])):
            for number in numbers:
                if number not in by_number:
                    raise ValueError(f"no part {number}; this file has parts 0-{len(data.parts) - 1}")
                p = by_number[number]
                staff_of_part[(p["track"], p["channel"] - 1)] = staff
        notes = [n for n in data.notes if (n.track, n.channel) in staff_of_part and n.channel != DRUM_CHANNEL]
        if not notes:
            raise ValueError("no pitched notes in the chosen parts")

    # Quantize starts and ends separately; every note keeps at least one grid step.
    timed = {"treble": [], "bass": []}
    moved = 0
    for n in notes:
        start, end = _round_to(n.start, grid), _round_to(n.end, grid)
        if end <= start:
            end = start + grid
        if start != n.start:
            moved += 1
        staff = staff_of_part.get((n.track, n.channel)) or ("treble" if n.pitch >= split else "bass")
        timed[staff].append(TimedNote(n.pitch, start, end, n.velocity, exact_end=end == n.end))
    if moved:
        warnings.append(f"quantized {moved} of {len(notes)} note starts to a {grid}-beat grid")

    score = Score(measures=[], tempo=round(tempo), time_signature=time_sig, warnings=warnings)
    score.measures = build_measures(timed, score.measure_length, warnings, legato)

    if trim_leading:
        leading = 0
        for m in score.measures[:-1]:
            if all(e.is_rest for events in m.staves.values() for e in events):
                leading += 1
            else:
                break
        if leading:
            score.measures = score.measures[leading:]
            warnings.append(f"dropped {leading} empty measure(s) at the start")

    if key:
        score.key = parse_key(key)
    elif data.keys:
        score.key = parse_key(sorted(data.keys)[0][1])
    else:
        score.key = estimate_key([(n.pitch, n.end - n.start) for n in notes])
        warnings.append(f"no key signature in the file; estimated {score.key}")
    spell_score(score)
    return score
