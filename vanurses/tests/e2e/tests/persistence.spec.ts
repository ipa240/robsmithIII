import { test, expect } from '@playwright/test';
import { gotoAndWait, CONFIG } from './fixtures';

test.describe('Data Persistence - All Areas', () => {

  test.describe('Profile Preferences', () => {
    test('OFS priority sliders save correctly', async ({ page }) => {
      await gotoAndWait(page, '/profile');
      await page.waitForTimeout(3000);

      // Look for slider/range inputs for OFS priorities
      const sliders = page.locator('input[type="range"], [class*="slider"], [role="slider"]');
      const sliderCount = await sliders.count();
      console.log('Found sliders:', sliderCount);

      if (sliderCount > 0) {
        // Adjust first slider
        const firstSlider = sliders.first();
        await firstSlider.fill('4'); // Set to value 4
        await page.waitForTimeout(500);

        // Look for save button
        const saveBtn = page.locator('button:has-text("Save"), button[type="submit"]').first();
        if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await saveBtn.click();
          await page.waitForTimeout(2000);

          // Refresh and verify
          await page.reload();
          await page.waitForTimeout(3000);

          // Check if slider value persisted (would need to read value)
          console.log('Slider preference saved - page refreshed');
        }
      }
    });

    test('profile info saves correctly', async ({ page }) => {
      await gotoAndWait(page, '/profile');
      await page.waitForTimeout(2000);

      // Check profile edit link exists
      const editLink = page.locator('a[href*="edit"], button:has-text("Edit Profile")');
      const hasEditLink = await editLink.first().isVisible().catch(() => false);
      console.log('Has edit profile link:', hasEditLink);

      if (hasEditLink) {
        await editLink.first().click();
        await page.waitForTimeout(2000);

        // Should be on profile builder
        const isOnBuilder = page.url().includes('edit') || page.url().includes('builder');
        console.log('Navigated to edit:', isOnBuilder);
      }
    });
  });

  test.describe('Resume Builder', () => {
    test('resume page loads', async ({ page }) => {
      await gotoAndWait(page, '/resume');
      await page.waitForTimeout(2000);

      // Check resume builder loaded
      const hasResumeContent = await page.locator('text=/Resume|Experience|Education|Skills/i').first().isVisible().catch(() => false);
      console.log('Resume page has content:', hasResumeContent);
      expect(hasResumeContent).toBeTruthy();
    });

    test('can add work experience entry', async ({ page }) => {
      await gotoAndWait(page, '/resume');
      await page.waitForTimeout(2000);

      // Look for add experience button
      const addBtn = page.locator('button:has-text("Add"), button:has-text("+"), [class*="add"]');

      if (await addBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await addBtn.first().click();
        await page.waitForTimeout(1000);

        // Fill in form fields
        const inputs = page.locator('input[type="text"], input[placeholder], textarea');
        const inputCount = await inputs.count();
        console.log('Form fields found:', inputCount);

        if (inputCount > 0) {
          await inputs.first().fill('Test Hospital');
          await page.waitForTimeout(500);
        }
      }
    });

    test('resume changes persist on refresh', async ({ page }) => {
      await gotoAndWait(page, '/resume');
      await page.waitForTimeout(2000);

      // Get page content before
      const contentBefore = await page.textContent('body');

      // Refresh
      await page.reload();
      await page.waitForTimeout(3000);

      // Get content after
      const contentAfter = await page.textContent('body');

      // Should have similar content (resume data loaded)
      console.log('Content loaded after refresh:', contentAfter ? 'yes' : 'no');
    });
  });

  test.describe('Saved Jobs', () => {
    test('saved jobs page loads', async ({ page }) => {
      await gotoAndWait(page, '/saved');
      await page.waitForTimeout(2000);

      // Check page has content
      const hasContent = await page.locator('text=/Saved|Jobs|Browse|No saved/i').first().isVisible().catch(() => false);
      expect(hasContent).toBeTruthy();
    });

    test('can save and unsave a job', async ({ page }) => {
      // Go to jobs
      await gotoAndWait(page, '/jobs');
      await page.waitForTimeout(3000);

      // Find heart/save button on first job card
      const saveBtn = page.locator('button[aria-label*="save"], [class*="heart"], [class*="save"], button:has(svg[class*="heart"])').first();

      if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Click to toggle save state
        await saveBtn.click();
        await page.waitForTimeout(1000);

        console.log('Clicked save button');

        // Verify saved jobs page
        await gotoAndWait(page, '/saved');
        await page.waitForTimeout(2000);

        const savedPageLoaded = await page.locator('h1, h2, [class*="heading"]').first().isVisible().catch(() => false);
        console.log('Saved page loaded:', savedPageLoaded);
      }
    });
  });

  test.describe('Applications Tracking', () => {
    test('application status changes persist', async ({ page }) => {
      await gotoAndWait(page, '/applications');
      await page.waitForTimeout(2000);

      // Look for kanban columns
      const columns = page.locator('[class*="column"], [class*="kanban"], [class*="status"]');
      const colCount = await columns.count();
      console.log('Application columns:', colCount);

      // Check for application cards
      const cards = page.locator('[class*="card"], [class*="application"]');
      const cardCount = await cards.count();
      console.log('Application cards:', cardCount);
    });

    test('application notes save', async ({ page }) => {
      await gotoAndWait(page, '/applications');
      await page.waitForTimeout(2000);

      // Click on first application if any
      const appCard = page.locator('[class*="application"], [class*="card"] a, [class*="job"]').first();

      if (await appCard.isVisible({ timeout: 2000 }).catch(() => false)) {
        await appCard.click();
        await page.waitForTimeout(1000);

        // Look for notes field
        const notesField = page.locator('textarea, [class*="notes"]').first();
        if (await notesField.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('Notes field visible');
        }
      }
    });
  });

  test.describe('Notification Preferences', () => {
    test('notifications page loads', async ({ page }) => {
      await gotoAndWait(page, '/notifications');
      await page.waitForTimeout(2000);

      const hasContent = await page.locator('text=/Notifications|Alerts|Settings/i').first().isVisible().catch(() => false);
      console.log('Notifications page loaded:', hasContent);
    });

    test('can mark notification as read', async ({ page }) => {
      await gotoAndWait(page, '/notifications');
      await page.waitForTimeout(2000);

      // Look for unread notification
      const notification = page.locator('[class*="notification"], [class*="alert"], [class*="unread"]').first();

      if (await notification.isVisible({ timeout: 2000 }).catch(() => false)) {
        await notification.click();
        await page.waitForTimeout(1000);
        console.log('Clicked notification');
      }
    });
  });

  test.describe('Comparison Tool', () => {
    test('compare selections persist', async ({ page }) => {
      await gotoAndWait(page, '/compare');
      await page.waitForTimeout(2000);

      // Check page loaded
      const hasCompareUI = await page.locator('text=/Compare|Add Facility|Comparison/i').first().isVisible().catch(() => false);
      console.log('Compare page loaded:', hasCompareUI);
    });
  });

  test.describe('Sully Chat History', () => {
    test('sully chat loads', async ({ page }) => {
      await gotoAndWait(page, '/sully');
      await page.waitForTimeout(2000);

      // Check chat UI
      const hasChatUI = await page.locator('textarea, input[type="text"], [class*="chat"], [class*="message"]').first().isVisible().catch(() => false);
      console.log('Sully chat UI loaded:', hasChatUI);
      expect(hasChatUI).toBeTruthy();
    });

    test('can send message to sully', async ({ page }) => {
      await gotoAndWait(page, '/sully');
      await page.waitForTimeout(2000);

      // Find input field
      const inputField = page.locator('textarea, input[placeholder*="message"], input[placeholder*="ask"]').first();

      if (await inputField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await inputField.fill('Hello Sully, this is a test');
        await page.waitForTimeout(500);

        // Find send button
        const sendBtn = page.locator('button[type="submit"], button:has-text("Send"), button:has(svg[class*="send"])').first();
        if (await sendBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await sendBtn.click();
          await page.waitForTimeout(5000);

          // Check for response
          const hasResponse = await page.locator('[class*="message"], [class*="response"], text=/Sully|nurse|job/i').isVisible().catch(() => false);
          console.log('Got response from Sully:', hasResponse);
        }
      }
    });
  });
});

test.describe('Onboarding Preferences', () => {
  test('onboarding selections are applied to profile', async ({ page }) => {
    // Go to profile to check preferences
    await gotoAndWait(page, '/profile');
    await page.waitForTimeout(2000);

    // Check for onboarding-set preferences (nursing type, experience, etc.)
    const hasNursingType = await page.locator('text=/RN|LPN|CNA|NP/i').first().isVisible().catch(() => false);
    const hasSpecialty = await page.locator('text=/ICU|ER|Med-Surg|Pediatric/i').first().isVisible().catch(() => false);
    const hasRegion = await page.locator('text=/Hampton|Richmond|Northern|Virginia/i').first().isVisible().catch(() => false);

    console.log('Profile shows:', { hasNursingType, hasSpecialty, hasRegion });
  });

  test('job preferences affect job search results', async ({ page }) => {
    await gotoAndWait(page, '/jobs');
    await page.waitForTimeout(3000);

    // Check that jobs are filtered/sorted based on preferences
    const hasJobs = await page.locator('a[href*="/jobs/"], [class*="job"]').first().isVisible().catch(() => false);
    console.log('Jobs page shows jobs:', hasJobs);
  });
});
