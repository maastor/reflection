# Contributing

Thanks for helping improve reflection.

## Layout

```
.claude-plugin/      Claude Code plugin manifest + marketplace listing
skills/              SKILL.md (LLM-facing) per skill — reflection is the core
commands/            Slash-command .toml files
agents/              Subagents (reflector)
src/hooks/           Runtime hook scripts + config + statusline
src/tools/           reflection-init.js (per-repo scaffolding)
src/rules/           Always-on ruleset blocks (opencode/openclaw/gemini)
src/plugins/opencode/ opencode plugin + commands
bin/                 Unified cross-platform installer
plugins/reflection/  Codex plugin package (.codex-plugin + assets)
tests/               Node test suite
```

## Source of truth

The question bank lives **only** in `skills/reflection/SKILL.md` as a
`| slug | question |` table. `reflection-config.js` parses it at runtime, so add
or edit questions there — don't duplicate the list in code.

## Development

```bash
node --test tests/*.test.mjs      # run the suite
node bin/install.js --list        # sanity-check the provider matrix
```

Test a hook directly:

```bash
echo '{"prompt":"/reflection","cwd":"'"$PWD"'"}' | node src/hooks/reflection-tracker.js
```

## Before opening a PR

- Keep the loop tight: one question, one issue, one minimal fix is the product
  philosophy — reflect it in the prompts too.
- If you touch a hook file, regenerate `src/hooks/checksums.sha256`:
  ```bash
  cd src/hooks && shasum -a 256 package.json reflection-*.js reflection-statusline.* > checksums.sha256
  ```
- Run the test suite.

## Security

Flag I/O is symlink-safe and validated against a slug whitelist. Don't relax
those guards in `reflection-config.js` or the statusline scripts — a predictable
flag path under `~/.claude` is an exfil/clobber vector otherwise.
