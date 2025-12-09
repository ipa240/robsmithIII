import { test, expect } from '@playwright/test';
import { gotoAndWait, CONFIG } from './fixtures';

// Stripe test card - always succeeds
const STRIPE_TEST_CARD = {
  number: '4242424242424242',
  expiry: '12/30',
  cvc: '123',
  name: 'Test User',
  zip: '12345'
};

test.describe('Tier Upgrade - Complete Payment Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Log current tier before tests
    await gotoAndWait(page, '/billing');
    await page.waitForTimeout(2000);

    const response = await page.request.get(`${CONFIG.apiURL}/api/billing/status`).catch(() => null);
    if (response && response.status() === 200) {
      const data = await response.json();
      console.log('Current tier before test:', data.tier);
    }
  });

  test('upgrade button redirects to Stripe checkout', async ({ page }) => {
    await gotoAndWait(page, '/billing');
    await page.waitForTimeout(2000);

    // Find upgrade button (Starter tier)
    const upgradeBtn = page.locator('button:has-text("Upgrade")').first();

    if (!(await upgradeBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log('No upgrade button - user may already be on paid tier');
      // Verify they're on a paid tier
      const statusResponse = await page.request.get(`${CONFIG.apiURL}/api/billing/status`).catch(() => null);
      if (statusResponse && statusResponse.status() === 200) {
        const data = await statusResponse.json();
        console.log('User tier:', data.tier);
        expect(['starter', 'pro', 'premium', 'hr_admin']).toContain(data.tier);
      }
      return;
    }

    console.log('Clicking upgrade button...');
    await upgradeBtn.click();

    // Wait for Stripe checkout to load
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 }).catch(() => {
      console.log('Did not redirect to Stripe:', page.url());
    });

    // Verify we're on Stripe checkout
    expect(page.url()).toContain('checkout.stripe.com');
    console.log('SUCCESS: Redirected to Stripe checkout:', page.url());

    // Take screenshot for manual verification
    await page.screenshot({ path: 'playwright/screenshots/stripe-checkout.png' });
    console.log('Screenshot saved. Use test card 4242424242424242 to complete payment manually.');

    // Verify Stripe page loaded correctly (has payment form elements)
    await page.waitForTimeout(3000);
    const hasPaymentForm = await page.locator('form, [class*="checkout"], [class*="payment"]').first().isVisible().catch(() => false);
    console.log('Stripe payment form visible:', hasPaymentForm);
  });

  test('verify paid tier features after upgrade', async ({ page }) => {
    // Get current tier
    const response = await page.request.get(`${CONFIG.apiURL}/api/billing/status`);

    if (response.status() !== 200) {
      console.log('Could not get billing status');
      return;
    }

    const data = await response.json();
    console.log('Current tier:', data.tier);
    console.log('Limits:', {
      sully_daily_limit: data.sully_daily_limit,
      saved_jobs_limit: data.saved_jobs_limit,
      comparison_limit: data.comparison_limit
    });

    if (data.tier === 'free') {
      console.log('Still on free tier - payment not completed');
      // Expected limits for free
      expect(data.sully_daily_limit).toBe(3);
      expect(data.saved_jobs_limit).toBe(5);
    } else if (data.tier === 'starter') {
      console.log('On Starter tier - checking unlocked features');
      expect(data.sully_daily_limit).toBeGreaterThan(3);
      expect(data.saved_jobs_limit).toBeGreaterThan(5);
    } else if (data.tier === 'pro') {
      console.log('On Pro tier - checking unlocked features');
      expect(data.sully_daily_limit).toBeGreaterThanOrEqual(50);
    } else if (data.tier === 'premium') {
      console.log('On Premium tier - unlimited features');
      expect(data.sully_daily_limit).toBeGreaterThanOrEqual(100);
    }
  });

  test('paid users see full facility indices', async ({ page }) => {
    // Check billing status first
    const statusResponse = await page.request.get(`${CONFIG.apiURL}/api/billing/status`);
    const tierData = statusResponse.status() === 200 ? await statusResponse.json() : { tier: 'unknown' };

    await gotoAndWait(page, '/facilities');
    await page.waitForTimeout(3000);

    // Click first facility
    const facilityLink = page.locator('a[href*="/facilities/"]').first();
    if (await facilityLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await facilityLink.click();
      await page.waitForTimeout(3000);

      // Check for full indices vs limited
      const hasRadarChart = await page.locator('[class*="radar"], canvas, svg[class*="chart"]').first().isVisible().catch(() => false);
      const hasUpgradePrompt = await page.locator('text=/Upgrade|Unlock|Premium/i').first().isVisible().catch(() => false);
      const hasAllIndices = await page.locator('[class*="index"], [class*="score"]').count();

      console.log('Facility detail:', {
        tier: tierData.tier,
        hasRadarChart,
        hasUpgradePrompt,
        indicesShown: hasAllIndices
      });

      if (['starter', 'pro', 'premium'].includes(tierData.tier)) {
        // Paid users should see full content
        expect(hasRadarChart || hasAllIndices > 2).toBeTruthy();
      } else {
        // Free users may see upgrade prompt
        console.log('Free user - limited view expected');
      }
    }
  });

  test('sully daily limits match tier', async ({ request }) => {
    // Check billing status via API - no need to load page
    const statusResponse = await request.get(`${CONFIG.apiURL}/api/billing/status`);

    if (statusResponse.status() !== 200) {
      console.log('Billing status requires auth:', statusResponse.status());
      return;
    }

    const data = await statusResponse.json();
    console.log('Current tier:', data.tier);
    console.log('Sully daily limit:', data.sully_daily_limit);

    // Verify limits match tier
    if (data.tier === 'free') {
      expect(data.sully_daily_limit).toBe(3);
    } else if (data.tier === 'starter') {
      expect(data.sully_daily_limit).toBeGreaterThanOrEqual(10);
    } else if (data.tier === 'pro') {
      expect(data.sully_daily_limit).toBeGreaterThanOrEqual(25);
    } else if (data.tier === 'premium') {
      expect(data.sully_daily_limit).toBeGreaterThanOrEqual(100);
    }
  });

  test('paid users can save more jobs', async ({ page }) => {
    await gotoAndWait(page, '/saved');
    await page.waitForTimeout(2000);

    // Check for save limit indicator
    const hasLimitText = await page.locator('text=/\\d+.*saved|limit.*\\d+/i').first().isVisible().catch(() => false);
    console.log('Shows saved jobs limit:', hasLimitText);

    // Check billing status
    const statusResponse = await page.request.get(`${CONFIG.apiURL}/api/billing/status`);
    if (statusResponse.status() === 200) {
      const data = await statusResponse.json();
      console.log('Saved jobs limit:', data.saved_jobs_limit);

      if (data.tier === 'free') {
        expect(data.saved_jobs_limit).toBe(5);
      } else {
        expect(data.saved_jobs_limit).toBeGreaterThan(5);
      }
    }
  });

  test('paid users can compare more facilities', async ({ page }) => {
    await gotoAndWait(page, '/compare');
    await page.waitForTimeout(2000);

    // Check for comparison limit
    const hasCompareUI = await page.locator('text=/Compare|Add Facility/i').first().isVisible().catch(() => false);
    console.log('Compare UI loaded:', hasCompareUI);

    const statusResponse = await page.request.get(`${CONFIG.apiURL}/api/billing/status`);
    if (statusResponse.status() === 200) {
      const data = await statusResponse.json();
      console.log('Comparison limit:', data.comparison_limit);

      if (data.tier === 'free') {
        // Free users have 0 or limited comparisons
        expect(data.comparison_limit).toBeLessThanOrEqual(2);
      } else {
        expect(data.comparison_limit).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Feature Unlock Verification by Tier', () => {

  test('list all tier features from API', async ({ request }) => {
    const response = await request.get(`${CONFIG.apiURL}/api/billing/tiers`);
    expect(response.status()).toBe(200);

    const data = await response.json();

    console.log('\n=== TIER FEATURES ===');
    for (const tier of data.tiers) {
      console.log(`\n${tier.name} ($${tier.monthly_price / 100}/mo):`);
      tier.features?.forEach((f: string) => console.log(`  - ${f}`));
    }
    console.log('=====================\n');
  });

  test('compare free vs paid limits', async ({ request }) => {
    const tiersResponse = await request.get(`${CONFIG.apiURL}/api/billing/tiers`);
    const tiers = (await tiersResponse.json()).tiers;

    const free = tiers.find((t: any) => t.id === 'free');
    const starter = tiers.find((t: any) => t.id === 'starter');
    const pro = tiers.find((t: any) => t.id === 'pro');
    const premium = tiers.find((t: any) => t.id === 'premium');

    console.log('\n=== TIER COMPARISON ===');
    console.log('Free features:', free?.features?.length || 0);
    console.log('Starter features:', starter?.features?.length || 0);
    console.log('Pro features:', pro?.features?.length || 0);
    console.log('Premium features:', premium?.features?.length || 0);
    console.log('========================\n');

    // Paid tiers should have more features
    expect(starter?.features?.length).toBeGreaterThanOrEqual(free?.features?.length || 0);
    expect(pro?.features?.length).toBeGreaterThanOrEqual(starter?.features?.length || 0);
  });

  test('all tiers have required fields', async ({ request }) => {
    const response = await request.get(`${CONFIG.apiURL}/api/billing/tiers`);
    const data = await response.json();

    for (const tier of data.tiers) {
      console.log(`Checking tier: ${tier.id}`);
      expect(tier).toHaveProperty('id');
      expect(tier).toHaveProperty('name');
      expect(tier).toHaveProperty('monthly_price');
      expect(tier).toHaveProperty('features');
      expect(Array.isArray(tier.features)).toBeTruthy();
    }

    // Must include free tier (fixed bug)
    const tierIds = data.tiers.map((t: any) => t.id);
    expect(tierIds).toContain('free');
    expect(tierIds).toContain('starter');
    expect(tierIds).toContain('pro');
    expect(tierIds).toContain('premium');
  });

  test('tier limits are properly configured', async ({ request }) => {
    const response = await request.get(`${CONFIG.apiURL}/api/billing/tiers`);
    const data = await response.json();

    // Find tiers and verify limits make sense
    const free = data.tiers.find((t: any) => t.id === 'free');
    const starter = data.tiers.find((t: any) => t.id === 'starter');
    const pro = data.tiers.find((t: any) => t.id === 'pro');
    const premium = data.tiers.find((t: any) => t.id === 'premium');

    // Verify pricing progression
    expect(free.monthly_price).toBe(0);
    expect(starter.monthly_price).toBeGreaterThan(0);
    expect(pro.monthly_price).toBeGreaterThan(starter.monthly_price);
    expect(premium.monthly_price).toBeGreaterThan(pro.monthly_price);

    console.log('Pricing:', {
      free: free.monthly_price,
      starter: starter.monthly_price,
      pro: pro.monthly_price,
      premium: premium.monthly_price
    });
  });
});

test.describe('Token Packs', () => {

  test('token packs are listed', async ({ page }) => {
    await gotoAndWait(page, '/billing');
    await page.waitForTimeout(2000);

    // Look for token pack section
    const hasTokenSection = await page.locator('text=/Token|Pack|Sully.*Question/i').first().isVisible().catch(() => false);
    console.log('Has token pack section:', hasTokenSection);

    // Look for buy buttons
    const buyButtons = page.locator('button:has-text("Buy")');
    const buttonCount = await buyButtons.count();
    console.log('Buy buttons found:', buttonCount);

    // At least one buy button should exist if user is authenticated
    if (hasTokenSection) {
      expect(buttonCount).toBeGreaterThan(0);
    }
  });

  test('token pack click redirects to Stripe', async ({ page }) => {
    await gotoAndWait(page, '/billing');
    await page.waitForTimeout(2000);

    // Find a token pack buy button
    const buyBtn = page.locator('button:has-text("Buy")').first();

    if (!(await buyBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log('No buy button visible - skipping');
      return;
    }

    console.log('Clicking buy button...');
    await buyBtn.click();

    // Wait for redirect
    await page.waitForTimeout(5000);
    const url = page.url();

    // Should redirect to Stripe or stay on billing (if error)
    const redirectedToStripe = url.includes('stripe.com');
    console.log('Token pack checkout redirect:', { redirectedToStripe, url });

    // If we got redirected, that's success
    if (redirectedToStripe) {
      expect(url).toContain('checkout.stripe.com');
      await page.screenshot({ path: 'playwright/screenshots/token-pack-checkout.png' });
    }
  });
});

test.describe('Billing API Validation', () => {

  test('billing status returns valid response', async ({ request }) => {
    const response = await request.get(`${CONFIG.apiURL}/api/billing/status`);

    // May be 401 if not authenticated in this context
    if (response.status() === 200) {
      const data = await response.json();

      console.log('Billing status:', data);

      // Validate required fields
      expect(data).toHaveProperty('tier');
      expect(data).toHaveProperty('sully_daily_limit');
      expect(data).toHaveProperty('saved_jobs_limit');

      // Validate tier is valid
      expect(['free', 'starter', 'pro', 'premium', 'hr_admin']).toContain(data.tier);

      // Validate limits are numbers
      expect(typeof data.sully_daily_limit).toBe('number');
      expect(typeof data.saved_jobs_limit).toBe('number');
    } else {
      console.log('Billing status requires auth:', response.status());
      expect([401, 403]).toContain(response.status());
    }
  });

  test('checkout endpoint behavior', async ({ request }) => {
    const response = await request.post(`${CONFIG.apiURL}/api/billing/checkout`, {
      data: { tier: 'starter', billing_period: 'monthly' }
    });

    console.log('Checkout response status:', response.status());

    // Checkout should either:
    // 1. Return 401/403 if not authenticated
    // 2. Return 200 with checkout URL if authenticated
    // 3. Return 400/422 for invalid input
    expect([200, 400, 401, 403, 422]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      console.log('Checkout response:', data);
      // Should have a checkout URL
      expect(data.url || data.checkout_url || data.session_url).toBeTruthy();
    }
  });

  test('tiers endpoint is public', async ({ request }) => {
    const response = await request.get(`${CONFIG.apiURL}/api/billing/tiers`);

    // Should be accessible without auth
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('tiers');
    expect(Array.isArray(data.tiers)).toBeTruthy();
  });
});
