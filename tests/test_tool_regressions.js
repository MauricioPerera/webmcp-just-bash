import assert from 'node:assert/strict';
import { VirtualFS } from '../src/core/vfs.js';
import { BashRuntime } from '../src/core/bash-runtime.js';
import { WebMCPProvider } from '../src/core/webmcp-provider.js';

const vfs = new VirtualFS();
const bash = new BashRuntime(vfs);
const provider = new WebMCPProvider(vfs, bash);
provider.initDefaultTools();
const call = (name, args) => provider.invokeTool(name, args);
for (const name of ['bash_exec', 'fs_mkdir', 'fs_stat', 'kdd_validate_contract']) {
  assert.equal((await call(name, {})).status, 'error');
}
for (const args of [null, [], 'text', 12]) {
  assert.equal((await call('bash_list_commands', args)).status, 'error');
}
vfs.writeFile('/tmp/original', 'keep');
assert.equal((await call('fs_write_file', { path: '/tmp/original' })).status, 'error');
assert.equal(vfs.readFile('/tmp/original'), 'keep');
assert.equal((await call('fs_write_file', { path: '/tmp/original', content: 123 })).status, 'error');
assert.equal(vfs.readFile('/tmp/original'), 'keep');
assert.equal((await call('fs_write_file', { path: '/tmp/unicode', content: 'á😀' })).result.bytesWritten, 6);
assert.equal((await call('fs_mkdir', { path: '/tmp/invalid/child', recursive: 'false' })).status, 'error');
assert.equal(vfs.exists('/tmp/invalid'), false);
assert.equal((await call('kdd_validate_contract', { contractName: 'nonexistent.md' })).status, 'error');
assert.equal((await call('bash_register_command', { name: '../tmp/escape', type: 'bash', code: 'echo x' })).status, 'error');
assert.equal(vfs.exists('/tmp/escape'), false);
vfs.mkdir('/bin/collision');
assert.equal((await call('bash_register_command', { name: 'collision', type: 'bash', code: 'echo x' })).status, 'error');
assert.equal(bash.customCommands.has('collision'), false);
assert.equal((await call('bash_register_command', { name: 'safe', type: 'bash', code: 'echo "$1"' })).status, 'success');
const payloads = ['hello; echo injected > /tmp/injected', ';', '|', '>', '$HOME', '"; echo injected', "it's literal", 'á😀'];
await Promise.all(payloads.map(async value => {
  const result = await bash.customCommands.get('safe')([value]);
  assert.equal(result.stdout, value + '\n');
}));
assert.equal(vfs.exists('/tmp/injected'), false);
assert.ok((await call('bash_list_commands', {})).result.builtins.includes('echo'));
for (let i = 0; i < 1000; i++) await call('fs_read_file', { path: '/missing' });
assert.equal(provider.callLogs.length, 50);
await call('fs_stat', { path: '/tmp' });
assert.equal(provider.callLogs.length, 50);
console.log('[Tool regressions] Schema, atomicity, UTF-8, invalid KDD input, registration, argument isolation and bounded logs passed.');
