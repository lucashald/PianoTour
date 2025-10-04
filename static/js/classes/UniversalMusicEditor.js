// UniversalMusicEditor.js
// Interactive music editor that extends UniversalMusicRenderer with editing capabilities

import { UniversalMusicRenderer } from './UniversalMusicRenderer.js';

export class UniversalMusicEditor extends UniversalMusicRenderer {
    constructor(elementId, options = {}) {
        super(elementId, options);
        
        // Editor-specific state
        this.selectedNoteId = null;
        this.selectedMeasureIndex = 0;
        
        // Drag and drop state
        this.isDragging = false;
        this.draggedNote = null; // { measureIndex, clef, noteId, originalNoteData, vexflowIndex }
        this.dragStartPosition = null; // { x, y } in client coordinates
        this.originalNoteData = null;
        this.originalVexFlowNoteBBox = null;
        
        // Palette drag state
        this.isPaletteDrag = false;
        this.paletteDragType = null;
        this.selectedDuration = "q"; // Default duration for palette drops
        
        // Mouse interaction state for drag/click detection
        this.mouseDownInitialPos = null;
        this.mouseDownNoteTarget = null;
        this.hasMouseMovedSinceMousedown = false;
        this.isDraggingInitiated = false;
        
        // Constants
        this.dragThreshold = 5; // pixels
        
        // Callbacks
        this.onMeasureClick = null;
        this.onNoteClick = null;
        
        // Staff position calibration variables
        this.staffCalibrated = false;
        this.trebleStaffTop = null;
        this.trebleStaffBottom = null;
        this.bassStaffTop = null;
        this.bassStaffBottom = null;
        this.staffLineSpacing = null;
        
        // Instrument-specific staff positions
        this.staffPositions = this.getStaffPositionsForInstrument();
    }

/**
 * Returns staff position mappings based on instrument type
 */
getStaffPositionsForInstrument() {
    switch (this.instrumentType) {
        case 'piano':
            return {
                treble: [
                    { position: -2, note: "C6", type: "ledger" },
                    { position: -1.5, note: "B5", type: "ledger-space" },
                    { position: -1, note: "A5", type: "ledger" },
                    { position: -0.5, note: "G5", type: "ledger-space" },
                    { position: 0, note: "F5", type: "line" },
                    { position: 0.5, note: "E5", type: "space" },
                    { position: 1, note: "D5", type: "line" },
                    { position: 1.5, note: "C5", type: "space" },
                    { position: 2, note: "B4", type: "line" },
                    { position: 2.5, note: "A4", type: "space" },
                    { position: 3, note: "G4", type: "line" },
                    { position: 3.5, note: "F4", type: "space" },
                    { position: 4, note: "E4", type: "line" },
                    { position: 4.5, note: "D4", type: "space" },
                    { position: 5, note: "C4", type: "ledger" },
                    { position: 5.5, note: "B3", type: "ledger-space" },
                    { position: 6, note: "A3", type: "ledger" },
                ],
                bass: [
                    { position: -2, note: "C4", type: "ledger" },
                    { position: -1.5, note: "B3", type: "ledger-space" },
                    { position: -1, note: "A3", type: "ledger" },
                    { position: -0.5, note: "G3", type: "ledger-space" },
                    { position: 0, note: "A3", type: "line" },
                    { position: 0.5, note: "G3", type: "space" },
                    { position: 1, note: "F3", type: "line" },
                    { position: 1.5, note: "E3", type: "space" },
                    { position: 2, note: "D3", type: "line" },
                    { position: 2.5, note: "C3", type: "space" },
                    { position: 3, note: "B2", type: "line" },
                    { position: 3.5, note: "A2", type: "space" },
                    { position: 4, note: "G2", type: "line" },
                    { position: 4.5, note: "F2", type: "space" },
                    { position: 5, note: "E2", type: "ledger" },
                    { position: 5.5, note: "D2", type: "ledger-space" },
                    { position: 6, note: "C2", type: "ledger" },
                ]
            };
        case 'guitar':
            return {
                treble: [
                    { position: -1, note: "A5", type: "ledger" },
                    { position: -0.5, note: "G5", type: "ledger-space" },
                    { position: 0, note: "F5", type: "line" },
                    { position: 0.5, note: "E5", type: "space" },
                    { position: 1, note: "D5", type: "line" },
                    { position: 1.5, note: "C5", type: "space" },
                    { position: 2, note: "B4", type: "line" },
                    { position: 2.5, note: "A4", type: "space" },
                    { position: 3, note: "G4", type: "line" },
                    { position: 3.5, note: "F4", type: "space" },
                    { position: 4, note: "E4", type: "line" },
                    { position: 4.5, note: "D4", type: "space" },
                    { position: 5, note: "C4", type: "ledger" },
                ]
            };
        case 'drums':
            // For drums, use simplified mapping
            return {
                percussion: [
                    { position: 0, note: "snare", type: "line" },
                    { position: 1, note: "hi-hat", type: "line" },
                    { position: 2, note: "kick", type: "line" },
                    { position: 3, note: "crash", type: "line" },
                    { position: 4, note: "ride", type: "line" },
                ]
            };
        default:
            return { treble: [] };
    }
}

    /**
     * Calibrates staff positions after rendering
     */
    calibrateStaffPositions() {
        console.log(`UniversalMusicEditor: Calibrating staff positions for ${this.instrumentType}`);
        
        if (!this.vexflowStaveMap || this.vexflowStaveMap.length === 0) {
            console.warn('UniversalMusicEditor: No staves available for calibration');
            return;
        }

        const firstMeasureStaves = this.vexflowStaveMap[0];
        
        switch (this.instrumentType) {
            case 'piano':
                if (firstMeasureStaves.treble) {
                    this.trebleStaffTop = firstMeasureStaves.treble.getYForLine(0);
                    this.trebleStaffBottom = firstMeasureStaves.treble.getYForLine(4);
                }
                if (firstMeasureStaves.bass) {
                    this.bassStaffTop = firstMeasureStaves.bass.getYForLine(0);
                    this.bassStaffBottom = firstMeasureStaves.bass.getYForLine(4);
                }
                break;
            case 'guitar':
                if (firstMeasureStaves.standard) {
                    this.trebleStaffTop = firstMeasureStaves.standard.getYForLine(0);
                    this.trebleStaffBottom = firstMeasureStaves.standard.getYForLine(4);
                }
                break;
            case 'drums':
                if (firstMeasureStaves) {
                    this.trebleStaffTop = firstMeasureStaves.getYForLine(0);
                    this.trebleStaffBottom = firstMeasureStaves.getYForLine(4);
                }
                break;
        }

        if (this.trebleStaffTop && this.trebleStaffBottom) {
            this.staffLineSpacing = (this.trebleStaffBottom - this.trebleStaffTop) / 4;
            this.staffCalibrated = true;
            console.log(`UniversalMusicEditor: Staff calibration complete. Line spacing: ${this.staffLineSpacing}`);
        }
    }

/**
 * Override render to capture VexFlow data for interaction
 */
render(measuresData, options = {}) {
    // Store measures data for note detection
    this.measuresData = measuresData;
    
    // Call parent render method
    super.render(measuresData, options);
    
    // FIX: Ensure VexFlow data is captured with proper timing
    setTimeout(() => {
        this.calibrateStaffPositions();
        this.captureVexFlowData();
        console.log('UniversalMusicEditor: VexFlow data ready for interaction');
    }, 250); // Increased timeout to ensure rendering is complete
}

    /**
     * Capture VexFlow data from parent renderer for interaction
     */
    captureVexFlowData() {
        // Log what data we have available
        console.log('UniversalMusicEditor: VexFlow data captured:', {
            noteMapLength: this.vexflowNoteMap?.length || 0,
            indexMapSize: Object.keys(this.vexflowIndexByNoteId || {}).length,
            staveMapLength: this.vexflowStaveMap?.length || 0,
            measurePositions: this.measureXPositions?.length || 0,
            sampleIndexMapping: Object.keys(this.vexflowIndexByNoteId || {}).slice(0, 3),
            sampleNoteMap: this.vexflowNoteMap?.[0] ? Object.keys(this.vexflowNoteMap[0]) : []
        });
        
        // Check if we have actual VexFlow notes to interact with
        if (this.vexflowNoteMap?.[0]) {
            console.log('UniversalMusicEditor: First measure note map:', this.vexflowNoteMap[0]);
        }
    }

    /**
     * Get measures data (for note detection)
     */
    getMeasuresData() {
        return this.measuresData || [];
    }

    /**
     * Enables score interaction with mouse events
     */
    enableScoreInteraction(onMeasureClick, onNoteClick) {
        console.log("UniversalMusicEditor: Enabling score interaction");
        
        this.onMeasureClick = onMeasureClick;
        this.onNoteClick = onNoteClick;
        
        const scoreElement = document.getElementById(this.elementId);
        if (!scoreElement) {
            console.error(`UniversalMusicEditor: Score element #${this.elementId} not found`);
            return;
        }

        // Remove existing listeners
        this.removeEventListeners();
        
        // Add event listeners
        this.addEventListeners(scoreElement);
    }

    /**
     * Add event listeners to score element
     */
    addEventListeners(scoreElement) {
        // Store bound methods for removal later
        this.boundMouseDown = this.handleMouseDown.bind(this);
        this.boundMouseMove = this.handleMouseMove.bind(this);
        this.boundMouseUp = this.handleMouseUp.bind(this);
        this.boundDragOver = this.handleDragOver.bind(this);
        this.boundDrop = this.handleDrop.bind(this);

        scoreElement.addEventListener('mousedown', this.boundMouseDown);
        scoreElement.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('mouseup', this.boundMouseUp);
        scoreElement.addEventListener('dragover', this.boundDragOver);
        scoreElement.addEventListener('drop', this.boundDrop);
    }

    /**
     * Remove event listeners
     */
    removeEventListeners() {
        const scoreElement = document.getElementById(this.elementId);
        if (!scoreElement) return;

        if (this.boundMouseDown) {
            scoreElement.removeEventListener('mousedown', this.boundMouseDown);
            scoreElement.removeEventListener('mousemove', this.boundMouseMove);
            document.removeEventListener('mouseup', this.boundMouseUp);
            scoreElement.removeEventListener('dragover', this.boundDragOver);
            scoreElement.removeEventListener('drop', this.boundDrop);
        }
    }

    /**
 * Handle mouse down events
 */
handleMouseDown(event) {
    if (event.button !== 0 || this.isPaletteDrag) return; // Only left-click
    event.preventDefault();

    // FIX: Get coordinates relative to the score element
    const scoreElement = document.getElementById(this.elementId);
    const rect = scoreElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    console.log(`UniversalMusicEditor: Mouse down at (${x}, ${y})`);

    // Reset state
    this.mouseDownInitialPos = { x, y };
    this.mouseDownNoteTarget = this.detectNoteClick(x, y);
    this.hasMouseMovedSinceMousedown = false;
    this.isDragging = false;
    this.isDraggingInitiated = false;

    if (this.mouseDownNoteTarget) {
        console.log('UniversalMusicEditor: Mouse down on target:', this.mouseDownNoteTarget);
    }
}

/**
 * Handle mouse move events
 */
handleMouseMove(event) {
    if (!this.mouseDownInitialPos && !this.isPaletteDrag) return;

    if (this.isDraggingInitiated || this.isPaletteDrag) {
        event.preventDefault();
    }

    // FIX: Get coordinates relative to the score element
    const scoreElement = document.getElementById(this.elementId);
    const rect = scoreElement.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    // Check for drag initiation
    if (this.mouseDownInitialPos && !this.isPaletteDrag && !this.isDraggingInitiated) {
        const distance = Math.sqrt(
            Math.pow(currentX - this.mouseDownInitialPos.x, 2) +
            Math.pow(currentY - this.mouseDownInitialPos.y, 2)
        );

        if (distance > this.dragThreshold && 
            this.mouseDownNoteTarget && 
            this.mouseDownNoteTarget.noteId !== null) {
            
            this.hasMouseMovedSinceMousedown = true;
            this.isDraggingInitiated = true;
            this.isDragging = true;
            this.startDrag(this.mouseDownNoteTarget, this.mouseDownInitialPos);
            scoreElement.style.cursor = 'none';
            console.log('UniversalMusicEditor: Drag initiated');
        }
    }

    // Visual feedback during drag
    if (this.isPaletteDrag || (this.isDraggingInitiated && this.draggedNote)) {
        const clef = this.detectClefRegion(currentY);
        const nearest = this.findNearestStaffPosition(currentY, clef);
        if (nearest) {
            this.updateDragPreview(currentX, nearest.y, nearest.note);
        }
    }
}

    /**
     * Handle mouse up events
     */
    handleMouseUp(event) {
        if (!this.mouseDownInitialPos || this.isPaletteDrag) return;

        const scoreElement = document.getElementById(this.elementId);
        const scoreRect = scoreElement.getBoundingClientRect();
        const isOnScore = (
            event.clientX >= scoreRect.left &&
            event.clientX <= scoreRect.right &&
            event.clientY >= scoreRect.top &&
            event.clientY <= scoreRect.bottom
        );

        if (isOnScore && this.isDraggingInitiated) {
            // Complete drag operation
            const endX = event.clientX - scoreRect.left;
            const endY = event.clientY - scoreRect.top;
            console.log('UniversalMusicEditor: Completing drag operation');
            this.completeDrag(endX, endY);
        } else if (isOnScore && !this.hasMouseMovedSinceMousedown) {
            // Handle click
            const endX = event.clientX - scoreRect.left;
            const endY = event.clientY - scoreRect.top;
            
            if (this.mouseDownNoteTarget && this.mouseDownNoteTarget.noteId !== null) {
                console.log('UniversalMusicEditor: Note click detected');
                if (this.onNoteClick) {
                    this.onNoteClick(
                        this.mouseDownNoteTarget.measureIndex,
                        this.mouseDownNoteTarget.clef,
                        this.mouseDownNoteTarget.noteId
                    );
                }
            } else {
                console.log('UniversalMusicEditor: Measure click detected');
                const measureIndex = this.detectMeasureClick(endX, endY);
                if (measureIndex !== -1 && this.onMeasureClick) {
                    this.onMeasureClick(measureIndex, false);
                }
            }
        } else if (!isOnScore && this.isDraggingInitiated) {
            console.log('UniversalMusicEditor: Drag canceled - mouse released outside score');
        }

        // Reset state
        this.resetInteractionState();
    }

    /**
     * Handle drag over events
     */
    handleDragOver(event) {
        event.preventDefault(); // Allow drop
    }

    /**
     * Handle drop events
     */
    handleDrop(event) {
        event.preventDefault();
        if (this.isPaletteDrag) {
            const rect = event.target.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            this.handlePaletteDrop(x, y);
            this.resetPaletteDragState();
        }
    }

    /**
     * Reset interaction state
     */
    resetInteractionState() {
        this.mouseDownInitialPos = null;
        this.mouseDownNoteTarget = null;
        this.hasMouseMovedSinceMousedown = false;
        this.isDragging = false;
        this.isDraggingInitiated = false;
        this.draggedNote = null;
        
        const scoreElement = document.getElementById(this.elementId);
        if (scoreElement) {
            scoreElement.style.cursor = 'default';
        }
        
        this.clearDragPreview();
    }

    /**
     * Reset palette drag state
     */
    resetPaletteDragState() {
        this.isPaletteDrag = false;
        this.paletteDragType = null;
        
        const scoreElement = document.getElementById(this.elementId);
        if (scoreElement) {
            scoreElement.style.cursor = 'default';
        }
        
        this.clearDragPreview();
    }

    /**
     * Detect note click at coordinates
     */
/**
 * Detect note click at coordinates
 */
detectNoteClick(x, y) {
    console.log(`UniversalMusicEditor: Detecting note click at (${x}, ${y})`);

    // Check if we have the necessary data
    if (!this.vexflowNoteMap || !this.vexflowIndexByNoteId) {
        console.warn('UniversalMusicEditor: VexFlow data not available for note detection');
        return this.detectMeasureClick(x, y) !== -1 ? {
            measureIndex: this.detectMeasureClick(x, y),
            clef: this.detectClefRegion(y),
            noteId: null,
            originalNoteData: null,
            vexflowIndex: -1
        } : null;
    }

    // Get measures data to cross-reference
    const measuresData = this.getMeasuresData();
    
    for (let measureIndex = 0; measureIndex < measuresData.length; measureIndex++) {
        const currentMeasureData = measuresData[measureIndex] || [];

        for (let i = 0; i < currentMeasureData.length; i++) {
            const noteData = currentMeasureData[i];
            const clef = noteData.clef;
            const noteId = noteData.id;

            // FIX: Get the VexFlow index object from the mapping
            const indexInfo = this.vexflowIndexByNoteId[noteId];

            if (indexInfo && 
                this.vexflowNoteMap[measureIndex]?.[clef]?.[indexInfo.index]) {
                
                const vexflowNote = this.vexflowNoteMap[measureIndex][clef][indexInfo.index];
                
                try {
                    const bbox = vexflowNote.getBoundingBox();

                    if (bbox &&
                        x >= bbox.x &&
                        x <= bbox.x + bbox.w &&
                        y >= bbox.y &&
                        y <= bbox.y + bbox.h) {
                        
                        console.log('UniversalMusicEditor: Note found:', {
                            measureIndex,
                            clef,
                            noteId,
                            vexflowIndex: indexInfo.index,
                            bbox: bbox
                        });
                        
                        return {
                            measureIndex: measureIndex,
                            clef: clef,
                            noteId: noteId,
                            originalNoteData: noteData,
                            vexflowIndex: indexInfo.index
                        };
                    }
                } catch (error) {
                    console.warn('UniversalMusicEditor: Error getting bounding box for note:', error);
                }
            }
        }
    }

    // No note found, check for measure background
    const clickedMeasureIndex = this.detectMeasureClick(x, y);
    if (clickedMeasureIndex !== -1) {
        const clefRegion = this.detectClefRegion(y);
        console.log(`UniversalMusicEditor: Measure background clicked: ${clickedMeasureIndex}, ${clefRegion}`);
        
        return {
            measureIndex: clickedMeasureIndex,
            clef: clefRegion,
            noteId: null,
            originalNoteData: null,
            vexflowIndex: -1
        };
    }

    console.log('UniversalMusicEditor: No note or measure found at coordinates');
    return null;
}
    /**
     * Detect measure click at coordinates
     */
    detectMeasureClick(x, y) {
        if (!this.measureXPositions || this.measureXPositions.length === 0) {
            return -1;
        }

        // Check vertical bounds
        if (!this.isWithinVerticalBounds(y)) {
            return -1;
        }

        // Check horizontal bounds
        for (let i = 0; i < this.measureXPositions.length; i++) {
            const measureStartX = this.measureXPositions[i];
            if (x >= measureStartX && x <= measureStartX + this.measureWidth) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Check if Y coordinate is within valid vertical bounds
     */
    isWithinVerticalBounds(y) {
        if (!this.staffCalibrated) {
            return y >= 0 && y <= 300; // Fallback bounds
        }

        const topMargin = 50;
        const bottomMargin = 50;
        const scoreTopY = this.trebleStaffTop || 0;
        const scoreBottomY = this.bassStaffBottom || this.trebleStaffBottom || 300;

        return y >= scoreTopY - topMargin && y <= scoreBottomY + bottomMargin;
    }

    /**
     * Detect clef region based on Y coordinate
     */
    detectClefRegion(y) {
        switch (this.instrumentType) {
            case 'piano':
                if (!this.staffCalibrated) {
                    return y < 150 ? 'treble' : 'bass'; // Fallback
                }
                const gapMidpoint = this.trebleStaffBottom + 
                    (this.bassStaffTop - this.trebleStaffBottom) / 2;
                return y < gapMidpoint ? 'treble' : 'bass';
            
            case 'guitar':
                if (this.showTablature) {
                    return y < 120 ? 'treble' : 'tab';
                }
                return 'treble';
            
            case 'drums':
                return 'percussion';
            
            default:
                return 'treble';
        }
    }

/**
 * Find nearest staff position for given Y coordinate
 */
findNearestStaffPosition(y, clef) {
    const positions = this.staffPositions[clef];
    if (!positions) {
        console.warn(`UniversalMusicEditor: No staff positions for clef ${clef}`);
        return null;
    }

    // Get the appropriate stave for calculation
    let stave = null;
    if (this.vexflowStaveMap && this.vexflowStaveMap.length > 0) {
        const firstMeasureStaves = this.vexflowStaveMap[0];
        switch (this.instrumentType) {
            case 'piano':
                stave = firstMeasureStaves[clef];
                break;
            case 'guitar':
                stave = clef === 'treble' ? firstMeasureStaves.standard : firstMeasureStaves.tab;
                break;
            case 'drums':
                stave = firstMeasureStaves;
                break;
        }
    }

    if (!stave) {
        console.warn(`UniversalMusicEditor: No stave found for clef ${clef}`);
        return null;
    }

    let nearest = null;
    let minDistance = Infinity;

    for (const pos of positions) {
        // FIX: Handle fractional positions properly
        let posY;
        if (pos.position % 1 === 0) {
            // Integer position - use getYForLine
            posY = stave.getYForLine(Math.abs(pos.position));
            // Adjust for negative positions (above staff)
            if (pos.position < 0) {
                const staffTop = stave.getYForLine(0);
                const lineSpacing = (stave.getYForLine(1) - stave.getYForLine(0));
                posY = staffTop + (pos.position * lineSpacing);
            }
        } else {
            // Fractional position - interpolate between lines
            const baseLine = Math.floor(Math.abs(pos.position));
            const fraction = Math.abs(pos.position) % 1;
            const staffTop = stave.getYForLine(0);
            const lineSpacing = (stave.getYForLine(1) - stave.getYForLine(0));
            
            if (pos.position < 0) {
                posY = staffTop + (pos.position * lineSpacing);
            } else {
                const baseY = stave.getYForLine(baseLine);
                const nextY = stave.getYForLine(baseLine + 1);
                posY = baseY + (fraction * (nextY - baseY));
            }
        }

        const distance = Math.abs(y - posY);

        if (distance < minDistance) {
            minDistance = distance;
            nearest = {
                ...pos,
                y: posY
            };
        }
    }

    return nearest;
}

    /**
     * Start drag operation
     */
    startDrag(noteInfo, initialClickPos) {
        console.log('UniversalMusicEditor: Starting drag operation');
        this.draggedNote = noteInfo;
        this.dragStartPosition = initialClickPos;
        
        // Store original note data - this will need to be implemented
        // based on how the universal renderer stores note data
        this.originalNoteData = noteInfo.originalNoteData || {
            name: 'C4',
            clef: noteInfo.clef,
            duration: 'q',
            isRest: false
        };
    }

    /**
     * Complete drag operation
     */
    completeDrag(endX, endY) {
        console.log('UniversalMusicEditor: Completing drag operation');
        
        if (!this.draggedNote || !this.originalNoteData) {
            console.warn('UniversalMusicEditor: No drag data available');
            return;
        }

        const targetMeasureIndex = this.detectMeasureClick(endX, endY);
        if (targetMeasureIndex === -1) {
            console.log('UniversalMusicEditor: Dropped outside valid measure');
            return;
        }

        const newClef = this.detectClefRegion(endY);
        const nearest = this.findNearestStaffPosition(endY, newClef);
        
        if (!nearest) {
            console.warn('UniversalMusicEditor: Could not determine drop position');
            return;
        }

        // Dispatch note dropped event
        document.dispatchEvent(new CustomEvent('noteDropped', {
            detail: {
                fromMeasureIndex: this.draggedNote.measureIndex,
                fromNoteId: this.draggedNote.noteId,
                toMeasureIndex: targetMeasureIndex,
                insertBeforeNoteId: null, // Will need to implement insertion position detection
                clefChanged: newClef !== this.originalNoteData.clef,
                pitchChanged: nearest.note !== this.originalNoteData.name,
                newClef: newClef,
                newPitch: nearest.note
            }
        }));
    }

    /**
     * Handle palette drop
     */
    handlePaletteDrop(x, y) {
        console.log('UniversalMusicEditor: Handling palette drop');
        
        const targetMeasureIndex = this.detectMeasureClick(x, y);
        if (targetMeasureIndex === -1) {
            console.log('UniversalMusicEditor: Palette dropped outside valid measure');
            return;
        }

        const clef = this.detectClefRegion(y);
        const nearest = this.findNearestStaffPosition(y, clef);
        
        if (!nearest) {
            console.warn('UniversalMusicEditor: Could not determine palette drop position');
            return;
        }

        // Dispatch palette drop event
        document.dispatchEvent(new CustomEvent('paletteDropped', {
            detail: {
                measureIndex: targetMeasureIndex,
                clef: clef,
                note: nearest.note,
                duration: this.selectedDuration,
                type: this.paletteDragType
            }
        }));
    }

    /**
     * Update drag preview
     */
    updateDragPreview(x, snapY, noteName) {
        if (!this.isDragging && !this.isPaletteDrag) {
            this.clearDragPreview();
            return;
        }

        let preview = document.getElementById(`${this.elementId}-drag-preview`);
        if (!preview) {
            preview = document.createElement('div');
            preview.id = `${this.elementId}-drag-preview`;
            preview.style.cssText = `
                position: absolute;
                pointer-events: none;
                z-index: 1000;
                transition: top 0.1s ease-out;
            `;
            document.getElementById(this.elementId).appendChild(preview);
        }

        const isOnLine = Math.abs(snapY % 10) < 1; // Approximate line detection

        if (isOnLine) {
            preview.innerHTML = `
                <div style="position: relative; width: 120px; height: 3px;">
                    <div style="
                        position: absolute;
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%);
                        background: rgba(255, 255, 255, 0.8);
                        border: 2px solid rgba(216, 131, 104, 0.9);
                        border-radius: 50%;
                        width: 20px;
                        height: 20px;
                        z-index: 1;
                    "></div>
                    <div style="
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 3px;
                        background: rgba(216, 131, 104, 0.9);
                        z-index: 2;
                    "></div>
                </div>
            `;
        } else {
            preview.innerHTML = `
                <div style="position: relative; width: 120px; height: 0px;">
                    <div style="
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 36px;
                        height: 0px;
                        border-top: 3px dashed rgba(41, 123, 81, 0.8);
                        z-index: 1;
                    "></div>
                    <div style="
                        position: absolute;
                        top: 0;
                        right: 0;
                        width: 36px;
                        height: 0px;
                        border-top: 3px dashed rgba(41, 123, 81, 0.8);
                        z-index: 1;
                    "></div>
                    <div style="
                        position: absolute;
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%);
                        background: rgba(255, 255, 255, 0.8);
                        border: 2px solid rgba(41, 123, 81, 0.8);
                        border-radius: 50%;
                        width: 20px;
                        height: 20px;
                        z-index: 2;
                    "></div>
                </div>
            `;
        }

        preview.style.left = `${x - 60}px`;
        preview.style.top = `${snapY - 1}px`;
        preview.style.display = 'block';
    }

    /**
     * Clear drag preview
     */
    clearDragPreview() {
        const preview = document.getElementById(`${this.elementId}-drag-preview`);
        if (preview) {
            preview.style.display = 'none';
        }
    }

    /**
     * Set palette drag state
     */
    setPaletteDragState(isDragging, type, duration) {
        this.isPaletteDrag = isDragging;
        this.paletteDragType = type;
        if (duration) {
            this.selectedDuration = duration;
        }
    }

    /**
     * Set selected note
     */
    setSelectedNote(noteId, measureIndex) {
        this.selectedNoteId = noteId;
        this.selectedMeasureIndex = measureIndex;
    }

    /**
     * Get selected note
     */
    getSelectedNote() {
        return {
            noteId: this.selectedNoteId,
            measureIndex: this.selectedMeasureIndex
        };
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedNoteId = null;
        this.selectedMeasureIndex = 0;
    }

    /**
     * Cleanup when editor is destroyed
     */
    destroy() {
        this.removeEventListeners();
        this.clearDragPreview();
        this.clearSelection();
    }
}