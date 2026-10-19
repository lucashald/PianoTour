"""Score <-> PianoTour's saved-score JSON."""

import re

from .durations import symbol_beats
from .keys import note_to_midi, parse_key
from .model import Event, Measure, Score, STAVES

DEFAULT_REST_NAME = {"treble": "B4", "bass": "D3"}


def to_json(score):
    """Score -> PianoTour JSON (the format /convert-to-json returns)."""
    measures = []
    pending = {s: None for s in STAVES}   # note waiting for its tie partner
    for mi, measure in enumerate(score.measures):
        out = []
        for staff in STAVES:
            for i, e in enumerate(measure.staves[staff]):
                note = {
                    "id": f"m{mi}-{staff}-{i}",
                    "clef": staff,
                    "duration": e.symbol,
                    "measure": mi,
                    "isRest": e.is_rest,
                }
                if e.is_rest:
                    note["name"] = DEFAULT_REST_NAME[staff]
                else:
                    names = e.names or [str(p) for p in e.pitches]
                    note["name"] = names[0] if len(names) == 1 else "(" + " ".join(names) + ")"
                    note["velocity"] = e.velocity
                    if e.performed is not None:
                        note["performedDuration"] = e.performed

                start = pending[staff]
                if start is not None:
                    tie = {"type": "tie", "startNoteId": start["id"], "endNoteId": note["id"]}
                    start["tie"] = tie
                    note.setdefault("tie", dict(tie))
                pending[staff] = note if e.tie_next else None
                out.append(note)
        measures.append(out)

    n, d = score.time_signature
    return {
        "title": score.title,
        "keySignature": score.key.tonic,
        "isMinorChordMode": score.key.minor,
        "tempo": round(score.tempo),
        "timeSignature": {"numerator": n, "denominator": d},
        "instrument": score.instrument,
        "midiChannel": str(score.channel),
        "measures": measures,
    }


def _channel(value):
    """PianoTour sends midiChannel as a number or a string; anything else is channel 0."""
    try:
        channel = int(value)
    except (TypeError, ValueError):
        return 0
    return channel if 0 <= channel <= 15 else 0


def _pitches(name):
    name = name.strip()
    parts = name[1:-1].split() if name.startswith("(") else [name]
    return sorted(note_to_midi(p) for p in parts)


def _number(value, default):
    if isinstance(value, bool):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def from_json(data):
    """PianoTour JSON -> Score. Notes keep the order given in each measure.

    Export shouldn't fail over one odd value, so a bad key, duration or note
    name is replaced with a safe default and reported in score.warnings.
    """
    if isinstance(data, list):
        data = {"measures": data}
    warnings = []
    ts = data.get("timeSignature") or {"numerator": 4, "denominator": 4}
    # The app can carry an octave digit on the key ("C4"); minor is a separate flag.
    key_text = re.sub(r"\d+$", "", str(data.get("keyName") or data.get("keySignature") or "C"))
    try:
        key = parse_key(key_text, minor=bool(data.get("isMinorChordMode")))
    except ValueError:
        warnings.append(f"unknown key {key_text!r}; wrote C major")
        key = parse_key("C")
    tempo = _number(data.get("tempo"), 120)
    score = Score(
        measures=[],
        tempo=tempo if 1 <= tempo <= 1000 else 120,
        time_signature=(int(ts["numerator"]), int(ts["denominator"])),
        key=key,
        title=str(data.get("title") or ""),
        instrument=str(data.get("instrument") or "piano"),
        channel=_channel(data.get("midiChannel")),
        warnings=warnings,
    )
    measure_length = score.measure_length

    for mi, raw in enumerate(data.get("measures", [])):
        measure = Measure()
        raw = [n for n in raw if isinstance(n, dict)]
        for staff in STAVES:
            notes = [n for n in raw if n.get("clef", "treble") == staff]
            for n in notes:
                where = f"measure {mi + 1} {staff}"
                is_rest = bool(n.get("isRest"))
                symbol = str(n.get("duration", "q"))
                try:
                    beats = symbol_beats(symbol)
                except ValueError:
                    warnings.append(f"{where}: unknown duration {symbol!r}; used a quarter")
                    symbol, beats = "q", symbol_beats("q")
                if is_rest and len(notes) == 1 and symbol == "w":
                    beats = measure_length   # lone whole rest = the whole bar, in any meter
                pitches = []
                if not is_rest:
                    try:
                        pitches = _pitches(str(n.get("name", "")))
                    except ValueError:
                        warnings.append(f"{where}: can't read note {n.get('name')!r}; played as a rest")
                velocity = int(_number(n.get("velocity"), 80))
                performed = _number(n.get("performedDuration"), None)
                tie = n.get("tie") if isinstance(n.get("tie"), dict) else {}
                measure.staves[staff].append(Event(
                    pitches=pitches,
                    symbol=symbol,
                    duration=beats,
                    velocity=min(max(velocity, 1), 127),
                    tie_next=bool(pitches) and tie.get("type", "tie") == "tie"
                    and n.get("id") is not None and tie.get("startNoteId") == n.get("id"),
                    performed=performed if performed and 0 < performed <= 8 else None,
                    names=re.findall(r"[A-G][#bn]*-?\d+", str(n.get("name", ""))) if pitches else None,
                ))
        score.measures.append(measure)
    return score
