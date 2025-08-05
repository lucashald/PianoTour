import os
import librosa
import numpy as np
import soundfile as sf # Required for saving WAV files

def get_peak_amplitude(audio_file):
    """
    Analyzes an audio file and returns its peak amplitude.
    (Reused from check_peak_volume_script)

    Args:
        audio_file (str): The path to the WAV file.

    Returns:
        float: The maximum absolute amplitude value (peak volume) of the audio,
               or None if an error occurs.
    """
    try:
        # Load the audio file. y will be a NumPy array of audio samples,
        # normalized typically between -1.0 and 1.0 by librosa.load().
        y, sr = librosa.load(audio_file, sr=None) # sr=None preserves original sample rate

        # The peak amplitude is the maximum absolute value in the audio time series.
        peak_amp = np.max(np.abs(y))
        return peak_amp, y, sr # Return y and sr as well for efficiency

    except Exception as e:
        print(f"Error processing {audio_file}: {e}")
        return None, None, None

def normalize_files_peak_amplitude(input_folder_path, output_folder_name='guitar', target_peak=0.9):
    """
    Iterates through all WAV files in an input folder, normalizes their peak amplitude,
    and saves them to a new output folder.

    Args:
        input_folder_path (str): The path to the folder containing the input WAV files.
        output_folder_name (str): The name of the subfolder where normalized files will be saved.
                                  This folder will be created inside input_folder_path.
        target_peak (float): The desired peak amplitude for all normalized files (0.0 to 1.0).
    """
    
    if not os.path.isdir(input_folder_path):
        print(f"Error: The input folder '{input_folder_path}' does not exist.")
        return

    output_folder_path = os.path.join(input_folder_path, output_folder_name)
    if not os.path.exists(output_folder_path):
        os.makedirs(output_folder_path)
        print(f"Created output folder: '{output_folder_path}'")

    print(f"Starting peak amplitude normalization for WAV files in: '{input_folder_path}'")
    print(f"Normalized files will be saved to: '{output_folder_path}' with target peak: {target_peak}\n")

    for filename in os.listdir(input_folder_path):
        if filename.lower().endswith(".wav"):
            input_filepath = os.path.join(input_folder_path, filename)
            output_filepath = os.path.join(output_folder_path, filename)

            # Get the peak amplitude and audio data
            current_peak, y, sr = get_peak_amplitude(input_filepath)

            if y is None or sr is None:
                print(f"Skipping '{filename}' due to loading error.")
                continue

            if current_peak == 0:
                print(f"Warning: '{filename}' is silent. Saving as is to '{output_filepath}'.")
                sf.write(output_filepath, y, sr)
                continue

            # Calculate the scaling factor needed to reach the target peak
            scale_factor = target_peak / current_peak

            # Apply the scaling to the audio data
            normalized_y = y * scale_factor

            # Clip values to ensure they don't exceed the target_peak due to
            # floating-point arithmetic, especially if target_peak is near 1.0.
            normalized_y = np.clip(normalized_y, -target_peak, target_peak)

            try:
                # Save the normalized audio to the output folder
                sf.write(output_filepath, normalized_y, sr)
                print(f"Normalized '{filename}' (Original Peak: {current_peak:.4f}) to Peak: {target_peak:.4f} -> '{output_filepath}'")
            except Exception as e:
                print(f"Error saving normalized file '{filename}': {e}")
        else:
            # Optionally, copy non-wav files or ignore them
            # For this script, we'll just ignore non-wav files
            pass

    print("\nPeak amplitude normalization process complete.")

# --- Main execution block ---
if __name__ == "__main__":
    # Set the folder containing your WAV files.
    # '.' refers to the current directory where the script is run.
    folder_to_process = '.' 

    # Run the normalization process
    normalize_files_peak_amplitude(folder_to_process)
