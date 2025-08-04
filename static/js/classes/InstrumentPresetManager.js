/**
 * InstrumentPresetManager.js - Manages instrument presets and configurations
 */
export class InstrumentPresetManager {
    constructor() {
        this.presets = {
            piano: {
                name: 'Piano',
                baseUrl: '/static/samples/',
                sampleUrls: {
                    C2: "SteinwayD_m_C2_L.wav",
                    E2: "SteinwayD_m_E2_L.wav",
                    "G#2": "SteinwayD_m_G#2_L.wav",
                    C3: "SteinwayD_m_C3_L.wav",
                    E3: "SteinwayD_m_E3_L.wav",
                    "G#3": "SteinwayD_m_G#3_L.wav",
                    C4: "SteinwayD_m_C4_L.wav",
                    E4: "SteinwayD_m_E4_L.wav",
                    "F#4": "SteinwayD_m_F#4_L.wav",
                    "A#4": "SteinwayD_m_A#4_L.wav",
                    C5: "SteinwayD_m_C5_L.wav",
                    "F#5": "SteinwayD_m_F#5_L.wav",
                    C6: "SteinwayD_m_C6_L.wav",
                },
                envelopeSettings: {
                    attack: 0.01,
                    decay: 0.3,
                    sustain: 0.8,
                    release: 1.2,
                    reverb: { enabled: true, roomSize: 0.2, wet: 0.15 },
                    compression: { enabled: true, threshold: -18, ratio: 4, attack: 0.003, release: 0.1 },
                    eq: { enabled: true, low: +1, mid: 0, high: -1 }
                }
            },

            drums: {
                name: 'Drums',
                baseUrl: '/static/samples/drums/',
                sampleUrls: {
                    "C2": "kick.wav",
                    "B1": "BOXKICK.wav", 
                    "D2": "snare.wav",
                    "C#2": "sidestick.wav",
                    "F2": "rim.wav",
                    "F#2": "hi-hat.wav",
                    "A#2": "open-hat.wav",
                    "A2": "low-tom.wav",
                    "B2": "MIDTOM.wav",
                    "C3": "high-tom.wav",
                    "C#3": "crash.wav",
                    "D#3": "ride.wav",
                    "G3": "cymbal.wav",
                    "D#2": "clap.wav",
                    "G#3": "cowbell.wav",
                    "A#3": "conga.wav",
                    "F#3": "BONGOLO.wav",
                    "G#4": "BONGOHI.wav",
                    "A4": "claves.wav"
                },
                envelopeSettings: {
                    attack: 0.001,
                    decay: 0.1,
                    sustain: 0.3,
                    release: 0.8,
                    reverb: { enabled: true, roomSize: 0.3, wet: 0.2 },
                    compression: { enabled: true, threshold: -15, ratio: 6, attack: 0.001, release: 0.05 }
                }
            },

            guitar: {
                name: 'Guitar',
                baseUrl: '/static/samples/',
                sampleUrls: {
                    "F#2": "nylonf42.wav",
                    C3: "nylonf48.wav",
                    F3: "nylonf53.wav",
                    "A#3": "nylonf58.wav",
                    D4: "nylonf62.wav",
                    "G#4": "nylonf68.wav",
                    "C#5": "nylonf73.wav",
                    G5: "nylonf79.wav",
                },
                envelopeSettings: {
                    attack: 0.02,
                    decay: 0.5,
                    sustain: 0.9,
                    release: 2.0,
                    reverb: { enabled: true, roomSize: 0.4, wet: 0.25 },
                    chorus: { enabled: true, frequency: 1.5, depth: 0.7, wet: 0.2 },
                    compression: { enabled: true, threshold: -16, ratio: 6, attack: 0.003, release: 0.1 }
                }
            },

            cello: {
                name: 'Cello',
                baseUrl: '/static/samples/',
                sampleUrls: {
                    "C3": "CelloC3.wav",
                    "A3": "CelloA3.wav",
                    "C4": "CelloC4.wav",
                    "D#4": "CelloD#4.wav",
                    "E3": "CelloE3.wav",
                    "A4": "CelloA4.wav",
                    "F#4": "CelloF#4.wav",
                    "D2": "CelloD2.wav",
                    "C5": "CelloC5.wav",
                    "G#4": "CelloG#4.wav",
                },
                envelopeSettings: {
                    attack: 0.03,
                    decay: 0.2,
                    sustain: 0.95,
                    release: 1.5,
                    reverb: { enabled: true, roomSize: 0.6, wet: 0.3 },
                    eq: { enabled: true, low: 2, mid: 0, high: -1 }
                }
            },

            sax: {
                name: 'Saxophone',
                baseUrl: '/static/samples/',
                sampleUrls: {
                    A2: "TSAX45-2.wav",
                    "C#3": "TSAX49.wav",
                    F3: "TSAX53-3.wav",
                    A3: "TSAX57.wav",
                    C4: "TSAX60-3.wav",
                    D4: "TSAX62-2.wav",
                    F4: "TSAX65-2.wav",
                    "G#4": "TSAX68.wav",
                    A4: "TSAX69-3.wav",
                    C5: "TSAX72.wav",
                    "F#5": "TSAX78-2.wav",
                    "A#5": "TSAX82-2.wav",
                    C6: "TSAX84-2.wav",
                },
                envelopeSettings: {
                    attack: 0.03,
                    decay: 0.2,
                    sustain: 1.0,
                    release: 0.8
                }
            }
        };
    }

    getPreset(instrumentName) {
        return this.presets[instrumentName] || null;
    }

    getSampleUrls(instrumentName) {
        const preset = this.getPreset(instrumentName);
        return preset ? preset.sampleUrls : this.presets.piano.sampleUrls;
    }

    getBaseUrl(instrumentName) {
        const preset = this.getPreset(instrumentName);
        return preset ? preset.baseUrl : this.presets.piano.baseUrl;
    }

    getEnvelopeSettings(instrumentName) {
        const preset = this.getPreset(instrumentName);
        return preset ? preset.envelopeSettings : this.presets.piano.envelopeSettings;
    }

    getDisplayName(instrumentName) {
        const preset = this.getPreset(instrumentName);
        return preset ? preset.name : 'Unknown Instrument';
    }

    getAvailableInstruments() {
        return Object.keys(this.presets);
    }

    addPreset(instrumentName, presetData) {
        this.presets[instrumentName] = presetData;
        console.log(`📝 Added preset for ${instrumentName}`);
    }
}