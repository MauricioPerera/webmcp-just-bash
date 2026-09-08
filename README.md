# just-bash (100% Client-Side Clone & FastWebMCP Playground)

> A 100% functional, client-side clone of [vercel-labs/just-bash](https://github.com/vercel-labs/just-bash) deployable to **GitHub Pages** with zero backend servers.

- **Live Landing Page & Terminal Sandbox**: [https://mauricioperera.github.io/webmcp-just-bash/](https://mauricioperera.github.io/webmcp-just-bash/)
- **GitHub Repository**: [https://github.com/MauricioPerera/webmcp-just-bash](https://github.com/MauricioPerera/webmcp-just-bash)

Built with:
- **Tailwind CSS**: Modern landing page aesthetic matching [justbash.dev](https://justbash.dev/).
- **HTMX**: Hypermedia-driven client-side reactive components (File Explorer, WebMCP Inspector, KDD Knowledge Viewer).
- **KDD Standard**: Knowledge-Driven Development methodology from [MauricioPerera/KDD](https://github.com/MauricioPerera/KDD), featuring OKF knowledge nodes and CCDD task contracts sealed with frozen test SHA-256 hashes.
- **FastWebMCP & webmcp.com**: Exposes typed WebMCP tools onto `document.modelContext` and `window.webmcp` per [FastWebMCP](https://mauricioperera.github.io/fastwebmcp/) and [webmcp.com](https://webmcp.com).

---

## Live Demo & GitHub Pages Deployment

This project is 100% static client-side:
- **Production URL**: [https://mauricioperera.github.io/webmcp-just-bash/](https://mauricioperera.github.io/webmcp-just-bash/)
- **Deploy Steps**: Push to `main` branch with GitHub Pages source set to `/ (root)`.

---

## Features

- **Pure Client-Side In-Memory Bash**:
  - Full pipeline execution: `cmd1 | cmd2 | cmd3`
  - Redirections: `>`, `>>`, `<`, `2>&1`
  - Variable expansions: `$VAR`, `${VAR}`, `$?`, `$HOME`, `$PWD`
  - Conditionals & chaining: `&&`, `||`, `;`
  - Standard Unix builtins: `ls`, `cat`, `grep`, `awk`, `jq`, `sed`, `head`, `tail`, `wc`, `sort`, `uniq`, `cut`, `tr`, `tree`, `find`, `mkdir`, `rm`, `cp`, `mv`, `stat`, `date`, `whoami`, `env`, `export`, `clear`, `help`, `history`, etc.
  - Custom site commands: `about`, `install`, `github`, `webmcp`, `agent <query>`.

- **FastWebMCP & WebMCP Integration**:
  - Tools registered: `bash_exec`, `fs_read_file`, `fs_write_file`, `fs_list_dir`, `fs_mkdir`, `fs_stat`, `kdd_validate_contract`.
  - Declarative forms supported in HTML: `<form toolname="run_bash" tooldescription="...">`.
  - Live execution telemetry logging latency, parameters, and results.

- **Autonomous Client-Side AI Agent (`agent`)**:
  - **Offline Heuristic Mode**: Streams multi-step reasoning and tool calls (`bash_exec`, `fs_read_file`, `fs_list_dir`) directly in the terminal with zero network calls and zero cost.
  - **Online BYOK Mode**: Optional support to input an API key (OpenAI, Anthropic, Groq, OpenRouter) held only in memory for the current tab to execute real LLM tool-calling loops in the browser.

---

## Running Locally

Serve statically with any static file server:

```bash
# Using npx serve:
npx serve . -p 8080

# Or using Python:
python -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## Automated Testing & KDD Validation

### 1. Run Oracle Test Suites (Node.js)
```bash
npm test
# Or directly:
node tests/run_all_tests.js
```

### 2. Run Deterministic KDD Contract & OKF Validation (Python stdlib)
```bash
npm run validate
# Or individually:
python scripts/validate_contracts.py knowledge/contracts
python scripts/validate_okf.py knowledge
python scripts/validate_specs.py specs
```

---

## Repository Structure

```
.
├── index.html                   # 100% client-side SPA (GitHub Pages ready)
├── 404.html                     # GitHub Pages fallback routing
├── package.json                 # Scripts and metadata
├── src/
│   ├── main.js                  # Entry point
│   ├── core/
│   │   ├── vfs.js               # Virtual in-memory POSIX filesystem
│   │   ├── bash-runtime.js      # Bash interpreter, pipelines, redirections, builtins
│   │   ├── webmcp-provider.js   # FastWebMCP & WebMCP standard bridge
│   │   └── agent-runner.js      # Autonomous tool-calling agent runner
│   ├── ui/
│   │   ├── terminal.js          # LiteTerminal with ANSI and autocomplete
│   │   ├── htmx-bridge.js       # HTMX reactivity (tabs, explorer, tools)
│   │   └── ascii-art.js         # justbash.dev ASCII logo & banner
│   └── styles/
│       └── main.css             # Terminal styling & themes
├── knowledge/                   # OKF knowledge nodes
│   ├── index.md
│   ├── architecture.md
│   ├── virtual_filesystem.md
│   ├── bash_engine.md
│   ├── webmcp_bridge.md
│   ├── terminal_ui.md
│   └── contracts/               # CCDD task contracts (sealed with SHA-256)
│       ├── contract-01-virtual-fs.md
│       ├── contract-02-bash-engine.md
│       ├── contract-03-webmcp-bridge.md
│       ├── contract-04-terminal-ui.md
│       └── contract-05-agent-tool-loop.md
├── specs/
│   └── just-bash-spec.md
├── scripts/
│   ├── validate_contracts.py
│   ├── validate_okf.py
│   └── validate_specs.py
└── tests/
    ├── run_all_tests.js
    ├── test_vfs.js
    ├── test_bash.js
    ├── test_webmcp.js
    ├── test_terminal.js
    └── test_agent.js
```

---

## License

Apache-2.0. Based on [vercel-labs/just-bash](https://github.com/vercel-labs/just-bash).
