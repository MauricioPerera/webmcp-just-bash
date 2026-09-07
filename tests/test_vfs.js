import assert from 'node:assert/strict';
import { VirtualFS } from '../src/core/vfs.js';

console.log('[Test VFS] Starting unit tests...');

const vfs = new VirtualFS();

// Test 1: Seed files exist
assert.equal(vfs.exists('/home/user/README.md'), true, 'README.md should exist');
assert.equal(vfs.exists('/home/user/package.json'), true, 'package.json should exist');
assert.equal(vfs.exists('/home/user/LICENSE'), true, 'LICENSE should exist');
const readme = vfs.readFile('/home/user/README.md');
assert.ok(readme.includes('just-bash'), 'README content mismatch');

// Test 2: Writing and reading a file
vfs.writeFile('/home/user/test.txt', 'Hello Just-Bash!');
assert.equal(vfs.readFile('/home/user/test.txt'), 'Hello Just-Bash!');

// Test 3: Path resolution
assert.equal(vfs.resolvePath('test.txt', '/home/user'), '/home/user/test.txt');
assert.equal(vfs.resolvePath('../test.txt', '/home/user'), '/home/test.txt');
assert.equal(vfs.resolvePath('/tmp/file.log', '/home/user'), '/tmp/file.log');

// Test 4: Creating directories
vfs.mkdir('/home/user/nested/dir', { recursive: true });
assert.equal(vfs.exists('/home/user/nested/dir'), true);

// Test 5: Listing directory entries
const entries = vfs.readDir('/home/user');
assert.ok(entries.includes('test.txt'));
assert.ok(entries.includes('README.md'));
assert.ok(entries.includes('nested'));

// Test 6: File removal
vfs.rm('/home/user/test.txt');
assert.equal(vfs.exists('/home/user/test.txt'), false);

// Test 7: Stat
const stat = vfs.stat('/home/user/README.md');
assert.equal(stat.type, 'file');
assert.ok(stat.size > 0);

// Test 8: Tree / walk
const walked = vfs.walk('/home/user');
assert.ok(walked.length > 3);

console.log('[Test VFS] All 8 VFS test cases passed successfully.');
