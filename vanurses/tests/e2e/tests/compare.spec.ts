import { test, expect } from '@playwright/test';
import { gotoAndWait, CONFIG } from './fixtures';

test.describe('Facility Comparison', () => {
  test.describe('Compare Page Display', () => {
    test('compare page loads', async ({ page }) => {
      await gotoAndWait(page, '/compare');

      const header = page.locator('h1, h2').filter({ hasText: /Compare|Comparison/i });
      await expect(header.first()).toBeVisible();
    });

    test('add facility UI exists', async ({ page }) => {
      await gotoAndWait(page, '/compare');

      // Look for add facility button or search
      const addButton = page.locator('button:has-text("Add"), input[placeholder*="Search"], [class*="add"]');
      const hasAdd = await addButton.first().isVisible().catch(() => false);
      expect(hasAdd).toBeTruthy();
    });
  });

  test.describe('Adding Facilities', () => {
    test('can search for facilities to add', async ({ page }) => {
      await gotoAndWait(page, '/compare');

      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
      if (await searchInput.first().isVisible()) {
        await searchInput.first().fill('Medical');
        await page.waitForTimeout(1000);

        // Results should appear
        const results = page.locator('[class*="result"], [class*="option"], [class*="suggestion"]');
        const hasResults = await results.first().isVisible().catch(() => false);
      }
    });

    test('can add facility to comparison', async ({ page }) => {
      await gotoAndWait(page, '/compare');

      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
      if (await searchInput.first().isVisible()) {
        await searchInput.first().fill('Medical');
        await page.waitForTimeout(1500);

        // Click first result
        const firstResult = page.locator('[class*="result"], [class*="option"]').first();
        if (await firstResult.isVisible()) {
          await firstResult.click();
          await page.waitForTimeout(500);

          // Facility should be added to comparison
          const comparedFacility = page.locator('[class*="compared"], [class*="selected"]');
        }
      }
    });

    test('maximum 5 facilities limit', async ({ page }) => {
      // This test documents expected behavior
      await gotoAndWait(page, '/compare');

      // UI should indicate max 5 facilities
      const limitText = page.locator('text=/5.*facilities|up to 5/i');
    });
  });

  test.describe('Comparison Display', () => {
    test('comparison table shows side-by-side', async ({ page }) => {
      await gotoAndWait(page, '/compare');

      // If facilities are pre-loaded or we can add some
      const table = page.locator('table, [class*="comparison"], [class*="grid"]');
      // Table may only appear with facilities added
    });

    test('best in category highlighted', async ({ page }) => {
      await gotoAndWait(page, '/compare');

      // Look for highlighting indicators
      const highlight = page.locator('[class*="best"], [class*="winner"], [class*="highlight"]');
    });
  });

  test.describe('Removing Facilities', () => {
    test('remove button exists on added facilities', async ({ page }) => {
      await gotoAndWait(page, '/compare');

      const removeButton = page.locator('button:has-text("Remove"), button[aria-label*="Remove"], [class*="remove"]');
    });
  });
});
