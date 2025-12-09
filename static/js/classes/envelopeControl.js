export class EnvelopeControl {
    constructor(config = {}) {
        // Default ADSR values
        this.attack = config.attack || 0.01;
        this.decay = config.decay || 0.3;
        this.sustain = config.sustain || 0.8;
        this.release = config.release || 1.2;

        // NEW: Effects configuration
        this.effectsConfig = {
            reverb: config.reverb || { enabled: false, roomSize: 0.3, wet: 0.2 },
            delay: config.delay || { enabled: false, delayTime: 0.25, feedback: 0.3, wet: 0.2 },
            chorus: config.chorus || { enabled: false, frequency: 1.5, depth: 0.7, wet: 0.3 },
            compression: config.compression || { enabled: false, threshold: -20, ratio: 8, attack: 0.003, release: 0.1 },
            eq: config.eq || { enabled: false, low: 0, mid: 0, high: 0 },
            distortion: config.distortion || { enabled: false, distortion: 0.4, wet: 0.5 }
        };

        this.input = null; // Replaces this.envelope as the entry point
        this.sampler = null; // Reference to the sampler for direct control
        this.isConnected = false;
        this.connectedNodes = new Set();
        
        this.init();
    }
    
    init() {
        this.createAudioChain();
        console.log('EnvelopeControl initialized with settings:', {
            attack: this.attack,
            decay: this.decay, 
            sustain: this.sustain,
            release: this.release
        });
    }
    
    // Bind the sampler to this control to enable per-note envelope updates
    bindSampler(sampler) {
        this.sampler = sampler;
        // Apply initial settings
        this.updateSamplerSettings();
        console.log('Sampler bound to EnvelopeControl');
    }

    updateSamplerSettings() {
        if (this.sampler) {
            // Tone.Sampler only supports Attack and Release curves for now
            // We map our ADSR values to the sampler's properties
            if (this.sampler.attack !== undefined) this.sampler.attack = this.attack;
            if (this.sampler.release !== undefined) this.sampler.release = this.release;
            
            // Note: Decay and Sustain are not directly supported by standard Tone.Sampler
            // but we keep the values for UI consistency or future custom implementation
        }
    }
    
    // Create audio chain (Input -> Effects -> Destination)
    createAudioChain() {
        if (window.Tone) {
            // We use a Gain node as the input point instead of a monophonic envelope
            // This allows polyphonic signals from the sampler to pass through without being gated
            this.input = new Tone.Gain(1);

            // Create effects objects and chain
            this.effects = {};
            this.effectsChain = [];

            this.createReverb();
            this.createDelay();
            this.createChorus();
            this.createCompression();
            this.createEQ();
            this.createDistortion();

            this.buildEffectsChain();

            this.isConnected = true;
        } else {
            console.warn('Tone.js not available yet');
        }
    }

    createReverb() {
        this.effects.reverb = new Tone.Reverb({
            decay: this.effectsConfig.reverb.roomSize * 10, // Convert roomSize to decay time
            wet: this.effectsConfig.reverb.wet
        });
        if (this.effectsConfig.reverb.enabled) {
            this.effectsChain.push(this.effects.reverb);
        }
        console.log(`Reverb created: decay=${this.effectsConfig.reverb.roomSize * 10}s, wet=${this.effectsConfig.reverb.wet}`);
    }

    createDelay() {
        this.effects.delay = new Tone.FeedbackDelay({
            delayTime: this.effectsConfig.delay.delayTime,
            feedback: this.effectsConfig.delay.feedback,
            wet: this.effectsConfig.delay.wet
        });
        if (this.effectsConfig.delay.enabled) {
            this.effectsChain.push(this.effects.delay);
        }
    }

    createChorus() {
        this.effects.chorus = new Tone.Chorus({
            frequency: this.effectsConfig.chorus.frequency,
            depth: this.effectsConfig.chorus.depth,
            wet: this.effectsConfig.chorus.wet
        });
        if (this.effectsConfig.chorus.enabled) {
            this.effectsChain.push(this.effects.chorus);
        }
    }

    createCompression() {
        this.effects.compression = new Tone.Compressor({
            threshold: this.effectsConfig.compression.threshold,
            ratio: this.effectsConfig.compression.ratio,
            attack: this.effectsConfig.compression.attack,
            release: this.effectsConfig.compression.release
        });
        if (this.effectsConfig.compression.enabled) {
            this.effectsChain.push(this.effects.compression);
        }
    }

    createEQ() {
        this.effects.eq = new Tone.EQ3({
            low: this.effectsConfig.eq.low,
            mid: this.effectsConfig.eq.mid,
            high: this.effectsConfig.eq.high
        });
        if (this.effectsConfig.eq.enabled) {
            this.effectsChain.push(this.effects.eq);
        }
    }

    createDistortion() {
        this.effects.distortion = new Tone.Distortion({
            distortion: this.effectsConfig.distortion.distortion,
            wet: this.effectsConfig.distortion.wet
        });
        if (this.effectsConfig.distortion.enabled) {
            this.effectsChain.push(this.effects.distortion);
        }
    }

    buildEffectsChain() {
        let currentNode = this.input;
        this.effectsChain.forEach(effect => {
            currentNode.connect(effect);
            currentNode = effect;
        });
        currentNode.toDestination();
    }

    /**
     * Returns the final output node after all effects have been applied.
     * This is used for spectrum visualization and other audio analysis.
     * @returns {Tone.AudioNode} The last node in the effects chain, or the input if no effects
     */
    getFinalOutput() {
        if (this.effectsChain.length > 0) {
            return this.effectsChain[this.effectsChain.length - 1];
        }
        return this.input;
    }

    // Enable/disable effects dynamically
    enableEffect(effectName, enabled = true) {
        if (!this.effectsConfig[effectName]) {
            console.warn(`Effect ${effectName} not found`);
            return;
        }
        this.effectsConfig[effectName].enabled = enabled;
        this.dispose();
        this.createAudioChain();
        // Re-bind sampler if it exists, though connection is handled by audioManager/playbackHelpers
        console.log(`Effect ${effectName} ${enabled ? 'enabled' : 'disabled'}`);
    }

    setEffectParameter(effectName, parameter, value) {
        if (!this.effectsConfig[effectName]) {
            console.warn(`Effect ${effectName} not found`);
            return;
        }
        
        // Update the config
        this.effectsConfig[effectName][parameter] = value;
        
        // Update the actual Tone.js effect parameter
        if (this.effects[effectName]) {
            const effect = this.effects[effectName];
            
            // Parameter mapping for user-friendly names to Tone.js names
            const parameterMap = {
                // Reverb mappings
                'roomSize': 'decay',  // roomSize maps to decay
                'wet': 'wet',
                // Compression mappings
                'threshold': 'threshold',
                'ratio': 'ratio',
                'attack': 'attack',
                'release': 'release',
                // EQ mappings
                'low': 'low',
                'mid': 'mid',
                'high': 'high'
            };
            
            // Get the actual Tone.js parameter name
            const toneParam = parameterMap[parameter] || parameter;
            
            // Special handling for roomSize -> decay conversion
            let effectValue = value;
            if (parameter === 'roomSize') {
                // Convert roomSize (0-1) to decay time (0-10 seconds)
                effectValue = value * 10;
                console.log(`Converting roomSize ${value} to decay ${effectValue}`);
            }

            if (effect[toneParam] !== undefined) {
                // Check if it's an AudioParam (has .value property) - simplified check
                if (effect[toneParam] && effect[toneParam].value !== undefined) {
                    try {
                        // Use rampTo to smooth transition if available, otherwise set value
                        if (effect[toneParam].rampTo) {
                            effect[toneParam].rampTo(effectValue, 0.1);
                        } else {
                            effect[toneParam].value = effectValue;
                        }
                        console.log(`${effectName} ${toneParam}.value set to ${effectValue}`);
                    } catch (e) {
                        // Fallback
                        effect[toneParam].value = effectValue;
                    }
                } else {
                    // Direct property assignment
                    effect[toneParam] = effectValue;
                    console.log(`${effectName} ${toneParam} set to ${effectValue}`);
                }
            } else {
                console.warn(`Parameter ${toneParam} not found on ${effectName} effect`);
            }
        }
    }

    // Connect an audio source to this input chain
    connect(audioNode) {
        if (audioNode && audioNode.connect) {
            audioNode.connect(this.input);
            this.connectedNodes.add(audioNode);
            return true;
        }
        return false;
    }
    
    // Trigger methods are now handled by the Sampler directly for polyphony
    triggerAttack(time) {
        // No-op: Sampler handles per-voice attack
    }
    
    triggerRelease(time) {
        // No-op: Sampler handles per-voice release
    }
    
    // Update envelope parameters
    setAttack(value) {
        this.attack = value;
        if (this.sampler && this.sampler.attack !== undefined) {
            this.sampler.attack = value;
        }
    }
    
    setDecay(value) {
        this.decay = value;
        // Sampler doesn't support decay natively, stored for future use
    }
    
    setSustain(value) {
        this.sustain = value;
        // Sampler doesn't support sustain level natively, stored for future use
    }
    
    setRelease(value) {
        this.release = value;
        if (this.sampler && this.sampler.release !== undefined) {
            this.sampler.release = value;
        }
    }
    
    // Set all ADSR values at once
    setADSR(attack, decay, sustain, release) {
        this.setAttack(attack);
        this.setDecay(decay);
        this.setSustain(sustain);
        this.setRelease(release);
    }
    
    // Update getSettings to include effects config
    getSettings() {
        return {
            attack: this.attack,
            decay: this.decay,
            sustain: this.sustain,
            release: this.release,
            effects: this.effectsConfig
        };
    }
    
    // Cleanup
    destroy() {
        this.dispose();
        this.connectedNodes.clear();
        this.isConnected = false;
        this.sampler = null;
    }

    // Cleanup for input and effects
    dispose() {
        if (this.input) {
            this.input.dispose();
            this.input = null;
        }
        if (this.effects) {
            Object.values(this.effects).forEach(effect => {
                if (effect && effect.dispose) effect.dispose();
            });
            this.effects = {};
        }
        this.effectsChain = [];
    }
}
