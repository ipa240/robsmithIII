#!/bin/bash
DOWN="/home/ian/Downloads"
SWARM="/home/ian/SwarmUI"
CKPT_DIR="$SWARM/dlbackend/comfy/ComfyUI/models/checkpoints"
VAE_DIR="$SWARM/dlbackend/comfy/ComfyUI/models/vae"

mkdir -p "$CKPT_DIR" "$VAE_DIR"

# Find the checkpoint – super forgiving now
CKPT=$(find "$DOWN" -maxdepth 1 -type f \( -iname "*2*n*1*.safetensors" -o -iname "*1*.safetensors" \) -print -quit 2>/dev/null)

# Find the VAE – also super forgiving
VAE=$(find "$DOWN" -maxdepth 1 -type f -iname "*pony*vae*.safetensors" -print -quit 2>/dev/null)

[[ -n "$CKPT" ]] && ln -sf "$CKPT" "$CKPT_DIR/" && echo "Checkpoint linked → $(basename "$CKPT")"
[[ -n "$VAE" ]] && ln -sf "$VAE"   "$VAE_DIR/"   && echo "VAE linked       → $(basename "$VAE")"

echo -e "\nRestarting SwarmUI...\n"

# systemd service
if systemctl is-active --quiet swarmui 2>/dev/null; then
    sudo systemctl restart swarmui && echo "systemd service restarted"

# screen session
elif screen -ls | grep -q "swarmui"; then
    screen -S swarmui -X quit
    cd "$SWARM" && screen -dmS swarmui bash -c './launch-linux.sh'
    echo "screen session restarted"

# tmux session
elif tmux has-session -t swarmui 2>/dev/null; then
    tmux kill-session -t swarmui
    cd "$SWARM" && tmux new -d -s swarmui './launch-linux.sh'
    echo "tmux session restarted"

# fallback – just kill any running SwarmUI and restart
else
    pkill -f "SwarmUI" || true
    cd "$SWARM" && nohup ./launch-linux.sh >/dev/null 2>&1 &
    echo "SwarmUI restarted in background"
fi

echo -e "\nFinished! Your models are in and SwarmUI is restarting.\nWait 15 seconds then refresh the web page."
