---
type: 'Specification'
title: 'FastWebMCP & WebMCP Standard Bridge'
description: 'Integration specification for FastWebMCP and webmcp.com standards on document.modelContext.'
tags: ['okf', 'webmcp', 'fastwebmcp', 'tools', 'ai-agent']
---

# FastWebMCP & WebMCP Standard Bridge

## Overview
Conforms to the specifications defined by [FastWebMCP](https://mauricioperera.github.io/fastwebmcp/) and the [webmcp.com](https://webmcp.com) directory standard.
Exposes a polyfill on `document.modelContext` and `window.webmcp`.

## Standard Interface
```typescript
interface WebMCPRuntime {
  isPolyfill: boolean;
  version: string;
  spec: 'https://webmcp.com';
  tools: Map<string, ToolDefinition>;
  registerTool(tool: ToolDefinition): ToolDefinition;
  listTools(): ToolSummary[];
  getTool(name: string): ToolDefinition | null;
  invokeTool(name: string, args: Record<string, any>): Promise<ToolResult>;
}
```

## Default Tools Registered
1. `bash_exec`:
   - Schema: `{ command: { type: 'string', description: 'Bash command line' } }`
   - Returns: `{ stdout: string, stderr: string, exitCode: number }`
2. `fs_read_file`:
   - Schema: `{ path: { type: 'string', description: 'Virtual path' } }`
   - Returns: `{ content: string, size: number }`
3. `fs_write_file`:
   - Schema: `{ path: { type: 'string' }, content: { type: 'string' } }`
   - Returns: `{ success: boolean, path: string }`
4. `fs_list_dir`:
   - Schema: `{ path: { type: 'string', default: '.' } }`
   - Returns: `{ entries: string[], total: number }`
5. `fs_stat`:
   - Schema: `{ path: { type: 'string' } }`
   - Returns: `{ type: 'file' | 'dir', size: number, updatedAt: number }`
6. `kdd_validate_contract`:
   - Schema: `{ contractPath: { type: 'string' } }`
   - Returns: `{ valid: boolean, errors: string[] }`

## Declarative WebMCP Forms
Supports DOM discovery of forms tagged with:
```html
<form toolname="run_bash" tooldescription="Execute a bash command in virtual sandbox">
  <input name="command" toolparamdescription="Bash command string" />
</form>
```
When submitted, invokes the corresponding tool through `document.modelContext`.
