import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { writeExportFile } from './export-file.js';
import { fileURLToPath } from 'node:url';
import { evaluateBudgets } from './budgets.js';
import { RunStore } from './store.js';

function inlineScript(text: string): string {
  return text.replace(/<\/script/gi, '<\\/script');
}

/** Single HTML file, including data, styles and the prebuilt app; no server or consumer build required. */
export async function exportComparisonReport(
  store: RunStore,
  comparisonId: string,
  output: string,
  budgetFile?: unknown,
): Promise<string> {
  const saved = await store.readComparisonReport(comparisonId);
  const report =
    budgetFile === undefined ? saved : { ...saved, budgets: evaluateBudgets(saved, budgetFile) };
  const assets = fileURLToPath(new URL('./report/assets/', import.meta.url));
  const files = await readdir(assets);
  const scripts = files.filter((file) => file.endsWith('.js'));
  if (scripts.length !== 1)
    throw new Error('Report packaging requires one self-contained app script');
  const [script, styles] = await Promise.all([
    readFile(join(assets, scripts[0]!), 'utf8'),
    Promise.all(
      files
        .filter((file) => file.endsWith('.css'))
        .map((file) => readFile(join(assets, file), 'utf8')),
    ),
  ]);
  const data = JSON.stringify(report)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BritePulse comparison</title><style>${styles.join('\n').replace(/<\/style/gi, '<\\/style')}</style><script id="britepulse-report-data" type="application/json">${data}</script></head><body><div id="root"></div><script type="module">${inlineScript(script)}</script></body></html>`;

  return writeExportFile(store.directory, output, html);
}
