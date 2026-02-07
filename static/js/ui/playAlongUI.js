// playAlongUI.js
// HUD overlay rendering for play-along mode: score, streak, progress, controls

import { pianoState } from "../core/appState.js";
import {
  stop as stopPlayAlong,
  pause as pausePlayAlong,
  resume as resumePlayAlong,
  restart as restartPlayAlong,
} from "../score/playAlongController.js";

// ===================================================================
// DOM Element References
// ===================================================================

let hudEl = null;
let completionEl = null;

function getHudElements() {
  if (hudEl) return hudEl;
  hudEl = {
    root: document.getElementById("playalong-hud"),
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
  };
  return hudEl;
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
// HUD Show / Hide
// ===================================================================

/**
 * Show the play-along HUD overlay.
 * @param {boolean} showLive - If true, shows live stats (session active). If false, shows settings panel.
 */
export function showPlayAlongHUD(showLive = false) {
  const els = getHudElements();
  if (els.root) {
    els.root.classList.remove("hidden");
  }

  // Toggle between settings panel and live stats
  if (els.settings) {
    els.settings.style.display = showLive ? "none" : "block";
  }
  if (els.live) {
    els.live.style.display = showLive ? "block" : "none";
  }

  // Show/hide timing display based on mode
  if (els.timingSection) {
    els.timingSection.style.display =
      showLive && pianoState.playAlong.settings.mode === "timed" ? "block" : "none";
  }

  // Hide completion modal if visible
  const comp = getCompletionElements();
  if (comp.root) {
    comp.root.classList.add("hidden");
  }

  // Hide count-in when switching panels
  if (els.countIn) {
    els.countIn.style.display = "none";
  }
}

/**
 * Hide the play-along HUD overlay.
 */
export function hidePlayAlongHUD() {
  const els = getHudElements();
  if (els.root) {
    els.root.classList.add("hidden");
  }
}

/**
 * Show the count-in number overlay.
 * @param {number} beat - The beat number to display (4, 3, 2, 1).
 */
export function showCountIn(beat) {
  const els = getHudElements();

  // Hide settings and live panels during count-in
  if (els.settings) els.settings.style.display = "none";
  if (els.live) els.live.style.display = "none";

  if (els.countIn) {
    els.countIn.style.display = "flex";
  }
  if (els.countInNumber) {
    els.countInNumber.textContent = beat;
    // Re-trigger animation
    els.countInNumber.classList.remove("playalong-hud__countin-pop");
    void els.countInNumber.offsetWidth;
    els.countInNumber.classList.add("playalong-hud__countin-pop");
  }
}

/**
 * Hide the count-in overlay.
 */
export function hideCountIn() {
  const els = getHudElements();
  if (els.countIn) {
    els.countIn.style.display = "none";
  }
}

// ===================================================================
// HUD Update
// ===================================================================

/**
 * Get a streak display string.
 */
function formatStreak(streak) {
  if (streak >= 50) return `${streak} <span class="streak-fire streak-fire--max">MAX</span>`;
  if (streak >= 25) return `${streak} <span class="streak-fire">HOT</span>`;
  if (streak >= 10) return `${streak} <span class="streak-fire">x${streak}</span>`;
  return `${streak}`;
}

/**
 * Get the display names for the current expected notes.
 */
function getCurrentExpectedDisplay() {
  const pa = pianoState.playAlong;
  if (pa.currentPosition.eventIndex >= pa.noteSequence.length) return "--";

  const event = pa.noteSequence[pa.currentPosition.eventIndex];
  if (!event || event.isRest || event.requiredMidiNumbers.size === 0) return "--";

  return event.displayNames.join(", ") || "--";
}

/**
 * Update all HUD elements with current play-along state.
 */
export function updateHUD() {
  const els = getHudElements();
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

  // Expected notes
  if (els.expectedNotes) {
    els.expectedNotes.textContent = getCurrentExpectedDisplay();
  }

  // Paused state
  if (els.pausedIndicator) {
    els.pausedIndicator.style.display = pa.paused ? "block" : "none";
  }
  if (els.expectedSection) {
    els.expectedSection.style.display = pa.paused ? "none" : "block";
  }

  // Pause button text
  if (els.pauseBtn) {
    els.pauseBtn.textContent = pa.paused ? "Resume" : "Pause";
  }
}

/**
 * Show a timing rating flash in the HUD (timed mode).
 * @param {'perfect'|'good'|'early'|'late'|'missed'} rating
 */
export function showTimingRating(rating) {
  const els = getHudElements();
  if (!els.timingLabel) return;

  const labels = {
    perfect: "PERFECT",
    good: "GOOD",
    early: "EARLY",
    late: "LATE",
    missed: "MISSED",
  };

  els.timingLabel.textContent = labels[rating] || "--";
  els.timingLabel.className = "playalong-hud__timing-label";
  els.timingLabel.classList.add(`playalong-hud__timing-label--${rating}`);

  // Animate
  els.timingLabel.classList.remove("playalong-hud__timing-pop");
  void els.timingLabel.offsetWidth; // Force reflow
  els.timingLabel.classList.add("playalong-hud__timing-pop");
}

// ===================================================================
// Settings Toggles
// ===================================================================

/**
 * Apply the active visual state to the correct toggle button.
 */
function setActiveToggle(groupId, activeValue, dataAttr) {
  const group = document.getElementById(groupId);
  if (!group) return;

  group.querySelectorAll(".playalong-hud__toggle-btn").forEach((btn) => {
    if (btn.dataset[dataAttr] === activeValue) {
      btn.classList.add("playalong-hud__toggle-btn--active");
    } else {
      btn.classList.remove("playalong-hud__toggle-btn--active");
    }
  });
}

/**
 * Initialize the settings toggles to reflect current pianoState.
 */
function syncSettingsToUI() {
  const settings = pianoState.playAlong.settings;

  // Mode toggle
  setActiveToggle("playalong-mode-toggle", settings.mode, "mode");

  // Clef toggle
  let clefValue = "both";
  if (settings.trebleOnly) clefValue = "treble";
  else if (settings.bassOnly) clefValue = "bass";
  setActiveToggle("playalong-clef-toggle", clefValue, "clef");
}

// ===================================================================
// Completion Modal
// ===================================================================

/**
 * Show the completion modal with final results.
 * @param {Object} results - { accuracy, correct, incorrect, bestStreak, elapsed, totalNotes, timing? }
 */
export function showCompletionModal(results) {
  // Hide HUD
  hidePlayAlongHUD();

  const comp = getCompletionElements();
  if (!comp.root) return;

  // Set accuracy with color class
  if (comp.accuracy) {
    comp.accuracy.textContent = `${results.accuracy}%`;
    comp.accuracy.className = "playalong-completion__accuracy";
    if (results.accuracy >= 80) {
      comp.accuracy.classList.add("playalong-completion__accuracy--high");
    } else if (results.accuracy >= 50) {
      comp.accuracy.classList.add("playalong-completion__accuracy--mid");
    } else {
      comp.accuracy.classList.add("playalong-completion__accuracy--low");
    }
  }

  // Set detail values
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

  comp.root.classList.remove("hidden");
}

/**
 * Hide the completion modal.
 */
function hideCompletionModal() {
  const comp = getCompletionElements();
  if (comp.root) {
    comp.root.classList.add("hidden");
  }
}

// ===================================================================
// Event Listeners (attached once from initializePlayAlongUI)
// ===================================================================

/**
 * Initialize play-along UI event listeners.
 * Called once during app setup.
 */
export function initializePlayAlongUI() {
  // --- Mode toggle ---
  document.getElementById("playalong-mode-toggle")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".playalong-hud__toggle-btn");
    if (!btn || pianoState.playAlong.active) return; // Don't allow changes during active session

    const mode = btn.dataset.mode;
    if (mode) {
      pianoState.playAlong.settings.mode = mode;
      setActiveToggle("playalong-mode-toggle", mode, "mode");
    }
  });

  // --- Clef toggle ---
  document.getElementById("playalong-clef-toggle")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".playalong-hud__toggle-btn");
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
  });

  document.getElementById("playalong-restart-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    restartPlayAlong();
  });

  // --- Completion modal controls ---
  document.getElementById("playalong-tryagain-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    hideCompletionModal();
    restartPlayAlong();
  });

  document.getElementById("playalong-done-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    hideCompletionModal();
    stopPlayAlong();
  });

  // Sync settings UI to current state
  syncSettingsToUI();
}
