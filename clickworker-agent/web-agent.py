#!/usr/bin/env python3
"""
Autonomous Web Agent for Clickworker Testing
Uses browser automation + AI to intelligently complete jobs
"""
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import time
import random
import json
import ollama
from bs4 import BeautifulSoup
from datetime import datetime

class HumanLikeAgent:
    def __init__(self, start_url):
        self.start_url = start_url
        self.driver = None
        self.wait = None
        self.memory = {
            "visited_pages": [],
            "completed_jobs": [],
            "known_patterns": {},
            "job_workflows": []
        }

    def log(self, msg, level="INFO"):
        """Pretty logging"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        icons = {"INFO": "ℹ", "SUCCESS": "✓", "ERROR": "✗", "THINKING": "💭", "ACTION": "→"}
        icon = icons.get(level, "•")
        print(f"[{timestamp}] {icon} {msg}", flush=True)

    def human_delay(self, min_sec=0.5, max_sec=2.0):
        """Random human-like delay"""
        time.sleep(random.uniform(min_sec, max_sec))

    def setup_browser(self):
        """Initialize browser with human-like settings"""
        self.log("Setting up browser...", "INFO")

        chrome_options = Options()
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)

        # Add user agent
        chrome_options.add_argument('user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

        self.driver = webdriver.Chrome(options=chrome_options)
        self.wait = WebDriverWait(self.driver, 10)

        # Hide webdriver property
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

        self.log("Browser ready", "SUCCESS")

    def get_page_analysis(self):
        """Analyze current page using AI"""
        # Get page HTML
        html = self.driver.page_source
        soup = BeautifulSoup(html, 'html.parser')

        # Extract text content
        text_content = soup.get_text(separator=' ', strip=True)[:2000]  # First 2000 chars

        # Get all interactive elements
        buttons = self.driver.find_elements(By.TAG_NAME, "button")
        links = self.driver.find_elements(By.TAG_NAME, "a")
        inputs = self.driver.find_elements(By.TAG_NAME, "input")
        textareas = self.driver.find_elements(By.TAG_NAME, "textarea")
        selects = self.driver.find_elements(By.TAG_NAME, "select")

        elements_info = {
            "buttons": [{"text": btn.text, "visible": btn.is_displayed()} for btn in buttons[:20]],
            "links": [{"text": link.text, "href": link.get_attribute("href")} for link in links[:20]],
            "inputs": [{"type": inp.get_attribute("type"), "placeholder": inp.get_attribute("placeholder"), "name": inp.get_attribute("name")} for inp in inputs[:20]],
            "textareas": len(textareas),
            "selects": len(selects)
        }

        return {
            "url": self.driver.current_url,
            "title": self.driver.title,
            "text_content": text_content,
            "elements": elements_info
        }

    def ask_ai(self, question, context):
        """Ask AI what to do next"""
        prompt = f"""You are an autonomous web agent testing a clickworker website.

CURRENT PAGE:
URL: {context['url']}
Title: {context['title']}
Text Content: {context['text_content']}

Available Elements:
- Buttons: {json.dumps(context['elements']['buttons'], indent=2)}
- Links: {json.dumps(context['elements']['links'][:10], indent=2)}
- Input Fields: {json.dumps(context['elements']['inputs'], indent=2)}

QUESTION: {question}

Respond with JSON only:
{{
  "action": "click_button"/"click_link"/"fill_input"/"select_option"/"submit"/"wait"/"analyze",
  "target": "exact text of element to interact with",
  "value": "text to enter (for inputs)",
  "reasoning": "why this action"
}}
"""

        try:
            response = ollama.generate(
                model="llava:7b",
                prompt=prompt
            )

            raw = response['response'].strip()

            # Clean markdown
            if raw.startswith("```"):
                lines = raw.split('\n')
                raw = '\n'.join(line for line in lines if not line.strip().startswith('```'))

            return json.loads(raw)
        except Exception as e:
            self.log(f"AI decision failed: {e}", "ERROR")
            return {"action": "wait", "reasoning": "error in AI"}

    def find_element_by_text(self, text, tag="button"):
        """Find element containing specific text"""
        try:
            # Try exact match first
            elements = self.driver.find_elements(By.TAG_NAME, tag)
            for elem in elements:
                if elem.text.strip().lower() == text.lower():
                    return elem

            # Try partial match
            for elem in elements:
                if text.lower() in elem.text.strip().lower():
                    return elem

            return None
        except:
            return None

    def human_type(self, element, text):
        """Type like a human"""
        element.click()
        self.human_delay(0.3, 0.8)

        for char in text:
            element.send_keys(char)
            time.sleep(random.uniform(0.08, 0.22))

            # Occasional pause
            if char == ' ' and random.random() < 0.15:
                time.sleep(random.uniform(0.3, 0.9))

    def complete_job_workflow(self):
        """Main workflow to find and complete a job"""
        self.log("Starting job completion workflow", "INFO")

        # Step 1: Find a job
        self.log("STEP 1: Finding available job...", "THINKING")
        page_context = self.get_page_analysis()

        decision = self.ask_ai(
            "What should I click to find/start/get an available job?",
            page_context
        )

        self.log(f"AI Decision: {decision.get('action')} - {decision.get('reasoning')}", "THINKING")

        if decision['action'] == 'click_button':
            target = decision.get('target', '')
            btn = self.find_element_by_text(target, "button")
            if btn:
                self.log(f"Clicking button: {target}", "ACTION")
                btn.click()
                self.human_delay(2, 4)
            else:
                # Try finding as link
                link = self.find_element_by_text(target, "a")
                if link:
                    self.log(f"Clicking link: {target}", "ACTION")
                    link.click()
                    self.human_delay(2, 4)

        # Step 2: Read the task
        self.log("STEP 2: Reading task instructions...", "THINKING")
        page_context = self.get_page_analysis()
        self.human_delay(2, 4)  # Simulate reading time

        # Step 3: Complete the task
        self.log("STEP 3: Completing task...", "ACTION")

        max_actions = 10
        for i in range(max_actions):
            page_context = self.get_page_analysis()

            decision = self.ask_ai(
                f"What is the next action to complete this task? (Action {i+1}/{max_actions})",
                page_context
            )

            self.log(f"Action {i+1}: {decision.get('action')} - {decision.get('reasoning')}", "ACTION")

            if decision['action'] == 'fill_input':
                target = decision.get('target', '')
                value = decision.get('value', '')

                # Find input by placeholder or name
                inputs = self.driver.find_elements(By.TAG_NAME, "input")
                for inp in inputs:
                    if target.lower() in (inp.get_attribute("placeholder") or "").lower() or \
                       target.lower() in (inp.get_attribute("name") or "").lower():
                        self.log(f"Filling input '{target}' with: {value}", "ACTION")
                        self.human_type(inp, value)
                        break

            elif decision['action'] == 'click_button':
                target = decision.get('target', '')
                btn = self.find_element_by_text(target, "button")
                if btn:
                    self.log(f"Clicking: {target}", "ACTION")
                    btn.click()
                    self.human_delay(1, 3)

            elif decision['action'] == 'submit':
                self.log("Submitting task...", "SUCCESS")
                # Look for submit button
                submit_btn = self.find_element_by_text("submit", "button") or \
                            self.find_element_by_text("next", "button") or \
                            self.find_element_by_text("continue", "button")

                if submit_btn:
                    submit_btn.click()
                    self.human_delay(2, 4)
                break

            elif decision['action'] == 'wait':
                self.log("Waiting...", "INFO")
                self.human_delay(2, 5)

            self.human_delay(1, 2)

        self.log("Job workflow completed!", "SUCCESS")
        self.memory['completed_jobs'].append({
            "url": self.driver.current_url,
            "timestamp": datetime.now().isoformat()
        })

    def run(self):
        """Main agent loop"""
        try:
            self.setup_browser()

            self.log(f"Navigating to: {self.start_url}", "INFO")
            self.driver.get(self.start_url)
            self.human_delay(3, 5)

            self.log("="*70, "INFO")
            self.log("AUTONOMOUS WEB AGENT ACTIVE", "SUCCESS")
            self.log("="*70, "INFO")

            # Continuous loop
            job_count = 0
            while True:
                job_count += 1
                self.log(f"\n{'='*70}", "INFO")
                self.log(f"JOB #{job_count}", "INFO")
                self.log(f"{'='*70}", "INFO")

                self.complete_job_workflow()

                # Check if we should continue
                self.log(f"Completed {job_count} jobs. Looking for next job...", "SUCCESS")
                self.human_delay(3, 6)

        except KeyboardInterrupt:
            self.log("Agent stopped by user", "INFO")
        except Exception as e:
            self.log(f"Error: {e}", "ERROR")
            import traceback
            traceback.print_exc()
        finally:
            if self.driver:
                self.log(f"Session complete. Completed {len(self.memory['completed_jobs'])} jobs.", "SUCCESS")
                self.human_delay(3, 3)
                self.driver.quit()

# Main entry point
if __name__ == "__main__":
    import sys

    print("="*70)
    print(" AUTONOMOUS CLICKWORKER WEB AGENT")
    print("="*70)
    print()

    # Get URL from user
    if len(sys.argv) > 1:
        url = sys.argv[1]
    else:
        url = input("Enter your clickworker website URL: ").strip()
        if not url.startswith("http"):
            url = "http://" + url

    print(f"\nStarting agent on: {url}")
    print("\nThis agent will:")
    print("  • Open browser and navigate to your site")
    print("  • Find available jobs using AI")
    print("  • Read and understand task instructions")
    print("  • Complete tasks intelligently")
    print("  • Fill forms, answer questions, check boxes")
    print("  • Submit results automatically")
    print("  • Repeat continuously")
    print()
    print("Press Ctrl+C to stop")
    print("="*70)
    print()

    time.sleep(2)

    agent = HumanLikeAgent(url)
    agent.run()
