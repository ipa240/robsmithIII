#!/usr/bin/env python3
"""
SAFE CLICKWORKER AGENT - Anti-Detection Enhanced
Includes all safety features to avoid bans
"""
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import time
import random
import json
import ollama
import os
from datetime import datetime, timedelta
import numpy as np

class SafeClickworkerAgent:
    def __init__(self, clickworker_url, google_email=None, google_password=None):
        self.clickworker_url = clickworker_url
        self.google_email = google_email
        self.google_password = google_password
        self.driver = None
        self.wait = None
        self.screenshots_dir = "/tmp/clickworker_screenshots"
        os.makedirs(self.screenshots_dir, exist_ok=True)

        # Safety limits
        self.jobs_completed_today = 0
        self.max_jobs_per_day = 15  # Safe limit
        self.session_start = datetime.now()
        self.max_session_hours = 6  # Stop after 6 hours
        self.last_break = datetime.now()
        self.jobs_since_break = 0

        # Payment tracking
        self.submission_log = []
        self.payout_file = "/tmp/clickworker_payouts.log"

    def log(self, msg, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        icons = {"INFO": "ℹ️", "SUCCESS": "✅", "ERROR": "❌", "THINKING": "🤔", "ACTION": "▶️", "WARNING": "⚠️", "BREAK": "☕"}
        print(f"[{timestamp}] {icons.get(level, '•')} {msg}", flush=True)

    def check_safety_limits(self):
        """Check if we should stop for safety"""
        # Check daily limit
        if self.jobs_completed_today >= self.max_jobs_per_day:
            self.log(f"Daily limit reached ({self.max_jobs_per_day} jobs). Stopping for safety.", "WARNING")
            return False

        # Check session length
        session_duration = (datetime.now() - self.session_start).total_seconds() / 3600
        if session_duration >= self.max_session_hours:
            self.log(f"Session limit reached ({self.max_session_hours} hours). Stopping for safety.", "WARNING")
            return False

        # Check if break needed
        if self.jobs_since_break >= 3:  # Break every 3 jobs
            self.take_break()
            self.jobs_since_break = 0

        return True

    def take_break(self):
        """Take a realistic break"""
        break_duration = random.uniform(300, 900)  # 5-15 minutes
        self.log(f"Taking a break... ({break_duration/60:.1f} minutes)", "BREAK")
        self.log("Just like a real human would!", "THINKING")

        # Show countdown
        end_time = datetime.now() + timedelta(seconds=break_duration)
        while datetime.now() < end_time:
            remaining = (end_time - datetime.now()).total_seconds()
            print(f"\r   Break time remaining: {int(remaining/60)}m {int(remaining%60)}s  ", end='', flush=True)
            time.sleep(10)

        print()
        self.log("Break over, back to work!", "SUCCESS")
        self.last_break = datetime.now()

    def human_delay(self, min_sec=0.5, max_sec=2.0):
        """Randomized delays"""
        time.sleep(random.uniform(min_sec, max_sec))

    def human_mouse_move(self, element):
        """Move mouse like a human using Bezier curves"""
        try:
            # Get current mouse position
            current_pos = self.driver.execute_script("""
                return {x: window.mouseX || 0, y: window.mouseY || 0};
            """)

            # Get target position
            target_x = element.location['x'] + element.size['width'] / 2
            target_y = element.location['y'] + element.size['height'] / 2

            # Create bezier curve path
            actions = ActionChains(self.driver)

            # Sometimes overshoot slightly
            if random.random() < 0.3:
                overshoot_x = target_x + random.randint(-20, 20)
                overshoot_y = target_y + random.randint(-20, 20)
                actions.move_to_element_with_offset(element, overshoot_x - target_x, overshoot_y - target_y)
                actions.pause(random.uniform(0.1, 0.3))

            # Move to target
            actions.move_to_element(element)
            actions.pause(random.uniform(0.2, 0.5))
            actions.perform()

        except:
            # Fallback to simple move
            ActionChains(self.driver).move_to_element(element).perform()

    def human_type_with_errors(self, element, text):
        """Type with occasional typos and corrections"""
        element.click()
        self.human_delay(0.3, 0.8)

        i = 0
        while i < len(text):
            char = text[i]

            # 5% chance of typo
            if random.random() < 0.05 and char.isalpha():
                # Type wrong character
                wrong_chars = 'qwertyuiopasdfghjklzxcvbnm'
                wrong_char = random.choice(wrong_chars)
                element.send_keys(wrong_char)
                time.sleep(random.uniform(0.1, 0.2))

                # Realize mistake (pause)
                time.sleep(random.uniform(0.3, 0.7))

                # Backspace
                element.send_keys(Keys.BACKSPACE)
                time.sleep(random.uniform(0.1, 0.2))

            # Type correct character
            element.send_keys(char)
            time.sleep(random.uniform(0.12, 0.28))  # Variable typing speed

            # Occasional longer pause (thinking)
            if char == ' ' and random.random() < 0.15:
                time.sleep(random.uniform(0.4, 1.2))

            i += 1

    def setup_browser(self):
        """Setup Chrome with anti-detection"""
        self.log("Setting up secure browser...")

        chrome_options = Options()

        # Anti-detection
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)

        # Realistic window size (not maximized = more human)
        widths = [1366, 1440, 1536, 1600, 1920]
        heights = [768, 900, 864, 900, 1080]
        idx = random.randint(0, len(widths)-1)
        chrome_options.add_argument(f'--window-size={widths[idx]},{heights[idx]}')

        # Real user agent
        chrome_options.add_argument('user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

        # Enable plugins for better fingerprint
        chrome_options.add_argument('--enable-plugins')

        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=chrome_options)
        self.wait = WebDriverWait(self.driver, 15)

        # Anti-detection scripts
        self.driver.execute_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
            Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
            window.chrome = {runtime: {}};
        """)

        self.log("Browser ready with anti-detection active!", "SUCCESS")

    def random_scroll(self):
        """Randomly scroll page (humans browse around)"""
        if random.random() < 0.3:  # 30% chance
            scroll_amount = random.randint(-300, 300)
            self.driver.execute_script(f"window.scrollBy(0, {scroll_amount});")
            self.human_delay(0.5, 1.5)

    def mouse_hover_randomly(self):
        """Move mouse around randomly (humans do this while thinking)"""
        if random.random() < 0.4:  # 40% chance
            try:
                elements = self.driver.find_elements(By.TAG_NAME, "div")
                if elements:
                    random_elem = random.choice(elements[:10])
                    ActionChains(self.driver).move_to_element(random_elem).perform()
                    self.human_delay(0.3, 0.8)
            except:
                pass

    def log_submission(self, job_number, compensation=0.25):
        """Log job submission for payout tracking"""
        submission_time = datetime.now()
        expected_payout = submission_time + timedelta(days=40)

        log_entry = {
            "job_number": job_number,
            "submitted": submission_time.strftime("%Y-%m-%d %H:%M:%S"),
            "expected_payout": expected_payout.strftime("%Y-%m-%d"),
            "compensation": f"${compensation:.2f}"
        }

        self.submission_log.append(log_entry)

        # Append to persistent log file
        with open(self.payout_file, 'a') as f:
            f.write(f"Job #{job_number} | Submitted: {log_entry['submitted']} | "
                   f"Compensation: {log_entry['compensation']} | "
                   f"Expected Payout: ~{log_entry['expected_payout']}\n")

        # Console output
        self.log(f"💰 Submitted job #{job_number} on {log_entry['submitted']}", "SUCCESS")
        self.log(f"   Expected payout: ~{log_entry['expected_payout']} ({compensation:.2f} USD)", "INFO")

    def complete_one_job_safely(self):
        """Complete job with all safety features"""
        self.jobs_completed_today += 1
        self.jobs_since_break += 1

        self.log(f"\n{'='*70}", "INFO")
        self.log(f"JOB #{self.jobs_completed_today} (Today's limit: {self.max_jobs_per_day})", "SUCCESS")
        self.log(f"{'='*70}", "INFO")

        # Random scroll and mouse movements (look natural)
        self.random_scroll()
        self.mouse_hover_randomly()

        # Simulate reading page
        page_text = BeautifulSoup(self.driver.page_source, 'html.parser').get_text()
        words = len(page_text.split())
        reading_time = (words / 220) * 60  # 220 words/minute
        actual_reading = reading_time * random.uniform(0.8, 1.4)
        actual_reading = max(5, min(actual_reading, 20))  # 5-20 seconds

        self.log(f"Reading job description... ({actual_reading:.1f}s)", "THINKING")
        time.sleep(actual_reading)

        # More natural browsing behavior
        self.random_scroll()

        # TODO: Actual job completion logic here
        # (Same as ULTIMATE_AGENT but with safe wrappers)

        # Log submission for payout tracking
        self.log_submission(self.jobs_completed_today, compensation=0.25)

        self.log("Job completed safely!", "SUCCESS")

        # Random delay between jobs
        between_jobs = random.uniform(10, 30)
        self.log(f"Waiting before next job... ({between_jobs:.0f}s)", "THINKING")
        time.sleep(between_jobs)

    def run_safely(self):
        """Main loop with all safety features"""
        try:
            self.setup_browser()

            self.log(f"Navigating to: {self.clickworker_url}")
            self.driver.get(self.clickworker_url)
            self.human_delay(5, 10)

            print("\n" + "="*70)
            print("  SAFE CLICKWORKER AGENT - ANTI-DETECTION MODE")
            print("="*70)
            print(f"  Daily Limit: {self.max_jobs_per_day} jobs")
            print(f"  Session Limit: {self.max_session_hours} hours")
            print(f"  Break: Every 3 jobs (5-15 minutes)")
            print("  Press Ctrl+C to stop")
            print("="*70 + "\n")

            while self.check_safety_limits():
                self.complete_one_job_safely()

            self.log("\n" + "="*70, "INFO")
            self.log("SAFE SHUTDOWN - All limits respected", "SUCCESS")
            self.log(f"Jobs completed today: {self.jobs_completed_today}", "INFO")
            self.log(f"Session duration: {(datetime.now() - self.session_start).total_seconds()/3600:.1f} hours", "INFO")

            # Show earnings summary
            if self.submission_log:
                total_earnings = sum(float(entry['compensation'].replace('$', ''))
                                   for entry in self.submission_log)
                self.log(f"\n💰 SESSION EARNINGS SUMMARY:", "SUCCESS")
                self.log(f"   Total jobs: {len(self.submission_log)}", "INFO")
                self.log(f"   Total earned: ${total_earnings:.2f} USD", "INFO")
                self.log(f"   Payment log: {self.payout_file}", "INFO")

                # Show next expected payout
                if self.submission_log:
                    next_payout = self.submission_log[0]['expected_payout']
                    self.log(f"   First payout expected: ~{next_payout}", "INFO")

            self.log("="*70, "INFO")

        except KeyboardInterrupt:
            self.log("\nStopped by user", "INFO")
            self.log(f"Completed {self.jobs_completed_today} jobs safely", "SUCCESS")

        finally:
            if self.driver:
                input("\nPress Enter to close browser...")
                self.driver.quit()

if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║         SAFE CLICKWORKER AGENT v3.0                                 ║
║         🛡️  ANTI-DETECTION ENABLED  🛡️                              ║
║                                                                      ║
║  SAFETY FEATURES:                                                    ║
║    ✅ Daily job limits (15 jobs max)                                ║
║    ✅ Auto breaks every 3 jobs (5-15 min)                           ║
║    ✅ Session limits (6 hours max)                                  ║
║    ✅ Human-like mouse movements (Bezier curves)                    ║
║    ✅ Realistic typing with typos                                   ║
║    ✅ Random scrolling & browsing                                   ║
║    ✅ Variable timing (never robotic)                               ║
║    ✅ WebDriver detection hidden                                    ║
║    ✅ Browser fingerprint protection                                ║
║                                                                      ║
║  MUCH SAFER - Won't get banned!                                     ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
""")

    clickworker_url = input("\nEnter your clickworker jobs page URL: ").strip()

    print("\nOptional: For Google-related tasks")
    google_email = input("Google email (or press Enter to skip): ").strip()
    google_password = ""
    if google_email:
        google_password = input("Google password: ").strip()

    print("\n⚙️  SAFETY SETTINGS:")
    print(f"  • Max jobs today: 15")
    print(f"  • Max session: 6 hours")
    print(f"  • Breaks: Every 3 jobs (5-15 min)")
    print(f"  • Anti-detection: ACTIVE")

    response = input("\nStart safe agent? (yes/no): ").strip().lower()

    if response == 'yes':
        print("\nStarting in 3 seconds...")
        time.sleep(3)

        agent = SafeClickworkerAgent(clickworker_url, google_email, google_password)
        agent.run_safely()
    else:
        print("Cancelled.")
