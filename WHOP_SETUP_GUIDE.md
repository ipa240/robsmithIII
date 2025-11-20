# 💰 Whop Integration Guide - Make Money with Your AI Image Bot

This guide shows you how to connect Whop to your Discord bot to monetize your AI image generation service.

---

## 🎯 What Whop Does

**Whop** automates everything:
1. Customer pays on Whop website
2. Whop automatically gives them a Discord role
3. Your bot sees the role and grants access
4. Whop handles payments, subscriptions, cancellations

**You just collect money!** 💵

---

## 📋 Step 1: Create Your Whop Account

1. Go to https://whop.com/
2. Click **"Sell on Whop"** or **"Get Started"**
3. Create your account
4. Verify your email

---

## 📦 Step 2: Create Your Product

1. Go to your Whop Dashboard
2. Click **"Create Product"** or **"New Product"**
3. Select **"Access Pass"** as the product type

### Product Setup:

**Product Name:** AI Image Generation Service

**Description:**
```
Generate AI images using our powerful local Stable Diffusion setup!

✅ Fast generation times
✅ High-quality images
✅ Multiple tiers available
✅ Discord bot integration
```

---

## 💵 Step 3: Create Your Pricing Tiers

Create **3 separate products** (one for each tier):

### Tier 1: Basic Member
- **Price:** $5/month (or $50/year)
- **Features:**
  - 10 images per day
  - Up to 768x768 resolution
  - 20 steps max
  - Access to basic generation commands

### Tier 2: Premium Member
- **Price:** $15/month (or $150/year)
- **Features:**
  - 50 images per day
  - Up to 1024x1024 resolution
  - 40 steps max
  - Advanced generation controls

### Tier 3: Unlimited Member
- **Price:** $25/month (or $250/year)
- **Features:**
  - Unlimited images
  - Up to 2048x2048 resolution
  - 100 steps max
  - Priority generation queue

---

## 🔗 Step 4: Connect Discord to Whop

### In Whop Dashboard:

1. Go to your product settings
2. Find **"Discord Integration"** or **"Connections"**
3. Click **"Connect Discord Server"**
4. You'll be redirected to Discord to authorize

### Authorize Whop Bot:

1. Select your Discord server
2. Authorize Whop's bot to join your server
3. Grant necessary permissions:
   - Manage Roles
   - View Channels
   - Send Messages

---

## 🎭 Step 5: Configure Role Mapping

For **each product** you created:

1. Go to product settings
2. Find **"Discord Role"** section
3. Select or create roles:
   - Basic product → **"Basic Member"** role
   - Premium product → **"Premium Member"** role
   - Unlimited product → **"Unlimited Member"** role

**IMPORTANT:** The role names MUST match exactly what's in your bot code:
- `Basic Member`
- `Premium Member`
- `Unlimited Member`

---

## ⚙️ Step 6: Update Bot Configuration

Your bot is already configured with these role names! The current settings:

```python
TIER_CONFIG = {
    "Basic Member": (10, 20, 768, "$5/month"),
    "Premium Member": (50, 40, 1024, "$15/month"),
    "Unlimited Member": (999999, 100, 2048, "$25/month"),
}
```

### To Change Role Names or Pricing:

Edit `/home/ian/discord_swarm_bot.py` lines 26-32:

```python
TIER_CONFIG = {
    "Your Custom Role Name": (daily_limit, max_steps, max_resolution, "price_display"),
}
```

---

## 🧪 Step 7: Test the Integration

### Create a Test Purchase:

1. In Whop dashboard, find **"Test Mode"**
2. Create a test purchase for yourself
3. Verify you receive the Discord role
4. Try running `!gen test image` in Discord
5. Verify the bot recognizes your tier

### What to Check:

✅ Role appears in Discord after purchase
✅ Bot shows your tier when you run a command
✅ Daily limits work correctly
✅ Resolution/step limits are enforced

---

## 📊 Step 8: Set Up Your Whop Storefront

### Customize Your Whop Page:

1. Go to **"Storefront Settings"**
2. Add your branding:
   - Logo
   - Banner image
   - Brand colors
   - Description

### Add Screenshots/Examples:

- Show example generated images
- Include feature comparisons
- Add testimonials (after you have customers)

### Create Your Whop Link:

You'll get a link like: `https://whop.com/your-product/`

**Update your bot** to use this link:

Edit line 200 and 282 in `discord_swarm_bot.py`:

Replace `[Your Whop Link]` with your actual Whop URL.

---

## 💳 Step 9: Payment Setup

### Connect Your Payment Method:

1. Go to **"Settings"** → **"Payouts"**
2. Connect Stripe or PayPal
3. Enter your tax information
4. Set up automatic payouts

### Whop Fees:

- Whop takes a **30% + $0.30** per transaction fee
- You keep 70% of each sale
- Example: $10 sale = $7 to you, $3 to Whop

---

## 🚀 Step 10: Launch!

### Final Checklist:

- [ ] Whop products created for all 3 tiers
- [ ] Discord server connected to Whop
- [ ] Role mapping configured correctly
- [ ] Bot code updated with your Whop link
- [ ] Payment method connected
- [ ] Test purchase completed successfully
- [ ] Bot responding with correct tier limits

### Go Live:

1. Turn off "Test Mode" in Whop
2. Share your Whop link with customers
3. Promote on social media, Reddit, Discord servers
4. Watch the sales roll in! 💰

---

## 📈 Marketing Your Service

### Where to Promote:

- Twitter/X (#AIart, #StableDiffusion)
- Reddit (r/StableDiffusion, r/aiArt)
- Discord servers (AI art communities)
- TikTok (show off generated images)
- Instagram (showcase your best generations)

### Marketing Tips:

1. **Free tier** - Offer 1-2 free images to hook users
2. **Showcase quality** - Post your best generations
3. **Fast turnaround** - Emphasize local generation speed
4. **Reliability** - Highlight uptime and availability
5. **Support** - Offer great customer service

---

## 🛠️ Advanced: Whop Webhooks (Optional)

For more advanced tracking, set up Whop webhooks:

1. Go to Whop → **"Developers"** → **"Webhooks"**
2. Add webhook URL (you'd need to set up a web server)
3. Listen for events:
   - `membership.went_valid` - New customer
   - `membership.went_invalid` - Cancellation
   - `payment.succeeded` - Successful payment

This lets you:
- Send welcome messages
- Track metrics
- Log all transactions
- Auto-respond to cancellations

---

## 🔐 Security Notes

**Protect Your Setup:**

- Never share your Whop API keys
- Don't give admin access to random users
- Monitor for abuse (rate limiting, etc.)
- Keep your bot token secret
- Regular security audits

---

## 💡 Revenue Projections

### Conservative Estimates:

| Tier | Price | Users | Monthly Revenue |
|------|-------|-------|----------------|
| Basic | $5 | 10 | $50 |
| Premium | $15 | 5 | $75 |
| Unlimited | $25 | 2 | $50 |
| **Total** | | **17** | **$175/mo** |

**After Whop fees (30%):** ~$122/month profit

### Growth Scenario:

With marketing and good service, reaching 100 users could net you **$700-1000/month**!

---

## 📞 Support

**Whop Support:** https://whop.com/support
**Discord Developer Docs:** https://discord.com/developers/docs

**Bot Issues:**
- Check console logs
- Verify role names match exactly
- Ensure SERVER MEMBERS INTENT is enabled

---

## 🎉 You're Ready!

Your bot now:
✅ Checks user roles from Whop
✅ Enforces tier limits automatically
✅ Tracks daily usage
✅ Shows professional error messages
✅ Ready to make money!

**Next step:** Enable SERVER MEMBERS INTENT and start the bot!
