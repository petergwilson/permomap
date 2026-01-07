#!/usr/bin/env python3
"""
Parse the track maintenance schedule PDF and extract tracks updated in 2025.
Uses table extraction to get the 'Track' field directly from the PDF table.
"""

import pypdf
import re
from datetime import datetime

def parse_pdf(pdf_path):
    """Extract and parse the track maintenance schedule using table extraction."""
    pdf = pypdf.PdfReader(pdf_path)
    
    tracks = []
    
    # Process each page
    for page_num, page in enumerate(pdf.pages):
        # Extract text for the page
        text = page.extract_text()
        
        # Try to identify table structure by looking for the header
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        
        # Find where the table starts
        table_start = None
        for i, line in enumerate(lines):
            if 'Track' in line and 'Current Condition' in line:
                table_start = i + 1
                break
        
        if table_start is None:
            continue
        
        # Parse table rows
        # The format appears to be:
        # Track name (could be multi-line)
        # Current condition (paragraph)
        # Last cut
        # Importance
        # Custodian
        # Next cut
        # (repeat)
        
        i = table_start
        while i < len(lines):
            line = lines[i]
            
            # Skip empty lines
            if not line:
                i += 1
                continue
            
            # Check if this is a track name
            if is_track_name_line(line):
                # Clean up track name by truncating at descriptive words
                track_name = clean_track_name(line)
                track_data = []
                
                # Collect following lines until next track name
                i += 1
                while i < len(lines) and not is_track_name_line(lines[i]):
                    if lines[i]:
                        track_data.append(lines[i])
                    i += 1
                
                tracks.append({
                    'name': track_name,
                    'data': ' '.join(track_data)
                })
            else:
                i += 1
    
    return tracks

def clean_track_name(name):
    """
    Clean track name by truncating at descriptive words or location prepositions.
    E.g., "Mt Browne Hut track from Taipo River" -> "Mt Browne Hut track"
    """
    # Truncate at these words which typically follow the track name
    truncate_at = [
        r'\s+from\b',
        r'\s+to\b',
        r'\s+via\b',
        r'\s+up\b',
        r'\s+down\b',
        r'\s+onto\b',
        r'\s+as\s+marked\b',
        r'\s+marked\s+on\b',
        r'\s+\(as\b',
    ]
    
    for pattern in truncate_at:
        match = re.search(pattern, name, re.IGNORECASE)
        if match:
            return name[:match.start()].strip()
    
    return name.strip()

def is_track_name_line(line):
    """
    Determine if a line is a track name from the 'Track' column.
    Track names are specific and end with keywords like:
    - Hut track, Hut route, Hut
    - Biv track, Biv route, Biv  
    - tops track, tops route, tops
    - Ridge track, Ridge route, Ridge
    - Creek track, Creek, Valley track, etc.
    """
    if not line or len(line) > 150:
        return False
    
    # Must start with uppercase
    if not line[0].isupper():
        return False
    
    # Skip all caps (headers)
    if line.isupper():
        return False
    
    # Lines that start with these are NOT track names (they're conditions/descriptions)
    not_track_starters = ['Good', 'OK', 'Reasonable', 'Overgrown', 
                         'Followable', 'Needs', 'Overgrowing',
                         'Condition', 'Trimmed', 'Windfall',
                         'Pretty', 'Should', 'Reasonably', 'Most', 'Some',
                         'Being', 'Last', 'Cut', 'High', 'Medium', 'Low',
                         'DOC', 'CTC', 'Permolat', 'Winter', 'Summer', 'Ongoing',
                         'The', 'A', 'An', 'This', 'Track', 'Route', 'Original',
                         'Considerable', 'Mix', 'Fine', 'Tracked', 'Med ']
    
    # Check if starts with a non-track word
    first_word = line.split()[0] if line.split() else ''
    if first_word in not_track_starters:
        return False
    
    # Track names typically end with these patterns
    track_ending_patterns = [
        r'\bHut\b',
        r'\bBiv\b',
        r'\btops?\b',
        r'\btrack\b',
        r'\broute\b',
        r'\bRidge\b',
        r'\bCreek\b',
        r'\bRiver\b',
        r'\bValley\b',
        r'\bSaddle\b',
        r'\bSpur\b',
        r'\bRange\b',
        r'\bPeak\b',
        r'\bPass\b',
        r'\bFlat\b',
        r'\bKnob\b',
        r'\bBasin\b',
    ]
    
    # Track names should end with a track indicator, optionally followed by location
    # e.g., "Mt Browne Hut track" or "Murray Saddle" or "Browning Range tops"
    line_lower = line.lower()
    
    # Check if line ends with or contains a track ending near the end
    has_track_ending = False
    for pattern in track_ending_patterns:
        if re.search(pattern, line_lower):
            # Check if it's near the end or followed by common location words
            match = re.search(pattern, line_lower)
            if match:
                pos = match.end()
                remaining = line_lower[pos:].strip()
                # If nothing after or just location descriptors, it's likely a track name
                if not remaining or remaining.startswith(('from', 'to', 'via', 'up', 'down', 'onto', 'marked', 'as')):
                    has_track_ending = True
                    break
    
    return has_track_ending

def extract_track_details(track_dict):
    """Extract structured details from the track data string."""
    data = track_dict['data']
    
    # Extract last cut year/date
    last_cut = None
    if match := re.search(r"(\d{4}|\w+\s+'?\d{2})", data):
        last_cut = match.group(1)
    
    # Extract importance
    importance = None
    if 'High' in data:
        importance = 'High'
    elif 'Medium' in data or 'Med' in data:
        importance = 'Medium'
    elif 'Low' in data:
        importance = 'Low'
    
    # Extract custodian
    custodian = None
    custodian_patterns = [
        r'(DOC[^\.]*)',
        r'(CTC[^\.]*)',
        r'(Permolat[^\.]*)',
        r'([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+and\s+[A-Z][a-z]+\s+[A-Z][a-z]+)?)'
    ]
    for pattern in custodian_patterns:
        if match := re.search(pattern, data):
            custodian = match.group(1)
            break
    
    # Extract current condition (first sentence usually)
    condition = data.split('.')[0] if '.' in data else data[:100]
    
    # Extract next cut
    next_cut = None
    if 'Ongoing' in data:
        next_cut = 'Ongoing'
    elif match := re.search(r"(Summer|Winter|Autumn|Spring)\s+'?\d{2}", data):
        next_cut = match.group(0)
    elif match := re.search(r"(202\d)", data):
        next_cut = match.group(1)
    
    return {
        'name': track_dict['name'],
        'condition': condition,
        'last_cut': last_cut,
        'importance': importance,
        'custodian': custodian,
        'next_cut': next_cut,
        'raw_data': data
    }

def filter_2025_updates(tracks):
    """Filter tracks that have 2025 updates."""
    tracks_2025 = []
    
    for track in tracks:
        data = (track.get('raw_data', '') or '') + (track.get('last_cut', '') or '') + (track.get('condition', '') or '')
        # Look for 2025 patterns
        if "'25" in data or "2025" in data or " 25" in data:
            tracks_2025.append(track)
    
    return tracks_2025


def main():
    pdf_path = '/home/peter/permomap/remote_huts_content/track_maintenance_schedule_template_20260107.pdf'
    
    # Parse PDF and extract tracks from table
    tracks_raw = parse_pdf(pdf_path)
    print(f"Extracted {len(tracks_raw)} total tracks from PDF table")
    
    # Extract details
    tracks_detailed = [extract_track_details(t) for t in tracks_raw]
    
    # Filter to 2025 updates
    tracks_2025 = filter_2025_updates(tracks_detailed)
    
    print(f"\nFound {len(tracks_2025)} tracks with 2025 updates:\n")
    
    for track in tracks_2025:
        print(f"Track: {track['name']}")
        print(f"  Last Cut: {track.get('last_cut', 'N/A')}")
        print(f"  Importance: {track.get('importance', 'N/A')}")
        print(f"  Custodian: {track.get('custodian', 'N/A')}")
        print(f"  Next Cut: {track.get('next_cut', 'N/A')}")
        print()
    
    return tracks_2025

if __name__ == '__main__':
    tracks = main()
