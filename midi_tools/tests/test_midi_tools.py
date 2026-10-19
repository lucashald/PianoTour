#!/usr/bin/env python3
"""Tests for midi_tools (MIDI <-> PianoTour score JSON).

    python -m unittest discover -s midi_tools/tests

The same package lives in the music-theory Claude skill, whose tests build
inputs from its compact score format; these use plain PianoTour JSON.
"""

import copy
import json
import sys
import tempfile
import unittest
from fractions import Fraction as F
from pathlib import Path

import mido

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))

import midi_tools  # noqa: E402
from midi_tools.durations import spell  # noqa: E402
from midi_tools.keys import estimate_key, parse_key, spell_pitch, spelling_table  # noqa: E402
from midi_tools.model import Key  # noqa: E402

FIXTURES = HERE / "fixtures"
NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def name_of(pitch):
    return NAMES[pitch % 12] + str(pitch // 12 - 1)


def note(id_, name, duration, clef="treble", **extra):
    return {"id": id_, "name": name, "clef": clef, "duration": duration,
            "isRest": extra.pop("isRest", False), **extra}


def symbols(pos, length, rest=False):
    return [s for s, _ in spell(F(pos), F(length), rest)]


def write_midi(path, parts, ppq=480):
    """parts: [(channel, [(pitch, start_beats, end_beats), ...]), ...], one track each."""
    mf = mido.MidiFile(type=1, ticks_per_beat=ppq)
    for channel, notes in parts:
        events = []
        for pitch, start, end in notes:
            events.append((round(start * ppq), 1, mido.Message("note_on", note=pitch, velocity=90, channel=channel)))
            events.append((round(end * ppq), 0, mido.Message("note_off", note=pitch, velocity=0, channel=channel)))
        track, last = mido.MidiTrack(), 0
        for tick, _, msg in sorted(events, key=lambda e: (e[0], e[1])):
            track.append(msg.copy(time=tick - last))
            last = tick
        mf.tracks.append(track)
    mf.save(path)


def sounding_notes(path):
    """(start_beat, end_beat, pitch, velocity) for every note, sorted."""
    return sorted((n.start, n.end, n.pitch, n.velocity) for n in midi_tools.read_midi(path).notes)


def staff_names(data, staff):
    return [n["name"] + ("/r" if n["isRest"] else "") + "/" + n["duration"]
            for m in data["measures"] for n in m if n["clef"] == staff]


def export(data):
    with tempfile.TemporaryDirectory() as tmp:
        warnings = midi_tools.json_to_midi(data, Path(tmp) / "o.mid")
        return warnings, sounding_notes(Path(tmp) / "o.mid")


class DurationTests(unittest.TestCase):
    def test_values(self):
        self.assertEqual(symbols(0, 4), ["w"])
        self.assertEqual(symbols(0, 3), ["h."])
        self.assertEqual(symbols(1, 2), ["q", "q"])               # no half note from beat 2
        self.assertEqual(symbols(F(1, 2), 1), ["8", "8"])         # offbeat ties into the beat
        self.assertEqual(symbols(F(1, 4), 2), ["16", "8", "q", "16"])
        self.assertEqual(symbols(0, 3, rest=True), ["h", "q"])     # rests never dotted
        with self.assertRaises(ValueError):
            spell(F(0), F(1, 16))


class KeyTests(unittest.TestCase):
    def spell(self, midi, key):
        return spell_pitch(midi, spelling_table(key))

    def test_spelling(self):
        self.assertEqual(self.spell(70, Key("F")), "Bb4")
        self.assertEqual(self.spell(61, Key("F")), "C#4")          # #5: leading tone to D minor
        self.assertEqual(self.spell(70, Key("G")), "Bb4")          # b3
        self.assertEqual(self.spell(71, Key("Gb")), "Cb5")
        self.assertEqual(self.spell(68, Key("A", True)), "G#4")    # raised 7th
        self.assertEqual(self.spell(70, Key("A", True)), "Bb4")    # b2

    def test_parse_and_estimate(self):
        self.assertEqual(parse_key("A", minor=True), Key("A", True))
        self.assertEqual(parse_key("A#"), Key("Bb"))
        c_major = [(p, 1) for p in (60, 62, 64, 65, 67, 69, 71, 72, 67, 64, 60)]
        self.assertEqual(estimate_key(c_major), Key("C"))


class ExportTests(unittest.TestCase):
    def test_order_follows_the_score_not_the_ids(self):
        # ugly_midi sorted notes by id as text: note-0-10 played before note-0-2.
        pitches = list(range(60, 76))
        data = {"measures": [[note(f"note-0-{i}", name_of(p), "16") for i, p in enumerate(pitches)]]}
        self.assertEqual([n[2] for n in export(data)[1]], pitches)

    def test_leading_rest_stays_first(self):
        data = {"measures": [[note("m0-treble-0", "B4", "q", isRest=True),
                              note("grp1-0-treble", "C4", "q"), note("grp2-0-treble", "D4", "h")]]}
        self.assertEqual(export(data)[1][0][:3], (1, 2, 60))

    def test_ties_hold_and_velocity_is_kept(self):
        tie = {"type": "tie", "startNoteId": "b", "endNoteId": "c"}
        data = {"measures": [[note("a", "E4", "h", velocity=101), note("b", "E4", "h", tie=tie)],
                             [note("c", "E4", "w", tie=tie)]]}
        self.assertEqual(export(data)[1], [(0, 2, 64, 101), (2, 8, 64, 80)])

    def test_performed_duration(self):
        data = {"measures": [[note("a", "C4", "w", performedDuration=0.5)]]}
        self.assertEqual(export(data)[1][0][:3], (0, 2, 60))

    def test_instrument_and_channel(self):
        data = {"instrument": "cello", "midiChannel": "3", "measures": [[note("a", "C3", "w", clef="bass")]]}
        with tempfile.TemporaryDirectory() as tmp:
            midi_tools.json_to_midi(data, Path(tmp) / "i.mid")
            msgs = [m for t in mido.MidiFile(Path(tmp) / "i.mid").tracks for m in t
                    if m.type in ("program_change", "note_on")]
        self.assertEqual([(m.type, m.channel) for m in msgs], [("program_change", 3), ("note_on", 3)])
        self.assertEqual(msgs[0].program, 42)

    def test_bad_values_become_warnings(self):
        data = {"keySignature": "H", "measures": [[
            note("a", "C4", "q"), note("b", "rest", "q"),
            note("c", "E4", "7", velocity="loud")]]}
        warnings, notes = export(data)
        self.assertEqual(len(warnings), 3)
        self.assertEqual([(n[0], n[2], n[3]) for n in notes], [(0, 60, 80), (2, 64, 80)])

    def test_key_with_octave_digit_and_minor_flag(self):
        score = midi_tools.from_json({"keySignature": "A4", "isMinorChordMode": True, "measures": []})
        self.assertEqual(score.key, Key("A", True))


class ImportTests(unittest.TestCase):
    def test_played_gaps_filled_written_rests_kept(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "g.mid"
            write_midi(path, [(0, [(60, 0, F(9, 10)), (62, 1, F(19, 10)), (64, 2, 4)])])
            self.assertEqual(staff_names(midi_tools.midi_to_json(path), "treble"), ["C4/q", "D4/q", "E4/h"])
            write_midi(path, [(0, [(60, 0, F(1, 2)), (62, 1, F(3, 2)), (64, 2, 4)])])
            self.assertEqual(staff_names(midi_tools.midi_to_json(path), "treble"),
                             ["C4/8", "B4/r/8", "D4/8", "B4/r/8", "E4/h"])

    def test_parts_on_whole_staves(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "p.mid"
            write_midi(path, [(0, [(57, 0, 2), (60, 2, 4)]), (1, [(41, 0, 4)])])
            data = midi_tools.midi_to_json(path, treble=[0], bass=[1])
        self.assertEqual(staff_names(data, "treble"), ["A3/h", "C4/h"])
        self.assertEqual(staff_names(data, "bass"), ["F2/w"])

    def test_not_a_midi_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "x.mid"
            path.write_bytes(b"\xff\xd8\xff\xe0 not midi")
            with self.assertRaises(ValueError):
                midi_tools.midi_to_json(path)


class TwoStepTests(unittest.TestCase):
    """extract() -> JSON -> quantize_json(), as the /extract-midi and /quantize-tracks routes use it."""

    def raw(self, tmp):
        path = Path(tmp) / "two.mid"
        write_midi(path, [(0, [(57, 0, 2), (60, 2, 4), (64, 4, 8)]), (1, [(41, 0, 8)])])
        return path, json.loads(json.dumps(midi_tools.extract(path)))

    def test_same_result_as_one_step(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, raw = self.raw(tmp)
            self.assertEqual(midi_tools.quantize_json(raw), midi_tools.midi_to_json(path))
            self.assertEqual(midi_tools.quantize_json(raw, parts=[1]), midi_tools.midi_to_json(path, parts=[1]))

    def test_fields_the_track_picker_reads(self):
        with tempfile.TemporaryDirectory() as tmp:
            _, raw = self.raw(tmp)
        first = raw["tracks"][0]
        for field in ("index", "name", "instrument", "isDrum", "noteCount", "startMeasure", "pitchRange"):
            self.assertIn(field, first)
        self.assertEqual(raw["tempoMap"][0]["bpm"], 120)
        self.assertEqual(raw["duration"], 4.0)

    def test_tampered_raw_data_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            _, good = self.raw(tmp)
        breaks = {
            "pitch out of range": lambda r: r["tracks"][0]["notes"][0].__setitem__(0, 200),
            "note not a list": lambda r: r["tracks"][0]["notes"].__setitem__(0, "C4"),
            "bool as number": lambda r: r.__setitem__("ppq", True),
            "wrong format": lambda r: r.__setitem__("format", "ugly_midi"),
            "duplicate track": lambda r: r["tracks"].append(copy.deepcopy(r["tracks"][0])),
        }
        for name, damage in breaks.items():
            with self.subTest(name):
                raw = copy.deepcopy(good)
                damage(raw)
                with self.assertRaises(ValueError):
                    midi_tools.quantize_json(raw)


class RoundTripTests(unittest.TestCase):
    def test_fixtures_sound_the_same_after_a_round_trip(self):
        for path in sorted(FIXTURES.glob("*.json")):
            with self.subTest(fixture=path.name):
                data = json.loads(path.read_text(encoding="utf-8"))
                with tempfile.TemporaryDirectory() as tmp:
                    first, second = Path(tmp) / "a.mid", Path(tmp) / "b.mid"
                    midi_tools.json_to_midi(data, first)
                    back = midi_tools.midi_to_json(first, trim_leading=False)
                    midi_tools.json_to_midi(back, second)
                    a, b = sounding_notes(first), sounding_notes(second)
                self.assertTrue(a)
                self.assertEqual(a, b)


if __name__ == "__main__":
    unittest.main()
