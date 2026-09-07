import assert from 'node:assert/strict';
import { VirtualFS } from '../src/core/vfs.js';
import { BashRuntime } from '../src/core/bash-runtime.js';
import { WebMCPProvider } from '../src/core/webmcp-provider.js';

console.log('[Test WebMCP] Starting WebMCP bridge tests...');

const vfs = new VirtualFS();
const bash = new BashRuntime(vfs);
const provider = new WebMCPProvider(vfs, bash);
provider.initDefaultTools();

async function run() {
  // Test 1: Registry check
  const tools = provider.listTools();
  assert.ok(tools.length >= 5, 'Should have at least 5 default tools');
  const toolNames = tools.map(t => t.name);
  assert.ok(toolNames.includes('bash_exec'), 'Must have bash_exec');
  assert.ok(toolNames.includes('fs_read_file'), 'Must have fs_read_file');
  assert.ok(toolNames.includes('fs_write_file'), 'Must have fs_write_file');
  assert.ok(toolNames.includes('fs_list_dir'), 'Must have fs_list_dir');

  // Test 2: Invoke bash_exec
  const execRes = await provider.invokeTool('bash_exec', { command: 'echo "FastWebMCP"' });
  assert.equal(execRes.status, 'success');
  assert.equal(execRes.result.exitCode, 0);
  assert.equal(execRes.result.stdout.trim(), 'FastWebMCP');

  // Test 3: Invoke fs_write_file and fs_read_file
  await provider.invokeTool('fs_write_file', { path: '/home/user/mcp.txt', content: 'WebMCP Standard' });
  const readRes = await provider.invokeTool('fs_read_file', { path: '/home/user/mcp.txt' });
  assert.equal(readRes.status, 'success');
  assert.equal(readRes.result.content, 'WebMCP Standard');

  // Test 4: Tool name validation ([A-Za-z0-9_.-]{1,128})
  assert.throws(() => {
    provider.registerImperativeTool({ name: 'invalid name with spaces' });
  }, /Invalid tool name/);

  // Test 5: Telemetry logs
  assert.ok(provider.callLogs.length >= 3);
  assert.equal(provider.callLogs[0].status, 'success');

  console.log('[Test WebMCP] All 5 WebMCP test cases passed successfully.');
}

run().catch(err => {
  console.error('[Test WebMCP] Failed:', err);
  process.exit(1);
});
