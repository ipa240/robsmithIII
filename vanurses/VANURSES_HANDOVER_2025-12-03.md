# VANurses Project Handover Documentation
**Date:** December 3, 2025
**Project:** Virginia Nursing Job Aggregation & Facility Scoring Platform

---

## Overview

VANurses is a data-driven platform that helps nurses in Virginia find their ideal workplace by scoring healthcare facilities across multiple quality-of-life and career factors. The system aggregates data from multiple sources, calculates composite scores, and provides personalized facility rankings based on user preferences.

---

## Architecture

### Infrastructure
- **Database Server:** PostgreSQL on `192.168.0.150`
- **Database Name:** `vanurses`
- **Database User:** `vanurses_app`
- **Local Development:** Ubuntu Linux workstation

### Tech Stack
- **Backend:** Python 3 with psycopg2 for database access
- **Database:** PostgreSQL
- **Data Sources:** CMS, Glassdoor, Indeed, OpenStreetMap, Census, FBI Crime Data
- **Version Control:** GitHub

---

## Database Schema

### Core Tables

#### `facilities` (98 Virginia healthcare facilities)
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| name | VARCHAR | Facility name |
| city | VARCHAR | City location |
| state | VARCHAR | State (VA/Virginia) |
| address | VARCHAR | Street address |
| zip | VARCHAR | ZIP code |
| latitude | DECIMAL | GPS latitude |
| longitude | DECIMAL | GPS longitude |
| bed_count | INTEGER | Number of beds |
| facility_type | VARCHAR | Hospital type |

#### `facility_scores` (composite scores per facility)
| Column | Type | Description |
|--------|------|-------------|
| facility_id | INTEGER | FK to facilities |
| pci_score | INTEGER | Pay Competitiveness Index (0-100) |
| eri_score | INTEGER | Employee Review Index (0-100) |
| pei_score | INTEGER | Patient Experience Index (0-100) |
| fsi_score | INTEGER | Facility Statistics Index (0-100) |
| lssi_score | INTEGER | Location Safety/Security Index (0-100) |
| ali_score | INTEGER | Amenities & Lifestyle Index (0-100) |
| csi_score | INTEGER | Commute Stress Index (0-100) |
| qli_score | INTEGER | Quality of Life Index (0-100) |
| cci_score | INTEGER | Climate Comfort Index (0-100) |
| ofs_score | INTEGER | Overall Facility Score (weighted composite) |
| ofs_grade | VARCHAR | Letter grade (A+ to F) |

#### `facility_amenities`
| Column | Type | Description |
|--------|------|-------------|
| facility_id | INTEGER | FK to facilities |
| has_onsite_daycare | BOOLEAN | Verified on-site childcare |
| childcare_count | INTEGER | Number of daycares within 1 mile |
| restaurants_count | INTEGER | Restaurants nearby |
| gyms_count | INTEGER | Fitness centers nearby |
| ali_score | INTEGER | Computed amenities score |

#### `facility_reviews`
| Column | Type | Description |
|--------|------|-------------|
| system_name | VARCHAR | Health system name |
| source | VARCHAR | 'glassdoor' or 'indeed' |
| overall_rating | DECIMAL | 1-5 star rating |
| work_life_balance | DECIMAL | Work-life balance rating |
| compensation_benefits | DECIMAL | Comp/benefits rating |
| management_rating | DECIMAL | Management rating |
| review_count | INTEGER | Number of reviews |

#### `facility_statistics`
| Column | Type | Description |
|--------|------|-------------|
| facility_id | INTEGER | FK to facilities |
| teaching_status | BOOLEAN | Is teaching hospital |
| cms_rating | INTEGER | CMS star rating (1-5) |
| bed_count | INTEGER | Number of beds |
| fsi_score | INTEGER | Facility statistics score |

---

## Scoring System (9 Indices)

Each index is scored 0-100, then combined into an Overall Facility Score (OFS).

### Index Definitions

| Code | Name | Weight | Description | Data Sources |
|------|------|--------|-------------|--------------|
| PCI | Pay Competitiveness | 18% | Salary vs regional market rate | BLS, Indeed salary data |
| ERI | Employee Reviews | 15% | Staff satisfaction ratings | Glassdoor, Indeed |
| PEI | Patient Experience | 12% | Patient satisfaction scores | CMS HCAHPS |
| FSI | Facility Statistics | 12% | Hospital resources/quality | CMS Hospital Compare |
| LSSI | Location Safety | 13% | Crime rates around facility | FBI UCR, local crime data |
| ALI | Amenities & Lifestyle | 10% | Nearby food, gyms, childcare | OpenStreetMap Overpass API |
| CSI | Commute Stress | 8% | Traffic patterns, drive times | Traffic APIs |
| QLI | Quality of Life | 8% | Cost of living, schools | Census, community data |
| CCI | Climate Comfort | 4% | Weather patterns | NOAA, weather APIs |

### Grade Scale
| Score | Grade |
|-------|-------|
| 97-100 | A+ |
| 90-96 | A |
| 86-89 | A- |
| 80-85 | B+ |
| 75-79 | B |
| 71-74 | B- |
| 65-70 | C+ |
| 60-64 | C |
| 55-59 | C- |
| 50-54 | D+ |
| 45-49 | D |
| 40-44 | D- |
| 0-39 | F |

---

## Key Scripts

### `/home/ian/vanurses/scoring/`

#### `calculate_eri.py`
Calculates Employee Review Index by:
1. Fetching Glassdoor + Indeed ratings from `facility_reviews`
2. Mapping health systems to individual facilities
3. Weighting components: Overall (40%), Work-Life (25%), Comp (20%), Management (15%)
4. Converting 1-5 stars to 0-100 scale
5. Storing in `facility_scores.eri_score`

#### `calculate_ofs.py`
Calculates Overall Facility Score by:
1. Fetching all 9 index scores for each facility
2. Applying default weights (see table above)
3. Computing weighted average
4. Assigning letter grade
5. Storing in `facility_scores.ofs_score` and `ofs_grade`

#### `personalized_ofs.py`
Interactive demo for personalized rankings:
1. Collects user preferences (location, childcare, shift, etc.)
2. Collects priority ratings (1-5 stars) for each index
3. Calculates custom weights from star ratings
4. Filters facilities by distance and requirements
5. Re-ranks facilities using personalized weights
6. Displays top matches

---

## Verified On-Site Daycare Facilities (11 total)

| Facility | City | Provider |
|----------|------|----------|
| Augusta Health | Fishersville | Bright Horizons |
| Bon Secours Memorial Regional | Mechanicsville | Bon Secours Family Centers |
| Bon Secours St Francis | Midlothian | Bon Secours Family Centers |
| Bon Secours St Marys | Richmond | Bon Secours Family Centers |
| INOVA Fairfax Hospital | Falls Church | Bright Horizons |
| INOVA Fair Oaks Hospital | Fairfax | Bright Horizons |
| Medical College of Virginia (VCU) | Richmond | VCU Child Development Center |
| Sentara Obici Hospital | Suffolk | Growing Up at Obici |
| University of Virginia Medical Center | Charlottesville | Bright Horizons/MCCC |
| VHC Health | Arlington | On-campus |
| Winchester Medical Center | Winchester | Valley Health Child Care |

**Note:** INOVA Mount Vernon closed June 2023. Sentara Martha Jefferson opening Jan 2026.

---

## How to Run Personalized Rankings

### Quick Test (Non-Interactive)
```bash
ssh ian@192.168.0.150
python3 << 'EOF'
import psycopg2
from math import radians, cos, sin, asin, sqrt

# Set user preferences
zip_code = "22701"  # User's zip
max_miles = 25
needs_daycare = True

# Set priority ratings (1-5 stars)
priorities = {
    'pci': 5,   # Pay
    'eri': 4,   # Reviews
    'pei': 3,   # Patient Experience
    'fsi': 3,   # Facility
    'lssi': 4,  # Safety
    'ali': 3,   # Amenities
    'csi': 4,   # Commute
    'qli': 4,   # Quality of Life
    'cci': 2,   # Climate
}

# ... calculation logic ...
EOF
```

### Interactive Demo
```bash
python3 /home/ian/vanurses/scoring/personalized_ofs.py
```

---

## Database Connection

```python
import psycopg2

DB_CONFIG = {
    'host': '192.168.0.150',
    'database': 'vanurses',
    'user': 'vanurses_app',
    'password': 'VaNurses2025Secure'
}

conn = psycopg2.connect(**DB_CONFIG)
cursor = conn.cursor()
```

---

## Common Queries

### Get all facilities with scores
```sql
SELECT f.name, f.city, fs.ofs_score, fs.ofs_grade,
       fs.pci_score, fs.eri_score, fs.lssi_score
FROM facilities f
JOIN facility_scores fs ON f.id = fs.facility_id
WHERE f.state IN ('VA', 'Virginia')
ORDER BY fs.ofs_score DESC;
```

### Get facilities with on-site daycare
```sql
SELECT f.name, f.city
FROM facilities f
JOIN facility_amenities fa ON f.id = fa.facility_id
WHERE fa.has_onsite_daycare = TRUE;
```

### Get facilities within X miles of a zip code
```sql
-- Uses Haversine formula in Python, not SQL
-- See personalized_ofs.py for implementation
```

---

## Data Update Schedule

| Data Type | Source | Update Frequency |
|-----------|--------|------------------|
| Employee Reviews | Glassdoor/Indeed | Monthly |
| Patient Experience | CMS HCAHPS | Quarterly |
| Crime Data | FBI UCR | Annually |
| Amenities | OpenStreetMap | As needed |
| Pay Data | BLS/Indeed | Quarterly |

---

## Known Issues / Limitations

1. **Distance Calculations:** Using city-center coordinates, not exact facility addresses. Accuracy within ~5 miles.

2. **Daycare Data:** Manually verified. May become outdated. Last verified: December 2025.

3. **Review Mapping:** Some small/independent hospitals default to score of 50 if no system match found.

4. **Missing Data:** 7 facilities have default PEI scores (non-hospitals or no HCAHPS data).

---

## File Locations

| File | Location | Purpose |
|------|----------|---------|
| ERI Calculator | `/home/ian/vanurses/scoring/calculate_eri.py` | Employee Review Index |
| OFS Calculator | `/home/ian/vanurses/scoring/calculate_ofs.py` | Overall Facility Score |
| Personalized Demo | `/home/ian/vanurses/scoring/personalized_ofs.py` | Interactive rankings |
| API | `/home/ian/vanurses/api/` | REST API (if applicable) |
| Scraper | `/home/ian/vanurses/scraper/` | Data collection scripts |

---

## GitHub Repository

**URL:** github.com/ipa240/AIGeneratorDiscord-and-Bot
**Branch:** main
**Latest Commit:** `1e8ea69` - Add personalized facility scoring system (Module 11)

---

## Contact / Support

For questions about this project, review the code comments and this documentation. Key files are well-documented with module numbers (Module 3, 10, 11, etc.) corresponding to the development phases.

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-03 | Added Module 11: Personalized Rankings |
| 2025-12-03 | Updated verified daycare list (11 facilities) |
| 2025-12-03 | Added facility coordinates for distance calculations |
| 2025-12-03 | Fixed ERI mapping to cover all 98 facilities |
