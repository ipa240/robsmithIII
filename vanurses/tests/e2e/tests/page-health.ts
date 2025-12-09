import { Page } from '@playwright/test';

export interface PageHealthReport {
  url: string;
  consoleErrors: string[];
  brokenImages: string[];
  emptyTextElements: string[];
  layoutIssues: string[];
  passed: boolean;
}

export async function checkPageHealth(page: Page): Promise<PageHealthReport> {
  const report: PageHealthReport = {
    url: page.url(),
    consoleErrors: [],
    brokenImages: [],
    emptyTextElements: [],
    layoutIssues: [],
    passed: true,
  };

  // 1. Check for broken images
  const images = await page.locator('img').all();
  for (const img of images) {
    const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
    if (naturalWidth === 0) {
      const src = await img.getAttribute('src');
      if (src && !src.includes('data:')) {
        report.brokenImages.push(src);
        report.passed = false;
      }
    }
  }

  // 2. Check for empty/malformed text
  const textElements = await page.locator('h1, h2, h3, h4, p, span, button, a').all();
  for (const el of textElements) {
    try {
      const text = await el.textContent();
      const isVisible = await el.isVisible();
      if (isVisible && text) {
        // Check for undefined/null/NaN appearing as text
        if (text.includes('undefined') || text.includes('null') || text.includes('NaN')) {
          const tagName = await el.evaluate(e => e.tagName);
          report.emptyTextElements.push(`${tagName}: "${text.slice(0, 50)}"`);
          report.passed = false;
        }
        // Check for unrendered template variables
        if (text.includes('{{') || text.includes('${')) {
          report.emptyTextElements.push(`Unrendered template: ${text.slice(0, 50)}`);
          report.passed = false;
        }
      }
    } catch {
      // Element may have been removed from DOM
    }
  }

  // 3. Check for overflow/layout issues
  const overflowElements = await page.evaluate(() => {
    const issues: string[] = [];
    document.querySelectorAll('*').forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.right > window.innerWidth + 10) {
        issues.push(`Horizontal overflow: ${el.tagName}.${el.className}`);
      }
    });
    return issues.slice(0, 5); // Limit to first 5 issues
  });
  report.layoutIssues = overflowElements;

  if (report.consoleErrors.length > 0 || report.brokenImages.length > 0) {
    report.passed = false;
  }

  return report;
}

// Helper to capture console errors
export function setupConsoleErrorCapture(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}
