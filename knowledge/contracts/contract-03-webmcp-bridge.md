---
type: 'Task Contract'
title: 'Implement FastWebMCP & WebMCP Standard Bridge'
description: 'Tool registry and invocation layer complying with FastWebMCP and webmcp.com standards.'
tags: ['ccdd', 'kdd', 'webmcp', 'fastwebmcp', 'tools']

task: implement_webmcp_bridge
intent: "Expose typed tools onto document.modelContext and window.webmcp per webmcp_bridge.md"
target: src/core/webmcp-provider.js
signature: "class WebMCPProvider { constructor(vfs, bash); registerImperativeTool(tool); invokeTool(name, args): Promise<object>; listTools(): Array<object>; }"
test_command: "node tests/test_webmcp.js"
budget:
  max_cyclomatic_complexity: 10
tests: "tests/test_webmcp.js"
touch_only: ["src/core/webmcp-provider.js"]
tests_sha256: "454350e6c7397b0a3d641d0b95eef6c7220b8d79c08a8449627c80e4fc6900b2"
deps_allowed: ["src/core/vfs.js", "src/core/bash-runtime.js"]
---

# CCDD Task Contract: FastWebMCP & WebMCP Bridge

## Intent
Polyfill and bridge WebMCP tools to autonomous browser agents per [webmcp_bridge.md](../webmcp_bridge.md).

## Interface
- Target file: `src/core/webmcp-provider.js`
- Export: `WebMCPProvider` class.
- Methods: `registerImperativeTool`, `invokeTool`, `listTools`, `initDefaultTools`.

## Constraints
- Max cyclomatic complexity: 10.
- Touch only `src/core/webmcp-provider.js`.
- Maintain execution telemetry and validate tool names against `^[A-Za-z0-9_.-]{1,128}$`.
