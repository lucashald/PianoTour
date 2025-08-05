import os
import librosa
import numpy as np

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
        # Using a typical musical range (C2 to C7) to help focus pitch detection.
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

def check_files_pitch(folder_path):
    """
    Iterates through all WAV files in a folder and prints their detected pitch.
    
    Args:
        folder_path (str): The path to the folder containing the WAV files.
    """
    
    if not os.path.isdir(folder_path):
        print(f"Error: The folder '{folder_path}' does not exist.")
        return

    print(f"Starting pitch analysis for WAV files in: {folder_path}\n")
    
    for filename in os.listdir(folder_path):
        if filename.lower().endswith(".wav"): # Use .lower() for case-insensitive check
            filepath = os.path.join(folder_path, filename)
            
            # Get the pitch of the file
            pitch = get_pitch(filepath)
            
            if pitch is not None:
                print(f"File: '{filename}' -> Detected Pitch: {pitch:.2f} Hz")
            else:
                print(f"File: '{filename}' -> Could not determine pitch.")
    print("\nPitch analysis complete.")

# --- Main execution block ---
if __name__ == "__main__":
    # IMPORTANT: Replace 'path/to/your/folder' with the actual path to your folder of .wav files.
    # Examples:
    #   On Windows: folder_to_process = r'C:\Users\YourUser\Music\MyWavFiles'
    #   On macOS/Linux: folder_to_process = '/Users/YourUser/Music/MyWavFiles'
    #   If the script is in the same directory as your WAV files: folder_to_process = '.'
    #   If your WAV files are in a subfolder named 'audio_samples': folder_to_process = 'audio_samples'
    
    folder_to_process = '.' # Set this to your desired folder path

    check_files_pitch(folder_to_process)
