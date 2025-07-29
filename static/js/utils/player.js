// Minimal SpessaSynth Piano Tour Player
// Stripped down to essentials: just load SpessaSynth and connect to HTML

class PianoTourPlayer {
    constructor() {
        this.synth = null;
        this.sequencer = null;
        this.audioContext = null;
        this.soundFontBuffer = null;
        this.isReady = false;

        // Start minimal initialization
        this.initialize();
    }

    async initialize() {
        console.log('🎹 Initializing minimal Piano Tour player...');

        // Wait for SpessaSynth libraries
        await this.waitForLibraries();

        // Connect to existing HTML elements
        this.connectToHTML();

        // Preload soundfont in background
        this.preloadSoundFont();

        this.isReady = true;
        console.log('✅ Piano Tour player ready');
    }

async waitForLibraries() {
    return new Promise((resolve) => {
        const checkLibraries = () => {
            if (window.SpessaSynth || window.manager) {
                console.log('✅ SpessaSynth libraries found');
                
                // ADD THIS: Disable looping by default
                if (window.manager && window.manager.seq) {
                    window.manager.seq.loop = false;
                    console.log('🔁 Looping disabled by default');
                }
                
                resolve();
            } else {
                setTimeout(checkLibraries, 100);
            }
        };
        checkLibraries();
    });
}

    connectToHTML() {
        // Connect to existing file input
        const fileInput = document.getElementById('midi_file_input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    this.loadMidiFile(e.target.files[0]);
                }
            });
        }

        // Connect to existing upload button
        const uploadButton = document.getElementById('file_upload');
        if (uploadButton) {
            uploadButton.addEventListener('click', () => {
                fileInput?.click();
            });
        }

        // Simple drag and drop
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                this.loadMidiFile(e.dataTransfer.files[0]);
            }
        });

        // Space bar for play/pause
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                this.togglePlayback();
            }
        });

        console.log('✅ Connected to HTML elements');
    }

    async preloadSoundFont() {
        try {
            const response = await fetch('/static/soundfonts/default.sf3');
            if (response.ok) {
                this.soundFontBuffer = await response.arrayBuffer();
                console.log('✅ SoundFont preloaded');
            }
        } catch (error) {
            console.log('⚠️ SoundFont preload failed, will use default');
            this.soundFontBuffer = null;
        }
    }

    async ensureAudioReady() {
        if (this.audioContext && this.synth) {
            return true;
        }

        try {
            // Create AudioContext (requires user interaction)
            if (!this.audioContext) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContext({ sampleRate: 44100 });

                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
                console.log('✅ AudioContext created');
            }

            // Create synthesizer
            if (!this.synth) {
                // Use existing SpessaSynth manager if available
                if (window.manager && window.manager.synth) {
                    this.synth = window.manager.synth;
                    console.log('✅ Using existing SpessaSynth');
                } else if (window.SpessaSynth) {
                    const soundFont = this.soundFontBuffer || await this.getDefaultSoundFont();
                    this.synth = new window.SpessaSynth(this.audioContext, soundFont);
                    await this.synth.isReady;
                    console.log('✅ SpessaSynth synthesizer ready');
                } else {
                    throw new Error('SpessaSynth not available');
                }
            }

            return true;

        } catch (error) {
            console.error('❌ Audio initialization failed:', error);
            return false;
        }
    }

    async getDefaultSoundFont() {
        // Return a minimal soundfont buffer if none loaded
        return new ArrayBuffer(1024);
    }

    async loadMidiFile(file) {
        if (!this.isReady) {
            console.log('⚠️ Player not ready yet');
            return;
        }

        try {
            console.log(`📂 Loading: ${file.name}`);

            const arrayBuffer = await file.arrayBuffer();

            // Parse MIDI
            let midiData;
            if (window.SpessaSynthCore && window.SpessaSynthCore.MIDI) {
                midiData = new window.SpessaSynthCore.MIDI(arrayBuffer);
            } else {
                // Basic MIDI data structure
                midiData = {
                    binary: arrayBuffer,
                    name: file.name,
                    duration: 120
                };
            }

            // Ensure audio is ready
            if (!(await this.ensureAudioReady())) {
                console.log('❌ Audio not ready');
                return;
            }

            // Create sequencer
            if (window.manager && window.manager.seq) {
                // Use existing sequencer
                this.sequencer = window.manager.seq;
                // Load new MIDI into existing sequencer
                window.manager.seq.loadNewSongList([midiData]);
                console.log('✅ Loaded into existing sequencer');
            } else if (window.Sequencer && this.synth) {
                // Create new sequencer
                this.sequencer = new window.Sequencer([midiData], this.synth);
                console.log('✅ Created new sequencer');
            }

            console.log(`🎵 Ready to play: ${file.name}`);

        } catch (error) {
            console.error('❌ Error loading MIDI:', error);
        }
    }

    togglePlayback() {
        // Use existing SpessaSynth manager if available
        if (window.manager && window.manager.seq) {
            if (window.manager.seq.paused) {
                window.manager.seq.play();
                console.log('▶️ Playing');
            } else {
                window.manager.seq.pause();
                console.log('⏸️ Paused');
            }
            return;
        }

        // Fallback to our own sequencer
        if (this.sequencer) {
            if (this.sequencer.paused) {
                this.sequencer.play();
                console.log('▶️ Playing');
            } else {
                this.sequencer.pause();
                console.log('⏸️ Paused');
            }
        } else {
            console.log('⚠️ No MIDI loaded');
        }
    }

    stop() {
        if (window.manager && window.manager.seq) {
            window.manager.seq.stop();
        } else if (this.sequencer) {
            this.sequencer.stop();
        }
        console.log('⏹️ Stopped');
    }

    // Minimal API for external use
    play() {
        if (window.manager && window.manager.seq) {
            window.manager.seq.play();
        } else if (this.sequencer) {
            this.sequencer.play();
        }
    }

    pause() {
        if (window.manager && window.manager.seq) {
            window.manager.seq.pause();
        } else if (this.sequencer) {
            this.sequencer.pause();
        }
    }

    isPlaying() {
        if (window.manager && window.manager.seq) {
            return !window.manager.seq.paused;
        }
        if (this.sequencer) {
            return !this.sequencer.paused;
        }
        return false;
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting minimal Piano Tour...');
    window.pianoTourPlayer = new PianoTourPlayer();
});

// Export for global access
window.PianoTourPlayer = PianoTourPlayer;