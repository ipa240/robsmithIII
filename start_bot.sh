#!/bin/bash

echo "==================================="
echo "Discord SwarmUI Image Generator Bot"
echo "==================================="
echo ""

# Check if SwarmUI is running
echo "Checking if SwarmUI is running on port 7801..."
if curl -s http://localhost:7801/API/GetNewSession > /dev/null 2>&1; then
    echo "✅ SwarmUI is running!"
else
    echo "❌ WARNING: SwarmUI doesn't appear to be running on port 7801"
    echo "   Please start SwarmUI before running the bot."
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "Starting Discord bot..."
echo "Press Ctrl+C to stop the bot"
echo ""

python3 discord_swarm_bot.py
