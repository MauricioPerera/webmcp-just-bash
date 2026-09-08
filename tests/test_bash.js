import assert from 'node:assert/strict';
import { VirtualFS } from '../src/core/vfs.js';
import { BashRuntime } from '../src/core/bash-runtime.js';

console.log('[Test Bash] Starting Bash Engine unit tests...');

const vfs = new VirtualFS();
const bash = new BashRuntime(vfs);

async function run() {
  // Test 1: Simple echo
  let res = await bash.exec('echo "Hello World"');
  assert.equal(res.exitCode, 0);
  assert.equal(res.stdout.trim(), 'Hello World');

  // Test 2: Redirection > and cat
  res = await bash.exec('echo "line 1\nline 2" > myfile.txt');
  assert.equal(res.exitCode, 0);
  res = await bash.exec('cat myfile.txt');
  assert.equal(res.exitCode, 0);
  assert.ok(res.stdout.includes('line 1'));

  // Test 3: Pipe and grep
  res = await bash.exec('cat myfile.txt | grep "line 2"');
  assert.equal(res.exitCode, 0);
  assert.equal(res.stdout.trim(), 'line 2');

  // Invalid regular expressions must behave as command errors, never throw.
  res = await bash.exec('grep "[" myfile.txt');
  assert.equal(res.exitCode, 2);
  assert.match(res.stderr, /invalid regular expression/);

  res = await bash.exec('sed "s/[//" < myfile.txt');
  assert.equal(res.exitCode, 2);
  assert.match(res.stderr, /invalid regular expression/);

  // Test 4: Pipe and wc -l
  res = await bash.exec('cat myfile.txt | wc -l');
  assert.equal(res.exitCode, 0);
  assert.equal(res.stdout.trim(), '2');

  // Test 5: Conditionals && and ||
  res = await bash.exec('true && echo success');
  assert.equal(res.stdout.trim(), 'success');
  res = await bash.exec('false || echo fallback');
  assert.equal(res.stdout.trim(), 'fallback');

  // Test 6: Environment variables
  res = await bash.exec('export GREETING="hola" && echo $GREETING');
  assert.equal(res.stdout.trim(), 'hola');

  // Test 7: JQ JSON parsing
  res = await bash.exec('echo \'{"status": "ok", "code": 200}\' | jq .status');
  assert.equal(res.exitCode, 0);
  assert.ok(res.stdout.includes('ok'));

  // Test 8: Custom site commands (about, install, github)
  res = await bash.exec('about');
  assert.equal(res.exitCode, 0);
  assert.ok(res.stdout.includes('just-bash'));

  res = await bash.exec('install');
  assert.equal(res.exitCode, 0);
  assert.ok(res.stdout.includes('npm install just-bash'));

  res = await bash.exec('github');
  assert.equal(res.exitCode, 0);
  assert.ok(res.stdout.includes('github.com/vercel-labs/just-bash'));

  console.log('[Test Bash] All 8 Bash Engine test cases passed successfully.');
}

run().catch(err => {
  console.error('[Test Bash] Failed:', err);
  process.exit(1);
});
