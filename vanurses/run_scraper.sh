#!/bin/bash
# VANurses.com - Hourly Scraper Cron Job
# Runs all scrapers, then enriches new jobs with AI

SCRIPT_DIR="/home/ian/vanurses"
LOG_DIR="/home/ian/vanurses/logs"
LOG_FILE="$LOG_DIR/scraper_$(date +%Y%m%d_%H%M%S).log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Run the scraper
echo "=== VANurses Scraper Started: $(date) ===" >> "$LOG_FILE"
cd "$SCRIPT_DIR"
python3 -m scraper.run_all >> "$LOG_FILE" 2>&1
echo "=== VANurses Scraper Completed: $(date) ===" >> "$LOG_FILE"

# Enrich new jobs with AI (only jobs added since last enrichment run)
echo "" >> "$LOG_FILE"
echo "=== Job Enrichment Started: $(date) ===" >> "$LOG_FILE"
python3 -m scraper.enrich_jobs --new-only >> "$LOG_FILE" 2>&1
echo "=== Job Enrichment Completed: $(date) ===" >> "$LOG_FILE"

# Keep only last 24 hours of logs (24 files for hourly runs)
find "$LOG_DIR" -name "scraper_*.log" -mtime +1 -delete

# Optional: Send summary to stdout for cron email
tail -50 "$LOG_FILE"
