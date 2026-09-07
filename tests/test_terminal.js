import assert from 'node:assert/strict';
import { LiteTerminal } from '../src/ui/terminal.js';
import { VirtualFS } from '../src/core/vfs.js';
import { BashRuntime } from '../src/core/bash-runtime.js';

console.log('[Test Terminal] Starting LiteTerminal unit tests...');

const vfs = new VirtualFS();
const bash = new BashRuntime(vfs);
const term = new LiteTerminal({ cwd: '/home/user', vfs, bash });

// Test 1: Terminal initialization
assert.ok(term);
assert.equal(term.cwd, '/home/user');

// Test 2: Input and History
term.historyPush('echo 1');
term.historyPush('echo 2');
assert.equal(term.history.length, 2);
assert.equal(term.historyPrevious(), 'echo 2');
assert.equal(term.historyPrevious(), 'echo 1');
assert.equal(term.historyNext(), 'echo 2');

// Test 3: Autocomplete suggestions
const matches = term.getCompletions('cat READ');
assert.ok(matches.length > 0);
assert.ok(matches[0].includes('README.md'));

const cmdMatches = term.getCompletions('ab');
assert.ok(cmdMatches.includes('about'));

// Test 4: ANSI stripping / sanitization
const stripped = LiteTerminal.stripAnsi('\x1b[32mHello\x1b[0m World');
assert.equal(stripped, 'Hello World');

console.log('[Test Terminal] All 4 Terminal test cases passed successfully.');
