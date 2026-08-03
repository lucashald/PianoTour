# Piano Tour

An interactive, browser-based piano studio for composing, practicing, and playing back sheet music.

**Live:** https://www.pianotour.com

## Features

- Write scores directly on a rendered staff via click or drag note entry, with major/minor key signatures, tempo control (60–220 BPM), and semitone/octave transposition
- Piano, guitar, strings, brass, synth, with adjustable ADSR envelope, reverb, EQ, and compression
- Export as audio or MIDI, print your score, or share a composition with others
- Connect an external keyboard for note entry
- Chord database
- Guitar chord lookup

## Tech Stack

- Backend: Python (Flask), containerized with Docker, deployed on Fly.io
- Frontend: Tone.js for audio synthesis, VexFlow for sheet music rendering
