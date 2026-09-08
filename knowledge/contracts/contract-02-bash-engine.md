---
type: 'Task Contract'
title: 'Implement Bash Runtime Engine'
description: 'Pure client-side Bash interpreter handling pipelines, redirections, variables, builtins, and custom commands.'
tags: ['ccdd', 'kdd', 'bash', 'interpreter', 'pipeline']

task: implement_bash_engine
intent: "Implement pure JavaScript Bash execution engine per the specification in bash_engine.md"
target: src/core/bash-runtime.js
signature: "class BashRuntime { constructor(vfs); exec(cmdString): Promise<{ stdout: string, stderr: string, exitCode: number }>; }"
test_command: "node tests/test_bash.js"
budget:
  max_cyclomatic_complexity: 15
tests: "tests/test_bash.js"
touch_only: ["src/core/bash-runtime.js"]
tests_sha256: "6e08d2ed05b1a319db80634fcf735b36c80b5c4a60745b66150b110799e1e09d"
deps_allowed: ["src/core/vfs.js"]
---

# CCDD Task Contract: Bash Runtime Engine

## Intent
Execute bash scripts and terminal commands entirely within client-side memory according to [bash_engine.md](../bash_engine.md).

## Interface
- Target file: `src/core/bash-runtime.js`
- Export: `BashRuntime` class.
- Methods: `exec(cmdString): Promise<{ stdout, stderr, exitCode }>`.

## Constraints
- Max cyclomatic complexity: 15.
- Touch only `src/core/bash-runtime.js`.
- Support pipes (`|`), redirections (`>`, `>>`), conditionals (`&&`, `||`), variable substitution (`$VAR`), standard utilities, and custom site commands (`about`, `install`, `github`).
