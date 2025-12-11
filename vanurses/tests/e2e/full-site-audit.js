const { chromium } = require('playwright');

const BASE_URL = 'https://vanurses.net';

// Results tracking
const results = {
  pages: [],
  jobs: [],
  facilities: [],
  errors: [],
  warnings: [],
  summary: {}
};

function log(msg) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${msg}`);
}

async function testPage(page, name, url, checks = {}) {
  const result = {
    name,
    url,
    status: 'unknown',
    loadTime: 0,
    contentLength: 0,
    errors: [],
    warnings: [],
    checks: {}
  };

  const startTime = Date.now();

  try {
    await page.goto(url, { timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    result.loadTime = Date.now() - startTime;

    const bodyText = await page.locator('body').innerText();
    result.contentLength = bodyText.length;

    // Basic checks
    if (bodyText.length < 100) {
      result.errors.push('Page appears blank (< 100 chars)');
    }

    if (bodyText.includes('Error') || bodyText.includes('error')) {
      if (bodyText.includes('Job Not Found') || bodyText.includes('Facility Not Found')) {
        result.errors.push('Not Found error displayed');
      }
    }

    // Custom checks
    if (checks.mustContain) {
      for (const text of checks.mustContain) {
        if (!bodyText.includes(text)) {
          result.warnings.push(`Missing expected text: "${text}"`);
        }
      }
    }

    if (checks.mustNotContain) {
      for (const text of checks.mustNotContain) {
        if (bodyText.includes(text)) {
          result.errors.push(`Contains unexpected text: "${text}"`);
        }
      }
    }

    // Check for React errors in the page
    const reactError = await page.evaluate(() => {
      const errorBoundary = document.querySelector('[class*="error"]');
      return errorBoundary?.innerText || null;
    });

    if (reactError && reactError.includes('went wrong')) {
      result.errors.push('React error boundary triggered');
    }

    result.status = result.errors.length === 0 ? 'pass' : 'fail';

  } catch (err) {
    result.status = 'error';
    result.errors.push(`Load error: ${err.message}`);
    result.loadTime = Date.now() - startTime;
  }

  return result;
}

async function runFullAudit() {
  log('=== VANurses Full Site Audit ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Track all errors
  const pageErrors = [];
  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  // ============================================
  // SECTION 1: Test All Main Pages
  // ============================================
  log('\n=== SECTION 1: Main Pages ===\n');

  const mainPages = [
    { name: 'Landing', url: '/', checks: { mustContain: ['nurse', 'job'] } },
    { name: 'Jobs', url: '/jobs', checks: { mustContain: ['RN', 'nurse'] } },
    { name: 'Facilities', url: '/facilities', checks: {} },
    { name: 'Map', url: '/map', checks: {} },
    { name: 'Dashboard', url: '/dashboard', checks: {} },
    { name: 'Trends', url: '/trends', checks: {} },
    { name: 'Compare', url: '/compare', checks: {} },
    { name: 'Scoring', url: '/scoring', checks: {} },
    { name: 'Sully (AI)', url: '/sully', checks: {} },
    { name: 'Billing', url: '/billing', checks: {} },
    { name: 'Profile', url: '/profile', checks: {} },
    { name: 'Saved Jobs', url: '/saved-jobs', checks: {} },
    { name: 'Applications', url: '/applications', checks: {} },
    { name: 'Learning', url: '/learning', checks: {} },
    { name: 'Support', url: '/support', checks: {} },
  ];

  for (const pageConfig of mainPages) {
    pageErrors.length = 0; // Reset for each page
    const result = await testPage(page, pageConfig.name, `${BASE_URL}${pageConfig.url}`, pageConfig.checks);
    result.jsErrors = [...pageErrors];
    results.pages.push(result);

    const status = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '⚠';
    const errors = result.errors.length > 0 ? ` (${result.errors.join(', ')})` : '';
    const jsErr = result.jsErrors.length > 0 ? ` [${result.jsErrors.length} JS errors]` : '';
    console.log(`  ${status} ${result.name}: ${result.loadTime}ms, ${result.contentLength} chars${errors}${jsErr}`);
  }

  // ============================================
  // SECTION 2: Test All Jobs (sample)
  // ============================================
  log('\n=== SECTION 2: Job Detail Pages ===\n');

  // Get all jobs from API
  const jobsResponse = await page.evaluate(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/jobs?limit=100&offset=0`);
    return res.json();
  }, BASE_URL);

  const allJobs = jobsResponse.data || [];
  log(`Found ${allJobs.length} jobs to test\n`);

  let jobsPass = 0, jobsFail = 0, jobsWithContent = 0, jobsBlank = 0;

  for (let i = 0; i < allJobs.length; i++) {
    const job = allJobs[i];
    pageErrors.length = 0;

    const result = await testPage(page, `Job ${i + 1}`, `${BASE_URL}/jobs/${job.id}`, {
      mustNotContain: ['Job Not Found']
    });

    result.jobId = job.id;
    result.jobTitle = job.title?.substring(0, 50);
    result.jsErrors = [...pageErrors];

    // Check if job has enriched content
    const hasEnrichedContent = result.contentLength > 1500;
    result.hasEnrichedContent = hasEnrichedContent;

    if (hasEnrichedContent) jobsWithContent++;
    else jobsBlank++;

    if (result.status === 'pass') jobsPass++;
    else jobsFail++;

    results.jobs.push(result);

    // Log progress every 10 jobs
    if ((i + 1) % 10 === 0 || i === allJobs.length - 1) {
      log(`  Tested ${i + 1}/${allJobs.length} jobs (${jobsPass} pass, ${jobsFail} fail)`);
    }

    // Log failures immediately
    if (result.status !== 'pass') {
      console.log(`    ✗ Job ${job.id}: ${result.errors.join(', ')}`);
    }

    // Check for React errors
    if (result.jsErrors.some(e => e.includes('Objects are not valid as a React child'))) {
      console.log(`    ⚠ REACT ERROR on job ${job.id}`);
      results.errors.push({ type: 'react', jobId: job.id, error: result.jsErrors[0] });
    }
  }

  // ============================================
  // SECTION 3: Test Facilities
  // ============================================
  log('\n=== SECTION 3: Facility Detail Pages ===\n');

  const facilitiesResponse = await page.evaluate(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/facilities?limit=50&offset=0`);
    return res.json();
  }, BASE_URL);

  const allFacilities = facilitiesResponse.data || [];
  log(`Found ${allFacilities.length} facilities to test\n`);

  let facilitiesPass = 0, facilitiesFail = 0;

  for (let i = 0; i < Math.min(allFacilities.length, 30); i++) {
    const facility = allFacilities[i];
    pageErrors.length = 0;

    const result = await testPage(page, `Facility ${i + 1}`, `${BASE_URL}/facilities/${facility.id}`, {
      mustNotContain: ['Facility Not Found']
    });

    result.facilityId = facility.id;
    result.facilityName = facility.name?.substring(0, 40);
    result.jsErrors = [...pageErrors];

    if (result.status === 'pass') facilitiesPass++;
    else facilitiesFail++;

    results.facilities.push(result);

    if ((i + 1) % 10 === 0 || i === Math.min(allFacilities.length, 30) - 1) {
      log(`  Tested ${i + 1}/${Math.min(allFacilities.length, 30)} facilities (${facilitiesPass} pass, ${facilitiesFail} fail)`);
    }
  }

  // ============================================
  // SECTION 4: Test Job Preview Drawer
  // ============================================
  log('\n=== SECTION 4: Job Preview Drawer ===\n');

  await page.goto(`${BASE_URL}/jobs`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Test clicking on job cards to open drawer
  let drawerTests = { pass: 0, fail: 0 };
  const jobCards = await page.locator('article').all();

  for (let i = 0; i < Math.min(jobCards.length, 5); i++) {
    pageErrors.length = 0;

    try {
      await jobCards[i].click();
      await page.waitForTimeout(1500);

      // Check if drawer opened
      const drawer = page.locator('[class*="fixed right-0"]');
      const isVisible = await drawer.isVisible().catch(() => false);

      if (isVisible) {
        // Check drawer content
        const drawerText = await drawer.innerText().catch(() => '');

        if (drawerText.length > 100 && !pageErrors.some(e => e.includes('Objects are not valid'))) {
          drawerTests.pass++;
          console.log(`  ✓ Drawer ${i + 1}: Loaded (${drawerText.length} chars)`);
        } else {
          drawerTests.fail++;
          const err = pageErrors.length > 0 ? pageErrors[0].substring(0, 60) : 'Content issue';
          console.log(`  ✗ Drawer ${i + 1}: ${err}`);
        }

        // Close drawer
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        console.log(`  - Drawer ${i + 1}: No drawer visible (may navigate directly)`);
      }
    } catch (err) {
      drawerTests.fail++;
      console.log(`  ✗ Drawer ${i + 1}: ${err.message}`);
    }
  }

  // ============================================
  // SECTION 5: API Health Check
  // ============================================
  log('\n=== SECTION 5: API Health ===\n');

  const apiEndpoints = [
    '/api/jobs?limit=10',
    '/api/facilities?limit=10',
    '/api/facilities/stats',
    '/api/jobs/filters',
  ];

  for (const endpoint of apiEndpoints) {
    try {
      const response = await page.evaluate(async (url) => {
        const res = await fetch(url);
        const data = await res.json();
        return { status: res.status, count: data.data?.length || data.total || 'N/A' };
      }, `${BASE_URL}${endpoint}`);

      if (response.status === 200) {
        console.log(`  ✓ ${endpoint}: ${response.status} (${response.count} items)`);
      } else {
        console.log(`  ✗ ${endpoint}: ${response.status}`);
      }
    } catch (err) {
      console.log(`  ✗ ${endpoint}: ${err.message}`);
    }
  }

  // ============================================
  // GENERATE SUMMARY REPORT
  // ============================================
  log('\n' + '='.repeat(60));
  log('                    FULL AUDIT REPORT');
  log('='.repeat(60) + '\n');

  // Pages Summary
  const pagesPass = results.pages.filter(p => p.status === 'pass').length;
  const pagesFail = results.pages.filter(p => p.status !== 'pass').length;
  console.log(`📄 MAIN PAGES: ${pagesPass}/${results.pages.length} passed`);
  if (pagesFail > 0) {
    console.log('   Failed pages:');
    results.pages.filter(p => p.status !== 'pass').forEach(p => {
      console.log(`     - ${p.name}: ${p.errors.join(', ')}`);
    });
  }

  // Jobs Summary
  console.log(`\n💼 JOB PAGES: ${jobsPass}/${allJobs.length} passed`);
  console.log(`   - With enriched content: ${jobsWithContent}`);
  console.log(`   - Basic/minimal content: ${jobsBlank}`);
  if (jobsFail > 0) {
    console.log(`   - Failed: ${jobsFail}`);
    const failedJobs = results.jobs.filter(j => j.status !== 'pass').slice(0, 5);
    failedJobs.forEach(j => {
      console.log(`     - ${j.jobId}: ${j.errors.join(', ')}`);
    });
  }

  // React Errors
  const reactErrors = results.jobs.filter(j => j.jsErrors?.some(e => e.includes('Objects are not valid')));
  console.log(`\n⚛️ REACT ERRORS: ${reactErrors.length} jobs with render errors`);
  if (reactErrors.length > 0) {
    console.log('   Jobs with React errors:');
    reactErrors.slice(0, 5).forEach(j => {
      console.log(`     - ${j.jobId}`);
    });
  }

  // Facilities Summary
  console.log(`\n🏥 FACILITY PAGES: ${facilitiesPass}/${Math.min(allFacilities.length, 30)} passed`);

  // Drawer Summary
  console.log(`\n📋 JOB DRAWERS: ${drawerTests.pass}/${drawerTests.pass + drawerTests.fail} passed`);

  // Overall Score
  const totalTests = results.pages.length + allJobs.length + results.facilities.length + drawerTests.pass + drawerTests.fail;
  const totalPass = pagesPass + jobsPass + facilitiesPass + drawerTests.pass;
  const overallScore = Math.round((totalPass / totalTests) * 100);

  console.log('\n' + '='.repeat(60));
  console.log(`\n🎯 OVERALL SCORE: ${overallScore}% (${totalPass}/${totalTests} tests passed)\n`);

  // Quality Issues
  if (results.errors.length > 0 || reactErrors.length > 0 || pagesFail > 0 || jobsFail > 0) {
    console.log('⚠️ ISSUES TO ADDRESS:');
    if (reactErrors.length > 0) console.log(`   - ${reactErrors.length} React render errors (Objects as children)`);
    if (pagesFail > 0) console.log(`   - ${pagesFail} main pages not loading correctly`);
    if (jobsFail > 0) console.log(`   - ${jobsFail} job pages failing`);
    if (jobsBlank > allJobs.length * 0.5) console.log(`   - ${jobsBlank} jobs have minimal content (may need enrichment)`);
  } else {
    console.log('✅ No critical issues detected!');
  }

  console.log('\n' + '='.repeat(60) + '\n');

  await browser.close();

  // Return summary for programmatic use
  return {
    overallScore,
    pages: { pass: pagesPass, fail: pagesFail },
    jobs: { pass: jobsPass, fail: jobsFail, total: allJobs.length, withContent: jobsWithContent },
    facilities: { pass: facilitiesPass, fail: facilitiesFail },
    reactErrors: reactErrors.length,
    drawers: drawerTests
  };
}

runFullAudit().then(summary => {
  console.log('Audit complete. Summary:', JSON.stringify(summary, null, 2));
  process.exit(summary.reactErrors > 0 || summary.jobs.fail > 5 ? 1 : 0);
}).catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
