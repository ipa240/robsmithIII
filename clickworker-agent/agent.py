#!/usr/bin/env python3
import cv2
import numpy as np
from PIL import ImageGrab
import ollama
import pyautogui
import time
import random
import json
from datetime import datetime
import os

# Faster + more reliable mouse/keyboard
pyautogui.PAUSE = 0.04
pyautogui.FAILSAFE = False   # disables the move-to-corner-to-panic feature

# ------------------------------------------------------------------
def grab_screen():
    screen = ImageGrab.grab()                                   # full screen
    screen_np = cv2.cvtColor(np.array(screen), cv2.COLOR_RGB2BGR)

    # Resize if too large (max 1920x1080 for faster processing)
    height, width = screen_np.shape[:2]
    max_width = 1920
    if width > max_width:
        ratio = max_width / width
        new_width = max_width
        new_height = int(height * ratio)
        screen_np = cv2.resize(screen_np, (new_width, new_height))

    path = "/tmp/research_screen.jpg"
    cv2.imwrite(path, screen_np, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return path

# ------------------------------------------------------------------
RESEARCH_PROMPT = """You are controlling a desktop. Respond with ONLY valid JSON, nothing else.

Pick ONE action from:
{"action": "click", "x": 1234, "y": 567}
{"action": "type", "text": "your text"}
{"action": "scroll_down"}
{"action": "scroll_up"}
{"action": "refresh_jobs"}
{"action": "wait"}

Return ONE JSON object, no arrays, no markdown, no explanations.

Screenshot:"""

# ------------------------------------------------------------------
print("Research Desktop Agent STARTED – llava:7b in control")
print("Press Ctrl+C in terminal to stop")

while True:
    try:
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] Capturing screen...", flush=True)
        img_path = grab_screen()

        print(f"[{timestamp}] Sending to llava:7b...", flush=True)
        response = ollama.generate(
            model="llava:7b",
            prompt=RESEARCH_PROMPT,
            images=[img_path]
        )

        raw = response['response'].strip()
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] → {raw[:140]}", flush=True)

        # Strip markdown code blocks if present
        if raw.startswith("```"):
            # Remove ```json or ``` at start and ``` at end
            lines = raw.split('\n')
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw = '\n'.join(lines).strip()

        # Try to parse JSON
        try:
            data = json.loads(raw)

            if data.get("action") == "click" and "x" in data and "y" in data:
                x, y = int(data["x"]), int(data["y"])
                print(f"   → CLICK ({x}, {y})")
                pyautogui.moveTo(x, y, duration=random.uniform(0.4, 1.2))
                time.sleep(random.uniform(0.2, 0.7))
                pyautogui.click()

            elif data.get("action") == "type" and "text" in data:
                text = data["text"]
                print(f"   → TYPE: {text}")
                pyautogui.write(text, interval=random.uniform(0.05, 0.18))

            elif data.get("action") == "scroll_down":
                print("   → SCROLL DOWN")
                pyautogui.scroll(-400)  # negative = down

            elif data.get("action") == "scroll_up":
                print("   → SCROLL UP")
                pyautogui.scroll(400)  # positive = up

            elif data.get("action") == "refresh_jobs":
                print("   → REFRESHING job list")
                pyautogui.press('f5')
                time.sleep(8)

            elif data.get("action") == "wait":
                delay = random.uniform(6, 16)
                print(f"   → WAIT {delay:.1f}s")
                time.sleep(delay)

            # Human-like pause after every action
            time.sleep(random.uniform(2.5, 8))

        except json.JSONDecodeError:
            print("   → Bad JSON – skipping this cycle")
            time.sleep(10)

    except KeyboardInterrupt:
        print("\nAgent stopped by user")
        break
    except Exception as e:
        print(f"Unexpected error: {e}")
        time.sleep(10)
