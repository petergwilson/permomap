# Track Matching Analysis Report
**Generated:** January 7, 2026  
**Source:** track_maintenance_schedule_template_20260107.pdf  
**Database:** permolat_tracks_prod (182 tracks)

## Summary Statistics
- **Total tracks in PDF:** 384
- **Tracks with 2025 updates:** 39
- **Successfully matched:** 12 (31%)
- **Failed to match:** 27 (69%)

## Successfully Matched Tracks

| PDF Track Name | Database Match | ID | Score | Type |
|----------------|----------------|----|----|------|
| Barrack Creek tops | Barrack Creek Tops Route | 6 | 1.00 | exact |
| Cone Creek - Morgan | Cone Creek Hut to Morgan Tops | 101 | 0.54 | fuzzy |
| Explorer Hut | Fraser Peak track from Explorer Hut | 31 | 0.52 | fuzzy |
| Darby Creek | Frisco Hut from Darby Creek | 97 | 0.51 | fuzzy |
| Saddle | Harman Saddle Route | 156 | 0.54 | fuzzy |
| Miserable Ridge track | Miserable Ridge from Rapid Creek | 129 | 0.55 | fuzzy |
| Mt Greenland Hut track | Mt Greenland Route | 210 | 0.69 | fuzzy |
| Newton Range tops | Newton Range Tops | 189 | 1.00 | exact |
| Pell Stream Hut marked | Pell Stream Hut marked route | 67 | 1.00 | exact |
| Creek | Lake Creek Track | 206 | 0.57 | fuzzy |
| Yeats Ridge Track from | Yeats Ridge Track | 60 | 0.86 | fuzzy |

**Note:** "Saddle" appears twice in the PDF - both matched to Harman Saddle Route (ID: 156)

## Failed Matches - Requires Manual Mapping

### Issue Category 1: False Track Names (Actually Condition Descriptions)
These are NOT track names - they are condition/maintenance descriptions that the parser incorrectly identified:

```
❌ Good. Needs a couple of waratahs at the
❌ Lower Creek is OK river travel. Further
❌ Campbell Biv track Pretty Good. Could do with a bit of a trim
❌ Cone Creek Track OK. Windthrow and trimming done in
❌ Tidied up '25.
❌ Fine to bush line with a little bit of
❌ Mix of track and river travel. Tracked
❌ The bottom end is good – work done on
❌ Topomaps)
❌ Considerable windthrow from October 25
❌ Mt Willberg Pretty good. Retrimmed to trig in Winter
❌ Saddle Creek OK/ 4x TR detours
❌ Upper section OK with light regen. New
❌ E1475360/ N5262986. Recut to 550m
❌ Good. Mid section untracked but easy
❌ Med Michal Klajban & CTC October
❌ Tracked section reasonable. Work done
❌ Original track gone in most places. A line
```

**Root Cause:** PDF parsing is picking up condition text that follows track names. The track name detection regex needs improvement.

### Issue Category 2: Legitimate Track Names Not in Database
These appear to be real track names but either:
- Don't exist in the database
- Have significantly different names in the database

```
❌ Gerhardt Spur Biv track Good from Biv down to just east of Pt
   (Truncated to: Gerhardt Spur Biv track Good from Biv)
   
❌ Brian O'Lyn tops track

❌ Murray Saddle

❌ Rapid Creek

❌ Mt Browne/ Misty Ridge

❌ Homeward Ridge track

❌ Tunnel Creek Hut track Prettyy good condition. Some bits have a
   (Truncated to: Tunnel Creek Hut)

❌ Whitcombe main valley

❌ Whitcombe valley track
```

### Issue Category 3: Problematic Matches (Low Confidence)
These matches succeeded but have concerningly low scores:

```
⚠️  Creek → Lake Creek Track (ID: 206, Score: 0.57)
    Problem: "Creek" is too generic - might be wrong match
    
⚠️  Explorer Hut → Fraser Peak track from Explorer Hut (ID: 31, Score: 0.52)
    Problem: Score just barely above threshold
    
⚠️  Darby Creek → Frisco Hut from Darby Creek (ID: 97, Score: 0.51)
    Problem: Score just barely above threshold
```

## Recommendations

### 1. Improve Track Name Detection
The parser is incorrectly identifying condition descriptions as track names. Need to:
- Better regex patterns to identify where track names END
- Look for punctuation/capitalization patterns that indicate start of condition text
- Use multi-line context to understand document structure

### 2. Add Manual Mapping Constant
For tracks that can't be automatically matched, add a manual mapping dictionary:

```python
MANUAL_TRACK_MAPPINGS = {
    # PDF name (or partial match) -> Database ID
    "Gerhardt Spur Biv": 123,  # Add actual ID when confirmed
    "Brian O'Lyn tops": 124,
    "Murray Saddle": 125,
    "Tunnel Creek Hut": 126,
    "Whitcombe valley": 127,
    "Whitcombe main valley": 128,
    # etc.
}
```

### 3. Query Database for Missing Tracks
Search database for tracks containing these keywords to find correct IDs:
- Gerhardt
- Brian O'Lyn
- Murray
- Tunnel Creek
- Whitcombe
- Homeward Ridge

### 4. Improve Truncation Logic
Current truncation stops at "track/hut/biv + from/to/via" but needs refinement:
- "Gerhardt Spur Biv track Good from Biv" - stops at wrong "from" (should stop at "track")
- "Campbell Biv track Pretty Good" - should stop at "track"

### 5. Increase Match Threshold
Consider raising minimum similarity from 0.5 to 0.6 or 0.7 to avoid false positives like "Creek" → "Lake Creek Track"

## Next Steps

1. **Fix Parser Track Detection**
   - Update `_is_likely_track_name()` to better identify true track names vs conditions
   - May need to parse multi-line context to understand PDF structure

2. **Database Query for Missing Tracks**
   - Run fuzzy searches for the unmatched legitimate track names
   - Build manual mapping constant

3. **Review Generated SQL**
   - Check if the 12 matched tracks have correct data extracted
   - Verify epoch timestamps are correct
   - Ensure custodian/condition fields are properly parsed

4. **Test with Manual Mappings**
   - Add manual mappings to parser
   - Re-run to generate complete SQL

## Current Parser Success Rate: 31%
**Target:** 80%+ with manual mappings and improved detection
