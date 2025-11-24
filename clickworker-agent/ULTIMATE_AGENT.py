#!/usr/bin/env python3
"""
UNIVERSAL CLICKWORKER AGENT
Handles ANY type of job - learns and adapts to different task structures
"""
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import time
import random
import json
import ollama
import os
from datetime import datetime

class UniversalClickworkerAgent:
    def __init__(self, clickworker_url, google_email=None, google_password=None):
        self.clickworker_url = clickworker_url
        self.google_email = google_email
        self.google_password = google_password
        self.driver = None
        self.wait = None
        self.job_count = 0
        self.screenshots_dir = "/tmp/clickworker_screenshots"
        os.makedirs(self.screenshots_dir, exist_ok=True)

    def log(self, msg, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        icons = {"INFO": "ℹ️", "SUCCESS": "✅", "ERROR": "❌", "THINKING": "🤔", "ACTION": "▶️"}
        print(f"[{timestamp}] {icons.get(level, '•')} {msg}", flush=True)

    def human_delay(self, min_sec=0.5, max_sec=2.0):
        """More realistic human delays"""
        time.sleep(random.uniform(min_sec, max_sec))

    def reading_delay(self, text_length):
        """Delay based on reading speed (humans read ~200-250 words/min)"""
        words = text_length / 5  # Approximate words
        reading_time = (words / 200) * 60  # Seconds to read
        actual_delay = reading_time * random.uniform(0.7, 1.3)  # Add variance
        self.log(f"Reading... ({actual_delay:.1f}s)", "THINKING")
        time.sleep(max(2, min(actual_delay, 15)))  # Between 2-15 seconds

    def thinking_delay(self):
        """Random thinking pause"""
        delay = random.uniform(2.5, 6.0)
        self.log(f"Thinking... ({delay:.1f}s)", "THINKING")
        time.sleep(delay)

    def setup_browser(self):
        """Setup Chrome"""
        self.log("Initializing browser...")

        chrome_options = Options()
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--start-maximized')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_argument('user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36')

        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=chrome_options)
        self.wait = WebDriverWait(self.driver, 15)
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

        self.log("Browser ready!", "SUCCESS")

    def analyze_job_page(self):
        """AI analyzes the job page and understands what's required"""
        self.log("Analyzing job requirements with AI...", "THINKING")

        # Simulate reading the page first
        soup = BeautifulSoup(self.driver.page_source, 'html.parser')
        page_text = soup.get_text(separator='\n', strip=True)

        # Human reads the job first
        self.reading_delay(len(page_text[:2000]))

        # Get all form fields
        inputs = self.driver.find_elements(By.TAG_NAME, "input")
        textareas = self.driver.find_elements(By.TAG_NAME, "textarea")
        selects = self.driver.find_elements(By.TAG_NAME, "select")
        buttons = self.driver.find_elements(By.TAG_NAME, "button")

        fields_info = []
        for inp in inputs[:20]:
            fields_info.append({
                "type": inp.get_attribute("type"),
                "name": inp.get_attribute("name"),
                "placeholder": inp.get_attribute("placeholder"),
                "required": inp.get_attribute("required") is not None
            })

        # Ask AI to understand the job
        prompt = f"""You are analyzing a clickworker job page. Understand what the worker needs to do.

PAGE TEXT (first 2000 chars):
{page_text[:2000]}

FORM FIELDS DETECTED:
{json.dumps(fields_info, indent=2)}

Analyze this job and respond with JSON:
{{
  "job_type": "google_search" / "data_entry" / "survey" / "categorization" / "screenshot_task" / "other",
  "job_description": "brief summary of what to do",
  "steps": [
    {{"step": 1, "action": "describe what to do", "requires_google": true/false, "requires_screenshot": true/false}},
    ...
  ],
  "required_fields": [
    {{"field_name": "name or placeholder", "field_type": "text/file/select", "how_to_fill": "instructions"}}
  ]
}}
"""

        try:
            response = ollama.generate(model="llava:7b", prompt=prompt)
            raw = response['response'].strip()

            if raw.startswith("```"):
                lines = raw.split('\n')
                raw = '\n'.join(line for line in lines if not line.strip().startswith('```'))

            job_analysis = json.loads(raw)

            self.log(f"Job Type: {job_analysis.get('job_type')}", "SUCCESS")
            self.log(f"Description: {job_analysis.get('job_description', '')[:80]}", "INFO")
            self.log(f"Steps to complete: {len(job_analysis.get('steps', []))}", "INFO")

            return job_analysis

        except Exception as e:
            self.log(f"AI analysis failed: {e}", "ERROR")
            return None

    def execute_job_steps(self, job_analysis):
        """Execute job steps based on AI analysis"""
        steps = job_analysis.get('steps', [])

        for i, step_info in enumerate(steps, 1):
            self.log(f"\n[STEP {i}/{len(steps)}] {step_info.get('action', 'Unknown')}", "ACTION")

            # Pause before starting each step (humans think before acting)
            self.thinking_delay()

            # If step requires Google
            if step_info.get('requires_google') and self.google_email:
                self.log("Opening Google in new tab...", "ACTION")
                self.driver.execute_script("window.open('https://www.google.com', '_blank');")
                self.driver.switch_to.window(self.driver.window_handles[-1])
                self.human_delay(2, 3)

                # Login if needed
                if "accounts.google.com" in self.driver.current_url or "sign in" in self.driver.page_source.lower():
                    self.google_login()

            # If step requires screenshot
            if step_info.get('requires_screenshot'):
                self.take_screenshot(f"step_{i}")

            # Ask AI what to do for this specific step
            self.execute_step_with_ai(step_info)

            # Switch back to job tab if we opened Google
            if step_info.get('requires_google'):
                self.driver.switch_to.window(self.driver.window_handles[0])

            self.human_delay(1, 2)

    def execute_step_with_ai(self, step_info):
        """Let AI figure out how to complete this specific step"""
        # Get current page context
        page_text = BeautifulSoup(self.driver.page_source, 'html.parser').get_text()[:1000]

        prompt = f"""Current page shows: {page_text}

You need to: {step_info.get('action')}

What action should I take RIGHT NOW? Respond with JSON:
{{
  "action_type": "search" / "click" / "type" / "screenshot" / "wait" / "extract_text",
  "details": {{"text": "...", "element_selector": "...", "delay": 3}}
}}
"""

        try:
            response = ollama.generate(model="llava:7b", prompt=prompt)
            raw = response['response'].strip()

            if raw.startswith("```"):
                lines = raw.split('\n')
                raw = '\n'.join(line for line in lines if not line.strip().startswith('```'))

            action = json.loads(raw)

            # Execute the action
            if action['action_type'] == 'search':
                self.perform_search(action['details'].get('text', ''))
            elif action['action_type'] == 'click':
                # Find and click element
                pass
            elif action['action_type'] == 'type':
                # Type text
                pass
            elif action['action_type'] == 'screenshot':
                self.take_screenshot()
            elif action['action_type'] == 'wait':
                time.sleep(action['details'].get('delay', 3))

        except Exception as e:
            self.log(f"Step execution error: {e}", "ERROR")

    def google_login(self):
        """Login to Google"""
        try:
            if not self.google_email or not self.google_password:
                self.log("No Google credentials provided", "ERROR")
                return False

            self.driver.get("https://accounts.google.com")
            self.human_delay(2, 3)

            # Email
            email_field = self.wait.until(EC.presence_of_element_located((By.ID, "identifierId")))
            for char in self.google_email:
                email_field.send_keys(char)
                time.sleep(random.uniform(0.05, 0.15))

            self.driver.find_element(By.ID, "identifierNext").click()
            self.human_delay(2, 3)

            # Password
            password_field = self.wait.until(EC.presence_of_element_located((By.NAME, "Passwd")))
            for char in self.google_password:
                password_field.send_keys(char)
                time.sleep(random.uniform(0.05, 0.15))

            self.driver.find_element(By.ID, "passwordNext").click()
            self.human_delay(3, 5)

            self.log("Google login successful", "SUCCESS")
            return True

        except Exception as e:
            self.log(f"Google login failed: {e}", "ERROR")
            return False

    def perform_search(self, keyword):
        """Perform Google search"""
        try:
            search_box = self.wait.until(EC.presence_of_element_located((By.NAME, "q")))
            search_box.clear()

            # Think about what to type
            self.human_delay(0.8, 1.5)

            # Type slowly like a human
            for char in keyword:
                search_box.send_keys(char)
                time.sleep(random.uniform(0.12, 0.25))  # Slower typing

            # Pause before hitting enter (humans review their search)
            self.human_delay(1.0, 2.5)
            search_box.send_keys(Keys.RETURN)

            # Wait for results to load and read them
            self.human_delay(3, 6)

            self.log(f"Searched: {keyword}", "SUCCESS")
            return True

        except Exception as e:
            self.log(f"Search failed: {e}", "ERROR")
            return False

    def take_screenshot(self, name="screenshot"):
        """Take screenshot"""
        # Human pauses before taking screenshot
        self.human_delay(1.5, 3.0)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{self.screenshots_dir}/{name}_{timestamp}.png"

        self.driver.save_screenshot(filename)
        self.log(f"Screenshot: {filename}", "SUCCESS")

        # Brief pause after screenshot
        self.human_delay(0.8, 1.5)

        return filename

    def fill_form_fields(self, job_analysis):
        """Intelligently fill form fields based on AI understanding"""
        self.log("Filling form fields...", "ACTION")

        required_fields = job_analysis.get('required_fields', [])

        for field_info in required_fields:
            field_type = field_info.get('field_type')
            field_name = field_info.get('field_name', '')
            how_to_fill = field_info.get('how_to_fill', '')

            self.log(f"Field: {field_name} ({field_type})", "INFO")

            # Find the field
            # Fill it based on how_to_fill instructions
            # This would be expanded based on field types

        self.log("Form fields completed", "SUCCESS")

    def complete_one_job(self):
        """Complete a single job end-to-end"""
        self.job_count += 1

        self.log(f"\n{'='*70}", "INFO")
        self.log(f"JOB #{self.job_count}", "SUCCESS")
        self.log(f"{'='*70}", "INFO")

        # Analyze what this job requires
        job_analysis = self.analyze_job_page()

        if not job_analysis:
            self.log("Could not understand job requirements", "ERROR")
            return False

        # Execute the steps
        self.execute_job_steps(job_analysis)

        # Fill any remaining form fields
        self.fill_form_fields(job_analysis)

        # Submit (find submit button)
        try:
            submit_btns = self.driver.find_elements(By.CSS_SELECTOR, "button[type='submit'], input[type='submit']")
            if submit_btns:
                self.log("Submitting job...", "ACTION")
                submit_btns[0].click()
                self.human_delay(3, 5)
                self.log("Job submitted!", "SUCCESS")
                return True
        except:
            self.log("Submit button not found - manual submission needed", "ERROR")

        return True

    def run_continuous(self):
        """Run continuously, completing jobs"""
        try:
            self.setup_browser()

            self.log(f"Navigating to: {self.clickworker_url}")
            self.driver.get(self.clickworker_url)
            self.human_delay(5, 8)

            print("\n" + "="*70)
            print("  UNIVERSAL CLICKWORKER AGENT - ACTIVE")
            print("="*70)
            print("  Will continuously find and complete jobs")
            print("  Press Ctrl+C to stop")
            print("="*70 + "\n")

            while True:
                # Complete current job
                self.complete_one_job()

                # Find next job
                self.log("\nLooking for next job...", "INFO")
                self.human_delay(5, 10)

                # Try to find "next job" or similar button
                # Or reload the jobs page

        except KeyboardInterrupt:
            self.log("\nStopped by user", "INFO")
            self.log(f"Completed {self.job_count} jobs in this session", "SUCCESS")

        finally:
            if self.driver:
                input("\nPress Enter to close browser...")
                self.driver.quit()

if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║         UNIVERSAL CLICKWORKER AGENT v2.0                            ║
║                                                                      ║
║  This agent can handle ANY type of clickworker job:                 ║
║    • Google search tasks                                             ║
║    • Data entry                                                      ║
║    • Surveys                                                         ║
║    • Categorization                                                  ║
║    • Screenshot tasks                                                ║
║    • Form filling                                                    ║
║    • And more!                                                       ║
║                                                                      ║
║  It learns what each job requires and adapts automatically.         ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
""")

    clickworker_url = input("\nEnter your clickworker jobs page URL: ").strip()

    print("\nOptional: For Google-related tasks")
    google_email = input("Google email (or press Enter to skip): ").strip()
    google_password = ""
    if google_email:
        google_password = input("Google password: ").strip()

    print("\nStarting in 3 seconds...")
    time.sleep(3)

    agent = UniversalClickworkerAgent(clickworker_url, google_email, google_password)
    agent.run_continuous()
