import os

def rename_steinway_files(directory_path):
    """
    Renames files in a given directory based on specific rules:
    - Replaces spaces with underscores (_).
    - Replaces opening parentheses '(' with underscores (_).
    - Removes closing parentheses ')'.

    Args:
        directory_path (str): The absolute or relative path to the folder
                              containing the files to be renamed.
    """
    # Verify that the provided path is actually a directory
    if not os.path.isdir(directory_path):
        print(f"Error: The path '{directory_path}' is not a valid directory.")
        return

    print(f"Scanning directory: {directory_path}\n")

    # Get a list of all items in the directory
    try:
        filenames = os.listdir(directory_path)
    except OSError as e:
        print(f"Error accessing the directory: {e}")
        return

    # Loop through each file in the directory
    for filename in filenames:
        # Create the new filename by applying the replacement rules
        # 1. Replace spaces with underscores
        new_name = filename.replace(' ', '_')
        # 2. Replace opening parenthesis with an underscore
        new_name = new_name.replace('(', '_')
        # 3. Remove the closing parenthesis
        new_name = new_name.replace(')', '')

        # Check if the new name is different from the old one
        if new_name != filename:
            # Construct the full path for both the old and new filenames
            old_file_path = os.path.join(directory_path, filename)
            new_file_path = os.path.join(directory_path, new_name)

            # Rename the file
            try:
                os.rename(old_file_path, new_file_path)
                print(f'Renamed: "{filename}"  ->  "{new_name}"')
            except OSError as e:
                print(f'Error renaming "{filename}": {e}')
        else:
            # Optional: uncomment the line below to see which files were not changed
            # print(f'Skipped (no changes): "{filename}"')
            pass

    print("\nFile renaming process complete.")

# --- Main execution block ---
if __name__ == "__main__":
    # Prompt the user to enter the path to their samples folder
    folder_path = input("Please enter the path to the folder containing your files: ")
    rename_steinway_files(folder_path)
