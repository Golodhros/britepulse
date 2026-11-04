import { spawn } from 'node:child_process';

export interface CommandOptions {
  cwd: string;
  timeoutMs: number;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}
export interface CommandResult {
  code: number | null;
  signal: NodeJS.Signals | null;
}
export class CommandInterruptedError extends Error {
  constructor(readonly reason: 'timeout' | 'cancelled') {
    super(`Command ${reason}`);
    this.name = 'CommandInterruptedError';
  }
}
/** Shell-free asynchronous command execution with bounded termination and streaming output. */
export async function runCommand(
  command: readonly string[],
  options: CommandOptions,
): Promise<CommandResult> {
  const [executable, ...args] = command;
  if (!executable || command.some((part) => !part.trim()))
    throw new Error('Build command must be a nonempty argument array');
  if (
    !Number.isInteger(options.timeoutMs) ||
    options.timeoutMs <= 0 ||
    options.timeoutMs > 2_147_483_647
  )
    throw new Error('Command timeout must be a positive integer');
  if (options.signal?.aborted) throw new CommandInterruptedError('cancelled');
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let callbackError: unknown;
    let interruption: 'timeout' | 'cancelled' | undefined;
    let forceTimer: ReturnType<typeof setTimeout> | undefined;
    const kill = (signal: NodeJS.Signals) => {
      if (!child.pid) return;
      try {
        if (process.platform !== 'win32') process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      }
    };
    const interrupt = (reason: 'timeout' | 'cancelled') => {
      if (interruption) return;
      interruption = reason;
      kill('SIGTERM');
      forceTimer = setTimeout(() => kill('SIGKILL'), 500);
      forceTimer.unref();
    };
    const cancel = () => interrupt('cancelled');
    const timer = setTimeout(() => interrupt('timeout'), options.timeoutMs);
    timer.unref();
    const cleanup = () => {
      clearTimeout(timer);
      if (forceTimer) clearTimeout(forceTimer);
      options.signal?.removeEventListener('abort', cancel);
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    const stream = (callback: ((chunk: string) => void) | undefined, chunk: string) => {
      try {
        callback?.(chunk);
      } catch (error) {
        callbackError = error;
        interrupt('cancelled');
      }
    };
    child.stdout.on('data', (chunk) => stream(options.onStdout, chunk));
    child.stderr.on('data', (chunk) => stream(options.onStderr, chunk));
    options.signal?.addEventListener('abort', cancel, { once: true });
    // Cover cancellation between the initial check and listener registration.
    if (options.signal?.aborted) cancel();
    child.once('error', (error) => {
      cleanup();
      reject(error);
    });
    child.once('close', (code, signal) => {
      if (interruption) kill('SIGKILL');
      cleanup();
      if (callbackError !== undefined) reject(callbackError);
      else if (interruption) reject(new CommandInterruptedError(interruption));
      else resolve({ code, signal });
    });
  });
}
