import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scheduleSyntheticSamples,
  SyntheticScheduleError,
  aggregateSyntheticSamples,
} from '../dist/index.js';

const url = 'https://example.com/';
const success = {
  status: 'success',
  metrics: { lcp: { value: 100, unit: 'ms' } },
  error: null,
  reports: { json: null, html: null },
};
const failure = { ...success, status: 'failed', error: 'Navigation failed' };

test('runs sequential slots with bounded failed retries and retains every attempt', async () => {
  const calls = [];
  const saved = [];
  let active = false;
  const samples = await scheduleSyntheticSamples(
    { url, runs: 3, warmups: 1, retries: 1 },
    async (context) => {
      assert.equal(active, false);
      active = true;
      calls.push([context.attempt, context.warmup]);
      await Promise.resolve();
      active = false;

      return [2, 3].includes(context.attempt) ? failure : success;
    },
    {
      onSample: async (sample) => {
        saved.push(sample.attempt);
        sample.metrics = {};
      },
    },
  );
  assert.deepEqual(calls, [
    [1, true],
    [2, false],
    [3, false],
    [4, false],
    [5, false],
  ]);
  assert.deepEqual(saved, [1, 2, 3, 4, 5]);
  assert.equal(new Set(samples.map((sample) => sample.id)).size, 5);
  const result = aggregateSyntheticSamples({
    url,
    expectedSamples: 3,
    metrics: { lcp: { unit: 'ms', direction: 'lower' } },
    samples,
  });
  assert.equal(result.status, 'partial');
  assert.equal(result.metrics.lcp.validSamples, 2);
  assert.equal(result.metrics.lcp.attemptedSamples, 4);
});

test('never retries successful samples with missing metrics or low scores', async () => {
  const samples = await scheduleSyntheticSamples({ url, runs: 2, retries: 10 }, async () => ({
    ...success,
    metrics: {},
  }));
  assert.equal(samples.length, 2);
});

test('records thrown runner errors as failed attempts and replaces them', async () => {
  let count = 0;
  const samples = await scheduleSyntheticSamples({ url, runs: 1, retries: 1 }, async () => {
    if (++count === 1) throw new Error('Browser crashed');

    return success;
  });
  assert.equal(samples[0].error, 'Browser crashed');
  assert.equal(samples[1].status, 'success');
});

test('stops on failed warmups, invalid output and persistence errors without retrying', async () => {
  for (const [outcome, options] of [
    [failure, {}],
    [{ ...success, error: 'invalid success' }, {}],
    [
      success,
      {
        onSample: async () => {
          throw new Error('Disk full');
        },
      },
    ],
  ]) {
    let calls = 0;
    await assert.rejects(
      scheduleSyntheticSamples(
        { url, warmups: 1 },
        async () => {
          calls++;

          return outcome;
        },
        options,
      ),
      (error) => {
        assert(error instanceof SyntheticScheduleError);
        assert(error.cause instanceof Error);

        return true;
      },
    );
    assert.equal(calls, 1);
  }
});

test('cancellation starts no new attempts and retains settled samples', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    scheduleSyntheticSamples(
      { url },
      async () => {
        assert.fail('Must not run');
      },
      { signal: controller.signal },
    ),
    /cancelled/,
  );
  const active = new AbortController();
  await assert.rejects(
    scheduleSyntheticSamples(
      { url },
      async ({ signal }) => {
        assert.equal(signal, active.signal);
        active.abort();

        return success;
      },
      { signal: active.signal },
    ),
    (error) => {
      assert.equal(error.samples.length, 1);

      return /cancelled/.test(error.message);
    },
  );
});

test('validates bounds before invoking the runner', async () => {
  await assert.rejects(
    scheduleSyntheticSamples({ url, runs: 0 }, async () => {
      assert.fail('Must not run');
    }),
    /Invalid synthetic schedule/,
  );
});

test('awaits cancellation cleanup and does not invent a failed sample for interrupted work', async () => {
  const controller = new AbortController();
  let cleaned = false;
  await assert.rejects(
    scheduleSyntheticSamples(
      { url },
      async () => {
        controller.abort();
        try {
          throw new Error('Interrupted');
        } finally {
          await Promise.resolve();
          cleaned = true;
        }
      },
      { signal: controller.signal },
    ),
    (error) => {
      assert.equal(cleaned, true);
      assert.deepEqual(error.samples, []);

      return /cancelled/.test(error.message);
    },
  );
});

test('persistence failure retains the unpersisted sample and prevents the next attempt', async () => {
  let calls = 0;
  await assert.rejects(
    scheduleSyntheticSamples(
      { url, runs: 3 },
      async () => {
        calls++;

        return success;
      },
      {
        onSample: async () => {
          throw new Error('Disk full');
        },
      },
    ),
    (error) => {
      assert.equal(error.samples.length, 1);
      assert.equal(error.cause.message, 'Disk full');

      return true;
    },
  );
  assert.equal(calls, 1);
});

test('fatal adapter failures stop without creating retried navigation failures', async () => {
  const { SyntheticRunnerFatalError } = await import('../dist/index.js');
  let calls = 0;
  await assert.rejects(
    scheduleSyntheticSamples({ url, runs: 3, retries: 2 }, async () => {
      calls++;
      throw new SyntheticRunnerFatalError('Persistence failed');
    }),
    (error) => {
      assert.equal(error.samples.length, 0);
      assert(error.cause instanceof SyntheticRunnerFatalError);

      return true;
    },
  );
  assert.equal(calls, 1);
});
