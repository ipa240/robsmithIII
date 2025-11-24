#!/usr/bin/env python3
"""
Human-Like Clickworker Testing Agent
Acts like a real person: reads, thinks, makes decisions intelligently
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
import pytesseract

# Ultra-realistic human timing
pyautogui.PAUSE = 0.02
pyautogui.FAILSAFE = True  # Move to corner to emergency stop

# Agent state
state = {
    "mode": "FINDING_JOB",  # FINDING_JOB, READING_TASK, COMPLETING_TASK
    "last_screen_text": "",
    "task_instructions": "",
    "actions_taken": [],
    "stuck_counter": 0
}

def log(msg, level="INFO"):
    """Pretty logging"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    icons = {"INFO": "ℹ", "SUCCESS": "✓", "ERROR": "✗", "THINKING": "💭", "ACTION": "→"}
    icon = icons.get(level, "•")
    print(f"[{timestamp}] {icon} {msg}", flush=True)

def human_delay(action_type="normal"):
    """Realistic human delays"""
    delays = {
        "reading_word": random.uniform(0.08, 0.15),  # per word
        "thinking": random.uniform(1.2, 3.5),
        "quick_scan": random.uniform(0.4, 0.9),
        "decision": random.uniform(0.8, 2.2),
        "typing_char": random.uniform(0.08, 0.22),
        "mouse_move": random.uniform(0.3, 0.8),
        "after_click": random.uniform(0.5, 1.5),
        "page_load": random.uniform(1.5, 3.0),
        "normal": random.uniform(0.5, 1.5)
    }
    time.sleep(delays.get(action_type, delays["normal"]))

def grab_screen_with_ocr():
    """Capture screenshot and extract all text"""
    screen = ImageGrab.grab()
    screen_np = cv2.cvtColor(np.array(screen), cv2.COLOR_RGB2BGR)

    # Resize for processing
    height, width = screen_np.shape[:2]
    max_width = 1920
    scale = 1.0
    if width > max_width:
        scale = max_width / width
        new_width = max_width
        new_height = int(height * scale)
        screen_np = cv2.resize(screen_np, (new_width, new_height))

    # Save screenshot
    screen_path = "/tmp/human_screen.jpg"
    cv2.imwrite(screen_path, screen_np, [cv2.IMWRITE_JPEG_QUALITY, 85])

    # OCR to extract text
    try:
        ocr_text = pytesseract.image_to_string(screen_np)
        # Also get text with positions
        ocr_data = pytesseract.image_to_data(screen_np, output_type=pytesseract.Output.DICT)
    except Exception as e:
        log(f"OCR failed: {e}", "ERROR")
        ocr_text = ""
        ocr_data = None

    return screen_path, screen_np, ocr_text, ocr_data, scale

def find_text_position(ocr_data, search_text):
    """Find screen coordinates of specific text"""
    if not ocr_data:
        return None

    search_lower = search_text.lower()
    n_boxes = len(ocr_data['text'])

    # Try to find exact match first
    for i in range(n_boxes):
        text = ocr_data['text'][i].lower().strip()
        if text and search_lower in text:
            x = ocr_data['left'][i] + ocr_data['width'][i] // 2
            y = ocr_data['top'][i] + ocr_data['height'][i] // 2
            conf = ocr_data['conf'][i]
            if conf > 30:  # Confidence threshold
                return (x, y, text)

    # Try fuzzy matching
    for i in range(n_boxes):
        text = ocr_data['text'][i].lower().strip()
        if text and any(word in text for word in search_lower.split()):
            x = ocr_data['left'][i] + ocr_data['width'][i] // 2
            y = ocr_data['top'][i] + ocr_data['height'][i] // 2
            conf = ocr_data['conf'][i]
            if conf > 30:
                return (x, y, text)

    return None

def human_mouse_move(x, y):
    """Move mouse like a human (curved path, not straight)"""
    current_x, current_y = pyautogui.position()

    # Add slight randomness to target
    x += random.randint(-3, 3)
    y += random.randint(-3, 3)

    # Calculate distance
    distance = ((x - current_x)**2 + (y - current_y)**2)**0.5

    # Duration based on distance (realistic)
    duration = 0.3 + (distance / 2000) + random.uniform(0, 0.3)

    # Move with easing
    pyautogui.moveTo(x, y, duration=duration, tween=pyautogui.easeInOutQuad)

    # Small correction movement (humans overshoot slightly)
    if random.random() < 0.3:
        time.sleep(random.uniform(0.05, 0.15))
        pyautogui.moveRel(random.randint(-2, 2), random.randint(-2, 2), duration=0.1)

def human_click(x=None, y=None):
    """Click like a human"""
    if x is not None and y is not None:
        human_mouse_move(x, y)

    human_delay("decision")

    # Sometimes double-check position before clicking
    if random.random() < 0.2:
        time.sleep(random.uniform(0.1, 0.3))

    pyautogui.click()
    human_delay("after_click")

def human_type(text):
    """Type like a human with realistic speed and occasional typos"""
    for i, char in enumerate(text):
        # Occasional typo (5% chance)
        if random.random() < 0.05 and char.isalpha():
            # Type wrong letter
            wrong_char = chr(ord(char) + random.choice([-1, 1]))
            pyautogui.write(wrong_char)
            human_delay("typing_char")
            # Realize mistake, backspace
            time.sleep(random.uniform(0.2, 0.5))
            pyautogui.press('backspace')
            human_delay("typing_char")

        pyautogui.write(char)
        human_delay("typing_char")

        # Occasional thinking pause mid-sentence
        if char == ' ' and random.random() < 0.15:
            time.sleep(random.uniform(0.3, 0.9))

def answer_question_intelligently(question):
    """Use AI to answer questions intelligently"""
    try:
        # Use ollama to generate a smart answer
        response = ollama.generate(
            model="llava:7b",  # or use a text-only model for better performance
            prompt=f"""You are completing a clickworker task. Answer this question naturally and helpfully:

Question: {question}

Provide a brief, realistic answer (1-3 sentences). Be specific and natural like a real person would answer."""
        )

        answer = response['response'].strip()
        # Clean up if it's too long
        if len(answer) > 200:
            answer = answer[:197] + "..."
        return answer
    except:
        # Fallback answers
        fallbacks = [
            "Yes, that seems correct.",
            "I would say this is accurate.",
            "From my perspective, yes.",
            "That appears to be the case.",
            "I believe so."
        ]
        return random.choice(fallbacks)

def find_and_interact_with_form_elements(img_path, ocr_data, scale):
    """Find checkboxes, radio buttons, dropdowns, text fields and interact with them"""
    interactions = []

    # Ask vision AI to identify all form elements
    form_analysis = analyze_with_vision(img_path,
        """Identify ALL form elements on this page (checkboxes, radio buttons, text inputs, dropdowns).

        For EACH element return:
        {
          'type': 'checkbox'/'radio'/'text_input'/'dropdown',
          'label': 'the label/question text',
          'x': pixel_x,
          'y': pixel_y,
          'should_interact': true/false (based on task context),
          'value_to_enter': 'text' (if text_input),
          'option_to_select': 'text' (if dropdown/radio)
        }

        Return JSON array: [...]""")

    if not form_analysis or not isinstance(form_analysis, list):
        return []

    for element in form_analysis:
        if element.get('should_interact'):
            elem_type = element.get('type')
            x = int(element.get('x', 0) / scale)
            y = int(element.get('y', 0) / scale)
            label = element.get('label', 'unknown')

            log(f"Found {elem_type}: {label}", "INFO")

            if elem_type == 'checkbox' and element.get('should_interact'):
                log(f"Checking checkbox: {label}", "ACTION")
                human_click(x, y)
                interactions.append(f"checked {label}")
                human_delay("decision")

            elif elem_type == 'radio':
                log(f"Selecting radio: {label}", "ACTION")
                human_click(x, y)
                interactions.append(f"selected {label}")
                human_delay("decision")

            elif elem_type == 'text_input':
                value = element.get('value_to_enter', '')
                if not value and label:
                    # Generate intelligent answer for the question/label
                    value = answer_question_intelligently(label)

                log(f"Filling text field '{label}' with: {value}", "ACTION")
                human_click(x, y)
                human_delay("decision")
                human_type(value)
                interactions.append(f"entered '{value}' in {label}")

            elif elem_type == 'dropdown':
                option = element.get('option_to_select', '')
                if option:
                    log(f"Selecting from dropdown: {option}", "ACTION")
                    human_click(x, y)
                    human_delay("decision")
                    # Type to search in dropdown
                    human_type(option)
                    time.sleep(0.3)
                    pyautogui.press('enter')
                    interactions.append(f"selected '{option}' in {label}")

    return interactions

def analyze_with_vision(img_path, question):
    """Ask vision model a specific question about the screen"""
    try:
        response = ollama.generate(
            model="llava:7b",
            prompt=f"{question}\n\nRespond with ONLY JSON, no markdown, no explanations.",
            images=[img_path]
        )

        raw = response['response'].strip()

        # Clean markdown code blocks
        if raw.startswith("```"):
            lines = raw.split('\n')
            raw = '\n'.join(line for line in lines if not line.strip().startswith('```'))

        return json.loads(raw)
    except Exception as e:
        log(f"Vision analysis failed: {e}", "ERROR")
        return None

def read_screen_naturally(ocr_text):
    """Simulate natural reading time"""
    word_count = len(ocr_text.split())
    reading_time = word_count * human_delay.__code__.co_consts[1]  # Use reading_word delay
    log(f"Reading screen ({word_count} words)...", "THINKING")
    time.sleep(min(reading_time, 5))  # Cap at 5 seconds

# ============================================================================
# MAIN AGENT LOOP
# ============================================================================

log("="*70)
log("HUMAN-LIKE CLICKWORKER TESTING AGENT", "INFO")
log("="*70)
log("Behaving like a real person testing your website")
log("Will find jobs, read instructions, complete tasks naturally")
log("Press Ctrl+C (or move mouse to top-left corner) to stop")
log("="*70)

iteration = 0

while True:
    try:
        iteration += 1
        log(f"\n{'='*70}")
        log(f"Iteration {iteration} | Mode: {state['mode']}", "INFO")

        # Capture screen with OCR
        img_path, screen_np, ocr_text, ocr_data, scale = grab_screen_with_ocr()
        screen_height, screen_width = screen_np.shape[:2]

        # Store text to detect changes
        text_changed = (ocr_text != state["last_screen_text"])
        state["last_screen_text"] = ocr_text

        # Quick scan of page
        human_delay("quick_scan")

        # ====================================================================
        # MODE: FINDING_JOB
        # ====================================================================
        if state["mode"] == "FINDING_JOB":
            log("Looking for available jobs to test...", "THINKING")

            # Search for job-related keywords in OCR text
            job_keywords = [
                "find job", "available job", "get job", "new job", "start task",
                "browse job", "job list", "tasks available", "begin", "start"
            ]

            found_keyword = None
            for keyword in job_keywords:
                if keyword in ocr_text.lower():
                    found_keyword = keyword
                    break

            if found_keyword:
                log(f"Found '{found_keyword}' on page", "SUCCESS")

                # Try to click it using OCR position
                pos = find_text_position(ocr_data, found_keyword)

                if pos:
                    x, y, matched_text = pos
                    log(f"Clicking on '{matched_text}'", "ACTION")
                    human_click(int(x / scale), int(y / scale))

                    state["mode"] = "READING_TASK"
                    state["stuck_counter"] = 0
                    human_delay("page_load")
                else:
                    # Ask vision model where to click
                    log("Using vision AI to find clickable element...", "THINKING")
                    result = analyze_with_vision(img_path,
                        f"Find the button/link for '{found_keyword}'. Return: {{'x': pixel_x, 'y': pixel_y, 'text': 'button text'}}")

                    if result and 'x' in result and 'y' in result:
                        x = int(result['x'] / scale)
                        y = int(result['y'] / scale)
                        log(f"Vision AI found it at ({x}, {y})", "SUCCESS")
                        human_click(x, y)

                        state["mode"] = "READING_TASK"
                        state["stuck_counter"] = 0
                        human_delay("page_load")
            else:
                log("No job keywords found, scanning page with vision AI...", "THINKING")

                # Ask vision model what to do
                result = analyze_with_vision(img_path,
                    "What should a user click to find/start/get a job or task? Return: {'action': 'description', 'x': pixel_x, 'y': pixel_y}")

                if result and result.get('x') and result.get('y'):
                    x = int(result['x'] / scale)
                    y = int(result['y'] / scale)
                    log(f"Vision AI suggests: {result.get('action', 'click here')}", "ACTION")
                    human_click(x, y)
                    human_delay("page_load")
                else:
                    log("Nothing obvious to click, waiting...", "THINKING")
                    state["stuck_counter"] += 1
                    time.sleep(3)

        # ====================================================================
        # MODE: READING_TASK
        # ====================================================================
        elif state["mode"] == "READING_TASK":
            log("Reading task instructions...", "THINKING")

            # Simulate natural reading
            read_screen_naturally(ocr_text)

            # Use vision to understand the task
            task_analysis = analyze_with_vision(img_path,
                """Analyze this clickworker task page. What is the user being asked to do?
                Return: {
                  'task_type': 'data_entry'/'image_selection'/'survey'/'categorization'/'other',
                  'instructions': 'brief summary of task',
                  'what_to_click_next': 'describe the next clickable element',
                  'x': pixel_x,
                  'y': pixel_y
                }""")

            if task_analysis:
                log(f"Task Type: {task_analysis.get('task_type', 'unknown')}", "INFO")
                log(f"Instructions: {task_analysis.get('instructions', 'unclear')}", "INFO")

                state["task_instructions"] = task_analysis.get('instructions', '')
                state["mode"] = "COMPLETING_TASK"
                human_delay("thinking")
            else:
                log("Could not understand task, retrying...", "ERROR")
                time.sleep(2)

        # ====================================================================
        # MODE: COMPLETING_TASK
        # ====================================================================
        elif state["mode"] == "COMPLETING_TASK":
            log("Working on task...", "ACTION")

            # First, try to intelligently fill out any forms/checkboxes/fields
            log("Scanning for form elements...", "THINKING")
            form_interactions = find_and_interact_with_form_elements(img_path, ocr_data, scale)

            if form_interactions:
                log(f"Completed {len(form_interactions)} form interactions", "SUCCESS")
                for interaction in form_interactions:
                    log(f"  - {interaction}", "INFO")

                # After filling forms, look for submit button
                human_delay("thinking")

                # Try to find submit button
                submit_keywords = ["submit", "next", "continue", "finish", "done", "complete", "send"]
                found_submit = False

                for keyword in submit_keywords:
                    pos = find_text_position(ocr_data, keyword)
                    if pos:
                        x, y, text = pos
                        log(f"Found '{text}' button - submitting", "SUCCESS")
                        human_click(int(x / scale), int(y / scale))
                        found_submit = True

                        state["mode"] = "FINDING_JOB"
                        state["actions_taken"] = []
                        state["stuck_counter"] = 0
                        human_delay("page_load")
                        break

                if not found_submit:
                    log("Forms filled, but no submit button found yet", "INFO")

            # Get next action from vision AI
            action_plan = analyze_with_vision(img_path,
                f"""This is a clickworker task: "{state.get('task_instructions', '')}"

                What should the user do RIGHT NOW to complete this task? Be SPECIFIC.
                Return: {{
                  'action_type': 'click'/'type'/'select'/'scroll'/'submit',
                  'description': 'what to do',
                  'x': pixel_x (if clicking),
                  'y': pixel_y (if clicking),
                  'text_to_type': 'text' (if typing),
                  'is_task_complete': true/false
                }}""")

            if action_plan:
                log(f"Next action: {action_plan.get('description', 'unknown')}", "ACTION")

                action_type = action_plan.get('action_type', '')

                if action_type == 'click' and action_plan.get('x') and action_plan.get('y'):
                    x = int(action_plan['x'] / scale)
                    y = int(action_plan['y'] / scale)
                    human_click(x, y)
                    state["actions_taken"].append(f"clicked ({x}, {y})")

                elif action_type == 'type' and action_plan.get('text_to_type'):
                    text = action_plan['text_to_type']
                    log(f"Typing: {text}", "ACTION")
                    human_type(text)
                    state["actions_taken"].append(f"typed '{text}'")

                elif action_type == 'submit' or action_plan.get('is_task_complete'):
                    log("Task appears complete, looking for submit button", "SUCCESS")

                    # Find submit/next/continue button
                    submit_keywords = ["submit", "next", "continue", "finish", "done", "complete"]
                    found = False

                    for keyword in submit_keywords:
                        pos = find_text_position(ocr_data, keyword)
                        if pos:
                            x, y, text = pos
                            log(f"Found '{text}' button", "SUCCESS")
                            human_click(int(x / scale), int(y / scale))
                            found = True
                            break

                    if found:
                        state["mode"] = "FINDING_JOB"
                        state["actions_taken"] = []
                        state["stuck_counter"] = 0
                        human_delay("page_load")
                    else:
                        log("Submit button not found in OCR, asking vision AI...", "THINKING")
                        submit_info = analyze_with_vision(img_path,
                            "Where is the submit/next/continue/finish button? Return: {'x': pixel_x, 'y': pixel_y, 'text': 'button text'}")

                        if submit_info and submit_info.get('x'):
                            x = int(submit_info['x'] / scale)
                            y = int(submit_info['y'] / scale)
                            log(f"Vision AI found submit at ({x}, {y})", "SUCCESS")
                            human_click(x, y)

                            state["mode"] = "FINDING_JOB"
                            state["actions_taken"] = []
                            state["stuck_counter"] = 0
                            human_delay("page_load")

                human_delay("thinking")
            else:
                log("Vision AI couldn't suggest next action", "ERROR")
                state["stuck_counter"] += 1
                time.sleep(2)

        # Check if stuck
        if state["stuck_counter"] > 5:
            log("Agent seems stuck, resetting to FINDING_JOB", "ERROR")
            state["mode"] = "FINDING_JOB"
            state["stuck_counter"] = 0
            state["actions_taken"] = []

            # Try refreshing page
            log("Refreshing page...", "ACTION")
            pyautogui.press('f5')
            human_delay("page_load")

        # Natural pause between actions
        human_delay("normal")

    except KeyboardInterrupt:
        log("Agent stopped by user", "INFO")
        break
    except Exception as e:
        log(f"Error: {e}", "ERROR")
        import traceback
        traceback.print_exc()
        time.sleep(3)
