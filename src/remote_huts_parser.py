#!/usr/bin/env python3
"""
Remote Huts Track Maintenance Schedule Parser

This module parses the track maintenance schedule PDF and matches track names
to IDs in the permolat_tracks_prod database table. It uses sophisticated regex
patterns and fuzzy matching to handle variations in track names.

Usage:
    python remote_huts_parser.py /path/to/schedule.pdf

The parser:
1. Extracts text from the PDF
2. Identifies track records using structural patterns
3. Parses maintenance details (condition, last cut, custodian, etc.)
4. Matches track names to database IDs using multiple strategies
5. Generates SQL INSERT statements for permolat_track_versions
"""

import pypdf
import re
import sys
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import psycopg2
from psycopg2.extras import RealDictCursor
from difflib import SequenceMatcher


# ============================================================================
# MANUAL TRACK MAPPINGS
# ============================================================================
# For tracks that cannot be automatically matched, add manual mappings here.
# Key: PDF track name (or unique substring)
# Value: Database track ID
#
# To find IDs, query the database:
#   SELECT id, trackname FROM permolat_tracks_prod WHERE trackname ILIKE '%keyword%';
#
MANUAL_TRACK_MAPPINGS = {
    # Example: "Gerhardt Spur Biv": 123,
    # Add mappings here as needed
}


class TrackNameMatcher:
    """
    Handles matching of track names from PDF to database IDs.
    Uses multiple strategies: exact match, fuzzy match, and pattern-based matching.
    """
    
    def __init__(self, db_connection):
        self.conn = db_connection
        self.db_tracks = self._load_database_tracks()
        
    def _load_database_tracks(self) -> List[Dict]:
        """Load all tracks from permolat_tracks_prod."""
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    id,
                    trackname,
                    lastcut,
                    custodian,
                    currentcon,
                    importance,
                    nextcut,
                    layer_name
                FROM permolat_tracks_prod
                ORDER BY trackname
            """)
            return cur.fetchall()
    
    def _normalize_track_name(self, name: str) -> str:
        """
        Normalize track name for comparison.
        - Convert to lowercase
        - Remove extra whitespace
        - Standardize common variations
        """
        name = name.lower().strip()
        # Remove multiple spaces
        name = re.sub(r'\s+', ' ', name)
        # Standardize common abbreviations
        replacements = {
            'hut track': 'hut',
            ' track': '',
            ' route': '',
            'tops track': 'tops',
            'biv track': 'biv',
        }
        for old, new in replacements.items():
            name = name.replace(old, new)
        return name
    
    def _truncate_track_name_at_indicator(self, name: str) -> str:
        """
        Truncate track name after the first occurrence of key indicator words.
        This helps match PDF names like "Boo Boo Hut track from Kokatahi" 
        to database names like "Boo Boo Hut track".
        
        Stops at: track, route, tops, biv, hut (when followed by "from", "to", "via")
        """
        # Pattern to find track indicators followed by location descriptors
        # We want to keep everything up to and including the indicator word
        truncate_patterns = [
            r'(\s+track)\s+(from|to|via|up|down|onto|into)\b',
            r'(\s+route)\s+(from|to|via|up|down|onto|into)\b',
            r'(\s+tops)\s+(from|to|via|up|down|onto|into)\b',
            r'(\s+biv)\s+(from|to|via|up|down|onto|into)\b',
            r'(\s+hut)\s+(track|from|to|via)\b',
        ]
        
        for pattern in truncate_patterns:
            match = re.search(pattern, name, re.IGNORECASE)
            if match:
                # Keep everything up to and including the indicator word
                return name[:match.start() + len(match.group(1))]
        
        return name
    
    def _extract_key_components(self, name: str) -> set:
        """
        Extract key components from track name for matching.
        Returns set of important words (excludes common words like 'from', 'to', 'via').
        """
        name = self._normalize_track_name(name)
        
        # Split into words
        words = name.split()
        
        # Common words to exclude
        exclude = {'from', 'to', 'via', 'the', 'and', 'or', 'up', 'down', 'onto', 'into'}
        
        # Extract significant words (longer than 2 chars, not in exclude list)
        key_words = {w for w in words if len(w) > 2 and w not in exclude}
        
        return key_words
    
    def find_best_match(self, pdf_track_name: str, min_similarity: float = 0.6) -> Optional[Dict]:
        """
        Find best matching track in database.
        
        Args:
            pdf_track_name: Track name from PDF
            min_similarity: Minimum similarity score (0-1) to consider a match
            
        Returns:
            Dictionary with matched track data and match score, or None if no match found
        """
        # First, truncate PDF name at key indicator words to remove location descriptors
        truncated_pdf_name = self._truncate_track_name_at_indicator(pdf_track_name)
        
        # Check manual mappings first (highest priority)
        for manual_key, track_id in MANUAL_TRACK_MAPPINGS.items():
            if manual_key.lower() in pdf_track_name.lower():
                # Find the track in our database cache
                for db_track in self.db_tracks:
                    if db_track['id'] == track_id:
                        return {**db_track, 'match_score': 1.0, 'match_type': 'manual'}
        
        normalized_pdf_name = self._normalize_track_name(truncated_pdf_name)
        pdf_components = self._extract_key_components(truncated_pdf_name)
        
        best_match = None
        best_score = 0.0
        
        for db_track in self.db_tracks:
            db_name = db_track['trackname']
            if not db_name:
                continue
                
            normalized_db_name = self._normalize_track_name(db_name)
            
            # Strategy 1: Exact match (after normalization)
            if normalized_pdf_name == normalized_db_name:
                return {**db_track, 'match_score': 1.0, 'match_type': 'exact'}
            
            # Strategy 2: SequenceMatcher similarity
            sequence_score = SequenceMatcher(None, normalized_pdf_name, normalized_db_name).ratio()
            
            # Strategy 3: Component overlap
            db_components = self._extract_key_components(db_name)
            if pdf_components and db_components:
                component_overlap = len(pdf_components & db_components) / len(pdf_components | db_components)
            else:
                component_overlap = 0.0
            
            # Strategy 4: Substring match (bidirectional)
            substring_score = 0.0
            if normalized_pdf_name in normalized_db_name:
                substring_score = len(normalized_pdf_name) / len(normalized_db_name)
            elif normalized_db_name in normalized_pdf_name:
                substring_score = len(normalized_db_name) / len(normalized_pdf_name)
            
            # Combined score (weighted average)
            combined_score = (
                sequence_score * 0.4 +
                component_overlap * 0.4 +
                substring_score * 0.2
            )
            
            if combined_score > best_score and combined_score >= min_similarity:
                best_score = combined_score
                best_match = {
                    **db_track,
                    'match_score': combined_score,
                    'match_type': 'fuzzy',
                    'sequence_score': sequence_score,
                    'component_score': component_overlap,
                    'substring_score': substring_score
                }
        
        return best_match


class TrackMaintenanceParser:
    """
    Parses the track maintenance schedule PDF and extracts structured data.
    """
    
    # Regex patterns for extracting information
    YEAR_PATTERN = re.compile(r'\b(19|20)\d{2}\b')
    ABBREV_YEAR_PATTERN = re.compile(r"'(\d{2})\b")
    MONTH_YEAR_PATTERN = re.compile(r'\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+[\'"]?(\d{2}|\d{4})\b', re.IGNORECASE)
    
    IMPORTANCE_PATTERN = re.compile(r'\b(High|Medium|Med|Low|Low-med|Low-Med)\b', re.IGNORECASE)
    
    # Custodian patterns - look for names (Title Case) and organizations
    CUSTODIAN_PATTERN = re.compile(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:and|&)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)?|DOC(?:[^\.]{0,30})?|CTC|Permolat(?:[^\.]{0,20})?|BCT)\b')
    
    # Next cut patterns
    NEXT_CUT_PATTERN = re.compile(r'\b(Ongoing|Summer|Winter|Autumn|Spring)\s*[\'"]?(\d{2,4})?\b|20\d{2}\b', re.IGNORECASE)
    
    # Track name indicators - words that commonly appear in track names
    TRACK_INDICATORS = {
        'hut', 'biv', 'track', 'from', 'to', 'via', 'tops', 'peak', 'range',
        'creek', 'river', 'valley', 'saddle', 'spur', 'route', 'ridge', 'flat',
        'knob', 'basin', 'up', 'down', 'onto', 'gorge', 'pass', 'tarn', 'stream'
    }
    
    # Words that indicate this is NOT a track name (condition descriptions)
    CONDITION_INDICATORS = {
        'good', 'ok', 'reasonable', 'reasonably', 'overgrown', 'overgrowing',
        'followable', 'needs', 'pretty', 'should', 'trimmed', 'recut', 'cut',
        'windfall', 'marked', 'maintenance', 'condition', 'rough', 'easy',
        'difficult', 'steep', 'grade', 'cleared', 'flagged'
    }
    
    def __init__(self, pdf_path: str):
        self.pdf_path = pdf_path
        self.raw_text = None
        self.tracks = []
        
    def extract_pdf_text(self) -> str:
        """Extract all text from PDF."""
        pdf = pypdf.PdfReader(self.pdf_path)
        full_text = ""
        for page in pdf.pages:
            full_text += page.extract_text() + "\n"
        self.raw_text = full_text
        return full_text
    
    def _is_likely_track_name(self, line: str) -> bool:
        """
        Determine if a line is likely to be a track name.
        
        Rules:
        1. Starts with uppercase letter
        2. Contains track indicator words
        3. Doesn't start with condition indicator words
        4. Reasonably short (< 150 chars)
        5. Not all caps (headers)
        6. Ends with or contains track endings (Hut, Biv, tops, track, route, etc.)
        """
        if not line or len(line) > 150:
            return False
        
        # Must start with uppercase
        if not line[0].isupper():
            return False
        
        # Skip if all caps (likely header)
        if line.isupper():
            return False
        
        line_lower = line.lower()
        
        # Check if starts with condition words (these are descriptions, not names)
        words = line_lower.split()
        if words and words[0] in self.CONDITION_INDICATORS:
            return False
        
        # Track names should end with or contain a track ending pattern
        # e.g., "Mt Browne Hut track" or "Murray Saddle" or "Browning Range tops"
        track_ending_patterns = [
            r'\bhut\b',
            r'\bbiv\b',
            r'\btops?\b',
            r'\btrack\b',
            r'\broute\b',
            r'\bridge\b',
            r'\bcreek\b',
            r'\briver\b',
            r'\bvalley\b',
            r'\bsaddle\b',
            r'\bspur\b',
            r'\brange\b',
            r'\bpeak\b',
            r'\bpass\b',
            r'\bflat\b',
            r'\bknob\b',
            r'\bbasin\b',
        ]
        
        # Check if line contains a track ending near the end
        has_track_ending = False
        for pattern in track_ending_patterns:
            match = re.search(pattern, line_lower)
            if match:
                # Check if it's near the end or followed by common location words
                pos = match.end()
                remaining = line_lower[pos:].strip()
                # If nothing after or just location descriptors, it's likely a track name
                if not remaining or remaining.startswith(('from', 'to', 'via', 'up', 'down', 'onto', 'marked', 'as')):
                    has_track_ending = True
                    break
        
        return has_track_ending
    
    def _clean_track_name(self, name: str) -> str:
        """
        Clean track name by truncating at descriptive words or location prepositions.
        E.g., "Mt Browne Hut track from Taipo River" -> "Mt Browne Hut track"
        """
        # Truncate at these words which typically follow the track name
        truncate_patterns = [
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
        
        for pattern in truncate_patterns:
            match = re.search(pattern, name, re.IGNORECASE)
            if match:
                return name[:match.start()].strip()
        
        return name.strip()
    
    def _extract_year_from_text(self, text: str) -> Optional[str]:
        """Extract year or date from text."""
        # Look for patterns like "Dec '25", "2025", "Nov 25", etc.
        
        # Try full year first
        year_match = self.YEAR_PATTERN.search(text)
        if year_match:
            return year_match.group(0)
        
        # Try abbreviated year like '25
        abbrev_match = self.ABBREV_YEAR_PATTERN.search(text)
        if abbrev_match:
            year = int(abbrev_match.group(1))
            # Assume 20xx for years 00-99
            full_year = f"20{year:02d}" if year < 100 else str(year)
            return full_year
        
        # Try month + year patterns
        month_year_match = self.MONTH_YEAR_PATTERN.search(text)
        if month_year_match:
            year = month_year_match.group(2)
            if len(year) == 2:
                year = f"20{year}"
            return year
        
        return None
    
    def _convert_year_to_epoch_ms(self, year_str: str, month: int = 6) -> int:
        """
        Convert year string to epoch milliseconds.
        Defaults to June (mid-year) if no specific month provided.
        """
        try:
            year = int(year_str)
            dt = datetime(year, month, 1)
            return int(dt.timestamp() * 1000)
        except:
            return 0
    
    def parse_tracks(self) -> List[Dict]:
        """
        Parse the PDF text and extract track records.
        
        Returns:
            List of dictionaries containing track information
        """
        if not self.raw_text:
            self.extract_pdf_text()
        
        lines = [l.strip() for l in self.raw_text.split('\n') if l.strip()]
        
        tracks = []
        current_track = None
        current_data_lines = []
        in_table = False
        
        for line in lines:
            # Detect start of table
            if 'Track' in line and 'Current Condition' in line:
                in_table = True
                continue
            
            if not in_table:
                continue
            
            # Check if this is a new track name
            if self._is_likely_track_name(line):
                # Save previous track if exists
                if current_track:
                    tracks.append(self._finalize_track(current_track, current_data_lines))
                
                # Start new track - clean the track name
                current_track = self._clean_track_name(line)
                current_data_lines = []
            else:
                # Add data to current track
                if current_track:
                    current_data_lines.append(line)
        
        # Don't forget the last track
        if current_track:
            tracks.append(self._finalize_track(current_track, current_data_lines))
        
        self.tracks = tracks
        return tracks
    
    def _finalize_track(self, track_name: str, data_lines: List[str]) -> Dict:
        """
        Process accumulated data lines for a track and extract structured information.
        """
        full_data = ' '.join(data_lines)
        
        # Extract condition (typically first sentence or first 200 chars)
        condition = full_data
        if '.' in full_data:
            sentences = full_data.split('.')
            condition = sentences[0] + '.'
        else:
            condition = full_data[:200]
        
        # Extract last cut year
        last_cut = self._extract_year_from_text(full_data)
        
        # Extract importance
        importance_match = self.IMPORTANCE_PATTERN.search(full_data)
        importance = importance_match.group(1) if importance_match else None
        
        # Normalize importance
        if importance:
            importance = importance.title()
            if importance in ['Med', 'Medium']:
                importance = 'Medium'
            elif importance in ['Low-Med', 'Low-med']:
                importance = 'Low-Medium'
        
        # Extract custodian
        custodian = None
        custodian_matches = self.CUSTODIAN_PATTERN.findall(full_data)
        if custodian_matches:
            # Take the most complete custodian mention
            custodian = max(custodian_matches, key=len)
        
        # Extract next cut
        next_cut = None
        next_cut_match = self.NEXT_CUT_PATTERN.search(full_data)
        if next_cut_match:
            next_cut = next_cut_match.group(0)
        
        return {
            'name': track_name,
            'condition': condition,
            'last_cut': last_cut,
            'importance': importance,
            'custodian': custodian,
            'next_cut': next_cut,
            'raw_data': full_data
        }
    
    def filter_2025_updates(self) -> List[Dict]:
        """Filter tracks that have 2025 updates."""
        if not self.tracks:
            self.parse_tracks()
        
        tracks_2025 = []
        for track in self.tracks:
            # Check if any field mentions 2025 or '25
            full_text = (
                f"{track.get('raw_data', '')} "
                f"{track.get('last_cut', '')} "
                f"{track.get('condition', '')} "
                f"{track.get('next_cut', '')}"
            )
            
            if "'25" in full_text or "2025" in full_text or " 25 " in full_text:
                tracks_2025.append(track)
        
        return tracks_2025


def generate_sql_inserts(matched_tracks: List[Dict], output_file: str = None) -> str:
    """
    Generate SQL INSERT statements for permolat_track_versions.
    
    Args:
        matched_tracks: List of tracks with database matches
        output_file: Optional file path to write SQL to
        
    Returns:
        SQL string
    """
    sql_lines = [
        "-- SQL file to update permolat_track_versions with 2025 track maintenance updates",
        f"-- Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "-- Source: Track Maintenance Schedule PDF",
        "",
        "BEGIN;",
        ""
    ]
    
    for idx, track in enumerate(matched_tracks, 1):
        db_match = track.get('db_match')
        if not db_match:
            sql_lines.append(f"-- WARNING: No database match found for: {track['name']}")
            sql_lines.append("")
            continue
        
        track_id = db_match['id']
        track_name = db_match['trackname']
        match_score = db_match.get('match_score', 0)
        
        # Convert last cut to epoch milliseconds
        last_cut_epoch = 0
        if track.get('last_cut'):
            last_cut_epoch = track.get('last_cut_epoch', 0)
        
        # Escape single quotes in text - handle None values
        condition = (track.get('condition') or '').replace("'", "''")
        custodian = (track.get('custodian') or '').replace("'", "''")
        next_cut = (track.get('next_cut') or '').replace("'", "''")
        importance = track.get('importance') or ''
        
        sql_lines.extend([
            f"-- {idx}. {track_name} (ID: {track_id}, Match Score: {match_score:.2f})",
            f"-- PDF Name: {track['name']}",
            f"-- Last Cut: {track.get('last_cut', 'N/A')}",
            "INSERT INTO permolat_track_versions (",
            "    shape__len, trackname, lastcheck, custodian, lastcut, importance, currentcon,",
            "    hikinggrad, maintenanc, marking, docregion, altitudech, warnings, conservati,",
            "    tracktype, currentc_1, disttops, lengthinbu, datasource, isroutegis, complete,",
            "    globalid, slopedist, infonote, nextcut, xyz_distan, zvalues_ca, docregionb,",
            "    custodiang, layer_name, geom, original, rollback, multiple_status,",
            "    status_overlay_links, existing_track_info_field_links,",
            "    parent_id, version_id, added_by, added_timestamp, moderated_timestamp, moderated_by, comments",
            ")",
            "SELECT ",
            "    t.shape__len, t.trackname, t.lastcheck,",
            f"    '{custodian}' as custodian," if custodian else "    t.custodian,",
            f"    {last_cut_epoch} as lastcut," if last_cut_epoch else "    t.lastcut,",
            f"    '{importance}' as importance," if importance else "    t.importance,",
            f"    '{condition}' as currentcon,",
            "    t.hikinggrad, t.maintenanc, t.marking, t.docregion, t.altitudech, t.warnings, t.conservati,",
            "    t.tracktype, t.currentc_1, t.disttops, t.lengthinbu, t.datasource, t.isroutegis, t.complete,",
            "    t.globalid, t.slopedist, t.infonote,",
            f"    '{next_cut}' as nextcut," if next_cut else "    t.nextcut,",
            "    t.xyz_distan, t.zvalues_ca, t.docregionb,",
            "    t.custodiang, t.layer_name, t.geom, t.original, t.rollback, t.multiple_status,",
            "    t.status_overlay_links, t.existing_track_info_field_links,",
            f"    t.id as parent_id,",
            "    nextval('permolat_track_versions_version_id_seq') as version_id,",
            "    1 as added_by,",
            "    CURRENT_TIMESTAMP as added_timestamp,",
            "    CURRENT_TIMESTAMP as moderated_timestamp,",
            "    1 as moderated_by,",
            f"    'Maintenance update from 2025 schedule: {track.get('last_cut', 'Updated')}'",
            "FROM permolat_tracks_prod t",
            f"WHERE t.id = {track_id};",
            ""
        ])
    
    # Add UPDATE statement
    track_ids = [str(t['db_match']['id']) for t in matched_tracks if t.get('db_match')]
    if track_ids:
        sql_lines.extend([
            "-- Update permolat_tracks_prod to point to the new current versions",
            "UPDATE permolat_tracks_prod t",
            "SET ",
            "    current_version_id = v.version_id,",
            "    last_moderated_at = v.moderated_timestamp,",
            "    last_moderated_timestamp = v.moderated_timestamp",
            "FROM permolat_track_versions v",
            "WHERE v.parent_id = t.id",
            "  AND v.added_timestamp >= CURRENT_DATE",
            f"  AND t.id IN ({', '.join(track_ids)});",
            ""
        ])
    
    sql_lines.extend([
        "COMMIT;",
        "",
        f"-- Summary: Updated {len(track_ids)} tracks with 2025 maintenance information"
    ])
    
    sql_text = '\n'.join(sql_lines)
    
    if output_file:
        with open(output_file, 'w') as f:
            f.write(sql_text)
        print(f"SQL written to: {output_file}")
    
    return sql_text


def main():
    """Main execution function."""
    if len(sys.argv) < 2:
        print("Usage: python remote_huts_parser.py <pdf_path>")
        print("Example: python remote_huts_parser.py /path/to/track_maintenance_schedule.pdf")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    # Database connection
    try:
        conn = psycopg2.connect(
            dbname="gis",
            user="postgres",
            password="postgres",
            host="localhost"
        )
        print("✓ Connected to database")
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        sys.exit(1)
    
    try:
        # Initialize parser
        print(f"\nParsing PDF: {pdf_path}")
        parser = TrackMaintenanceParser(pdf_path)
        parser.extract_pdf_text()
        
        # Parse all tracks
        all_tracks = parser.parse_tracks()
        print(f"✓ Extracted {len(all_tracks)} total tracks from PDF")
        
        # Filter to 2025 updates
        tracks_2025 = parser.filter_2025_updates()
        print(f"✓ Found {len(tracks_2025)} tracks with 2025 updates")
        
        # Initialize matcher
        print("\n✓ Loading database tracks...")
        matcher = TrackNameMatcher(conn)
        print(f"✓ Loaded {len(matcher.db_tracks)} tracks from database")
        
        # Match tracks
        print("\n" + "="*80)
        print("MATCHING TRACKS")
        print("="*80)
        
        matched_tracks = []
        unmatched_tracks = []
        
        for track in tracks_2025:
            print(f"\nPDF Track: {track['name']}")
            
            # Show truncated name for matching
            truncated_name = matcher._truncate_track_name_at_indicator(track['name'])
            if truncated_name != track['name']:
                print(f"  → Truncated to: {truncated_name}")
            match = matcher.find_best_match(track['name'], min_similarity=0.5)
            
            if match:
                track['db_match'] = match
                matched_tracks.append(track)
                
                # Calculate epoch timestamp
                if track.get('last_cut'):
                    track['last_cut_epoch'] = parser._convert_year_to_epoch_ms(track['last_cut'])
                
                print(f"  ✓ MATCHED: {match['trackname']} (ID: {match['id']})")
                print(f"    Score: {match['match_score']:.2f} | Type: {match['match_type']}")
                print(f"    Last Cut: {track.get('last_cut', 'N/A')}")
                print(f"    Custodian: {track.get('custodian', 'N/A')}")
                print(f"    Importance: {track.get('importance', 'N/A')}")
            else:
                unmatched_tracks.append(track)
                print(f"  ✗ NO MATCH FOUND (try adjusting min_similarity)")
        
        # Generate SQL
        print("\n" + "="*80)
        print("GENERATING SQL")
        print("="*80)
        
        output_file = "sql/update_tracks_2025_maintenance_generated.sql"
        sql = generate_sql_inserts(matched_tracks, output_file)
        
        # Summary
        print("\n" + "="*80)
        print("SUMMARY")
        print("="*80)
        print(f"Total tracks in PDF: {len(all_tracks)}")
        print(f"Tracks with 2025 updates: {len(tracks_2025)}")
        print(f"Successfully matched: {len(matched_tracks)}")
        print(f"Unmatched: {len(unmatched_tracks)}")
        
        if unmatched_tracks:
            print("\nUnmatched tracks:")
            for track in unmatched_tracks:
                print(f"  - {track['name']}")
        
        print(f"\n✓ SQL file generated: {output_file}")
        
    finally:
        conn.close()


if __name__ == '__main__':
    main()
