#!/usr/bin/env python3
"""
Email Notification Worker for VANurses

This script processes email notifications for watched facilities.
Run via cron:
- Instant alerts: Every 15 minutes
- Daily digest: Once per day at 7 AM

Usage:
  python3 /home/ian/vanurses/api/app/services/notification_worker.py --instant
  python3 /home/ian/vanurses/api/app/services/notification_worker.py --daily
"""

import os
import sys
import argparse
import logging
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import List, Dict, Any

import psycopg2
from psycopg2.extras import RealDictCursor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database connection
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432"),
    "database": os.getenv("DB_NAME", "vanurses"),
    "user": os.getenv("DB_USER", "vanurses_app"),
    "password": os.getenv("DB_PASSWORD", "VaNurses2025Secure")
}

# SMTP Configuration
SMTP_CONFIG = {
    "host": os.getenv("SMTP_HOST", "192.168.0.132"),
    "port": int(os.getenv("SMTP_PORT", "587")),
    "user": os.getenv("SMTP_USER", "jobs@vanurses.net"),
    "password": os.getenv("SMTP_PASSWORD", "GobbleGort7$!"),
    "from_email": os.getenv("SMTP_FROM_EMAIL", "jobs@vanurses.net"),
    "from_name": os.getenv("SMTP_FROM_NAME", "VANurses Job Alerts")
}


def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)


def send_email(to_email: str, subject: str, html_content: str, text_content: str = None) -> bool:
    """Send an email via SMTP with TLS"""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{SMTP_CONFIG['from_name']} <{SMTP_CONFIG['from_email']}>"
        msg["To"] = to_email

        if text_content:
            msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        # Create SSL context that doesn't verify certs (internal mailcow)
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE

        with smtplib.SMTP(SMTP_CONFIG['host'], SMTP_CONFIG['port'], timeout=30) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            if SMTP_CONFIG['user'] and SMTP_CONFIG['password']:
                server.login(SMTP_CONFIG['user'], SMTP_CONFIG['password'])
            server.sendmail(SMTP_CONFIG['from_email'], to_email, msg.as_string())

        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


def build_facility_alert_html(facility: dict, jobs: List[dict], user_name: str = "there") -> str:
    """Build HTML email for watched facility new jobs"""
    job_list = ""
    for job in jobs[:5]:
        pay = ""
        if job.get("pay_min") or job.get("pay_max"):
            pay = f" - ${job.get('pay_min', job.get('pay_max'))}/{job.get('pay_type', 'hr')[:3]}" if job.get('pay_type') else f" - ${job.get('pay_min', job.get('pay_max'))}"

        job_list += f"""
        <li style="margin-bottom: 8px;">
            <a href="https://vanurses.net/jobs/{job.get('id')}" style="color: #3b82f6; text-decoration: none;">{job.get('title', 'Job')}</a>{pay}
        </li>
        """

    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
    <div style="background: linear-gradient(135deg, #059669 0%, #3b82f6 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">New Jobs at {facility.get('name', 'Your Watched Facility')}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">VANurses - Virginia Nursing Jobs</p>
    </div>
    <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">Hey {user_name},</p>
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 20px 0;">
            Great news! <strong>{facility.get('name')}</strong> just posted {len(jobs)} new job{'s' if len(jobs) > 1 else ''}:
        </p>

        <ul style="color: #374151; padding-left: 20px; margin: 0 0 20px 0;">
            {job_list}
        </ul>

        <div style="margin-top: 24px; text-align: center;">
            <a href="https://vanurses.net/facilities/{facility.get('id')}" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Facility</a>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            You're receiving this because you're watching {facility.get('name')} on VANurses.<br>
            <a href="https://vanurses.net/profile" style="color: #6b7280;">Manage your watched facilities</a>
        </p>
    </div>
</body>
</html>
"""


def build_digest_html(user_name: str, jobs: List[dict], stats: dict) -> str:
    """Build daily digest email"""
    job_rows = ""
    for job in jobs[:10]:
        job_rows += f"""
        <li style="margin-bottom: 8px;">
            <a href="https://vanurses.net/jobs/{job.get('job_id')}" style="color: #3b82f6; text-decoration: none;">{job.get('title', 'Job')}</a>
            <span style="color: #6b7280;"> at {job.get('facility_name', '')}</span>
        </li>
        """

    job_section = ""
    if jobs:
        job_section = f"""
        <h3 style="color: #374151; font-size: 16px; margin: 20px 0 12px 0;">New Jobs at Your Watched Facilities</h3>
        <ul style="color: #374151; padding-left: 20px; margin: 0 0 16px 0;">{job_rows}</ul>
        """

    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Your VANurses Daily Digest</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">{datetime.now().strftime('%B %d, %Y')}</p>
    </div>
    <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px;">
        <p style="color: #374151;">Hey {user_name},</p>
        <p style="color: #6b7280;">Here's what's happening in Virginia nursing:</p>
        <table style="width: 100%; margin: 20px 0;">
            <tr>
                <td style="background: #f0f9ff; padding: 16px; border-radius: 8px; text-align: center; width: 50%;">
                    <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">{stats.get('total_jobs', 0)}</div>
                    <div style="font-size: 12px; color: #6b7280;">Open Jobs</div>
                </td>
                <td style="width: 16px;"></td>
                <td style="background: #f0fdf4; padding: 16px; border-radius: 8px; text-align: center; width: 50%;">
                    <div style="font-size: 24px; font-weight: 700; color: #059669;">${stats.get('avg_hourly', 0):.0f}</div>
                    <div style="font-size: 12px; color: #6b7280;">Avg Hourly</div>
                </td>
            </tr>
        </table>
        {job_section}
        <div style="text-align: center; margin-top: 24px;">
            <a href="https://vanurses.net/dashboard" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Go to Dashboard</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            <a href="https://vanurses.net/profile" style="color: #6b7280;">Manage your notification preferences</a>
        </p>
    </div>
</body>
</html>
"""


def get_users_with_instant_alerts() -> List[Dict[str, Any]]:
    """Get users who have enabled instant alerts"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, email, first_name, preferences
                FROM users
                WHERE email IS NOT NULL
                  AND preferences->>'notifications' IS NOT NULL
                  AND (preferences->'notifications'->>'email_instant_alerts')::boolean = true
            """)
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_users_with_daily_digest() -> List[Dict[str, Any]]:
    """Get users who have enabled daily digest"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, email, first_name, preferences
                FROM users
                WHERE email IS NOT NULL
                  AND (
                    preferences->>'notifications' IS NULL
                    OR (preferences->'notifications'->>'email_daily_digest')::boolean IS NOT false
                  )
            """)
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_new_jobs_for_watched_facilities(user_id: str, since: datetime) -> List[Dict[str, Any]]:
    """Get new jobs posted at watched facilities since given time"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    j.id as job_id,
                    j.title,
                    j.nursing_type,
                    j.specialty,
                    j.city,
                    j.state,
                    j.pay_min,
                    j.pay_max,
                    j.pay_type,
                    j.posted_at,
                    f.id as facility_id,
                    f.name as facility_name,
                    fs.ofs_grade
                FROM watched_facilities wf
                JOIN facilities f ON wf.facility_id = f.id
                JOIN jobs j ON j.facility_id = f.id
                LEFT JOIN facility_scores fs ON f.id = fs.facility_id
                LEFT JOIN email_notifications en ON (
                    en.user_id = wf.user_id
                    AND en.job_id = j.id
                    AND en.notification_type = 'instant_alert'
                )
                WHERE wf.user_id = %s
                  AND j.is_active = true
                  AND j.posted_at > %s
                  AND en.id IS NULL
                ORDER BY j.posted_at DESC
            """, (user_id, since))
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_watched_facilities_with_new_jobs(user_id: str) -> Dict[str, Dict]:
    """Get watched facilities grouped with their new jobs since last notification"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    f.id,
                    f.name,
                    f.city,
                    f.state,
                    fs.ofs_grade,
                    wf.last_notified_at
                FROM watched_facilities wf
                JOIN facilities f ON wf.facility_id = f.id
                LEFT JOIN facility_scores fs ON f.id = fs.facility_id
                WHERE wf.user_id = %s
            """, (user_id,))
            facilities = [dict(r) for r in cur.fetchall()]

            result = {}
            for facility in facilities:
                last_notified = facility.get('last_notified_at') or datetime.now() - timedelta(hours=24)

                cur.execute("""
                    SELECT
                        j.id,
                        j.title,
                        j.nursing_type,
                        j.specialty,
                        j.city,
                        j.state,
                        j.pay_min,
                        j.pay_max,
                        j.pay_type,
                        j.posted_at
                    FROM jobs j
                    LEFT JOIN email_notifications en ON (
                        en.user_id = %s
                        AND en.job_id = j.id
                        AND en.notification_type = 'instant_alert'
                    )
                    WHERE j.facility_id = %s
                      AND j.is_active = true
                      AND j.posted_at > %s
                      AND en.id IS NULL
                    ORDER BY j.posted_at DESC
                    LIMIT 10
                """, (user_id, facility['id'], last_notified))
                jobs = [dict(r) for r in cur.fetchall()]

                if jobs:
                    result[facility['id']] = {
                        'facility': facility,
                        'jobs': jobs
                    }

            return result
    finally:
        conn.close()


def record_notification(user_id: str, job_id: str, facility_id: str, notification_type: str, success: bool = True):
    """Record that a notification was sent"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO email_notifications (user_id, job_id, facility_id, notification_type, success)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (user_id, job_id, notification_type) DO NOTHING
            """, (user_id, job_id, facility_id, notification_type, success))
            conn.commit()
    finally:
        conn.close()


def update_last_notified(user_id: str, facility_id: str):
    """Update last_notified_at timestamp for watched facility"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE watched_facilities
                SET last_notified_at = NOW()
                WHERE user_id = %s AND facility_id = %s
            """, (user_id, facility_id))
            conn.commit()
    finally:
        conn.close()


def process_instant_alerts():
    """Send instant alerts for new jobs at watched facilities"""
    logger.info("Processing instant alerts...")

    users = get_users_with_instant_alerts()
    logger.info(f"Found {len(users)} users with instant alerts enabled")

    total_sent = 0
    for user in users:
        user_id = user['id']
        email = user['email']
        name = user.get('first_name') or 'there'

        facility_jobs = get_watched_facilities_with_new_jobs(user_id)

        if not facility_jobs:
            continue

        logger.info(f"User {email}: {len(facility_jobs)} facilities with new jobs")

        for facility_id, data in facility_jobs.items():
            facility = data['facility']
            jobs = data['jobs']

            if not jobs:
                continue

            html = build_facility_alert_html(facility, jobs, name)
            subject = f"New Jobs at {facility.get('name', 'Your Watched Facility')}"
            text = f"Hey {name}, {facility.get('name')} just posted {len(jobs)} new jobs."

            success = send_email(email, subject, html, text)

            if success:
                total_sent += 1
                for job in jobs:
                    record_notification(
                        user_id=user_id,
                        job_id=str(job['id']),
                        facility_id=str(facility_id),
                        notification_type='instant_alert',
                        success=True
                    )
                update_last_notified(user_id, facility_id)
                logger.info(f"Sent alert to {email} for {facility['name']} ({len(jobs)} jobs)")
            else:
                logger.error(f"Failed to send alert to {email}")

    logger.info(f"Instant alerts complete. Sent {total_sent} emails.")
    return total_sent


def process_daily_digest():
    """Send daily digest emails to users"""
    logger.info("Processing daily digest...")

    users = get_users_with_daily_digest()
    logger.info(f"Found {len(users)} users for daily digest")

    conn = get_db_connection()
    stats = {}
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as count FROM jobs WHERE is_active = true")
            stats['total_jobs'] = cur.fetchone()['count']

            cur.execute("""
                SELECT AVG(pay_min) as avg_pay
                FROM jobs
                WHERE is_active = true
                  AND pay_type = 'hourly'
                  AND pay_min IS NOT NULL
                  AND pay_min > 0
            """)
            result = cur.fetchone()
            stats['avg_hourly'] = result['avg_pay'] or 0
    finally:
        conn.close()

    total_sent = 0
    since = datetime.now() - timedelta(hours=24)

    for user in users:
        user_id = user['id']
        email = user['email']
        name = user.get('first_name') or 'there'

        jobs = get_new_jobs_for_watched_facilities(user_id, since)

        if not jobs:
            continue

        html = build_digest_html(name, jobs, stats)
        subject = f"Your VANurses Daily Digest - {datetime.now().strftime('%B %d')}"

        success = send_email(email, subject, html)

        if success:
            total_sent += 1
            logger.info(f"Sent digest to {email} ({len(jobs)} new jobs)")

            for job in jobs[:10]:
                record_notification(
                    user_id=user_id,
                    job_id=str(job['job_id']),
                    facility_id=str(job.get('facility_id')),
                    notification_type='daily_digest',
                    success=True
                )
        else:
            logger.error(f"Failed to send digest to {email}")

    logger.info(f"Daily digest complete. Sent {total_sent} emails.")
    return total_sent


def main():
    parser = argparse.ArgumentParser(description='VANurses Email Notification Worker')
    parser.add_argument('--instant', action='store_true', help='Process instant alerts')
    parser.add_argument('--daily', action='store_true', help='Process daily digest')
    args = parser.parse_args()

    if not args.instant and not args.daily:
        # Default: run both
        process_instant_alerts()
        process_daily_digest()
    else:
        if args.instant:
            process_instant_alerts()
        if args.daily:
            process_daily_digest()


if __name__ == '__main__':
    main()
