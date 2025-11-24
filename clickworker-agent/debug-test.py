#!/usr/bin/env python3
import sys
print("1. Starting imports...", flush=True)

print("2. Importing cv2...", flush=True)
import cv2

print("3. Importing numpy...", flush=True)
import numpy as np

print("4. Importing PIL...", flush=True)
from PIL import ImageGrab

print("5. Importing ollama...", flush=True)
import ollama

print("6. Importing pyautogui (this may hang)...", flush=True)
import pyautogui
print("   ✓ pyautogui loaded!", flush=True)

print("7. Testing screen grab...", flush=True)
screen = ImageGrab.grab()
print(f"   ✓ Screenshot: {screen.size}", flush=True)

print("8. Testing ollama...", flush=True)
models = ollama.list()
print(f"   ✓ Ollama works, {len(models.get('models', []))} models", flush=True)

print("\n✓ ALL IMPORTS SUCCESSFUL!", flush=True)
