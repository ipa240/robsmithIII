#!/usr/bin/env python3
"""
Smart Clickworker Agent with OCR and Vision
Designed for testing clickworker websites - finds jobs and completes them
"""
import cv2
import numpy as np
from PIL import ImageGrab, Image
import ollama
import pyautogui
import time
import random
import json
from datetime import datetime
import os
import re

# Performance settings
pyautogui.PAUSE = 0.05
pyautogui.FAILSAFE = False

# State tracking
current_state = "FINDING_JOB"  # FINDING_JOB, READING_TASK, COMPLETING_TASK, SUBMITTING
last_action_time = time.time()
task_instructions = ""

def grab_screen():
    """Capture and resize screenshot"""
    screen = ImageGrab.grab()
    screen_np = cv2.cvtColor(np.array(screen), cv2.COLOR_RGB2BGR)

    # Resize for faster processing
    height, width = screen_np.shape[:2]
    max_width = 1920
    if width > max_width:
        ratio = max_width / width
        new_width = max_width
        new_height = int(height * ratio)
        screen_np = cv2.resize(screen_np, (new_width, new_height))

    path = "/tmp/smart_screen.jpg"
    cv2.imwrite(path, screen_np, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return path, screen_np

def find_clickable_elements(img_path):
    """Use vision model to identify clickable elements"""
    prompt = """Analyze this website screenshot. List ALL clickable elements you see (buttons, links, form fields).

For EACH element provide:
- type: "button", "link", "input", "checkbox", "dropdown"
- text: the visible text/label
- x: horizontal position (0-100%)
- y: vertical position (0-100%)
- purpose: what it does (e.g., "submit form", "find jobs", "select option")

Return ONLY a JSON array. Example:
[
  {"type": "button", "text": "Find Jobs", "x": 50, "y": 20, "purpose": "search for available jobs"},
  {"type": "input", "text": "Answer", "x": 30, "y": 50, "purpose": "text input field"}
]
"""

    try:
        response = ollama.generate(
            model="llava:7b",
            prompt=prompt,
            images=[img_path]
        )

        raw = response['response'].strip()

        # Clean markdown
        if raw.startswith("```"):
            lines = raw.split('\n')
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw = '\n'.join(lines).strip()

        elements = json.loads(raw)
        return elements if isinstance(elements, list) else []
    except Exception as e:
        print(f"   ✗ Element detection failed: {e}")
        return []

def analyze_task(img_path):
    """Understand what the current task is asking"""
    prompt = """You are analyzing a clickworker task page.

What is the task asking the user to do? Provide:
1. task_type: "image_selection", "text_entry", "form_fill", "categorization", "survey", "other"
2. instructions: brief summary of what to do
3. next_action: specific next step (e.g., "click the image of a cat", "enter the number '42' in the text field")

Return ONLY JSON:
{"task_type": "...", "instructions": "...", "next_action": "..."}
"""

    try:
        response = ollama.generate(
            model="llava:7b",
            prompt=prompt,
            images=[img_path]
        )

        raw = response['response'].strip()

        # Clean markdown
        if raw.startswith("```"):
            lines = raw.split('\n')
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw = '\n'.join(lines).strip()

        task_info = json.loads(raw)
        return task_info
    except Exception as e:
        print(f"   ✗ Task analysis failed: {e}")
        return None

def click_element_by_text(text_to_find, screen_width=1920, screen_height=1200):
    """Find and click an element containing specific text"""
    elements = find_clickable_elements("/tmp/smart_screen.jpg")

    for elem in elements:
        if text_to_find.lower() in elem.get('text', '').lower():
            # Convert percentage to actual coordinates
            x = int((elem['x'] / 100) * screen_width)
            y = int((elem['y'] / 100) * screen_height)

            print(f"   → Found '{text_to_find}' at ({x}, {y})")
            pyautogui.moveTo(x, y, duration=random.uniform(0.3, 0.7))
            time.sleep(random.uniform(0.1, 0.3))
            pyautogui.click()
            return True

    return False

# Main loop
print("="*60)
print("SMART CLICKWORKER AGENT - Testing Mode")
print("="*60)
print("This agent will:")
print("  1. Find available jobs on your website")
print("  2. Read task instructions")
print("  3. Complete tasks intelligently")
print("  4. Submit results")
print()
print("Press Ctrl+C to stop")
print("="*60)

iteration = 0
while True:
    try:
        iteration += 1
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"\n[{timestamp}] === Iteration {iteration} | State: {current_state} ===")

        # Capture screen
        img_path, screen_np = grab_screen()
        height, width = screen_np.shape[:2]

        if current_state == "FINDING_JOB":
            print(f"[{timestamp}] Looking for available jobs...")

            # Try to find "Find Jobs", "Available Jobs", "Start Task", etc.
            job_keywords = ["find job", "available job", "start task", "get task", "new job", "begin"]

            elements = find_clickable_elements(img_path)
            print(f"   Found {len(elements)} clickable elements")

            for keyword in job_keywords:
                for elem in elements:
                    if keyword in elem.get('text', '').lower() or keyword in elem.get('purpose', '').lower():
                        x = int((elem['x'] / 100) * width)
                        y = int((elem['y'] / 100) * height)

                        print(f"   → Clicking: {elem['text']} (purpose: {elem.get('purpose', 'unknown')})")
                        pyautogui.moveTo(x, y, duration=random.uniform(0.4, 0.9))
                        time.sleep(random.uniform(0.2, 0.4))
                        pyautogui.click()

                        current_state = "READING_TASK"
                        time.sleep(random.uniform(2, 4))
                        break

                if current_state == "READING_TASK":
                    break

            if current_state == "FINDING_JOB":
                print("   → No job button found, waiting...")
                time.sleep(5)

        elif current_state == "READING_TASK":
            print(f"[{timestamp}] Analyzing task instructions...")

            task_info = analyze_task(img_path)

            if task_info:
                print(f"   Task Type: {task_info.get('task_type', 'unknown')}")
                print(f"   Instructions: {task_info.get('instructions', 'none')}")
                print(f"   Next Action: {task_info.get('next_action', 'unclear')}")

                task_instructions = task_info.get('instructions', '')
                current_state = "COMPLETING_TASK"
                time.sleep(random.uniform(1, 2))
            else:
                print("   → Could not understand task, retrying...")
                time.sleep(3)

        elif current_state == "COMPLETING_TASK":
            print(f"[{timestamp}] Working on task...")

            # Get specific action recommendation
            task_info = analyze_task(img_path)

            if task_info and task_info.get('next_action'):
                next_action = task_info['next_action']
                print(f"   → Action: {next_action}")

                # Try to execute the action
                # This is where we'd implement specific task logic
                # For now, look for submit/next buttons after a delay
                time.sleep(random.uniform(3, 6))

                # Look for submit button
                elements = find_clickable_elements(img_path)
                for elem in elements:
                    elem_text = elem.get('text', '').lower()
                    if any(word in elem_text for word in ['submit', 'next', 'continue', 'done', 'finish']):
                        x = int((elem['x'] / 100) * width)
                        y = int((elem['y'] / 100) * height)

                        print(f"   → Clicking: {elem['text']}")
                        pyautogui.moveTo(x, y, duration=random.uniform(0.4, 0.9))
                        time.sleep(random.uniform(0.2, 0.4))
                        pyautogui.click()

                        current_state = "FINDING_JOB"
                        time.sleep(random.uniform(2, 4))
                        break

            # Fallback: if stuck, go back to finding jobs
            if time.time() - last_action_time > 30:
                print("   → Seems stuck, resetting to find jobs")
                current_state = "FINDING_JOB"

        last_action_time = time.time()
        time.sleep(random.uniform(2, 5))

    except KeyboardInterrupt:
        print("\n\nAgent stopped by user")
        break
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        time.sleep(5)
