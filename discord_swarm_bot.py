import discord
from discord.ext import commands
from discord.ui import View, Button
import os
import sys
import requests
import json
from dotenv import load_dotenv
from io import BytesIO
import asyncio
import time
from collections import defaultdict

# Force stdout to flush immediately for better logging
sys.stdout.reconfigure(line_buffering=True)

# Load environment variables from .env file
load_dotenv()

# Initialize Discord bot
intents = discord.Intents.default()
intents.message_content = True
intents.members = True  # Required to read user roles
bot = commands.Bot(command_prefix='!', intents=intents)

# SwarmUI API Configuration
SWARM_API_URL = "http://localhost:7801"
swarm_session_id = None

# Ollama API Configuration for prompt enhancement
OLLAMA_API_URL = "http://192.168.0.105:11434"
OLLAMA_MODEL = "llama3.1:8b"  # Using llama3.1 8B model

# ═══════════════════════════════════════════════════════════════
# QUEUE & RATE LIMITING SYSTEM
# ═══════════════════════════════════════════════════════════════

# Generation queue to prevent GPU overload
generation_queue = asyncio.Queue()
active_generations = 0
MAX_CONCURRENT_GENERATIONS = 1  # Process one image at a time (prevents GPU OOM)

# Per-user cooldowns to prevent spam
user_last_request = defaultdict(float)
COOLDOWN_SECONDS = 5  # 5 second cooldown between requests per user

# Track stuck tasks
active_tasks = {}  # user_id: task_start_time

# Tier Configuration - Map Discord role names to generation limits
# These role names should match what Whop assigns when users purchase
TIER_CONFIG = {
    # Role name: (generations_per_day, max_steps, max_resolution, price_display, has_privacy)
    "free-trial": (3, 20, 1024, "Free", False),                     # Free trial tier - PUBLIC
    "Basic $19": (25, 30, 1024, "$19/month", True),                 # Basic tier - PRIVATE
    "Unlimited $39": (75, 50, 1536, "$39/month", True),             # Premium tier - PRIVATE
    "VIP $99": (999999, 100, 2048, "$99/month", True),              # VIP tier - PRIVATE
}

# Priority order - if user has multiple roles, use the highest tier
TIER_PRIORITY = ["VIP $99", "Unlimited $39", "Basic $19", "free-trial"]

# Privacy settings
PRIVACY_ENABLED = True  # Set to False to disable privacy features

# Track usage per user per day (in production, use a database)
user_usage = {}

def get_swarm_session():
    """Get or refresh SwarmUI session ID"""
    global swarm_session_id
    try:
        response = requests.post(
            f"{SWARM_API_URL}/API/GetNewSession",
            headers={"Content-Type": "application/json"},
            json={}
        )
        data = response.json()
        swarm_session_id = data.get("session_id")
        return swarm_session_id
    except Exception as e:
        print(f"Error getting Swarm session: {e}")
        return None

async def get_user_tier(member):
    """Get the highest tier based on user's Discord roles"""
    if not member:
        return None, None, None

    # Force fetch the member to ensure we have latest role data
    try:
        if hasattr(member, 'guild'):
            fresh_member = await member.guild.fetch_member(member.id)
            member = fresh_member
    except:
        pass  # Use cached member if fetch fails

    user_role_names = [role.name for role in member.roles]

    print(f"DEBUG: Fetching roles for {member.name}")
    print(f"DEBUG: Found roles: {user_role_names}")

    # Check roles in priority order (highest tier first)
    for tier_name in TIER_PRIORITY:
        if tier_name in user_role_names:
            settings = TIER_CONFIG[tier_name]
            return tier_name, settings, user_role_names

    # No tier role found - AUTO-ASSIGN free-trial
    print(f"⚠️ User {member.name} has no tier, attempting to auto-assign free-trial...")

    try:
        free_trial_role = discord.utils.get(member.guild.roles, name="free-trial")
        if free_trial_role:
            await member.add_roles(free_trial_role)
            print(f"✅ Auto-assigned free-trial to {member.name}")

            # Update roles list and return free-trial settings
            user_role_names.append("free-trial")
            settings = TIER_CONFIG["free-trial"]
            return "free-trial", settings, user_role_names
        else:
            print(f"❌ free-trial role not found in server!")
    except Exception as e:
        print(f"❌ Failed to auto-assign free-trial to {member.name}: {e}")

    # Still no tier role found
    return None, None, user_role_names

def check_user_limit(user_id, tier_name, tier_settings):
    """Check if user has remaining generations for the day"""
    if not tier_settings:
        return False, "No tier role found. Purchase a plan at [Your Whop Link]"

    daily_limit = tier_settings[0]
    today = str(discord.utils.utcnow().date())
    key = f"{user_id}_{tier_name}_{today}"

    current_usage = user_usage.get(key, 0)

    if current_usage >= daily_limit:
        return False, f"Daily limit reached ({daily_limit} images/day)"

    return True, current_usage

def increment_usage(user_id, tier_name):
    """Increment user's usage count"""
    today = str(discord.utils.utcnow().date())
    key = f"{user_id}_{tier_name}_{today}"
    user_usage[key] = user_usage.get(key, 0) + 1

# ═══════════════════════════════════════════════════════════════
# QUEUE & RATE LIMITING FUNCTIONS
# ═══════════════════════════════════════════════════════════════

def check_cooldown(user_id):
    """Check if user is on cooldown. Returns (allowed, seconds_remaining)"""
    current_time = time.time()
    last_request = user_last_request.get(user_id, 0)
    time_since_last = current_time - last_request

    if time_since_last < COOLDOWN_SECONDS:
        remaining = COOLDOWN_SECONDS - time_since_last
        return False, int(remaining) + 1

    return True, 0

def update_cooldown(user_id):
    """Update user's last request time"""
    user_last_request[user_id] = time.time()

async def cleanup_stuck_tasks():
    """Clean up tasks that have been running too long (10+ minutes)"""
    current_time = time.time()
    stuck_threshold = 600  # 10 minutes

    stuck_users = []
    for user_id, start_time in list(active_tasks.items()):
        if current_time - start_time > stuck_threshold:
            stuck_users.append(user_id)
            del active_tasks[user_id]
            print(f"⚠️ Cleaned up stuck task for user {user_id} (running {int((current_time - start_time) / 60)} minutes)")

    return stuck_users

async def process_generation_queue():
    """Background task to process generation queue"""
    global active_generations

    while True:
        try:
            # Clean up stuck tasks every loop
            await cleanup_stuck_tasks()

            # Check if we can process more generations
            if active_generations >= MAX_CONCURRENT_GENERATIONS:
                await asyncio.sleep(2)
                continue

            # Get next item from queue (wait max 1 second)
            try:
                task = await asyncio.wait_for(generation_queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue

            # Process the task
            active_generations += 1
            asyncio.create_task(task)

        except Exception as e:
            print(f"❌ Queue processor error: {e}")
            await asyncio.sleep(1)

def parse_public_flag(prompt):
    """Check if prompt contains --public flag and remove it"""
    if "--public" in prompt.lower():
        # Remove the --public flag from the prompt
        cleaned_prompt = prompt.replace("--public", "").replace("--PUBLIC", "").strip()
        return cleaned_prompt, True
    return prompt, False

async def send_generated_image(ctx, image_bytes, filename, tier_name, tier_settings, prompt, model_name="", extra_info="", force_public=False):
    """Send generated image - privately to DM by default, or publicly if force_public=True"""
    file = discord.File(fp=image_bytes, filename=filename)

    # By default, send privately. Only send publicly if force_public=True
    is_private = not force_public

    if is_private:
        # Send to DM (default behavior)
        try:
            dm_embed = discord.Embed(
                title="🔒 Your Private Generation",
                description=f"**Tier:** {tier_name}",
                color=discord.Color.green()
            )

            dm_embed.add_field(
                name="💡 Prompt",
                value=f"`{prompt[:500]}`",
                inline=False
            )

            if model_name:
                dm_embed.add_field(
                    name="🎨 Model",
                    value=model_name,
                    inline=True
                )

            if extra_info:
                dm_embed.add_field(
                    name="⚙️ Settings",
                    value=extra_info,
                    inline=True
                )

            dm_embed.set_footer(text="Private generation • Only you can see this • Use --public flag to post in channel")

            await ctx.author.send(embed=dm_embed, file=file)

            # Send public confirmation (without image)
            public_embed = discord.Embed(
                title="✅ Image Generated",
                description=f"**{ctx.author.display_name}**, your image has been sent to your DMs! 🔒",
                color=discord.Color.blue()
            )
            public_embed.set_footer(text=f"{tier_name} • Private Generation • Add --public to your prompt to share publicly")

            await ctx.send(embed=public_embed)

            print(f'✅ Private image sent to {ctx.author.name} ({tier_name})')
            return True

        except discord.Forbidden:
            # User has DMs disabled - fall back to public
            await ctx.send(
                f"⚠️ **{ctx.author.mention}** I couldn't DM you! Posting publicly instead.\n"
                f"To enable private DMs: Server Settings → Privacy & Safety → Allow direct messages from server members"
            )
            # Send publicly as fallback
            fallback_file = discord.File(fp=image_bytes, filename=filename)
            await ctx.send(content=f"✅ Generated for **{ctx.author.display_name}**: `{prompt[:200]}`", file=fallback_file)
            return True
    else:
        # Send publicly (user requested with --public flag)
        public_embed = discord.Embed(
            title="🎨 Public Generation",
            description=f"Generated for **{ctx.author.display_name}**",
            color=discord.Color.gold()
        )

        public_embed.add_field(
            name="💡 Prompt",
            value=f"`{prompt[:500]}`",
            inline=False
        )

        if model_name:
            public_embed.add_field(
                name="🎨 Model",
                value=model_name,
                inline=True
            )

        if extra_info:
            public_embed.add_field(
                name="⚙️ Settings",
                value=extra_info,
                inline=True
            )

        public_embed.set_footer(text="Public Generation • Remove --public flag for private DM delivery")

        await ctx.send(embed=public_embed, file=file)

        print(f'✅ Public image generated for {ctx.author.name} (--public flag)')
        return True

def enhance_prompt(basic_prompt, style="realistic"):
    """Use Ollama to enhance a basic prompt for better image generation"""
    try:
        system_prompt = f"""You are an expert AI image prompt engineer. Take simple ideas and create detailed, comma-separated prompts for Stable Diffusion.

Style: {style}

RULES:
- Use COMMA-SEPARATED format (tags, not full sentences)
- If input mentions a CELEBRITY, include their actual physical features (hair color, eye color, etc.)
- Be descriptive with visual details (lighting, mood, colors, pose, expression)
- Add technical terms (lens, aperture, lighting) when relevant
- Include quality tags at end: "professional photography, high detail, 8k, masterpiece quality"
- Keep under 150 words
- NO explanations, just output the enhanced comma-separated prompt

Example 1:
Input: "a woman"
Output: "beautiful woman, flowing auburn hair, soft natural lighting, gentle smile, elegant dress, sun-dappled garden, professional photography, bokeh background, 8k, high detail, masterpiece quality"

Example 2:
Input: "Ryan Gosling"
Output: "Ryan Gosling, blonde hair short, blue eyes, chiseled jawline, light stubble, confident expression, casual white t-shirt, leather jacket, urban background, natural lighting, cinematic photography, 50mm lens, f/2.8, high detail, professional quality"

Now enhance this prompt:"""

        response = requests.post(
            f"{OLLAMA_API_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": f"{system_prompt}\n\nInput: {basic_prompt}",
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9
                }
            },
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()
            enhanced = data.get("response", "").strip()
            # Remove any "Output:" prefix if the model added it
            enhanced = enhanced.replace("Output:", "").strip()
            return enhanced if enhanced else basic_prompt
        else:
            return basic_prompt

    except Exception as e:
        print(f"Ollama enhancement failed: {e}")
        return basic_prompt

def create_perfect_script(user_idea, style="photorealistic"):
    """Create a perfect, ultra-detailed script/prompt from a simple idea"""
    try:
        system_prompt = f"""You are an expert AI image prompt engineer specializing in comma-separated tag format for Stable Diffusion. Create detailed, optimized prompts from basic ideas.

IMPORTANT INSTRUCTIONS:
1. Use COMMA-SEPARATED format (like tags, not sentences)
2. If the input mentions a CELEBRITY or famous person, include their ACTUAL physical features (hair color, eye color, facial features, typical style)
3. Be SPECIFIC and DETAILED with visual descriptions
4. Include all relevant details for {style} images

STRUCTURE (all separated by commas):
- Subject details (age, gender, specific features, hair, eyes, skin, expression, pose)
- Clothing/appearance (detailed description of outfit, accessories)
- Setting/environment (location, background elements, props)
- Lighting (type, direction, quality, color, mood)
- Camera/technical (angle, lens, aperture, focus)
- Style/quality tags (artistic style, mood, quality descriptors)

CELEBRITY HANDLING:
If input mentions a celebrity (like "Margot Robbie", "Ryan Gosling", etc.):
- Add their real physical features (e.g., "blonde hair", "blue eyes", "sharp jawline")
- Include their typical style or iconic look
- Be accurate to their actual appearance

Example 1 (general):
Input: "woman beach"
Output: "woman, 25 years old, sun-kissed tan skin, long blonde hair flowing in wind, bright blue eyes, gentle smile, serene expression, white flowing sundress, barefoot, standing on pristine tropical beach, golden hour sunset, warm amber lighting, pink and orange sky, ocean waves in background, 85mm lens, f/1.8, shallow depth of field, professional photography, cinematic composition, soft bokeh, high detail, 8k resolution, masterpiece quality"

Example 2 (celebrity):
Input: "Margot Robbie in Times Square"
Output: "Margot Robbie, blonde hair shoulder-length, blue eyes, fair skin, natural makeup, confident smile, wearing stylish black leather jacket, white t-shirt, blue jeans, standing in Times Square New York, bright neon signs background, bustling city atmosphere, evening lighting, colorful billboards, urban setting, 50mm lens, f/2.8, street photography style, vibrant colors, sharp focus, photorealistic, high detail, professional photography, 8k"

Now create the PERFECT comma-separated prompt for this idea:"""

        response = requests.post(
            f"{OLLAMA_API_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": f"{system_prompt}\n\nInput: {user_idea}",
                "stream": False,
                "options": {
                    "temperature": 0.8,
                    "top_p": 0.95,
                    "num_predict": 400
                }
            },
            timeout=45
        )

        if response.status_code == 200:
            data = response.json()
            script = data.get("response", "").strip()
            # Clean up any prefixes
            script = script.replace("Output:", "").strip()
            return script if script else user_idea
        else:
            return user_idea

    except Exception as e:
        print(f"Script creation failed: {e}")
        return user_idea

class SubscribeView(View):
    """View with payment link buttons"""
    def __init__(self):
        super().__init__(timeout=None)  # Buttons never expire

        # Basic Access Button
        basic_button = Button(
            label="Basic Access - $19/mo",
            style=discord.ButtonStyle.primary,
            url="https://whop.com/jredrocket/basic-access-99-93ad/"
        )
        self.add_item(basic_button)

        # Unlimited + Gallery Button
        unlimited_button = Button(
            label="Unlimited + Gallery - $39/mo",
            style=discord.ButtonStyle.primary,
            url="https://whop.com/jredrocket/unlimited-gallery/"
        )
        self.add_item(unlimited_button)

        # VIP Priority + Customs Button
        vip_button = Button(
            label="VIP Priority + Customs - $99/mo",
            style=discord.ButtonStyle.success,
            url="https://whop.com/jredrocket/vip-priority-customs/"
        )
        self.add_item(vip_button)

def generate_image(prompt, width=1216, height=832, steps=50, cfg_scale=6.5, negative_prompt=None, upscale=True, model=None):
    """Generate an image using SwarmUI"""
    global swarm_session_id

    # Get session if we don't have one
    if not swarm_session_id:
        get_swarm_session()

    try:
        # Use specified model or default to AutismMix
        if model is None:
            model = "autismmixSDXL_autismmixPony.safetensors"

        default_model = model

        # Default negative prompt if not provided
        if negative_prompt is None:
            negative_prompt = "cartoon, anime, painting, 3d, plastic skin, doll, blurry, lowres, deformed, bad anatomy, watermark"

        request_data = {
            "session_id": swarm_session_id,
            "images": 1,
            "prompt": prompt,
            "negativeprompt": negative_prompt,
            "width": width,
            "height": height,
            "steps": steps,
            "cfgscale": cfg_scale,
            "sampler": "dpmpp_2m_sde_gpu",
            "scheduler": "karras",
            "seed": -1,  # Random seed
            "model": default_model,
            "loras": "<lora:lora:1.0>"  # Apply lora.safetensors to all generations
        }

        # Add upscaling if enabled (smart upscaling based on resolution)
        if upscale:
            # Calculate max dimension
            max_dim = max(width, height)

            # VERY conservative upscaling to prevent GPU OOM errors
            # - Small images (< 832): 1.5x upscale
            # - Medium images (832-1024): 1.25x upscale
            # - Large images (> 1024): No upscale (prevents VRAM overload)

            if max_dim > 1024:
                # Skip upscaling to save VRAM
                print(f"DEBUG: Skipping upscale (image >= 1024px: {max_dim}px)")
                # Don't add upscaling parameters
            elif max_dim >= 832:
                # Medium size, use minimal 1.25x upscale
                request_data["dooverridehires"] = True
                request_data["hiresfix"] = True
                request_data["hiresmultiplier"] = 1.25
                request_data["hiresupscaler"] = "4x UltraSharp"
                request_data["hiresdenoise"] = 0.20
                print(f"DEBUG: Using 1.25x upscale (medium image: {max_dim}px)")
            else:
                # Small size, use 1.5x upscale
                request_data["dooverridehires"] = True
                request_data["hiresfix"] = True
                request_data["hiresmultiplier"] = 1.5
                request_data["hiresupscaler"] = "4x UltraSharp"
                request_data["hiresdenoise"] = 0.20
                print(f"DEBUG: Using 1.5x upscale (small image: {max_dim}px)")

        print(f"DEBUG: Generating with model: {default_model}")
        print(f"DEBUG: Request: {prompt} [{width}x{height}, {steps} steps, upscale: {upscale}]")

        response = requests.post(
            f"{SWARM_API_URL}/API/GenerateText2Image",
            headers={"Content-Type": "application/json"},
            json=request_data,
            timeout=300  # 5 minutes timeout for generation (upscaling takes longer)
        )

        data = response.json()

        # Check for errors
        if "error_id" in data:
            if data["error_id"] == "invalid_session_id":
                # Retry with new session
                get_swarm_session()
                return generate_image(prompt, width, height, steps, cfg_scale)
            return None, f"Error: {data.get('error', 'Unknown error')}"

        if "error" in data:
            return None, f"Error: {data['error']}"

        # Get image path from response
        if "images" in data and len(data["images"]) > 0:
            image_path = data["images"][0]
            image_url = f"{SWARM_API_URL}/{image_path}"
            return image_url, None

        return None, "No image generated"

    except requests.Timeout:
        return None, "Image generation timed out (took longer than 5 minutes)"
    except Exception as e:
        return None, f"Error generating image: {str(e)}"

@bot.event
async def on_ready():
    print("=" * 50)
    print(f'✅ BOT CONNECTED: {bot.user.name} (ID: {bot.user.id})')
    print(f'✅ SwarmUI API: {SWARM_API_URL}')
    print("=" * 50)

    # Initialize session
    if get_swarm_session():
        print(f'✅ SwarmUI Session: {swarm_session_id}')
    else:
        print('❌ WARNING: Could not connect to SwarmUI on port 7801')

    # List servers the bot is in
    print(f'\n📋 Connected to {len(bot.guilds)} server(s):')
    for guild in bot.guilds:
        print(f'   - {guild.name} (ID: {guild.id})')

    print(f'\n🎨 Whop Role-Based Tiers:')
    for tier, settings in TIER_CONFIG.items():
        print(f'   - {tier} ({settings[3]}): {settings[0]} imgs/day, {settings[1]} steps max, {settings[2]}px max')

    # Start queue processor
    asyncio.create_task(process_generation_queue())
    print(f'\n🔄 Generation queue processor started')
    print(f'   - Max concurrent generations: {MAX_CONCURRENT_GENERATIONS}')
    print(f'   - Per-user cooldown: {COOLDOWN_SECONDS} seconds')

    print(f'\n✅ Bot ready! Use !gen <prompt> in any channel')
    print("=" * 50)

@bot.event
async def on_member_join(member):
    """Automatically assign free-trial role when someone joins"""
    print(f'👋 New member joined: {member.name}')

    # Find the "free-trial" role
    free_trial_role = discord.utils.get(member.guild.roles, name="free-trial")

    if free_trial_role:
        try:
            await member.add_roles(free_trial_role)
            print(f'✅ Assigned free-trial role to {member.name}')

            # Send welcome DM
            try:
                await member.send(
                    f"🎨 **Welcome to Uncensored AI Art Lab!**\n\n"
                    f"You've been given **3 free images** to try out our AI image generator!\n\n"
                    f"**How to use:**\n"
                    f"• Go to any channel you can access\n"
                    f"• Type `!gen <your prompt>` (example: `!gen a beautiful sunset`)\n"
                    f"• Type `!subscribe` to see paid plans for unlimited access\n\n"
                    f"Enjoy your free trial!"
                )
            except:
                pass  # User has DMs disabled
        except Exception as e:
            print(f'❌ Could not assign free-trial role to {member.name}: {e}')
    else:
        print(f'⚠️  Warning: "free-trial" role not found in server')

@bot.event
async def on_message(message):
    # Log all messages for debugging
    if message.author != bot.user and not message.content.startswith('!'):
        print(f'💬 Message from {message.author.name} in #{message.channel.name}: {message.content[:50]}...')

    # Process commands
    await bot.process_commands(message)

@bot.command(name='generate', aliases=['gen', 'img', 'image'])
async def generate_command(ctx, *, prompt: str):
    """Generate an image from a text prompt

    Usage: !generate a beautiful sunset over mountains
    Add --public to post in channel instead of DM
    """
    # Check for --public flag
    cleaned_prompt, is_public = parse_public_flag(prompt)

    print(f'🎨 Command: !gen from {ctx.author.name} in #{ctx.channel.name}: {cleaned_prompt} (public={is_public})')

    # Get user's tier based on their Discord roles
    tier_name, tier_settings, user_roles = await get_user_tier(ctx.author)

    if not tier_settings:
        embed = discord.Embed(
            title="❌ No Access - Subscription Required",
            description="You need an active subscription to generate AI images!",
            color=discord.Color.red()
        )

        embed.add_field(
            name="Basic Access - $19/month",
            value="25 images/day • Up to 1024px • 30 steps max",
            inline=False
        )

        embed.add_field(
            name="Unlimited + Gallery - $39/month",
            value="75 images/day • Up to 1536px • 50 steps max",
            inline=False
        )

        embed.add_field(
            name="VIP Priority + Customs - $99/month",
            value="Unlimited images • Up to 2048px • 100 steps max",
            inline=False
        )

        embed.set_footer(text="Click a button below to get started!")

        view = SubscribeView()
        await ctx.send(embed=embed, view=view)
        print(f'❌ User {ctx.author.name} has no tier role. Roles: {user_roles}')
        return

    # Check cooldown to prevent spam
    cooldown_ok, cooldown_remaining = check_cooldown(ctx.author.id)
    if not cooldown_ok:
        await ctx.send(f"⏱️ Slow down! Please wait **{cooldown_remaining} seconds** before generating again.")
        return

    # Check usage limits
    allowed, usage_info = check_user_limit(ctx.author.id, tier_name, tier_settings)
    if not allowed:
        await ctx.send(f"❌ {usage_info}\nUpgrade your tier or wait until tomorrow!")
        return

    # Show tier and remaining generations
    remaining = tier_settings[0] - usage_info if isinstance(usage_info, int) else "∞"
    await ctx.send(f"🎫 **{tier_name}** ({tier_settings[3]}) | Remaining: **{remaining}**")

    # Send initial "working on it" message
    status_msg = await ctx.send(f"🎨 Generating high-quality image with 2x upscaling: `{cleaned_prompt}`\nThis may take 1-3 minutes...")

    # Update cooldown and track task
    update_cooldown(ctx.author.id)
    active_tasks[ctx.author.id] = time.time()

    try:
        # Get default settings based on tier
        max_res = tier_settings[2]
        max_steps = tier_settings[1]
        width = min(1216, max_res)
        height = min(832, max_res)
        steps = min(50, max_steps)

        # Generate the image
        image_url, error = generate_image(cleaned_prompt, width, height, steps)

        if error:
            await status_msg.edit(content=f"❌ {error}")
            return

        if image_url:
            # Download the image
            response = requests.get(image_url, timeout=30)

            if response.status_code == 200:
                # Send the image (privately by default, publicly if --public flag)
                image_bytes = BytesIO(response.content)

                success = await send_generated_image(
                    ctx,
                    image_bytes,
                    "generated_image.png",
                    tier_name,
                    tier_settings,
                    cleaned_prompt,
                    model_name="AutismMix (Default)",
                    extra_info=f"{width}x{height}, {steps} steps",
                    force_public=is_public
                )

                if success:
                    await status_msg.delete()
                    increment_usage(ctx.author.id, tier_name)
            else:
                await status_msg.edit(content=f"❌ Could not download generated image (HTTP {response.status_code})")
        else:
            await status_msg.edit(content="❌ Image generation failed")

    except Exception as e:
        await status_msg.edit(content=f"❌ Error: {str(e)}")
    finally:
        # Clean up active task tracking
        if ctx.author.id in active_tasks:
            del active_tasks[ctx.author.id]

@bot.command(name='genadvanced', aliases=['genadv'])
async def generate_advanced(ctx, width: int, height: int, steps: int, cfg: float, *, prompt: str):
    """Generate an image with custom parameters

    Usage: !genadvanced 512 512 30 7.5 a beautiful landscape
    Add --public to post in channel instead of DM

    Parameters:
    - width: Image width (recommended: 512, 768, 1024)
    - height: Image height (recommended: 512, 768, 1024)
    - steps: Number of steps (10-50, higher = better quality but slower)
    - cfg: CFG scale (1-20, 7-8 recommended)
    - prompt: Your text prompt
    """
    # Check for --public flag
    cleaned_prompt, is_public = parse_public_flag(prompt)

    print(f'🎨 Command: !genadv from {ctx.author.name} in #{ctx.channel.name}: {width}x{height}, {steps} steps (public={is_public})')

    # Get user's tier based on their Discord roles
    tier_name, tier_settings, user_roles = await get_user_tier(ctx.author)

    if not tier_settings:
        embed = discord.Embed(
            title="❌ No Access - Subscription Required",
            description="You need an active subscription to use advanced generation!",
            color=discord.Color.red()
        )

        embed.add_field(
            name="Basic Access - $19/month",
            value="25 images/day • Up to 1024px • 30 steps max",
            inline=False
        )

        embed.add_field(
            name="Unlimited + Gallery - $39/month",
            value="75 images/day • Up to 1536px • 50 steps max",
            inline=False
        )

        embed.add_field(
            name="VIP Priority + Customs - $99/month",
            value="Unlimited images • Up to 2048px • 100 steps max",
            inline=False
        )

        embed.set_footer(text="Click a button below to get started!")

        view = SubscribeView()
        await ctx.send(embed=embed, view=view)
        print(f'❌ User {ctx.author.name} has no tier role. Roles: {user_roles}')
        return

    # Check cooldown to prevent spam
    cooldown_ok, cooldown_remaining = check_cooldown(ctx.author.id)
    if not cooldown_ok:
        await ctx.send(f"⏱️ Slow down! Please wait **{cooldown_remaining} seconds** before generating again.")
        return

    # Check usage limits
    allowed, usage_info = check_user_limit(ctx.author.id, tier_name, tier_settings)
    if not allowed:
        await ctx.send(f"❌ {usage_info}\nUpgrade your tier or wait until tomorrow!")
        return

    # Check if parameters exceed tier limits
    max_res = tier_settings[2]
    max_steps = tier_settings[1]

    if width > max_res or height > max_res:
        await ctx.send(f"❌ Your tier (**{tier_name}**) allows max {max_res}x{max_res} resolution")
        return

    if steps > max_steps:
        await ctx.send(f"❌ Your tier (**{tier_name}**) allows max {max_steps} steps")
        return

    # Show remaining generations
    remaining = tier_settings[0] - usage_info if isinstance(usage_info, int) else "∞"
    await ctx.send(f"🎫 **{tier_name}** ({tier_settings[3]}) | Remaining: **{remaining}**")

    # Validate parameters
    if width < 256 or width > 2048 or height < 256 or height > 2048:
        await ctx.send("❌ Width and height must be between 256 and 2048")
        return

    if steps < 1 or steps > 100:
        await ctx.send("❌ Steps must be between 1 and 100")
        return

    if cfg < 1 or cfg > 30:
        await ctx.send("❌ CFG scale must be between 1 and 30")
        return

    # Send initial status
    status_msg = await ctx.send(
        f"🎨 Generating {width}x{height} image with {steps} steps and 2x upscaling...\n"
        f"Prompt: `{cleaned_prompt}`\n"
        f"This may take 1-3 minutes depending on parameters..."
    )

    try:
        # Generate the image
        image_url, error = generate_image(cleaned_prompt, width, height, steps, cfg)

        if error:
            await status_msg.edit(content=f"❌ {error}")
            return

        if image_url:
            # Download the image
            response = requests.get(image_url, timeout=30)

            if response.status_code == 200:
                # Send the image (privately by default, publicly if --public flag)
                image_bytes = BytesIO(response.content)

                success = await send_generated_image(
                    ctx,
                    image_bytes,
                    "generated_image.png",
                    tier_name,
                    tier_settings,
                    cleaned_prompt,
                    model_name="AutismMix (Advanced)",
                    extra_info=f"{width}x{height}, {steps} steps, CFG {cfg}",
                    force_public=is_public
                )

                if success:
                    await status_msg.delete()
                    # Increment usage counter
                    increment_usage(ctx.author.id, tier_name)
                    print(f'✅ Advanced image generated successfully for {ctx.author.name} ({tier_name})')
            else:
                await status_msg.edit(content=f"❌ Could not download generated image (HTTP {response.status_code})")
        else:
            await status_msg.edit(content="❌ Image generation failed")

    except Exception as e:
        await status_msg.edit(content=f"❌ Error: {str(e)}")

@bot.command(name='swarminfo', aliases=['info'])
async def swarm_info(ctx):
    """Get information about the SwarmUI image generator"""
    info = f"""
**SwarmUI Discord Bot**

This bot generates images using your local SwarmUI installation.

**🔒 Privacy:** All images are sent privately to your DMs by default. Add `--public` to any command to post in the channel.

**Model Commands:**
`!gen <prompt>` - Creative/Mixed style (default)
`!genreal <prompt>` - Photorealistic images
`!genpony <prompt>` - Anime/Stylized images
`!genartistic <prompt>` - Artistic/Illustration style
`!genprn <prompt>` - Adult realistic content
`!genflux <prompt>` - High-quality Flux model
`!genhurricane <prompt>` - SD 2.1 Hurricane model
`!genbase <prompt>` - Official SDXL base model

**AI Prompt Enhancement:**
`!enhance <prompt>` - Get AI-optimized prompt
`!genenhanced <prompt>` - Auto-enhance & generate

**✨ VIP $99 EXCLUSIVE FEATURES:**
`!genanimepro <prompt>` - Premium Anime Generator (AI-enhanced, max quality)
`!script <idea>` - Create PERFECT detailed script
`!genwithscript <idea>` - Create script & generate image
*VIP-only features that deliver professional-level results*

**Other Commands:**
`!genadvanced <width> <height> <steps> <cfg> <prompt>` - Custom parameters
`!subscribe` - View subscription tiers
`!myroles` - Check your subscription status

**Examples:**
`!gen a beautiful sunset over mountains` - Private DM delivery
`!genreal a portrait of a person --public` - Public channel post
`!genpony an anime character in a forest`
`!genartistic a fantasy landscape painting`
`!genprn an adult scene`
`!genflux a photorealistic cityscape`
`!genhurricane a dramatic stormy sky`
`!genbase a simple landscape`

**Default Settings:**
- Resolution: 1216x832
- Steps: 50
- CFG Scale: 6.5
- Sampler: DPM++ 2M SDE GPU (Karras)
- Upscaling: 2x with 4x UltraSharp

**SwarmUI Status:** {'🟢 Connected' if swarm_session_id else '🔴 Disconnected'}
**API URL:** {SWARM_API_URL}
    """
    await ctx.send(info)

@bot.command(name='subscribe', aliases=['pricing', 'plans', 'tiers'])
async def subscribe(ctx):
    """Show available subscription tiers with payment links"""

    embed = discord.Embed(
        title="AI Image Generator - Subscription Tiers",
        description="Upgrade from your free trial to unlock unlimited AI image generation!\n\n🔒 **All tiers include private DM delivery** (add --public to any command to post in channel)",
        color=discord.Color.blue()
    )

    embed.add_field(
        name="Free Trial (Current)",
        value=(
            "3 images per day\n"
            "Up to 20 steps\n"
            "Max resolution: 1024x1024\n"
            "Perfect for testing!"
        ),
        inline=False
    )

    embed.add_field(
        name="Basic Access - $19/month",
        value=(
            "25 images per day\n"
            "Up to 30 steps\n"
            "Max resolution: 1024x1024\n"
            "Perfect for casual users!"
        ),
        inline=False
    )

    embed.add_field(
        name="Unlimited + Gallery - $39/month",
        value=(
            "75 images per day\n"
            "Up to 50 steps\n"
            "Max resolution: 1536x1536\n"
            "Great for content creators!"
        ),
        inline=False
    )

    embed.add_field(
        name="VIP Priority + Customs - $99/month",
        value=(
            "Unlimited images\n"
            "Up to 100 steps\n"
            "Max resolution: 2048x2048\n"
            "🎬 **AI Perfect Script Maker** (EXCLUSIVE!)\n"
            "✨ **Premium Anime Generator** (EXCLUSIVE!)\n"
            "Priority access + custom requests!"
        ),
        inline=False
    )

    embed.set_footer(text="Click a button below to subscribe")

    view = SubscribeView()
    await ctx.send(embed=embed, view=view)

@bot.command(name='myroles', aliases=['roles', 'debug'])
async def check_roles(ctx):
    """Debug command to see what roles the bot detects"""
    tier_name, tier_settings, user_roles = await get_user_tier(ctx.author)

    roles_list = "\n".join([f"• {role}" for role in user_roles])

    await ctx.send(
        f"**DEBUG: Your Roles**\n"
        f"Bot can see these roles for {ctx.author.mention}:\n"
        f"{roles_list}\n\n"
        f"**Detected Tier:** {tier_name if tier_name else 'None'}\n"
        f"**Tier Settings:** {tier_settings if tier_settings else 'No tier found'}"
    )

@bot.command(name='genreal', aliases=['realistic', 'real'])
async def generate_realistic(ctx, *, prompt: str):
    """Generate a photorealistic image

    Usage: !genreal a portrait of a person
    Add --public to post in channel instead of DM
    """
    # Check for --public flag
    cleaned_prompt, is_public = parse_public_flag(prompt)

    print(f'🎨 Command: !genreal from {ctx.author.name} in #{ctx.channel.name}: {cleaned_prompt} (public={is_public})')

    # Get user's tier
    tier_name, tier_settings, user_roles = await get_user_tier(ctx.author)

    if not tier_settings:
        embed = discord.Embed(
            title="❌ No Access - Subscription Required",
            description="You need an active subscription to generate AI images!",
            color=discord.Color.red()
        )
        view = SubscribeView()
        await ctx.send(embed=embed, view=view)
        return

    # Check usage limits
    allowed, usage_info = check_user_limit(ctx.author.id, tier_name, tier_settings)
    if not allowed:
        await ctx.send(f"❌ {usage_info}\nUpgrade your tier or wait until tomorrow!")
        return

    remaining = tier_settings[0] - usage_info if isinstance(usage_info, int) else "∞"
    await ctx.send(f"🎫 **{tier_name}** ({tier_settings[3]}) | Remaining: **{remaining}**")

    status_msg = await ctx.send(f"📸 Generating photorealistic image: `{cleaned_prompt}`\nThis may take 1-3 minutes...")

    try:
        max_res = tier_settings[2]
        max_steps = tier_settings[1]
        width = min(1216, max_res)
        height = min(832, max_res)
        steps = min(50, max_steps)

        # Use realistic model
        image_url, error = generate_image(cleaned_prompt, width, height, steps, model="realismByStableYogi_ponyV3VAE.safetensors")

        if error:
            await status_msg.edit(content=f"❌ {error}")
            return

        if image_url:
            response = requests.get(image_url, timeout=60)
            if response.status_code == 200:
                image_bytes = BytesIO(response.content)

                success = await send_generated_image(
                    ctx,
                    image_bytes,
                    "realistic_image.png",
                    tier_name,
                    tier_settings,
                    cleaned_prompt,
                    model_name="Realism by StableYogi",
                    extra_info=f"{width}x{height}, {steps} steps",
                    force_public=is_public
                )

                if success:
                    await status_msg.delete()
                    increment_usage(ctx.author.id, tier_name)
                    print(f'✅ Realistic image generated for {ctx.author.name} ({tier_name})')
            else:
                await status_msg.edit(content=f"❌ Could not download image (HTTP {response.status_code})")
    except Exception as e:
        await status_msg.edit(content=f"❌ Error: {str(e)}")

@bot.command(name='genpony', aliases=['pony', 'anime'])
async def generate_pony(ctx, *, prompt: str):
    """Generate an anime/stylized image

    Usage: !genpony an anime character
    Add --public to post in channel instead of DM
    """
    # Check for --public flag
    cleaned_prompt, is_public = parse_public_flag(prompt)

    print(f'🎨 Command: !genpony from {ctx.author.name} in #{ctx.channel.name}: {cleaned_prompt} (public={is_public})')

    tier_name, tier_settings, user_roles = await get_user_tier(ctx.author)

    if not tier_settings:
        embed = discord.Embed(
            title="❌ No Access - Subscription Required",
            description="You need an active subscription to generate AI images!",
            color=discord.Color.red()
        )
        view = SubscribeView()
        await ctx.send(embed=embed, view=view)
        return

    allowed, usage_info = check_user_limit(ctx.author.id, tier_name, tier_settings)
    if not allowed:
        await ctx.send(f"❌ {usage_info}\nUpgrade your tier or wait until tomorrow!")
        return

    remaining = tier_settings[0] - usage_info if isinstance(usage_info, int) else "∞"
    await ctx.send(f"🎫 **{tier_name}** ({tier_settings[3]}) | Remaining: **{remaining}**")

    status_msg = await ctx.send(f"🎨 Generating anime/stylized image: `{cleaned_prompt}`\nThis may take 1-3 minutes...")

    try:
        max_res = tier_settings[2]
        max_steps = tier_settings[1]
        width = min(1216, max_res)
        height = min(832, max_res)
        steps = min(50, max_steps)

        # Use pony model
        image_url, error = generate_image(cleaned_prompt, width, height, steps, model="ponyDiffusionV6XL_v6StartWithThisOne.safetensors")

        if error:
            await status_msg.edit(content=f"❌ {error}")
            return

        if image_url:
            response = requests.get(image_url, timeout=60)
            if response.status_code == 200:
                image_bytes = BytesIO(response.content)

                success = await send_generated_image(
                    ctx,
                    image_bytes,
                    "pony_image.png",
                    tier_name,
                    tier_settings,
                    cleaned_prompt,
                    model_name="Pony Diffusion v6 XL",
                    extra_info=f"{width}x{height}, {steps} steps",
                    force_public=is_public
                )

                if success:
                    await status_msg.delete()
                    increment_usage(ctx.author.id, tier_name)
                    print(f'✅ Pony image generated for {ctx.author.name} ({tier_name})')
            else:
                await status_msg.edit(content=f"❌ Could not download image (HTTP {response.status_code})")
    except Exception as e:
        await status_msg.edit(content=f"❌ Error: {str(e)}")

@bot.command(name='genartistic', aliases=['artistic', 'art', 'illustration'])
async def generate_artistic(ctx, *, prompt: str):
    """Generate an artistic/illustration style image

    Usage: !genartistic a fantasy landscape painting
    Add --public to post in channel instead of DM
    """
    # Check for --public flag
    cleaned_prompt, is_public = parse_public_flag(prompt)

    print(f'🎨 Command: !genartistic from {ctx.author.name} in #{ctx.channel.name}: {cleaned_prompt} (public={is_public})')

    tier_name, tier_settings, user_roles = await get_user_tier(ctx.author)

    if not tier_settings:
        embed = discord.Embed(
            title="❌ No Access - Subscription Required",
            description="You need an active subscription to generate AI images!",
            color=discord.Color.red()
        )
        view = SubscribeView()
        await ctx.send(embed=embed, view=view)
        return

    allowed, usage_info = check_user_limit(ctx.author.id, tier_name, tier_settings)
    if not allowed:
        await ctx.send(f"❌ {usage_info}\nUpgrade your tier or wait until tomorrow!")
        return

    remaining = tier_settings[0] - usage_info if isinstance(usage_info, int) else "∞"
    await ctx.send(f"🎫 **{tier_name}** ({tier_settings[3]}) | Remaining: **{remaining}**")

    status_msg = await ctx.send(f"🖼️ Generating artistic image: `{cleaned_prompt}`\nThis may take 1-3 minutes...")

    try:
        max_res = tier_settings[2]
        max_steps = tier_settings[1]
        width = min(1216, max_res)
        height = min(832, max_res)
        steps = min(50, max_steps)

        # Use illustrious model
        image_url, error = generate_image(cleaned_prompt, width, height, steps, model="illustriousXL_v01.safetensors")

        if error:
            await status_msg.edit(content=f"❌ {error}")
            return

        if image_url:
            response = requests.get(image_url, timeout=60)
            if response.status_code == 200:
                image_bytes = BytesIO(response.content)

                success = await send_generated_image(
                    ctx,
                    image_bytes,
                    "artistic_image.png",
                    tier_name,
                    tier_settings,
                    cleaned_prompt,
                    model_name="Illustrious XL",
                    extra_info=f"{width}x{height}, {steps} steps",
                    force_public=is_public
                )

                if success:
                    await status_msg.delete()
                    increment_usage(ctx.author.id, tier_name)
                    print(f'✅ Artistic image generated for {ctx.author.name} ({tier_name})')
            else:
                await status_msg.edit(content=f"❌ Could not download image (HTTP {response.status_code})")
    except Exception as e:
        await status_msg.edit(content=f"❌ Error: {str(e)}")

@bot.command(name='genprn', aliases=['prn', 'adult'])
async def generate_prn(ctx, *, prompt: str):
    """Generate an adult realistic image

    Usage: !genprn a person
    Add --public to post in channel instead of DM
    """
    # Check for --public flag
    cleaned_prompt, is_public = parse_public_flag(prompt)

    print(f'🎨 Command: !genprn from {ctx.author.name} in #{ctx.channel.name}: {cleaned_prompt} (public={is_public})')

    tier_name, tier_settings, user_roles = await get_user_tier(ctx.author)

    if not tier_settings:
        embed = discord.Embed(
            title="❌ No Access - Subscription Required",
            description="You need an active subscription to generate AI images!",
            color=discord.Color.red()
        )
        view = SubscribeView()
        await ctx.send(embed=embed, view=view)
        return

    allowed, usage_info = check_user_limit(ctx.author.id, tier_name, tier_settings)
    if not allowed:
        await ctx.send(f"❌ {usage_info}\nUpgrade your tier or wait until tomorrow!")
        return

    remaining = tier_settings[0] - usage_info if isinstance(usage_info, int) else "∞"
    await ctx.send(f"🎫 **{tier_name}** ({tier_settings[3]}) | Remaining: **{remaining}**")

    status_msg = await ctx.send(f"🔞 Generating adult realistic image: `{cleaned_prompt}`\nThis may take 1-3 minutes...")

    try:
        max_res = tier_settings[2]
        max_steps = tier_settings[1]
        # Use SDXL realistic model (works better than SD 1.5)
        width = min(1216, max_res)
        height = min(832, max_res)
        steps = min(50, max_steps)

        # Use realistic SDXL model - great for adult content
        image_url, error = generate_image(cleaned_prompt, width, height, steps, model="realismByStableYogi_ponyV3VAE.safetensors")

        if error:
            await status_msg.edit(content=f"❌ {error}")
            return

        if image_url:
            response = requests.get(image_url, timeout=60)
            if response.status_code == 200:
                image_bytes = BytesIO(response.content)

                success = await send_generated_image(
                    ctx,
                    image_bytes,
                    "adult_realistic_image.png",
                    tier_name,
                    tier_settings,
                    cleaned_prompt,
                    model_name="Realism by StableYogi (Adult)",
                    extra_info=f"{width}x{height}, {steps} steps",
                    force_public=is_public
                )

                if success:
                    await status_msg.delete()
                    increment_usage(ctx.author.id, tier_name)
                    print(f'✅ Adult realistic image generated for {ctx.author.name} ({tier_name})')
            else:
                await status_msg.edit(content=f"❌ Could not download image (HTTP {response.status_code})")
    except Exception as e:
        await status_msg.edit(content=f"❌ Error: {str(e)}")

@bot.command(name='genflux', aliases=['flux'])
async def generate_flux(ctx, *, prompt: str):
    """Generate a high-quality image using Flux model

    Usage: !genflux a beautiful landscape
    Add --public to post in channel instead of DM
    """
    # Check for --public flag
    cleaned_prompt, is_public = parse_public_flag(prompt)

    print(f'🎨 Command: !genflux from {ctx.author.name} in #{ctx.channel.name}: {cleaned_prompt} (public={is_public})')

    tier_name, tier_settings, user_roles = await get_user_tier(ctx.author)

    if not tier_settings:
        embed = discord.Embed(
            title="❌ No Access - Subscription Required",
            description="You need an active subscription to generate AI images!",
            color=discord.Color.red()
        )
        view = SubscribeView()
        await ctx.send(embed=embed, view=view)
        return

    allowed, usage_info = check_user_limit(ctx.author.id, tier_name, tier_settings)
    if not allowed:
        await ctx.send(f"❌ {usage_info}\nUpgrade your tier or wait until tomorrow!")
        return

    remaining = tier_settings[0] - usage_info if isinstance(usage_info, int) else "∞"
    await ctx.send(f"🎫 **{tier_name}** ({tier_settings[3]}) | Remaining: **{remaining}**")

    status_msg = await ctx.send(f"⚡ Generating high-quality Flux image: `{cleaned_prompt}`\nThis may take 2-4 minutes...")

    try:
        max_res = tier_settings[2]
        max_steps = tier_settings[1]
        width = min(1216, max_res)
        height = min(832, max_res)
        steps = min(50, max_steps)

        # Use Flux model
        image_url, error = generate_image(cleaned_prompt, width, height, steps, model="1.safetensors")

        if error:
            await status_msg.edit(content=f"❌ {error}")
            return

        if image_url:
            response = requests.get(image_url, timeout=60)
            if response.status_code == 200:
                image_bytes = BytesIO(response.content)

                success = await send_generated_image(
                    ctx,
                    image_bytes,
                    "flux_image.png",
                    tier_name,
                    tier_settings,
                    cleaned_prompt,
                    model_name="Flux",
                    extra_info=f"{width}x{height}, {steps} steps",
                    force_public=is_public
                )

                if success:
                    await status_msg.delete()
                    increment_usage(ctx.author.id, tier_name)
                    print(f'✅ Flux image generated for {ctx.author.name} ({tier_name})')
            else:
                await status_msg.edit(content=f"❌ Could not download image (HTTP {response.status_code})")
    except Exception as e:
        await status_msg.edit(content=f"❌ Error: {str(e)}")

@bot.command(name='genhurricane', aliases=['hurricane', 'sd21'])
async def generate_hurricane(ctx, *, prompt: str):
    """Generate an image using SD 2.1 Hurricane model

    Usage: !genhurricane a fantasy scene
    Add --public to post in channel instead of DM
    """
    # Check for --public flag
    cleaned_prompt, is_public = parse_public_flag(prompt)

    print(f'🎨 Command: !genhurricane from {ctx.author.name} in #{ctx.channel.name}: {cleaned_prompt} (public={is_public})')

    tier_name, tier_settings, user_roles = await get_user_tier(ctx.author)

    if not tier_settings:
        embed = discord.Embed(
            title="❌ No Access - Subscription Required",
            description="You need an active subscription to generate AI images!",
            color=discord.Color.red()
        )
        view = SubscribeView()
        await ctx.send(embed=embed, view=view)
        return

    allowed, usage_info = check_user_limit(ctx.author.id, tier_name, tier_settings)
    if not allowed:
        await ctx.send(f"❌ {usage_info}\nUpgrade your tier or wait until tomorrow!")
        return

    remaining = tier_settings[0] - usage_info if isinstance(usage_info, int) else "∞"
    await ctx.send(f"🎫 **{tier_name}** ({tier_settings[3]}) | Remaining: **{remaining}**")

    status_msg = await ctx.send(f"🌀 Generating Hurricane SD2.1 image: `{cleaned_prompt}`\nThis may take 1-3 minutes...")

    try:
        max_res = tier_settings[2]
        max_steps = tier_settings[1]
        # SD 2.1 model - use appropriate resolutions (768x768 or 768x512)
        width = min(768, max_res)
        height = min(768, max_res)
        steps = min(50, max_steps)

        # Use Hurricane model (SD 2.1) - disable upscaling for compatibility
        image_url, error = generate_image(cleaned_prompt, width, height, steps, model="SD21HurricaneFully_v10EncoderTrained.safetensors", upscale=False)

        if error:
            await status_msg.edit(content=f"❌ {error}")
            return

        if image_url:
            response = requests.get(image_url, timeout=60)
            if response.status_code == 200:
                image_bytes = BytesIO(response.content)

                success = await send_generated_image(
                    ctx,
                    image_bytes,
                    "hurricane_image.png",
                    tier_name,
                    tier_settings,
                    cleaned_prompt,
                    model_name="SD 2.1 Hurricane",
                    extra_info=f"{width}x{height}, {steps} steps",
                    force_public=is_public
                )

                if success:
                    await status_msg.delete()
                    increment_usage(ctx.author.id, tier_name)
                    print(f'✅ Hurricane image generated for {ctx.author.name} ({tier_name})')
            else:
                await status_msg.edit(content=f"❌ Could not download image (HTTP {response.status_code})")
    except Exception as e:
        await status_msg.edit(content=f"❌ Error: {str(e)}")

@bot.command(name='genbase', aliases=['base', 'sdxl'])
async def generate_base(ctx, *, prompt: str):
    """Generate an image using official SDXL base model

    Usage: !genbase a landscape
    Add --public to post in channel instead of DM
    """
    # Check for --public flag
    cleaned_prompt, is_public = parse_public_flag(prompt)

    print(f'🎨 Command: !genbase from {ctx.author.name} in #{ctx.channel.name}: {cleaned_prompt} (public={is_public})')

    tier_name, tier_settings, user_roles = await get_user_tier(ctx.author)

    if not tier_settings:
        embed = discord.Embed(
            title="❌ No Access - Subscription Required",
            description="You need an active subscription to generate AI images!",
            color=discord.Color.red()
        )
        view = SubscribeView()
        await ctx.send(embed=embed, view=view)
        return

    allowed, usage_info = check_user_limit(ctx.author.id, tier_name, tier_settings)
    if not allowed:
        await ctx.send(f"❌ {usage_info}\nUpgrade your tier or wait until tomorrow!")
        return

    remaining = tier_settings[0] - usage_info if isinstance(usage_info, int) else "∞"
    await ctx.send(f"🎫 **{tier_name}** ({tier_settings[3]}) | Remaining: **{remaining}**")

    status_msg = await ctx.send(f"🎯 Generating SDXL base image: `{cleaned_prompt}`\nThis may take 1-3 minutes...")

    try:
        max_res = tier_settings[2]
        max_steps = tier_settings[1]
        width = min(1216, max_res)
        height = min(832, max_res)
        steps = min(50, max_steps)

        # Use official SDXL base model
        image_url, error = generate_image(cleaned_prompt, width, height, steps, model="OfficialStableDiffusion/sd_xl_base_1.0.safetensors")

        if error:
            await status_msg.edit(content=f"❌ {error}")
            return

        if image_url:
            response = requests.get(image_url, timeout=60)
            if response.status_code == 200:
                image_bytes = BytesIO(response.content)

                success = await send_generated_image(
                    ctx,
                    image_bytes,
                    "sdxl_base_image.png",
                    tier_name,
                    tier_settings,
                    cleaned_prompt,
                    model_name="SDXL Base 1.0",
                    extra_info=f"{width}x{height}, {steps} steps",
                    force_public=is_public
                )

                if success:
                    await status_msg.delete()
                    increment_usage(ctx.author.id, tier_name)
                    print(f'✅ SDXL base image generated for {ctx.author.name} ({tier_name})')
            else:
                await status_msg.edit(content=f"❌ Could not download image (HTTP {response.status_code})")
    except Exception as e:
        await status_msg.edit(content=f"❌ Error: {str(e)}")

@bot.command(name='enhance', aliases=['optimize', 'improve'])
async def enhance_prompt_command(ctx, *, prompt: str):
    """Enhance a basic prompt using AI for better image results

    Usage: !enhance a woman at the beach
    """
    print(f'💡 Command: !enhance from {ctx.author.name}: {prompt}')

    status_msg = await ctx.send(f"🤖 Enhancing your prompt with AI...\nOriginal: `{prompt}`")

    try:
        enhanced = enhance_prompt(prompt, style="photorealistic")

        embed = discord.Embed(
            title="✨ Prompt Enhanced!",
            color=discord.Color.blue()
        )

        embed.add_field(
            name="📝 Original Prompt",
            value=f"```{prompt}```",
            inline=False
        )

        embed.add_field(
            name="🎨 Enhanced Prompt",
            value=f"```{enhanced}```",
            inline=False
        )

        embed.set_footer(text="Use !genenhanced to generate with this enhancement automatically")

        await status_msg.delete()
        await ctx.send(embed=embed)

    except Exception as e:
        await status_msg.edit(content=f"❌ Error enhancing prompt: {str(e)}")

@bot.command(name='genenhanced', aliases=['genenh', 'genai'])
async def generate_enhanced(ctx, *, prompt: str):
    """Generate an image with AI-enhanced prompt

    Usage: !genenhanced a woman at the beach
    Add --public to post in channel instead of DM
    """
    # Check for --public flag
    cleaned_prompt, is_public = parse_public_flag(prompt)

    print(f'🎨 Command: !genenhanced from {ctx.author.name} in #{ctx.channel.name}: {cleaned_prompt} (public={is_public})')

    # Get user's tier
    tier_name, tier_settings, user_roles = await get_user_tier(ctx.author)

    if not tier_settings:
        embed = discord.Embed(
            title="❌ No Access - Subscription Required",
            description="You need an active subscription to generate AI images!",
            color=discord.Color.red()
        )
        view = SubscribeView()
        await ctx.send(embed=embed, view=view)
        return

    # Check usage limits
    allowed, usage_info = check_user_limit(ctx.author.id, tier_name, tier_settings)
    if not allowed:
        await ctx.send(f"❌ {usage_info}\nUpgrade your tier or wait until tomorrow!")
        return

    remaining = tier_settings[0] - usage_info if isinstance(usage_info, int) else "∞"
    await ctx.send(f"🎫 **{tier_name}** ({tier_settings[3]}) | Remaining: **{remaining}**")

    # Enhance the prompt first
    status_msg = await ctx.send(f"🤖 Step 1/2: Enhancing prompt with AI...\nOriginal: `{cleaned_prompt}`")

    try:
        enhanced_prompt = enhance_prompt(cleaned_prompt, style="photorealistic")

        await status_msg.edit(content=f"✅ Prompt enhanced!\n🎨 Step 2/2: Generating image with enhanced prompt...\nThis may take 1-3 minutes...")

        # Generate with enhanced prompt
        max_res = tier_settings[2]
        max_steps = tier_settings[1]
        width = min(1216, max_res)
        height = min(832, max_res)
        steps = min(50, max_steps)

        image_url, error = generate_image(enhanced_prompt, width, height, steps)

        if error:
            await status_msg.edit(content=f"❌ {error}")
            return

        if image_url:
            response = requests.get(image_url, timeout=60)
            if response.status_code == 200:
                image_bytes = BytesIO(response.content)
                file = discord.File(fp=image_bytes, filename="enhanced_image.png")

                success = await send_generated_image(
                    ctx,
                    image_bytes,
                    "enhanced_image.png",
                    tier_name,
                    tier_settings,
                    f"Original: {cleaned_prompt[:100]}... | Enhanced prompt",
                    model_name="AI-Enhanced",
                    extra_info=f"{width}x{height}, {steps} steps",
                    force_public=is_public
                )
                if success:
                    await status_msg.delete()
                    increment_usage(ctx.author.id, tier_name)
                    print(f'✅ Enhanced image generated for {ctx.author.name} ({tier_name})')
            else:
                await status_msg.edit(content=f"❌ Could not download image (HTTP {response.status_code})")
        else:
            await status_msg.edit(content="❌ Image generation failed")

    except Exception as e:
        await status_msg.edit(content=f"❌ Error: {str(e)}")

@bot.command(name='script', aliases=['makescript', 'perfectscript'])
async def create_script_command(ctx, *, idea: str):
    """Create a PERFECT detailed script from your basic idea

    Usage: !script woman beach sunset
    Perfect for the #script-maker channel!
    VIP $99 ONLY
    """
    print(f'📝 Command: !script from {ctx.author.name}: {idea}')

    # Check if user has VIP $99 tier
    tier_name, tier_settings, user_roles = await get_user_tier(ctx.author)

    if tier_name != "VIP $99":
        embed = discord.Embed(
            title="🎬 Perfect Script Maker - VIP Only",
            description="The Perfect Script Maker is an exclusive feature for VIP members!",
            color=discord.Color.red()
        )

        embed.add_field(
            name="❌ Access Denied",
            value=f"Your current tier: **{tier_name if tier_name else 'None'}**\n"
                  f"Required tier: **VIP $99**",
            inline=False
        )

        embed.add_field(
            name="🌟 VIP Benefits",
            value="• Unlimited images per day\n"
                  "• Up to 100 steps\n"
                  "• Max resolution: 2048x2048\n"
                  "• **AI Perfect Script Maker** 🎬\n"
                  "• Priority generation\n"
                  "• Custom requests",
            inline=False
        )

        embed.add_field(
            name="💎 Upgrade to VIP",
            value="Click the button below to get VIP access!",
            inline=False
        )

        vip_button = View()
        vip_btn = Button(
            label="Upgrade to VIP $99/mo",
            style=discord.ButtonStyle.success,
            url="https://whop.com/jredrocket/vip-priority-customs/"
        )
        vip_button.add_item(vip_btn)

        await ctx.send(embed=embed, view=vip_button)
        print(f'❌ User {ctx.author.name} tried to use !script but is not VIP. Tier: {tier_name}')
        return

    status_msg = await ctx.send(f"🎬 Creating the PERFECT script for: `{idea}`\n⏳ This may take 15-30 seconds...")

    try:
        perfect_script = create_perfect_script(idea, style="photorealistic")

        embed = discord.Embed(
            title="🎬 Perfect Script Created!",
            description="Your professional image generation script is ready!",
            color=discord.Color.gold()
        )

        embed.add_field(
            name="💡 Your Idea",
            value=f"```{idea}```",
            inline=False
        )

        # Split script if it's too long for Discord
        if len(perfect_script) > 1000:
            embed.add_field(
                name="📜 Perfect Script (Part 1)",
                value=f"```{perfect_script[:1000]}```",
                inline=False
            )
            embed.add_field(
                name="📜 Perfect Script (Part 2)",
                value=f"```{perfect_script[1000:]}```",
                inline=False
            )
        else:
            embed.add_field(
                name="📜 Perfect Script",
                value=f"```{perfect_script}```",
                inline=False
            )

        embed.add_field(
            name="🎨 Next Steps",
            value="Copy this script and use:\n"
                  "• `!gen <script>` - Generate with default model\n"
                  "• `!genreal <script>` - Photorealistic\n"
                  "• `!genpony <script>` - Anime style\n"
                  "• Or use `!genwithscript <idea>` to auto-generate!",
            inline=False
        )

        embed.set_footer(text="Script created by AI • Perfect for professional results")

        await status_msg.delete()
        await ctx.send(embed=embed)

    except Exception as e:
        await status_msg.edit(content=f"❌ Error creating script: {str(e)}")

@bot.command(name='genwithscript', aliases=['genscript', 'scriptgen'])
async def generate_with_script(ctx, *, idea: str):
    """Create a perfect script AND generate the image automatically

    Usage: !genwithscript woman beach sunset
    Add --public to post in channel instead of DM
    VIP $99 ONLY
    """
    # Check for --public flag
    cleaned_prompt, is_public = parse_public_flag(idea)

    print(f'🎬 Command: !genwithscript from {ctx.author.name} in #{ctx.channel.name}: {cleaned_prompt} (public={is_public})')

    # Get user's tier
    tier_name, tier_settings, user_roles = await get_user_tier(ctx.author)

    # Check if user has VIP $99 tier
    if tier_name != "VIP $99":
        embed = discord.Embed(
            title="🎬 Perfect Script Generator - VIP Only",
            description="The Perfect Script Generator with auto-generation is an exclusive VIP feature!",
            color=discord.Color.red()
        )

        embed.add_field(
            name="❌ Access Denied",
            value=f"Your current tier: **{tier_name if tier_name else 'None'}**\n"
                  f"Required tier: **VIP $99**",
            inline=False
        )

        embed.add_field(
            name="🌟 VIP Benefits",
            value="• Unlimited images per day\n"
                  "• Up to 100 steps\n"
                  "• Max resolution: 2048x2048\n"
                  "• **AI Perfect Script Maker** 🎬\n"
                  "• **Auto Script + Generation** ⚡\n"
                  "• Priority generation\n"
                  "• Custom requests",
            inline=False
        )

        embed.add_field(
            name="💎 Upgrade to VIP",
            value="Click the button below to get VIP access!",
            inline=False
        )

        vip_button = View()
        vip_btn = Button(
            label="Upgrade to VIP $99/mo",
            style=discord.ButtonStyle.success,
            url="https://whop.com/jredrocket/vip-priority-customs/"
        )
        vip_button.add_item(vip_btn)

        await ctx.send(embed=embed, view=vip_button)
        print(f'❌ User {ctx.author.name} tried to use !genwithscript but is not VIP. Tier: {tier_name}')
        return

    if not tier_settings:
        embed = discord.Embed(
            title="❌ No Access - Subscription Required",
            description="You need an active subscription to generate AI images!",
            color=discord.Color.red()
        )
        view = SubscribeView()
        await ctx.send(embed=embed, view=view)
        return

    # Check usage limits
    allowed, usage_info = check_user_limit(ctx.author.id, tier_name, tier_settings)
    if not allowed:
        await ctx.send(f"❌ {usage_info}\nUpgrade your tier or wait until tomorrow!")
        return

    remaining = tier_settings[0] - usage_info if isinstance(usage_info, int) else "∞"
    await ctx.send(f"🎫 **{tier_name}** ({tier_settings[3]}) | Remaining: **{remaining}**")

    # Create the perfect script first
    status_msg = await ctx.send(f"🎬 Step 1/2: Creating PERFECT script from: `{cleaned_prompt}`\n⏳ Please wait 15-30 seconds...")

    try:
        perfect_script = create_perfect_script(cleaned_prompt, style="photorealistic")

        await status_msg.edit(content=f"✅ Script created! ({len(perfect_script)} characters)\n🎨 Step 2/2: Generating image...\n⏳ This may take 1-3 minutes...")

        # Generate with the perfect script
        max_res = tier_settings[2]
        max_steps = tier_settings[1]
        width = min(1216, max_res)
        height = min(832, max_res)
        steps = min(50, max_steps)

        image_url, error = generate_image(perfect_script, width, height, steps)

        if error:
            await status_msg.edit(content=f"❌ {error}")
            return

        if image_url:
            response = requests.get(image_url, timeout=60)
            if response.status_code == 200:
                image_bytes = BytesIO(response.content)

                success = await send_generated_image(
                    ctx,
                    image_bytes,
                    "perfect_script_image.png",
                    tier_name,
                    tier_settings,
                    f"Original: {cleaned_prompt[:100]}... | AI Script Generated",
                    model_name="VIP Script Maker + AI Generation",
                    extra_info=f"{width}x{height}, {steps} steps, Script: {len(perfect_script)} chars",
                    force_public=is_public
                )

                if success:
                    await status_msg.delete()
                    increment_usage(ctx.author.id, tier_name)
                    print(f'✅ Perfect script image generated for {ctx.author.name} ({tier_name})')
            else:
                await status_msg.edit(content=f"❌ Could not download image (HTTP {response.status_code})")
        else:
            await status_msg.edit(content="❌ Image generation failed")

    except Exception as e:
        await status_msg.edit(content=f"❌ Error: {str(e)}")

@bot.command(name='genanimepro', aliases=['animepro', 'premiumanime'])
async def generate_anime_pro(ctx, *, prompt: str):
    """Generate PREMIUM anime art with perfect quality - VIP ONLY

    Usage: !genanimepro cute anime girl with pink hair
    Add --public to post in channel instead of DM
    VIP $99 EXCLUSIVE
    """
    # Check for --public flag
    cleaned_prompt, is_public = parse_public_flag(prompt)

    print(f'🎨 Command: !genanimepro from {ctx.author.name} in #{ctx.channel.name}: {cleaned_prompt} (public={is_public})')

    # Check if user has VIP $99 tier
    tier_name, tier_settings, user_roles = await get_user_tier(ctx.author)

    if tier_name != "VIP $99":
        embed = discord.Embed(
            title="🌸 Premium Anime Generator - VIP Exclusive",
            description="The Premium Anime Generator creates STUNNING anime art with perfect quality!",
            color=discord.Color.purple()
        )

        embed.add_field(
            name="❌ VIP Access Required",
            value=f"Your current tier: **{tier_name if tier_name else 'None'}**\n"
                  f"Required tier: **VIP $99**",
            inline=False
        )

        embed.add_field(
            name="✨ What Makes Premium Anime Special?",
            value="• Uses AI-enhanced prompts automatically\n"
                  "• Optimized settings for anime perfection\n"
                  "• Maximum quality (2048px, 100 steps)\n"
                  "• Professional anime artist-level results\n"
                  "• Perfect character details, vibrant colors\n"
                  "• Studio-quality backgrounds",
            inline=False
        )

        embed.add_field(
            name="🎨 Example Results",
            value="Transform simple ideas like:\n"
                  "`anime girl` → Stunning character with perfect proportions, detailed eyes, "
                  "beautiful hair rendering, professional lighting, studio-quality background\n\n"
                  "Regular commands can't match this quality!",
            inline=False
        )

        embed.add_field(
            name="💎 Upgrade to VIP $99",
            value="• Premium Anime Generator\n"
                  "• AI Perfect Script Maker\n"
                  "• Unlimited images\n"
                  "• Best quality for ALL styles",
            inline=False
        )

        vip_button = View()
        vip_btn = Button(
            label="Upgrade to VIP $99/mo - Get Premium Anime!",
            style=discord.ButtonStyle.success,
            url="https://whop.com/jredrocket/vip-priority-customs/"
        )
        vip_button.add_item(vip_btn)

        await ctx.send(embed=embed, view=vip_button)
        print(f'❌ User {ctx.author.name} tried to use !genanimepro but is not VIP. Tier: {tier_name}')
        return

    # VIP user - proceed with premium generation
    if not tier_settings:
        await ctx.send("❌ Error: Could not load tier settings")
        return

    # Check usage limits
    allowed, usage_info = check_user_limit(ctx.author.id, tier_name, tier_settings)
    if not allowed:
        await ctx.send(f"❌ {usage_info}\nUpgrade your tier or wait until tomorrow!")
        return

    remaining = tier_settings[0] - usage_info if isinstance(usage_info, int) else "∞"
    await ctx.send(f"🎫 **{tier_name}** ({tier_settings[3]}) | Remaining: **{remaining}**")

    status_msg = await ctx.send(f"✨ Creating PREMIUM anime art with AI enhancement...\n⏳ Step 1/2: Enhancing prompt...")

    try:
        # Enhance the prompt for anime perfection
        anime_enhanced_prompt = enhance_prompt(cleaned_prompt, style="anime")

        # Add anime quality boosters
        final_prompt = f"{anime_enhanced_prompt}, masterpiece, best quality, highly detailed, beautiful anime art, vibrant colors, professional illustration, studio quality, perfect anatomy, detailed eyes, beautiful lighting"

        await status_msg.edit(content=f"✨ Prompt enhanced!\n🎨 Step 2/2: Generating premium anime art...\n⏳ This may take 2-4 minutes for maximum quality...")

        # Use max settings for VIP
        max_res = tier_settings[2]
        max_steps = tier_settings[1]
        width = min(1216, max_res)
        height = min(832, max_res)
        steps = min(80, max_steps)  # Higher steps for anime quality

        # Use pony model with enhanced prompt
        image_url, error = generate_image(final_prompt, width, height, steps, cfg_scale=7.0, model="ponyDiffusionV6XL_v6StartWithThisOne.safetensors")

        if error:
            await status_msg.edit(content=f"❌ {error}")
            return

        if image_url:
            response = requests.get(image_url, timeout=60)
            if response.status_code == 200:
                image_bytes = BytesIO(response.content)
                file = discord.File(fp=image_bytes, filename="premium_anime.png")

                result_embed = discord.Embed(
                    title=f"✨ Premium Anime - VIP Exclusive",
                    description=f"Created for **{ctx.author.display_name}**",
                    color=discord.Color.purple()
                )

                result_embed.add_field(
                    name="💡 Your Prompt",
                    value=f"`{cleaned_prompt}`",
                    inline=False
                )

                result_embed.add_field(
                    name="⚙️ Premium Settings",
                    value=f"• AI-Enhanced Prompt\n• {width}x{height} resolution\n• {steps} steps (premium quality)\n• Anime-optimized model",
                    inline=False
                )

                result_embed.set_footer(text="VIP Exclusive • Premium Anime Generator")

                success = await send_generated_image(
                    ctx,
                    image_bytes,
                    "premium_anime.png",
                    tier_name,
                    tier_settings,
                    cleaned_prompt,
                    model_name="Pony Diffusion v6 XL (Premium Anime)",
                    extra_info=f"{width}x{height}, {steps} steps, AI-enhanced",
                    force_public=is_public
                )

                if success:
                    await status_msg.delete()
                    increment_usage(ctx.author.id, tier_name)
                    print(f'✅ Premium anime generated for {ctx.author.name} ({tier_name})')
            else:
                await status_msg.edit(content=f"❌ Could not download image (HTTP {response.status_code})")
        else:
            await status_msg.edit(content="❌ Image generation failed")

    except Exception as e:
        await status_msg.edit(content=f"❌ Error: {str(e)}")

@bot.command(name='assignfreetrial')
@commands.has_permissions(administrator=True)
async def assign_free_trial_all(ctx):
    """Admin command: Assign free-trial role to all members without a tier"""
    free_trial_role = discord.utils.get(ctx.guild.roles, name="free-trial")

    if not free_trial_role:
        await ctx.send("❌ Error: `free-trial` role doesn't exist! Create it first in Server Settings → Roles")
        return

    assigned_count = 0
    already_have_tier = 0

    status_msg = await ctx.send("🔄 Assigning free-trial role to members without a tier...")

    for member in ctx.guild.members:
        if member.bot:
            continue  # Skip bots

        # Check if they already have a tier role
        user_roles = [role.name for role in member.roles]
        has_tier = any(tier in user_roles for tier in TIER_PRIORITY)

        if not has_tier:
            try:
                await member.add_roles(free_trial_role)
                assigned_count += 1
                print(f"✅ Assigned free-trial to {member.name}")
            except Exception as e:
                print(f"❌ Failed to assign to {member.name}: {e}")
        else:
            already_have_tier += 1

    await status_msg.edit(
        content=f"✅ **Free Trial Assignment Complete!**\n\n"
                f"• Assigned to: **{assigned_count}** members\n"
                f"• Already have tier: **{already_have_tier}** members\n"
                f"• Total processed: **{assigned_count + already_have_tier}** members"
    )

    print(f"Free trial role assigned to {assigned_count} members")

@bot.command(name='reconnect')
async def reconnect_swarm(ctx):
    """Reconnect to SwarmUI (if connection was lost)"""
    if get_swarm_session():
        await ctx.send(f"✅ Successfully reconnected to SwarmUI!\nSession ID: `{swarm_session_id}`")
    else:
        await ctx.send("❌ Could not connect to SwarmUI. Make sure it's running on port 7801")

# Run the bot
if __name__ == "__main__":
    print("=" * 50)
    print("DISCORD SWARM BOT - INITIALIZING")
    print("=" * 50)
    sys.stdout.flush()

    # Get Discord token from environment variable
    DISCORD_TOKEN = os.getenv('DISCORD_TOKEN')

    if not DISCORD_TOKEN:
        print("ERROR: DISCORD_TOKEN environment variable not set!")
        print("Please create a .env file with DISCORD_TOKEN=your_token_here")
        exit(1)

    print(f"✅ Discord token loaded: {DISCORD_TOKEN[:20]}...")
    print("🚀 Starting bot connection...")
    sys.stdout.flush()

    bot.run(DISCORD_TOKEN)
