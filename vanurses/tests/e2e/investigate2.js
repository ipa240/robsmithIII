const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Enable console logging
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // Listen to network requests
  page.on('response', response => {
    if (response.url().includes('/api/jobs')) {
      console.log(`API: ${response.status()} ${response.url()}`);
    }
  });

  // First get the job IDs from the API
  console.log('Fetching jobs from API...');
  await page.goto('https://vanurses.net/jobs');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Get job IDs from the page
  const response = await page.evaluate(async () => {
    const res = await fetch('https://vanurses.net/api/jobs?limit=5&offset=0');
    return res.json();
  });

  console.log(`\nFound ${response.data.length} jobs:`);
  for (const job of response.data.slice(0, 5)) {
    console.log(`  ID: ${job.id} - ${job.title.substring(0, 50)}`);
  }

  if (response.data.length > 0) {
    const firstJobId = response.data[0].id;
    console.log(`\n=== Navigating directly to job: ${firstJobId} ===`);

    // Navigate directly to job detail page
    await page.goto(`https://vanurses.net/jobs/${firstJobId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    console.log('Current URL:', page.url());
    await page.screenshot({ path: '/tmp/direct_job.png', fullPage: true });

    // Check page content
    const bodyText = await page.locator('body').innerText();
    console.log('\n=== PAGE CONTENT (first 1500 chars) ===');
    console.log(bodyText.substring(0, 1500));
    console.log('=== END ===\n');

    // Check if job not found
    if (bodyText.includes('Job Not Found')) {
      console.log('ERROR: Job Not Found displayed!');

      // Try fetching the API directly
      const apiResponse = await page.evaluate(async (id) => {
        try {
          const res = await fetch(`https://vanurses.net/api/jobs/${id}`);
          return { status: res.status, data: await res.json() };
        } catch (e) {
          return { error: e.message };
        }
      }, firstJobId);
      console.log('API Response:', JSON.stringify(apiResponse, null, 2));
    }
  }

  console.log('\nBrowser will stay open for 30 seconds...');
  await page.waitForTimeout(30000);

  await browser.close();
})();
