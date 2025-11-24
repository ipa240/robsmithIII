## 🛡️ MULTI-USER MONITORING WITH SAFEGUARDS

**Version:** 2.0 (Multi-User Edition)
**Purpose:** Enterprise-grade monitoring for multiple researchers with comprehensive quality control
**Status:** Production Ready ✅

---

## 🎯 OVERVIEW

The Multi-User Monitoring Dashboard provides:

✅ **User Authentication** - Secure login for multiple researchers
✅ **Per-User Sessions** - Isolated monitoring for each researcher
✅ **Job Result Verification** - Automatic accuracy checking
✅ **Screenshot Archiving** - Visual proof of job completion
✅ **Quality Safeguards** - Automated alerts for issues
✅ **Accountability** - Complete audit trail per user

**Perfect for research teams with multiple researchers needing oversight and quality assurance.**

---

## 🚀 QUICK START

### 1. Start Multi-User Dashboard

```bash
cd /home/ian/clickworker-agent
python3 monitoring_server_multiuser.py
```

### 2. Login

```
http://localhost:5000/login
```

**Default Admin:**
- Username: `admin`
- Password: `admin123`
- ⚠️ **CHANGE THIS IMMEDIATELY!**

### 3. Add Researchers

```bash
# Add a researcher
python3 add_user.py add john pass123 john@research.local researcher

# Add a viewer (read-only)
python3 add_user.py add viewer view123 viewer@research.local viewer

# List all users
python3 add_user.py list
```

---

## 👥 USER MANAGEMENT

### User Roles

**1. Admin**
- Full system access
- Can add/remove users
- View all researchers' data
- Verify job results

**2. Researcher**
- Run agents
- View own statistics
- Submit job results
- Receive quality alerts

**3. Viewer**
- Read-only access
- View statistics
- Cannot run agents
- Cannot modify data

### Adding Users

```bash
# Basic syntax
python3 add_user.py add <username> <password> <email> <role>

# Examples
python3 add_user.py add alice pass456 alice@lab.edu researcher
python3 add_user.py add bob viewer789 bob@lab.edu viewer
python3 add_user.py add supervisor admin999 super@lab.edu admin
```

### Managing Users

```bash
# List all users
python3 add_user.py list

# Change password
python3 add_user.py password alice newpass123

# Delete user
python3 add_user.py delete bob
```

---

## 🔒 AUTHENTICATION & SECURITY

### Session Security

- **Secure Sessions:** Flask session cookies with secret key
- **Password Hashing:** Werkzeug SHA-256 hashing
- **Login Required:** All dashboard pages require authentication
- **User Isolation:** Each user sees only their own data

### Best Practices

1. **Change Default Password:**
   ```bash
   python3 add_user.py password admin YourStrongPassword123!
   ```

2. **Use Strong Passwords:**
   - Minimum 8 characters
   - Mix of letters, numbers, symbols
   - Unique per user

3. **Separate Accounts:**
   - Don't share login credentials
   - Each researcher gets own account
   - Accountability per person

4. **Regular Audits:**
   - Review user list monthly
   - Remove inactive users
   - Check for suspicious activity

---

## 📋 JOB RESULT VERIFICATION

### How It Works

**1. Job Completion:**
When a job is completed, results are saved:
```json
{
  "job_number": 5,
  "results": {
    "search_query": "python programming",
    "first_headline": "Python Tutorial - W3Schools",
    "page_count": 10,
    "screenshot_taken": true
  },
  "expected_results": {
    "search_query": "python programming",
    "first_headline": "Python Tutorial",
    "page_count": 10
  }
}
```

**2. Automatic Verification:**
System compares `results` vs `expected_results`:
- ✅ **Exact Match:** 100% score, PASSED
- ⚠️ **Partial Match:** 80-99% score, PASSED with warning
- ❌ **No Match:** <80% score, FAILED

**3. Verification Results Stored:**
```sql
job_results table:
- expected_value: "Python Tutorial"
- actual_value: "Python Tutorial - W3Schools"
- match_score: 0.85 (85%)
- passed: TRUE
```

### Using Verification in Code

```python
from monitoring_client import MonitoringClient

monitor = MonitoringClient('http://localhost:5000')

# Complete job with verification
monitor.job_completed(
    job_number=5,
    duration=120,
    compensation=0.25,
    accepted=True,
    results={
        "search_query": "python programming",
        "first_headline": "Python Tutorial - W3Schools",
        "page_count": 10
    },
    expected_results={
        "search_query": "python programming",
        "first_headline": "Python Tutorial",
        "page_count": 10
    }
)
```

### Viewing Verification Status

Dashboard shows:
- ✅ **Verified** badge on jobs
- 📊 Verification pass rate
- ⚠️ Failed verifications highlighted
- 📄 Detailed comparison available

---

## 📸 SCREENSHOT ARCHIVING

### Automatic Screenshot Storage

**Directory Structure:**
```
/tmp/clickworker_screenshots_archive/
├── user_1/
│   ├── job_1_20251124_103015.png
│   ├── job_2_20251124_103245.png
│   └── job_3_20251124_103530.png
├── user_2/
│   └── job_1_20251124_104012.png
└── user_3/
    └── job_1_20251124_105203.png
```

### How to Save Screenshots

```python
from monitoring_client import MonitoringClient

monitor = MonitoringClient()

# Save screenshot with job
with open('screenshot.png', 'rb') as f:
    screenshot_data = f.read()

monitor.job_completed(
    job_number=1,
    screenshot_data=screenshot_data,
    # ... other parameters
)
```

### Screenshot Features

- ✅ **Timestamped:** Each screenshot has unique timestamp
- ✅ **User-Separated:** Organized by user ID
- ✅ **Permanent Archive:** Not deleted automatically
- ✅ **Quality Control:** Visual proof of job completion
- ✅ **Audit Trail:** Can review any job visually

### Retrieving Screenshots

```bash
# View user's screenshots
ls /tmp/clickworker_screenshots_archive/user_1/

# Open specific screenshot
xdg-open /tmp/clickworker_screenshots_archive/user_1/job_5_*.png
```

---

## 🛡️ QUALITY SAFEGUARDS

### Automatic Quality Checks

The system automatically monitors for:

#### 1. **Low Acceptance Rate** ⚠️
**Trigger:** Acceptance rate drops below 90%
**Alert:** WARNING
**Action:** Review job quality, check for errors

```
Alert: Acceptance rate dropped to 87.5% (target: >95%)
```

#### 2. **Fast Completion Times** ⚠️
**Trigger:** Job completed in < 30 seconds
**Alert:** WARNING
**Action:** Verify job was actually completed properly

```
Alert: Job completed very quickly (25s) - verify quality
```

#### 3. **High Captcha Rate** 🔴
**Trigger:** 3+ captchas in 1 hour
**Alert:** CRITICAL
**Action:** Possible detection, review anti-detection settings

```
Alert: High captcha rate detected (5 in last hour) - possible detection
```

#### 4. **Session Duration Warning** ℹ️
**Trigger:** Session duration > 5.5 hours
**Alert:** INFO
**Action:** Plan to stop soon, approaching 6-hour limit

```
Alert: Session duration: 5.7h (limit: 6h)
```

#### 5. **Result Verification Failures** ⚠️
**Trigger:** Job verification fails (match score < 80%)
**Alert:** WARNING
**Action:** Review job results, check for accuracy

```
Alert: Job #5 verification failed - expected vs actual mismatch
```

### Quality Alert Dashboard

**View Alerts:**
- Real-time alerts in event log
- Dedicated alerts API endpoint
- Color-coded by severity:
  - 🔵 INFO - Informational
  - 🟡 WARNING - Needs attention
  - 🔴 CRITICAL - Immediate action required

**Alert Actions:**
```bash
# View alerts via API
curl http://localhost:5000/api/alerts

# In dashboard: Alerts section shows:
# - Unresolved alert count
# - Alert type
# - Severity
# - Timestamp
# - Message
```

---

## 📊 RESULT DATA TRACKING

### What Gets Logged

**For Each Job:**
```json
{
  "job_id": 123,
  "user_id": 1,
  "job_number": 5,
  "timestamp": "2025-11-24 10:30:15",
  "duration": 120,
  "compensation": 0.25,
  "accepted": true,
  "verified": true,
  "screenshot_path": "/tmp/.../job_5_20251124_103015.png",
  "result_data": {
    "search_query": "python programming",
    "first_headline": "Python Tutorial",
    "pages_viewed": 10,
    "links_clicked": 3
  },
  "notes": "Completed successfully"
}
```

### Result Data Storage

**JSON Files:**
```
/tmp/clickworker_job_results/
├── user_1/
│   ├── job_1_20251124_103015.json
│   ├── job_2_20251124_103245.json
│   └── job_3_20251124_103530.json
└── user_2/
    └── job_1_20251124_104012.json
```

**Database Records:**
```sql
jobs table: Basic job info
job_results table: Verification details (expected vs actual)
quality_alerts table: Issues flagged
events table: Activity log
```

### Accessing Result Data

**Via API:**
```bash
# Get job details
curl http://localhost:5000/api/stats

# Response includes recent jobs with:
# - has_results: true/false
# - verified: true/false
# - acceptance status
```

**Via Files:**
```bash
# Read job results
cat /tmp/clickworker_job_results/user_1/job_5_*.json
```

---

## 🔍 ACCURACY CHECKING

### Verification Levels

**Level 1: Exact Match**
```python
expected = "Python Tutorial"
actual = "Python Tutorial"
match_score = 1.0  # 100%
result = PASSED ✅
```

**Level 2: Partial Match**
```python
expected = "Python Tutorial"
actual = "Python Tutorial - W3Schools"
match_score = 0.85  # 85%
result = PASSED ⚠️ (with warning)
```

**Level 3: No Match**
```python
expected = "Python Tutorial"
actual = "JavaScript Guide"
match_score = 0.15  # 15%
result = FAILED ❌
```

### Custom Verification

```python
# Implement custom verification logic
def verify_search_results(expected, actual):
    """Custom verification for search results"""
    # Check if main keywords match
    expected_keywords = set(expected.lower().split())
    actual_keywords = set(actual.lower().split())

    overlap = len(expected_keywords & actual_keywords)
    total = len(expected_keywords)

    match_score = overlap / total
    passed = match_score >= 0.8

    return match_score, passed

# Use in monitoring
match_score, passed = verify_search_results(
    expected="python programming tutorial",
    actual="Python Programming Tutorial for Beginners"
)

if passed:
    log_event('verification', 'Job passed verification', 'SUCCESS')
else:
    log_event('verification', f'Job failed (score: {match_score:.0%})', 'WARNING')
```

---

## 📈 ANALYTICS & REPORTING

### Per-User Statistics

**Dashboard Shows:**
- Total jobs completed
- Acceptance rate (with trend)
- Total earnings
- Verification pass rate
- Active quality alerts
- Session history

### Admin View (Future Feature)

```
Admin Dashboard:
├── All Users Overview
│   ├── User 1: 50 jobs, 96% acceptance
│   ├── User 2: 30 jobs, 94% acceptance
│   └── User 3: 20 jobs, 98% acceptance
├── System-Wide Stats
│   ├── Total jobs: 100
│   ├── Average acceptance: 96%
│   └── Quality alerts: 3 active
└── Performance Comparison
    └── Chart: Jobs per user, acceptance rates
```

### Exporting Data

```bash
# Export user's job data
sqlite3 /tmp/clickworker_monitoring_multiuser.db \
  "SELECT * FROM jobs WHERE user_id=1" \
  -header -csv > user1_jobs.csv

# Export quality alerts
sqlite3 /tmp/clickworker_monitoring_multiuser.db \
  "SELECT * FROM quality_alerts WHERE resolved=0" \
  -header -csv > active_alerts.csv
```

---

## 🔧 CONFIGURATION

### Environment Variables

```bash
# Set secret key (recommended for production)
export SECRET_KEY="your-super-secret-random-key-here"

# Start server
python3 monitoring_server_multiuser.py
```

### Database Location

**Default:** `/tmp/clickworker_monitoring_multiuser.db`

**To change:**
```python
# In monitoring_server_multiuser.py
DB_PATH = '/path/to/your/database.db'
```

### Screenshot Archive Location

**Default:** `/tmp/clickworker_screenshots_archive`

**To change:**
```python
# In monitoring_server_multiuser.py
SCREENSHOTS_BASE = '/path/to/screenshots'
```

---

## 🚨 TROUBLESHOOTING

### Issue: Can't Login

**Check:**
1. Database initialized? (should happen automatically)
2. Default admin created? (check server startup output)
3. Password correct? (case-sensitive)

**Solution:**
```bash
# Reset admin password
python3 add_user.py password admin newpassword123
```

### Issue: User Can't See Their Jobs

**Check:**
1. Logged in as correct user?
2. Jobs submitted with correct user_id?
3. Database permissions correct?

**Solution:**
```bash
# Verify user ID
python3 add_user.py list

# Check jobs for user
sqlite3 /tmp/clickworker_monitoring_multiuser.db \
  "SELECT COUNT(*) FROM jobs WHERE user_id=1"
```

### Issue: Screenshots Not Saving

**Check:**
1. Directory permissions: `/tmp/clickworker_screenshots_archive`
2. Screenshot data provided in API call
3. Disk space available

**Solution:**
```bash
# Check permissions
ls -ld /tmp/clickworker_screenshots_archive

# Check disk space
df -h /tmp

# Create directory if missing
mkdir -p /tmp/clickworker_screenshots_archive
chmod 755 /tmp/clickworker_screenshots_archive
```

### Issue: Quality Alerts Not Appearing

**Check:**
1. Safeguards enabled (default: yes)
2. Conditions met for alerts
3. User logged in to see their alerts

**Test:**
```bash
# Submit test job with fast completion
curl -X POST http://localhost:5000/api/job/complete \
  -H "Content-Type: application/json" \
  -d '{"job_number": 999, "duration": 20}'

# Should trigger "fast completion" alert
```

---

## 📚 API REFERENCE

### Authentication Endpoints

**POST /login**
```bash
curl -X POST http://localhost:5000/login \
  -d "username=admin&password=admin123"
```

**GET /logout**
```bash
curl http://localhost:5000/logout
```

### Data Endpoints (Require Login)

**GET /api/state**
```bash
curl -b cookies.txt http://localhost:5000/api/state
```

**GET /api/stats**
```bash
curl -b cookies.txt http://localhost:5000/api/stats
```

**GET /api/alerts**
```bash
curl -b cookies.txt http://localhost:5000/api/alerts
```

**POST /api/job/complete**
```bash
curl -X POST http://localhost:5000/api/job/complete \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "job_number": 1,
    "duration": 120,
    "compensation": 0.25,
    "accepted": true,
    "results": {"query": "test"},
    "expected_results": {"query": "test"}
  }'
```

---

## ✅ SECURITY BEST PRACTICES

### 1. Password Management
- ✅ Change default admin password immediately
- ✅ Use strong passwords (8+ characters)
- ✅ Don't share passwords between users
- ✅ Rotate passwords quarterly

### 2. User Management
- ✅ Create separate account per researcher
- ✅ Use principle of least privilege (researcher vs admin)
- ✅ Remove inactive users promptly
- ✅ Regular user audits

### 3. Data Protection
- ✅ Backup database regularly
- ✅ Secure screenshot archives
- ✅ Review quality alerts daily
- ✅ Monitor for suspicious activity

### 4. Network Security
- ✅ Use HTTPS in production (not included by default)
- ✅ Restrict access to internal network only
- ✅ Consider VPN for remote access
- ✅ Firewall rules for port 5000

---

## 🎯 CONCLUSION

The Multi-User Monitoring Dashboard with Safeguards provides:

✅ **Enterprise Security** - Authentication and user isolation
✅ **Quality Assurance** - Automated verification and alerts
✅ **Accountability** - Complete audit trail per researcher
✅ **Transparency** - Screenshot archives and result logging
✅ **Team Collaboration** - Multiple researchers, separate sessions
✅ **Research Integrity** - Accuracy checking and safeguards

**Perfect for authorized research teams needing professional-grade monitoring with comprehensive quality control.**

---

**Last Updated:** 2025-11-24
**Version:** 2.0 (Multi-User Edition)
**Status:** Production Ready for Authorized Research Teams
