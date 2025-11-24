# Clickworker Agent

Desktop automation agent using llava:7b vision model for internal testing workflows.

## Quick Start

```bash
cd /home/ian/clickworker-agent
./run-agent.sh
```

Or manually:
```bash
DISPLAY=:1 python3 agent.py
```

Press **Ctrl+C** to stop the agent.

## What It Does

- Captures desktop screenshots every few seconds
- Analyzes them with llava:7b vision model
- Executes human-like mouse/keyboard actions
- Actions: click, type, scroll, refresh, wait

## Files

- `agent.py` - Main agent script
- `run-agent.sh` - Helper script to run with correct DISPLAY
- `test-agent.py` - Diagnostic test script
- `setup-autostart.sh` - (Optional) Setup systemd auto-start

## Requirements

- Ollama with llava:7b model
- Python packages: pyautogui, ollama, opencv-python, pillow
- X display (:1)

## Troubleshooting

If agent hangs or errors:
1. Kill SwarmUI to free GPU memory: `pkill -f SwarmUI`
2. Check ollama is running: `ollama list`
3. Verify DISPLAY: `echo $DISPLAY` (should be :1)
4. Run test: `DISPLAY=:1 python3 debug-test.py`

## Performance

- Screenshot capture: ~instant
- Vision model inference: 1-7 seconds per frame
- Actions execute with human-like timing (0.4-8 second delays)
