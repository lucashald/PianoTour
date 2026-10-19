// timeSignatures.js
// The time signatures the score editor allows. Add an entry only after testing it:
// writing, playback, beaming, re-splitting and print.

import { pianoState } from "./appState.js";

export const SUPPORTED_TIME_SIGNATURES = [
  "2/4",
  "3/4",
  "4/4",
  "5/4",
  "6/4",
  "2/2",
  "3/2",
  "4/2",
  "3/8",
  "4/8",
  "6/8",
];

export function isSupportedTimeSignature(numerator, denominator) {
  return SUPPORTED_TIME_SIGNATURES.includes(`${numerator}/${denominator}`);
}

/**
 * Fills the editor's time signature dropdown (if present) and selects the current value.
 */
export function syncTimeSignatureSelect() {
  const select = document.getElementById("time-signature-select");
  if (!select) return;

  if (select.options.length === 0) {
    SUPPORTED_TIME_SIGNATURES.forEach((value) => {
      select.add(new Option(value, value));
    });
  }

  select.value = `${pianoState.timeSignature.numerator}/${pianoState.timeSignature.denominator}`;
}
