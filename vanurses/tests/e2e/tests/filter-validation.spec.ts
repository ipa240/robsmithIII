import { test, expect } from '@playwright/test';

const BASE_URL = 'https://vanurses.net';
const API_URL = `${BASE_URL}/api/jobs`;

interface Job {
  id: string;
  title: string;
  nursing_type: string;
  specialty: string;
  employment_type: string;
  shift_type: string;
  facility_name: string;
  facility_system: string;
  facility_ofs_grade: string;
  sign_on_bonus: number | null;
  bonus_from_enrichment: string | null;
  experience_req: string | null;
  education_req: string | null;
  certifications_req: string | null;
  pay_min: number | null;
  pay_max: number | null;
}

interface ApiResponse {
  success: boolean;
  data: Job[];
  total: number;
}

interface FilterTestResult {
  filter: string;
  params: Record<string, string | boolean>;
  total: number;
  sampleSize: number;
  validCount: number;
  invalidCount: number;
  invalidExamples: string[];
  passed: boolean;
}

const results: FilterTestResult[] = [];

// Helper to fetch jobs with filters
async function fetchJobs(params: Record<string, string | boolean | number>): Promise<ApiResponse> {
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

// Validation functions for each filter type
const validators = {
  nursing_type: (job: Job, expected: string) => {
    const actual = job.nursing_type?.toLowerCase().replace(/[{}]/g, '');
    return actual === expected.toLowerCase();
  },

  specialty: (job: Job, expected: string) => {
    const actual = job.specialty?.toLowerCase().replace(/[{}]/g, '');
    return actual === expected.toLowerCase();
  },

  employment_type: (job: Job, expected: string) => {
    const actual = job.employment_type?.toLowerCase().replace(/[{}]/g, '');
    return actual === expected.toLowerCase();
  },

  shift_type: (job: Job, expected: string) => {
    const actual = job.shift_type?.toLowerCase().replace(/[{}]/g, '');
    return actual === expected.toLowerCase();
  },

  has_sign_on_bonus: (job: Job) => {
    // Must have either sign_on_bonus column > 0 OR bonus_from_enrichment with positive value
    const columnBonus = job.sign_on_bonus && job.sign_on_bonus > 0;
    const enrichmentBonus = job.bonus_from_enrichment &&
      parseInt(job.bonus_from_enrichment) > 0;
    return columnBonus || enrichmentBonus;
  },

  new_grad_friendly: (job: Job) => {
    // Should match title patterns OR experience_req patterns
    const titlePattern = /new.?grad|graduate.?nurse|GN |residency/i;
    const expPattern = /new.?grad|entry.?level|0.?year|no.?experience|graduate.?nurse|GN.?program/i;

    const titleMatch = titlePattern.test(job.title || '');
    const expMatch = expPattern.test(job.experience_req || '');
    return titleMatch || expMatch;
  },

  bsn_required_yes: (job: Job) => {
    const eduPattern = /BSN.*(required|preferred|must)/i;
    return eduPattern.test(job.education_req || '');
  },

  bsn_required_no: (job: Job) => {
    const adnPattern = /(ADN|ASN|Associate).*(accepted|ok|considered)/i;
    const noBsnRequired = !/(BSN.*required)/i.test(job.education_req || '');
    return adnPattern.test(job.education_req || '') || noBsnRequired;
  },

  certification_ACLS: (job: Job) => {
    return /ACLS/i.test(job.certifications_req || '');
  },

  certification_BLS: (job: Job) => {
    return /BLS/i.test(job.certifications_req || '');
  },

  certification_PALS: (job: Job) => {
    return /PALS/i.test(job.certifications_req || '');
  },

  min_pay: (job: Job, minPay: number) => {
    return job.pay_min !== null && job.pay_min >= minPay;
  },

  max_pay: (job: Job, maxPay: number) => {
    return (job.pay_max !== null && job.pay_max <= maxPay) ||
           (job.pay_min !== null && job.pay_min <= maxPay);
  },

  pay_disclosed_only: (job: Job) => {
    return job.pay_min !== null || job.pay_max !== null;
  },
};

// Test individual filters
test.describe('Individual Filter Validation', () => {

  test('nursing_type=rn filter', async () => {
    const response = await fetchJobs({ nursing_type: 'rn' });

    let valid = 0, invalid = 0;
    const invalidExamples: string[] = [];

    for (const job of response.data) {
      if (validators.nursing_type(job, 'rn')) {
        valid++;
      } else {
        invalid++;
        if (invalidExamples.length < 3) {
          invalidExamples.push(`${job.title} (type: ${job.nursing_type})`);
        }
      }
    }

    results.push({
      filter: 'nursing_type=rn',
      params: { nursing_type: 'rn' },
      total: response.total,
      sampleSize: response.data.length,
      validCount: valid,
      invalidCount: invalid,
      invalidExamples,
      passed: invalid === 0
    });

    expect(invalid, `Found ${invalid} jobs with wrong nursing_type`).toBe(0);
  });

  test('nursing_type=lpn filter', async () => {
    const response = await fetchJobs({ nursing_type: 'lpn' });

    let valid = 0, invalid = 0;
    const invalidExamples: string[] = [];

    for (const job of response.data) {
      if (validators.nursing_type(job, 'lpn')) {
        valid++;
      } else {
        invalid++;
        if (invalidExamples.length < 3) {
          invalidExamples.push(`${job.title} (type: ${job.nursing_type})`);
        }
      }
    }

    results.push({
      filter: 'nursing_type=lpn',
      params: { nursing_type: 'lpn' },
      total: response.total,
      sampleSize: response.data.length,
      validCount: valid,
      invalidCount: invalid,
      invalidExamples,
      passed: invalid === 0
    });

    expect(invalid, `Found ${invalid} jobs with wrong nursing_type`).toBe(0);
  });

  test('specialty=icu filter', async () => {
    const response = await fetchJobs({ specialty: 'icu' });

    let valid = 0, invalid = 0;
    const invalidExamples: string[] = [];

    for (const job of response.data) {
      if (validators.specialty(job, 'icu')) {
        valid++;
      } else {
        invalid++;
        if (invalidExamples.length < 3) {
          invalidExamples.push(`${job.title} (specialty: ${job.specialty})`);
        }
      }
    }

    results.push({
      filter: 'specialty=icu',
      params: { specialty: 'icu' },
      total: response.total,
      sampleSize: response.data.length,
      validCount: valid,
      invalidCount: invalid,
      invalidExamples,
      passed: invalid === 0
    });

    expect(invalid, `Found ${invalid} jobs with wrong specialty`).toBe(0);
  });

  test('specialty=er filter', async () => {
    const response = await fetchJobs({ specialty: 'er' });

    let valid = 0, invalid = 0;
    const invalidExamples: string[] = [];

    for (const job of response.data) {
      if (validators.specialty(job, 'er')) {
        valid++;
      } else {
        invalid++;
        if (invalidExamples.length < 3) {
          invalidExamples.push(`${job.title} (specialty: ${job.specialty})`);
        }
      }
    }

    results.push({
      filter: 'specialty=er',
      params: { specialty: 'er' },
      total: response.total,
      sampleSize: response.data.length,
      validCount: valid,
      invalidCount: invalid,
      invalidExamples,
      passed: invalid === 0
    });

    expect(invalid, `Found ${invalid} jobs with wrong specialty`).toBe(0);
  });

  test('employment_type=full_time filter', async () => {
    const response = await fetchJobs({ employment_type: 'full_time' });

    let valid = 0, invalid = 0;
    const invalidExamples: string[] = [];

    for (const job of response.data) {
      if (validators.employment_type(job, 'full_time')) {
        valid++;
      } else {
        invalid++;
        if (invalidExamples.length < 3) {
          invalidExamples.push(`${job.title} (emp_type: ${job.employment_type})`);
        }
      }
    }

    results.push({
      filter: 'employment_type=full_time',
      params: { employment_type: 'full_time' },
      total: response.total,
      sampleSize: response.data.length,
      validCount: valid,
      invalidCount: invalid,
      invalidExamples,
      passed: invalid === 0
    });

    expect(invalid, `Found ${invalid} jobs with wrong employment_type`).toBe(0);
  });

  test('employment_type=part_time filter', async () => {
    const response = await fetchJobs({ employment_type: 'part_time' });

    let valid = 0, invalid = 0;
    const invalidExamples: string[] = [];

    for (const job of response.data) {
      if (validators.employment_type(job, 'part_time')) {
        valid++;
      } else {
        invalid++;
        if (invalidExamples.length < 3) {
          invalidExamples.push(`${job.title} (emp_type: ${job.employment_type})`);
        }
      }
    }

    results.push({
      filter: 'employment_type=part_time',
      params: { employment_type: 'part_time' },
      total: response.total,
      sampleSize: response.data.length,
      validCount: valid,
      invalidCount: invalid,
      invalidExamples,
      passed: invalid === 0
    });

    expect(invalid, `Found ${invalid} jobs with wrong employment_type`).toBe(0);
  });

  test('has_sign_on_bonus filter', async () => {
    const response = await fetchJobs({ has_sign_on_bonus: true });

    let valid = 0, invalid = 0;
    const invalidExamples: string[] = [];

    for (const job of response.data) {
      if (validators.has_sign_on_bonus(job)) {
        valid++;
      } else {
        invalid++;
        if (invalidExamples.length < 3) {
          invalidExamples.push(`${job.title} (bonus: ${job.sign_on_bonus}, enrichment: ${job.bonus_from_enrichment})`);
        }
      }
    }

    results.push({
      filter: 'has_sign_on_bonus=true',
      params: { has_sign_on_bonus: true },
      total: response.total,
      sampleSize: response.data.length,
      validCount: valid,
      invalidCount: invalid,
      invalidExamples,
      passed: invalid === 0
    });

    expect(invalid, `Found ${invalid} jobs without sign-on bonus`).toBe(0);
  });

  test('new_grad_friendly filter', async () => {
    const response = await fetchJobs({ new_grad_friendly: true });

    let valid = 0, invalid = 0;
    const invalidExamples: string[] = [];

    for (const job of response.data) {
      if (validators.new_grad_friendly(job)) {
        valid++;
      } else {
        invalid++;
        if (invalidExamples.length < 3) {
          invalidExamples.push(`${job.title} (exp: ${job.experience_req?.substring(0, 50)}...)`);
        }
      }
    }

    results.push({
      filter: 'new_grad_friendly=true',
      params: { new_grad_friendly: true },
      total: response.total,
      sampleSize: response.data.length,
      validCount: valid,
      invalidCount: invalid,
      invalidExamples,
      passed: invalid === 0
    });

    // Allow some tolerance since enrichment data may have different patterns
    const passRate = valid / response.data.length;
    expect(passRate, `Only ${(passRate * 100).toFixed(1)}% valid`).toBeGreaterThan(0.8);
  });

  test('pay_disclosed_only filter', async () => {
    const response = await fetchJobs({ pay_disclosed_only: true });

    let valid = 0, invalid = 0;
    const invalidExamples: string[] = [];

    for (const job of response.data) {
      if (validators.pay_disclosed_only(job)) {
        valid++;
      } else {
        invalid++;
        if (invalidExamples.length < 3) {
          invalidExamples.push(`${job.title} (pay_min: ${job.pay_min}, pay_max: ${job.pay_max})`);
        }
      }
    }

    results.push({
      filter: 'pay_disclosed_only=true',
      params: { pay_disclosed_only: true },
      total: response.total,
      sampleSize: response.data.length,
      validCount: valid,
      invalidCount: invalid,
      invalidExamples,
      passed: invalid === 0
    });

    expect(invalid, `Found ${invalid} jobs without disclosed pay`).toBe(0);
  });

  test('min_pay=40 filter', async () => {
    const response = await fetchJobs({ min_pay: 40 });

    let valid = 0, invalid = 0;
    const invalidExamples: string[] = [];

    for (const job of response.data) {
      if (validators.min_pay(job, 40)) {
        valid++;
      } else {
        invalid++;
        if (invalidExamples.length < 3) {
          invalidExamples.push(`${job.title} (pay_min: ${job.pay_min})`);
        }
      }
    }

    results.push({
      filter: 'min_pay=40',
      params: { min_pay: 40 },
      total: response.total,
      sampleSize: response.data.length,
      validCount: valid,
      invalidCount: invalid,
      invalidExamples,
      passed: invalid === 0
    });

    expect(invalid, `Found ${invalid} jobs below min pay`).toBe(0);
  });
});

// Test combined filters (the ones that had the bug)
test.describe('Combined Filter Validation', () => {

  test('new_grad_friendly + has_sign_on_bonus', async () => {
    const response = await fetchJobs({
      new_grad_friendly: true,
      has_sign_on_bonus: true
    });

    let bothValid = 0, bonusInvalid = 0, gradInvalid = 0;
    const invalidExamples: string[] = [];

    for (const job of response.data) {
      const hasBonus = validators.has_sign_on_bonus(job);
      const isNewGrad = validators.new_grad_friendly(job);

      if (hasBonus && isNewGrad) {
        bothValid++;
      } else {
        if (!hasBonus) bonusInvalid++;
        if (!isNewGrad) gradInvalid++;
        if (invalidExamples.length < 5) {
          invalidExamples.push(
            `${job.title.substring(0, 40)}... | bonus=${job.bonus_from_enrichment || job.sign_on_bonus} | new_grad=${isNewGrad}`
          );
        }
      }
    }

    results.push({
      filter: 'new_grad_friendly + has_sign_on_bonus',
      params: { new_grad_friendly: true, has_sign_on_bonus: true },
      total: response.total,
      sampleSize: response.data.length,
      validCount: bothValid,
      invalidCount: bonusInvalid + gradInvalid,
      invalidExamples,
      passed: bonusInvalid === 0 // Main concern is bonus filter
    });

    console.log(`\n=== new_grad + sign_on_bonus Results ===`);
    console.log(`Total: ${response.total}`);
    console.log(`Both valid: ${bothValid}`);
    console.log(`Missing bonus: ${bonusInvalid}`);
    console.log(`Not new grad pattern: ${gradInvalid}`);

    // CRITICAL: No jobs should be missing bonus when has_sign_on_bonus=true
    expect(bonusInvalid, `Found ${bonusInvalid} jobs without bonus`).toBe(0);
  });

  test('rn + icu + full_time', async () => {
    const response = await fetchJobs({
      nursing_type: 'rn',
      specialty: 'icu',
      employment_type: 'full_time'
    });

    let allValid = 0, invalid = 0;
    const invalidExamples: string[] = [];

    for (const job of response.data) {
      const isRn = validators.nursing_type(job, 'rn');
      const isIcu = validators.specialty(job, 'icu');
      const isFullTime = validators.employment_type(job, 'full_time');

      if (isRn && isIcu && isFullTime) {
        allValid++;
      } else {
        invalid++;
        if (invalidExamples.length < 3) {
          invalidExamples.push(
            `${job.title} | rn=${isRn} icu=${isIcu} ft=${isFullTime}`
          );
        }
      }
    }

    results.push({
      filter: 'rn + icu + full_time',
      params: { nursing_type: 'rn', specialty: 'icu', employment_type: 'full_time' },
      total: response.total,
      sampleSize: response.data.length,
      validCount: allValid,
      invalidCount: invalid,
      invalidExamples,
      passed: invalid === 0
    });

    expect(invalid, `Found ${invalid} jobs not matching all filters`).toBe(0);
  });

  test('rn + has_sign_on_bonus + pay_disclosed_only', async () => {
    const response = await fetchJobs({
      nursing_type: 'rn',
      has_sign_on_bonus: true,
      pay_disclosed_only: true
    });

    let allValid = 0, invalid = 0;
    const invalidExamples: string[] = [];

    for (const job of response.data) {
      const isRn = validators.nursing_type(job, 'rn');
      const hasBonus = validators.has_sign_on_bonus(job);
      const hasPay = validators.pay_disclosed_only(job);

      if (isRn && hasBonus && hasPay) {
        allValid++;
      } else {
        invalid++;
        if (invalidExamples.length < 3) {
          invalidExamples.push(
            `${job.title} | rn=${isRn} bonus=${hasBonus} pay=${hasPay}`
          );
        }
      }
    }

    results.push({
      filter: 'rn + sign_on_bonus + pay_disclosed',
      params: { nursing_type: 'rn', has_sign_on_bonus: true, pay_disclosed_only: true },
      total: response.total,
      sampleSize: response.data.length,
      validCount: allValid,
      invalidCount: invalid,
      invalidExamples,
      passed: invalid === 0
    });

    expect(invalid, `Found ${invalid} jobs not matching all filters`).toBe(0);
  });

  test('new_grad_friendly + specialty=med_surg', async () => {
    const response = await fetchJobs({
      new_grad_friendly: true,
      specialty: 'med_surg'
    });

    let allValid = 0, invalid = 0;
    const invalidExamples: string[] = [];

    for (const job of response.data) {
      const isNewGrad = validators.new_grad_friendly(job);
      const isMedSurg = validators.specialty(job, 'med_surg');

      if (isNewGrad && isMedSurg) {
        allValid++;
      } else {
        invalid++;
        if (invalidExamples.length < 3) {
          invalidExamples.push(
            `${job.title} | new_grad=${isNewGrad} med_surg=${isMedSurg} (actual: ${job.specialty})`
          );
        }
      }
    }

    results.push({
      filter: 'new_grad + med_surg',
      params: { new_grad_friendly: true, specialty: 'med_surg' },
      total: response.total,
      sampleSize: response.data.length,
      validCount: allValid,
      invalidCount: invalid,
      invalidExamples,
      passed: invalid === 0
    });

    // Specialty filter must be exact
    const specialtyMismatch = response.data.filter(j => !validators.specialty(j, 'med_surg')).length;
    expect(specialtyMismatch, `Found ${specialtyMismatch} jobs with wrong specialty`).toBe(0);
  });

  test('lpn + part_time + has_sign_on_bonus', async () => {
    const response = await fetchJobs({
      nursing_type: 'lpn',
      employment_type: 'part_time',
      has_sign_on_bonus: true
    });

    let allValid = 0, invalid = 0;
    const invalidExamples: string[] = [];

    for (const job of response.data) {
      const isLpn = validators.nursing_type(job, 'lpn');
      const isPartTime = validators.employment_type(job, 'part_time');
      const hasBonus = validators.has_sign_on_bonus(job);

      if (isLpn && isPartTime && hasBonus) {
        allValid++;
      } else {
        invalid++;
        if (invalidExamples.length < 3) {
          invalidExamples.push(
            `${job.title} | lpn=${isLpn} pt=${isPartTime} bonus=${hasBonus}`
          );
        }
      }
    }

    results.push({
      filter: 'lpn + part_time + sign_on_bonus',
      params: { nursing_type: 'lpn', employment_type: 'part_time', has_sign_on_bonus: true },
      total: response.total,
      sampleSize: response.data.length,
      validCount: allValid,
      invalidCount: invalid,
      invalidExamples,
      passed: invalid === 0
    });

    if (response.total > 0) {
      expect(invalid, `Found ${invalid} jobs not matching all filters`).toBe(0);
    }
  });
});

// Print summary at the end
test.afterAll(() => {
  console.log('\n' + '='.repeat(80));
  console.log('                        FILTER VALIDATION SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`Passed: ${passed.length}`);
  console.log(`Failed: ${failed.length}`);

  console.log('\n--- DETAILED RESULTS ---\n');

  for (const result of results) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    const accuracy = result.sampleSize > 0
      ? ((result.validCount / result.sampleSize) * 100).toFixed(1)
      : 'N/A';

    console.log(`${status} | ${result.filter}`);
    console.log(`       Total: ${result.total} | Sample: ${result.sampleSize} | Valid: ${result.validCount} | Invalid: ${result.invalidCount} | Accuracy: ${accuracy}%`);

    if (result.invalidExamples.length > 0) {
      console.log(`       Examples of invalid:`);
      for (const ex of result.invalidExamples) {
        console.log(`         - ${ex}`);
      }
    }
    console.log('');
  }

  if (failed.length > 0) {
    console.log('\n--- FAILED TESTS ---');
    for (const f of failed) {
      console.log(`\n${f.filter}:`);
      console.log(`  ${f.invalidCount} invalid out of ${f.sampleSize}`);
      for (const ex of f.invalidExamples) {
        console.log(`    - ${ex}`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
});
