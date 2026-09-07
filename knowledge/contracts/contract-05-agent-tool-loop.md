---
type: 'Task Contract'
title: 'Implement Autonomous Agent Tool Loop'
description: 'Tool-calling agent runner executing multi-step queries with real-time streaming.'
tags: ['ccdd', 'kdd', 'agent', 'tool-loop', 'webmcp']

task: implement_agent_tool_loop
intent: "Implement autonomous agent capable of calling WebMCP tools in a multi-step loop per architecture.md"
target: src/core/agent-runner.js
signature: "class AgentRunner { constructor(webmcpProvider); runQuery(query, opts): Promise<{ response: string, steps: Array<object> }>; }"
test_command: "node tests/test_agent.js"
budget:
  max_cyclomatic_complexity: 12
tests: "tests/test_agent.js"
touch_only: ["src/core/agent-runner.js"]
tests_sha256: "765ad1915a51061bf32c06699b62049b4cbf989776bfff8acb5dca782fa4d0da"
deps_allowed: ["src/core/webmcp-provider.js"]
---

# CCDD Task Contract: Autonomous Agent Tool Loop

## Intent
Enable the `agent` terminal command to explore the virtual environment and answer complex queries per [architecture.md](../architecture.md).

## Interface
- Target file: `src/core/agent-runner.js`
- Export: `AgentRunner` class.
- Methods: `runQuery(query, { onChunk, maxSteps }): Promise<{ response, steps }>`.

## Constraints
- Max cyclomatic complexity: 12.
- Touch only `src/core/agent-runner.js`.
- Support streaming reasoning chunks and multi-turn tool execution (`bash_exec`, `fs_read_file`, `fs_list_dir`).
