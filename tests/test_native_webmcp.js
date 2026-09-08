import assert from 'node:assert/strict';
import { VirtualFS } from '../src/core/vfs.js';
import { BashRuntime } from '../src/core/bash-runtime.js';
import { WebMCPProvider } from '../src/core/webmcp-provider.js';

const registered = new Map();
const context = {
  async registerTool(tool) { assert.ok(!registered.has(tool.name)); registered.set(tool.name, tool); },
  async unregisterTool(name) { registered.delete(name); }
};
globalThis.document = { modelContext: context };
try {
  const vfs = new VirtualFS();
  const provider = new WebMCPProvider(vfs, new BashRuntime(vfs));
  provider.initDefaultTools();
  await Promise.all(provider.nativeRegistrations.values());
  assert.equal(document.modelContext, context, 'native context must not be overwritten');
  assert.equal(registered.size, 9);
  assert.equal(registered.has('kdd_validate_contract'), true);
  const write = registered.get('fs_write_file').execute;
  await write({ path: '/tmp/native', content: 'original' });
  await assert.rejects(write({ path: '/tmp/native' }), /content/);
  assert.equal(vfs.readFile('/tmp/native'), 'original');
  assert.equal((await registered.get('fs_read_file').execute({ path: '/tmp/native' })).content, 'original');
  provider.registerImperativeTool({ name: 'run_bash', declarative: true, execute: async () => ({}) });
  assert.equal(registered.has('run_bash'), false, 'declarative registration belongs to browser');
  provider.registerImperativeTool({ name: 'fs_stat', execute: async () => 'replacement' });
  await Promise.all(provider.nativeRegistrations.values());
  assert.equal(await registered.get('fs_stat').execute({}), 'replacement');
} finally {
  delete globalThis.document;
}
console.log('[Native WebMCP] Registration, errors, no native shadowing, replacement and no form duplicates passed.');
