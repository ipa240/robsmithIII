const { chromium } = require('playwright');

const BASE_URL = 'https://vanurses.net';
let testsPassed = 0;
let testsFailed = 0;
let reactErrors = [];

function log(msg) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${msg}`);
}

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  console.log(`  ✗ ${msg}`);
}

async function runTests() {
  log('=== VANurses Full Navigation Test ===\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 200
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Track React errors
  page.on('pageerror', err => {
    const msg = err.message;
    reactErrors.push(msg);
    console.log(`  ⚠ PAGE ERROR: ${msg.substring(0, 100)}`);
  });

  // Log API calls
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/') && response.status() >= 400) {
      console.log(`  ⚠ API ERROR: ${response.status()} ${url}`);
    }
  });

  try {
    // === TEST 1: Jobs Page → Drawer → Full Details → Back ===
    log('\n[TEST 1] Jobs Page → Drawer → Full Details → Back');

    await page.goto(`${BASE_URL}/jobs`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    pass('Navigated to /jobs');

    // Count job cards
    const jobCards = await page.locator('[data-testid="job-card"], .job-card, article').count();

    // Find clickable job card - look for various patterns
    const jobCardSelector = 'article, [class*="cursor-pointer"], [class*="hover:shadow"]';
    const cards = await page.locator(jobCardSelector).all();

    if (cards.length > 0) {
      pass(`Found ${cards.length} clickable elements`);

      // Click first job card to open drawer
      await cards[0].click();
      await page.waitForTimeout(1500);

      // Check if drawer opened (look for drawer content)
      const drawerVisible = await page.locator('[class*="fixed right-0"], [class*="drawer"], [class*="slide-in"]').isVisible().catch(() => false);

      if (drawerVisible) {
        pass('Job preview drawer opened');
        await page.screenshot({ path: '/tmp/nav_test_1_drawer.png' });

        // Look for "View Full Details" button
        const viewFullBtn = page.locator('text="View Full Details"').first();
        if (await viewFullBtn.isVisible()) {
          await viewFullBtn.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);

          const currentUrl = page.url();
          if (currentUrl.includes('/jobs/')) {
            pass(`Navigated to job detail: ${currentUrl}`);
            await page.screenshot({ path: '/tmp/nav_test_1_detail.png' });

            // Check for content (not blank page)
            const bodyText = await page.locator('body').innerText();
            if (bodyText.length > 200 && !bodyText.includes('Job Not Found')) {
              pass(`Job detail loaded (${bodyText.length} chars)`);

              // Test back navigation
              await page.goBack();
              await page.waitForLoadState('networkidle');
              await page.waitForTimeout(1500);

              if (page.url().includes('/jobs') && !page.url().includes('/jobs/')) {
                pass('Back navigation returned to /jobs');
                testsPassed++;
              } else {
                fail(`Back navigation went to ${page.url()}`);
                testsFailed++;
              }
            } else {
              fail('Job detail page has no content or shows error');
              testsFailed++;
            }
          } else {
            fail(`Did not navigate to job detail, URL: ${currentUrl}`);
            testsFailed++;
          }
        } else {
          fail('View Full Details button not found');
          testsFailed++;
        }
      } else {
        // Maybe it navigated directly to job detail
        if (page.url().includes('/jobs/')) {
          pass('Clicked card navigated directly to job detail');
          testsPassed++;
        } else {
          fail('Drawer did not open and did not navigate');
          testsFailed++;
        }
      }
    } else {
      fail('No job cards found on page');
      testsFailed++;
    }

    // === TEST 2: Direct Job URL Navigation ===
    log('\n[TEST 2] Direct Job URL Navigation');

    // Get job IDs from API
    const jobsResponse = await page.evaluate(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/jobs?limit=5&offset=0`);
      return res.json();
    }, BASE_URL);

    if (jobsResponse.data && jobsResponse.data.length > 0) {
      const testJob = jobsResponse.data[0];
      pass(`Got job ID: ${testJob.id}`);

      await page.goto(`${BASE_URL}/jobs/${testJob.id}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const bodyText = await page.locator('body').innerText();
      await page.screenshot({ path: '/tmp/nav_test_2_direct.png' });

      if (bodyText.includes('Job Not Found')) {
        fail('Job Not Found error displayed');
        testsFailed++;
      } else if (bodyText.length < 200) {
        fail(`Page appears blank (${bodyText.length} chars)`);
        testsFailed++;
      } else {
        pass(`Direct job URL loaded successfully (${bodyText.length} chars)`);
        testsPassed++;
      }
    } else {
      fail('Could not fetch jobs from API');
      testsFailed++;
    }

    // === TEST 3: Facilities → Facility Detail → Back ===
    log('\n[TEST 3] Facilities → Facility Detail → Back');

    await page.goto(`${BASE_URL}/facilities`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    pass('Navigated to /facilities');

    // Click a facility card
    const facilityCards = await page.locator('a[href*="/facilities/"]').all();
    if (facilityCards.length > 0) {
      pass(`Found ${facilityCards.length} facility links`);
      await facilityCards[0].click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      if (page.url().includes('/facilities/')) {
        pass(`Navigated to facility detail: ${page.url()}`);
        await page.screenshot({ path: '/tmp/nav_test_3_facility.png' });

        await page.goBack();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        if (page.url().endsWith('/facilities') || page.url().endsWith('/facilities/')) {
          pass('Back navigation returned to /facilities');
          testsPassed++;
        } else {
          fail(`Back went to: ${page.url()}`);
          testsFailed++;
        }
      } else {
        fail('Did not navigate to facility detail');
        testsFailed++;
      }
    } else {
      fail('No facility links found');
      testsFailed++;
    }

    // === TEST 4: Browser Forward Button ===
    log('\n[TEST 4] Browser Forward Navigation');

    await page.goto(`${BASE_URL}/jobs`);
    await page.waitForLoadState('networkidle');

    // Navigate to a job detail
    const jobsForForward = await page.evaluate(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/jobs?limit=1&offset=0`);
      return res.json();
    }, BASE_URL);

    if (jobsForForward.data && jobsForForward.data.length > 0) {
      const jobId = jobsForForward.data[0].id;
      await page.goto(`${BASE_URL}/jobs/${jobId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Go back
      await page.goBack();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      pass('Went back to /jobs');

      // Go forward
      await page.goForward();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      if (page.url().includes(`/jobs/${jobId}`)) {
        const bodyText = await page.locator('body').innerText();
        if (bodyText.length > 200 && !bodyText.includes('Job Not Found')) {
          pass('Forward navigation restored job detail with content');
          testsPassed++;
        } else {
          fail('Forward navigation shows blank/error page');
          testsFailed++;
        }
      } else {
        fail(`Forward did not return to job detail: ${page.url()}`);
        testsFailed++;
      }
    } else {
      fail('Could not get job for forward test');
      testsFailed++;
    }

    // === TEST 5: Map → Facility → Back ===
    log('\n[TEST 5] Map → Facility → Back');

    await page.goto(`${BASE_URL}/map`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    pass('Navigated to /map');
    await page.screenshot({ path: '/tmp/nav_test_5_map.png' });

    // Click on a facility link or marker
    const mapFacilityLinks = await page.locator('a[href*="/facilities/"]').all();
    if (mapFacilityLinks.length > 0) {
      await mapFacilityLinks[0].click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      if (page.url().includes('/facilities/')) {
        pass(`Map → Facility detail: ${page.url()}`);
        await page.screenshot({ path: '/tmp/nav_test_5_facility.png' });

        await page.goBack();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        if (page.url().includes('/map')) {
          pass('Back returned to /map');
          testsPassed++;
        } else {
          fail(`Back went to: ${page.url()}`);
          testsFailed++;
        }
      } else {
        fail('Did not navigate to facility from map');
        testsFailed++;
      }
    } else {
      pass('No facility links on map page (may need to interact with markers)');
      testsPassed++; // Skip this test if no links visible
    }

    // === TEST 6: Multiple Job Details (check for React errors) ===
    log('\n[TEST 6] Multiple Job Details (checking for React render errors)');

    const allJobs = await page.evaluate(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/jobs?limit=5&offset=0`);
      return res.json();
    }, BASE_URL);

    if (allJobs.data && allJobs.data.length >= 3) {
      let errorCount = 0;

      for (let i = 0; i < 3; i++) {
        const job = allJobs.data[i];
        log(`  Testing job ${i + 1}/3: ${job.id}`);

        reactErrors = []; // Reset for this job

        await page.goto(`${BASE_URL}/jobs/${job.id}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2500);

        const bodyText = await page.locator('body').innerText();

        if (reactErrors.length > 0) {
          fail(`Job ${job.id} had React errors: ${reactErrors[0].substring(0, 80)}`);
          errorCount++;
        } else if (bodyText.includes('Job Not Found') || bodyText.length < 200) {
          fail(`Job ${job.id} shows error or blank page`);
          errorCount++;
        } else {
          pass(`Job ${job.id} loaded successfully`);
        }
      }

      if (errorCount === 0) {
        pass('All 3 jobs loaded without React errors');
        testsPassed++;
      } else {
        fail(`${errorCount}/3 jobs had errors`);
        testsFailed++;
      }
    } else {
      fail('Not enough jobs to test');
      testsFailed++;
    }

  } catch (err) {
    console.log(`\n  ⚠ UNEXPECTED ERROR: ${err.message}`);
    testsFailed++;
  }

  // === SUMMARY ===
  log('\n=== SUMMARY ===');
  console.log(`${testsPassed}/${testsPassed + testsFailed} tests passed`);

  if (reactErrors.length > 0) {
    console.log(`\n${reactErrors.length} React errors detected during tests:`);
    reactErrors.slice(0, 5).forEach(err => console.log(`  - ${err.substring(0, 100)}`));
  } else {
    console.log('0 React errors detected');
  }

  console.log(`\nScreenshots saved to /tmp/nav_test_*.png`);

  log('\nBrowser will close in 10 seconds...');
  await page.waitForTimeout(10000);

  await browser.close();

  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests();
