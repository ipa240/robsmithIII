"""Email Alert Service for VANurses Job Notifications"""
import smtplib
import ssl
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from datetime import datetime

from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def send_email(to_email: str, subject: str, html_content: str, text_content: str = None) -> bool:
    """Send an email via SMTP with TLS"""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        msg["To"] = to_email

        if text_content:
            msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        # Create SSL context that doesn't verify certs (internal mailcow)
        context = ssl.create_default_context()
        if not getattr(settings, 'smtp_verify_certs', True):
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
            server.ehlo()
            if getattr(settings, 'smtp_use_tls', True):
                server.starttls(context=context)
                server.ehlo()
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_from_email, to_email, msg.as_string())

        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


def build_job_alert_html(jobs: List[dict], user_name: str = "there") -> str:
    """Build HTML email for new job alerts"""
    job_rows = ""
    for job in jobs[:10]:  # Limit to 10 jobs per email
        pay = ""
        if job.get("pay_min") or job.get("pay_max"):
            pay = f"${job.get('pay_min', job.get('pay_max'))}"
            if job.get("pay_type"):
                pay += f"/{job.get('pay_type', 'hr')[:3]}"

        job_rows += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                <a href="https://vanurses.net/jobs/{job.get('id')}" style="color: #3b82f6; text-decoration: none; font-weight: 600;">{job.get('title', 'Job')}</a>
                <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">{job.get('facility_name', 'Unknown Facility')} - {job.get('city', '')}, {job.get('state', 'VA')}</div>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #059669; font-weight: 600;">{pay or 'See posting'}</td>
        </tr>
        """

    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">New Jobs Match Your Preferences</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">VANurses - Virginia Nursing Jobs</p>
    </div>
    <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">Hey {user_name},</p>
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 20px 0;">We found {len(jobs)} new job{'' if len(jobs) == 1 else 's'} that match your saved preferences:</p>

        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr>
                    <th style="text-align: left; padding: 12px; background: #f9fafb; border-bottom: 2px solid #e5e7eb; color: #374151;">Position</th>
                    <th style="text-align: right; padding: 12px; background: #f9fafb; border-bottom: 2px solid #e5e7eb; color: #374151;">Pay</th>
                </tr>
            </thead>
            <tbody>
                {job_rows}
            </tbody>
        </table>

        <div style="margin-top: 24px; text-align: center;">
            <a href="https://vanurses.net/jobs" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View All Jobs</a>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            You're receiving this because you enabled job alerts on VANurses.<br>
            <a href="https://vanurses.net/profile" style="color: #6b7280;">Manage your notification preferences</a>
        </p>
    </div>
</body>
</html>
"""


def build_facility_alert_html(facility: dict, jobs: List[dict], user_name: str = "there") -> str:
    """Build HTML email for watched facility new jobs"""
    job_list = ""
    for job in jobs[:5]:
        pay = ""
        if job.get("pay_min") or job.get("pay_max"):
            pay = f" - ${job.get('pay_min', job.get('pay_max'))}/{job.get('pay_type', 'hr')[:3]}"

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
            Great news! <strong>{facility.get('name')}</strong> just posted {len(jobs)} new job{'' if len(jobs) == 1 else 's'}:
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


def send_job_alert(to_email: str, user_name: str, jobs: List[dict]) -> bool:
    """Send job alert email to user"""
    if not jobs:
        return False

    subject = f"{len(jobs)} New Nursing Jobs Match Your Preferences"
    html = build_job_alert_html(jobs, user_name)
    text = f"Hey {user_name}, we found {len(jobs)} new jobs matching your preferences. Visit https://vanurses.net/jobs to view them."

    return send_email(to_email, subject, html, text)


def send_facility_job_alert(to_email: str, user_name: str, facility: dict, jobs: List[dict]) -> bool:
    """Send alert when watched facility posts new jobs"""
    if not jobs or not facility:
        return False

    subject = f"New Jobs at {facility.get('name', 'Your Watched Facility')}"
    html = build_facility_alert_html(facility, jobs, user_name)
    text = f"Hey {user_name}, {facility.get('name')} just posted {len(jobs)} new jobs."

    return send_email(to_email, subject, html, text)


def build_digest_html(user_name: str, matching_jobs: List[dict], facility_jobs: dict, stats: dict) -> str:
    """Build weekly/daily digest email"""
    job_section = ""
    if matching_jobs:
        job_rows = ""
        for job in matching_jobs[:5]:
            job_rows += f"""
            <li style="margin-bottom: 8px;">
                <a href="https://vanurses.net/jobs/{job.get('id')}" style="color: #3b82f6; text-decoration: none;">{job.get('title', 'Job')}</a>
                <span style="color: #6b7280;"> at {job.get('facility_name', '')}</span>
            </li>
            """
        job_section = f"""
        <h3 style="color: #374151; font-size: 16px; margin: 20px 0 12px 0;">Jobs Matching Your Preferences</h3>
        <ul style="color: #374151; padding-left: 20px; margin: 0 0 16px 0;">{job_rows}</ul>
        """

    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Your VANurses Weekly Digest</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">{datetime.now().strftime('%B %d, %Y')}</p>
    </div>
    <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px;">
        <p style="color: #374151;">Hey {user_name},</p>
        <p style="color: #6b7280;">Here's what's happening in Virginia nursing:</p>
        <div style="display: flex; gap: 16px; margin: 20px 0;">
            <div style="flex: 1; background: #f0f9ff; padding: 16px; border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">{stats.get('total_jobs', 0)}</div>
                <div style="font-size: 12px; color: #6b7280;">Open Jobs</div>
            </div>
            <div style="flex: 1; background: #f0fdf4; padding: 16px; border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: 700; color: #059669;">${stats.get('avg_hourly', 0):.0f}</div>
                <div style="font-size: 12px; color: #6b7280;">Avg Hourly</div>
            </div>
        </div>
        {job_section}
        <div style="text-align: center; margin-top: 24px;">
            <a href="https://vanurses.net/dashboard" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Go to Dashboard</a>
        </div>
    </div>
</body>
</html>
"""


def send_digest_email(to_email: str, user_name: str, matching_jobs: List[dict], facility_jobs: dict, stats: dict) -> bool:
    """Send weekly/daily digest email"""
    subject = f"Your VANurses Weekly Digest - {datetime.now().strftime('%B %d')}"
    html = build_digest_html(user_name, matching_jobs, facility_jobs, stats)
    return send_email(to_email, subject, html)
