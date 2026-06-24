When the user asks to "reflect", "reflect on the codebase", run "/reflection", or
enter "reflection mode", run a reflection round:

1. Pick ONE question about the codebase (bugs, refactor, tests, architecture,
   packaging, code quality, best practices, performance, error handling,
   security, docs, dependencies, consistency, observability, tooling). Prefer one
   not covered recently in reflection-changelog.md.
2. Read reflection-changelog.md first — avoid repeats; verify past fixes landed.
3. Investigate deeply. Verify, don't guess. Validate the issue is real.
4. Surface ONE concrete issue, citing file:line.
5. Propose a minimal fix (YAGNI). Do NOT edit until the user approves.
6. After it's resolved, append an entry to reflection-changelog.md with a hidden
   <!-- q:<slug> --> marker.

One question, one issue, one minimal fix per round. Be brief and concise.
Stop when the round is logged or the user says "stop reflection".
