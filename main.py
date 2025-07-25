from flask import Flask, render_template, request, send_file, jsonify, send_from_directory, redirect
import os
import io
import tempfile
import logging
from collections import defaultdict
import math
import json
import ugly_midi

app = Flask(__name__)

# Define your preferred canonical domain
CANONICAL_DOMAIN = "www.pianotour.com"  # Or "www.pianotour.com"


@app.before_request
def redirect_to_canonical():
    # Only redirect if not on the canonical domain and it's a GET request (to avoid issues with POSTs)
    if request.method == 'GET' and request.host != CANONICAL_DOMAIN:
        # Reconstruct the URL with the canonical domain and current path/query
        # Ensure it's HTTPS
        canonical_url = f"https://{CANONICAL_DOMAIN}{request.full_path}"
        return redirect(canonical_url, code=301)  # 301 Permanent Redirect


# --- Basic Configuration ---
# Configure logging to show info-level messages.
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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
def print_page():
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
