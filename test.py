from flask import Flask, render_template, request, send_file, jsonify, send_from_directory, redirect
import os
import io
import tempfile
import logging
from collections import defaultdict
import math
import json
import ugly_midi
import jsonschema
from jsonschema import validate

# --- Basic Configuration ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Flask App Initialization ---
app = Flask(__name__)


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
    return render_template('piano.html', hide_spectrum=False)


@app.route('/editor')
def editor():
    return render_template('editor.html', show_side_panel=True)


@app.route('/json')
def json():
    return render_template('json.html', show_side_panel=True)


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

@app.route('/drums')
def drums():
    """Drums instrument route"""
    return render_template('drums.html')


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


import jsonschema
from jsonschema import validate

# More permissive schema that allows ugly_midi to handle missing/invalid data
# Updated schema to accept full object with metadata + measures
SONG_DATA_SCHEMA = {
    "type": "object",
    "properties": {
        "keySignature": {
            "type": "string",
            "maxLength": 10
        },
        "tempo": {
            "type": "number",
            "minimum": 20,
            "maximum": 300
        },
        "timeSignature": {
            "type": "object",
            "properties": {
                "numerator": {"type": "integer", "minimum": 1, "maximum": 32},
                "denominator": {"type": "integer", "minimum": 1, "maximum": 32}
            },
            "required": ["numerator", "denominator"]
        },
        "instrument": {
            "type": "string",
            "maxLength": 50
        },
        "midiChannel": {
            "type": ["integer", "string"],
            "minimum": 0,
            "maximum": 15
        },
        "isMinorChordMode": {
            "type": "boolean"
        },
        "measures": {
            "type": "array",
            "maxItems": 1000,
            "items": {
                "type": "array",
                "maxItems": 100,
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "maxLength": 50
                        },
                        "clef": {
                            "type": "string",
                            "maxLength": 20
                        },
                        "duration": {
                            "type": "string",
                            "maxLength": 10
                        },
                        "isRest": {
                            "type": "boolean"
                        },
                        "velocity": {
                            "type": ["integer", "string"],
                            "minimum": 0,
                            "maximum": 127
                        },
                        "measure": {
                            "type": ["integer", "string"],
                            "minimum": 0
                        },
                        "id": {
                            "type": "string",
                            "maxLength": 100
                        }
                    },
                    "required": [],
                    "additionalProperties": True
                }
            }
        }
    },
    "required": ["measures"],
    "additionalProperties": True
}


def sanitize_for_ugly_midi(song_data):
    """
    Sanitize full object structure with metadata + measures
    """
    if not isinstance(song_data, dict):
        raise ValueError("Song data must be an object with metadata and measures")
    
    if "measures" not in song_data:
        raise ValueError("Song data must contain a 'measures' array")
    
    measures = song_data["measures"]
    if not isinstance(measures, list):
        raise ValueError("Measures must be an array")

    # Sanitize the measures array (keeping your existing logic)
    sanitized_measures = []
    for measure_idx, measure in enumerate(measures[:1000]):  # Limit measures
        if not isinstance(measure, list):
            continue

        sanitized_measure = []
        for note_idx, note in enumerate(measure[:100]):  # Limit notes per measure
            if not isinstance(note, dict):
                continue

            # Basic sanitization - remove null bytes, limit string lengths
            sanitized_note = {}
            for key, value in note.items():
                if isinstance(value, str):
                    # Remove null bytes and limit length
                    clean_value = value.replace('\x00', '').strip()
                    sanitized_note[key] = clean_value[:100]  # Reasonable limit
                elif isinstance(value, (int, float, bool)):
                    sanitized_note[key] = value
                elif value is None:
                    sanitized_note[key] = None
                # Ignore complex objects/arrays to prevent injection

            sanitized_measure.append(sanitized_note)
        sanitized_measures.append(sanitized_measure)

    # Create the sanitized object with metadata preserved
    sanitized_data = {
        "measures": sanitized_measures,
        # Preserve metadata fields with basic sanitization
        "keySignature": str(song_data.get("keySignature", "C"))[:10],
        "tempo": max(20, min(300, float(song_data.get("tempo", 120)))),
        "timeSignature": song_data.get("timeSignature", {"numerator": 4, "denominator": 4}),
        "instrument": str(song_data.get("instrument", "piano"))[:50],
        "midiChannel": int(song_data.get("midiChannel", 0)),
        "isMinorChordMode": bool(song_data.get("isMinorChordMode", False))
    }

    return sanitized_data


@app.route('/convert-to-midi', methods=['POST'])
def convert_to_midi():
    temp_midi_path = None
    try:
        # Check content type
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 400

        song_data = request.get_json()
        if not song_data:
            return jsonify({'error': 'No song data provided'}), 400

        # Add debug logging
        logger.info(f"Received object with keys: {list(song_data.keys()) if isinstance(song_data, dict) else 'Not a dict'}")
        if isinstance(song_data, dict) and 'measures' in song_data:
            logger.info(f"Found {len(song_data['measures'])} measures")

        # Check size limits
        if len(str(song_data)) > 1024 * 1024:  # 1MB limit
            return jsonify({'error': 'Song data too large'}), 413

        # Validate against schema
        try:
            validate(instance=song_data, schema=SONG_DATA_SCHEMA)
        except jsonschema.exceptions.ValidationError as e:
            logger.error(f"Schema validation failed: {str(e)}")
            return jsonify({'error': f'Invalid song data format: {str(e)}'}), 400

        # Sanitize input
        try:
            sanitized_data = sanitize_for_ugly_midi(song_data)
        except ValueError as e:
            logger.error(f"Sanitization failed: {str(e)}")
            return jsonify({'error': str(e)}), 400

        # Process with ugly_midi - you may need to pass just the measures or the full object
        # depending on what your ugly_midi library expects
        midi_data = ugly_midi.json_to_midi(sanitized_data)

        # Create secure temporary file
        fd, temp_midi_path = tempfile.mkstemp(suffix='.mid', prefix='midi_')
        os.close(fd)

        ugly_midi.save_midi(midi_data, temp_midi_path)

        return send_file(temp_midi_path,
                         as_attachment=True,
                         download_name='score.mid',
                         mimetype='audio/midi')

    except Exception as e:
        logger.error(f"Error during MIDI conversion: {e}", exc_info=True)
        return jsonify({'error': 'Failed to convert to MIDI'}), 500

    finally:
        if temp_midi_path and os.path.exists(temp_midi_path):
            try:
                os.unlink(temp_midi_path)
            except Exception:
                pass


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
