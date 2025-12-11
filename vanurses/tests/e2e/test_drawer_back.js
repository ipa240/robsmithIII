const { chromium } = require('playwright');

const BASE_URL = 'https://vanurses.net';

async function testDrawerBackButton() {
  console.log('=== Testing Job Drawer Back Button Behavior ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Navigate to jobs page
    console.log('1. Navigating to /jobs...');
    await page.goto(`${BASE_URL}/jobs`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);  // Extra wait for job data to load

    const startUrl = page.url();
    console.log(`   Current URL: ${startUrl}`);

    // 2. Click a job card to open drawer
    console.log('\n2. Looking for job cards...');

    // Wait for job cards to appear - they're divs with cursor-pointer class
    await page.waitForSelector('[class*="cursor-pointer"]', { timeout: 10000 }).catch(() => {});

    // Job cards are divs with cursor-pointer inside the jobs container
    const jobCards = await page.locator('div[class*="cursor-pointer"][class*="rounded"]').all();
    console.log(`   Found ${jobCards.length} job cards`);

    if (jobCards.length === 0) {
      // Try broader selector
      const allClickable = await page.locator('[class*="cursor-pointer"]').all();
      console.log(`   Found ${allClickable.length} total clickable elements`);

      if (allClickable.length === 0) {
        console.log('   ERROR: No clickable cards found');
        await page.screenshot({ path: '/tmp/drawer_test_debug.png' });
        return false;
      }

      await allClickable[0].click();
    } else {
      await jobCards[0].click();
    }

    await page.waitForTimeout(2000);

    // Check if drawer is visible
    const drawer = page.locator('[class*="fixed right-0"]');
    const isDrawerOpen = await drawer.isVisible().catch(() => false);

    if (!isDrawerOpen) {
      console.log('   ERROR: Drawer did not open');
      return false;
    }
    console.log('   ✓ Drawer opened successfully');

    // 3. Press browser back button
    console.log('\n3. Pressing browser back button...');
    await page.goBack();
    await page.waitForTimeout(1500);

    const afterBackUrl = page.url();
    console.log(`   URL after back: ${afterBackUrl}`);

    // Check if still on jobs page
    if (!afterBackUrl.includes('/jobs')) {
      console.log('   ✗ FAIL: Navigated away from /jobs page');
      console.log(`   Expected to stay on /jobs, but went to ${afterBackUrl}`);
      return false;
    }

    // Check if drawer is closed
    const isDrawerStillOpen = await drawer.isVisible().catch(() => false);

    if (isDrawerStillOpen) {
      console.log('   ✗ FAIL: Drawer is still open after back button');
      return false;
    }

    console.log('   ✓ Drawer closed, stayed on /jobs page');

    // 4. Press back again - should now navigate away
    console.log('\n4. Pressing back again (should navigate to previous page)...');
    await page.goBack();
    await page.waitForTimeout(1500);

    const finalUrl = page.url();
    console.log(`   URL after second back: ${finalUrl}`);

    if (finalUrl === afterBackUrl) {
      console.log('   Note: No previous page in history (test started at /jobs)');
    } else {
      console.log('   ✓ Navigated to previous page as expected');
    }

    console.log('\n=== TEST PASSED ===');
    console.log('Back button now closes the drawer instead of navigating away!');
    return true;

  } catch (err) {
    console.log(`\n✗ ERROR: ${err.message}`);
    return false;
  } finally {
    await browser.close();
  }
}

testDrawerBackButton().then(passed => {
  process.exit(passed ? 0 : 1);
});
