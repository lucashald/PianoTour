import os
import librosa
import numpy as np

def get_peak_amplitude(audio_file):
    """
    Analyzes an audio file and returns its peak amplitude.

    Args:
        audio_file (str): The path to the WAV file.

    Returns:
        float: The maximum absolute amplitude value (peak volume) of the audio,
               or None if an error occurs.
    """
    try:
        # Load the audio file. y will be a NumPy array of audio samples,
        # normalized typically between -1.0 and 1.0.
        y, sr = librosa.load(audio_file, sr=None)

        # The peak amplitude is the maximum absolute value in the audio time series.
        peak_amp = np.max(np.abs(y))
        return peak_amp

    except Exception as e:
        print(f"Error processing {audio_file}: {e}")
        return None

def check_files_peak_volume(folder_path):
    """
    Iterates through all WAV files in a folder and prints their detected peak amplitude.

    Args:
        folder_path (str): The path to the folder containing the WAV files.
    """

    if not os.path.isdir(folder_path):
        print(f"Error: The folder '{folder_path}' does not exist.")
        return

    print(f"Starting peak volume analysis for WAV files in: {folder_path}\n")

    for filename in os.listdir(folder_path):
        if filename.lower().endswith(".wav"): # Case-insensitive check for .wav
            filepath = os.path.join(folder_path, filename)

            # Get the peak amplitude of the file
            peak_volume = get_peak_amplitude(filepath)

            if peak_volume is not None:
                # The peak amplitude is usually between 0.0 and 1.0 after librosa.load()
                print(f"File: '{filename}' -> Peak Amplitude: {peak_volume:.4f}")
            else:
                print(f"File: '{filename}' -> Could not determine peak amplitude.")
    print("\nPeak volume analysis complete.")

# --- Main execution block ---
if __name__ == "__main__":
    # IMPORTANT: Replace 'path/to/your/folder' with the actual path to your folder of .wav files.
    # Examples:
    #   On Windows: folder_to_process = r'C:\Users\YourUser\Music\MyWavFiles'
    #   On macOS/Linux: folder_to_process = '/Users/YourUser/Music/MyWavFiles'
    #   If the script is in the same directory as your WAV files: folder_to_process = '.'
    #   If your WAV files are in a subfolder named 'audio_samples': folder_to_process = 'audio_samples'

    folder_to_process = '.' # Set this to your desired folder path

    check_files_peak_volume(folder_to_process)
