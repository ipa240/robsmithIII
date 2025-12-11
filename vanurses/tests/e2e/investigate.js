const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Enable console logging
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // Listen to network requests
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log(`API: ${response.status()} ${response.url()}`);
    }
  });

  // Go to jobs page
  console.log('Going to jobs page...');
  await page.goto('https://vanurses.net/jobs');
  await page.waitForLoadState('networkidle');

  // Take screenshot of jobs page
  await page.screenshot({ path: '/tmp/jobs_page.png', fullPage: true });
  console.log('Screenshot saved: /tmp/jobs_page.png');

  // Get the first job card
  console.log('Looking for job cards...');
  const jobCards = await page.locator('.bg-white.rounded-xl.border').all();
  console.log(`Found ${jobCards.length} job cards`);

  if (jobCards.length > 0) {
    // Click on the first job card
    console.log('Clicking first job card...');
    await jobCards[0].click();

    // Wait for drawer or navigation
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/after_click.png', fullPage: true });
    console.log('Screenshot saved: /tmp/after_click.png');

    // Look for "View Full Details" button in drawer
    const viewDetailsBtn = page.locator('text=View Full Details');
    if (await viewDetailsBtn.isVisible()) {
      console.log('Drawer opened, clicking View Full Details...');
      await viewDetailsBtn.click();
      await page.waitForTimeout(3000);
    }

    // Check current URL
    console.log('Current URL:', page.url());
    await page.screenshot({ path: '/tmp/job_detail.png', fullPage: true });
    console.log('Screenshot saved: /tmp/job_detail.png');

    // Check for error messages
    const pageContent = await page.content();
    if (pageContent.includes('Job Not Found')) {
      console.log('ERROR: Job Not Found page displayed');
    }

    // Check page body text
    const bodyText = await page.locator('body').innerText();
    console.log('\n=== PAGE CONTENT ===');
    console.log(bodyText.substring(0, 2000));
    console.log('=== END PAGE CONTENT ===\n');
  }

  // Keep browser open for inspection
  console.log('\nBrowser will stay open for 30 seconds for inspection...');
  await page.waitForTimeout(30000);

  await browser.close();
})();
