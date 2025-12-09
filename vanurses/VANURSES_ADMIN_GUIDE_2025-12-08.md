# VANurses System Administration Guide
**Date:** December 8, 2025
**Version:** 2.1

---

## Server Infrastructure

### Production Server
- **Host:** `192.168.0.150`
- **OS:** Ubuntu Linux
- **SSH:** `ssh ian@192.168.0.150` (password: `1122`)

### Services

| Service | Port | Description |
|---------|------|-------------|
| VANurses API | 5011 | FastAPI backend (gunicorn + uvicorn) |
| PostgreSQL | 5432 | Database |
| Nginx | 80/443 | Reverse proxy (if configured) |

### Service Management

```bash
# Check API status
sudo systemctl status vanurses-api

# Restart API
sudo systemctl restart vanurses-api

# View API logs
sudo journalctl -u vanurses-api -f

# View error logs
tail -f /tmp/vanurses-api-error.log
```

---

## Database

### Connection Details
```
Host: 192.168.0.150
Database: vanurses
User: vanurses_app
Password: VaNurses2025Secure
```

### Quick Access
```bash
PGPASSWORD='VaNurses2025Secure' psql -h 192.168.0.150 -U vanurses_app -d vanurses
```

---

## Community Categories (NEW - Dec 2025)

### Overview
Users can suggest new community forum categories. Suggestions require admin approval before appearing publicly.

### Database Table: `community_categories`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Category name |
| slug | VARCHAR(100) | URL-friendly slug |
| description | TEXT | Category description |
| icon | VARCHAR(50) | Lucide icon name |
| is_approved | BOOLEAN | Admin approval status |
| is_active | BOOLEAN | Visibility flag |
| created_by | UUID | User who suggested |
| approved_by | UUID | Admin who approved |
| approved_at | TIMESTAMPTZ | Approval timestamp |
| sort_order | INTEGER | Display order |

### API Endpoints

#### User-Facing (Community)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/community/categories` | List approved categories |
| POST | `/api/community/categories/suggest` | Submit category suggestion |

#### Admin (requires admin role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/community/categories` | List all categories (pending + approved) |
| POST | `/api/admin/community/categories/{id}/approve` | Approve a pending category |
| DELETE | `/api/admin/community/categories/{id}` | Delete/reject a category |
| PATCH | `/api/admin/community/categories/{id}` | Update category details |

### Admin UI
Access the Admin Dashboard at `/admin` and click the "Community" tab to:
- View pending category suggestions (with approve/reject buttons)
- Manage active categories
- See who suggested each category and when

### SQL Queries

**List pending suggestions:**
```sql
SELECT name, description, created_at,
       (SELECT email FROM users WHERE id = created_by) as suggested_by
FROM community_categories
WHERE is_approved = FALSE
ORDER BY created_at DESC;
```

**Approve a category manually:**
```sql
UPDATE community_categories
SET is_approved = TRUE,
    approved_at = NOW(),
    approved_by = '<admin_user_id>'
WHERE id = '<category_id>';
```

**View approval stats:**
```sql
SELECT
    COUNT(*) FILTER (WHERE is_approved = TRUE) as approved,
    COUNT(*) FILTER (WHERE is_approved = FALSE) as pending
FROM community_categories;
```

---

## Authentication (Zitadel)

### Overview
VANurses uses Zitadel (zitadel.vanurses.net) for OAuth2/OIDC authentication.

### Key Files
- `api/app/auth/zitadel.py` - Token validation
- `frontend/src/components/ProtectedRoute.tsx` - Auth guards

### Admin Users
Admin status is set in the `users` table:
```sql
UPDATE users SET is_admin = TRUE WHERE email = 'admin@vanurses.net';
```

---

## Sully AI Assistant

### Rate Limits
| Tier | Daily Limit | Monthly Limit |
|------|-------------|---------------|
| free | 5 | - |
| starter | 25 | - |
| pro | 100 | - |
| premium | unlimited | - |

### Endpoints
- `POST /api/sully/chat` - Send message to Sully
- `GET /api/sully/history` - Get conversation history

### Model
Uses Google Gemini Flash via API (configured in `api/app/routers/sully.py`)

---

## Subscription Tiers

| Tier | Features |
|------|----------|
| free | Basic job search, 5 Sully questions/day |
| starter | More Sully questions, facility scores |
| pro | Full scores, analytics, job alerts |
| premium | All features, unlimited Sully |
| hr_admin | Employer features, job posting |

---

## Common Admin Tasks

### Restart After Code Changes
```bash
# On server
sudo systemctl restart vanurses-api
cd ~/vanurses/frontend && npm run build
```

### Check System Health
```bash
# API responding
curl http://localhost:5011/api/health

# Database connection
PGPASSWORD='VaNurses2025Secure' psql -h localhost -U vanurses_app -d vanurses -c "SELECT 1"

# Check job counts
PGPASSWORD='VaNurses2025Secure' psql -h localhost -U vanurses_app -d vanurses -c "SELECT COUNT(*) FROM jobs WHERE is_active = TRUE"
```

### View Active Users
```sql
SELECT email, tier, is_admin, created_at
FROM users
ORDER BY created_at DESC
LIMIT 20;
```

### Mark Stale Jobs Inactive
```sql
UPDATE jobs
SET is_active = FALSE
WHERE scraped_at < NOW() - INTERVAL '30 days';
```

---

## File Locations

| Component | Path |
|-----------|------|
| API Code | `~/vanurses/api/app/` |
| Frontend Code | `~/vanurses/frontend/src/` |
| Scraper | `~/vanurses/scraper/` |
| API Service | `/etc/systemd/system/vanurses-api.service` |
| API Logs | `/tmp/vanurses-api-*.log` |
| Scoring Scripts | `~/vanurses/scoring/` |

---

## GitHub Repository

**URL:** github.com/ipa240/AIGeneratorDiscord-and-Bot
**Branch:** main
**Latest Commit:** `dae7dfb` - Replace all mock data with PostgreSQL database integration

---

## Database Tables (User Data - Dec 2025)

The following tables store user-specific data that persists across sessions:

### `user_ceus` - CEU/Continuing Education Logs
```sql
CREATE TABLE user_ceus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    provider VARCHAR(255),
    hours DECIMAL(5,2) NOT NULL,
    category VARCHAR(100),
    completion_date DATE,
    certificate_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `user_applications` - Job Application Tracker
```sql
CREATE TABLE user_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'applied',  -- clicked, applied, screening, interviewing, offer, accepted, rejected, withdrawn
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    follow_up_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `support_tickets` - Help Desk System
```sql
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    user_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'open',  -- open, in_progress, resolved, closed
    priority VARCHAR(20) DEFAULT 'normal',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL,  -- 'user' or 'support'
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `learning_resources` - CEU Resources Library
```sql
CREATE TABLE learning_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    url VARCHAR(500),
    category VARCHAR(100),
    provider VARCHAR(255),
    is_free BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `scraper_runs` - Job Scraper Status Tracking
```sql
CREATE TABLE scraper_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'running',  -- running, completed, failed
    jobs_found INTEGER DEFAULT 0,
    errors TEXT
);
```

---

## API Router Updates (Dec 8, 2025)

All mock/in-memory data has been replaced with PostgreSQL database queries:

| Router | Previous State | New State |
|--------|----------------|-----------|
| `learning.py` | In-memory `ceu_db = {}` | Queries `user_ceus` table |
| `applications.py` | In-memory `applications_db = {}` | Queries `user_applications` table |
| `admin.py` | Hardcoded mock stats | Real queries to users, jobs, facilities |
| `hr.py` | Mock HR data | Queries jobs, facilities, applications by facility |
| `support.py` | In-memory tickets | Queries `support_tickets` + `ticket_messages` |
| `news.py` | Sample article fallback | Returns empty if no DB articles |

---

## Frontend Updates (Dec 8, 2025)

### Onboarding.tsx
- Removed LVN and APRN from license type options (now: RN, LPN, CNA, NP, CRNA, CNM, CNS)
- Shows ALL tier features (removed "+N more" truncation)
- Fixed Sully chat limit text: "3 Sully AI chats/day" (was "5/month")

### Dashboard.tsx
- Stats cards are now clickable links:
  - Active Jobs → `/jobs`
  - Facilities → `/facilities`
  - Saved Jobs → `/saved`
  - Avg Hourly → `/trends`
- Facility grade icons show colored backgrounds (A=green, B=blue, C=amber, D=orange, F=red)
- Added "Personalized Matches" CTA for paid users, upgrade prompt for free users

### Applications.tsx
- Fixed drag & drop glitch with optimistic updates
- Added visual feedback during drag (opacity, ring highlight)
- Added error toast with automatic dismissal
- Drop target columns highlight when dragging over

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-08 | **MAJOR:** Replaced ALL mock data with PostgreSQL database integration |
| 2025-12-08 | Created 6 new database tables for user data persistence |
| 2025-12-08 | Fixed drag & drop in Applications with optimistic updates |
| 2025-12-08 | Fixed Onboarding: removed LVN/APRN, show all features, fixed Sully limit |
| 2025-12-08 | Fixed Dashboard: clickable stats, facility grades, Match Results CTA |
| 2025-12-08 | Added community category approval workflow |
| 2025-12-08 | Added Admin Dashboard Community tab |
| 2025-12-08 | Backed up full API and frontend to GitHub |
| 2025-12-07 | Added E2E test suite |
| 2025-12-06 | Zitadel authentication integration |
| 2025-12-03 | Personalized facility scoring (Module 11) |
