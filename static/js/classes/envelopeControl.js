export class EnvelopeControl {
    constructor(config = {}) {
        // Default ADSR values
        this.attack = config.attack || 0.01;
        this.decay = config.decay || 0.3;
        this.sustain = config.sustain || 0.8;
        this.release = config.release || 1.2;
        
        this.envelope = null;
        this.isConnected = false;
        this.connectedNodes = new Set();
        
        this.init();
    }
    
    init() {
        this.createEnvelope();
        console.log('🎵 Envelope created with ADSR:', {
            attack: this.attack,
            decay: this.decay, 
            sustain: this.sustain,
            release: this.release
        });
    }
    
    createEnvelope() {
        if (window.Tone) {
            this.envelope = new Tone.AmplitudeEnvelope({
                attack: this.attack,
                decay: this.decay,
                sustain: this.sustain,
                release: this.release
            }).toDestination();
            
            this.isConnected = true;
        } else {
            console.warn('Tone.js not available yet');
        }
    }
    
    // Connect an audio source to this envelope
    connect(audioNode) {
        if (this.envelope && audioNode) {
            // Disconnect from destination first
            this.envelope.disconnect();
            
            // Connect: audioNode -> envelope -> destination
            audioNode.connect(this.envelope);
            this.envelope.toDestination();
            
            this.connectedNodes.add(audioNode);
            console.log('🔗 Audio node connected to envelope');
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
        // ✅ FIXED: Handle undefined time parameter
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
    
    // Get current settings
    getSettings() {
        return {
            attack: this.attack,
            decay: this.decay,
            sustain: this.sustain,
            release: this.release
        };
    }
    
    // Cleanup
    destroy() {
        if (this.envelope) {
            this.envelope.dispose();
            this.envelope = null;
        }
        this.connectedNodes.clear();
        this.isConnected = false;
    }
}