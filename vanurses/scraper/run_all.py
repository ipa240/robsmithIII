#!/usr/bin/env python3
"""
VANurses.com - Master Scraper Runner
Runs all scrapers to collect Virginia nursing jobs
"""

import time
from datetime import datetime

from .workday import scrape_all_workday_systems
from .phenom import scrape_all_phenom_systems
from .oracle import scrape_all_oracle_systems


def run_all_scrapers():
    """Run all scrapers in sequence."""
    start_time = datetime.now()

    print("=" * 70)
    print("VANurses.com - Master Scraper Runner")
    print(f"Started: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    all_stats = {
        'workday': None,
        'phenom': None,
        'oracle': None,
    }

    # Run Workday scraper (Sentara, Carilion, VCU, Valley, Riverside, Mary Washington)
    print("\n" + "=" * 70)
    print("PHASE 1: WORKDAY SYSTEMS")
    print("=" * 70)
    try:
        all_stats['workday'] = scrape_all_workday_systems()
    except Exception as e:
        print(f"Workday scraper failed: {e}")
        all_stats['workday'] = {'errors': 1}

    time.sleep(5)

    # Run Phenom scraper (Bon Secours, UVA Health)
    print("\n" + "=" * 70)
    print("PHASE 2: PHENOM PEOPLE SYSTEMS")
    print("=" * 70)
    try:
        all_stats['phenom'] = scrape_all_phenom_systems()
    except Exception as e:
        print(f"Phenom scraper failed: {e}")
        all_stats['phenom'] = {'errors': 1}

    time.sleep(5)

    # Run Oracle scraper (Inova)
    print("\n" + "=" * 70)
    print("PHASE 3: ORACLE CLOUD SYSTEMS")
    print("=" * 70)
    try:
        all_stats['oracle'] = scrape_all_oracle_systems()
    except Exception as e:
        print(f"Oracle scraper failed: {e}")
        all_stats['oracle'] = {'errors': 1}

    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    # Calculate totals
    total_jobs = 0
    total_nursing = 0
    total_new = 0
    total_updated = 0
    total_errors = 0

    for scraper, stats in all_stats.items():
        if stats:
            total_jobs += stats.get('total_jobs', 0)
            total_nursing += stats.get('nursing_jobs', 0)
            total_new += stats.get('new_jobs', 0)
            total_updated += stats.get('updated_jobs', 0)
            total_errors += stats.get('errors', 0)

    print("\n" + "=" * 70)
    print("FINAL SUMMARY - ALL SCRAPERS")
    print("=" * 70)
    print(f"Duration: {duration:.1f} seconds ({duration/60:.1f} minutes)")
    print(f"\nBy Platform:")

    if all_stats['workday']:
        w = all_stats['workday']
        print(f"  Workday: {w.get('systems_scraped', 0)} systems, {w.get('nursing_jobs', 0)} nursing jobs")

    if all_stats['phenom']:
        p = all_stats['phenom']
        print(f"  Phenom:  {p.get('systems_scraped', 0)} systems, {p.get('nursing_jobs', 0)} nursing jobs")

    if all_stats['oracle']:
        o = all_stats['oracle']
        print(f"  Oracle:  {o.get('systems_scraped', 0)} systems, {o.get('nursing_jobs', 0)} nursing jobs")

    print(f"\nTotals:")
    print(f"  Total jobs processed: {total_jobs}")
    print(f"  Nursing jobs found: {total_nursing}")
    print(f"  New jobs added: {total_new}")
    print(f"  Jobs updated: {total_updated}")
    print(f"  Errors: {total_errors}")
    print(f"\nCompleted: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    return all_stats


if __name__ == '__main__':
    run_all_scrapers()
