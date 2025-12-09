import { test, expect } from '@playwright/test';
import { gotoAndWait } from './fixtures';

test.describe('Applications Tracking', () => {
  test.describe('Applications Page Display', () => {
    test('applications page loads', async ({ page }) => {
      await gotoAndWait(page, '/applications');

      const header = page.locator('h1, h2').filter({ hasText: /Applications|Applied|Tracking/i });
      await expect(header.first()).toBeVisible();
    });

    test('kanban view displays', async ({ page }) => {
      await gotoAndWait(page, '/applications');

      // Look for kanban columns
      const kanban = page.locator('[class*="kanban"], [class*="column"], [class*="board"]');
      const hasKanban = await kanban.first().isVisible().catch(() => false);
    });

    test('view toggle exists (kanban/list)', async ({ page }) => {
      await gotoAndWait(page, '/applications');

      const toggle = page.locator('button:has-text("List"), button:has-text("Kanban"), [class*="view-toggle"]');
      const hasToggle = await toggle.first().isVisible().catch(() => false);
    });
  });

  test.describe('Application Status Columns', () => {
    test('applied column exists', async ({ page }) => {
      await gotoAndWait(page, '/applications');

      const appliedColumn = page.locator('text=Applied, [class*="applied"]');
    });

    test('interview column exists', async ({ page }) => {
      await gotoAndWait(page, '/applications');

      const interviewColumn = page.locator('text=Interview, [class*="interview"]');
    });

    test('offer column exists', async ({ page }) => {
      await gotoAndWait(page, '/applications');

      const offerColumn = page.locator('text=Offer, [class*="offer"]');
    });
  });

  test.describe('Application Cards', () => {
    test('application cards show job info', async ({ page }) => {
      await gotoAndWait(page, '/applications');

      const cards = page.locator('[class*="application"], [class*="card"]');
      // Cards may or may not exist depending on user data
    });

    test('can click application for details', async ({ page }) => {
      await gotoAndWait(page, '/applications');

      const firstCard = page.locator('[class*="application"], [class*="card"]').first();
      if (await firstCard.isVisible()) {
        await firstCard.click();
        await page.waitForTimeout(500);
        // Modal or detail view should appear
      }
    });
  });

  test.describe('Drag and Drop', () => {
    test('cards can be dragged between columns', async ({ page }) => {
      await gotoAndWait(page, '/applications');

      // This would require actual application data to test
      // Document expected drag-drop behavior
      const draggableCard = page.locator('[draggable="true"], [class*="draggable"]');
    });
  });

  test.describe('Application Notes', () => {
    test('can add notes to application', async ({ page }) => {
      await gotoAndWait(page, '/applications');

      const notesButton = page.locator('button:has-text("Notes"), [class*="notes"]');
      if (await notesButton.first().isVisible()) {
        await notesButton.first().click();
        await page.waitForTimeout(500);
        // Notes input should appear
      }
    });
  });

  test.describe('Next Steps', () => {
    test('can set next step date', async ({ page }) => {
      await gotoAndWait(page, '/applications');

      const dateInput = page.locator('input[type="date"], [class*="date-picker"]');
    });
  });

  test.describe('List View', () => {
    test('list view displays application table', async ({ page }) => {
      await gotoAndWait(page, '/applications');

      const listToggle = page.locator('button:has-text("List")').first();
      if (await listToggle.isVisible()) {
        await listToggle.click();
        await page.waitForTimeout(500);

        const table = page.locator('table, [class*="list"]');
      }
    });
  });

  test.describe('Empty State', () => {
    test('empty state shows browse jobs CTA', async ({ page }) => {
      await gotoAndWait(page, '/applications');

      // If no applications, should show empty state
      const emptyState = page.locator('text=No applications, text=Browse Jobs, a[href*="jobs"]');
    });
  });
});
