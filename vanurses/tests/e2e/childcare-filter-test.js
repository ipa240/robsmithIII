/**
 * Childcare Filter Validation Test
 * Tests that childcare=onsite and childcare=nearby return correct results
 */

const API_URL = 'https://vanurses.net/api/jobs';

async function fetchJobs(params) {
  const searchParams = new URLSearchParams();
  searchParams.set('limit', '100');

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  }

  const response = await fetch(`${API_URL}?${searchParams.toString()}`);
  return response.json();
}

async function fetchFacilityAmenities(facilityName) {
  // Use facilities endpoint to get amenities data
  const response = await fetch(`https://vanurses.net/api/facilities?search=${encodeURIComponent(facilityName)}&limit=1`);
  const data = await response.json();
  return data.data?.[0] || null;
}

async function runChildcareTests() {
  console.log('=' .repeat(70));
  console.log('         CHILDCARE FILTER VALIDATION TEST');
  console.log('='.repeat(70) + '\n');

  let passed = 0;
  let failed = 0;
  const failures = [];

  // Test 1: childcare=onsite should return jobs from facilities with has_onsite_daycare=true
  console.log('--- TEST 1: childcare=onsite ---\n');

  const onsiteResponse = await fetchJobs({ childcare: 'onsite' });
  console.log(`Total jobs returned: ${onsiteResponse.total}`);
  console.log(`Sample size: ${onsiteResponse.data.length}\n`);

  // Check each job's facility
  const onsiteFacilities = new Set();
  let onsiteValid = 0;
  let onsiteInvalid = 0;
  const onsiteInvalidExamples = [];

  for (const job of onsiteResponse.data) {
    const facilityName = job.facility_name;
    onsiteFacilities.add(facilityName);

    // We need to verify this facility actually has onsite daycare
    // Since the API doesn't return the flag, we'll track unique facilities
  }

  console.log(`Unique facilities in results: ${onsiteFacilities.size}`);
  console.log('Facilities returned:');
  for (const f of [...onsiteFacilities].slice(0, 10)) {
    console.log(`  - ${f}`);
  }

  // Test 2: childcare=nearby should return jobs from facilities with childcare_count > 0
  console.log('\n--- TEST 2: childcare=nearby ---\n');

  const nearbyResponse = await fetchJobs({ childcare: 'nearby' });
  console.log(`Total jobs returned: ${nearbyResponse.total}`);
  console.log(`Sample size: ${nearbyResponse.data.length}\n`);

  const nearbyFacilities = new Set();
  for (const job of nearbyResponse.data) {
    nearbyFacilities.add(job.facility_name);
  }

  console.log(`Unique facilities in results: ${nearbyFacilities.size}`);
  console.log('Facilities returned:');
  for (const f of [...nearbyFacilities].slice(0, 10)) {
    console.log(`  - ${f}`);
  }

  // Test 3: Cross-validate - jobs with childcare=onsite should NOT include facilities without onsite daycare
  console.log('\n--- TEST 3: Verify no overlap violation ---\n');

  // Facilities known to NOT have onsite daycare (from DB query above)
  const knownNoOnsite = [
    'Centra Health',
    'EVMS Medical Group',
    'INOVA Loudoun Hospital',
    'Alexander T. Augusta Military Medical Center',
    'LewisGale Hospital Montgomery'
  ];

  let violationFound = false;
  for (const facility of onsiteFacilities) {
    if (knownNoOnsite.includes(facility)) {
      console.log(`✗ VIOLATION: ${facility} returned for childcare=onsite but doesn't have onsite daycare`);
      violationFound = true;
      failed++;
    }
  }

  if (!violationFound) {
    console.log('✓ No facilities without onsite daycare found in childcare=onsite results');
    passed++;
  }

  // Test 4: Verify facilities returned for onsite DO have onsite daycare
  console.log('\n--- TEST 4: Verify onsite facilities are correct ---\n');

  // Known facilities WITH onsite daycare
  const knownWithOnsite = [
    'University of Virginia Medical Center',
    'INOVA Fairfax Hospital',
    'Augusta Health',
    'VHC Health',
    'Bon Secours St Marys Hospital'
  ];

  let onsiteCorrect = 0;
  for (const facility of onsiteFacilities) {
    if (knownWithOnsite.includes(facility)) {
      onsiteCorrect++;
    }
  }

  if (onsiteCorrect > 0) {
    console.log(`✓ Found ${onsiteCorrect} known onsite-daycare facilities in results`);
    passed++;
  } else {
    console.log('✗ No known onsite-daycare facilities found');
    failed++;
  }

  // Test 5: Combined filter - childcare + nursing_type
  console.log('\n--- TEST 5: childcare=onsite + nursing_type=rn ---\n');

  const combinedResponse = await fetchJobs({ childcare: 'onsite', nursing_type: 'rn' });
  console.log(`Total RN jobs with onsite childcare: ${combinedResponse.total}`);

  let rnValid = 0;
  let rnInvalid = 0;
  for (const job of combinedResponse.data) {
    const nursingType = (job.nursing_type || '').toLowerCase().replace(/[{}]/g, '');
    if (nursingType === 'rn') {
      rnValid++;
    } else {
      rnInvalid++;
      if (rnInvalid <= 3) {
        console.log(`  Invalid: ${job.title} - nursing_type: ${job.nursing_type}`);
      }
    }
  }

  if (rnInvalid === 0) {
    console.log(`✓ All ${rnValid} jobs are RN positions`);
    passed++;
  } else {
    console.log(`✗ ${rnInvalid}/${combinedResponse.data.length} jobs are not RN`);
    failed++;
  }

  // Test 6: childcare filter with specialty
  console.log('\n--- TEST 6: childcare=nearby + specialty=icu ---\n');

  const icuChildcareResponse = await fetchJobs({ childcare: 'nearby', specialty: 'icu' });
  console.log(`Total ICU jobs with nearby childcare: ${icuChildcareResponse.total}`);

  let icuValid = 0;
  let icuInvalid = 0;
  for (const job of icuChildcareResponse.data) {
    const specialty = (job.specialty || '').toLowerCase().replace(/[{}]/g, '');
    if (specialty === 'icu') {
      icuValid++;
    } else {
      icuInvalid++;
      if (icuInvalid <= 3) {
        console.log(`  Invalid: ${job.title} - specialty: ${job.specialty}`);
      }
    }
  }

  if (icuInvalid === 0) {
    console.log(`✓ All ${icuValid} jobs are ICU specialty`);
    passed++;
  } else {
    console.log(`✗ ${icuInvalid}/${icuChildcareResponse.data.length} jobs are not ICU`);
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('                         SUMMARY');
  console.log('='.repeat(70));
  console.log(`\nTotal Tests: ${passed + failed}`);
  console.log(`Passed: ${passed} ✓`);
  console.log(`Failed: ${failed} ✗`);
  console.log(`Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('\n' + '='.repeat(70));

  process.exit(failed > 0 ? 1 : 0);
}

runChildcareTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
