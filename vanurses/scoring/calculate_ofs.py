#!/usr/bin/env python3
"""
Calculate Overall Facility Score (OFS) for Virginia healthcare facilities.
Combines all 13 indices into a single weighted score.

Module 10: Overall Facility Score

Index Weights (total 100%) - 13 indices:
- PCI (Pay Competitiveness): 15%
- ERI (Employee Reviews): 12%
- LSSI (Location Safety): 10%
- PEI (Patient Experience): 10%
- FSI (Facility Statistics): 10%
- CMSI (CMS Quality - nursing homes): 8%
- ALI (Amenities & Lifestyle): 8%
- JTI (Job Transparency): 7%
- LSI (Leapfrog Safety - hospitals): 6%
- CSI (Commute Stress): 5%
- QLI (Quality of Life): 5%
- OII (Opportunity Insights): 4%
- CCI (Climate Comfort): 3%

Data Sources:
- CMS Five-Star (nursing homes) - cms.gov
- Leapfrog Safety Grades (hospitals) - hospitalsafetygrade.org
- Opportunity Atlas (opportunityatlas.org) - Economic mobility data
- BLS, CMS HCAHPS, FBI Crime Stats, Census Bureau, etc.
"""

import psycopg2
from typing import Dict, List, Optional

DB_CONFIG = {
    'host': 'localhost',
    'database': 'vanurses',
    'user': 'vanurses_app',
    'password': 'VaNurses2025Secure'
}

# Index weights (must sum to 1.0) - 13 indices total
WEIGHTS = {
    'pci': 0.15,   # Pay - most important for job seekers
    'eri': 0.12,   # Employee Reviews - what employees say
    'lssi': 0.10,  # Location Safety - personal safety matters
    'pei': 0.10,   # Patient Experience - work environment quality
    'fsi': 0.10,   # Facility Stats - hospital resources/quality
    'cmsi': 0.08,  # CMS Quality (nursing homes) - government rating
    'ali': 0.08,   # Amenities - work-life balance
    'jti': 0.07,   # Job Transparency - how clear are job postings
    'lsi': 0.06,   # Leapfrog Safety (hospitals) - third-party safety rating
    'csi': 0.05,   # Commute - daily quality of life
    'qli': 0.05,   # Quality of Life - community factors
    'oii': 0.04,   # Opportunity Insights - economic mobility
    'cci': 0.03,   # Climate - nice to have
}

DEFAULT_SCORE = 50  # Used when index is missing

def get_grade(score: int) -> str:
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

def main():
    print("=" * 70)
    print("OVERALL FACILITY SCORE (OFS) CALCULATOR")
    print("Module 10: Combined Index Score")
    print("=" * 70)
    print()

    print("Index Weights:")
    for idx, weight in WEIGHTS.items():
        print(f"  {idx.upper()}: {weight*100:.0f}%")
    print()

    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        # Get all facilities with their index scores (all 13 indices)
        cursor.execute("""
            SELECT
                f.id,
                f.name,
                f.city,
                f.facility_type,
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
            WHERE f.state IN ('VA', 'Virginia')
            ORDER BY f.name
        """)

        facilities = cursor.fetchall()
        print(f"Processing {len(facilities)} facilities...")
        print()

        results = []

        for row in facilities:
            fac_id, name, city, facility_type = row[0], row[1], row[2], row[3]

            scores = {
                'pci': row[4],
                'pei': row[5],
                'fsi': row[6],
                'lssi': row[7],
                'ali': row[8],
                'csi': row[9],
                'qli': row[10],
                'cci': row[11],
                'eri': row[12],
                'jti': row[13],
                'oii': row[14],
                'cmsi': row[15],  # CMS Quality (nursing homes)
                'lsi': row[16],   # Leapfrog Safety (hospitals)
            }

            # Count available indices
            available = sum(1 for s in scores.values() if s is not None)

            # Calculate weighted score
            weighted_sum = 0
            weighted_components = {}
            notes = []

            for idx, weight in WEIGHTS.items():
                score = scores[idx] if scores[idx] is not None else DEFAULT_SCORE
                weighted = score * weight
                weighted_sum += weighted
                weighted_components[idx] = weighted

                if scores[idx] is None:
                    notes.append(f"{idx.upper()}=default")

            ofs_score = int(round(weighted_sum))
            ofs_score = max(0, min(100, ofs_score))
            ofs_grade = get_grade(ofs_score)

            result = {
                'facility_id': fac_id,
                'name': name,
                'city': city,
                'scores': scores,
                'weighted': weighted_components,
                'ofs_score': ofs_score,
                'ofs_grade': ofs_grade,
                'available': available,
                'notes': ', '.join(notes) if notes else None
            }
            results.append(result)

            print(f"[{len(results):2d}] {name[:42]:<42} OFS: {ofs_score:3d} ({ofs_grade}) [{available}/13 indices]")

        print()
        print("Updating database...")

        for r in results:
            cursor.execute("""
                INSERT INTO facility_scores
                    (facility_id, pci_score, pei_score, fsi_score, ali_score,
                     csi_score, cci_score, lssi_score, qli_score, eri_score,
                     jti_score, oii_score, cmsi_score, lsi_score,
                     ofs_score, ofs_grade,
                     pci_weighted, pei_weighted, fsi_weighted, ali_weighted,
                     csi_weighted, cci_weighted, lssi_weighted, qli_weighted, eri_weighted,
                     jti_weighted, oii_weighted, cmsi_weighted, lsi_weighted,
                     indices_available, calculation_notes, calculated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
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
                    calculation_notes = EXCLUDED.calculation_notes,
                    calculated_at = now()
            """, (
                r['facility_id'],
                r['scores']['pci'], r['scores']['pei'], r['scores']['fsi'],
                r['scores']['ali'], r['scores']['csi'], r['scores']['cci'],
                r['scores']['lssi'], r['scores']['qli'], r['scores']['eri'],
                r['scores']['jti'], r['scores']['oii'], r['scores']['cmsi'], r['scores']['lsi'],
                r['ofs_score'], r['ofs_grade'],
                r['weighted']['pci'], r['weighted']['pei'], r['weighted']['fsi'],
                r['weighted']['ali'], r['weighted']['csi'], r['weighted']['cci'],
                r['weighted']['lssi'], r['weighted']['qli'], r['weighted']['eri'],
                r['weighted']['jti'], r['weighted']['oii'], r['weighted']['cmsi'], r['weighted']['lsi'],
                r['available'], r['notes']
            ))

        conn.commit()
        print(f"Updated {len(results)} facilities")

        # Summary
        print()
        print("=" * 70)
        print("OFS SUMMARY")
        print("=" * 70)

        # Grade distribution
        print()
        print("OFS Grade Distribution:")
        grades = {}
        for r in results:
            grades[r['ofs_grade']] = grades.get(r['ofs_grade'], 0) + 1
        for grade in ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F']:
            if grades.get(grade, 0) > 0:
                print(f"  {grade}: {grades[grade]}")

        # Top and bottom
        sorted_results = sorted(results, key=lambda x: x['ofs_score'], reverse=True)

        print()
        print("TOP 10 BEST OVERALL (Highest OFS):")
        print("-" * 70)
        for r in sorted_results[:10]:
            s = r['scores']
            print(f"  {r['ofs_grade']} ({r['ofs_score']:2d}): {r['name'][:35]:<35} {r['city']}")
            print(f"         PCI:{s['pci'] or '-':>3} ERI:{s['eri'] or '-':>3} PEI:{s['pei'] or '-':>3} FSI:{s['fsi'] or '-':>3} LSSI:{s['lssi'] or '-':>3} ALI:{s['ali'] or '-':>3}")

        print()
        print("BOTTOM 10 (Lowest OFS):")
        print("-" * 70)
        for r in sorted_results[-10:]:
            s = r['scores']
            print(f"  {r['ofs_grade']} ({r['ofs_score']:2d}): {r['name'][:35]:<35} {r['city']}")
            print(f"         PCI:{s['pci'] or '-':>3} ERI:{s['eri'] or '-':>3} PEI:{s['pei'] or '-':>3} FSI:{s['fsi'] or '-':>3} LSSI:{s['lssi'] or '-':>3} ALI:{s['ali'] or '-':>3}")

        # Stats
        all_ofs = [r['ofs_score'] for r in results]
        print()
        print("Statistics:")
        print(f"  Total Facilities: {len(results)}")
        print(f"  Average OFS: {sum(all_ofs)/len(all_ofs):.1f}")
        print(f"  Min OFS: {min(all_ofs)}")
        print(f"  Max OFS: {max(all_ofs)}")

    finally:
        conn.close()

if __name__ == '__main__':
    main()
