// playAlongUI.js
// Inline panel rendering for play-along mode: replaces spectrum with controls

import { pianoState } from "../core/appState.js";
import {
  stop as stopPlayAlong,
  pause as pausePlayAlong,
  resume as resumePlayAlong,
  restart as restartPlayAlong,
} from "../score/playAlongController.js";
import { setTempo } from "../score/scoreWriter.js";

// ===================================================================
// DOM Element References
// ===================================================================

let panelEl = null;
let completionEl = null;

function getPanelElements() {
  if (panelEl) return panelEl;
  panelEl = {
    root: document.getElementById("playalong-panel"),
    spectrum: document.getElementById("spectrum-container"),
    settings: document.getElementById("playalong-settings"),
    live: document.getElementById("playalong-live"),
    accuracy: document.getElementById("playalong-accuracy"),
    streak: document.getElementById("playalong-streak"),
    progressFill: document.getElementById("playalong-progress-fill"),
    progressText: document.getElementById("playalong-progress-text"),
    expectedNotes: document.getElementById("playalong-expected-notes"),
    pausedIndicator: document.getElementById("playalong-paused"),
    expectedSection: document.getElementById("playalong-expected"),
    pauseBtn: document.getElementById("playalong-pause-btn"),
    timingLabel: document.getElementById("playalong-timing-label"),
    timingSection: document.getElementById("playalong-timing"),
    countIn: document.getElementById("playalong-countin"),
    countInNumber: document.getElementById("playalong-countin-number"),
    completion: document.getElementById("playalong-completion"),
    tempoValue: document.getElementById("playalong-tempo-value"),
    liveTempoValue: document.getElementById("playalong-live-tempo-value"),
    completeTempoValue: document.getElementById("playalong-complete-tempo-value"),
  };
  return panelEl;
}

function getCompletionElements() {
  if (completionEl) return completionEl;
  completionEl = {
    root: document.getElementById("playalong-completion"),
    accuracy: document.getElementById("playalong-completion-accuracy"),
    correct: document.getElementById("playalong-completion-correct"),
    incorrect: document.getElementById("playalong-completion-incorrect"),
    bestStreak: document.getElementById("playalong-completion-streak"),
    time: document.getElementById("playalong-completion-time"),
    timingSection: document.getElementById("playalong-completion-timing"),
    perfect: document.getElementById("playalong-completion-perfect"),
    good: document.getElementById("playalong-completion-good"),
    early: document.getElementById("playalong-completion-early"),
    late: document.getElementById("playalong-completion-late"),
    missed: document.getElementById("playalong-completion-missed"),
  };
  return completionEl;
}

// ===================================================================
// Spectrum / Panel Toggle
// ===================================================================

/**
 * Hide spectrum and show the play-along panel.
 */
function showPanel() {
  const els = getPanelElements();
  if (els.spectrum) els.spectrum.classList.add("hidden");
  if (els.root) els.root.classList.remove("hidden");
}

/**
 * Hide the play-along panel and restore the spectrum.
 */
function hidePanel() {
  const els = getPanelElements();
  if (els.root) els.root.classList.add("hidden");
  if (els.spectrum) els.spectrum.classList.remove("hidden");
}

// ===================================================================
// Panel View Management
// ===================================================================

/**
 * Show only the specified sub-view inside the panel.
 * @param {'settings'|'live'|'countin'|'completion'} view
 */
function showPanelView(view) {
  const els = getPanelElements();
  // Hide all sub-views
  if (els.settings) els.settings.style.display = "none";
  if (els.live) els.live.style.display = "none";
  if (els.countIn) els.countIn.style.display = "none";
  if (els.completion) els.completion.style.display = "none";

  // Show the requested view
  switch (view) {
    case "settings":
      if (els.settings) els.settings.style.display = "block";
      break;
    case "live":
      if (els.live) els.live.style.display = "block";
      break;
    case "countin":
      if (els.countIn) els.countIn.style.display = "flex";
      break;
    case "completion":
      if (els.completion) els.completion.style.display = "block";
      break;
  }
}

// ===================================================================
// Tempo Helpers
// ===================================================================

const TEMPO_STEP = 5;
const TEMPO_MIN = 30;
const TEMPO_MAX = 300;

/**
 * Adjust tempo by a delta and sync all displays.
 * Works both before and during a play-along session.
 * @param {number} delta - Amount to change (e.g. +5 or -5)
 */
function adjustTempo(delta) {
  const current = pianoState.tempo || 120;
  const next = Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, current + delta));
  if (next === current) return;

  // setTempo updates pianoState.tempo, redraws score, and saves
  setTempo(next);

  // If Tone.Transport is running (active timed session), update live BPM
  if (typeof Tone !== "undefined" && Tone.Transport.state === "started") {
    Tone.Transport.bpm.value = next;
  }

  syncTempoDisplays(next);
}

/**
 * Sync all tempo display elements to the given value.
 */
function syncTempoDisplays(bpm) {
  const els = getPanelElements();
  if (els.tempoValue) els.tempoValue.textContent = bpm;
  if (els.liveTempoValue) els.liveTempoValue.textContent = bpm;
  if (els.completeTempoValue) els.completeTempoValue.textContent = bpm;
}

// ===================================================================
// Public API: Show / Hide
// ===================================================================

/**
 * Show the play-along panel (replaces spectrum).
 * @param {boolean} showLive - If true, shows live stats (session active). If false, shows settings panel.
 */
export function showPlayAlongHUD(showLive = false) {
  showPanel();
  syncTempoDisplays(pianoState.tempo || 120);

  if (showLive) {
    showPanelView("live");

    // Show/hide timing display based on mode
    const els = getPanelElements();
    if (els.timingSection) {
      els.timingSection.style.display =
        pianoState.playAlong.settings.mode === "timed" ? "block" : "none";
    }
  } else {
    showPanelView("settings");
  }
}

/**
 * Hide the play-along panel and restore spectrum.
 */
export function hidePlayAlongHUD() {
  hidePanel();
}

/**
 * Show the count-in number.
 * @param {number} beat - The beat number to display (4, 3, 2, 1).
 */
export function showCountIn(beat) {
  showPanel();
  showPanelView("countin");

  const els = getPanelElements();
  if (els.countInNumber) {
    els.countInNumber.textContent = beat;
    // Re-trigger animation
    els.countInNumber.classList.remove("playalong-panel__countin-pop");
    void els.countInNumber.offsetWidth;
    els.countInNumber.classList.add("playalong-panel__countin-pop");
  }
}

/**
 * Hide the count-in and switch to live view.
 */
export function hideCountIn() {
  // Switch to the live sub-view (count-in hid all other views)
  showPanelView("live");

  // Show/hide timing display based on mode
  const els = getPanelElements();
  if (els.timingSection) {
    els.timingSection.style.display =
      pianoState.playAlong.settings.mode === "timed" ? "block" : "none";
  }
}

// ===================================================================
// HUD Update
// ===================================================================

function formatStreak(streak) {
  if (streak >= 50) return `${streak} <span class="streak-fire streak-fire--max">MAX</span>`;
  if (streak >= 25) return `${streak} <span class="streak-fire">HOT</span>`;
  if (streak >= 10) return `${streak} <span class="streak-fire">x${streak}</span>`;
  return `${streak}`;
}

function getCurrentExpectedDisplay() {
  const pa = pianoState.playAlong;
  if (pa.currentPosition.eventIndex >= pa.noteSequence.length) return "--";

  const event = pa.noteSequence[pa.currentPosition.eventIndex];
  if (!event || event.isRest || event.requiredMidiNumbers.size === 0) return "--";

  // Filter notes by selected clef to match what the user is expected to play
  const settings = pa.settings;
  let relevantNotes;
  if (settings.trebleOnly) {
    relevantNotes = event.trebleNotes;
  } else if (settings.bassOnly) {
    relevantNotes = event.bassNotes;
  } else {
    relevantNotes = [...event.trebleNotes, ...event.bassNotes];
  }

  const names = relevantNotes
    .filter((n) => !n.isRest && !n.isTiedEnd)
    .map((n) => n.chordName || n.noteName)
    .filter(Boolean);

  return names.length > 0 ? names.join(", ") : "--";
}

/**
 * Update all panel elements with current play-along state.
 */
export function updateHUD() {
  const els = getPanelElements();
  if (!els.root) return;

  const pa = pianoState.playAlong;
  const stats = pa.stats;

  // Accuracy
  const total = stats.correct + stats.incorrect;
  const accuracy = total > 0 ? Math.round((stats.correct / total) * 100) : 100;
  if (els.accuracy) {
    els.accuracy.textContent = `${accuracy}%`;
  }

  // Streak
  if (els.streak) {
    els.streak.innerHTML = formatStreak(stats.streak);
  }

  // Progress
  const completedEvents = pa.currentPosition.eventIndex;
  const totalEvents = pa.noteSequence.length;
  const progressPct = totalEvents > 0 ? (completedEvents / totalEvents) * 100 : 0;

  if (els.progressFill) {
    els.progressFill.style.width = `${progressPct}%`;
  }
  if (els.progressText) {
    els.progressText.textContent = `${completedEvents} / ${stats.totalNotes}`;
  }

  // Expected notes (gated by showNoteNames setting for future toggle)
  if (els.expectedSection) {
    if (pianoState.playAlong.settings.showNoteNames) {
      els.expectedSection.style.display = pa.paused ? "none" : "block";
      if (els.expectedNotes) {
        els.expectedNotes.textContent = getCurrentExpectedDisplay();
      }
    } else {
      els.expectedSection.style.display = "none";
    }
  }

  // Paused state
  if (els.pausedIndicator) {
    els.pausedIndicator.style.display = pa.paused ? "block" : "none";
  }

  // Pause button text
  if (els.pauseBtn) {
    els.pauseBtn.textContent = pa.paused ? "Resume" : "Pause";
  }
}

/**
 * Show a timing rating flash in the panel (timed mode).
 * @param {'perfect'|'good'|'early'|'late'|'missed'} rating
 */
export function showTimingRating(rating) {
  const els = getPanelElements();
  if (!els.timingLabel) return;

  const labels = {
    perfect: "PERFECT",
    good: "GOOD",
    early: "EARLY",
    late: "LATE",
    missed: "MISSED",
  };

  els.timingLabel.textContent = labels[rating] || "--";
  els.timingLabel.className = "playalong-panel__timing-label";
  els.timingLabel.classList.add(`playalong-panel__timing-label--${rating}`);

  // Animate
  els.timingLabel.classList.remove("playalong-panel__timing-pop");
  void els.timingLabel.offsetWidth;
  els.timingLabel.classList.add("playalong-panel__timing-pop");
}

// ===================================================================
// Settings Toggles
// ===================================================================

function setActiveToggle(groupId, activeValue, dataAttr) {
  const group = document.getElementById(groupId);
  if (!group) return;

  group.querySelectorAll(".playalong-panel__toggle-btn").forEach((btn) => {
    if (btn.dataset[dataAttr] === activeValue) {
      btn.classList.add("playalong-panel__toggle-btn--active");
    } else {
      btn.classList.remove("playalong-panel__toggle-btn--active");
    }
  });
}

function syncSettingsToUI() {
  const settings = pianoState.playAlong.settings;
  setActiveToggle("playalong-mode-toggle", settings.mode, "mode");

  let clefValue = "both";
  if (settings.trebleOnly) clefValue = "treble";
  else if (settings.bassOnly) clefValue = "bass";
  setActiveToggle("playalong-clef-toggle", clefValue, "clef");
}

// ===================================================================
// Completion (inline view)
// ===================================================================

/**
 * Show the completion view inline in the panel.
 * @param {Object} results - { accuracy, correct, incorrect, bestStreak, elapsed, totalNotes, timing? }
 */
export function showCompletionModal(results) {
  // Stay in the panel, switch to completion view
  showPanel();
  showPanelView("completion");

  const comp = getCompletionElements();
  if (!comp.root) return;

  // Set accuracy with color
  if (comp.accuracy) {
    comp.accuracy.textContent = `${results.accuracy}%`;
    comp.accuracy.style.color =
      results.accuracy >= 80
        ? "var(--color-green-light, #499770)"
        : results.accuracy >= 50
        ? "var(--color-gold-light, #D8A668)"
        : "var(--color-peach-light, #D88368)";
  }

  if (comp.correct) comp.correct.textContent = results.correct;
  if (comp.incorrect) comp.incorrect.textContent = results.incorrect;
  if (comp.bestStreak) comp.bestStreak.textContent = results.bestStreak;
  if (comp.time) {
    const mins = Math.floor(results.elapsed / 60);
    const secs = results.elapsed % 60;
    comp.time.textContent = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  // Timing breakdown (timed mode only)
  if (comp.timingSection) {
    if (results.timing) {
      comp.timingSection.classList.remove("hidden");
      if (comp.perfect) comp.perfect.textContent = results.timing.perfect || 0;
      if (comp.good) comp.good.textContent = results.timing.good || 0;
      if (comp.early) comp.early.textContent = results.timing.early || 0;
      if (comp.late) comp.late.textContent = results.timing.late || 0;
      if (comp.missed) comp.missed.textContent = results.timing.missed || 0;
    } else {
      comp.timingSection.classList.add("hidden");
    }
  }
}

/**
 * Hide the completion view and restore spectrum.
 */
function hideCompletionView() {
  hidePanel();
}

// ===================================================================
// Event Listeners
// ===================================================================

/**
 * Initialize play-along UI event listeners.
 */
export function initializePlayAlongUI() {
  // --- Mode toggle ---
  document.getElementById("playalong-mode-toggle")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".playalong-panel__toggle-btn");
    if (!btn || pianoState.playAlong.active) return;

    const mode = btn.dataset.mode;
    if (mode) {
      pianoState.playAlong.settings.mode = mode;
      setActiveToggle("playalong-mode-toggle", mode, "mode");
    }
  });

  // --- Clef toggle ---
  document.getElementById("playalong-clef-toggle")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".playalong-panel__toggle-btn");
    if (!btn || pianoState.playAlong.active) return;

    const clef = btn.dataset.clef;
    if (clef) {
      const settings = pianoState.playAlong.settings;
      settings.trebleOnly = clef === "treble";
      settings.bassOnly = clef === "bass";
      settings.requireBothClefs = clef === "both";
      setActiveToggle("playalong-clef-toggle", clef, "clef");
    }
  });

  // --- HUD controls ---
  document.getElementById("playalong-pause-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    const pa = pianoState.playAlong;
    if (pa.paused) {
      resumePlayAlong();
    } else {
      pausePlayAlong();
    }
    updateHUD();
  });

  document.getElementById("playalong-stop-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    stopPlayAlong();
    showPlayAlongHUD(false); // Return to settings
  });

  document.getElementById("playalong-restart-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    restartPlayAlong();
  });

  // --- Close buttons (settings + live) ---
  document.getElementById("playalong-close-settings-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    hidePanel();
  });

  document.getElementById("playalong-close-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    stopPlayAlong();
    hidePanel();
  });

  // --- Tempo controls (settings panel) ---
  document.getElementById("playalong-tempo-down")?.addEventListener("click", (e) => {
    e.preventDefault();
    adjustTempo(-TEMPO_STEP);
  });
  document.getElementById("playalong-tempo-up")?.addEventListener("click", (e) => {
    e.preventDefault();
    adjustTempo(TEMPO_STEP);
  });

  // --- Tempo controls (live panel) ---
  document.getElementById("playalong-live-tempo-down")?.addEventListener("click", (e) => {
    e.preventDefault();
    adjustTempo(-TEMPO_STEP);
  });
  document.getElementById("playalong-live-tempo-up")?.addEventListener("click", (e) => {
    e.preventDefault();
    adjustTempo(TEMPO_STEP);
  });

  // --- Completion controls ---
  document.getElementById("playalong-complete-restart-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    restartPlayAlong();
  });

  document.getElementById("playalong-complete-stop-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    stopPlayAlong();
    showPlayAlongHUD(false); // Return to settings
  });

  document.getElementById("playalong-complete-close-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    stopPlayAlong();
    hidePanel();
  });

  // --- Tempo controls (completion panel) ---
  document.getElementById("playalong-complete-tempo-down")?.addEventListener("click", (e) => {
    e.preventDefault();
    adjustTempo(-TEMPO_STEP);
  });
  document.getElementById("playalong-complete-tempo-up")?.addEventListener("click", (e) => {
    e.preventDefault();
    adjustTempo(TEMPO_STEP);
  });

  // --- Escape key: stop session if active, or close panel if on settings ---
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const els = getPanelElements();
      if (els.root && !els.root.classList.contains("hidden")) {
        e.preventDefault();
        if (pianoState.playAlong.active) {
          stopPlayAlong();
          showPlayAlongHUD(false); // Return to settings
        } else {
          hidePanel(); // Close panel entirely
        }
      }
    }
  });

  // Sync settings UI to current state
  syncSettingsToUI();
  syncTempoDisplays(pianoState.tempo || 120);
}
