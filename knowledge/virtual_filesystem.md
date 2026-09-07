---
type: 'Data Model'
title: 'Virtual File System (VFS)'
description: 'In-memory hierarchical POSIX filesystem specification.'
tags: ['okf', 'vfs', 'filesystem', 'posix']
---

# Virtual File System Specification

## Hierarchy & Layout
- `/home/user`: Default working directory and `$HOME`.
- `/bin`: Command executables and system utilities.
- `/usr/bin`: Secondary binaries.
- `/tmp`: Temporary scratch directory.

## Node Structure
```javascript
{
  type: 'file' | 'dir',
  name: string,
  content?: string,          // UTF-8 string for files
  children?: Map<string, Node>, // Child entries for directories
  createdAt: number,
  updatedAt: number,
  mode: number               // POSIX permissions (e.g. 0o755, 0o644)
}
```

## Supported Operations
- `readFile(path: string): string`
- `writeFile(path: string, content: string): void`
- `mkdir(path: string, options?: { recursive: boolean }): void`
- `rm(path: string, options?: { recursive: boolean }): void`
- `stat(path: string): NodeStats`
- `readDir(path: string): string[]`
- `exists(path: string): boolean`
- `resolvePath(target: string, cwd: string): string`
- `walk(path: string): Array<{ path: string, type: 'file' | 'dir', size: number }>`
- `exportJSON(): string` & `importJSON(data: string): void`

## Pre-populated Seed Files
- `/home/user/README.md`: Overview of the Just-Bash project.
- `/home/user/LICENSE`: Apache-2.0 open-source license.
- `/home/user/package.json`: Simulated package manifest.
- `/home/user/AGENTS.md`: AI Agent guidelines and usage examples.
- `/home/user/wtf-is-this.md`: Humorous and technical background document.
- `/home/user/dirs/are/fun/author/info.txt`: Author metadata.
- `/home/user/src/hello.sh`: Sample bash script.
