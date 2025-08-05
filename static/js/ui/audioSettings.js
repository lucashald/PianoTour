// audioSettings.js - Audio Settings Control Interface with Proper Audio Updates
import { pianoState } from '../core/appState.js';

class AudioSettingsController {
    constructor() {
        this.sliders = new Map();
        this.isInitialized = false;
        this.settingsPrefix = 'audio-settings-';
        this.isSyncing = false;
        
        this.waitForAudio();
    }

    async waitForAudio() {
        window.addEventListener('audioReady', () => {
            this.initializeControls();
        });

        if (pianoState.audioStatus === 'ready' && pianoState.envelope) {
            this.initializeControls();
        }
    }

    initializeControls() {
        if (this.isInitialized) return;
        
        console.log('🎛️ Initializing audio settings controls');
        
        this.initializeADSRControls();
        this.initializeReverbControls();
        this.initializeCompressionControls();
        this.initializeEQControls();
        this.initializePresetControls();
        
        this.syncWithAudioSettings();
        this.loadSavedSettings();
        this.updateAllDisplays();
        
        this.isInitialized = true;
        console.log('✅ Audio settings controls initialized');
    }

    syncWithAudioSettings() {
        if (!pianoState.envelope || this.isSyncing) return;
        
        this.isSyncing = true;
        console.log('🔄 Syncing sliders with current audio settings');
        
        try {
            const currentSettings = pianoState.envelope.getSettings();
            
            this.syncSliderValue('attack', currentSettings.attack);
            this.syncSliderValue('decay', currentSettings.decay);
            this.syncSliderValue('sustain', currentSettings.sustain);
            this.syncSliderValue('release', currentSettings.release);
            
            if (currentSettings.effects) {
                const effects = currentSettings.effects;
                
                // Parameter mapping for user-friendly names to Tone.js names
                const paramMap = {
                    reverbRoom: 'roomSize',
                    reverbWet: 'wet',
                    compThreshold: 'threshold',
                    compRatio: 'ratio',
                    compAttack: 'attack',
                    compRelease: 'release',
                    eqLow: 'low',
                    eqMid: 'mid',
                    eqHigh: 'high'
                };

                if (effects.reverb) {
                    this.syncSliderValue('reverbRoom', effects.reverb.roomSize);
                    this.syncSliderValue('reverbWet', effects.reverb.wet);
                }
                
                if (effects.compression) {
                    this.syncSliderValue('compThreshold', effects.compression.threshold);
                    this.syncSliderValue('compRatio', effects.compression.ratio);
                    this.syncSliderValue('compAttack', effects.compression.attack);
                    this.syncSliderValue('compRelease', effects.compression.release);
                }
                
                if (effects.eq) {
                    this.syncSliderValue('eqLow', effects.eq.low);
                    this.syncSliderValue('eqMid', effects.eq.mid);
                    this.syncSliderValue('eqHigh', effects.eq.high);
                }
            }
            
            console.log('✅ Sliders synced with audio settings');
        } catch (error) {
            console.error('Error syncing with audio settings:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    syncSliderValue(name, value) {
        const config = this.sliders.get(name);
        if (config && config.slider && value !== undefined) {
            config.slider.value = value;
            
            if (config.display) {
                const displayValue = config.formatDisplay ? config.formatDisplay(value) : value;
                config.display.textContent = displayValue;
            }
            
            this.updateSliderFill(config.slider, value);
        }
    }

    initializeADSRControls() {
        // Attack
        this.registerSlider('attack', {
            slider: document.getElementById('attackSlider'),
            display: document.getElementById('attackValue'),
            updateFn: (value) => {
                if (pianoState.envelope && !this.isSyncing) {
                    const val = parseFloat(value);
                    pianoState.envelope.setAttack(val);
                    console.log(`🎛️ Attack set to ${val}`);
                }
            },
            formatDisplay: (value) => parseFloat(value).toFixed(3),
            min: 0.001,
            max: 1,
            step: 0.001
        });

        // Decay
        this.registerSlider('decay', {
            slider: document.getElementById('decaySlider'),
            display: document.getElementById('decayValue'),
            updateFn: (value) => {
                if (pianoState.envelope && !this.isSyncing) {
                    const val = parseFloat(value);
                    pianoState.envelope.setDecay(val);
                    console.log(`🎛️ Decay set to ${val}`);
                }
            },
            formatDisplay: (value) => parseFloat(value).toFixed(2),
            min: 0.1,
            max: 2,
            step: 0.01
        });

        // Sustain
        this.registerSlider('sustain', {
            slider: document.getElementById('sustainSlider'),
            display: document.getElementById('sustainValue'),
            updateFn: (value) => {
                if (pianoState.envelope && !this.isSyncing) {
                    const val = parseFloat(value);
                    pianoState.envelope.setSustain(val);
                    console.log(`🎛️ Sustain set to ${val}`);
                }
            },
            formatDisplay: (value) => parseFloat(value).toFixed(2),
            min: 0,
            max: 1,
            step: 0.01
        });

        // Release
        this.registerSlider('release', {
            slider: document.getElementById('releaseSlider'),
            display: document.getElementById('releaseValue'),
            updateFn: (value) => {
                if (pianoState.envelope && !this.isSyncing) {
                    const val = parseFloat(value);
                    pianoState.envelope.setRelease(val);
                    console.log(`🎛️ Release set to ${val}`);
                }
            },
            formatDisplay: (value) => parseFloat(value).toFixed(2),
            min: 0.1,
            max: 3,
            step: 0.01
        });
    }

    initializeReverbControls() {
        // Reverb Room Size
        this.registerSlider('reverbRoom', {
            slider: document.getElementById('reverbRoomSlider'),
            display: document.getElementById('reverbRoomValue'),
            updateFn: (value) => {
                if (pianoState.envelope && !this.isSyncing) {
                    const val = parseFloat(value);
                    pianoState.envelope.setEffectParameter('reverb', 'roomSize', val);
                }
            },
            formatDisplay: (value) => parseFloat(value).toFixed(2),
            min: 0,
            max: 1,
            step: 0.01
        });

        // Reverb Wet
        this.registerSlider('reverbWet', {
            slider: document.getElementById('reverbWetSlider'),
            display: document.getElementById('reverbWetValue'),
            updateFn: (value) => {
                if (pianoState.envelope && !this.isSyncing) {
                    const val = parseFloat(value);
                    pianoState.envelope.setEffectParameter('reverb', 'wet', val);
                }
            },
            formatDisplay: (value) => parseFloat(value).toFixed(2),
            min: 0,
            max: 1,
            step: 0.01
        });
    }

    initializeCompressionControls() {
        // Compression Threshold
        this.registerSlider('compThreshold', {
            slider: document.getElementById('compThresholdSlider'),
            display: document.getElementById('compThresholdValue'),
            updateFn: (value) => {
                if (pianoState.envelope && !this.isSyncing) {
                    const val = parseFloat(value);
                    pianoState.envelope.setEffectParameter('compression', 'threshold', val);
                }
            },
            formatDisplay: (value) => `${parseFloat(value).toFixed(1)}dB`,
            min: -40,
            max: 0,
            step: 0.1
        });

        // Compression Ratio
        this.registerSlider('compRatio', {
            slider: document.getElementById('compRatioSlider'),
            display: document.getElementById('compRatioValue'),
            updateFn: (value) => {
                if (pianoState.envelope && !this.isSyncing) {
                    const val = parseFloat(value);
                    pianoState.envelope.setEffectParameter('compression', 'ratio', val);
                }
            },
            formatDisplay: (value) => `${parseFloat(value).toFixed(1)}:1`,
            min: 1,
            max: 20,
            step: 0.1
        });

        // Compression Attack
        this.registerSlider('compAttack', {
            slider: document.getElementById('compAttackSlider'),
            display: document.getElementById('compAttackValue'),
            updateFn: (value) => {
                if (pianoState.envelope && !this.isSyncing) {
                    const val = parseFloat(value);
                    pianoState.envelope.setEffectParameter('compression', 'attack', val);
                }
            },
            formatDisplay: (value) => `${parseFloat(value).toFixed(4)}s`,
            min: 0.001,
            max: 0.1,
            step: 0.0001
        });

        // Compression Release
        this.registerSlider('compRelease', {
            slider: document.getElementById('compReleaseSlider'),
            display: document.getElementById('compReleaseValue'),
            updateFn: (value) => {
                if (pianoState.envelope && !this.isSyncing) {
                    const val = parseFloat(value);
                    pianoState.envelope.setEffectParameter('compression', 'release', val);
                }
            },
            formatDisplay: (value) => `${parseFloat(value).toFixed(2)}s`,
            min: 0.01,
            max: 1,
            step: 0.01
        });
    }

    initializeEQControls() {
        // EQ Low
        this.registerSlider('eqLow', {
            slider: document.getElementById('eqLowSlider'),
            display: document.getElementById('eqLowValue'),
            updateFn: (value) => {
                if (pianoState.envelope && !this.isSyncing) {
                    const val = parseFloat(value);
                    pianoState.envelope.setEffectParameter('eq', 'low', val);
                }
            },
            formatDisplay: (value) => {
                const val = parseFloat(value);
                return `${val >= 0 ? '+' : ''}${val.toFixed(1)}dB`;
            },
            min: -12,
            max: 12,
            step: 0.1
        });

        // EQ Mid
        this.registerSlider('eqMid', {
            slider: document.getElementById('eqMidSlider'),
            display: document.getElementById('eqMidValue'),
            updateFn: (value) => {
                if (pianoState.envelope && !this.isSyncing) {
                    const val = parseFloat(value);
                    pianoState.envelope.setEffectParameter('eq', 'mid', val);
                }
            },
            formatDisplay: (value) => {
                const val = parseFloat(value);
                return `${val >= 0 ? '+' : ''}${val.toFixed(1)}dB`;
            },
            min: -12,
            max: 12,
            step: 0.1
        });

        // EQ High
        this.registerSlider('eqHigh', {
            slider: document.getElementById('eqHighSlider'),
            display: document.getElementById('eqHighValue'),
            updateFn: (value) => {
                if (pianoState.envelope && !this.isSyncing) {
                    const val = parseFloat(value);
                    pianoState.envelope.setEffectParameter('eq', 'high', val);
                }
            },
            formatDisplay: (value) => {
                const val = parseFloat(value);
                return `${val >= 0 ? '+' : ''}${val.toFixed(1)}dB`;
            },
            min: -12,
            max: 12,
            step: 0.1
        });
    }

    initializePresetControls() {
        // Reset button
        const resetButton = document.getElementById('resetButton');
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                this.resetToDefaults();
            });
        }

        // Preset buttons
        const concertHallButton = document.getElementById('concertHallButton');
        if (concertHallButton) {
            concertHallButton.addEventListener('click', () => {
                this.applyPreset('concertHall');
            });
        }

        const studioButton = document.getElementById('studioButton');
        if (studioButton) {
            studioButton.addEventListener('click', () => {
                this.applyPreset('studio');
            });
        }

        const jazzClubButton = document.getElementById('jazzClubButton');
        if (jazzClubButton) {
            jazzClubButton.addEventListener('click', () => {
                this.applyPreset('jazzClub');
            });
        }

        const cathedralButton = document.getElementById('cathedralButton');
        if (cathedralButton) {
            cathedralButton.addEventListener('click', () => {
                this.applyPreset('cathedral');
            });
        }

        // Instrument selector
        const instrumentSelect = document.getElementById('instrumentSelect');
        if (instrumentSelect) {
            // Set current instrument
            if (pianoState.instrument) {
                instrumentSelect.value = pianoState.instrument;
            }

            instrumentSelect.addEventListener('change', (e) => {
                this.changeInstrument(e.target.value);
            });
        }
    }

    getAudioPresets() {
        return {
            concertHall: {
                name: 'Concert Hall',
                settings: {
                    attack: 0.02,
                    decay: 0.4,
                    sustain: 0.9,
                    release: 2.5,
                    reverbRoom: 0.8,
                    reverbWet: 0.4,
                    compThreshold: -20,
                    compRatio: 3,
                    compAttack: 0.005,
                    compRelease: 0.15,
                    eqLow: 1,
                    eqMid: 0,
                    eqHigh: 2
                }
            },
            studio: {
                name: 'Studio',
                settings: {
                    attack: 0.01,
                    decay: 0.2,
                    sustain: 0.8,
                    release: 1.0,
                    reverbRoom: 0.1,
                    reverbWet: 0.05,
                    compThreshold: -12,
                    compRatio: 8,
                    compAttack: 0.001,
                    compRelease: 0.05,
                    eqLow: 0,
                    eqMid: 1,
                    eqHigh: 1
                }
            },
            jazzClub: {
                name: 'Jazz Club',
                settings: {
                    attack: 0.03,
                    decay: 0.5,
                    sustain: 0.85,
                    release: 1.8,
                    reverbRoom: 0.4,
                    reverbWet: 0.25,
                    compThreshold: -18,
                    compRatio: 4,
                    compAttack: 0.003,
                    compRelease: 0.12,
                    eqLow: 2,
                    eqMid: -1,
                    eqHigh: -0.5
                }
            },
            cathedral: {
                name: 'Cathedral',
                settings: {
                    attack: 0.05,
                    decay: 0.8,
                    sustain: 0.95,
                    release: 4.0,
                    reverbRoom: 1.0,
                    reverbWet: 0.6,
                    compThreshold: -25,
                    compRatio: 2,
                    compAttack: 0.01,
                    compRelease: 0.3,
                    eqLow: -1,
                    eqMid: 0,
                    eqHigh: 3
                }
            }
        };
    }

    applyPreset(presetName) {
        const presets = this.getAudioPresets();
        const preset = presets[presetName];
        
        if (!preset) {
            console.error(`Preset ${presetName} not found`);
            return;
        }

        console.log(`🎛️ Applying ${preset.name} preset`);
        
        // Apply all settings from the preset
        Object.entries(preset.settings).forEach(([setting, value]) => {
            this.setSliderValue(setting, value);
        });
    }

    async changeInstrument(instrumentName) {
        if (!pianoState.sampler || !pianoState.envelope) {
            console.error('Audio system not ready for instrument change');
            return;
        }

        console.log(`🎵 Changing instrument to ${instrumentName}`);

        try {
            // Import the audioManager to access Instrument class
            const { Instrument } = await import('../core/audioManager.js');
            
            // Stop any currently playing notes
            if (pianoState.sampler) {
                pianoState.sampler.releaseAll();
            }

            // Update the piano state
            pianoState.instrument = instrumentName;

            // Create new envelope with instrument-specific settings
            const oldEnvelope = pianoState.envelope;
            pianoState.envelope = Instrument.createEnvelope(instrumentName);

            // Get new sample URLs
            const sampleUrls = Instrument.getSampleUrls(instrumentName);
            const baseUrl = Instrument.getBaseUrl(instrumentName);

            // Create new sampler
            const oldSampler = pianoState.sampler;
            pianoState.sampler = new Tone.Sampler({
                urls: sampleUrls,
                baseUrl: baseUrl,
                onload: () => {
                    console.log(`🎵 ${instrumentName} samples loaded successfully`);
                    // Connect new sampler to new envelope
                    pianoState.envelope.connect(pianoState.sampler);
                    
                    // Sync sliders with new instrument settings
                    this.syncWithAudioSettings();
                    
                    // Dispose old audio objects
                    setTimeout(() => {
                        if (oldEnvelope) oldEnvelope.dispose();
                        if (oldSampler) oldSampler.dispose();
                    }, 1000);
                },
                onerror: (error) => console.error("Sample loading error:", error)
            });

            // Show feedback
            this.showInstrumentChanged(Instrument.getDisplayName(instrumentName));

            // Dispatch event for other parts of the app
            window.dispatchEvent(new CustomEvent('instrumentChanged', {
                detail: { instrument: instrumentName }
            }));

        } catch (error) {
            console.error('Error changing instrument:', error);
        }
    }

    showPresetApplied(presetName) {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.textContent = `✅ ${presetName} preset applied`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--color-success, #28a745);
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.style.transform = 'translateY(0)', 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    showInstrumentChanged(instrumentName) {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.textContent = `🎵 Switched to ${instrumentName}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--color-primary, #007bff);
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
            transform: translateY(-20px);
            opacity: 0;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        }, 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    registerSlider(name, config) {
        if (!config.slider) {
            console.warn(`Slider element not found for ${name}`);
            return;
        }

        this.sliders.set(name, config);

        // Set up event listeners with immediate feedback
        config.slider.addEventListener('input', (e) => {
            const value = e.target.value;
            this.updateSlider(name, value, false);
        });

        config.slider.addEventListener('change', (e) => {
            const value = e.target.value;
            this.updateSlider(name, value, true);
        });

        // Initialize slider properties
        if (config.min !== undefined) config.slider.min = config.min;
        if (config.max !== undefined) config.slider.max = config.max;
        if (config.step !== undefined) config.slider.step = config.step;
    }

    updateSlider(name, value, shouldSave = true) {
        const config = this.sliders.get(name);
        if (!config) return;

        // Update the audio parameter immediately
        if (config.updateFn && !this.isSyncing) {
            try {
                config.updateFn(value);
            } catch (error) {
                console.error(`Error updating ${name}:`, error);
            }
        }

        // Update the display
        if (config.display) {
            const displayValue = config.formatDisplay ? config.formatDisplay(value) : value;
            config.display.textContent = displayValue;
        }

        // Update CSS custom property for slider fill
        this.updateSliderFill(config.slider, value);

        // Save to localStorage if requested
        if (shouldSave && !this.isSyncing) {
            this.saveSetting(name, value);
        }
    }

    updateSliderFill(slider, value) {
        if (!slider) return;
        
        const min = parseFloat(slider.min) || 0;
        const max = parseFloat(slider.max) || 100;
        const percent = ((parseFloat(value) - min) / (max - min)) * 100;
        
        slider.style.setProperty('--value-percent', `${percent}%`);
    }

    saveSetting(name, value) {
        try {
            localStorage.setItem(this.settingsPrefix + name, value.toString());
        } catch (error) {
            console.error(`Failed to save setting ${name}:`, error);
        }
    }

    loadSavedSettings() {
        this.sliders.forEach((config, name) => {
            try {
                const savedValue = localStorage.getItem(this.settingsPrefix + name);
                if (savedValue !== null && config.slider) {
                    config.slider.value = savedValue;
                    this.updateSlider(name, savedValue, false);
                }
            } catch (error) {
                console.error(`Failed to load setting ${name}:`, error);
            }
        });
    }

    updateAllDisplays() {
        this.sliders.forEach((config, name) => {
            if (config.slider) {
                const value = config.slider.value;
                this.updateSlider(name, value, false);
            }
        });
    }

    resetToDefaults() {
        if (!pianoState.envelope) {
            console.error('No envelope available for reset');
            return;
        }

        console.log('🔄 Resetting settings to instrument defaults');
        
        try {
            // Get the current instrument name
            const currentInstrument = pianoState.instrument || 'piano';
            
            // Get the default settings for this instrument from the Instrument class
            const defaultSettings = this.getInstrumentDefaults(currentInstrument);
            
            if (!defaultSettings) {
                console.error('Could not get default settings for instrument:', currentInstrument);
                return;
            }

            console.log('📋 Default settings:', defaultSettings);

            // Apply the default settings to the audio system
            this.applyDefaultSettings(defaultSettings);

            // Clear saved settings from localStorage
            this.clearSavedSettings();

            // Show feedback
            this.showResetApplied(currentInstrument);

        } catch (error) {
            console.error('Error resetting to defaults:', error);
        }
    }

    // NEW: Get instrument default settings
    getInstrumentDefaults(instrumentName) {
        // These are the default settings from your audioManager.js
        const instrumentDefaults = {
            piano: {
                attack: 0.01,
                decay: 0.3,
                sustain: 0.8,
                release: 1.2,
                reverbRoom: 0.2,
                reverbWet: 0.15,
                compThreshold: -18,
                compRatio: 4,
                compAttack: 0.003,
                compRelease: 0.1,
                eqLow: 1,
                eqMid: 0,
                eqHigh: -1
            },
            guitar: {
                attack: 0.02,
                decay: 0.5,
                sustain: 0.9,
                release: 2.0,
                reverbRoom: 0.4,
                reverbWet: 0.25,
                compThreshold: -16,
                compRatio: 6,
                compAttack: 0.003,
                compRelease: 0.1,
                eqLow: 0,
                eqMid: 0,
                eqHigh: 0
            },
            cello: {
                attack: 0.03,
                decay: 0.2,
                sustain: 0.95,
                release: 1.5,
                reverbRoom: 0.6,
                reverbWet: 0.3,
                compThreshold: -20,
                compRatio: 3,
                compAttack: 0.005,
                compRelease: 0.15,
                eqLow: 2,
                eqMid: 0,
                eqHigh: -1
            },
            sax: {
                attack: 0.03,
                decay: 0.2,
                sustain: 1.0,
                release: 0.8,
                reverbRoom: 0.3,
                reverbWet: 0.2,
                compThreshold: -15,
                compRatio: 5,
                compAttack: 0.004,
                compRelease: 0.12,
                eqLow: 0,
                eqMid: 1,
                eqHigh: 0
            }
        };

        return instrumentDefaults[instrumentName] || instrumentDefaults.piano;
    }

    // NEW: Apply default settings to audio system
    applyDefaultSettings(settings) {
        console.log('🎛️ Applying default settings to audio system');

        // Set each parameter one by one, which will update both the audio and sliders
        Object.entries(settings).forEach(([setting, value]) => {
            this.setSliderValue(setting, value);
            console.log(`  ${setting}: ${value}`);
        });
    }

    // NEW: Clear all saved settings
    clearSavedSettings() {
        console.log('🧹 Clearing saved settings from localStorage');
        this.sliders.forEach((config, name) => {
            try {
                localStorage.removeItem(this.settingsPrefix + name);
            } catch (error) {
                console.error(`Failed to clear setting ${name}:`, error);
            }
        });
    }

    // NEW: Show reset feedback
    showResetApplied(instrumentName) {
        const notification = document.createElement('div');
        notification.textContent = `🔄 Reset to ${instrumentName} defaults`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--color-warning, #ffc107);
            color: #212529;
            padding: 12px 16px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
            transform: translateY(-20px);
            opacity: 0;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        }, 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    debugEffects() {
        if (!pianoState.envelope?.effects) {
            console.log('❌ No effects found');
            return;
        }

        const effects = pianoState.envelope.effects;
        console.log('🔍 Current Effects State:');
        
        if (effects.reverb) {
            console.log(`  Reverb: decay=${effects.reverb.decay}, wet=${effects.reverb.wet.value}`);
        }
        if (effects.compressor) {
            console.log(`  Compressor: threshold=${effects.compressor.threshold.value}dB, ratio=${effects.compressor.ratio.value}`);
        }
        if (effects.eq) {
            console.log(`  EQ: low=${effects.eq.low.value}dB, mid=${effects.eq.mid.value}dB, high=${effects.eq.high.value}dB`);
        }
    }

    getCurrentSettings() {
        const settings = {};
        this.sliders.forEach((config, name) => {
            if (config.slider) {
                settings[name] = parseFloat(config.slider.value);
            }
        });
        return settings;
    }

    applySettings(settings) {
        Object.entries(settings).forEach(([name, value]) => {
            this.setSliderValue(name, value);
        });
    }

setSliderValue(name, value) {
    const config = this.sliders.get(name);
    if (config && config.slider) {
        // Set the slider value
        config.slider.value = value;
        
        // Update the audio parameter AND the display
        this.updateSlider(name, value, true);
        
        console.log(`🎛️ ${name} reset to ${value}`);
    }
}
}

// Create and export the controller instance
export const audioSettingsController = new AudioSettingsController();

// Make debug method globally available
window.debugAudioEffects = () => audioSettingsController.debugEffects();

export function resetAudioSettings() {
    audioSettingsController.resetToDefaults();
}

export function getCurrentAudioSettings() {
    return audioSettingsController.getCurrentSettings();
}

export function applyAudioSettings(settings) {
    audioSettingsController.applySettings(settings);
}

export function syncSettingsWithAudio() {
    audioSettingsController.syncWithAudioSettings();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Controller will auto-initialize when audio is ready
    });
}

export default audioSettingsController;