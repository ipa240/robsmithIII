import { test as setup, expect } from '@playwright/test';
import { CONFIG } from './fixtures';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the landing page first
  await page.goto('/');

  // Check if already logged in by looking for authenticated elements
  const isLoggedIn = await page.locator('[data-testid="user-menu"], .user-menu, nav a[href="/dashboard"]').isVisible().catch(() => false);

  if (!isLoggedIn) {
    // Click login button (says "Log In" on the page)
    await page.click('a:has-text("Log In"), button:has-text("Log In"), a:has-text("Get Started")');

    // Wait for Zitadel login page
    await page.waitForURL(/.*zitadel.*|.*auth.*|.*login.*/i, { timeout: 10000 }).catch(() => {
      // If no redirect, we might be on a custom login page
    });

    // Fill in credentials (Zitadel login)
    await page.fill('input[name="loginName"], input[type="email"], #loginName', CONFIG.testUser.email);
    await page.click('button[type="submit"]');

    // Wait for password field
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.fill('input[type="password"]', CONFIG.testUser.password);
    await page.click('button[type="submit"]');

    // Wait for redirect back to app
    await page.waitForURL(/.*vanurses.*|.*callback.*/i, { timeout: 30000 });

    // Wait for app to be fully loaded
    await page.waitForLoadState('networkidle');
  }

  // Verify we're authenticated
  await expect(page).toHaveURL(/.*dashboard.*|.*jobs.*|.*onboarding.*/i);

  // If on onboarding page, complete it step by step
  if (page.url().includes('onboarding')) {
    console.log('Completing onboarding flow...');

    // Step 1: Welcome - Just click Next
    const step1Next = page.locator('button:has-text("Next")');
    await step1Next.click();
    await page.waitForTimeout(800);

    // Step 2: License - Select RN license type and click Next
    console.log('Step 2: License selection');
    const rnLicense = page.locator('button:has-text("RN")').first();
    if (await rnLicense.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rnLicense.click();
      await page.waitForTimeout(300);
    }
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(800);

    // Step 3: Experience - Select years and click Next
    console.log('Step 3: Experience');
    const expOption = page.locator('button:has-text("1-3"), button:has-text("3-5"), button:has-text("5+")').first();
    if (await expOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expOption.click();
      await page.waitForTimeout(300);
    }
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(800);

    // Step 4: Preferences (Specialties/Shifts) - Select one and click Next
    console.log('Step 4: Preferences');
    const prefOption = page.locator('button:has-text("ICU"), button:has-text("ER"), button:has-text("Med-Surg")').first();
    if (await prefOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await prefOption.click();
      await page.waitForTimeout(300);
    }
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(800);

    // Step 5: Location - Select region and click Next
    console.log('Step 5: Location');
    const regionOption = page.locator('button:has-text("Northern"), button:has-text("Central"), button:has-text("Hampton")').first();
    if (await regionOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await regionOption.click();
      await page.waitForTimeout(300);
    }
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(800);

    // Step 6: Priorities (OFS weights) - Just click Next (defaults are fine)
    console.log('Step 6: Priorities');
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(1000);

    // Step 7: Complete - Select Free tier and click Continue
    console.log('Step 7: Complete - selecting Free tier');
    const freeTier = page.locator('button:has-text("Free")').first();
    if (await freeTier.isVisible({ timeout: 3000 }).catch(() => false)) {
      await freeTier.click();
      await page.waitForTimeout(500);
    }

    // Click Continue with Free button
    const continueBtn = page.locator('button:has-text("Continue with Free"), button:has-text("Continue")').first();
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.click();
    }

    // Wait for redirect to dashboard/jobs
    await page.waitForURL(/.*dashboard.*|.*jobs.*/i, { timeout: 20000 }).catch(() => {
      console.log('Still on onboarding after completion attempt - URL:', page.url());
    });

    console.log('After onboarding:', page.url());
  }

  // Now we should be on dashboard or jobs page
  await page.waitForLoadState('networkidle');
  console.log('Final URL after auth:', page.url());

  // IMPORTANT: Navigate to a few pages to ensure all cookies are set
  // This is necessary because the app may set cookies on navigation
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Verify we're NOT on onboarding anymore
  if (page.url().includes('onboarding')) {
    console.log('WARNING: Still on onboarding after setup - user may need manual onboarding completion');
  } else {
    console.log('Successfully reached dashboard:', page.url());
  }

  // Save authentication state (includes cookies from both auth.vanurses.net and vanurses.net)
  await page.context().storageState({ path: authFile });
});
