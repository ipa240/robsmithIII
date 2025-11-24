#!/bin/bash
# Quick start script for the human-like clickworker agent

echo "=========================================="
echo "  CLICKWORKER TESTING AGENT"
echo "=========================================="
echo ""
echo "This agent will:"
echo "  • Navigate your jobs page"
echo "  • Find available jobs"
echo "  • Read instructions intelligently"
echo "  • Fill out forms, answer questions"
echo "  • Check checkboxes, select options"
echo "  • Complete tasks like a real human"
echo "  • Submit results automatically"
echo ""
echo "Press Ctrl+C to stop at any time"
echo "Or move mouse to top-left corner for emergency stop"
echo ""
echo "Starting in 3 seconds..."
sleep 3

export DISPLAY=:1
cd /home/ian/clickworker-agent
python3 human-agent.py
