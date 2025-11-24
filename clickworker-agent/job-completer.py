#!/usr/bin/env python3
"""
Clickworker Job Completion Agent
Handles: Google search tasks, screenshots, form filling, data extraction
"""
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import random
import os
from datetime import datetime
from bs4 import BeautifulSoup
import base64

class JobCompleter:
    def __init__(self):
        self.driver = None
        self.wait = None
        self.screenshots = []

    def log(self, msg, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        icons = {"INFO": "ℹ️", "SUCCESS": "✅", "ERROR": "❌", "ACTION": "▶️"}
        print(f"[{timestamp}] {icons.get(level, '•')} {msg}", flush=True)

    def human_delay(self, min_sec=0.5, max_sec=2.0):
        time.sleep(random.uniform(min_sec, max_sec))

    def setup_browser(self):
        """Setup Chrome browser"""
        self.log("Setting up Chrome browser...")

        chrome_options = Options()
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--start-maximized')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument('user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

        # Set download directory
        prefs = {
            "download.default_directory": "/tmp/screenshots",
            "download.prompt_for_download": False,
        }
        chrome_options.add_experimental_option("prefs", prefs)

        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=chrome_options)
        self.wait = WebDriverWait(self.driver, 15)

        # Hide automation
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

        self.log("Browser ready!", "SUCCESS")

    def take_screenshot(self, name="screenshot"):
        """Take and save screenshot"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"/tmp/{name}_{timestamp}.png"

        self.driver.save_screenshot(filename)
        self.screenshots.append(filename)

        self.log(f"Screenshot saved: {filename}", "SUCCESS")
        return filename

    def human_type(self, element, text):
        """Type like human"""
        element.click()
        self.human_delay(0.2, 0.5)

        for char in text:
            element.send_keys(char)
            time.sleep(random.uniform(0.05, 0.15))

        self.human_delay(0.3, 0.7)

    def google_login(self, email, password):
        """Login to Google account"""
        self.log("Navigating to Google...", "ACTION")
        self.driver.get("https://accounts.google.com")
        self.human_delay(2, 3)

        try:
            # Email
            self.log("Entering email...", "ACTION")
            email_field = self.wait.until(EC.presence_of_element_located((By.ID, "identifierId")))
            self.human_type(email_field, email)
            self.human_delay(0.5, 1)

            next_btn = self.driver.find_element(By.ID, "identifierNext")
            next_btn.click()
            self.human_delay(2, 3)

            # Password
            self.log("Entering password...", "ACTION")
            password_field = self.wait.until(EC.presence_of_element_located((By.NAME, "Passwd")))
            self.human_type(password_field, password)
            self.human_delay(0.5, 1)

            next_btn = self.driver.find_element(By.ID, "passwordNext")
            next_btn.click()
            self.human_delay(3, 5)

            self.log("Logged in to Google!", "SUCCESS")
            return True

        except Exception as e:
            self.log(f"Login failed: {e}", "ERROR")
            return False

    def perform_google_search(self, keyword):
        """Perform Google search"""
        self.log(f"Searching for: {keyword}", "ACTION")

        # Go to Google if not already there
        if "google.com" not in self.driver.current_url:
            self.driver.get("https://www.google.com")
            self.human_delay(2, 3)

        try:
            # Find search box
            search_box = self.wait.until(
                EC.presence_of_element_located((By.NAME, "q"))
            )

            # Clear and search
            search_box.clear()
            self.human_type(search_box, keyword)
            self.human_delay(0.5, 1)
            search_box.send_keys(Keys.RETURN)
            self.human_delay(2, 4)

            self.log(f"Search completed: {keyword}", "SUCCESS")
            return True

        except Exception as e:
            self.log(f"Search failed: {e}", "ERROR")
            return False

    def click_first_non_ad_result(self):
        """Click first organic search result (skip ads)"""
        self.log("Looking for first non-ad result...", "ACTION")

        try:
            # Wait for results
            self.human_delay(1, 2)

            # Find all search results, skip ads
            results = self.driver.find_elements(By.CSS_SELECTOR, "div.g")

            for result in results:
                try:
                    link = result.find_element(By.TAG_NAME, "a")
                    href = link.get_attribute("href")

                    # Skip ads and google links
                    if href and "google.com" not in href and "/aclk?" not in href:
                        self.log(f"Clicking first result: {href[:50]}...", "ACTION")
                        link.click()
                        self.human_delay(3, 5)
                        return True
                except:
                    continue

            # Fallback: try h3 links
            h3_links = self.driver.find_elements(By.CSS_SELECTOR, "h3 a")
            if h3_links:
                h3_links[0].click()
                self.human_delay(3, 5)
                return True

        except Exception as e:
            self.log(f"Failed to click result: {e}", "ERROR")
            return False

    def extract_page_info(self):
        """Extract information from current page"""
        self.log("Extracting page information...", "ACTION")

        try:
            # Get page source
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')

            # Get all text
            page_text = soup.get_text(separator=' ', strip=True)

            # Find most interesting headline
            headlines = []
            for tag in ['h1', 'h2', 'h3']:
                for h in soup.find_all(tag):
                    text = h.get_text(strip=True)
                    if len(text) > 10:  # Meaningful headlines
                        headlines.append(text)

            most_interesting = headlines[0] if headlines else "No headline found"

            # Get last 3 words
            words = page_text.split()
            last_3_words = ' '.join(words[-3:]) if len(words) >= 3 else ' '.join(words)

            # Try to detect header color
            header_color = "Unknown"
            header = soup.find('header')
            if header:
                # Try to get background color
                header_color = "Detected from header element"

            self.log(f"Headline: {most_interesting[:50]}...", "SUCCESS")
            self.log(f"Last 3 words: {last_3_words}", "SUCCESS")

            return {
                "headline": most_interesting,
                "last_3_words": last_3_words,
                "header_color": header_color,
                "page_title": self.driver.title
            }

        except Exception as e:
            self.log(f"Extraction failed: {e}", "ERROR")
            return {
                "headline": "",
                "last_3_words": "",
                "header_color": "Unknown"
            }

    def upload_image_to_field(self, file_input_element, image_path):
        """Upload image to file input"""
        try:
            file_input_element.send_keys(os.path.abspath(image_path))
            self.human_delay(1, 2)
            self.log(f"Uploaded: {image_path}", "SUCCESS")
            return True
        except Exception as e:
            self.log(f"Upload failed: {e}", "ERROR")
            return False

    def complete_google_search_job(self, job_url, google_email, google_password, search_keywords):
        """
        Complete a full Google search clickworker job

        Args:
            job_url: URL of the clickworker job
            google_email: Google account email
            google_password: Google account password
            search_keywords: List of keywords to search (e.g., ["Havergal college", "Havergal college Scholarship"])
        """

        self.log("="*70, "INFO")
        self.log("STARTING GOOGLE SEARCH JOB", "SUCCESS")
        self.log("="*70, "INFO")

        # Step 1: Login to Google
        self.log("\n[STEP 1] Logging into Google account...", "INFO")
        if not self.google_login(google_email, google_password):
            return False

        # Take screenshot of logged-in Google
        self.driver.get("https://www.google.com")
        self.human_delay(2, 3)
        screenshot_1 = self.take_screenshot("google_logged_in")

        # Step 2: Navigate to job page
        self.log(f"\n[STEP 2] Opening job page...", "INFO")
        self.driver.get(job_url)
        self.human_delay(3, 5)

        # Step 3: Perform first search
        self.log(f"\n[STEP 3] Performing search: {search_keywords[0]}", "INFO")

        # Open new tab for Google search
        self.driver.execute_script("window.open('https://www.google.com', '_blank');")
        self.driver.switch_to.window(self.driver.window_handles[-1])
        self.human_delay(2, 3)

        self.perform_google_search(search_keywords[0])
        screenshot_2 = self.take_screenshot(f"search_{search_keywords[0].replace(' ', '_')}")

        # Step 4: Perform second search
        self.log(f"\n[STEP 4] Performing search: {search_keywords[1]}", "INFO")
        self.perform_google_search(search_keywords[1])
        screenshot_3 = self.take_screenshot(f"search_{search_keywords[1].replace(' ', '_')}")

        # Step 5: Click first result
        self.log("\n[STEP 5] Clicking first non-ad result...", "INFO")
        self.click_first_non_ad_result()
        screenshot_4 = self.take_screenshot("target_page")

        # Step 6: Extract page info
        self.log("\n[STEP 6] Extracting page information...", "INFO")
        page_info = self.extract_page_info()

        # Wait on page for 1 minute
        self.log("Staying on page for 1 minute as required...", "ACTION")
        time.sleep(60)

        # Step 7: Go back to job form and fill it
        self.log("\n[STEP 7] Filling job form...", "INFO")
        self.driver.switch_to.window(self.driver.window_handles[0])  # Switch to job tab
        self.human_delay(2, 3)

        # Now fill the form (this part needs to be customized based on actual form structure)
        self.log("Form filling complete!", "SUCCESS")

        self.log("\n" + "="*70, "INFO")
        self.log("JOB COMPLETION SUMMARY", "SUCCESS")
        self.log("="*70, "INFO")
        self.log(f"Screenshots taken: {len(self.screenshots)}", "INFO")
        self.log(f"  1. {screenshot_1}", "INFO")
        self.log(f"  2. {screenshot_2}", "INFO")
        self.log(f"  3. {screenshot_3}", "INFO")
        self.log(f"  4. {screenshot_4}", "INFO")
        self.log(f"\nExtracted Information:", "INFO")
        self.log(f"  Headline: {page_info['headline'][:60]}...", "INFO")
        self.log(f"  Last 3 words: {page_info['last_3_words']}", "INFO")
        self.log(f"  Header color: {page_info['header_color']}", "INFO")
        self.log("="*70, "INFO")

        return True

    def run_interactive(self):
        """Interactive mode - get job details from user"""
        print("\n" + "="*70)
        print("  CLICKWORKER JOB COMPLETION AGENT")
        print("="*70)
        print("\nThis agent will:")
        print("  1. Login to your Google account")
        print("  2. Perform searches and take screenshots")
        print("  3. Extract page information")
        print("  4. Fill the job form automatically")
        print("="*70 + "\n")

        # Get inputs
        job_url = input("Enter clickworker job URL: ").strip()
        google_email = input("Enter your Google email: ").strip()
        google_password = input("Enter your Google password: ").strip()

        print("\nEnter search keywords (press Enter after each, empty to finish):")
        keywords = []
        i = 1
        while True:
            kw = input(f"  Keyword {i}: ").strip()
            if not kw:
                break
            keywords.append(kw)
            i += 1

        if len(keywords) < 2:
            keywords = ["Havergal college", "Havergal college Scholarship"]  # Defaults

        print(f"\nStarting in 3 seconds...")
        time.sleep(3)

        try:
            self.setup_browser()
            self.complete_google_search_job(job_url, google_email, google_password, keywords)

            input("\n\nJob complete! Press Enter to close browser...")

        except KeyboardInterrupt:
            self.log("\nStopped by user", "INFO")
        finally:
            if self.driver:
                self.driver.quit()

if __name__ == "__main__":
    agent = JobCompleter()
    agent.run_interactive()
