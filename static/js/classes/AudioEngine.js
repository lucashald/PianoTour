// AudioEngine.js - Generic audio engine for any instrument

import {
  connectSpectrumToAudio,
  initializeSpectrum,
  startSpectrumVisualization,
  stopSpectrumVisualization
} from '../ui/spectrum.js';
import { EnvelopeControl } from './EnvelopeControl.js';
import { InstrumentPresetManager } from './InstrumentPresetManager.js';



/**
 * Main audio engine class - handles audio initialization, management, and playback
 */
export class AudioEngine {
    // Audio status constants
    static get STATUS() {
        return {
            UNINITIALIZED: 'uninitialized',
            LOADING: 'loading',
            READY: 'ready',
            ERROR: 'error'
        };
    }

    constructor(config = {}) {
        // Configuration
        this.instrumentId = config.instrumentId || 'default';
        this.storagePrefix = config.storagePrefix || 'audio-engine';
        this.volumeKey = `${this.storagePrefix}-volume`;
        this.unlockKey = `${this.storagePrefix}-unlocked`;

        // Core state
        this.status = AudioEngine.STATUS.UNINITIALIZED;
        this.currentInstrument = config.defaultInstrument || 'piano';
        this.sampler = null;
        this.envelope = null;
        this.lastError = null;

        // Managers
        this.presetManager = new InstrumentPresetManager();
        
        // Action management
        this._deferredAction = null;
        this._eventListeners = new Map();

        // Spectrum visualization
        this._spectrumInitialized = false;
        this._spectrumActive = false;
        this._spectrumOptions = {
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
            ...config.spectrumOptions
        };

        // Initialize
        this._initialize();
    }

    // ===================================================================
    // Public API - Status and Control
    // ===================================================================

    get isReady() {
        return this.status === AudioEngine.STATUS.READY;
    }

    get isLoading() {
        return this.status === AudioEngine.STATUS.LOADING;
    }

    get hasError() {
        return this.status === AudioEngine.STATUS.ERROR;
    }

    getCurrentInstrument() {
        return this.currentInstrument;
    }

    getAvailableInstruments() {
        return this.presetManager.getAvailableInstruments();
    }

    /**
     * Initialize or switch to a different instrument
     */
    async setInstrument(instrumentName) {
        if (!this.presetManager.getPreset(instrumentName)) {
            throw new Error(`Unknown instrument: ${instrumentName}`);
        }

        console.log(`🎵 Switching to ${instrumentName}`);
        
        // Stop any currently playing notes
        if (this.sampler && this.sampler.releaseAll) {
            this.sampler.releaseAll();
        }

        const oldInstrument = this.currentInstrument;
        this.currentInstrument = instrumentName;

        if (this.isReady) {
            await this._reinitializeAudio();
            this._emitEvent('instrumentChanged', { 
                oldInstrument, 
                newInstrument: instrumentName 
            });
        }

        return instrumentName;
    }

    /**
     * Main method to unlock audio and execute an action
     */
    async unlockAndExecute(action, replaceExisting = true) {
        console.log(`🔓 UnlockAndExecute called, current status: ${this.status}`);

        // Try to resume context if needed
        if (window.Tone && Tone.context && Tone.context.state !== 'running') {
            console.log(`Attempting to resume AudioContext. Current state: ${Tone.context.state}`);
            try {
                await Tone.context.resume();
                console.log(`AudioContext resumed. New state: ${Tone.context.state}`);
            } catch (e) {
                console.warn("Failed to resume AudioContext during unlock:", e);
            }
        }

        // Execute immediately if ready
        if (this.isReady) {
            console.log('✅ Audio already ready, executing action immediately');
            try {
                action();
                return true;
            } catch (error) {
                console.error('Error executing immediate action:', error);
                return false;
            }
        }

        // Store deferred action
        if (replaceExisting || !this._deferredAction) {
            this._deferredAction = action;
            console.log(replaceExisting ? '📝 Deferred action replaced' : '📝 Deferred action stored');
        } else {
            console.log('⚠️ Deferred action ignored - one already pending');
            return false;
        }

        // Wait if currently loading
        if (this.isLoading) {
            console.log('⏳ Audio currently loading, action deferred');
            return this._waitForReady();
        }

        // Start initialization
        console.log('🚀 Starting audio initialization with deferred action');
        const success = await this._initializeAudio();

        if (!success) {
            this._deferredAction = null;
        }

        return success;
    }

    /**
     * Trigger a note on
     */
    triggerAttack(note, time, velocity = 1) {
        if (!this.isReady || !this.sampler) return false;

        try {
            this.sampler.triggerAttack(note, time, velocity);
            if (this.envelope) {
                this.envelope.triggerAttack(time);
            }
            this.startSpectrum();
            return true;
        } catch (error) {
            console.error('Error triggering attack:', error);
            return false;
        }
    }

    /**
     * Trigger a note off
     */
    triggerRelease(note, time) {
        if (!this.isReady || !this.sampler) return false;

        try {
            this.sampler.triggerRelease(note, time);
            if (this.envelope) {
                this.envelope.triggerRelease(time);
            }
            return true;
        } catch (error) {
            console.error('Error triggering release:', error);
            return false;
        }
    }

    /**
     * Release all currently playing notes
     */
    releaseAll() {
        if (this.sampler && this.sampler.releaseAll) {
            this.sampler.releaseAll();
        }
    }

    // ===================================================================
    // Spectrum Visualization
    // ===================================================================

    startSpectrum() {
        if (this._spectrumInitialized && !this._spectrumActive) {
            startSpectrumVisualization();
            this._spectrumActive = true;
            console.log("🌈 Spectrum visualization started");
        }
    }

    stopSpectrum() {
        if (this._spectrumActive) {
            stopSpectrumVisualization();
            this._spectrumActive = false;
            console.log("🌈 Spectrum visualization stopped");
        }
    }

    // ===================================================================
    // Volume Control
    // ===================================================================

    setVolume(percent) {
        if (!window.Tone) return false;

        const dbValue = this._percentToDb(percent);
        Tone.Destination.volume.value = dbValue;
        
        // Save to localStorage
        try {
            localStorage.setItem(this.volumeKey, percent.toString());
        } catch (error) {
            console.warn('Failed to save volume setting:', error);
        }

        console.log(`🔊 Volume set to: ${percent}% (${dbValue.toFixed(1)} dB)`);
        this._emitEvent('volumeChanged', { percent, db: dbValue });
        return true;
    }

    getVolume() {
        try {
            const saved = localStorage.getItem(this.volumeKey);
            return saved ? parseFloat(saved) : 75; // Default 75%
        } catch (error) {
            return 75;
        }
    }

    // ===================================================================
    // Event System
    // ===================================================================

    addEventListener(event, callback) {
        if (!this._eventListeners.has(event)) {
            this._eventListeners.set(event, []);
        }
        this._eventListeners.get(event).push(callback);
    }

    removeEventListener(event, callback) {
        if (this._eventListeners.has(event)) {
            const callbacks = this._eventListeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    // ===================================================================
    // Cleanup
    // ===================================================================

    dispose() {
        console.log('🧹 Disposing AudioEngine');
        
        this.stopSpectrum();
        
        if (this.sampler) {
            this.sampler.dispose();
            this.sampler = null;
        }
        
        if (this.envelope) {
            this.envelope.dispose();
            this.envelope = null;
        }
        
        this._eventListeners.clear();
        this._deferredAction = null;
        this.status = AudioEngine.STATUS.UNINITIALIZED;
    }

    // ===================================================================
    // Private Methods - Initialization
    // ===================================================================

    _initialize() {
        // Set up volume control on initialization
        this._initializeVolumeControl();
    }

    async _initializeAudio() {
        let timeoutId;
        try {
            this._setStatus(AudioEngine.STATUS.LOADING);
            console.log("🎵 Starting audio initialization");

            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error("Audio initialization timed out after 15 seconds"));
                }, 15000);
            });

            await Promise.race([
                this._performInitialization(),
                timeoutPromise
            ]);

            // Success
            clearTimeout(timeoutId);
            this._setStatus(AudioEngine.STATUS.READY);
            this._processDeferredAction();
            this._emitEvent('ready');

            return true;

        } catch (error) {
            console.error("❌ Audio initialization failed:", error);
            clearTimeout(timeoutId);
            this.lastError = error;
            this._setStatus(AudioEngine.STATUS.ERROR);
            this._deferredAction = null;
            this._emitEvent('error', { error });
            return false;
        }
    }

    async _performInitialization() {
        // Stage 1: Unlock audio
        await this._attemptAudioUnlock();

        // Stage 2: Initialize Tone.js
        await this._initializeTone();

        // Stage 3: Create instrument-specific audio chain
        await this._createAudioChain();

        // Stage 4: Initialize spectrum
        this._initializeSpectrum();

        // Stage 5: Validate
        await this._validateAudioSystem();
    }

    async _reinitializeAudio() {
        if (!this.isReady) return;

        console.log('🔄 Reinitializing audio for instrument change');
        
        // Dispose old audio objects
        if (this.sampler) {
            this.sampler.dispose();
        }
        if (this.envelope) {
            this.envelope.dispose();
        }

        // Create new audio chain
        await this._createAudioChain();
        
        // Reconnect spectrum if needed
        if (this._spectrumInitialized && this.envelope) {
            connectSpectrumToAudio(this.envelope.envelope);
        }
    }

    async _createAudioChain() {
        console.log(`🎛️ Creating audio chain for ${this.currentInstrument}`);

        // Create envelope with instrument-specific settings
        const envelopeSettings = this.presetManager.getEnvelopeSettings(this.currentInstrument);
        this.envelope = new EnvelopeControl(envelopeSettings);

        // Get sample configuration
        const sampleUrls = this.presetManager.getSampleUrls(this.currentInstrument);
        const baseUrl = this.presetManager.getBaseUrl(this.currentInstrument);

        // Create sampler
        this.sampler = new Tone.Sampler({
            urls: sampleUrls,
            baseUrl: baseUrl,
            onload: () => console.log(`✅ ${this.currentInstrument} samples loaded`),
            onerror: (error) => console.error("❌ Sample loading error:", error)
        });

        // Connect audio chain: sampler -> envelope -> destination
        this.envelope.connect(this.sampler);

        // Wait for samples to load
        await Tone.loaded();
        
        console.log('🔗 Audio chain created successfully');
    }

    // ===================================================================
    // Private Methods - Audio Unlock
    // ===================================================================

    async _attemptAudioUnlock() {
        const strategies = [
            this._unlockWithHtmlAudio.bind(this),
            this._unlockWithWebAudio.bind(this)
        ];

        for (const strategy of strategies) {
            if (await strategy()) {
                this._markAsUnlocked();
                return;
            }
        }

        console.warn("⚠️ All unlock strategies failed, proceeding with Tone.start()");
    }

    async _unlockWithHtmlAudio() {
        const unlockAudio = document.getElementById("unlock-audio");
        if (!unlockAudio) return false;

        try {
            await unlockAudio.play();
            console.log("✅ HTML audio unlock successful");
            return true;
        } catch (e) {
            console.warn("HTML audio unlock failed:", e.name);
            return false;
        }
    }

    async _unlockWithWebAudio() {
        try {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            if (context.state === 'suspended') {
                await context.resume();
            }
            
            const buffer = context.createBuffer(1, 1, 22050);
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            source.start(0);
            
            setTimeout(() => context.close(), 500);
            console.log("✅ Web Audio unlock successful");
            return true;
        } catch (e) {
            console.warn("Web Audio unlock failed:", e.name);
            return false;
        }
    }

    async _initializeTone(maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await Tone.start();
                console.log(`✅ Tone.js started on attempt ${attempt}`);

                if (Tone.context.state === 'interrupted') {
                    console.log("Context interrupted, resuming...");
                    await Tone.context.resume();
                }

                if (Tone.context.state !== 'running') {
                    throw new Error(`Context in unexpected state: ${Tone.context.state}`);
                }

                return;

            } catch (error) {
                console.warn(`Tone.js attempt ${attempt}/${maxRetries} failed:`, error);
                if (attempt === maxRetries) {
                    throw new Error("Failed to start Tone.js after retries");
                }
                await new Promise(resolve => setTimeout(resolve, 300 * attempt));
            }
        }
    }

    async _validateAudioSystem() {
        if (Tone.context.state !== 'running') {
            throw new Error("Audio context not running");
        }
        if (!this.sampler) {
            throw new Error("No sampler created");
        }
        if (!this.envelope) {
            throw new Error("No envelope created");
        }
        console.log("✅ Audio system validation passed");
    }

    // ===================================================================
    // Private Methods - Spectrum
    // ===================================================================

    _initializeSpectrum() {
        try {
            const container = document.getElementById("spectrum");
            if (!container) {
                console.log("No spectrum container found");
                return;
            }

            initializeSpectrum(this._spectrumOptions);
            this._spectrumInitialized = true;

            if (this.envelope) {
                connectSpectrumToAudio(this.envelope.envelope);
                console.log("🌈 Spectrum connected to envelope");
            }
        } catch (error) {
            console.error("Spectrum initialization failed:", error);
            this._spectrumInitialized = false;
        }
    }

    // ===================================================================
    // Private Methods - Volume
    // ===================================================================

    _initializeVolumeControl() {
        const volumeSlider = document.getElementById('volumeSlider');
        if (!volumeSlider) return;

        // Restore saved volume
        const savedVolume = this.getVolume();
        volumeSlider.value = savedVolume;
        
        // Set initial volume when Tone is available
        if (window.Tone) {
            this.setVolume(savedVolume);
        }

        // Handle volume changes
        volumeSlider.addEventListener('input', (e) => {
            this.setVolume(parseFloat(e.target.value));
        });
    }

    _percentToDb(percent) {
        if (percent === 0) return -Infinity;
        return (percent / 100) * 20 - 20; // Maps 100% to 0dB, 1% to -19.8dB
    }

    // ===================================================================
    // Private Methods - Utilities
    // ===================================================================

    _setStatus(newStatus) {
        const oldStatus = this.status;
        this.status = newStatus;
        console.log(`🎵 Audio status: ${oldStatus} → ${newStatus}`);
        this._emitEvent('statusChanged', { oldStatus, newStatus });
    }

    _emitEvent(eventName, data = {}) {
        const callbacks = this._eventListeners.get(eventName) || [];
        callbacks.forEach(callback => {
            try {
                callback({ ...data, engine: this });
            } catch (error) {
                console.error(`Error in ${eventName} callback:`, error);
            }
        });

        // Also emit as DOM event for backward compatibility
        window.dispatchEvent(new CustomEvent(`audioEngine.${eventName}`, {
            detail: { ...data, engine: this }
        }));
    }

    _processDeferredAction() {
        if (this._deferredAction) {
            console.log('▶️ Processing deferred action');
            const action = this._deferredAction;
            this._deferredAction = null;

            try {
                action();
            } catch (error) {
                console.error('Error executing deferred action:', error);
            }
        }
    }

    _waitForReady() {
        return new Promise((resolve) => {
            const checkReady = setInterval(() => {
                if (this.status === AudioEngine.STATUS.READY) {
                    clearInterval(checkReady);
                    resolve(true);
                } else if (this.status === AudioEngine.STATUS.ERROR) {
                    clearInterval(checkReady);
                    this._deferredAction = null;
                    resolve(false);
                }
            }, 50);
        });
    }

    _markAsUnlocked() {
        try {
            localStorage.setItem(this.unlockKey, 'true');
            localStorage.setItem(`${this.unlockKey}_timestamp`, Date.now().toString());
        } catch (error) {
            console.warn('Failed to save unlock status:', error);
        }
    }
}

// ===================================================================
// Exports
// ===================================================================

export default AudioEngine;

// For backward compatibility, export a singleton instance
export const defaultAudioEngine = new AudioEngine({
    instrumentId: 'main',
    storagePrefix: 'piano-tour'
});