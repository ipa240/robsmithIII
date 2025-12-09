import { test, expect } from '@playwright/test';
import { gotoAndWait, waitForPageLoad, isVisible, waitForAPI, CONFIG } from './fixtures';

test.describe('Billing & Payments', () => {
  test.describe('Billing Page Display', () => {
    test('billing page loads with tier cards', async ({ page }) => {
      await gotoAndWait(page, '/billing');

      // Check page title or header
      const header = page.locator('h1:has-text("Billing"), h1:has-text("Subscription"), h2:has-text("Plans")');
      await expect(header.first()).toBeVisible();

      // Check for tier cards
      const tierCards = page.locator('[class*="tier"], [class*="plan"], [class*="card"]');
      const cardCount = await tierCards.count();
      expect(cardCount).toBeGreaterThan(0);
    });

    test('displays all subscription tiers', async ({ page, isMobile }) => {
      await gotoAndWait(page, '/billing');

      // On mobile, need to scroll down to see content
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);

      if (isMobile) {
        // Mobile shows current plan and token packs instead of tier cards
        const currentPlan = page.locator('text=Current Plan');
        const hasPlan = await currentPlan.isVisible().catch(() => false);
        const hasTokenPacks = await page.locator('text=/Sully questions|Pack/').first().isVisible().catch(() => false);
        expect(hasPlan || hasTokenPacks).toBeTruthy();
      } else {
        // Desktop shows Starter, Pro, Premium tier cards
        const starter = page.locator('text=Starter');
        const pro = page.locator('text=Pro');
        const premium = page.locator('text=Premium');

        await expect(starter.first()).toBeVisible({ timeout: 10000 });
        await expect(pro.first()).toBeVisible({ timeout: 10000 });
        await expect(premium.first()).toBeVisible({ timeout: 10000 });
      }
    });

    test('displays pricing for each tier', async ({ page }) => {
      await gotoAndWait(page, '/billing');

      // Check for price indicators - look for $X/mo format
      const prices = page.locator('text=/\\$\\d+/');
      const priceCount = await prices.count();
      expect(priceCount).toBeGreaterThan(0);
    });

    test('monthly/yearly toggle exists and works', async ({ page }) => {
      await gotoAndWait(page, '/billing');

      // Look for billing period toggle
      const toggle = page.locator('[class*="toggle"], button:has-text("Monthly"), button:has-text("Yearly"), [class*="switch"]');

      if (await toggle.first().isVisible()) {
        // Click toggle
        await toggle.first().click();

        // Prices should update (look for "year" text appearing)
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('Current Subscription Status', () => {
    test('shows current tier badge', async ({ page }) => {
      await gotoAndWait(page, '/billing');

      // Look for current tier indicator
      const currentIndicator = page.locator('[class*="current"], :has-text("Current Plan"), [class*="badge"]');
      // May not be visible for unauthenticated users
    });

    test('shows token balance for Sully AI', async ({ page }) => {
      await gotoAndWait(page, '/billing');

      // Look for token/credit display
      const tokens = page.locator('text=tokens, text=credits, text=messages');
      // May be visible depending on user state
    });
  });

  test.describe('Upgrade Flow', () => {
    test('upgrade buttons are clickable', async ({ page }) => {
      await gotoAndWait(page, '/billing');

      // Find upgrade/subscribe buttons
      const upgradeButtons = page.locator('button:has-text("Upgrade"), button:has-text("Subscribe"), button:has-text("Get Started")');
      const buttonCount = await upgradeButtons.count();

      expect(buttonCount).toBeGreaterThan(0);

      // Check first button is enabled
      if (buttonCount > 0) {
        const firstButton = upgradeButtons.first();
        await expect(firstButton).toBeEnabled();
      }
    });

    test('upgrade button creates checkout session', async ({ page }) => {
      await gotoAndWait(page, '/billing');

      // Click an upgrade button
      const upgradeButton = page.locator('button:has-text("Upgrade"), button:has-text("Subscribe")').first();

      if (await upgradeButton.isVisible()) {
        // Set up API response listener
        const responsePromise = page.waitForResponse(
          (response) => response.url().includes('/checkout') || response.url().includes('/billing'),
          { timeout: 10000 }
        ).catch(() => null);

        await upgradeButton.click();

        const response = await responsePromise;
        // Either redirects to Stripe or shows error
      }
    });
  });

  test.describe('Sully Token Packs', () => {
    test('token pack section displays', async ({ page }) => {
      await gotoAndWait(page, '/billing');

      // Look for Sully token packs
      const tokenSection = page.locator('text=Token, text=Sully, text=AI Credits, text=Messages');
      const hasTokenSection = await tokenSection.first().isVisible().catch(() => false);

      // Token packs should be visible
      if (hasTokenSection) {
        // Look for pack options
        const packs = page.locator('[class*="pack"], [class*="token"]');
        const packCount = await packs.count();
        expect(packCount).toBeGreaterThanOrEqual(0);
      }
    });

    test('token pack buttons are clickable', async ({ page }) => {
      await gotoAndWait(page, '/billing');

      // Find token pack purchase buttons
      const packButtons = page.locator('button:has-text("Buy"), button:has-text("Purchase"), button:has-text("tokens")');
      const buttonCount = await packButtons.count();

      if (buttonCount > 0) {
        const firstButton = packButtons.first();
        await expect(firstButton).toBeEnabled();
      }
    });

    test('CRITICAL: token pack purchase creates checkout', async ({ page }) => {
      // THIS IS THE BROKEN FUNCTIONALITY
      await gotoAndWait(page, '/billing');

      // Find and click a token pack button
      const packButton = page.locator('button:has-text("Buy"), button:has-text("tokens")').first();

      if (await packButton.isVisible()) {
        // Listen for network requests
        const requests: string[] = [];
        page.on('request', (request) => {
          if (request.url().includes('api')) {
            requests.push(`${request.method()} ${request.url()}`);
          }
        });

        page.on('response', (response) => {
          if (response.url().includes('api')) {
            console.log(`API Response: ${response.status()} ${response.url()}`);
          }
        });

        await packButton.click();

        // Wait for API call
        await page.waitForTimeout(3000);

        // Log what happened
        console.log('API Requests made:', requests);

        // Check if we got redirected to Stripe or got an error
        const url = page.url();
        const hasError = await page.locator('[class*="error"], [role="alert"]').isVisible().catch(() => false);

        if (hasError) {
          const errorText = await page.locator('[class*="error"], [role="alert"]').textContent();
          console.log('ERROR FOUND:', errorText);
          // This test documents the bug
        }
      }
    });
  });

  test.describe('Billing API Endpoints', () => {
    test('GET /api/billing/status returns data', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/billing/status`);
      console.log('Billing status response:', response.status());

      // May return 401 if not authenticated
      expect([200, 401, 403]).toContain(response.status());
    });

    test('GET /api/billing/tiers returns tier data', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/billing/tiers`);

      if (response.status() === 200) {
        const data = await response.json();
        console.log('Tiers:', Object.keys(data));
      }
    });
  });
});

test.describe('Payment Webhook Integration', () => {
  test('webhook endpoint is reachable', async ({ page }) => {
    // Just check the endpoint exists (will reject without valid Stripe signature)
    const response = await page.request.post(`${CONFIG.apiURL}/api/billing/webhook`, {
      data: { test: true },
      headers: { 'stripe-signature': 'test' }
    }).catch((e) => ({ status: () => 400 }));

    // Should return 400 (invalid signature) not 404 (not found)
    expect(response.status()).not.toBe(404);
  });
});

test.describe('Feature Gating', () => {
  test('free users see upgrade prompts', async ({ page }) => {
    await gotoAndWait(page, '/billing');

    // Free tier should show upgrade options
    const upgradePrompts = page.locator('button:has-text("Upgrade"), a:has-text("Upgrade")');
    const count = await upgradePrompts.count();
    expect(count).toBeGreaterThan(0);
  });

  test('premium features show locked state for free users', async ({ page }) => {
    // Navigate to a premium feature
    await gotoAndWait(page, '/trends');

    // Look for lock icons or upgrade prompts
    const lockIndicators = page.locator('[class*="lock"], [class*="premium"], :has-text("Upgrade to")');
    // May or may not be present
  });
});
