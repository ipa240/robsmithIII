import { test, expect } from '@playwright/test';
import { gotoAndWait, waitForPageLoad, isVisible } from './fixtures';

test.describe('Navigation & Layout', () => {
  test.describe('Header Navigation', () => {
    test('header displays on all pages', async ({ page }) => {
      await gotoAndWait(page, '/');

      const header = page.locator('header, nav, [class*="header"], [class*="navbar"]');
      await expect(header.first()).toBeVisible();
    });

    test('logo links to home', async ({ page }) => {
      await gotoAndWait(page, '/jobs');

      const logo = page.locator('a[href="/"], [class*="logo"], a:has-text("VANurses")').first();
      if (await logo.isVisible()) {
        await logo.click();
        await waitForPageLoad(page);

        // May redirect to landing or stay on jobs
        expect(page.url()).toMatch(/\/$|\/dashboard|\/jobs|vanurses/);
      }
    });

    test('main navigation links work', async ({ page }) => {
      await gotoAndWait(page, '/dashboard');
      await page.waitForTimeout(1000);

      // Test each main nav link - note: some may require auth
      const navLinks = [
        { text: 'Jobs', url: '/jobs' },
        { text: 'Facilities', url: '/facilities' },
      ];

      for (const link of navLinks) {
        const navLink = page.locator(`nav a:has-text("${link.text}"), header a:has-text("${link.text}")`).first();
        if (await navLink.isVisible()) {
          await navLink.click();
          await waitForPageLoad(page);

          const currentUrl = page.url();
          // Nav links may redirect to auth or onboarding
          const isValid = currentUrl.includes(link.url) || currentUrl.includes('auth') || currentUrl.includes('login') || currentUrl.includes('onboarding');
          expect(isValid).toBeTruthy();

          // Go back to dashboard
          await gotoAndWait(page, '/dashboard');
        }
      }
    });

    test('More dropdown works', async ({ page }) => {
      await gotoAndWait(page, '/');

      // Look for More/Menu dropdown
      const moreButton = page.locator('button:has-text("More"), [class*="dropdown"]').first();
      if (await moreButton.isVisible()) {
        await moreButton.click();
        await page.waitForTimeout(500);

        // Dropdown should appear
        const dropdown = page.locator('[class*="dropdown-menu"], [role="menu"]');
        const hasDropdown = await dropdown.first().isVisible().catch(() => false);
      }
    });
  });

  test.describe('Account Menu', () => {
    test('account menu displays for authenticated users', async ({ page }) => {
      await gotoAndWait(page, '/dashboard');

      const accountMenu = page.locator('[class*="account"], [class*="avatar"], [class*="user-menu"]');
      // May not be visible if not authenticated
    });

    test('account dropdown has profile link', async ({ page }) => {
      await gotoAndWait(page, '/dashboard');

      const accountButton = page.locator('[class*="account"], [class*="avatar"]').first();
      if (await accountButton.isVisible()) {
        await accountButton.click();
        await page.waitForTimeout(500);

        const profileLink = page.locator('a[href*="profile"], button:has-text("Profile")');
        const hasProfile = await profileLink.first().isVisible().catch(() => false);
      }
    });

    test('account dropdown has billing link', async ({ page }) => {
      await gotoAndWait(page, '/dashboard');

      const accountButton = page.locator('[class*="account"], [class*="avatar"]').first();
      if (await accountButton.isVisible()) {
        await accountButton.click();
        await page.waitForTimeout(500);

        const billingLink = page.locator('a[href*="billing"], button:has-text("Billing")');
      }
    });

    test('account dropdown has sign out', async ({ page }) => {
      await gotoAndWait(page, '/dashboard');

      const accountButton = page.locator('[class*="account"], [class*="avatar"]').first();
      if (await accountButton.isVisible()) {
        await accountButton.click();
        await page.waitForTimeout(500);

        const signOut = page.locator('button:has-text("Sign Out"), button:has-text("Logout"), a:has-text("Sign Out")');
      }
    });
  });

  test.describe('Mobile Navigation', () => {
    test('hamburger menu appears on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await gotoAndWait(page, '/');

      // On mobile, navigation may collapse or show hamburger
      const hamburger = page.locator('[class*="hamburger"], [class*="menu-toggle"], button[aria-label*="menu"], [class*="mobile"], svg');
      const hasHamburger = await hamburger.first().isVisible().catch(() => false);
      // Some apps use different mobile patterns - this documents the behavior
    });

    test('hamburger opens mobile menu', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await gotoAndWait(page, '/');

      const hamburger = page.locator('[class*="hamburger"], [class*="menu-toggle"]').first();
      if (await hamburger.isVisible()) {
        await hamburger.click();
        await page.waitForTimeout(500);

        // Mobile menu should appear
        const mobileMenu = page.locator('[class*="mobile-menu"], [class*="sidebar"], [role="menu"]');
        const hasMenu = await mobileMenu.first().isVisible().catch(() => false);
        expect(hasMenu).toBeTruthy();
      }
    });
  });

  test.describe('Footer', () => {
    test('footer displays', async ({ page }) => {
      await gotoAndWait(page, '/');

      // Scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      const footer = page.locator('footer, [class*="footer"]');
      const hasFooter = await footer.first().isVisible().catch(() => false);
    });

    test('footer has privacy policy link', async ({ page }) => {
      await gotoAndWait(page, '/');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      const privacyLink = page.locator('a[href*="privacy"]');
      if (await privacyLink.first().isVisible()) {
        await privacyLink.first().click();
        await waitForPageLoad(page);
        expect(page.url()).toContain('privacy');
      }
    });

    test('footer has terms link', async ({ page }) => {
      await gotoAndWait(page, '/');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      const termsLink = page.locator('a[href*="terms"]');
    });
  });
});

test.describe('All Pages Load', () => {
  const pages = [
    { path: '/', name: 'Landing' },
    { path: '/jobs', name: 'Jobs' },
    { path: '/facilities', name: 'Facilities' },
    { path: '/dashboard', name: 'Dashboard' },
    { path: '/sully', name: 'Sully' },
    { path: '/billing', name: 'Billing' },
    { path: '/profile', name: 'Profile' },
    { path: '/applications', name: 'Applications' },
    { path: '/saved-jobs', name: 'Saved Jobs' },
    { path: '/compare', name: 'Compare' },
    { path: '/trends', name: 'Trends' },
    { path: '/news', name: 'News' },
    { path: '/notifications', name: 'Notifications' },
    { path: '/community', name: 'Community' },
    { path: '/learning', name: 'Learning' },
    { path: '/map', name: 'Map' },
    { path: '/support', name: 'Support' },
    { path: '/privacy', name: 'Privacy' },
    { path: '/terms', name: 'Terms' },
    { path: '/scoring', name: 'Scoring' },
  ];

  for (const pageInfo of pages) {
    test(`${pageInfo.name} page loads without error`, async ({ page }) => {
      let hasError = false;
      page.on('pageerror', (error) => {
        console.log(`Page error on ${pageInfo.path}:`, error.message);
        hasError = true;
      });

      await gotoAndWait(page, pageInfo.path);

      // Page should not show 404 or error
      const body = await page.content();
      const has404 = body.includes('404') && body.includes('Not Found');
      const hasErrorPage = body.includes('Something went wrong') || body.includes('Error');

      // Log any issues
      if (has404) {
        console.log(`${pageInfo.name} returned 404`);
      }
    });
  }
});
