# Human-Like Clickworker Testing Agent

## Quick Start

```bash
cd /home/ian/clickworker-agent
./START_AGENT.sh
```

## What It Does

This intelligent agent acts like a **real person** testing your clickworker website:

### Capabilities

1. **Navigates Jobs Page**
   - Finds "Find Jobs", "Available Jobs", "Start Task" buttons
   - Selects jobs to test

2. **Reads & Understands Tasks**
   - Uses OCR to extract text from screen
   - Uses AI vision to understand what's being asked
   - Simulates natural reading time (based on word count)

3. **Completes Tasks Intelligently**
   - **Answers Questions**: Uses AI to generate natural, intelligent answers
   - **Fills Text Fields**: Enters appropriate data based on field labels
   - **Checks Checkboxes**: Identifies and clicks relevant checkboxes
   - **Selects Radio Buttons**: Makes appropriate selections
   - **Uses Dropdowns**: Selects correct options from dropdowns
   - **Clicks Images/Buttons**: Interacts with visual elements

4. **Acts Human-Like**
   - Realistic mouse movements (curved paths, not straight lines)
   - Natural typing speed with occasional typos + corrections
   - Reading delays based on content length
   - Thinking pauses before decisions
   - Variable timing (never robotic)

5. **Submits & Repeats**
   - Finds and clicks Submit/Next/Continue buttons
   - Returns to find more jobs
   - Continuous testing loop

## Controls

- **Stop**: Press `Ctrl+C` in terminal
- **Emergency Stop**: Move mouse to top-left corner
- **Restart**: Just run `./START_AGENT.sh` again

## Features

### OCR Text Reading
- Extracts ALL text from screen
- Finds clickable elements by text content
- Understands page structure

### Vision AI
- Analyzes screenshots to understand context
- Identifies form elements automatically
- Makes intelligent decisions about what to click

### Intelligent Question Answering
- Reads question text
- Generates contextually appropriate answers
- Responds naturally like a real person

## Requirements

- ✓ Ollama with llava:7b model (installed)
- ✓ OCR (tesseract) (installed)
- ✓ Python packages (installed)
- ✓ X Display :1 (active)

## Logs

The agent provides detailed logging:
- ℹ Info - General status
- ✓ Success - Completed actions
- ✗ Error - Problems encountered
- 💭 Thinking - Processing/analyzing
- → Action - Doing something

## Tips

1. **First Time**: Let it run for 2-3 minutes to see how it navigates
2. **Stuck?**: It will auto-recover after 5 attempts or refresh the page
3. **Too Fast/Slow?**: Timings are randomized for realism
4. **Open Your Website**: Make sure your jobs page is open in a browser before starting

## Advanced

The agent uses a state machine:
- `FINDING_JOB` - Looking for available jobs
- `READING_TASK` - Understanding task requirements
- `COMPLETING_TASK` - Filling forms, clicking, typing

## Files

- `human-agent.py` - Main intelligent agent
- `START_AGENT.sh` - Easy launcher
- `agent.py` - Simple version (older)
- `smart-agent.py` - Mid-tier version
