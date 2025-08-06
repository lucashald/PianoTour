import os
import librosa
import numpy as np

# Define MIDI note numbers, their names, and center frequencies
# This data is based on the standard A4 = 440 Hz tuning system
# and covers a wide range of musical notes.
MIDI_NOTES = [
    (0, "C0", 16.35), (1, "C#0", 17.32), (2, "D0", 18.35), (3, "D#0", 19.45),
    (4, "E0", 20.60), (5, "F0", 21.83), (6, "F#0", 23.12), (7, "G0", 24.50),
    (8, "G#0", 25.96), (9, "A0", 27.50), (10, "A#0", 29.14), (11, "B0", 30.87),
    (12, "C1", 32.70), (13, "C#1", 34.65), (14, "D1", 36.71), (15, "D#1", 38.89),
    (16, "E1", 41.20), (17, "F1", 43.65), (18, "F#1", 46.25), (19, "G1", 49.00),
    (20, "G#1", 51.91), (21, "A1", 55.00), (22, "A#1", 58.27), (23, "B1", 61.74),
    (24, "C2", 65.41), (25, "C#2", 69.30), (26, "D2", 73.42), (27, "D#2", 77.78),
    (28, "E2", 82.41), (29, "F2", 87.31), (30, "F#2", 92.50), (31, "G2", 98.00),
    (32, "G#2", 103.83), (33, "A2", 110.00), (34, "A#2", 116.54), (35, "B2", 123.47),
    (36, "C3", 130.81), (37, "C#3", 138.59), (38, "D3", 146.83), (39, "D#3", 155.56),
    (40, "E3", 164.81), (41, "F3", 174.61), (42, "F#3", 185.00), (43, "G3", 196.00),
    (44, "G#3", 207.65), (45, "A3", 220.00), (46, "A#3", 233.08), (47, "B3", 246.94),
    (48, "C4", 261.63), (49, "C#4", 277.18), (50, "D4", 293.66), (51, "D#4", 311.13),
    (52, "E4", 329.63), (53, "F4", 349.23), (54, "F#4", 369.99), (55, "G4", 392.00),
    (56, "G#4", 415.30), (57, "A4", 440.00), (58, "A#4", 466.16), (59, "B4", 493.88),
    (60, "C5", 523.25), (61, "C#5", 554.37), (62, "D5", 587.33), (63, "D#5", 622.25),
    (64, "E5", 659.26), (65, "F5", 698.46), (66, "F#5", 739.99), (67, "G5", 783.99),
    (68, "G#5", 830.61), (69, "A5", 880.00), (70, "A#5", 932.33), (71, "B5", 987.77),
    (72, "C6", 1046.50), (73, "C#6", 1108.73), (74, "D6", 1174.66), (75, "D#6", 1244.51),
    (76, "E6", 1318.51), (77, "F6", 1396.91), (78, "F#6", 1479.98), (79, "G6", 1567.98),
    (80, "G#6", 1661.22), (81, "A6", 1760.00), (82, "A#6", 1864.66), (83, "B6", 1975.53),
    (84, "C7", 2093.00), (85, "C#7", 2217.46), (86, "D7", 2349.32), (87, "D#7", 2489.02),
    (88, "E7", 2637.02), (89, "F7", 2793.83), (90, "F#7", 2959.96), (91, "G7", 3135.96),
    (92, "G#7", 3322.44), (93, "A7", 3520.00), (94, "A#7", 3729.31), (95, "B7", 3951.07),
    (96, "C8", 4186.01), (97, "C#8", 4434.92), (98, "D8", 4698.64), (99, "D#8", 4978.03),
    (100, "E8", 5274.04), (101, "F8", 5587.65), (102, "F#8", 5919.91), (103, "G8", 6271.93),
    (104, "G#8", 6644.88), (105, "A8", 7040.00), (106, "A#8", 7458.62), (107, "B8", 7902.13)
]


def get_pitch(audio_file):
    """
    Analyzes an audio file and returns its fundamental frequency (pitch).
    
    Args:
        audio_file (str): The path to the WAV file.
        
    Returns:
        float: The median pitch of the audio in Hertz (Hz), or None if an error occurs.
    """
    try:
        # Load the audio file. sr=None preserves the original sampling rate.
        y, sr = librosa.load(audio_file, sr=None)
        
        # Estimate pitch using the pYIN algorithm.
        # Reverting fmin and fmax to a more typical musical range (C2 to C7)
        # to help prevent detection of lower, potentially spurious, fundamental frequencies.
        f0, voiced_flag, voiced_probs = librosa.pyin(y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'))
        
        # Filter out unvoiced (non-pitched) frames and take the median of the valid pitches.
        valid_pitches = f0[voiced_flag]
        
        if valid_pitches.size > 0:
            median_pitch = np.median(valid_pitches)
            return median_pitch
        else:
            return None
            
    except Exception as e:
        print(f"Error processing {audio_file}: {e}")
        return None


def pitch_to_note_name(pitch_hz, buffer_hz=1.0):
    """
    Converts a given pitch in Hertz to its closest musical note name,
    considering a buffer for slight deviations.
    
    Args:
        pitch_hz (float): The pitch in Hertz.
        buffer_hz (float): The allowed deviation in Hertz for a pitch to be
                           considered an exact match for a note's center frequency.
                           Defaults to 1.0 Hz.
                           
    Returns:
        str: The closest musical note name (e.g., "C2", "A#4"), or "Unknown"
             if the pitch is outside the defined MIDI note range.
    """
    if pitch_hz is None:
        return "Unknown"

    closest_note_name = "Unknown"
    min_difference = float('inf')

    for midi_num, note_name, center_freq in MIDI_NOTES:
        # Check if the pitch falls within the buffer range of the current note
        if abs(pitch_hz - center_freq) <= buffer_hz:
            return note_name  # Found an exact match within the buffer

        # If not an exact match, keep track of the closest note
        diff = abs(pitch_hz - center_freq)
        if diff < min_difference:
            min_difference = diff
            closest_note_name = note_name
            
    # If no note was found within the buffer, return the closest one
    return closest_note_name


def rename_files_by_note(folder_path):
    """
    Iterates through all WAV files in a folder and renames them based on their musical note pitch.
    
    Args:
        folder_path (str): The path to the folder containing the WAV files.
    """
    
    if not os.path.isdir(folder_path):
        print(f"Error: The folder '{folder_path}' does not exist.")
        return

    print(f"Starting to process WAV files in: {folder_path}")
    
    for filename in os.listdir(folder_path):
        if filename.lower().endswith(".wav"): # Use .lower() for case-insensitive check
            old_filepath = os.path.join(folder_path, filename)
            
            # Get the pitch of the file
            pitch = get_pitch(old_filepath)
            
            if pitch is not None:
                # Convert pitch to note name
                note_name = pitch_to_note_name(pitch, buffer_hz=1.0) # Using a 1 Hz buffer
                
                if note_name != "Unknown":
                    # Construct the new filename
                    new_filename = f"{note_name}.wav"
                    new_filepath = os.path.join(folder_path, new_filename)
                    
                    # Check if the new filename already exists (to prevent overwriting)
                    if os.path.exists(new_filepath) and old_filepath != new_filepath:
                        # Append a number if the filename already exists
                        base_name, ext = os.path.splitext(new_filename)
                        counter = 1
                        while os.path.exists(f"{base_name}_{counter}{ext}"):
                            counter += 1
                        new_filename = f"{base_name}_{counter}{ext}"
                        new_filepath = os.path.join(folder_path, new_filename)
                        print(f"Warning: '{note_name}.wav' already exists. Renaming '{filename}' to '{new_filename}'")

                    # Rename the file
                    try:
                        os.rename(old_filepath, new_filepath)
                        print(f"Renamed '{filename}' (Pitch: {pitch:.2f} Hz) to '{new_filename}'")
                    except OSError as e:
                        print(f"Error renaming {filename} to {new_filename}: {e}")
                else:
                    print(f"Could not determine a suitable note name for '{filename}' (Pitch: {pitch:.2f} Hz), skipping.")
            else:
                print(f"Could not determine pitch for '{filename}', skipping.")
    print("File renaming process complete.")

# --- Main execution block ---
if __name__ == "__main__":
    # IMPORTANT: Replace 'path/to/your/folder' with the actual path to your folder of .wav files.
    # Examples:
    #   On Windows: folder_to_process = r'C:\Users\YourUser\Music\MyWavFiles'
    #   On macOS/Linux: folder_to_process = '/Users/YourUser/Music/MyWavFiles'
    #   If the script is in the same directory as your WAV files: folder_to_process = '.'
    #   If your WAV files are in a subfolder named 'audio_samples': folder_to_process = 'audio_samples'
    
    folder_to_process = '.' # Set this to your desired folder path

    rename_files_by_note(folder_to_process)
