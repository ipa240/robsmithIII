"""
Facility Name Normalization Utility
Converts facility names to consistent Title Case with special handling
for healthcare acronyms and common patterns.
"""

import re
import psycopg2
from typing import Optional
from .config import DB_CONFIG


# Words that should stay UPPERCASE
UPPERCASE_WORDS = {
    # Healthcare acronyms
    'va', 'uva', 'vhc', 'hca', 'inova', 'amn', 'aya', 'evms', 'vcu',
    'nicu', 'picu', 'icu', 'er', 'or', 'ot', 'pt',
    # Location abbreviations
    'usa', 'us', 'dc',
    # Roman numerals
    'ii', 'iii', 'iv', 'vi', 'vii', 'viii', 'ix', 'x',
}

# Words to capitalize with specific casing (not all uppercase)
TITLE_CASE_WORDS = {
    'llc': 'LLC',
    'inc': 'Inc',
    'pllc': 'PLLC',
    'pc': 'PC',
    'lp': 'LP',
    'corp': 'Corp',
    'co': 'Co',
}

# Words that should stay lowercase (unless first word)
LOWERCASE_WORDS = {
    'at', 'of', 'and', 'the', 'in', 'on', 'by', 'for', 'to', 'a', 'an'
}

# Abbreviation expansions
ABBREVIATIONS = {
    'ctr': 'Center',
    'ctr.': 'Center',
    'hosp': 'Hospital',
    'hosp.': 'Hospital',
    'med': 'Medical',
    'med.': 'Medical',
    'rehab': 'Rehabilitation',
    'nsg': 'Nursing',
    'hlth': 'Health',
    'svcs': 'Services',
    'ca': 'Care',
    'fac': 'Facility',
}

# Special full-name replacements (case-insensitive match)
SPECIAL_NAMES = {
    'bon secours': 'Bon Secours',
    'st marys': "St. Mary's",
    'st mary': "St. Mary",
    'st francis': "St. Francis",
    'st josephs': "St. Joseph's",
    'st joseph': "St. Joseph",
    'mt sinai': "Mt. Sinai",
}


def normalize_facility_name(name: str, expand_abbreviations: bool = True) -> str:
    """
    Normalize a facility name to consistent Title Case.

    Args:
        name: The facility name to normalize
        expand_abbreviations: Whether to expand common abbreviations (e.g., CTR -> Center)

    Returns:
        Normalized facility name

    Examples:
        >>> normalize_facility_name("AUGUSTA HEALTH")
        'Augusta Health'
        >>> normalize_facility_name("bon secours st marys hospital")
        "Bon Secours St. Mary's Hospital"
        >>> normalize_facility_name("ABINGDON HEALTH CARE LLC")
        'Abingdon Health Care LLC'
    """
    if not name:
        return name

    # Strip and normalize whitespace
    name = ' '.join(name.split())

    # Check for special full-name replacements first
    name_lower = name.lower()
    for pattern, replacement in SPECIAL_NAMES.items():
        if pattern in name_lower:
            name_lower = name_lower.replace(pattern, replacement.lower())
            # We'll rebuild with title case, so just mark it

    # Split into words
    words = name.split()
    result = []

    for i, word in enumerate(words):
        word_lower = word.lower()
        word_clean = word_lower.strip('.,;:()')  # Remove punctuation for comparison

        # Keep original punctuation
        prefix = ''
        suffix = ''
        if word.startswith('('):
            prefix = '('
            word_clean = word_clean[1:]
        if word.endswith(')'):
            suffix = ')'
            word_clean = word_clean[:-1]

        # Check if we should expand abbreviation (check this FIRST)
        if expand_abbreviations and word_clean in ABBREVIATIONS:
            result.append(prefix + ABBREVIATIONS[word_clean] + suffix)
            continue

        # Check for title-case words (LLC, Inc, etc.)
        if word_clean in TITLE_CASE_WORDS:
            result.append(prefix + TITLE_CASE_WORDS[word_clean] + suffix)
            continue

        # Check if it's an uppercase acronym
        if word_clean in UPPERCASE_WORDS:
            result.append(prefix + word_clean.upper() + suffix)
            continue

        # Check if it's a lowercase word (but not first word)
        if i > 0 and word_clean in LOWERCASE_WORDS:
            result.append(prefix + word_lower + suffix)
            continue

        # Handle ampersand
        if word == '&':
            result.append('&')
            continue

        # Handle hyphenated words
        if '-' in word:
            parts = word.split('-')
            titled_parts = []
            for part in parts:
                part_lower = part.lower()
                if part_lower in UPPERCASE_WORDS:
                    titled_parts.append(part_lower.upper())
                else:
                    titled_parts.append(part.capitalize())
            result.append('-'.join(titled_parts))
            continue

        # Default: Title Case
        result.append(word.capitalize())

    normalized = ' '.join(result)

    # Post-process special names
    for pattern, replacement in SPECIAL_NAMES.items():
        # Case-insensitive replacement
        compiled = re.compile(re.escape(pattern), re.IGNORECASE)
        normalized = compiled.sub(replacement, normalized)

    return normalized


def normalize_all_facilities(dry_run: bool = True) -> dict:
    """
    Normalize all facility names in the database.

    Args:
        dry_run: If True, only print changes without applying them

    Returns:
        Dictionary with stats about the normalization
    """
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    stats = {
        'total': 0,
        'changed': 0,
        'unchanged': 0,
        'errors': 0,
        'changes': []
    }

    try:
        # Get all facilities
        cur.execute("SELECT id, name FROM facilities ORDER BY name")
        facilities = cur.fetchall()
        stats['total'] = len(facilities)

        for facility_id, name in facilities:
            try:
                normalized = normalize_facility_name(name)

                if normalized != name:
                    stats['changed'] += 1
                    stats['changes'].append({
                        'id': facility_id,
                        'old': name,
                        'new': normalized
                    })

                    if not dry_run:
                        cur.execute(
                            "UPDATE facilities SET name = %s WHERE id = %s",
                            (normalized, facility_id)
                        )
                else:
                    stats['unchanged'] += 1

            except Exception as e:
                stats['errors'] += 1
                print(f"  Error normalizing '{name}': {e}")

        if not dry_run:
            conn.commit()
            print(f"\nApplied {stats['changed']} name changes to database")

    finally:
        cur.close()
        conn.close()

    return stats


def print_normalization_preview(limit: int = None):
    """Print a preview of name normalizations without applying them."""
    stats = normalize_all_facilities(dry_run=True)

    print("=" * 70)
    print("FACILITY NAME NORMALIZATION PREVIEW")
    print("=" * 70)
    print(f"\nTotal facilities: {stats['total']}")
    print(f"Would change: {stats['changed']}")
    print(f"Already normalized: {stats['unchanged']}")

    if stats['changes']:
        print(f"\nChanges to be made:")
        print("-" * 70)

        changes = stats['changes'][:limit] if limit else stats['changes']
        for change in changes:
            print(f"  {change['old']}")
            print(f"  → {change['new']}")
            print()

        if limit and len(stats['changes']) > limit:
            print(f"  ... and {len(stats['changes']) - limit} more changes")


def apply_normalization():
    """Apply name normalization to all facilities in the database."""
    print("Applying facility name normalization...")
    stats = normalize_all_facilities(dry_run=False)

    print("\n" + "=" * 70)
    print("NORMALIZATION COMPLETE")
    print("=" * 70)
    print(f"Total facilities: {stats['total']}")
    print(f"Names changed: {stats['changed']}")
    print(f"Already normalized: {stats['unchanged']}")
    print(f"Errors: {stats['errors']}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--apply":
        apply_normalization()
    else:
        print_normalization_preview(limit=30)
        print("\nTo apply changes, run: python -m scraper.normalize_names --apply")
