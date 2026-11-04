import { intro, outro, select, isCancel, cancel } from '@clack/prompts';

export async function interactive(): Promise<void> {
  intro('BritePulse');
  const task = await select({
    message: 'Where would you like to start?',
    options: [
      { value: 'dashboard', label: 'Dashboard', hint: 'development preview' },
      { value: 'status', label: 'Implementation status' },
    ],
  });
  if (isCancel(task)) cancel('Cancelled.');
  else
    outro(
      task === 'dashboard'
        ? 'In the source checkout, run pnpm dev to preview the sample dashboard. Report serving is not implemented yet.'
        : 'Workspace and compatibility probes are ready. Measurement collection and local history are next.',
    );
}
