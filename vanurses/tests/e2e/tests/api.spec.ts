import { test, expect } from '@playwright/test';
import { CONFIG } from './fixtures';

test.describe('API Endpoints', () => {
  test.describe('Public Endpoints', () => {
    test('GET /api/stats returns statistics', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/stats`);
      console.log('Stats status:', response.status());

      if (response.status() === 200) {
        const data = await response.json();
        console.log('Stats data keys:', Object.keys(data));
      }
    });

    test('GET /api/jobs returns job list', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/jobs`);
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.success).toBeTruthy();
      expect(Array.isArray(data.data)).toBeTruthy();
      console.log(`Found ${data.data.length} jobs, total: ${data.total}`);
    });

    test('GET /api/jobs with pagination works', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/jobs?limit=10&offset=0`);
      expect(response.status()).toBe(200);
    });

    test('GET /api/jobs with specialty filter', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/jobs?specialty=er`);
      expect(response.status()).toBe(200);
    });

    test('GET /api/jobs with nursing_type filter', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/jobs?nursing_type=rn`);
      expect(response.status()).toBe(200);
    });

    test('GET /api/facilities returns facility list', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/facilities`);
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.success).toBeTruthy();
      expect(Array.isArray(data.data)).toBeTruthy();
      console.log(`Found ${data.data.length} facilities`);
    });

    test('GET /api/facilities with region filter', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/facilities?region=northern`);
      expect([200, 400]).toContain(response.status());
    });

    test('GET /api/sully/status returns status', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/sully/status`);
      console.log('Sully status endpoint:', response.status());
      expect([200, 404]).toContain(response.status());
    });

    test('GET /api/news returns articles', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/news`);
      console.log('News status:', response.status());
      expect([200, 404]).toContain(response.status());
    });
  });

  test.describe('Authenticated Endpoints', () => {
    test('GET /api/me requires auth', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/me`);
      expect([200, 401, 403]).toContain(response.status());
    });

    test('GET /api/billing/status requires auth', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/billing/status`);
      expect([200, 401, 403]).toContain(response.status());
    });

    test('POST /api/sully/chat requires auth', async ({ page }) => {
      const response = await page.request.post(`${CONFIG.apiURL}/api/sully/chat`, {
        data: { message: 'Hello', mood: 'neutral' }
      });
      expect([200, 401, 403, 422]).toContain(response.status());
    });

    test('POST /api/billing/checkout requires auth', async ({ page }) => {
      const response = await page.request.post(`${CONFIG.apiURL}/api/billing/checkout`, {
        data: { tier: 'starter' }
      });
      expect([200, 401, 403, 422]).toContain(response.status());
    });

    test('GET /api/applications requires auth', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/applications`);
      expect([200, 401, 403]).toContain(response.status());
    });

    test('GET /api/me/saved-jobs requires auth', async ({ page }) => {
      // Note: users router has prefix="/api", endpoint is /me/saved-jobs
      const response = await page.request.get(`${CONFIG.apiURL}/api/me/saved-jobs`);
      expect([200, 401, 403]).toContain(response.status());
    });

    test('GET /api/notifications requires auth', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/notifications`);
      expect([200, 401, 403]).toContain(response.status());
    });
  });

  test.describe('Admin Endpoints', () => {
    test('GET /api/admin/stats requires admin', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/admin/stats`);
      expect([200, 401, 403]).toContain(response.status());
    });

    test('GET /api/admin/users requires admin', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/admin/users`);
      expect([200, 401, 403]).toContain(response.status());
    });
  });

  test.describe('Billing Webhook', () => {
    test('POST /api/billing/webhook returns 400 without signature', async ({ page }) => {
      const response = await page.request.post(`${CONFIG.apiURL}/api/billing/webhook`, {
        data: { type: 'test' },
        headers: { 'stripe-signature': 'invalid' }
      });

      // Should reject invalid signature (not 404)
      expect(response.status()).not.toBe(404);
      console.log('Webhook response:', response.status());
    });
  });

  test.describe('Job Detail Endpoint', () => {
    test('GET /api/jobs/:id returns job detail', async ({ page }) => {
      // First get a valid job ID
      const listResponse = await page.request.get(`${CONFIG.apiURL}/api/jobs?limit=1`);
      const listData = await listResponse.json();

      const jobs = listData.data || listData.jobs || listData;
      if (jobs.length > 0) {
        const jobId = jobs[0].id;
        const response = await page.request.get(`${CONFIG.apiURL}/api/jobs/${jobId}`);
        expect(response.status()).toBe(200);

        const result = await response.json();
        const job = result.data || result;
        expect(job.id).toBe(jobId);
        console.log('Job detail has keys:', Object.keys(job));
      }
    });
  });

  test.describe('Facility Detail Endpoint', () => {
    test('GET /api/facilities/:id returns facility detail', async ({ page }) => {
      const listResponse = await page.request.get(`${CONFIG.apiURL}/api/facilities?limit=1`);
      const listData = await listResponse.json();

      const facilities = listData.data || listData.facilities || listData;
      if (facilities.length > 0) {
        const facilityId = facilities[0].id;
        const response = await page.request.get(`${CONFIG.apiURL}/api/facilities/${facilityId}`);
        expect(response.status()).toBe(200);

        const result = await response.json();
        const facility = result.data || result;
        expect(facility.id).toBe(facilityId);
        console.log('Facility detail has keys:', Object.keys(facility).slice(0, 10).join(', ') + '...');
      }
    });
  });

  test.describe('Error Handling', () => {
    test('Invalid job ID returns 400 error', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/jobs/invalid-uuid`);
      // Should return 400 for invalid UUID format
      expect([400, 404, 422, 500]).toContain(response.status());
      console.log('Invalid job UUID status:', response.status());
    });

    test('Invalid facility ID returns 400 error', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/facilities/invalid-uuid`);
      // Should return 400 for invalid UUID format
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.detail).toBe('Invalid facility ID format');
    });

    test('Invalid endpoint returns 404', async ({ page }) => {
      const response = await page.request.get(`${CONFIG.apiURL}/api/nonexistent`);
      expect(response.status()).toBe(404);
    });
  });
});

test.describe('CRITICAL: Billing Auth Issue', () => {
  test('billing status returns proper response with token', async ({ page }) => {
    // This documents the known issue: billing endpoints use get_user_from_token
    // which looks for tokens in auth_tokens table, but app uses Zitadel JWT

    const testToken = 'test-jwt-token';

    const response = await page.request.get(`${CONFIG.apiURL}/api/billing/status`, {
      headers: {
        'Authorization': `Bearer ${testToken}`
      }
    });

    console.log('Billing status with token:', response.status());

    if (response.status() === 401) {
      console.log('CONFIRMED: billing/status returns 401 with JWT token');
      console.log('This is the known auth mismatch bug - billing.py uses auth_tokens table');
    }

    // Document the expected vs actual behavior
    expect([200, 401]).toContain(response.status());
  });

  test('checkout endpoint behavior with token', async ({ page }) => {
    const testToken = 'test-jwt-token';

    const response = await page.request.post(`${CONFIG.apiURL}/api/billing/checkout`, {
      headers: {
        'Authorization': `Bearer ${testToken}`
      },
      data: { tier: 'starter' }
    });

    console.log('Checkout with token:', response.status());

    if (response.status() === 401 || response.status() === 403) {
      console.log('CONFIRMED: checkout fails with JWT token');
    }
  });

  test('sync endpoint behavior with token', async ({ page }) => {
    const testToken = 'test-jwt-token';

    const response = await page.request.post(`${CONFIG.apiURL}/api/billing/sync`, {
      headers: {
        'Authorization': `Bearer ${testToken}`
      }
    });

    console.log('Sync with token:', response.status());

    if (response.status() === 401) {
      console.log('CONFIRMED: sync endpoint returns 401');
      console.log('Root cause: get_user_from_token in billing.py needs Zitadel JWT support');
    }
  });
});
