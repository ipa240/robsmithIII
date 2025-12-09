import { test as base, expect, Page } from '@playwright/test';

// Test configuration
export const CONFIG = {
  baseURL: process.env.BASE_URL || 'https://vanurses.net',
  apiURL: process.env.API_URL || 'http://192.168.0.150:5011',
  testUser: {
    email: process.env.TEST_EMAIL || 'ian@allitsystems.com',
    password: process.env.TEST_PASSWORD || 'GobbleGort7$!',
  },
};

// Custom test fixture with helpers
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Override goto to auto-handle onboarding
    const originalGoto = page.goto.bind(page);
    page.goto = async (url: string, options?: any) => {
      const result = await originalGoto(url, options);
      await page.waitForLoadState('networkidle').catch(() => {});
      await skipOnboardingIfPresent(page);
      return result;
    };
    await use(page);
  },
});

// Helper function to skip onboarding if it appears
export async function skipOnboardingIfPresent(page: Page, targetUrl?: string): Promise<boolean> {
  // Check if we're on onboarding page or if onboarding modal appears
  const onboardingText = page.locator('text=Welcome to VANurses');
  const isOnboarding = await onboardingText.isVisible({ timeout: 2000 }).catch(() => false);

  if (!isOnboarding) {
    return false; // Not on onboarding
  }

  console.log('Onboarding detected - completing quickly...');

  // Quick complete onboarding by clicking through
  for (let step = 1; step <= 7; step++) {
    const nextBtn = page.locator('button:has-text("Next"), button:has-text("Continue")').first();

    // Try to select any option on the page first
    const option = page.locator('button[class*="border"]:not([disabled])').first();
    if (await option.isVisible({ timeout: 500 }).catch(() => false)) {
      await option.click().catch(() => {});
      await page.waitForTimeout(200);
    }

    // Click next/continue
    if (await nextBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nextBtn.click().catch(() => {});
      await page.waitForTimeout(500);
    } else {
      break;
    }
  }

  // Wait for redirect to complete
  await page.waitForLoadState('networkidle').catch(() => {});

  // If we had a target URL, navigate back to it now that onboarding is done
  if (targetUrl && !page.url().includes(targetUrl.replace('/', ''))) {
    console.log(`Navigating to intended page: ${targetUrl}`);
    await page.goto(targetUrl);
    await page.waitForLoadState('networkidle').catch(() => {});
  }

  return true;
}

// Helper function to navigate and wait with auto-onboarding skip
export async function gotoAndWait(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  // Auto-skip onboarding if it appears, and navigate back to target if needed
  await skipOnboardingIfPresent(page, url);
}

// Legacy wrapper for backward compatibility - tries to extract URL from goto before waitForPageLoad
export async function waitForPageLoad(page: Page, targetUrl?: string) {
  await page.waitForLoadState('networkidle');
  // Auto-skip onboarding if it appears
  // If targetUrl provided, use it; otherwise just skip onboarding without re-navigation
  if (targetUrl && !targetUrl.includes('onboarding')) {
    await skipOnboardingIfPresent(page, targetUrl);
  } else {
    // Just skip onboarding, let it go to dashboard - most tests can handle this
    await skipOnboardingIfPresent(page);
  }
}

export async function waitForAPI(page: Page, endpoint: string, timeout = 10000) {
  return page.waitForResponse(
    (response) => response.url().includes(endpoint),
    { timeout }
  );
}

export async function captureFailure(page: Page, testName: string) {
  await page.screenshot({ path: `playwright/screenshots/${testName}.png`, fullPage: true });
}

// API testing helpers
export async function fetchAPI(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${CONFIG.apiURL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  return response;
}

// Check if element exists and is visible
export async function isVisible(page: Page, selector: string, timeout = 5000): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

// Check element text content
export async function hasText(page: Page, selector: string, text: string): Promise<boolean> {
  const element = page.locator(selector);
  const content = await element.textContent();
  return content?.includes(text) ?? false;
}

// Scroll to element
export async function scrollToElement(page: Page, selector: string) {
  await page.locator(selector).scrollIntoViewIfNeeded();
}

// Click and wait for navigation
export async function clickAndWait(page: Page, selector: string) {
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click(selector),
  ]);
}

// Fill form field
export async function fillField(page: Page, selector: string, value: string) {
  await page.fill(selector, value);
}

// Select dropdown option
export async function selectOption(page: Page, selector: string, value: string) {
  await page.selectOption(selector, value);
}

// Check button is clickable
export async function isButtonClickable(page: Page, selector: string): Promise<boolean> {
  const button = page.locator(selector);
  const isEnabled = await button.isEnabled();
  const isVisible = await button.isVisible();
  return isEnabled && isVisible;
}

// Wait for toast/notification
export async function waitForToast(page: Page, text?: string, timeout = 5000) {
  const toastSelector = '[role="alert"], .toast, .notification';
  await page.waitForSelector(toastSelector, { timeout });
  if (text) {
    await expect(page.locator(toastSelector)).toContainText(text);
  }
}

// Test data
export const TEST_DATA = {
  facilities: {
    sampleId: '00000000-0000-0000-0000-000000000001',
    searchTerm: 'Medical Center',
  },
  jobs: {
    sampleId: '00000000-0000-0000-0000-000000000001',
    searchTerm: 'RN',
  },
};

// Export expect for convenience
export { expect };
