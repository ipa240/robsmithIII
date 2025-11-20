#!/usr/bin/env python3
import os
import subprocess
import shutil
import glob

print("=" * 50)
print("SWARM UI FRESH INSTALLATION")
print("=" * 50)

os.chdir("/home/ian")

# Remove existing SwarmUI
if os.path.exists("SwarmUI"):
    print("Removing existing SwarmUI directory...")
    shutil.rmtree("SwarmUI")

# Clone SwarmUI
print("Cloning SwarmUI from GitHub...")
result = subprocess.run(["git", "clone", "https://github.com/mcmonkeyprojects/SwarmUI"],
                       capture_output=True, text=True)
if result.returncode != 0:
    print(f"ERROR: {result.stderr}")
    exit(1)
print("✓ SwarmUI cloned successfully")

# Create Models directory
os.makedirs("SwarmUI/Models/Stable-Diffusion", exist_ok=True)
os.makedirs("SwarmUI/Models/Lora", exist_ok=True)

# Copy models from backup
backup_models = glob.glob("/home/ian/SwarmUI_Models_Backup/Stable-Diffusion/*.safetensors")
print(f"\nCopying {len(backup_models)} models from backup...")
for model in backup_models:
    filename = os.path.basename(model)
    dest = f"SwarmUI/Models/Stable-Diffusion/{filename}"
    print(f"  Copying {filename}...")
    shutil.copy2(model, dest)

# Copy models from Downloads
download_models = [
    "/home/ian/Downloads/realismByStableYogi_ponyV3VAE.safetensors",
    "/home/ian/Downloads/1.safetensors",
    "/home/ian/Downloads/uberRealisticPornMerge_v23Final.safetensors",
    "/home/ian/Downloads/SD21HurricaneFully_v10EncoderTrained.safetensors"
]

print(f"\nCopying additional models from Downloads...")
for model in download_models:
    if os.path.exists(model):
        filename = os.path.basename(model)
        dest = f"SwarmUI/Models/Stable-Diffusion/{filename}"
        print(f"  Copying {filename}...")
        shutil.copy2(model, dest)

# Copy LoRA
lora_file = "/home/ian/Downloads/aidmaNSFWunlock-FLUX-V0.2.safetensors"
if os.path.exists(lora_file):
    print(f"\nCopying LoRA model...")
    shutil.copy2(lora_file, "SwarmUI/Models/Lora/")

# Fix launch script
print("\nFixing launch script to use python3...")
launch_script = "SwarmUI/launch-linux.sh"
if os.path.exists(launch_script):
    with open(launch_script, 'r') as f:
        content = f.read()
    content = content.replace('python ', 'python3 ')
    with open(launch_script, 'w') as f:
        f.write(content)
    print("✓ Launch script updated")

# List all models
print("\n" + "=" * 50)
print("Installation complete!")
models = glob.glob("SwarmUI/Models/Stable-Diffusion/*.safetensors")
print(f"Total models installed: {len(models)}")
print("\nModels:")
for model in models:
    size = os.path.getsize(model) / (1024**3)  # GB
    print(f"  - {os.path.basename(model)} ({size:.2f} GB)")

loras = glob.glob("SwarmUI/Models/Lora/*.safetensors")
if loras:
    print(f"\nLoRA models: {len(loras)}")
    for lora in loras:
        print(f"  - {os.path.basename(lora)}")

print("=" * 50)
print("\nNext step: Launch SwarmUI with:")
print("  cd /home/ian/SwarmUI && ./launch-linux.sh")
