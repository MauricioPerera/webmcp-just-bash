---
type: 'Specification'
title: 'Terminal UI Component'
description: 'Monospace ANSI renderer, keyboard handling, and HTMX reactive bridge.'
tags: ['okf', 'terminal', 'ui', 'htmx', 'tailwind']
---

# Terminal UI & HTMX Bridge Specification

## Terminal Interface (LiteTerminal)
- **DOM Container**: Auto-scrolling viewport with monospace typography (`Geist Mono`, `IBM Plex Mono`, `monospace`).
- **ANSI Engine**: Interprets standard escape codes (foreground/background colors, bold, dim, cyan highlights, line clearing).
- **Keyboard Handling**:
  - `Enter`: Evaluates current input command.
  - `ArrowUp` / `ArrowDown`: Recalls previous/next command from history.
  - `Tab`: Autocompletes matching commands and virtual filesystem paths.
  - `Ctrl+C`: Aborts current line and prints fresh prompt.
  - `Ctrl+L`: Clears terminal screen buffer.
  - `Left` / `Right` / `Home` / `End`: Cursor navigation.

## HTMX Reactive Panels
- **Tab Navigation**: Seamless switching between Terminal, Virtual Filesystem Explorer, WebMCP Tools Inspector, and KDD Knowledge Viewer.
- **Event-Driven Sync**: Dispatches `vfs:change` and `webmcp:tool-executed` custom window events so HTMX components re-render without server round-trips.
