---
type: 'Task Contract'
title: 'Implement Virtual POSIX File System'
description: 'In-memory hierarchical file system supporting read, write, directory traversal, and change notifications.'
tags: ['ccdd', 'kdd', 'vfs', 'storage']

task: implement_virtual_fs
intent: "Implement an in-memory POSIX filesystem per the specification in virtual_filesystem.md"
target: src/core/vfs.js
signature: "class VirtualFS { readFile(p); writeFile(p, c); mkdir(p, opts); rm(p, opts); stat(p); readDir(p); resolvePath(p, cwd); walk(p); }"
test_command: "node tests/test_vfs.js"
budget:
  max_cyclomatic_complexity: 12
tests: "tests/test_vfs.js"
touch_only: ["src/core/vfs.js"]
tests_sha256: "f02ab12064f7ce072d4a7f4345d6c02bade1313481f00b601fb91a93771ae451"
deps_allowed: []
---

# CCDD Task Contract: Virtual File System

## Intent
Provide an in-memory POSIX-compliant virtual filesystem satisfying all requirements documented in [virtual_filesystem.md](../virtual_filesystem.md).

## Interface
- Target file: `src/core/vfs.js`
- Export: `VirtualFS` class.
- Methods: `readFile`, `writeFile`, `mkdir`, `rm`, `stat`, `readDir`, `resolvePath`, `walk`, `exists`, `on`, `emit`.

## Constraints
- Max cyclomatic complexity: 12.
- Touch only `src/core/vfs.js`.
- Zero host filesystem or node native dependencies; must run purely in the browser.
