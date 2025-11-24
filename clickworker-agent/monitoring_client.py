#!/usr/bin/env python3
"""
MONITORING CLIENT - Integration for SAFE_AGENT
Sends real-time updates to monitoring dashboard
"""
import requests
import json
from datetime import datetime

class MonitoringClient:
    """Client for sending updates to monitoring dashboard"""

    def __init__(self, server_url='http://localhost:5000'):
        self.server_url = server_url
        self.enabled = True
        self._test_connection()

    def _test_connection(self):
        """Test connection to monitoring server"""
        try:
            response = requests.get(f'{self.server_url}/api/state', timeout=2)
            self.enabled = response.status_code == 200
        except:
            self.enabled = False
            print("⚠️  Monitoring dashboard not running - continuing without monitoring")

    def log_event(self, event_type, message, level='INFO'):
        """Log an event to the monitoring dashboard"""
        if not self.enabled:
            return

        try:
            # Send to monitoring server
            # Note: Events are logged via database in monitoring_server.py
            # This is a placeholder for future direct event logging
            pass
        except Exception as e:
            print(f"Failed to log event: {e}")

    def update_state(self, **kwargs):
        """Update agent state"""
        if not self.enabled:
            return

        try:
            # Updates are handled via state endpoint
            # This is for future direct state updates
            pass
        except Exception as e:
            print(f"Failed to update state: {e}")

    def job_completed(self, job_number, duration=0, compensation=0.25, accepted=True, notes=''):
        """Log completed job"""
        if not self.enabled:
            return

        try:
            data = {
                'job_number': job_number,
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'duration': duration,
                'compensation': compensation,
                'accepted': accepted,
                'notes': notes
            }
            response = requests.post(
                f'{self.server_url}/api/job/complete',
                json=data,
                timeout=5
            )
            if response.status_code != 200:
                print(f"⚠️  Failed to log job to monitoring dashboard")
        except Exception as e:
            print(f"Failed to log job completion: {e}")

    def session_started(self):
        """Log session start"""
        if not self.enabled:
            return

        try:
            response = requests.post(
                f'{self.server_url}/api/control/start',
                timeout=5
            )
        except Exception as e:
            print(f"Failed to log session start: {e}")

    def session_stopped(self):
        """Log session stop"""
        if not self.enabled:
            return

        try:
            response = requests.post(
                f'{self.server_url}/api/control/stop',
                timeout=5
            )
        except Exception as e:
            print(f"Failed to log session stop: {e}")
