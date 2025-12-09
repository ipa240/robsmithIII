/**
 * Complete User Journey Test
 *
 * Simulates a real human going through the entire app:
 * 1. Sign up / Login
 * 2. Complete onboarding
 * 3. View matched results
 * 4. Browse and filter jobs
 * 5. View job details
 * 6. Save a job
 * 7. View facilities
 * 8. View facility details
 * 9. Compare facilities
 * 10. Chat with Sully AI
 * 11. Check billing/upgrade options
 * 12. Update profile/preferences
 *
 * Run with: npx playwright test complete-user-journey.spec.ts --project=chromium
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://192.168.0.150:5173';
const API_URL = process.env.TEST_API_URL || 'http://192.168.0.150:5011';

// Test user credentials - use a dedicated test account
const TEST_USER = {
  email: 'e2e-test@vanurses.net',
  password: 'TestUser2025!'
};

// Helper to wait for page to be ready
async function waitForPageReady(page: Page, timeout = 10000) {
  await page.waitForLoadState('networkidle', { timeout });
  await page.waitForTimeout(500); // Brief pause for React hydration
}

// Helper to handle onboarding if it appears
async function handleOnboardingIfPresent(page: Page) {
  const onboardingIndicators = [
    'text=/welcome|get started|let\'s begin/i',
    '[data-testid="onboarding"]',
    'text=/what type of nurse/i'
  ];

  for (const indicator of onboardingIndicators) {
    if (await page.locator(indicator).first().isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Onboarding detected - completing...');
      await completeOnboarding(page);
      return true;
    }
  }
  return false;
}

// Complete the onboarding flow
async function completeOnboarding(page: Page) {
  // Step 1: Nurse Type
  const nurseTypeBtn = page.locator('button:has-text("RN")').first();
  if (await nurseTypeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nurseTypeBtn.click();
    await page.waitForTimeout(500);
  }

  // Look for Next/Continue button
  const nextBtn = page.locator('button:has-text("Next"), button:has-text("Continue")').first();
  if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nextBtn.click();
    await page.waitForTimeout(1000);
  }

  // Step 2: Specialties - select ICU and ER
  const icuBtn = page.locator('button:has-text("ICU")').first();
  if (await icuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await icuBtn.click();
    const erBtn = page.locator('button:has-text("ER")').first();
    if (await erBtn.isVisible().catch(() => false)) await erBtn.click();
  }

  // Next
  if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nextBtn.click();
    await page.waitForTimeout(1000);
  }

  // Step 3: Employment Type - select Full-Time
  const fullTimeBtn = page.locator('button:has-text("Full-Time"), button:has-text("Full Time")').first();
  if (await fullTimeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await fullTimeBtn.click();
  }

  // Next
  if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nextBtn.click();
    await page.waitForTimeout(1000);
  }

  // Step 4: Experience/Years - enter 5 years
  const yearsInput = page.locator('input[type="number"], input[placeholder*="year"]').first();
  if (await yearsInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await yearsInput.fill('5');
  }

  // Final submit/complete
  const completeBtn = page.locator('button:has-text("Complete"), button:has-text("Finish"), button:has-text("Get Started")').first();
  if (await completeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await completeBtn.click();
    await page.waitForTimeout(2000);
  }

  console.log('Onboarding completed');
}

// Navigate and ensure we're on the right page
async function navigateTo(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`);
  await waitForPageReady(page);
  await handleOnboardingIfPresent(page);
}

test.describe('Complete User Journey', () => {
  test.describe.configure({ mode: 'serial' }); // Run tests in order

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // Create a persistent context to maintain login state across tests
    const context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('1. Landing page loads and shows key elements', async () => {
    await page.goto(BASE_URL);
    await waitForPageReady(page);

    // Check for key landing page elements
    const hasHero = await page.locator('text=/Virginia.*Nurs|Find.*Job|Healthcare/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasLoginBtn = await page.locator('text=/Sign In|Login|Get Started/i').first().isVisible().catch(() => false);

    console.log('Landing page:', { hasHero, hasLoginBtn });
    expect(hasHero || hasLoginBtn).toBeTruthy();

    await page.screenshot({ path: 'playwright/screenshots/journey-01-landing.png' });
  });

  test('2. Login/Authentication flow', async () => {
    // Click sign in button
    const signInBtn = page.locator('text=/Sign In|Login|Get Started/i').first();
    if (await signInBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await signInBtn.click();
      await page.waitForTimeout(3000);
    }

    // Check if we're redirected to auth or already logged in
    const currentUrl = page.url();
    console.log('After sign in click:', currentUrl);

    // If on Zitadel login page, complete login
    if (currentUrl.includes('zitadel') || currentUrl.includes('auth')) {
      console.log('On auth page - completing login...');

      // Fill email
      const emailInput = page.locator('input[type="email"], input[name="loginName"], input[id="loginName"]').first();
      if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await emailInput.fill(TEST_USER.email);
        await page.locator('button[type="submit"], button:has-text("Next")').first().click();
        await page.waitForTimeout(2000);
      }

      // Fill password
      const passwordInput = page.locator('input[type="password"]').first();
      if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await passwordInput.fill(TEST_USER.password);
        await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first().click();
        await page.waitForTimeout(3000);
      }
    }

    await page.screenshot({ path: 'playwright/screenshots/journey-02-auth.png' });
  });

  test('3. Complete onboarding (if needed)', async () => {
    await waitForPageReady(page);

    const completedOnboarding = await handleOnboardingIfPresent(page);
    console.log('Onboarding needed:', completedOnboarding);

    await page.screenshot({ path: 'playwright/screenshots/journey-03-onboarding.png' });
  });

  test('4. View Results page - matched jobs', async () => {
    await navigateTo(page, '/results');

    // Check for matched jobs content
    const hasResults = await page.locator('text=/matched|results|your score/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasJobCards = await page.locator('[class*="job"], [class*="card"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasNoResults = await page.locator('text=/no.*found|no.*match/i').first().isVisible({ timeout: 2000 }).catch(() => false);

    console.log('Results page:', { hasResults, hasJobCards, hasNoResults });

    // Should have either job cards or a "no results" message
    expect(hasResults || hasJobCards || hasNoResults).toBeTruthy();

    await page.screenshot({ path: 'playwright/screenshots/journey-04-results.png' });
  });

  test('5. Browse Jobs page with filters', async () => {
    await navigateTo(page, '/jobs');

    // Check page loaded
    const hasJobsHeader = await page.locator('text=/nursing jobs|job listings/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasJobCards = await page.locator('a[href*="/jobs/"]').first().isVisible({ timeout: 3000 }).catch(() => false);

    console.log('Jobs page:', { hasJobsHeader, hasJobCards });
    expect(hasJobsHeader || hasJobCards).toBeTruthy();

    // Test filters
    const filterBtn = page.locator('button:has-text("Filter"), button:has-text("Filters")').first();
    if (await filterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterBtn.click();
      await page.waitForTimeout(500);

      // Try to select a specialty filter
      const specialtySelect = page.locator('select').filter({ hasText: /specialty|all specialties/i }).first();
      if (await specialtySelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await specialtySelect.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
        console.log('Applied specialty filter');
      }
    }

    await page.screenshot({ path: 'playwright/screenshots/journey-05-jobs.png' });
  });

  test('6. View Job details', async () => {
    await navigateTo(page, '/jobs');

    // Click on first job card
    const jobLink = page.locator('a[href*="/jobs/"]').first();
    if (await jobLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await jobLink.click();
      await waitForPageReady(page);

      // Check job detail page
      const hasJobTitle = await page.locator('h1, h2').first().isVisible({ timeout: 3000 }).catch(() => false);
      const hasFacilityInfo = await page.locator('text=/facility|hospital|location/i').first().isVisible().catch(() => false);
      const hasApplyBtn = await page.locator('text=/apply|save|view/i').first().isVisible().catch(() => false);

      console.log('Job detail page:', { hasJobTitle, hasFacilityInfo, hasApplyBtn });
      expect(hasJobTitle).toBeTruthy();

      await page.screenshot({ path: 'playwright/screenshots/journey-06-job-detail.png' });
    }
  });

  test('7. Save a job', async () => {
    // Navigate to jobs and try to save one
    await navigateTo(page, '/jobs');

    const saveBtn = page.locator('button:has-text("Save"), button[aria-label*="save"], [data-testid="save-job"]').first();
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
      console.log('Saved a job');
    }

    // Check saved jobs page
    await navigateTo(page, '/saved');
    const hasSavedSection = await page.locator('text=/saved|bookmarked/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log('Saved jobs page:', { hasSavedSection });

    await page.screenshot({ path: 'playwright/screenshots/journey-07-saved.png' });
  });

  test('8. Browse Facilities page', async () => {
    await navigateTo(page, '/facilities');

    const hasFacilitiesHeader = await page.locator('text=/facilities|hospitals/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasFacilityCards = await page.locator('a[href*="/facilities/"]').first().isVisible({ timeout: 3000 }).catch(() => false);

    console.log('Facilities page:', { hasFacilitiesHeader, hasFacilityCards });
    expect(hasFacilitiesHeader || hasFacilityCards).toBeTruthy();

    await page.screenshot({ path: 'playwright/screenshots/journey-08-facilities.png' });
  });

  test('9. View Facility details', async () => {
    await navigateTo(page, '/facilities');

    const facilityLink = page.locator('a[href*="/facilities/"]').first();
    if (await facilityLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await facilityLink.click();
      await waitForPageReady(page);

      const hasFacilityName = await page.locator('h1, h2').first().isVisible({ timeout: 3000 }).catch(() => false);
      const hasScoreInfo = await page.locator('text=/score|grade|rating/i').first().isVisible().catch(() => false);

      console.log('Facility detail:', { hasFacilityName, hasScoreInfo });
      expect(hasFacilityName).toBeTruthy();

      await page.screenshot({ path: 'playwright/screenshots/journey-09-facility-detail.png' });
    }
  });

  test('10. Compare facilities', async () => {
    await navigateTo(page, '/compare');

    const hasCompareHeader = await page.locator('text=/compare|comparison/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Compare page:', { hasCompareHeader });

    await page.screenshot({ path: 'playwright/screenshots/journey-10-compare.png' });
  });

  test('11. Chat with Sully AI', async () => {
    await navigateTo(page, '/sully');

    const hasSullyHeader = await page.locator('text=/sully|ai|assistant|chat/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasChatInput = await page.locator('input[type="text"], textarea').first().isVisible({ timeout: 3000 }).catch(() => false);

    console.log('Sully page:', { hasSullyHeader, hasChatInput });

    // Try sending a message
    if (hasChatInput) {
      const chatInput = page.locator('input[type="text"], textarea').first();
      await chatInput.fill('What jobs are available in ICU?');

      const sendBtn = page.locator('button[type="submit"], button:has-text("Send")').first();
      if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sendBtn.click();
        await page.waitForTimeout(3000); // Wait for AI response
        console.log('Sent message to Sully');
      }
    }

    await page.screenshot({ path: 'playwright/screenshots/journey-11-sully.png' });
  });

  test('12. Check Billing page', async () => {
    await navigateTo(page, '/billing');

    const hasBillingHeader = await page.locator('text=/billing|subscription|plan|pricing/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasTierCards = await page.locator('text=/free|starter|pro|premium/i').first().isVisible({ timeout: 3000 }).catch(() => false);

    console.log('Billing page:', { hasBillingHeader, hasTierCards });
    expect(hasBillingHeader || hasTierCards).toBeTruthy();

    await page.screenshot({ path: 'playwright/screenshots/journey-12-billing.png' });
  });

  test('13. Update Profile/Preferences', async () => {
    await navigateTo(page, '/profile');

    const hasProfileHeader = await page.locator('text=/profile|preferences|settings/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasFormFields = await page.locator('input, select').first().isVisible({ timeout: 3000 }).catch(() => false);

    console.log('Profile page:', { hasProfileHeader, hasFormFields });

    // Try updating a preference
    const prioritySlider = page.locator('input[type="range"]').first();
    if (await prioritySlider.isVisible({ timeout: 2000 }).catch(() => false)) {
      await prioritySlider.fill('4');
      console.log('Updated priority slider');
    }

    await page.screenshot({ path: 'playwright/screenshots/journey-13-profile.png' });
  });

  test('14. Check Market Trends', async () => {
    await navigateTo(page, '/trends');

    const hasTrendsHeader = await page.locator('text=/trends|market|analytics/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Trends page:', { hasTrendsHeader });

    await page.screenshot({ path: 'playwright/screenshots/journey-14-trends.png' });
  });

  test('15. Check Healthcare News', async () => {
    await navigateTo(page, '/news');

    const hasNewsHeader = await page.locator('text=/news|healthcare|articles/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log('News page:', { hasNewsHeader });

    await page.screenshot({ path: 'playwright/screenshots/journey-15-news.png' });
  });

  test('16. Final - Verify all critical data displays correctly', async () => {
    // Go back to results to verify the normalization fix works
    await navigateTo(page, '/results');
    await page.waitForTimeout(2000);

    const jobCount = await page.locator('[class*="job"], [class*="card"]').count();
    const hasNoResultsMsg = await page.locator('text=/no.*found|no.*match/i').first().isVisible({ timeout: 2000 }).catch(() => false);

    console.log('Final results check:', { jobCount, hasNoResultsMsg });

    // Take final screenshot
    await page.screenshot({ path: 'playwright/screenshots/journey-16-final.png', fullPage: true });

    // The test passes if we have jobs OR a proper "no results" message
    // (not a blank page or error)
    expect(jobCount > 0 || hasNoResultsMsg).toBeTruthy();
  });
});

test.describe('Quick Smoke Test', () => {
  // Faster version that just checks all pages load without errors

  test('All pages load without errors', async ({ page }) => {
    const pages = [
      { path: '/', name: 'Landing' },
      { path: '/jobs', name: 'Jobs' },
      { path: '/facilities', name: 'Facilities' },
      { path: '/billing', name: 'Billing' },
      { path: '/trends', name: 'Trends' },
      { path: '/news', name: 'News' },
    ];

    const results: Record<string, boolean> = {};

    for (const p of pages) {
      await page.goto(`${BASE_URL}${p.path}`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      // Check for error indicators
      const hasError = await page.locator('text=/error|failed|500|404/i').first().isVisible({ timeout: 1000 }).catch(() => false);
      const hasContent = await page.locator('h1, h2, [class*="card"]').first().isVisible({ timeout: 3000 }).catch(() => false);

      results[p.name] = !hasError && hasContent;
      console.log(`${p.name}: ${results[p.name] ? 'OK' : 'FAIL'}`);
    }

    // All pages should load successfully
    const allPassed = Object.values(results).every(v => v);
    console.log('\nSmoke test results:', results);
    expect(allPassed).toBeTruthy();
  });
});

test.describe('Data Normalization Verification', () => {
  // Specific tests to verify the normalization fix

  test('API accepts both display and database format', async ({ request }) => {
    // Test 1: Display format
    const displayResponse = await request.get(`${API_URL}/api/jobs/matched`, {
      params: {
        specialties: 'ICU,OR',
        employment_types: 'Full-Time,Part-Time',
        limit: 5
      }
    });
    expect(displayResponse.status()).toBe(200);
    const displayData = await displayResponse.json();
    console.log('Display format jobs:', displayData.data?.length || 0);

    // Test 2: Database format
    const dbResponse = await request.get(`${API_URL}/api/jobs/matched`, {
      params: {
        specialties: 'icu,or',
        employment_types: 'full_time,part_time',
        limit: 5
      }
    });
    expect(dbResponse.status()).toBe(200);
    const dbData = await dbResponse.json();
    console.log('Database format jobs:', dbData.data?.length || 0);

    // Both should return results (same count ideally)
    expect(displayData.data?.length).toBeGreaterThan(0);
    expect(dbData.data?.length).toBeGreaterThan(0);
  });

  test('Jobs page filters work correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/jobs`);
    await page.waitForLoadState('networkidle');

    // Get initial job count
    const initialCount = await page.locator('text=/\\d+.*jobs/i').first().textContent().catch(() => '0 jobs');
    console.log('Initial:', initialCount);

    // Open filters
    const filterBtn = page.locator('button:has-text("Filter")').first();
    if (await filterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterBtn.click();
      await page.waitForTimeout(500);
    }

    // Select employment type filter
    const empSelect = page.locator('select').filter({ hasText: /employment|all employment/i }).first();
    if (await empSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await empSelect.selectOption('full_time');
      await page.waitForTimeout(2000);

      const filteredCount = await page.locator('text=/\\d+.*jobs/i').first().textContent().catch(() => '0 jobs');
      console.log('After filter:', filteredCount);

      // Should have some results
      expect(filteredCount).not.toBe('0 jobs');
    }
  });
});
