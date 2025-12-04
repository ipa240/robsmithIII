#!/usr/bin/env python3
"""
Calculate Employee Review Index (ERI) for Virginia healthcare facilities.
Combines Glassdoor and Indeed ratings into a 0-100 score.

Module 3 Part 3: Employee Review Index
"""

import psycopg2
from typing import Dict, Optional
from decimal import Decimal

DB_CONFIG = {
    'host': 'localhost',
    'database': 'vanurses',
    'user': 'vanurses_app',
    'password': 'VaNurses2025Secure'
}

# Map facility names to review system names
SYSTEM_MAPPING = {
    # Major health systems
    'Bon Secours': 'Bon Secours',
    'Carilion': 'Carilion',
    'Centra': 'Centra',
    'INOVA': 'Inova',
    'Sentara': 'Sentara',
    'Riverside': 'Riverside',

    # UVA Health
    'UVA': 'UVA Health',
    'University of Virginia': 'UVA Health',

    # VCU Health
    'VCU': 'VCU Health',
    'Medical College of Virginia': 'VCU Health',

    # Independent hospitals
    'Augusta Health': 'Augusta Health',
    'Bath Community': 'Bath Community Hospital',
    'Buchanan General': 'Buchanan General Hospital',
    'Chesapeake': 'Chesapeake Regional',
    'Wythe County': 'Wythe County Hospital',
    'Fauquier': 'Fauquier Health',
    'VHC Health': 'VHC Health',

    # CHKD
    'Children': 'CHKD',
    'CHKD': 'CHKD',

    # EVMS
    'EVMS': 'EVMS Medical Group',

    # Federal/Military
    'Fort Belvoir': 'Federal/Military',
    'NMC Portsmouth': 'Federal/Military',

    # VA Medical Centers
    'Hampton VA': 'VA Medical Center',
    'Richmond VA': 'VA Medical Center',
    'Salem VA': 'VA Medical Center',

    # HCA hospitals
    'Henrico Doctors': 'HCA',
    'CJW': 'HCA',
    'John Randolph': 'HCA',
    'Reston Hospital': 'HCA',
    'Spotsylvania': 'HCA',
    'Dominion Hospital': 'HCA',
    'LewisGale': 'HCA',  # LewisGale is HCA
    'Stonesprings': 'HCA',  # Stonesprings is HCA

    # Ballad Health
    'Johnston Memorial': 'Ballad Health',
    'Clinch Valley': 'Ballad Health',
    'Lonesome Pine': 'Ballad Health',

    # Lee County (uses Ballad data)
    'Lee County': 'Lee County Hospital',

    # LifePoint
    'Smyth County': 'LifePoint',
    'Twin County': 'LifePoint',
    'Sovah': 'LifePoint',

    # Mary Washington
    'Mary Washington': 'Mary Washington',
    'Stafford Hospital': 'Mary Washington',

    # Novant
    'Novant': 'Novant Health',

    # Valley Health
    'Valley Health': 'Valley Health',
    'Winchester': 'Valley Health',
    'Warren Memorial': 'Valley Health',
    'Page Memorial': 'Valley Health',
    'Shenandoah Memorial': 'Valley Health',

    # UHS (psychiatric)
    'Virginia Beach Psychiatric': 'UHS',
    'Poplar Springs': 'UHS',
    'Cumberland Hospital': 'UHS',
    'The Pavilion': 'UHS',

    # VA State Mental Health
    'Northern Virginia Mental': 'VA State Mental Health',
    'Southern Virginia Mental': 'VA State Mental Health',
    'Southwestern Virginia Mental': 'VA State Mental Health',
    'VA State Mental': 'VA State Mental Health',

    # VA State Psychiatric
    'Western State': 'VA State Psychiatric',
    'Catawba': 'VA State Psychiatric',
    'Hiram W Davis': 'VA State Psychiatric',

    # Bon Secours specific
    'Mary Immaculate': 'Bon Secours',

    # Independent/small hospitals - map to closest match or use defaults
    'Community Memorial': 'Centra',  # South Hill area, closest system
    'Dickenson Community': 'Ballad Health',  # SW VA, Ballad territory
    'Rappahannock General': 'Bon Secours',  # Acquired by Bon Secours
    'Russell County': 'Ballad Health',  # SW VA
    'Southside Community': 'Centra',  # Farmville, Centra area
}

# ERI Component Weights
WEIGHTS = {
    'overall_rating': 0.40,
    'work_life_balance': 0.25,
    'compensation_benefits': 0.20,
    'management_rating': 0.15,
}

def star_to_score(rating: Optional[float]) -> Optional[int]:
    """Convert 1-5 star rating to 0-100 score."""
    if rating is None:
        return None
    # 1 star = 0, 5 stars = 100
    return int(round((rating - 1) * 25))

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

def find_system(facility_name: str) -> Optional[str]:
    """Find the review system for a facility."""
    for key, system in SYSTEM_MAPPING.items():
        if key.lower() in facility_name.lower():
            return system
    return None

def main():
    print("=" * 70)
    print("EMPLOYEE REVIEW INDEX (ERI) CALCULATOR")
    print("Module 3 Part 3: Combined Glassdoor + Indeed Scores")
    print("=" * 70)
    print()

    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        # Get all review data
        cursor.execute("""
            SELECT system_name, source, overall_rating, work_life_balance,
                   compensation_benefits, management_rating, review_count
            FROM facility_reviews
            ORDER BY system_name, source
        """)

        reviews = cursor.fetchall()

        # Aggregate by system (combine Glassdoor + Indeed)
        system_reviews = {}
        for row in reviews:
            system = row[0]
            source = row[1]
            if system not in system_reviews:
                system_reviews[system] = {'glassdoor': None, 'indeed': None}

            system_reviews[system][source] = {
                'overall': float(row[2]) if row[2] else None,
                'work_life': float(row[3]) if row[3] else None,
                'compensation': float(row[4]) if row[4] else None,
                'management': float(row[5]) if row[5] else None,
                'count': row[6]
            }

        print(f"Found reviews for {len(system_reviews)} systems")
        print()

        # Calculate ERI for each system
        system_eri = {}
        for system, sources in system_reviews.items():
            components = {}

            # Average Glassdoor and Indeed for each component
            for comp in ['overall', 'work_life', 'compensation', 'management']:
                values = []
                weights = []

                for source in ['glassdoor', 'indeed']:
                    if sources[source] and sources[source].get(comp):
                        values.append(sources[source][comp])
                        # Weight by review count
                        weights.append(sources[source].get('count', 1) or 1)

                if values:
                    # Weighted average by review count
                    total_weight = sum(weights)
                    weighted_avg = sum(v * w for v, w in zip(values, weights)) / total_weight
                    components[comp] = weighted_avg

            # Calculate weighted ERI
            if 'overall' in components:
                eri_raw = 0
                weight_sum = 0

                if 'overall' in components:
                    eri_raw += components['overall'] * WEIGHTS['overall_rating']
                    weight_sum += WEIGHTS['overall_rating']

                if 'work_life' in components:
                    eri_raw += components['work_life'] * WEIGHTS['work_life_balance']
                    weight_sum += WEIGHTS['work_life_balance']

                if 'compensation' in components:
                    eri_raw += components['compensation'] * WEIGHTS['compensation_benefits']
                    weight_sum += WEIGHTS['compensation_benefits']

                if 'management' in components:
                    eri_raw += components['management'] * WEIGHTS['management_rating']
                    weight_sum += WEIGHTS['management_rating']

                # Normalize if not all components present
                if weight_sum > 0:
                    eri_raw = eri_raw / weight_sum

                # Convert 1-5 scale to 0-100
                eri_score = star_to_score(eri_raw)
                system_eri[system] = {
                    'score': eri_score,
                    'grade': get_grade(eri_score),
                    'components': components
                }

        print("System ERI Scores:")
        print("-" * 70)
        for system in sorted(system_eri.keys()):
            eri = system_eri[system]
            print(f"  {system:<30} ERI: {eri['score']:3d} ({eri['grade']})")
        print()

        # Get all facilities and map to systems
        cursor.execute("""
            SELECT id, name, city FROM facilities
            WHERE state IN ('VA', 'Virginia')
            ORDER BY name
        """)

        facilities = cursor.fetchall()
        print(f"Mapping {len(facilities)} facilities to systems...")
        print()

        results = []
        unmatched = []

        for fac_id, name, city in facilities:
            system = find_system(name)

            if system and system in system_eri:
                eri = system_eri[system]
                results.append({
                    'facility_id': fac_id,
                    'name': name,
                    'system': system,
                    'eri_score': eri['score'],
                    'eri_grade': eri['grade']
                })
            else:
                # No review data - use default 50
                results.append({
                    'facility_id': fac_id,
                    'name': name,
                    'system': system or 'Unknown',
                    'eri_score': 50,
                    'eri_grade': 'D+'
                })
                unmatched.append(name)

        print(f"Matched: {len(results) - len(unmatched)}")
        print(f"Unmatched (using default 50): {len(unmatched)}")
        if unmatched:
            print("  Unmatched facilities:")
            for name in unmatched[:10]:
                print(f"    - {name}")
            if len(unmatched) > 10:
                print(f"    ... and {len(unmatched) - 10} more")
        print()

        # ERI column already added via postgres

        # Update facility_scores with ERI
        print("Updating database...")
        for r in results:
            cursor.execute("""
                UPDATE facility_scores
                SET eri_score = %s
                WHERE facility_id = %s
            """, (r['eri_score'], r['facility_id']))

        conn.commit()
        print(f"Updated {len(results)} facilities with ERI scores")

        # Summary
        print()
        print("=" * 70)
        print("ERI SUMMARY")
        print("=" * 70)

        eri_scores = [r['eri_score'] for r in results]
        print(f"Average ERI: {sum(eri_scores)/len(eri_scores):.1f}")
        print(f"Min ERI: {min(eri_scores)}")
        print(f"Max ERI: {max(eri_scores)}")

        # Grade distribution
        grades = {}
        for r in results:
            grades[r['eri_grade']] = grades.get(r['eri_grade'], 0) + 1

        print()
        print("ERI Grade Distribution:")
        for grade in ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F']:
            if grades.get(grade, 0) > 0:
                print(f"  {grade}: {grades[grade]}")

        # Top and bottom
        sorted_results = sorted(results, key=lambda x: x['eri_score'], reverse=True)

        print()
        print("TOP 10 BY EMPLOYEE REVIEWS:")
        print("-" * 50)
        for r in sorted_results[:10]:
            print(f"  {r['eri_grade']} ({r['eri_score']:2d}): {r['name'][:40]}")

        print()
        print("BOTTOM 10 BY EMPLOYEE REVIEWS:")
        print("-" * 50)
        for r in sorted_results[-10:]:
            print(f"  {r['eri_grade']} ({r['eri_score']:2d}): {r['name'][:40]}")

    finally:
        conn.close()

if __name__ == '__main__':
    main()
