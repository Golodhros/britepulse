import { parseBundleSnapshot, type BundleSnapshot } from './contracts.js';
export type GraphAsset = BundleSnapshot['assets'][number] & {
  imports: string[];
  dynamicImports: string[];
};
export function assetKind(id: string): GraphAsset['kind'] {
  if (id.endsWith('.js') || id.endsWith('.mjs')) return 'js';
  if (id.endsWith('.css')) return 'css';
  return 'other';
}

function includeUnresolvedAssets(
  input: GraphAsset[],
  assets: Map<string, GraphAsset>,
  issues: string[],
): void {
  for (const asset of input) {
    for (const reference of [...asset.imports, ...asset.dynamicImports]) {
      if (assets.has(reference)) continue;
      issues.push(`Unresolved emitted asset: ${reference}`);
      assets.set(reference, {
        id: reference,
        kind: assetKind(reference),
        sizes: {
          emittedBytes: null,
          parsedBytes: null,
          gzipBytes: null,
          brotliBytes: null,
          transferBytes: null,
        },
        modules: [],
        imports: [],
        dynamicImports: [],
      });
    }
  }
}

export function resolveBundleGraph(
  input: GraphAsset[],
  entries: Record<string, string>,
  metadata: Pick<BundleSnapshot, 'runId' | 'target' | 'toolVersions' | 'compression'>,
  diagnostics: string[] = [],
): BundleSnapshot {
  const assets = new Map(input.map((asset) => [asset.id, asset]));
  if (assets.size !== input.length) throw new Error('Duplicate asset identifiers in bundle graph');
  const issues = [...diagnostics];
  includeUnresolvedAssets(input, assets, issues);
  const closure = (roots: Iterable<string>, dynamic: boolean): Set<string> => {
    const visited = new Set<string>();
    const queue = [...roots];
    while (queue.length) {
      const id = queue.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const asset = assets.get(id);
      if (!asset) throw new Error(`Entrypoint references missing asset ${id}`);
      queue.push(...asset.imports, ...(dynamic ? asset.dynamicImports : []));
    }
    return visited;
  };
  const entrypoints = Object.fromEntries(
    Object.entries(entries).map(([name, entry]) => {
      const initial = closure([entry], false);
      const reachable = closure([entry], true);
      return [
        name,
        {
          initial: [...initial].sort(),
          asynchronous: [...reachable].filter((id) => !initial.has(id)).sort(),
        },
      ];
    }),
  );
  return parseBundleSnapshot({
    schemaVersion: 1,
    adapter: 'vite',
    ...metadata,
    capabilities: {
      modules: 'partial',
      routes: 'unavailable',
      compression: metadata.compression ? 'available' : 'unavailable',
    },
    completeness: {
      status: issues.length ? 'partial' : 'complete',
      diagnostics: [...new Set(issues)],
    },
    assets: [...assets.values()].map(({ id, kind, sizes, modules }) => ({
      id,
      kind,
      sizes,
      modules,
    })),
    entrypoints,
  });
}
