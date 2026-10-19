"""Duration symbols and splitting lengths into values that can be written."""

from fractions import Fraction

# Longest first. No dotted whole: VexFlow can't draw it.
NOTE_VALUES = [
    ("w", Fraction(4)), ("h.", Fraction(3)), ("h", Fraction(2)),
    ("q.", Fraction(3, 2)), ("q", Fraction(1)),
    ("8.", Fraction(3, 4)), ("8", Fraction(1, 2)),
    ("16.", Fraction(3, 8)), ("16", Fraction(1, 4)),
    ("32", Fraction(1, 8)),
]
SYMBOL_BEATS = dict(NOTE_VALUES)
SYMBOL_BEATS.update({"32.": Fraction(3, 16), "w.": Fraction(6)})  # read-only: may appear in input
SMALLEST = Fraction(1, 8)


def symbol_beats(symbol):
    if symbol not in SYMBOL_BEATS:
        raise ValueError(f"unknown duration {symbol!r}")
    return SYMBOL_BEATS[symbol]


def _fits(symbol, value, pos):
    dotted = symbol.endswith(".")
    # A value starts on a multiple of itself (of its undotted value if dotted),
    # so a half note in 4/4 starts on beat 1 or 3, never beat 2.
    align = value * Fraction(2, 3) if dotted else value
    if pos % align:
        return False
    # Something starting off the beat may not run across the next beat,
    # so the beat stays visible: an eighth on the "and" ties into the beat.
    if pos % 1 and pos // 1 != (pos + value - SMALLEST) // 1:
        return False
    return True


def spell(pos, length, rest=False):
    """Split `length` beats starting at measure offset `pos` into symbols.

    Returns [(symbol, beats), ...]; a note gets tied across the pieces.
    Rests never use dotted values (the renderer can't draw them).
    """
    out = []
    remaining = Fraction(length)
    pos = Fraction(pos)
    while remaining > 0:
        choice = next((c for unit in END_UNITS if (c := _pick(pos, remaining, rest, unit))), None)
        if not choice:
            raise ValueError(f"can't write {remaining} beats at offset {pos} (finer than a 32nd?)")
        out.append(choice)
        pos += choice[1]
        remaining -= choice[1]
    return out


# When more pieces follow, a piece should end on a beat if it can, else on an
# eighth, and so on: a 2-beat note on beat 2 is q~q, not q.~8.
END_UNITS = [Fraction(1), Fraction(1, 2), Fraction(1, 4), Fraction(1, 8)]


def _pick(pos, remaining, rest, end_unit):
    for symbol, value in NOTE_VALUES:
        if value > remaining or (rest and symbol.endswith(".")):
            continue
        if value < remaining and (pos + value) % end_unit:
            continue
        if _fits(symbol, value, pos):
            return symbol, value
    return None
