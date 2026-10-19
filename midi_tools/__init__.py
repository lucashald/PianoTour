"""midi_tools: MIDI <-> PianoTour score JSON.

    import midi_tools
    midi_tools.inspect("song.mid")                       # parts, tempo, keys
    data = midi_tools.midi_to_json("song.mid")           # PianoTour JSON + "warnings"
    midi_tools.json_to_midi(data, "out.mid")             # list of warnings

Two-step import, for a part picker between reading and converting:

    raw = midi_tools.extract("song.mid")                 # JSON-ready; send to the browser
    data = midi_tools.quantize_json(raw, parts=[0, 3])   # raw posted back -> PianoTour JSON

Only dependency: mido. Positions are exact fractions of a beat throughout.

Two copies of this package exist: in the music-theory Claude skill and in
PianoTour. They're kept in sync by hand; change both.
"""

from .midi_in import extract, from_raw, inspect, midi_to_score, quantize, read_midi, to_raw
from .midi_out import score_to_midi
from .model import Event, Key, Measure, Score
from .pianotour import from_json, to_json

__all__ = [
    "inspect", "midi_to_json", "json_to_midi", "extract", "quantize_json",
    "midi_to_score", "quantize", "score_to_midi", "read_midi", "to_raw", "from_raw",
    "from_json", "to_json", "Score", "Measure", "Event", "Key",
]


def _with_warnings(score):
    data = to_json(score)
    data["warnings"] = score.warnings
    return data


def midi_to_json(path, **options):
    """MIDI file -> PianoTour JSON dict, with a "warnings" list added.
    Options are midi_in.score_from_data()'s: parts, grid, split, key,
    trim_leading, treble, bass, legato."""
    return _with_warnings(midi_to_score(path, **options))


def quantize_json(raw, parts=None, **options):
    """Raw data from extract() -> PianoTour JSON dict with "warnings".
    Same options as midi_to_json()."""
    return _with_warnings(quantize(raw, parts=parts, **options))


def json_to_midi(data, path):
    """PianoTour JSON -> MIDI file at `path`. Returns warnings."""
    score = from_json(data)
    score_to_midi(score).save(path)
    return score.warnings
