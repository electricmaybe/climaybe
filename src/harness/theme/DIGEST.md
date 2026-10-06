# Harness digest

Pinned to [walkinglabs/learn-harness-engineering](https://github.com/walkinglabs/learn-harness-engineering) commit `38ddcd2` (`skills/harness-creator/templates`).

## Five subsystems

| Subsystem | Artifact here | Purpose |
|---|---|---|
| Instructions | `AGENTS.md` (+ `CLAUDE.md`, `agent-harness.mdc`) | Startup path, invariants, definition of done |
| State | `feature_list.json`, `progress.md` | Active feature, status, evidence |
| Verification | `init.sh`, `climaybe check` | Install + Theme Check baseline gate + tests |
| Scope | Feature dependencies / WIP=1 | Prevents overreach and half-finished work |
| Lifecycle | `session-handoff.md`, end-of-session routine | Next session restartable |

## Course takeaways (generic)

- Keep the root instruction file short: routing and invariants, not a full manual.
- Put project facts in project docs; link AI rules instead of copying them.
- Make verification commands explicit and runnable.
- Require evidence before marking a feature done.
- Prefer append/update state files over chat history.
- Never hide destructive overwrites; existing harness files stay untouched on re-run.

## TODO — theme-specific notes

- [ ] Document storefront niches, catalog quirks, and demo data expectations for this theme
- [ ] Note which Theme Check checks are intentionally baselined and why
- [ ] Link any internal runbooks (release, hotfix, locale sync) used by this merchant
