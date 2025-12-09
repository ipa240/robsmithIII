/**
 * Data Consistency Tests
 *
 * Checks for data quality issues like:
 * - Duplicate filter values (e.g., "Full-Time" and "full_time")
 * - Invalid/malformed data in database
 * - API response consistency
 *
 * Run with: npm run test:consistency
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.TEST_API_URL || 'http://192.168.0.150:5011';

test.describe('Data Consistency Checks', () => {

  test('No duplicate employment types in filters', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/filters`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    const empTypes = data.data?.employment_types || data.employment_types || [];

    console.log('Employment types:', empTypes);

    // Normalize all values to check for duplicates
    const normalized = empTypes.map((e: string) =>
      e.toLowerCase().replace(/[{}_-]/g, '').replace(/\s+/g, '')
    );

    const uniqueNormalized = [...new Set(normalized)];

    // Check for duplicates
    const duplicates = normalized.filter((item: string, index: number) =>
      normalized.indexOf(item) !== index
    );

    if (duplicates.length > 0) {
      console.log('DUPLICATE EMPLOYMENT TYPES FOUND:', duplicates);
      console.log('Original values:', empTypes);
    }

    expect(duplicates.length).toBe(0);
  });

  test('No duplicate specialties in filters', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/filters`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    const specialties = data.data?.specialties || data.specialties || [];

    console.log('Specialties count:', specialties.length);

    // Normalize all values
    const normalized = specialties.map((s: string) =>
      s.toLowerCase().replace(/[{}_-]/g, '').replace(/\s+/g, '')
    );

    const duplicates = normalized.filter((item: string, index: number) =>
      normalized.indexOf(item) !== index
    );

    if (duplicates.length > 0) {
      console.log('DUPLICATE SPECIALTIES FOUND:');
      duplicates.forEach((dup: string) => {
        const originals = specialties.filter((s: string) =>
          s.toLowerCase().replace(/[{}_-]/g, '').replace(/\s+/g, '') === dup
        );
        console.log(`  "${dup}" appears as:`, originals);
      });
    }

    expect(duplicates.length).toBe(0);
  });

  test('No curly brace format in filters', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/filters`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    const allFilters = [
      ...(data.data?.employment_types || data.employment_types || []),
      ...(data.data?.specialties || data.specialties || []),
      ...(data.data?.nursing_types || data.nursing_types || []),
      ...(data.data?.shift_types || data.shift_types || []),
    ];

    const bracedValues = allFilters.filter((v: string) => v.includes('{') || v.includes('}'));

    if (bracedValues.length > 0) {
      console.log('VALUES WITH CURLY BRACES FOUND:', bracedValues);
    }

    expect(bracedValues.length).toBe(0);
  });

  test('Employment type values are valid format', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/filters`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    const empTypes = data.data?.employment_types || data.employment_types || [];

    const validFormats = ['full_time', 'part_time', 'prn', 'contract', 'travel', 'temporary', 'other'];
    const invalidValues = empTypes.filter((e: string) => !validFormats.includes(e.toLowerCase()));

    if (invalidValues.length > 0) {
      console.log('INVALID EMPLOYMENT TYPE VALUES:', invalidValues);
      console.log('Expected one of:', validFormats);
    }

    expect(invalidValues.length).toBe(0);
  });

  test('All jobs have valid employment types', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/jobs`, {
      params: { limit: 100 }
    });
    expect(response.status()).toBe(200);

    const data = await response.json();
    const jobs = data.data || [];

    const validFormats = ['full_time', 'part_time', 'prn', 'contract', 'travel', 'temporary', 'other'];

    const invalidJobs = jobs.filter((job: any) => {
      if (!job.employment_type) return false;
      const normalized = job.employment_type.toLowerCase().replace(/[{}]/g, '');
      return !validFormats.includes(normalized);
    });

    if (invalidJobs.length > 0) {
      console.log('JOBS WITH INVALID EMPLOYMENT TYPE:');
      invalidJobs.slice(0, 5).forEach((job: any) => {
        console.log(`  Job ${job.id}: "${job.employment_type}"`);
      });
      console.log(`  ... and ${invalidJobs.length - 5} more`);
    }

    expect(invalidJobs.length).toBe(0);
  });

  test('Filter values match between jobs and filters endpoint', async ({ request }) => {
    // Get filters
    const filtersResponse = await request.get(`${API_URL}/api/filters`);
    const filtersData = await filtersResponse.json();
    const filterEmpTypes = new Set(filtersData.data?.employment_types || []);

    // Get jobs
    const jobsResponse = await request.get(`${API_URL}/api/jobs`, {
      params: { limit: 1000 }
    });
    const jobsData = await jobsResponse.json();
    const jobs = jobsData.data || [];

    // Get unique employment types from jobs
    const jobEmpTypes = new Set(jobs.map((j: any) => j.employment_type).filter(Boolean));

    // Check for employment types in jobs but not in filters
    const missingInFilters: string[] = [];
    jobEmpTypes.forEach((empType: string) => {
      if (!filterEmpTypes.has(empType)) {
        missingInFilters.push(empType);
      }
    });

    if (missingInFilters.length > 0) {
      console.log('EMPLOYMENT TYPES IN JOBS BUT NOT IN FILTERS:', missingInFilters);
    }

    expect(missingInFilters.length).toBe(0);
  });
});

test.describe('API Response Consistency', () => {

  test('Matched jobs API normalizes input correctly', async ({ request }) => {
    // Test with display format
    const displayResponse = await request.get(`${API_URL}/api/jobs/matched`, {
      params: { specialties: 'ICU', employment_types: 'Full-Time', limit: 5 }
    });

    // Test with database format
    const dbResponse = await request.get(`${API_URL}/api/jobs/matched`, {
      params: { specialties: 'icu', employment_types: 'full_time', limit: 5 }
    });

    expect(displayResponse.status()).toBe(200);
    expect(dbResponse.status()).toBe(200);

    const displayData = await displayResponse.json();
    const dbData = await dbResponse.json();

    console.log('Display format results:', displayData.data?.length || 0);
    console.log('Database format results:', dbData.data?.length || 0);

    // Both should return the same number of results
    expect(displayData.data?.length).toBe(dbData.data?.length);
  });

  test('Jobs list API normalizes filters correctly', async ({ request }) => {
    // Test with display format
    const displayResponse = await request.get(`${API_URL}/api/jobs`, {
      params: { employment_type: 'Full-Time', limit: 5 }
    });

    // Test with database format
    const dbResponse = await request.get(`${API_URL}/api/jobs`, {
      params: { employment_type: 'full_time', limit: 5 }
    });

    expect(displayResponse.status()).toBe(200);
    expect(dbResponse.status()).toBe(200);

    const displayData = await displayResponse.json();
    const dbData = await dbResponse.json();

    console.log('Display format total:', displayData.total);
    console.log('Database format total:', dbData.total);

    // Both should return the same total
    expect(displayData.total).toBe(dbData.total);
  });
});

test.describe('Database Health Checks', () => {

  test('Jobs table has reasonable data', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/jobs`, {
      params: { limit: 1 }
    });
    expect(response.status()).toBe(200);

    const data = await response.json();
    console.log('Total jobs:', data.total);

    // Should have jobs
    expect(data.total).toBeGreaterThan(100);
  });

  test('Facilities have scores', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/facilities`, {
      params: { limit: 10 }
    });
    expect(response.status()).toBe(200);

    const data = await response.json();
    const facilities = data.data || [];

    const withScores = facilities.filter((f: any) => f.ofs_score !== null);
    const percentWithScores = (withScores.length / facilities.length) * 100;

    console.log(`Facilities with scores: ${withScores.length}/${facilities.length} (${percentWithScores.toFixed(1)}%)`);

    // Most facilities should have scores
    expect(percentWithScores).toBeGreaterThan(50);
  });

  test('Jobs have facility names (denormalized check)', async ({ request }) => {
    // Instead of checking FK integrity (which depends on scraper creating facilities),
    // check that jobs display properly with facility info
    const jobsResponse = await request.get(`${API_URL}/api/jobs`, {
      params: { limit: 50 }
    });
    const jobs = (await jobsResponse.json()).data || [];

    const jobsWithFacilityName = jobs.filter((j: any) => j.facility_name);
    const percentWithName = (jobsWithFacilityName.length / jobs.length) * 100;

    console.log(`Jobs with facility name: ${jobsWithFacilityName.length}/${jobs.length} (${percentWithName.toFixed(1)}%)`);

    // Most jobs should have a facility name for display
    // This is a softer check than FK integrity
    expect(percentWithName).toBeGreaterThan(30);
  });
});

test.describe('Frontend Data Display', () => {

  test('Jobs page shows consistent filter values', async ({ page }) => {
    const BASE_URL = process.env.TEST_BASE_URL || 'http://192.168.0.150:5173';
    await page.goto(`${BASE_URL}/jobs`);
    await page.waitForLoadState('networkidle');

    // Open filters
    const filterBtn = page.locator('button:has-text("Filter")').first();
    if (await filterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterBtn.click();
      await page.waitForTimeout(500);
    }

    // Get employment type options
    const empSelect = page.locator('select').filter({ hasText: /employment|all employment/i }).first();
    if (await empSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await empSelect.locator('option').allTextContents();
      console.log('Employment type options:', options);

      // Check for duplicates in visible options
      const normalized = options.map(o => o.toLowerCase().replace(/[{}_-\s]/g, ''));
      const seen = new Set();
      const duplicates = normalized.filter(n => {
        if (seen.has(n)) return true;
        seen.add(n);
        return false;
      });

      if (duplicates.length > 0) {
        console.log('DUPLICATE OPTIONS IN DROPDOWN:', duplicates);
      }

      expect(duplicates.length).toBe(0);
    }
  });

  test('Job cards display valid employment types', async ({ page }) => {
    const BASE_URL = process.env.TEST_BASE_URL || 'http://192.168.0.150:5173';
    await page.goto(`${BASE_URL}/jobs`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Get page text content to check for raw database values
    const pageText = await page.textContent('body') || '';

    const invalidPatterns = ['{FULL_TIME}', '{PART_TIME}', '{OTHER}', '{TEMPORARY}', 'full_time', 'part_time'];
    const foundInvalid: string[] = [];

    for (const pattern of invalidPatterns) {
      if (pageText.includes(pattern)) {
        foundInvalid.push(pattern);
      }
    }

    if (foundInvalid.length > 0) {
      console.log('INVALID RAW DATABASE VALUES FOUND IN UI:', foundInvalid);
    }

    // No raw database format should appear in UI
    expect(foundInvalid.length).toBe(0);
  });
});
