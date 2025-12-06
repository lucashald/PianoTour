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
  startRest,
  endRest,
} from "../instrument/keyboardHelpers.js";

import { handleInitialGuitar } from "../instrument/guitarInstrument.js";

import { initializeGuitarControls, createChordPalette } from "./guitarUI.js";

import { toggleIsMinorKey, show_side_panel, generateChordPreviewButtons, getCurrentChordClef } from "../ui/uiHelpers.js";
import { setTempo } from "../score/scoreWriter.js";
import { setupPaletteInteractions } from "../ui/paletteHelpers.js";

let instrumentDiv;
let isMouseWheelVelocityEnabled = true;

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
      console.log('Audio is loading.');
      break;
    case 'error':
      console.error('Audio failed to load.');
      break;
    case 'ready':
      console.log('Audio is ready.');
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
  if (window.keyboardDisabled) {
    return; // Skip if keyboard is disabled
}
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
  // Use click so we can cycle through 3 states (off / note names / keyboard letters)
  document
    .getElementById("toggleLabelsCheckbox")
    ?.addEventListener("click", handleToggleLabelsChange);
  document
    .getElementById("mode-cycle-btn")
    ?.addEventListener("click", handleModeCycleClick);
  document
    .getElementById("is-minor-key-btn")
    ?.addEventListener("click", toggleIsMinorKey);
  document
    .getElementById("show-side-panel-btn")
    ?.addEventListener("click", show_side_panel);
  window.addEventListener("resize", handleWindowResize);
    document
    .getElementById("tempo-input")
    ?.addEventListener("change", handleTempoChange);
  
  // Wire up the mouse wheel velocity toggle
  document
    .getElementById("toggleVelocityCheckbox")
    ?.addEventListener("change", handleMouseWheelVelocityToggle);
  
  // Initialize mouse wheel velocity control if enabled by default
  if (isMouseWheelVelocityEnabled) {
    document.addEventListener('wheel', handleMouseWheelVelocityControl, { passive: false });
  }
  
  // Wire up the palette drag mode toggle
  document
    .getElementById("togglePaletteDragModeCheckbox")
    ?.addEventListener("change", handlePaletteDragModeToggle);
  
  // Wire up the fixed duration toggle
  document
    .getElementById("toggleFixedDurationCheckbox")
    ?.addEventListener("change", handleFixedDurationToggle);
  
  // Wire up the quantize dropdown
  document
    .getElementById("quantize-select")
    ?.addEventListener("change", handleQuantizeChange);
  
  // Rest button listeners
  const bassRestBtn = document.getElementById("bass-rest-btn");
  const trebleRestBtn = document.getElementById("treble-rest-btn");
  
  if (bassRestBtn) {
    bassRestBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      bassRestBtn.classList.add("pressed");
      startRest("bass");
    });
    bassRestBtn.addEventListener("pointerup", () => {
      bassRestBtn.classList.remove("pressed");
      endRest("bass");
    });
    bassRestBtn.addEventListener("pointerleave", () => {
      if (bassRestBtn.classList.contains("pressed")) {
        bassRestBtn.classList.remove("pressed");
        endRest("bass");
      }
    });
  }
  
  if (trebleRestBtn) {
    trebleRestBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      trebleRestBtn.classList.add("pressed");
      startRest("treble");
    });
    trebleRestBtn.addEventListener("pointerup", () => {
      trebleRestBtn.classList.remove("pressed");
      endRest("treble");
    });
    trebleRestBtn.addEventListener("pointerleave", () => {
      if (trebleRestBtn.classList.contains("pressed")) {
        trebleRestBtn.classList.remove("pressed");
        endRest("treble");
      }
    });
  }
  
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

function handleTempoChange(event) {
    const newTempo = parseInt(event.target.value, 10);
    if (!isNaN(newTempo) && newTempo >= 60 && newTempo <= 300) {
        setTempo(newTempo);
    }
}

/**
 * Handles the mouse wheel velocity slider control
 * Allows adjusting velocity with the mouse wheel when enabled
 */
function handleMouseWheelVelocityControl(event) {
  if (!isMouseWheelVelocityEnabled) {
    return;
  }

  // Only activate with Alt held down
  if (!event.altKey) {
    return;
  }

  console.log('Alt+wheel detected, adjusting velocity');
  event.preventDefault();

  const velocitySliderEl = document.getElementById('velocitySlider');
  if (!velocitySliderEl) {
    console.error('velocitySlider element not found');
    return;
  }

  // Cast to HTMLInputElement for type safety
  const slider = velocitySliderEl;

  // Get current velocity and calculate new value
  const sliderInput = slider;
  let currentVelocity = parseInt(sliderInput.value);
  const wheelDelta = event.deltaY > 0 ? -1 : 1; // Negative deltaY = scroll up = increase
  const step = 5; // Increment by 5
  const newVelocity = Math.max(
    parseInt(sliderInput.min),
    Math.min(
      parseInt(sliderInput.max),
      currentVelocity + (wheelDelta * step)
    )
  );

  // Update the slider value
  sliderInput.value = String(newVelocity);

  // Update the display value if it exists
  const velocityValue = document.getElementById('velocityValue');
  if (velocityValue) {
    velocityValue.textContent = String(newVelocity);
  }

  // Update pianoState velocity
  pianoState.velocity = newVelocity;

  console.log(`Velocity adjusted to ${newVelocity} via mouse wheel`);
}

/**
 * Toggles the mouse wheel velocity control on/off
 */
function handleMouseWheelVelocityToggle(event) {
  const wasEnabled = isMouseWheelVelocityEnabled;
  isMouseWheelVelocityEnabled = (event.target).checked;

  // Only update listeners if state actually changed
  if (isMouseWheelVelocityEnabled && !wasEnabled) {
    // Turning on - add the listener
    document.addEventListener('wheel', handleMouseWheelVelocityControl, { passive: false });
    console.log('Mouse wheel velocity control enabled');
  } else if (!isMouseWheelVelocityEnabled && wasEnabled) {
    // Turning off - remove the listener
    document.removeEventListener('wheel', handleMouseWheelVelocityControl);
    console.log('Mouse wheel velocity control disabled');
  }
}

/**
 * Toggles between drag mode and click mode for palette items
 */
function handlePaletteDragModeToggle(event) {
  const useDragMode = event.target.checked;
  pianoState.togglePaletteDragMode = useDragMode;
  setupPaletteInteractions(useDragMode);
  console.log(`Palette mode changed to: ${useDragMode ? 'Drag' : 'Click'}`);
}

/**
 * Toggles between fixed duration mode and held-time-based duration
 */
function handleFixedDurationToggle(event) {
  const useFixedDuration = event.target.checked;
  pianoState.toggleFixedDuration = useFixedDuration;
  console.log(`Fixed duration mode: ${useFixedDuration ? 'ON (using quantize)' : 'OFF (using held time)'}`);
}

/**
 * Handles quantize (note duration) change from dropdown or button
 */
export function handleQuantizeChange(event) {
  // Handle both dropdown change and button click events
  let quantize;
  
  if (event.target.id === 'quantize-select') {
    // From dropdown
    quantize = event.target.value;
  } else if (event.target.id === 'quantize-btn' || event.target.closest('#quantize-btn')) {
    // From button click - cycle to next value
    const options = ['16', '8', 'q', 'h', 'w'];
    const currentIndex = options.indexOf(pianoState.quantize);
    const nextIndex = (currentIndex + 1) % options.length;
    quantize = options[nextIndex];
    event.preventDefault();
  } else {
    // Fallback: assume it's from dropdown
    quantize = event.target.value;
  }
  
  pianoState.quantize = quantize;
  console.log(`Quantize changed to: ${quantize}`);
  
  // Update the button UI to reflect the new quantize value
  updateQuantizeButtonUI(quantize);
  
  // Update the dropdown to reflect the new quantize value
  const dropdown = document.getElementById('quantize-select');
  if (dropdown && dropdown.value !== quantize) {
    dropdown.value = quantize;
  }
  
  // Regenerate chord preview buttons to update their durations
  const currentClef = getCurrentChordClef();
  generateChordPreviewButtons(currentClef);
}

/**
 * Updates the quantize button UI to show the current quantize value
 */
function updateQuantizeButtonUI(quantize) {
  const imageMap = {
    'w': 'whole.png',
    'h': 'half-up.png',
    'q': 'quarter-up.png',
    '8': '8th-up.png',
    '16': '16th-up.png'
  };
  
  const btn = document.getElementById('quantize-btn');
  if (btn) {
    const imgName = imageMap[quantize];
    if (imgName) {
      btn.innerHTML = `<img src="/static/images/${imgName}" alt="${quantize}" class="quantize-icon">`;
    } else {
      // Fallback for 32 or others
      const labels = { '32': '1/32' };
      btn.textContent = labels[quantize] || quantize;
    }
  }
}