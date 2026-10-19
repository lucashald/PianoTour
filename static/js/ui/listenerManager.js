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
import { setTempo, getMeasures } from "../score/scoreWriter.js";
import { drawAll } from "../score/scoreRenderer.js";
import { loadBool, saveBool } from "../utils/settingsStore.js";

let instrumentDiv;
let isMouseWheelVelocityEnabled = loadBool('mouseWheelVelocity', true);

/**
 * Settings-panel toggles that persist. Each entry reads its current value,
 * applies a new one, and optionally redraws the score after a change.
 */
const SETTING_TOGGLES = [
  {
    id: "toggleVelocityCheckbox",
    key: "mouseWheelVelocity",
    read: () => isMouseWheelVelocityEnabled,
    apply: setMouseWheelVelocityEnabled,
  },
  {
    id: "toggleFixedDurationCheckbox",
    key: "fixedDuration",
    read: () => pianoState.toggleFixedDuration,
    apply: setFixedDuration,
  },
  {
    id: "toggleMeasureNumbersCheckbox",
    key: "showMeasureNumbers",
    read: () => pianoState.showMeasureNumbers,
    apply: (enabled) => { pianoState.showMeasureNumbers = enabled; },
    redraw: true,
  },
];

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

  // Prevent browser scroll/zoom when touching the piano
  pianoState.svg.style.touchAction = "none";

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
  
  // Initialize mouse wheel velocity control if enabled (saved or default)
  if (isMouseWheelVelocityEnabled) {
    document.addEventListener('wheel', handleMouseWheelVelocityControl, { passive: false });
  }

  // Wire up the persisted settings toggles
  setupSettingToggles();

  // Show the saved instrument in the settings dropdown before audio loads
  const instrumentSelect = document.getElementById("instrumentSelect");
  if (instrumentSelect) {
    instrumentSelect.value = pianoState.instrument;
  }

  // Wire up the drag-to-strum toggle (guitar page only)
  document
    .getElementById("toggleDragStrumCheckbox")
    ?.addEventListener("change", handleDragStrumToggle);
  
  // Wire up the quantize dropdown
  document
    .getElementById("quantize-select")
    ?.addEventListener("change", handleQuantizeChange);
  
  // Wire up the quantize button
  document
    .getElementById("quantize-btn")
    ?.addEventListener("click", handleQuantizeChange);
  
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
 * Syncs each settings checkbox to its saved value and applies it, then saves
 * and applies on change.
 */
function setupSettingToggles() {
  SETTING_TOGGLES.forEach((toggle) => {
    const checkbox = document.getElementById(toggle.id);
    if (!checkbox) return;

    checkbox.checked = toggle.read();
    toggle.apply(checkbox.checked);

    checkbox.addEventListener("change", (event) => {
      const enabled = event.target.checked;
      saveBool(toggle.key, enabled);
      toggle.apply(enabled);
      if (toggle.redraw) {
        drawAll(getMeasures(), true);
      }
    });
  });
}

/**
 * Turns the mouse wheel velocity control on/off
 */
function setMouseWheelVelocityEnabled(enabled) {
  const wasEnabled = isMouseWheelVelocityEnabled;
  isMouseWheelVelocityEnabled = enabled;

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
 * Switches between fixed duration mode and held-time-based duration
 */
function setFixedDuration(useFixedDuration) {
  pianoState.toggleFixedDuration = useFixedDuration;
  console.log(`Fixed duration mode: ${useFixedDuration ? 'ON (using quantize)' : 'OFF (using held time)'}`);
  
  // Show/hide quantize button based on fixed duration mode
  const quantizeBtn = document.getElementById('quantize-btn');
  if (quantizeBtn) {
    if (useFixedDuration) {
      quantizeBtn.classList.remove('hidden');
    } else {
      quantizeBtn.classList.add('hidden');
    }
  }
}

/**
 * Toggles drag-to-strum on the guitar. The instance owns the state and its
 * persistence, so this just forwards the checkbox.
 */
function handleDragStrumToggle(event) {
  window.guitarInstance?.setDragStrumEnabled(event.target.checked);
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
    'w': 'note-whole-up-cropped.svg',
    'w.': 'note-whole-up-dotted-cropped.svg',
    'h': 'note-half-up-cropped.svg',
    'h.': 'note-half-up-dotted-cropped.svg',
    'q': 'note-quarter-up-cropped.svg',
    'q.': 'note-quarter-up-dotted-cropped.svg',
    '8': 'note-eighth-up-cropped.svg',
    '8.': 'note-eighth-up-dotted-cropped.svg',
    '16': 'note-16th-up-cropped.svg',
    '16.': 'note-16th-up-dotted-cropped.svg',
    '32': 'note-32nd-up-cropped.svg',
    '32.': 'note-32nd-up-dotted-cropped.svg'
  };
  
  const btn = document.getElementById('quantize-btn');
  if (btn) {
    const imgName = imageMap[quantize];
    if (imgName) {
      btn.innerHTML = `<img src="/static/images/generatedsvg/${imgName}" alt="${quantize}" class="quantize-icon">`;
    } else {
      // Fallback for unknown durations
      btn.textContent = quantize;
    }
  }
}