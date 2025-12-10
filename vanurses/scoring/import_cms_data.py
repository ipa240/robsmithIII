#!/usr/bin/env python3
"""
Import CMS Five-Star Nursing Home Rating data into the database.

Downloads from: https://data.cms.gov/provider-data/dataset/4pq5-n9py
"""

import csv
import psycopg2
from datetime import datetime
import subprocess
import os

DB_CONFIG = {
    'host': 'localhost',
    'database': 'vanurses',
    'user': 'vanurses_app',
    'password': 'VaNurses2025Secure'
}

CSV_URL = "https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0/download?format=csv"
CSV_PATH = "/tmp/cms_nursing_home.csv"


def download_cms_data():
    """Download latest CMS nursing home data"""
    print(f"Downloading CMS data from {CSV_URL}...")
    result = subprocess.run(
        ['wget', '-O', CSV_PATH, CSV_URL],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"Download failed: {result.stderr}")
        return False
    print(f"Downloaded to {CSV_PATH}")
    return True


def create_table(cursor):
    """Create CMS ratings table if not exists"""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cms_nursing_home_ratings (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            ccn VARCHAR(20) UNIQUE,
            provider_name VARCHAR(255),
            address VARCHAR(255),
            city VARCHAR(100),
            state VARCHAR(2),
            zip_code VARCHAR(10),
            county VARCHAR(100),
            ownership_type VARCHAR(100),
            num_certified_beds INT,
            overall_rating INT,
            health_inspection_rating INT,
            staffing_rating INT,
            qm_rating INT,
            long_stay_qm_rating INT,
            short_stay_qm_rating INT,
            abuse_icon VARCHAR(10),
            special_focus_status VARCHAR(50),
            data_date DATE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_cms_state ON cms_nursing_home_ratings(state);
        CREATE INDEX IF NOT EXISTS idx_cms_city ON cms_nursing_home_ratings(city);
        CREATE INDEX IF NOT EXISTS idx_cms_overall ON cms_nursing_home_ratings(overall_rating);
    """)


def parse_int(value):
    """Safely parse integer from CSV"""
    if not value or value.strip() == '':
        return None
    try:
        return int(value)
    except ValueError:
        return None


def import_data(cursor, state_filter='VA'):
    """Import CMS data from CSV, filtering by state"""

    print(f"Importing CMS data for state: {state_filter}")

    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        count = 0
        skipped = 0

        for row in reader:
            # Filter by state
            state = row.get('State', '').strip()
            if state != state_filter:
                skipped += 1
                continue

            ccn = row.get('CMS Certification Number (CCN)', '').strip()
            if not ccn:
                continue

            cursor.execute("""
                INSERT INTO cms_nursing_home_ratings (
                    ccn, provider_name, address, city, state, zip_code, county,
                    ownership_type, num_certified_beds,
                    overall_rating, health_inspection_rating, staffing_rating,
                    qm_rating, long_stay_qm_rating, short_stay_qm_rating,
                    abuse_icon, special_focus_status, data_date
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                ON CONFLICT (ccn) DO UPDATE SET
                    provider_name = EXCLUDED.provider_name,
                    address = EXCLUDED.address,
                    city = EXCLUDED.city,
                    state = EXCLUDED.state,
                    zip_code = EXCLUDED.zip_code,
                    county = EXCLUDED.county,
                    ownership_type = EXCLUDED.ownership_type,
                    num_certified_beds = EXCLUDED.num_certified_beds,
                    overall_rating = EXCLUDED.overall_rating,
                    health_inspection_rating = EXCLUDED.health_inspection_rating,
                    staffing_rating = EXCLUDED.staffing_rating,
                    qm_rating = EXCLUDED.qm_rating,
                    long_stay_qm_rating = EXCLUDED.long_stay_qm_rating,
                    short_stay_qm_rating = EXCLUDED.short_stay_qm_rating,
                    abuse_icon = EXCLUDED.abuse_icon,
                    special_focus_status = EXCLUDED.special_focus_status,
                    data_date = EXCLUDED.data_date,
                    updated_at = NOW()
            """, (
                ccn,
                row.get('Provider Name', '')[:255],
                row.get('Provider Address', '')[:255],
                row.get('City/Town', '')[:100],
                state,
                row.get('ZIP Code', '')[:10],
                row.get('County/Parish', '')[:100],
                row.get('Ownership Type', '')[:100],
                parse_int(row.get('Number of Certified Beds', '')),
                parse_int(row.get('Overall Rating', '')),
                parse_int(row.get('Health Inspection Rating', '')),
                parse_int(row.get('Staffing Rating', '')),
                parse_int(row.get('QM Rating', '')),
                parse_int(row.get('Long-Stay QM Rating', '')),
                parse_int(row.get('Short-Stay QM Rating', '')),
                row.get('Abuse Icon', '')[:10] if row.get('Abuse Icon') else None,
                row.get('Special Focus Status', '')[:50] if row.get('Special Focus Status') else None,
                datetime.now().date()
            ))

            count += 1
            if count % 50 == 0:
                print(f"  Imported {count} facilities...")

        print(f"Imported {count} Virginia nursing homes (skipped {skipped} out-of-state)")
        return count


def show_stats(cursor):
    """Show rating distribution stats"""
    print("\n" + "=" * 60)
    print("CMS FIVE-STAR RATING DISTRIBUTION (Virginia)")
    print("=" * 60)

    cursor.execute("""
        SELECT
            overall_rating,
            COUNT(*) as count
        FROM cms_nursing_home_ratings
        WHERE state = 'VA' AND overall_rating IS NOT NULL
        GROUP BY overall_rating
        ORDER BY overall_rating DESC
    """)

    print("\nOverall Rating Distribution:")
    for row in cursor.fetchall():
        stars = "★" * row[0] + "☆" * (5 - row[0])
        print(f"  {stars} ({row[0]} stars): {row[1]} facilities")

    cursor.execute("""
        SELECT
            COUNT(*) as total,
            ROUND(AVG(overall_rating)::numeric, 2) as avg_rating,
            COUNT(*) FILTER (WHERE overall_rating = 5) as five_star,
            COUNT(*) FILTER (WHERE overall_rating = 1) as one_star
        FROM cms_nursing_home_ratings
        WHERE state = 'VA' AND overall_rating IS NOT NULL
    """)

    stats = cursor.fetchone()
    print(f"\nStatistics:")
    print(f"  Total facilities with ratings: {stats[0]}")
    print(f"  Average rating: {stats[1]} stars")
    print(f"  5-star facilities: {stats[2]}")
    print(f"  1-star facilities: {stats[3]}")


def main():
    print("=" * 60)
    print("CMS FIVE-STAR NURSING HOME DATA IMPORT")
    print("=" * 60)
    print()

    # Download if file doesn't exist or is old
    if not os.path.exists(CSV_PATH):
        if not download_cms_data():
            return
    else:
        print(f"Using existing file: {CSV_PATH}")

    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        create_table(cursor)
        conn.commit()

        count = import_data(cursor)
        conn.commit()

        show_stats(cursor)

        print("\nDone!")

    finally:
        conn.close()


if __name__ == '__main__':
    main()
