// audioControl.js - Base class
export class AudioControl {
    constructor(container) {
        this.container = container;
        this.volume = 75;
        this.audioStatus = 'uninitialized';
    }
    
    setVolume(vol) {
        this.volume = Math.max(0, Math.min(100, vol));
        this.updateDisplay();
        this.saveToStorage();
    }
    
    saveToStorage() {
        localStorage.setItem(`${this.constructor.name}-volume`, this.volume);
    }
    
    initializeAudio() {
        return window.audioManager?.unlockAndExecute(() => {
            this.audioStatus = 'ready';
            this.onAudioReady();
        });
    }
    
    // Override in child classes
    updateDisplay() { }
    onAudioReady() { }
}