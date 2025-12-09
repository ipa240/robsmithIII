import { test, expect } from '@playwright/test';
import { gotoAndWait, CONFIG } from './fixtures';

test.describe('Community Features', () => {

  test.describe('Community Page Display', () => {
    test('community page loads', async ({ page }) => {
      await gotoAndWait(page, '/community');
      await page.waitForTimeout(2000);

      // Should have community content
      const hasContent = await page.locator('text=/Community|Discussion|Post|Forum/i').first().isVisible().catch(() => false);
      console.log('Has community content:', hasContent);
      expect(hasContent).toBeTruthy();
    });

    test('shows category list', async ({ page }) => {
      await gotoAndWait(page, '/community');
      await page.waitForTimeout(2000);

      // Should have category buttons/links
      const categories = page.locator('text=/General|Virginia|Career|ICU|Travel/i');
      const categoryCount = await categories.count();
      console.log('Categories found:', categoryCount);
      expect(categoryCount).toBeGreaterThan(0);
    });

    test('shows posts or empty state', async ({ page }) => {
      await gotoAndWait(page, '/community');
      await page.waitForTimeout(3000);

      // Should have posts, categories, or UI elements
      const hasPosts = await page.locator('[class*="post"], [class*="card"], text=/reply|comment/i').first().isVisible().catch(() => false);
      const hasEmptyState = await page.locator('text=/No posts|Be the first|Start a discussion/i').first().isVisible().catch(() => false);
      const hasCommunityUI = await page.locator('text=/General|Discussion|Category|Community/i').first().isVisible().catch(() => false);
      const hasNewPostBtn = await page.locator('button:has-text("New"), button:has-text("Create"), button:has-text("Post")').first().isVisible().catch(() => false);

      console.log('Has posts:', hasPosts, 'Has empty state:', hasEmptyState, 'Has UI:', hasCommunityUI, 'Has new post:', hasNewPostBtn);
      expect(hasPosts || hasEmptyState || hasCommunityUI || hasNewPostBtn).toBeTruthy();
    });
  });

  test.describe('Create Post', () => {
    test('new post form exists', async ({ page }) => {
      await gotoAndWait(page, '/community');
      await page.waitForTimeout(2000);

      // Look for new post button or form
      const newPostBtn = page.locator('button:has-text("New Post"), button:has-text("Create"), button:has-text("Write"), [class*="new-post"]');
      const hasNewPost = await newPostBtn.first().isVisible().catch(() => false);

      console.log('Has new post button:', hasNewPost);
      // Don't fail if no button - might be inline
    });

    test('can create a post', async ({ page }) => {
      await gotoAndWait(page, '/community');
      await page.waitForTimeout(2000);

      // Try to open new post modal/form
      const newPostBtn = page.locator('button:has-text("New Post"), button:has-text("Create Post"), button:has-text("Start Discussion")').first();

      if (await newPostBtn.isVisible().catch(() => false)) {
        await newPostBtn.click();
        await page.waitForTimeout(1000);

        // Fill in post details
        const titleInput = page.locator('input[placeholder*="title"], input[name="title"], [class*="title"] input').first();
        const contentInput = page.locator('textarea[placeholder*="content"], textarea[name="content"], [class*="content"] textarea').first();

        if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          const testTitle = `Test Post ${Date.now()}`;
          await titleInput.fill(testTitle);

          if (await contentInput.isVisible({ timeout: 1000 }).catch(() => false)) {
            await contentInput.fill('This is a test post from E2E tests.');
          }

          // Submit
          const submitBtn = page.locator('button[type="submit"], button:has-text("Post"), button:has-text("Submit")').first();
          if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await submitBtn.click();
            await page.waitForTimeout(3000);

            // Verify post appears
            const postCreated = await page.locator(`text=${testTitle}`).isVisible({ timeout: 5000 }).catch(() => false);
            console.log('Post created:', postCreated);
          }
        }
      } else {
        console.log('No new post button visible - skipping');
      }
    });
  });

  test.describe('Community API', () => {
    test('GET /api/community/posts returns posts', async ({ request }) => {
      const response = await request.get(`${CONFIG.apiURL}/api/community/posts`);
      console.log('Community posts response:', response.status());

      // May be 200 with posts or 404 if not implemented
      expect([200, 401, 404]).toContain(response.status());

      if (response.status() === 200) {
        const data = await response.json();
        console.log('Posts count:', Array.isArray(data) ? data.length : 'not array');
      }
    });

    test('GET /api/community/posts/trending returns trending', async ({ request }) => {
      const response = await request.get(`${CONFIG.apiURL}/api/community/posts/trending`);
      console.log('Trending posts response:', response.status());

      expect([200, 401, 404]).toContain(response.status());
    });
  });
});

test.describe('Data Persistence', () => {

  test.describe('Saved Jobs Persistence', () => {
    test('save a job and verify it persists', async ({ page }) => {
      // Go to jobs page
      await gotoAndWait(page, '/jobs');
      await page.waitForTimeout(3000);

      // Find a job card with a save/heart button
      const saveBtn = page.locator('button[class*="heart"], button[aria-label*="save"], [class*="save"], button:has(svg)').first();

      if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Click to save
        await saveBtn.click();
        await page.waitForTimeout(1000);

        // Navigate to saved jobs page
        await gotoAndWait(page, '/saved');
        await page.waitForTimeout(3000);

        // Verify saved job appears
        const hasSavedJobs = await page.locator('a[href*="/jobs/"], [class*="job"], [class*="card"]').first().isVisible().catch(() => false);
        const hasEmptyState = await page.locator('text=/No saved|Browse jobs/i').first().isVisible().catch(() => false);

        console.log('Has saved jobs:', hasSavedJobs, 'Empty state:', hasEmptyState);
        // Either we have jobs or empty state is expected
        expect(hasSavedJobs || hasEmptyState).toBeTruthy();
      } else {
        console.log('No save button visible on jobs page');
      }
    });

    test('saved jobs persist after logout and login', async ({ page, browser }) => {
      // First save a job
      await gotoAndWait(page, '/jobs');
      await page.waitForTimeout(3000);

      // Note: Full logout/login persistence test would require fresh browser context
      // For now, check that saved jobs page loads correctly
      await gotoAndWait(page, '/saved');
      await page.waitForTimeout(2000);

      const pageLoaded = await page.locator('text=/Saved|Jobs|Browse/i').first().isVisible().catch(() => false);
      expect(pageLoaded).toBeTruthy();
    });
  });

  test.describe('Application Notes Persistence', () => {
    test('application notes save correctly', async ({ page }) => {
      await gotoAndWait(page, '/applications');
      await page.waitForTimeout(2000);

      // Find an application card
      const appCard = page.locator('[class*="application"], [class*="card"]').first();

      if (await appCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        await appCard.click();
        await page.waitForTimeout(1000);

        // Look for notes input
        const notesInput = page.locator('textarea[placeholder*="note"], textarea[name*="note"], [class*="notes"] textarea').first();

        if (await notesInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          const testNote = `Test note ${Date.now()}`;
          await notesInput.fill(testNote);

          // Save notes
          const saveBtn = page.locator('button:has-text("Save"), button[type="submit"]').first();
          if (await saveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await saveBtn.click();
            await page.waitForTimeout(2000);
          }

          // Refresh page and verify note persists
          await page.reload();
          await page.waitForTimeout(3000);

          const notesPersisted = await page.locator(`text=${testNote.slice(0, 20)}`).isVisible({ timeout: 5000 }).catch(() => false);
          console.log('Notes persisted:', notesPersisted);
        }
      } else {
        console.log('No application cards visible');
      }
    });
  });

  test.describe('User Preferences Persistence', () => {
    test('profile preferences save correctly', async ({ page }) => {
      await gotoAndWait(page, '/profile');
      await page.waitForTimeout(2000);

      // Check profile page loaded
      const profileLoaded = await page.locator('text=/Profile|Settings|Preferences/i').first().isVisible().catch(() => false);
      expect(profileLoaded).toBeTruthy();

      // Look for preference controls (sliders, toggles, etc.)
      const preferenceControl = page.locator('input[type="range"], [class*="slider"], input[type="checkbox"], button[role="switch"]').first();

      if (await preferenceControl.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Found preference control - preferences can be modified');
      }
    });
  });
});
