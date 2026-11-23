import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { httpUrl } from './validation.js';

const input = z
  .strictObject({
    url: httpUrl,
    engine: z.string(),
    launcher: z.string(),
    directory: z.string(),
    device: z.enum(['desktop', 'mobile']),
  })
  .parse(JSON.parse(await readFile(process.argv[2]!, 'utf8')));
interface Chrome {
  port: number;
  kill(): Promise<void>;
}
interface Launcher {
  launch(options: object): Promise<Chrome>;
}
type Lighthouse = (url: string, flags: object, config?: unknown) => Promise<unknown>;
const { default: lighthouse } = (await import(pathToFileURL(input.engine).href)) as {
  default: Lighthouse;
};
const { launch } = (await import(pathToFileURL(input.launcher).href)) as Launcher;
let chrome: Chrome | undefined;
try {
  chrome = await launch({
    chromeFlags: ['--headless'],
    handleSIGINT: false,
    userDataDir: join(input.directory, 'chrome'),
    ...(process.env.CHROME_PATH ? { chromePath: process.env.CHROME_PATH } : {}),
  });
  const config =
    input.device === 'desktop'
      ? (await import(pathToFileURL(join(dirname(input.engine), 'config/desktop-config.js')).href))
          .default
      : undefined;
  const result = z.object({ report: z.array(z.string()).length(2) }).parse(
    await lighthouse(
      input.url,
      {
        port: chrome.port,
        output: ['json', 'html'],
        onlyCategories: ['performance'],
        disableStorageReset: false,
        logLevel: 'silent',
      },
      config,
    ),
  );
  await writeFile(join(input.directory, 'report.json'), result.report[0]!);
  await writeFile(join(input.directory, 'report.html'), result.report[1]!);
} finally {
  await chrome?.kill();
}
