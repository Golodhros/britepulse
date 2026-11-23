# Local storage and process execution

`RunStore` stores local history beneath the configured output directory. Every collection creates `runs/<uuid>/manifest.json`; labels and timestamps are metadata and cannot overwrite a previous run. Discovering history sorts manifest timestamps and returns diagnostics for malformed entries alongside valid runs.

`collectRun` owns a collection lifecycle. A successful callback finalizes the run as complete. A thrown error records failed or partial state depending on whether any artifacts were saved; command cancellation records cancelled state. The thrown `RunExecutionError` includes the saved manifest and original cause. An interrupted process that never reaches cleanup remains visibly running, rather than being inferred complete.

A run session serializes concurrent writes. Artifacts are first written to unique temporary files and atomically linked into place without replacing an existing artifact. Manifest and comparison JSON updates use an atomic rename. These operations provide atomic visibility, not a power-loss durability guarantee. Finalization waits for already-queued writes, rejects later writes, and refuses a complete state after an artifact write failure. Files already written remain available in partial or failed runs.

Artifact names are relative paths. Traversal, absolute paths, manifest replacement, and symlinked child directories are rejected. Manifest IDs must match their directory IDs; symlinked manifests are not read as ordinary runs. Comparison directories also use fresh UUIDs and require both referenced runs to exist.

`withTemporaryDirectory` isolates temporary work and removes it when a callback succeeds or throws. `runCommand` streams stdout/stderr, takes an executable/argument array without a shell, and returns ordinary exit codes. Timeouts and abort signals terminate the process and reject with a typed interruption reason. On macOS and Linux, interruption also terminates the child's process group, with a bounded SIGKILL fallback. Windows currently terminates only the immediate child. Output callback failures terminate the process and preserve the callback error.

CLI Vite imports and experimental Lighthouse collection use this storage. Automatic recovery/resumption of running entries remains future work. Storage stays on the local filesystem; no cloud interfaces or remote synchronization are implemented.
