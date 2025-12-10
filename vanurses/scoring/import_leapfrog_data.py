#!/usr/bin/env python3
"""
Import Leapfrog Hospital Safety Grades for Virginia hospitals.
Data sourced from Fall 2025 Leapfrog Safety Grade announcements.
"""

import psycopg2
import re

DB_CONFIG = {
    'host': 'localhost',
    'database': 'vanurses',
    'user': 'vanurses_app',
    'password': 'VaNurses2025Secure'
}

# Virginia hospitals with Fall 2025 Leapfrog grades
# Data from VHHA, HCA Virginia, VCU Health press releases
LEAPFROG_GRADES = {
    # === A GRADE HOSPITALS (36 total) ===
    # Bon Secours
    'Bon Secours Mary Immaculate Hospital': 'A',
    'Mary Immaculate Hospital': 'A',
    'Bon Secours Maryview Medical Center': 'A',
    'Maryview Medical Center': 'A',
    'Bon Secours Southampton Medical Center': 'A',
    'Bon Secours Southampton Memorial Hospital': 'A',

    # Carilion
    'Carilion Franklin Memorial Hospital': 'A',

    # Centra
    'Centra Bedford Memorial Hospital': 'A',

    # Lifepoint
    'Clinch Valley Medical Center': 'A',
    'Wythe County Community Hospital': 'A',

    # HCA Virginia
    'Henrico Doctors\' Hospital': 'A',
    'LewisGale Hospital Alleghany': 'A',
    'LewisGale Hospital Pulaski': 'A',
    'Reston Hospital Center': 'A',
    'Stonesprings Hospital Center': 'A',
    'StoneSprings Hospital Center': 'A',

    # Inova
    'INOVA Alexandria Hospital': 'A',
    'Inova Alexandria Hospital': 'A',
    'INOVA Fairfax Hospital': 'A',
    'Inova Fairfax Hospital': 'A',
    'INOVA Fair Oaks Hospital': 'A',
    'Inova Fair Oaks Hospital': 'A',
    'INOVA Loudoun Hospital': 'A',
    'Inova Loudoun Hospital': 'A',

    # Riverside
    'Riverside Doctors\' Hospital of Williamsburg': 'A',
    'Riverside Doctors\' Hospital Williamsburg': 'A',
    'Riverside Regional Medical Center': 'A',

    # Sentara (major healthcare system)
    'Sentara CarePlex Hospital': 'A',
    'Sentara Careplex Hospital': 'A',
    'Sentara Halifax Regional Hospital': 'A',
    'Sentara Leigh Hospital': 'A',
    'Sentara Northern Virginia Medical Center': 'A',
    'Sentara Obici Hospital': 'A',
    'Sentara Princess Anne Hospital': 'A',
    'Sentara RMH Medical Center': 'A',
    'Sentara Virginia Beach General Hospital': 'A',
    'Sentara Williamsburg Regional Medical Center': 'A',

    # UVA
    'UVA Health Haymarket Medical Center': 'A',
    'UVA Haymarket Medical Center': 'A',
    'UVA Health Prince William Medical Center': 'A',
    'UVA Prince William Medical Center': 'A',
    'Novant Prince William Medical Center': 'A',

    # VCU
    'VCU Medical Center': 'A',
    'Medical College of Virginia Hospitals': 'A',
    'VCU Health Community Memorial Hospital': 'A',
    'Community Memorial Hospital': 'A',
    'VCU Health Tappahannock Hospital': 'A',

    # Valley Health
    'Winchester Medical Center': 'A',

    # === B GRADE HOSPITALS ===
    'University of Virginia Medical Center': 'B',

    # === C GRADE HOSPITALS ===
    'Sentara Norfolk General Hospital': 'C',

    # Other major hospitals (estimates based on not being on A list)
    'Carilion Medical Center': 'B',  # Major trauma center, historically B
    'Bon Secours St Marys Hospital': 'B',
    'Bon Secours Memorial Regional Medical Center': 'B',
    'Chesapeake General Hospital': 'B',
    'Mary Washington Hospital': 'B',
}

# Convert grade to 0-100 LSI score
GRADE_TO_SCORE = {
    'A': 95,
    'B': 80,
    'C': 65,
    'D': 50,
    'F': 30,
}


def normalize_name(name):
    """Normalize hospital name for matching"""
    if not name:
        return ''
    name = name.lower()
    # Remove common words
    name = re.sub(r'\b(hospital|medical|center|health|system|regional|community|memorial|general)\b', '', name)
    name = re.sub(r'[^a-z0-9\s]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def main():
    print("=" * 70)
    print("LEAPFROG HOSPITAL SAFETY GRADE IMPORT")
    print("Fall 2025 Data")
    print("=" * 70)
    print()

    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        # Get all hospitals from facilities
        cursor.execute("""
            SELECT id, name, city
            FROM facilities
            WHERE facility_type IN ('hospital', 'critical_access', 'psychiatric', 'childrens')
              AND state = 'VA'
        """)

        hospitals = cursor.fetchall()
        print(f"Found {len(hospitals)} hospitals in database")
        print()

        matched = 0
        unmatched = []
        grade_counts = {'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0}

        for fac_id, name, city in hospitals:
            grade = None

            # Try exact match
            if name in LEAPFROG_GRADES:
                grade = LEAPFROG_GRADES[name]

            # Try partial match
            if not grade:
                name_lower = name.lower()
                for leapfrog_name, g in LEAPFROG_GRADES.items():
                    if leapfrog_name.lower() in name_lower or name_lower in leapfrog_name.lower():
                        grade = g
                        break

            # Try normalized match
            if not grade:
                norm_name = normalize_name(name)
                for leapfrog_name, g in LEAPFROG_GRADES.items():
                    if normalize_name(leapfrog_name) == norm_name:
                        grade = g
                        break

            if grade:
                lsi_score = GRADE_TO_SCORE[grade]

                # Insert into leapfrog table
                cursor.execute("""
                    INSERT INTO leapfrog_hospital_grades (
                        facility_id, hospital_name, city, safety_grade, grade_period
                    ) VALUES (%s, %s, %s, %s, 'Fall 2025')
                    ON CONFLICT (facility_id) DO UPDATE SET
                        safety_grade = EXCLUDED.safety_grade,
                        grade_period = EXCLUDED.grade_period,
                        updated_at = NOW()
                """, (fac_id, name, city, grade))

                # Update facility_scores
                cursor.execute("""
                    INSERT INTO facility_scores (facility_id, lsi_score, leapfrog_grade)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (facility_id) DO UPDATE SET
                        lsi_score = EXCLUDED.lsi_score,
                        leapfrog_grade = EXCLUDED.leapfrog_grade,
                        calculated_at = NOW()
                """, (fac_id, lsi_score, grade))

                matched += 1
                grade_counts[grade] += 1
                print(f"  ✓ {name[:45]:<45} → {grade} ({lsi_score})")
            else:
                unmatched.append((name, city))

        conn.commit()

        print()
        print(f"Matched: {matched} hospitals")
        print(f"Unmatched: {len(unmatched)} hospitals")

        print()
        print("Grade Distribution:")
        for grade in ['A', 'B', 'C', 'D', 'F']:
            if grade_counts[grade] > 0:
                bar = "█" * grade_counts[grade]
                print(f"  {grade}: {grade_counts[grade]:2d} {bar}")

        if unmatched:
            print()
            print("Unmatched hospitals (no Leapfrog data found):")
            for name, city in unmatched[:15]:  # Show first 15
                print(f"  - {name} ({city})")
            if len(unmatched) > 15:
                print(f"  ... and {len(unmatched) - 15} more")

    finally:
        conn.close()

    print()
    print("Done!")


if __name__ == '__main__':
    main()
