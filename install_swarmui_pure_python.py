#!/usr/bin/env python3
"""
SwarmUI Installation Script - Pure Python
Runs without relying on bash environment
"""
import os
import shutil
import subprocess
import glob

def main():
    print("=" * 60)
    print("SWARMUI FRESH INSTALLATION - PURE PYTHON")
    print("=" * 60)

    home_dir = "/home/ian"
    swarm_dir = os.path.join(home_dir, "SwarmUI")

    # Step 1: Remove old SwarmUI
    if os.path.exists(swarm_dir):
        print("\n[1/7] Removing existing SwarmUI directory...")
        try:
            shutil.rmtree(swarm_dir)
            print("✓ Removed successfully")
        except Exception as e:
            print(f"✗ Error removing: {e}")
            return False
    else:
        print("\n[1/7] No existing SwarmUI directory found")

    # Step 2: Clone SwarmUI
    print("\n[2/7] Cloning SwarmUI from GitHub...")
    try:
        result = subprocess.run(
            ["git", "clone", "https://github.com/mcmonkeyprojects/SwarmUI", swarm_dir],
            cwd=home_dir,
            capture_output=True,
            text=True,
            timeout=180
        )
        if result.returncode == 0:
            print("✓ Clone successful")
        else:
            print(f"✗ Clone failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"✗ Error cloning: {e}")
        return False

    # Step 3: Create model directories
    print("\n[3/7] Creating model directories...")
    models_dir = os.path.join(swarm_dir, "Models", "Stable-Diffusion")
    lora_dir = os.path.join(swarm_dir, "Models", "Lora")
    try:
        os.makedirs(models_dir, exist_ok=True)
        os.makedirs(lora_dir, exist_ok=True)
        print(f"✓ Created {models_dir}")
        print(f"✓ Created {lora_dir}")
    except Exception as e:
        print(f"✗ Error creating directories: {e}")
        return False

    # Step 4: Copy models from backup
    print("\n[4/7] Copying models from backup...")
    backup_dir = os.path.join(home_dir, "SwarmUI_Models_Backup", "Stable-Diffusion")
    copied_count = 0
    if os.path.exists(backup_dir):
        backup_models = glob.glob(os.path.join(backup_dir, "*.safetensors"))
        for model_path in backup_models:
            try:
                filename = os.path.basename(model_path)
                dest = os.path.join(models_dir, filename)
                print(f"  Copying {filename}...")
                shutil.copy2(model_path, dest)
                copied_count += 1
            except Exception as e:
                print(f"  ✗ Failed to copy {filename}: {e}")
        print(f"✓ Copied {copied_count} models from backup")
    else:
        print(f"! Backup directory not found: {backup_dir}")

    # Step 5: Copy models from Downloads
    print("\n[5/7] Copying models from Downloads...")
    downloads_dir = os.path.join(home_dir, "Downloads")
    download_count = 0
    if os.path.exists(downloads_dir):
        download_models = glob.glob(os.path.join(downloads_dir, "*.safetensors"))
        for model_path in download_models:
            try:
                filename = os.path.basename(model_path)
                # Put LoRA files in Lora directory
                if "NSFW" in filename or "lora" in filename.lower():
                    dest = os.path.join(lora_dir, filename)
                    print(f"  Copying {filename} to Lora/...")
                else:
                    dest = os.path.join(models_dir, filename)
                    print(f"  Copying {filename}...")
                shutil.copy2(model_path, dest)
                download_count += 1
            except Exception as e:
                print(f"  ✗ Failed to copy {filename}: {e}")
        print(f"✓ Copied {download_count} models from Downloads")
    else:
        print(f"! Downloads directory not found: {downloads_dir}")

    # Step 6: Fix launch script
    print("\n[6/7] Fixing launch script to use python3...")
    launch_script = os.path.join(swarm_dir, "launch-linux.sh")
    try:
        with open(launch_script, 'r') as f:
            content = f.read()
        content = content.replace('python ', 'python3 ')
        with open(launch_script, 'w') as f:
            f.write(content)
        print("✓ Launch script updated")
    except Exception as e:
        print(f"✗ Error updating launch script: {e}")

    # Step 7: Summary
    print("\n[7/7] Installation Summary:")
    print("=" * 60)

    # List all models
    all_models = glob.glob(os.path.join(models_dir, "*.safetensors"))
    all_loras = glob.glob(os.path.join(lora_dir, "*.safetensors"))

    print(f"\nStable Diffusion Models ({len(all_models)}):")
    for model_path in sorted(all_models):
        filename = os.path.basename(model_path)
        size_gb = os.path.getsize(model_path) / (1024**3)
        print(f"  • {filename} ({size_gb:.2f} GB)")

    if all_loras:
        print(f"\nLoRA Models ({len(all_loras)}):")
        for lora_path in sorted(all_loras):
            filename = os.path.basename(lora_path)
            size_mb = os.path.getsize(lora_path) / (1024**2)
            print(f"  • {filename} ({size_mb:.1f} MB)")

    print("\n" + "=" * 60)
    print("✓ INSTALLATION COMPLETE!")
    print("\nNext steps:")
    print("  1. cd /home/ian/SwarmUI")
    print("  2. ./launch-linux.sh")
    print("  3. Open http://localhost:7801 in your browser")
    print("=" * 60)

    return True

if __name__ == "__main__":
    try:
        success = main()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nInstallation cancelled by user")
        exit(1)
    except Exception as e:
        print(f"\n\nFATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
