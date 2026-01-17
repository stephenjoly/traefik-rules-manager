# Agents Build Guide

This file describes how to build and evolve the podcast summarization app with production-minded practices. It also encodes the working norms for automation (e.g., commit after each action, context docs).

## Operational Practices
- Idempotence: do not re-transcribe if transcript exists unless forced.
- Observability: structured logs; metrics counters for jobs, failures, durations.
- Secrets/config via env (.env for local). Keep tokens out of VCS.

## Working Norms (for automation/agents)
- Git hygiene: commit after each meaningful action/change (small, scoped commits).
- Keep large binaries and secrets out of commits; use `.gitignore` accordingly.
- Add `context.md` files in subdirectories when needed to explain purpose/layout so newcomers can onboard quickly.
- Prefer clear docstrings and concise comments where logic is non-obvious.
- Default to tests where feasible (unit for helpers; integration for pipelines); add smoke tests for pipeline happy-path.
- Continuously update existing `context.md` and `agents.md` files for accuracy.
