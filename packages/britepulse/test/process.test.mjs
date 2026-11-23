import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCommand, CommandInterruptedError } from '../dist/process.js';
const command = (source) => [process.execPath, '-e', source];
test('streams output asynchronously and preserves literal shell metacharacters', async () => {
  let stdout = '';
  let stderr = '';
  const result = await runCommand(
    [
      ...command('console.log(process.argv[1]);console.error("progress");'),
      '$(echo unsafe);literal',
    ],
    {
      cwd: process.cwd(),
      timeoutMs: 5000,
      onStdout: (chunk) => (stdout += chunk),
      onStderr: (chunk) => (stderr += chunk),
    },
  );
  assert.equal(result.code, 0);
  assert.equal(stdout.trim(), '$(echo unsafe);literal');
  assert.equal(stderr.trim(), 'progress');
});
test('nonzero command exits are returned for callers to classify', async () => {
  const result = await runCommand(command('process.exit(7)'), {
    cwd: process.cwd(),
    timeoutMs: 5000,
  });
  assert.equal(result.code, 7);
});
test('timeouts terminate a process that ignores graceful termination', async () => {
  const started = Date.now();
  await assert.rejects(
    runCommand(command('process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'), {
      cwd: process.cwd(),
      timeoutMs: 250,
    }),
    (error) => error instanceof CommandInterruptedError && error.reason === 'timeout',
  );
  assert(Date.now() - started < 5000);
});
test('cancellation stops a running command and pre-aborted calls spawn nothing', async () => {
  const controller = new AbortController();
  const pending = runCommand(command('setInterval(()=>{},1000)'), {
    cwd: process.cwd(),
    timeoutMs: 5000,
    signal: controller.signal,
    onStdout: () => {},
  });
  controller.abort();
  await assert.rejects(pending, (error) => error.reason === 'cancelled');
  await assert.rejects(
    runCommand(command('process.exit(0)'), {
      cwd: process.cwd(),
      timeoutMs: 5000,
      signal: controller.signal,
    }),
    (error) => error.reason === 'cancelled',
  );
});
test('invalid input and spawn errors fail promptly', async () => {
  await assert.rejects(runCommand([], { cwd: process.cwd(), timeoutMs: 5000 }), /nonempty/);
  await assert.rejects(
    runCommand(command(''), { cwd: process.cwd(), timeoutMs: 0 }),
    /nonempty|positive/,
  );
  await assert.rejects(
    runCommand(['britepulse-executable-that-does-not-exist'], {
      cwd: process.cwd(),
      timeoutMs: 5000,
    }),
    /ENOENT/,
  );
});

test('output callback failures stop the child and reject with the original error', async () => {
  await assert.rejects(
    runCommand(command('console.log("ready");setInterval(()=>{},1000)'), {
      cwd: process.cwd(),
      timeoutMs: 5000,
      onStdout: () => {
        throw new Error('Output consumer failed');
      },
    }),
    /Output consumer failed/,
  );
});
