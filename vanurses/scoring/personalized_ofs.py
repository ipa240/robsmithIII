#!/usr/bin/env python3
"""
VANurses Personalized Facility Ranking Demo
Module 11: User Preferences & Personalized Rankings

Interactive onboarding that captures user priorities and calculates
personalized facility rankings.
"""

import psycopg2
from math import radians, cos, sin, asin, sqrt

DB_CONFIG = {
    'host': '192.168.0.150',
    'database': 'vanurses',
    'user': 'vanurses_app',
    'password': 'VaNurses2025Secure'
}

# Zip code to lat/lng mapping for Virginia (common zips)
ZIP_COORDS = {
    '22101': (38.9339, -77.1773),  # McLean
    '22201': (38.8816, -77.0910),  # Arlington
    '22301': (38.8206, -77.0581),  # Alexandria
    '22401': (38.3032, -77.4605),  # Fredericksburg
    '22901': (38.0293, -78.4767),  # Charlottesville
    '23060': (37.6688, -77.5883),  # Glen Allen
    '23220': (37.5538, -77.4603),  # Richmond
    '23320': (36.7682, -76.2366),  # Chesapeake
    '23451': (36.8529, -75.9780),  # Virginia Beach
    '23502': (36.8946, -76.2590),  # Norfolk
    '23601': (37.0226, -76.4581),  # Newport News
    '23666': (37.0571, -76.3853),  # Hampton
    '24011': (37.2707, -79.9414),  # Roanoke
    '24060': (37.2296, -80.4139),  # Blacksburg
    '24501': (37.4138, -79.1423),  # Lynchburg
    '22030': (38.8462, -77.3064),  # Fairfax
    '22042': (38.8631, -77.2311),  # Falls Church
    '22102': (38.9531, -77.2272),  # McLean
    '20110': (38.7510, -77.4753),  # Manassas
    '20176': (39.1157, -77.5636),  # Leesburg
}

def haversine(lon1, lat1, lon2, lat2):
    """Calculate distance between two points in miles."""
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    return c * 3956  # Earth radius in miles

def get_grade(score):
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

def clear_screen():
    print("\n" * 2)

def ask_question(prompt, options):
    """Ask a multiple choice question."""
    print(f"\n{prompt}")
    for i, opt in enumerate(options, 1):
        print(f"  {i}. {opt}")
    while True:
        try:
            choice = input("\nYour choice: ").strip()
            if choice.lower() == 'q':
                return None
            idx = int(choice) - 1
            if 0 <= idx < len(options):
                return options[idx]
        except ValueError:
            pass
        print("Invalid choice. Try again.")

def ask_yes_no(prompt):
    """Ask a yes/no question."""
    print(f"\n{prompt}")
    while True:
        choice = input("(y/n): ").strip().lower()
        if choice in ['y', 'yes']:
            return True
        elif choice in ['n', 'no']:
            return False
        print("Please enter y or n.")

def ask_stars(prompt):
    """Ask for a 1-5 star rating."""
    print(f"\n{prompt}")
    print("  1 ⭐       = Not important")
    print("  2 ⭐⭐     = Slightly important")
    print("  3 ⭐⭐⭐   = Moderately important")
    print("  4 ⭐⭐⭐⭐ = Very important")
    print("  5 ⭐⭐⭐⭐⭐ = Critical")
    while True:
        try:
            choice = int(input("\nRating (1-5): ").strip())
            if 1 <= choice <= 5:
                return choice
        except ValueError:
            pass
        print("Please enter 1-5.")

def main():
    print("=" * 60)
    print("    VANurses - Personalized Facility Rankings")
    print("    Find YOUR perfect workplace")
    print("=" * 60)
    print("\nAnswer a few questions to get personalized recommendations.")
    print("Type 'q' at any time to quit.\n")

    prefs = {}

    # ==================== SECTION 1: LOCATION ====================
    print("\n" + "=" * 40)
    print("SECTION 1: LOCATION")
    print("=" * 40)

    prefs['zip_code'] = input("\n1. What's your current zip code? ").strip()

    prefs['willing_to_relocate'] = ask_yes_no("2. Are you willing to relocate?")

    if not prefs['willing_to_relocate']:
        commute_opts = ['10 miles', '25 miles', '50 miles', 'Any distance']
        prefs['max_commute'] = ask_question("3. How far are you willing to commute?", commute_opts)
    else:
        prefs['max_commute'] = 'Any distance'

    # ==================== SECTION 2: CHILDCARE ====================
    print("\n" + "=" * 40)
    print("SECTION 2: CHILDCARE")
    print("=" * 40)

    prefs['needs_onsite_daycare'] = ask_yes_no("4. Do you need on-site daycare at the hospital?")

    if not prefs['needs_onsite_daycare']:
        prefs['needs_nearby_daycare'] = ask_yes_no("5. Do you need a daycare facility nearby?")
    else:
        prefs['needs_nearby_daycare'] = False

    # ==================== SECTION 3: JOB PREFERENCES ====================
    print("\n" + "=" * 40)
    print("SECTION 3: JOB PREFERENCES")
    print("=" * 40)

    shift_opts = ['Day', 'Night', 'Rotating', 'Any']
    prefs['preferred_shift'] = ask_question("6. What shift do you prefer?", shift_opts)

    emp_opts = ['Full-time', 'Part-time', 'PRN', 'Travel Contract', 'Any']
    prefs['employment_type'] = ask_question("7. Employment type?", emp_opts)

    exp_opts = ['New Grad', '1-3 years', '3-5 years', '5+ years']
    prefs['experience_level'] = ask_question("8. Your experience level?", exp_opts)

    # ==================== SECTION 4: HOSPITAL PREFERENCES ====================
    print("\n" + "=" * 40)
    print("SECTION 4: HOSPITAL PREFERENCES")
    print("=" * 40)

    teaching_opts = ['Yes', 'No', 'No preference']
    prefs['prefers_teaching'] = ask_question("9. Do you prefer teaching hospitals?", teaching_opts)

    prefs['has_compact_license'] = ask_yes_no("10. Do you have a compact nursing license?")

    # ==================== SECTION 5: PRIORITIES ====================
    print("\n" + "=" * 40)
    print("SECTION 5: WHAT MATTERS MOST TO YOU?")
    print("Rate each factor 1-5 stars")
    print("=" * 40)

    priorities = {}

    priorities['pci'] = ask_stars("PAY & COMPENSATION - Salary vs market rate")
    priorities['eri'] = ask_stars("EMPLOYEE REVIEWS - What staff say on Glassdoor/Indeed")
    priorities['pei'] = ask_stars("PATIENT EXPERIENCE - Hospital quality ratings")
    priorities['fsi'] = ask_stars("FACILITY RESOURCES - Beds, teaching status, equipment")
    priorities['lssi'] = ask_stars("SAFE NEIGHBORHOOD - Crime rates, safety")
    priorities['ali'] = ask_stars("AMENITIES NEARBY - Food, gyms, childcare")
    priorities['csi'] = ask_stars("EASY COMMUTE - Traffic, drive time")
    priorities['qli'] = ask_stars("QUALITY OF LIFE - Cost of living, schools, community")
    priorities['cci'] = ask_stars("CLIMATE COMFORT - Weather, temperature")

    prefs['priorities'] = priorities

    # ==================== CALCULATE WEIGHTS ====================
    print("\n" + "=" * 40)
    print("CALCULATING YOUR PERSONALIZED RANKINGS...")
    print("=" * 40)

    total_stars = sum(priorities.values())
    weights = {k: v / total_stars for k, v in priorities.items()}

    print("\nYour personalized weights:")
    for idx, weight in sorted(weights.items(), key=lambda x: x[1], reverse=True):
        print(f"  {idx.upper()}: {weight*100:.1f}%")

    # ==================== FETCH AND FILTER FACILITIES ====================
    print("\n" + "=" * 40)
    print("FINDING YOUR MATCHES...")
    print("=" * 40)

    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            f.id, f.name, f.city, f.latitude, f.longitude,
            fs.pci_score, fs.eri_score, fs.pei_score, fs.fsi_score,
            fs.lssi_score, fs.ali_score, fs.csi_score, fs.qli_score, fs.cci_score,
            fst.teaching_status,
            fa.childcare_score
        FROM facilities f
        JOIN facility_scores fs ON f.id = fs.facility_id
        LEFT JOIN facility_statistics fst ON f.id = fst.facility_id
        LEFT JOIN facility_amenities fa ON f.id = fa.facility_id
        WHERE f.state IN ('VA', 'Virginia')
    """)

    facilities = cursor.fetchall()
    conn.close()

    # Get user coordinates
    user_coords = ZIP_COORDS.get(prefs['zip_code'])

    # Filter facilities
    filtered = []
    for fac in facilities:
        fac_id, name, city, lat, lng = fac[0:5]
        scores = {
            'pci': fac[5] or 50,
            'eri': fac[6] or 50,
            'pei': fac[7] or 50,
            'fsi': fac[8] or 50,
            'lssi': fac[9] or 50,
            'ali': fac[10] or 50,
            'csi': fac[11] or 50,
            'qli': fac[12] or 50,
            'cci': fac[13] or 50,
        }
        teaching = fac[14]
        childcare = fac[15] or 0

        # Filter by distance
        if not prefs['willing_to_relocate'] and user_coords and lat and lng:
            distance = haversine(user_coords[1], user_coords[0], float(lng), float(lat))
            max_dist = {'10 miles': 10, '25 miles': 25, '50 miles': 50, 'Any distance': 9999}
            if distance > max_dist.get(prefs['max_commute'], 9999):
                continue
        else:
            distance = None

        # Filter by teaching preference
        if prefs['prefers_teaching'] == 'Yes' and not teaching:
            continue

        # Filter by daycare (basic - would need more detailed data)
        # For now, use childcare_score > 50 as proxy for nearby childcare
        if prefs['needs_nearby_daycare'] and childcare < 30:
            continue

        # Calculate personalized OFS
        personal_ofs = sum(scores[idx] * weights[idx] for idx in weights)
        personal_ofs = int(round(personal_ofs))

        filtered.append({
            'name': name,
            'city': city,
            'scores': scores,
            'personal_ofs': personal_ofs,
            'grade': get_grade(personal_ofs),
            'distance': distance,
            'teaching': teaching
        })

    # Sort by personalized OFS
    filtered.sort(key=lambda x: x['personal_ofs'], reverse=True)

    # ==================== DISPLAY RESULTS ====================
    print("\n" + "=" * 60)
    print(f"YOUR TOP {min(10, len(filtered))} PERSONALIZED MATCHES")
    print("=" * 60)

    if not filtered:
        print("\nNo facilities match your criteria. Try adjusting your preferences.")
        return

    for i, fac in enumerate(filtered[:10], 1):
        dist_str = f" ({fac['distance']:.0f} mi)" if fac['distance'] else ""
        teaching_str = " [Teaching]" if fac['teaching'] else ""

        print(f"\n{i}. {fac['name']}{teaching_str}")
        print(f"   📍 {fac['city']}{dist_str}")
        print(f"   ⭐ Personalized Score: {fac['personal_ofs']} ({fac['grade']})")

        # Show top 3 scores that matter to this user
        top_scores = sorted(
            [(idx, fac['scores'][idx]) for idx in weights],
            key=lambda x: weights[x[0]] * x[1],
            reverse=True
        )[:3]
        score_strs = [f"{idx.upper()}:{score}" for idx, score in top_scores]
        print(f"   Key scores: {', '.join(score_strs)}")

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"\nTotal facilities matching your criteria: {len(filtered)}")
    print(f"Your #1 match: {filtered[0]['name']} ({filtered[0]['city']})")

    # Compare to default ranking
    default_weights = {
        'pci': 0.18, 'eri': 0.15, 'pei': 0.12, 'fsi': 0.12,
        'lssi': 0.13, 'ali': 0.10, 'csi': 0.08, 'qli': 0.08, 'cci': 0.04
    }

    for fac in filtered:
        fac['default_ofs'] = sum(fac['scores'][idx] * default_weights[idx] for idx in default_weights)

    default_sorted = sorted(filtered, key=lambda x: x['default_ofs'], reverse=True)
    default_top = default_sorted[0]['name']

    if default_top != filtered[0]['name']:
        print(f"\n💡 Without personalization, the default #1 would be: {default_top}")
        print(f"   Your priorities changed the ranking!")

if __name__ == '__main__':
    main()
