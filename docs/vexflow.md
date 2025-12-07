Never use dotted whole notes. They always cause vexflow to throw an error.

# VexFlow API Notes

## Useful Methods for Note Positioning

### `getNoteHeadBounds()`
Returns the actual Y coordinates of note heads, **excluding stems, flags, and other decorations**.

```javascript
const bounds = vexNote.getNoteHeadBounds();
// bounds.y_top    - Y coordinate of highest notehead
// bounds.y_bottom - Y coordinate of lowest notehead
```

**Use case:** Determining which note in a chord the user clicked on for drag operations.

### `ys` Array
The `ys` property contains Y values for each individual notehead in order.

```javascript
const noteHeadYs = vexNote.ys; // Array of Y positions for each key
```

### `getModifierStartXY(position, index)`
Gets the X and Y coordinates for a specific note head by index.

```javascript
const pos = vexNote.getModifierStartXY(Modifier.Position.LEFT, noteIndex);
// pos.x, pos.y - coordinates for that specific notehead
```

### `getKeys()`
Returns array of keys in VexFlow format like `['C/5', 'E/5', 'G/5']`.

### `getBoundingBox()`
Returns the bounding box of the entire note **including stems, flags, ledger lines, etc.**

⚠️ **Warning:** Do NOT use this for determining note head positions - it includes decorations that skew the center point.

### `getKeyLine(index)`
Returns the staff line number for a specific key in the chord.

⚠️ **Note:** This returns staff line positions, not pixel coordinates. Use in combination with `stave.getYForLine()` to convert to pixels.

## Coordinate System Notes

- Y coordinates increase going **down** the page
- Higher pitched notes have **smaller** Y values (closer to top of screen)
- Staff lines are numbered from top to bottom (line 0 = top of staff)

We need to make sure that we aren't trying to write rests with "name": "rest"

We want to use a note name to tell vexflow WHERE on the staff to position the rest. Like this:       {
        "name": "A4",
        "clef": "treble",
        "duration": "w",
        "isRest": true,
        "measure": 1,
        "id": "1765084369246",
        "performedDuration": 0.853,
        "velocity": 107
      }