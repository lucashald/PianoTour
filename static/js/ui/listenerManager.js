// listenerManager.js
import { pianoState } from "../core/appState.js";
import {
  handleInitial,
  handleKeyPointerDown,
  handleModeCycleClick,
  handlePointerMove,
  handleToggleLabelsChange,
  handleWindowResize,
  startSliderDrag,
  stopAllDragChords,
  stopAllDragNotes
} from "../instrument/instrumentHelpers.js";

import {
  handleInitialKeyboard,
  handleKeyDown,
  handleKeyUp,
} from "../instrument/keyboardHelpers.js";

import { toggleIsMinorKey } from "../ui/uiHelpers.js";

// Module-level variable to store instrumentDiv reference
let instrumentDiv;

/**
 * Sets the instrumentDiv reference that's needed by several listener functions
 * @param {HTMLElement} div - The instrument container div
 */
export function setInstrumentDiv(div) {
  instrumentDiv = div;
}


/**
 * Adds basic keyboard listeners for initial audio unlock
 */
export function addBasicKeyboardListeners() {
  document.addEventListener("keydown", handleInitialKeyboard, { once: true });
}

/**
 * Adds advanced keyboard listeners for full functionality
 */
export function addAdvancedKeyboardListeners() {
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);
  document.removeEventListener("keydown", handleInitialKeyboard);
if (pianoState.overlay) {
  pianoState.overlay.addEventListener("pointerdown", startSliderDrag);
  pianoState.overlay.classList.remove("hidden"); // Add this line
}
}

/**
 * Adds basic instrument listeners for initial audio unlock
 */
export function addBasicInstrumentListeners() {
  if (!instrumentDiv) {
    console.error("instrumentDiv not set. Call setInstrumentDiv() first.");
    return;
  }

  // Get all piano key elements only
  const pianoKeys = instrumentDiv.querySelectorAll('rect[data-midi]');
  
  pianoKeys.forEach(key => {
    key.addEventListener("pointerdown", handleInitial, { 
      once: true, 
      passive: false 
    });
    key.addEventListener("click", handleInitial, { 
      once: true 
    });
  });
}

/**
 * Adds advanced instrument listeners for full functionality
 */
export function addAdvancedInstrumentListeners() {
  if (!instrumentDiv) {
    console.error("instrumentDiv not set. Call setInstrumentDiv() first.");
    return;
  }

  pianoState.svg.addEventListener("pointerdown", handleKeyPointerDown);
  pianoState.svg.addEventListener("pointermove", handlePointerMove);
  pianoState.svg.addEventListener("selectstart", (e) => e.preventDefault());
  pianoState.svg.addEventListener("contextmenu", (e) => e.preventDefault());

  // Remove the initial one-time listeners from piano keys only
  const pianoKeys = instrumentDiv.querySelectorAll('rect[data-midi]');
  
  pianoKeys.forEach(key => {
    key.removeEventListener("click", handleInitial);
    key.removeEventListener("pointerdown", handleInitial);
    key.removeEventListener("touchstart", handleInitial);
  });
}

/**
 * Adds button and window listeners
 */
export function addButtonListeners() {
  document
    .getElementById("toggleLabelsCheckbox")
    ?.addEventListener("change", handleToggleLabelsChange);
  document
    .getElementById("mode-cycle-btn")
    ?.addEventListener("click", handleModeCycleClick);
    document
    .getElementById("is-minor-key-btn")
    ?.addEventListener("click", toggleIsMinorKey);
  window.addEventListener("resize", handleWindowResize);

  console.log("Piano instrument UI initialized.");
}

/**
 * Adds dragging-related listeners for pointer interactions
 */
export function addInstrumentDraggingListeners() {
  // Global pointer up to ensure drag state is cleared
  document.addEventListener("pointerup", () => {
    if (pianoState.isDragging) {
      pianoState.isDragging = false;
      stopAllDragNotes();
      stopAllDragChords();
    }
  });

  // Handle pointer leaving the piano area
  pianoState.svg.addEventListener("pointerleave", () => {
    if (pianoState.isDragging) {
      pianoState.isDragging = false;
      stopAllDragNotes();
      stopAllDragChords();
    }
  });
}