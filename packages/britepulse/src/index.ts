/** Shared report contract. Runners and persistence are added in later work packages. */
export interface MetricSummary {
  median: number | null;
  validSamples: number;
  samples: number[];
  unit: 'ms' | 'bytes' | 'score' | 'unitless';
}
export interface RunMetadata {
  schemaVersion: 1;
  id: string;
  label: string;
  createdAt: string;
  framework: 'vite' | 'nextjs';
}
