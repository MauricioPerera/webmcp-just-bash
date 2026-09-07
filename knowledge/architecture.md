---
type: 'Architecture Node'
title: 'Client-Side Architecture & Data Flow'
description: 'High-level component topology and client-side execution boundaries for Just-Bash.'
tags: ['okf', 'architecture', 'client-side', 'github-pages']
---

# Client-Side Architecture

The application runs entirely within the user's browser, enabling direct deployment to static hosts such as GitHub Pages.

```
+------------------------------------------------------------------------+
|                            BROWSER WINDOW                              |
|                                                                        |
|   +-------------------+       HTMX Events      +-------------------+   |
|   |   LiteTerminal    |<======================>|   HTMX Panels     |   |
|   |  (ANSI & Input)   |                        | (VFS / WebMCP /   |   |
|   +---------+---------+                        |  KDD Viewer)      |   |
|             |                                  +---------+---------+   |
|             v                                            |             |
|   +-------------------+                        Invokes   |             |
|   |    BashRuntime    |<---------------------------------+             |
|   |  (Pipes/Builtins) |                                                |
|   +---------+---------+                                                |
|             |                                                          |
|             +---------------------+                                    |
|             |                     |                                    |
|             v                     v                                    |
|   +-------------------+  +-------------------+                         |
|   |    Virtual FS     |  |  WebMCP Provider  | (document.modelContext  |
|   |  (In-Memory POSIX)|  |   & FastWebMCP    |  & window.webmcp)       |
|   +-------------------+  +---------+---------+                         |
|                                    |                                   |
|                                    v                                   |
|                          +-------------------+                         |
|                          |    AgentRunner    |                         |
|                          | (Tool-Loop Agent) |                         |
|                          +-------------------+                         |
+------------------------------------------------------------------------+
```

## Boundaries and Guarantees
1. **Zero Host Execution**: Commands never escape into the client operating system. Everything is sandboxed inside the in-memory JavaScript runtime.
2. **Deterministic State**: File operations update the shared `VirtualFS` singleton.
3. **WebMCP Polyfill & Standard**: Exposes tools onto `document.modelContext` and `window.webmcp` according to [webmcp.com](https://webmcp.com) and [FastWebMCP](https://mauricioperera.github.io/fastwebmcp/).
4. **Client-Side Agent**: The `agent` command executes directly in the browser via tool loops calling registered WebMCP tools (`bash_exec`, `fs_read_file`, etc.).
