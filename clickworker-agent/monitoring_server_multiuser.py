#!/usr/bin/env python3
"""
CLICKWORKER AGENT MONITORING DASHBOARD - MULTI-USER EDITION
Real-time monitoring with authentication, job verification, and safeguards
For authorized research and testing with multiple researchers
"""
from flask import Flask, render_template, jsonify, request, redirect, url_for, session, flash
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import json
import os
import time
import shutil
from datetime import datetime, timedelta
from threading import Thread, Lock
import sqlite3
from pathlib import Path

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'clickworker-monitoring-research-multiuser-2024')
socketio = SocketIO(app, cors_allowed_origins="*")

# Flask-Login setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Global state per user
user_states = {}
state_lock = Lock()

# Database setup
DB_PATH = '/tmp/clickworker_monitoring_multiuser.db'
SCREENSHOTS_BASE = '/tmp/clickworker_screenshots_archive'
RESULTS_BASE = '/tmp/clickworker_job_results'

os.makedirs(SCREENSHOTS_BASE, exist_ok=True)
os.makedirs(RESULTS_BASE, exist_ok=True)

class User(UserMixin):
    """User model for authentication"""
    def __init__(self, id, username, email, role='researcher'):
        self.id = id
        self.username = username
        self.email = email
        self.role = role  # researcher, admin, viewer

@login_manager.user_loader
def load_user(user_id):
    """Load user from database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT id, username, email, role FROM users WHERE id = ?', (user_id,))
    result = cursor.fetchone()
    conn.close()

    if result:
        return User(result[0], result[1], result[2], result[3])
    return None

def init_database():
    """Initialize SQLite database with multi-user support"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT DEFAULT 'researcher',
            created_at TEXT,
            last_login TEXT
        )
    ''')

    # Jobs table (with user tracking)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            job_number INTEGER,
            timestamp TEXT,
            duration REAL,
            compensation REAL,
            accepted BOOLEAN,
            notes TEXT,
            screenshot_path TEXT,
            result_data TEXT,
            verified BOOLEAN DEFAULT 0,
            verified_by INTEGER,
            verified_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (verified_by) REFERENCES users(id)
        )
    ''')

    # Sessions table (with user tracking)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            start_time TEXT,
            end_time TEXT,
            jobs_completed INTEGER,
            earnings REAL,
            acceptance_rate REAL,
            captchas INTEGER,
            security_score REAL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    # Events table (with user tracking)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            timestamp TEXT,
            event_type TEXT,
            message TEXT,
            level TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    # Job results verification table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS job_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER,
            result_type TEXT,
            expected_value TEXT,
            actual_value TEXT,
            match_score REAL,
            passed BOOLEAN,
            checked_at TEXT,
            FOREIGN KEY (job_id) REFERENCES jobs(id)
        )
    ''')

    # Quality control alerts
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS quality_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            job_id INTEGER,
            alert_type TEXT,
            severity TEXT,
            message TEXT,
            timestamp TEXT,
            resolved BOOLEAN DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (job_id) REFERENCES jobs(id)
        )
    ''')

    conn.commit()
    conn.close()

def create_default_admin():
    """Create default admin user if none exists"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) FROM users WHERE role = "admin"')
    if cursor.fetchone()[0] == 0:
        # Create default admin
        password_hash = generate_password_hash('admin123')
        cursor.execute('''
            INSERT INTO users (username, password_hash, email, role, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', ('admin', password_hash, 'admin@clickworker-research.local', 'admin',
              datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
        conn.commit()
        print("✅ Default admin created - Username: admin, Password: admin123")
        print("⚠️  IMPORTANT: Change this password immediately!")

    conn.close()

def log_event(event_type, message, level='INFO', user_id=None):
    """Log event to database and broadcast to user's room"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # Try to get user_id from current_user if available
    try:
        if user_id is None and current_user and current_user.is_authenticated:
            user_id = current_user.id
    except:
        pass  # No user context available (e.g., at startup)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO events (user_id, timestamp, event_type, message, level) VALUES (?, ?, ?, ?, ?)',
        (user_id, timestamp, event_type, message, level)
    )
    conn.commit()
    conn.close()

    # Broadcast to user's room only
    if user_id:
        socketio.emit('event', {
            'timestamp': timestamp,
            'type': event_type,
            'message': message,
            'level': level
        }, room=f'user_{user_id}')

def save_job_screenshot(user_id, job_number, screenshot_data=None):
    """Save job screenshot for verification"""
    user_dir = os.path.join(SCREENSHOTS_BASE, f'user_{user_id}')
    os.makedirs(user_dir, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    screenshot_path = os.path.join(user_dir, f'job_{job_number}_{timestamp}.png')

    # If screenshot_data provided, save it
    if screenshot_data:
        with open(screenshot_path, 'wb') as f:
            f.write(screenshot_data)

    return screenshot_path

def save_job_results(user_id, job_number, result_data):
    """Save job results for verification"""
    user_dir = os.path.join(RESULTS_BASE, f'user_{user_id}')
    os.makedirs(user_dir, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    result_path = os.path.join(user_dir, f'job_{job_number}_{timestamp}.json')

    with open(result_path, 'w') as f:
        json.dump(result_data, f, indent=2)

    return result_path

def verify_job_result(job_id, expected_results):
    """Verify job results against expected values"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get job data
    cursor.execute('SELECT result_data FROM jobs WHERE id = ?', (job_id,))
    result = cursor.fetchone()

    if not result or not result[0]:
        conn.close()
        return False

    actual_results = json.loads(result[0])
    all_passed = True

    for key, expected_value in expected_results.items():
        actual_value = actual_results.get(key, '')

        # Calculate match score (simple string similarity)
        if expected_value == actual_value:
            match_score = 1.0
            passed = True
        else:
            # Basic similarity check
            match_score = len(set(str(expected_value)) & set(str(actual_value))) / max(len(str(expected_value)), len(str(actual_value)), 1)
            passed = match_score > 0.8

        if not passed:
            all_passed = False

        # Log verification result
        cursor.execute('''
            INSERT INTO job_results (job_id, result_type, expected_value, actual_value, match_score, passed, checked_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (job_id, key, str(expected_value), str(actual_value), match_score, passed,
              datetime.now().strftime('%Y-%m-%d %H:%M:%S')))

    # Mark job as verified
    cursor.execute('UPDATE jobs SET verified = 1, verified_at = ? WHERE id = ?',
                  (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), job_id))

    conn.commit()
    conn.close()

    return all_passed

def check_quality_safeguards(user_id, job_data):
    """Check various quality safeguards and create alerts if needed"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    alerts = []

    # Check 1: Acceptance rate dropping
    cursor.execute('''
        SELECT COUNT(*) as total, SUM(CASE WHEN accepted = 1 THEN 1 ELSE 0 END) as accepted
        FROM jobs WHERE user_id = ? AND timestamp >= date('now', '-7 days')
    ''', (user_id,))
    result = cursor.fetchone()
    if result[0] > 10:  # Only check if enough data
        acceptance_rate = (result[1] / result[0]) * 100
        if acceptance_rate < 90:
            alerts.append({
                'type': 'low_acceptance',
                'severity': 'WARNING',
                'message': f'Acceptance rate dropped to {acceptance_rate:.1f}% (target: >95%)'
            })

    # Check 2: Job completion speed (too fast = suspicious)
    if 'duration' in job_data and job_data['duration'] < 30:
        alerts.append({
            'type': 'fast_completion',
            'severity': 'WARNING',
            'message': f'Job completed very quickly ({job_data["duration"]:.0f}s) - verify quality'
        })

    # Check 3: Multiple captchas (detection warning)
    cursor.execute('''
        SELECT COUNT(*) FROM events
        WHERE user_id = ? AND event_type = 'captcha' AND timestamp >= date('now', '-1 hour')
    ''', (user_id,))
    captcha_count = cursor.fetchone()[0]
    if captcha_count >= 3:
        alerts.append({
            'type': 'high_captcha_rate',
            'severity': 'CRITICAL',
            'message': f'High captcha rate detected ({captcha_count} in last hour) - possible detection'
        })

    # Check 4: Session duration approaching limit
    cursor.execute('''
        SELECT start_time FROM sessions
        WHERE user_id = ? AND end_time IS NULL
        ORDER BY start_time DESC LIMIT 1
    ''', (user_id,))
    result = cursor.fetchone()
    if result:
        start_time = datetime.strptime(result[0], '%Y-%m-%d %H:%M:%S')
        duration_hours = (datetime.now() - start_time).total_seconds() / 3600
        if duration_hours >= 5.5:  # 30 min before 6 hour limit
            alerts.append({
                'type': 'session_limit_approaching',
                'severity': 'INFO',
                'message': f'Session duration: {duration_hours:.1f}h (limit: 6h)'
            })

    # Save alerts
    job_id = job_data.get('job_id')
    for alert in alerts:
        cursor.execute('''
            INSERT INTO quality_alerts (user_id, job_id, alert_type, severity, message, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, job_id, alert['type'], alert['severity'], alert['message'],
              datetime.now().strftime('%Y-%m-%d %H:%M:%S')))

        # Log as event too
        log_event('quality_alert', alert['message'], alert['severity'], user_id)

    conn.commit()
    conn.close()

    return alerts

# Routes

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Login page"""
    if current_user.is_authenticated:
        return redirect(url_for('index'))

    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT id, username, password_hash, email, role FROM users WHERE username = ?', (username,))
        result = cursor.fetchone()
        conn.close()

        if result and check_password_hash(result[2], password):
            user = User(result[0], result[1], result[3], result[4])
            login_user(user)

            # Update last login
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('UPDATE users SET last_login = ? WHERE id = ?',
                          (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), user.id))
            conn.commit()
            conn.close()

            log_event('auth', f'User {username} logged in', 'INFO', user.id)
            return redirect(url_for('index'))
        else:
            flash('Invalid username or password', 'error')

    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    """Logout"""
    log_event('auth', f'User {current_user.username} logged out', 'INFO')
    logout_user()
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    """Main dashboard page"""
    # Show admin dashboard for admins, regular dashboard for others
    if current_user.role == 'admin':
        return render_template('dashboard_admin.html', user=current_user)
    return render_template('dashboard.html', user=current_user)

@app.route('/api/state')
@login_required
def get_state():
    """Get current agent state for logged-in user"""
    user_id = current_user.id
    with state_lock:
        if user_id not in user_states:
            user_states[user_id] = {
                'status': 'stopped',
                'current_job': None,
                'jobs_completed': 0,
                'jobs_today': 0,
                'session_start': None,
                'session_duration': 0,
                'earnings_session': 0.0,
                'earnings_total': 0.0,
                'acceptance_rate': 0.0,
                'captcha_count': 0,
                'security_score': 9.5,
                'last_activity': None,
            }
        return jsonify(user_states[user_id])

@app.route('/api/stats')
@login_required
def get_stats():
    """Get statistics for logged-in user"""
    user_id = current_user.id
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Total jobs
    cursor.execute('SELECT COUNT(*) FROM jobs WHERE user_id = ?', (user_id,))
    total_jobs = cursor.fetchone()[0]

    # Total earnings
    cursor.execute('SELECT SUM(compensation) FROM jobs WHERE user_id = ? AND accepted = 1', (user_id,))
    result = cursor.fetchone()[0]
    total_earnings = result if result else 0.0

    # Month earnings
    cursor.execute('''
        SELECT SUM(compensation) FROM jobs
        WHERE user_id = ? AND accepted = 1
        AND strftime('%Y-%m', timestamp) = strftime('%Y-%m', 'now')
    ''', (user_id,))
    result = cursor.fetchone()[0]
    month_earnings = result if result else 0.0

    # Acceptance rate
    cursor.execute('SELECT COUNT(*) FROM jobs WHERE user_id = ? AND accepted = 1', (user_id,))
    accepted = cursor.fetchone()[0]
    acceptance_rate = (accepted / total_jobs * 100) if total_jobs > 0 else 0.0

    # Last run timestamp
    cursor.execute('''
        SELECT MAX(timestamp) FROM jobs WHERE user_id = ?
    ''', (user_id,))
    last_run = cursor.fetchone()[0]

    # Recent jobs (last 10)
    cursor.execute('''
        SELECT id, job_number, timestamp, duration, compensation, accepted, verified, result_data, notes, screenshot_path
        FROM jobs WHERE user_id = ?
        ORDER BY timestamp DESC
        LIMIT 10
    ''', (user_id,))
    recent_jobs = [
        {
            'id': row[0],
            'job_number': row[1],
            'timestamp': row[2],
            'duration': row[3],
            'compensation': row[4],
            'accepted': bool(row[5]),
            'verified': bool(row[6]),
            'has_results': bool(row[7]),
            'notes': row[8],
            'screenshot_path': row[9]
        }
        for row in cursor.fetchall()
    ]

    # Quality alerts (unresolved)
    cursor.execute('''
        SELECT COUNT(*) FROM quality_alerts
        WHERE user_id = ? AND resolved = 0
    ''', (user_id,))
    active_alerts = cursor.fetchone()[0]

    conn.close()

    return jsonify({
        'total_jobs': total_jobs,
        'total_earnings': total_earnings,
        'month_earnings': month_earnings,
        'acceptance_rate': acceptance_rate,
        'last_run': last_run,
        'recent_jobs': recent_jobs,
        'active_alerts': active_alerts
    })

@app.route('/api/admin/users')
@login_required
def get_all_users():
    """Get all users with stats (admin only)"""
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get all users
    cursor.execute('SELECT id, username, email, role, last_login FROM users ORDER BY id')
    users_data = []

    for row in cursor.fetchall():
        user_id, username, email, role, last_login = row

        # Get stats for each user
        cursor.execute('SELECT COUNT(*) FROM jobs WHERE user_id = ?', (user_id,))
        total_jobs = cursor.fetchone()[0]

        cursor.execute('SELECT SUM(compensation) FROM jobs WHERE user_id = ? AND accepted = 1', (user_id,))
        result = cursor.fetchone()[0]
        total_earnings = result if result else 0.0

        cursor.execute('''
            SELECT SUM(compensation) FROM jobs
            WHERE user_id = ? AND accepted = 1
            AND strftime('%Y-%m', timestamp) = strftime('%Y-%m', 'now')
        ''', (user_id,))
        result = cursor.fetchone()[0]
        month_earnings = result if result else 0.0

        cursor.execute('SELECT MAX(timestamp) FROM jobs WHERE user_id = ?', (user_id,))
        last_run = cursor.fetchone()[0]

        cursor.execute('SELECT COUNT(*) FROM jobs WHERE user_id = ? AND accepted = 1', (user_id,))
        accepted = cursor.fetchone()[0]
        acceptance_rate = (accepted / total_jobs * 100) if total_jobs > 0 else 0.0

        # Check if active (has state)
        is_active = user_id in user_states and user_states[user_id].get('status') == 'running'

        users_data.append({
            'id': user_id,
            'username': username,
            'email': email,
            'role': role,
            'last_login': last_login,
            'is_active': is_active,
            'last_run': last_run,
            'total_jobs': total_jobs,
            'total_earnings': total_earnings,
            'month_earnings': month_earnings,
            'acceptance_rate': acceptance_rate
        })

    conn.close()
    return jsonify(users_data)

@app.route('/api/job/complete', methods=['POST'])
@login_required
def job_complete():
    """Log completed job with verification"""
    data = request.json
    user_id = current_user.id

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Save job
    cursor.execute('''
        INSERT INTO jobs (user_id, job_number, timestamp, duration, compensation, accepted, notes, result_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        user_id,
        data.get('job_number'),
        data.get('timestamp', datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
        data.get('duration', 0),
        data.get('compensation', 0.25),
        data.get('accepted', True),
        data.get('notes', ''),
        json.dumps(data.get('results', {}))
    ))

    job_id = cursor.lastrowid
    conn.commit()
    conn.close()

    # Save results to file
    if data.get('results'):
        save_job_results(user_id, data.get('job_number'), data.get('results'))

    # Run quality safeguards
    job_data = {
        'job_id': job_id,
        'duration': data.get('duration', 0)
    }
    alerts = check_quality_safeguards(user_id, job_data)

    # Verify results if expected values provided
    if data.get('expected_results'):
        passed = verify_job_result(job_id, data.get('expected_results'))
        if not passed:
            log_event('quality', f"Job #{data.get('job_number')} verification failed", 'WARNING', user_id)

    log_event('job', f"Job #{data.get('job_number')} completed", 'SUCCESS', user_id)

    return jsonify({'success': True, 'job_id': job_id, 'alerts': alerts})

@app.route('/api/alerts')
@login_required
def get_alerts():
    """Get quality control alerts"""
    user_id = current_user.id
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute('''
        SELECT id, alert_type, severity, message, timestamp, resolved
        FROM quality_alerts
        WHERE user_id = ?
        ORDER BY timestamp DESC
        LIMIT 20
    ''', (user_id,))

    alerts = [
        {
            'id': row[0],
            'type': row[1],
            'severity': row[2],
            'message': row[3],
            'timestamp': row[4],
            'resolved': bool(row[5])
        }
        for row in cursor.fetchall()
    ]

    conn.close()
    return jsonify(alerts)

# WebSocket events

@socketio.on('connect')
@login_required
def handle_connect():
    """Client connected - join user's room"""
    user_id = current_user.id
    join_room(f'user_{user_id}')
    log_event('connection', f'User {current_user.username} connected', 'INFO', user_id)
    emit('state_update', user_states.get(user_id, {}))

@socketio.on('disconnect')
@login_required
def handle_disconnect():
    """Client disconnected - leave user's room"""
    user_id = current_user.id
    leave_room(f'user_{user_id}')
    log_event('connection', f'User {current_user.username} disconnected', 'INFO', user_id)

if __name__ == '__main__':
    print("""
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║         CLICKWORKER AGENT MONITORING - MULTI-USER EDITION            ║
║         📊 Real-Time Monitoring with Authentication                  ║
║                                                                      ║
║  Purpose: Authorized Research & Testing (Multi-User)                 ║
║                                                                      ║
║  Features:                                                           ║
║    • User authentication & management                                ║
║    • Per-user session tracking                                       ║
║    • Job result verification                                         ║
║    • Screenshot archiving                                            ║
║    • Quality control safeguards                                      ║
║    • Accuracy checking                                               ║
║    • Multi-researcher support                                        ║
║                                                                      ║
║  Access: http://localhost:5000                                       ║
║  Default Admin: admin / admin123 (CHANGE IMMEDIATELY)                ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
    """)

    # Initialize database
    init_database()
    create_default_admin()
    log_event('system', 'Multi-user monitoring dashboard started', 'SUCCESS')

    # Run Flask app
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True)
