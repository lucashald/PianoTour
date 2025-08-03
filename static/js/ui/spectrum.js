// spectrum.js
// Keyboard-aligned frequency spectrum visualizer for Piano Tour
// Integrates with Tone.js audio and aligns spectrum display with piano keys

// ===================================================================
// Imports
// ===================================================================

import { pianoState } from "../core/appState.js";
import {
  ALL_NOTE_INFO,
  BLACK_KEY_WIDTH,
  WHITE_KEY_WIDTH,
} from "../core/note-data.js";

// ===================================================================
// Class Definition: KeyboardAlignedSpectrum
// ===================================================================

class KeyboardAlignedSpectrum {
  constructor(containerId, keyboardRange = { min: 36, max: 96 }, options = {}) {
    // Default configuration
    this.config = {
      fftSize: 4096,
      smoothingTimeConstant: 0.8,
      canvasHeight: 120,
      backgroundColor: "#000000",
      colorScheme: "blue fire",
      showGrid: false,
      showLabels: false,
      minDb: -90,
      maxDb: -5,
      enableFrequencyGain: true,
      debugMode: false,
      drawingThreshold: 0.1,
      ...options,
    };

    // Properties
    this.containerId = containerId;
    this.keyRange = keyboardRange;
    this.canvas = null;
    this.ctx = null;
    this.analyser = null;
    this.isAnimating = false;
    this.animationId = null;
    this.connectedNode = null;

    // Filter notes for our range and build lookup tables
    this.rangeNotes = ALL_NOTE_INFO.filter(
      (note) => note.midi >= this.keyRange.min && note.midi <= this.keyRange.max
    );

    // Calculate exact keyboard width from the filtered notes
    this.keyboardWidth = this._calculateKeyboardWidth();

    // Initialize
    this._createCanvas();
    this._setupAudioAnalyser();
  }

  // ===================================================================
  // Private Methods
  // ===================================================================

  /**
   * Calculates the exact width of the keyboard based on key positions
   * @private
   */
  _calculateKeyboardWidth() {
    if (this.rangeNotes.length === 0) return 828; // fallback

    // Find the rightmost key and calculate total width
    const rightmostNote = this.rangeNotes.reduce((max, note) =>
      note.x > max.x ? note : max
    );

    const rightmostKeyWidth = rightmostNote.isBlack
      ? BLACK_KEY_WIDTH
      : WHITE_KEY_WIDTH;
    return rightmostNote.x + rightmostKeyWidth;
  }

  /**
   * Finds the MIDI note at a given pixel position
   * @param {number} x - Pixel position
   * @returns {number|null} MIDI note number or null if not found
   * @private
   */
  _findMIDINoteAtPixel(x) {
    let closestNote = null;
    let closestDistance = Infinity;

    // Find the key whose center is closest to this pixel position
    for (const note of this.rangeNotes) {
      const keyWidth = note.isBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH;
      const keyCenter = note.x + keyWidth / 2;
      const distance = Math.abs(x - keyCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestNote = note;
      }
    }

    return closestNote ? closestNote.midi : null;
  }

  /**
   * Gets the center pixel position for a given MIDI note
   * @param {number} midiNote - MIDI note number
   * @returns {number|null} Center pixel position or null if not found
   * @private
   */
  _getMIDINoteCenter(midiNote) {
    const note = this.rangeNotes.find((n) => n.midi === midiNote);
    if (!note) return null;

    const keyWidth = note.isBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH;
    return note.x + keyWidth / 2;
  }

  /**
   * Creates and sets up the canvas element
   * @private
   */
  _createCanvas() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      throw new Error(`Container with ID '${this.containerId}' not found`);
    }

    // Create canvas element
    this.canvas = document.createElement("canvas");
    this.canvas.id = "spectrum-canvas";
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.background = this.config.backgroundColor;
    this.canvas.style.borderRadius = "8px";

    // Get 2D context
    this.ctx = this.canvas.getContext("2d");

    // Append to container
    container.appendChild(this.canvas);

    // Set up canvas size
    this._setupCanvasSize();

    // Handle resize
    window.addEventListener("resize", () => this._setupCanvasSize());
  }
  /**
   * Sets up canvas dimensions with device pixel ratio handling
   * @private
   */
  _setupCanvasSize() {
    if (!this.canvas) return;

    const container = document.getElementById(this.containerId);
    if (!container) return;

    const devicePixelRatio = window.devicePixelRatio || 1;

    // Get the actual container dimensions
    const containerRect = container.getBoundingClientRect();
    const logicalWidth = containerRect.width;
    const logicalHeight = this.config.canvasHeight;

    // Set display size to fill the container
    this.canvas.style.width = "100%";
    this.canvas.style.height = logicalHeight + "px";

    // Set actual canvas size for high DPI displays
    this.canvas.width = logicalWidth * devicePixelRatio;
    this.canvas.height = logicalHeight * devicePixelRatio;

    // Store logical dimensions for calculations
    this.logicalWidth = logicalWidth;
    this.logicalHeight = logicalHeight;

    // Scale context for device pixel ratio
    if (this.ctx) {
      this.ctx.scale(devicePixelRatio, devicePixelRatio);
    }
  }

  /**
   * Sets up the Tone.js analyser node
   * @private
   */
  _setupAudioAnalyser() {
    try {
      // This is where the analyser is created.
      // It's still responsible for its own analyser instance.
      this.analyser = new Tone.Analyser("fft", this.config.fftSize);
      this.analyser.smoothing = this.config.smoothingTimeConstant;
    } catch (error) {
      console.error("Error creating Tone.js analyser in spectrum.js:", error);
    }
  }

  /**
   * Converts MIDI note number to frequency in Hz
   * @param {number} midiNote - MIDI note number
   * @returns {number} Frequency in Hz
   * @private
   */
  _midiToFrequency(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }

  /**
   * Converts frequency to FFT bin index
   * @param {number} frequency - Frequency in Hz
   * @returns {number} FFT bin index
   * @private
   */
  _frequencyToBin(frequency) {
    // Ensure Tone.context is available before trying to use it
    if (!Tone.context || Tone.context.sampleRate === undefined) {
      console.warn("Tone.context not ready, cannot convert frequency to bin.");
      return 0; // Return a default or handle error appropriately
    }
    const nyquistFreq = Tone.context.sampleRate / 2;
    return Math.round((frequency / nyquistFreq) * this.analyser.size);
  }

  /**
 * Checks if there's significant audio activity in the spectrum
 * @returns {boolean} True if there's meaningful audio being rendered
 */
hasSignificantAudioActivity() {
  if (!this.analyser || !this.isAnimating) {
    return false;
  }

  // Get current FFT data
  const fftSize = this.analyser.size;
  const fftData = new Float32Array(fftSize);
  this.analyser.getValue(fftData);

  // Count how many frequency bins are above the drawing threshold
  let activeBins = 0;
  const threshold = this.config.drawingThreshold || 0.01;
  const minDbThreshold = this.config.minDb || -90;
  const maxDbThreshold = this.config.maxDb || -5;

  for (let i = 0; i < fftSize; i++) {
    const dbValue = fftData[i];
    const normalizedMagnitude = Math.max(
      0,
      (dbValue - minDbThreshold) / (maxDbThreshold - minDbThreshold)
    );
    
    if (normalizedMagnitude > threshold) {
      activeBins++;
    }
  }

  // Consider it "active" if more than a few bins are above threshold
  // You can adjust this threshold based on your needs
  const minimumActiveBins = 5;
  return activeBins > minimumActiveBins;
}

  /**
   * Maps magnitude value to color based on color scheme
   * @param {number} magnitude - Normalized magnitude (0-1)
   * @param {string} colorScheme - Color scheme name
   * @returns {string} CSS color string
   * @private
   */
  _getColorForMagnitude(magnitude, colorScheme) {
    const intensity = Math.max(0, Math.min(1, magnitude));

    switch (colorScheme) {
      case "rainbow":
        // HSL rainbow: red(0) -> yellow(60) -> green(120) -> cyan(180) -> blue(240)
        const hue = 240 + intensity * 120; // Blue to green/yellow range
        return `hsl(${hue}, 100%, ${50 + intensity * 30}%)`;

      /**
       * NEW: This case uses colors inspired by your new palette.
       * It creates a smooth "cool-to-hot" gradient from a medium blue to a warm peach.
       */
      case "palette": {
        // We interpolate between the HSL values of two colors from the palette.
        // Start Color: --color-blue-medium (#295570) -> HSL(207, 45%, 30%)
        // End Color:   --color-peach-light (#D88368) -> HSL(15, 61%, 63%)

        const startHue = 207;
        const endHue = 15;

        // Interpolate each HSL component based on the intensity
        const hue = startHue - (intensity * (startHue - endHue));
        const saturation = 45 + (intensity * 16); // From 45% to 61%
        const lightness = 30 + (intensity * 33);  // From 30% to 63%

        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      }

      case "blue":
        return `hsl(220, 100%, ${20 + intensity * 60}%)`;

      case "green":
        return `hsl(120, 100%, ${20 + intensity * 60}%)`;

      case "fire":
        if (intensity < 0.3) {
          return `hsl(0, 100%, ${20 + intensity * 100}%)`; // Red
        } else if (intensity < 0.7) {
          return `hsl(30, 100%, ${30 + intensity * 50}%)`; // Orange
        } else {
          return `hsl(60, 100%, ${50 + intensity * 40}%)`; // Yellow
        }

        case "blue fire":
        if (intensity < 0.25) {
          return `hsl(207, 23%, ${20 + intensity * 100}%)`; // blue
        } else if (intensity < 0.5) {
          return `hsl(207, 45%, ${30 + intensity * 50}%)`; // bluer
        } else {
          return `hsl(207, 84%, ${50 + intensity * 40}%)`; // bluest
        }

      default:
        return `hsl(220, 80%, ${20 + intensity * 60}%)`;
    }
  }


  /**
   * Draws grid lines on the canvas
   * @private
   */
  _drawGrid() {
    if (!this.config.showGrid || !this.ctx) return;

    const canvasWidth = this.logicalWidth;
    const canvasHeight = this.config.canvasHeight;

    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    this.ctx.lineWidth = 1;

    // Draw vertical lines at octave boundaries (every 12 semitones)
    const noteRange = this.keyRange.max - this.keyRange.min;
    const octaveCount = noteRange / 12;

    for (let i = 0; i <= octaveCount; i++) {
      const octaveMidi = this.keyRange.min + i * 12;
      const centerX = this._getMIDINoteCenter(octaveMidi);

      if (centerX !== null) {
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, 0);
        this.ctx.lineTo(centerX, canvasHeight);
        this.ctx.stroke();
      }
    }

    // Draw horizontal lines for dB levels
    const dbLines = 4;
    for (let i = 0; i <= dbLines; i++) {
      const y = (i / dbLines) * canvasHeight;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(canvasWidth, y);
      this.ctx.stroke();
    }
  }

  /**
   * Draws note labels on the canvas
   * @private
   */
  _drawLabels() {
    if (!this.config.showLabels || !this.ctx) return;

    const canvasHeight = this.config.canvasHeight;

    this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    this.ctx.font = "12px Inter, sans-serif";
    this.ctx.textAlign = "center";

    // Draw octave labels at C notes
    for (const note of this.rangeNotes) {
      if (note.name && note.name.startsWith("C")) {
        const centerX = this._getMIDINoteCenter(note.midi);
        if (centerX !== null) {
          const octave = note.name.slice(1); // Extract octave number from name like "C4"
          this.ctx.fillText(`C${octave}`, centerX, canvasHeight - 5);
        }
      }
    }
  }

  /**
   * Main rendering loop
   * @private
   */
  _render() {
    if (!this.ctx || !this.analyser || !this.isAnimating) return;

    const canvasWidth = this.logicalWidth;
    const canvasHeight = this.config.canvasHeight;

    // Clear canvas
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Get FFT data
    const fftData = this.analyser.getValue();
    const fftSize = fftData.length;

    // Check if we have audio data
    const hasAudio = fftData.some((value) => value > this.config.minDb + 10);
    if (!hasAudio) {
      // Draw grid and labels even without audio
      this._drawGrid();
      this._drawLabels();
      this.animationId = requestAnimationFrame(() => this._render());
      return;
    }

    // Calculate scaling factor between canvas and keyboard
    const keyboardToCanvasScale = canvasWidth / this.keyboardWidth;

    // Render spectrum aligned with actual keyboard layout
    for (let x = 0; x < canvasWidth; x++) {
      // Scale the pixel position back to keyboard coordinates
      const keyboardX = x / keyboardToCanvasScale;

      // Find which MIDI note this scaled pixel corresponds to
      const midiNote = this._findMIDINoteAtPixel(keyboardX);

      if (midiNote !== null) {
        // Convert MIDI note to frequency
        const frequency = this._midiToFrequency(midiNote);

        // Map frequency to FFT bin
        const binIndex = this._frequencyToBin(frequency);

        if (binIndex < fftSize && binIndex >= 0) {
          // Get magnitude in dB and normalize to 0-1
          const dbValue = fftData[binIndex];
          const normalizedMagnitude = Math.max(
            0,
            (dbValue - this.config.minDb) /
              (this.config.maxDb - this.config.minDb)
          );

          // Apply threshold and smoothing to reduce noise
          if (normalizedMagnitude > this.config.drawingThreshold) {
            // Add smoothing to reduce "floor" effect - curve the response
            const smoothedMagnitude = Math.pow(normalizedMagnitude, 1.2);

            // Calculate bar height
            const barHeight = smoothedMagnitude * canvasHeight * 0.99;

            // Get color for this magnitude
            const color = this._getColorForMagnitude(
              smoothedMagnitude,
              this.config.colorScheme
            );

            // Draw vertical bar
            this.ctx.fillStyle = color;
            this.ctx.fillRect(x, canvasHeight - barHeight, 1, barHeight);
          }
        }
      }
    }

    // Draw grid and labels on top
    this._drawGrid();
    this._drawLabels();

    // Continue animation
    this.animationId = requestAnimationFrame(() => this._render());
  }

  // ===================================================================
  // Public Methods
  // ===================================================================

  /**
   * Connects an audio node to the spectrum analyser
   * @param {Tone.ToneAudioNode} audioNode - Tone.js audio node to analyze
   */
  connectAudio(audioNode) {
    if (!audioNode || !this.analyser) {
      console.error("Cannot connect audio: invalid node or analyser not ready");
      return;
    }

    try {
      // Disconnect previous node if exists
      if (this.connectedNode) {
        this.connectedNode.disconnect(this.analyser);
      }

      // Connect new node to analyser (this doesn't affect the audio output)
      audioNode.connect(this.analyser);
      this.connectedNode = audioNode;

      console.log("Spectrum analyser connected to audio node");
    } catch (error) {
      console.error("Error connecting audio to spectrum:", error);
    }
  }

  /**
   * Disconnects audio from the spectrum analyser
   */
  disconnectAudio() {
    if (this.connectedNode && this.analyser) {
      try {
        this.connectedNode.disconnect(this.analyser);
        this.connectedNode = null;
        console.log("Spectrum analyser disconnected from audio");
      } catch (error) {
        console.error("Error disconnecting audio from spectrum:", error);
      }
    }
  }

  /**
   * Starts the visualization animation
   */
  startVisualization() {
    if (this.isAnimating) return;

    this.isAnimating = true;
    this._render();
    console.log("Spectrum visualization started");
  }

  /**
   * Stops the visualization animation
   */
  stopVisualization() {
    this.isAnimating = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    console.log("Spectrum visualization stopped");
  }

  /**
   * Updates configuration options
   * @param {object} newOptions - New configuration options
   */
  updateOptions(newOptions) {
    this.config = { ...this.config, ...newOptions };

    // Update analyser if needed
    if (this.analyser) {
      if (newOptions.smoothingTimeConstant !== undefined) {
        this.analyser.smoothing = newOptions.smoothingTimeConstant;
      }
      // Note: FFT size cannot be changed after creation, would need new analyser
      if (
        newOptions.fftSize !== undefined &&
        newOptions.fftSize !== this.analyser.size
      ) {
        console.warn(
          "FFT size change requires recreating analyser - use destroy() and recreate"
        );
      }
    }

    // Update canvas if dimensions changed
    if (newOptions.canvasHeight !== undefined) {
      this._setupCanvasSize();
    }

    console.log("Spectrum options updated:", newOptions);
  }

  /**
   * Updates sensitivity settings for fine-tuning
   * @param {number} minDb - Minimum dB level
   * @param {number} maxDb - Maximum dB level
   * @param {number} threshold - Drawing threshold (0-1)
   */
  updateSensitivity(minDb, maxDb, threshold) {
    this.config.minDb = minDb || this.config.minDb;
    this.config.maxDb = maxDb || this.config.maxDb;
    this.config.drawingThreshold = threshold || this.config.drawingThreshold;
    console.log(
      `Sensitivity updated: minDb=${this.config.minDb}, maxDb=${this.config.maxDb}, threshold=${this.config.drawingThreshold}`
    );
  }

  /**
   * Enables or disables debug mode for frequency analysis
   * @param {boolean} enabled - Whether to enable debug logging
   */
  setDebugMode(enabled) {
    this.config.debugMode = enabled;
    console.log(`Spectrum debug mode ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Enables or disables frequency gain compensation
   * @param {boolean} enabled - Whether to enable frequency gain
   */
  setFrequencyGain(enabled) {
    this.config.enableFrequencyGain = enabled;
    console.log(
      `Frequency gain compensation ${enabled ? "enabled" : "disabled"}`
    );
  }

  /**
   * Resizes the canvas to fit its container
   */
  resize() {
    this._setupCanvasSize();
  }

  /**
   * Destroys the spectrum visualizer and cleans up resources
   */
  destroy() {
    // Stop animation
    this.stopVisualization();

    // Disconnect audio
    this.disconnectAudio();

    // Remove canvas from DOM
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    // Clean up references
    this.canvas = null;
    this.ctx = null;
    this.analyser = null;
    this.connectedNode = null;

    console.log("Spectrum visualizer destroyed");
  }
}

// ===================================================================
// Integration Functions for playbackHelpers.js
// ===================================================================

// Global spectrum instance
let spectrumVisualizer = null;
let isSpectrumEnabled = false; // This flag is still relevant for enabling/disabling the feature

/**
 * Creates and initializes the spectrum visualizer
 * @param {object} options - Configuration options
 * @returns {object} Spectrum control object
 */
export function createSpectrum(options = {}) {
  try {
    // Create spectrum instance
    const spectrum = new KeyboardAlignedSpectrum(
      "spectrum",
      { min: 36, max: 96 },
      options
    );

    // Return control object
    return {
      instance: spectrum,
      connect: (audioNode) => spectrum.connectAudio(audioNode),
      start: () => spectrum.startVisualization(),
      stop: () => spectrum.stopVisualization(),
      destroy: () => spectrum.destroy(),
    };
  } catch (error) {
    console.error("Error creating spectrum visualizer:", error);
    return null;
  }
}

/**
 * Initializes the spectrum for integration with playbackHelpers
 * @param {object} options - Configuration options
 */
export function initializeSpectrum(options = {}) {
  try {
    if (spectrumVisualizer) {
      console.log("Spectrum already initialized");
      return;
    }

    spectrumVisualizer = createSpectrum(options);
    if (spectrumVisualizer) {
      isSpectrumEnabled = true;
      console.log("Spectrum initialized successfully");

      // ✅ FIXED: Connect to envelope if it exists, fallback to sampler
      // The envelope is what's actually sending audio to the speakers
      if (pianoState.envelope) {
        connectSpectrumToAudio(pianoState.envelope.envelope); // Connect to the Tone.js envelope object
        console.log("Spectrum connected to envelope output");
      } else if (pianoState.sampler) {
        connectSpectrumToAudio(pianoState.sampler);
        console.log("Spectrum connected to sampler (no envelope available)");
      } else {
        console.log("Neither envelope nor sampler available for spectrum auto-connection.");
      }
    }
  } catch (error) {
    console.error("Error initializing spectrum:", error);
    isSpectrumEnabled = false;
  }
}

/**
 * Connects the spectrum to an audio node
 * @param {Tone.ToneAudioNode} audioNode - Audio node to connect
 */
export function connectSpectrumToAudio(audioNode) {
  if (spectrumVisualizer && audioNode) {
    spectrumVisualizer.connect(audioNode);
  }
}

/**
 * Starts spectrum visualization
 */
export function startSpectrumVisualization() {
  if (spectrumVisualizer && isSpectrumEnabled) {
    spectrumVisualizer.start();
  }
}

// Add these variables at the module level in spectrum.js
let spectrumStopTimeout = null;
let pendingStopRequests = 0;

export function stopSpectrumVisualization() {
  if (!spectrumVisualizer) return;

  // Clear any existing timeout
  if (spectrumStopTimeout) {
    clearTimeout(spectrumStopTimeout);
  }

  pendingStopRequests++;
  const currentRequestId = pendingStopRequests;

  console.log(`Spectrum stop requested (#${currentRequestId}), waiting for audio decay...`);

  // Check if spectrum is actually rendering audio data
  const checkForAudioActivity = () => {
    if (currentRequestId !== pendingStopRequests) {
      // A newer stop request has been made
      return;
    }

    if (!spectrumVisualizer.instance.isAnimating) {
      // Animation already stopped
      spectrumStopTimeout = null;
      pendingStopRequests = 0;
      return;
    }

    // Check if there's actual audio activity
    const hasAudioActivity = spectrumVisualizer.instance.hasSignificantAudioActivity();
    
    if (!hasAudioActivity) {
      console.log(`🎵 Audio activity ceased, stopping spectrum visualization (#${currentRequestId})`);
      spectrumVisualizer.stop();
      spectrumStopTimeout = null;
      pendingStopRequests = 0;
    } else {
      // Still has audio activity, check again in 100ms
      spectrumStopTimeout = setTimeout(checkForAudioActivity, 100);
    }
  };

  // Start checking for audio activity with a small delay
  spectrumStopTimeout = setTimeout(checkForAudioActivity, 200);
}

/**
 * Destroys the spectrum visualizer
 */
export function destroySpectrum() {
  if (spectrumVisualizer) {
    spectrumVisualizer.destroy();
    spectrumVisualizer = null;
    isSpectrumEnabled = false;
  }
}

// ===================================================================
// Export default class for direct usage
// ===================================================================

export default KeyboardAlignedSpectrum;