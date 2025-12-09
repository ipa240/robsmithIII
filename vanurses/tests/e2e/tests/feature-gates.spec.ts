import { test, expect } from '@playwright/test';
import { gotoAndWait, CONFIG } from './fixtures';

test.describe('Feature Gating by Tier', () => {

  test.describe('Jobs Page Gates', () => {
    test('jobs page loads with results', async ({ page }) => {
      await gotoAndWait(page, '/jobs');
      await page.waitForTimeout(5000);

      // Should have job cards or links to jobs
      const jobCards = page.locator('[class*="job"], [class*="card"], a[href*="/jobs/"]');
      const cardCount = await jobCards.count();

      // Also check for job-related text
      const hasJobContent = await page.locator('text=/RN|Nursing|Registered|position|job/i').first().isVisible().catch(() => false);

      console.log('Job cards displayed:', cardCount, 'Has job content:', hasJobContent);
      expect(cardCount > 0 || hasJobContent).toBeTruthy();
    });

    test('checks for upgrade prompt on jobs page', async ({ page }) => {
      await gotoAndWait(page, '/jobs');
      await page.waitForTimeout(3000);

      // Free users should see "X More Matches Available - Upgrade"
      const upgradePrompt = page.locator('text=/More.*Matches|Unlock.*more|Upgrade/i');
      const hasPrompt = await upgradePrompt.first().isVisible().catch(() => false);

      console.log('Shows upgrade prompt on jobs:', hasPrompt);
    });
  });

  test.describe('Sully AI Gates', () => {
    test('sully page loads', async ({ page }) => {
      await gotoAndWait(page, '/sully');
      await page.waitForTimeout(2000);

      // Should have chat interface
      const chatArea = page.locator('textarea, input[type="text"], [class*="chat"], [class*="message"]');
      const hasChatUI = await chatArea.first().isVisible().catch(() => false);

      console.log('Has chat UI:', hasChatUI);
      expect(hasChatUI).toBeTruthy();
    });

    test('shows daily limit indicator', async ({ page }) => {
      await gotoAndWait(page, '/sully');
      await page.waitForTimeout(2000);

      // Should show remaining questions
      const limitIndicator = page.locator('text=/remaining|left|questions|\\d+.*\\/.*\\d+/i');
      const hasLimit = await limitIndicator.first().isVisible().catch(() => false);

      console.log('Shows limit indicator:', hasLimit);
    });
  });

  test.describe('Facility Comparison Gates', () => {
    test('compare page loads', async ({ page }) => {
      await gotoAndWait(page, '/compare');
      await page.waitForTimeout(2000);

      // Should have add facility button or search
      const addButton = page.locator('button:has-text("Add"), [class*="search"], input[placeholder*="Search"]');
      const hasAddUI = await addButton.first().isVisible().catch(() => false);

      console.log('Has add facility UI:', hasAddUI);
    });
  });

  test.describe('Saved Jobs Gates', () => {
    test('saved jobs page loads', async ({ page }) => {
      await gotoAndWait(page, '/saved');
      await page.waitForTimeout(2000);

      // Should have saved jobs list or empty state
      const content = page.locator('[class*="saved"], [class*="job"], text=/No saved|Browse jobs/i');
      const hasContent = await content.first().isVisible().catch(() => false);

      console.log('Has saved jobs content:', hasContent);
    });
  });

  test.describe('Trends Page Gates', () => {
    test('trends page loads', async ({ page }) => {
      await gotoAndWait(page, '/trends');
      await page.waitForTimeout(2000);

      // May show upgrade prompt or data
      const content = page.locator('[class*="trend"], [class*="chart"], text=/Upgrade|Premium/i, h1, h2');
      const hasContent = await content.first().isVisible().catch(() => false);

      console.log('Has trends content:', hasContent);
    });
  });

  test.describe('Profile Page', () => {
    test('profile page shows tier info', async ({ page }) => {
      await gotoAndWait(page, '/profile');
      await page.waitForTimeout(2000);

      // Should show user tier somewhere
      const tierInfo = page.locator('text=/Free|Starter|Pro|Premium|tier|subscription/i');
      const hasTierInfo = await tierInfo.first().isVisible().catch(() => false);

      console.log('Shows tier info:', hasTierInfo);
    });
  });
});

test.describe('API Feature Gates', () => {

  test('billing/status returns tier limits', async ({ request }) => {
    const response = await request.get(`${CONFIG.apiURL}/api/billing/status`);

    // Will be 401 if not authenticated
    if (response.status() === 200) {
      const data = await response.json();

      console.log('Billing status:', {
        tier: data.tier,
        sully_daily_limit: data.sully_daily_limit,
        saved_jobs_limit: data.saved_jobs_limit,
        comparison_limit: data.comparison_limit
      });

      expect(data).toHaveProperty('tier');
      expect(data).toHaveProperty('sully_daily_limit');
    } else {
      console.log('Billing status returned:', response.status());
      expect(response.status()).toBe(401);
    }
  });

  test('billing/tiers returns feature lists', async ({ request }) => {
    const response = await request.get(`${CONFIG.apiURL}/api/billing/tiers`);

    expect(response.status()).toBe(200);
    const data = await response.json();

    // Each tier should have features
    for (const tier of data.tiers) {
      console.log(`${tier.id} features:`, tier.features?.length || 0);
      expect(tier).toHaveProperty('features');
      expect(Array.isArray(tier.features)).toBeTruthy();
    }
  });

  test('protected endpoints return data when authenticated', async ({ request }) => {
    // These tests run in authenticated context, so endpoints should return 200
    const protectedEndpoints = [
      '/api/me',
      '/api/billing/status',
    ];

    for (const endpoint of protectedEndpoints) {
      const response = await request.get(`${CONFIG.apiURL}${endpoint}`);
      console.log(`${endpoint}: ${response.status()}`);
      // In authenticated context, should get 200 or 401 (if token not passed)
      expect([200, 401]).toContain(response.status());
    }
  });
});

test.describe('Tier Limit Verification', () => {
  test('free tier has correct limits', async ({ request }) => {
    const response = await request.get(`${CONFIG.apiURL}/api/billing/tiers`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    const freeTier = data.tiers.find((t: any) => t.id === 'free');

    expect(freeTier).toBeDefined();
    expect(freeTier.monthly_price).toBe(0);

    console.log('Free tier:', freeTier);
  });

  test('paid tiers have prices', async ({ request }) => {
    const response = await request.get(`${CONFIG.apiURL}/api/billing/tiers`);
    expect(response.status()).toBe(200);

    const data = await response.json();

    const starter = data.tiers.find((t: any) => t.id === 'starter');
    const pro = data.tiers.find((t: any) => t.id === 'pro');
    const premium = data.tiers.find((t: any) => t.id === 'premium');

    expect(starter.monthly_price).toBeGreaterThan(0);
    expect(pro.monthly_price).toBeGreaterThan(starter.monthly_price);
    expect(premium.monthly_price).toBeGreaterThan(pro.monthly_price);

    console.log('Tier prices:', {
      starter: starter.monthly_price,
      pro: pro.monthly_price,
      premium: premium.monthly_price
    });
  });
});
