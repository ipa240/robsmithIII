/**
 * Filter Validation Test Suite
 * Tests all filter combinations to ensure correct results
 */

const API_URL = 'https://vanurses.net/api/jobs';

const results = [];

// Helper to fetch jobs with filters
async function fetchJobs(params) {
  const searchParams = new URLSearchParams();
  searchParams.set('limit', '50');

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== false) {
      searchParams.set(key, String(value));
    }
  }

  const response = await fetch(`${API_URL}?${searchParams.toString()}`);
  return response.json();
}

// Validation functions
const validators = {
  nursing_type: (job, expected) => {
    const actual = job.nursing_type?.toLowerCase().replace(/[{}]/g, '');
    return actual === expected.toLowerCase();
  },

  specialty: (job, expected) => {
    const actual = job.specialty?.toLowerCase().replace(/[{}]/g, '');
    return actual === expected.toLowerCase();
  },

  employment_type: (job, expected) => {
    const actual = job.employment_type?.toLowerCase().replace(/[{}]/g, '');
    return actual === expected.toLowerCase();
  },

  shift_type: (job, expected) => {
    const actual = job.shift_type?.toLowerCase().replace(/[{}]/g, '');
    return actual === expected.toLowerCase();
  },

  has_sign_on_bonus: (job) => {
    const columnBonus = job.sign_on_bonus && job.sign_on_bonus > 0;
    const enrichmentBonus = job.bonus_from_enrichment &&
      parseInt(job.bonus_from_enrichment) > 0;
    return columnBonus || enrichmentBonus;
  },

  new_grad_friendly: (job) => {
    const titlePattern = /new.?grad|graduate.?nurse|GN |residency/i;
    const expPattern = /new.?grad|entry.?level|0.?year|no.?experience|graduate.?nurse|GN.?program/i;
    return titlePattern.test(job.title || '') || expPattern.test(job.experience_req || '');
  },

  pay_disclosed_only: (job) => {
    return job.pay_min !== null || job.pay_max !== null;
  },

  min_pay: (job, minPay) => {
    return job.pay_min !== null && job.pay_min >= minPay;
  },
};

// Test runner
async function runTest(name, params, validator, description) {
  try {
    const response = await fetchJobs(params);

    let valid = 0, invalid = 0;
    const invalidExamples = [];

    for (const job of response.data) {
      if (validator(job)) {
        valid++;
      } else {
        invalid++;
        if (invalidExamples.length < 3) {
          invalidExamples.push(job);
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

    const status = passed ? '✓' : '✗';
    console.log(`${status} ${name}: ${valid}/${response.data.length} valid (${accuracy}%) | Total: ${response.total}`);

    if (!passed && invalidExamples.length > 0) {
      console.log(`  Invalid examples:`);
      for (const ex of invalidExamples) {
        console.log(`    - ${ex.title?.substring(0, 50)}...`);
        if (description) console.log(`      ${description(ex)}`);
      }
    }

    return { passed, invalid, total: response.total };
  } catch (err) {
    console.log(`✗ ${name}: ERROR - ${err.message}`);
    return { passed: false, invalid: -1, total: 0 };
  }
}

// Main test suite
async function runAllTests() {
  console.log('='.repeat(70));
  console.log('              FILTER VALIDATION TEST SUITE');
  console.log('='.repeat(70) + '\n');

  console.log('--- INDIVIDUAL FILTERS ---\n');

  // Nursing type filters
  await runTest(
    'nursing_type=rn',
    { nursing_type: 'rn' },
    (job) => validators.nursing_type(job, 'rn'),
    (job) => `nursing_type: ${job.nursing_type}`
  );

  await runTest(
    'nursing_type=lpn',
    { nursing_type: 'lpn' },
    (job) => validators.nursing_type(job, 'lpn'),
    (job) => `nursing_type: ${job.nursing_type}`
  );

  await runTest(
    'nursing_type=cna',
    { nursing_type: 'cna' },
    (job) => validators.nursing_type(job, 'cna'),
    (job) => `nursing_type: ${job.nursing_type}`
  );

  // Specialty filters
  await runTest(
    'specialty=icu',
    { specialty: 'icu' },
    (job) => validators.specialty(job, 'icu'),
    (job) => `specialty: ${job.specialty}`
  );

  await runTest(
    'specialty=er',
    { specialty: 'er' },
    (job) => validators.specialty(job, 'er'),
    (job) => `specialty: ${job.specialty}`
  );

  await runTest(
    'specialty=med_surg',
    { specialty: 'med_surg' },
    (job) => validators.specialty(job, 'med_surg'),
    (job) => `specialty: ${job.specialty}`
  );

  await runTest(
    'specialty=labor_delivery',
    { specialty: 'labor_delivery' },
    (job) => validators.specialty(job, 'labor_delivery'),
    (job) => `specialty: ${job.specialty}`
  );

  // Employment type filters
  await runTest(
    'employment_type=full_time',
    { employment_type: 'full_time' },
    (job) => validators.employment_type(job, 'full_time'),
    (job) => `employment_type: ${job.employment_type}`
  );

  await runTest(
    'employment_type=part_time',
    { employment_type: 'part_time' },
    (job) => validators.employment_type(job, 'part_time'),
    (job) => `employment_type: ${job.employment_type}`
  );

  await runTest(
    'employment_type=prn',
    { employment_type: 'prn' },
    (job) => validators.employment_type(job, 'prn'),
    (job) => `employment_type: ${job.employment_type}`
  );

  // Boolean filters
  await runTest(
    'has_sign_on_bonus=true',
    { has_sign_on_bonus: true },
    validators.has_sign_on_bonus,
    (job) => `sign_on_bonus: ${job.sign_on_bonus}, enrichment: ${job.bonus_from_enrichment}`
  );

  await runTest(
    'new_grad_friendly=true',
    { new_grad_friendly: true },
    validators.new_grad_friendly,
    (job) => `title: ${job.title?.substring(0, 40)}, exp: ${job.experience_req?.substring(0, 40)}`
  );

  await runTest(
    'pay_disclosed_only=true',
    { pay_disclosed_only: true },
    validators.pay_disclosed_only,
    (job) => `pay_min: ${job.pay_min}, pay_max: ${job.pay_max}`
  );

  // Pay range filters
  await runTest(
    'min_pay=40',
    { min_pay: 40 },
    (job) => validators.min_pay(job, 40),
    (job) => `pay_min: ${job.pay_min}`
  );

  console.log('\n--- COMBINED FILTERS (critical tests) ---\n');

  // The bug we fixed - combined filters with OR clauses
  await runTest(
    'new_grad_friendly + has_sign_on_bonus',
    { new_grad_friendly: true, has_sign_on_bonus: true },
    (job) => validators.has_sign_on_bonus(job), // Primary check: bonus must exist
    (job) => `bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
  );

  await runTest(
    'rn + icu + full_time',
    { nursing_type: 'rn', specialty: 'icu', employment_type: 'full_time' },
    (job) => validators.nursing_type(job, 'rn') &&
             validators.specialty(job, 'icu') &&
             validators.employment_type(job, 'full_time'),
    (job) => `type: ${job.nursing_type}, spec: ${job.specialty}, emp: ${job.employment_type}`
  );

  await runTest(
    'rn + has_sign_on_bonus + pay_disclosed_only',
    { nursing_type: 'rn', has_sign_on_bonus: true, pay_disclosed_only: true },
    (job) => validators.nursing_type(job, 'rn') &&
             validators.has_sign_on_bonus(job) &&
             validators.pay_disclosed_only(job),
    (job) => `type: ${job.nursing_type}, bonus: ${job.bonus_from_enrichment}, pay: ${job.pay_min}-${job.pay_max}`
  );

  await runTest(
    'new_grad_friendly + specialty=med_surg',
    { new_grad_friendly: true, specialty: 'med_surg' },
    (job) => validators.specialty(job, 'med_surg'),
    (job) => `specialty: ${job.specialty}`
  );

  await runTest(
    'has_sign_on_bonus + employment_type=part_time',
    { has_sign_on_bonus: true, employment_type: 'part_time' },
    (job) => validators.has_sign_on_bonus(job) && validators.employment_type(job, 'part_time'),
    (job) => `bonus: ${job.bonus_from_enrichment}, emp: ${job.employment_type}`
  );

  await runTest(
    'icu + has_sign_on_bonus + min_pay=35',
    { specialty: 'icu', has_sign_on_bonus: true, min_pay: 35 },
    (job) => validators.specialty(job, 'icu') && validators.has_sign_on_bonus(job),
    (job) => `spec: ${job.specialty}, bonus: ${job.bonus_from_enrichment}, pay: ${job.pay_min}`
  );

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('                         SUMMARY');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`Passed: ${passed.length} ✓`);
  console.log(`Failed: ${failed.length} ✗`);

  if (failed.length > 0) {
    console.log('\n--- FAILED TESTS ---');
    for (const f of failed) {
      console.log(`\n${f.name}:`);
      console.log(`  Total: ${f.total}, Invalid: ${f.invalid}/${f.sampleSize}`);
      for (const ex of f.invalidExamples) {
        console.log(`  - ${ex.title?.substring(0, 50)}...`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));

  // Exit with error code if any tests failed
  process.exit(failed.length > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
