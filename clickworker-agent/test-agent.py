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

print("="*50)
print("AGENT TEST MODE")
print("="*50)

# Test 1: Screen capture
print("\n1. Testing screen capture...")
try:
    screen = ImageGrab.grab()
    screen_np = cv2.cvtColor(np.array(screen), cv2.COLOR_RGB2BGR)
    path = "/tmp/test_screen.jpg"
    cv2.imwrite(path, screen_np)
    print(f"✓ Screenshot saved to {path}")
    print(f"  Screen size: {screen_np.shape}")
except Exception as e:
    print(f"✗ Screen capture failed: {e}")
    exit(1)

# Test 2: Ollama connection
print("\n2. Testing Ollama connection...")
try:
    models = ollama.list()
    print(f"✓ Ollama connected, available models: {len(models.get('models', []))}")
    llava_found = any('llava' in str(m.get('model', m.get('name', ''))) for m in models.get('models', []))
    if llava_found:
        print("✓ llava model found")
    else:
        print("✗ llava model not found, trying to use anyway...")
except Exception as e:
    print(f"✗ Ollama connection failed: {e}")
    exit(1)

# Test 3: Vision model inference
print("\n3. Testing llava:34b inference (this may take 30-60 seconds)...")
print("  Sending screenshot to model...")
try:
    start = time.time()
    response = ollama.generate(
        model="llava:34b",
        prompt="Describe what you see in this screenshot in one short sentence.",
        images=[path]
    )
    duration = time.time() - start
    print(f"✓ Model responded in {duration:.1f} seconds")
    print(f"  Response: {response['response'][:200]}")
except Exception as e:
    print(f"✗ Model inference failed: {e}")
    exit(1)

# Test 4: PyAutoGUI
print("\n4. Testing PyAutoGUI...")
try:
    x, y = pyautogui.position()
    print(f"✓ Mouse position: ({x}, {y})")
    screen_w, screen_h = pyautogui.size()
    print(f"✓ Screen size: {screen_w}x{screen_h}")
except Exception as e:
    print(f"✗ PyAutoGUI failed: {e}")
    exit(1)

print("\n" + "="*50)
print("ALL TESTS PASSED!")
print("="*50)
print("\nAgent is ready to use. Run: python3 agent.py")
