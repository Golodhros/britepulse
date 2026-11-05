# Resolve the review scope

Determine the scope before reading a large diff. Use the same scope for code, architecture and style review.

1. Honor explicit paths, commits, ranges or a requested base branch. A request for unstaged changes means `git diff`; a request for uncommitted changes includes staged, unstaged and untracked files.
2. During implementation, include all changes belonging to the current feature slice, including commits already made during that task. Use conversation context and `git log --oneline` to identify the range.
3. On a feature branch with no more specific context, compare its merge base with `main`, and include current worktree changes. Use `git merge-base HEAD main` to obtain the base and pass the returned revision to `git diff <base> HEAD`.
4. On `main`, `git diff main...HEAD` is empty even after committing real work. Use the current task's commit range. For an otherwise unspecified clean-tree review, state that you are reviewing the latest commit with `git show HEAD`; do not silently expand to the entire project. An explicitly branch-only request with no branch changes should be reported as empty.

For worktree scope, inspect both tracked changes and untracked files:

```sh
git status --short
git diff HEAD --stat
git diff HEAD
git ls-files --others --exclude-standard
```

`git diff HEAD` combines staged and unstaged tracked edits, but does not show untracked file content. Read relevant untracked files separately. For committed scope, record the base and head revisions. For explicit file scope, read the current files and enough surrounding code to assess them.

Read changed manifests and configuration JSON. Inspect the relevant dependency/peer changes in `pnpm-lock.yaml` without loading the entire lockfile. Ignore generated `dist/`, `node_modules/`, `.britepulse/` and `.artifacts/` as review inputs; their generated output can still be evidence for packaging or runtime checks.

For each actionable finding, give priority, file/line, trigger, observed behavior and practical impact. P0 means an urgent, broadly applicable failure; P1 means a serious correctness or data-loss issue; P2 means an ordinary defect or material coverage gap; P3 means a supported maintainability/documentation issue. Distinguish new problems from existing limitations. Report no findings when none are supported.

A standalone review does not change implementation files. When reviewing as part of an authorized implementation-and-cleanup loop, fix findings in that feature's scope and recheck the affected behavior. Do not add unrelated cleanup to satisfy a review category.

For substantial reviews or when requested, save a new report under the already ignored `.artifacts/reviews/` directory. Include scope, findings, validation evidence and unresolved gaps. Small reviews can be delivered in chat without creating report files.
