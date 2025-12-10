#!/usr/bin/env python3
"""
VANurses.com - Batch Job Enrichment Script

Enriches jobs with AI-extracted sections using Ollama.
Run after scraping to process new jobs, or once to enrich all existing jobs.

Usage:
    python -m scraper.enrich_jobs              # Enrich all unenriched jobs
    python -m scraper.enrich_jobs --new-only   # Enrich only new jobs (since last run)
    python -m scraper.enrich_jobs --changed    # Re-enrich jobs with changed descriptions
    python -m scraper.enrich_jobs --batch 100  # Process 100 jobs at a time
    python -m scraper.enrich_jobs --test 5     # Test with 5 jobs
"""

import argparse
import time
import json
import hashlib
from datetime import datetime
from typing import Optional, Dict, List

import psycopg2
from psycopg2.extras import RealDictCursor

from .config import DB_CONFIG
from .job_parser import enrich_job


def compute_description_hash(description: str) -> str:
    """Compute MD5 hash of job description for change detection."""
    if not description:
        return ""
    return hashlib.md5(description.encode('utf-8')).hexdigest()

# Rate limiting
DELAY_BETWEEN_JOBS = 1.5  # seconds between Ollama calls
BATCH_SIZE = 50  # Jobs per batch


def get_unenriched_jobs(conn, limit: Optional[int] = None, new_only: bool = False, changed_only: bool = False) -> List[Dict]:
    """
    Get jobs that need enrichment.

    Args:
        conn: Database connection
        limit: Max jobs to return (None = all)
        new_only: Only get jobs added since last enrichment run
        changed_only: Only get jobs where description has changed since enrichment
    """
    cur = conn.cursor(cursor_factory=RealDictCursor)

    if changed_only:
        # Get jobs where description hash doesn't match stored hash (content changed)
        cur.execute("""
            SELECT j.id, j.source_url, j.title, j.description, j.is_active,
                   j.raw_schema_json->>'description_hash' as stored_hash
            FROM jobs j
            WHERE j.is_active = TRUE
              AND j.raw_schema_json IS NOT NULL
              AND j.raw_schema_json->>'extraction_method' IS NOT NULL
              AND j.raw_schema_json->>'description_hash' IS NOT NULL
              AND j.raw_schema_json->>'description_hash' != MD5(COALESCE(j.description, ''))
            ORDER BY j.scraped_at DESC
            LIMIT %s
        """, (limit,))
    elif new_only:
        # Get jobs added since last successful enrichment run OR jobs never enriched
        cur.execute("""
            SELECT j.id, j.source_url, j.title, j.description, j.is_active
            FROM jobs j
            WHERE j.is_active = TRUE
              AND (
                  -- Never enriched
                  j.raw_schema_json IS NULL
                  OR j.raw_schema_json->>'extraction_method' IS NULL
                  OR j.raw_schema_json->>'extraction_method' = 'failed'
                  -- Or new since last run
                  OR j.scraped_at > (
                      SELECT COALESCE(MAX(created_at), '2000-01-01')
                      FROM enrichment_runs
                      WHERE status = 'success'
                  )
                  -- Or description changed since enrichment
                  OR (
                      j.raw_schema_json->>'description_hash' IS NOT NULL
                      AND j.raw_schema_json->>'description_hash' != MD5(COALESCE(j.description, ''))
                  )
              )
            ORDER BY j.scraped_at DESC
            LIMIT %s
        """, (limit,))
    else:
        # Get all unenriched jobs
        cur.execute("""
            SELECT j.id, j.source_url, j.title, j.description, j.is_active
            FROM jobs j
            WHERE j.is_active = TRUE
              AND (j.raw_schema_json IS NULL
                   OR j.raw_schema_json->>'extraction_method' IS NULL
                   OR j.raw_schema_json->>'extraction_method' = 'failed')
            ORDER BY j.scraped_at DESC
            LIMIT %s
        """, (limit,))

    jobs = cur.fetchall()
    cur.close()
    return jobs


def save_enrichment(conn, job_id: str, enrichment_data: Dict) -> bool:
    """Save enrichment data to the job record."""
    cur = conn.cursor()

    try:
        cur.execute("""
            UPDATE jobs
            SET raw_schema_json = %s,
                is_active = %s
            WHERE id = %s
        """, (
            json.dumps(enrichment_data),
            not enrichment_data.get('is_expired', False),
            job_id
        ))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error saving enrichment for job {job_id}: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()


def mark_job_expired(conn, job_id: str, reason: str = "Job no longer available") -> bool:
    """Mark a job as inactive/expired."""
    cur = conn.cursor()

    try:
        cur.execute("""
            UPDATE jobs
            SET is_active = FALSE,
                raw_schema_json = COALESCE(raw_schema_json, '{}'::jsonb) ||
                    jsonb_build_object(
                        'is_expired', true,
                        'expired_reason', %s,
                        'expired_at', %s
                    )
            WHERE id = %s
        """, (reason, datetime.utcnow().isoformat(), job_id))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error marking job {job_id} as expired: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()


def log_enrichment_run(conn, stats: Dict) -> None:
    """Log the enrichment run to the database."""
    cur = conn.cursor()

    # Create enrichment_runs table if it doesn't exist
    cur.execute("""
        CREATE TABLE IF NOT EXISTS enrichment_runs (
            id SERIAL PRIMARY KEY,
            created_at TIMESTAMP DEFAULT NOW(),
            jobs_processed INT,
            jobs_enriched INT,
            jobs_expired INT,
            jobs_failed INT,
            duration_seconds FLOAT,
            status VARCHAR(50)
        )
    """)

    try:
        cur.execute("""
            INSERT INTO enrichment_runs
            (jobs_processed, jobs_enriched, jobs_expired, jobs_failed, duration_seconds, status)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            stats.get('processed', 0),
            stats.get('enriched', 0),
            stats.get('expired', 0),
            stats.get('failed', 0),
            stats.get('duration', 0),
            'success' if stats.get('failed', 0) < stats.get('processed', 1) / 2 else 'partial'
        ))
        conn.commit()
    except Exception as e:
        print(f"Error logging enrichment run: {e}")
        conn.rollback()
    finally:
        cur.close()


def enrich_batch(jobs: List[Dict], conn) -> Dict:
    """
    Enrich a batch of jobs.

    Returns:
        Stats dict with enriched, expired, failed counts
    """
    stats = {
        'processed': 0,
        'enriched': 0,
        'expired': 0,
        'failed': 0,
    }

    for job in jobs:
        job_id = job['id']
        source_url = job['source_url']
        title = job['title']
        existing_desc = job.get('description', '')

        print(f"  [{stats['processed'] + 1}/{len(jobs)}] Enriching: {title[:50]}...")

        try:
            # Enrich the job
            enrichment = enrich_job(source_url, existing_description=existing_desc)

            # Store description hash for change detection on future scrapes
            enrichment['description_hash'] = compute_description_hash(existing_desc)
            enrichment['enriched_at'] = datetime.utcnow().isoformat()

            # Check if job is expired
            if enrichment.get('is_expired'):
                mark_job_expired(conn, job_id, enrichment.get('expired_message', 'Job expired'))
                stats['expired'] += 1
                print(f"    -> EXPIRED: {enrichment.get('expired_message', 'Unknown reason')}")
            elif enrichment.get('extraction_method') in ('ollama', 'regex'):
                # Successfully enriched
                save_enrichment(conn, job_id, enrichment)
                stats['enriched'] += 1

                # Show what was extracted
                parsed = enrichment.get('parsed', {})
                sections = [k for k, v in parsed.items() if v]
                print(f"    -> OK ({enrichment.get('extraction_method')}): {', '.join(sections) or 'no sections'}")
            else:
                # Failed to enrich
                save_enrichment(conn, job_id, enrichment)
                stats['failed'] += 1
                print(f"    -> FAILED: {enrichment.get('extraction_method', 'unknown')}")

        except Exception as e:
            print(f"    -> ERROR: {e}")
            stats['failed'] += 1

        stats['processed'] += 1

        # Rate limiting
        time.sleep(DELAY_BETWEEN_JOBS)

    return stats


def run_enrichment(limit: Optional[int] = None, new_only: bool = False, changed_only: bool = False, test_mode: bool = False):
    """
    Run the enrichment process.

    Args:
        limit: Max jobs to process (None = all)
        new_only: Only process jobs added since last run (also catches changed descriptions)
        changed_only: Only re-enrich jobs where description changed
        test_mode: Just show what would be processed
    """
    start_time = time.time()

    mode_desc = "new + changed" if new_only else "changed only" if changed_only else "all unenriched"

    print("=" * 70)
    print("VANurses.com - Job Enrichment")
    print(f"Mode: {mode_desc}")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    conn = psycopg2.connect(**DB_CONFIG)

    # Get jobs to enrich
    jobs = get_unenriched_jobs(conn, limit=limit, new_only=new_only, changed_only=changed_only)

    print(f"\nFound {len(jobs)} jobs to enrich")

    if not jobs:
        print("No jobs need enrichment. Done.")
        conn.close()
        return

    if test_mode:
        print("\nTEST MODE - Jobs that would be processed:")
        for i, job in enumerate(jobs[:10]):
            print(f"  {i+1}. {job['title'][:60]}")
        if len(jobs) > 10:
            print(f"  ... and {len(jobs) - 10} more")
        conn.close()
        return

    # Process in batches
    total_stats = {
        'processed': 0,
        'enriched': 0,
        'expired': 0,
        'failed': 0,
    }

    batch_num = 0
    for i in range(0, len(jobs), BATCH_SIZE):
        batch = jobs[i:i + BATCH_SIZE]
        batch_num += 1

        print(f"\n{'=' * 50}")
        print(f"Batch {batch_num}: Processing {len(batch)} jobs")
        print(f"{'=' * 50}")

        batch_stats = enrich_batch(batch, conn)

        # Accumulate stats
        for key in total_stats:
            total_stats[key] += batch_stats.get(key, 0)

        print(f"\nBatch {batch_num} complete:")
        print(f"  Enriched: {batch_stats['enriched']}")
        print(f"  Expired: {batch_stats['expired']}")
        print(f"  Failed: {batch_stats['failed']}")

    # Calculate duration
    duration = time.time() - start_time
    total_stats['duration'] = duration

    # Log the run
    log_enrichment_run(conn, total_stats)

    conn.close()

    # Final summary
    print("\n" + "=" * 70)
    print("ENRICHMENT COMPLETE")
    print("=" * 70)
    print(f"Duration: {duration:.1f} seconds ({duration/60:.1f} minutes)")
    print(f"Jobs processed: {total_stats['processed']}")
    print(f"Jobs enriched: {total_stats['enriched']}")
    print(f"Jobs expired (marked inactive): {total_stats['expired']}")
    print(f"Jobs failed: {total_stats['failed']}")

    success_rate = (total_stats['enriched'] / total_stats['processed'] * 100) if total_stats['processed'] > 0 else 0
    print(f"Success rate: {success_rate:.1f}%")


def main():
    parser = argparse.ArgumentParser(description='Enrich jobs with AI-extracted sections')
    parser.add_argument('--new-only', action='store_true',
                        help='Enrich new jobs + re-enrich changed descriptions (use after scrape)')
    parser.add_argument('--changed', action='store_true',
                        help='Only re-enrich jobs where description has changed')
    parser.add_argument('--batch', type=int, default=None,
                        help='Number of jobs to process (default: all)')
    parser.add_argument('--test', type=int, default=None,
                        help='Test mode: show N jobs that would be processed')

    args = parser.parse_args()

    if args.test:
        run_enrichment(limit=args.test, new_only=args.new_only, changed_only=args.changed, test_mode=True)
    else:
        run_enrichment(limit=args.batch, new_only=args.new_only, changed_only=args.changed)


if __name__ == '__main__':
    main()
