// settingsStore.js
// Persists UI preferences (toggles, chosen instrument) to localStorage.
// These are global, not per instrument; per-instrument audio sliders live in audioSettings.js.

const PREFIX = 'ui-settings-';

/**
 * Reads a saved boolean, falling back to defaultValue when unset or unreadable.
 */
export function loadBool(name, defaultValue) {
  try {
    const saved = localStorage.getItem(PREFIX + name);
    return saved === null ? defaultValue : saved === 'true';
  } catch (error) {
    console.warn(`Could not read setting ${name}:`, error);
    return defaultValue;
  }
}

export function saveBool(name, value) {
  try {
    localStorage.setItem(PREFIX + name, String(Boolean(value)));
  } catch (error) {
    console.warn(`Could not save setting ${name}:`, error);
  }
}

/**
 * Reads a saved string, falling back to defaultValue when unset or unreadable.
 */
export function loadString(name, defaultValue) {
  try {
    return localStorage.getItem(PREFIX + name) ?? defaultValue;
  } catch (error) {
    console.warn(`Could not read setting ${name}:`, error);
    return defaultValue;
  }
}

export function saveString(name, value) {
  try {
    localStorage.setItem(PREFIX + name, value);
  } catch (error) {
    console.warn(`Could not save setting ${name}:`, error);
  }
}
