# Final Setup Step - Enable Message Content Intent

## ⚠️ IMPORTANT: One More Step Required!

Your Discord bot needs **Message Content Intent** enabled to read messages. This is a quick 30-second fix in the Discord Developer Portal.

## Steps to Enable Message Content Intent

1. **Go to Discord Developer Portal:**
   https://discord.com/developers/applications/1440712479574331442

2. **Navigate to the "Bot" section** (left sidebar)

3. **Scroll down to "Privileged Gateway Intents"**

4. **Enable these toggles:**
   - ✅ **MESSAGE CONTENT INTENT** (THIS IS REQUIRED!)
   - ✅ **SERVER MEMBERS INTENT** (optional, but recommended)
   - ✅ **PRESENCE INTENT** (optional)

5. **Click "Save Changes"** at the bottom

6. **That's it!** Now you can run the bot.

## After Enabling, Start the Bot

```bash
python3 discord_swarm_bot.py
```

Or use the convenience script:
```bash
./start_bot.sh
```

## Invite the Bot to Your Server

If you haven't already, use this URL to invite your bot:

1. Go to "OAuth2" > "URL Generator" in the Developer Portal
2. Select scopes: `bot`
3. Select permissions:
   - ✅ Send Messages
   - ✅ Attach Files
   - ✅ Read Messages/View Channels
   - ✅ Read Message History
   - ✅ Use Slash Commands (optional)
4. Copy the generated URL
5. Open it in your browser and select your server

## Test the Bot

Once the bot is running and invited:

```
!gen a beautiful sunset
!info
```

## Full Setup Status

- [x] SwarmUI installed and running on port 7801
- [x] Discord bot created (App ID: 1440712479574331442)
- [x] Discord.py installed
- [x] Bot code created (discord_swarm_bot.py)
- [x] .env file with Discord token
- [x] .gitignore protecting credentials
- [ ] **Message Content Intent enabled** ← YOU NEED TO DO THIS!
- [ ] **Bot invited to your server**
- [ ] **Bot running**

## Quick Links

- Developer Portal: https://discord.com/developers/applications/1440712479574331442
- Your Bot Settings: https://discord.com/developers/applications/1440712479574331442/bot

---

**After enabling Message Content Intent, the bot will work perfectly!**
