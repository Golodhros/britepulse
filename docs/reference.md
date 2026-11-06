# CLI reference

Reference · [Documentation home](README.md)

Direct commands emit JSON results; `--json` is accepted for explicit scripting. Progress and errors use stderr. Run `britepulse <command> --help` for that command's accepted flags. The package requires Node.js >=22.19.0.

| Command               | Inputs                                                                                                                            | Result                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `init`                | Required `--url` (repeatable); optional `--app-root`, `--adapter vite\|next-webpack\|none`, `--environment`, `--runs`, `--config` | Exclusively creates configuration; existing files are not overwritten                     |
| `doctor`              | `--config`, `--environment`, `--runs`, `--retries`, `--timeout-ms`                                                                | Checks project settings and installed metadata; does not collect measurements             |
| `history`             | Same profile flags as `doctor`                                                                                                    | Lists all local runs in the resolved output directory, with discovery diagnostics         |
| `analyze`             | Exactly one of `--artifact` or `--next-build`; optional `--label`, `--target client\|ssr`, `--environment`, `--config`            | Imports a Vite artifact or Next.js Pages client Webpack build into a fresh run            |
| `compare`             | Required `--baseline` and `--candidate` run UUIDs; optional `--config`                                                            | Saves a comparison and report data                                                        |
| `report`              | Required `--comparison` UUID and `--output` new HTML path; optional `--config`, `--budgets`                                       | Exports one standalone HTML report                                                        |
| `budget`              | Required `--comparison` and `--budgets`; optional `--output`, `--config`, `--json`                                                | Evaluates CI rules; exits 0 pass, 1 violation, 2 error                                    |
| `measure`             | Required `--experimental`; optional `--label`, `--config`, `--environment`, `--runs`, `--retries`, `--timeout-ms`                 | Experimental cold-cache Lighthouse collection on macOS/Linux without authentication hooks |
| `--help`, `--version` | No command                                                                                                                        | Prints help or installed package version without optional tool startup                    |
| No command            | Interactive terminal                                                                                                              | Opens the Clack setup/doctor/history menu                                                 |

`--help`/`-h` are accepted by commands. Root version also accepts `-v`. Redirected input cannot enter the interactive menu. Relative `--artifact` and `--config` paths resolve from the current working directory; configuration-owned paths follow the [configuration reference](configuration.md).

## Exit statuses

| Code  | Meaning                                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------- |
| `0`   | Command succeeded; experimental collection has complete requested data                                      |
| `1`   | Experimental measurement returned a partial manifest, or a budget was violated                              |
| `2`   | Invalid invocation/configuration, failed doctor checks, fatal collection error, or budget measurement error |
| `130` | Interactive prompt cancelled                                                                                |

SIGINT/SIGTERM during `measure` request cancellation and persist a cancelled run when collection has started; the CLI reports the resulting collection error with exit 2. A cancelled browser operation is not a completed measurement.

## Other reference pages

- [Configuration, serialized contracts and core APIs](configuration.md)
- [CI budgets](budgets.md)
- [Comparisons and reports](comparisons-and-reports.md)
- [Next.js Pages Router import](next-pages-integration.md)
- [Vite options and artifact semantics](vite-integration.md)
- [Storage and process execution](local-storage.md)
- [Compatibility evidence](compatibility.md)

Examples for accomplishing tasks live in [How-to guides](how-to-guides.md). Architectural rationale lives in [Architecture](../Architecture.md).
