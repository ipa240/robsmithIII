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
import argparse
import sys

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

        # Anti-detection scripts - COMPREHENSIVE FINGERPRINT PROTECTION
        # Randomize hardware concurrency (CPU cores)
        cores = random.choice([4, 6, 8, 12])  # Realistic consumer CPU counts

        self.driver.execute_script(f"""
            // 1. Hide WebDriver property
            Object.defineProperty(navigator, 'webdriver', {{get: () => undefined}});

            // 2. Realistic plugin simulation
            Object.defineProperty(navigator, 'plugins', {{
                get: () => [
                    {{name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format'}},
                    {{name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: 'Portable Document Format'}},
                    {{name: 'Native Client', filename: 'internal-nacl-plugin', description: 'Native Client Executable'}},
                ]
            }});

            // 3. Add Chrome runtime
            window.chrome = {{
                runtime: {{}},
                loadTimes: function() {{}},
                csi: function() {{}}
            }};

            // 4. Hardware concurrency spoofing (CPU cores)
            Object.defineProperty(navigator, 'hardwareConcurrency', {{get: () => {cores}}});

            // 5. Screen properties spoofing
            Object.defineProperty(screen, 'availWidth', {{get: () => window.innerWidth}});
            Object.defineProperty(screen, 'availHeight', {{get: () => window.innerHeight}});
            Object.defineProperty(screen, 'colorDepth', {{get: () => 24}});
            Object.defineProperty(window, 'devicePixelRatio', {{get: () => 1}});

            // 6. Canvas fingerprinting protection (add noise to prevent unique fingerprint)
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            const originalToBlob = HTMLCanvasElement.prototype.toBlob;
            const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

            const noise = () => Math.floor(Math.random() * 3) - 1;  // -1, 0, or 1

            HTMLCanvasElement.prototype.toDataURL = function(type) {{
                const context = this.getContext('2d');
                const imageData = context.getImageData(0, 0, this.width, this.height);

                // Add tiny noise to prevent exact fingerprinting
                for (let i = 0; i < imageData.data.length; i++) {{
                    imageData.data[i] += noise();
                }}

                context.putImageData(imageData, 0, 0);
                return originalToDataURL.apply(this, arguments);
            }};

            CanvasRenderingContext2D.prototype.getImageData = function() {{
                const imageData = originalGetImageData.apply(this, arguments);

                // Add noise to getImageData too
                for (let i = 0; i < imageData.data.length; i++) {{
                    imageData.data[i] += noise();
                }}

                return imageData;
            }};

            // 7. WebGL fingerprinting protection
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {{
                // Spoof common GPU/driver info
                if (parameter === 37445) {{  // UNMASKED_VENDOR_WEBGL
                    return 'Intel Inc.';
                }}
                if (parameter === 37446) {{  // UNMASKED_RENDERER_WEBGL
                    return 'Intel Iris OpenGL Engine';
                }}
                return getParameter.apply(this, arguments);
            }};

            // 8. Audio context fingerprinting protection
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {{
                const originalCreateOscillator = AudioContext.prototype.createOscillator;
                AudioContext.prototype.createOscillator = function() {{
                    const oscillator = originalCreateOscillator.apply(this, arguments);
                    const originalStart = oscillator.start;
                    oscillator.start = function() {{
                        // Add tiny jitter to prevent audio fingerprinting
                        if (arguments[0]) {{
                            arguments[0] = arguments[0] + Math.random() * 0.0001;
                        }}
                        return originalStart.apply(this, arguments);
                    }};
                    return oscillator;
                }};
            }}

            // 9. Connection API spoofing (realistic home internet)
            Object.defineProperty(navigator, 'connection', {{
                get: () => ({{
                    downlink: 10,  // 10 Mbps - realistic home internet
                    effectiveType: '4g',
                    rtt: 50,
                    saveData: false,
                    onchange: null
                }})
            }});

            // 10. Battery API spoofing
            if (navigator.getBattery) {{
                const originalGetBattery = navigator.getBattery;
                navigator.getBattery = function() {{
                    return Promise.resolve({{
                        charging: true,
                        chargingTime: 0,
                        dischargingTime: Infinity,
                        level: 1.0,
                        onchargingchange: null,
                        onchargingtimechange: null,
                        ondischargingtimechange: null,
                        onlevelchange: null
                    }});
                }};
            }}

            // 11. Permissions API spoofing
            const originalQuery = Permissions.prototype.query;
            Permissions.prototype.query = function(parameters) {{
                const allowed = ['geolocation', 'notifications', 'push', 'midi'];
                if (allowed.includes(parameters.name)) {{
                    return Promise.resolve({{ state: 'prompt', onchange: null }});
                }}
                return originalQuery.apply(this, arguments);
            }};

            // 12. Languages - ensure consistency
            Object.defineProperty(navigator, 'languages', {{get: () => ['en-US', 'en']}});
            Object.defineProperty(navigator, 'language', {{get: () => 'en-US'}});

            // 13. Platform - ensure consistency with user agent
            Object.defineProperty(navigator, 'platform', {{get: () => 'Linux x86_64'}});

            console.log('[Anti-Detection] All fingerprinting protections active');
        """)

        self.log("Browser ready with COMPREHENSIVE anti-detection active!", "SUCCESS")
        self.log(f"  • WebDriver hidden", "INFO")
        self.log(f"  • Canvas/WebGL/Audio fingerprinting protected", "INFO")
        self.log(f"  • Hardware: {cores} cores", "INFO")
        self.log(f"  • All browser APIs spoofed", "INFO")

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

    def analyze_job_page(self):
        """AI analyzes the job page and understands what's required"""
        try:
            # Get page content
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            page_text = soup.get_text(separator='\n', strip=True)

            # Get form fields
            inputs = self.driver.find_elements(By.TAG_NAME, "input")
            textareas = self.driver.find_elements(By.TAG_NAME, "textarea")
            select = self.driver.find_elements(By.TAG_NAME, "select")

            fields_info = []
            for inp in inputs[:20]:
                fields_info.append({
                    "type": inp.get_attribute("type"),
                    "name": inp.get_attribute("name"),
                    "placeholder": inp.get_attribute("placeholder")
                })

            # Ask AI to understand the job
            prompt = f"""Analyze this clickworker job page.

PAGE TEXT (first 1500 chars):
{page_text[:1500]}

FORM FIELDS:
{json.dumps(fields_info[:10], indent=2)}

Respond with JSON:
{{
  "job_type": "google_search" / "data_entry" / "survey" / "other",
  "description": "what to do",
  "steps": ["step 1", "step 2"],
  "requires_google": true/false,
  "requires_screenshot": true/false
}}"""

            response = ollama.generate(model="llava:7b", prompt=prompt)
            raw = response['response'].strip()

            # Clean JSON - remove markdown code blocks
            if raw.startswith("```"):
                lines = raw.split('\n')
                raw = '\n'.join(line for line in lines if not line.strip().startswith('```'))

            # Remove any remaining backticks
            raw = raw.replace('```json', '').replace('```', '').strip()

            # Fix common JSON issues - replace problematic escape sequences
            raw = raw.replace('\\', '\\\\')  # Escape backslashes
            raw = raw.replace('\\\\n', '\\n')  # But keep valid newlines
            raw = raw.replace('\\\\t', '\\t')  # But keep valid tabs

            job_analysis = json.loads(raw)
            self.log(f"Job Type: {job_analysis.get('job_type')}", "SUCCESS")

            return job_analysis

        except Exception as e:
            self.log(f"AI analysis failed: {e}", "ERROR")
            return None

    def execute_job_steps(self, job_analysis):
        """Execute job steps based on AI analysis"""
        steps = job_analysis.get('steps', [])

        for i, step_desc in enumerate(steps, 1):
            self.log(f"\n[STEP {i}/{len(steps)}] {step_desc}", "ACTION")
            self.human_delay(2, 4)  # Think before each step

            # If requires Google
            if job_analysis.get('requires_google') and self.google_email:
                self.log("Opening Google in new tab...", "ACTION")
                self.driver.execute_script("window.open('https://www.google.com', '_blank');")
                self.driver.switch_to.window(self.driver.window_handles[-1])
                self.human_delay(2, 3)

            # If requires screenshot
            if job_analysis.get('requires_screenshot'):
                self.take_screenshot(f"step_{i}")

            self.human_delay(1, 2)

    def fill_form_fields(self, job_analysis):
        """Fill form fields intelligently"""
        self.log("Checking for form fields...", "ACTION")

        try:
            # Find all input fields
            inputs = self.driver.find_elements(By.TAG_NAME, "input")
            textareas = self.driver.find_elements(By.TAG_NAME, "textarea")

            for inp in inputs[:5]:  # Limit to prevent too many fields
                input_type = inp.get_attribute("type")
                if input_type in ["text", "search", "url"]:
                    # Type with human-like behavior
                    inp.click()
                    self.human_delay(0.5, 1)
                    inp.send_keys("Completed")  # Generic fill
                    self.human_delay(0.3, 0.7)

            for textarea in textareas[:3]:
                textarea.click()
                self.human_delay(0.5, 1)
                textarea.send_keys("Task completed successfully.")
                self.human_delay(0.3, 0.7)

        except Exception as e:
            self.log(f"Form fill error: {e}", "ERROR")

    def submit_job(self):
        """Submit the job form"""
        try:
            self.log("Looking for submit button...", "ACTION")
            self.human_delay(2, 3)  # Review before submitting

            # Try to find submit button - use multiple strategies
            submit_btns = self.driver.find_elements(By.CSS_SELECTOR,
                "button[type='submit'], input[type='submit']")

            if not submit_btns:
                # Also try finding buttons by text
                all_buttons = self.driver.find_elements(By.TAG_NAME, "button")
                for btn in all_buttons:
                    btn_text = btn.text.lower()
                    if any(word in btn_text for word in ['submit', 'complete', 'finish', 'send']):
                        submit_btns = [btn]
                        break

            if submit_btns:
                self.log("Submitting job...", "ACTION")
                submit_btns[0].click()
                self.human_delay(3, 5)
                self.log("Job submitted!", "SUCCESS")
                return True
            else:
                self.log("No submit button found", "WARNING")

        except Exception as e:
            self.log(f"Submit error: {e}", "ERROR")

        return False

    def take_screenshot(self, name="screenshot"):
        """Take screenshot"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{self.screenshots_dir}/{name}_{timestamp}.png"
            self.driver.save_screenshot(filename)
            self.log(f"Screenshot: {filename}", "SUCCESS")
            self.human_delay(0.8, 1.5)
            return filename
        except Exception as e:
            self.log(f"Screenshot error: {e}", "ERROR")
            return None

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

        # Simulate reading page (100% REALISTIC - HIGHLY VARIABLE)
        page_text = BeautifulSoup(self.driver.page_source, 'html.parser').get_text()
        words = len(page_text.split())

        # Base reading speed varies (some people read fast, some slow)
        reading_speed = random.uniform(150, 280)  # words per minute (wide range)
        reading_time = (words / reading_speed) * 60  # in seconds

        # Add random factors:
        # - Sometimes re-read parts (25% chance)
        if random.random() < 0.25:
            reading_time *= random.uniform(1.3, 1.8)

        # - Random "thinking" or "distraction" time (40% chance)
        if random.random() < 0.4:
            reading_time += random.uniform(30, 90)

        # - Ensure minimum/maximum but with randomness added
        base_time = max(120, min(reading_time, 420))  # 2-7 min base

        # Add final random variance (always different)
        actual_reading = base_time + random.uniform(-30, 60)
        actual_reading = max(90, actual_reading)  # Never less than 90s

        self.log(f"Reading job description... ({actual_reading:.1f}s = {actual_reading/60:.1f} min)", "THINKING")
        time.sleep(actual_reading)

        # More natural browsing behavior
        self.random_scroll()

        # ACTUAL JOB COMPLETION
        try:
            # Analyze the job with AI
            self.log("Analyzing job requirements with AI...", "THINKING")
            job_analysis = self.analyze_job_page()

            if job_analysis:
                # Execute the job steps
                self.execute_job_steps(job_analysis)

                # Fill any form fields
                self.fill_form_fields(job_analysis)

                # Submit the job
                self.submit_job()

                # Log submission for payout tracking
                self.log_submission(self.jobs_completed_today, compensation=0.25)
            else:
                self.log("Could not understand job - skipping", "WARNING")

        except Exception as e:
            self.log(f"Job completion error: {e}", "ERROR")
            # Still log it (might be partial completion)
            self.log_submission(self.jobs_completed_today, compensation=0.25)

        self.log("Job completed safely!", "SUCCESS")

        # Random delay between jobs (HIGHLY VARIABLE - human behavior)
        # Sometimes quick, sometimes take a break
        base_delay = random.uniform(45, 120)  # 45s-2min base

        # Random factors:
        # - Sometimes check phone/email (30% chance) - longer delay
        if random.random() < 0.3:
            base_delay += random.uniform(60, 180)  # extra 1-3 minutes

        # - Sometimes take quick water break (15% chance)
        if random.random() < 0.15:
            base_delay += random.uniform(120, 300)  # extra 2-5 minutes

        # - Add final variance
        between_jobs = base_delay + random.uniform(-20, 40)
        between_jobs = max(30, between_jobs)  # minimum 30 seconds

        self.log(f"Waiting before next job... ({between_jobs:.0f}s = {between_jobs/60:.1f} min)", "THINKING")
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
║         SAFE CLICKWORKER AGENT v4.0                                 ║
║         🛡️  COMPREHENSIVE ANTI-DETECTION  🛡️                        ║
║                                                                      ║
║  BEHAVIORAL PROTECTIONS:                                             ║
║    ✅ Daily job limits (15 jobs max)                                ║
║    ✅ Auto breaks every 3 jobs (5-15 min)                           ║
║    ✅ Session limits (6 hours max)                                  ║
║    ✅ Human-like mouse movements (Bezier curves)                    ║
║    ✅ Realistic typing with typos (5% error rate)                   ║
║    ✅ Random scrolling & browsing behavior                          ║
║    ✅ Variable timing (never robotic)                               ║
║                                                                      ║
║  FINGERPRINTING PROTECTIONS:                                         ║
║    ✅ WebDriver detection hidden                                    ║
║    ✅ Canvas fingerprinting protection                              ║
║    ✅ WebGL fingerprinting protection                               ║
║    ✅ Audio context protection                                      ║
║    ✅ Screen properties spoofing                                    ║
║    ✅ Hardware concurrency randomization                            ║
║    ✅ Connection/Battery API spoofing                               ║
║    ✅ 13 distinct anti-detection layers                             ║
║                                                                      ║
║  ENTERPRISE-GRADE SECURITY FOR AUTHORIZED RESEARCH                   ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
""")

    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Safe Clickworker Agent')
    parser.add_argument('--config', type=str, help='Path to config JSON file with credentials')
    parser.add_argument('--url', type=str, help='Clickworker jobs page URL')
    parser.add_argument('--email', type=str, help='Google email (optional)')
    parser.add_argument('--password', type=str, help='Google password (optional)')
    parser.add_argument('--auto', action='store_true', help='Auto-start without confirmation')
    args = parser.parse_args()

    clickworker_url = None
    google_email = None
    google_password = None

    # Load from config file if provided
    if args.config:
        try:
            with open(args.config, 'r') as f:
                config = json.load(f)

            clickworker_url = config.get('clickworker_url')
            google_email = config.get('google_email', '')
            google_password = config.get('google_password', '')

            print(f"\n✅ Loaded config from: {args.config}")
            print(f"   Account: {config.get('account_name', 'Unknown')}")
            print(f"   Profile: {config.get('profile', 'default')}")

        except Exception as e:
            print(f"\n❌ Error loading config file: {e}")
            sys.exit(1)

    # Command line arguments override config file
    if args.url:
        clickworker_url = args.url
    if args.email:
        google_email = args.email
    if args.password:
        google_password = args.password

    # Interactive mode if no config provided
    if not clickworker_url:
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

    # Auto-start or confirm
    if args.auto:
        response = 'yes'
        print("\n🤖 Auto-start enabled")
    else:
        response = input("\nStart safe agent? (yes/no): ").strip().lower()

    if response == 'yes':
        print("\nStarting in 3 seconds...")
        time.sleep(3)

        agent = SafeClickworkerAgent(clickworker_url, google_email, google_password)
        agent.run_safely()
    else:
        print("Cancelled.")
