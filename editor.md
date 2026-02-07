# PianoTour Editor Route Documentation

## Overview

This document explains the architecture and functionality differences between the main route (`/`) and the editor route (`/editor`) in the PianoTour application. The primary distinction is that the editor route includes a full drag-and-drop interface for note placement, a side panel with editing controls, and a note palette system.

---

## Table of Contents

1. [Route Definitions](#route-definitions)
2. [Template Architecture](#template-architecture)
3. [Drag and Drop System](#drag-and-drop-system)
4. [Palette Functionality](#palette-functionality)
5. [Editor UI Components](#editor-ui-components)
6. [JavaScript Module Loading](#javascript-module-loading)
7. [Key Differences Summary](#key-differences-summary)
8. [Implementation Details](#implementation-details)

---

## Route Definitions

**Location:** `/workspaces/PianoTour/main.py`

### Main Route (`/`)
```python
@app.route('/')
def index():
    return render_template('piano.html', hide_spectrum=False)
```
- Template: `piano.html`
- No side panel
- Keyboard-focused interaction

### Editor Route (`/editor`)
```python
@app.route('/editor')
def editor():
    return render_template('editor.html', show_side_panel=True)
```
- Template: `editor.html`
- Side panel enabled via `show_side_panel=True`
- Full editing capabilities with drag-and-drop

---

## Template Architecture

Both routes extend a shared base template (`index.html`) but include different partials and JavaScript modules.

### Main Route Template (`templates/piano.html`)

**Structure:**
- Extends `index.html`
- Includes `_toggles.html` partial (basic toggles)
- Does NOT include palette block
- Minimal editor initialization

**JavaScript Initialization:**
```javascript
import { pianoState } from '/static/js/core/appState.js';
import { addBasicKeyboardListeners } from '/static/js/ui/listenerManager.js';

pianoState.instrument = templateInstrument;
addBasicKeyboardListeners();
```

### Editor Route Template (`templates/editor.html`)

**Structure:**
- Extends `index.html`
- Includes `_palette.html` partial (lines 245-247)
- Includes `_chords.html` partial (lines 250-252)
- Full side panel UI (lines 14-242)
- Floating editor panel system

**JavaScript Initialization:**
```javascript
// Waits for pianoTourBaseReady event, then:
const { initializeMusicEditor } = await import('/static/js/editor/scoreEditor.js');
const { initializePaletteInteractions, setupPaletteInteractions } = await import('/static/js/ui/paletteHelpers.js');
const { triggerAttackRelease } = await import('/static/js/instrument/playbackHelpers.js');

initializeMusicEditor();
setupFloatingPanelInteractions();
initializePaletteInteractions();
```

---

## Drag and Drop System

This is the PRIMARY DIFFERENCE between the two routes.

### Architecture Overview

The drag-and-drop system consists of three main components:

1. **Palette Items** - Source of draggable elements
2. **Score Area** - Drop target with preview rendering
3. **Drop Handlers** - Process the drop and add notes to score

### Key Files

| File | Purpose |
|------|---------|
| `static/js/ui/paletteHelpers.js` | Palette drag event setup and mode management |
| `static/js/score/scoreRenderer.js` | Drop handling, preview rendering, snap-to-staff logic |
| `templates/partials/_palette.html` | HTML structure of draggable palette items |
| `static/js/editor/scoreEditor.js` | Editor state management and note callbacks |

### Palette Items

**Location:** `templates/partials/_palette.html`

**Available Items:**
- Note durations: 32nd, 16th, 8th, Quarter, Half, Whole
- Dotted variants for all durations
- Rest durations: 16th, 8th, Quarter, Half, Whole
- Clef toggle button
- Diatonic chord buttons (I, ii, iii, IV, V, vi, vii°)
- Custom chord buttons (dynamically added)
- Interval buttons (2nds through 8ths)

### Drag Event Flow

**1. Drag Initialization (`dragstart` event)**

Location: `paletteHelpers.js`, lines 344-384

```javascript
newNote.addEventListener('dragstart', (event) => {
  // Hide browser's default drag preview
  const transparentDragImage = new Image();
  transparentDragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  event.dataTransfer.setDragImage(transparentDragImage, 0, 0);

  // Set drag state globally
  setPaletteDragState(true, type, duration);

  // Store drag data for drop handler
  event.dataTransfer.setData('application/note', JSON.stringify({
    type: type,
    duration: duration
  }));
});
```

**2. Drag Preview Update (`dragover` event on score)**

Location: `scoreRenderer.js`, lines 659-705

```javascript
scoreElement.addEventListener("dragover", (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";

  if (!isPaletteDrag) return;

  // Get mouse coordinates
  const rect = scoreElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  // Detect target measure
  const measureIndex = detectMeasureClick(x, y);

  if (measureIndex !== -1) {
    // Valid drop zone - show preview at exact position
    const clef = detectClefRegion(y);
    const nearest = findNearestStaffPosition(y, clef);

    if (nearest) {
      // Convert to absolute screen coordinates for fixed positioning
      const absoluteX = event.clientX;
      const absoluteY = rect.top + nearest.y;
      updateDragPreview(absoluteX, absoluteY, nearest.note, nearest.type);
      highlightSelectedMeasure(measureIndex);
    }
  } else {
    // Try to snap to nearest valid measure
    const snapped = findNearestValidMeasure(x, y);
    if (snapped) {
      // Show preview at snapped position
      const clef = detectClefRegion(snapped.snappedY);
      const nearest = findNearestStaffPosition(snapped.snappedY, clef);
      // ... update preview
    } else {
      // Too far - clear preview
      clearDragPreview();
      clearMeasureHighlight();
    }
  }
});
```

**3. Drop Handling (`drop` event)**

Location: `scoreRenderer.js`, lines 723-732

```javascript
scoreElement.addEventListener("drop", (event) => {
  clearDragPreview();
  event.preventDefault();

  const rect = scoreElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  handlePaletteDrop(x, y, event);
});
```

**4. Drag Cleanup (`dragend` event)**

Location: `paletteHelpers.js`, lines 386-389

```javascript
newNote.addEventListener('dragend', (event) => {
  setPaletteDragState(false, null, null);
});
```

### Drop Handler Implementation

**Function:** `handlePaletteDrop(endX, endY, event)`

Location: `scoreRenderer.js`, lines 735-936

**Process:**

1. **Check for special drag types** (intervals or chords)
   - Intervals: Parse interval data, create interval chord at root position
   - Chords: Parse chord data, select appropriate voicing for clef

2. **Handle standard note drop:**
   ```javascript
   // Find target measure
   let targetMeasureIndex = detectMeasureClick(endX, endY);

   // If invalid, try to snap to nearest measure
   if (targetMeasureIndex === -1) {
     const snapped = findNearestValidMeasure(endX, endY);
     if (!snapped) return; // Too far, ignore
     targetMeasureIndex = snapped.measureIndex;
   }

   // Detect clef and find nearest staff position
   const clef = detectClefRegion(actualY);
   const nearestPosition = findNearestStaffPosition(actualY, clef);

   // Apply key signature correction
   const rawMIDI = NOTES_BY_NAME[nearestPosition.note];
   const correctedMIDI = applyKeySignatureCorrection(rawMIDI, pianoState.keySignature);
   const correctedNoteInfo = ALL_NOTE_INFO.find(n => n.midi === correctedMIDI);
   const newNoteName = correctedNoteInfo ? correctedNoteInfo.name : nearestPosition.note;

   // Create note object
   const newNote = {
     name: newNoteName,
     clef: clef,
     duration: pianoState.quantize,
     isRest: isRest,
     id: Date.now().toString(),
   };

   // Add to measure
   const result = addNoteToMeasure(targetMeasureIndex, newNote);

   // Dispatch event for auto-select
   if (result) {
     document.dispatchEvent(new CustomEvent('noteAddedToScore', {
       detail: result
     }));
   }
   ```

### Drag Preview Rendering

**Function:** `updateDragPreview(x, snapY, noteName, noteType = null)`

Location: `scoreRenderer.js`, lines 938-1194

**Visual Design:**

The preview shows two different visual styles depending on whether the note snaps to a staff line or a space:

**Staff Line (Red Line):**
```html
<div style="position: relative; width: 120px; height: 3px;">
  <!-- White circle behind note -->
  <div style="
    background: rgba(255, 255, 255, 0.33);
    border-radius: 50%;
    width: 48px;
    height: 48px;
    z-index: 1;
  ">
    <img src="[note-image.svg]" style="width: 120px; height: 120px;">
  </div>

  <!-- Red line on top -->
  <div style="
    width: 100%;
    height: 3px;
    background: rgba(216, 131, 104, 0.9);
    z-index: 2;
  "></div>

  <!-- Note name label -->
  <div style="background: rgba(216, 131, 104, 0.9); z-index: 3;">C4</div>
</div>
```

**Staff Space (Green Dashed Line):**
```html
<div style="position: relative; width: 120px; height: 0px;">
  <!-- Left dashed line -->
  <div style="width: 36px; border-top: 3px dashed rgba(41, 123, 81, 0.8);"></div>

  <!-- Right dashed line -->
  <div style="width: 36px; border-top: 3px dashed rgba(41, 123, 81, 0.8);"></div>

  <!-- White circle with note -->
  <div style="
    background: rgba(255, 255, 255, 0.33);
    border-radius: 50%;
    width: 48px;
    height: 48px;
    z-index: 2;
  ">
    <img src="[note-image.svg]" style="width: 120px; height: 120px;">
  </div>

  <!-- Note name label -->
  <div style="background: rgba(41, 123, 81, 0.9); z-index: 3;">D4</div>
</div>
```

**Image Positioning Logic:**

The note images are 120x120 SVG files with note heads at specific positions:

| Note Type | Note Head X | Note Head Y |
|-----------|-------------|-------------|
| Up-stem notes | 23 | 80 |
| Down-stem notes | 23 | 65 |
| Whole notes | 25.5 | 80 |
| Rests | 60 | 60 |

The container is 48x48 pixels with center at (24, 24). The image offset is calculated to align the note head center with the container center:

```javascript
const imgLeft = 24 - noteHeadX;  // e.g., 24 - 23 = 1
const imgTop = 24 - noteHeadY;   // e.g., 24 - 80 = -56
```

**Performance Optimization:**

The preview uses a cache to avoid unnecessary DOM updates:

```javascript
let dragPreviewCache = {
  isOnLine: null,      // Line vs. space
  noteName: null,      // Note name (C4, D4, etc.)
  duration: null,      // Note duration (q, h, w, etc.)
  stemDirection: null, // up or down
  imagePath: null      // SVG file path
};
```

Only updates what has changed:
- Structure rebuilt only if line/space changes
- Image src updated only if duration/stem changes
- Position updated every frame (cheap operation)

### Staff Position Detection

**Function:** `findNearestStaffPosition(y, clef)`

Location: `scoreRenderer.js`, lines 187-215

Uses position mappings for each clef:

**Treble Staff Positions:**
```javascript
const TREBLE_STAFF_POSITIONS = [
  { position: -3, note: "E6", type: "ledger" },
  { position: -2.5, note: "D6", type: "ledger-space" },
  { position: -2, note: "C6", type: "ledger" },
  { position: -1.5, note: "B5", type: "ledger-space" },
  { position: -1, note: "A5", type: "ledger" },
  { position: -0.5, note: "G5", type: "ledger-space" },
  { position: 0, note: "F5", type: "line" },    // Top line
  { position: 0.5, note: "E5", type: "space" },
  { position: 1, note: "D5", type: "line" },
  { position: 1.5, note: "C5", type: "space" },
  { position: 2, note: "B4", type: "line" },    // Middle line
  { position: 2.5, note: "A4", type: "space" },
  { position: 3, note: "G4", type: "line" },
  { position: 3.5, note: "F4", type: "space" },
  { position: 4, note: "E4", type: "line" },    // Bottom line
  { position: 4.5, note: "D4", type: "space" },
  { position: 5, note: "C4", type: "ledger" },
  { position: 5.5, note: "B3", type: "ledger-space" },
  { position: 6, note: "A3", type: "ledger" },
];
```

**Bass Staff Positions:** (similar structure, lines 114-132)

The function iterates through positions, calculates Y coordinate using VexFlow's `stave.getYForLine(pos.position)`, and returns the position with minimum distance to cursor Y.

### Measure Snapping

**Function:** `findNearestValidMeasure(x, y, snapThreshold = 80)`

Location: `scoreRenderer.js`, lines 1599-1683

When a drop occurs outside a measure's bounds, this function attempts to snap to the nearest valid position within 80 pixels:

```javascript
// Clamp Y to valid vertical range
let snappedY = y;
if (y < scoreTopY - topMargin) {
  snappedY = scoreTopY - topMargin;
} else if (y > scoreBottomY + bottomMargin) {
  snappedY = scoreBottomY + bottomMargin;
}

// Find nearest measure horizontally
for (let i = 0; i < measureXPositions.length; i++) {
  const measureStartX = measureXPositions[i];
  const measureEndX = measureStartX + measureWidth;

  // If x is within measure bounds, use it directly
  if (x >= measureStartX && x <= measureEndX) {
    nearestMeasureIndex = i;
    snappedX = x;
    break;
  }

  // Otherwise, check distance to measure edges
  // ... snap logic
}

// Check total distance
const totalDistance = Math.sqrt(minDistance * minDistance + verticalDistance * verticalDistance);

if (totalDistance > snapThreshold) {
  return null; // Too far, don't snap
}

return { measureIndex, snappedX, snappedY };
```

---

## Palette Functionality

**File:** `static/js/ui/paletteHelpers.js` (446 lines)

### Two Operating Modes

The palette system supports two interaction modes, controlled by `pianoState.togglePaletteDragMode`:

#### 1. Drag Mode (`useDragMode = true`)

**Behavior:**
- Note/rest items are draggable onto score
- Diatonic chord items are draggable
- Custom chord items are draggable
- Interval items are always draggable (even in click mode)
- Clicking diatonic chords selects them without placing

**Setup:**
```javascript
newNote.draggable = true;
newNote.addEventListener('dragstart', dragStartHandler);
newNote.addEventListener('dragend', dragEndHandler);
```

#### 2. Click Mode (`useDragMode = false`)

**Behavior:**
- Clicking note/rest items places them immediately in current measure
- Clicking chord items adds chord at current note position
- Intervals remain draggable

**Setup:**
```javascript
newNote.draggable = false;
newNote.addEventListener('click', () => {
  handlePaletteClick(item, degree, durationText);
});
```

### Palette Click Handler

**Function:** `handlePaletteClick(item, degree, duration)`

Location: `paletteHelpers.js`, lines 20-59

```javascript
export function handlePaletteClick(item, degree, duration) {
  // Update quantize for note duration items
  if (item.match(/^(32nd|16th|8th|q|h|w)/)) {
    pianoState.quantize = duration;
    updateUI(`Quantize: ${duration}`, { updateQuantize: true });
  }

  // Handle rest items
  if (item.includes('rest')) {
    handleRestClick(duration);
  }

  // Handle chord items (diatonic)
  if (degree) {
    handleChordClick(item, degree, duration);
  }
}
```

**Rest Click Handler:**
```javascript
function handleRestClick(duration) {
  if (pianoState.currentSelectedMeasure === -1) {
    updateUI("Select a measure first", { error: true });
    return;
  }

  const newNote = {
    name: 'R',
    clef: pianoState.currentSelectedNote?.clef || 'treble',
    duration: duration,
    isRest: true,
    id: Date.now().toString()
  };

  addNoteToMeasure(pianoState.currentSelectedMeasure, newNote);
}
```

**Chord Click Handler:**
```javascript
function handleChordClick(item, degree, duration) {
  if (!pianoState.currentSelectedNote) {
    updateUI("Select a note first to add chord", { error: true });
    return;
  }

  const chordObj = getDiatonicChordAtNote(
    pianoState.currentSelectedNote.name,
    degree,
    pianoState.keySignature
  );

  // Replace selected note with chord
  // ... implementation
}
```

### Palette Initialization

**Function:** `initializePaletteInteractions()`

Location: `paletteHelpers.js`, lines 62-211

**Process:**

1. **Setup Drag Mode Toggle:**
   ```javascript
   const dragModeCheckbox = document.getElementById('togglePaletteDragMode');
   dragModeCheckbox.checked = pianoState.togglePaletteDragMode;
   dragModeCheckbox.addEventListener('change', (e) => {
     pianoState.togglePaletteDragMode = e.target.checked;
     setupPaletteInteractions(e.target.checked);
   });
   ```

2. **Setup Palette Items:**
   ```javascript
   setupPaletteInteractions(pianoState.togglePaletteDragMode);
   ```

3. **Setup Clef Toggle:**
   ```javascript
   const clefToggle = document.querySelector('.clef-toggle');
   clefToggle.addEventListener('click', () => {
     const currentClef = pianoState.currentSelectedNote?.clef || 'treble';
     const newClef = currentClef === 'treble' ? 'bass' : 'treble';
     // ... update selected note clef
   });
   ```

4. **Setup Custom Chord Buttons:**
   ```javascript
   // Listen for custom chord additions
   document.addEventListener('customChordAdded', (event) => {
     addCustomChordButton(event.detail.chord, event.detail.displayName);
   });

   // Load saved custom chords
   if (pianoState.customChords) {
     pianoState.customChords.forEach(chord => {
       addCustomChordButton(chord.chord, chord.displayName);
     });
   }
   ```

---

## Editor UI Components

The editor route includes a comprehensive side panel with multiple sections for editing various aspects of the score.

### Side Panel Structure

**Location:** `templates/editor.html`, lines 14-242

### 1. Score Controls

**Location:** Lines 17-74

**Components:**
- **Time Signature:**
  - Numerator dropdown (1-12)
  - Denominator dropdown (1, 2, 4, 8, 16)
  - Change button with confirmation dialog

- **Tempo (BPM):**
  - Dropdown (60-220 BPM)
  - Updates `pianoState.tempo`

- **Measure Navigation:**
  - Previous button (←)
  - Current measure number input
  - Next button (→)
  - Total measures display

**JavaScript Handlers:**
```javascript
// Time signature change
document.getElementById('changeTimeSignature').addEventListener('click', () => {
  const numerator = parseInt(document.getElementById('timeSignatureNumerator').value);
  const denominator = parseInt(document.getElementById('timeSignatureDenominator').value);

  if (confirm(`Change time signature to ${numerator}/${denominator}? This will affect all measures.`)) {
    pianoState.timeSignature = { numerator, denominator };
    updateTimeSignature(numerator, denominator);
  }
});

// Measure navigation
document.getElementById('prevMeasure').addEventListener('click', () => {
  if (pianoState.currentSelectedMeasure > 0) {
    selectMeasure(pianoState.currentSelectedMeasure - 1);
  }
});
```

### 2. Note Selection Widgets

**Location:** Lines 76-90

**Components:**
- **Treble Clef Notes List** (`#treble-notes`)
  - Populated by `populateNoteListWidget(0, 'treble')`
  - Shows all notes in treble clef of current measure

- **Bass Clef Notes List** (`#bass-notes`)
  - Populated by `populateNoteListWidget(0, 'bass')`
  - Shows all notes in bass clef of current measure

**Population Logic:**
```javascript
function populateNoteListWidget(measureIndex, clef) {
  const widget = document.getElementById(`${clef}-notes`);
  const measure = getMeasures()[measureIndex];
  const notesInClef = measure.filter(n => n.clef === clef);

  widget.innerHTML = notesInClef.map(note =>
    `<button data-note-id="${note.id}">${note.name} (${note.duration})</button>`
  ).join('');

  // Add click handlers
  widget.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      selectNoteById(btn.dataset.noteId);
    });
  });
}
```

### 3. Note Editor

**Location:** Lines 98-192

**Components:**

**Basic Properties:**
- **Letter Dropdown:** C, D, E, F, G, A, B, R (Rest)
- **Accidental Dropdown:** #, ♭, None
- **Octave Dropdown:** 2, 3, 4, 5, 6, 7
- **Duration Dropdown:** w, h, q, 8, 16, 32, w., h., q., 8., 16.

**Performance Properties:**
- **Performed Duration Slider:** 0-100%
  - Controls staccato/legato articulation
  - Default: 90%

- **Velocity Slider:** 0-127
  - Controls note loudness
  - Default: 80

**Action Buttons:**

Row 1:
- **Remove:** Delete current note
- **Treble/Bass Toggle:** Move note to opposite clef
- **Toggle Rest:** Convert note to rest or rest to note
- **Split:** Split note into two notes of half duration

Row 2:
- **Transpose Semitone Up/Down:** +/- 1 semitone
- **Transpose Octave Up/Down:** +/- 12 semitones

Row 3:
- **Add Tie:** Tie current note to next note
- **Remove Tie:** Remove tie from current note
- **Add Slur:** Add slur to next note
- **Remove Slur:** Remove slur from current note

Row 4:
- **Duplicate Note:** Create a copy after current note

**Event Handlers:**
```javascript
// Note property changes
document.getElementById('noteLetter').addEventListener('change', (e) => {
  if (!pianoState.currentSelectedNote) return;

  const letter = e.target.value;
  const accidental = document.getElementById('noteAccidental').value;
  const octave = document.getElementById('noteOctave').value;

  let newName = letter;
  if (accidental !== 'none') newName += accidental;
  if (letter !== 'R') newName += octave;

  updateSelectedNoteProperty('name', newName);
});

// Transpose
document.getElementById('transposeUp').addEventListener('click', () => {
  transposeSelectedNote(1); // +1 semitone
});

// Tie operations
document.getElementById('addTie').addEventListener('click', () => {
  addTieToSelectedNote('tie');
});
```

### 4. Measure Editor

**Location:** Lines 194-210

**Components:**
- **Move to End:** Move current measure to end of score
- **Add After:** Add new empty measure after current
- **Duplicate Measure:** Create copy of current measure after it
- **Delete:** Remove current measure (with confirmation)

**Event Handlers:**
```javascript
document.getElementById('moveMeasureToEnd').addEventListener('click', () => {
  if (pianoState.currentSelectedMeasure === -1) return;
  moveMeasureToEnd(pianoState.currentSelectedMeasure);
});

document.getElementById('addMeasure').addEventListener('click', () => {
  addEmptyMeasure(pianoState.currentSelectedMeasure + 1);
});

document.getElementById('duplicateMeasure').addEventListener('click', () => {
  if (pianoState.currentSelectedMeasure === -1) return;
  duplicateMeasure(pianoState.currentSelectedMeasure);
});

document.getElementById('deleteMeasure').addEventListener('click', () => {
  if (pianoState.currentSelectedMeasure === -1) return;
  if (confirm('Delete this measure?')) {
    deleteMeasure(pianoState.currentSelectedMeasure);
  }
});
```

### 5. Score Editor

**Location:** Lines 212-228

**Components:**
- **Transpose Entire Score:**
  - Semitone Up (+1)
  - Semitone Down (-1)
  - Octave Up (+12)
  - Octave Down (-12)

**Event Handlers:**
```javascript
document.getElementById('transposeScoreUp').addEventListener('click', () => {
  transposeEntireScore(1);
});

document.getElementById('transposeScoreOctaveUp').addEventListener('click', () => {
  transposeEntireScore(12);
});
```

**Implementation:**
```javascript
function transposeEntireScore(semitones) {
  const measures = getMeasures();

  measures.forEach((measure, measureIndex) => {
    measure.forEach(note => {
      if (note.isRest) return;

      const currentMIDI = NOTES_BY_NAME[note.name];
      const newMIDI = currentMIDI + semitones;
      const newNoteInfo = ALL_NOTE_INFO.find(n => n.midi === newMIDI);

      if (newNoteInfo) {
        note.name = newNoteInfo.name;
      }
    });
  });

  safeRedraw();
  saveToLocalStorage();
}
```

### 6. Floating Editor Panel

**Location:** Lines 230-242

**Behavior:**
- Appears when a note is selected
- Can be docked to sidebar or float freely
- Click outside closes panel (when undocked)
- Escape key closes panel
- Persists dock state in `pianoState.floatingPanelDocked`

**Setup Function:**
```javascript
function setupFloatingPanelInteractions() {
  const floatingPanel = document.getElementById('floating-note-editor');
  const dockButton = document.getElementById('dockPanelButton');

  // Dock/undock toggle
  dockButton.addEventListener('click', () => {
    pianoState.floatingPanelDocked = !pianoState.floatingPanelDocked;

    if (pianoState.floatingPanelDocked) {
      floatingPanel.classList.add('docked');
      floatingPanel.classList.remove('floating');
      dockButton.textContent = 'Undock';
    } else {
      floatingPanel.classList.remove('docked');
      floatingPanel.classList.add('floating');
      dockButton.textContent = 'Dock';
    }
  });

  // Click outside to close (when undocked)
  document.addEventListener('click', (e) => {
    if (pianoState.floatingPanelDocked) return;
    if (!floatingPanel.contains(e.target) && !e.target.closest('.vf-notehead')) {
      floatingPanel.style.display = 'none';
    }
  });

  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && floatingPanel.style.display === 'block') {
      floatingPanel.style.display = 'none';
    }
  });
}
```

**Show/Hide Logic:**
```javascript
// Show when note is selected
document.addEventListener('noteSelected', (event) => {
  const floatingPanel = document.getElementById('floating-note-editor');
  floatingPanel.style.display = 'block';
  populateNoteEditor(event.detail.note);
});

// Hide when measure is deselected
document.addEventListener('measureDeselected', () => {
  const floatingPanel = document.getElementById('floating-note-editor');
  if (!pianoState.floatingPanelDocked) {
    floatingPanel.style.display = 'none';
  }
});
```

---

## JavaScript Module Loading

### Main Route Initialization

**File:** `templates/piano.html`, lines 9-24

**Process:**
```javascript
document.addEventListener('DOMContentLoaded', async () => {
  // Import core modules
  const { pianoState } = await import('/static/js/core/appState.js');
  const { addBasicKeyboardListeners } = await import('/static/js/ui/listenerManager.js');

  // Set instrument from template
  pianoState.instrument = templateInstrument;

  // Add basic keyboard listeners only
  addBasicKeyboardListeners();
});
```

**Keyboard Listeners:**
- Piano key press/release (computer keyboard → piano keys)
- Play/pause (Space bar)
- Basic navigation

### Editor Route Initialization

**File:** `templates/editor.html`, lines 273-315

**Process:**

**Phase 1: Wait for Base Ready**
```javascript
document.addEventListener('pianoTourBaseReady', async () => {
  console.log('Piano Tour base ready, loading editor modules...');

  // Dynamic module loading
  const { initializeMusicEditor } = await import('/static/js/editor/scoreEditor.js');
  const { initializePaletteInteractions, setupPaletteInteractions } =
    await import('/static/js/ui/paletteHelpers.js');
  const { triggerAttackRelease } = await import('/static/js/instrument/playbackHelpers.js');

  // ... Phase 2
});
```

**Phase 2: Initialize Editor Components**
```javascript
// Expose functions globally for inline scripts
window.triggerAttackRelease = triggerAttackRelease;
window.setupPaletteInteractions = setupPaletteInteractions;

// Initialize editor
console.log('Initializing music editor...');
initializeMusicEditor();

// Initialize floating panel
console.log('Setting up floating panel...');
setupFloatingPanelInteractions();

// Initialize palette
console.log('Initializing palette interactions...');
initializePaletteInteractions();

console.log('Editor initialization complete');
```

### Base Template Initialization

**File:** `templates/index.html`, lines 242-355

Both routes go through this shared initialization:

**Phase 1: Immediate UI (`initializeImmediateUI()`)**
- Set initial dimensions
- Initialize audio manager
- Initialize sidebar toggle
- Setup basic event handlers
- Render empty score immediately

**Phase 2: Heavy Components (`initializeHeavyComponents()`)**
- Load score from localStorage
- Setup MIDI unlock system
- **Dispatch `pianoTourBaseReady` event** ← Editor waits for this

```javascript
async function initializeHeavyComponents() {
  const { loadFromLocalStorage } = await import('/static/js/utils/ioHelpers.js');
  const { setupUnlockSystem } = await import('/static/js/instrument/unlockHelpers.js');

  // Load score
  loadFromLocalStorage();

  // Setup MIDI
  await setupUnlockSystem();

  // Notify that base is ready
  document.dispatchEvent(new Event('pianoTourBaseReady'));
  console.log('Base initialization complete, dispatched pianoTourBaseReady');
}
```

---

## Key Differences Summary

### Feature Comparison Table

| Feature | Main Route (`/`) | Editor Route (`/editor`) |
|---------|------------------|--------------------------|
| **Template** | `piano.html` | `editor.html` |
| **Side Panel** | ❌ No | ✅ Yes (`show_side_panel=True`) |
| **Palette UI** | ❌ Not included | ✅ Included (`_palette.html`) |
| **Drag & Drop** | ❌ No | ✅ Yes (full system) |
| **Drag Preview** | ❌ No | ✅ Yes (custom rendering) |
| **Note Editor UI** | ❌ No | ✅ Yes (sidebar form) |
| **Measure Controls** | ❌ No | ✅ Yes (add/delete/duplicate) |
| **Score Controls** | ❌ No | ✅ Yes (transpose/time sig) |
| **Floating Panel** | ❌ No | ✅ Yes (dock/undock) |
| **Chord Palette** | ❌ No | ✅ Yes (`_chords.html`) |
| **Interval Palette** | ❌ No | ✅ Yes (2nds-8ths) |
| **Custom Chords** | ❌ No | ✅ Yes (create & save) |
| **Editor Modules** | ❌ Not loaded | ✅ Loaded dynamically |
| **Keyboard Input** | ✅ Yes (primary method) | ✅ Yes (secondary method) |
| **Piano Keys** | ✅ Yes | ✅ Yes |
| **Click Note Placement** | ❌ No | ✅ Yes (palette click mode) |
| **Palette Drag Mode** | N/A | ✅ Toggle between drag/click |
| **Note Selection** | ❌ No | ✅ Yes (click to select) |
| **Note List Widgets** | ❌ No | ✅ Yes (treble/bass lists) |
| **Measure Navigation** | ❌ No | ✅ Yes (prev/next buttons) |
| **Property Editing** | ❌ No | ✅ Yes (duration, velocity, etc.) |
| **Tie/Slur Controls** | ❌ No | ✅ Yes (add/remove buttons) |
| **Transpose Operations** | ❌ No | ✅ Yes (note & score level) |
| **Split Note** | ❌ No | ✅ Yes |
| **Duplicate Note** | ❌ No | ✅ Yes |
| **Interaction Model** | Keyboard-only | Multi-modal (drag/click/keyboard) |

### Workflow Differences

**Main Route Workflow:**
1. User plays notes on computer keyboard
2. Notes are added to score in real-time
3. Basic playback controls available
4. Read-only score visualization

**Editor Route Workflow:**
1. User selects measure to edit
2. User drags notes/chords/rests from palette to score
3. User clicks on notes to select and edit
4. User modifies properties via sidebar controls
5. User can transpose, duplicate, or delete notes
6. Full editing capabilities with visual feedback

---

## Implementation Details

### State Management

**File:** `static/js/core/appState.js`

**Key State Variables:**

```javascript
export const pianoState = {
  // Drag state
  togglePaletteDragMode: true,     // Drag vs. click mode

  // Selection state
  currentSelectedMeasure: -1,       // Currently selected measure index
  currentSelectedNote: null,        // Currently selected note object

  // Score state
  quantize: 'q',                    // Current note duration for input
  keySignature: 'C',                // Current key signature
  timeSignature: { numerator: 4, denominator: 4 },
  tempo: 120,                       // BPM

  // UI state
  floatingPanelDocked: true,        // Floating panel dock state

  // Custom data
  customChords: [],                 // User-created chord definitions

  // ... other state variables
};
```

### Key Signature Correction

**Function:** `applyKeySignatureCorrection(rawMIDI, keySignature)`

Location: `static/js/core/note-data.js`

When a note is dragged to the score, its pitch is automatically adjusted to fit the current key signature:

```javascript
export function applyKeySignatureCorrection(rawMIDI, keySignatureName) {
  const keyData = KEY_SIGNATURES[keySignatureName];
  if (!keyData) return rawMIDI;

  const noteInfo = ALL_NOTE_INFO.find(n => n.midi === rawMIDI);
  if (!noteInfo) return rawMIDI;

  const noteLetter = noteInfo.name[0]; // C, D, E, F, G, A, B

  // Check if this note should be modified in this key
  if (keyData.sharps && keyData.sharps.includes(noteLetter)) {
    // Key has sharps on this note
    if (!noteInfo.name.includes('#')) {
      return rawMIDI + 1; // Sharpen it
    }
  } else if (keyData.flats && keyData.flats.includes(noteLetter)) {
    // Key has flats on this note
    if (!noteInfo.name.includes('b')) {
      return rawMIDI - 1; // Flatten it
    }
  }

  return rawMIDI;
}
```

**Example:**
- In key of G major (one sharp: F#)
- User drags note to F4 position
- `rawMIDI` = 65 (F4)
- Function returns 66 (F#4)
- Note is displayed as F#4

### Event System

The editor uses a custom event system for communication between components:

**Key Events:**

```javascript
// Note added to score
document.dispatchEvent(new CustomEvent('noteAddedToScore', {
  detail: {
    measureIndex: 0,
    noteId: '1234567890',
    note: { name: 'C4', clef: 'treble', duration: 'q' }
  }
}));

// Note selected
document.dispatchEvent(new CustomEvent('noteSelected', {
  detail: {
    measureIndex: 0,
    clef: 'treble',
    noteId: '1234567890',
    note: { /* note object */ }
  }
}));

// Note dropped (from drag operation)
document.dispatchEvent(new CustomEvent('noteDropped', {
  detail: {
    fromMeasureIndex: 0,
    fromNoteId: '1234567890',
    toMeasureIndex: 1,
    insertBeforeNoteId: null,
    clefChanged: false,
    pitchChanged: true,
    newClef: 'treble',
    newPitch: 'D4',
    chordAnchor: 'bottom'
  }
}));

// Measure selected
document.dispatchEvent(new CustomEvent('measureSelected', {
  detail: { measureIndex: 0 }
}));

// Custom chord added
document.dispatchEvent(new CustomEvent('customChordAdded', {
  detail: {
    chord: { treble: ['E4', 'G4', 'C5'], bass: ['C3', 'E3', 'G3'] },
    displayName: 'Cmaj'
  }
}));
```

### Chord System

**File:** `static/js/core/note-data.js`

**Diatonic Chord Generation:**

```javascript
export function getDiatonicChordAtNote(rootNoteName, degree, keySignatureName) {
  // Get the scale for this key
  const scale = SCALES[keySignatureName];
  if (!scale) return null;

  // Get the chord type for this degree (I, ii, iii, etc.)
  const chordType = getChordTypeForDegree(degree, keySignatureName);

  // Build chord intervals based on type
  const intervals = chordType === 'major' ? [0, 4, 7] : [0, 3, 7];

  // Calculate chord notes
  const rootMIDI = NOTES_BY_NAME[rootNoteName];
  const chordNotes = intervals.map(interval => {
    const noteMIDI = rootMIDI + interval;
    return ALL_NOTE_INFO.find(n => n.midi === noteMIDI).name;
  });

  // Separate into treble and bass voicings
  return {
    treble: chordNotes.filter(name => {
      const midi = NOTES_BY_NAME[name];
      return midi >= 60; // Middle C and above
    }),
    bass: chordNotes.filter(name => {
      const midi = NOTES_BY_NAME[name];
      return midi < 60; // Below middle C
    }),
    displayName: `${degree} (${keySignatureName})`
  };
}
```

**Interval Chord Generation:**

```javascript
export function createIntervalChord(rootNoteName, intervalType) {
  const rootMIDI = NOTES_BY_NAME[rootNoteName];

  // Define interval semitones
  const intervalSemitones = {
    '2nd': 2, '3rd': 4, '4th': 5, '5th': 7,
    '6th': 9, '7th': 11, '8ve': 12
  };

  const semitones = intervalSemitones[intervalType];
  if (!semitones) return null;

  const topMIDI = rootMIDI + semitones;
  const topNoteInfo = ALL_NOTE_INFO.find(n => n.midi === topMIDI);

  return {
    treble: rootMIDI >= 60 ? [rootNoteName, topNoteInfo.name] : [],
    bass: rootMIDI < 60 ? [rootNoteName, topNoteInfo.name] : [],
    displayName: intervalType
  };
}
```

### Custom Chord Creation

**Process:**

1. User selects existing notes in score
2. User clicks "Save as Chord" button
3. Dialog prompts for chord name
4. Chord is saved to `pianoState.customChords`
5. Button is added to palette dynamically
6. Chord persists in localStorage

**Implementation:**

```javascript
document.getElementById('saveAsChord').addEventListener('click', () => {
  if (!pianoState.currentSelectedNote) {
    updateUI("Select a chord first", { error: true });
    return;
  }

  const chordName = prompt("Enter chord name:");
  if (!chordName) return;

  // Extract chord notes from selection
  const chord = extractChordFromSelection(pianoState.currentSelectedNote);

  // Save to state
  pianoState.customChords.push({
    chord: chord,
    displayName: chordName
  });

  // Save to localStorage
  saveToLocalStorage();

  // Dispatch event to add button to palette
  document.dispatchEvent(new CustomEvent('customChordAdded', {
    detail: { chord, displayName: chordName }
  }));
});
```

---

## Conclusion

The editor route (`/editor`) is a comprehensive superset of the main route (`/`), adding:

1. **Drag-and-Drop System** - Visual note placement with real-time preview
2. **Palette UI** - Organized collection of draggable notes, rests, chords, and intervals
3. **Side Panel Controls** - Complete editing interface for notes, measures, and score
4. **Floating Editor Panel** - Contextual note editor that can dock/undock
5. **Two Interaction Modes** - Toggle between drag and click placement
6. **Advanced Editing** - Transpose, tie/slur, split, duplicate operations
7. **Custom Chords** - User-defined chord creation and storage

The main route focuses on keyboard-based real-time input, while the editor route provides a full notation editor with visual feedback and multi-modal interaction.

### Potential Integration into Main Route

If you want to incorporate editor features into the main route, consider:

**Low-Hanging Fruit:**
- Add palette as optional side panel
- Enable drag-and-drop note placement
- Add note selection and editing capability

**Medium Complexity:**
- Implement floating editor panel for selected notes
- Add measure/score controls
- Enable custom chord creation

**Full Integration:**
- Load all editor modules
- Include complete side panel
- Provide toggle to switch between "Play Mode" and "Edit Mode"

The modular structure of the codebase makes selective feature integration relatively straightforward, as most functionality is encapsulated in dedicated modules (`paletteHelpers.js`, `scoreEditor.js`, etc.).