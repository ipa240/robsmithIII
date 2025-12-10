#!/usr/bin/env python3
"""
Import nursing homes from CMS data into the facilities table.
Links them to their CMS Five-Star ratings.
"""

import psycopg2
import re

DB_CONFIG = {
    'host': 'localhost',
    'database': 'vanurses',
    'user': 'vanurses_app',
    'password': 'VaNurses2025Secure'
}

# Map Virginia cities to regions
CITY_TO_REGION = {
    # Hampton Roads
    'Norfolk': 'Hampton Roads', 'Virginia Beach': 'Hampton Roads', 'Newport News': 'Hampton Roads',
    'Hampton': 'Hampton Roads', 'Chesapeake': 'Hampton Roads', 'Portsmouth': 'Hampton Roads',
    'Suffolk': 'Hampton Roads', 'Williamsburg': 'Hampton Roads', 'Poquoson': 'Hampton Roads',

    # Richmond Metro
    'Richmond': 'Richmond Metro', 'Henrico': 'Richmond Metro', 'Chesterfield': 'Richmond Metro',
    'Colonial Heights': 'Richmond Metro', 'Hopewell': 'Richmond Metro', 'Petersburg': 'Richmond Metro',
    'Mechanicsville': 'Richmond Metro', 'Midlothian': 'Richmond Metro', 'Glen Allen': 'Richmond Metro',

    # Northern Virginia
    'Arlington': 'Northern Virginia', 'Alexandria': 'Northern Virginia', 'Fairfax': 'Northern Virginia',
    'Falls Church': 'Northern Virginia', 'Reston': 'Northern Virginia', 'McLean': 'Northern Virginia',
    'Vienna': 'Northern Virginia', 'Herndon': 'Northern Virginia', 'Leesburg': 'Northern Virginia',
    'Manassas': 'Northern Virginia', 'Woodbridge': 'Northern Virginia', 'Centreville': 'Northern Virginia',
    'Annandale': 'Northern Virginia', 'Springfield': 'Northern Virginia', 'Burke': 'Northern Virginia',

    # Roanoke/Lynchburg
    'Roanoke': 'Roanoke Valley', 'Salem': 'Roanoke Valley', 'Vinton': 'Roanoke Valley',
    'Lynchburg': 'Lynchburg', 'Bedford': 'Lynchburg', 'Forest': 'Lynchburg',

    # Charlottesville
    'Charlottesville': 'Charlottesville', 'Waynesboro': 'Charlottesville', 'Staunton': 'Charlottesville',

    # Southwest Virginia
    'Bristol': 'Southwest Virginia', 'Abingdon': 'Southwest Virginia', 'Marion': 'Southwest Virginia',
    'Wytheville': 'Southwest Virginia', 'Radford': 'Southwest Virginia', 'Blacksburg': 'Southwest Virginia',
    'Christiansburg': 'Southwest Virginia', 'Pulaski': 'Southwest Virginia',

    # Shenandoah Valley
    'Winchester': 'Shenandoah Valley', 'Harrisonburg': 'Shenandoah Valley', 'Lexington': 'Shenandoah Valley',
    'Front Royal': 'Shenandoah Valley', 'Woodstock': 'Shenandoah Valley',
}

def get_region(city):
    """Get region for a city, default to 'Other Virginia'"""
    if not city:
        return 'Other Virginia'

    # Direct match
    if city in CITY_TO_REGION:
        return CITY_TO_REGION[city]

    # Try partial match (for variations like "Virginia Beach City")
    city_lower = city.lower()
    for known_city, region in CITY_TO_REGION.items():
        if known_city.lower() in city_lower or city_lower in known_city.lower():
            return region

    return 'Other Virginia'


def normalize_name(name):
    """Normalize facility name for matching"""
    if not name:
        return ''
    # Remove common suffixes and normalize
    name = name.lower()
    name = re.sub(r'\s+(llc|inc|corp|corporation|lp|ltd|center|nursing|home|facility|health|care|rehab|rehabilitation)\.?$', '', name)
    name = re.sub(r'[^a-z0-9\s]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def main():
    print("=" * 70)
    print("IMPORT NURSING HOMES TO FACILITIES TABLE")
    print("=" * 70)
    print()

    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        # Get CMS nursing homes for Virginia
        cursor.execute("""
            SELECT
                ccn, provider_name, address, city, state, zip_code, county,
                ownership_type, num_certified_beds, overall_rating
            FROM cms_nursing_home_ratings
            WHERE state = 'VA'
        """)

        cms_facilities = cursor.fetchall()
        print(f"Found {len(cms_facilities)} Virginia nursing homes in CMS data")
        print()

        added = 0
        updated = 0
        skipped = 0

        for row in cms_facilities:
            ccn, name, address, city, state, zip_code, county, ownership, beds, rating = row

            # Determine region
            region = get_region(city)

            # Normalize name for matching
            name_normalized = normalize_name(name)

            # Check if facility already exists (by CCN or similar name in same city)
            cursor.execute("""
                SELECT id FROM facilities
                WHERE ccn = %s
                   OR (name_normalized = %s AND city = %s)
            """, (ccn, name_normalized, city))

            existing = cursor.fetchone()

            if existing:
                # Update existing facility with CMS data
                cursor.execute("""
                    UPDATE facilities SET
                        ccn = %s,
                        address = COALESCE(address, %s),
                        county = COALESCE(county, %s),
                        ownership_type = COALESCE(ownership_type, %s),
                        bed_count = COALESCE(bed_count, %s),
                        facility_type = COALESCE(facility_type, 'nursing_home'),
                        source_cms = true,
                        updated_at = NOW()
                    WHERE id = %s
                """, (ccn, address, county, ownership, beds, existing[0]))
                updated += 1
            else:
                # Insert new facility
                cursor.execute("""
                    INSERT INTO facilities (
                        ccn, name, name_normalized, address, city, state, zip,
                        county, region, ownership_type, bed_count, facility_type,
                        source_cms, is_active, scrape_enabled
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'nursing_home',
                        true, true, false
                    )
                """, (
                    ccn, name, name_normalized, address, city, state, zip_code,
                    county, region, ownership, beds
                ))
                added += 1

            if (added + updated) % 50 == 0:
                print(f"  Processed {added + updated} facilities...")

        conn.commit()

        print()
        print(f"Results:")
        print(f"  Added: {added} new nursing homes")
        print(f"  Updated: {updated} existing facilities")
        print(f"  Total: {added + updated}")

        # Show facility type breakdown
        print()
        cursor.execute("""
            SELECT facility_type, COUNT(*)
            FROM facilities
            GROUP BY facility_type
            ORDER BY count DESC
        """)

        print("Facility Type Distribution:")
        for row in cursor.fetchall():
            ftype = row[0] or 'unknown'
            print(f"  {ftype}: {row[1]}")

        # Show region breakdown for nursing homes
        print()
        cursor.execute("""
            SELECT region, COUNT(*)
            FROM facilities
            WHERE facility_type = 'nursing_home'
            GROUP BY region
            ORDER BY count DESC
        """)

        print("Nursing Homes by Region:")
        for row in cursor.fetchall():
            region = row[0] or 'Unknown'
            print(f"  {region}: {row[1]}")

    finally:
        conn.close()

    print()
    print("Done!")


if __name__ == '__main__':
    main()
