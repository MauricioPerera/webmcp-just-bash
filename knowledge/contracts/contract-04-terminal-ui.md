---
type: 'Task Contract'
title: 'Implement LiteTerminal UI Component'
description: 'Interactive monospace ANSI terminal with history navigation and path autocompletion.'
tags: ['ccdd', 'kdd', 'terminal', 'ui', 'autocomplete']

task: implement_terminal_ui
intent: "Render terminal emulator with ANSI formatting, Tab autocomplete, and history per terminal_ui.md"
target: src/ui/terminal.js
signature: "class LiteTerminal { constructor(opts); historyPush(cmd); historyPrevious(); historyNext(); getCompletions(input); static stripAnsi(str); }"
test_command: "node tests/test_terminal.js"
budget:
  max_cyclomatic_complexity: 14
tests: "tests/test_terminal.js"
touch_only: ["src/ui/terminal.js"]
tests_sha256: "1de7aca0883496c133ae35b3f656266c4de2189837a48a4053de081dd9bec45e"
deps_allowed: ["src/core/vfs.js", "src/core/bash-runtime.js"]
---

# CCDD Task Contract: LiteTerminal UI Component

## Intent
Provide a high-fidelity terminal UI matching justbash.dev per [terminal_ui.md](../terminal_ui.md).

## Interface
- Target file: `src/ui/terminal.js`
- Export: `LiteTerminal` class.
- Methods: `historyPush`, `historyPrevious`, `historyNext`, `getCompletions`, `write`, `clear`, `mount`.

## Constraints
- Max cyclomatic complexity: 14.
- Touch only `src/ui/terminal.js`.
- Clean ANSI decoding without unsafe innerHTML vulnerabilities.
