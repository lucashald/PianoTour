from flask import Flask, render_template, request, send_file, jsonify, redirect, url_for
import mido
from mido import MidiFile, MidiTrack, Message
import os
import tempfile
import logging

app = Flask(__name__)

# Define your preferred canonical domain
CANONICAL_DOMAIN = "www.pianotour.com" # Or "www.pianotour.com"

@app.before_request
def redirect_to_canonical():
    # Only redirect if not on the canonical domain and it's a GET request (to avoid issues with POSTs)
    if request.method == 'GET' and request.host != CANONICAL_DOMAIN:
        # Reconstruct the URL with the canonical domain and current path/query
        # Ensure it's HTTPS
        canonical_url = f"https://{CANONICAL_DOMAIN}{request.full_path}"
        return redirect(canonical_url, code=301) # 301 Permanent Redirect


# --- Basic Configuration ---
# Configure logging to show info-level messages.
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
TICKS_PER_BEAT = 480  # Standard MIDI ticks per beat

# Duration mappings
DURATION_TO_TICKS_MAP = {
    'w': TICKS_PER_BEAT * 4,      # whole note
    'h': TICKS_PER_BEAT * 2,      # half note
    'q': TICKS_PER_BEAT,          # quarter note
    '8': TICKS_PER_BEAT // 2,     # eighth note
    '16': TICKS_PER_BEAT // 4,    # sixteenth note
    '32': TICKS_PER_BEAT // 8,    # thirty-second note
    'w.': int(TICKS_PER_BEAT * 6),    # dotted whole (6 beats)
    'h.': int(TICKS_PER_BEAT * 3),    # dotted half (3 beats)
    'q.': int(TICKS_PER_BEAT * 1.5),  # dotted quarter (1.5 beats)
    '8.': int(TICKS_PER_BEAT * 0.75), # dotted eighth (0.75 beats)
    '16.': int(TICKS_PER_BEAT * 0.375), # dotted sixteenth (0.375 beats)
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
    sorted_durations = sorted(DURATION_TO_TICKS_MAP.items(), key=lambda x: x[1], reverse=True)
    
    # Find exact or close match
    for duration_symbol, duration_ticks in sorted_durations:
        if abs(ticks - duration_ticks) <= tolerance:
            return duration_symbol
    
    # If no close match found, find the closest duration
    closest_duration = min(sorted_durations, key=lambda x: abs(x[1] - ticks))
    logger.warning(f"No exact match for {ticks} ticks, using closest: {closest_duration[0]} ({closest_duration[1]} ticks)")
    return closest_duration[0]


def split_duration_across_measures(duration_ticks, remaining_space_in_measure, ticks_per_measure):
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
        available_durations = [(symbol, ticks) for symbol, ticks in DURATION_TO_TICKS_MAP.items() if ticks <= current_space]
        
        if not available_durations:
            # No duration fits in current space, move to next measure
            current_space = ticks_per_measure
            continue
        
        # Choose the duration that best fits the remaining duration
        best_duration = min(available_durations, key=lambda x: abs(x[1] - min(remaining_duration, current_space)))
        duration_symbol, actual_ticks = best_duration
        
        parts.append(duration_symbol)
        remaining_duration -= actual_ticks
        current_space -= actual_ticks
        
        # If we've filled the measure, prepare for the next one
        if current_space <= 0:
            current_space = ticks_per_measure
    
    if iteration_count >= max_iterations:
        logger.warning(f"Split duration hit max iterations. Remaining duration: {remaining_duration}")
    
    return parts


def midi_to_json_data(midi_file_path):
    """
    Converts a MIDI file to the app's JSON format with robust logic for duration,
    clef, and measure construction to prevent VexFlow errors.
    Now includes measure numbers in the output.
    """
    try:
        mid = MidiFile(midi_file_path)
    except Exception as e:
        logger.error(f"Mido failed to parse MIDI file: {e}")
        raise ValueError("Invalid or corrupted MIDI file.")

    midi_ticks_per_beat = mid.ticks_per_beat or TICKS_PER_BEAT
    normalization_factor = TICKS_PER_BEAT / midi_ticks_per_beat

    # --- Step 1: Extract Time Signature and Note Events ---
    time_signature_numerator = 4
    time_signature_denominator = 4
    all_events = []
    
    for i, track in enumerate(mid.tracks):
        absolute_time = 0
        for msg in track:
            absolute_time += msg.time
            if msg.is_meta and msg.type == 'time_signature':
                time_signature_numerator = msg.numerator
                time_signature_denominator = msg.denominator
                logger.info(f"Time signature: {time_signature_numerator}/{time_signature_denominator}")
            if msg.type in ['note_on', 'note_off']:
                all_events.append({
                    'type': msg.type, 'note': msg.note, 'velocity': msg.velocity,
                    'time': absolute_time, 'track': i
                })
    
    all_events.sort(key=lambda e: e['time'])
    logger.info(f"Total events: {len(all_events)}")

    # --- Step 2: Convert Events into Normalized Timed Notes ---
    notes_on = {}
    timed_notes = []
    
    for event in all_events:
        key = (event['note'], event['track'])
        if event['type'] == 'note_on' and event['velocity'] > 0:
            notes_on[key] = event
        elif event['type'] == 'note_off' or (event['type'] == 'note_on' and event['velocity'] == 0):
            if key in notes_on:
                note_on_event = notes_on.pop(key)
                duration_ticks = event['time'] - note_on_event['time']
                if duration_ticks > 0:
                    normalized_duration = duration_ticks * normalization_factor
                    timed_notes.append({
                        'midiNotes': [event['note']],
                        'clef': 'bass' if event['note'] < 60 else 'treble',
                        'start_time': note_on_event['time'] * normalization_factor,
                        'duration_ticks': normalized_duration,
                        'isRest': False
                    })
    
    # Handle any notes that were turned on but never turned off
    for key, note_on_event in notes_on.items():
        logger.warning(f"Note {key} was turned on but never turned off")
        # Add with a default duration
        default_duration = TICKS_PER_BEAT  # quarter note
        timed_notes.append({
            'midiNotes': [note_on_event['note']],
            'clef': 'bass' if note_on_event['note'] < 60 else 'treble',
            'start_time': note_on_event['time'] * normalization_factor,
            'duration_ticks': default_duration,
            'isRest': False
        })
    
    timed_notes.sort(key=lambda x: x['start_time'])
    logger.info(f"Total timed notes: {len(timed_notes)}")

    # --- Step 3: Group Simultaneous Notes into Chords ---
    if not timed_notes:
        logger.warning("No timed notes found")
        return []
    
    chord_groups = []
    CHORD_TOLERANCE_TICKS = 20
    current_chord = [timed_notes[0]]
    
    for i in range(1, len(timed_notes)):
        if abs(timed_notes[i]['start_time'] - current_chord[0]['start_time']) <= CHORD_TOLERANCE_TICKS:
            current_chord.append(timed_notes[i])
        else:
            # Process current chord
            combined_midi_notes = [note['midiNotes'][0] for note in current_chord]
            avg_duration = sum(note['duration_ticks'] for note in current_chord) / len(current_chord)
            # Clef decision based on lowest note for bass clef dominance
            clef = 'bass' if min(combined_midi_notes) < 60 else 'treble'
            chord_groups.append({
                'midiNotes': combined_midi_notes,
                'clef': clef,
                'start_time': current_chord[0]['start_time'],
                'duration_ticks': avg_duration,
                'isRest': False
            })
            current_chord = [timed_notes[i]]
    
    # Don't forget the last chord
    if current_chord:
        combined_midi_notes = [note['midiNotes'][0] for note in current_chord]
        avg_duration = sum(note['duration_ticks'] for note in current_chord) / len(current_chord)
        clef = 'bass' if min(combined_midi_notes) < 60 else 'treble'
        chord_groups.append({
            'midiNotes': combined_midi_notes,
            'clef': clef,
            'start_time': current_chord[0]['start_time'],
            'duration_ticks': avg_duration,
            'isRest': False
        })
    
    logger.info(f"Total chord groups: {len(chord_groups)}")

    # --- Step 4: Build Measures with Robust Logic ---
    if not chord_groups:
        return []

    ticks_per_measure = TICKS_PER_BEAT * time_signature_numerator * (4 / time_signature_denominator)
    logger.info(f"Ticks per measure: {ticks_per_measure}")
    
    song_data = []
    time_cursor = 0
    current_measure = []
    current_measure_ticks = 0
    current_measure_number = 1  # Start measure numbering from 1
    
    def add_measure_if_needed():
        nonlocal current_measure, current_measure_ticks, current_measure_number
        if current_measure:
            # Fill remaining space with rest if needed
            remaining_ticks = ticks_per_measure - current_measure_ticks
            if remaining_ticks > 0:
                rest_duration = ticks_to_duration_symbol(remaining_ticks)
                current_measure.append({
                    'isRest': True,
                    'duration': rest_duration,
                    'measure': current_measure_number - 1  # 0-based measure numbering
                })
            
            song_data.append(current_measure)
            current_measure = []
            current_measure_ticks = 0
            current_measure_number += 1
    
    def add_item_to_current_measure(item, duration_ticks):
        nonlocal current_measure_ticks
        
        remaining_space = ticks_per_measure - current_measure_ticks
        duration_symbol = ticks_to_duration_symbol(duration_ticks)
        actual_duration_ticks = DURATION_TO_TICKS_MAP.get(duration_symbol, 0)
        
        if actual_duration_ticks <= remaining_space:
            # Item fits in current measure
            item_copy = item.copy()
            item_copy['duration'] = duration_symbol
            item_copy['measure'] = current_measure_number - 1  # 0-based measure numbering
            current_measure.append(item_copy)
            current_measure_ticks += actual_duration_ticks
        else:
            # Item needs to be split across measures
            duration_parts = split_duration_across_measures(duration_ticks, remaining_space, ticks_per_measure)
            
            for i, duration_symbol in enumerate(duration_parts):
                # If current measure is full, start a new one
                if current_measure_ticks >= ticks_per_measure:
                    add_measure_if_needed()
                
                item_copy = item.copy()
                item_copy['duration'] = duration_symbol
                item_copy['measure'] = current_measure_number - 1  # 0-based measure numbering
                
                # Add tie if this is not the last part
                if i < len(duration_parts) - 1:
                    item_copy['tied'] = True
                
                current_measure.append(item_copy)
                current_measure_ticks += DURATION_TO_TICKS_MAP.get(duration_symbol, 0)
    
    # Process all chord groups
    for item in chord_groups:
        # Add rest if there's a gap
        rest_duration = item['start_time'] - time_cursor
        if rest_duration > 1:  # Small tolerance
            add_item_to_current_measure({'isRest': True}, rest_duration)
        
        # Add the note/chord
        add_item_to_current_measure(item, item['duration_ticks'])
        
        # Update time cursor
        time_cursor = item['start_time'] + item['duration_ticks']
    
    # Add the last measure if it has content
    add_measure_if_needed()
    
    # Validation and logging
    logger.info(f"Generated {len(song_data)} measures")
    for i, measure in enumerate(song_data[:3]):  # Print first 3 measures for debugging
        total_ticks = sum(DURATION_TO_TICKS_MAP.get(n.get('duration'), 0) for n in measure)
        logger.info(f"Measure {i}: {len(measure)} items, {total_ticks}/{ticks_per_measure} ticks")
        for j, item in enumerate(measure):
            if item.get('isRest'):
                logger.info(f"  Rest: {item.get('duration', 'unknown duration')} measure:{item.get('measure', 'unknown')}")
            else:
                logger.info(f"  Note: {item.get('midiNotes', [])} clef:{item.get('clef')} duration:{item.get('duration', 'unknown')} measure:{item.get('measure', 'unknown')}")
    
    return song_data

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
            duration_in_ticks = duration_to_ticks(note_info.get('duration', 'q'))
            if note_info.get('isRest', False):
                current_time_in_ticks += duration_in_ticks
            else:
                midi_notes = note_info.get('midiNotes', [])
                if not midi_notes: 
                    continue
                velocity = get_velocity(note_info)
                channel = 1 if note_info.get('clef') == 'bass' else 0
                for midi_note in midi_notes:
                    if isinstance(midi_note, (int, float)) and 0 <= midi_note <= 127:
                        events.append({'type': 'note_on', 'note': int(midi_note), 'velocity': velocity, 'channel': channel, 'time': current_time_in_ticks})
                        events.append({'type': 'note_off', 'note': int(midi_note), 'velocity': 64, 'channel': channel, 'time': current_time_in_ticks + duration_in_ticks})
                current_time_in_ticks += duration_in_ticks
    
    events.sort(key=lambda e: e['time'])
    last_event_time = 0
    for event in events:
        delta_time = event['time'] - last_event_time
        track.append(Message(event['type'], note=event['note'], velocity=event['velocity'], channel=event['channel'], time=delta_time))
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
    return render_template('index.html')

@app.route('/editor')
def editor():
    return render_template('editor.html')

@app.route('/print')
def print():
    return render_template('print.html')

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


@app.route('/convert-to-midi', methods=['POST'])
def convert_to_midi():
    temp_midi_path = None
    try:
        song_data = request.json
        if not song_data:
            return jsonify({'error': 'No song data provided'}), 400
        midi_file = create_piano_midi(song_data)
        fd, temp_midi_path = tempfile.mkstemp(suffix='.mid')
        os.close(fd)
        midi_file.save(temp_midi_path)
        return send_file(temp_midi_path, as_attachment=True, download_name='score.mid', mimetype='audio/midi')
    except Exception as e:
        logger.error(f"Error during MIDI conversion: {e}", exc_info=True)
        return jsonify({'error': f'Failed to convert to MIDI: {str(e)}'}), 500
    finally:
        if temp_midi_path and os.path.exists(temp_midi_path):
            try:
                os.unlink(temp_midi_path)
            except Exception as cleanup_error:
                logger.warning(f"Failed to clean up temp file: {cleanup_error}")

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
        return jsonify({'error': f'Failed to convert MIDI to JSON: {str(e)}'}), 500
    finally:
        if temp_midi_path and os.path.exists(temp_midi_path):
            try:
                os.unlink(temp_midi_path)
            except Exception as cleanup_error:
                logger.warning(f"Failed to clean up temp file: {cleanup_error}")

@app.route('/health')
def health_check():
    return jsonify({'status': 'ok'})