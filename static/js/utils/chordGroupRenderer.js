import { ChordPreview } from '../classes/ChordPreview.js';
import { CHORD_DEFINITIONS, CHORD_GROUPS } from '../core/note-data.js';

/**
 * Renders a collection of chords or chord groups with preview elements
 * @param {string} containerId - ID of the container element to render into
 * @param {Array} items - Array of chord names or chord group objects
 * @param {string} itemType - 'chords' or 'groups' to specify what items contains
 * @param {string} clef - 'treble', 'bass', or 'both' (default: 'both')
 * @param {object} options - Optional configuration
 * @param {number} options.chordWidth - Width of each chord preview (default: 110)
 * @param {number} options.chordHeight - Height of each chord preview (default: 150)
 * @returns {object} - Object containing all created ChordPreview instances organized by chord name
 */
export function renderChordPreviews(containerId, items, itemType, clef = 'both', options = {}) {
    const chordWidth = options.chordWidth || 110;
    const chordHeight = options.chordHeight || 150;
    
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`ChordGroupRenderer: Container #${containerId} not found`);
        return {};
    }

    // Validate inputs
    if (!items || items.length === 0) {
        console.warn('ChordGroupRenderer: No items provided');
        return {};
    }

    if (!['chords', 'groups'].includes(itemType)) {
        console.error('ChordGroupRenderer: itemType must be "chords" or "groups"');
        return {};
    }

    if (!['treble', 'bass', 'both'].includes(clef)) {
        console.error('ChordGroupRenderer: clef must be "treble", "bass", or "both"');
        return {};
    }

    container.innerHTML = '';
    const allPreviews = {};

    if (itemType === 'chords') {
        // Render individual chords
        renderChordList(container, items, clef, chordWidth, chordHeight, allPreviews);
    } else {
        // Render chord groups
        renderChordGroupsList(container, items, clef, chordWidth, chordHeight, allPreviews);
    }

    return allPreviews;
}

/**
 * Renders a flat list of chord names
 * @private
 */
function renderChordList(container, chordNames, clef, chordWidth, chordHeight, allPreviews) {
    const chordContainer = document.createElement('div');
    chordContainer.className = 'chord-list-container';
    container.appendChild(chordContainer);

    chordNames.forEach((chordName) => {
        renderSingleChord(chordContainer, chordName, clef, chordWidth, chordHeight, allPreviews);
    });
}

/**
 * Renders chord groups with sections
 * @private
 */
function renderChordGroupsList(container, chordGroups, clef, chordWidth, chordHeight, allPreviews) {
    chordGroups.forEach((group) => {
        // Create section for this group
        const section = document.createElement('div');
        section.className = 'chord-group-section';

        const heading = document.createElement('h2');
        heading.className = 'chord-group-heading';
        heading.textContent = group.label;
        section.appendChild(heading);

        const groupContainer = document.createElement('div');
        groupContainer.id = `chord-group-${group.label.replace(/\s+/g, '-')}`;
        groupContainer.className = 'chord-group-container';
        section.appendChild(groupContainer);

        container.appendChild(section);

        // Render each chord in the group
        group.chords.forEach((chordName) => {
            renderSingleChord(groupContainer, chordName, clef, chordWidth, chordHeight, allPreviews);
        });
    });
}

/**
 * Creates a preview element for a single chord in a specific clef
 * @private
 */
function createClefPreview(chordName, clef, chordWidth, chordHeight) {
    // Create container div
    const previewDiv = document.createElement('div');
    const elementId = `chord-${chordName}-${clef}`;
    previewDiv.id = elementId;
    previewDiv.className = `chord-preview chord-preview-${clef}`;

    // Create and render ChordPreview instance
    const preview = new ChordPreview(elementId, {
        clef: clef,
        width: chordWidth,
        height: chordHeight
    });

    // Append the element to DOM BEFORE rendering
    // This ensures the element exists when ChordPreview.render() is called
    // We'll return it to be appended by the caller

    return {
        element: previewDiv,
        instance: preview,
        elementId: elementId
    };
}

/**
 * Renders a single chord with optional clef variants
 * @private
 */
function renderSingleChord(container, chordName, clef, chordWidth, chordHeight, allPreviews) {
    // Verify chord exists
    if (!CHORD_DEFINITIONS[chordName]) {
        console.warn(`ChordGroupRenderer: Chord "${chordName}" not found in CHORD_DEFINITIONS`);
        return;
    }

    // Create wrapper for the chord
    const chordWrapper = document.createElement('div');
    chordWrapper.className = 'chord-preview-wrapper';
    chordWrapper.id = `chord-wrapper-${chordName}`;

    // Create label
    const label = document.createElement('div');
    label.className = 'chord-preview-label';
    label.textContent = chordName;
    chordWrapper.appendChild(label);

    // Create preview container(s) based on clef parameter
    if (clef === 'treble' || clef === 'both') {
        const treblePreview = createClefPreview(chordName, 'treble', chordWidth, chordHeight);
        chordWrapper.appendChild(treblePreview.element);
        
        const previewKey = `${chordName}-treble`;
        allPreviews[previewKey] = treblePreview.instance;
    }

    if (clef === 'bass' || clef === 'both') {
        const bassPreview = createClefPreview(chordName, 'bass', chordWidth, chordHeight);
        chordWrapper.appendChild(bassPreview.element);
        
        const previewKey = `${chordName}-bass`;
        allPreviews[previewKey] = bassPreview.instance;
    }

    // Append wrapper to container FIRST
    container.appendChild(chordWrapper);

    // NOW render the chords after they're in the DOM
    if (clef === 'treble' || clef === 'both') {
        const treblePreview = allPreviews[`${chordName}-treble`];
        if (treblePreview) {
            treblePreview.render(chordName);
        }
    }

    if (clef === 'bass' || clef === 'both') {
        const bassPreview = allPreviews[`${chordName}-bass`];
        if (bassPreview) {
            bassPreview.render(chordName);
        }
    }
}

/**
 * Quick helper to render all chord groups with both clefs
 * @param {string} containerId - Container element ID
 * @param {object} options - Optional configuration (chordWidth, chordHeight)
 * @returns {object} - All created ChordPreview instances
 */
export function renderAllChordGroups(containerId, options = {}) {
    return renderChordPreviews(containerId, CHORD_GROUPS, 'groups', 'both', options);
}

/**
 * Quick helper to render specific chords
 * @param {string} containerId - Container element ID
 * @param {string[]} chordNames - Array of chord names to render
 * @param {string} clef - 'treble', 'bass', or 'both'
 * @param {object} options - Optional configuration (chordWidth, chordHeight)
 * @returns {object} - All created ChordPreview instances
 */
export function renderChords(containerId, chordNames, clef = 'both', options = {}) {
    return renderChordPreviews(containerId, chordNames, 'chords', clef, options);
}

/**
 * Quick helper to render a single chord group
 * @param {string} containerId - Container element ID
 * @param {string} groupLabel - Label of the chord group to render
 * @param {string} clef - 'treble', 'bass', or 'both'
 * @param {object} options - Optional configuration (chordWidth, chordHeight)
 * @returns {object} - All created ChordPreview instances
 */
export function renderChordGroup(containerId, groupLabel, clef = 'both', options = {}) {
    const group = CHORD_GROUPS.find(g => g.label === groupLabel);
    
    if (!group) {
        console.error(`ChordGroupRenderer: Chord group "${groupLabel}" not found`);
        return {};
    }

    return renderChordPreviews(containerId, [group], 'groups', clef, options);
}
