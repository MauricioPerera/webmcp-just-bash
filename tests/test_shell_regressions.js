import assert from 'node:assert/strict';
import { VirtualFS } from '../src/core/vfs.js';
import { BashRuntime } from '../src/core/bash-runtime.js';
import { WebMCPProvider } from '../src/core/webmcp-provider.js';
const vfs = new VirtualFS();
const bash = new BashRuntime(vfs);
const provider = new WebMCPProvider(vfs, bash);
provider.initDefaultTools();
for (const value of [';', '>', '>>', '<', '|', '&&', '||', '&', '', '$HOME', 'two words']) {
  const result = await bash.exec(`echo '${value}'`);
  assert.equal(result.stdout, value + '\n');
  assert.equal(result.exitCode, 0);
}
assert.equal((await bash.exec("echo '>' /tmp/literal")).stdout, '> /tmp/literal\n');
assert.equal(vfs.exists('/tmp/literal'), false);
assert.equal((await bash.exec('echo \\;')).stdout, ';\n');
assert.equal((await bash.exec('echo \\$HOME')).stdout, '$HOME\n');
assert.equal((await bash.exec('echo "unterminated')).exitCode, 2);
await provider.invokeTool('bash_register_command', { name: 'safe', type: 'bash', code: 'echo "$1"' });
await bash.exec("defcmd legacy 'echo $1'");
for (const command of ['safe', 'sh /bin/safe', 'bash /bin/safe', '/bin/safe', 'legacy', 'source /bin/safe', '. /bin/safe']) {
  const value = 'hello; echo injected > /tmp/injected';
  const result = await bash.exec(`${command} '${value}'`);
  assert.equal(result.stdout, value + '\n', command);
  assert.equal(vfs.exists('/tmp/injected'), false);
}
await provider.invokeTool('bash_register_command', { name: 'multi', type: 'bash', code: 'echo first\necho second' });
assert.equal((await bash.exec('multi')).stdout, 'first\nsecond\n');
assert.equal((await bash.exec('sh /bin/multi')).stdout, 'first\nsecond\n');
vfs.writeFile('/tmp/environment.sh', 'export SOURCE_CHECK=changed');
await bash.exec('sh /tmp/environment.sh');
assert.equal(bash.env.SOURCE_CHECK, undefined);
await bash.exec('source /tmp/environment.sh');
assert.equal(bash.env.SOURCE_CHECK, 'changed');
assert.equal(bash.positionalArgs, undefined);
assert.equal((await bash.exec('echo first # comment\necho second')).stdout, 'first\nsecond\n');
assert.equal((await bash.exec("echo 'a\nb'")).stdout, 'a\nb\n');
vfs.writeFile('/tmp/lines', 'a\n\nb\n');
assert.equal((await bash.exec('cat /tmp/lines | wc -l')).stdout.trim(), '3');
vfs.writeFile('/tmp/unicode', 'á😀');
assert.equal((await bash.exec('cat /tmp/unicode | wc -c')).stdout.trim(), '6');
assert.equal((await bash.exec('cat /tmp/unicode | wc -l')).stdout.trim(), '0');
await Promise.all(Array.from({ length: 100 }, async (_, i) => {
  assert.equal((await bash.exec(`sh /bin/safe '${i}'`)).stdout, `${i}\n`);
}));
for (let i = 0; i < 2500; i++) {
  const path = `/tmp/load/${i}`;
  assert.equal((await provider.invokeTool('fs_write_file', { path, content: String(i) })).status, 'success');
  assert.equal((await provider.invokeTool('fs_read_file', { path })).result.content, String(i));
  assert.equal((await provider.invokeTool('fs_stat', { path })).result.type, 'file');
  assert.equal((await provider.invokeTool('fs_read_file', { path: '/missing' })).status, 'error');
}
assert.equal(provider.callLogs.length, 50);
assert.equal(vfs.readDir('/tmp/load').length, 2500);
console.log('[Shell regressions] Quoted operators, scripts, safe arguments, newlines, counts, 100 concurrent scripts and 10000 mixed calls passed.');
