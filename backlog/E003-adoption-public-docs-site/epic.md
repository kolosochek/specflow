---
title: Adoption — public docs site
created: 2026-04-28
status: empty
---

## Goal

specflow today lives entirely inside this repository. A new reader who lands on the GitHub project sees `README.md` and a `docs/` folder that is comprehensive but reference-shaped — written for someone who already understands the framework. There is no public-facing surface that introduces the package, walks the reader through what it changes about a normal development process, or shows what evidence we have that the trade-offs are worth it.

This epic ships that surface as a static site published to GitHub Pages. The site is a thin layer over the existing `docs/` content, but it is **narrative-shaped**: it leads with motivation, then concepts, then evidence, then reference. The dogfood story — specflow being used to ship its own foundation epic with full TDD audit trail — is the primary case study, because it is the only set of numbers we own that comes from the framework actually doing its job.

The site does **not** invent new features, change the CLI, or restate the formal grammar. It re-presents what already exists in a form a reader who has never opened the CLI can absorb in 5 minutes.

## Success criteria

- A static site is published at `kolosochek.github.io/specflow` and reachable from a `README.md` link at the top of the repository.
- A first-time visitor can answer three questions from the landing page alone: *what is specflow*, *what does it change about my dev process*, *should I look further*.
- The "Concepts" tour visualizes the four axioms (markdown source of truth, sqlite projection, CLI as state mutator, slices as TDD units) with diagrams generated from the same Mermaid sources used in `docs/`, so there is no duplicate of conceptual content to drift.
- The "Benefits" section presents three concrete claims — TDD discipline visibility, audit trail completeness, transparency to non-author team members — each backed by a number or chart sourced from this repository's own `git log` / test counts after the foundation epic merged.
- A GitHub Actions workflow rebuilds and publishes the site on every push to `main`, so the site cannot drift from the repo.
- The site explicitly does **not** claim that specflow makes development *faster*. The honest framing is that specflow trades author-time speed for downstream legibility — and that trade-off is the value proposition.
