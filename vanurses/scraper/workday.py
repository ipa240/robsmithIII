"""
VANurses.com - Workday Scraper
Scrapes nursing jobs from Workday-based hospital career sites
"""

import requests
import time
import json
import re
from datetime import datetime
from typing import List, Dict, Optional, Generator
import psycopg2
from psycopg2.extras import execute_values

from .config import DB_CONFIG, WORKDAY_SYSTEMS, REQUEST_DELAY, MAX_RETRIES, RETRY_DELAY, JOBS_PER_PAGE, MAX_PAGES
from .classifier import classify_job


class WorkdayScraper:
    """Scraper for Workday job portals."""

    def __init__(self, system_key: str):
        """
        Initialize scraper for a specific hospital system.

        Args:
            system_key: Key from WORKDAY_SYSTEMS (e.g., 'sentara', 'carilion')
        """
        if system_key not in WORKDAY_SYSTEMS:
            raise ValueError(f"Unknown system: {system_key}")

        self.system_key = system_key
        self.config = WORKDAY_SYSTEMS[system_key]
        self.base_url = self.config['base_url']
        self.api_path = self.config['api_path']
        self.system_name = self.config['name']

        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        })

        self.stats = {
            'pages_fetched': 0,
            'jobs_found': 0,
            'nursing_jobs': 0,
            'jobs_new': 0,
            'jobs_updated': 0,
            'errors': 0,
        }

    def _make_request(self, offset: int = 0, limit: int = JOBS_PER_PAGE) -> Optional[Dict]:
        """Make API request to Workday."""
        url = f"{self.base_url}{self.api_path}"

        payload = {
            "appliedFacets": {},
            "limit": limit,
            "offset": offset,
            "searchText": ""
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
        """Fetch all jobs from the system, yielding one at a time."""
        offset = 0
        total_jobs = None

        print(f"\nFetching jobs from {self.system_name}...")

        while True:
            # Rate limiting
            if offset > 0:
                time.sleep(REQUEST_DELAY)

            data = self._make_request(offset=offset)
            if not data:
                break

            self.stats['pages_fetched'] += 1

            # Get total on first request
            if total_jobs is None:
                total_jobs = data.get('total', 0)
                print(f"  Total jobs available: {total_jobs}")

            job_postings = data.get('jobPostings', [])
            if not job_postings:
                break

            for job in job_postings:
                self.stats['jobs_found'] += 1
                yield job

            offset += JOBS_PER_PAGE

            # Safety limit
            if offset >= MAX_PAGES * JOBS_PER_PAGE:
                print(f"  Reached max pages limit ({MAX_PAGES})")
                break

            if offset >= total_jobs:
                break

        print(f"  Fetched {self.stats['jobs_found']} total jobs")

    def parse_job(self, job_data: Dict) -> Optional[Dict]:
        """Parse a Workday job posting into our schema."""
        try:
            title = job_data.get('title', '')
            external_id = job_data.get('bulletFields', [None])[0] if job_data.get('bulletFields') else None

            # Get job URL
            external_path = job_data.get('externalPath', '')
            job_url = f"{self.base_url}{external_path}" if external_path else None

            # Classify the job
            classification = classify_job(title)
            if not classification:
                return None  # Not a nursing job

            self.stats['nursing_jobs'] += 1

            # Extract location
            location_data = job_data.get('locationsText', '')
            city = None
            state = 'VA'

            # Parse location (usually "City, State" format)
            if location_data:
                parts = location_data.split(',')
                if parts:
                    city = parts[0].strip()

            # Extract posted date
            posted_on = job_data.get('postedOn', '')
            posted_at = None
            if posted_on:
                try:
                    # Workday uses format like "Posted 3 Days Ago" or date
                    if 'ago' in posted_on.lower():
                        # Parse relative date
                        days_match = re.search(r'(\d+)\s*day', posted_on.lower())
                        if days_match:
                            days = int(days_match.group(1))
                            posted_at = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
                            from datetime import timedelta
                            posted_at = posted_at - timedelta(days=days)
                        else:
                            posted_at = datetime.now()
                    else:
                        posted_at = datetime.strptime(posted_on, '%Y-%m-%d')
                except:
                    posted_at = datetime.now()

            return {
                'external_job_id': external_id or job_data.get('externalPath', ''),
                'source_url': job_url,
                'title': title,
                'title_normalized': title.upper(),
                'city': city,
                'state': state,
                'posted_at': posted_at,
                'scraped_at': datetime.now(),
                'is_active': True,
                **classification,
            }

        except Exception as e:
            print(f"  Error parsing job: {e}")
            self.stats['errors'] += 1
            return None

    def get_facility_id(self, conn) -> Optional[str]:
        """Get the facility ID for this system from the database."""
        cur = conn.cursor()

        # Get first facility for this system (we'll improve this later)
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

        facility_id = self.get_facility_id(conn)
        if not facility_id:
            print(f"  Warning: No facility found for {self.system_name}")

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
        cur.execute("""
            INSERT INTO scrape_logs (
                facility_id, source_name, source_url, status,
                jobs_found, jobs_new, jobs_updated, duration_ms
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            facility_id,
            self.system_name,
            f"{self.base_url}{self.api_path}",
            'success' if self.stats['errors'] == 0 else 'partial',
            self.stats['nursing_jobs'],
            self.stats['jobs_new'],
            self.stats['jobs_updated'],
            0,  # We'll add timing later
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
        print(f"    Total jobs found: {self.stats['jobs_found']}")
        print(f"    Nursing jobs: {self.stats['nursing_jobs']}")
        print(f"    New jobs: {self.stats['jobs_new']}")
        print(f"    Updated jobs: {self.stats['jobs_updated']}")
        print(f"    Errors: {self.stats['errors']}")
        print(f"    Duration: {duration:.1f}s")

        return self.stats


def scrape_all_workday_systems() -> Dict:
    """Scrape all Workday hospital systems."""
    print("=" * 60)
    print("VANurses.com - Workday Scraper")
    print("=" * 60)

    total_stats = {
        'systems_scraped': 0,
        'total_jobs': 0,
        'nursing_jobs': 0,
        'new_jobs': 0,
        'updated_jobs': 0,
        'errors': 0,
    }

    for system_key in WORKDAY_SYSTEMS:
        try:
            scraper = WorkdayScraper(system_key)
            stats = scraper.run()

            total_stats['systems_scraped'] += 1
            total_stats['total_jobs'] += stats['jobs_found']
            total_stats['nursing_jobs'] += stats['nursing_jobs']
            total_stats['new_jobs'] += stats['jobs_new']
            total_stats['updated_jobs'] += stats['jobs_updated']
            total_stats['errors'] += stats['errors']

        except Exception as e:
            print(f"Error scraping {system_key}: {e}")
            total_stats['errors'] += 1

        # Delay between systems
        time.sleep(REQUEST_DELAY * 2)

    print("\n" + "=" * 60)
    print("TOTAL RESULTS")
    print("=" * 60)
    print(f"Systems scraped: {total_stats['systems_scraped']}")
    print(f"Total jobs found: {total_stats['total_jobs']}")
    print(f"Nursing jobs: {total_stats['nursing_jobs']}")
    print(f"New jobs added: {total_stats['new_jobs']}")
    print(f"Jobs updated: {total_stats['updated_jobs']}")
    print(f"Errors: {total_stats['errors']}")

    return total_stats


if __name__ == '__main__':
    import sys

    if len(sys.argv) > 1:
        # Scrape specific system
        system = sys.argv[1]
        if system == 'all':
            scrape_all_workday_systems()
        elif system in WORKDAY_SYSTEMS:
            scraper = WorkdayScraper(system)
            scraper.run()
        else:
            print(f"Unknown system: {system}")
            print(f"Available: {', '.join(WORKDAY_SYSTEMS.keys())}, all")
    else:
        print("Usage: python -m scraper.workday <system|all>")
        print(f"Systems: {', '.join(WORKDAY_SYSTEMS.keys())}")
