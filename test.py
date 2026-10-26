"""
DEVELOPMENT SERVER
This file is the development server and should be used for any testing or local development.
Do not deploy this file as the production server.
"""

from flask import Flask, render_template, request, send_file, jsonify, send_from_directory, redirect
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import re
import os
import io
import tempfile
import logging
from collections import defaultdict
import math
import json
from fractions import Fraction
import midi_tools
import jsonschema
from jsonschema import validate
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

# --- Basic Configuration ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Flask App Initialization ---
app = Flask(__name__)
limiter = Limiter(app=app, key_func=get_remote_address)

# --- MIDI conversion limits ---
MIDI_MAX_FILE_SIZE = 5 * 1024 * 1024   # 5 MB
MIDI_CONVERSION_TIMEOUT = 60           # seconds


def midi_to_json_data(midi_file_path):
    """
    MIDI → JSON conversion with timeout and memory-error protection.
    """
    try:
        logger.info("Converting MIDI to JSON with midi_tools")

        # Run conversion with a timeout
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(midi_tools.midi_to_json, midi_file_path)
            try:
                json_data = future.result(timeout=MIDI_CONVERSION_TIMEOUT)
            except FuturesTimeoutError:
                logger.error("MIDI conversion timed out after %ds", MIDI_CONVERSION_TIMEOUT)
                raise ValueError(
                    f"MIDI conversion timed out after {MIDI_CONVERSION_TIMEOUT} seconds. "
                    "The file may be too large or complex."
                )

        for warning in json_data.pop("warnings", []):
            logger.info("midi_tools: %s", warning)

        logger.info(
            "Converted MIDI to %d measures at %s BPM",
            len(json_data.get('measures', [])),
            json_data.get('tempo', 'unknown'),
        )

        return json_data
    except MemoryError:
        logger.error("MIDI conversion ran out of memory")
        raise ValueError(
            "The MIDI file is too large or complex — the server ran out of memory. "
            "Try a simpler or shorter MIDI file."
        )
    except ValueError:
        raise  # already formatted
    except Exception as e:
        logger.error("midi_tools failed to convert MIDI file: %s", e, exc_info=True)
        raise ValueError(f"Failed to convert MIDI file: {e}")

# --- Flask Routes ---

SHARE_API = "https://7vw7rxom9h.execute-api.us-east-1.amazonaws.com/default/pianotour-share"

@app.route('/share/<code>')
def share_redirect(code):
    if not re.fullmatch(r'PT-[a-z0-9]{8}', code):
        return jsonify({'error': 'Invalid share code'}), 400
    return redirect(f"{SHARE_API}?action=download&code={code}")


@app.route('/')
def index():
    return render_template('piano.html',
        hide_spectrum=False,
        meta_title='PianoTour - Interactive Piano Studio',
        meta_description='Play interactive piano, guitar, and drums online. Create and print musical scores.')

@app.route('/fret')
def fret():
    return render_template('fret.html', instrument='guitar')

@app.route('/playable-guitar')
def playable_guitar():
    return render_template('playable-guitar.html', instrument='guitar')

@app.route('/editor')
def editor():
    return render_template('editor.html', show_side_panel=True, disable_keyboard=True)

@app.route('/json')
def json_page():
    return render_template('json.html', show_side_panel=True, disable_keyboard=True)


@app.route('/extras')
def extras():
    return render_template('extras.html', show_side_panel=True)


@app.route('/print')
def print_page():
    return render_template('print.html')


@app.route('/practice')
def practice():
    return render_template('practice.html')

@app.route('/keyboard')
def keyboard():
    return render_template('keyboard.html')


@app.route('/guitar')
def guitar():
    """Guitar instrument route"""
    return render_template('guitar.html', instrument='guitar', show_side_panel=False)


@app.route('/cello')
def cello():
    """Guitar instrument route"""
    return render_template('cello.html', instrument='cello')

@app.route('/violin')
def violin():
    """Violin instrument route"""
    return render_template('violin.html', instrument='violin')

@app.route('/sax')
def sax():
    """Guitar instrument route"""
    return render_template('sax.html', instrument='sax')

@app.route('/french_horn')
def french_horn():
    """French Horn instrument route"""
    return render_template('french_horn.html', instrument='french_horn')

@app.route('/clarinet')
def clarinet():
    """Clarinet instrument route"""
    return render_template('clarinet.html', instrument='clarinet')

@app.route('/harp')
def harp():
    """Harp instrument route"""
    return render_template('harp.html', instrument='harp')

@app.route('/bass')
def bass():
    """Bass instrument route"""
    return render_template('bass.html', instrument='bass')

@app.route('/drums')
def drums():
    """Drums instrument route"""
    return render_template('drums.html', hide_spectrum=False, hide_instrument=False, hide_score=False)


@app.route('/player')
def player():
    return render_template('player.html')


@app.route('/testplayer')
def testplayer():
    return render_template('testplayer.html')

@app.route('/chords')
def chords():
    """Chords page"""
    return render_template('chords.html', show_side_panel=True)

@app.route('/chordmode')
def chord_mode():
    """Chord mode page"""
    return render_template('chordMode.html', show_side_panel=True)

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
    return jsonify({'success': True})


@app.route('/soundfonts')
def soundfont():
    return jsonify([{'name': '/static/soundfonts/default.sf3'}])


@app.route('/setlastsf2')
def set_last_sf2():
    """SpessaSynth reports the selected SoundFont here; nothing to store."""
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

# Permissive schema: midi_tools turns odd values into warnings rather than failing.
# Accepts the full object with metadata + measures.
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


def _sanitize_tie(tie):
    """Keep a tie/slur link only if it's exactly {type, startNoteId, endNoteId}."""
    if (tie.get("type") in ("tie", "slur")
            and isinstance(tie.get("startNoteId"), str) and isinstance(tie.get("endNoteId"), str)):
        return {
            "type": tie["type"],
            "startNoteId": tie["startNoteId"][:100],
            "endNoteId": tie["endNoteId"][:100],
        }
    return None


def sanitize_song_data(song_data):
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
                elif key == "tie" and isinstance(value, dict):
                    tie = _sanitize_tie(value)
                    if tie:
                        sanitized_note[key] = tie
                # Ignore other complex objects/arrays to prevent injection

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
@limiter.limit("10 per minute")
def convert_to_midi():
    temp_midi_path = None
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 400

        if request.content_length and request.content_length > 1024 * 1024:
            return jsonify({'error': 'Song data too large'}), 413

        song_data = request.get_json()
        if not song_data:
            return jsonify({'error': 'No song data provided'}), 400

        logger.info(f"Converting to MIDI: {len(song_data.get('measures', []))} measures at {song_data.get('tempo', 120)} BPM")

        try:
            validate(instance=song_data, schema=SONG_DATA_SCHEMA)
        except jsonschema.exceptions.ValidationError as e:
            logger.error(f"Schema validation failed: {str(e)}")
            return jsonify({'error': 'Invalid song data format'}), 400

        sanitized_data = sanitize_song_data(song_data)

        fd, temp_midi_path = tempfile.mkstemp(suffix='.mid', prefix='midi_')
        os.close(fd)

        # Run conversion with a timeout
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(midi_tools.json_to_midi, sanitized_data, temp_midi_path)
            try:
                warnings = future.result(timeout=MIDI_CONVERSION_TIMEOUT)
            except FuturesTimeoutError:
                logger.error("MIDI conversion timed out after %ds", MIDI_CONVERSION_TIMEOUT)
                return jsonify({'error': f'Conversion timed out after {MIDI_CONVERSION_TIMEOUT}s.'}), 500
        for warning in warnings:
            logger.info("midi_tools: %s", warning)

        return send_file(temp_midi_path,
                         as_attachment=True,
                         download_name='score.mid',
                         mimetype='audio/midi')

    except MemoryError:
        logger.error("Out of memory during MIDI conversion")
        return jsonify({'error': 'The server ran out of memory. Try fewer measures.'}), 500
    except Exception as e:
        logger.error(f"Error during MIDI conversion: {e}", exc_info=True)
        return jsonify({'error': f'Failed to convert to MIDI: {str(e)}'}), 500

    finally:
        if temp_midi_path and os.path.exists(temp_midi_path):
            try:
                os.unlink(temp_midi_path)
            except Exception:
                pass
                
@app.route('/convert-to-json', methods=['POST'])
@limiter.limit("10 per minute")
def convert_to_json():
    if 'midiFile' not in request.files:
        return jsonify({'error': 'No MIDI file provided.'}), 400
    file = request.files['midiFile']
    if file.filename == '':
        return jsonify({'error': 'No file selected.'}), 400

    # --- File-size guard ---
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    if file_size > MIDI_MAX_FILE_SIZE:
        return jsonify({
            'error': f'MIDI file is too large ({file_size / 1024 / 1024:.1f} MB). '
                     f'Maximum allowed size is {MIDI_MAX_FILE_SIZE / 1024 / 1024:.0f} MB.'
        }), 413

    # --- Magic bytes guard ---
    file_header = file.read(4)
    file.seek(0)
    if file_header != b'MThd':
        return jsonify({'error': 'File does not appear to be a valid MIDI file'}), 400

    temp_midi_path = None
    try:
        fd, temp_midi_path = tempfile.mkstemp(suffix='.mid')
        os.close(fd)
        file.save(temp_midi_path)
        json_data = midi_to_json_data(temp_midi_path)
        return jsonify(json_data)
    except MemoryError:
        logger.error("Out of memory during JSON conversion")
        return jsonify({
            'error': 'The server ran out of memory processing this MIDI file. '
                     'Try a simpler or shorter file.'
        }), 500
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


@app.route('/extract-midi', methods=['POST'])
@limiter.limit("10 per minute")
def extract_midi():
    """Stage 1: Extract raw notes per-track + tempo/measure grid (no quantization)."""
    if 'midiFile' not in request.files:
        return jsonify({'error': 'No MIDI file provided.'}), 400
    file = request.files['midiFile']
    if file.filename == '':
        return jsonify({'error': 'No file selected.'}), 400

    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    if file_size > MIDI_MAX_FILE_SIZE:
        return jsonify({
            'error': f'MIDI file is too large ({file_size / 1024 / 1024:.1f} MB). '
                     f'Maximum allowed size is {MIDI_MAX_FILE_SIZE / 1024 / 1024:.0f} MB.'
        }), 413

    # --- Magic bytes guard ---
    file_header = file.read(4)
    file.seek(0)
    if file_header != b'MThd':
        return jsonify({'error': 'File does not appear to be a valid MIDI file'}), 400

    temp_midi_path = None
    try:
        fd, temp_midi_path = tempfile.mkstemp(suffix='.mid')
        os.close(fd)
        file.save(temp_midi_path)

        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(midi_tools.extract, temp_midi_path)
            try:
                raw_data = future.result(timeout=MIDI_CONVERSION_TIMEOUT)
            except FuturesTimeoutError:
                logger.error("MIDI extraction timed out after %ds", MIDI_CONVERSION_TIMEOUT)
                return jsonify({'error': f'MIDI extraction timed out after {MIDI_CONVERSION_TIMEOUT}s.'}), 500

        return jsonify(raw_data)
    except MemoryError:
        logger.error("Out of memory during MIDI extraction")
        return jsonify({'error': 'The server ran out of memory. Try a simpler file.'}), 500
    except Exception as e:
        logger.error(f"Error during MIDI extraction: {e}", exc_info=True)
        return jsonify({'error': f'Failed to extract MIDI data: {str(e)}'}), 500
    finally:
        if temp_midi_path and os.path.exists(temp_midi_path):
            try:
                os.unlink(temp_midi_path)
            except Exception:
                pass


@app.route('/quantize-tracks', methods=['POST'])
@limiter.limit("10 per minute")
def quantize_tracks():
    """Stage 2: Quantize selected tracks into VexFlow JSON."""
    try:
        if request.content_length and request.content_length > 10 * 1024 * 1024:
            return jsonify({'error': 'Payload too large'}), 413

        payload = request.get_json()
        if not payload:
            return jsonify({'error': 'No JSON payload provided.'}), 400

        raw_data = payload.get('rawData')
        if not raw_data:
            return jsonify({'error': 'Missing rawData field.'}), 400

        track_indices = payload.get('trackIndices')  # None = all non-drum tracks
        if track_indices is not None and not (
                isinstance(track_indices, list)
                and all(isinstance(i, int) and not isinstance(i, bool) for i in track_indices)):
            return jsonify({'error': 'trackIndices must be a list of track numbers.'}), 400

        # Quantize grid in beats; a multiple of a 32nd note (0.125).
        quantize_resolution = payload.get('quantizeResolution', 0.125)
        if isinstance(quantize_resolution, bool) or not isinstance(quantize_resolution, (int, float)):
            return jsonify({'error': 'quantizeResolution must be a number.'}), 400
        grid = Fraction(quantize_resolution).limit_denominator(64)
        if not 0 < grid <= 4 or grid % Fraction(1, 8):
            return jsonify({'error': 'quantizeResolution must be a multiple of 0.125, up to 4.'}), 400

        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(midi_tools.quantize_json, raw_data, track_indices, grid=grid)
            try:
                json_data = future.result(timeout=MIDI_CONVERSION_TIMEOUT)
            except FuturesTimeoutError:
                logger.error("Track quantization timed out after %ds", MIDI_CONVERSION_TIMEOUT)
                return jsonify({'error': f'Quantization timed out after {MIDI_CONVERSION_TIMEOUT}s.'}), 500
            except ValueError as e:
                # Bad raw data or track choice: the request's fault, not the server's.
                return jsonify({'error': str(e)}), 400

        for warning in json_data.pop('warnings', []):
            logger.info("midi_tools: %s", warning)
        return jsonify(json_data)
    except MemoryError:
        logger.error("Out of memory during track quantization")
        return jsonify({'error': 'The server ran out of memory. Try fewer tracks.'}), 500
    except Exception as e:
        logger.error(f"Error during track quantization: {e}", exc_info=True)
        return jsonify({'error': f'Failed to quantize tracks: {str(e)}'}), 500


@app.route('/health')
def health_check():
    return jsonify({'status': 'ok'})


@app.route('/settings')
def settings():
    return render_template('settings.html', show_side_panel=True)

@app.route('/sitemap.xml')
def sitemap():
    return send_from_directory('static', 'sitemap.xml')

@app.route('/chordPreview')
def chord_preview():
    return render_template('chordPreview.html')

@app.route('/robots.txt')
def robots():
    return send_from_directory('static', 'robots.txt')

# --- Main Execution ---
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=4000)