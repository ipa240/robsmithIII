# Discord SwarmUI Image Generator Bot

This Discord bot integrates with your **local SwarmUI installation** to generate AI images directly from Discord commands.

## Features

- 🎨 Generate AI images from text prompts
- ⚙️ Advanced mode with custom parameters (resolution, steps, CFG scale)
- 🔄 Automatic session management
- 📊 Real-time status updates
- 💯 **100% FREE** - No API costs (uses your local SwarmUI)

## Prerequisites

1. **SwarmUI installed and running** on `http://localhost:7801`
   - You should already have this from our previous setup!
   - If not running, start it before launching the bot

2. **Discord Bot Token**
   - Already configured in `.env` file ✅

3. **Python packages** (already installed)
   - discord.py
   - requests
   - python-dotenv

## Setup Complete! 🎉

Everything is already configured. Your bot is ready to run!

## Running the Bot

```bash
python3 discord_swarm_bot.py
```

Or use the convenience script:
```bash
./start_bot.sh
```

## Discord Commands

Once your bot is running and invited to your server:

### Basic Image Generation
```
!generate <prompt>
!gen <prompt>
!img <prompt>
```

**Example:**
```
!gen a beautiful sunset over mountains
!img a cyberpunk city at night, neon lights
```

### Advanced Image Generation
```
!genadvanced <width> <height> <steps> <cfg> <prompt>
!genadv <width> <height> <steps> <cfg> <prompt>
```

**Example:**
```
!genadv 512 768 30 7.5 a majestic dragon flying
!genadv 1024 1024 40 8 portrait of a warrior
```

**Parameters:**
- `width/height`: 256-2048 (recommended: 512, 768, 1024)
- `steps`: 1-100 (higher = better quality but slower)
- `cfg`: 1-30 (CFG scale, 7-8 recommended)

### Bot Information
```
!swarminfo
!info
```
Shows bot status and available commands

### Reconnect to SwarmUI
```
!reconnect
```
Reconnects to SwarmUI if connection was lost

## Default Settings

- **Resolution:** 1024x1024
- **Steps:** 20
- **CFG Scale:** 7.5
- **Seed:** Random

## Inviting the Bot to Your Server

1. Go to https://discord.com/developers/applications
2. Select your application (ID: 1440712479574331442)
3. Go to "OAuth2" > "URL Generator"
4. Select scopes: `bot`
5. Select permissions:
   - Send Messages
   - Attach Files
   - Read Messages/View Channels
   - Read Message History
6. Copy the generated URL and open it in your browser
7. Select the server you want to add the bot to

## Architecture

```
Discord User → Discord Bot → SwarmUI API (localhost:7801) → Generated Image → Discord
```

The bot:
1. Receives your prompt from Discord
2. Calls your local SwarmUI API
3. Waits for image generation (30-120 seconds)
4. Downloads the generated image
5. Posts it back to Discord

## Troubleshooting

### "Could not connect to SwarmUI"
- Make sure SwarmUI is running on port 7801
- Check: `curl http://localhost:7801`
- Restart SwarmUI if needed

### "Image generation timed out"
- Complex prompts or high step counts can take longer
- Try reducing steps or resolution
- Check SwarmUI logs for errors

### Bot doesn't respond
- Make sure "Message Content Intent" is enabled in Discord Developer Portal
- Check bot has proper permissions in your server
- Look at terminal output for error messages

## Files

- `discord_swarm_bot.py` - Main bot code
- `.env` - Your Discord token (keep secret!)
- `.gitignore` - Protects your credentials from git
- `start_bot.sh` - Quick start script
- `README_DISCORD_SWARM.md` - This file

## Security Notes

⚠️ **IMPORTANT:**
- Never commit `.env` file to git (it's in .gitignore)
- Don't share your Discord token publicly
- Consider regenerating your token periodically

## Cost

**$0.00** - Everything runs locally on your machine!
- No OpenAI API costs
- No cloud service fees
- Only electricity for your GPU

---

## Quick Start Checklist

- [x] SwarmUI installed at `/home/ian/SwarmUI`
- [x] SwarmUI running on port 7801
- [x] Discord bot created and configured
- [x] Discord token saved in `.env`
- [x] Python packages installed
- [x] Bot code created

**You're ready to go!** Run: `python3 discord_swarm_bot.py`
