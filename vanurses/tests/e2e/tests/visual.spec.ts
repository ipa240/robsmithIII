import { test, expect } from '@playwright/test';
import { gotoAndWait } from './fixtures';
import { setupConsoleErrorCapture } from './page-health';

// All pages to test
const PAGES_TO_TEST = [
  { path: '/', name: 'Landing Page' },
  { path: '/jobs', name: 'Jobs List' },
  { path: '/facilities', name: 'Facilities List' },
  { path: '/billing', name: 'Billing Page' },
  { path: '/sully', name: 'Sully AI Chat' },
  { path: '/compare', name: 'Compare Facilities' },
  { path: '/profile', name: 'User Profile' },
  { path: '/saved', name: 'Saved Jobs' },
  { path: '/applications', name: 'Applications' },
  { path: '/notifications', name: 'Notifications' },
  { path: '/trends', name: 'Market Trends' },
  { path: '/news', name: 'Healthcare News' },
];

test.describe('Visual Quality Tests', () => {

  test.describe('Console Errors', () => {
    for (const pageInfo of PAGES_TO_TEST) {
      test(`${pageInfo.name} has no critical JavaScript errors`, async ({ page }) => {
        const errors = setupConsoleErrorCapture(page);

        await gotoAndWait(page, pageInfo.path);
        await page.waitForTimeout(3000); // Wait for async operations

        // Filter out known non-critical errors
        const criticalErrors = errors.filter(e =>
          !e.includes('favicon') &&
          !e.includes('404') &&
          !e.includes('Clarity') &&
          !e.includes('Failed to load resource') &&
          !e.includes('net::ERR') &&
          !e.includes('error boundary') && // React error boundary logs are informational
          !e.includes('Consider adding an error boundary') &&
          !e.includes('Warning:') && // React warnings, not errors
          !e.includes('AxiosError') && // Network errors that are handled
          !e.includes('onboarding status') // Onboarding check error
        );

        if (criticalErrors.length > 0) {
          console.log(`Console errors on ${pageInfo.path}:`, criticalErrors);
        }

        expect(criticalErrors, `Console errors on ${pageInfo.path}`).toHaveLength(0);
      });
    }
  });

  test.describe('Broken Images', () => {
    for (const pageInfo of PAGES_TO_TEST) {
      test(`${pageInfo.name} has no broken images`, async ({ page }) => {
        await gotoAndWait(page, pageInfo.path);
        await page.waitForTimeout(2000);

        const images = await page.locator('img').all();
        const brokenImages: string[] = [];

        for (const img of images) {
          try {
            const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
            const src = await img.getAttribute('src');
            if (naturalWidth === 0 && src && !src.includes('data:')) {
              brokenImages.push(src);
            }
          } catch {
            // Image may have been removed
          }
        }

        if (brokenImages.length > 0) {
          console.log(`Broken images on ${pageInfo.path}:`, brokenImages);
        }

        expect(brokenImages, `Broken images on ${pageInfo.path}`).toHaveLength(0);
      });
    }
  });

  test.describe('Text Formatting', () => {
    for (const pageInfo of PAGES_TO_TEST) {
      test(`${pageInfo.name} has no malformed text`, async ({ page }) => {
        await gotoAndWait(page, pageInfo.path);
        await page.waitForTimeout(2000);

        const badPatterns = [
          'undefined',
          '[object Object]',
          'DATASET',  // Known Sully issue
          '{{',
          '${',
        ];

        const pageText = await page.textContent('body');
        const issues: string[] = [];

        for (const pattern of badPatterns) {
          if (pageText?.includes(pattern)) {
            issues.push(`Found "${pattern}" on page`);
          }
        }

        if (issues.length > 0) {
          console.log(`Text issues on ${pageInfo.path}:`, issues);
        }

        expect(issues, `Text issues on ${pageInfo.path}`).toHaveLength(0);
      });
    }
  });

  test.describe('Layout & Overflow', () => {
    for (const pageInfo of PAGES_TO_TEST) {
      test(`${pageInfo.name} has no horizontal overflow`, async ({ page }) => {
        await gotoAndWait(page, pageInfo.path);
        await page.waitForTimeout(2000);

        const hasOverflow = await page.evaluate(() => {
          return document.body.scrollWidth > window.innerWidth + 20;
        });

        expect(hasOverflow, `Horizontal overflow on ${pageInfo.path}`).toBeFalsy();
      });
    }
  });

  test.describe('Required Elements Present', () => {
    test('Jobs page has job cards or message', async ({ page }) => {
      await gotoAndWait(page, '/jobs');
      await page.waitForTimeout(5000);

      // Should have some job cards, "no results" message, or a loading skeleton
      const hasJobCards = await page.locator('[class*="job"], [class*="card"], a[href*="/jobs/"]').first().isVisible().catch(() => false);
      const hasNoResults = await page.locator('text=/No jobs|no results|0 results/i').first().isVisible().catch(() => false);
      const hasHeader = await page.locator('h1, h2, [class*="heading"]').first().isVisible().catch(() => false);
      const hasJobTitle = await page.locator('text=/Registered Nurse|RN|Nursing|Jobs/i').first().isVisible().catch(() => false);

      console.log('Jobs page check:', { hasJobCards, hasNoResults, hasHeader, hasJobTitle });

      expect(hasHeader || hasJobTitle).toBeTruthy();
      expect(hasJobCards || hasNoResults || hasJobTitle).toBeTruthy();
    });

    test('Facilities page has facility cards', async ({ page }) => {
      await gotoAndWait(page, '/facilities');
      await page.waitForTimeout(5000);

      const hasCards = await page.locator('[class*="facility"], [class*="card"], a[href*="/facilities/"]').first().isVisible().catch(() => false);
      const hasHeader = await page.locator('h1, h2, [class*="heading"]').first().isVisible().catch(() => false);
      const hasFacilityName = await page.locator('text=/Hospital|Medical|Health|Center/i').first().isVisible().catch(() => false);

      console.log('Facilities page check:', { hasCards, hasHeader, hasFacilityName });

      expect(hasHeader || hasFacilityName).toBeTruthy();
      expect(hasCards || hasFacilityName).toBeTruthy();
    });

    test('Billing page shows all tier cards', async ({ page }) => {
      await gotoAndWait(page, '/billing');
      await page.waitForTimeout(2000);

      // All 4 tiers should be visible
      await expect(page.locator('text=Free').first()).toBeVisible();
      await expect(page.locator('text=Starter').first()).toBeVisible();
      await expect(page.locator('text=Pro').first()).toBeVisible();
      await expect(page.locator('text=Premium').first()).toBeVisible();
    });

    test('Profile page shows user info section', async ({ page }) => {
      await gotoAndWait(page, '/profile');
      await page.waitForTimeout(2000);

      // Should show some profile-related content
      const hasProfileContent = await page.locator('h1, h2, [class*="profile"]').first().isVisible();
      expect(hasProfileContent).toBeTruthy();
    });

    test('Landing page has hero section', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Should have hero content
      const hasHero = await page.locator('[class*="hero"], h1').first().isVisible();
      expect(hasHero).toBeTruthy();
    });
  });
});
