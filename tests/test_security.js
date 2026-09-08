import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { LiteTerminal } from '../src/ui/terminal.js';
import { HTMXBridge } from '../src/ui/htmx-bridge.js';
import { VirtualFS } from '../src/core/vfs.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.doesNotMatch(html, /\son\w+\s*=/i, 'HTML must not contain inline event handlers');
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  assert.match(match[1], /\bsrc=/, 'Executable scripts must be external');
  assert.equal(match[2].trim(), '');
  const source = match[1].match(/src="([^"]+)"/)[1];
  if (source.startsWith('./')) {
    assert.ok(existsSync(new URL(`../${source}`, import.meta.url)), `Missing asset: ${source}`);
  }
}
const scriptPolicy = html.match(/script-src ([^;]+)/)[1];
assert.doesNotMatch(scriptPolicy, /unsafe-inline|unsafe-eval/);

const term = new LiteTerminal({ cwd: '/home/user/<img src=x onerror=alert(1)>' });
let promptText;
term.promptElement = {
  set innerHTML(value) { throw new Error('Prompt must never parse HTML'); },
  set textContent(value) { promptText = value; }
};
term.updatePrompt();
assert.ok(promptText.includes('<img src=x onerror=alert(1)>'));

const vfs = new VirtualFS();
const path = '/home/user/file; echo injected';
vfs.writeFile(path, 'literal file content');
const lines = [];
const bridge = Object.create(HTMXBridge.prototype);
bridge.vfs = vfs;
bridge.terminal = { writeln: value => lines.push(value) };
bridge.openVirtualEntry({ path, type: 'file' });
assert.deepEqual(lines, ['literal file content']);
assert.equal(HTMXBridge.escapeHTML('<img src=x>'), '&lt;img src=x&gt;');
console.log('[Security] Inline scripts, local assets, prompt injection and literal VFS paths checked.');
