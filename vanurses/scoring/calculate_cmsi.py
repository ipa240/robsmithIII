#!/usr/bin/env python3
"""
Calculate CMSI (CMS Quality Index) for nursing homes.
Converts CMS Five-Star ratings to 0-100 score.

Score Conversion:
- 5 stars = 100
- 4 stars = 80
- 3 stars = 60
- 2 stars = 40
- 1 star = 20
- No rating = NULL (will use default in OFS calc)
"""

import psycopg2

DB_CONFIG = {
    'host': 'localhost',
    'database': 'vanurses',
    'user': 'vanurses_app',
    'password': 'VaNurses2025Secure'
}

# Convert 1-5 star rating to 0-100 score
STAR_TO_SCORE = {
    5: 100,
    4: 80,
    3: 60,
    2: 40,
    1: 20,
}


def main():
    print("=" * 70)
    print("CMSI (CMS QUALITY INDEX) CALCULATOR")
    print("=" * 70)
    print()

    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        # Columns already added via postgres user
        # Get nursing homes with CMS ratings
        cursor.execute("""
            SELECT
                f.id as facility_id,
                f.name,
                f.city,
                c.overall_rating,
                c.health_inspection_rating,
                c.staffing_rating,
                c.qm_rating
            FROM facilities f
            JOIN cms_nursing_home_ratings c ON f.ccn = c.ccn
            WHERE f.facility_type = 'nursing_home'
              AND c.overall_rating IS NOT NULL
        """)

        facilities = cursor.fetchall()
        print(f"Found {len(facilities)} nursing homes with CMS ratings")
        print()

        updated = 0
        score_dist = {100: 0, 80: 0, 60: 0, 40: 0, 20: 0}

        for row in facilities:
            fac_id, name, city, overall, health, staffing, qm = row

            # Convert to CMSI score (0-100)
            cmsi_score = STAR_TO_SCORE.get(overall, 50)  # Default to 50 if unknown
            score_dist[cmsi_score] = score_dist.get(cmsi_score, 0) + 1

            # Upsert into facility_scores
            cursor.execute("""
                INSERT INTO facility_scores (
                    facility_id, cmsi_score, cms_overall_rating,
                    cms_health_rating, cms_staffing_rating, cms_qm_rating
                ) VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (facility_id) DO UPDATE SET
                    cmsi_score = EXCLUDED.cmsi_score,
                    cms_overall_rating = EXCLUDED.cms_overall_rating,
                    cms_health_rating = EXCLUDED.cms_health_rating,
                    cms_staffing_rating = EXCLUDED.cms_staffing_rating,
                    cms_qm_rating = EXCLUDED.cms_qm_rating,
                    calculated_at = NOW()
            """, (fac_id, cmsi_score, overall, health, staffing, qm))

            updated += 1

            if updated % 50 == 0:
                print(f"  Updated {updated} facilities...")

        conn.commit()

        print()
        print(f"Updated CMSI scores for {updated} nursing homes")
        print()
        print("CMSI Score Distribution:")
        for score in sorted(score_dist.keys(), reverse=True):
            stars = score // 20
            bar = "█" * (score_dist[score] // 2)
            print(f"  {score:3d} ({stars}★): {score_dist[score]:3d} {bar}")

        # Calculate average
        cursor.execute("""
            SELECT
                ROUND(AVG(cmsi_score)::numeric, 1) as avg_cmsi,
                COUNT(*) as count
            FROM facility_scores
            WHERE cmsi_score IS NOT NULL
        """)
        stats = cursor.fetchone()
        print()
        print(f"Average CMSI Score: {stats[0]}")
        print(f"Facilities with CMSI: {stats[1]}")

    finally:
        conn.close()

    print()
    print("Done!")


if __name__ == '__main__':
    main()
