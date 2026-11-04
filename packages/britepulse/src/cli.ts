#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const help = `BritePulse

Usage: britepulse [command]

  --help, -h      Show help
  --version, -v   Show version
  (no command)   Open the interactive menu

Collection, analysis, and persistence are not implemented yet.
`;
const args = process.argv.slice(2);
if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
  console.log(help);
} else if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  console.log(pkg.version);
} else if (args.length) {
  console.error(`Unknown command: ${args.join(' ')}. Run britepulse --help.`);
  process.exitCode = 2;
} else if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('Interactive mode requires a terminal. Run britepulse --help.');
  process.exitCode = 2;
} else {
  const { interactive } = await import('./interactive.js');
  await interactive();
}
