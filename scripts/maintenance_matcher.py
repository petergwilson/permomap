#!/usr/bin/env python3
"""
Maintenance Schedule Matcher — API backend
------------------------------------------
Pure JSON API server.  Open reconcile.html in a browser to use the UI.

Usage:
    python3 scripts/maintenance_matcher.py [--pdf PATH] [--port 5050]

The HTML file (reconcile.html) fetches from http://localhost:5050/api/...
"""

import argparse
import io
import json
import os
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

import pdfplumber
import psycopg2
import psycopg2.extras
from thefuzz import fuzz

DEFAULT_DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/gis"
)

DB_FIELD_MAP = {
    "condition":    "currentcon",
    "lastcut":      "lastcut",       # float8 in DB (epoch)
    "lastcut_text": None,            # text companion for display/editing
    "importance":   "importance",
    "custodian":    "custodian",
    "nextcut":      "nextcut",       # text in DB
    "nextcut_text": None,            # text companion (same value, easier to edit)
}
# Fields that map to real DB columns (subset of DB_FIELD_MAP)
DB_MAPPED_FIELDS = {k: v for k, v in DB_FIELD_MAP.items() if v is not None}

# ──────────────────────────────────────────────────────────────────────────────
# PDF parsing
# ──────────────────────────────────────────────────────────────────────────────

def parse_pdf(pdf_bytes: bytes) -> list[dict]:
    """Extract all table rows from the maintenance schedule PDF."""
    rows = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table or len(table[0]) < 5:
                    continue
                # Skip header row(s)
                for row in table:
                    if row[0] and row[0].lower().startswith("track"):
                        continue
                    # Skip completely empty rows
                    if not any(row):
                        continue
                    # Normalise cell text
                    cells = [c.replace("\n", " ").strip() if c else "" for c in row]
                    # Must have at least a track name
                    if not cells[0]:
                        continue
                    rows.append({
                        "track":      cells[0],
                        "condition":  cells[1] if len(cells) > 1 else "",
                        "lastcut":    cells[2] if len(cells) > 2 else "",
                        "importance": cells[3] if len(cells) > 3 else "",
                        "custodian":  cells[4] if len(cells) > 4 else "",
                        "nextcut":    cells[5] if len(cells) > 5 else "",
                    })
    return rows


# ──────────────────────────────────────────────────────────────────────────────
# Database
# ──────────────────────────────────────────────────────────────────────────────

def fetch_db_tracks(database_url: str) -> list[dict]:
    """Fetch all current tracks from permolat_tracks_prod (includes centroid as lon/lat)."""
    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    id,
                    trackname,
                    currentcon,
                    lastcut,
                    importance,
                    custodian,
                    nextcut,
                    layer_name,
                    ST_X(ST_Transform(ST_Centroid(geom), 4326)) AS lon,
                    ST_Y(ST_Transform(ST_Centroid(geom), 4326)) AS lat
                FROM permolat_tracks_prod
                WHERE trackname IS NOT NULL
                ORDER BY trackname
            """)
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def fetch_track_geojson(database_url: str, track_id: int) -> dict | None:
    """Return GeoJSON Feature for a single track (geometry in WGS84)."""
    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    id, trackname, layer_name,
                    ST_AsGeoJSON(ST_Transform(geom, 4326))::json AS geometry
                FROM permolat_tracks_prod
                WHERE id = %s
            """, (track_id,))
            row = cur.fetchone()
            if not row:
                return None
            return {
                "type": "Feature",
                "properties": {"id": row["id"], "trackname": row["trackname"],
                               "layer_name": row["layer_name"]},
                "geometry": row["geometry"],
            }
    finally:
        conn.close()


# ──────────────────────────────────────────────────────────────────────────────
# Fuzzy matching
# ──────────────────────────────────────────────────────────────────────────────

def _combined_score(s1: str, s2: str) -> int:
    """Combine token_sort_ratio and ratio, penalise very short DB names."""
    tsr  = fuzz.token_sort_ratio(s1, s2)
    r    = fuzz.ratio(s1, s2)
    # Penalise if the DB name is much shorter than the PDF name
    len_ratio = min(len(s2), len(s1)) / max(len(s1), len(s2), 1)
    penalty   = int((1 - len_ratio) * 30)  # up to -30 pts for very short strings
    return max(0, int(tsr * 0.7 + r * 0.3) - penalty)


def match_tracks(pdf_rows: list[dict], db_tracks: list[dict]) -> list[dict]:
    """Fuzzy-match each PDF row to a DB track."""
    db_names   = [t["trackname"] for t in db_tracks]
    db_by_name = {t["trackname"]: t for t in db_tracks}

    results = []
    for pdf_row in pdf_rows:
        pdf_name = pdf_row["track"]
        scored   = [(name, _combined_score(pdf_name, name)) for name in db_names]
        scored.sort(key=lambda x: x[1], reverse=True)
        top5     = scored[:5]
        best_name, best_score = top5[0] if top5 else (None, 0)
        best_db  = db_by_name.get(best_name) if best_name else None

        # Build field diffs — only for mapped fields
        diffs = {}
        if best_db:
            for pdf_col, db_col in DB_MAPPED_FIELDS.items():
                pdf_val  = pdf_row.get(pdf_col, "")
                db_val   = str(best_db.get(db_col) or "")
                pdf_norm = pdf_val.strip().lower()
                db_norm  = db_val.strip().lower()
                diffs[pdf_col] = {
                    "pdf":     pdf_val,
                    "db":      db_val,
                    "same":    pdf_norm == db_norm,
                    "similar": fuzz.token_set_ratio(pdf_norm, db_norm) >= 80,
                }

        # Seed edited with PDF values + text companions seeded from PDF
        edited = {k: pdf_row.get(k, "") for k in DB_MAPPED_FIELDS}
        edited["lastcut_text"]  = pdf_row.get("lastcut", "")
        edited["nextcut_text"]  = pdf_row.get("nextcut", "")
        # geom_geojson: None means "use DB geometry"; a GeoJSON string means user drew one
        edited["geom_geojson"]  = None

        results.append({
            "pdf":        pdf_row,
            "db":         best_db,
            "score":      best_score,
            "diffs":      diffs,
            "candidates": [{"name": n, "score": s, "id": db_by_name[n]["id"]}
                           for n, s in top5],
            "status":     "pending",
            "manual":     False,
            "edited":     edited,
        })

    return results


# ──────────────────────────────────────────────────────────────────────────────
# SQL generation
# ──────────────────────────────────────────────────────────────────────────────


def q(s: str) -> str:
    """SQL-escape a string value."""
    return str(s).replace("'", "''")


def _parse_date_to_epoch(text: str) -> str:
    """
    Convert a free-text date string from the PDF into a float8 epoch value
    (seconds since 1970-01-01) suitable for the lastcut column.
    Returns a SQL expression string (either a numeric literal or NULL).
    Accepts formats like: 'Jan 2025', 'January 2025', '2025-01', '01/2025',
    'Oct 24', 'October 24', 'March 2024', '2024', etc.
    """
    import re
    from datetime import datetime, timezone
    if not text or not text.strip():
        return "NULL"
    t = text.strip()
    MONTHS = {
        "jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,
        "jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12,
    }
    # Try dateutil if available for robustness
    try:
        from dateutil import parser as dp
        dt = dp.parse(t, default=datetime(2000, 1, 1))
        return str(int(dt.replace(tzinfo=timezone.utc).timestamp()))
    except Exception:
        pass
    # Fallback patterns
    # "Jan 2025" or "January 2025"
    m = re.match(r'^([A-Za-z]{3,9})\s+(\d{4})$', t)
    if m:
        mon = MONTHS.get(m.group(1).lower()[:3])
        yr  = int(m.group(2))
        if mon:
            return str(int(datetime(yr, mon, 1, tzinfo=timezone.utc).timestamp()))
    # "Jan 24" or "Oct 24" (2-digit year)
    m = re.match(r'^([A-Za-z]{3,9})\s+(\d{2})$', t)
    if m:
        mon = MONTHS.get(m.group(1).lower()[:3])
        yr  = 2000 + int(m.group(2))
        if mon:
            return str(int(datetime(yr, mon, 1, tzinfo=timezone.utc).timestamp()))
    # "2025-01" or "01/2025"
    m = re.match(r'^(\d{4})-(\d{1,2})$', t) or re.match(r'^(\d{1,2})/(\d{4})$', t)
    if m:
        try:
            yr, mo = (int(m.group(1)), int(m.group(2))) if '-' in t else (int(m.group(2)), int(m.group(1)))
            return str(int(datetime(yr, mo, 1, tzinfo=timezone.utc).timestamp()))
        except Exception:
            pass
    # bare year "2024"
    m = re.match(r'^(\d{4})$', t)
    if m:
        return str(int(datetime(int(m.group(1)), 1, 1, tzinfo=timezone.utc).timestamp()))
    # Could not parse — emit as comment, default NULL
    return f"NULL -- could not parse: {t}"


def _parse_date_to_epoch_float(text: str) -> float | None:
    """Like _parse_date_to_epoch but returns a Python float (or None)."""
    sql = _parse_date_to_epoch(text)
    if sql == "NULL" or sql.startswith("NULL"):
        return None
    try:
        return float(sql.split()[0])
    except (ValueError, IndexError):
        return None


def create_track(database_url: str, props: dict, geom_geojson_wgs84: str) -> dict:
    """
    Insert a brand-new track into permolat_tracks_prod + an initial version row.
    geom_geojson_wgs84 is a GeoJSON *geometry* object string in EPSG:4326 (Leaflet).
    Returns {id, version_id}.
    """
    import json as _json
    conn = psycopg2.connect(database_url)
    try:
        with conn:
            with conn.cursor() as cur:
                # Next prod id
                cur.execute("SELECT COALESCE(MAX(id), 0) + 1 AS new_id FROM permolat_tracks_prod")
                new_id = cur.fetchone()[0]

                lastcut_val = _parse_date_to_epoch_float(props.get("lastcut_text", ""))
                nextcut_val = props.get("nextcut_text") or props.get("nextcut") or None
                geom_json   = geom_geojson_wgs84 if isinstance(geom_geojson_wgs84, str) \
                              else _json.dumps(geom_geojson_wgs84)

                cur.execute("""
                    INSERT INTO permolat_tracks_prod
                        (id, trackname, tracktype, layer_name, importance,
                         custodian, currentcon, lastcut, nextcut, geom,
                         current_version, added_by)
                    VALUES
                        (%s, %s, %s, %s, %s,
                         %s, %s, %s, %s,
                         ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326), 3857),
                         true, 1)
                """, [new_id,
                      props["trackname"].strip(),
                      props.get("tracktype") or None,
                      props.get("layer_name") or "permolat_tracks",
                      props.get("importance") or None,
                      props.get("custodian") or None,
                      props.get("currentcon") or None,
                      lastcut_val,
                      nextcut_val,
                      geom_json])

                # Next version_id
                cur.execute(
                    "SELECT COALESCE(MAX(version_id), 0) + 1 FROM permolat_track_versions"
                )
                new_version_id = cur.fetchone()[0]
                comment = f"New track from maintenance schedule: {props['trackname']}"

                cur.execute("""
                    INSERT INTO permolat_track_versions
                        (id, trackname, tracktype, layer_name, importance,
                         custodian, currentcon, lastcut, nextcut, geom,
                         version_id, parent_id, added_by,
                         added_timestamp, moderated_timestamp, comments)
                    VALUES
                        (%s, %s, %s, %s, %s,
                         %s, %s, %s, %s,
                         ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326), 3857),
                         %s, %s, 1,
                         NOW(), NOW(), %s)
                """, [new_id,
                      props["trackname"].strip(),
                      props.get("tracktype") or None,
                      props.get("layer_name") or "permolat_tracks",
                      props.get("importance") or None,
                      props.get("custodian") or None,
                      props.get("currentcon") or None,
                      lastcut_val,
                      nextcut_val,
                      geom_json,
                      new_version_id,
                      new_id,
                      comment])

        return {"id": int(new_id), "version_id": int(new_version_id)}
    finally:
        conn.close()


def generate_sql(matches: list[dict]) -> dict:
    """
    Generate SQL for all actionable matches. Returns a dict with:
      - sql: flat string (BEGIN … COMMIT) for copy-all
      - blocks: list of {type, label, sql} for UI display
      - count: total statements
      - summary: human-readable summary string

    Block types:
      'meta'      — header comment / BEGIN / COMMIT
      'version'   — INSERT INTO permolat_track_versions (SELECT FROM prod) — existing track update
      'new_track' — DO $$ … inserts into both prod + versions — brand new track
      'new_geom'  — version update that also replaces geometry
    """
    versions  = [m for m in matches
                 if m.get("status") == "approved" and m.get("db")]
    new_tracks = [m for m in matches
                  if m.get("status") == "new_track"
                  and (m.get("edited", {}).get("geom_geojson") or m.get("db"))]

    if not versions and not new_tracks:
        flat = "-- No approved rows and no new tracks with geometry."
        return {"sql": flat, "blocks": [{"type":"meta","label":"No actionable rows","sql":flat}],
                "count": 0, "summary": "Nothing to generate"}

    blocks = []
    header_sql = (
        f"-- Generated by maintenance_matcher.py  ({len(versions)} version update(s)"
        f"  ·  {len(new_tracks)} new track(s))\n"
        f"-- Review carefully before running!\n"
        f"BEGIN;"
    )
    blocks.append({"type":"meta", "label":"Transaction header", "sql": header_sql})

    # ── Version updates (approved existing tracks) ────────────────────────
    for item in versions:
        db      = item["db"]
        edits   = item.get("edited", {})
        db_id   = int(db["id"])
        tn      = q(db["trackname"])
        comment = q(f"Maintenance schedule update — PDF: {item['pdf']['track']}")

        def sv(edit_key, db_key=None, fallback=""):
            v = edits.get(edit_key, "")
            if not v and db_key:
                v = db.get(db_key) or fallback
            return f"'{q(str(v))}'" if v else "NULL"

        lastcut_text = edits.get("lastcut_text", "") or edits.get("lastcut", "")
        lastcut_sql  = _parse_date_to_epoch(lastcut_text) if lastcut_text else (
            str(db.get("lastcut")) if db.get("lastcut") is not None else "NULL"
        )
        nextcut_val = (edits.get("nextcut_text", "") or
                       edits.get("nextcut", "") or
                       str(db.get("nextcut") or ""))
        nextcut_sql = f"'{q(nextcut_val)}'" if nextcut_val else "NULL"

        geom_geojson = edits.get("geom_geojson")
        block_type = "new_geom" if geom_geojson else "version"
        if geom_geojson:
            geom_sql = (f"ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON('{q(geom_geojson)}'),4326),3857)"
                        f"  -- NEW GEOMETRY (replaces existing; old row still in versions table)")
        else:
            geom_sql = "t.geom  -- unchanged geometry (copied from prod)"

        # lastcut_sql may be "NULL -- could not parse: TEXT"; split value from comment
        lastcut_parts = lastcut_sql.split(" -- ", 1)
        lastcut_val_sql = lastcut_parts[0].strip()
        lastcut_comment = f"  -- {lastcut_parts[1]}" if len(lastcut_parts) > 1 else ""

        stmt = (
            f"-- Updates track '{db['trackname']}' (prod id={db_id})\n"
            f"-- Inserts a new row in permolat_track_versions; existing rows are untouched.\n"
            f"-- lastcut={lastcut_sql}  nextcut={nextcut_sql}\n"
            f"INSERT INTO permolat_track_versions (\n"
            f"    id, shape__len, trackname, lastcheck,\n"
            f"    custodian, lastcut, importance, currentcon,\n"
            f"    hikinggrad, maintenanc, marking, docregion,\n"
            f"    altitudech, warnings, conservati, tracktype,\n"
            f"    currentc_1, disttops, lengthinbu, datasource,\n"
            f"    isroutegis, complete, globalid, slopedist, infonote,\n"
            f"    nextcut, xyz_distan, zvalues_ca, docregionb, custodiang,\n"
            f"    layer_name, geom, original, rollback, multiple_status,\n"
            f"    status_overlay_links, existing_track_info_field_links,\n"
            f"    version_id, parent_id, comments,\n"
            f"    added_by, added_timestamp, moderated_by, moderated_timestamp\n"
            f")\n"
            f"SELECT\n"
            f"    t.id, t.shape__len, t.trackname, t.lastcheck,\n"
            f"    {sv('custodian','custodian')}  AS custodian,\n"
            f"    {lastcut_val_sql}                  AS lastcut,{lastcut_comment}\n"
            f"    {sv('importance','importance')} AS importance,\n"
            f"    {sv('condition','currentcon')}  AS currentcon,\n"
            f"    t.hikinggrad, t.maintenanc, t.marking, t.docregion,\n"
            f"    t.altitudech, t.warnings, t.conservati, t.tracktype,\n"
            f"    t.currentc_1, t.disttops, t.lengthinbu, t.datasource,\n"
            f"    t.isroutegis, t.complete, t.globalid, t.slopedist, t.infonote,\n"
            f"    {nextcut_sql}                  AS nextcut,\n"
            f"    t.xyz_distan, t.zvalues_ca, t.docregionb, t.custodiang,\n"
            f"    t.layer_name,\n"
            f"    {geom_sql}\n"
            f"                                   AS geom,\n"
            f"    t.original, t.rollback, t.multiple_status,\n"
            f"    t.status_overlay_links, t.existing_track_info_field_links,\n"
            f"    nextval('permolat_track_versions_version_id_seq') AS version_id,\n"
            f"    t.id                           AS parent_id,\n"
            f"    '{comment}'                    AS comments,\n"
            f"    1                              AS added_by,\n"
            f"    NOW()                          AS added_timestamp,\n"
            f"    NULL                           AS moderated_by,\n"
            f"    NOW()                          AS moderated_timestamp\n"
            f"FROM permolat_tracks_prod t WHERE t.id = {db_id};"
        )
        label = f"'{db['trackname']}' (prod id={db_id})" + (" + new geometry" if geom_geojson else "")
        blocks.append({"type": block_type, "label": label, "sql": stmt})

    # ── New tracks (not yet saved to DB) ─────────────────────────────────
    for item in new_tracks:
        edits   = item.get("edited", {})
        db      = item.get("db")
        tn_raw  = edits.get("nt_trackname", "") or item["pdf"]["track"]
        tn      = q(tn_raw)
        geom_geojson = edits.get("geom_geojson")

        lastcut_text = edits.get("lastcut_text", "") or edits.get("lastcut", "")
        lastcut_sql  = _parse_date_to_epoch(lastcut_text) if lastcut_text else "NULL"
        nextcut_val  = edits.get("nextcut_text", "") or edits.get("nextcut", "")
        nextcut_sql  = f"'{q(nextcut_val)}'" if nextcut_val else "NULL"

        # Helper: pull from edits first, then fall back to db field
        def _sv(ekey, dbkey=None, _ed=edits, _db=db):
            v = _ed.get(ekey, "")
            if not v and dbkey and _db:
                v = _db.get(dbkey) or ""
            return f"'{q(str(v))}'" if v else "NULL"

        if db:
            # Track exists in permolat_tracks with a known id.
            # Step 1: INSERT INTO permolat_tracks_prod ... ON CONFLICT DO NOTHING
            # Step 2: INSERT INTO permolat_track_versions
            db_id    = int(db["id"])
            geom_sql = (
                f"ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON('{q(geom_geojson)}'),4326),3857)"
                if geom_geojson else "t.geom"
            )
            geom_note = (
                "  -- NEW GEOMETRY (drawn/picked)"
                if geom_geojson else
                "  -- geometry copied from permolat_tracks"
            )
            comment       = q(f"Maintenance schedule update — PDF: {item['pdf']['track']}")
            custodian_sql = _sv('nt_custodian', 'custodian')
            importance_sql= _sv('nt_importance', 'importance')
            currentcon_sql= _sv('nt_condition',  'currentcon')

            stmt = (
                f"-- Insert into permolat_tracks_prod (new track, id={db_id}"
                + (", geometry copied from permolat_tracks" if not geom_geojson else "")
                + ")\n"
                f"INSERT INTO permolat_tracks_prod\n"
                f"    (id, trackname, custodian, lastcut, importance, currentcon, nextcut, geom, layer_name, added_by)\n"
                f"SELECT {db_id}, t.trackname, {custodian_sql}, {lastcut_sql}, {importance_sql}, {currentcon_sql}, {nextcut_sql},\n"
                f"    {geom_sql},{geom_note}\n"
                f"    t.layer_name, 1\n"
                f"FROM permolat_tracks t WHERE t.id = {db_id} LIMIT 1\n"
                f"ON CONFLICT (id) DO NOTHING;\n"
                f"\n"
                f"-- Inserts first version row for '{db['trackname']}' (prod id={db_id})\n"
                f"-- lastcut={lastcut_sql}  nextcut={nextcut_sql}\n"
                f"INSERT INTO permolat_track_versions (\n"
                f"    shape__len, trackname, lastcheck,\n"
                f"    custodian, lastcut, importance, currentcon,\n"
                f"    hikinggrad, maintenanc, marking, docregion,\n"
                f"    altitudech, warnings, conservati, tracktype,\n"
                f"    currentc_1, disttops, lengthinbu, datasource,\n"
                f"    isroutegis, complete, globalid, slopedist, infonote,\n"
                f"    nextcut, xyz_distan, zvalues_ca, docregionb, custodiang,\n"
                f"    layer_name, geom, original, rollback, multiple_status,\n"
                f"    status_overlay_links, existing_track_info_field_links,\n"
                f"    version_id, parent_id, comments,\n"
                f"    added_by, added_timestamp, moderated_by, moderated_timestamp\n"
                f")\n"
                f"SELECT\n"
                f"    t.shape__len, t.trackname, t.lastcheck,\n"
                f"    {custodian_sql}  AS custodian,\n"
                f"    {lastcut_sql}    AS lastcut,  -- lastcut_text: {lastcut_text or 'N/A'}\n"
                f"    {importance_sql} AS importance,\n"
                f"    {currentcon_sql} AS currentcon,\n"
                f"    t.hikinggrad, t.maintenanc, t.marking, t.docregion,\n"
                f"    t.altitudech, t.warnings, t.conservati, t.tracktype,\n"
                f"    t.currentc_1, t.disttops, t.lengthinbu, t.datasource,\n"
                f"    t.isroutegis, t.complete, t.globalid, t.slopedist, t.infonote,\n"
                f"    {nextcut_sql}    AS nextcut,\n"
                f"    t.xyz_distan, t.zvalues_ca, t.docregionb, t.custodiang,\n"
                f"    t.layer_name,\n"
                f"    {geom_sql}       AS geom,\n"
                f"    t.original, t.rollback, t.multiple_status,\n"
                f"    t.status_overlay_links, t.existing_track_info_field_links,\n"
                f"    nextval('permolat_track_versions_version_id_seq') AS version_id,\n"
                f"    t.id             AS parent_id,\n"
                f"    '{comment}'      AS comments,\n"
                f"    1                AS added_by,\n"
                f"    NOW()            AS added_timestamp,\n"
                f"    NULL             AS moderated_by,\n"
                f"    NOW()            AS moderated_timestamp\n"
                f"FROM permolat_tracks_prod t WHERE t.id = {db_id};"
            )
            label = f"NEW (matched): '{db['trackname']}' (id={db_id})"

        else:
            # Truly brand-new track with no DB match — requires drawn geometry
            geom_gj = q(geom_geojson or "")

            def _svn(key, _ed=edits):
                v = _ed.get(key, "")
                return f"'{q(v)}'" if v else "NULL"

            stmt = (
                f"-- BRAND NEW TRACK: '{tn_raw}'\n"
                f"-- Step 1: inserts a new row in permolat_tracks_prod (new id, never existed before).\n"
                f"-- Step 2: inserts matching first-version row in permolat_track_versions.\n"
                f"-- lastcut={lastcut_sql}  nextcut={nextcut_sql}\n"
                f"DO $$\n"
                f"DECLARE new_id INT; new_vid BIGINT;\n"
                f"BEGIN\n"
                f"  -- New prod id (one more than current max)\n"
                f"  SELECT COALESCE(MAX(id),0)+1 INTO new_id FROM permolat_tracks_prod;\n"
                f"\n"
                f"  -- Insert into permolat_tracks_prod (the live/current table)\n"
                f"  INSERT INTO permolat_tracks_prod\n"
                f"    (id, trackname, tracktype, layer_name, importance,\n"
                f"     custodian, currentcon, lastcut, nextcut, geom, current_version, added_by)\n"
                f"  VALUES\n"
                f"    (new_id, '{tn}', {_svn('nt_tracktype')}, {_svn('nt_layer_name')},\n"
                f"     {_svn('nt_importance')}, {_svn('nt_custodian')}, {_svn('nt_condition')},\n"
                f"     {lastcut_sql}, {nextcut_sql},\n"
                f"     ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON('{geom_gj}'),4326),3857),\n"
                f"     true, 1);\n"
                f"\n"
                f"  -- New version_id (one more than current max)\n"
                f"  SELECT COALESCE(MAX(version_id),0)+1 INTO new_vid FROM permolat_track_versions;\n"
                f"\n"
                f"  -- Insert initial version row in permolat_track_versions\n"
                f"  INSERT INTO permolat_track_versions\n"
                f"    (id, trackname, tracktype, layer_name, importance,\n"
                f"     custodian, currentcon, lastcut, nextcut, geom,\n"
                f"     version_id, parent_id, added_by, added_timestamp, moderated_timestamp, comments)\n"
                f"  VALUES\n"
                f"    (new_id, '{tn}', {_svn('nt_tracktype')}, {_svn('nt_layer_name')},\n"
                f"     {_svn('nt_importance')}, {_svn('nt_custodian')}, {_svn('nt_condition')},\n"
                f"     {lastcut_sql}, {nextcut_sql},\n"
                f"     ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON('{geom_gj}'),4326),3857),\n"
                f"     new_vid, new_id, 1, NOW(), NOW(),\n"
                f"     'New track from maintenance schedule: {tn}');\n"
                f"END $$;"
            )
            label = f"NEW: '{tn_raw}'"

        blocks.append({"type":"new_track", "label": label, "sql": stmt})

    blocks.append({"type":"meta", "label":"Commit", "sql":"COMMIT;"})

    flat = "\n\n".join(b["sql"] for b in blocks)
    summary = (f"{len(versions)} version update(s)"
               + (f"  ·  {len(new_tracks)} new track(s)" if new_tracks else ""))
    return {
        "sql":     flat,
        "blocks":  blocks,
        "count":   len(versions) + len(new_tracks),
        "summary": summary,
    }


# ──────────────────────────────────────────────────────────────────────────────
# HTTP Server
# ──────────────────────────────────────────────────────────────────────────────

_state: dict = {
    "pdf_rows": [],
    "db_tracks": [],
    "matches": [],
    "database_url": DEFAULT_DATABASE_URL,
    "pdf_name": "",
}


class ReuseAddrHTTPServer(HTTPServer):
    allow_reuse_address = True


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # suppress default logging
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def send_json(self, data, status=200):
        body = json.dumps(data, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/state":
            self.send_json({
                "pdf_name":  _state["pdf_name"],
                "row_count": len(_state["pdf_rows"]),
                "db_count":  len(_state["db_tracks"]),
                "matches":   _state["matches"],
                "db_tracks": _state["db_tracks"],
            })
        elif path == "/api/db_tracks":
            self.send_json(_state["db_tracks"])
        elif path.startswith("/api/track_geojson/"):
            try:
                track_id = int(path.split("/")[-1])
            except ValueError:
                self.send_json({"error": "Invalid track id"}, 400)
                return
            feature = fetch_track_geojson(_state["database_url"], track_id)
            if feature:
                self.send_json(feature)
            else:
                self.send_json({"error": "Track not found"}, 404)
        elif path in ("/", "/reconcile.html"):
            # Serve reconcile.html from the project root
            html_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "reconcile.html"
            )
            with open(html_path, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        path         = urlparse(self.path).path
        content_type = self.headers.get("Content-Type", "")
        length       = int(self.headers.get("Content-Length", 0))
        raw_body     = self.rfile.read(length)

        if path == "/api/upload_pdf":
            body = raw_body
            # Parse multipart
            if "multipart/form-data" in content_type:
                boundary = content_type.split("boundary=")[-1].encode()
                parts = body.split(b"--" + boundary)
                pdf_bytes = None
                for part in parts:
                    if b"filename=" in part and b"Content-Type: application/pdf" in part:
                        _, _, content = part.partition(b"\r\n\r\n")
                        pdf_bytes = content.rstrip(b"\r\n--")
                        break
                    elif b"filename=" in part:
                        _, _, content = part.partition(b"\r\n\r\n")
                        pdf_bytes = content.rstrip(b"\r\n--")

                if not pdf_bytes:
                    self.send_json({"error": "No PDF found in upload"}, 400)
                    return
            else:
                pdf_bytes = body

            try:
                pdf_rows = parse_pdf(pdf_bytes)
                # Try to get filename from header
                fname = ""
                if "filename=" in content_type:
                    fname = content_type.split("filename=")[-1].strip('"')

                # Load DB tracks
                try:
                    db_tracks = fetch_db_tracks(_state["database_url"])
                except Exception as e:
                    self.send_json({"error": f"DB error: {e}"}, 500)
                    return

                matches = match_tracks(pdf_rows, db_tracks)

                _state["pdf_rows"]  = pdf_rows
                _state["db_tracks"] = db_tracks
                _state["matches"]   = matches
                _state["pdf_name"]  = fname

                self.send_json({
                    "pdf_rows": len(pdf_rows),
                    "db_tracks": len(db_tracks),
                    "matches": matches,
                })
            except Exception as e:
                import traceback
                self.send_json({"error": str(e), "trace": traceback.format_exc()}, 500)

        elif path == "/api/rematch":
            data    = json.loads(raw_body)
            row_idx = data.get("row_idx")
            db_id   = data.get("db_id")

            if row_idx is None or db_id is None:
                self.send_json({"error": "row_idx and db_id required"}, 400)
                return

            db_track = next((t for t in _state["db_tracks"] if t["id"] == db_id), None)
            if not db_track:
                self.send_json({"error": "DB track not found"}, 404)
                return

            match   = _state["matches"][row_idx]
            pdf_row = match["pdf"]

            diffs = {}
            for pdf_col, db_col in DB_MAPPED_FIELDS.items():
                pdf_val  = pdf_row.get(pdf_col, "")
                db_val   = str(db_track.get(db_col) or "")
                pdf_norm = pdf_val.strip().lower()
                db_norm  = db_val.strip().lower()
                diffs[pdf_col] = {
                    "pdf":    pdf_val,
                    "db":     db_val,
                    "same":   pdf_norm == db_norm,
                    "similar": fuzz.token_set_ratio(pdf_norm, db_norm) >= 80,
                }

            _state["matches"][row_idx]["db"]    = db_track
            _state["matches"][row_idx]["score"]  = 100  # manual
            _state["matches"][row_idx]["manual"] = True
            _state["matches"][row_idx]["diffs"]  = diffs

            self.send_json({"ok": True, "diffs": diffs, "db": db_track})

        elif path == "/api/set_status":
            data    = json.loads(raw_body)
            row_idx = data["row_idx"]
            status  = data["status"]   # approved | skipped | nomatch | pending
            edited  = data.get("edited", {})
            if 0 <= row_idx < len(_state["matches"]):
                _state["matches"][row_idx]["status"] = status
                if edited:
                    _state["matches"][row_idx]["edited"] = edited
                    db = _state["matches"][row_idx].get("db")
                    if db:
                        synthetic = {**_state["matches"][row_idx]["pdf"], **edited}
                        # recompute diffs with edited values on the pdf side
                        for pdf_col, db_col in DB_MAPPED_FIELDS.items():
                            pdf_val  = synthetic.get(pdf_col, "")
                            db_val   = str(db.get(db_col) or "")
                            pdf_norm = pdf_val.strip().lower()
                            db_norm  = db_val.strip().lower()
                            _state["matches"][row_idx]["diffs"][pdf_col] = {
                                "pdf":     pdf_val,
                                "db":      db_val,
                                "same":    pdf_norm == db_norm,
                                "similar": fuzz.token_set_ratio(pdf_norm, db_norm) >= 80,
                            }
            self.send_json({"ok": True})

        elif path == "/api/save_geom":
            # { row_idx, geojson }  — store a user-drawn geometry on the match
            data    = json.loads(raw_body)
            row_idx = data.get("row_idx")
            geojson = data.get("geojson")  # GeoJSON geometry string or None to clear
            if row_idx is None or not (0 <= row_idx < len(_state["matches"])):
                self.send_json({"error": "Invalid row_idx"}, 400)
                return
            _state["matches"][row_idx]["edited"]["geom_geojson"] = geojson
            self.send_json({"ok": True})

        elif path == "/api/sync_bulk":
            # Restore all row statuses + edits from browser localStorage state.
            # Called before generate_sql so SQL generation works after server restart.
            data = json.loads(raw_body)
            synced = 0
            for row in data.get("rows", []):
                idx = row.get("row_idx")
                if idx is not None and 0 <= idx < len(_state["matches"]):
                    if row.get("status"):
                        _state["matches"][idx]["status"] = row["status"]
                    if row.get("edited"):
                        _state["matches"][idx].setdefault("edited", {}).update(row["edited"])
                    db_id = row.get("db_id")
                    if db_id is not None:
                        for t in _state["db_tracks"]:
                            if t["id"] == db_id:
                                _state["matches"][idx]["db"] = t
                                break
                    synced += 1
            self.send_json({"ok": True, "synced": synced})

        elif path == "/api/generate_sql":
            result = generate_sql(_state["matches"])
            self.send_json(result)

        elif path == "/api/create_track":
            # Directly save a new track + initial version to the DB.
            # { row_idx, props: {trackname, tracktype, layer_name, importance,
            #                    custodian, currentcon, lastcut_text, nextcut_text},
            #   geom_geojson: "<WGS84 GeoJSON geometry string>" }
            data        = json.loads(raw_body)
            row_idx     = data.get("row_idx")
            props       = data.get("props", {})
            geom_geojson = data.get("geom_geojson")

            if not props.get("trackname", "").strip():
                self.send_json({"error": "trackname is required"}, 400)
                return
            if not geom_geojson:
                self.send_json({"error": "geometry required — draw the track on the map first"}, 400)
                return

            try:
                result = create_track(_state["database_url"], props, geom_geojson)
                new_db = {
                    "id":         result["id"],
                    "trackname":  props["trackname"].strip(),
                    "layer_name": props.get("layer_name") or "permolat_tracks",
                    "importance": props.get("importance"),
                    "custodian":  props.get("custodian"),
                    "currentcon": props.get("currentcon"),
                    "lastcut":    _parse_date_to_epoch_float(props.get("lastcut_text", "")),
                    "nextcut":    props.get("nextcut_text") or props.get("nextcut"),
                    "lon": None, "lat": None,
                }
                if row_idx is not None and 0 <= row_idx < len(_state["matches"]):
                    _state["matches"][row_idx]["status"] = "saved"
                    _state["matches"][row_idx]["db"]     = new_db
                    _state["db_tracks"].append(new_db)
                self.send_json({**result, "ok": True})
            except Exception as ex:
                import traceback
                self.send_json({"error": str(ex), "trace": traceback.format_exc()}, 500)

        else:
            self.send_response(404)
            self.end_headers()


# ──────────────────────────────────────────────────────────────────────────────
# HTML UI  — split-pane manual reconciliation workflow
# ──────────────────────────────────────────────────────────────────────────────

HTML_PAGE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Track Maintenance Matcher</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;color:#1a1a1a;background:#eef0f3}
body{display:flex;flex-direction:column}

/* Header */
#hdr{background:#1a3a5c;color:#fff;padding:7px 14px;display:flex;align-items:center;gap:14px;flex-shrink:0}
#hdr h1{font-size:14px;font-weight:600;letter-spacing:.4px}
.hbadge{background:rgba(255,255,255,.18);border-radius:4px;padding:2px 8px;font-size:11px;white-space:nowrap}

/* Progress */
#progbar{height:4px;background:#0d2136;flex-shrink:0}
#progfill{height:4px;background:#4caf50;width:0;transition:width .25s}

/* Toolbar */
#toolbar{background:#fff;border-bottom:1px solid #ddd;padding:7px 14px;display:flex;align-items:center;gap:9px;flex-shrink:0;flex-wrap:wrap}
label.tlabel{font-size:11px;font-weight:600;color:#555}
input[type=file]{font-size:11px}
button{padding:4px 12px;border-radius:4px;border:1px solid #bbb;background:#f5f5f5;cursor:pointer;font-size:12px;font-weight:500}
button.primary{background:#1a3a5c;color:#fff;border-color:#1a3a5c}
button.success{background:#2e7d32;color:#fff;border-color:#2e7d32}
button:hover{filter:brightness(.92)}
button:disabled{opacity:.4;cursor:default}
#statbar{margin-left:auto;font-size:11px;color:#666}

/* Filters */
#filterbar{background:#fafafa;border-bottom:1px solid #e0e0e0;padding:5px 14px;display:flex;gap:10px;align-items:center;flex-shrink:0;flex-wrap:wrap}
#filterbar label{font-size:11px;color:#555}
select.fsel,input[type=search]{font-size:12px;padding:3px 7px;border:1px solid #ccc;border-radius:3px}
#fcnt{margin-left:auto;font-size:11px;color:#888}

/* Split layout */
#split{display:flex;flex:1;overflow:hidden;min-height:0}

/* Left list */
#list-pane{width:320px;min-width:180px;max-width:400px;flex-shrink:0;background:#fff;border-right:2px solid #d0d5dd;overflow-y:auto}
.list-row{padding:6px 9px;cursor:pointer;border-bottom:1px solid #f0f0f0;display:flex;align-items:flex-start;gap:7px}
.list-row:hover{background:#f4f7fb}
.list-row.active{background:#e3edf8;border-left:3px solid #1a3a5c}
.lr-body{flex:1;min-width:0}
.lr-name{font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lr-sub{font-size:10px;color:#888;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.list-row.active .lr-name{color:#1a3a5c;font-weight:600}

/* Status indicators */
.sdot{width:9px;height:9px;border-radius:50%;flex-shrink:0;margin-top:4px}
.sdot.pending{background:#bbb}.sdot.approved{background:#4caf50}
.sdot.skipped{background:#ff9800}.sdot.nomatch{background:#f44336}
.sbadge{font-size:10px;font-weight:700;padding:1px 5px;border-radius:9px;white-space:nowrap;flex-shrink:0;align-self:center}
.sbadge.pending{background:#e8e8e8;color:#666}.sbadge.approved{background:#d4edda;color:#155724}
.sbadge.skipped{background:#fff3cd;color:#856404}.sbadge.nomatch{background:#f8d7da;color:#721c24}

/* Score chip */
.sc{display:inline-block;padding:0 5px;border-radius:9px;font-size:10px;font-weight:700}
.sc.hi{background:#d4edda;color:#155724}.sc.me{background:#fff3cd;color:#856404}
.sc.lo{background:#f8d7da;color:#721c24}.sc.mn{background:#cce5ff;color:#004085}

/* Right detail */
#detail-pane{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px;background:#eef0f3}
.detail-empty{color:#aaa;font-size:14px;text-align:center;margin:60px auto}

/* Cards */
.dcard{background:#fff;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,.09);padding:11px 13px}
.dcard h3{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#888;margin-bottom:7px}
.dcard-title{font-size:15px;font-weight:600;color:#1a3a5c;margin-bottom:3px}
.dcard-meta{font-size:11px;color:#888}

/* Match search + list */
#match-search{width:100%;padding:5px 8px;border:1px solid #ccc;border-radius:4px;font-size:12px;margin-bottom:5px}
#match-list{max-height:170px;overflow-y:auto;border:1px solid #ddd;border-radius:4px}
.ml-row{padding:5px 9px;cursor:pointer;font-size:12px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center}
.ml-row:hover{background:#f0f5ff}
.ml-row.selected{background:#e3edf8;font-weight:600}
.ml-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ml-score{font-size:10px;color:#888;margin-left:6px;flex-shrink:0}

/* Field comparison grid */
.fields-grid{display:grid;grid-template-columns:110px 1fr 1fr;gap:0;border:1px solid #e0e0e0;border-radius:4px;overflow:hidden}
.fg-hdr{font-size:10px;font-weight:700;color:#888;text-transform:uppercase;padding:4px 7px;background:#f5f5f5;border-bottom:1px solid #e0e0e0}
.fg-label{padding:5px 7px;font-size:11px;font-weight:600;color:#555;border-bottom:1px solid #f0f0f0;border-right:1px solid #f0f0f0;display:flex;align-items:flex-start}
.fg-cell{padding:4px 7px;font-size:12px;border-bottom:1px solid #f0f0f0;border-right:1px solid #f0f0f0}
.fg-cell:last-child{border-right:none}
.fg-cell.editable{background:#fffde7}
.fg-cell textarea{width:100%;border:none;background:transparent;resize:none;font-size:12px;font-family:inherit;min-height:36px;outline:none;line-height:1.4}
.fg-cell textarea:focus{background:#fff8e1;border-radius:2px}
/* diff row colours */
.diff-same .fg-cell:nth-child(3){color:#aaa}
.diff-similar .fg-cell.editable textarea{color:#7f4f00}
.diff-similar .fg-cell:nth-child(3){color:#3e6b4f}
.diff-diff .fg-cell.editable textarea{color:#b71c1c;font-weight:500}
.diff-diff .fg-cell:nth-child(3){color:#1b5e20;font-weight:500}
.diff-diff .fg-label::before{content:"≠ ";color:#c62828}
.diff-similar .fg-label::before{content:"≈ ";color:#e65100}
.diff-same .fg-label::before{content:"✓ ";color:#388e3c}

/* Action bar */
#action-bar{background:#fff;border-top:2px solid #e0e0e0;padding:9px 14px;display:none;flex-shrink:0;gap:9px;align-items:center}
.row-info{font-size:11px;color:#888;margin-right:auto}
button.btn-approve{background:#2e7d32;color:#fff;border-color:#2e7d32;font-size:13px;padding:6px 18px}
button.btn-skip{background:#e65100;color:#fff;border-color:#e65100}
button.btn-nomatch{background:#b71c1c;color:#fff;border-color:#b71c1c}
button.btn-reset{background:#5c6bc0;color:#fff;border-color:#5c6bc0}
button.btn-nav{padding:4px 10px;font-size:15px}

/* Keyboard hint */
.kb{font-size:10px;background:#f0f0f0;border:1px solid #ccc;border-radius:3px;padding:0 4px;font-family:monospace;color:#555}

/* SQL panel */
#sql-panel{background:#fff;border-top:2px solid #1a3a5c;padding:11px 14px;display:none;flex-shrink:0}
#sql-panel h3{font-size:13px;color:#1a3a5c;margin-bottom:7px}
#sql-out{background:#1e1e2e;color:#cdd6f4;font:11px/1.5 'Courier New',monospace;padding:10px;border-radius:4px;overflow:auto;max-height:220px;white-space:pre}
#sql-actions{margin-top:8px;display:flex;gap:8px;align-items:center}

/* Loading */
#loading{position:fixed;inset:0;background:rgba(255,255,255,.8);display:none;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:#1a3a5c;z-index:999}
</style>
</head>
<body>

<div id="hdr">
  <h1>Track Maintenance Matcher</h1>
  <span class="hbadge" id="h-pdf">No PDF loaded</span>
  <span class="hbadge" id="h-db">DB —</span>
  <span class="hbadge" id="h-prog">0 / 0 reconciled</span>
</div>
<div id="progbar"><div id="progfill"></div></div>

<div id="toolbar">
  <label class="tlabel">PDF:</label>
  <input type="file" id="pdf-input" accept=".pdf">
  <button class="primary" onclick="uploadPdf()">Load &amp; Match</button>
  <span style="color:#ccc">|</span>
  <button onclick="jumpNextPending()" id="btn-jnp">Next pending ↓</button>
  <span style="color:#ccc">|</span>
  <button class="success" id="btn-sql" onclick="generateSQL()" disabled>
    Generate SQL &nbsp;(<span id="app-count">0</span> approved)
  </button>
  <span id="statbar"></span>
</div>

<div id="filterbar">
  <label>Show:</label>
  <select class="fsel" id="fstatus" onchange="applyFilter()">
    <option value="all">All rows</option>
    <option value="pending" selected>Pending</option>
    <option value="approved">Approved</option>
    <option value="skipped">Skipped</option>
    <option value="nomatch">No match</option>
  </select>
  <label style="margin-left:8px">Score:</label>
  <select class="fsel" id="fscore" onchange="applyFilter()">
    <option value="all">Any</option>
    <option value="lo">Low (&lt;60)</option>
    <option value="me">Med (60–79)</option>
    <option value="hi">High (≥80)</option>
  </select>
  <label style="margin-left:8px">Search:</label>
  <input type="search" id="fsearch" placeholder="track name…" oninput="applyFilter()" style="width:150px">
  <span id="fcnt"></span>
</div>

<div id="split">
  <div id="list-pane"></div>
  <div id="detail-pane">
    <div class="detail-empty">
      Upload a maintenance schedule PDF, then step through each row:<br><br>
      <strong>Workflow</strong><br>
      1. Check the auto-matched DB track — override if wrong<br>
      2. Edit any PDF field values if needed<br>
      3. Click <strong>✓ Approve</strong> (or press <span class="kb">A</span>) — moves to next pending<br>
      4. <strong>Skip</strong> rows with no useful changes, <strong>No match</strong> for unrecognised tracks<br>
      5. When done, click <strong>Generate SQL</strong> to produce INSERT statements<br><br>
      <span style="font-size:11px;color:#aaa">
        <span class="kb">↑</span>/<span class="kb">↓</span> navigate &nbsp;
        <span class="kb">A</span> approve &nbsp;
        <span class="kb">S</span> skip &nbsp;
        <span class="kb">N</span> no match
      </span>
    </div>
  </div>
</div>

<div id="action-bar">
  <span class="row-info" id="row-info">—</span>
  <button class="btn-nav" onclick="navigate(-1)" title="Previous ↑">↑</button>
  <button class="btn-nav" onclick="navigate(1)"  title="Next ↓">↓</button>
  <button class="btn-reset"   onclick="doStatus('pending')">Reset</button>
  <button class="btn-nomatch" onclick="doStatus('nomatch')">No match</button>
  <button class="btn-skip"    onclick="doStatus('skipped')">Skip →</button>
  <button class="btn-approve" onclick="doStatus('approved')">✓ Approve</button>
</div>

<div id="sql-panel">
  <h3>Generated SQL — review carefully before running</h3>
  <pre id="sql-out"></pre>
  <div id="sql-actions">
    <button onclick="copySql()">Copy to clipboard</button>
    <button onclick="document.getElementById('sql-panel').style.display='none'">Close</button>
    <span id="sql-note" style="font-size:11px;color:#888;margin-left:8px"></span>
  </div>
</div>

<div id="loading">Loading…</div>

<script>
// ── State ──────────────────────────────────────────────────────────────────
let ALL  = [];   // all match objects
let DB   = [];   // all db tracks
let VIS  = [];   // indices into ALL currently visible in list
let CUR  = -1;   // current selected index into ALL
const STORAGE_KEY = 'matcher_v2';

const FIELDS = ['condition','lastcut','importance','custodian','nextcut'];
const FLABELS = {
  condition:'Condition', lastcut:'Last cut', importance:'Importance',
  custodian:'Custodian', nextcut:'Next cut'
};

// ── Upload ─────────────────────────────────────────────────────────────────
async function uploadPdf() {
  const inp = document.getElementById('pdf-input');
  if (!inp.files.length) { alert('Select a PDF first.'); return; }
  const file = inp.files[0];
  setStatus('Parsing PDF and auto-matching…');
  load(true);
  const fd = new FormData();
  fd.append('pdf', file, file.name);
  try {
    const r = await fetch('/api/upload_pdf',{method:'POST',body:fd});
    const d = await r.json();
    if (d.error) { alert('Error: '+d.error+'\n'+(d.trace||'')); return; }
    ALL = d.matches; DB = d.db_tracks;
    restoreLocal(file.name);
    document.getElementById('h-pdf').textContent = file.name;
    document.getElementById('h-db').textContent  = 'DB: '+DB.length;
    rebuildList();
    applyFilter();
    updateProgress();
    document.getElementById('action-bar').style.display = 'flex';
    const first = VIS.length ? VIS[0] : (ALL.length ? 0 : -1);
    if (first >= 0) selectRow(first);
    setStatus(ALL.length+' PDF rows · '+DB.length+' DB tracks. Work through each row below.');
  } catch(e) { alert('Failed: '+e); }
  finally { load(false); }
}

// ── List ───────────────────────────────────────────────────────────────────
function rebuildList() {
  const pane = document.getElementById('list-pane');
  pane.innerHTML = '';
  ALL.forEach((m,i) => {
    const el = document.createElement('div');
    el.className = 'list-row';
    el.dataset.idx    = i;
    el.dataset.status = m.status;
    el.dataset.score  = m.score;
    el.dataset.name   = (m.pdf.track||'').toLowerCase();
    el.innerHTML = lrHTML(m);
    el.onclick = () => selectRow(i);
    pane.appendChild(el);
  });
}

function lrHTML(m) {
  const db_name = m.db ? m.db.trackname : '(no match)';
  const sc = scCls(m.score, m.manual);
  const hasDiff = m.diffs && Object.values(m.diffs).some(d=>!d.same);
  return `<div class="sdot ${m.status}"></div>
    <div class="lr-body">
      <div class="lr-name" title="${esc(m.pdf.track)}">${esc(m.pdf.track)}</div>
      <div class="lr-sub">→ ${esc(db_name)}
        <span class="sc ${sc}" style="margin-left:4px">${m.manual?'✎':m.score}</span>
        ${hasDiff?'<span style="color:#c00;margin-left:3px;font-size:10px">Δ</span>':''}
      </div>
    </div>
    <span class="sbadge ${m.status}">${m.status}</span>`;
}

function refreshRow(i) {
  document.querySelectorAll('#list-pane .list-row').forEach(r => {
    if (parseInt(r.dataset.idx) !== i) return;
    const m = ALL[i];
    r.dataset.status = m.status;
    r.innerHTML = lrHTML(m);
    r.onclick = () => selectRow(i);
    r.className = 'list-row'+(i===CUR?' active':'');
  });
}

// ── Detail panel ───────────────────────────────────────────────────────────
function selectRow(i) {
  if (CUR >= 0) flushEdits(CUR);
  CUR = i;
  document.querySelectorAll('#list-pane .list-row').forEach(r =>
    r.classList.toggle('active', parseInt(r.dataset.idx)===i));
  document.querySelector('#list-pane .list-row.active')
    ?.scrollIntoView({block:'nearest'});
  renderDetail(i);
  updateRowInfo(i);
}

function renderDetail(i) {
  const m  = ALL[i];
  const dp = document.getElementById('detail-pane');
  dp.innerHTML = `
    <div class="dcard">
      <h3>PDF row ${i+1} of ${ALL.length}</h3>
      <div class="dcard-title">${esc(m.pdf.track)}</div>
      <div class="dcard-meta">
        Status: <strong>${m.status}</strong>
        &nbsp;·&nbsp; Match score:
        <span class="sc ${scCls(m.score,m.manual)}">${m.manual?'manual override':m.score}</span>
      </div>
    </div>
    <div class="dcard">
      <h3>Matched DB track — change if auto-match is wrong</h3>
      <input type="search" id="match-search" placeholder="Search DB tracks by name…"
             oninput="filterML(this.value)">
      <div id="match-list">${buildML(m,i)}</div>
    </div>
    <div class="dcard">
      <h3>Field comparison
        <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;color:#bbb;margin-left:6px">
          Edit left column to correct PDF values before approving
        </span>
      </h3>
      ${buildFields(m)}
    </div>`;
}

function buildML(m, i) {
  const cids = new Set(m.candidates.map(c=>c.id));
  const rows = [
    ...m.candidates,
    ...DB.filter(t=>!cids.has(t.id)).map(t=>({id:t.id,name:t.trackname,score:null}))
  ];
  return rows.map(c => {
    const sel  = m.db && m.db.id===c.id ? 'selected' : '';
    const sc   = c.score!==null ? `<span class="ml-score">${c.score}%</span>` : '';
    return `<div class="ml-row ${sel}" onclick="rematch(${i},${c.id})">
      <span class="ml-name">${esc(c.name||c.trackname)}</span>${sc}</div>`;
  }).join('');
}

function filterML(q) {
  const ql = q.toLowerCase();
  document.querySelectorAll('#match-list .ml-row').forEach(r => {
    r.style.display = r.querySelector('.ml-name').textContent.toLowerCase().includes(ql)?'':'none';
  });
}

function buildFields(m) {
  let h = `<div class="fields-grid">
    <div class="fg-hdr">Field</div>
    <div class="fg-hdr">PDF value (editable)</div>
    <div class="fg-hdr">Current DB value</div>`;
  FIELDS.forEach(f => {
    const d  = m.diffs?.[f] || {};
    const pv = m.edited?.[f] ?? (d.pdf||'');
    const dv = d.db||'';
    const cls = d.same?'diff-same':d.similar?'diff-similar':'diff-diff';
    h += `<div class="fg-label ${cls}">${FLABELS[f]}</div>
      <div class="fg-cell editable ${cls}"><textarea data-f="${f}" rows="2">${esc(pv)}</textarea></div>
      <div class="fg-cell ${cls}">${esc(dv)}</div>`;
  });
  return h + '</div>';
}

// ── Rematch ────────────────────────────────────────────────────────────────
async function rematch(i, dbId) {
  load(true);
  try {
    const r = await fetch('/api/rematch',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({row_idx:i,db_id:dbId})});
    const d = await r.json();
    if (d.ok) {
      ALL[i].db=d.db; ALL[i].diffs=d.diffs; ALL[i].score=100; ALL[i].manual=true;
      refreshRow(i);
      if (i===CUR) renderDetail(i);
    }
  } finally { load(false); }
}

// ── Status actions ─────────────────────────────────────────────────────────
function flushEdits(i) {
  const tas = document.querySelectorAll('#detail-pane textarea[data-f]');
  if (!tas.length) return;
  const e = {};
  tas.forEach(t => e[t.dataset.f] = t.value);
  ALL[i].edited = e;
}

async function doStatus(status) {
  if (CUR < 0) return;
  flushEdits(CUR);
  ALL[CUR].status = status;
  await fetch('/api/set_status',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({row_idx:CUR, status, edited:ALL[CUR].edited})});
  refreshRow(CUR);
  updateProgress();
  updateRowInfo(CUR);
  saveLocal();
  if (status==='approved'||status==='skipped') {
    const n = nextPending(CUR+1);
    if (n>=0) selectRow(n);
  }
}

function nextPending(from) {
  for (let i=from; i<ALL.length; i++) if (ALL[i].status==='pending') return i;
  for (let i=0; i<from; i++)          if (ALL[i].status==='pending') return i;
  return -1;
}

function jumpNextPending() {
  const n = nextPending(CUR+1);
  if (n>=0) selectRow(n); else setStatus('All rows reconciled.');
}

// ── Navigate ───────────────────────────────────────────────────────────────
function navigate(dir) {
  if (CUR<0) return;
  flushEdits(CUR);
  const pos = VIS.indexOf(CUR);
  if (pos<0) return;
  const np = pos+dir;
  if (np>=0 && np<VIS.length) selectRow(VIS[np]);
}

// ── Filter ─────────────────────────────────────────────────────────────────
function applyFilter() {
  const st = document.getElementById('fstatus').value;
  const sc = document.getElementById('fscore').value;
  const q  = document.getElementById('fsearch').value.toLowerCase().trim();
  VIS = [];
  document.querySelectorAll('#list-pane .list-row').forEach(r => {
    const i   = parseInt(r.dataset.idx);
    const m   = ALL[i];
    let show  = true;
    if (st!=='all' && m.status!==st) show=false;
    if (sc==='lo' && m.score>=60) show=false;
    if (sc==='me' && (m.score<60||m.score>=80)) show=false;
    if (sc==='hi' && m.score<80) show=false;
    if (q && !(m.pdf.track||'').toLowerCase().includes(q)) show=false;
    r.style.display = show?'':'none';
    if (show) VIS.push(i);
  });
  document.getElementById('fcnt').textContent = VIS.length+' of '+ALL.length;
}

// ── Progress ───────────────────────────────────────────────────────────────
function updateProgress() {
  const total = ALL.length;
  const done  = ALL.filter(m=>m.status!=='pending').length;
  const app   = ALL.filter(m=>m.status==='approved').length;
  document.getElementById('progfill').style.width = total?(done/total*100)+'%':'0';
  document.getElementById('h-prog').textContent   = done+'/'+total+' reconciled';
  document.getElementById('app-count').textContent = app;
  document.getElementById('btn-sql').disabled = app===0;
}

function updateRowInfo(i) {
  const pos = VIS.indexOf(i);
  document.getElementById('row-info').textContent =
    `Row ${i+1}/${ALL.length}  ·  visible ${pos+1}/${VIS.length}  ·  status: ${ALL[i].status}`;
}

// ── SQL ────────────────────────────────────────────────────────────────────
async function generateSQL() {
  if (CUR>=0) { flushEdits(CUR); await saveCurrentToServer(); }
  load(true);
  try {
    const r = await fetch('/api/generate_sql',{method:'POST',
      headers:{'Content-Type':'application/json'},body:'{}'});
    const d = await r.json();
    document.getElementById('sql-out').textContent  = d.sql;
    document.getElementById('sql-note').textContent = d.count+' INSERT statement(s)';
    document.getElementById('sql-panel').style.display = '';
    document.getElementById('sql-panel').scrollIntoView({behavior:'smooth'});
  } finally { load(false); }
}

async function saveCurrentToServer() {
  if (CUR<0) return;
  await fetch('/api/set_status',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({row_idx:CUR,status:ALL[CUR].status,edited:ALL[CUR].edited})});
}

async function copySql() {
  await navigator.clipboard.writeText(document.getElementById('sql-out').textContent);
  setStatus('Copied to clipboard.');
}

// ── Local persistence ──────────────────────────────────────────────────────
function saveLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      ALL.map(m=>({t:m.pdf.track,s:m.status,e:m.edited,did:m.db?.id,mn:m.manual}))));
  } catch(e){}
}

function restoreLocal(pdf_name) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)||saved.length!==ALL.length) return;
    let n=0;
    ALL.forEach((m,i)=>{
      const s=saved[i];
      if (!s||s.t!==m.pdf.track) return;
      if (s.s) m.status=s.s;
      if (s.e) m.edited=s.e;
      if (s.mn&&s.did) {
        const db=DB.find(t=>t.id===s.did);
        if (db){m.db=db;m.manual=true;m.score=100;}
      }
      n++;
    });
    if (n) setStatus('Restored '+n+' rows from previous session.');
  } catch(e){}
}

// ── Keyboard ───────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT') return;
  if (e.key==='ArrowDown'||e.key==='j') { e.preventDefault(); navigate(1); }
  if (e.key==='ArrowUp'  ||e.key==='k') { e.preventDefault(); navigate(-1); }
  if (e.key==='a') doStatus('approved');
  if (e.key==='s') doStatus('skipped');
  if (e.key==='n') doStatus('nomatch');
});

// ── Helpers ────────────────────────────────────────────────────────────────
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function scCls(s,mn){return mn?'mn':s>=80?'hi':s>=60?'me':'lo'}
function load(v){document.getElementById('loading').style.display=v?'flex':'none'}
function setStatus(m){document.getElementById('statbar').textContent=m}

// ── Auto-restore on page load ──────────────────────────────────────────────
(async()=>{
  try {
    const d=await(await fetch('/api/state')).json();
    if (d.matches&&d.matches.length) {
      ALL=d.matches; DB=d.db_tracks;
      document.getElementById('h-pdf').textContent=d.pdf_name||'pre-loaded';
      document.getElementById('h-db').textContent='DB: '+DB.length;
      restoreLocal(d.pdf_name);
      rebuildList(); applyFilter(); updateProgress();
      document.getElementById('action-bar').style.display='flex';
      const first=VIS.length?VIS[0]:0;
      if (ALL.length) selectRow(first);
      setStatus(ALL.length+' rows loaded · '+DB.length+' DB tracks');
    }
  } catch(e){}
})();
</script>
</body></html>
"""


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Track Maintenance Schedule Matcher — manual reconciliation tool")
    parser.add_argument("--pdf",  help="PDF to pre-load at startup")
    parser.add_argument("--port", type=int, default=5050)
    parser.add_argument("--db",   default=DEFAULT_DATABASE_URL,
                        help="PostgreSQL connection URL (default: $DATABASE_URL)")
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    _state["database_url"] = args.db

    if args.pdf:
        print(f"Pre-loading {args.pdf} …")
        with open(args.pdf, "rb") as f:
            pdf_bytes = f.read()
        pdf_rows  = parse_pdf(pdf_bytes)
        db_tracks = fetch_db_tracks(args.db)
        matches   = match_tracks(pdf_rows, db_tracks)
        _state.update({
            "pdf_rows":  pdf_rows,
            "db_tracks": db_tracks,
            "matches":   matches,
            "pdf_name":  os.path.basename(args.pdf),
        })
        high = sum(1 for m in matches if m["score"] >= 80)
        low  = sum(1 for m in matches if m["score"] < 60)
        print(f"  {len(pdf_rows)} PDF rows  ·  {len(db_tracks)} DB tracks")
        print(f"  High confidence (≥80): {high}  ·  Needs review (<60): {low}")

    url = f"http://localhost:{args.port}"
    print(f"\nMaintenance Matcher →  {url}")
    print("Keyboard shortcuts in UI:  ↑/↓ navigate · A approve · S skip · N no-match")
    print("Press Ctrl+C to stop.\n")

    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()

    server = ReuseAddrHTTPServer(("", args.port), Handler)
    server.socket.setsockopt(__import__('socket').SOL_SOCKET,
                             __import__('socket').SO_REUSEADDR, 1)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()

