import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { validateContract } from '../src/core/contract-validator.js';
import { VirtualFS } from '../src/core/vfs.js';
import { BashRuntime } from '../src/core/bash-runtime.js';
import { WebMCPProvider } from '../src/core/webmcp-provider.js';

const vfs = new VirtualFS();
const readAsset = async path => new Uint8Array(await readFile(new URL(`../${path}`, import.meta.url)));
const names = (await readdir(new URL('../knowledge/contracts/', import.meta.url))).filter(n => n.endsWith('.md'));
for (const name of names) {
  const result = await validateContract(name, vfs, readAsset);
  assert.equal(result.status, 'verified');
  assert.equal(result.testsExecuted, false);
  assert.equal(result.actualSha256, result.expectedSha256);
}
const original = await readFile(new URL('../knowledge/contracts/contract-01-virtual-fs.md', import.meta.url), 'utf8');
vfs.writeFile('/tmp/contract.md', original);
vfs.writeFile('/tests/test_vfs.js', await readFile(new URL('./test_vfs.js', import.meta.url), 'utf8'));
const provider = new WebMCPProvider(vfs, new BashRuntime(vfs));
provider.initDefaultTools();
assert.equal((await provider.invokeTool('kdd_validate_contract', { contractName: '/tmp/contract.md' })).result.status, 'verified');
vfs.writeFile('/tests/test_vfs.js', 'altered');
await assert.rejects(validateContract('/tmp/contract.md', vfs), /mismatch/);
const invalidContracts = [
  'not a contract',
  original.replace(/^type:.*$/m, "type: 'Other'"),
  original.replace(/^title:.*\r?\n/m, ''),
  original.replace(/^tags:.*$/m, 'tags: []'),
  original.replace('max_cyclomatic_complexity: 12', 'max_cyclomatic_complexity: 0'),
  original.replace('tests/test_vfs.js', '../secret.js'),
  original.replace('tests/test_vfs.js', 'https://example.com/test.js'),
  original.replace(/^tests_sha256:.*$/m, 'tests_sha256: nope'),
  original.replace(/^task:/m, 'type: duplicate\ntask:'),
  original.replace(/^title:.*$/m, 'title: |'),
];
for (const content of invalidContracts) {
  vfs.writeFile('/tmp/invalid.md', content);
  await assert.rejects(validateContract('/tmp/invalid.md', vfs));
}
for (const name of ['contract-missing.md', '../contract.md', 'https://example.com/contract.md', '/missing']) {
  await assert.rejects(validateContract(name, vfs, readAsset));
}
vfs.rm('/tests/test_vfs.js');
await assert.rejects(validateContract('/tmp/contract.md', vfs), /No such file/);
await assert.rejects(validateContract(names[0], vfs, async () => new Uint8Array(1024 * 1024 + 1)), /oversized/);
await assert.rejects(validateContract(names[0], vfs, async () => { throw new Error('HTTP 503'); }), /503/);
console.log(`[Contract validator] ${names.length} real contracts, virtual invocation, tampering, malformed data, paths, missing files, size limit and load failures passed.`);
