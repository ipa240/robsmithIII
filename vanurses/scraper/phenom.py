"""
VANurses.com - Phenom People Scraper
Scrapes nursing jobs from Phenom People-based hospital career sites
(Used by Bon Secours, UVA Health, and others)
"""

import requests
import time
import json
from datetime import datetime
from typing import List, Dict, Optional, Generator
import psycopg2

from .config import DB_CONFIG, REQUEST_DELAY, MAX_RETRIES, RETRY_DELAY
from .classifier import classify_job

# Phenom People systems in Virginia
PHENOM_SYSTEMS = {
    'bonsecours': {
        'name': 'Bon Secours',
        'base_url': 'https://careers.bsmhealth.org',
        'widgets_path': '/widgets',
        'facilities': 9,
    },
    'uvahealth': {
        'name': 'UVA Health',
        'base_url': 'https://careers.uvahealth.org',
        'widgets_path': '/widgets',
        'facilities': 3,
    },
}


class PhenomScraper:
    """Scraper for Phenom People job portals."""

    def __init__(self, system_key: str):
        if system_key not in PHENOM_SYSTEMS:
            raise ValueError(f"Unknown system: {system_key}")

        self.system_key = system_key
        self.config = PHENOM_SYSTEMS[system_key]
        self.base_url = self.config['base_url']
        self.widgets_path = self.config['widgets_path']
        self.system_name = self.config['name']

        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        })

        self.stats = {
            'pages_fetched': 0,
            'jobs_found': 0,
            'nursing_jobs': 0,
            'virginia_jobs': 0,
            'jobs_new': 0,
            'jobs_updated': 0,
            'errors': 0,
        }

    def _make_request(self, offset: int = 0, size: int = 100) -> Optional[Dict]:
        """Make API request to Phenom widgets endpoint."""
        url = f"{self.base_url}{self.widgets_path}"

        payload = {
            "lang": "en_us",
            "deviceType": "desktop",
            "country": "us",
            "pageName": "search-results",
            "ddoKey": "refineSearch",
            "sortBy": "",
            "from": offset,
            "jobs": True,
            "counts": True,
            "size": size,
            "keywords": "",
            "facets": {"state": ["Virginia"]}
        }

        for attempt in range(MAX_RETRIES):
            try:
                response = self.session.post(url, json=payload, timeout=30)
                response.raise_for_status()
                return response.json()
            except requests.exceptions.RequestException as e:
                print(f"  Request error (attempt {attempt + 1}): {e}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY)
                else:
                    self.stats['errors'] += 1
                    return None

    def fetch_jobs(self) -> Generator[Dict, None, None]:
        """Fetch all Virginia jobs from the system, yielding one at a time."""
        offset = 0
        total_jobs = None
        page_size = 100

        print(f"\nFetching jobs from {self.system_name}...")

        while True:
            if offset > 0:
                time.sleep(REQUEST_DELAY)

            data = self._make_request(offset=offset, size=page_size)
            if not data:
                break

            self.stats['pages_fetched'] += 1

            refine = data.get('refineSearch', {})
            if total_jobs is None:
                total_jobs = refine.get('totalHits', 0)
                print(f"  Total jobs available: {total_jobs}")

            jobs = refine.get('data', {}).get('jobs', [])
            if not jobs:
                break

            # Filter for Virginia only (API returns all, we filter client-side)
            va_jobs = [j for j in jobs if j.get('state') == 'Virginia']

            for job in va_jobs:
                self.stats['jobs_found'] += 1
                self.stats['virginia_jobs'] += 1
                yield job

            offset += page_size

            # If we got fewer than page_size, we're done
            if len(jobs) < page_size:
                break

            # Safety limit
            if offset >= 5000:
                print(f"  Reached max offset limit (5000)")
                break

        print(f"  Fetched {self.stats['virginia_jobs']} Virginia jobs")

    def parse_job(self, job_data: Dict) -> Optional[Dict]:
        """Parse a Phenom job posting into our schema."""
        try:
            title = job_data.get('title', '')
            job_id = job_data.get('jobId') or job_data.get('reqId', '')

            # Get job URL
            job_seq = job_data.get('jobSeqNo', '')
            job_url = f"{self.base_url}/us/en/job/{job_seq}" if job_seq else None

            # Classify the job
            description = job_data.get('descriptionTeaser', '')
            classification = classify_job(title, description)
            if not classification:
                return None  # Not a nursing job

            self.stats['nursing_jobs'] += 1

            # Extract location
            city = job_data.get('city', '')
            state_full = job_data.get('state', 'Virginia')
            # Convert state name to abbreviation
            state = 'VA' if state_full == 'Virginia' else state_full[:2].upper()
            facility = job_data.get('facility', '')

            # Extract posted date
            posted_date = job_data.get('postedDate', '')
            posted_at = None
            if posted_date:
                try:
                    posted_at = datetime.strptime(posted_date[:19], '%Y-%m-%dT%H:%M:%S')
                except:
                    posted_at = datetime.now()
            else:
                posted_at = datetime.now()

            return {
                'external_job_id': job_id,
                'source_url': job_url,
                'title': title,
                'title_normalized': title.upper(),
                'city': city,
                'state': state,
                'facility_name': facility,
                'posted_at': posted_at,
                'scraped_at': datetime.now(),
                'is_active': True,
                **classification,
            }

        except Exception as e:
            print(f"  Error parsing job: {e}")
            self.stats['errors'] += 1
            return None

    def get_facility_id(self, conn, facility_name: str = None) -> Optional[str]:
        """Get the facility ID for this system from the database."""
        cur = conn.cursor()

        # Try to match by facility name first
        if facility_name:
            cur.execute("""
                SELECT id FROM facilities
                WHERE system_name = %s
                  AND (name ILIKE %s OR name ILIKE %s)
                LIMIT 1
            """, (self.system_name, f'%{facility_name}%', f'{facility_name}%'))
            result = cur.fetchone()
            if result:
                cur.close()
                return result[0]

        # Fall back to first facility for this system
        cur.execute("""
            SELECT id FROM facilities
            WHERE system_name = %s
            LIMIT 1
        """, (self.system_name,))

        result = cur.fetchone()
        cur.close()

        return result[0] if result else None

    def save_jobs(self, jobs: List[Dict]) -> Dict:
        """Save jobs to database."""
        if not jobs:
            return self.stats

        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        insert_query = """
            INSERT INTO jobs (
                facility_id, external_job_id, source_url, title, title_normalized,
                job_category, nursing_type, specialty, employment_type,
                shift_type, shift_hours, city, state, posted_at, scraped_at, is_active
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (facility_id, external_job_id) DO UPDATE SET
                title = EXCLUDED.title,
                title_normalized = EXCLUDED.title_normalized,
                specialty = EXCLUDED.specialty,
                employment_type = EXCLUDED.employment_type,
                shift_type = EXCLUDED.shift_type,
                shift_hours = EXCLUDED.shift_hours,
                scraped_at = EXCLUDED.scraped_at,
                is_active = TRUE
            RETURNING id, (xmax = 0) as is_new;
        """

        for job in jobs:
            try:
                facility_id = self.get_facility_id(conn, job.get('facility_name'))
                if not facility_id:
                    # Use first facility for system if no match
                    facility_id = self.get_facility_id(conn)
                    if not facility_id:
                        print(f"  Warning: No facility found for {self.system_name}")
                        continue

                cur.execute(insert_query, (
                    facility_id,
                    job['external_job_id'],
                    job['source_url'],
                    job['title'],
                    job['title_normalized'],
                    job['job_category'],
                    job['nursing_type'],
                    job['specialty'],
                    job['employment_type'],
                    job.get('shift_type'),
                    job.get('shift_hours'),
                    job.get('city'),
                    job.get('state', 'VA'),
                    job.get('posted_at'),
                    job['scraped_at'],
                    job['is_active'],
                ))

                result = cur.fetchone()
                if result:
                    if result[1]:  # is_new
                        self.stats['jobs_new'] += 1
                    else:
                        self.stats['jobs_updated'] += 1

            except Exception as e:
                print(f"  Error saving job {job.get('title', 'unknown')}: {e}")
                self.stats['errors'] += 1
                conn.rollback()
                continue

        conn.commit()

        # Log the scrape
        facility_id = self.get_facility_id(conn)
        cur.execute("""
            INSERT INTO scrape_logs (
                facility_id, source_name, source_url, status,
                jobs_found, jobs_new, jobs_updated, duration_ms
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            facility_id,
            self.system_name,
            f"{self.base_url}{self.widgets_path}",
            'success' if self.stats['errors'] == 0 else 'partial',
            self.stats['nursing_jobs'],
            self.stats['jobs_new'],
            self.stats['jobs_updated'],
            0,
        ))

        conn.commit()
        cur.close()
        conn.close()

        return self.stats

    def run(self) -> Dict:
        """Run the full scrape for this system."""
        start_time = time.time()

        jobs = []
        for job_data in self.fetch_jobs():
            parsed = self.parse_job(job_data)
            if parsed:
                jobs.append(parsed)

        if jobs:
            self.save_jobs(jobs)

        duration = time.time() - start_time

        print(f"\n  Results for {self.system_name}:")
        print(f"    Pages fetched: {self.stats['pages_fetched']}")
        print(f"    Virginia jobs found: {self.stats['virginia_jobs']}")
        print(f"    Nursing jobs: {self.stats['nursing_jobs']}")
        print(f"    New jobs: {self.stats['jobs_new']}")
        print(f"    Updated jobs: {self.stats['jobs_updated']}")
        print(f"    Errors: {self.stats['errors']}")
        print(f"    Duration: {duration:.1f}s")

        return self.stats


def scrape_all_phenom_systems() -> Dict:
    """Scrape all Phenom People hospital systems."""
    print("=" * 60)
    print("VANurses.com - Phenom People Scraper")
    print("=" * 60)

    total_stats = {
        'systems_scraped': 0,
        'total_jobs': 0,
        'nursing_jobs': 0,
        'new_jobs': 0,
        'updated_jobs': 0,
        'errors': 0,
    }

    for system_key in PHENOM_SYSTEMS:
        try:
            scraper = PhenomScraper(system_key)
            stats = scraper.run()

            total_stats['systems_scraped'] += 1
            total_stats['total_jobs'] += stats['virginia_jobs']
            total_stats['nursing_jobs'] += stats['nursing_jobs']
            total_stats['new_jobs'] += stats['jobs_new']
            total_stats['updated_jobs'] += stats['jobs_updated']
            total_stats['errors'] += stats['errors']

        except Exception as e:
            print(f"Error scraping {system_key}: {e}")
            total_stats['errors'] += 1

        time.sleep(REQUEST_DELAY * 2)

    print("\n" + "=" * 60)
    print("TOTAL RESULTS")
    print("=" * 60)
    print(f"Systems scraped: {total_stats['systems_scraped']}")
    print(f"Virginia jobs found: {total_stats['total_jobs']}")
    print(f"Nursing jobs: {total_stats['nursing_jobs']}")
    print(f"New jobs added: {total_stats['new_jobs']}")
    print(f"Jobs updated: {total_stats['updated_jobs']}")
    print(f"Errors: {total_stats['errors']}")

    return total_stats


if __name__ == '__main__':
    import sys

    if len(sys.argv) > 1:
        system = sys.argv[1]
        if system == 'all':
            scrape_all_phenom_systems()
        elif system in PHENOM_SYSTEMS:
            scraper = PhenomScraper(system)
            scraper.run()
        else:
            print(f"Unknown system: {system}")
            print(f"Available: {', '.join(PHENOM_SYSTEMS.keys())}, all")
    else:
        print("Usage: python -m scraper.phenom <system|all>")
        print(f"Systems: {', '.join(PHENOM_SYSTEMS.keys())}")
