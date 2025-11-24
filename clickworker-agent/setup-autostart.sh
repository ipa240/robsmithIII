#!/bin/bash
# Setup script for clickworker agent auto-start

echo "Creating systemd service..."
sudo tee /etc/systemd/system/clickworker.service > /dev/null <<'EOF'
[Unit]
Description=Desktop Automation Agent for Internal Testing
After=graphical-session.target

[Service]
Type=simple
User=ian
Environment="DISPLAY=:0"
Environment="XAUTHORITY=/home/ian/.Xauthority"
ExecStart=/usr/bin/python3 /home/ian/clickworker-agent/agent.py
Restart=always
RestartSec=15

[Install]
WantedBy=graphical-session.target
EOF

echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

echo "Enabling clickworker service..."
sudo systemctl enable clickworker.service

echo ""
echo "✓ Setup complete!"
echo ""
echo "To start the agent now: sudo systemctl start clickworker"
echo "To check status: sudo systemctl status clickworker"
echo "To stop: sudo systemctl stop clickworker"
echo "To view logs: journalctl -u clickworker -f"
