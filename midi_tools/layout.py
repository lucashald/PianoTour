"""Timed notes on one staff -> measures of notatable events.

Steps per staff: merge notes that start together into chords, cut each chord
off where the next one starts (one voice per staff), fill the gaps with rests,
split at barlines, and spell each piece into note values joined by ties.
"""

from dataclasses import dataclass
from fractions import Fraction

from .durations import spell
from .model import Event, Measure, STAVES


@dataclass
class TimedNote:
    pitch: int
    start: Fraction   # beats from the start of the piece
    end: Fraction
    velocity: int
    exact_end: bool = True   # released exactly on the grid (as notation software writes it)


def _chords(notes):
    """Group notes by start time; each chord lasts until its longest note ends."""
    by_start = {}
    for n in notes:
        by_start.setdefault(n.start, []).append(n)
    chords = []
    for start in sorted(by_start):
        group = by_start[start]
        chords.append({
            "start": start,
            "end": max(n.end for n in group),
            "pitches": sorted({n.pitch for n in group}),
            "velocity": round(sum(n.velocity for n in group) / len(group)),
            "exact_end": all(n.exact_end for n in group),
        })
    return chords


def _timeline(notes, total, warnings, staff, legato=True):
    """Notes -> back-to-back segments (chords and rests) covering [0, total)."""
    chords = _chords(notes)
    if legato:
        # Players lift between notes; written music holds the note instead of
        # adding a tiny rest. Fill a gap when the note was released off the
        # grid (a played release, not a written rest), it sounded for at least
        # half the time until the next note, and the gap is under a beat.
        for this, nxt in zip(chords, chords[1:]):
            gap = nxt["start"] - this["end"]
            span = nxt["start"] - this["start"]
            if not this["exact_end"] and 0 < gap < 1 and this["end"] - this["start"] >= span / 2:
                this["end"] = nxt["start"]
    cut = 0
    for this, nxt in zip(chords, chords[1:]):
        if this["end"] > nxt["start"]:
            this["end"] = nxt["start"]
            cut += 1
    if cut:
        warnings.append(f"{staff}: shortened {cut} note(s) that overlapped the next one (one voice per staff)")

    segments, pos = [], Fraction(0)
    for c in chords:
        if c["start"] > pos:
            segments.append({"start": pos, "end": c["start"], "pitches": [], "velocity": 0})
        segments.append(c)
        pos = c["end"]
    if pos < total:
        segments.append({"start": pos, "end": total, "pitches": [], "velocity": 0})
    return segments


def build_measures(notes_by_staff, measure_length, warnings, legato=True):
    """{"treble": [TimedNote], "bass": [...]} -> list[Measure]."""
    last_end = max((n.end for notes in notes_by_staff.values() for n in notes), default=Fraction(0))
    count = max(1, -(-last_end // measure_length))  # ceiling
    total = count * measure_length
    measures = [Measure() for _ in range(int(count))]

    for staff in STAVES:
        for seg in _timeline(notes_by_staff.get(staff, []), total, warnings, staff, legato):
            pos = seg["start"]
            while pos < seg["end"]:
                index = int(pos // measure_length)
                offset = pos - index * measure_length
                piece_end = min(seg["end"], (index + 1) * measure_length)
                length = piece_end - pos
                is_rest = not seg["pitches"]
                events = measures[index].staves[staff]

                if is_rest and length == measure_length:
                    # A silent bar gets one whole rest, the usual full-measure rest in any meter.
                    events.append(Event([], "w", measure_length))
                else:
                    parts = spell(offset, length, rest=is_rest)
                    for i, (symbol, beats) in enumerate(parts):
                        events.append(Event(
                            list(seg["pitches"]), symbol, beats,
                            velocity=seg["velocity"] or 80,
                            # Tie every piece to the next, including across the barline.
                            tie_next=not is_rest and (i < len(parts) - 1 or piece_end < seg["end"]),
                        ))
                pos = piece_end
    return measures
