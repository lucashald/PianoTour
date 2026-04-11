// ioHelpers.js - File loading and UI interaction only

import { pianoState } from "../core/appState.js";
import { sanitizeTitle } from "./sanitize.js";
import { scoreManager } from "../score/scoreManager.js";
import { drawAll, setKeySignature } from "../score/scoreRenderer.js";
import {
  getMeasures,
  processAndSyncScore,
  setTempo,
  setTimeSignature,
} from "../score/scoreWriter.js";
import { updateUI } from "../ui/uiHelpers.js";

// Progress tracking UI elements
let progressModal = null;
let progressBar = null;
let progressText = null;
let progressDetails = null;
let activeMidiAbortController = null;

// Two-stage MIDI: store raw extracted data for re-quantization
let cachedRawMidiData = null;

/** Get the cached raw MIDI data (for re-quantization or track switching). */
export function getCachedRawMidiData() {
  return cachedRawMidiData;
}

// Initialize file handlers with progress UI
export function initializeFileHandlers() {
  const fileInput = document.getElementById("load-file");
  const loadButton = document.getElementById("load-score-btn");
  const saveButton = document.getElementById("save-score-btn");
  const exportMidiButton = document.getElementById("export-midi-btn");
  const saveLocalButton = document.getElementById("save-local-btn");

  // Create progress modal for file processing
  createProgressModal();

  // Set up scoreManager event listeners
  setupScoreManagerListeners();

  // Load button opens file dialog
  loadButton?.addEventListener("click", () => {
    fileInput?.click();
  });

  // File input handles file selection
  fileInput?.addEventListener("change", async () => {
    const [file] = fileInput.files;

    if (file) {
      await handleFile(file);
    }
  });

  // Save button
  saveButton?.addEventListener("click", () => {
    saveScoreToFile();
  });

  // Export MIDI button
  exportMidiButton?.addEventListener("click", () => {
    exportMidi();
  });

  // Save to localStorage button
  saveLocalButton?.addEventListener("click", () => {
    saveToLocalStorage();
  });
}

// Create progress modal for file processing feedback
function createProgressModal() {
  // Only create if it doesn't already exist
  if (document.getElementById("file-progress-modal")) return;

  const modal = document.createElement("div");
  modal.id = "file-progress-modal";
  modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

  const content = document.createElement("div");
  content.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 32px;
        min-width: 400px;
        max-width: 500px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        text-align: center;
    `;

  content.innerHTML = `
        <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px 0; color: #333; font-size: 18px;">Processing Score</h3>
            <p id="progress-text" style="margin: 0; color: #666; font-size: 14px;">Preparing to load...</p>
        </div>
        
        <div style="margin-bottom: 20px;">
            <div style="width: 100%; height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden;">
                <div id="progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); transition: width 0.3s ease;"></div>
            </div>
            <div id="progress-details" style="margin-top: 8px; font-size: 12px; color: #888;"></div>
        </div>

        <div id="validation-summary" style="margin-bottom: 16px; font-size: 12px; color: #ff9800; display: none;">
            <strong>Issues Found:</strong>
            <div id="validation-details" style="margin-top: 4px; text-align: left; max-height: 100px; overflow-y: auto;"></div>
        </div>

        <button id="cancel-loading" style="
            background: #f44336;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            display: none;
        ">Cancel</button>
    `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  // Store references
  progressModal = modal;
  progressBar = document.getElementById("progress-bar");
  progressText = document.getElementById("progress-text");
  progressDetails = document.getElementById("progress-details");
}

// Show progress modal (optionally with a cancel button for long operations)
function showProgressModal({ showCancel = false } = {}) {
  if (progressModal) {
    progressModal.style.display = "flex";
    updateProgress(0, 1, "Starting...");
    hideValidationSummary();

    const cancelBtn = document.getElementById("cancel-loading");
    if (cancelBtn) {
      cancelBtn.style.display = showCancel ? "inline-block" : "none";
    }
  }
}

// Hide progress modal
function hideProgressModal() {
  if (progressModal) {
    progressModal.style.display = "none";
    resetProgress();

    const cancelBtn = document.getElementById("cancel-loading");
    if (cancelBtn) cancelBtn.style.display = "none";
  }
}

// Update progress display
function updateProgress(current, total, message, details = "") {
  if (!progressBar || !progressText || !progressDetails) return;

  const percentage = Math.round((current / total) * 100);
  progressBar.style.width = `${percentage}%`;
  progressText.textContent = message;
  progressDetails.textContent = details
    ? `${details} (${current}/${total})`
    : `${current}/${total}`;
}

// Show validation issues in the modal
function showValidationIssues(issues) {
  const validationSummary = document.getElementById("validation-summary");
  const validationDetails = document.getElementById("validation-details");

  if (validationSummary && validationDetails && issues.length > 0) {
    validationDetails.innerHTML = issues
      .slice(0, 10)
      .map((issue) => `<div style="margin-bottom: 2px;">• ${issue}</div>`)
      .join("");

    if (issues.length > 10) {
      validationDetails.innerHTML += `<div style="margin-top: 4px; font-style: italic;">... and ${issues.length - 10} more issues</div>`;
    }

    validationSummary.style.display = "block";
  }
}

// Hide validation summary
function hideValidationSummary() {
  const validationSummary = document.getElementById("validation-summary");
  if (validationSummary) {
    validationSummary.style.display = "none";
  }
}

// Reset progress display
function resetProgress() {
  if (progressBar) progressBar.style.width = "0%";
  if (progressText) progressText.textContent = "Preparing to load...";
  if (progressDetails) progressDetails.textContent = "";
  hideValidationSummary();
}

// Set up scoreManager event listeners
function setupScoreManagerListeners() {
  // Listen for score processing events
  scoreManager.addEventListener("scoreProgress", (data) => {
    const details = data.message.includes("measures")
      ? `Processing measure ${data.current} of ${data.total}`
      : "";
    updateProgress(data.current, data.total, data.message, details);
  });

  scoreManager.addEventListener("scoreProcessed", (score) => {
    if (score.validationErrors && score.validationErrors.length > 0) {
      console.warn("Validation warnings:", score.validationErrors);
      showValidationIssues(score.validationErrors);
    }
  });

  scoreManager.addEventListener("scoreError", (errorData) => {
    console.error("Score processing error:", errorData.error);
    hideProgressModal();
  });
}

// File handler - determines file type and routes to appropriate loader
export async function handleFile(file) {
  const fileExtension = file.name.split(".").pop().toLowerCase();

  try {
    if (fileExtension === "json") {
      await loadJsonFile(file);
    } else if (fileExtension === "mid" || fileExtension === "midi") {
      await loadMidiFile(file);
    } else {
      alert(
        `Unsupported file type: .${fileExtension}\nPlease select a .json or .mid file.`,
      );
    }
  } catch (error) {
    console.error("Error loading file:", error);
    hideProgressModal();

    // Show user-friendly error messages
    let errorMessage = "Failed to load file";
    if (error.message.includes("Unexpected token")) {
      errorMessage = "Invalid JSON file format";
    } else if (error.message.includes("measures")) {
      errorMessage = "Invalid score structure - missing or invalid measures";
    } else if (error.message.includes("Web Workers")) {
      errorMessage = "Your browser doesn't support large file processing";
    }

    alert(`${errorMessage}: ${error.message}`);
  }
}

// Load JSON file using scoreManager
async function loadJsonFile(file) {
  try {
    const text = await file.text();

    showProgressModal();

    // Use scoreManager to process and validate the score
    const processedScore = await scoreManager.processScore(text, {
      fileName: file.name,
      skipBeatValidation: true,
      onProgress: (current, total, message) => {
        updateProgress(current, total, message);
      },
    });

    // Apply the processed score to the application state
    await applyProcessedScore(processedScore);

    // Keep modal open briefly if there were validation issues
    if (
      processedScore.validationErrors &&
      processedScore.validationErrors.length > 0
    ) {
      setTimeout(hideProgressModal, 3000); // Show issues for 3 seconds
    } else {
      hideProgressModal();
    }
  } catch (error) {
    // Handle JSON parsing errors specifically
    if (error instanceof SyntaxError) {
      throw new Error(
        `Unexpected token ${error.message.split(" ").slice(-1)[0]}`,
      );
    }
    throw error;
  }
}

async function applyProcessedScore(processedScore) {
  try {
    // CRITICAL: Set time signature and tempo BEFORE processing measures
    const timeSignature = processedScore.metadata.timeSignature;
    const tempo = processedScore.metadata.tempo;

    if (!setTimeSignature(timeSignature.numerator, timeSignature.denominator)) {
      console.warn("Failed to set time signature, using default 4/4");
      setTimeSignature(4, 4);
    }

    if (!setTempo(tempo)) {
      console.warn("Failed to set tempo, using default 120 BPM"); // Fixed this line
      setTempo(120);
    }

    // Set title before processing so it's included in the localStorage save
    pianoState.title = sanitizeTitle(processedScore.name.replace(/\.json$/i, ''));

    // Apply measures to scoreWriter (now with correct time signature set)
    if (processAndSyncScore(processedScore.measures)) {
      // Apply key signature
      const keySignature = processedScore.metadata.keySignature;

      if (setKeySignature(keySignature)) {
        // Update piano state with loaded metadata
        pianoState.tempo = processedScore.metadata.tempo;
        pianoState.instrument = processedScore.metadata.instrument;
        pianoState.midiChannel = processedScore.metadata.midiChannel;
        pianoState.isMinorChordMode = processedScore.metadata.isMinorChordMode;

        // Show appropriate success message
        const issueCount = processedScore.validationErrors?.length || 0;
        const message =
          issueCount > 0
            ? `Score loaded with ${issueCount} corrections (${processedScore.measures.length} measures, ${timeSignature.numerator}/${timeSignature.denominator})`
            : `Score loaded successfully (${processedScore.measures.length} measures, ${timeSignature.numerator}/${timeSignature.denominator})`;

        updateUI(message, {
          updateKeySignature: true,
          regenerateChords: true,
        });
      } else {
        setKeySignature("C");
        updateUI(
          `Score loaded with invalid key signature, defaulted to C major`,
          {
            updateKeySignature: true,
            regenerateChords: true,
          },
        );
      }

      // Re-render the score
      updateProgress(1, 1, "Rendering score...");
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          try {
            drawAll(getMeasures());
            resolve();
          } catch (renderError) {
            console.error("Rendering error:", renderError);
            alert(
              "Score rendering failed. The file may contain complex data that couldn't be displayed properly.",
            );
            resolve();
          }
        });
      });
    } else {
      throw new Error(
        "Could not apply the processed score data to scoreWriter",
      );
    }
  } catch (error) {
    console.error("Error applying processed score:", error);
    throw error;
  }
}

// Load MIDI file with two-stage pipeline: extract raw data → pick tracks → quantize
async function loadMidiFile(file) {
  const formData = new FormData();
  formData.append("midiFile", file);

  // Create an AbortController so the user can cancel the request
  const abortController = new AbortController();
  activeMidiAbortController = abortController;

  showProgressModal({ showCancel: true });
  updateProgress(0, 1, "Extracting MIDI data...", "Reading tracks & notes");

  // Wire up cancel button
  const cancelBtn = document.getElementById("cancel-loading");
  const onCancel = () => {
    abortController.abort();
    updateProgress(0, 1, "Cancelling...", "");
  };
  cancelBtn?.addEventListener("click", onCancel, { once: true });

  try {
    // ─── Stage 1: Extract raw notes per-track (fast, no quantization) ───
    const extractResponse = await fetch("/extract-midi", {
      method: "POST",
      body: formData,
      signal: abortController.signal,
    });

    if (!extractResponse.ok) {
      const errorData = await extractResponse.json().catch(() => ({}));
      throw new Error(
        errorData.error ||
          `Server error (${extractResponse.status}). Please try again.`,
      );
    }

    const rawData = await extractResponse.json();
    cachedRawMidiData = rawData;

    updateProgress(
      0.15,
      1,
      "MIDI data extracted",
      `${rawData.tracks.length} track(s) found`,
    );

    // Filter to non-drum tracks with notes
    const playableTracks = rawData.tracks.filter(
      (t) => !t.isDrum && t.noteCount > 0,
    );

    if (playableTracks.length === 0) {
      throw new Error("No playable (non-drum) tracks found in the MIDI file.");
    }

    // ─── Track Selection ───
    let selectedTrackIndices = null; // null means "all non-drum tracks"

    if (playableTracks.length > 1) {
      // Show track picker and let user choose
      hideProgressModal();
      selectedTrackIndices = await showTrackPicker(playableTracks, rawData);

      if (selectedTrackIndices === null) {
        // User cancelled
        console.log("Track selection cancelled by user");
        return false;
      }

      // Re-show progress modal for quantization
      showProgressModal({ showCancel: true });
      cancelBtn?.addEventListener("click", onCancel, { once: true });
    }

    // ─── Stage 2: Quantize selected tracks ───
    updateProgress(
      0.3,
      1,
      "Quantizing selected tracks...",
      "Converting to notation",
    );

    const quantizeResponse = await fetch("/quantize-tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawData: rawData,
        trackIndices: selectedTrackIndices,
        quantizeResolution: 0.125,
      }),
      signal: abortController.signal,
    });

    if (!quantizeResponse.ok) {
      const errorData = await quantizeResponse.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Quantization failed (${quantizeResponse.status}).`,
      );
    }

    const vexflowJsonFromServer = await quantizeResponse.json();

    updateProgress(
      0.5,
      1,
      "Processing converted data...",
      "Running validation",
    );

    if (
      !vexflowJsonFromServer.measures ||
      !Array.isArray(vexflowJsonFromServer.measures)
    ) {
      throw new Error("Invalid server response - missing measures array");
    }

    // Process through scoreManager with splitting disabled for MIDI files
    const processedScore = await scoreManager.processScore(
      JSON.stringify(vexflowJsonFromServer),
      {
        fileName: file.name.replace(".mid", ".json"),
        disableSplitting: true,
        onProgress: (current, total, message) => {
          const adjustedCurrent = 0.5 + (current / total) * 0.4;
          updateProgress(
            adjustedCurrent,
            1,
            message,
            `Processing measure ${current} of ${total}`,
          );
        },
      },
    );

    updateProgress(0.9, 1, "Applying to score...", "Almost done");

    // Apply the processed score
    await applyProcessedScore(processedScore);

    // Handle validation issues
    if (
      processedScore.validationErrors &&
      processedScore.validationErrors.length > 0
    ) {
      console.warn(
        "MIDI validation warnings:",
        processedScore.validationErrors,
      );
      setTimeout(hideProgressModal, 3000);
    } else {
      hideProgressModal();
    }
  } catch (error) {
    if (error.name === "AbortError") {
      console.log("MIDI import cancelled by user");
      hideProgressModal();
      return false;
    }

    console.error("MIDI loading failed:", error);
    hideProgressModal();

    const userMessage = getUserFriendlyMidiError(error, file);
    alert(userMessage);

    return false;
  } finally {
    activeMidiAbortController = null;
    cancelBtn?.removeEventListener("click", onCancel);
  }
}

/**
 * Re-quantize cached raw MIDI data with different tracks or resolution.
 * Can be called from UI to switch tracks without re-uploading.
 */
export async function requantizeTracks(
  trackIndices = null,
  quantizeResolution = 0.125,
) {
  if (!cachedRawMidiData) {
    alert("No MIDI file loaded. Please load a MIDI file first.");
    return false;
  }

  showProgressModal({ showCancel: false });
  updateProgress(0, 1, "Re-quantizing tracks...", "Converting to notation");

  try {
    const response = await fetch("/quantize-tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawData: cachedRawMidiData,
        trackIndices: trackIndices,
        quantizeResolution: quantizeResolution,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Quantization failed (${response.status}).`,
      );
    }

    const vexflowJson = await response.json();
    updateProgress(0.5, 1, "Processing...", "Validating");

    const processedScore = await scoreManager.processScore(
      JSON.stringify(vexflowJson),
      {
        fileName: "requantized.json",
        disableSplitting: true,
        onProgress: (current, total, message) => {
          updateProgress(
            0.5 + (current / total) * 0.4,
            1,
            message,
            `Measure ${current}/${total}`,
          );
        },
      },
    );

    updateProgress(0.9, 1, "Applying...", "Almost done");
    await applyProcessedScore(processedScore);
    hideProgressModal();
    return true;
  } catch (error) {
    console.error("Re-quantization failed:", error);
    hideProgressModal();
    alert(`Re-quantization failed: ${error.message}`);
    return false;
  }
}

/**
 * Show a track picker modal for multi-track MIDI files.
 * Returns array of selected track indices, or null if cancelled.
 */
function showTrackPicker(playableTracks, rawData) {
  const MAX_TRACKS = 2;

  return new Promise((resolve) => {
    // Remove any existing picker
    document.getElementById("track-picker-modal")?.remove();

    // Sort by startMeasure (earliest first), then by noteCount descending as tiebreak
    const sorted = [...playableTracks].sort((a, b) => {
      const mA = a.startMeasure ?? Infinity;
      const mB = b.startMeasure ?? Infinity;
      if (mA !== mB) return mA - mB;
      return (b.noteCount || 0) - (a.noteCount || 0);
    });

    // Pre-select the first MAX_TRACKS tracks
    const preSelected = new Set(
      sorted.slice(0, MAX_TRACKS).map((t) => t.index),
    );

    const modal = document.createElement("div");
    modal.id = "track-picker-modal";
    modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10001;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

    const totalDuration = rawData.duration;
    const durationStr =
      totalDuration > 60
        ? `${Math.floor(totalDuration / 60)}m ${Math.round(totalDuration % 60)}s`
        : `${Math.round(totalDuration)}s`;

    const trackListHtml = sorted
      .map((track) => {
        const pitchMin = track.pitchRange?.min ?? 0;
        const pitchMax = track.pitchRange?.max ?? 127;
        const rangeLabel =
          pitchMin < 60 && pitchMax >= 60
            ? "Full range"
            : pitchMin >= 60
              ? "Treble"
              : "Bass";
        const measureLabel =
          track.startMeasure != null ? `Starts m. ${track.startMeasure}` : "";
        const checked = preSelected.has(track.index) ? "checked" : "";
        return `
                <label style="display: flex; align-items: center; padding: 10px 12px;
                    border: 1px solid #e0e0e0; border-radius: 8px; cursor: pointer;
                    transition: background 0.15s; margin-bottom: 6px;"
                    onmouseover="this.style.background='#f5f5f5'"
                    onmouseout="this.style.background='white'">
                    <input type="checkbox" value="${track.index}" ${checked}
                        style="margin-right: 12px; width: 18px; height: 18px; cursor: pointer;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #333; font-size: 14px;">
                            ${track.name}
                        </div>
                        <div style="font-size: 12px; color: #888; margin-top: 2px;">
                            ${track.instrument} · ${track.noteCount} notes · ${rangeLabel}${measureLabel ? " · " + measureLabel : ""}
                        </div>
                    </div>
                </label>
            `;
      })
      .join("");

    modal.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 28px;
                min-width: 420px; max-width: 540px; max-height: 80vh;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3); display: flex; flex-direction: column;">
                <h3 style="margin: 0 0 4px 0; color: #333; font-size: 18px;">Select Tracks</h3>
                <p style="margin: 0 0 6px 0; color: #888; font-size: 13px;">
                    ${rawData.tracks.length} tracks · ${durationStr} · ${rawData.tempoMap[0]?.bpm ?? "?"} BPM
                </p>
                <p id="track-pick-status" style="margin: 0 0 12px 0; color: #555; font-size: 13px; font-weight: 500;">
                </p>

                <div style="overflow-y: auto; max-height: 50vh; margin-bottom: 16px;">
                    ${trackListHtml}
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="track-pick-cancel" style="
                        background: #f5f5f5; color: #666; border: 1px solid #ddd;
                        padding: 10px 20px; border-radius: 8px; cursor: pointer;
                        font-size: 14px;">Cancel</button>
                    <button id="track-pick-selected" style="
                        background: #4CAF50; color: white; border: none;
                        padding: 10px 20px; border-radius: 8px; cursor: pointer;
                        font-size: 14px; font-weight: 600;">Load Selected</button>
                </div>
            </div>
        `;

    document.body.appendChild(modal);

    const checkboxes = () => modal.querySelectorAll('input[type="checkbox"]');
    const checkedCount = () =>
      modal.querySelectorAll('input[type="checkbox"]:checked').length;
    const statusEl = () => document.getElementById("track-pick-status");
    const loadBtn = () => document.getElementById("track-pick-selected");

    // Update status text and disable unchecked boxes when at limit
    function updateSelectionState() {
      const count = checkedCount();
      const status = statusEl();
      const btn = loadBtn();
      if (status) {
        if (count === 0) {
          status.textContent = "Select at least 1 track";
          status.style.color = "#e53935";
        } else if (count >= MAX_TRACKS) {
          status.textContent = `${count} of ${MAX_TRACKS} tracks selected (max)`;
          status.style.color = "#e65100";
        } else {
          status.textContent = `${count} of ${MAX_TRACKS} tracks selected`;
          status.style.color = "#555";
        }
      }
      // Disable unchecked checkboxes when at max
      checkboxes().forEach((cb) => {
        if (!cb.checked && count >= MAX_TRACKS) {
          cb.disabled = true;
          cb.parentElement.style.opacity = "0.45";
          cb.parentElement.style.cursor = "not-allowed";
        } else {
          cb.disabled = false;
          cb.parentElement.style.opacity = "1";
          cb.parentElement.style.cursor = "pointer";
        }
      });
      // Disable load button when nothing selected
      if (btn) {
        btn.disabled = count === 0;
        btn.style.opacity = count === 0 ? "0.5" : "1";
        btn.style.cursor = count === 0 ? "not-allowed" : "pointer";
      }
    }

    // Listen for checkbox changes
    checkboxes().forEach((cb) =>
      cb.addEventListener("change", updateSelectionState),
    );
    // Initial state
    updateSelectionState();

    const cleanup = () => modal.remove();

    document
      .getElementById("track-pick-cancel")
      .addEventListener("click", () => {
        cleanup();
        resolve(null);
      });

    document
      .getElementById("track-pick-selected")
      .addEventListener("click", () => {
        const selected = modal.querySelectorAll(
          'input[type="checkbox"]:checked',
        );
        const indices = Array.from(selected).map((cb) => parseInt(cb.value));
        if (indices.length === 0) return; // shouldn't happen, button is disabled
        cleanup();
        resolve(indices);
      });

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(null);
      }
    });
  });
}
// Generate user-friendly error messages for MIDI
function getUserFriendlyMidiError(error, file) {
  const fileName = file ? file.name : "MIDI file";
  const fileSize = file ? `(${Math.round(file.size / 1024)}KB)` : "";

  let message = `Failed to load ${fileName} ${fileSize}\n\n`;

  if (error.message.includes("timed out")) {
    message += "The conversion took too long and was stopped.\n\n";
    message += "This usually happens with very large or complex MIDI files.\n";
    message += "Try a shorter or simpler MIDI file.";
  } else if (
    error.message.includes("memory") ||
    error.message.includes("Memory") ||
    error.message.includes("allocate")
  ) {
    message += "The server ran out of memory processing this file.\n\n";
    message += "The MIDI file is too large or complex.\n";
    message += "Try a shorter or simpler MIDI file (under 5 MB).";
  } else if (
    error.message.includes("too many ticks") ||
    error.message.includes("Too many ticks")
  ) {
    message +=
      "This MIDI file has too many musical elements in individual measures.\n\n";
    message += "This often happens with:\n";
    message += "• MIDI files with many simultaneous notes\n";
    message += "• Very complex orchestral arrangements\n";
    message += "• Files with extremely short note values\n\n";
    message +=
      "Try using a simpler MIDI file or one with fewer simultaneous parts.";
  } else if (
    error.message.includes("validation") ||
    error.message.includes("measures")
  ) {
    message +=
      "The MIDI file structure is too complex for the current system.\n\n";
    message += "Try:\n";
    message += "• Using a MIDI with simpler notation\n";
    message += "• Reducing the number of tracks before export\n";
    message += "• Using a shorter musical piece";
  } else if (error.message.includes("too large")) {
    message += "This MIDI file is too large to process.\n\n";
    message += "Try using a smaller MIDI file (under 5 MB).";
  } else if (
    error.message.includes("format") ||
    error.message.includes("corrupted")
  ) {
    message +=
      "The MIDI file appears to be corrupted or in an unsupported format.\n\n";
    message += "Try:\n";
    message += "• Re-exporting the MIDI from your music software\n";
    message += "• Using Standard MIDI File format\n";
    message += "• Checking the file isn't corrupted";
  } else if (
    error.message.includes("Server") ||
    error.message.includes("server")
  ) {
    message += "There was a server error processing the MIDI file.\n\n";
    message += "Please try again in a moment, or try a different MIDI file.";
  } else {
    message += `Error: ${error.message}\n\n`;
    message +=
      "The MIDI file could not be loaded. Please try a different file.";
  }

  return message;
}

// Save current score to JSON file
export function saveScoreToFile() {
  const scoreData = {
    title: pianoState.title,
    keySignature: pianoState.keySignature,
    tempo: pianoState.tempo,
    timeSignature: {
      numerator: pianoState.timeSignature.numerator,
      denominator: pianoState.timeSignature.denominator,
    },
    instrument: pianoState.instrument,
    midiChannel: pianoState.midiChannel,
    measures: getMeasures(),
  };

  const dataStr = JSON.stringify(scoreData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${pianoState.title || "my-song"}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

// Export MIDI
export function exportMidi() {
  const vexflowJson = {
    keySignature: pianoState.keySignature,
    tempo: pianoState.tempo,
    timeSignature: {
      numerator: pianoState.timeSignature.numerator,
      denominator: pianoState.timeSignature.denominator,
    },
    instrument: pianoState.instrument,
    midiChannel: pianoState.midiChannel,
    measures: getMeasures().map((measure, measureIndex) => {
      return measure.map((note, noteIndex) => {
        return {
          id: `note-${measureIndex}-${noteIndex}`,
          name: note.name,
          clef: note.clef,
          duration: note.duration,
          measure: measureIndex,
          isRest: note.isRest,
        };
      });
    }),
  };

  fetch("/convert-to-midi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(vexflowJson),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to export MIDI file.");
      }
      return response.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-song.mid";
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch((error) => {
      console.error("MIDI export failed:", error);
      alert("Failed to export MIDI file.");
    });
}

export function setScoreTitle(raw) {
  pianoState.title = sanitizeTitle(raw);
  saveToLocalStorage();
  const titleEl = document.getElementById("score-title");
  if (titleEl) titleEl.textContent = pianoState.title;
}

// Save to localStorage
export function saveToLocalStorage() {
  const scoreData = {
    title: pianoState.title,
    measures: getMeasures(),
    keySignature: pianoState.keySignature,
    isMinorChordMode: pianoState.isMinorChordMode,
    timeSignature: {
      numerator: pianoState.timeSignature.numerator,
      denominator: pianoState.timeSignature.denominator,
    },
  };

  try {
    localStorage.setItem("autosavedScore", JSON.stringify(scoreData));
    console.log("Score saved to localStorage");
  } catch (e) {
    console.warn("Failed to save to localStorage:", e);
  }
}

// Utility functions for external access
export function getProcessingStatus() {
  return scoreManager.getProcessingStatus();
}

export function getScoreManager() {
  return scoreManager;
}
