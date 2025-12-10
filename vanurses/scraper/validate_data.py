#!/usr/bin/env python3
"""
VANurses.com - Data Quality Validation Script

Checks enriched job data for quality issues:
1. Jobs wrongly marked as expired
2. Missing critical fields (summary, education, etc.)
3. Suspiciously short or generic content
4. URL validity checks

Usage:
    python -m scraper.validate_data              # Full validation report
    python -m scraper.validate_data --fix        # Fix issues where possible
    python -m scraper.validate_data --sample 20  # Check random sample
"""

import argparse
import json
import requests
import re
from typing import Dict, List, Tuple
from datetime import datetime

import psycopg2
from psycopg2.extras import RealDictCursor

from .config import DB_CONFIG


def get_enriched_jobs(conn, limit: int = None) -> List[Dict]:
    """Get all enriched jobs for validation."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, title, source_url, description, is_active,
               raw_schema_json, facility_id
        FROM jobs
        WHERE raw_schema_json IS NOT NULL
          AND raw_schema_json->>'extraction_method' IS NOT NULL
        ORDER BY RANDOM()
        LIMIT %s
    """, (limit,))
    jobs = cur.fetchall()
    cur.close()
    return jobs


def validate_job(job: Dict) -> List[Tuple[str, str]]:
    """
    Validate a single job's enriched data.

    Returns list of (issue_type, description) tuples.
    """
    issues = []
    enrichment = job.get('raw_schema_json') or {}
    if isinstance(enrichment, str):
        enrichment = json.loads(enrichment)

    parsed = enrichment.get('parsed', {})
    raw_text = enrichment.get('raw_text', '')
    extraction_method = enrichment.get('extraction_method', '')

    # Issue 1: Check for Phenom template text falsely captured
    if 'job you are trying to apply for has been filled' in raw_text.lower():
        # Check if this is actually a Phenom site with valid job
        if 'phapp' in raw_text.lower() or 'phenompeople' in raw_text.lower():
            issues.append(('phenom_template', 'Contains Phenom template text - may be falsely marked expired'))

    # Issue 2: Missing summary
    summary = parsed.get('summary')
    if not summary or len(str(summary)) < 20:
        issues.append(('missing_summary', 'No meaningful summary extracted'))
    elif summary and 'has been filled' in summary.lower():
        issues.append(('bad_summary', 'Summary contains "has been filled" - likely template text'))

    # Issue 3: No useful fields extracted
    useful_fields = ['education', 'experience', 'certifications', 'benefits', 'schedule']
    extracted_count = sum(1 for f in useful_fields if parsed.get(f))
    if extracted_count == 0:
        issues.append(('no_fields', 'No useful fields extracted (education, experience, etc.)'))

    # Issue 4: Extraction failed
    if extraction_method == 'failed':
        issues.append(('extraction_failed', 'Enrichment extraction failed'))
    elif extraction_method == 'expired':
        # Verify it's actually expired by checking URL (sample only)
        pass  # Would need HTTP check

    # Issue 5: Very short raw_text (likely fetch failed)
    if len(raw_text) < 100 and extraction_method not in ('expired', 'failed'):
        issues.append(('short_content', f'Very short content ({len(raw_text)} chars) - fetch may have failed'))

    # Issue 6: Active job with expired enrichment
    if job.get('is_active') and enrichment.get('is_expired'):
        issues.append(('status_mismatch', 'Job is active but enrichment says expired'))

    return issues


def verify_url_status(url: str) -> Tuple[int, bool]:
    """Check if URL is accessible and job is available."""
    try:
        response = requests.head(url, timeout=10, allow_redirects=True)
        status = response.status_code

        # For 200 status, do a GET to check for Phenom-style sites
        if status == 200:
            response = requests.get(url, timeout=15)
            html = response.text

            # Check Phenom embedded status
            if 'phapp.ddo' in html.lower():
                match = re.search(r'"jobDetail":\s*\{"status":\s*(\d+)', html)
                if match:
                    job_status = int(match.group(1))
                    return (status, job_status == 200)

            # Check for filled text (non-Phenom)
            if 'has been filled' in html.lower() or 'no longer available' in html.lower():
                return (status, False)

            return (status, True)

        return (status, status == 200)
    except Exception as e:
        return (0, False)


def run_validation(limit: int = None, verify_urls: bool = False, fix: bool = False):
    """Run validation on enriched jobs."""
    print("=" * 70)
    print("VANurses.com - Data Quality Validation")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    conn = psycopg2.connect(**DB_CONFIG)
    jobs = get_enriched_jobs(conn, limit=limit)

    print(f"\nValidating {len(jobs)} enriched jobs...")

    issues_by_type = {}
    jobs_with_issues = []

    for i, job in enumerate(jobs):
        if (i + 1) % 100 == 0:
            print(f"  Checked {i + 1}/{len(jobs)} jobs...")

        issues = validate_job(job)

        if issues:
            jobs_with_issues.append({
                'id': job['id'],
                'title': job['title'],
                'url': job['source_url'],
                'issues': issues
            })

            for issue_type, desc in issues:
                if issue_type not in issues_by_type:
                    issues_by_type[issue_type] = []
                issues_by_type[issue_type].append(job['id'])

    # Summary report
    print("\n" + "=" * 70)
    print("VALIDATION SUMMARY")
    print("=" * 70)
    print(f"Total jobs checked: {len(jobs)}")
    print(f"Jobs with issues: {len(jobs_with_issues)} ({len(jobs_with_issues)/len(jobs)*100:.1f}%)")

    print("\nIssues by type:")
    for issue_type, job_ids in sorted(issues_by_type.items(), key=lambda x: -len(x[1])):
        print(f"  {issue_type}: {len(job_ids)} jobs")

    # Show sample of issues
    if jobs_with_issues:
        print("\nSample issues (first 10):")
        for job_info in jobs_with_issues[:10]:
            print(f"\n  {job_info['title'][:50]}")
            print(f"  ID: {job_info['id']}")
            for issue_type, desc in job_info['issues']:
                print(f"    - [{issue_type}] {desc}")

    # Optional URL verification
    if verify_urls and jobs_with_issues:
        print("\n" + "=" * 70)
        print("URL VERIFICATION (checking if jobs are actually available)")
        print("=" * 70)

        to_verify = jobs_with_issues[:20]  # Limit to 20 for speed
        for job_info in to_verify:
            status, available = verify_url_status(job_info['url'])
            status_text = "AVAILABLE" if available else "UNAVAILABLE"
            print(f"  {job_info['title'][:40]}: HTTP {status} -> {status_text}")

    conn.close()

    return {
        'total': len(jobs),
        'with_issues': len(jobs_with_issues),
        'issues_by_type': {k: len(v) for k, v in issues_by_type.items()},
        'job_ids_with_issues': [j['id'] for j in jobs_with_issues]
    }


def main():
    parser = argparse.ArgumentParser(description='Validate enriched job data quality')
    parser.add_argument('--sample', type=int, default=None,
                        help='Check random sample of N jobs (default: all)')
    parser.add_argument('--verify-urls', action='store_true',
                        help='Also verify URLs are accessible')
    parser.add_argument('--fix', action='store_true',
                        help='Attempt to fix issues')

    args = parser.parse_args()

    run_validation(
        limit=args.sample,
        verify_urls=args.verify_urls,
        fix=args.fix
    )


if __name__ == '__main__':
    main()
