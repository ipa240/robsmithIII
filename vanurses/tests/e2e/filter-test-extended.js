/**
 * Extended Filter Validation Test Suite
 * Tests filters NOT covered by the comprehensive test:
 * - search, city, region, facility_system
 * - max_pay, bsn_required, certification
 * - childcare, max_distance_miles, user_zip
 */

const API_URL = 'https://vanurses.net/api/jobs';

const results = [];
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// Helper to fetch jobs with filters
async function fetchJobs(params) {
  const searchParams = new URLSearchParams();
  searchParams.set('limit', '50');

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== false && value !== null) {
      searchParams.set(key, String(value));
    }
  }

  const response = await fetch(`${API_URL}?${searchParams.toString()}`);
  return response.json();
}

// Content validators
const validators = {
  search: (job, searchTerm) => {
    const title = (job.title || '').toLowerCase();
    const desc = (job.description || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    return title.includes(term) || desc.includes(term);
  },

  city: (job, expected) => {
    const actual = (job.city || '').toLowerCase();
    return actual === expected.toLowerCase();
  },

  region: (job, expected) => {
    const actual = (job.facility_region || '').toLowerCase().replace(/[_\s-]/g, '');
    const exp = expected.toLowerCase().replace(/[_\s-]/g, '');
    // Handle various region name formats
    return actual.includes(exp) || exp.includes(actual) ||
           actual.includes('nova') && exp.includes('northern') ||
           actual.includes('hampton') && exp.includes('hampton');
  },

  facility_system: (job, expected) => {
    const actual = (job.facility_system || '').toLowerCase();
    return actual.includes(expected.toLowerCase());
  },

  max_pay: (job, maxPay) => {
    // Either pay_max <= maxPay OR pay_min <= maxPay (per API logic)
    const hasValidPay = (job.pay_max !== null && job.pay_max <= maxPay) ||
                        (job.pay_min !== null && job.pay_min <= maxPay);
    return hasValidPay;
  },

  bsn_required_yes: (job) => {
    const edu = (job.education_req || '').toLowerCase();
    return /bsn.*(required|preferred|must)/.test(edu);
  },

  bsn_required_no: (job) => {
    const edu = (job.education_req || '').toLowerCase();
    // ADN/ASN/Associate mentioned (means they accept non-BSN)
    // OR no BSN required mention
    // Note: "BSN Required or ADN Required" is valid - ADN IS accepted
    const acceptsAdn = /(adn|asn|associate)/.test(edu);
    const noBsnRequired = !(/bsn.*required/.test(edu)) || acceptsAdn;
    return noBsnRequired;
  },

  certification: (job, cert) => {
    const certs = (job.certifications_req || '').toUpperCase();
    return certs.includes(cert.toUpperCase());
  },

  // For distance, we just check the distance_miles field is populated and within range
  max_distance: (job, maxMiles) => {
    if (job.distance_miles === null || job.distance_miles === undefined) {
      return false;  // No distance data means facility has no coordinates
    }
    return job.distance_miles <= maxMiles;
  },

  // Check that results are sorted by distance
  sorted_by_distance: (jobs) => {
    if (jobs.length < 2) return true;
    for (let i = 1; i < jobs.length; i++) {
      if (jobs[i].distance_miles !== null && jobs[i-1].distance_miles !== null) {
        if (jobs[i].distance_miles < jobs[i-1].distance_miles) {
          return false;
        }
      }
    }
    return true;
  },
};

// Test runner
async function runTest(name, params, validator, description) {
  totalTests++;
  try {
    const response = await fetchJobs(params);

    if (response.data.length === 0) {
      results.push({
        name,
        params,
        total: response.total,
        sampleSize: 0,
        valid: 0,
        invalid: 0,
        accuracy: 'N/A (no results)',
        passed: true,
        note: 'No jobs match this filter combination'
      });
      passedTests++;
      console.log(`✓ ${name}: No results (filter may be too restrictive)`);
      return { passed: true, invalid: 0, total: 0 };
    }

    let valid = 0, invalid = 0;
    const invalidExamples = [];

    for (const job of response.data) {
      if (validator(job)) {
        valid++;
      } else {
        invalid++;
        if (invalidExamples.length < 3) {
          invalidExamples.push({
            id: job.id,
            title: job.title?.substring(0, 50),
            details: description ? description(job) : ''
          });
        }
      }
    }

    const passed = invalid === 0;
    const accuracy = response.data.length > 0
      ? ((valid / response.data.length) * 100).toFixed(1)
      : 'N/A';

    results.push({
      name,
      params,
      total: response.total,
      sampleSize: response.data.length,
      valid,
      invalid,
      accuracy,
      passed,
      invalidExamples
    });

    if (passed) {
      passedTests++;
      console.log(`✓ ${name}: ${valid}/${response.data.length} (${accuracy}%) | Total: ${response.total}`);
    } else {
      failedTests++;
      console.log(`✗ ${name}: ${valid}/${response.data.length} (${accuracy}%) | Total: ${response.total}`);
      for (const ex of invalidExamples.slice(0, 2)) {
        console.log(`    - ${ex.title}...`);
        if (ex.details) console.log(`      ${ex.details}`);
      }
    }

    return { passed, invalid, total: response.total };
  } catch (err) {
    failedTests++;
    console.log(`✗ ${name}: ERROR - ${err.message}`);
    results.push({ name, error: err.message, passed: false });
    return { passed: false, invalid: -1, total: 0 };
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main test suite
async function runAllTests() {
  console.log('='.repeat(80));
  console.log('           EXTENDED FILTER VALIDATION TEST SUITE');
  console.log('           (Testing filters not in comprehensive suite)');
  console.log('='.repeat(80) + '\n');

  // ============================================
  // SECTION 1: SEARCH FILTER
  // ============================================
  console.log('\n' + '─'.repeat(80));
  console.log('SECTION 1: SEARCH FILTER');
  console.log('─'.repeat(80) + '\n');

  const searchTerms = ['ICU', 'nurse', 'cardiac', 'emergency', 'pediatric', 'oncology'];
  for (const term of searchTerms) {
    await runTest(
      `search="${term}"`,
      { search: term },
      (job) => validators.search(job, term),
      (job) => `title: ${job.title?.substring(0, 40)}`
    );
    await delay(100);
  }

  // Search + other filters
  await runTest(
    'search="ICU" + nursing_type=rn',
    { search: 'ICU', nursing_type: 'rn' },
    (job) => validators.search(job, 'ICU') && job.nursing_type?.toLowerCase().replace(/[{}]/g, '') === 'rn',
    (job) => `title: ${job.title?.substring(0, 40)}, type: ${job.nursing_type}`
  );

  await runTest(
    'search="bonus" + has_sign_on_bonus',
    { search: 'bonus', has_sign_on_bonus: true },
    (job) => validators.search(job, 'bonus') &&
             ((job.sign_on_bonus && job.sign_on_bonus > 0) || (job.bonus_from_enrichment && parseInt(job.bonus_from_enrichment) > 0)),
    (job) => `title: ${job.title?.substring(0, 40)}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
  );

  // ============================================
  // SECTION 2: REGION FILTER (has OR clause!)
  // ============================================
  console.log('\n' + '─'.repeat(80));
  console.log('SECTION 2: REGION FILTER');
  console.log('─'.repeat(80) + '\n');

  const regions = ['nova', 'hampton_roads', 'richmond', 'roanoke', 'charlottesville', 'shenandoah'];
  for (const region of regions) {
    await runTest(
      `region=${region}`,
      { region: region },
      (job) => validators.region(job, region),
      (job) => `facility_region: ${job.facility_region}`
    );
    await delay(100);
  }

  // Region + other filters (test OR clause)
  await runTest(
    'region=nova + nursing_type=rn',
    { region: 'nova', nursing_type: 'rn' },
    (job) => validators.region(job, 'nova') && job.nursing_type?.toLowerCase().replace(/[{}]/g, '') === 'rn',
    (job) => `region: ${job.facility_region}, type: ${job.nursing_type}`
  );

  await runTest(
    'region=richmond + has_sign_on_bonus',
    { region: 'richmond', has_sign_on_bonus: true },
    (job) => validators.region(job, 'richmond') &&
             ((job.sign_on_bonus && job.sign_on_bonus > 0) || (job.bonus_from_enrichment && parseInt(job.bonus_from_enrichment) > 0)),
    (job) => `region: ${job.facility_region}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
  );

  // ============================================
  // SECTION 3: FACILITY SYSTEM FILTER
  // ============================================
  console.log('\n' + '─'.repeat(80));
  console.log('SECTION 3: FACILITY SYSTEM FILTER');
  console.log('─'.repeat(80) + '\n');

  const systems = ['HCA', 'Sentara', 'Inova', 'VCU', 'UVA'];
  for (const system of systems) {
    await runTest(
      `facility_system=${system}`,
      { facility_system: system },
      (job) => validators.facility_system(job, system),
      (job) => `facility_system: ${job.facility_system}`
    );
    await delay(100);
  }

  // System + other filters
  await runTest(
    'facility_system=HCA + nursing_type=rn',
    { facility_system: 'HCA', nursing_type: 'rn' },
    (job) => validators.facility_system(job, 'HCA') && job.nursing_type?.toLowerCase().replace(/[{}]/g, '') === 'rn',
    (job) => `system: ${job.facility_system}, type: ${job.nursing_type}`
  );

  await runTest(
    'facility_system=Sentara + has_sign_on_bonus',
    { facility_system: 'Sentara', has_sign_on_bonus: true },
    (job) => validators.facility_system(job, 'Sentara') &&
             ((job.sign_on_bonus && job.sign_on_bonus > 0) || (job.bonus_from_enrichment && parseInt(job.bonus_from_enrichment) > 0)),
    (job) => `system: ${job.facility_system}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
  );

  // ============================================
  // SECTION 4: MAX_PAY FILTER (has OR clause!)
  // ============================================
  console.log('\n' + '─'.repeat(80));
  console.log('SECTION 4: MAX_PAY FILTER');
  console.log('─'.repeat(80) + '\n');

  const maxPayValues = [40, 50, 60, 80];
  for (const maxPay of maxPayValues) {
    await runTest(
      `max_pay=${maxPay}`,
      { max_pay: maxPay },
      (job) => validators.max_pay(job, maxPay),
      (job) => `pay_min: ${job.pay_min}, pay_max: ${job.pay_max}`
    );
    await delay(100);
  }

  // Pay range tests (min + max)
  await runTest(
    'min_pay=35 + max_pay=50',
    { min_pay: 35, max_pay: 50 },
    (job) => job.pay_min !== null && job.pay_min >= 35 && validators.max_pay(job, 50),
    (job) => `pay_min: ${job.pay_min}, pay_max: ${job.pay_max}`
  );

  await runTest(
    'min_pay=40 + max_pay=60',
    { min_pay: 40, max_pay: 60 },
    (job) => job.pay_min !== null && job.pay_min >= 40 && validators.max_pay(job, 60),
    (job) => `pay_min: ${job.pay_min}, pay_max: ${job.pay_max}`
  );

  // Max pay + other filters
  await runTest(
    'max_pay=50 + nursing_type=rn',
    { max_pay: 50, nursing_type: 'rn' },
    (job) => validators.max_pay(job, 50) && job.nursing_type?.toLowerCase().replace(/[{}]/g, '') === 'rn',
    (job) => `pay: ${job.pay_min}-${job.pay_max}, type: ${job.nursing_type}`
  );

  await runTest(
    'max_pay=45 + has_sign_on_bonus',
    { max_pay: 45, has_sign_on_bonus: true },
    (job) => validators.max_pay(job, 45) &&
             ((job.sign_on_bonus && job.sign_on_bonus > 0) || (job.bonus_from_enrichment && parseInt(job.bonus_from_enrichment) > 0)),
    (job) => `pay: ${job.pay_min}-${job.pay_max}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
  );

  // ============================================
  // SECTION 5: BSN_REQUIRED FILTER (has OR clause!)
  // ============================================
  console.log('\n' + '─'.repeat(80));
  console.log('SECTION 5: BSN_REQUIRED FILTER');
  console.log('─'.repeat(80) + '\n');

  await runTest(
    'bsn_required=yes',
    { bsn_required: 'yes' },
    validators.bsn_required_yes,
    (job) => `education: ${(job.education_req || '').substring(0, 50)}`
  );

  await runTest(
    'bsn_required=no',
    { bsn_required: 'no' },
    validators.bsn_required_no,
    (job) => `education: ${(job.education_req || '').substring(0, 50)}`
  );

  // BSN + other filters (critical - has OR clause)
  await runTest(
    'bsn_required=yes + nursing_type=rn',
    { bsn_required: 'yes', nursing_type: 'rn' },
    (job) => validators.bsn_required_yes(job) && job.nursing_type?.toLowerCase().replace(/[{}]/g, '') === 'rn',
    (job) => `edu: ${(job.education_req || '').substring(0, 30)}, type: ${job.nursing_type}`
  );

  await runTest(
    'bsn_required=no + nursing_type=rn',
    { bsn_required: 'no', nursing_type: 'rn' },
    (job) => validators.bsn_required_no(job) && job.nursing_type?.toLowerCase().replace(/[{}]/g, '') === 'rn',
    (job) => `edu: ${(job.education_req || '').substring(0, 30)}, type: ${job.nursing_type}`
  );

  await runTest(
    'bsn_required=no + has_sign_on_bonus',
    { bsn_required: 'no', has_sign_on_bonus: true },
    (job) => validators.bsn_required_no(job) &&
             ((job.sign_on_bonus && job.sign_on_bonus > 0) || (job.bonus_from_enrichment && parseInt(job.bonus_from_enrichment) > 0)),
    (job) => `edu: ${(job.education_req || '').substring(0, 30)}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
  );

  await runTest(
    'bsn_required=no + new_grad_friendly',
    { bsn_required: 'no', new_grad_friendly: true },
    (job) => validators.bsn_required_no(job) &&
             (/new.?grad|graduate.?nurse|residency/.test((job.title || '').toLowerCase()) ||
              /new.?grad|entry.?level|0.?year|no.?experience|graduate.?nurse|gn.?program|new.?graduate/.test((job.experience_req || '').toLowerCase())),
    (job) => `edu: ${(job.education_req || '').substring(0, 30)}, exp: ${(job.experience_req || '').substring(0, 30)}`
  );

  // ============================================
  // SECTION 6: CERTIFICATION FILTER
  // ============================================
  console.log('\n' + '─'.repeat(80));
  console.log('SECTION 6: CERTIFICATION FILTER');
  console.log('─'.repeat(80) + '\n');

  const certs = ['ACLS', 'BLS', 'PALS', 'CCRN', 'NRP'];
  for (const cert of certs) {
    await runTest(
      `certification=${cert}`,
      { certification: cert },
      (job) => validators.certification(job, cert),
      (job) => `certifications: ${(job.certifications_req || '').substring(0, 50)}`
    );
    await delay(100);
  }

  // Cert + other filters
  await runTest(
    'certification=ACLS + nursing_type=rn',
    { certification: 'ACLS', nursing_type: 'rn' },
    (job) => validators.certification(job, 'ACLS') && job.nursing_type?.toLowerCase().replace(/[{}]/g, '') === 'rn',
    (job) => `certs: ${(job.certifications_req || '').substring(0, 30)}, type: ${job.nursing_type}`
  );

  await runTest(
    'certification=BLS + specialty=icu',
    { certification: 'BLS', specialty: 'icu' },
    (job) => validators.certification(job, 'BLS') && job.specialty?.toLowerCase().replace(/[{}]/g, '') === 'icu',
    (job) => `certs: ${(job.certifications_req || '').substring(0, 30)}, spec: ${job.specialty}`
  );

  // ============================================
  // SECTION 7: DISTANCE FILTER (user_zip, max_distance_miles)
  // ============================================
  console.log('\n' + '─'.repeat(80));
  console.log('SECTION 7: DISTANCE FILTER');
  console.log('─'.repeat(80) + '\n');

  // Test with zip code (Richmond area)
  await runTest(
    'user_zip=23220 + max_distance_miles=25',
    { user_zip: '23220', max_distance_miles: 25 },
    (job) => validators.max_distance(job, 25),
    (job) => `distance: ${job.distance_miles?.toFixed(1)} miles`
  );

  await runTest(
    'user_zip=23220 + max_distance_miles=50',
    { user_zip: '23220', max_distance_miles: 50 },
    (job) => validators.max_distance(job, 50),
    (job) => `distance: ${job.distance_miles?.toFixed(1)} miles`
  );

  // Northern Virginia zip
  await runTest(
    'user_zip=22101 + max_distance_miles=30',
    { user_zip: '22101', max_distance_miles: 30 },
    (job) => validators.max_distance(job, 30),
    (job) => `distance: ${job.distance_miles?.toFixed(1)} miles`
  );

  // Hampton Roads zip
  await runTest(
    'user_zip=23451 + max_distance_miles=20',
    { user_zip: '23451', max_distance_miles: 20 },
    (job) => validators.max_distance(job, 20),
    (job) => `distance: ${job.distance_miles?.toFixed(1)} miles`
  );

  // Distance + other filters
  await runTest(
    'user_zip=23220 + max_distance_miles=50 + nursing_type=rn',
    { user_zip: '23220', max_distance_miles: 50, nursing_type: 'rn' },
    (job) => validators.max_distance(job, 50) && job.nursing_type?.toLowerCase().replace(/[{}]/g, '') === 'rn',
    (job) => `distance: ${job.distance_miles?.toFixed(1)}, type: ${job.nursing_type}`
  );

  await runTest(
    'user_zip=22101 + max_distance_miles=25 + has_sign_on_bonus',
    { user_zip: '22101', max_distance_miles: 25, has_sign_on_bonus: true },
    (job) => validators.max_distance(job, 25) &&
             ((job.sign_on_bonus && job.sign_on_bonus > 0) || (job.bonus_from_enrichment && parseInt(job.bonus_from_enrichment) > 0)),
    (job) => `distance: ${job.distance_miles?.toFixed(1)}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
  );

  // Sort by distance
  const distanceSortResponse = await fetchJobs({ user_zip: '23220', sort_by_distance: true });
  const isSorted = validators.sorted_by_distance(distanceSortResponse.data);
  totalTests++;
  if (isSorted) {
    passedTests++;
    console.log(`✓ sort_by_distance=true: Jobs sorted by distance correctly`);
  } else {
    failedTests++;
    console.log(`✗ sort_by_distance=true: Jobs NOT sorted by distance`);
    for (let i = 1; i < Math.min(5, distanceSortResponse.data.length); i++) {
      console.log(`    ${i}: ${distanceSortResponse.data[i-1].distance_miles?.toFixed(1)} -> ${distanceSortResponse.data[i].distance_miles?.toFixed(1)}`);
    }
  }
  results.push({ name: 'sort_by_distance=true', passed: isSorted });

  // ============================================
  // SECTION 8: CITY FILTER
  // ============================================
  console.log('\n' + '─'.repeat(80));
  console.log('SECTION 8: CITY FILTER');
  console.log('─'.repeat(80) + '\n');

  const cities = ['Richmond', 'Norfolk', 'Virginia Beach', 'Alexandria', 'Roanoke'];
  for (const city of cities) {
    await runTest(
      `city=${city}`,
      { city: city },
      (job) => validators.city(job, city),
      (job) => `city: ${job.city}`
    );
    await delay(100);
  }

  // City + other filters
  await runTest(
    'city=Richmond + nursing_type=rn',
    { city: 'Richmond', nursing_type: 'rn' },
    (job) => validators.city(job, 'Richmond') && job.nursing_type?.toLowerCase().replace(/[{}]/g, '') === 'rn',
    (job) => `city: ${job.city}, type: ${job.nursing_type}`
  );

  // ============================================
  // SECTION 9: COMPLEX MULTI-FILTER COMBINATIONS
  // ============================================
  console.log('\n' + '─'.repeat(80));
  console.log('SECTION 9: COMPLEX MULTI-FILTER COMBINATIONS');
  console.log('─'.repeat(80) + '\n');

  // Critical: Multiple filters with OR clauses combined
  await runTest(
    'region=nova + bsn_required=no + has_sign_on_bonus',
    { region: 'nova', bsn_required: 'no', has_sign_on_bonus: true },
    (job) => validators.region(job, 'nova') &&
             validators.bsn_required_no(job) &&
             ((job.sign_on_bonus && job.sign_on_bonus > 0) || (job.bonus_from_enrichment && parseInt(job.bonus_from_enrichment) > 0)),
    (job) => `region: ${job.facility_region}, edu: ${(job.education_req || '').substring(0, 20)}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
  );

  await runTest(
    'max_pay=50 + new_grad_friendly + nursing_type=rn',
    { max_pay: 50, new_grad_friendly: true, nursing_type: 'rn' },
    (job) => validators.max_pay(job, 50) &&
             job.nursing_type?.toLowerCase().replace(/[{}]/g, '') === 'rn' &&
             (/new.?grad|graduate.?nurse|residency/.test((job.title || '').toLowerCase()) ||
              /new.?grad|entry.?level|0.?year|no.?experience|graduate.?nurse|gn.?program|new.?graduate/.test((job.experience_req || '').toLowerCase())),
    (job) => `pay: ${job.pay_min}-${job.pay_max}, type: ${job.nursing_type}, exp: ${(job.experience_req || '').substring(0, 20)}`
  );

  await runTest(
    'facility_system=HCA + region=richmond + employment_type=full_time',
    { facility_system: 'HCA', region: 'richmond', employment_type: 'full_time' },
    (job) => validators.facility_system(job, 'HCA') &&
             validators.region(job, 'richmond') &&
             job.employment_type?.toLowerCase().replace(/[{}]/g, '') === 'full_time',
    (job) => `system: ${job.facility_system}, region: ${job.facility_region}, emp: ${job.employment_type}`
  );

  await runTest(
    'search="ICU" + certification=ACLS + nursing_type=rn',
    { search: 'ICU', certification: 'ACLS', nursing_type: 'rn' },
    (job) => validators.search(job, 'ICU') &&
             validators.certification(job, 'ACLS') &&
             job.nursing_type?.toLowerCase().replace(/[{}]/g, '') === 'rn',
    (job) => `title: ${job.title?.substring(0, 30)}, certs: ${(job.certifications_req || '').substring(0, 20)}`
  );

  await runTest(
    'user_zip=23220 + max_distance=30 + specialty=icu + has_sign_on_bonus',
    { user_zip: '23220', max_distance_miles: 30, specialty: 'icu', has_sign_on_bonus: true },
    (job) => validators.max_distance(job, 30) &&
             job.specialty?.toLowerCase().replace(/[{}]/g, '') === 'icu' &&
             ((job.sign_on_bonus && job.sign_on_bonus > 0) || (job.bonus_from_enrichment && parseInt(job.bonus_from_enrichment) > 0)),
    (job) => `dist: ${job.distance_miles?.toFixed(1)}, spec: ${job.specialty}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
  );

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('                              FINAL SUMMARY');
  console.log('='.repeat(80));

  console.log(`\nTotal Tests Run: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✓`);
  console.log(`Failed: ${failedTests} ✗`);
  console.log(`Pass Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (failedTests > 0) {
    console.log('\n' + '─'.repeat(80));
    console.log('FAILED TESTS DETAILS:');
    console.log('─'.repeat(80));

    const failed = results.filter(r => !r.passed && !r.error);
    for (const f of failed) {
      console.log(`\n✗ ${f.name}`);
      if (f.params) console.log(`  Params: ${JSON.stringify(f.params)}`);
      if (f.total !== undefined) console.log(`  Total: ${f.total}, Invalid: ${f.invalid}/${f.sampleSize} (${f.accuracy}%)`);
      if (f.invalidExamples) {
        for (const ex of f.invalidExamples) {
          console.log(`  - ${ex.title}...`);
          if (ex.details) console.log(`    ${ex.details}`);
        }
      }
    }

    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.log('\nERRORS:');
      for (const e of errors) {
        console.log(`  - ${e.name}: ${e.error}`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));

  process.exit(failedTests > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
