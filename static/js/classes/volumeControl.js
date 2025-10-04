// VolumeControl.js
// This class manages the volume control UI and functionality, including audio status handling.
import { unlockAndExecute } from '../core/audioManager.js';

export class VolumeControl {
        constructor(container) {
            this.container = container;
            this.slider = container.querySelector('#volumeSlider');
            this.volumeValue = container.querySelector('#volumeValue');
            this.volumeIcon = container.querySelector('.volume-icon');
            this.previousVolume = 75;
            this.audioStatus = 'uninitialized'; // Track audio status
            
            this.init();
        }
        
        init() {
            this.setAudioStatus('uninitialized'); // Start disabled
            this.updateDisplay();
            this.bindEvents();
            this.listenForAudioStatusChanges();
        }
        
        bindEvents() {
    // Container click - fallback for any missed clicks
        this.container.addEventListener('click', (e) => {
            e.preventDefault();
        // Only handle if no other element handled it
        if (e.target === this.container) {
            this.handleClick('Container');
        }
    });
    
    // Slider - handle both initialization and volume changes
        this.slider.addEventListener('click', (e) => {
            e.preventDefault();
        e.stopPropagation(); // Prevent container click
        this.handleClick('Slider');
    });
    
    this.slider.addEventListener('input', (e) => {
    this.updateDisplay();
    this.checkMuteState();
    this.updateToneVolume();
});

    // Volume value - handle clicks on the number
        this.volumeValue.addEventListener('click', (e) => {
            e.preventDefault();
        e.stopPropagation();
        this.handleClick('Volume value');
    });
    
    // Icon - handle mute toggle or initialization
        this.volumeIcon.addEventListener('click', (e) => {
            e.preventDefault();
        e.stopPropagation();
        if (this.audioStatus === 'ready') {
            this.toggleMute();
        } else {
            this.handleClick('Icon');
        }
    });
    
    // Keyboard support for icon
    this.volumeIcon.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (this.audioStatus === 'ready') {
                this.toggleMute();
            } else {
                this.handleClick('Icon (keyboard)');
            }
        }
    });
}

// Simple unified click handler
handleClick(source) {
    if (this.audioStatus === 'uninitialized' || this.audioStatus === 'error') {
        console.log(`${source} clicked - initializing audio`);
        this.initializeAudio();
    }
    // Do nothing if loading or ready (ready state handled elsewhere)
}

        // NEW: Listen for audio status changes
        listenForAudioStatusChanges() {
            // Listen for the audioReady event
            window.addEventListener('audioReady', () => {
                this.setAudioStatus('ready');
            });
            
            // Listen for custom audio status events
            window.addEventListener('audioStatusChange', (e) => {
                this.setAudioStatus(e.detail.status);
            });
        }
        
        // NEW: Set audio status and update UI accordingly
        setAudioStatus(status) {
            this.audioStatus = status;
            this.updateAudioStatusDisplay();
        }
        // NEW: Update UI based on audio status
updateAudioStatusDisplay() {
    // Remove all status classes
    this.container.classList.remove('audio-uninitialized', 'audio-loading', 'audio-ready', 'audio-error');
    
    switch (this.audioStatus) {
        case 'uninitialized':
            this.container.classList.add('audio-uninitialized');
            // DON'T disable the slider - just mark it as non-functional
            this.slider.setAttribute('data-audio-status', 'uninitialized');
            this.volumeIcon.setAttribute('aria-label', 'Click to enable audio');
            this.updateVolumeIcon('muted-disabled');
            break;
            
        case 'loading':
            this.container.classList.add('audio-loading');
            this.slider.setAttribute('data-audio-status', 'loading');
            this.volumeIcon.setAttribute('aria-label', 'Audio loading...');
            this.updateVolumeIcon('loading');
            break;
            
        case 'ready':
            this.container.classList.add('audio-ready');
            this.slider.disabled = false; // Only enable when ready
            this.slider.setAttribute('data-audio-status', 'ready');
            this.volumeIcon.setAttribute('aria-label', 'Toggle mute');
            this.loadSavedVolume();
            this.checkMuteState(); // This will set the correct icon
            break;
            
        case 'error':
            this.container.classList.add('audio-error');
            this.slider.setAttribute('data-audio-status', 'error');
            this.volumeIcon.setAttribute('aria-label', 'Audio error - click to retry');
            this.updateVolumeIcon('error');
            break;
    }
}
        
        // NEW: Update volume icon based on state
        updateVolumeIcon(state) {
            const iconPath = this.volumeIcon.querySelector('path');
            
            switch (state) {
                case 'muted-disabled':
                    // Muted icon with different styling
                    iconPath.setAttribute('d', 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z');
                    break;
                    
                case 'loading':
                    // Could use a different icon or add animation
                    iconPath.setAttribute('d', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z');
                    break;
                    
                case 'error':
                    // Error icon
                    iconPath.setAttribute('d', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z');
                    break;
                    
                case 'normal':
                    // Normal volume icon
                    iconPath.setAttribute('d', 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z');
                    break;
                    
                case 'muted':
                    // Muted icon (when audio is ready but muted)
                    iconPath.setAttribute('d', 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z');
                    break;
            }
        }
        
        // NEW: Initialize audio when clicked in uninitialized state
async initializeAudio() {
    this.setAudioStatus('loading');
    try {
        await unlockAndExecute(() => {
            console.log('Audio initialized via volume control');
        });
    } catch (error) {
        console.error('Failed to initialize audio:', error);
        this.setAudioStatus('error');
    }
}
        
        updateDisplay() {
            const value = this.slider.value;
            this.volumeValue.textContent = value;
            this.slider.style.setProperty('--value-percent', `${value}%`);
        }
        
updateToneVolume() {
    const percent = parseFloat(this.slider.value);
    let dbValue;
    
    if (percent === 0) {
        dbValue = -Infinity;
    } else {
        dbValue = (percent / 100) * 20 - 20;
    }
    
    // Always save to localStorage regardless of audio state
    localStorage.setItem('piano-volume', percent.toString());
    
    // Apply to Tone.js if available (no-op if not ready yet)
    if (window.Tone && window.Tone.Destination) {
        window.Tone.Destination.volume.value = dbValue;
        console.log(`Volume: ${percent}% (${dbValue === -Infinity ? '-∞' : dbValue.toFixed(1)} dB)`);
    }
}
        
        toggleMute() {
            const isMuted = this.container.classList.contains('muted');
            
            if (isMuted) {
                this.slider.value = this.previousVolume;
            } else {
                this.previousVolume = this.slider.value;
                this.slider.value = 0;
            }
            
            this.updateDisplay();
            this.checkMuteState();
            this.updateToneVolume();
        }
        
        checkMuteState() {
            if (this.slider.value == 0) {
                this.container.classList.add('muted');
                this.updateVolumeIcon('muted');
            } else {
                this.container.classList.remove('muted');
                this.updateVolumeIcon('normal');
            }
        }
        
        loadSavedVolume() {
            const savedVolume = localStorage.getItem('piano-volume') || '75';
            this.slider.value = savedVolume;
            this.updateDisplay();
            this.checkMuteState();
            this.updateToneVolume();
        }
    }