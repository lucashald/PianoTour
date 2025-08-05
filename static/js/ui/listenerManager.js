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

import { handleInitialGuitar } from "../instrument/guitarInstrument.js";

import { initializeGuitarControls, createChordPalette } from "./guitarUI.js";

import { toggleIsMinorKey } from "../ui/uiHelpers.js";

let instrumentDiv;

export function setInstrumentDiv(div) {
  instrumentDiv = div;
}

export function addAudioStatusListeners() {
  window.addEventListener('audioStatusChange', handleAudioStatusChange);
}

function handleAudioStatusChange(e) {
  const status = e.detail.status;
    switch (status) {
    case 'loading':
      console.log('zz Audio is loading.');
      break;
    case 'error':
      console.error('zz Audio failed to load.');
      break;
    case 'ready':
      console.log('zz Audio is ready.');
    addAdvancedKeyboardListeners();
    addAdvancedInstrumentListeners();
    addInstrumentDraggingListeners();
      break;
  }
}

/**
 * Keyboard Section
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
  pianoState.overlay.classList.remove("hidden");
}
}

/**
 * Piano Keys Section
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

// Guitar Section

// Updated advanced listeners function
export function addAdvancedGuitarListeners() {
  console.log('🎸 Adding advanced guitar listeners...');
  
  if (window.guitarInstance) {
    // Remove basic listeners first
    const stringButtons = window.guitarInstance.stringLabelsContainer.querySelectorAll('.string-button');
    stringButtons.forEach(button => {
      button.removeEventListener('click', handleInitialGuitar);
    });
    
    if (window.guitarInstance.strumArea) {
      window.guitarInstance.strumArea.removeEventListener('click', handleInitialGuitar);
    }
    
    // Add advanced listeners
    window.guitarInstance.setupAudioEventListeners();
    initializeGuitarControls('#guitar-controls');
    createChordPalette();
  }
}

/**
 * Adds button listeners
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
  addAudioStatusListeners();
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