#!/usr/bin/env python3
"""
AUTONOMOUS DESKTOP AI AGENT
Full PC control - can navigate applications, complete complex tasks, learn and adapt
"""
import cv2
import numpy as np
from PIL import ImageGrab
import pyautogui
import time
import random
import json
import ollama
import pytesseract
from datetime import datetime
import os

# Disable failsafe for full control
pyautogui.FAILSAFE = False

class AutonomousAgent:
    def __init__(self):
        self.goal = "Find and complete clickworker jobs continuously"
        self.memory = {
            "actions_history": [],
            "screen_states": [],
            "learned_patterns": {},
            "successful_workflows": [],
            "current_task": None
        }
        self.iteration = 0
        self.stuck_count = 0
        self.last_screen_hash = None

    def log(self, msg, level="INFO"):
        """Enhanced logging"""
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        icons = {
            "INFO": "ℹ️ ",
            "SUCCESS": "✅",
            "ERROR": "❌",
            "THINKING": "🤔",
            "ACTION": "▶️ ",
            "GOAL": "🎯",
            "LEARNING": "🧠"
        }
        icon = icons.get(level, "•")
        print(f"[{timestamp}] {icon} {msg}", flush=True)

    def capture_screen(self):
        """Capture and analyze screen"""
        screen = ImageGrab.grab()
        screen_np = cv2.cvtColor(np.array(screen), cv2.COLOR_RGB2BGR)

        # Resize for performance
        height, width = screen_np.shape[:2]
        max_width = 1920
        scale = 1.0
        if width > max_width:
            scale = max_width / width
            new_height = int(height * scale)
            screen_np = cv2.resize(screen_np, (max_width, new_height))

        # Save screenshot
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_path = f"/tmp/agent_screen_{timestamp}.jpg"
        cv2.imwrite(screenshot_path, screen_np, [cv2.IMWRITE_JPEG_QUALITY, 80])

        # OCR extraction
        try:
            ocr_text = pytesseract.image_to_string(screen_np)
            ocr_data = pytesseract.image_to_data(screen_np, output_type=pytesseract.Output.DICT)
        except:
            ocr_text = ""
            ocr_data = None

        # Calculate screen hash to detect if stuck
        screen_hash = hash(ocr_text[:500])

        return {
            "path": screenshot_path,
            "image": screen_np,
            "ocr_text": ocr_text,
            "ocr_data": ocr_data,
            "dimensions": (width, height),
            "scale": scale,
            "hash": screen_hash
        }

    def think(self, screen_data):
        """AI reasoning - decide what to do next"""
        self.log("Analyzing situation...", "THINKING")

        # Build context
        context = f"""
GOAL: {self.goal}

CURRENT SCREEN:
Text visible: {screen_data['ocr_text'][:1000]}

RECENT ACTIONS (last 5):
{json.dumps(self.memory['actions_history'][-5:], indent=2)}

TASK STATUS: {self.memory.get('current_task', 'Finding new job')}
"""

        # Ask AI for decision
        prompt = f"""{context}

You are an autonomous AI agent controlling a desktop computer. Your goal is to find and complete clickworker jobs.

Based on the current screen, decide the BEST next action:

Response format (JSON only):
{{
  "understanding": "what I see on screen",
  "current_objective": "immediate goal (e.g., 'find job button', 'fill form field', 'submit answer')",
  "action_type": "click" / "type" / "press_key" / "scroll" / "wait" / "open_browser",
  "action_details": {{
    "x": pixel_x (if click),
    "y": pixel_y (if click),
    "text": "text to type" (if type),
    "key": "key name" (if press_key),
    "direction": "up/down" (if scroll)
  }},
  "reasoning": "why this action will help achieve the goal",
  "expected_outcome": "what should happen after this action"
}}
"""

        try:
            response = ollama.generate(
                model="llava:7b",
                prompt=prompt,
                images=[screen_data['path']]
            )

            raw = response['response'].strip()

            # Clean markdown
            if raw.startswith("```"):
                lines = raw.split('\n')
                raw = '\n'.join(line for line in lines if not line.strip().startswith('```'))

            decision = json.loads(raw)

            self.log(f"Understanding: {decision.get('understanding', 'unclear')[:100]}", "THINKING")
            self.log(f"Objective: {decision.get('current_objective', 'unknown')}", "GOAL")
            self.log(f"Plan: {decision.get('action_type')} - {decision.get('reasoning', '')[:80]}", "ACTION")

            return decision

        except Exception as e:
            self.log(f"AI reasoning failed: {e}", "ERROR")
            # Fallback: wait and observe
            return {
                "action_type": "wait",
                "reasoning": "AI error, observing",
                "action_details": {}
            }

    def execute_action(self, decision, screen_data):
        """Execute the decided action"""
        action_type = decision.get('action_type')
        details = decision.get('action_details', {})
        scale = screen_data['scale']

        # Record action
        self.memory['actions_history'].append({
            "iteration": self.iteration,
            "action": action_type,
            "details": details,
            "objective": decision.get('current_objective'),
            "timestamp": datetime.now().isoformat()
        })

        # Execute
        if action_type == "click":
            x = int(details.get('x', 0) / scale)
            y = int(details.get('y', 0) / scale)
            self.log(f"Clicking at ({x}, {y})", "ACTION")

            # Human-like mouse movement
            current_x, current_y = pyautogui.position()
            distance = ((x - current_x)**2 + (y - current_y)**2)**0.5
            duration = 0.3 + (distance / 1500)

            pyautogui.moveTo(x, y, duration=duration, tween=pyautogui.easeInOutQuad)
            time.sleep(random.uniform(0.2, 0.5))
            pyautogui.click()
            time.sleep(random.uniform(0.5, 1.5))

        elif action_type == "type":
            text = details.get('text', '')
            self.log(f"Typing: {text}", "ACTION")

            for char in text:
                pyautogui.write(char)
                time.sleep(random.uniform(0.08, 0.20))

                if char == ' ' and random.random() < 0.1:
                    time.sleep(random.uniform(0.2, 0.6))

            time.sleep(random.uniform(0.5, 1.0))

        elif action_type == "press_key":
            key = details.get('key', 'enter')
            self.log(f"Pressing key: {key}", "ACTION")
            pyautogui.press(key)
            time.sleep(random.uniform(0.8, 1.5))

        elif action_type == "scroll":
            direction = details.get('direction', 'down')
            amount = 400 if direction == "down" else -400
            self.log(f"Scrolling {direction}", "ACTION")
            pyautogui.scroll(amount)
            time.sleep(random.uniform(1.0, 2.0))

        elif action_type == "open_browser":
            self.log("Opening browser", "ACTION")
            # Try to open browser
            pyautogui.hotkey('alt', 'f2')  # Run dialog
            time.sleep(0.5)
            pyautogui.write('firefox')
            pyautogui.press('enter')
            time.sleep(3)

        elif action_type == "wait":
            delay = random.uniform(2, 5)
            self.log(f"Waiting {delay:.1f}s to observe...", "ACTION")
            time.sleep(delay)

        else:
            self.log(f"Unknown action: {action_type}", "ERROR")
            time.sleep(2)

    def detect_if_stuck(self, screen_hash):
        """Detect if agent is stuck in a loop"""
        if screen_hash == self.last_screen_hash:
            self.stuck_count += 1
        else:
            self.stuck_count = 0

        self.last_screen_hash = screen_hash

        if self.stuck_count > 3:
            self.log(f"Detected stuck state (same screen {self.stuck_count} times)", "ERROR")
            return True

        return False

    def handle_stuck_state(self):
        """Try to recover from stuck state"""
        self.log("Attempting recovery...", "LEARNING")

        # Try random strategies
        strategies = [
            lambda: (pyautogui.press('escape'), self.log("Pressed ESC", "ACTION")),
            lambda: (pyautogui.press('f5'), self.log("Refreshed", "ACTION")),
            lambda: (pyautogui.scroll(-400), self.log("Scrolled up", "ACTION")),
            lambda: (pyautogui.click(), self.log("Random click", "ACTION")),
        ]

        random.choice(strategies)()
        time.sleep(2)
        self.stuck_count = 0

    def learn_from_success(self, workflow):
        """Store successful workflows for future use"""
        self.memory['successful_workflows'].append({
            "workflow": workflow,
            "success_rate": 1.0,
            "timestamp": datetime.now().isoformat()
        })
        self.log("Learned new workflow pattern", "LEARNING")

    def run(self):
        """Main autonomous loop"""
        self.log("="*70, "INFO")
        self.log("AUTONOMOUS DESKTOP AI AGENT ACTIVATED", "SUCCESS")
        self.log("="*70, "INFO")
        self.log(f"Goal: {self.goal}", "GOAL")
        self.log("="*70, "INFO")
        self.log("\nAgent will now operate autonomously...", "INFO")
        self.log("Press Ctrl+C to stop\n", "INFO")

        time.sleep(2)

        try:
            while True:
                self.iteration += 1

                self.log(f"\n{'='*70}", "INFO")
                self.log(f"ITERATION {self.iteration}", "INFO")
                self.log(f"{'='*70}", "INFO")

                # 1. Observe
                self.log("Phase 1: Observing screen...", "THINKING")
                screen_data = self.capture_screen()

                # 2. Detect if stuck
                if self.detect_if_stuck(screen_data['hash']):
                    self.handle_stuck_state()
                    continue

                # 3. Think
                self.log("Phase 2: AI decision making...", "THINKING")
                decision = self.think(screen_data)

                # 4. Act
                self.log("Phase 3: Executing action...", "ACTION")
                self.execute_action(decision, screen_data)

                # 5. Learn
                # Track successful patterns
                if "submit" in decision.get('current_objective', '').lower() or \
                   "complete" in decision.get('current_objective', '').lower():
                    self.log("Potential task completion detected!", "SUCCESS")

                # Natural pause between iterations
                time.sleep(random.uniform(1.5, 3.0))

        except KeyboardInterrupt:
            self.log("\n\nAgent stopped by user", "INFO")
            self.log(f"Session stats:", "INFO")
            self.log(f"  • Total iterations: {self.iteration}", "INFO")
            self.log(f"  • Actions taken: {len(self.memory['actions_history'])}", "INFO")
            self.log(f"  • Successful workflows learned: {len(self.memory['successful_workflows'])}", "LEARNING")

        except Exception as e:
            self.log(f"Critical error: {e}", "ERROR")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║         AUTONOMOUS DESKTOP AI AGENT v1.0                            ║
║                                                                      ║
║  This agent has FULL CONTROL of your desktop and will:              ║
║                                                                      ║
║    • Observe the screen using vision AI                             ║
║    • Make intelligent decisions about what to do                    ║
║    • Control mouse, keyboard, and applications                      ║
║    • Find and complete clickworker jobs autonomously                ║
║    • Learn from successes and failures                              ║
║    • Adapt to different task types                                  ║
║                                                                      ║
║  WARNING: The agent will control your PC. Make sure:                ║
║    - Your clickworker website/app is open                           ║
║    - No sensitive data is visible                                   ║
║    - You can press Ctrl+C to stop it                                ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
""")

    response = input("\nReady to start? (yes/no): ").strip().lower()

    if response == 'yes':
        print("\nStarting autonomous agent in 3 seconds...")
        time.sleep(3)

        agent = AutonomousAgent()
        agent.run()
    else:
        print("Cancelled.")
