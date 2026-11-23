---
name: quality
description: Combine BritePulse correctness, architecture and style reviews for a completed feature slice, then reconcile findings with the task's validation evidence.
---

# Review a completed BritePulse feature

Use this workflow before advancing from an implemented feature to the next one, or when asked for a comprehensive review. It coordinates reviews; [audit-changes](../audit-changes/SKILL.md) runs the executable checks. A narrowly scoped fix does not need an unrelated repository-wide audit.

1. Resolve [review scope](../../references/review-scope.md) once, including task commits and relevant worktree changes. Start with the stat and read changed manifests/configuration separately from large generated or lockfile output. An empty `main...HEAD` diff is not proof that the current task made no changes.
2. Apply the three complementary reviews to that same scope:
   - [Code review](../code-review/SKILL.md): measurement, CLI, graph and lifecycle correctness.
   - [Architecture review](../architecture-review/SKILL.md): boundaries, dependencies, schemas and packaging.
   - [Style review](../style-review/SKILL.md): terminology, naming, public contract clarity and documentation.
3. Combine duplicate findings. Keep confirmed defects separate from missing runtime evidence and existing planned limitations. Do not manufacture an issue to fill each review category.
4. In an implementation-and-cleanup task, fix supported findings within that feature before proceeding and run the affected checks from [audit-changes](../audit-changes/SKILL.md). In a standalone review, report findings without changing implementation files unless fixes were requested.
5. Summarize the resolved scope, highest-impact findings, fixes when authorized, validation actually performed and remaining gaps. A clean code review does not substitute for a failed/missing browser, packaging or compatibility check. Save a combined report under `.artifacts/reviews/` when the review warrants a durable artifact or one was requested.

The result should make it clear whether the requested feature slice is ready for the next implementation step. Review completion does not authorize publishing, pushing, merging or broader external actions, and does not impose a new permission gate on local work already authorized by the user.
