# BritePulse documentation

Choose the kind of help you need. These docs follow [Diátaxis](https://diataxis.fr/): tutorials teach through a guided exercise, how-to guides solve particular tasks, reference describes the interfaces, and explanation develops understanding.

| Need                                           | Start here                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| Learn the workflow with a small application    | [Getting started tutorial](getting-started.md)                                   |
| Complete a particular task                     | [How-to guides and recipes](how-to-guides.md)                                    |
| Look up commands, formats and supported inputs | [Reference index](reference.md)                                                  |
| Understand components and tradeoffs            | [Architecture](../Architecture.md) and [measurement model](measurement-model.md) |

## Tutorials

[Getting started](getting-started.md) guides you from a local package build to a Vite artifact and an immutable history entry. It requires neither Chrome nor a running application server.

## How-to guides

[Recipes](how-to-guides.md) cover adding the Vite plugin, collecting compression estimates, importing SSR output, selecting an environment, inspecting partial history, and trying experimental Lighthouse collection.

## Reference

- [CLI commands](reference.md)
- [Configuration, contracts and programmatic APIs](configuration.md)
- [Next.js Pages Router import](next-pages-integration.md)
- [Vite integration options and artifact semantics](vite-integration.md)
- [Storage and process behavior](local-storage.md)
- [Compatibility evidence and limits](compatibility.md)

## Explanation

- [Architecture and diagrams](../Architecture.md)
- [Measurement model](measurement-model.md)
- [Measurement engine decisions](decisions/measurement-engines.md)

## Contributor records

[Implementation progress](implementation-progress.md) records completed slices and validation evidence. [AGENTS.md](../AGENTS.md) describes the development and review workflow. These records supplement the user docs; they are not a tutorial or an interface specification.

When adding documentation, choose one primary purpose. Link to another category for prerequisites, exact option definitions or design rationale instead of embedding all four kinds in one page. Existing reference paths remain stable for repository links.
