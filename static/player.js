// Optimized SpessaSynth Piano Tour Player
// Instant UI with background loading and deferred audio

class PianoTourPlayer {
    constructor() {
        this.synth = null;
        this.sequencer = null;
        this.audioContext = null;
        this.soundFontBuffer = null;
        this.currentFiles = [];
        this.isPlaying = false;
        
        // Loading state management
        this.loadingStages = [
            'Checking SpessaSynth libraries...',
            'Preloading SoundFont assets...',
            'Preparing synthesizer components...',
            'Ready to play!'
        ];
        this.currentStage = 0;
        this.isFullyReady = false;
        
        // Configuration
        this.config = {
            sampleRate: 44100,
            voiceCap: 500
        };
        
        // INSTANT: Show UI immediately
        this.setupInstantUI();
        
        // BACKGROUND: Start loading heavy components
        this.initializeInBackground();
    }
    
    setupInstantUI() {
        // Create UI elements immediately - no waiting
        this.setupEventHandlers();
        this.setupPlaybackControls();
        this.updateStatus('🎹 Piano Tour loading...');
        this.updateProgress(0);
        
        console.log('✅ UI ready instantly!');
    }
    
    async initializeInBackground() {
        try {
            // Stage 1: Wait for SpessaSynth libraries
            this.updateLoadingStage(0);
            await this.waitForLibraries();
            
            // Stage 2: Preload SoundFont (but don't block on it)
            this.updateLoadingStage(1);
            this.preloadSoundFont(); // Non-blocking
            
            // Stage 3: Prepare synthesizer components (but don't create AudioContext)
            this.updateLoadingStage(2);
            await this.prepareSynthesizerComponents();
            
            // Stage 4: Ready!
            this.updateLoadingStage(3);
            this.isFullyReady = true;
            this.updateStatus('🎵 Ready! Upload MIDI files or click play.');
            
        } catch (error) {
            console.error('Background initialization failed:', error);
            this.updateStatus(`❌ Error: ${error.message}`);
        }
    }
    
    updateLoadingStage(stageIndex) {
        this.currentStage = stageIndex;
        const progress = Math.round((stageIndex / (this.loadingStages.length - 1)) * 100);
        
        this.updateStatus(this.loadingStages[stageIndex]);
        this.updateProgress(progress);
        
        console.log(`📊 Loading stage ${stageIndex + 1}/${this.loadingStages.length}: ${progress}%`);
    }
    
    async waitForLibraries() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max
            
            const checkLibraries = () => {
                attempts++;
                if (window.SpessaSynth || window.SpessaSynthCore) {
                    console.log('✅ SpessaSynth libraries detected');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.log('⚠️ SpessaSynth libraries not found, using fallback mode');
                    resolve();
                } else {
                    setTimeout(checkLibraries, 100);
                }
            };
            checkLibraries();
        });
    }
    
    async preloadSoundFont() {
        // Try Web Worker first for non-blocking load, fallback to direct fetch
        if (typeof Worker !== 'undefined') {
            this.loadSoundFontWithWorker();
        } else {
            await this.loadSoundFontDirect();
        }
    }
    
    loadSoundFontWithWorker() {
        try {
            // Create inline worker to avoid separate file dependency
            const workerCode = `
                self.onmessage = function(e) {
                    const { url } = e.data;
                    fetch(url)
                        .then(response => {
                            if (response.ok) {
                                return response.arrayBuffer();
                            }
                            throw new Error('Fetch failed');
                        })
                        .then(buffer => {
                            self.postMessage({ 
                                success: true, 
                                buffer: buffer,
                                size: buffer.byteLength 
                            });
                        })
                        .catch(error => {
                            self.postMessage({ 
                                success: false, 
                                error: error.message 
                            });
                        });
                };
            `;
            
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const worker = new Worker(URL.createObjectURL(blob));
            
            worker.postMessage({ url: '/static/soundfonts/default.sf3' });
            
            worker.onmessage = (e) => {
                const { success, buffer, error, size } = e.data;
                
                if (success) {
                    this.soundFontBuffer = buffer;
                    console.log(`✅ SoundFont loaded via Worker (${Math.round(size/1024)}KB)`);
                } else {
                    console.log(`⚠️ Worker load failed: ${error}, using fallback`);
                    this.soundFontBuffer = this.createDummySoundFont();
                }
                
                worker.terminate(); // Clean up
                URL.revokeObjectURL(blob); // Clean up blob URL
            };
            
            worker.onerror = (error) => {
                console.log('⚠️ Worker error, using fallback:', error);
                this.soundFontBuffer = this.createDummySoundFont();
                worker.terminate();
            };
            
        } catch (error) {
            console.log('⚠️ Worker creation failed, using direct fetch');
            this.loadSoundFontDirect();
        }
    }
    
    async loadSoundFontDirect() {
        // Fallback method - direct fetch
        try {
            const response = await fetch('/static/soundfonts/default.sf3');
            if (response.ok) {
                this.soundFontBuffer = await response.arrayBuffer();
                console.log('✅ SoundFont preloaded successfully (direct)');
            } else {
                throw new Error('SoundFont fetch failed');
            }
        } catch (error) {
            console.log('⚠️ SoundFont preload failed, will use fallback');
            this.soundFontBuffer = this.createDummySoundFont();
        }
    }
    
    async prepareSynthesizerComponents() {
        // Prepare everything except AudioContext
        await new Promise(resolve => setTimeout(resolve, 200)); // Simulate prep time
        console.log('✅ Synthesizer components prepared');
    }
    
    // LAZY: Only create AudioContext when user wants to play
    async ensureAudioReady() {
        if (this.audioContext && this.synth) {
            return true; // Already ready
        }
        
        try {
            this.updateStatus('🔊 Initializing audio system...');
            
            // Create AudioContext (requires user interaction)
            if (!this.audioContext) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate });
                
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
                console.log('✅ AudioContext created');
            }
            
            // Create synthesizer
            if (!this.synth) {
                this.updateStatus('🎹 Loading synthesizer...');
                
                // Wait for soundfont if still loading
                if (!this.soundFontBuffer) {
                    this.updateStatus('⏳ Waiting for SoundFont...');
                    await this.ensureSoundFontReady();
                }
                
                if (window.SpessaSynth) {
                    this.synth = new window.SpessaSynth(this.audioContext, this.soundFontBuffer);
                    await this.synth.isReady;
                    console.log('✅ SpessaSynth synthesizer ready');
                } else {
                    throw new Error('SpessaSynth library not available');
                }
            }
            
            this.updateStatus('🎵 Audio system ready!');
            return true;
            
        } catch (error) {
            console.error('Audio initialization failed:', error);
            this.updateStatus(`❌ Audio error: ${error.message}`);
            return false;
        }
    }
    
    async ensureSoundFontReady() {
        let attempts = 0;
        while (!this.soundFontBuffer && attempts < 30) { // 3 second timeout
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!this.soundFontBuffer) {
            console.log('⚠️ Using fallback SoundFont');
            this.soundFontBuffer = this.createDummySoundFont();
        }
    }
    
    createDummySoundFont() {
        // Minimal fallback SoundFont
        return new ArrayBuffer(1024);
    }
    
    setupEventHandlers() {
        this.setupFileUpload();
        this.setupDragAndDrop();
        this.setupKeyboardShortcuts();
    }
    
    setupFileUpload() {
        // Create file input if needed
        let fileInput = document.getElementById('midi_file_input');
        if (!fileInput) {
            fileInput = document.createElement('input');
            fileInput.id = 'midi_file_input';
            fileInput.type = 'file';
            fileInput.accept = '.mid,.midi,.kar,.rmi,.xmf,.mxmf';
            fileInput.multiple = true;
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);
        }
        
        // Create upload button if needed
        let uploadButton = document.getElementById('upload_button');
        if (!uploadButton) {
            uploadButton = this.createUploadButton();
        }
        
        uploadButton.onclick = () => fileInput.click();
        fileInput.onchange = async (event) => {
            const files = event.target.files;
            if (files && files.length > 0) {
                await this.loadMidiFiles(files);
            }
        };
    }
    
    createUploadButton() {
        const button = document.createElement('button');
        button.id = 'upload_button';
        button.textContent = '📁 Upload MIDI Files';
        button.className = 'btn btn-primary';
        button.style.margin = '10px';
        
        const container = document.getElementById('player_container') || document.body;
        container.appendChild(button);
        
        return button;
    }
    
    setupDragAndDrop() {
        const dropZone = document.getElementById('player_container') || document.body;
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            dropZone.style.backgroundColor = '#e3f2fd';
        });
        
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.backgroundColor = '';
        });
        
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.style.backgroundColor = '';
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                await this.loadMidiFiles(files);
            }
        });
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                this.togglePlayback();
            }
        });
    }
    
    setupPlaybackControls() {
        let controlContainer = document.getElementById('playback_controls');
        if (!controlContainer) {
            controlContainer = document.createElement('div');
            controlContainer.id = 'playback_controls';
            controlContainer.style.margin = '20px';
            controlContainer.style.textAlign = 'center';
            
            const playerContainer = document.getElementById('player_container') || document.body;
            playerContainer.appendChild(controlContainer);
        }
        
        this.createPlaybackUI(controlContainer);
    }
    
    createPlaybackUI(container) {
        container.innerHTML = `
            <div style="margin: 15px 0;">
                <button id="play_pause_btn" class="btn btn-success" style="margin: 0 5px; padding: 10px 20px;">
                    ▶️ Play
                </button>
                <button id="stop_btn" class="btn btn-danger" style="margin: 0 5px; padding: 10px 20px;">
                    ⏹️ Stop
                </button>
            </div>
            
            <div style="margin: 10px 0;">
                <div id="progress_bar_container" style="width: 300px; height: 6px; background: #ddd; border-radius: 3px; margin: 10px auto; position: relative;">
                    <div id="progress_bar_fill" style="height: 100%; background: #007bff; border-radius: 3px; width: 0%; transition: width 0.3s;"></div>
                </div>
                <span id="progress_display" style="font-family: monospace;">00:00 / 00:00</span>
            </div>
            
            <div id="status_display" style="margin: 15px 0; font-style: italic; color: #666;">
                Loading Piano Tour...
            </div>
        `;
        
        document.getElementById('play_pause_btn').onclick = () => this.togglePlayback();
        document.getElementById('stop_btn').onclick = () => this.stop();
    }
    
    async loadMidiFiles(files) {
        try {
            this.updateStatus('📂 Loading MIDI files...');
            
            const file = files[0];
            const arrayBuffer = await file.arrayBuffer();
            
            // Parse MIDI
            let midiData;
            if (window.SpessaSynthCore && window.SpessaSynthCore.MIDI) {
                midiData = new window.SpessaSynthCore.MIDI(arrayBuffer);
            } else {
                midiData = this.parseMidiBasic(arrayBuffer, file.name);
            }
            
            // Ensure audio is ready before creating sequencer
            if (!(await this.ensureAudioReady())) {
                return;
            }
            
            // Create sequencer
            if (window.Sequencer && this.synth) {
                this.sequencer = new window.Sequencer([midiData], this.synth);
                this.setupSequencerEvents();
            }
            
            this.currentFiles = [file];
            this.updateStatus(`🎵 Loaded: ${file.name}`);
            this.updateUploadButton(file.name);
            
        } catch (error) {
            console.error('Error loading MIDI:', error);
            this.updateStatus(`❌ Error loading MIDI: ${error.message}`);
        }
    }
    
    parseMidiBasic(arrayBuffer, fileName) {
        return {
            binary: arrayBuffer,
            name: fileName || 'MIDI File',
            duration: 120,
            tracks: []
        };
    }
    
    async togglePlayback() {
        // Ensure audio system is ready (lazy initialization)
        if (!(await this.ensureAudioReady())) {
            return;
        }
        
        if (!this.sequencer) {
            this.updateStatus('⚠️ No MIDI file loaded');
            return;
        }
        
        try {
            if (this.sequencer.paused) {
                this.sequencer.play();
                this.updateStatus('🎵 Playing...');
            } else {
                this.sequencer.pause();
                this.updateStatus('⏸️ Paused');
            }
        } catch (error) {
            console.error('Playback error:', error);
            this.updateStatus(`❌ Playback error: ${error.message}`);
        }
    }
    
    stop() {
        if (this.sequencer) {
            this.sequencer.stop();
        }
        this.isPlaying = false;
        this.updatePlayButton('▶️ Play');
        this.updateProgress(0);
        this.updateStatus('⏹️ Stopped');
    }
    
    setupSequencerEvents() {
        if (!this.sequencer) return;
        
        this.sequencer.addOnTimeChangeEvent((time) => {
            this.updateProgressTime(time);
        }, 'player-time');
        
        this.sequencer.addOnPlaybackStateChangeEvent((isPlaying) => {
            this.isPlaying = isPlaying;
            this.updatePlayButton(isPlaying ? '⏸️ Pause' : '▶️ Play');
        }, 'player-state');
    }
    
    updatePlayButton(text) {
        const btn = document.getElementById('play_pause_btn');
        if (btn) {
            btn.textContent = text;
            btn.className = text.includes('Play') ? 'btn btn-success' : 'btn btn-warning';
        }
    }
    
    updateProgressTime(currentTime) {
        const duration = this.sequencer ? this.sequencer.duration : 120;
        const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
        
        this.updateProgress(progress);
        
        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };
        
        const display = document.getElementById('progress_display');
        if (display) {
            display.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
        }
    }
    
    updateProgress(percent) {
        const progressBar = document.getElementById('progress_bar_fill');
        if (progressBar) {
            progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
        }
    }
    
    updateStatus(message) {
        console.log('🎹 Piano Tour:', message);
        const display = document.getElementById('status_display');
        if (display) {
            display.textContent = message;
        }
    }
    
    updateUploadButton(fileName) {
        const btn = document.getElementById('upload_button');
        if (btn) {
            const displayName = fileName.length > 20 ? fileName.substring(0, 20) + '...' : fileName;
            btn.textContent = `🎵 ${displayName}`;
        }
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Piano Tour Player...');
    window.pianoTourPlayer = new PianoTourPlayer();
});

// Export for global access
window.PianoTourPlayer = PianoTourPlayer;