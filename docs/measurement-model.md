# Understanding the measurement model

Explanation · [Documentation home](README.md)

BritePulse keeps original evidence separate from normalized records. Normalization gives downstream tools a common vocabulary without erasing the report or build artifact that produced a number.

## Identities describe different things

A local run ID identifies one collection in history. A label is a human description and can repeat. A source build ID identifies the imported build artifact; importing it twice creates two local runs without changing that source identity. A configuration fingerprint describes the configured measurement profile, not a checkout or storage directory.

Those distinctions let a comparison ask whether two measurements are compatible before computing differences. Compatibility schemas exist, but comparison computation is still separate planned work.

## Unknown is different from zero

An emitted asset can have an unknown size because its reference is missing. A successful Lighthouse attempt can lack one metric. Neither case establishes zero cost or a performance improvement. BritePulse preserves nulls and records diagnostics so inspection remains useful without giving incomplete data a passing result.

Completeness and capabilities answer different questions. A snapshot can contain every asset available from its collector while still providing only partial module attribution. Vite entrypoints are build facts; they do not establish a React framework route map.

## Repeats are summarized per metric

A median summarizes values across successful measured attempts. Warmups and failed attempts do not supply values. Each metric has its own valid count, because one report can contain LCP while another does not. Median absolute deviation records spread without claiming statistical significance.

Retrying a successful low score would bias the sample set. Retries therefore replace failed measured attempts only. Aggregation can preserve partial medians for inspection; complete one- or two-sample results still cannot satisfy the planned minimum-three-sample budget policy. Budget evaluation is not yet implemented.

## Asset sizes describe a build, not a browser session

Emitted bytes describe output files. Gzip and Brotli values are estimates using a named compression configuration. Parsed size and observed network transfer are separate quantities and stay unknown when unavailable. Shared chunks are deduplicated within reachable asset sets; adding every route's initial set would count shared files repeatedly.

Synthetic navigation metrics describe a controlled browser navigation, not real-user field measurements. The experimental collector requests cold browser state with a fresh profile per attempt. That is distinct from warming an application server or measuring an authenticated browser session. Browser compatibility remains unverified until the live probes succeed.

## Presentation is a separate stage

Stored measurements do not automatically become dashboard findings. The current report application uses illustrative data. Connecting real history, implementing compatible comparisons, evaluating budgets and exporting real-data reports remain explicit work rather than conclusions implied by a successful build.
