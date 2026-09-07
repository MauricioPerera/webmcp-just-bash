---
type: 'Specification'
title: 'Bash Runtime Engine'
description: 'Grammar, execution pipeline, environment model, and built-in command specifications.'
tags: ['okf', 'bash', 'interpreter', 'pipeline']
---

# Bash Runtime Engine Specification

## Execution Pipeline
1. **Lexical Parsing**: Tokenizes line into words, strings (single/double quotes), pipe operators (`|`), redirection tokens (`>`, `>>`, `<`, `2>`, `2>&1`), and chained connectors (`&&`, `||`, `;`).
2. **Variable Expansion**: Replaces `$VAR`, `${VAR}`, `$HOME`, `$PWD`, `$?`, `$$` in unquoted or double-quoted tokens.
3. **Execution Routing**:
   - Conditionals: Evaluates `cmd1 && cmd2` or `cmd1 || cmd2` according to exit code of `cmd1`.
   - Pipelines: Connects stdout of stage `i` to stdin of stage `i+1`.
   - Redirections: Intercepts stdout/stderr and routes to virtual files or pipes.
4. **Command Execution**:
   - Built-ins and Unix commands execute with `{ stdin, args, cwd, env, fs }`.
   - Returns `{ stdout: string, stderr: string, exitCode: number }`.

## Standard Built-in Utilities
- **Navigation & Environment**: `cd`, `pwd`, `echo`, `printf`, `env`, `export`, `printenv`, `whoami`, `date`, `hostname`.
- **File Management**: `ls`, `cat`, `head`, `tail`, `wc`, `touch`, `mkdir`, `rm`, `cp`, `mv`, `stat`, `tree`, `find`.
- **Text Processing**: `grep` (-i, -v, -n, -E), `sort` (-r, -n), `uniq` (-c, -d), `cut` (-d, -f), `tr`, `sed`, `awk`, `base64`.
- **Data & Shell Utilities**: `jq`, `seq`, `sleep`, `which`, `clear`, `help`, `history`, `true`, `false`.

## Custom Commands & Extensibility
- `about`: Emits project info and version metadata.
- `install`: Emits npm installation instructions.
- `github`: Returns official repository URL.
- `webmcp`: Displays current WebMCP tools registry and status.
- `agent <query>`: Triggers client-side autonomous tool-calling agent.
- `alias [name=val]` / `unalias <name>`: Create and manage persistent shell aliases.
- `defcmd <name> [--js] <code>`: Define custom shell or JavaScript commands on the fly.
- `sh <script>` / `bash <script>` / `source <script>` / `./<script>`: Execute shell and node scripts from VFS or `$PATH`.

