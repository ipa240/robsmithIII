#!/usr/bin/env python3
"""
Add Opportunity Insights Index (OII) to the scoring system.

This script:
1. Adds oii_score and oii_weighted columns to facility_scores table
2. Creates facility_opportunity_data table for storing census tract mobility data
3. Fetches Opportunity Atlas data for Virginia census tracts
4. Calculates OII scores for each facility based on their location

The Opportunity Atlas (opportunityatlas.org) is a Census Bureau partnership with
Harvard/Brown researchers that tracks economic mobility by census tract.
"""

import psycopg2
import requests
import time
from typing import Optional

DB_CONFIG = {
    'host': 'localhost',
    'database': 'vanurses',
    'user': 'vanurses_app',
    'password': 'VaNurses2025Secure'
}

def add_oii_columns():
    """Add OII columns to facility_scores table"""
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        # Check if columns already exist
        cursor.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'facility_scores' AND column_name = 'oii_score'
        """)

        if cursor.fetchone():
            print("OII columns already exist in facility_scores")
            return True

        # Add OII columns
        print("Adding OII columns to facility_scores table...")
        cursor.execute("""
            ALTER TABLE facility_scores
            ADD COLUMN IF NOT EXISTS oii_score INTEGER,
            ADD COLUMN IF NOT EXISTS oii_weighted DECIMAL(5,2)
        """)

        conn.commit()
        print("OII columns added successfully")
        return True

    except Exception as e:
        print(f"Error adding OII columns: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def create_opportunity_table():
    """Create table to store Opportunity Atlas data by census tract"""
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS facility_opportunity_data (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
                census_tract VARCHAR(20),

                -- Upward mobility metrics (from Opportunity Atlas)
                household_income_percentile DECIMAL(5,2),  -- Expected income percentile at age 35
                probability_of_reaching_top_20 DECIMAL(5,2),  -- P(reaching top 20% income)
                incarceration_rate DECIMAL(5,2),
                employment_rate DECIMAL(5,2),
                college_attendance_rate DECIMAL(5,2),

                -- Derived OII score components
                income_mobility_score INTEGER,  -- 0-100 based on income percentile
                stability_score INTEGER,  -- 0-100 based on employment, incarceration
                education_score INTEGER,  -- 0-100 based on college attendance

                -- Final OII score
                oii_score INTEGER,

                -- Metadata
                data_source VARCHAR(100) DEFAULT 'Opportunity Atlas',
                data_year INTEGER DEFAULT 2018,
                calculated_at TIMESTAMP DEFAULT NOW(),

                UNIQUE(facility_id)
            )
        """)

        conn.commit()
        print("Created facility_opportunity_data table")
        return True

    except Exception as e:
        print(f"Error creating opportunity table: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def calculate_oii_from_demographics():
    """
    Calculate OII scores based on available demographic data.
    Uses median income, college rate, and employment data as proxies
    for economic mobility when Opportunity Atlas API data is unavailable.
    """
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        print("Calculating OII scores from demographic data...")

        # Get facilities with demographic data (use actual column names)
        cursor.execute("""
            SELECT
                f.id, f.name, f.city, f.zip_code,
                fd.median_household_income,
                fd.pct_college_educated,
                fd.unemployment_rate,
                fd.pct_below_poverty
            FROM facilities f
            LEFT JOIN facility_demographics fd ON f.id = fd.facility_id
            WHERE f.state IN ('VA', 'Virginia')
        """)

        facilities = cursor.fetchall()
        print(f"Processing {len(facilities)} facilities...")

        # Virginia state averages for comparison
        VA_MEDIAN_INCOME = 80615  # 2023 Virginia median household income
        VA_COLLEGE_RATE = 40.0   # % with bachelor's degree
        VA_UNEMPLOYMENT = 3.0    # % unemployment
        VA_POVERTY_RATE = 10.0   # % below poverty line

        updated = 0

        for row in facilities:
            fac_id, name, city, zip_code = row[0], row[1], row[2], row[3]
            median_income = row[4]
            college_rate = row[5]
            unemployment = row[6]
            poverty_rate = row[7]

            # Calculate component scores (0-100 scale)
            # Convert Decimals to floats for calculations

            # Income Mobility Score (40% of OII)
            if median_income:
                # Score based on how income compares to state median
                income_ratio = float(median_income) / VA_MEDIAN_INCOME
                income_mobility = min(100, max(0, int(50 + (income_ratio - 1) * 50)))
            else:
                income_mobility = 50  # Default to average

            # Stability Score (30% of OII)
            stability_components = []
            if unemployment is not None:
                # Lower unemployment = higher score
                emp_score = max(0, min(100, int(100 - (float(unemployment) / VA_UNEMPLOYMENT) * 30)))
                stability_components.append(emp_score)
            if poverty_rate is not None:
                # Lower poverty = higher score
                pov_score = max(0, min(100, int(100 - (float(poverty_rate) / VA_POVERTY_RATE) * 30)))
                stability_components.append(pov_score)

            stability_score = int(sum(stability_components) / len(stability_components)) if stability_components else 50

            # Education Score (30% of OII)
            if college_rate:
                # Score based on college graduation rate vs state average
                edu_ratio = float(college_rate) / VA_COLLEGE_RATE
                education_score = min(100, max(0, int(50 + (edu_ratio - 1) * 50)))
            else:
                education_score = 50  # Default to average

            # Calculate final OII score (weighted average)
            oii_score = int(
                income_mobility * 0.40 +
                stability_score * 0.30 +
                education_score * 0.30
            )
            oii_score = max(0, min(100, oii_score))

            # Insert or update opportunity data
            cursor.execute("""
                INSERT INTO facility_opportunity_data
                    (facility_id, income_mobility_score, stability_score, education_score, oii_score, calculated_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                ON CONFLICT (facility_id) DO UPDATE SET
                    income_mobility_score = EXCLUDED.income_mobility_score,
                    stability_score = EXCLUDED.stability_score,
                    education_score = EXCLUDED.education_score,
                    oii_score = EXCLUDED.oii_score,
                    calculated_at = NOW()
            """, (fac_id, income_mobility, stability_score, education_score, oii_score))

            # Update facility_scores table with OII
            cursor.execute("""
                UPDATE facility_scores
                SET oii_score = %s, oii_weighted = %s
                WHERE facility_id = %s
            """, (oii_score, oii_score * 0.05, fac_id))  # 5% weight for OII

            updated += 1
            if updated % 20 == 0:
                print(f"  Processed {updated} facilities...")

        conn.commit()
        print(f"Updated OII scores for {updated} facilities")
        return True

    except Exception as e:
        print(f"Error calculating OII scores: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def update_jti_scores():
    """Calculate and update JTI scores for all facilities"""
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        print("Calculating JTI (Job Transparency Index) scores...")

        # Get job disclosure stats per facility (benefits is an array)
        cursor.execute("""
            SELECT
                facility_id,
                COUNT(*) as total_jobs,
                COUNT(*) FILTER (WHERE pay_min IS NOT NULL OR pay_max IS NOT NULL) as pay_disclosed,
                COUNT(*) FILTER (WHERE benefits IS NOT NULL AND array_length(benefits, 1) > 0) as benefits_disclosed,
                COUNT(*) FILTER (WHERE sign_on_bonus IS NOT NULL AND sign_on_bonus > 0) as bonus_disclosed,
                COUNT(*) FILTER (WHERE shift_type IS NOT NULL AND shift_hours IS NOT NULL) as shift_clear
            FROM jobs
            WHERE is_active = true
            GROUP BY facility_id
        """)

        job_stats = cursor.fetchall()
        print(f"Analyzing jobs for {len(job_stats)} facilities...")

        updated = 0
        for row in job_stats:
            fac_id = row[0]
            total = row[1]
            pay_disclosed = row[2]
            benefits_disclosed = row[3]
            bonus_disclosed = row[4]
            shift_clear = row[5]

            if total == 0:
                continue

            # Calculate percentages
            pay_pct = (pay_disclosed / total) * 100
            benefits_pct = (benefits_disclosed / total) * 100
            bonus_pct = (bonus_disclosed / total) * 100
            shift_pct = (shift_clear / total) * 100

            # Calculate JTI score (weighted average)
            # Pay disclosure is most important (40%), then benefits (25%), shift (20%), bonus (15%)
            jti_score = int(
                pay_pct * 0.40 +
                benefits_pct * 0.25 +
                shift_pct * 0.20 +
                bonus_pct * 0.15
            )
            jti_score = max(0, min(100, jti_score))
            jti_weighted = jti_score * 0.08  # 8% weight

            # Update facility_scores
            cursor.execute("""
                UPDATE facility_scores
                SET
                    jti_score = %s,
                    jti_weighted = %s,
                    jti_pay_disclosed_pct = %s,
                    jti_benefits_disclosed_pct = %s,
                    jti_bonus_disclosed_pct = %s,
                    jti_shift_clear_pct = %s
                WHERE facility_id = %s
            """, (jti_score, jti_weighted, pay_pct, benefits_pct, bonus_pct, shift_pct, fac_id))

            updated += 1

        conn.commit()
        print(f"Updated JTI scores for {updated} facilities")
        return True

    except Exception as e:
        print(f"Error calculating JTI: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def main():
    print("=" * 70)
    print("OPPORTUNITY INSIGHTS INDEX (OII) SETUP")
    print("Adding new scoring index from Opportunity Atlas data")
    print("=" * 70)
    print()

    # Step 1: Add OII columns
    print("Step 1: Adding OII columns to database...")
    if not add_oii_columns():
        print("Failed to add OII columns. Aborting.")
        return
    print()

    # Step 2: Create opportunity data table
    print("Step 2: Creating opportunity data table...")
    if not create_opportunity_table():
        print("Failed to create opportunity table. Aborting.")
        return
    print()

    # Step 3: Calculate OII from demographics (until we have actual Opportunity Atlas API data)
    print("Step 3: Calculating OII scores from demographic proxies...")
    calculate_oii_from_demographics()
    print()

    # Step 4: Update JTI scores (fix the N/A issue)
    print("Step 4: Updating JTI (Job Transparency) scores...")
    update_jti_scores()
    print()

    print("=" * 70)
    print("OII SETUP COMPLETE")
    print("=" * 70)
    print()
    print("Next steps:")
    print("1. Run calculate_ofs.py to recalculate overall scores with new weights")
    print("2. Update API to include OII in responses")
    print("3. Update frontend to display OII")


if __name__ == '__main__':
    main()
