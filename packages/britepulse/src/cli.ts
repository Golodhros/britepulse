#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const help = `BritePulse

Usage: britepulse [command]

  --help, -h      Show help
  --version, -v   Show version
  init            Create configuration without overwriting an existing file
  analyze         Import a Vite artifact or Next.js Pages Webpack build into history
  measure         Experimental cold-cache Lighthouse collection (requires --experimental)
  compare         Compare two stored run IDs
  report          Export a saved comparison as a standalone HTML report
  doctor          Validate the project and resolved measurement profile
  history         List local runs
  (no command)    Open the interactive menu

Live browser collection compatibility remains unvalidated.
`;
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) console.log(help);
  else if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    console.log(pkg.version);
  } else if (args.length) {
    const { execute } = await import('./commands.js');
    await execute(args);
  } else if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Interactive mode requires a terminal. Run britepulse --help.');
  } else {
    const { interactive } = await import('./interactive.js');
    await interactive();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
