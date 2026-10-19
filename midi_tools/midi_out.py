"""Score -> MIDI file."""

from fractions import Fraction

import mido

from .model import STAVES

PPQ = 480
STAFF_NAMES = {"treble": "right hand", "bass": "left hand"}
DRUM_CHANNEL = 9
# PianoTour instrument names -> General MIDI program (0-based). Unknown names play as piano.
PROGRAMS = {
    "piano": 0, "keyboard": 0, "guitar": 24, "bass": 32, "violin": 40, "cello": 42,
    "harp": 46, "strings": 48, "brass": 61, "french_horn": 60, "french horn": 60,
    "sax": 65, "saxophone": 65, "clarinet": 71, "synth": 80,
}
# Key names mido accepts for the key_signature meta message.
MIDO_KEYS = set(mido.midifiles.meta._key_signature_decode.values())


def _staff_notes(score, staff, warnings):
    """Walk one staff in order -> [(start_beats, end_beats, pitch, velocity)].

    Tied events become one held note. Positions come from adding up durations
    in the order the events are written; nothing is re-sorted.
    """
    out = []
    held = None   # {"start", "length", "pitches", "velocity", "performed"}

    def close():
        played = held["length"] * Fraction(held["performed"] if held["performed"] is not None else 1)
        played = max(played, Fraction(1, 64))
        for p in held["pitches"]:
            out.append((held["start"], held["start"] + played, p, held["velocity"]))

    for mi, measure in enumerate(score.measures):
        pos = mi * score.measure_length
        bar_end = pos + score.measure_length
        for e in measure.staves[staff]:
            if pos >= bar_end:
                warnings.append(f"measure {mi + 1} {staff}: more beats than the time signature allows; extra notes dropped")
                break
            if e.is_rest:
                if held:
                    close()
                    held = None
            elif held and held["pitches"] == e.pitches:
                held["length"] += e.duration           # tie continues
            else:
                if held:
                    if held["tied"]:
                        warnings.append(f"measure {mi + 1} {staff}: tie to different notes ignored")
                    close()
                held = {"start": pos, "length": e.duration, "pitches": e.pitches,
                        "velocity": e.velocity, "performed": e.performed}
            if held:
                held["tied"] = e.tie_next and not e.is_rest
                if not held["tied"]:
                    close()
                    held = None
            pos += e.duration
    if held:
        close()
    return out


def score_to_midi(score, warnings=None):
    """Score -> mido.MidiFile (type 1: a tempo/meta track plus one track per staff)."""
    warnings = score.warnings if warnings is None else warnings
    mf = mido.MidiFile(type=1, ticks_per_beat=PPQ)

    meta = mido.MidiTrack()
    if score.title:
        meta.append(mido.MetaMessage("track_name", name=score.title, time=0))
    meta.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(score.tempo), time=0))
    n, d = score.time_signature
    meta.append(mido.MetaMessage("time_signature", numerator=n, denominator=d, time=0))
    key = str(score.key)
    if key in MIDO_KEYS:
        meta.append(mido.MetaMessage("key_signature", key=key, time=0))
    else:
        warnings.append(f"key {key} can't be written as a MIDI key signature")
    meta.append(mido.MetaMessage("end_of_track", time=0))
    mf.tracks.append(meta)

    channel = score.channel
    name = score.instrument.replace("_", " ").title()
    for staff in STAVES:
        events = []
        for start, end, pitch, velocity in _staff_notes(score, staff, warnings):
            events.append((round(start * PPQ), 1, mido.Message("note_on", note=pitch, velocity=velocity, channel=channel)))
            events.append((round(end * PPQ), 0, mido.Message("note_off", note=pitch, velocity=0, channel=channel)))
        if not events:
            continue
        track = mido.MidiTrack()
        track.append(mido.MetaMessage("track_name", name=f"{name} {STAFF_NAMES[staff]}", time=0))
        if channel != DRUM_CHANNEL:   # channel 10 is the drum kit; a program change means nothing there
            program = PROGRAMS.get(score.instrument.lower(), 0)
            track.append(mido.Message("program_change", program=program, channel=channel, time=0))
        # Note-offs before note-ons at the same tick, so repeated notes re-strike cleanly.
        last = 0
        for tick, _, msg in sorted(events, key=lambda x: (x[0], x[1])):
            track.append(msg.copy(time=tick - last))
            last = tick
        track.append(mido.MetaMessage("end_of_track", time=0))
        mf.tracks.append(track)
    return mf
