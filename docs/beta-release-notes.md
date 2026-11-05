# BritePulse 0.1.0-beta.0

Prepared beta release notes · [Documentation home](README.md)

This version is prepared locally; it has not been published by this implementation task.

## Available workflows

- Guided and direct project setup, read-only doctor checks, immutable local history and JSON command output.
- Vite 8.3.5 production artifact collection with initial/dynamic asset sets, emitted bytes and optional gzip/Brotli estimates; client and SSR targets stay separate.
- Next.js 16.4.5 / Webpack 5.98.0 Pages client imports, retaining source artifacts and deduplicated manifest-backed initial route assets. Snapshots are explicitly partial.
- Experimental cold-cache Lighthouse collection using application-installed Lighthouse 13.6.0 and chrome-launcher 1.2.2 on macOS/Linux, with workers, bounded retries, cancellation and retained evidence.
- Synthetic-only profiles (`--adapter none`) for deployed websites using Expo, Gatsby or other frameworks, with generic run identity and no bundle-tool requirement.
- Versioned contracts, per-metric medians/spread and explicit missing values.
- Shared comparisons and a prebuilt React/Shadcn/Britecharts dashboard using saved data, with standalone HTML export and explicit empty/partial/incompatible states.

## Limits for beta users

Live Lighthouse probes are blocked by loopback `EPERM` in the development environment; controlled worker/process tests are not proof of actual Chrome cache, device or cleanup behavior. Authentication hooks and warm-cache collection are rejected by the experimental collector.

Next.js asynchronous route attribution, concrete URL-to-template matching, App Router, mixed-router, Turbopack and SSR imports are unavailable. Missing sizes remain null. Budget evaluation and automated application build orchestration are not implemented. Report browser checks are implemented but local Chrome launch is blocked; CI rendering validation is still required. This beta does not provide remote storage or statistical-significance claims.

The package requires Node.js >=22.19.0. Check [compatibility evidence](compatibility.md) and follow [Getting started](getting-started.md) for a server-free collection exercise. Use [release how-to](releases.md) for the publication steps and remaining account/workflow setup.
