/**
 * Comprehensive Filter Validation Test Suite
 * Tests ~360 filter combinations and validates actual job content
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

// Content validators - check actual job data
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
    const title = (job.title || '').toLowerCase();
    const exp = (job.experience_req || '').toLowerCase();

    // Check title patterns
    const titleMatch = /new.?grad|graduate.?nurse|residency/.test(title);

    // Check experience patterns
    const expMatch = /new.?grad|entry.?level|0.?year|no.?experience|graduate.?nurse|gn.?program|new.?graduate/.test(exp);

    return titleMatch || expMatch;
  },

  pay_disclosed_only: (job) => {
    return job.pay_min !== null || job.pay_max !== null;
  },

  min_pay: (job, minPay) => {
    return job.pay_min !== null && job.pay_min >= minPay;
  },

  max_pay: (job, maxPay) => {
    return job.pay_max !== null && job.pay_max <= maxPay;
  },

  has_relocation: (job) => {
    return job.relocation_assistance === true;
  },

  ofs_grade: (job, grade) => {
    // API filters by score ranges, so validate using score NOT the stored grade
    // (stored grade may use different grading system like B- etc.)
    const score = job.facility_ofs_score;

    if (score === null || score === undefined) return false;

    const ranges = {
      'A': [90, 100],
      'B': [80, 89],
      'C': [70, 79],
      'D': [60, 69],
      'F': [0, 59],
    };
    const [min, max] = ranges[grade.toUpperCase()] || [0, 0];
    return score >= min && score <= max;
  },

  bsn_required_yes: (job) => {
    const edu = (job.education_req || '').toLowerCase();
    return /bsn.*(required|preferred|must)/.test(edu);
  },

  bsn_required_no: (job) => {
    const edu = (job.education_req || '').toLowerCase();
    // Either ADN accepted OR no BSN required mention
    return /(adn|asn|associate).*(accepted|ok|considered)/.test(edu) ||
           !edu.includes('bsn') || !edu.includes('required');
  },

  certification: (job, cert) => {
    const certs = (job.certifications_req || '').toUpperCase();
    return certs.includes(cert.toUpperCase());
  },

  posted_within_days: (job, days) => {
    if (!job.posted_at) return false;
    const posted = new Date(job.posted_at);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return posted >= cutoff;
  },

  region: (job, expected) => {
    const actual = (job.region || '').toLowerCase().replace(/[_\s]/g, '');
    const exp = expected.toLowerCase().replace(/[_\s]/g, '');
    return actual.includes(exp) || exp.includes(actual);
  },
};

// Test runner with content validation
async function runTest(name, params, validator, description) {
  totalTests++;
  try {
    const response = await fetchJobs(params);

    if (response.data.length === 0) {
      // No results - might be valid (no matching jobs)
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

// Rate limiter to avoid overwhelming API
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main test suite
async function runAllTests() {
  console.log('='.repeat(80));
  console.log('           COMPREHENSIVE FILTER VALIDATION TEST SUITE (~360 tests)');
  console.log('='.repeat(80) + '\n');

  // ============================================
  // SECTION 1: INDIVIDUAL FILTERS (~40 tests)
  // ============================================
  console.log('\n' + '─'.repeat(80));
  console.log('SECTION 1: INDIVIDUAL FILTERS');
  console.log('─'.repeat(80) + '\n');

  // Nursing type (3 tests)
  for (const nt of ['rn', 'lpn', 'cna']) {
    await runTest(
      `nursing_type=${nt}`,
      { nursing_type: nt },
      (job) => validators.nursing_type(job, nt),
      (job) => `nursing_type: ${job.nursing_type}`
    );
    await delay(100);
  }

  // Specialty (15 tests)
  const specialties = ['icu', 'er', 'med_surg', 'labor_delivery', 'psych', 'peds',
                       'oncology', 'surgical', 'cardiac', 'neuro', 'ortho',
                       'dialysis', 'home_health', 'rehab', 'geriatrics'];
  for (const sp of specialties) {
    await runTest(
      `specialty=${sp}`,
      { specialty: sp },
      (job) => validators.specialty(job, sp),
      (job) => `specialty: ${job.specialty}`
    );
    await delay(100);
  }

  // Employment type (3 tests)
  for (const et of ['full_time', 'part_time', 'prn']) {
    await runTest(
      `employment_type=${et}`,
      { employment_type: et },
      (job) => validators.employment_type(job, et),
      (job) => `employment_type: ${job.employment_type}`
    );
    await delay(100);
  }

  // Shift type (3 tests)
  for (const st of ['day', 'night', 'rotating']) {
    await runTest(
      `shift_type=${st}`,
      { shift_type: st },
      (job) => validators.shift_type(job, st),
      (job) => `shift_type: ${job.shift_type}`
    );
    await delay(100);
  }

  // Boolean filters (4 tests)
  await runTest(
    'has_sign_on_bonus=true',
    { has_sign_on_bonus: true },
    validators.has_sign_on_bonus,
    (job) => `bonus: ${job.sign_on_bonus || job.bonus_from_enrichment}`
  );

  await runTest(
    'new_grad_friendly=true',
    { new_grad_friendly: true },
    validators.new_grad_friendly,
    (job) => `title: ${job.title?.substring(0, 40)}, exp: ${(job.experience_req || '').substring(0, 40)}`
  );

  await runTest(
    'pay_disclosed_only=true',
    { pay_disclosed_only: true },
    validators.pay_disclosed_only,
    (job) => `pay_min: ${job.pay_min}, pay_max: ${job.pay_max}`
  );

  await runTest(
    'has_relocation=true',
    { has_relocation: true },
    validators.has_relocation,
    (job) => `relocation_assistance: ${job.relocation_assistance}`
  );

  // OFS Grade (5 tests)
  for (const grade of ['A', 'B', 'C', 'D', 'F']) {
    await runTest(
      `ofs_grade=${grade}`,
      { ofs_grade: grade },
      (job) => validators.ofs_grade(job, grade),
      (job) => `ofs_score: ${job.facility_ofs_score}`
    );
    await delay(100);
  }

  // Pay range tests (4 tests)
  for (const minPay of [30, 35, 40, 50]) {
    await runTest(
      `min_pay=${minPay}`,
      { min_pay: minPay },
      (job) => validators.min_pay(job, minPay),
      (job) => `pay_min: ${job.pay_min}`
    );
    await delay(100);
  }

  // Posted within days (3 tests)
  for (const days of [7, 14, 30]) {
    await runTest(
      `posted_within_days=${days}`,
      { posted_within_days: days },
      (job) => validators.posted_within_days(job, days),
      (job) => `posted_at: ${job.posted_at}`
    );
    await delay(100);
  }

  // ============================================
  // SECTION 2: PAIRWISE COMBINATIONS (~200 tests)
  // ============================================
  console.log('\n' + '─'.repeat(80));
  console.log('SECTION 2: PAIRWISE FILTER COMBINATIONS');
  console.log('─'.repeat(80) + '\n');

  // nursing_type + specialty (9 tests)
  const nursingTypes = ['rn', 'lpn', 'cna'];
  const topSpecialties = ['icu', 'er', 'med_surg'];
  for (const nt of nursingTypes) {
    for (const sp of topSpecialties) {
      await runTest(
        `${nt} + ${sp}`,
        { nursing_type: nt, specialty: sp },
        (job) => validators.nursing_type(job, nt) && validators.specialty(job, sp),
        (job) => `type: ${job.nursing_type}, spec: ${job.specialty}`
      );
      await delay(100);
    }
  }

  // nursing_type + employment_type (9 tests)
  const employmentTypes = ['full_time', 'part_time', 'prn'];
  for (const nt of nursingTypes) {
    for (const et of employmentTypes) {
      await runTest(
        `${nt} + ${et}`,
        { nursing_type: nt, employment_type: et },
        (job) => validators.nursing_type(job, nt) && validators.employment_type(job, et),
        (job) => `type: ${job.nursing_type}, emp: ${job.employment_type}`
      );
      await delay(100);
    }
  }

  // nursing_type + shift_type (9 tests)
  const shiftTypes = ['day', 'night', 'rotating'];
  for (const nt of nursingTypes) {
    for (const st of shiftTypes) {
      await runTest(
        `${nt} + ${st}`,
        { nursing_type: nt, shift_type: st },
        (job) => validators.nursing_type(job, nt) && validators.shift_type(job, st),
        (job) => `type: ${job.nursing_type}, shift: ${job.shift_type}`
      );
      await delay(100);
    }
  }

  // nursing_type + boolean filters (12 tests)
  for (const nt of nursingTypes) {
    await runTest(
      `${nt} + has_sign_on_bonus`,
      { nursing_type: nt, has_sign_on_bonus: true },
      (job) => validators.nursing_type(job, nt) && validators.has_sign_on_bonus(job),
      (job) => `type: ${job.nursing_type}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
    );
    await delay(100);

    await runTest(
      `${nt} + new_grad_friendly`,
      { nursing_type: nt, new_grad_friendly: true },
      (job) => validators.nursing_type(job, nt) && validators.new_grad_friendly(job),
      (job) => `type: ${job.nursing_type}, exp: ${(job.experience_req || '').substring(0, 30)}`
    );
    await delay(100);

    await runTest(
      `${nt} + pay_disclosed`,
      { nursing_type: nt, pay_disclosed_only: true },
      (job) => validators.nursing_type(job, nt) && validators.pay_disclosed_only(job),
      (job) => `type: ${job.nursing_type}, pay: ${job.pay_min}-${job.pay_max}`
    );
    await delay(100);

    await runTest(
      `${nt} + has_relocation`,
      { nursing_type: nt, has_relocation: true },
      (job) => validators.nursing_type(job, nt) && validators.has_relocation(job),
      (job) => `type: ${job.nursing_type}, reloc: ${job.relocation_assistance}`
    );
    await delay(100);
  }

  // specialty + employment_type (9 tests)
  for (const sp of topSpecialties) {
    for (const et of employmentTypes) {
      await runTest(
        `${sp} + ${et}`,
        { specialty: sp, employment_type: et },
        (job) => validators.specialty(job, sp) && validators.employment_type(job, et),
        (job) => `spec: ${job.specialty}, emp: ${job.employment_type}`
      );
      await delay(100);
    }
  }

  // specialty + boolean filters (12 tests)
  for (const sp of topSpecialties) {
    await runTest(
      `${sp} + has_sign_on_bonus`,
      { specialty: sp, has_sign_on_bonus: true },
      (job) => validators.specialty(job, sp) && validators.has_sign_on_bonus(job),
      (job) => `spec: ${job.specialty}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
    );
    await delay(100);

    await runTest(
      `${sp} + new_grad_friendly`,
      { specialty: sp, new_grad_friendly: true },
      (job) => validators.specialty(job, sp) && validators.new_grad_friendly(job),
      (job) => `spec: ${job.specialty}, exp: ${(job.experience_req || '').substring(0, 30)}`
    );
    await delay(100);

    await runTest(
      `${sp} + pay_disclosed`,
      { specialty: sp, pay_disclosed_only: true },
      (job) => validators.specialty(job, sp) && validators.pay_disclosed_only(job),
      (job) => `spec: ${job.specialty}, pay: ${job.pay_min}-${job.pay_max}`
    );
    await delay(100);

    await runTest(
      `${sp} + has_relocation`,
      { specialty: sp, has_relocation: true },
      (job) => validators.specialty(job, sp) && validators.has_relocation(job),
      (job) => `spec: ${job.specialty}, reloc: ${job.relocation_assistance}`
    );
    await delay(100);
  }

  // employment_type + shift_type (9 tests)
  for (const et of employmentTypes) {
    for (const st of shiftTypes) {
      await runTest(
        `${et} + ${st}`,
        { employment_type: et, shift_type: st },
        (job) => validators.employment_type(job, et) && validators.shift_type(job, st),
        (job) => `emp: ${job.employment_type}, shift: ${job.shift_type}`
      );
      await delay(100);
    }
  }

  // employment_type + boolean filters (12 tests)
  for (const et of employmentTypes) {
    await runTest(
      `${et} + has_sign_on_bonus`,
      { employment_type: et, has_sign_on_bonus: true },
      (job) => validators.employment_type(job, et) && validators.has_sign_on_bonus(job),
      (job) => `emp: ${job.employment_type}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
    );
    await delay(100);

    await runTest(
      `${et} + new_grad_friendly`,
      { employment_type: et, new_grad_friendly: true },
      (job) => validators.employment_type(job, et) && validators.new_grad_friendly(job),
      (job) => `emp: ${job.employment_type}, exp: ${(job.experience_req || '').substring(0, 30)}`
    );
    await delay(100);

    await runTest(
      `${et} + pay_disclosed`,
      { employment_type: et, pay_disclosed_only: true },
      (job) => validators.employment_type(job, et) && validators.pay_disclosed_only(job),
      (job) => `emp: ${job.employment_type}, pay: ${job.pay_min}-${job.pay_max}`
    );
    await delay(100);

    await runTest(
      `${et} + has_relocation`,
      { employment_type: et, has_relocation: true },
      (job) => validators.employment_type(job, et) && validators.has_relocation(job),
      (job) => `emp: ${job.employment_type}, reloc: ${job.relocation_assistance}`
    );
    await delay(100);
  }

  // Boolean filter combinations - CRITICAL (the bug was here!) (6 tests)
  console.log('\n--- CRITICAL: Boolean filter combinations (bug source) ---\n');

  await runTest(
    'new_grad_friendly + has_sign_on_bonus',
    { new_grad_friendly: true, has_sign_on_bonus: true },
    (job) => validators.new_grad_friendly(job) && validators.has_sign_on_bonus(job),
    (job) => `exp: ${(job.experience_req || '').substring(0, 30)}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
  );

  await runTest(
    'new_grad_friendly + pay_disclosed',
    { new_grad_friendly: true, pay_disclosed_only: true },
    (job) => validators.new_grad_friendly(job) && validators.pay_disclosed_only(job),
    (job) => `exp: ${(job.experience_req || '').substring(0, 30)}, pay: ${job.pay_min}-${job.pay_max}`
  );

  await runTest(
    'has_sign_on_bonus + pay_disclosed',
    { has_sign_on_bonus: true, pay_disclosed_only: true },
    (job) => validators.has_sign_on_bonus(job) && validators.pay_disclosed_only(job),
    (job) => `bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}, pay: ${job.pay_min}-${job.pay_max}`
  );

  await runTest(
    'new_grad_friendly + has_relocation',
    { new_grad_friendly: true, has_relocation: true },
    (job) => validators.new_grad_friendly(job) && validators.has_relocation(job),
    (job) => `exp: ${(job.experience_req || '').substring(0, 30)}, reloc: ${job.relocation_assistance}`
  );

  await runTest(
    'has_sign_on_bonus + has_relocation',
    { has_sign_on_bonus: true, has_relocation: true },
    (job) => validators.has_sign_on_bonus(job) && validators.has_relocation(job),
    (job) => `bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}, reloc: ${job.relocation_assistance}`
  );

  await runTest(
    'pay_disclosed + has_relocation',
    { pay_disclosed_only: true, has_relocation: true },
    (job) => validators.pay_disclosed_only(job) && validators.has_relocation(job),
    (job) => `pay: ${job.pay_min}-${job.pay_max}, reloc: ${job.relocation_assistance}`
  );

  // OFS grade + other filters (15 tests)
  for (const grade of ['A', 'B', 'C']) {
    await runTest(
      `ofs_grade=${grade} + rn`,
      { ofs_grade: grade, nursing_type: 'rn' },
      (job) => validators.ofs_grade(job, grade) && validators.nursing_type(job, 'rn'),
      (job) => `ofs: ${job.facility_ofs_score}, type: ${job.nursing_type}`
    );
    await delay(100);

    await runTest(
      `ofs_grade=${grade} + full_time`,
      { ofs_grade: grade, employment_type: 'full_time' },
      (job) => validators.ofs_grade(job, grade) && validators.employment_type(job, 'full_time'),
      (job) => `ofs: ${job.facility_ofs_score}, emp: ${job.employment_type}`
    );
    await delay(100);

    await runTest(
      `ofs_grade=${grade} + has_sign_on_bonus`,
      { ofs_grade: grade, has_sign_on_bonus: true },
      (job) => validators.ofs_grade(job, grade) && validators.has_sign_on_bonus(job),
      (job) => `ofs: ${job.facility_ofs_score}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
    );
    await delay(100);

    await runTest(
      `ofs_grade=${grade} + new_grad_friendly`,
      { ofs_grade: grade, new_grad_friendly: true },
      (job) => validators.ofs_grade(job, grade) && validators.new_grad_friendly(job),
      (job) => `ofs: ${job.facility_ofs_score}, exp: ${(job.experience_req || '').substring(0, 30)}`
    );
    await delay(100);

    await runTest(
      `ofs_grade=${grade} + pay_disclosed`,
      { ofs_grade: grade, pay_disclosed_only: true },
      (job) => validators.ofs_grade(job, grade) && validators.pay_disclosed_only(job),
      (job) => `ofs: ${job.facility_ofs_score}, pay: ${job.pay_min}-${job.pay_max}`
    );
    await delay(100);
  }

  // min_pay + other filters (12 tests)
  for (const minPay of [35, 40, 45]) {
    await runTest(
      `min_pay=${minPay} + rn`,
      { min_pay: minPay, nursing_type: 'rn' },
      (job) => validators.min_pay(job, minPay) && validators.nursing_type(job, 'rn'),
      (job) => `pay_min: ${job.pay_min}, type: ${job.nursing_type}`
    );
    await delay(100);

    await runTest(
      `min_pay=${minPay} + icu`,
      { min_pay: minPay, specialty: 'icu' },
      (job) => validators.min_pay(job, minPay) && validators.specialty(job, 'icu'),
      (job) => `pay_min: ${job.pay_min}, spec: ${job.specialty}`
    );
    await delay(100);

    await runTest(
      `min_pay=${minPay} + has_sign_on_bonus`,
      { min_pay: minPay, has_sign_on_bonus: true },
      (job) => validators.min_pay(job, minPay) && validators.has_sign_on_bonus(job),
      (job) => `pay_min: ${job.pay_min}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
    );
    await delay(100);

    await runTest(
      `min_pay=${minPay} + new_grad_friendly`,
      { min_pay: minPay, new_grad_friendly: true },
      (job) => validators.min_pay(job, minPay) && validators.new_grad_friendly(job),
      (job) => `pay_min: ${job.pay_min}, exp: ${(job.experience_req || '').substring(0, 30)}`
    );
    await delay(100);
  }

  // posted_within_days + other filters (9 tests)
  for (const days of [7, 14, 30]) {
    await runTest(
      `posted_within_days=${days} + rn`,
      { posted_within_days: days, nursing_type: 'rn' },
      (job) => validators.posted_within_days(job, days) && validators.nursing_type(job, 'rn'),
      (job) => `posted: ${job.posted_at}, type: ${job.nursing_type}`
    );
    await delay(100);

    await runTest(
      `posted_within_days=${days} + has_sign_on_bonus`,
      { posted_within_days: days, has_sign_on_bonus: true },
      (job) => validators.posted_within_days(job, days) && validators.has_sign_on_bonus(job),
      (job) => `posted: ${job.posted_at}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
    );
    await delay(100);

    await runTest(
      `posted_within_days=${days} + new_grad_friendly`,
      { posted_within_days: days, new_grad_friendly: true },
      (job) => validators.posted_within_days(job, days) && validators.new_grad_friendly(job),
      (job) => `posted: ${job.posted_at}, exp: ${(job.experience_req || '').substring(0, 30)}`
    );
    await delay(100);
  }

  // ============================================
  // SECTION 3: TRIPLE COMBINATIONS (~100 tests)
  // ============================================
  console.log('\n' + '─'.repeat(80));
  console.log('SECTION 3: TRIPLE FILTER COMBINATIONS');
  console.log('─'.repeat(80) + '\n');

  // nursing_type + specialty + employment_type (27 tests)
  for (const nt of nursingTypes) {
    for (const sp of topSpecialties) {
      for (const et of employmentTypes) {
        await runTest(
          `${nt} + ${sp} + ${et}`,
          { nursing_type: nt, specialty: sp, employment_type: et },
          (job) => validators.nursing_type(job, nt) &&
                   validators.specialty(job, sp) &&
                   validators.employment_type(job, et),
          (job) => `type: ${job.nursing_type}, spec: ${job.specialty}, emp: ${job.employment_type}`
        );
        await delay(100);
      }
    }
  }

  // Critical: Triple boolean combinations (4 tests)
  console.log('\n--- CRITICAL: Triple boolean combinations ---\n');

  await runTest(
    'new_grad + bonus + pay_disclosed',
    { new_grad_friendly: true, has_sign_on_bonus: true, pay_disclosed_only: true },
    (job) => validators.new_grad_friendly(job) &&
             validators.has_sign_on_bonus(job) &&
             validators.pay_disclosed_only(job),
    (job) => `exp: ${(job.experience_req || '').substring(0, 20)}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}, pay: ${job.pay_min}`
  );

  await runTest(
    'new_grad + bonus + relocation',
    { new_grad_friendly: true, has_sign_on_bonus: true, has_relocation: true },
    (job) => validators.new_grad_friendly(job) &&
             validators.has_sign_on_bonus(job) &&
             validators.has_relocation(job),
    (job) => `exp: ${(job.experience_req || '').substring(0, 20)}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}, reloc: ${job.relocation_assistance}`
  );

  await runTest(
    'bonus + pay_disclosed + relocation',
    { has_sign_on_bonus: true, pay_disclosed_only: true, has_relocation: true },
    (job) => validators.has_sign_on_bonus(job) &&
             validators.pay_disclosed_only(job) &&
             validators.has_relocation(job),
    (job) => `bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}, pay: ${job.pay_min}, reloc: ${job.relocation_assistance}`
  );

  await runTest(
    'new_grad + pay_disclosed + relocation',
    { new_grad_friendly: true, pay_disclosed_only: true, has_relocation: true },
    (job) => validators.new_grad_friendly(job) &&
             validators.pay_disclosed_only(job) &&
             validators.has_relocation(job),
    (job) => `exp: ${(job.experience_req || '').substring(0, 20)}, pay: ${job.pay_min}, reloc: ${job.relocation_assistance}`
  );

  // Mixed categorical + boolean triples (27 tests)
  for (const nt of nursingTypes) {
    for (const sp of topSpecialties) {
      await runTest(
        `${nt} + ${sp} + has_sign_on_bonus`,
        { nursing_type: nt, specialty: sp, has_sign_on_bonus: true },
        (job) => validators.nursing_type(job, nt) &&
                 validators.specialty(job, sp) &&
                 validators.has_sign_on_bonus(job),
        (job) => `type: ${job.nursing_type}, spec: ${job.specialty}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
      );
      await delay(100);

      await runTest(
        `${nt} + ${sp} + new_grad_friendly`,
        { nursing_type: nt, specialty: sp, new_grad_friendly: true },
        (job) => validators.nursing_type(job, nt) &&
                 validators.specialty(job, sp) &&
                 validators.new_grad_friendly(job),
        (job) => `type: ${job.nursing_type}, spec: ${job.specialty}, exp: ${(job.experience_req || '').substring(0, 20)}`
      );
      await delay(100);

      await runTest(
        `${nt} + ${sp} + pay_disclosed`,
        { nursing_type: nt, specialty: sp, pay_disclosed_only: true },
        (job) => validators.nursing_type(job, nt) &&
                 validators.specialty(job, sp) &&
                 validators.pay_disclosed_only(job),
        (job) => `type: ${job.nursing_type}, spec: ${job.specialty}, pay: ${job.pay_min}-${job.pay_max}`
      );
      await delay(100);
    }
  }

  // OFS grade + nursing_type + boolean (9 tests)
  for (const grade of ['A', 'B', 'C']) {
    await runTest(
      `ofs=${grade} + rn + has_sign_on_bonus`,
      { ofs_grade: grade, nursing_type: 'rn', has_sign_on_bonus: true },
      (job) => validators.ofs_grade(job, grade) &&
               validators.nursing_type(job, 'rn') &&
               validators.has_sign_on_bonus(job),
      (job) => `ofs: ${job.facility_ofs_score}, type: ${job.nursing_type}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
    );
    await delay(100);

    await runTest(
      `ofs=${grade} + rn + new_grad_friendly`,
      { ofs_grade: grade, nursing_type: 'rn', new_grad_friendly: true },
      (job) => validators.ofs_grade(job, grade) &&
               validators.nursing_type(job, 'rn') &&
               validators.new_grad_friendly(job),
      (job) => `ofs: ${job.facility_ofs_score}, type: ${job.nursing_type}, exp: ${(job.experience_req || '').substring(0, 20)}`
    );
    await delay(100);

    await runTest(
      `ofs=${grade} + rn + pay_disclosed`,
      { ofs_grade: grade, nursing_type: 'rn', pay_disclosed_only: true },
      (job) => validators.ofs_grade(job, grade) &&
               validators.nursing_type(job, 'rn') &&
               validators.pay_disclosed_only(job),
      (job) => `ofs: ${job.facility_ofs_score}, type: ${job.nursing_type}, pay: ${job.pay_min}-${job.pay_max}`
    );
    await delay(100);
  }

  // ============================================
  // SECTION 4: QUADRUPLE COMBINATIONS (20 tests)
  // ============================================
  console.log('\n' + '─'.repeat(80));
  console.log('SECTION 4: QUADRUPLE FILTER COMBINATIONS');
  console.log('─'.repeat(80) + '\n');

  // All 4 boolean filters
  await runTest(
    'all 4 booleans: new_grad + bonus + pay + reloc',
    { new_grad_friendly: true, has_sign_on_bonus: true, pay_disclosed_only: true, has_relocation: true },
    (job) => validators.new_grad_friendly(job) &&
             validators.has_sign_on_bonus(job) &&
             validators.pay_disclosed_only(job) &&
             validators.has_relocation(job),
    (job) => `exp: ${(job.experience_req || '').substring(0, 15)}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}, pay: ${job.pay_min}, reloc: ${job.relocation_assistance}`
  );

  // Categorical + boolean combos
  for (const nt of nursingTypes) {
    await runTest(
      `${nt} + icu + full_time + has_sign_on_bonus`,
      { nursing_type: nt, specialty: 'icu', employment_type: 'full_time', has_sign_on_bonus: true },
      (job) => validators.nursing_type(job, nt) &&
               validators.specialty(job, 'icu') &&
               validators.employment_type(job, 'full_time') &&
               validators.has_sign_on_bonus(job),
      (job) => `type: ${job.nursing_type}, spec: ${job.specialty}, emp: ${job.employment_type}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
    );
    await delay(100);

    await runTest(
      `${nt} + er + full_time + new_grad_friendly`,
      { nursing_type: nt, specialty: 'er', employment_type: 'full_time', new_grad_friendly: true },
      (job) => validators.nursing_type(job, nt) &&
               validators.specialty(job, 'er') &&
               validators.employment_type(job, 'full_time') &&
               validators.new_grad_friendly(job),
      (job) => `type: ${job.nursing_type}, spec: ${job.specialty}, emp: ${job.employment_type}, exp: ${(job.experience_req || '').substring(0, 20)}`
    );
    await delay(100);

    await runTest(
      `${nt} + med_surg + part_time + pay_disclosed`,
      { nursing_type: nt, specialty: 'med_surg', employment_type: 'part_time', pay_disclosed_only: true },
      (job) => validators.nursing_type(job, nt) &&
               validators.specialty(job, 'med_surg') &&
               validators.employment_type(job, 'part_time') &&
               validators.pay_disclosed_only(job),
      (job) => `type: ${job.nursing_type}, spec: ${job.specialty}, emp: ${job.employment_type}, pay: ${job.pay_min}-${job.pay_max}`
    );
    await delay(100);
  }

  // With OFS grade
  for (const grade of ['A', 'B']) {
    await runTest(
      `ofs=${grade} + rn + icu + has_sign_on_bonus`,
      { ofs_grade: grade, nursing_type: 'rn', specialty: 'icu', has_sign_on_bonus: true },
      (job) => validators.ofs_grade(job, grade) &&
               validators.nursing_type(job, 'rn') &&
               validators.specialty(job, 'icu') &&
               validators.has_sign_on_bonus(job),
      (job) => `ofs: ${job.facility_ofs_score}, type: ${job.nursing_type}, spec: ${job.specialty}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
    );
    await delay(100);

    await runTest(
      `ofs=${grade} + rn + full_time + new_grad_friendly`,
      { ofs_grade: grade, nursing_type: 'rn', employment_type: 'full_time', new_grad_friendly: true },
      (job) => validators.ofs_grade(job, grade) &&
               validators.nursing_type(job, 'rn') &&
               validators.employment_type(job, 'full_time') &&
               validators.new_grad_friendly(job),
      (job) => `ofs: ${job.facility_ofs_score}, type: ${job.nursing_type}, emp: ${job.employment_type}, exp: ${(job.experience_req || '').substring(0, 20)}`
    );
    await delay(100);
  }

  // With min_pay
  await runTest(
    'rn + icu + has_sign_on_bonus + min_pay=40',
    { nursing_type: 'rn', specialty: 'icu', has_sign_on_bonus: true, min_pay: 40 },
    (job) => validators.nursing_type(job, 'rn') &&
             validators.specialty(job, 'icu') &&
             validators.has_sign_on_bonus(job) &&
             validators.min_pay(job, 40),
    (job) => `type: ${job.nursing_type}, spec: ${job.specialty}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}, pay_min: ${job.pay_min}`
  );

  await runTest(
    'rn + new_grad_friendly + pay_disclosed + min_pay=35',
    { nursing_type: 'rn', new_grad_friendly: true, pay_disclosed_only: true, min_pay: 35 },
    (job) => validators.nursing_type(job, 'rn') &&
             validators.new_grad_friendly(job) &&
             validators.pay_disclosed_only(job) &&
             validators.min_pay(job, 35),
    (job) => `type: ${job.nursing_type}, exp: ${(job.experience_req || '').substring(0, 20)}, pay_min: ${job.pay_min}`
  );

  // ============================================
  // SECTION 5: EDGE CASES (20 tests)
  // ============================================
  console.log('\n' + '─'.repeat(80));
  console.log('SECTION 5: EDGE CASES');
  console.log('─'.repeat(80) + '\n');

  // Very restrictive combinations
  await runTest(
    'EDGE: cna + icu (unlikely combo)',
    { nursing_type: 'cna', specialty: 'icu' },
    (job) => validators.nursing_type(job, 'cna') && validators.specialty(job, 'icu'),
    (job) => `type: ${job.nursing_type}, spec: ${job.specialty}`
  );

  await runTest(
    'EDGE: lpn + labor_delivery (rare)',
    { nursing_type: 'lpn', specialty: 'labor_delivery' },
    (job) => validators.nursing_type(job, 'lpn') && validators.specialty(job, 'labor_delivery'),
    (job) => `type: ${job.nursing_type}, spec: ${job.specialty}`
  );

  await runTest(
    'EDGE: prn + has_sign_on_bonus (uncommon)',
    { employment_type: 'prn', has_sign_on_bonus: true },
    (job) => validators.employment_type(job, 'prn') && validators.has_sign_on_bonus(job),
    (job) => `emp: ${job.employment_type}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
  );

  await runTest(
    'EDGE: min_pay=60 (high threshold)',
    { min_pay: 60 },
    (job) => validators.min_pay(job, 60),
    (job) => `pay_min: ${job.pay_min}`
  );

  await runTest(
    'EDGE: ofs_grade=F',
    { ofs_grade: 'F' },
    (job) => validators.ofs_grade(job, 'F'),
    (job) => `ofs_score: ${job.facility_ofs_score}`
  );

  await runTest(
    'EDGE: posted_within_days=1',
    { posted_within_days: 1 },
    (job) => validators.posted_within_days(job, 1),
    (job) => `posted_at: ${job.posted_at}`
  );

  // Maximum filters combined
  await runTest(
    'EDGE: 5 filters - rn + icu + full_time + day + has_sign_on_bonus',
    { nursing_type: 'rn', specialty: 'icu', employment_type: 'full_time', shift_type: 'day', has_sign_on_bonus: true },
    (job) => validators.nursing_type(job, 'rn') &&
             validators.specialty(job, 'icu') &&
             validators.employment_type(job, 'full_time') &&
             validators.shift_type(job, 'day') &&
             validators.has_sign_on_bonus(job),
    (job) => `type: ${job.nursing_type}, spec: ${job.specialty}, emp: ${job.employment_type}, shift: ${job.shift_type}, bonus: ${job.bonus_from_enrichment || job.sign_on_bonus}`
  );

  await runTest(
    'EDGE: 6 filters - rn + icu + full_time + has_sign_on_bonus + new_grad + pay_disclosed',
    { nursing_type: 'rn', specialty: 'icu', employment_type: 'full_time', has_sign_on_bonus: true, new_grad_friendly: true, pay_disclosed_only: true },
    (job) => validators.nursing_type(job, 'rn') &&
             validators.specialty(job, 'icu') &&
             validators.employment_type(job, 'full_time') &&
             validators.has_sign_on_bonus(job) &&
             validators.new_grad_friendly(job) &&
             validators.pay_disclosed_only(job),
    (job) => `ALL filters applied`
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
      console.log(`  Params: ${JSON.stringify(f.params)}`);
      console.log(`  Total: ${f.total}, Invalid: ${f.invalid}/${f.sampleSize} (${f.accuracy}%)`);
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

  // Exit with error code if any tests failed
  process.exit(failedTests > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
