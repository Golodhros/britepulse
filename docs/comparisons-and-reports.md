# Comparisons and reports

Reference · [Documentation home](README.md)

`compare --baseline <run UUID> --candidate <run UUID>` loads two stored measurement runs and creates an immutable comparison ID. `report --comparison <comparison UUID> --output <new HTML path>` exports that comparison as one HTML file containing the prebuilt Shadcn/Britecharts application, styles and validated data. Opening or sharing it does not require a server, network assets or a consumer-side frontend build. Existing output files and destinations inside immutable history are rejected.

## Compatibility

Numeric differences require equal measurement kind, configuration fingerprint, framework, environment, tool versions and collector profile. Bundle adapter, client/SSR target and compression configuration must also agree. Labels, local IDs and source build IDs may differ. Incompatible comparisons preserve measurements for inspection but have null differences/percentages and hide comparison charts.

Only finalized complete/partial runs with exactly one supported normalized bundle or synthetic summary can be compared. Running, failed or cancelled runs are rejected. Partial measurements retain available values and show diagnostics; they do not establish a passing budget. Same-run comparisons are rejected.

## Metrics

Bundle comparisons include all-exported and per-entrypoint JS/CSS emitted bytes, plus gzip/Brotli bytes when a compression configuration exists. Asset sets are deduplicated. Any unknown member size makes that aggregate unknown. Vite initial/asynchronous sets remain distinct; the partial Next Pages importer does not gain asynchronous attribution through comparison. Entrypoints are not automatically framework routes, and all-exported bytes are not measured network downloads.

Synthetic comparisons use each URL's per-metric median and retain valid/attempted counts and median absolute deviation. Units and directions must match the Lighthouse metric definitions. Raw fractional scores remain fractional. Missing subjects/metrics do not create zero baselines. A known zero baseline permits an absolute difference but leaves percentage unknown. Differences are unrounded; UI percentage formatting does not alter stored values. No significance test or budget verdict is implied by a delta.

## Stored and exported data

`comparisons/<uuid>/comparison.json` follows the version-1 comparison contract. `report.json` captures the baseline/candidate manifests, source completeness, rows and sample metadata with that comparison. Report creation reads this saved model rather than recomputing a comparison against later source changes. Store readers reject unlisted run artifacts, symlinked children and mismatched comparison/report identities.

The shared report schema is browser-safe and contains no filesystem/process/UI dependency. The dashboard validates embedded or manually opened comparison JSON. Empty, malformed, unknown, partial and incompatible states are explicit; illustrative data has been removed. Exact-value tables accompany the Britecharts chart. Labels/diagnostics are escaped by React, and embedded JSON cannot close its HTML script element.

Programmatic APIs: `compareRuns(store, baselineId, candidateId)`, `exportComparisonReport(store, comparisonId, output)`, `store.readComparison(id)`, `store.readComparisonReport(id)` and `reportDocumentSchema`.

## Validation

Core cases cover compatibility, unknowns, added entrypoints, zero baselines, source retention and HTML escaping. Installed consumers compare actual Vite baseline/candidate builds, check the known dependency growth and export the report through the public CLI. Playwright tests use the exported file directly and cover filters/chart, narrow layout, partial/incompatible/unknown/empty states and invalid JSON. Local browser launch currently fails before rendering; a successful build or file export is not claimed as browser validation.
