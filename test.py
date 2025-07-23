from flask import Flask, render_template, request, send_file, jsonify, send_from_directory
import mido
from mido import MidiFile, MidiTrack, Message
import os
import io
import tempfile
import logging
from collections import defaultdict
import math
import json
import ugly_midi

# --- Basic Configuration ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Flask App Initialization ---
app = Flask(__name__)

# Constants
TICKS_PER_BEAT = 480  # Standard MIDI ticks per beat

# Duration mappings
DURATION_TO_TICKS_MAP = {
    'w': TICKS_PER_BEAT * 4,  # whole note
    'h': TICKS_PER_BEAT * 2,  # half note
    'q': TICKS_PER_BEAT,  # quarter note
    '8': TICKS_PER_BEAT // 2,  # eighth note
    '16': TICKS_PER_BEAT // 4,  # sixteenth note
    '32': TICKS_PER_BEAT // 8,  # thirty-second note
    'w.': int(TICKS_PER_BEAT * 6),  # dotted whole (6 beats)
    'h.': int(TICKS_PER_BEAT * 3),  # dotted half (3 beats)
    'q.': int(TICKS_PER_BEAT * 1.5),  # dotted quarter (1.5 beats)
    '8.': int(TICKS_PER_BEAT * 0.75),  # dotted eighth (0.75 beats)
    '16.': int(TICKS_PER_BEAT * 0.375),  # dotted sixteenth (0.375 beats)
}

# Reverse mapping for quick lookup
TICKS_TO_DURATION_MAP = {v: k for k, v in DURATION_TO_TICKS_MAP.items()}
# Create a sorted list of ticks for finding the closest duration
SORTED_TICKS = sorted(DURATION_TO_TICKS_MAP.items(), key=lambda item: item[1])
TICKS_TO_DURATION = {v: k for k, v in DURATION_TO_TICKS_MAP.items()}


def ticks_to_duration_symbol(ticks):
    """Convert ticks to VexFlow duration symbol, including dotted notes"""

    # Use tolerance for floating point comparison
    tolerance = TICKS_PER_BEAT // 32  # Small tolerance

    # Sort durations by tick value (descending) to check longer durations first
    sorted_durations = sorted(DURATION_TO_TICKS_MAP.items(),
                              key=lambda x: x[1],
                              reverse=True)

    # Find exact or close match
    for duration_symbol, duration_ticks in sorted_durations:
        if abs(ticks - duration_ticks) <= tolerance:
            return duration_symbol

    # If no close match found, find the closest duration
    closest_duration = min(sorted_durations, key=lambda x: abs(x[1] - ticks))
    logger.warning(
        f"No exact match for {ticks} ticks, using closest: {closest_duration[0]} ({closest_duration[1]} ticks)"
    )
    return closest_duration[0]


def split_duration_across_measures(duration_ticks, remaining_space_in_measure,
                                   ticks_per_measure):
    """
    Split a duration across multiple measures, returning a list of duration symbols
    """
    parts = []
    remaining_duration = duration_ticks
    current_space = remaining_space_in_measure

    # Safety counter to prevent infinite loops
    max_iterations = 20
    iteration_count = 0

    while remaining_duration > 0 and iteration_count < max_iterations:
        iteration_count += 1

        if current_space <= 0:
            # Start a new measure
            current_space = ticks_per_measure
            continue

        # Find the largest duration that fits in current space
        available_durations = [
            (symbol, ticks) for symbol, ticks in DURATION_TO_TICKS_MAP.items()
            if ticks <= current_space
        ]

        if not available_durations:
            # No duration fits in current space, move to next measure
            current_space = ticks_per_measure
            continue

        # Choose the duration that best fits the remaining duration
        best_duration = min(
            available_durations,
            key=lambda x: abs(x[1] - min(remaining_duration, current_space)))
        duration_symbol, actual_ticks = best_duration

        parts.append(duration_symbol)
        remaining_duration -= actual_ticks
        current_space -= actual_ticks

        # If we've filled the measure, prepare for the next one
        if current_space <= 0:
            current_space = ticks_per_measure

    if iteration_count >= max_iterations:
        logger.warning(
            f"Split duration hit max iterations. Remaining duration: {remaining_duration}"
        )

    return parts


def midi_to_json_data(midi_file_path):
    """
    Converts a MIDI file to the app's JSON format using ugly_midi library.
    """
    try:
        # Use ugly_midi to convert MIDI to VexFlow JSON
        vexflow_json = ugly_midi.midi_to_json(midi_file_path)

        # Transform VexFlow format to your app's expected format
        song_data = []

        for measure_index, measure in enumerate(
                vexflow_json.get('measures', [])):
            measure_notes = []

            for note in measure:
                if note.get('isRest', False):
                    measure_notes.append({
                        'name': '',
                        'clef': note.get('clef', 'treble'),
                        'duration': note.get('duration', 'q'),
                        'isRest': True,
                        'velocity': 80,
                        'measure': measure_index
                    })
                else:
                    measure_notes.append({
                        'name': note.get('name', 'C4'),
                        'clef': note.get('clef', 'treble'),
                        'duration': note.get('duration', 'q'),
                        'isRest': False,
                        'velocity': 80,  # Default velocity
                        'measure': measure_index
                    })

            song_data.append(measure_notes)

        return song_data

    except Exception as e:
        logger.error(f"ugly_midi failed to parse MIDI file: {e}")
        raise ValueError(f"Failed to convert MIDI file: {str(e)}")


# --- Core Conversion Logic ---


def create_piano_midi(song_data):
    """
    Create MIDI from song data in the expected format
    """
    if not isinstance(song_data, list):
        raise ValueError("Song data must be a list of measures.")

    mid = MidiFile(type=1, ticks_per_beat=TICKS_PER_BEAT)
    track = MidiTrack()
    mid.tracks.append(track)
    track.append(mido.MetaMessage('track_name', name='Piano', time=0))
    track.append(mido.MetaMessage('set_tempo', tempo=500000, time=0))
    track.append(Message('program_change', program=0, channel=0, time=0))
    track.append(Message('program_change', program=0, channel=1, time=0))
    events = []
    current_time_in_ticks = 0

    for measure in song_data:
        if not isinstance(measure, list):
            continue

        for note_info in measure:
            if not isinstance(note_info, dict):
                continue
            duration_in_ticks = duration_to_ticks(
                note_info.get('duration', 'q'))
            if note_info.get('isRest', False):
                current_time_in_ticks += duration_in_ticks
            else:
                midi_notes = note_info.get('midiNotes', [])
                if not midi_notes:
                    continue
                velocity = get_velocity(note_info)
                channel = 1 if note_info.get('clef') == 'bass' else 0
                for midi_note in midi_notes:
                    if isinstance(midi_note,
                                  (int, float)) and 0 <= midi_note <= 127:
                        events.append({
                            'type': 'note_on',
                            'note': int(midi_note),
                            'velocity': velocity,
                            'channel': channel,
                            'time': current_time_in_ticks
                        })
                        events.append({
                            'type':
                            'note_off',
                            'note':
                            int(midi_note),
                            'velocity':
                            64,
                            'channel':
                            channel,
                            'time':
                            current_time_in_ticks + duration_in_ticks
                        })
                current_time_in_ticks += duration_in_ticks

    events.sort(key=lambda e: e['time'])
    last_event_time = 0
    for event in events:
        delta_time = event['time'] - last_event_time
        track.append(
            Message(event['type'],
                    note=event['note'],
                    velocity=event['velocity'],
                    channel=event['channel'],
                    time=delta_time))
        last_event_time = event['time']
    return mid


def duration_to_ticks(duration):
    """Convert duration symbol to ticks"""
    return DURATION_TO_TICKS_MAP.get(duration, TICKS_PER_BEAT)


def get_velocity(note_info):
    """Get velocity from note info, with default"""
    return note_info.get('velocity', 80)


# --- Flask Routes ---


@app.route('/')
def index():
    return render_template('index.html', hide_spectrum=False)


@app.route('/editor')
def editor():
    return render_template('editor.html', show_side_panel=True)


@app.route('/extras')
def extras():
    return render_template('extras.html', show_side_panel=True)


@app.route('/print')
def print():
    return render_template('print.html')


@app.route('/practice')
def practice():
    return render_template('practice.html')


@app.route('/guitar')
def guitar():
    """Guitar instrument route"""
    return render_template('guitar.html', instrument='guitar')


@app.route('/cello')
def cello():
    """Guitar instrument route"""
    return render_template('cello.html', instrument='cello')


@app.route('/sax')
def sax():
    """Guitar instrument route"""
    return render_template('sax.html', instrument='sax')


@app.route('/player')
def player():
    return render_template('player.html')


@app.route('/testplayer')
def testplayer():
    return render_template('testplayer.html')


@app.route('/integrated')
def integrated():
    return render_template('spesIndex.html')


# SpessaSynth expects these routes:


@app.route('/getversion')
def get_version():
    """Return version info - SpessaSynth checks this"""
    return jsonify({
        "version": "3.27.12",  # or whatever version you want
        "name": "Piano Tour SpessaSynth"
    })


@app.route('/getsettings')
def get_settings():
    return jsonify({
        "renderer": {
            "renderingMode": "0",
            "renderWaveforms": True
        },
        "keyboard": {
            "keyRange": {
                "min": 36,
                "max": 96
            },  # 5 octaves (C2 to C7)
            "mode": "light",  # Light keyboard mode
            "show": True,  # Show keyboard
            "selectedChannel": 0,
            "autoRange": True
        },
        "interface": {
            "mode": "dark",
            "language": "en",
            "layout": "downwards"
        },
        "midi": {
            "input": None,
            "output": None
        },
        # ADD THIS SECTION:
        "sequencer": {
            "loop": False,  # This disables looping by default
            "autoPlay": True  # You can also control auto-play here
        }
    })


@app.route('/savesettings', methods=['POST'])
def save_settings():
    return jsonify({
        'success': True,
        'message': 'Settings received by server.'
    })


@app.route('/soundfonts')
def soundfont():
    return jsonify([{'name': '/static/soundfonts/default.sf3'}])


@app.route('/setlastsf2')
def set_last_sf2():
    """Remember last selected SoundFont"""
    sfname = request.args.get('sfname', '')
    print(f"Last SoundFont set to: {sfname}")
    return jsonify({'success': True})


@app.route('/package.json')
def package_json():
    """SpessaSynth checks for version info in package.json"""
    return jsonify({
        "name": "Piano Tour",
        "version": "3.27.12",
        "description": "Piano Tour MIDI Player"
    })


# Error handlers to return JSON instead of HTML for API routes
@app.errorhandler(404)
def not_found(error):
    # Check if this is an API request (expecting JSON)
    if request.path.startswith('/api/') or request.path in [
            '/getsettings', '/soundfonts', '/getversion'
    ]:
        return jsonify({'error': 'Not found'}), 404
    # For regular pages, return normal 404
    return "Page not found", 404


@app.route('/convert-to-midi', methods=['POST'])
def convert_to_midi():
    temp_midi_path = None
    try:
        song_data = request.json
        if not song_data:
            return jsonify({'error': 'No song data provided'}), 400

        # Use ugly_midi library instead of create_piano_midi
        midi_data = ugly_midi.json_to_midi(song_data)

        fd, temp_midi_path = tempfile.mkstemp(suffix='.mid')
        os.close(fd)

        # Use ugly_midi's save function instead of midi_file.save()
        ugly_midi.save_midi(midi_data, temp_midi_path)

        return send_file(temp_midi_path,
                         as_attachment=True,
                         download_name='score.mid',
                         mimetype='audio/midi')
    except Exception as e:
        logger.error(f"Error during MIDI conversion: {e}", exc_info=True)
        return jsonify({'error': f'Failed to convert to MIDI: {str(e)}'}), 500
    finally:
        if temp_midi_path and os.path.exists(temp_midi_path):
            try:
                os.unlink(temp_midi_path)
            except Exception as cleanup_error:
                logger.warning(
                    f"Failed to clean up temp file: {cleanup_error}")


@app.route('/convert-to-json', methods=['POST'])
def convert_to_json():
    if 'midiFile' not in request.files:
        return jsonify({'error': 'No MIDI file provided.'}), 400
    file = request.files['midiFile']
    if file.filename == '':
        return jsonify({'error': 'No file selected.'}), 400
    temp_midi_path = None
    try:
        fd, temp_midi_path = tempfile.mkstemp(suffix='.mid')
        os.close(fd)
        file.save(temp_midi_path)
        json_data = midi_to_json_data(temp_midi_path)
        return jsonify(json_data)
    except Exception as e:
        logger.error(f"Error during JSON conversion: {e}", exc_info=True)
        return jsonify({'error':
                        f'Failed to convert MIDI to JSON: {str(e)}'}), 500
    finally:
        if temp_midi_path and os.path.exists(temp_midi_path):
            try:
                os.unlink(temp_midi_path)
            except Exception as cleanup_error:
                logger.warning(
                    f"Failed to clean up temp file: {cleanup_error}")


@app.route('/health')
def health_check():
    return jsonify({'status': 'ok'})


# --- Main Execution ---
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=4000)
