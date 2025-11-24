#!/usr/bin/env python3
"""
CLICKWORKER AGENT MONITORING DASHBOARD
Real-time monitoring and control for authorized research and testing
"""
from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit
import json
import os
import time
from datetime import datetime, timedelta
from threading import Thread, Lock
import sqlite3
from pathlib import Path

app = Flask(__name__)
app.config['SECRET_KEY'] = 'clickworker-monitoring-research-2024'
socketio = SocketIO(app, cors_allowed_origins="*")

# Global state
agent_state = {
    'status': 'stopped',  # stopped, running, paused
    'current_job': None,
    'jobs_completed': 0,
    'jobs_today': 0,
    'session_start': None,
    'session_duration': 0,
    'last_break': None,
    'next_break': None,
    'earnings_session': 0.0,
    'earnings_total': 0.0,
    'acceptance_rate': 0.0,
    'captcha_count': 0,
    'security_score': 9.5,
    'last_activity': None,
}

state_lock = Lock()

# Database setup
DB_PATH = '/tmp/clickworker_monitoring.db'

def init_database():
    """Initialize SQLite database for monitoring"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Jobs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_number INTEGER,
            timestamp TEXT,
            duration REAL,
            compensation REAL,
            accepted BOOLEAN,
            notes TEXT
        )
    ''')

    # Sessions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            start_time TEXT,
            end_time TEXT,
            jobs_completed INTEGER,
            earnings REAL,
            acceptance_rate REAL,
            captchas INTEGER
        )
    ''')

    # Events table (for logging)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            event_type TEXT,
            message TEXT,
            level TEXT
        )
    ''')

    conn.commit()
    conn.close()

def log_event(event_type, message, level='INFO'):
    """Log event to database and broadcast to clients"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO events (timestamp, event_type, message, level) VALUES (?, ?, ?, ?)',
        (timestamp, event_type, message, level)
    )
    conn.commit()
    conn.close()

    # Broadcast to connected clients
    socketio.emit('event', {
        'timestamp': timestamp,
        'type': event_type,
        'message': message,
        'level': level
    })

def update_agent_state(**kwargs):
    """Update agent state and broadcast to clients"""
    with state_lock:
        agent_state.update(kwargs)
        agent_state['last_activity'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    socketio.emit('state_update', agent_state)

# API Routes

@app.route('/')
def index():
    """Main dashboard page"""
    return render_template('dashboard.html')

@app.route('/api/state')
def get_state():
    """Get current agent state"""
    with state_lock:
        return jsonify(agent_state)

@app.route('/api/stats')
def get_stats():
    """Get statistics"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Total jobs
    cursor.execute('SELECT COUNT(*) FROM jobs')
    total_jobs = cursor.fetchone()[0]

    # Total earnings
    cursor.execute('SELECT SUM(compensation) FROM jobs WHERE accepted = 1')
    result = cursor.fetchone()[0]
    total_earnings = result if result else 0.0

    # Acceptance rate
    cursor.execute('SELECT COUNT(*) FROM jobs WHERE accepted = 1')
    accepted = cursor.fetchone()[0]
    acceptance_rate = (accepted / total_jobs * 100) if total_jobs > 0 else 0.0

    # Recent jobs (last 10)
    cursor.execute('''
        SELECT job_number, timestamp, duration, compensation, accepted
        FROM jobs
        ORDER BY timestamp DESC
        LIMIT 10
    ''')
    recent_jobs = [
        {
            'job_number': row[0],
            'timestamp': row[1],
            'duration': row[2],
            'compensation': row[3],
            'accepted': bool(row[4])
        }
        for row in cursor.fetchall()
    ]

    # Earnings by day (last 7 days)
    cursor.execute('''
        SELECT DATE(timestamp) as date, SUM(compensation) as earnings
        FROM jobs
        WHERE accepted = 1 AND timestamp >= date('now', '-7 days')
        GROUP BY DATE(timestamp)
        ORDER BY date
    ''')
    earnings_by_day = [
        {'date': row[0], 'earnings': row[1]}
        for row in cursor.fetchall()
    ]

    conn.close()

    return jsonify({
        'total_jobs': total_jobs,
        'total_earnings': total_earnings,
        'acceptance_rate': acceptance_rate,
        'recent_jobs': recent_jobs,
        'earnings_by_day': earnings_by_day
    })

@app.route('/api/events')
def get_events():
    """Get recent events"""
    limit = request.args.get('limit', 50, type=int)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT timestamp, event_type, message, level
        FROM events
        ORDER BY timestamp DESC
        LIMIT ?
    ''', (limit,))

    events = [
        {
            'timestamp': row[0],
            'type': row[1],
            'message': row[2],
            'level': row[3]
        }
        for row in cursor.fetchall()
    ]

    conn.close()
    return jsonify(events)

@app.route('/api/control/<action>', methods=['POST'])
def control_agent(action):
    """Control agent (start/stop/pause)"""
    if action == 'start':
        update_agent_state(status='running', session_start=datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        log_event('control', 'Agent started', 'SUCCESS')
        return jsonify({'success': True, 'message': 'Agent started'})

    elif action == 'stop':
        update_agent_state(status='stopped')
        log_event('control', 'Agent stopped', 'WARNING')
        return jsonify({'success': True, 'message': 'Agent stopped'})

    elif action == 'pause':
        update_agent_state(status='paused')
        log_event('control', 'Agent paused', 'INFO')
        return jsonify({'success': True, 'message': 'Agent paused'})

    else:
        return jsonify({'success': False, 'message': 'Invalid action'}), 400

@app.route('/api/job/complete', methods=['POST'])
def job_complete():
    """Log completed job"""
    data = request.json

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO jobs (job_number, timestamp, duration, compensation, accepted, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        data.get('job_number'),
        data.get('timestamp', datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
        data.get('duration', 0),
        data.get('compensation', 0.25),
        data.get('accepted', True),
        data.get('notes', '')
    ))
    conn.commit()
    conn.close()

    # Update state
    with state_lock:
        agent_state['jobs_completed'] += 1
        agent_state['jobs_today'] += 1
        agent_state['earnings_session'] += data.get('compensation', 0.25)
        agent_state['earnings_total'] += data.get('compensation', 0.25)

    log_event('job', f"Job #{data.get('job_number')} completed", 'SUCCESS')

    return jsonify({'success': True})

# WebSocket events

@socketio.on('connect')
def handle_connect():
    """Client connected"""
    log_event('connection', 'Client connected', 'INFO')
    emit('state_update', agent_state)

@socketio.on('disconnect')
def handle_disconnect():
    """Client disconnected"""
    log_event('connection', 'Client disconnected', 'INFO')

@socketio.on('request_update')
def handle_update_request():
    """Client requested state update"""
    emit('state_update', agent_state)

# Background monitoring task

def monitor_payout_logs():
    """Monitor payment log file and update stats"""
    payout_file = '/tmp/clickworker_payouts.log'

    while True:
        try:
            if os.path.exists(payout_file):
                with open(payout_file, 'r') as f:
                    lines = f.readlines()

                # Count jobs from log
                job_count = len(lines)

                # Update total earnings estimate
                earnings = job_count * 0.25  # Assuming $0.25 per job

                with state_lock:
                    agent_state['earnings_total'] = earnings

            time.sleep(10)  # Check every 10 seconds
        except Exception as e:
            print(f"Error monitoring logs: {e}")
            time.sleep(30)

if __name__ == '__main__':
    print("""
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║         CLICKWORKER AGENT MONITORING DASHBOARD                       ║
║         📊 Real-Time Monitoring & Control                            ║
║                                                                      ║
║  Purpose: Authorized Research & Testing                              ║
║                                                                      ║
║  Features:                                                           ║
║    • Real-time agent status                                          ║
║    • Job completion tracking                                         ║
║    • Earnings visualization                                          ║
║    • Live logs and events                                            ║
║    • Session controls                                                ║
║    • Security metrics                                                ║
║                                                                      ║
║  Access: http://localhost:5000                                       ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
    """)

    # Initialize database
    init_database()
    log_event('system', 'Monitoring dashboard started', 'SUCCESS')

    # Start background monitoring
    monitor_thread = Thread(target=monitor_payout_logs, daemon=True)
    monitor_thread.start()

    # Run Flask app
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True)
