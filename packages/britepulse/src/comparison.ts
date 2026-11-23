import { z } from 'zod';
import {
  parseBundleSnapshot,
  metricAggregateSchema,
  type MetricAggregate,
  type Comparison,
  type RunManifest,
} from './contracts.js';
import { httpUrl, nonempty, schemaVersion } from './validation.js';
import { RunStore } from './store.js';
import { lighthouseMetricDefinitions } from './lighthouse-report.js';
import type { ReportRow } from './report-data.js';

const summarySchema = z.strictObject({
  schemaVersion,
  runId: z.uuid(),
  results: z.array(
    z.strictObject({
      url: httpUrl,
      aggregate: z.strictObject({
        status: z.enum(['complete', 'partial']),
        diagnostics: z.array(nonempty),
        metrics: z.record(nonempty, metricAggregateSchema),
      }),
    }),
  ),
});
interface Measurement {
  subject: string;
  label: string;
  unit: MetricAggregate['unit'];
  direction: MetricAggregate['direction'];
  value: number | null;
  aggregate: MetricAggregate | null;
}
interface LoadedRun {
  manifest: RunManifest;
  kind: 'synthetic' | 'bundle';
  profile: string;
  complete: boolean;
  measurements: Record<string, Measurement>;
}

function stable(value: Record<string, string>): string {
  return JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

function addMetric(run: LoadedRun, value: Measurement): void {
  const key = JSON.stringify([run.kind, value.subject, value.label]);
  if (Object.hasOwn(run.measurements, key)) throw new Error('Duplicate measurement identity');
  run.measurements[key] = value;
}

function sumKnown(values: Array<number | null>): number | null {
  if (values.some((value) => value === null)) return null;
  const total = values.reduce<number>((sum, value) => sum + value!, 0);

  return Number.isFinite(total) ? total : null;
}

async function loadBundle(store: RunStore, manifest: RunManifest): Promise<LoadedRun> {
  const snapshot = parseBundleSnapshot(
    await store.readRunArtifact(manifest.id, 'normalized/bundle.json'),
  );
  if (snapshot.runId !== manifest.id) throw new Error('Bundle identity differs from its run');
  const run: LoadedRun = {
    manifest,
    kind: 'bundle',
    complete: manifest.status === 'complete' && snapshot.completeness.status === 'complete',
    profile: JSON.stringify([
      snapshot.adapter,
      snapshot.target,
      stable(snapshot.toolVersions),
      snapshot.compression,
    ]),
    measurements: {},
  };
  const assets = new Map(snapshot.assets.map((asset) => [asset.id, asset]));
  const scopes = [
    { subject: 'All exported assets', ids: [...assets.keys()] },
    ...Object.entries(snapshot.entrypoints).flatMap(([name, entry]) => [
      { subject: `${name} · initial`, ids: entry.initial },
      ...(snapshot.adapter === 'vite'
        ? [{ subject: `${name} · asynchronous`, ids: entry.asynchronous }]
        : []),
    ]),
  ];
  for (const scope of scopes) {
    for (const kind of ['js', 'css'] as const) {
      for (const field of ['emittedBytes', 'gzipBytes', 'brotliBytes'] as const) {
        if (field !== 'emittedBytes' && !snapshot.compression) continue;
        const values = [...new Set(scope.ids)]
          .map((id) => assets.get(id)!)
          .filter((asset) => asset.kind === kind)
          .map((asset) => asset.sizes[field]);
        const value = sumKnown(values);
        addMetric(run, {
          subject: scope.subject,
          label: `${kind.toUpperCase()} ${field}`,
          unit: 'bytes',
          direction: 'lower',
          value,
          aggregate: null,
        });
      }
    }
  }

  return run;
}

async function loadSynthetic(store: RunStore, manifest: RunManifest): Promise<LoadedRun> {
  const summary = summarySchema.parse(
    await store.readRunArtifact(manifest.id, 'normalized/synthetic.json'),
  );
  if (summary.runId !== manifest.id) throw new Error('Synthetic identity differs from its run');
  const run: LoadedRun = {
    manifest,
    kind: 'synthetic',
    complete:
      manifest.status === 'complete' &&
      summary.results.length > 0 &&
      summary.results.every((result) => result.aggregate.status === 'complete'),
    profile: stable(manifest.toolVersions),
    measurements: {},
  };
  for (const result of summary.results) {
    for (const [label, aggregate] of Object.entries(result.aggregate.metrics)) {
      if (!Object.hasOwn(lighthouseMetricDefinitions, label))
        throw new Error(`Unknown synthetic metric definition: ${label}`);
      const definition =
        lighthouseMetricDefinitions[label as keyof typeof lighthouseMetricDefinitions];
      if (aggregate.unit !== definition.unit || aggregate.direction !== definition.direction)
        throw new Error(`Invalid synthetic metric unit or direction: ${label}`);
      addMetric(run, {
        subject: result.url,
        label,
        unit: aggregate.unit,
        direction: aggregate.direction,
        value: aggregate.median,
        aggregate,
      });
    }
  }

  return run;
}

async function loadRun(store: RunStore, id: string): Promise<LoadedRun> {
  const manifest = await store.read(id);
  if (!['complete', 'partial'].includes(manifest.status))
    throw new Error(`Run ${id} is not a completed or partial measurement`);
  const bundle = manifest.artifacts.includes('normalized/bundle.json');
  const synthetic = manifest.artifacts.includes('normalized/synthetic.json');
  if (bundle === synthetic)
    throw new Error('Run must contain exactly one supported measurement source');

  return bundle ? loadBundle(store, manifest) : loadSynthetic(store, manifest);
}

function profileDiagnostics(baseline: LoadedRun, candidate: LoadedRun): string[] {
  const diagnostics: string[] = [];
  if (baseline.kind !== candidate.kind) diagnostics.push('Measurement kinds differ');
  if (baseline.manifest.configFingerprint !== candidate.manifest.configFingerprint)
    diagnostics.push('Configuration fingerprints differ');
  if (baseline.manifest.framework !== candidate.manifest.framework)
    diagnostics.push('Framework identities differ');
  if (baseline.manifest.environment !== candidate.manifest.environment)
    diagnostics.push('Environments differ');
  if (
    baseline.profile !== candidate.profile ||
    stable(baseline.manifest.toolVersions) !== stable(candidate.manifest.toolVersions)
  )
    diagnostics.push('Collector versions, targets, adapters or compression settings differ');

  return diagnostics;
}

function delta(
  a: Measurement | undefined,
  b: Measurement | undefined,
  compatible: boolean,
): Comparison['metrics'][string] {
  const definition = a ?? b!;
  const baseline = a?.value ?? null;
  const candidate = b?.value ?? null;
  const absolute =
    compatible && baseline !== null && candidate !== null ? candidate - baseline : null;
  const percent =
    absolute !== null && baseline !== null && baseline !== 0 ? (absolute / baseline) * 100 : null;

  return {
    unit: definition.unit,
    direction: definition.direction,
    baseline,
    candidate,
    absolute,
    percent: percent !== null && Number.isFinite(percent) ? percent : null,
  };
}

export async function compareRuns(
  store: RunStore,
  baselineId: string,
  candidateId: string,
): Promise<Comparison> {
  if (baselineId === candidateId) throw new Error('Choose distinct baseline and candidate runs');
  const [baseline, candidate] = await Promise.all([
    loadRun(store, baselineId),
    loadRun(store, candidateId),
  ]);
  const incompatible = profileDiagnostics(baseline, candidate);
  const keys = [
    ...new Set([...Object.keys(baseline.measurements), ...Object.keys(candidate.measurements)]),
  ].sort();
  for (const key of keys) {
    const a = baseline.measurements[key];
    const b = candidate.measurements[key];
    if (a && b && (a.unit !== b.unit || a.direction !== b.direction))
      incompatible.push(`Metric definition differs: ${a.label}`);
  }
  const compatible = incompatible.length === 0;
  const diagnostics = [...incompatible];
  if (!baseline.complete || !candidate.complete)
    diagnostics.push(
      'Partial data: deltas are for inspection and cannot establish a passing budget',
    );
  const metrics: Comparison['metrics'] = {};
  const rows: ReportRow[] = [];
  for (const key of keys) {
    const a = baseline.measurements[key];
    const b = candidate.measurements[key];
    const definition = a ?? b!;
    metrics[key] = delta(a, b, compatible);
    rows.push({
      key,
      group: (a ? baseline : candidate).kind,
      subject: definition.subject,
      label: definition.label,
      baselineSamples: a?.aggregate ?? null,
      candidateSamples: b?.aggregate ?? null,
    });
    if (!a || !b)
      diagnostics.push(
        `Measurement absent from ${a ? 'candidate' : 'baseline'}: ${definition.subject} / ${definition.label}`,
      );
  }

  return store.createComparison(
    { baselineId, candidateId, compatible, diagnostics, metrics },
    {
      baseline: baseline.manifest,
      candidate: candidate.manifest,
      baselineComplete: baseline.complete,
      candidateComplete: candidate.complete,
      rows,
    },
  );
}
