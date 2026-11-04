import { resolveConfig, type BundleSnapshot, type MetricAggregate } from 'britepulse';
import { loadConfig } from 'britepulse/config';
import { britepulse } from 'britepulse/vite';
const config = resolveConfig({
  schemaVersion: 1,
  environments: { local: { urls: ['http://localhost:3000/'] } },
});
const count: number = config.synthetic.runs;
const target: BundleSnapshot['target'] = 'client';
const unit: MetricAggregate['unit'] = 'ms';
// @ts-expect-error Snapshot targets cannot be arbitrary framework names.
const invalidTarget: BundleSnapshot['target'] = 'react';
// @ts-expect-error Units cannot silently change to arbitrary display labels.
const invalidUnit: MetricAggregate['unit'] = 'kilobytes';
// @ts-expect-error Integration options must match the published declaration.
britepulse({ missingOption: true });
export { count, target, unit, invalidTarget, invalidUnit, loadConfig };
