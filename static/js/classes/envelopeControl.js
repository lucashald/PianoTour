export class EnvelopeControl {
    constructor(config = {}) {
        // Default ADSR values
        this.attack = config.attack || 0.01;
        this.decay = config.decay || 0.3;
        this.sustain = config.sustain || 0.8;
        this.release = config.release || 1.2;

        // ✅ NEW: Effects configuration
        this.effectsConfig = {
            reverb: config.reverb || { enabled: false, roomSize: 0.3, wet: 0.2 },
            delay: config.delay || { enabled: false, delayTime: 0.25, feedback: 0.3, wet: 0.2 },
            chorus: config.chorus || { enabled: false, frequency: 1.5, depth: 0.7, wet: 0.3 },
            compression: config.compression || { enabled: false, threshold: -20, ratio: 8, attack: 0.003, release: 0.1 },
            eq: config.eq || { enabled: false, low: 0, mid: 0, high: 0 },
            distortion: config.distortion || { enabled: false, distortion: 0.4, wet: 0.5 }
        };

        this.envelope = null;
        this.isConnected = false;
        this.connectedNodes = new Set();
        
        this.init();
    }
    
    init() {
        this.createAudioChain();
        console.log('Envelope created with ADSR:', {
            attack: this.attack,
            decay: this.decay, 
            sustain: this.sustain,
            release: this.release
        });
    }
    
    // ✅ NEW: Create envelope and effects chain
    createAudioChain() {
        if (window.Tone) {
            this.envelope = new Tone.AmplitudeEnvelope({
                attack: this.attack,
                decay: this.decay,
                sustain: this.sustain,
                release: this.release
            });

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
            console.log('🎛️ Audio chain created with effects');
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
        console.log(`🎛️ Reverb created: decay=${this.effectsConfig.reverb.roomSize * 10}s, wet=${this.effectsConfig.reverb.wet}`);
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
        this.effects.compressor = new Tone.Compressor({
            threshold: this.effectsConfig.compression.threshold,
            ratio: this.effectsConfig.compression.ratio,
            attack: this.effectsConfig.compression.attack,
            release: this.effectsConfig.compression.release
        });
        if (this.effectsConfig.compression.enabled) {
            this.effectsChain.push(this.effects.compressor);
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
        let currentNode = this.envelope;
        this.effectsChain.forEach(effect => {
            currentNode.connect(effect);
            currentNode = effect;
        });
        currentNode.toDestination();
        console.log(`🔗 Effects chain built: ${this.effectsChain.length} effects`);
    }

    // ✅ NEW: Enable/disable effects dynamically
    enableEffect(effectName, enabled = true) {
        if (!this.effectsConfig[effectName]) {
            console.warn(`Effect ${effectName} not found`);
            return;
        }
        this.effectsConfig[effectName].enabled = enabled;
        this.dispose();
        this.createAudioChain();
        console.log(`🎛️ Effect ${effectName} ${enabled ? 'enabled' : 'disabled'}`);
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
            
            if (effect[toneParam] !== undefined) {
                // Special handling for roomSize -> decay conversion
                let effectValue = value;
                if (parameter === 'roomSize') {
                    // Convert roomSize (0-1) to decay time (0-10 seconds)
                    effectValue = value * 10;
                    console.log(`🎛️ Converting roomSize ${value} to decay ${effectValue}`);
                }
                
                // Check if it's an AudioParam (has .value property)
                if (effect[toneParam] && typeof effect[toneParam] === 'object' && 'value' in effect[toneParam]) {
                    effect[toneParam].value = effectValue;
                    console.log(`🎛️ ${effectName} ${toneParam}.value set to ${effectValue}`);
                } else {
                    // Direct property assignment
                    effect[toneParam] = effectValue;
                    console.log(`🎛️ ${effectName} ${toneParam} set to ${effectValue}`);
                }
            } else {
                console.warn(`Parameter ${toneParam} not found on ${effectName} effect`);
            }
        }
    }

    // Connect an audio source to this envelope
    connect(audioNode) {
        if (audioNode && audioNode.connect) {
            audioNode.connect(this.envelope);
            // Envelope already connects through effects to destination
            this.connectedNodes.add(audioNode);
            console.log('🔗 Audio node connected to envelope with effects');
            return true;
        }
        return false;
    }
    
    // Trigger the envelope attack
    triggerAttack(time) {
        if (this.envelope) {
            this.envelope.triggerAttack(time);
        }
    }
    
    triggerRelease(time) {
        if (this.envelope) {
            const releaseTime = time !== undefined ? time : Tone.now();
            this.envelope.triggerRelease(releaseTime);
        }
    }
    
    // Update envelope parameters
    setAttack(value) {
        this.attack = value;
        if (this.envelope) {
            this.envelope.attack = value;
        }
    }
    
    setDecay(value) {
        this.decay = value;
        if (this.envelope) {
            this.envelope.decay = value;
        }
    }
    
    setSustain(value) {
        this.sustain = value;
        if (this.envelope) {
            this.envelope.sustain = value;
        }
    }
    
    setRelease(value) {
        this.release = value;
        if (this.envelope) {
            this.envelope.release = value;
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
    }

    // Cleanup for envelope and effects
    dispose() {
        if (this.envelope) {
            this.envelope.dispose();
            this.envelope = null;
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