# Right-Click Context Menu Implementation Plan

## Overview

Add a right-click context menu to the score area that provides access to the same controls currently available in the editor sidebar. The menu should appear at the cursor position when the user right-clicks on the rendered score, with context-sensitive items based on whether a note, measure, or empty area was clicked.

The context menu should work on **both** the `/` route and the `/editor` route. To support this, `initializeMusicEditor()` will be split into two separate functions — one for score interaction (usable by any route) and one for sidebar DOM wiring (editor-only).

---

## Prerequisite: Split `initializeMusicEditor()` into Two Functions

### Current State

`initializeMusicEditor()` in `static/js/editor/scoreEditor.js` (line 879) is a single monolithic function that does two unrelated things:

1. **Score interaction setup** (lines 879-884) — Calls `enableScoreInteraction()` with click/select callbacks, sets up `noteDropped` listener (line 1117), `noteAddedToScore` listener (line 1284), Delete key handler (line 1260), and `renderNoteEditBox()`.

2. **Sidebar DOM wiring** (lines 886-1115) — Event delegation on `#editorContainer` for click, input, and change events; populates duration/octave dropdowns (lines 1237-1257).

### Proposed Split

#### `initializeScoreInteraction()` — New exported function

Handles everything related to the score element itself. Can be called by any route that has a rendered score.

**Contents:**
- `enableScoreInteraction()` call with `changeMeasure` and `handleEditorNoteSelectClick` callbacks (lines 881-884)
- `noteDropped` event listener (lines 1117-1235) — handles drag-and-drop results from the score
- `noteAddedToScore` event listener (lines 1284-1290) — auto-selects newly added notes
- Delete key listener (lines 1260-1281) — removes selected note on Delete keypress
- `scoreContextMenu` event listener — **new**, for the context menu feature
- Close-on-click and close-on-Escape listeners for context menu — **new**

**Does NOT include:**
- `renderNoteEditBox()` call — This populates the sidebar note list which doesn't exist on `/`. Instead, it will be called conditionally: only if `#editorContainer` exists.
- Sidebar event delegation (click/input/change on `#editorContainer`)
- Duration/octave dropdown population

#### `initializeEditorSidebar()` — New exported function

Handles everything related to the `#editorContainer` sidebar DOM. Only called by `/editor`.

**Contents:**
- `renderNoteEditBox(false)` initial render (line 880)
- `editorContainer` click event delegation (lines 893-1028)
- `editorContainer` input event listener for sliders (lines 1031-1043)
- `editorContainer` change event listener for dropdowns (lines 1045-1115)
- Duration dropdown population (lines 1237-1246)
- Octave dropdown population (lines 1248-1257)

#### `initializeMusicEditor()` — Preserved as a convenience wrapper

To avoid breaking the existing `/editor` route, the original function is kept but simply calls both:

```javascript
export function initializeMusicEditor() {
    initializeScoreInteraction();
    initializeEditorSidebar();
}
```

### Route Usage

| Route | What to call | What it enables |
|-------|-------------|-----------------|
| `/editor` | `initializeMusicEditor()` (no change) | Score interaction + sidebar + context menu |
| `/` | `initializeScoreInteraction()` | Score interaction + context menu (no sidebar) |

### Changes to `templates/piano.html`

The `/` route template currently only imports `appState.js` and `listenerManager.js`. It will need to also import and call `initializeScoreInteraction()`:

```javascript
import { pianoState } from '/static/js/core/appState.js';
import { addBasicKeyboardListeners } from '/static/js/ui/listenerManager.js';
import { initializeScoreInteraction } from '/static/js/editor/scoreEditor.js';

pianoState.instrument = templateInstrument;
addBasicKeyboardListeners();

// Wait for base init, then enable score interaction + context menu
document.addEventListener('pianoTourBaseReady', () => {
    initializeScoreInteraction();
}, { once: true });
```

The same pattern applies to other instrument route templates (`guitar.html`, `cello.html`, etc.) if context menus should be available there too.

---

## Current Sidebar Controls Inventory

The editor sidebar (defined in `templates/editor.html` lines 14-242, with logic in `static/js/editor/scoreEditor.js`) contains these control groups:

### 1. Score Controls
- Time Signature (numerator/denominator selects)
- Tempo (BPM dropdown)
- Measure navigation (prev/next buttons, measure number input)

### 2. Note Lists (Treble & Bass Clef)
- Note select buttons (dynamically populated)
- "+" buttons to insert notes between existing notes

### 3. Note Editor (shown when a note is selected)
- **Pitch:** Letter, Accidental, Octave dropdowns
- **Duration:** Duration dropdown
- **Playback:** Performed Duration slider (0-100%), Velocity slider (0-127)
- **Actions:** Remove Note, Toggle Clef, Toggle Rest, Split Note
- **Transpose Note:** Semitone Up/Down, Octave Up/Down
- **Ties & Slurs:** Add Tie, Add Slur, Remove Tie/Slur, Cancel Slur
- **Duplicate:** Duplicate Note

### 4. Measure Editor
- Move to End, Add Measure After, Duplicate Measure, Delete Measure

### 5. Score Editor
- Transpose Score: Semitone Up/Down, Octave Up/Down

---

## Context Menu Design

The context menu will show **different items depending on what was right-clicked**:

### When right-clicking on a NOTE:
```
┌─────────────────────────┐
│ Note: C4 (Quarter)      │  <- Header (non-clickable)
│─────────────────────────│
│ Remove Note              │
│ Duplicate Note           │
│ Split Note               │
│ Toggle Rest              │
│ Toggle Clef              │
│─────────────────────────│
│ Transpose >             │  <- Submenu
│   ├ Semitone Up          │
│   ├ Semitone Down        │
│   ├ Octave Up            │
│   └ Octave Down          │
│─────────────────────────│
│ Ties & Slurs >          │  <- Submenu
│   ├ Add Tie              │
│   ├ Add Slur             │
│   └ Remove Tie/Slur      │
│─────────────────────────│
│ Insert Note Before       │
│ Insert Note After        │
└─────────────────────────┘
```

### When right-clicking on a MEASURE (but not on a note):
```
┌─────────────────────────┐
│ Measure 3               │  <- Header
│─────────────────────────│
│ Add Measure After        │
│ Duplicate Measure        │
│ Move to End              │
│ Delete Measure           │
│─────────────────────────│
│ Transpose Score >       │  <- Submenu
│   ├ Semitone Up          │
│   ├ Semitone Down        │
│   ├ Octave Up            │
│   └ Octave Down          │
└─────────────────────────┘
```

### Rationale for excluded controls

The following sidebar controls are **intentionally excluded** from the context menu because they are better suited to persistent UI elements rather than a transient menu:

- **Time Signature / Tempo** — These use dropdowns and selects; a context menu isn't the right UX for these.
- **Measure Navigation** — Right-clicking a measure already navigates to it; prev/next buttons are redundant here.
- **Note Pitch Editing (Letter/Accidental/Octave)** — These require dropdown selects and would be clunky in a context menu. The sidebar or drag-to-edit on the score is better.
- **Duration** — Same reasoning; the sidebar dropdown is a better UX.
- **Performed Duration / Velocity sliders** — Sliders don't work well in context menus.
- **Note list buttons / "+" insert buttons** — These are sidebar-specific navigation tools.

---

## Implementation Details

### Files to Modify

| File | Changes |
|------|---------|
| `static/js/editor/scoreEditor.js` | Split `initializeMusicEditor()` into `initializeScoreInteraction()` + `initializeEditorSidebar()`; add context menu build/show/hide logic |
| `static/css/editor.css` | Add context menu and submenu CSS styles |
| `static/js/score/scoreRenderer.js` | Add `contextmenu` event listener to the score element within `enableScoreInteraction()` |
| `templates/piano.html` | Import and call `initializeScoreInteraction()` |

### No New Files Needed

All logic will be added to existing files to maintain the current architecture.

---

### Step 1: Split `initializeMusicEditor()` (`static/js/editor/scoreEditor.js`)

Refactor the existing function into two exported functions as described in the Prerequisite section above. Keep `initializeMusicEditor()` as a wrapper that calls both. This is a pure refactor with no behavior change for existing callers.

**Exports to add:** `initializeScoreInteraction`

---

### Step 2: Add CSS for the Context Menu (`static/css/editor.css`)

Add styles for the context menu that reuse the existing visual language (dark translucent background matching `.floating-panel` and `.note-editor` styles):

```css
/* Context Menu Styles */
.editor-context-menu {
    position: fixed;
    z-index: 5000;
    background: rgba(30, 41, 59, 0.97);
    backdrop-filter: blur(20px);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    min-width: 200px;
    padding: 4px 0;
    color: white;
    font-size: 14px;
}

.editor-context-menu__header { ... }       /* Non-clickable header */
.editor-context-menu__separator { ... }    /* Divider line */
.editor-context-menu__item { ... }         /* Clickable menu item */
.editor-context-menu__item:hover { ... }   /* Hover state */
.editor-context-menu__item--disabled { ... } /* Greyed out */
.editor-context-menu__submenu { ... }      /* Nested submenu container */
.editor-context-menu__item--has-submenu::after { ... }  /* ">" indicator */
```

Key styling decisions:
- Match the existing dark theme (`rgba(30, 41, 59, ...)` from `editor.css` line 9, 84)
- Use `position: fixed` with `z-index: 5000` (above the floating panel at 4000)
- Submenus appear to the right of the parent item, with fallback to left if near viewport edge
- Context menu styles live in the main `styles.css` (not `editor.css`) since the menu is used on all routes

---

### Step 3: Add Context Menu Event to Score Interaction (`static/js/score/scoreRenderer.js`)

Within `enableScoreInteraction()` (line 528), add a new `contextmenu` event listener. This function already has access to `detectNoteClick()` and `detectMeasureClick()` which are exactly what we need to determine what was right-clicked.

```javascript
// Inside enableScoreInteraction(), after existing event listeners
scoreElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();

    const rect = scoreElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const noteTarget = detectNoteClick(x, y);
    const measureIndex = detectMeasureClick(x, y);

    // Dispatch custom event with context info
    document.dispatchEvent(new CustomEvent('scoreContextMenu', {
        detail: {
            clientX: event.clientX,
            clientY: event.clientY,
            noteTarget,      // { measureIndex, clef, noteId } or null
            measureIndex      // -1 if not on a measure
        }
    }));
});
```

**Why a custom event?** The `scoreRenderer.js` module shouldn't know about editor UI concerns. By dispatching a custom event (consistent with the existing `noteDropped` and `noteAddedToScore` custom events already used in the codebase), we keep the rendering module decoupled. The `scoreEditor.js` module listens for this event and manages the context menu.

---

### Step 4: Context Menu Logic in `scoreEditor.js`

Add the following to `scoreEditor.js`, leveraging **existing functions** already defined in the module:

#### 4a. Context Menu Builder

A function that creates the menu DOM dynamically based on context. No static HTML template needed — the menu is built from a data structure describing the items:

```javascript
function buildContextMenu(detail) {
    const menu = document.createElement('div');
    menu.className = 'editor-context-menu';
    menu.id = 'editorContextMenu';

    if (detail.noteTarget && detail.noteTarget.noteId !== null) {
        buildNoteContextMenu(menu, detail);
    } else if (detail.measureIndex !== -1) {
        buildMeasureContextMenu(menu, detail);
    }

    return menu;
}
```

#### 4b. Note Context Menu Items

Each item maps to an **existing handler function** already in `scoreEditor.js`:

| Menu Item | Existing Function | Location |
|-----------|------------------|----------|
| Remove Note | `removeNoteFromMeasure()` | Imported from `scoreWriter.js` (line 19) |
| Duplicate Note | `handleDuplicateNote()` | Defined at ~line 350 |
| Split Note | `splitNote()` | Imported from `scoreWriter.js` (line 19) |
| Toggle Rest | `placeNote()` with `{ isRest: !note.isRest }` | Inline logic at line 929-937 |
| Toggle Clef | `placeNote()` with clef toggle | Inline logic at line 923-928 |
| Transpose Semitone Up | `transposeSelectedNote(1)` | Defined at ~line 82 |
| Transpose Semitone Down | `transposeSelectedNote(-1)` | Same |
| Transpose Octave Up | `transposeSelectedNote(12)` | Same |
| Transpose Octave Down | `transposeSelectedNote(-12)` | Same |
| Add Tie | `handleAddTie()` | Defined at line 148 |
| Add Slur | `handleAddSlur()` | Defined at line 193 |
| Remove Tie/Slur | `handleRemoveTie()` | Defined at ~line 280 |
| Insert Note Before/After | `addNoteToMeasure()` | Imported from `scoreWriter.js` |

**No new action functions need to be created.** Every menu item maps directly to an existing function.

#### 4c. Measure Context Menu Items

| Menu Item | Existing Function |
|-----------|------------------|
| Add Measure After | `handleAddMeasureAfter()` |
| Duplicate Measure | `handleDuplicateMeasure()` |
| Move to End | `handleMoveMeasureToEnd()` |
| Delete Measure | `handleDeleteMeasure()` |
| Transpose Score | `transposeScore()` (imported from `scoreWriter.js`) |

Again, **all functions already exist.**

#### 4d. Show/Hide Logic

```javascript
function showContextMenu(clientX, clientY, menu) {
    // Remove any existing context menu
    hideContextMenu();

    document.body.appendChild(menu);

    // Position with viewport boundary checks
    const rect = menu.getBoundingClientRect();
    let x = clientX;
    let y = clientY;
    if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
}

function hideContextMenu() {
    const existing = document.getElementById('editorContextMenu');
    if (existing) existing.remove();
}
```

#### 4e. Event Listener Registration

In `initializeScoreInteraction()` (not the sidebar function), add:

```javascript
// Listen for context menu events from the score
document.addEventListener('scoreContextMenu', (event) => {
    const { clientX, clientY, noteTarget, measureIndex } = event.detail;

    // If a note was right-clicked, select it first
    if (noteTarget && noteTarget.noteId !== null) {
        handleEditorNoteSelectClick(noteTarget.measureIndex, noteTarget.clef, noteTarget.noteId);
    } else if (measureIndex !== -1) {
        changeMeasure(measureIndex);
    }

    const menu = buildContextMenu(event.detail);
    if (menu.children.length > 0) {
        showContextMenu(clientX, clientY, menu);
    }
});

// Close context menu on click outside or Escape
document.addEventListener('click', hideContextMenu);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideContextMenu();
});
```

---

### Step 5: Update `/` Route Template (`templates/piano.html`)

Add the `initializeScoreInteraction()` import and call, gated behind `pianoTourBaseReady` to match the existing initialization pattern:

```javascript
import { initializeScoreInteraction } from '/static/js/editor/scoreEditor.js';

document.addEventListener('pianoTourBaseReady', () => {
    initializeScoreInteraction();
}, { once: true });
```

---

### Step 6: Submenu Behavior

Submenus (Transpose, Ties & Slurs) appear on hover, positioned to the right of the parent item. If the submenu would overflow the viewport, position it to the left instead. This follows the same pattern used in the existing dropdown menu system in `uiHelpers.js` (lines 564-659).

---

## Existing Code Reuse Summary

| What | Source | Reuse Type |
|------|--------|------------|
| `removeNoteFromMeasure()` | `scoreWriter.js` | Direct call |
| `addNoteToMeasure()` | `scoreWriter.js` | Direct call |
| `splitNote()` | `scoreWriter.js` | Direct call |
| `placeNote()` | `scoreWriter.js` | Direct call |
| `createTie()` | `scoreWriter.js` | Direct call |
| `removeTie()` | `scoreWriter.js` | Direct call |
| `transposeScore()` | `scoreWriter.js` | Direct call |
| `insertMeasure()` | `scoreWriter.js` | Direct call |
| `deleteMeasure()` | `scoreWriter.js` | Direct call |
| `duplicateMeasure()` | `scoreWriter.js` | Direct call |
| `moveMeasureToEnd()` | `scoreWriter.js` | Direct call |
| `handleAddTie()` | `scoreEditor.js` | Direct call |
| `handleAddSlur()` | `scoreEditor.js` | Direct call |
| `handleRemoveTie()` | `scoreEditor.js` | Direct call |
| `handleDuplicateNote()` | `scoreEditor.js` | Direct call |
| `handleAddMeasureAfter()` | `scoreEditor.js` | Direct call |
| `handleDuplicateMeasure()` | `scoreEditor.js` | Direct call |
| `handleDeleteMeasure()` | `scoreEditor.js` | Direct call |
| `handleMoveMeasureToEnd()` | `scoreEditor.js` | Direct call |
| `transposeSelectedNote()` | `scoreEditor.js` | Direct call |
| `handleEditorNoteSelectClick()` | `scoreEditor.js` | Direct call |
| `changeMeasure()` | `scoreEditor.js` | Direct call |
| `renderNoteEditBox()` | `scoreEditor.js` | Conditional call (only if sidebar exists) |
| `detectNoteClick()` | `scoreRenderer.js` | Used in event handler |
| `detectMeasureClick()` | `scoreRenderer.js` | Used in event handler |
| `saveToLocalStorage()` | `ioHelpers.js` | Called by scoreWriter functions |
| Dark panel theme styles | `editor.css` | Visual consistency |
| Custom event pattern | `noteDropped`, `noteAddedToScore` | Architectural pattern |

**New functions to create: 5** (all are UI-only, no business logic)
1. `initializeScoreInteraction()` — Extracted from `initializeMusicEditor()`, sets up score interaction + context menu
2. `buildContextMenu()` — Assembles DOM from context
3. `buildNoteContextMenu()` — Populates note-specific items
4. `buildMeasureContextMenu()` — Populates measure-specific items
5. `showContextMenu()` / `hideContextMenu()` — Positioning and lifecycle

**Renamed function:**
- The remainder of `initializeMusicEditor()` (sidebar-only code) becomes `initializeEditorSidebar()`

---

## Implementation Order

1. **Split function** — Refactor `initializeMusicEditor()` into `initializeScoreInteraction()` + `initializeEditorSidebar()`, verify `/editor` still works
2. **CSS** — Add context menu styles to `styles.css`
3. **Score event** — Add `contextmenu` listener in `scoreRenderer.js`
4. **Menu logic** — Add build/show/hide functions in `scoreEditor.js`
5. **Event wiring** — Add `scoreContextMenu` listener in `initializeScoreInteraction()`
6. **`/` route** — Update `piano.html` to call `initializeScoreInteraction()`
7. **Testing** — Verify context menu works on both `/` and `/editor`, verify sidebar still works on `/editor`

---

## Edge Cases to Handle

- **Viewport overflow:** Menu should reposition if it would render off-screen (both X and Y axes)
- **Submenu overflow:** Submenus should flip to the left side if near right edge
- **Slur mode active:** If `slurMode` is true, the context menu should either not appear or show a "Cancel Slur" option
- **No note selected after right-click on empty area:** Don't show note-specific items
- **Multiple menus:** Always remove existing menu before showing a new one
- **Touch devices:** Context menu should not interfere with long-press behavior (can be addressed later if needed)
- **`renderNoteEditBox()` on `/` route:** This function populates the sidebar note lists. When called from `initializeScoreInteraction()` on a route without `#editorContainer`, it should either be skipped or handle the missing DOM gracefully. The simplest approach: check for `document.getElementById('editorContainer')` before calling it.
