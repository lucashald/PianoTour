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
- **Touch devices:** See the Mobile Support section below for full details.
- **`renderNoteEditBox()` on `/` route:** This function populates the sidebar note lists. When called from `initializeScoreInteraction()` on a route without `#editorContainer`, it should either be skipped or handle the missing DOM gracefully. The simplest approach: check for `document.getElementById('editorContainer')` before calling it.

---

## Mobile Support

### Current State

The score interaction in `scoreRenderer.js` (lines 552-654) uses exclusively **mouse events** (`mousedown`, `mousemove`, `mouseup`). There are no `touchstart`/`touchmove`/`touchend` listeners on the score element. The piano keys use `pointerdown`/`pointermove` (which handle touch), but the score does not.

This means on mobile today, you cannot click notes or drag them on the score — even on the `/editor` route. The sidebar buttons work (standard DOM elements), but direct score interaction is mouse-only.

### Impact of the Context Menu Plan on Mobile

The `contextmenu` event behaves inconsistently on mobile:

- **Android Chrome/Firefox:** Long-press fires `contextmenu` after ~500ms, but the underlying `mousedown`/`mouseup` detection doesn't work on touch, so the score can't detect what was pressed.
- **iOS Safari:** Long-press triggers the native text selection / callout menu. The `contextmenu` event is **not reliably fired**, and `preventDefault()` doesn't suppress the native callout.

The context menu changes won't break anything on mobile (the score is already non-interactive there), but they also won't work without additional touch support.

### Steps Required for Mobile Support

#### Mobile Step 1: Migrate Score Interaction to Pointer Events (Prerequisite)

`enableScoreInteraction()` in `scoreRenderer.js` (line 528) needs to handle touch. The simplest approach is to switch from mouse events to **pointer events**, matching the pattern already used for piano keys in `listenerManager.js` (lines 115-116). Pointer events unify mouse and touch into one API.

**Changes to `scoreRenderer.js`:**

| Current (mouse-only) | New (pointer, unified) |
|----------------------|----------------------|
| `mousedown` (line 553) | `pointerdown` |
| `mousemove` (line 568) | `pointermove` |
| `mouseup` (line 615) | `pointerup` |

Additional requirements:
- Add `touch-action: none` CSS on the score element to prevent browser scroll/zoom interference
- Guard `event.button !== 0` checks to only apply for mouse pointer types (`event.pointerType === 'mouse'`)
- The drag threshold (`DRAG_THRESHOLD`) may need to increase for touch since fingers are less precise than cursors

This step has **shared benefit** beyond context menus — it enables all score interaction on mobile (clicking, dragging, selecting).

#### Mobile Step 2: Long-Press Timer for Context Menu Trigger

Since `contextmenu` isn't reliable on mobile (especially iOS), implement a manual long-press timer:

```javascript
let longPressTimer = null;
const LONG_PRESS_DURATION = 500; // ms

scoreElement.addEventListener("pointerdown", (event) => {
    if (event.pointerType === 'touch') {
        longPressTimer = setTimeout(() => {
            const rect = scoreElement.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const noteTarget = detectNoteClick(x, y);
            const measureIndex = detectMeasureClick(x, y);

            document.dispatchEvent(new CustomEvent('scoreContextMenu', {
                detail: { clientX: event.clientX, clientY: event.clientY, noteTarget, measureIndex }
            }));
        }, LONG_PRESS_DURATION);
    }
});

scoreElement.addEventListener("pointermove", () => clearTimeout(longPressTimer));
scoreElement.addEventListener("pointerup", () => clearTimeout(longPressTimer));
scoreElement.addEventListener("pointercancel", () => clearTimeout(longPressTimer));
```

This integrates with the existing `scoreContextMenu` custom event, so the same context menu build/show logic handles both desktop right-click and mobile long-press.

#### Mobile Step 3: CSS Touch Adjustments

| CSS Change | Why |
|-----------|-----|
| `-webkit-touch-callout: none` on score element | Suppress native iOS callout on long-press |
| `touch-action: none` on score element | Prevent scroll/zoom during score interaction |
| Menu items minimum 44x44px tap targets | Apple HIG / Material Design touch guidelines |
| Position menu **above** touch point | Prevent finger from covering the menu |

#### Mobile Step 4: Gesture Disambiguation (Tap vs Long-Press vs Drag)

On touch, three gestures must be distinguished on the same element:

| Gesture | Duration | Movement | Action |
|---------|----------|----------|--------|
| **Tap** | Short (< 500ms) | None | Select note / select measure |
| **Long-press** | Hold >= 500ms | None | Show context menu |
| **Drag** | Any | Beyond threshold | Move note to new position |

The long-press timer must be cancelled if the user starts dragging (movement exceeds threshold). The existing drag threshold logic in `scoreRenderer.js` (lines 576-588) already handles tap-vs-drag — the long-press timer adds a third branch.

#### Mobile Step 5: Submenu UX Change

Submenus that open on `:hover` don't work on touch. On touch devices, submenus should **tap-to-expand** instead. This can be handled by detecting `pointerType` when the menu is shown and binding `click` instead of `mouseenter` for submenu triggers on touch.

### Mobile Implementation Effort Summary

| Step | Scope | Benefit |
|------|-------|---------|
| Pointer events migration | Moderate — update ~6 event listeners in `enableScoreInteraction()` | Enables **all** score interaction on mobile (clicking, dragging, selecting) |
| Long-press timer | Small — ~20 lines in `scoreRenderer.js` | Mobile context menu trigger |
| CSS touch adjustments | Small — a few CSS rules | Suppress native callouts, proper tap targets |
| Gesture disambiguation | Moderate — adjust existing drag/click logic | Clean tap / long-press / drag interaction model |
| Submenu UX | Small — conditional event binding | Submenus usable on touch |

The pointer events migration (Step 1) is the largest piece and is valuable independently — it would make the entire editor usable on tablets and phones, not just the context menu.


Progress update:
Here's a summary of what changed in scoreEditor.js:

initializeMusicEditor() (line 879-1292) was split into three functions:

initializeScoreInteraction() (line 884, exported) — Score-facing setup that any route can use:

enableScoreInteraction() call with changeMeasure and handleEditorNoteSelectClick callbacks
noteDropped event listener (drag-and-drop handling)
Delete key listener
noteAddedToScore event listener
initializeEditorSidebar() (line 1063, exported) — Sidebar DOM wiring, only for /editor:

renderNoteEditBox(false) initial render
editorContainer click/input/change event delegation
Duration and octave dropdown population
initializeMusicEditor() (line 1316, exported) — Preserved as a convenience wrapper that calls both initializeScoreInteraction() then initializeEditorSidebar()

Both editor.html and api.html still import and call initializeMusicEditor() — no changes needed there. The behavior is identical; this is a pure refactor. You can verify by loading the /editor route and checking the console for the context-menu: log messages showing both functions being called in sequence.

Here's a summary of what was completed:

Sidebar guard refactor — complete. The key changes in scoreEditor.js:

renderNoteEditBox() (line 509) — now checks !!document.getElementById('editorContainer') before calling sidebar functions. Highlighting and scrolling always run regardless of sidebar presence.

renderSidebarNoteList() (line 546) — extracted function handling treble/bass note list buttons and measure navigation. Only called when sidebar exists.

renderSidebarNoteEditor() (line 660) — extracted function handling the expanded note editor panel. Only called when sidebar exists.

initializeScoreInteraction() (line 902) — score-facing setup, works on any route.

initializeEditorSidebar() (line 1071) — sidebar DOM wiring, has its own early return if editorContainer is not found.

initializeMusicEditor() (line 1334) — convenience wrapper calling both.

All console logs include "context-menu" as requested. The refactor is purely structural — no behavior changes on existing routes.

Changes Made
styles.css — Added context menu CSS styles (Step 2)

.editor-context-menu — fixed-position menu at z-index 5000 (above floating panels)
.editor-context-menu__header — non-clickable header row
.editor-context-menu__separator — divider lines
.editor-context-menu__item — clickable items with hover state
.editor-context-menu__submenu-wrapper / __submenu — hover-to-expand submenus with left-flip fallback for viewport overflow
Matches existing dark theme (rgba(30, 41, 59, ...))
scoreRenderer.js — Added contextmenu event listener (Step 3)

Fires inside enableScoreInteraction(), after the mouseup handler
Calls detectNoteClick() and detectMeasureClick() to determine what was right-clicked
Dispatches scoreContextMenu custom event (consistent with existing noteDropped/noteAddedToScore pattern)
scoreEditor.js — Added context menu logic (Steps 4 & 5)

buildContextMenu() — dispatches to note or measure menu builder based on click target
buildNoteContextMenu() — Remove, Duplicate, Split, Make Rest/Note, Toggle Clef, Transpose submenu, Ties & Slurs submenu, Insert Before/After
buildMeasureContextMenu() — Add After, Duplicate, Move to End, Delete, Transpose Score submenu
addMenuItem(), addSeparator(), addSubmenu() — DOM builder helpers
showContextMenu() — positions menu with viewport overflow correction
hideContextMenu() — removes menu from DOM
Slur mode handling — if slur mode is active, shows "Cancel Slur" instead of normal menu
Close handlers — click outside and Escape key
All menu items call existing functions — no new business logic was created
piano.html — Added score interaction on / route (Step 6)

Imports and calls initializeScoreInteraction() after pianoTourBaseReady
Enables note/measure clicking, drag-and-drop, Delete key, and context menu on the / route


Raw conversation log:

I want to create a right click context menu that will give the user access to the same controls that are currently located in the editor sidebar. Can you create a planning document for implementing that change? You'll want to review the current code base carefully because I want to avoid creating any functions that already exist in other parts of the project.
I'll start by exploring the codebase to understand the current editor sidebar controls and existing functionality before creating a planning document.

Task:Explore editor codebase thoroughly
IN
I need a very thorough exploration of this codebase to understand:

1. The editor sidebar - what controls/buttons/actions does it contain? Look at the HTML templates and JavaScript files related to the editor.
2. What existing context menu functionality exists anywhere in the project?
3. What existing utility functions, event handlers, and patterns are used throughout the project that could be reused?
4. The overall project structure - what files exist, how they're organized.

Key things to find:
- The editor sidebar HTML and its controls/buttons
- Any existing right-click or context menu code
- JavaScript files that handle editor functionality
- Existing functions for things like copy, paste, delete, transpose, etc.
- How the editor state is managed
- Any existing menu/popup/modal patterns used in the project

Be very thorough - check all HTML files, JS files, and CSS files. I need to understand the full picture before planning a context menu implementation.
Bash
IN
find /workspaces/PianoTour -type f -name "*.html" -o -name "*.js" -o -name "*.json" | head -50

OUT
/workspaces/PianoTour/deploy.js
/workspaces/PianoTour/beatit.json
/workspaces/PianoTour/templates/extras.html
/workspaces/PianoTour/templates/editor.html
/workspaces/PianoTour/templates/clarinet.html
/workspaces/PianoTour/templates/piano.html
/workspaces/PianoTour/templates/practice.html
/workspaces/PianoTour/templates/bass.html
/workspaces/PianoTour/templates/chordPreview.html
/workspaces/PianoTour/templates/api.html
/workspaces/PianoTour/templates/json.html
/workspaces/PianoTour/templates/harp.html
/workspaces/PianoTour/templates/drums.html
/workspaces/PianoTour/templates/sax.html
/workspaces/PianoTour/templates/guitar.html
/workspaces/PianoTour/templates/index.html
/workspaces/PianoTour/templates/1settings.html
/workspaces/PianoTour/templates/cello.html
/workspaces/PianoTour/templates/playable-guitar.html
/workspaces/PianoTour/templates/chordMode.html
/workspaces/PianoTour/templates/chords.html
/workspaces/PianoTour/templates/print.html
/workspaces/PianoTour/templates/fret.html
/workspaces/PianoTour/templates/violin.html
/workspaces/PianoTour/templates/backup.html
/workspaces/PianoTour/templates/french_horn.html
/workspaces/PianoTour/templates/player.html
/workspaces/PianoTour/templates/partials/_global.html
/workspaces/PianoTour/templates/partials/_volumeControl.html
/workspaces/PianoTour/templates/partials/_chordmode.html
/workspaces/PianoTour/templates/partials/_filehandler.html
/workspaces/PianoTour/templates/partials/_menu.html
/workspaces/PianoTour/templates/partials/_chords.html
/workspaces/PianoTour/templates/partials/_score.html
/workspaces/PianoTour/templates/partials/_guitarControlPanel.html
/workspaces/PianoTour/templates/partials/_MIDI.html
/workspaces/PianoTour/templates/partials/_chordSearch.html
/workspaces/PianoTour/templates/partials/_toggles.html
/workspaces/PianoTour/templates/partials/_instrument.html
/workspaces/PianoTour/templates/partials/_palette.html
/workspaces/PianoTour/templates/partials/_changeTuning.html
/workspaces/PianoTour/templates/partials/_transpose.html
/workspaces/PianoTour/templates/partials/_settings.html
/workspaces/PianoTour/templates/partials/_player.html
/workspaces/PianoTour/templates/partials/_spectrum.html
/workspaces/PianoTour/templates/partials/_drumGrid.html
/workspaces/PianoTour/node_modules/color-name/index.js
/workspaces/PianoTour/node_modules/color-name/package.json
/workspaces/PianoTour/node_modules/saxes/package.json
/workspaces/PianoTour/node_modules/saxes/saxes.js
Bash
IN
ls -la /workspaces/PianoTour/

OUT
total 552
drwxrwxrwx+  12 codespace root        4096 Feb  5 22:40 .
drwxr-xrwx+   5 codespace root        4096 Dec 11 16:56 ..
drwx------+   2 codespace codespace   4096 Jan 10 17:32 .claude
drwxrwxrwx+   2 codespace root        4096 Dec 11 17:09 .devcontainer
drwxrwxrwx+   8 codespace root        4096 Feb  6 15:45 .git
-rw-rw-rw-    1 codespace root         215 Dec 11 16:51 .gitignore
-rw-rw-rw-    1 codespace root         122 Dec 11 16:51 .gitmodules
-rw-rw-rw-    1 codespace root         602 Dec 11 16:51 Dockerfile
-rw-rw-rw-    1 codespace root       11358 Dec 11 16:51 LICENSE
drwxrwxrwx+   2 codespace root        4096 Dec 11 16:51 __pycache__
-rw-rw-rw-    1 codespace codespace  51578 Feb  5 22:40 beatit.json
-rw-rw-rw-    1 codespace root         571 Dec 11 16:51 deploy.js
drwxrwxrwx+   2 codespace root        4096 Dec 11 16:51 docs
-rw-------    1 codespace codespace  38505 Jan 10 17:36 editor.md
-rw-rw-rw-    1 codespace root         449 Dec 11 16:51 fly.toml
-rw-rw-rw-    1 codespace root         386 Dec 11 16:51 jsconfig.json
-rw-rw-rw-    1 codespace root       15213 Dec 11 16:51 main.py
drwxrwxrwx+ 283 codespace codespace  12288 Dec 11 17:18 node_modules
-rw-rw-rw-    1 codespace root      251398 Dec 11 17:18 package-lock.json
-rw-rw-rw-    1 codespace root         615 Dec 11 16:51 package.json
-rw-rw-rw-    1 codespace root         384 Dec 11 16:51 pyproject.toml
-rw-rw-rw-    1 codespace root          91 Dec 11 16:51 requirements.txt
drwxrwxrwx+   2 codespace root        4096 Dec 11 16:51 scripts
-rw-rw-rw-    1 codespace codespace  20409 Dec 11 17:52 song.json
drwxrwxrwx+   8 codespace root        4096 Dec 11 16:51 static
drwxrwxrwx+   3 codespace root        4096 Feb  5 20:23 templates
-rw-rw-rw-    1 codespace root       17846 Dec 11 16:51 test.py
-rw-rw-rw-    1 codespace codespace    448 Dec 11 18:02 todo.md
-rw-rw-rw-    1 codespace root       48070 Dec 11 16:51 tonejs.md
drwxrwxrwx+   3 codespace root        4096 Dec 11 16:51 vendor
Bash
IN
find /workspaces/PianoTour/static -type f -name "*.js" -o -name "*.css" | sort

OUT
/workspaces/PianoTour/static/css/drumstyles.css
/workspaces/PianoTour/static/css/editor.css
/workspaces/PianoTour/static/css/guitar.css
/workspaces/PianoTour/static/css/guitarControlPanel.css
/workspaces/PianoTour/static/css/icons.css
/workspaces/PianoTour/static/css/styles.css
/workspaces/PianoTour/static/js/Harmonic.js
/workspaces/PianoTour/static/js/HarmonicController.js
/workspaces/PianoTour/static/js/Thread.js
/workspaces/PianoTour/static/js/ThreadController.js
/workspaces/PianoTour/static/js/ThreadGrabber.js
/workspaces/PianoTour/static/js/classes/ChordPreview.js
/workspaces/PianoTour/static/js/classes/UniversalMusicEditor.js
/workspaces/PianoTour/static/js/classes/UniversalMusicRenderer.js
/workspaces/PianoTour/static/js/classes/chordGroupPreview.js
/workspaces/PianoTour/static/js/classes/envelopeControl.js
/workspaces/PianoTour/static/js/classes/volumeControl.js
/workspaces/PianoTour/static/js/core/appState.js
/workspaces/PianoTour/static/js/core/audioManager.js
/workspaces/PianoTour/static/js/core/chords.js
/workspaces/PianoTour/static/js/core/drum-data.js
/workspaces/PianoTour/static/js/core/icons.js
/workspaces/PianoTour/static/js/core/note-data.js
/workspaces/PianoTour/static/js/drums/drumAudio.js
/workspaces/PianoTour/static/js/drums/drumGrid.js
/workspaces/PianoTour/static/js/drums/drumIOHelpers.js
/workspaces/PianoTour/static/js/drums/drumRenderer.js
/workspaces/PianoTour/static/js/drums/drumsScoreHighlighter.js
/workspaces/PianoTour/static/js/drums/drumsScoreManager.js
/workspaces/PianoTour/static/js/drums/drumsScorePlayback.js
/workspaces/PianoTour/static/js/drums/drumsScoreWriter.js
/workspaces/PianoTour/static/js/editor/jsonEditor.js
/workspaces/PianoTour/static/js/editor/musicEditor.js
/workspaces/PianoTour/static/js/editor/scoreEditor.js
/workspaces/PianoTour/static/js/export/audioExporter.js
/workspaces/PianoTour/static/js/export/audioScheduler.js
/workspaces/PianoTour/static/js/export/drumsAudioExporter.js
/workspaces/PianoTour/static/js/index.js
/workspaces/PianoTour/static/js/instrument/fretMap.js
/workspaces/PianoTour/static/js/instrument/guitarChords.js
/workspaces/PianoTour/static/js/instrument/guitarInstrument.js
/workspaces/PianoTour/static/js/instrument/instrumentHelpers.js
/workspaces/PianoTour/static/js/instrument/keyboardHelpers.js
/workspaces/PianoTour/static/js/instrument/midi-controller.js
/workspaces/PianoTour/static/js/instrument/playbackHelpers.js
/workspaces/PianoTour/static/js/instrumentPresets/ambientSynth.js
/workspaces/PianoTour/static/js/instrumentPresets/cello.js
/workspaces/PianoTour/static/js/instrumentPresets/utils.js
/workspaces/PianoTour/static/js/instrumentPresets/warmSynth.js
/workspaces/PianoTour/static/js/score/musicHighlighter.js
/workspaces/PianoTour/static/js/score/musicWriter.js
/workspaces/PianoTour/static/js/score/printRenderer.js
/workspaces/PianoTour/static/js/score/scoreHighlighter.js
/workspaces/PianoTour/static/js/score/scoreManager.js
/workspaces/PianoTour/static/js/score/scorePlayback.js
/workspaces/PianoTour/static/js/score/scoreRenderer.js
/workspaces/PianoTour/static/js/score/scoreWriter.js
/workspaces/PianoTour/static/js/spessa/chunk-2YXXFGBV.js
/workspaces/PianoTour/static/js/spessa/encode_vorbis-VI4HVA5Y.js
/workspaces/PianoTour/static/js/spessa/local_main.js
/workspaces/PianoTour/static/js/spessa/playback_worklet.js
/workspaces/PianoTour/static/js/spessa/spes.css
/workspaces/PianoTour/static/js/spessa/spesInstrumentHelpers.js
/workspaces/PianoTour/static/js/spessa/spesPlaybackHelpers.js
/workspaces/PianoTour/static/js/spessa/spessaSynthBridge.js
/workspaces/PianoTour/static/js/spessa/style.min.css
/workspaces/PianoTour/static/js/spessa/synth_worker.js
/workspaces/PianoTour/static/js/third-party/StartAudioContext.js
/workspaces/PianoTour/static/js/ui/audioSettings.js
/workspaces/PianoTour/static/js/ui/guitarControlPanel.js
/workspaces/PianoTour/static/js/ui/guitarUI.js
/workspaces/PianoTour/static/js/ui/listenerManager.js
/workspaces/PianoTour/static/js/ui/paletteHelpers.js
/workspaces/PianoTour/static/js/ui/spectrum.js
/workspaces/PianoTour/static/js/ui/uiHelpers.js
/workspaces/PianoTour/static/js/utils/chordGroupRenderer.js
/workspaces/PianoTour/static/js/utils/ioHelpers.js
/workspaces/PianoTour/static/js/utils/math.js
/workspaces/PianoTour/static/js/utils/player.js
/workspaces/PianoTour/static/js/utils/practice.js
/workspaces/PianoTour/static/js/utils/print.js
/workspaces/PianoTour/static/js/utils/velocityHumanizer.js
Read scoreEditor.js
Read appState.js
Grep "modal|popup|menu|dropdown" (glob: **/static/css/**/*.css)
28 lines of output
Grep "function (copy|paste|delete|duplicate|transpose)" (type: js)
7 lines of output
Bash
IN
grep -n "export function" /workspaces/PianoTour/static/js/score/scoreWriter.js | head -40

OUT
72:export function setTimeSignature(numerator, denominator) {
97:  export function setTempo(newTempo) {
293:export function undoLastWrite() {
320:export function writeNote(obj) {
536:export function addNoteToMeasure(measureIndex, noteData, insertBeforeNoteId = null) {
646:export function insertMeasure(afterMeasureIndex, newMeasureData = []) {
675:export function deleteMeasure(measureIndex) {
717:export function duplicateMeasure(measureIndex) {
749:export function moveMeasureToEnd(measureIndex) {
812:export function splitNote(measureIndex, noteId) {
868:export function removeNoteFromMeasure(measureIndex, noteId) {
888:export function updateNoteInMeasure(measureIndex, noteId, newNoteData) {
942:export function placeNote(fromMeasureIndex, fromNoteId, toMeasureIndex, noteData, insertBeforeNoteId = null) {
1019:export function populateChordNames(measures, useSymbol = false) {
1098:export function resetScore() {
1113:export function processAndSyncScore(loadedData) {
1156:export function getMeasures() {
1164:export function fillRests() {
1421:export function createTie(startNoteId, endNoteId, type = 'tie') {
1436:export function removeTie(noteId) {
1484:export function createSlur(startNoteId, endNoteId, type = 'slur') {
1567:export function removeSlur(noteId) {
1638:export function updateAllNotesPerformedDuration(newPerformedDuration) {
1673:export function transposeScore(semitones) {
Read musicEditor.js
Read uiHelpers.js
Bash
IN
grep -r "localStorage\|saveToLocalStorage" /workspaces/PianoTour/static/js/utils/ioHelpers.js | head -20

OUT
    // Save to localStorage button
        saveToLocalStorage();
// Save to localStorage
export function saveToLocalStorage() {
    localStorage.setItem('autosavedScore', JSON.stringify(scoreData));
Bash
IN
find /workspaces/PianoTour/static/js -type f -name "*.js" | wc -l && find /workspaces/PianoTour/templates -type f -name "*.html" | wc -l && find /workspaces/PianoTour/static/css -type f -name "*.css" | wc -l

OUT
74
44
6
Read paletteHelpers.js
Bash
IN
grep -n "class\|id=" /workspaces/PianoTour/templates/index.html | head -40

OUT
20:  <body id="page-instrument">
21:    <audio id="unlock-audio" preload="auto" style="display: none">
28:    <div class="piano-app">
31:      <div class="sidebar-backdrop" id="sidebarBackdrop"></div>
34:      <aside class="piano-app__side-panel" id="sidePanel">
35:        <button class="sidebar-close-btn" id="sidebarCloseBtn" aria-label="Close sidebar">×</button>
40:      <main class="piano-app__content-area">
42:        <header class="piano-app__header">
44:          <button class="sidebar-toggle-btn" id="sidebarToggleBtn" aria-label="Open editor panel">
45:            <svg class="sidebar-toggle-icon" viewBox="0 0 25.904 25.904" xmlns="http://www.w3.org/2000/svg">
57:				<h1 class="piano-app__header-title">Piano Tour</h1>
60:				<h1 class="piano-app__header-title">Piano Tour</h1>
66:        <div class="hidden" id="audio-settings">
73:        <div class="piano-app__now-playing" id="nowPlayingDisplay"></div>
77:        <div class="outer-wrapper">
78:          <section class="instrument-panel">
88:        <nav class="main-controls">
89:          <div class="controls-button-row">
90:            <button id="clearScoreBtn" class="btn btn--danger">
93:            <button id="undo-btn" class="btn btn--danger">Undo</button>
94:            <button id="key-signature-btn" class="btn btn--info">
97:            <label class="btn btn--toggle">
100:                id="is-minor-key-btn"
101:                class="hidden-input"
103:              <span id="minor-key-text">Major</span>
107:          <div class="controls-button-row">
109:            <button id="chord-display-toggle" class="btn btn--toggle">
113:            <button id="settings-display-toggle" class="btn btn--toggle">
119:            <a href="/" class="btn btn--info"><span>Close Editor</span></a>
121:            <a href="/editor" class="btn btn--info"><span>Open Editor</span></a>
124:            {% if request.path != '/' %}<a href="/" class="btn btn--info"
129:              class="btn btn--info"
134:              class="btn btn--info"
139:          <div class="main-controls__chord-interface hidden" id="chordButtons">
140:            <div id="CHORD_GROUPSContainer"></div>
Now let me read a few key files to verify some specific details before writing the plan.

Read scoreEditor.js (lines 871-1120)
Read editor.html (lines 2-51)
Read editor.html (lines 51-250)
Read editor.css
Read editor.css (from line 114)
Read scoreEditor.js (lines 2-51)
Read scoreEditor.js (lines 51-200)
Read uiHelpers.js (lines 561-660)
Now let me check the score interaction code to understand how notes are clicked in the rendered score.

Read scoreRenderer.js (lines 2-31)
Grep "enableScoreInteraction"
5 lines of output
Grep "enableScoreInteraction" (in /workspaces/PianoTour/static/js/score/scoreRenderer.js)
86 lines of output
Read scoreRenderer.js (lines 551-670)
Now I have a thorough understanding of the codebase. Let me also check the existing editor.md file to understand the document format being used.

Read editor.md (lines 981-1010)
Now I have everything I need. Let me create the planning document.

Write context-menu-plan.md
365 lines
# Right-Click Context Menu Implementation Plan

## Overview

Add a right-click context menu to the editor's score area that provides access to the same controls currently available in the editor sidebar. The menu should appear at the cursor position when the user right-clicks on the rendered score, with context-sensitive items based on whether a note, measure, or empty area was clicked.

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
│ Note: C4 (Quarter)      │  ← Header (non-clickable)
│─────────────────────────│
│ Remove Note              │
│ Duplicate Note           │
│ Split Note               │
│ Toggle Rest              │
│ Toggle Clef              │
│─────────────────────────│
│ Transpose ►             │  ← Submenu
│   ├ Semitone Up          │
│   ├ Semitone Down        │
│   ├ Octave Up            │
│   └ Octave Down          │
│─────────────────────────│
│ Ties & Slurs ►          │  ← Submenu
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
│ Measure 3               │  ← Header
│─────────────────────────│
│ Add Measure After        │
│ Duplicate Measure        │
│ Move to End              │
│ Delete Measure           │
│─────────────────────────│
│ Transpose Score ►       │  ← Submenu
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
| `static/js/editor/scoreEditor.js` | Add context menu creation, show/hide logic, and click handlers |
| `static/css/editor.css` | Add context menu and submenu CSS styles |
| `static/js/score/scoreRenderer.js` | Add `contextmenu` event listener to the score element within `enableScoreInteraction()` |

### No New Files Needed

All logic will be added to existing files to maintain the current architecture.

---

### Step 1: Add CSS for the Context Menu (`static/css/editor.css`)

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
.editor-context-menu__item--has-submenu::after { ... }  /* "►" indicator */
```

Key styling decisions:
- Match the existing dark theme (`rgba(30, 41, 59, ...)` from `editor.css` line 9, 84)
- Use `position: fixed` with `z-index: 5000` (above the floating panel at 4000)
- Submenus appear to the right of the parent item, with fallback to left if near viewport edge

---

### Step 2: Add Context Menu to Score Interaction (`static/js/score/scoreRenderer.js`)

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

### Step 3: Context Menu Logic in `scoreEditor.js`

Add the following to `scoreEditor.js`, leveraging **existing functions** already defined in the module:

#### 3a. Context Menu Builder

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

#### 3b. Note Context Menu Items

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

#### 3c. Measure Context Menu Items

| Menu Item | Existing Function |
|-----------|------------------|
| Add Measure After | `handleAddMeasureAfter()` |
| Duplicate Measure | `handleDuplicateMeasure()` |
| Move to End | `handleMoveMeasureToEnd()` |
| Delete Measure | `handleDeleteMeasure()` |
| Transpose Score | `transposeScore()` (imported from `scoreWriter.js`) |

Again, **all functions already exist.**

#### 3d. Show/Hide Logic

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

#### 3e. Event Listener Registration

In `initializeMusicEditor()`, add:

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

### Step 4: Submenu Behavior

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
| `renderNoteEditBox()` | `scoreEditor.js` | Direct call |
| `detectNoteClick()` | `scoreRenderer.js` | Used in event handler |
| `detectMeasureClick()` | `scoreRenderer.js` | Used in event handler |
| `saveToLocalStorage()` | `ioHelpers.js` | Called by scoreWriter functions |
| Dark panel theme styles | `editor.css` | Visual consistency |
| Custom event pattern | `noteDropped`, `noteAddedToScore` | Architectural pattern |

**New functions to create: 4** (all are UI-only, no business logic)
1. `buildContextMenu()` — Assembles DOM from context
2. `buildNoteContextMenu()` — Populates note-specific items
3. `buildMeasureContextMenu()` — Populates measure-specific items
4. `showContextMenu()` / `hideContextMenu()` — Positioning and lifecycle

---

## Implementation Order

1. **CSS first** — Add context menu styles to `editor.css`
2. **Score event** — Add `contextmenu` listener in `scoreRenderer.js`
3. **Menu logic** — Add build/show/hide functions in `scoreEditor.js`
4. **Event wiring** — Add `scoreContextMenu` listener in `initializeMusicEditor()`
5. **Testing** — Verify all menu items trigger the correct existing functions

---

## Edge Cases to Handle

- **Viewport overflow:** Menu should reposition if it would render off-screen (both X and Y axes)
- **Submenu overflow:** Submenus should flip to the left side if near right edge
- **Slur mode active:** If `slurMode` is true, the context menu should either not appear or show a "Cancel Slur" option
- **No note selected after right-click on empty area:** Don't show note-specific items
- **Multiple menus:** Always remove existing menu before showing a new one
- **Touch devices:** Context menu should not interfere with long-press behavior (can be addressed later if needed)
I've created the planning document at context-menu-plan.md. Here's a summary of the key points:

Architecture: The context menu is context-sensitive — right-clicking a note shows note actions (remove, duplicate, split, transpose, ties/slurs), while right-clicking a measure shows measure actions (add after, duplicate, move to end, delete, transpose score).

Zero duplicated logic: Every single menu action maps directly to an existing function already in scoreEditor.js or imported from scoreWriter.js. Only 4 new functions are needed, all purely UI concerns (building the DOM, positioning, showing/hiding).

Three files modified, no new files:

scoreRenderer.js — adds a contextmenu event on the score element using the existing detectNoteClick() and detectMeasureClick() functions, dispatches a custom event
scoreEditor.js — listens for the custom event, builds and displays the menu, wires items to existing handlers
editor.css — styles matching the existing dark theme
Intentionally excluded from the context menu: time signature, tempo, measure navigation, pitch/duration dropdowns, and sliders — these are all better served by the persistent sidebar UI.

If we want the right click context menus to work on the / route and not just the /editor route, which features from the editor will we need to add to the / route?
Let me check what's currently available on the / route versus the /editor route.

Grep "enableScoreInteraction" (glob: *.js)
74 lines of output
Grep "scoreEditor|musicEditor|initializeMusicEditor" (in /workspaces/PianoTour/templates)
31 lines of output
Grep "route.*['\"/][\s]*$|@app\.route" (glob: *.py)
329 lines of output
Read index.html (lines 231-360)
Now let me check what the / route (piano.html) currently has for score interaction.

Read piano.html
Now let me check what addBasicKeyboardListeners does and what score interaction exists on the / route.

Grep "enableScoreInteraction|contextmenu|onMeasureClick|onNoteClick" (in /workspaces/PianoTour/static/js/ui/listenerManager.js)
7 lines of output
Grep "addNoteToMeasure|removeNoteFromMeasure|transposeScore|splitNote|duplicateMeasure|deleteMeasure" (in /workspaces/PianoTour/templates/index.html)
1 line of output
editor.html has a summary
Let me check the summary the user mentioned in editor.html and also look at what the base index.html imports for score interaction on the / route.

Read editor.html (from line 250)
Now let me check what happens on the / route with the score — does it have any click interaction at all?

Grep "score|drawAll|scoreRenderer" (in /workspaces/PianoTour/templates/piano.html)
1 line of output
Grep "enableScoreInteraction|scoreEditor|initializeMusicEditor" (in /workspaces/PianoTour/templates/index.html)
1 line of output
editor.md i mean
Let me check the editor.md summary the user is pointing me to.

Read editor.md (lines 2-61)
Read editor.md (lines 61-160)
Good, I now have a clear picture. Let me read the Key Differences Summary section.

Grep "Key Differences Summary" (in /workspaces/PianoTour/editor.md)
163 lines of output
Now I have the full picture. Here's the answer:

The / route currently has none of the editor features. As the comparison table in editor.md:1024-1051 shows, the main route is keyboard-only with a read-only score visualization — no note selection, no score interaction callbacks, and no editor modules loaded.

To get context menus working on /, you'd need to bring over these specific capabilities:

Must-have (core infrastructure)
enableScoreInteraction() — This is the foundation. Currently only called by initializeMusicEditor() in scoreEditor.js:881. It sets up detectNoteClick() and detectMeasureClick() on the score element, which the context menu needs to know what was right-clicked. Without this, the score is non-interactive on /.

scoreEditor.js module loading — The context menu handlers all call functions defined in this module (handleAddTie, handleDuplicateNote, transposeSelectedNote, etc.). The / route doesn't import it at all — piano.html only imports appState.js and listenerManager.js.

Editor internal state tracking — The variables editorSelectedNoteId, editorSelectedMeasureIndex, and editorSelectedClef in scoreEditor.js:25-27 are what track which note/measure is selected. Every context menu action depends on these.

Could be scoped down for /
The full initializeMusicEditor() function also wires up all the sidebar DOM listeners (click, change, input events on #editorContainer). Since / has no sidebar, you have two options:

Option A: Load the full scoreEditor.js but guard the sidebar parts. Make initializeMusicEditor() skip the editorContainer event listeners if the element doesn't exist. Then add a lighter init function (or the same one) that only calls enableScoreInteraction() and registers the scoreContextMenu listener.

Option B: Extract a shared core. Pull the state variables, note manipulation handlers (handleAddTie, transposeSelectedNote, etc.), and enableScoreInteraction call into a shared module that both routes use. The sidebar-specific DOM wiring stays in scoreEditor.js.

What you do NOT need on /
The sidebar HTML (#editorContainer, note lists, note editor panel)
The palette system (_palette.html, paletteHelpers.js)
The floating panel system
The chord palette (_chords.html)
Drag-and-drop note placement
Option A is simpler — the existing initializeMusicEditor() would just gracefully skip sidebar wiring when #editorContainer is missing (it already checks for this at scoreEditor.js:888 and returns early). You'd just need to move the enableScoreInteraction() call and context menu listener registration to before that guard.

I think it might be better long term practice to split the initializeMusicEditor() into 2 functions. The sidebar and the score are separate objects so it would make sense to have seperate function to enable each one. Does that make sense?
Yes, that makes sense. The current initializeMusicEditor() does two distinct things — sets up score interaction (clicking/selecting notes on the rendered score) and wires up the sidebar DOM listeners. Splitting those apart means the / route can call just the score interaction init, while /editor calls both.

Want me to update the planning document with this approach, or go ahead and implement the split?

Update the planning document.
Let me re-read the current plan and the full initializeMusicEditor() to make sure I capture the split accurately.

Read scoreEditor.js (lines 880-1059)
Read context-menu-plan.md
Now let me also check the remaining parts of initializeMusicEditor — specifically the noteDropped and noteAddedToScore listeners and the Delete key handler.

Read scoreEditor.js (lines 1116-1315)
Now I have the complete picture. Let me update the planning document.

Read context-menu-plan.md
Now I have everything I need. Let me write the updated plan.

Write context-menu-plan.md
479 lines
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
Done. The main additions to the plan are:

New "Prerequisite" section detailing the split of initializeMusicEditor() into initializeScoreInteraction() (score-facing, usable by any route) and initializeEditorSidebar() (sidebar DOM wiring, editor-only), with initializeMusicEditor() preserved as a wrapper that calls both
Step 1 is now the refactor/split (done first, verified before adding context menu logic)
Step 5 covers updating piano.html to import and call initializeScoreInteraction()
Files to Modify table now includes templates/piano.html
Edge cases includes handling renderNoteEditBox() gracefully when the sidebar DOM doesn't exist
Context menu event wiring now lives in initializeScoreInteraction() instead of initializeMusicEditor(), so it's available on both routes
Can you help me understand how the /editor route handles highlighting selected notes/measures while the / route doesn't have that feature?
Let me trace the highlighting code path.

Read scoreHighlighter.js
Grep "handleEditorNoteSelectClick" (in /workspaces/PianoTour/static/js/editor/scoreEditor.js)
66 lines of output
Read scoreEditor.js (lines 726-775)
Now let me check where the highlighting actually gets called from within renderNoteEditBox.

Grep "highlightSelectedNote|highlightSelectedMeasure" (in /workspaces/PianoTour/static/js/editor/scoreEditor.js)
18 lines of output
Read scoreEditor.js (lines 691-720)
Here's how it works:

The highlighting functions themselves (highlightSelectedNote, highlightSelectedMeasure, etc.) live in a shared module — scoreHighlighter.js. They operate directly on VexFlow note objects via setVexFlowNoteStyle() and are completely independent of the editor sidebar. There's nothing route-specific about them.

The reason the / route doesn't have highlighting is purely about what calls them. The call chain is:

enableScoreInteraction() in scoreRenderer.js:528 registers mousedown/mouseup handlers on the score element. On click, it calls the onNoteClick or onMeasureClick callbacks that were passed in.

On the /editor route, initializeMusicEditor() at scoreEditor.js:881-884 is what calls enableScoreInteraction() and passes those callbacks:


enableScoreInteraction(
    (measureIndex, wasNoteClicked) => changeMeasure(measureIndex, !wasNoteClicked),
    handleEditorNoteSelectClick
);
handleEditorNoteSelectClick() at scoreEditor.js:725 sets editorSelectedNoteId and calls renderNoteEditBox().

renderNoteEditBox() does two unrelated things at the end (around line 705-718):

Sidebar DOM updates — populates dropdowns, shows/hides the #editorExpandedEditor panel
Highlighting — calls highlightSelectedMeasure() and highlightSelectedNote(), then scrollToMeasure()
On the / route, none of this is loaded. piano.html never imports scoreEditor.js, never calls enableScoreInteraction(), so clicking the score does nothing — no callbacks, no highlighting, no selection.

So the highlighting isn't inherently an "editor feature" — it's a shared rendering capability that just happens to only be triggered from the editor path. When you split initializeMusicEditor() into initializeScoreInteraction() + initializeEditorSidebar(), the highlighting calls will naturally come along with initializeScoreInteraction() since they flow through handleEditorNoteSelectClick() → renderNoteEditBox() → highlightSelectedMeasure/Note(). The only thing to watch out for is that renderNoteEditBox() also tries to update sidebar DOM elements that won't exist on / — those document.getElementById(...) calls will return null, so they'll need guards or an early-exit check.

Can you give me an overview of how these changes would impact Mobile devices and also an overview of what steps we would need to take to implement the new feature on mobile?
Let me check what existing mobile/touch handling the codebase has.

Grep "touch|mobile|pointer|long.?press|@media.*max-width"
145 lines of output
Grep "touchstart|touchend|touchmove|long.?press|contextmenu" (in /workspaces/PianoTour/static/js/score/scoreRenderer.js)
1 line of output
Grep "touchstart|touchend|touchmove|long.?press|contextmenu" (in /workspaces/PianoTour/static/js/ui/listenerManager.js)
15 lines of output
Grep "touchstart|touchend|touchmove|ontouchstart|touch" (in /workspaces/PianoTour/static/js, glob: *.js)
61 lines of output
Grep "mousedown|mouseup|mousemove" (in /workspaces/PianoTour/static/js/score/scoreRenderer.js)
21 lines of output
Now I have the full picture. Here's the overview:

Impact on Mobile Devices
Current state: No touch support on the score
The score interaction in scoreRenderer.js:552-654 uses exclusively mouse events (mousedown, mousemove, mouseup). There are no touchstart/touchmove/touchend listeners on the score element at all. The piano keys use pointerdown/pointermove (which do handle touch), but the score does not.

This means on mobile today, you can't click notes or drag them on the score — even on the /editor route. The sidebar buttons work (they're standard DOM elements), but direct score interaction doesn't.

The contextmenu event on mobile
The plan adds a contextmenu event listener in enableScoreInteraction(). On mobile browsers:

Android Chrome/Firefox: A long-press fires contextmenu after ~500ms. So the context menu would technically appear on long-press — but only if the underlying mousedown/mouseup detection works, which it currently doesn't on the score since those are mouse-only events.
iOS Safari: Long-press triggers the native text selection / callout menu. The contextmenu event is not reliably fired. preventDefault() on it doesn't suppress the native callout. You need -webkit-touch-callout: none in CSS and a manual long-press timer.
Bottom line for the current plan
The context menu changes won't break anything on mobile (the score is already non-interactive there), but they also won't work without additional touch support.

What It Would Take to Support Mobile
Step 1: Fix score interaction for touch (prerequisite)
The enableScoreInteraction() function in scoreRenderer.js:528 needs to handle touch events. The simplest approach is to switch from mousedown/mousemove/mouseup to pointerdown/pointermove/pointerup, which is what the piano keys already use in listenerManager.js:115-116. Pointer events unify mouse and touch into one API. The changes would be:

mousedown (line 553) → pointerdown + add event.button !== 0 guard only for mouse (pointer events fire for all pointer types)
mousemove (line 568) → pointermove
mouseup (line 615) → pointerup
Add touch-action: none CSS on the score element to prevent browser scroll/zoom from interfering
The drag threshold (currently DRAG_THRESHOLD) may need to be larger on touch since fingers are less precise than cursors
This would also fix note clicking, dragging, and measure selection on mobile — not just the context menu.

Step 2: Context menu trigger on touch
Since contextmenu isn't reliable on mobile (especially iOS), implement a long-press timer:


let longPressTimer = null;
const LONG_PRESS_DURATION = 500; // ms

scoreElement.addEventListener("pointerdown", (event) => {
    // Start long-press timer (only for touch, not mouse)
    if (event.pointerType === 'touch') {
        longPressTimer = setTimeout(() => {
            // Fire the same scoreContextMenu custom event
            const rect = scoreElement.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const noteTarget = detectNoteClick(x, y);
            const measureIndex = detectMeasureClick(x, y);
            
            document.dispatchEvent(new CustomEvent('scoreContextMenu', {
                detail: { clientX: event.clientX, clientY: event.clientY, noteTarget, measureIndex }
            }));
        }, LONG_PRESS_DURATION);
    }
});

// Cancel on move or release
scoreElement.addEventListener("pointermove", () => clearTimeout(longPressTimer));
scoreElement.addEventListener("pointerup", () => clearTimeout(longPressTimer));
scoreElement.addEventListener("pointercancel", () => clearTimeout(longPressTimer));
Step 3: CSS considerations
Add -webkit-touch-callout: none to the score element to suppress the native iOS callout
Context menu positioning needs to account for the fact that on touch, clientX/clientY is where the finger is — the menu should appear above the touch point so the finger doesn't cover it
Menu items need larger tap targets (at least 44x44px per Apple's HIG / 48x48dp per Material Design) — the current plan's menu items may be too small for fingers
Submenus on hover won't work on touch — they'd need to be tap-to-expand instead
Step 4: Prevent conflicts between tap, long-press, and drag
This is the trickiest part. On touch, you need to distinguish three gestures on the same element:

Gesture	Action
Tap (short touch)	Select note / select measure
Long-press (hold ~500ms)	Show context menu
Drag (touch + move)	Move note to new position
The long-press timer needs to be cancelled if the user starts dragging (movement exceeds threshold), and a tap should only fire if the touch was short and didn't move. The existing drag threshold logic in scoreRenderer.js:576-588 already handles tap-vs-drag — the long-press timer just adds a third branch.

Summary of effort
Step	Scope	Shared benefit
Pointer events migration	Moderate — touch up ~6 event listeners in enableScoreInteraction()	Enables all score interaction on mobile (clicking, dragging, selecting), not just context menus
Long-press timer	Small — ~20 lines in scoreRenderer.js	Mobile context menu trigger
CSS touch adjustments	Small — a few rules	Better mobile UX
Gesture disambiguation	Moderate — adjust existing drag/click logic	Clean mobile interaction model
The pointer events migration (Step 1) is the big one, and it's valuable independently of the context menu feature — it would make the entire editor usable on tablets and phones.

add that section to our .md plan
Read context-menu-plan.md (from line 469)
Edit context-menu-plan.md
Added 108 lines
Done. The mobile support section has been added to the end of context-menu-plan.md, replacing the brief "touch devices" bullet in the edge cases with a pointer to the new detailed section. It covers the current state, the five implementation steps (pointer events migration, long-press timer, CSS adjustments, gesture disambiguation, and submenu UX), and an effort summary table.

Let's go ahead and start implementing. We'll begin by splitting initializeMusicEditor() into 2 functions and updating any calls to that function so they call both functions. This shouldn't actually change anything when we test it. If you need to add any console logs, you must use the phrase "context-menu" in the log so we can keep easily identify all console logs related to this new feature.
Update Todos

Identify all callers of initializeMusicEditor()

Split initializeMusicEditor() into initializeScoreInteraction() + initializeEditorSidebar()

Update initializeMusicEditor() to be a wrapper calling both functions

Export initializeScoreInteraction from scoreEditor.js

Verify all callers still work with the wrapper
Grep "initializeMusicEditor"
120 lines of output
Good. There are three callers:

editor.html:281,290
api.html:249,260
musicEditor.js:374 — a separate copy of the function
Let me check musicEditor.js to understand if it's relevant.

Read musicEditor.js (lines 371-430)
Grep "musicEditor\.js" (in /workspaces/PianoTour/templates)
1 line of output
Update Todos

Identify all callers of initializeMusicEditor()

Split initializeMusicEditor() into initializeScoreInteraction() + initializeEditorSidebar()

Update initializeMusicEditor() to be a wrapper calling both functions

Export initializeScoreInteraction from scoreEditor.js

Verify all callers still work with the wrapper
Good. musicEditor.js has its own separate initializeMusicEditor() — it's an alternative editor using UniversalMusicEditor and is not imported by any template. It won't be affected by our changes.

The real callers of the scoreEditor.js version are:

templates/editor.html (line 281/290)
templates/api.html (line 249/260)
Now let me read the full function to make the clean split.

Read scoreEditor.js (lines 876-1295)
Now I have the full picture. Let me make the edit. The split is:

initializeScoreInteraction(): lines 881-884 (enableScoreInteraction), 1117-1235 (noteDropped), 1259-1281 (Delete key), 1283-1290 (noteAddedToScore)

initializeEditorSidebar(): line 880 (renderNoteEditBox), 886-1115 (editorContainer events), 1237-1257 (dropdown population)

Edit scoreEditor.js
Added 28 lines
Update Todos

Identify all callers of initializeMusicEditor()

Split initializeMusicEditor() into initializeScoreInteraction() + initializeEditorSidebar()

Update initializeMusicEditor() to be a wrapper calling both functions

Export initializeScoreInteraction from scoreEditor.js

Verify the refactored code is correct
Let me verify the result looks correct — check the structure around the split and make sure nothing was lost.

Read scoreEditor.js (lines 876-885)
Read scoreEditor.js (lines 1096-1115)
Read scoreEditor.js (lines 1116-1135)
Read scoreEditor.js (lines 1291-1320)
Read scoreEditor.js (lines 1320-1329)
Everything looks clean. Let me verify that editor.html and api.html still import and call initializeMusicEditor() (no changes needed there since the wrapper handles it).

Grep "initializeMusicEditor" (in /workspaces/PianoTour/templates)
15 lines of output
Update Todos

Identify all callers of initializeMusicEditor()

Split initializeMusicEditor() into initializeScoreInteraction() + initializeEditorSidebar()

Update initializeMusicEditor() to be a wrapper calling both functions

Export initializeScoreInteraction from scoreEditor.js

Verify the refactored code is correct
Done. Here's a summary of what changed in scoreEditor.js:

initializeMusicEditor() (line 879-1292) was split into three functions:

initializeScoreInteraction() (line 884, exported) — Score-facing setup that any route can use:

enableScoreInteraction() call with changeMeasure and handleEditorNoteSelectClick callbacks
noteDropped event listener (drag-and-drop handling)
Delete key listener
noteAddedToScore event listener
initializeEditorSidebar() (line 1063, exported) — Sidebar DOM wiring, only for /editor:

renderNoteEditBox(false) initial render
editorContainer click/input/change event delegation
Duration and octave dropdown population
initializeMusicEditor() (line 1316, exported) — Preserved as a convenience wrapper that calls both initializeScoreInteraction() then initializeEditorSidebar()

Both editor.html and api.html still import and call initializeMusicEditor() — no changes needed there. The behavior is identical; this is a pure refactor. You can verify by loading the /editor route and checking the console for the context-menu: log messages showing both functions being called in sequence.

Let's add an early return to any functions that rely on the sidebar in case the sidebar doesn't exist
Let me find which functions in scoreEditor.js reference sidebar DOM elements.

Grep "document\.getElementById\('editor" (in /workspaces/PianoTour/static/js/editor/scoreEditor.js)
39 lines of output
The sidebar references are concentrated in a few functions. Let me see which ones are called from the score interaction path (not just the sidebar).

Grep "^function |^export function " (in /workspaces/PianoTour/static/js/editor/scoreEditor.js)
32 lines of output
The key functions called from the score interaction path that reference sidebar DOM are:

renderNoteEditBox() (line 509) — heavily references sidebar elements, called from handleEditorNoteSelectClick, changeMeasure, and various handlers
updateSlurModeUI() (line 384) — references slur buttons
changeMeasure() (line 765) — calls renderNoteEditBox
Let me read these functions to add guards.

Read scoreEditor.js (lines 385-414)
Read scoreEditor.js (lines 510-729)
Now I can see the issue clearly. renderNoteEditBox() does two things:

Sidebar DOM updates (lines 516-700) — will crash on / route due to null elements at lines 522-523, 525-528
Highlighting (lines 705-718) — works on any route
The cleanest fix is to add an early guard in renderNoteEditBox() that skips the sidebar DOM parts when the container doesn't exist, but still runs the highlighting logic. Let me also check changeMeasure().

Read scoreEditor.js (lines 766-790)
Good — changeMeasure() already has a null guard on line 778-780 for the measure display, and its only sidebar interaction is calling renderNoteEditBox(). updateSlurModeUI() already uses null checks on every element. So the only function that will crash is renderNoteEditBox() — specifically lines 522-523 and 525-528 which call .disabled and .innerHTML on potentially null elements.

The fix: add an early check for editorContainer and skip the sidebar DOM manipulation when it's absent, while still running the highlighting logic at the end.

Edit scoreEditor.js
Added 18 lines
Now let me verify the edit looks correct around the boundaries.

Read scoreEditor.js (lines 510-539)
Read scoreEditor.js (lines 536-550)
Let me also check the transition from renderSidebarNoteEditor to the next function.

Read scoreEditor.js (lines 721-740)
This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.

Analysis:
Let me chronologically analyze the conversation:

1. **Initial Request**: User wants to create a right-click context menu for the editor, asked for a planning document. They want to avoid duplicating existing functions.

2. **Exploration Phase**: I explored the codebase thoroughly using a sub-agent, understanding:
   - Editor sidebar structure in `templates/editor.html`
   - All existing functions in `scoreEditor.js` and `scoreWriter.js`
   - The `enableScoreInteraction()` pattern in `scoreRenderer.js`
   - Existing dropdown menu patterns in `uiHelpers.js`
   - CSS patterns in `editor.css`

3. **Planning Document Created**: Created `/workspaces/PianoTour/context-menu-plan.md` with detailed implementation plan.

4. **Cross-Route Question**: User asked about making context menus work on `/` route too, not just `/editor`. I analyzed that the `/` route (piano.html) has no editor modules loaded at all - it only imports `appState.js` and `listenerManager.js`.

5. **User Suggested Split**: User suggested splitting `initializeMusicEditor()` into 2 functions - one for score interaction, one for sidebar. I agreed and updated the planning document.

6. **Highlighting Explanation**: User asked how highlighting works on `/editor` but not `/`. I traced the call chain: `enableScoreInteraction()` → callbacks → `handleEditorNoteSelectClick()` → `renderNoteEditBox()` → `highlightSelectedMeasure/Note()`. The highlighting functions are in shared `scoreHighlighter.js` but only triggered from the editor path.

7. **Mobile Support Discussion**: User asked about mobile impact. I analyzed that score interaction uses mouse-only events, context menu won't work on mobile without pointer events migration. User asked me to add this to the plan.

8. **Implementation Started**: User asked to start implementing the split. Key instructions:
   - Split `initializeMusicEditor()` into 2 functions
   - Update calls so they call both functions
   - Shouldn't change any behavior
   - Console logs must include "context-menu" phrase

9. **Split Implementation**: I edited `scoreEditor.js`:
   - Created `initializeScoreInteraction()` (exported) - contains `enableScoreInteraction()`, `noteDropped` listener, Delete key listener, `noteAddedToScore` listener
   - Created `initializeEditorSidebar()` (exported) - contains `renderNoteEditBox()` call, all `editorContainer` event delegation, dropdown population
   - Kept `initializeMusicEditor()` as wrapper calling both
   - Callers: `editor.html` and `api.html` still call `initializeMusicEditor()` - no changes needed

10. **Sidebar Guard Request**: User asked to add early returns to functions that rely on the sidebar in case it doesn't exist.

11. **Sidebar Guard Implementation**: I refactored `renderNoteEditBox()`:
    - Extracted sidebar DOM updates into `renderSidebarNoteList()` and `renderSidebarNoteEditor()`
    - Added `hasSidebar` check: `!!document.getElementById('editorContainer')`
    - Only calls sidebar functions when sidebar exists
    - Highlighting logic always runs regardless of sidebar presence
    - `updateSlurModeUI()` already had null guards
    - `changeMeasure()` already had null guard on its one sidebar reference

Let me verify I have all user messages and technical details correct.

Key files modified:
- `/workspaces/PianoTour/context-menu-plan.md` - created and updated multiple times
- `/workspaces/PianoTour/static/js/editor/scoreEditor.js` - split function and sidebar guards

Files examined but not modified:
- `templates/editor.html`
- `templates/piano.html`
- `templates/api.html`
- `templates/index.html`
- `static/js/score/scoreRenderer.js`
- `static/js/score/scoreHighlighter.js`
- `static/js/ui/uiHelpers.js`
- `static/js/ui/listenerManager.js`
- `static/js/editor/musicEditor.js`
- `static/css/editor.css`
- `main.py`
- `editor.md`

No errors were encountered during implementation. The user did redirect me to check `editor.md` for a summary when I was looking at the wrong file initially.

Summary:
1. Primary Request and Intent:
   - Create a right-click context menu for the PianoTour editor that provides access to the same controls in the editor sidebar
   - Create a detailed planning document first, carefully reviewing the codebase to avoid duplicating existing functions
   - Make the context menu work on both the `/` route and `/editor` route
   - Split `initializeMusicEditor()` into two separate functions: one for score interaction (any route) and one for sidebar DOM wiring (editor-only)
   - Add early returns to functions that rely on the sidebar DOM in case it doesn't exist (for routes without sidebar)
   - All console logs related to this feature must include the phrase "context-menu"
   - Implementation should not change existing behavior — pure refactor first, features later

2. Key Technical Concepts:
   - **VexFlow** music notation rendering with `scoreRenderer.js`
   - **Event delegation** pattern on `#editorContainer` for sidebar controls
   - **Custom events** pattern (`noteDropped`, `noteAddedToScore`, planned `scoreContextMenu`) for decoupled communication between modules
   - **`enableScoreInteraction()`** registers mousedown/mousemove/mouseup on score, provides `detectNoteClick()` and `detectMeasureClick()`
   - **`pianoState`** central state object in `appState.js`
   - **Highlighting system** in `scoreHighlighter.js` — shared module that styles VexFlow notes directly, triggered only from editor path
   - **Template inheritance** — `piano.html` and `editor.html` both extend `index.html`, with different blocks/partials
   - **Initialization flow** — `pianoTourBaseReady` custom event gates child script initialization
   - **Mouse-only score interaction** — `scoreRenderer.js` uses `mousedown`/`mousemove`/`mouseup`, not pointer events, so mobile score interaction doesn't work
   - **Pointer events** already used for piano keys in `listenerManager.js` (lines 115-116)

3. Files and Code Sections:

   - **`/workspaces/PianoTour/context-menu-plan.md`** (CREATED and UPDATED)
     - Comprehensive planning document for the context menu feature
     - Contains: sidebar controls inventory, context menu mockups (note context + measure context), excluded controls rationale, implementation steps, function split plan, existing code reuse summary, mobile support section
     - Updated to include: `initializeMusicEditor()` split into `initializeScoreInteraction()` + `initializeEditorSidebar()`, route usage table, mobile support with 5 steps (pointer events migration, long-press timer, CSS touch adjustments, gesture disambiguation, submenu UX), progress notes

   - **`/workspaces/PianoTour/static/js/editor/scoreEditor.js`** (MODIFIED — primary implementation file)
     - **Split `initializeMusicEditor()`** (was lines 879-1292) into three exported functions:
       - `initializeScoreInteraction()` — score-facing setup for any route
       - `initializeEditorSidebar()` — sidebar DOM wiring for `/editor` only  
       - `initializeMusicEditor()` — convenience wrapper calling both
     - **Refactored `renderNoteEditBox()`** to guard sidebar DOM access:
       - Extracted `renderSidebarNoteList(currentMeasure, selectedNote)` — updates treble/bass note list buttons, measure nav
       - Extracted `renderSidebarNoteEditor(currentMeasure, selectedNote)` — updates expanded note editor panel
       - `renderNoteEditBox()` now checks `!!document.getElementById('editorContainer')` before calling sidebar functions
       - Highlighting logic (`highlightSelectedMeasure`, `highlightSelectedNote`, `clearSelectedNoteHighlight`) always runs regardless of sidebar
     
     Key code for the split:
     ```javascript
     export function initializeScoreInteraction() {
         console.log('context-menu: initializeScoreInteraction() called');
         enableScoreInteraction(
             (measureIndex, wasNoteClicked) => changeMeasure(measureIndex, !wasNoteClicked),
             handleEditorNoteSelectClick
         );
         // noteDropped listener, Delete key listener, noteAddedToScore listener
         console.log('context-menu: initializeScoreInteraction() complete');
     }

     export function initializeEditorSidebar() {
         console.log('context-menu: initializeEditorSidebar() called');
         renderNoteEditBox(false);
         const editorContainer = document.getElementById('editorContainer');
         if (!editorContainer) {
             console.error("context-menu: Editor container with ID 'editorContainer' not found. Cannot initialize sidebar.");
             return;
         }
         // click, input, change event delegation on editorContainer
         // duration/octave dropdown population
         console.log('context-menu: initializeEditorSidebar() complete');
     }

     export function initializeMusicEditor() {
         console.log('context-menu: initializeMusicEditor() called — initializing both score interaction and sidebar');
         initializeScoreInteraction();
         initializeEditorSidebar();
     }
     ```

     Key code for the sidebar guard in `renderNoteEditBox`:
     ```javascript
     function renderNoteEditBox(smoothScroll = true) {
         const measures = getMeasures();
         if (editorSelectedMeasureIndex >= measures.length) {
             editorSelectedMeasureIndex = Math.max(0, measures.length - 1);
         }
         const currentMeasure = measures[editorSelectedMeasureIndex] || [];
         const selectedNote = editorSelectedNoteId !== null ? currentMeasure.find(note => note.id === editorSelectedNoteId) : null;

         const hasSidebar = !!document.getElementById('editorContainer');
         if (hasSidebar) {
             renderSidebarNoteList(currentMeasure, selectedNote);
             renderSidebarNoteEditor(currentMeasure, selectedNote);
             updateSlurModeUI(slurMode);
         }

         highlightSelectedMeasure(editorSelectedMeasureIndex);
         if (selectedNote) {
             highlightSelectedNote(editorSelectedMeasureIndex, selectedNote.clef, selectedNote.id);
             pianoState.currentSelectedNote = { measureIndex: editorSelectedMeasureIndex, clef: selectedNote.clef, noteId: selectedNote.id };
         } else {
             clearSelectedNoteHighlight();
             pianoState.currentSelectedNote = null;
             editorSelectedNoteId = null;
         }
         scrollToMeasure(editorSelectedMeasureIndex, smoothScroll);
     }
     ```

   - **`/workspaces/PianoTour/templates/editor.html`** (READ, not modified)
     - Lines 14-242: Full sidebar UI with score controls, note lists, note editor, measure editor, score editor
     - Lines 281/290: Imports and calls `initializeMusicEditor()` — no changes needed since wrapper still works
     
   - **`/workspaces/PianoTour/templates/api.html`** (READ, not modified)
     - Lines 249/260: Also imports and calls `initializeMusicEditor()` — no changes needed

   - **`/workspaces/PianoTour/templates/piano.html`** (READ, not modified)
     - Only imports `appState.js` and `listenerManager.js`, no editor modules — will need `initializeScoreInteraction()` import in future step

   - **`/workspaces/PianoTour/static/js/score/scoreRenderer.js`** (READ, not modified yet)
     - `enableScoreInteraction()` at line 528 — registers mousedown/mousemove/mouseup on score element
     - `detectNoteClick()` and `detectMeasureClick()` — will be used by context menu event
     - Will need `contextmenu` event listener added in future step

   - **`/workspaces/PianoTour/static/js/score/scoreHighlighter.js`** (READ, not modified)
     - Shared module with `highlightSelectedNote()`, `highlightSelectedMeasure()`, `clearSelectedNoteHighlight()`, etc.
     - Operates directly on VexFlow note objects via `setVexFlowNoteStyle()`
     - Route-independent — works anywhere the score is rendered

   - **`/workspaces/PianoTour/editor.md`** (READ)
     - Existing documentation of route differences
     - Feature comparison table at lines 1024-1051 showing `/` has none of the editor features
     - Used as reference for understanding architecture

   - **`/workspaces/PianoTour/static/js/editor/musicEditor.js`** (READ, not modified)
     - Has its own separate `initializeMusicEditor()` at line 374 using `UniversalMusicEditor` class
     - Not imported by any template — won't be affected by our changes

   - **`/workspaces/PianoTour/main.py`** (READ)
     - `/` route renders `piano.html` with no side panel
     - `/editor` route renders `editor.html` with `show_side_panel=True`

4. Errors and Fixes:
   - No code errors were encountered during implementation
   - User redirected me when I was looking at `editor.html` for a summary — they meant `editor.md`. I corrected course and read the right file.

5. Problem Solving:
   - **Identified that `renderNoteEditBox()` would crash on `/` route** — lines 522-523 call `.disabled` on null elements (`editorPrevBtn`, `editorNextBtn`), lines 525-528 call `.innerHTML` on null containers. Solved by extracting sidebar DOM logic into separate functions and gating with `hasSidebar` check.
   - **Identified `updateSlurModeUI()` was already safe** — all its DOM lookups use conditional checks (`if (slurBtn)`, `if (cancelSlurBtn)`, `if (editorExpandedEditor)`)
   - **Identified `changeMeasure()` was already safe** — its one sidebar reference (`editorSelectedMeasureDisplay`) already has a null guard
   - **Confirmed `musicEditor.js` has its own `initializeMusicEditor()`** that's completely separate and not imported by any template

6. All User Messages:
   - "I want to create a right click context menu that will give the user access to the same controls that are currently located in the editor sidebar. Can you create a planning document for implementing that change? You'll want to review the current code base carefully because I want to avoid creating any functions that already exist in other parts of the project."
   - "If we want the right click context menus to work on the / route and not just the /editor route, which features from the editor will we need to add to the / route?"
   - "editor.html has a summary" (redirecting me to look at editor.md)
   - "editor.md i mean" (clarifying the file)
   - "I think it might be better long term practice to split the initializeMusicEditor() into 2 functions. The sidebar and the score are separate objects so it would make sense to have seperate function to enable each one. Does that make sense?"
   - "Update the planning document."
   - "Can you help me understand how the /editor route handles highlighting selected notes/measures while the / route doesn't have that feature?"
   - "Can you give me an overview of how these changes would impact Mobile devices and also an overview of what steps we would need to take to implement the new feature on mobile?"
   - "add that section to our .md plan"
   - "Let's go ahead and start implementing. We'll begin by splitting initializeMusicEditor() into 2 functions and updating any calls to that function so they call both functions. This shouldn't actually change anything when we test it. If you need to add any console logs, you must use the phrase 'context-menu' in the log so we can keep easily identify all console logs related to this new feature."
   - "Let's add an early return to any functions that rely on the sidebar in case the sidebar doesn't exist"

7. Pending Tasks (from context-menu-plan.md implementation order):
   - Step 2: Add context menu CSS styles to `styles.css`
   - Step 3: Add `contextmenu` event listener in `scoreRenderer.js` dispatching `scoreContextMenu` custom event
   - Step 4: Add context menu build/show/hide functions in `scoreEditor.js`
   - Step 5: Add `scoreContextMenu` listener in `initializeScoreInteraction()`
   - Step 6: Update `piano.html` to call `initializeScoreInteraction()`
   - Step 7: Test context menu on both `/` and `/editor` routes

8. Current Work:
   The most recent task was adding early returns/guards to functions that rely on the sidebar DOM. This was completed by refactoring `renderNoteEditBox()` in `scoreEditor.js` to:
   - Check `!!document.getElementById('editorContainer')` for sidebar presence
   - Extract sidebar DOM updates into `renderSidebarNoteList()` and `renderSidebarNoteEditor()` (only called when sidebar exists)
   - Always run highlighting and scroll logic regardless of sidebar
   
   The user's last message was "Let's add an early return to any functions that rely on the sidebar in case the sidebar doesn't exist" and this was completed. The user has not yet confirmed the result or given the next instruction.

9. Optional Next Step:
   Per the implementation order in `context-menu-plan.md`, the next step would be Step 2: "Add context menu CSS styles to `styles.css`" — but the user has not explicitly asked to proceed with this yet. The user should be asked if they'd like to continue with the next implementation step or if they want to test the refactor first.

If you need specific details from before compaction (like exact code snippets, error messages, or content you generated), read the full transcript at: /home/codespace/.claude/projects/-workspaces-PianoTour/89782b8c-14c9-410f-9307-fde5f672b40c.jsonl
Please continue the conversation from where we left it off without asking the user any further questions. Continue with the last task that you were asked to work on.
The last task — adding early returns/guards to functions that rely on the sidebar — was completed in the previous session. Let me verify the current state of the code to confirm everything is in order.

Read scoreEditor.js (lines 2-51)
Grep "function renderNoteEditBox|function renderSidebarNoteList|function renderSidebarNoteEditor|function initializeScoreInteraction|function initializeEditorSidebar|function initializeMusicEditor" (in /workspaces/PianoTour/static/js/editor/scoreEditor.js)
6 lines of output
Let me verify the key parts of the refactored code.

Read scoreEditor.js (lines 510-559)
Read scoreEditor.js (lines 1335-1349)
Everything looks good. Here's a summary of what was completed:

Sidebar guard refactor — complete. The key changes in scoreEditor.js:

renderNoteEditBox() (line 509) — now checks !!document.getElementById('editorContainer') before calling sidebar functions. Highlighting and scrolling always run regardless of sidebar presence.

renderSidebarNoteList() (line 546) — extracted function handling treble/bass note list buttons and measure navigation. Only called when sidebar exists.

renderSidebarNoteEditor() (line 660) — extracted function handling the expanded note editor panel. Only called when sidebar exists.

initializeScoreInteraction() (line 902) — score-facing setup, works on any route.

initializeEditorSidebar() (line 1071) — sidebar DOM wiring, has its own early return if editorContainer is not found.

initializeMusicEditor() (line 1334) — convenience wrapper calling both.

All console logs include "context-menu" as requested. The refactor is purely structural — no behavior changes on existing routes.

Per the implementation plan in context-menu-plan.md, the next step would be Step 2: Add context menu CSS styles. Would you like to continue with that, or test the refactor first?

Yes
Let me review the implementation steps in the plan to see what's next.

Read context-menu-plan.md (lines 2-121)
Read context-menu-plan.md (lines 121-320)
Read context-menu-plan.md (lines 321-470)
Good — Step 1 is done. The next steps are Step 2 (CSS), Step 3 (score event), Step 4 (menu logic), and Step 5 (event wiring). Let me check the existing CSS file first, then implement Steps 2-5.

Update Todos

Split initializeMusicEditor() into two functions

Add sidebar guards to functions

Add context menu CSS styles to editor.css

Add contextmenu event listener in scoreRenderer.js

Add context menu build/show/hide functions in scoreEditor.js

Add scoreContextMenu listener in initializeScoreInteraction()

Update piano.html to call initializeScoreInteraction()
Read editor.css
Now let me check how editor.css is included — is it loaded on all routes or just /editor?

Grep "editor\.css" (in /workspaces/PianoTour/templates)
2 lines of output
The plan says to add CSS to styles.css since the context menu is used on all routes, and editor.css is only loaded on /editor and /api. Let me check what CSS is loaded on the / route.

Grep "\.css" (in /workspaces/PianoTour/templates/index.html)
1 line of output
Good — styles.css is loaded on all routes via index.html. Let me check the end of that file to add the context menu styles.

Bash Check styles.css line count
IN
wc -l /workspaces/PianoTour/static/css/styles.css

OUT
2278 /workspaces/PianoTour/static/css/styles.css
Read styles.css (lines 2261-2280)
Good. Now let me implement Steps 2-5 in parallel where possible. First, the CSS (Step 2), then the scoreRenderer event (Step 3), then the menu logic + event wiring in scoreEditor (Steps 4+5).

Let me start with the CSS and scoreRenderer changes, then do the scoreEditor changes after reading the relevant sections.

Read scoreRenderer.js (lines 526-625)
Read scoreRenderer.js (lines 625-684)
Good, I can see the end of the mouse event listeners at line 654. Now let me also check what detectNoteClick and detectMeasureClick look like to confirm they're accessible from within enableScoreInteraction.

Grep "function detectNoteClick|function detectMeasureClick" (in /workspaces/PianoTour/static/js/score/scoreRenderer.js)
2 lines of output
They're module-level functions, accessible within enableScoreInteraction. Now let me read the relevant handler functions in scoreEditor.js that the context menu items will call.

Grep "function transposeSelectedNote|function handleDuplicateNote|function handleAddTie|function handleAddSlur|function handleRemoveTie|function handleAddMeasureAfter|function handleDuplicateMeasure|function handleDeleteMeasure|function handleMoveMeasureToEnd" (in /workspaces/PianoTour/static/js/editor/scoreEditor.js)
9 lines of output
Now let me also check the Toggle Clef and Toggle Rest logic that's inline in the sidebar event delegation, so I can create proper context menu handlers for those.

Read scoreEditor.js (lines 901-1080)
Now let me check the Toggle Clef and Toggle Rest inline logic from the sidebar event delegation to understand how they work.

Grep "toggleClef|toggleRest|Toggle Clef|Toggle Rest" (in /workspaces/PianoTour/static/js/editor/scoreEditor.js)
1 line of output
Grep "toggle-clef|toggle-rest|isRest" (in /workspaces/PianoTour/static/js/editor/scoreEditor.js)
24 lines of output
Let me check the toggle clef and rest logic more closely.

Read scoreEditor.js (lines 1081-1140)
Now I have everything I need. Let me implement Steps 2-5 together. I'll add:

CSS to styles.css (since it's loaded on all routes)
contextmenu event in scoreRenderer.js
Menu build/show/hide logic + event wiring in scoreEditor.js
Edit styles.css
Added 94 lines
Now add the contextmenu event listener in scoreRenderer.js, right after the mouseup handler (line 654).

Read scoreRenderer.js (lines 653-662)
Update Todos

Split initializeMusicEditor() into two functions

Add sidebar guards to functions

Add context menu CSS styles to styles.css

Add contextmenu event listener in scoreRenderer.js

Add context menu build/show/hide functions in scoreEditor.js

Add scoreContextMenu listener in initializeScoreInteraction()

Update piano.html to call initializeScoreInteraction()
Edit scoreRenderer.js
Added 23 lines
Now let me add the context menu logic to scoreEditor.js. I need to add the build/show/hide functions and wire up the event listener in initializeScoreInteraction(). Let me first check what helper functions exist that I'll reference.

Read scoreEditor.js (lines 81-150)
Good. Now I'll add the context menu functions. I'll place them between the helper functions section and the renderNoteEditBox function, and add the event listener wiring in initializeScoreInteraction().

Read scoreEditor.js (lines 456-510)
I'll insert the context menu functions between transposeSelectedNote() (ends at line 507) and renderNoteEditBox() (starts at line 509).

Edit scoreEditor.js
Added 236 lines
Now I need to wire up the scoreContextMenu event listener and the close-on-click/Escape listeners inside initializeScoreInteraction(). Let me add them before the closing log.

Read scoreEditor.js (lines 1161-1190)
Grep "context-menu: initializeScoreInteraction\(\) complete" (in /workspaces/PianoTour/static/js/editor/scoreEditor.js)
1 line of output
Read scoreEditor.js (lines 1286-1305)
Edit scoreEditor.js
Added 46 lines
Update Todos

Split initializeMusicEditor() into two functions

Add sidebar guards to functions

Add context menu CSS styles to styles.css

Add contextmenu event listener in scoreRenderer.js

Add context menu build/show/hide functions in scoreEditor.js

Add scoreContextMenu listener in initializeScoreInteraction()

Update piano.html to call initializeScoreInteraction()
Now let me update piano.html to import and call initializeScoreInteraction().

Read piano.html
I need to check how the pianoTourBaseReady event pattern is used in other templates to ensure I match the pattern.

Grep "pianoTourBaseReady" (in /workspaces/PianoTour/templates)
4 lines of output
Read editor.html (lines 261-290)
Good — the pattern is to wait for pianoTourBaseReady before importing/calling editor modules. Let me update piano.html.

Edit piano.html
Added 23 lines
Update Todos

Split initializeMusicEditor() into two functions

Add sidebar guards to functions

Add context menu CSS styles to styles.css

Add contextmenu event listener in scoreRenderer.js

Add context menu build/show/hide functions in scoreEditor.js

Add scoreContextMenu listener in initializeScoreInteraction()

Update piano.html to call initializeScoreInteraction()
All implementation steps are complete. Here's a summary of what was done:

Changes Made
styles.css — Added context menu CSS styles (Step 2)

.editor-context-menu — fixed-position menu at z-index 5000 (above floating panels)
.editor-context-menu__header — non-clickable header row
.editor-context-menu__separator — divider lines
.editor-context-menu__item — clickable items with hover state
.editor-context-menu__submenu-wrapper / __submenu — hover-to-expand submenus with left-flip fallback for viewport overflow
Matches existing dark theme (rgba(30, 41, 59, ...))
scoreRenderer.js — Added contextmenu event listener (Step 3)

Fires inside enableScoreInteraction(), after the mouseup handler
Calls detectNoteClick() and detectMeasureClick() to determine what was right-clicked
Dispatches scoreContextMenu custom event (consistent with existing noteDropped/noteAddedToScore pattern)
scoreEditor.js — Added context menu logic (Steps 4 & 5)

buildContextMenu() — dispatches to note or measure menu builder based on click target
buildNoteContextMenu() — Remove, Duplicate, Split, Make Rest/Note, Toggle Clef, Transpose submenu, Ties & Slurs submenu, Insert Before/After
buildMeasureContextMenu() — Add After, Duplicate, Move to End, Delete, Transpose Score submenu
addMenuItem(), addSeparator(), addSubmenu() — DOM builder helpers
showContextMenu() — positions menu with viewport overflow correction
hideContextMenu() — removes menu from DOM
Slur mode handling — if slur mode is active, shows "Cancel Slur" instead of normal menu
Close handlers — click outside and Escape key
All menu items call existing functions — no new business logic was created
piano.html — Added score interaction on / route (Step 6)

Imports and calls initializeScoreInteraction() after pianoTourBaseReady
Enables note/measure clicking, drag-and-drop, Delete key, and context menu on the / route
We have a feature where clicking on the note that is already selected unselects it. But that causes a a problem because Right clicking an already selected note unselects it which makes the buttons on the context menu not work
Let me look at the toggle behavior in handleEditorNoteSelectClick.

Grep "function handleEditorNoteSelectClick" (in /workspaces/PianoTour/static/js/editor/scoreEditor.js)
1 line of output
Read scoreEditor.js (lines 980-1009)
Read scoreEditor.js (lines 1009-1038)
Found it — line 1015 is the toggle: editorSelectedNoteId = (editorSelectedNoteId === noteId) ? null : noteId;

The fix is straightforward: in the scoreContextMenu listener, I should skip the toggle-select call when the note is already selected, since it's already the active note. Let me update the event handler.

Read scoreEditor.js (lines 1311-1335)
Edit scoreEditor.js
Added 2 lines
Fixed. The scoreContextMenu handler now checks if the right-clicked note is already selected (editorSelectedNoteId !== noteTarget.noteId). If it's already selected, it skips the call to handleEditorNoteSelectClick() which would have toggled it off, so the context menu items will work correctly against the selected note.

There is a small gap between the context menu and the sub-menus which can sometimes cause the entire menu to disappear as the mouse goes between them.
Grep "editor-context-menu__submenu" (in /workspaces/PianoTour/static/css/styles.css)
4 lines of output
Read styles.css (lines 2343-2374)
The margin-left: 2px gap is the problem. I'll remove the visual gap and use a transparent padding bridge on the submenu instead so the hover area is continuous.

Edit styles.css
Added 4 lines
You've hit your limit · resets 8pm (UTC)