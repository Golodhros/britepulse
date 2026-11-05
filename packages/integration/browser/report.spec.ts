import { test, expect } from '@playwright/test';
import type { ReportDocument } from '../../britepulse/src/report-data.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const source = resolve('.artifacts/consumers/vite-react/comparison-report.html');
const directory = resolve('.artifacts/browser-reports');

async function variant(name: string, edit: (value: ReportDocument) => void): Promise<string> {
  const html = await readFile(source, 'utf8');
  const pattern =
    /(<script id="britepulse-report-data" type="application\/json">)(.*?)(<\/script>)/s;
  const match = html.match(pattern)!;
  const data = JSON.parse(match[2]!) as ReportDocument;
  edit(data);
  const json = JSON.stringify(data).replaceAll('<', '\\u003c');
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${name}.html`);
  await writeFile(
    path,
    html.replace(pattern, () => `${match[1]}${json}${match[3]}`),
  );

  return pathToFileURL(path).href;
}

test('standalone file renders real bundle comparison, filters, chart and narrow layout', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(pathToFileURL(source).href);
  await expect(page.getByText('Compatible profiles', { exact: true })).toBeVisible();
  await page.getByLabel('Measurement').selectOption({ label: 'JS emittedBytes (bytes)' });
  await expect(page.locator('svg').first()).toBeVisible();
  await expect(page.getByText('same-release-label', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Sample report', { exact: true })).toHaveCount(0);
  await page.getByLabel('Subject', { exact: true }).selectOption({ index: 1 });
  await expect(page.getByLabel('Measurement')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: join(directory, 'comparison-mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('incompatible and unknown states hide comparison charts rather than fabricate values', async ({
  page,
}) => {
  await page.goto(
    await variant('incompatible', (data) => {
      data.comparison.compatible = false;
      for (const metric of Object.values(data.comparison.metrics)) {
        metric.absolute = null;
        metric.percent = null;
      }
    }),
  );
  await expect(page.getByRole('alert')).toContainText('cannot be compared');
  await expect(page.locator('svg')).toHaveCount(0);
  await page.goto(
    await variant('unknown', (data) => {
      const key = JSON.stringify(['bundle', 'All exported assets', 'JS emittedBytes']);
      Object.assign(data.comparison.metrics[key], {
        baseline: null,
        absolute: null,
        percent: null,
      });
    }),
  );
  await page.getByLabel('Measurement').selectOption({ label: 'JS emittedBytes (bytes)' });
  await expect(page.getByRole('status')).toContainText('known value on both sides');
  await expect(page.locator('svg')).toHaveCount(0);
});

test('partial, empty, malicious-label and invalid-file states remain explicit', async ({
  page,
}) => {
  await page.goto(
    await variant('partial', (data) => {
      data.baselineComplete = false;
    }),
  );
  await expect(page.getByRole('note')).toContainText('Partial data');
  await page.goto(
    await variant('empty', (data) => {
      data.rows = [];
      data.comparison.metrics = {};
    }),
  );
  await expect(page.getByRole('status')).toContainText('no measurements');
  await page.goto(
    await variant('label', (data) => {
      data.baseline.label = '</script><script>window.__injected = true</script>';
    }),
  );
  expect(
    await page.evaluate(() => (window as Window & { __injected?: boolean }).__injected),
  ).toBeUndefined();
  await page.getByLabel('Open comparison JSON').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await expect(page.getByRole('alert')).toContainText('valid BritePulse comparison');
});
