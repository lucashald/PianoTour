#!/usr/bin/env python3
"""
Script to crop SVG files to their actual content bounds.
Creates new versions with '-cropped' suffix.
"""

import os
import re
from pathlib import Path

# Directory containing the SVGs
SVG_DIR = Path(__file__).parent

# Patterns for files to crop (notes and rests only)
CROP_PATTERNS = [
    r'^note-.*\.svg$',
    r'^rest-.*\.svg$',
]

# Padding to add around the content (in SVG units)
PADDING = 5


def parse_path_bounds(path_d):
    """
    Parse an SVG path 'd' attribute and extract approximate bounding box.
    This is a simplified parser that handles M, L, C, and numeric coordinates.
    """
    if not path_d:
        return None
    
    min_x, min_y = float('inf'), float('inf')
    max_x, max_y = float('-inf'), float('-inf')
    
    # Extract all numbers from the path
    # This is a simplified approach - we just grab all coordinate pairs
    numbers = re.findall(r'[-+]?\d*\.?\d+', path_d)
    
    if len(numbers) < 2:
        return None
    
    # Process numbers as x,y pairs
    i = 0
    while i < len(numbers) - 1:
        try:
            x = float(numbers[i])
            y = float(numbers[i + 1])
            
            # Skip very large numbers that might be flags or other values
            if abs(x) < 1000 and abs(y) < 1000:
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)
            
            i += 2
        except (ValueError, IndexError):
            i += 1
    
    if min_x == float('inf') or min_y == float('inf'):
        return None
    
    return (min_x, min_y, max_x, max_y)


def get_svg_content_bounds(svg_content):
    """
    Analyze SVG content and find the bounding box of all path elements.
    """
    min_x, min_y = float('inf'), float('inf')
    max_x, max_y = float('-inf'), float('-inf')
    
    # Find all path elements and their 'd' attributes
    path_pattern = r'<path[^>]*\sd="([^"]*)"[^>]*>'
    paths = re.findall(path_pattern, svg_content)
    
    for path_d in paths:
        bounds = parse_path_bounds(path_d)
        if bounds:
            min_x = min(min_x, bounds[0])
            min_y = min(min_y, bounds[1])
            max_x = max(max_x, bounds[2])
            max_y = max(max_y, bounds[3])
    
    # Also check for line elements (stems)
    line_pattern = r'd="M([\d.]+)\s+([\d.]+)L([\d.]+)\s+([\d.]+)"'
    lines = re.findall(line_pattern, svg_content)
    for line in lines:
        try:
            x1, y1, x2, y2 = map(float, line)
            min_x = min(min_x, x1, x2)
            max_x = max(max_x, x1, x2)
            min_y = min(min_y, y1, y2)
            max_y = max(max_y, y1, y2)
        except ValueError:
            pass
    
    if min_x == float('inf') or min_y == float('inf'):
        return None
    
    return (min_x, min_y, max_x, max_y)


def crop_svg(input_path, output_path, padding=PADDING):
    """
    Read an SVG, calculate tight bounds, and save a cropped version.
    """
    with open(input_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Get content bounds
    bounds = get_svg_content_bounds(content)
    if not bounds:
        print(f"  Could not determine bounds for {input_path.name}, skipping")
        return False
    
    min_x, min_y, max_x, max_y = bounds
    
    # Add padding
    min_x -= padding
    min_y -= padding
    max_x += padding
    max_y += padding
    
    # Calculate new dimensions
    new_width = max_x - min_x
    new_height = max_y - min_y
    
    # Create new viewBox
    new_viewbox = f"{min_x:.1f} {min_y:.1f} {new_width:.1f} {new_height:.1f}"
    
    # Replace the SVG attributes
    # Match: width="120" height="120" viewBox="0 0 120 120"
    new_content = re.sub(
        r'width="[\d.]+" height="[\d.]+" viewBox="[^"]+"',
        f'width="{new_width:.0f}" height="{new_height:.0f}" viewBox="{new_viewbox}"',
        content
    )
    
    # Also update the inline style if present
    new_content = re.sub(
        r'style="width: [\d.]+px; height: [\d.]+px;"',
        f'style="width: {new_width:.0f}px; height: {new_height:.0f}px;"',
        new_content
    )
    
    # Write the cropped version
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"  {input_path.name} -> {output_path.name}")
    print(f"    Original: 120x120, New: {new_width:.0f}x{new_height:.0f}")
    print(f"    ViewBox: {new_viewbox}")
    
    return True


def should_crop(filename):
    """Check if a file should be cropped based on patterns."""
    for pattern in CROP_PATTERNS:
        if re.match(pattern, filename):
            return True
    return False


def main():
    print("SVG Cropping Script")
    print("=" * 50)
    print(f"Processing directory: {SVG_DIR}")
    print(f"Padding: {PADDING}px")
    print()
    
    # Find all SVG files that match our patterns
    svg_files = [f for f in SVG_DIR.glob('*.svg') if should_crop(f.name)]
    
    # Filter out already-cropped files
    svg_files = [f for f in svg_files if '-cropped' not in f.name]
    
    print(f"Found {len(svg_files)} files to process")
    print()
    
    success_count = 0
    for svg_file in sorted(svg_files):
        # Create output filename with -cropped suffix
        output_name = svg_file.stem + '-cropped' + svg_file.suffix
        output_path = SVG_DIR / output_name
        
        if crop_svg(svg_file, output_path):
            success_count += 1
    
    print()
    print(f"Successfully cropped {success_count}/{len(svg_files)} files")
    print("Cropped files saved with '-cropped' suffix")


if __name__ == '__main__':
    main()
