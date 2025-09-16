// guitarControlPanel.js - Main guitar control panel functionality

// Import required modules
import { createChordButton, ChordDiagramRenderer } from '/static/js/ui/guitarUI.js';
import { setGuitarTuning, getPresetTunings, getCurrentTuningPreset, getCurrentTuningNotes } from '/static/js/instrument/guitarInstrument.js';
import * as ChordDB from '/static/js/core/chords.js';

// ===================================================================
// Helper Functions  
// ===================================================================

function convertChordsDbToArray(frets) {
  // If it's already an array, return it as-is (chord database format)
  if (Array.isArray(frets)) {
    return frets.map(fret => {
      if (fret === 'x') return null;
      return fret;
    });
  }
  
  // If it's a string, convert it (legacy format)
  if (typeof frets === 'string') {
    return frets.split('').map(fret => {
      if (fret === 'x') return null;
      return parseInt(fret, 10);
    });
  }
  
  // Fallback
  return frets;
}

/**
 * Guitar Control Panel Application
 * Manages chord lookup, guitar tuning, and autocomplete functionality
 */
class GuitarControlPanel {
    constructor() {
        this.currentChordData = null;
        this.chordAutocomplete = null;
        this.guitarTuningSelector = null;
        
        this.init();
    }

    async init() {
        
        try {
            await this.initializeDatabase();
            await this.initializeComponents();
            this.setupEventListeners();
            await this.loadInitialData();
            
            console.log('✅ Guitar Control Panel initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Guitar Control Panel:', error);
            this.updateStatus('databaseStatus', 'error', 'Initialization failed');
        }
    }

    async initializeDatabase() {
        this.updateStatus('databaseStatus', 'warning', 'Loading database...');
        
        const dbInitialized = await ChordDB.initializeChordDatabase();
        if (dbInitialized) {
            const chordCount = await ChordDB.getChordCount();
            this.updateStatus('databaseStatus', 'success', `Database loaded (${chordCount} chords)`);
            console.log('✅ Chord database initialized');
        } else {
            this.updateStatus('databaseStatus', 'error', 'Database failed to load');
            throw new Error('Failed to initialize chord database');
        }
    }

    async initializeComponents() {
        // Initialize chord autocomplete
        this.chordAutocomplete = new ChordAutocomplete('chordSearchInput', 'chordSuggestions');
        
        // Initialize guitar tuning selector
        this.guitarTuningSelector = new GuitarTuningSelector();
    }

    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');
        // Event listeners are now handled by individual components
        console.log('✅ Event listeners set up');
    }

    async loadInitialData() {
        // Set initial tuning to standard
        await ChordDB.changeGuitarTuning('standard');
    }

    async getRandomChord() {
        try {
            const tuning = document.getElementById('guitarTuningSelect')?.value || 'standard';
            const randomChordData = await ChordDB.getRandomChord(tuning);
            
            if (randomChordData && this.chordAutocomplete) {
                // Set the random chord in the autocomplete input using the chord symbol
                this.chordAutocomplete.selectChord(randomChordData.chordName);
            }
        } catch (error) {
            console.error('❌ Error getting random chord:', error);
        }
    }

    updateStatus(elementId, status, text) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.className = `status-indicator status-${status}`;
        element.textContent = text;
    }
}

/**
 * Chord Autocomplete Class
 * Handles chord search with autocomplete suggestions using comprehensive chord database
 */
class ChordAutocomplete {
    constructor(inputId, suggestionsId) {
        this.input = document.getElementById(inputId);
        this.suggestionsContainer = document.getElementById(suggestionsId);
        this.currentHighlight = -1;
        this.chordList = []; // Will store {symbol, displayName} objects
        this.chordData = new Map(); // Will store symbol -> chord data mapping for caching
        this.userHasTyped = false;
        this.selectedChordSymbol = null;
        this.selectedChordObj = null;
        this.recentChords = []; // Store recent chord selections (max 3)
        
        if (this.input && this.suggestionsContainer) {
            this.init();
        }
    }

    async init() {
        await this.loadChordData();
        this.bindEvents();
        await this.setDefaultChord();
    }

    async loadChordData() {
        try {
            // Get all chord symbols and display names from database
            this.chordList = await ChordDB.getAllChordDisplayNames();
            
            console.log(`✅ Loaded ${this.chordList.length} chords for autocomplete`);
        } catch (error) {
            console.error('❌ Error loading chord data for autocomplete:', error);
            this.chordList = [
                { symbol: 'C', displayName: 'C Major' },
                { symbol: 'G', displayName: 'G Major' },
                { symbol: 'Am', displayName: 'A Minor' },
                { symbol: 'F', displayName: 'F Major' }
            ]; // Fallback
        }
    }

    async setDefaultChord() {
        try {
            // Get current guitar tuning from guitar instance
            let currentTuning = 'standard'; // fallback
            const guitarInstance = window.guitarInstance;
            
            if (guitarInstance && getCurrentTuningPreset) {
                currentTuning = getCurrentTuningPreset();
            } else {
                // Fallback to dropdown value if guitar instance method not available
                currentTuning = document.getElementById('guitarTuningSelect')?.value || 'standard';
            }
            
            // Use degree 1 (tonic) of current key signature with current tuning
            const defaultChordData = await ChordDB.getGuitarChordByDegree(1, null, currentTuning);
            
            if (this.input && defaultChordData) {
                this.input.value = defaultChordData.displayName;
                this.userHasTyped = false;
                this.selectedChordSymbol = defaultChordData.symbol;
                this.selectedChordObj = defaultChordData;
                this.chordData.set(defaultChordData.symbol, defaultChordData);
                
                // Add default chord to recent chords
                this.addToRecentChords(defaultChordData.symbol, defaultChordData);
                
                // Automatically set the default chord on the guitar
                if (guitarInstance && defaultChordData.frets && !defaultChordData.isFallback) {
                    guitarInstance.setChord(defaultChordData.frets);
                    console.log(`🎸 Set default chord: ${defaultChordData.displayName} (degree 1 in ${defaultChordData.keySignature}, ${currentTuning} tuning)`);
                } else if (defaultChordData.isFallback) {
                    console.warn(`⚠️ Default chord ${defaultChordData.symbol} not available in ${currentTuning} tuning`);
                }
                
                await this.createSelectedChordElements(defaultChordData);
            }
        } catch (error) {
            console.warn('Could not set default chord:', error);
            
            // Ultimate fallback - use basic C major
            try {
                const fallbackChord = await ChordDB.getChord('C');
                if (fallbackChord && this.input) {
                    this.input.value = fallbackChord.displayName;
                    this.selectedChordSymbol = 'C';
                    this.selectedChordObj = fallbackChord;
                    this.chordData.set('C', fallbackChord);
                    await this.createSelectedChordElements(fallbackChord);
                    console.log('🎸 Used fallback chord: C Major');
                }
            } catch (fallbackError) {
                console.error('Could not even set fallback chord:', fallbackError);
            }
        }
    }

    async createSelectedChordElements(chordObj) {
        if (!chordObj) return;
        await this.createSelectedChordButton(chordObj);
        await this.renderRecentChordButtons(); // Render recent buttons in same container
    }

    async createSelectedChordButton(chordObj) {
        const buttonContainer = document.getElementById('selected-chord-button-container');
        if (!buttonContainer) return;

        buttonContainer.innerHTML = '';

        // Get current tuning and best fingering for button
        const currentTuning = document.getElementById('guitarTuningSelect')?.value || 'standard';
        const bestFingering = await ChordDB.getBestFingering(this.selectedChordSymbol, currentTuning);
        
        const guitarInstance = window.guitarInstance;
        if (guitarInstance && bestFingering.frets) {
            // Create chord object in format expected by createChordButton
            const chordForButton = {
                displayName: chordObj.displayName,
                frets: bestFingering.frets,
                fingers: bestFingering.fingers
            };
            
            const button = createChordButton(chordForButton, guitarInstance);
            button.classList.add('selected-chord-button');
            button.type = 'button';
            
            // Note: Removed the extra event listeners since chord is set automatically on selection
            // The original createChordButton event listeners will handle strumming
            
            buttonContainer.appendChild(button);
        } else {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = chordObj.displayName;
            button.className = 'btn btn--primary selected-chord-button';
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Selected chord clicked:', chordObj.displayName);
            });
            buttonContainer.appendChild(button);
        }
    }

    async renderRecentChordButtons() {
        const buttonContainer = document.getElementById('selected-chord-button-container');
        if (!buttonContainer) return;

        // Get recent chords excluding the currently selected one
        const recentChordsToShow = this.recentChords.filter(chord => 
            chord.symbol !== this.selectedChordSymbol
        );

        if (recentChordsToShow.length === 0) {
            return; // Only show current selected chord
        }

        // Add recent chord buttons after the selected chord button
        for (const recentChord of recentChordsToShow) {
            await this.createRecentChordButton(recentChord, buttonContainer);
        }
    }

    addToRecentChords(chordSymbol, chordData) {
        // Check if chord already exists in recent list
        const existingIndex = this.recentChords.findIndex(chord => chord.symbol === chordSymbol);
        
        if (existingIndex >= 0) {
            // Don't move to front, just update the data if needed
            this.recentChords[existingIndex].data = chordData;
        } else {
            // Add new chord to front
            this.recentChords.unshift({
                symbol: chordSymbol,
                data: chordData
            });
            
            // Keep only the 7 most recent
            if (this.recentChords.length > 7) {
                this.recentChords.pop();
            }
        }
        
        console.log('Recent chords updated:', this.recentChords.map(c => c.symbol));
    }

    async renderRecentChords() {
        const container = document.getElementById('selected-chord-diagram-container');
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';

        if (this.recentChords.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No recent chords</div>';
            return;
        }

        // Create wrapper for recent chord buttons
        const recentWrapper = document.createElement('div');
        recentWrapper.className = 'recent-chords-wrapper';
        recentWrapper.style.cssText = `
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            justify-content: flex-start;
            padding: 10px 0;
        `;

        for (const recentChord of this.recentChords) {
            await this.createRecentChordButton(recentChord, recentWrapper);
        }

        container.appendChild(recentWrapper);
    }

    async createRecentChordButton(recentChord, container) {
        const currentTuning = document.getElementById('guitarTuningSelect')?.value || 'standard';
        const bestFingering = await ChordDB.getBestFingering(recentChord.symbol, currentTuning);
        
        const guitarInstance = window.guitarInstance;
        
        if (guitarInstance && bestFingering.frets && !bestFingering.isFallback) {
            // Create chord object in format expected by createChordButton
            const chordForButton = {
                displayName: recentChord.data.displayName,
                frets: bestFingering.frets,
                fingers: bestFingering.fingers
            };
            
            const button = createChordButton(chordForButton, guitarInstance);
            button.classList.add('recent-chord-button');
            button.type = 'button';
            
            // Don't add any extra click handlers - just let the original createChordButton handle strumming
            
            container.appendChild(button);
        } else {
            // Fallback button if no fingering available
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = recentChord.data.displayName;
            button.className = 'btn btn--compact palette-button recent-chord-button';
            button.style.opacity = '0.5';
            button.title = `No fingering available for ${currentTuning} tuning`;
            
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Clicked unavailable recent chord:', recentChord.data.displayName);
            });
            
            container.appendChild(button);
        }
    }

    async createSelectedChordDiagram(chordObj) {
        const diagramContainer = document.getElementById('selected-chord-diagram-container');
        if (!diagramContainer) return;

        diagramContainer.innerHTML = '';

        try {
            // Get current tuning and best fingering for diagram
            const currentTuning = document.getElementById('guitarTuningSelect')?.value || 'standard';
            const bestFingering = await ChordDB.getBestFingering(this.selectedChordSymbol, currentTuning);
            
            if (!bestFingering.frets) {
                diagramContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: #666;">
                    ${chordObj.displayName}<br>
                    <small>No fingering available for ${currentTuning} tuning</small>
                </div>`;
                return;
            }

            const renderer = new ChordDiagramRenderer(diagramContainer, {
                width: 200,
                height: 200,
                lite: true,
                showTuning: false
            });

            const chordData = {
                key: chordObj.displayName,
                positions: [{
                    frets: bestFingering.frets,
                    fingers: bestFingering.fingers || null,
                    baseFret: 1,
                    barres: [],
                    capo: false
                }]
            };

            renderer.renderChord(chordData, 0);
            
            diagramContainer.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Since chord is already set automatically, clicking diagram just provides feedback
                // or could trigger a strum if desired
                console.log('Chord diagram clicked:', chordObj.displayName);
                
                // Optional: Add strum on diagram click
                // const guitarInstance = window.guitarInstance;
                // if (guitarInstance) {
                //     guitarInstance.strum();
                // }
            });

            diagramContainer.style.cursor = 'pointer';
            diagramContainer.title = `Click to play ${chordObj.displayName}`;
        } catch (error) {
            console.warn('Could not create chord diagram:', error);
            diagramContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: #666;">
                ${chordObj.displayName}<br>
                <small>Diagram unavailable</small>
            </div>`;
        }
    }

    normalizeSearchText(text) {
        return text
            .toLowerCase()
            .replace(/sharp/g, '#')
            .replace(/flat/g, 'b')
            .replace(/\s+/g, '')
            .replace(/major/g, 'maj')
            .replace(/minor/g, 'm')
            .replace(/diminished/g, 'dim')
            .replace(/augmented/g, 'aug');
    }

    scoreChordMatch(chordInfo, originalQuery, normalizedQuery) {
        const { symbol, displayName } = chordInfo;
        const symbolLower = symbol.toLowerCase();
        const displayNameLower = displayName.toLowerCase();
        const symbolNormalized = this.normalizeSearchText(symbol);
        const displayNameNormalized = this.normalizeSearchText(displayName);
        
        // Check if query matches either symbol or display name
        const matchesSymbol = symbolLower.includes(originalQuery) || symbolNormalized.includes(normalizedQuery);
        const matchesDisplayName = displayNameLower.includes(originalQuery) || displayNameNormalized.includes(normalizedQuery);
        
        if (!matchesSymbol && !matchesDisplayName) {
            return 0;
        }
        
        // Exact matches get highest score
        if (symbolLower === originalQuery || displayNameLower === originalQuery || 
            symbolNormalized === normalizedQuery || displayNameNormalized === normalizedQuery) {
            return 1000;
        }
        
        // Symbol matches get priority over display name matches for short queries
        if (originalQuery.length <= 2) {
            if (symbolLower.startsWith(originalQuery) || symbolNormalized.startsWith(normalizedQuery)) {
                return 800;
            }
        }
        
        // Display name matches for longer queries
        if (displayNameLower.startsWith(originalQuery) || displayNameNormalized.startsWith(normalizedQuery)) {
            return 600;
        }
        
        // Symbol prefix matches
        if (symbolLower.startsWith(originalQuery) || symbolNormalized.startsWith(normalizedQuery)) {
            return 500;
        }
        
        // Early position matches in display name
        const displayNameIndex = displayNameLower.indexOf(originalQuery);
        if (displayNameIndex >= 0 && displayNameIndex <= 2) {
            return 400 - displayNameIndex;
        }
        
        // Early position matches in symbol
        const symbolIndex = symbolLower.indexOf(originalQuery);
        if (symbolIndex >= 0 && symbolIndex <= 2) {
            return 300 - symbolIndex;
        }
        
        // General matches (prioritize display name for longer queries)
        if (originalQuery.length > 2 && matchesDisplayName) {
            return 200;
        }
        
        if (matchesSymbol) {
            return 150;
        }
        
        if (matchesDisplayName) {
            return 100;
        }
        
        return 0;
    }

    async handleInput(value) {
        const query = value.trim().toLowerCase();
        
        if (query.length === 0) {
            this.hideSuggestions();
            return;
        }

        const normalizedQuery = this.normalizeSearchText(query);
        
        // Score and sort matches
        const scoredMatches = [];
        for (const chordInfo of this.chordList) {
            const score = this.scoreChordMatch(chordInfo, query, normalizedQuery);
            if (score > 0) {
                scoredMatches.push({ ...chordInfo, score });
            }
        }
        
        const sortedMatches = scoredMatches
            .sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                return a.displayName.localeCompare(b.displayName);
            })
            .slice(0, 10);

        this.showSuggestions(sortedMatches, query);
    }

    bindEvents() {
        const form = document.getElementById('chordForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
            });
        }

        if (this.input) {
            this.input.addEventListener('click', (e) => {
                e.stopPropagation();
                this.input.select();
            });

            this.input.addEventListener('input', (e) => {
                e.stopPropagation();
                this.userHasTyped = true;
                this.handleInput(e.target.value);
            });

            this.input.addEventListener('keydown', (e) => {
                e.stopPropagation();
                this.handleKeydown(e);
            });

            this.input.addEventListener('focus', (e) => {
                e.stopPropagation();
                if (this.input.value.trim()) {
                    this.handleInput(this.input.value);
                }
            });
        }

        document.addEventListener('click', (e) => {
            if (this.input && this.suggestionsContainer && 
                !this.input.contains(e.target) && 
                !this.suggestionsContainer.contains(e.target)) {
                this.hideSuggestions();
            }
        });
    }

    showSuggestions(matches, query) {
        if (!this.suggestionsContainer) return;
        
        this.currentHighlight = -1;
        
        if (matches.length === 0) {
            this.suggestionsContainer.innerHTML = '<div class="no-results">No matching chords found</div>';
        } else {
            this.suggestionsContainer.innerHTML = matches
                .map((match, index) => 
                    `<div class="chord-suggestion" data-index="${index}" data-symbol="${match.symbol}">
                        ${this.highlightMatch(match.displayName, query)}
                    </div>`
                ).join('');

            this.suggestionsContainer.querySelectorAll('.chord-suggestion').forEach(suggestion => {
                suggestion.addEventListener('click', () => {
                    this.selectChord(suggestion.dataset.symbol);
                });
            });
        }

        this.suggestionsContainer.style.display = 'block';
    }

    highlightMatch(displayName, query) {
        // Simply return the display name without any highlighting markup
        return displayName;
    }

    handleKeydown(e) {
        if (!this.suggestionsContainer) return;
        
        const suggestions = this.suggestionsContainer.querySelectorAll('.chord-suggestion');
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.currentHighlight = Math.min(this.currentHighlight + 1, suggestions.length - 1);
                this.updateHighlight(suggestions);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this.currentHighlight = Math.max(this.currentHighlight - 1, -1);
                this.updateHighlight(suggestions);
                break;
                
            case 'Enter':
                e.preventDefault();
                if (this.currentHighlight >= 0 && suggestions[this.currentHighlight]) {
                    this.selectChord(suggestions[this.currentHighlight].dataset.symbol);
                }
                break;
                
            case 'Escape':
                this.hideSuggestions();
                if (this.input) this.input.blur();
                break;
        }
    }

    updateHighlight(suggestions) {
        suggestions.forEach((suggestion, index) => {
            suggestion.classList.toggle('highlighted', index === this.currentHighlight);
        });
    }

    async selectChord(chordSymbol) {
        try {
            // Get chord data from database or cache
            let chordData = this.chordData.get(chordSymbol);
            if (!chordData) {
                chordData = await ChordDB.getChord(chordSymbol);
                if (chordData) {
                    this.chordData.set(chordSymbol, chordData);
                }
            }

            if (!chordData) {
                console.warn(`Could not load chord data for ${chordSymbol}`);
                return;
            }

            if (this.input) {
                this.input.value = chordData.displayName;
                this.userHasTyped = false;
                this.hideSuggestions();
            }
            
            this.selectedChordSymbol = chordSymbol;
            this.selectedChordObj = chordData;
            
            // Add to recent chords
            this.addToRecentChords(chordSymbol, chordData);
            
            // Get current tuning and best fingering
            const currentTuning = document.getElementById('guitarTuningSelect')?.value || 'standard';
            const bestFingering = await ChordDB.getBestFingering(chordSymbol, currentTuning);
            
            // Automatically set the chord on the guitar
            const guitarInstance = window.guitarInstance;
            if (guitarInstance && bestFingering.frets && !bestFingering.isFallback) {
                guitarInstance.setChord(bestFingering.frets);
                console.log(`🎸 Automatically set chord: ${chordData.displayName} in ${currentTuning} tuning`);
            } else if (bestFingering.isFallback) {
                console.warn(`⚠️ No fingering available for ${chordSymbol} in ${currentTuning} tuning`);
            }
            
            await this.createSelectedChordElements(chordData);
            
            if (this.input) {
                this.input.dispatchEvent(new CustomEvent('chordSelected', {
                    detail: { 
                        chordSymbol: chordSymbol,
                        chordName: chordData.displayName,
                        chordObject: chordData,
                        fingering: bestFingering
                    }
                }));
            }
            
            console.log('Selected chord:', chordData.displayName, 'Symbol:', chordSymbol);
        } catch (error) {
            console.error('Error selecting chord:', error);
        }
    }

    hideSuggestions() {
        if (this.suggestionsContainer) {
            this.suggestionsContainer.style.display = 'none';
            this.currentHighlight = -1;
        }
    }
}

/**
 * Guitar Tuning Selector Class
 * Handles guitar tuning selection and display
 */
class GuitarTuningSelector {
    constructor() {
        this.select = document.getElementById('guitarTuningSelect');
        
        if (this.select) {
            this.init();
        }
    }
    
    async init() {
        await this.loadTunings();
        this.bindEvents();
    }
    
    async loadTunings() {
        try {
            const presetTunings = getPresetTunings();
            
            if (this.select) {
                this.select.innerHTML = '';
                
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Select a tuning...';
                this.select.appendChild(defaultOption);
                
                Object.entries(presetTunings).forEach(([name, tuningData]) => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = `${this.formatTuningName(name)} (${tuningData.notes.join('-')})`;
                    this.select.appendChild(option);
                });
                
                this.setCurrentSelection();
            }
            
        } catch (error) {
            console.error('Error loading guitar tunings:', error);
            if (this.select) {
                this.select.innerHTML = '<option value="">Error loading tunings</option>';
            }
        }
    }
    
    formatTuningName(name) {
        return name
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
    
    setCurrentSelection() {
        try {
            const currentNotes = getCurrentTuningNotes();
            const presetTunings = getPresetTunings();
            
            for (const [name, tuningData] of Object.entries(presetTunings)) {
                if (this.arraysEqual(currentNotes, tuningData.notes)) {
                    if (this.select) this.select.value = name;
                    break;
                }
            }
        } catch (error) {
            console.warn('Could not determine current tuning selection:', error);
        }
    }
    
    arraysEqual(a, b) {
        return Array.isArray(a) && Array.isArray(b) && 
               a.length === b.length && 
               a.every((val, i) => val === b[i]);
    }
    
    bindEvents() {
        if (this.select) {
            this.select.addEventListener('change', (e) => {
                const selectedTuning = e.target.value;
                
                if (selectedTuning) {
                    this.changeTuning(selectedTuning);
                }
            });
        }
    }
    
    changeTuning(tuningName) {
        try {
            console.log(`🎸 Changing to ${tuningName} tuning...`);
            
            const success = setGuitarTuning(tuningName);
            
            if (success) {
                // Notify other components about tuning change
                document.dispatchEvent(new CustomEvent('guitarTuningChanged', {
                    detail: { 
                        tuningName: tuningName,
                        notes: getCurrentTuningNotes()
                    }
                }));
                
                // Update current chord diagram for new tuning
                this.updateCurrentChordForNewTuning(tuningName);
            } else {
                console.error('❌ Failed to change guitar tuning');
            }
            
        } catch (error) {
            console.error('Error changing guitar tuning:', error);
        }
    }
    
    async updateCurrentChordForNewTuning(tuningName) {
        // Get the chord autocomplete instance and update its diagram
        const controlPanel = window.guitarControlPanel;
        if (controlPanel?.chordAutocomplete?.selectedChordSymbol) {
            const chordSymbol = controlPanel.chordAutocomplete.selectedChordSymbol;
            const chordData = controlPanel.chordAutocomplete.selectedChordObj;
            
            console.log(`🔄 Updating chord ${chordSymbol} (${chordData.displayName}) for new tuning: ${tuningName}`);
            
            try {
                // Get the chord fingering for the new tuning using the chord symbol
                const bestFingering = await ChordDB.getBestFingering(chordSymbol, tuningName);
                
                if (bestFingering && bestFingering.frets) {
                    if (!bestFingering.isFallback) {
                        // Real fingering available - apply it to the guitar
                        const guitarInstance = window.guitarInstance;
                        if (guitarInstance) {
                            guitarInstance.setChord(bestFingering.frets);
                            console.log(`🎸 Applied new fingering for ${chordSymbol} in ${tuningName} tuning`);
                        }
                        
                        console.log(`✅ Successfully updated chord diagram for ${tuningName} tuning`);
                    } else {
                        // Only fallback available - keep current fingering but update UI to show unavailable
                        console.warn(`⚠️ No specific fingering for ${chordSymbol} in ${tuningName} tuning - keeping current fingering`);
                    }
                    
                    // Update the UI elements (including recent chords)
                    await controlPanel.chordAutocomplete.createSelectedChordElements(chordData);
                } else {
                    console.warn(`⚠️ No fingering data available for ${chordSymbol} in ${tuningName} tuning`);
                }
                
            } catch (error) {
                console.warn('Could not update chord for new tuning:', error);
            }
        }
    }
}

// Initialize the Guitar Control Panel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.guitarControlPanel = new GuitarControlPanel();
    
    // Listen for chord selection events
    document.getElementById('chordSearchInput')?.addEventListener('chordSelected', (e) => {
        console.log('Chord selected:', e.detail.chordName);
        console.log('Chord symbol:', e.detail.chordSymbol);
        console.log('Full chord object:', e.detail.chordObject);
    });
    
    // Listen for external tuning changes
    document.addEventListener('guitarTuningChanged', (e) => {
        console.log('🎸 Guitar tuning changed externally:', e.detail);
    });
});

// Export for debugging
window.guitarDebug = {
    changeTuning: ChordDB.changeGuitarTuning,
    getCurrentTuning: ChordDB.getCurrentGuitarTuning,
    getRandomChord: () => window.guitarControlPanel?.getRandomChord(),
    getAllChords: ChordDB.getAllChordNames,
    getAllChordDisplayNames: ChordDB.getAllChordDisplayNames,
    getChord: ChordDB.getChord,
    getRecentChords: () => window.guitarControlPanel?.chordAutocomplete?.recentChords,
    clearRecentChords: () => {
        if (window.guitarControlPanel?.chordAutocomplete) {
            window.guitarControlPanel.chordAutocomplete.recentChords = [];
            window.guitarControlPanel.chordAutocomplete.renderRecentChords();
        }
    }
};

console.log('🔧 Guitar Control Panel loaded. Debug functions available at window.guitarDebug');