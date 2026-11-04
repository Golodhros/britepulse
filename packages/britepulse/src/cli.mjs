#!/usr/bin/env node
import { intro, outro, select, isCancel, cancel } from '@clack/prompts';

const command = process.argv[2];
if (command === '--help' || command === '-h') {
  console.log('BritePulse scaffold\n\n  britepulse          Open the interactive menu\n  britepulse --help   Show help\n\nDashboard development: pnpm dev from the workspace root.\nCollection, analysis, and persistence are not implemented yet.');
} else if (command) {
  console.error(`Unknown command: ${command}. Run britepulse --help.`);
  process.exitCode = 2;
} else if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('Interactive mode requires a terminal. Run britepulse --help.');
  process.exitCode = 2;
} else {
  intro('BritePulse');
  const task = await select({ message: 'Where would you like to start?', options: [
    { value: 'dashboard', label: 'Dashboard', hint: 'development preview' },
    { value: 'status', label: 'Implementation status' },
  ] });
  if (isCancel(task)) cancel('Cancelled.');
  else outro(task === 'dashboard'
    ? 'Run pnpm dev from the workspace root to open the sample dashboard.'
    : 'Scaffold ready. Lighthouse collection, bundle analysis, and local history are next.');
}
