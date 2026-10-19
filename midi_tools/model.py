"""Score model shared by the MIDI reader and writer.

Positions and durations are Fractions of a quarter note, so a measure of 3/4
is exactly Fraction(3) and nothing needs a float tolerance.
"""

from dataclasses import dataclass, field
from fractions import Fraction

STAVES = ("treble", "bass")


@dataclass
class Key:
    tonic: str          # "C", "Bb", "F#"
    minor: bool = False

    def __str__(self):
        return self.tonic + ("m" if self.minor else "")


@dataclass
class Event:
    """One note, chord or rest on a staff."""
    pitches: list[int]              # MIDI numbers, low to high; empty = rest
    symbol: str                     # duration symbol: w h. h q. q 8. 8 16. 16 32
    duration: Fraction              # beats this event takes up in its measure
    velocity: int = 80
    tie_next: bool = False          # tied to the next event on the same staff
    names: list[str] | None = None  # spelled note names ("Bb4"), filled in by keys.spell_score
    performed: float | None = None  # PianoTour performedDuration (played fraction of written length)

    @property
    def is_rest(self):
        return not self.pitches


@dataclass
class Measure:
    staves: dict[str, list[Event]] = field(default_factory=lambda: {s: [] for s in STAVES})


@dataclass
class Score:
    measures: list[Measure]
    tempo: float = 120
    time_signature: tuple[int, int] = (4, 4)
    key: Key = field(default_factory=lambda: Key("C"))
    title: str = ""
    instrument: str = "piano"       # PianoTour instrument name; sets the MIDI program
    channel: int = 0                # MIDI channel, 0-15 (9 is drums)
    warnings: list[str] = field(default_factory=list)

    @property
    def measure_length(self) -> Fraction:
        n, d = self.time_signature
        return Fraction(4 * n, d)
