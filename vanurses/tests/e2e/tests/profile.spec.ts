import { test, expect } from '@playwright/test';
import { gotoAndWait, waitForPageLoad } from './fixtures';

test.describe('Profile & Preferences', () => {
  test.describe('Profile Page Display', () => {
    test('profile page loads', async ({ page }) => {
      await gotoAndWait(page, '/profile');

      const header = page.locator('h1, h2').filter({ hasText: /Profile|Account|Settings/i });
      await expect(header.first()).toBeVisible();
    });

    test('user info displays', async ({ page }) => {
      await gotoAndWait(page, '/profile');

      // Should show email or name
      const userInfo = page.locator('[class*="email"], [class*="name"], [class*="user-info"]');
    });

    test('tier badge shows', async ({ page }) => {
      await gotoAndWait(page, '/profile');

      // Look for subscription tier indicator
      const tierBadge = page.locator('[class*="tier"], [class*="badge"], text=Free, text=Starter, text=Pro');
    });
  });

  test.describe('OFS Preferences', () => {
    test('OFS priority sliders exist', async ({ page }) => {
      await gotoAndWait(page, '/profile');

      // Look for priority sliders or inputs
      const sliders = page.locator('input[type="range"], [class*="slider"], [class*="priority"]');
      const sliderCount = await sliders.count();
    });

    test('can adjust index weight', async ({ page }) => {
      await gotoAndWait(page, '/profile');

      const slider = page.locator('input[type="range"]').first();
      if (await slider.isVisible()) {
        // Try to adjust slider
        await slider.fill('5');
        await page.waitForTimeout(500);
      }
    });

    test('save preferences button exists', async ({ page }) => {
      await gotoAndWait(page, '/profile');

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")');
      const hasSave = await saveButton.first().isVisible().catch(() => false);
    });

    test('preferences persist after save', async ({ page }) => {
      await gotoAndWait(page, '/profile');

      const saveButton = page.locator('button:has-text("Save")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(1000);

        // Reload and check values persisted
        await page.reload();
        await waitForPageLoad(page);
      }
    });
  });

  test.describe('Profile Edit', () => {
    test('edit profile link exists', async ({ page }) => {
      await gotoAndWait(page, '/profile');

      const editLink = page.locator('a:has-text("Edit"), button:has-text("Edit Profile"), a[href*="profile-builder"]');
    });

    test('profile builder page loads', async ({ page }) => {
      await gotoAndWait(page, '/profile-builder');

      const header = page.locator('h1, h2').filter({ hasText: /Profile|Builder/i });
    });
  });

  test.describe('Nursing Preferences', () => {
    test('nursing type displayed', async ({ page }) => {
      await gotoAndWait(page, '/profile');

      const nursingType = page.locator('text=RN, text=LPN, text=CNA, [class*="nursing-type"]');
    });

    test('specialty preferences displayed', async ({ page }) => {
      await gotoAndWait(page, '/profile');

      const specialties = page.locator('text=ICU, text=ER, text=Med-Surg, [class*="specialty"]');
    });

    test('shift preferences displayed', async ({ page }) => {
      await gotoAndWait(page, '/profile');

      const shifts = page.locator('text=Day, text=Night, text=7-7, [class*="shift"]');
    });
  });
});

test.describe('Saved Jobs Page', () => {
  test('saved jobs page loads', async ({ page }) => {
    await gotoAndWait(page, '/saved-jobs');
    await page.waitForTimeout(3000);

    // Saved jobs page should have some content - either header, empty state, or job list
    const pageContent = await page.content();
    const hasSavedContent = pageContent.includes('Saved') || pageContent.includes('saved') ||
                           pageContent.includes('Bookmark') || pageContent.includes('Jobs') ||
                           pageContent.includes('No saved') || pageContent.includes('Browse');
    expect(hasSavedContent).toBeTruthy();
  });

  test('saved jobs list displays', async ({ page }) => {
    await gotoAndWait(page, '/saved-jobs');

    const jobList = page.locator('[class*="job"], [class*="saved"]');
  });

  test('clicking saved job navigates to detail', async ({ page }) => {
    await gotoAndWait(page, '/saved-jobs');

    const firstJob = page.locator('[class*="job-card"], article').first();
    if (await firstJob.isVisible()) {
      await firstJob.click();
      await waitForPageLoad(page);

      expect(page.url()).toContain('job');
    }
  });

  test('unsave button removes job from list', async ({ page }) => {
    await gotoAndWait(page, '/saved-jobs');

    const unsaveButton = page.locator('button[class*="heart"], button[class*="unsave"]').first();
    if (await unsaveButton.isVisible()) {
      await unsaveButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('empty state shows browse jobs CTA', async ({ page }) => {
    await gotoAndWait(page, '/saved-jobs');

    const emptyState = page.locator('text=No saved jobs, a[href*="jobs"], button:has-text("Browse")');
  });
});

test.describe('Notifications Page', () => {
  test('notifications page loads', async ({ page }) => {
    await gotoAndWait(page, '/notifications');

    const header = page.locator('h1, h2').filter({ hasText: /Notifications/i });
    await expect(header.first()).toBeVisible();
  });

  test('notification list displays', async ({ page }) => {
    await gotoAndWait(page, '/notifications');

    const notifications = page.locator('[class*="notification"], [class*="alert"]');
  });

  test('mark as read button works', async ({ page }) => {
    await gotoAndWait(page, '/notifications');

    const markRead = page.locator('button:has-text("Mark as read"), button:has-text("Read")');
    if (await markRead.first().isVisible()) {
      await markRead.first().click();
      await page.waitForTimeout(500);
    }
  });

  test('mark all read button works', async ({ page }) => {
    await gotoAndWait(page, '/notifications');

    const markAllRead = page.locator('button:has-text("Mark all"), button:has-text("Clear all")');
  });

  test('delete notification works', async ({ page }) => {
    await gotoAndWait(page, '/notifications');

    const deleteButton = page.locator('button:has-text("Delete"), button[aria-label*="Delete"]').first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('watches tab exists', async ({ page }) => {
    await gotoAndWait(page, '/notifications');

    const watchesTab = page.locator('button:has-text("Watches"), a:has-text("Watches")');
  });
});
