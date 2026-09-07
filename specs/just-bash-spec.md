---
title: "Specification: Client-Side Just-Bash Clone"
status: "approved"
version: "1.0.0"
date: "2026-09-07"
tags: ["spec", "bash", "webmcp", "kdd", "github-pages"]
---

# Specification: 100% Client-Side Just-Bash Clone

## 1. Objectives
1. Provide a 100% functional, client-side clone of [vercel-labs/just-bash](https://github.com/vercel-labs/just-bash) that executes without server dependencies and is fully deployable to GitHub Pages.
2. Incorporate modern terminal UI aesthetics matching [justbash.dev](https://justbash.dev/) using Tailwind CSS.
3. Integrate hypermedia-driven reactive panels (File Tree Explorer, WebMCP Inspector, KDD Knowledge Viewer) via HTMX.
4. Integrate WebMCP and FastWebMCP standards ([FastWebMCP](https://mauricioperera.github.io/fastwebmcp/) & [webmcp.com](https://webmcp.com)) exposing typed bash and virtual file tools onto `document.modelContext` and `window.webmcp`.
5. Support the `agent` command inside the terminal with an autonomous client-side tool loop (offline streaming simulation and online BYOK API key mode).
6. Follow the Knowledge-Driven Development (KDD) standard ([MauricioPerera/KDD](https://github.com/MauricioPerera/KDD)) with OKF nodes, CCDD task contracts, and deterministic validators.

## 2. System Components
- **Virtual File System (VFS)**: Hierarchical in-memory POSIX filesystem (`/`, `/home/user`, `/bin`, `/tmp`) with directories, files, stats, tree traversal, and change notifications.
- **Bash Engine**: Parser and execution engine supporting command lines, pipes (`|`), redirections (`>`, `>>`, `<`, `2>`, `2>&1`), conditionals (`&&`, `||`, `;`), environment variables (`$VAR`, `$HOME`, `$PWD`, `$?`), built-in utilities (`ls`, `cat`, `grep`, `head`, `tail`, `wc`, `sort`, `uniq`, `cut`, `tr`, `sed`, `awk`, `echo`, `printf`, `pwd`, `cd`, `mkdir`, `rm`, `cp`, `mv`, `tree`, `find`, `env`, `export`, `date`, `whoami`, `clear`, `help`, `history`, `jq`, `base64`, `seq`, `sleep`, `which`), and custom site commands (`about`, `install`, `github`, `webmcp`, `agent`).
- **WebMCP Provider**: Runtime adhering to `webmcp.com` and `FastWebMCP` standards, registering tools with JSON Schema/validation and telemetry.
- **Terminal UI (LiteTerminal)**: Monospace ANSI terminal renderer with history (ArrowUp/Down), tab completion (Tab), keybindings (Ctrl+C, Ctrl+L), and light/dark theme toggle.
- **HTMX Reactive UI**: Navigation tabs, drawer panels, live file sync, and declarative tool forms.
- **KDD Governance**: Deterministic validators enforcing contract frontmatter, oracle SHA256 integrity, and complexity budgets.
