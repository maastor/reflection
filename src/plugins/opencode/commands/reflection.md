---
description: Start (or stop) a codebase reflection round on one randomly chosen question
---
Begin a reflection round. $ARGUMENTS

Pick ONE question about this codebase (prefer one not covered recently in
reflection-changelog.md), reflect deeply, find ONE concrete validated issue
(cite file:line — verify before claiming). By default propose a minimal fix
(YAGNI) and wait for my approval before editing. If $ARGUMENTS include `auto`
(or autoApply is set in .reflection/config.json), instead apply the minimal fix
directly and commit it as `reflection(<slug>): <summary>` — one commit per fix.
After it's resolved, append an entry to reflection-changelog.md. If $ARGUMENTS
name a question slug, use that question. If it says stop/done/off, end the round.
Be brief.
