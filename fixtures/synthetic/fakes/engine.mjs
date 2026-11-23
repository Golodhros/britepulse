import { appendFile, writeFile } from 'node:fs/promises';

export default async function lighthouse(url, flags, config) {
  await appendFile('fake-engine.ndjson', JSON.stringify({ url, flags, config }) + '\n');
  if (url.endsWith('/hang')) await new Promise(() => {});
  if (url.endsWith('/cleanup-hang')) await writeFile('fake-hang-cleanup', 'true');
  if (url.endsWith('/throw')) throw new Error('Fixture engine crash');
  const report = {
    lighthouseVersion: '13.6.0',
    gatherMode: 'navigation',
    requestedUrl: url,
    finalDisplayedUrl: url,
    fetchTime: new Date().toISOString(),
    audits: Object.fromEntries(
      [
        ['first-contentful-paint', 100],
        ['largest-contentful-paint', 200],
        ['speed-index', 150],
        ['total-blocking-time', 0],
        ['cumulative-layout-shift', 0.1],
      ].map(([name, value]) => [
        name,
        {
          numericValue: value,
          numericUnit: name === 'cumulative-layout-shift' ? 'unitless' : 'millisecond',
          scoreDisplayMode: 'numeric',
        },
      ]),
    ),
    categories: { performance: { score: 0.9 } },
  };
  if (url.endsWith('/partial')) delete report.audits['largest-contentful-paint'];
  if (url.endsWith('/error'))
    report.runtimeError = { code: 'NO_FCP', message: 'Fixture runtime failure' };

  return {
    report: [
      url.endsWith('/malformed') ? '{invalid' : JSON.stringify(report),
      '<html>Public fake Lighthouse report</html>',
    ],
  };
}
