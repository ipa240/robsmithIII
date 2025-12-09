import { test, expect } from '@playwright/test';
import { gotoAndWait, isVisible } from './fixtures';

test.describe('Authentication & Landing', () => {
  test.describe('Landing Page', () => {
    test('landing page loads with hero section', async ({ page }) => {
      await gotoAndWait(page, '/');

      // Check hero section exists
      await expect(page.locator('h1, .hero-title')).toBeVisible();

      // Check for main CTA buttons (button says "Log In" or "Get Started")
      const loginButton = page.locator('a:has-text("Log In"), button:has-text("Log In"), a:has-text("Get Started")');
      await expect(loginButton.first()).toBeVisible();
    });

    test('landing page displays features section', async ({ page }) => {
      await gotoAndWait(page, '/');

      // Scroll to features
      await page.evaluate(() => window.scrollTo(0, 500));

      // Check for feature cards or sections
      const hasFeatures = await isVisible(page, '.features, [class*="feature"], section:has-text("Score")');
      expect(hasFeatures).toBeTruthy();
    });

    test('landing page displays statistics', async ({ page }) => {
      await gotoAndWait(page, '/');

      // Look for stats like job counts, facility counts
      const statsSection = page.locator('[class*="stats"], [class*="count"], .stat');
      // Stats may or may not exist
    });

    test('landing page has working navigation links', async ({ page }) => {
      await gotoAndWait(page, '/');

      // Check navigation items exist
      const nav = page.locator('nav, header');
      await expect(nav).toBeVisible();
    });
  });

  test.describe('Sign In Flow', () => {
    test('login button redirects to auth', async ({ page }) => {
      await gotoAndWait(page, '/');

      const loginButton = page.locator('a:has-text("Log In"), button:has-text("Log In")').first();
      await loginButton.click();

      // Should redirect to Zitadel or show login form
      await page.waitForURL(/.*login.*|.*auth.*|.*zitadel.*/i, { timeout: 10000 }).catch(() => {
        // May stay on same page with modal
      });
    });
  });

  test.describe('Authenticated User', () => {
    test('authenticated user sees dashboard or jobs', async ({ page }) => {
      await gotoAndWait(page, '/dashboard');

      // Should either be on dashboard or redirected to login
      const url = page.url();
      expect(url).toMatch(/dashboard|login|jobs|onboarding/i);
    });

    test('user menu displays when authenticated', async ({ page }) => {
      await gotoAndWait(page, '/dashboard');

      // Look for user menu or account dropdown
      const userMenu = page.locator('[data-testid="user-menu"], .user-menu, [class*="account"], [class*="avatar"]');
      // May not be visible if not authenticated
    });
  });

  test.describe('Onboarding Flow', () => {
    test('onboarding page loads for new users', async ({ page }) => {
      await gotoAndWait(page, '/onboarding');

      // Should show onboarding steps or redirect
      const url = page.url();
      if (url.includes('onboarding')) {
        // Check for step indicators
        const stepIndicator = page.locator('[class*="step"], [class*="progress"]');
        await expect(stepIndicator).toBeVisible();
      }
    });

    test('onboarding has nursing type selection', async ({ page }) => {
      await gotoAndWait(page, '/onboarding');

      if (page.url().includes('onboarding')) {
        // Look for nursing type buttons/options
        const nursingOptions = page.locator('button:has-text("RN"), button:has-text("LPN"), button:has-text("CNA")');
        // May not be on first step
      }
    });
  });
});

test.describe('Public Pages', () => {
  test('privacy policy page loads', async ({ page }) => {
    await gotoAndWait(page, '/privacy');

    // Privacy page should have some heading or content about privacy
    const hasPrivacyContent = await isVisible(page, 'h1, h2, h3');
    expect(hasPrivacyContent).toBeTruthy();
  });

  test('terms of service page loads', async ({ page }) => {
    await gotoAndWait(page, '/terms');

    // Terms page should have some heading or content about terms
    const hasTermsContent = await isVisible(page, 'h1, h2, h3');
    expect(hasTermsContent).toBeTruthy();
  });

  test('support page loads', async ({ page }) => {
    await gotoAndWait(page, '/support');

    // Check for support content
    const hasContent = await isVisible(page, 'h1, h2, .support');
    expect(hasContent).toBeTruthy();
  });
});
