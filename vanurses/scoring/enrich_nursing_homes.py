#!/usr/bin/env python3
"""
Enrich nursing homes with location-based data by:
1. Finding nearest hospital with enrichment data
2. Copying location-based scores (crime, weather, commute, amenities)
3. Using regional defaults where no nearby hospital exists
4. Recalculating OFS scores

Run: python enrich_nursing_homes.py
"""

import psycopg2
from math import radians, cos, sin, asin, sqrt

DB_CONFIG = {
    'host': 'localhost',
    'database': 'vanurses',
    'user': 'vanurses_app',
    'password': 'VaNurses2025Secure'
}

# Regional default scores (0-100 scale)
REGIONAL_DEFAULTS = {
    'Northern Virginia': {
        'lssi_score': 65,  # Location Safety - urban areas, higher crime
        'csi_score': 45,   # Commute - heavy traffic
        'cci_score': 70,   # Climate - mild
        'ali_score': 80,   # Amenities - lots of restaurants/services
        'pci_score': 60,   # Pay - competitive
    },
    'Richmond Metro': {
        'lssi_score': 55,
        'csi_score': 60,
        'cci_score': 70,
        'ali_score': 70,
        'pci_score': 55,
    },
    'Hampton Roads': {
        'lssi_score': 55,
        'csi_score': 65,
        'cci_score': 75,
        'ali_score': 70,
        'pci_score': 50,
    },
    'Southwest Virginia': {
        'lssi_score': 75,  # Safer rural areas
        'csi_score': 80,   # Easy commute
        'cci_score': 65,   # Mountain weather
        'ali_score': 50,   # Fewer amenities
        'pci_score': 45,   # Lower pay
    },
    'Shenandoah Valley': {
        'lssi_score': 75,
        'csi_score': 75,
        'cci_score': 65,
        'ali_score': 55,
        'pci_score': 50,
    },
    'Other Virginia': {
        'lssi_score': 70,
        'csi_score': 70,
        'cci_score': 70,
        'ali_score': 55,
        'pci_score': 50,
    },
}

def haversine(lon1, lat1, lon2, lat2):
    """Calculate distance between two points in km."""
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    return c * 6371  # Earth's radius in km


def main():
    print("=" * 70)
    print("NURSING HOME ENRICHMENT SCRIPT")
    print("Copying location-based data from nearby hospitals")
    print("=" * 70)
    print()

    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        # Get all nursing homes
        cursor.execute("""
            SELECT f.id, f.name, f.city, f.latitude, f.longitude, f.region
            FROM facilities f
            WHERE f.facility_type = 'nursing_home'
            ORDER BY f.name
        """)
        nursing_homes = cursor.fetchall()
        print(f"Found {len(nursing_homes)} nursing homes to enrich")
        print()

        # Get hospitals with enrichment data
        cursor.execute("""
            SELECT f.id, f.name, f.city, f.latitude, f.longitude, f.region,
                   fa.ali_score, fcr.lssi_score, fcd.csi_score, fwd.cci_score,
                   fpd.pci_score
            FROM facilities f
            JOIN facility_amenities fa ON f.id = fa.facility_id
            JOIN facility_crime_data fcr ON f.id = fcr.facility_id
            JOIN facility_commute_data fcd ON f.id = fcd.facility_id
            JOIN facility_weather_data fwd ON f.id = fwd.facility_id
            LEFT JOIN facility_pay_data fpd ON f.id = fpd.facility_id
            WHERE f.facility_type = 'hospital'
        """)
        hospitals = cursor.fetchall()
        print(f"Found {len(hospitals)} hospitals with enrichment data")
        print()

        enriched_count = 0
        copied_count = 0
        default_count = 0

        for nh in nursing_homes:
            nh_id, nh_name, nh_city, nh_lat, nh_lon, nh_region = nh

            # Find nearest hospital with data
            nearest_hospital = None
            min_distance = float('inf')

            if nh_lat and nh_lon:
                for h in hospitals:
                    h_id, h_name, h_city, h_lat, h_lon, h_region, ali, lssi, csi, cci, pci = h
                    if h_lat and h_lon:
                        dist = haversine(float(nh_lon), float(nh_lat), float(h_lon), float(h_lat))
                        if dist < min_distance:
                            min_distance = dist
                            nearest_hospital = h

            # Decide whether to use hospital data or regional defaults
            if nearest_hospital and min_distance <= 30:  # Within 30km
                # Use nearby hospital's data
                h_id, h_name, h_city, h_lat, h_lon, h_region, ali, lssi, csi, cci, pci = nearest_hospital
                ali_score = ali
                lssi_score = lssi
                csi_score = csi
                cci_score = cci
                pci_score = pci if pci else REGIONAL_DEFAULTS.get(nh_region, REGIONAL_DEFAULTS['Other Virginia'])['pci_score']
                source = f"Copied from {h_name[:30]} ({min_distance:.1f}km)"
                copied_count += 1
            else:
                # Use regional defaults
                defaults = REGIONAL_DEFAULTS.get(nh_region, REGIONAL_DEFAULTS['Other Virginia'])
                ali_score = defaults['ali_score']
                lssi_score = defaults['lssi_score']
                csi_score = defaults['csi_score']
                cci_score = defaults['cci_score']
                pci_score = defaults['pci_score']
                source = f"Regional defaults ({nh_region})"
                default_count += 1

            # Insert/update facility_amenities
            cursor.execute("""
                INSERT INTO facility_amenities (facility_id, latitude, longitude, ali_score, ali_grade, updated_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                ON CONFLICT (facility_id) DO UPDATE SET
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    ali_score = EXCLUDED.ali_score,
                    ali_grade = EXCLUDED.ali_grade,
                    updated_at = NOW()
            """, (nh_id, nh_lat, nh_lon, ali_score, get_grade(ali_score)))

            # Insert/update facility_crime_data
            cursor.execute("""
                INSERT INTO facility_crime_data (facility_id, lssi_score, lssi_grade, created_at)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (facility_id) DO UPDATE SET
                    lssi_score = EXCLUDED.lssi_score,
                    lssi_grade = EXCLUDED.lssi_grade,
                    created_at = NOW()
            """, (nh_id, lssi_score, get_grade(lssi_score)))

            # Insert/update facility_commute_data
            cursor.execute("""
                INSERT INTO facility_commute_data (facility_id, csi_score, csi_grade, created_at)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (facility_id) DO UPDATE SET
                    csi_score = EXCLUDED.csi_score,
                    csi_grade = EXCLUDED.csi_grade,
                    created_at = NOW()
            """, (nh_id, csi_score, get_grade(csi_score)))

            # Insert/update facility_weather_data
            cursor.execute("""
                INSERT INTO facility_weather_data (facility_id, cci_score, cci_grade, created_at)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (facility_id) DO UPDATE SET
                    cci_score = EXCLUDED.cci_score,
                    cci_grade = EXCLUDED.cci_grade,
                    created_at = NOW()
            """, (nh_id, cci_score, get_grade(cci_score)))

            # Insert/update facility_pay_data
            cursor.execute("""
                INSERT INTO facility_pay_data (facility_id, pci_score, pci_grade, updated_at)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (facility_id) DO UPDATE SET
                    pci_score = EXCLUDED.pci_score,
                    pci_grade = EXCLUDED.pci_grade,
                    updated_at = NOW()
            """, (nh_id, pci_score, get_grade(pci_score)))

            enriched_count += 1
            print(f"[{enriched_count:3d}] {nh_name[:40]:<40} | {source}")

        conn.commit()

        print()
        print("=" * 70)
        print("ENRICHMENT SUMMARY")
        print("=" * 70)
        print(f"Total nursing homes enriched: {enriched_count}")
        print(f"  - Copied from nearby hospital: {copied_count}")
        print(f"  - Using regional defaults: {default_count}")
        print()

        # Now recalculate OFS for all nursing homes
        print("Recalculating OFS scores for nursing homes...")
        recalculate_ofs(cursor)
        conn.commit()

        print()
        print("DONE!")

    finally:
        conn.close()


def get_grade(score):
    """Convert 0-100 score to letter grade."""
    if score is None:
        return None
    if score >= 97: return 'A+'
    elif score >= 90: return 'A'
    elif score >= 86: return 'A-'
    elif score >= 80: return 'B+'
    elif score >= 75: return 'B'
    elif score >= 71: return 'B-'
    elif score >= 65: return 'C+'
    elif score >= 60: return 'C'
    elif score >= 55: return 'C-'
    elif score >= 50: return 'D+'
    elif score >= 45: return 'D'
    elif score >= 40: return 'D-'
    else: return 'F'


def recalculate_ofs(cursor):
    """Recalculate OFS for all nursing homes with new data."""

    # Index weights (must sum to 1.0)
    WEIGHTS = {
        'pci': 0.15,   # Pay
        'eri': 0.12,   # Employee Reviews
        'lssi': 0.10,  # Location Safety
        'pei': 0.10,   # Patient Experience
        'fsi': 0.10,   # Facility Stats
        'cmsi': 0.08,  # CMS Quality
        'ali': 0.08,   # Amenities
        'jti': 0.07,   # Job Transparency
        'lsi': 0.06,   # Leapfrog Safety
        'csi': 0.05,   # Commute
        'qli': 0.05,   # Quality of Life
        'oii': 0.04,   # Opportunity Insights
        'cci': 0.03,   # Climate
    }
    DEFAULT_SCORE = 50

    # Get nursing homes with all scores
    cursor.execute("""
        SELECT
            f.id, f.name,
            fpd.pci_score,
            fpe.pei_score,
            fs.fsi_score,
            fcr.lssi_score,
            fa.ali_score,
            fcd.csi_score,
            fd.qli_score,
            fwd.cci_score,
            fsc.eri_score,
            fsc.jti_score,
            fod.oii_score,
            fsc.cmsi_score,
            fsc.lsi_score
        FROM facilities f
        LEFT JOIN facility_pay_data fpd ON f.id = fpd.facility_id
        LEFT JOIN facility_patient_experience fpe ON f.id = fpe.facility_id
        LEFT JOIN facility_statistics fs ON f.id = fs.facility_id
        LEFT JOIN facility_crime_data fcr ON f.id = fcr.facility_id
        LEFT JOIN facility_amenities fa ON f.id = fa.facility_id
        LEFT JOIN facility_commute_data fcd ON f.id = fcd.facility_id
        LEFT JOIN facility_demographics fd ON f.id = fd.facility_id
        LEFT JOIN facility_weather_data fwd ON f.id = fwd.facility_id
        LEFT JOIN facility_scores fsc ON f.id = fsc.facility_id
        LEFT JOIN facility_opportunity_data fod ON f.id = fod.facility_id
        WHERE f.facility_type = 'nursing_home'
    """)

    facilities = cursor.fetchall()
    updated = 0

    for row in facilities:
        fac_id, name = row[0], row[1]
        scores = {
            'pci': row[2],
            'pei': row[3],
            'fsi': row[4],
            'lssi': row[5],
            'ali': row[6],
            'csi': row[7],
            'qli': row[8],
            'cci': row[9],
            'eri': row[10],
            'jti': row[11],
            'oii': row[12],
            'cmsi': row[13],
            'lsi': row[14],
        }

        # Calculate weighted score
        weighted_sum = 0
        weighted_components = {}
        available = 0

        for idx, weight in WEIGHTS.items():
            score = scores[idx] if scores[idx] is not None else DEFAULT_SCORE
            if scores[idx] is not None:
                available += 1
            weighted = score * weight
            weighted_sum += weighted
            weighted_components[idx] = weighted

        ofs_score = int(round(weighted_sum))
        ofs_score = max(0, min(100, ofs_score))
        ofs_grade = get_grade(ofs_score)

        # Update facility_scores
        cursor.execute("""
            INSERT INTO facility_scores
                (facility_id, pci_score, pei_score, fsi_score, ali_score,
                 csi_score, cci_score, lssi_score, qli_score, eri_score,
                 jti_score, oii_score, cmsi_score, lsi_score,
                 ofs_score, ofs_grade,
                 pci_weighted, pei_weighted, fsi_weighted, ali_weighted,
                 csi_weighted, cci_weighted, lssi_weighted, qli_weighted, eri_weighted,
                 jti_weighted, oii_weighted, cmsi_weighted, lsi_weighted,
                 indices_available, calculated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (facility_id) DO UPDATE SET
                pci_score = EXCLUDED.pci_score,
                pei_score = EXCLUDED.pei_score,
                fsi_score = EXCLUDED.fsi_score,
                ali_score = EXCLUDED.ali_score,
                csi_score = EXCLUDED.csi_score,
                cci_score = EXCLUDED.cci_score,
                lssi_score = EXCLUDED.lssi_score,
                qli_score = EXCLUDED.qli_score,
                eri_score = EXCLUDED.eri_score,
                jti_score = EXCLUDED.jti_score,
                oii_score = EXCLUDED.oii_score,
                cmsi_score = EXCLUDED.cmsi_score,
                lsi_score = EXCLUDED.lsi_score,
                ofs_score = EXCLUDED.ofs_score,
                ofs_grade = EXCLUDED.ofs_grade,
                pci_weighted = EXCLUDED.pci_weighted,
                pei_weighted = EXCLUDED.pei_weighted,
                fsi_weighted = EXCLUDED.fsi_weighted,
                ali_weighted = EXCLUDED.ali_weighted,
                csi_weighted = EXCLUDED.csi_weighted,
                cci_weighted = EXCLUDED.cci_weighted,
                lssi_weighted = EXCLUDED.lssi_weighted,
                qli_weighted = EXCLUDED.qli_weighted,
                eri_weighted = EXCLUDED.eri_weighted,
                jti_weighted = EXCLUDED.jti_weighted,
                oii_weighted = EXCLUDED.oii_weighted,
                cmsi_weighted = EXCLUDED.cmsi_weighted,
                lsi_weighted = EXCLUDED.lsi_weighted,
                indices_available = EXCLUDED.indices_available,
                calculated_at = NOW()
        """, (
            fac_id,
            scores['pci'], scores['pei'], scores['fsi'],
            scores['ali'], scores['csi'], scores['cci'],
            scores['lssi'], scores['qli'], scores['eri'],
            scores['jti'], scores['oii'], scores['cmsi'], scores['lsi'],
            ofs_score, ofs_grade,
            weighted_components['pci'], weighted_components['pei'], weighted_components['fsi'],
            weighted_components['ali'], weighted_components['csi'], weighted_components['cci'],
            weighted_components['lssi'], weighted_components['qli'], weighted_components['eri'],
            weighted_components['jti'], weighted_components['oii'], weighted_components['cmsi'], weighted_components['lsi'],
            available
        ))
        updated += 1

    print(f"Updated OFS for {updated} nursing homes")


if __name__ == '__main__':
    main()
