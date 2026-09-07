import assert from 'node:assert/strict';
import { VirtualFS } from '../src/core/vfs.js';
import { BashRuntime } from '../src/core/bash-runtime.js';
import { WebMCPProvider } from '../src/core/webmcp-provider.js';
import { AgentRunner } from '../src/core/agent-runner.js';

console.log('[Test Agent] Starting AgentRunner unit tests...');

const vfs = new VirtualFS();
const bash = new BashRuntime(vfs);
const provider = new WebMCPProvider(vfs, bash);
provider.initDefaultTools();

const agent = new AgentRunner(provider);

async function run() {
  const steps = [];
  const onChunk = (chunk) => steps.push(chunk);

  // Test 1: Query about project files
  const result = await agent.runQuery('List the files in /home/user and tell me what README says', { onChunk });

  assert.ok(result.response.length > 0, 'Agent should return a response');
  assert.ok(steps.length > 0, 'Agent should stream progress chunks');
  
  // Verify that tool calls were executed during the loop
  const toolExecLogs = provider.callLogs.filter(l => l.tool === 'bash_exec' || l.tool === 'fs_list_dir' || l.tool === 'fs_read_file');
  assert.ok(toolExecLogs.length > 0, 'Agent must invoke WebMCP tools to inspect files');

  console.log('[Test Agent] All Agent test cases passed successfully.');
}

run().catch(err => {
  console.error('[Test Agent] Failed:', err);
  process.exit(1);
});
