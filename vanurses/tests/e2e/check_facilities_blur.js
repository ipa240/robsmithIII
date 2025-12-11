const { chromium } = require('playwright');

const BASE_URL = 'https://vanurses.net';

async function checkFacilitiesBlur() {
  console.log('=== Checking Facilities Page Blur for Free Users ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Test 1: Not logged in (free user)
    console.log('--- TEST 1: Not Logged In (Free User) ---\n');

    await page.goto(`${BASE_URL}/facilities`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({ path: '/tmp/facilities_free_user.png', fullPage: true });
    console.log('Screenshot saved: /tmp/facilities_free_user.png');

    // Check for blur elements
    const blurElements = await page.locator('[class*="blur"]').count();
    console.log(`Found ${blurElements} elements with blur class`);

    // Check for specific blurred items
    const blurOverlays = await page.locator('.blur-sm, .blur-md, .blur-lg, .blur-xl').count();
    console.log(`Found ${blurOverlays} elements with blur-sm/md/lg/xl`);

    // Check facility cards
    const facilityCards = await page.locator('[class*="rounded"][class*="shadow"]').count();
    console.log(`Found ${facilityCards} facility cards`);

    // Look for specific data that should be blurred
    console.log('\n--- Checking Specific Elements ---');

    // Check for OFS scores/grades (should be blurred for free)
    const ofsGrades = await page.locator('text=/[A-F][+-]?/').count();
    console.log(`Found ${ofsGrades} potential grade indicators`);

    // Check what's in the facility list
    console.log('\n--- Facility Card Content Analysis ---');

    const cardContent = await page.evaluate(() => {
      // Find facility cards
      const cards = document.querySelectorAll('div[class*="border"][class*="rounded"]');
      const analysis = [];

      for (let i = 0; i < Math.min(3, cards.length); i++) {
        const card = cards[i];
        const blurredElements = card.querySelectorAll('[class*="blur"]');
        const text = card.textContent.substring(0, 200);
        analysis.push({
          hasBlur: blurredElements.length > 0,
          blurCount: blurredElements.length,
          textPreview: text.replace(/\s+/g, ' ').trim()
        });
      }
      return analysis;
    });

    cardContent.forEach((card, i) => {
      console.log(`\nCard ${i + 1}:`);
      console.log(`  Has blur: ${card.hasBlur} (${card.blurCount} blurred elements)`);
      console.log(`  Preview: ${card.textPreview.substring(0, 100)}...`);
    });

    // Check for unblurred scores
    console.log('\n--- Checking for Unblurred Scores ---');

    const unblurredScores = await page.evaluate(() => {
      const results = [];
      // Look for score badges that are NOT blurred
      document.querySelectorAll('span, div').forEach(el => {
        const text = el.textContent.trim();
        const classes = el.className || '';
        // Look for grade letters or scores
        if (/^[A-F][+-]?$/.test(text) || /^\d{1,3}$/.test(text)) {
          if (!classes.includes('blur')) {
            // Check parent for blur
            let parent = el.parentElement;
            let isBlurred = false;
            while (parent) {
              if ((parent.className || '').includes('blur')) {
                isBlurred = true;
                break;
              }
              parent = parent.parentElement;
            }
            if (!isBlurred && text.length < 5) {
              results.push({ text, classes: classes.substring(0, 50) });
            }
          }
        }
      });
      return results.slice(0, 20);
    });

    console.log(`Found ${unblurredScores.length} potentially unblurred score elements:`);
    unblurredScores.forEach(s => {
      console.log(`  - "${s.text}" (classes: ${s.classes || 'none'})`);
    });

    // Get page HTML structure for facility scores
    console.log('\n--- Facility Score HTML Analysis ---');

    const scoreElements = await page.evaluate(() => {
      const results = [];
      // Find elements that look like they contain scores
      document.querySelectorAll('[class*="score"], [class*="grade"], [class*="rating"]').forEach(el => {
        results.push({
          tag: el.tagName,
          classes: el.className.substring(0, 80),
          text: el.textContent.substring(0, 50).trim(),
          hasBlur: el.className.includes('blur') || el.innerHTML.includes('blur')
        });
      });
      return results.slice(0, 10);
    });

    scoreElements.forEach(el => {
      console.log(`  ${el.tag}: "${el.text}" blur=${el.hasBlur}`);
    });

    console.log('\n=== TEST COMPLETE ===');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

checkFacilitiesBlur().catch(console.error);
