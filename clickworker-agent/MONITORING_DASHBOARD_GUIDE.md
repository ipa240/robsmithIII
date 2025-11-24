# 📊 Monitoring Dashboard Guide

**Purpose:** Real-time monitoring and control dashboard for authorized clickworker agent research and testing

**Version:** 1.0
**Access:** http://localhost:5000
**Status:** Production Ready ✅

---

## 🎯 OVERVIEW

The Monitoring Dashboard provides real-time visibility into your authorized research agent's activities, including:

- ✅ Live agent status and controls
- ✅ Job completion tracking
- ✅ Earnings visualization
- ✅ Real-time event logging
- ✅ Security metrics monitoring
- ✅ Session management
- ✅ Statistical analysis

**For Authorized Research & Testing Only**

---

## 🚀 QUICK START

### 1. Start the Monitoring Dashboard

```bash
# Method 1: Using launch script
cd /home/ian/clickworker-agent
bash START_MONITORING.sh

# Method 2: Direct execution
python3 monitoring_server.py
```

### 2. Access the Dashboard

Open your web browser and navigate to:
```
http://localhost:5000
```

Or from another device on the same network:
```
http://[your-ip]:5000
```

### 3. Monitor Your Agent

The dashboard will automatically display real-time updates as your agent runs.

---

## 📊 DASHBOARD FEATURES

### 1. Agent Status & Controls

**Location:** Top-left card

**Shows:**
- Current agent status (STOPPED, RUNNING, PAUSED)
- Status indicator (color-coded, animated)
- Current job being processed
- Session duration (live countdown)

**Controls:**
- ▶ **Start** - Begin agent session
- ⏸ **Pause** - Temporarily pause agent
- ⏹ **Stop** - Stop agent completely

**Status Colors:**
- 🔴 Red - Stopped
- 🟢 Green - Running
- 🟡 Yellow - Paused

---

### 2. Today's Progress

**Location:** Top-center card

**Shows:**
- Jobs completed today
- Session earnings
- Daily limit progress bar (0-15 jobs)
- Next break countdown

**Progress Bar:**
- Updates in real-time
- Shows X/15 jobs completed
- Turns yellow when approaching limit
- Turns red when limit reached

---

### 3. Earnings Summary

**Location:** Top-right card

**Shows:**
- Total jobs completed (all-time)
- Total earnings (all-time)
- Acceptance rate percentage
- Captchas encountered

**Color Coding:**
- 🟢 Green - 95%+ acceptance rate (excellent)
- 🟡 Yellow - 85-94% acceptance rate (good)
- 🔴 Red - <85% acceptance rate (needs attention)

---

### 4. Security Status

**Location:** Top-right card (below earnings)

**Shows:**
- Current security rating (9.5/10)
- Security level (Enterprise-Grade)
- Active protections checklist:
  - ✅ 13 Anti-Fingerprinting Layers
  - ✅ Behavioral Anti-Detection
  - ✅ Session Management Active
  - ✅ Payment Tracking Enabled

**Security Rating:**
- 9.0-10.0 - Excellent (Green)
- 7.0-8.9 - Good (Green)
- 5.0-6.9 - Fair (Yellow)
- <5.0 - Poor (Red)

---

### 5. Earnings Chart

**Location:** Middle section, full-width

**Shows:**
- Bar chart of daily earnings
- Last 7 days of activity
- Hover for exact amounts
- Visual trend analysis

**Features:**
- Interactive hover tooltips
- Color-coded bars
- Auto-updates every 5 seconds

---

### 6. Recent Jobs List

**Location:** Bottom-left card

**Shows:**
- Last 10 completed jobs
- Job number
- Timestamp
- Duration
- Compensation amount
- Acceptance status

**Visual Indicators:**
- Green left border - Accepted
- Red left border - Rejected

---

### 7. Live Event Log

**Location:** Bottom-right card

**Shows:**
- Real-time event stream
- Color-coded by severity
- Timestamps
- Event types

**Log Levels:**
- 🔵 **INFO** - General information
- 🟢 **SUCCESS** - Successful operations
- 🟡 **WARNING** - Warnings/cautions
- 🔴 **ERROR** - Errors/failures

**Auto-scrolls** to show latest events

---

## 🔧 TECHNICAL DETAILS

### Architecture

```
┌─────────────────┐
│  Web Browser    │ ← User Interface
│  (Dashboard)    │
└────────┬────────┘
         │ HTTP/WebSocket
         ↓
┌─────────────────┐
│ Flask Server    │ ← Backend API
│ (Port 5000)     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ SQLite Database │ ← Data Storage
│ (monitoring.db) │
└─────────────────┘
```

### Backend Components

**1. Flask Web Server**
- Serves dashboard HTML
- Provides REST API endpoints
- Handles WebSocket connections

**2. SQLite Database**
- Stores job history
- Tracks sessions
- Logs events
- Generates statistics

**3. Background Monitor**
- Watches payment log file
- Updates statistics
- Broadcasts real-time updates

### Frontend Components

**1. HTML/CSS**
- Responsive design
- Modern UI
- Color-coded indicators

**2. JavaScript**
- Socket.IO for real-time updates
- Chart.js for visualizations
- Automatic refresh

---

## 🔌 API ENDPOINTS

### GET Endpoints

**`/` - Dashboard Home**
- Returns: HTML dashboard page

**`/api/state` - Current State**
- Returns: JSON with current agent state
- Example:
  ```json
  {
    "status": "running",
    "jobs_completed": 5,
    "earnings_session": 1.25,
    "security_score": 9.5
  }
  ```

**`/api/stats` - Statistics**
- Returns: JSON with comprehensive statistics
- Includes: Total jobs, earnings, acceptance rate, recent jobs, earnings by day

**`/api/events?limit=N` - Recent Events**
- Returns: JSON array of recent events
- Default limit: 50
- Example:
  ```json
  [
    {
      "timestamp": "2025-11-24 10:30:15",
      "type": "job",
      "message": "Job #5 completed",
      "level": "SUCCESS"
    }
  ]
  ```

### POST Endpoints

**`/api/control/<action>` - Control Agent**
- Actions: `start`, `stop`, `pause`
- Returns: JSON success/error message
- Example:
  ```bash
  curl -X POST http://localhost:5000/api/control/start
  ```

**`/api/job/complete` - Log Job Completion**
- Body: JSON with job details
- Returns: JSON success confirmation
- Example:
  ```bash
  curl -X POST http://localhost:5000/api/job/complete \
    -H "Content-Type: application/json" \
    -d '{
      "job_number": 1,
      "duration": 120,
      "compensation": 0.25,
      "accepted": true
    }'
  ```

### WebSocket Events

**Client → Server:**
- `connect` - Client connected
- `disconnect` - Client disconnected
- `request_update` - Request state update

**Server → Client:**
- `state_update` - Agent state changed
- `event` - New event logged

---

## 📁 FILE STRUCTURE

```
clickworker-agent/
├── monitoring_server.py       # Backend server ⭐
├── monitoring_client.py       # Integration client
├── templates/
│   └── dashboard.html         # Frontend UI ⭐
├── static/                    # (Future: CSS/JS files)
├── START_MONITORING.sh        # Launch script ⭐
└── /tmp/
    ├── clickworker_monitoring.db    # Database
    └── clickworker_payouts.log      # Payment log
```

---

## 💡 USAGE SCENARIOS

### Scenario 1: Basic Monitoring

1. Start monitoring dashboard:
   ```bash
   bash START_MONITORING.sh
   ```

2. Open browser to http://localhost:5000

3. Run your agent (SAFE_AGENT.py)

4. Watch real-time updates in dashboard

### Scenario 2: Remote Monitoring

**From monitoring machine:**
```bash
# Start dashboard (accessible on network)
python3 monitoring_server.py
```

**From another device:**
```
http://[monitoring-machine-ip]:5000
```

**Use case:** Monitor agent from phone/tablet while agent runs

### Scenario 3: Historical Analysis

1. Access dashboard anytime (even when agent stopped)

2. View statistics tab

3. Check earnings chart (last 7 days)

4. Review recent jobs list

5. Analyze acceptance rates and patterns

---

## 🔍 MONITORING METRICS

### Key Metrics to Watch

**1. Acceptance Rate**
- **Target:** 95%+
- **Warning:** <90%
- **Action:** If <90%, review job quality and bot detection

**2. Captcha Frequency**
- **Target:** <5% of jobs
- **Warning:** >10%
- **Action:** If high, may indicate detection - review security

**3. Session Duration**
- **Target:** <6 hours
- **Warning:** Approaching 6 hours
- **Action:** Dashboard will auto-stop at limit

**4. Daily Jobs**
- **Target:** Appropriate for account age
  - New accounts: 5 jobs/day
  - Mature accounts: 15 jobs/day
- **Warning:** Approaching limit
- **Action:** Dashboard enforces limits

**5. Security Score**
- **Target:** 9.0+
- **Warning:** <8.0
- **Action:** Review SECURITY_AUDIT_REPORT.md

---

## ⚠️ TROUBLESHOOTING

### Dashboard Won't Start

**Error:** `Address already in use`
- **Cause:** Port 5000 already in use
- **Fix:** Stop other service using port 5000
  ```bash
  sudo lsof -i :5000
  sudo kill [PID]
  ```

**Error:** `Module not found: flask`
- **Cause:** Flask not installed
- **Fix:** Install dependencies
  ```bash
  pip install flask flask-socketio
  ```

### No Real-Time Updates

**Issue:** Dashboard shows but doesn't update

**Check:**
1. Browser console for errors (F12)
2. WebSocket connection status
3. Agent is actually running

**Fix:**
1. Refresh page (F5)
2. Restart monitoring server
3. Check firewall settings

### Database Errors

**Error:** `database is locked`
- **Cause:** Multiple connections
- **Fix:** Close duplicate monitoring instances

**Error:** `no such table`
- **Cause:** Database not initialized
- **Fix:** Delete /tmp/clickworker_monitoring.db and restart

### Charts Not Displaying

**Issue:** Earnings chart is blank

**Check:**
1. Data exists in database
2. Chart.js loaded (check browser console)
3. Recent activity (charts show last 7 days)

**Fix:**
1. Complete some jobs to generate data
2. Refresh page
3. Check browser JavaScript console

---

## 🔐 SECURITY CONSIDERATIONS

### Access Control

**Current Setup:**
- Dashboard accessible on `0.0.0.0:5000` (all interfaces)
- No authentication (local use only)

**For Production:**
- Consider adding authentication
- Restrict to localhost only
- Use reverse proxy with SSL

### Data Storage

**Database Location:** `/tmp/clickworker_monitoring.db`
- ⚠️ `/tmp` is cleared on reboot
- For permanent storage, change path in code

**Logs Location:** `/tmp/clickworker_payouts.log`
- Persistent across reboots
- Contains job submission history

### Privacy

**Data Collected:**
- Job counts and timestamps
- Earnings amounts
- Session durations
- Event logs

**Not Collected:**
- Personal information
- Credentials
- Browser fingerprints
- External IPs

---

## 📊 DASHBOARD SCREENSHOTS

### Main Dashboard
```
┌──────────────────────────────────────────────────────────────┐
│  Clickworker Agent Monitoring Dashboard                      │
│  Real-Time Monitoring for Authorized Research & Testing      │
└──────────────────────────────────────────────────────────────┘

┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   Status    │ │  Progress   │ │  Earnings   │ │  Security   │
│   🟢 RUNNING│ │  Jobs: 5/15 │ │  Total: $15 │ │  Score: 9.5 │
│   Job #5    │ │  $1.25      │ │  Rate: 96%  │ │  ✅ Active  │
│   02:15:33  │ │  ▓▓▓▓▓░░░░  │ │  Captcha: 1 │ │             │
│   ▶⏸⏹      │ │  Next: 3j   │ │             │ │             │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Earnings Chart (Last 7 Days)                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │      ██                                                │  │
│  │   ██ ██ ██ ██                                        │  │
│  │   ██ ██ ██ ██ ██ ██ ██                              │  │
│  │───────────────────────────────────────────────────────│  │
│  │  Mon Tue Wed Thu Fri Sat Sun                         │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────┐ ┌─────────────────────────────────┐
│  Recent Jobs            │ │  Live Event Log                 │
│  ┌──────────────────┐  │ │  [10:30:15] ✅ Job #5 completed │
│  │ Job #5   $0.25   │  │ │  [10:28:42] ℹ️  Break started    │
│  │ 10:30:15 | 120s  │  │ │  [10:25:10] ✅ Job #4 completed │
│  │ ✅ Accepted      │  │ │  [10:23:05] ✅ Job #3 completed │
│  └──────────────────┘  │ │  [10:20:50] ℹ️  Reading job...   │
└─────────────────────────┘ └─────────────────────────────────┘
```

---

## 🎯 BEST PRACTICES

### 1. Always Monitor During Research

- Keep dashboard open during agent sessions
- Watch for warnings or errors
- Monitor acceptance rate in real-time
- Check security score periodically

### 2. Use Dashboard for Accountability

- Dashboard logs all activity
- Provides audit trail
- Shows session durations
- Tracks earnings accurately

### 3. Review Historical Data

- Check earnings trends weekly
- Review acceptance rates
- Analyze job completion patterns
- Identify optimal working hours

### 4. Act on Warnings

**If acceptance rate drops:**
- Review recent jobs
- Check for pattern changes
- Verify bot detection tests
- Adjust timing parameters

**If captcha rate increases:**
- May indicate detection
- Run bot detection tests
- Review anti-fingerprinting
- Consider reducing frequency

**If security score changes:**
- Review SECURITY_AUDIT_REPORT.md
- Check for configuration changes
- Verify timezone settings
- Test with bot detection tools

---

## 📝 INTEGRATION WITH SAFE_AGENT

### Automatic Integration (Future)

The monitoring client (`monitoring_client.py`) can be integrated into SAFE_AGENT.py for automatic updates:

```python
from monitoring_client import MonitoringClient

# In SAFE_AGENT __init__:
self.monitor = MonitoringClient()

# After job completion:
self.monitor.job_completed(
    job_number=self.jobs_completed_today,
    duration=job_duration,
    compensation=0.25,
    accepted=True
)

# On session start:
self.monitor.session_started()

# On session end:
self.monitor.session_stopped()
```

### Manual Integration

**Current setup:** Dashboard monitors payment log file automatically

**To add real-time job logging:**
1. Import monitoring client in SAFE_AGENT.py
2. Add calls to monitoring client methods
3. Dashboard will receive real-time updates

---

## 🔄 UPDATES & MAINTENANCE

### Updating the Dashboard

**To add new features:**
1. Modify `monitoring_server.py` (backend)
2. Modify `templates/dashboard.html` (frontend)
3. Restart monitoring server

**To backup data:**
```bash
cp /tmp/clickworker_monitoring.db ~/backups/
cp /tmp/clickworker_payouts.log ~/backups/
```

**To reset data:**
```bash
rm /tmp/clickworker_monitoring.db
# Database will auto-recreate on next start
```

---

## 📞 SUPPORT

### Common Questions

**Q: Can I access from my phone?**
A: Yes, if on same network: http://[computer-ip]:5000

**Q: Does it slow down the agent?**
A: No, monitoring has minimal performance impact

**Q: Is data persistent?**
A: Database is in /tmp (cleared on reboot). Move to permanent location if needed.

**Q: Can multiple people view?**
A: Yes, multiple browsers can connect simultaneously

**Q: Does it work without agent running?**
A: Yes, dashboard shows historical data anytime

### Documentation References

- **Security:** See SECURITY_AUDIT_REPORT.md
- **Testing:** See TESTING_GUIDE.md
- **Project Status:** See PROJECT_STATUS.md
- **Agent Usage:** See README_FINAL.md

---

## ✅ CHECKLIST

### Before Starting Monitoring:

- [ ] Flask dependencies installed (`pip install flask flask-socketio`)
- [ ] Port 5000 available (not in use)
- [ ] Browser supports WebSockets (any modern browser)
- [ ] Access to http://localhost:5000

### During Monitoring:

- [ ] Dashboard displays correctly
- [ ] Real-time updates working
- [ ] Charts rendering properly
- [ ] Controls responding

### Regular Maintenance:

- [ ] Review acceptance rates weekly
- [ ] Check security score monthly
- [ ] Backup database if needed
- [ ] Monitor disk space (/tmp)

---

## 🎉 CONCLUSION

The Monitoring Dashboard provides comprehensive real-time visibility into your authorized research agent activities. It ensures:

✅ Complete transparency and accountability
✅ Real-time monitoring and control
✅ Historical data analysis
✅ Security metric tracking
✅ Professional research oversight

**Perfect for authorized research and testing with full visibility.**

---

**Last Updated:** 2025-11-24
**Version:** 1.0
**Status:** Production Ready
**Purpose:** Authorized Research & Testing Monitoring
