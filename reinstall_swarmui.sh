#!/usr/bin/env bash
set -e

echo "====================================="
echo "SWARM UI FRESH INSTALLATION"
echo "====================================="

# Navigate to home directory
cd /home/ian

# Clone fresh SwarmUI
echo "Cloning SwarmUI from GitHub..."
if [ -d "SwarmUI" ]; then
    echo "Removing existing SwarmUI directory..."
    rm -rf SwarmUI
fi

git clone https://github.com/mcmonkeyprojects/SwarmUI
cd SwarmUI

echo "Running initial SwarmUI setup..."
# Run the launch script once to initialize (will fail but creates directories)
timeout 30 ./launch-linux.sh || true

echo "Copying models from backup..."
if [ -d "/home/ian/SwarmUI_Models_Backup" ]; then
    mkdir -p Models/Stable-Diffusion
    cp -v /home/ian/SwarmUI_Models_Backup/Stable-Diffusion/*.safetensors Models/Stable-Diffusion/ 2>/dev/null || true

    # Copy LoRA models if they exist
    if [ -d "/home/ian/SwarmUI_Models_Backup/Lora" ] || [ -d "/home/ian/SwarmUI_Models_Backup/LoRA" ]; then
        mkdir -p Models/Lora
        cp -v /home/ian/SwarmUI_Models_Backup/Lora/*.safetensors Models/Lora/ 2>/dev/null || true
        cp -v /home/ian/SwarmUI_Models_Backup/LoRA/*.safetensors Models/Lora/ 2>/dev/null || true
    fi
fi

echo "Copying additional models from Downloads..."
if [ -d "/home/ian/Downloads" ]; then
    mkdir -p Models/Stable-Diffusion
    # Copy only .safetensors files that are likely full models (not LoRAs)
    for model in /home/ian/Downloads/*.safetensors; do
        if [ -f "$model" ]; then
            filename=$(basename "$model")
            # Skip if it's already a LoRA we copied
            if [[ ! "$filename" =~ "aidmaNSFWunlock" ]]; then
                echo "Copying $filename..."
                cp -v "$model" Models/Stable-Diffusion/
            fi
        fi
    done

    # Copy LoRA files
    mkdir -p Models/Lora
    cp -v /home/ian/Downloads/*NSFW*.safetensors Models/Lora/ 2>/dev/null || true
fi

echo ""
echo "====================================="
echo "Installation complete!"
echo "Model files copied:"
ls -lh Models/Stable-Diffusion/*.safetensors 2>/dev/null | wc -l
echo "====================================="
