/**
 * vfs.js - Virtual In-Memory POSIX File System
 * Conforms to CCDD Contract 01 (contract-01-virtual-fs.md)
 */

export class VirtualFS {
  constructor() {
    this.root = this._createDirNode('');
    this.listeners = new Map();
    this._initStandardLayout();
    this._seedDefaultFiles();
  }

  _createDirNode(name) {
    return {
      type: 'dir',
      name,
      children: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mode: 0o755
    };
  }

  _createFileNode(name, content = '') {
    return {
      type: 'file',
      name,
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mode: 0o644
    };
  }

  _initStandardLayout() {
    this.mkdir('/home/user', { recursive: true });
    this.mkdir('/bin', { recursive: true });
    this.mkdir('/usr/bin', { recursive: true });
    this.mkdir('/tmp', { recursive: true });
  }

  _seedDefaultFiles() {
    this.writeFile('/home/user/README.md', `# just-bash (Client-Side Edition)

A simulated bash environment with an in-memory virtual filesystem.
Designed for AI agents needing a secure, sandboxed bash environment.

## Features
- Pure TypeScript / JavaScript implementation
- In-memory virtual filesystem
- FastWebMCP & webmcp.com standards compliant
- 100% Client-Side for GitHub Pages
- Interactive terminal powered by Tailwind CSS & HTMX
`);

    this.writeFile('/home/user/LICENSE', `Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/
`);

    this.writeFile('/home/user/package.json', JSON.stringify({
      name: "just-bash-web",
      version: "3.4.2",
      description: "Sandboxed bash interpreter with WebMCP tools",
      main: "src/main.js",
      scripts: {
        test: "node tests/run_all_tests.js"
      },
      dependencies: {
        "fastwebmcp": "^0.4.2",
        "htmx.org": "^2.0.4",
        "tailwindcss": "^4.0.0"
      }
    }, null, 2));

    this.writeFile('/home/user/AGENTS.md', `# AI Agent Guidelines

You are interacting with a virtual in-memory bash sandbox.
All file reads, writes, and pipelines execute inside the browser memory.

### Standard Commands Available
- \`ls\`, \`cat\`, \`grep\`, \`wc\`, \`head\`, \`tail\`, \`awk\`, \`sed\`, \`jq\`, \`tree\`, \`find\`
- Custom commands: \`about\`, \`install\`, \`github\`, \`webmcp\`, \`agent <query>\`
`);

    this.writeFile('/home/user/wtf-is-this.md', `# WTF is this?

This is a 100% client-side replica of justbash.dev, running an in-browser bash simulator
with WebMCP tools enabled!
`);

    this.mkdir('/home/user/dirs/are/fun/author', { recursive: true });
    this.writeFile('/home/user/dirs/are/fun/author/info.txt', 'https://github.com/vercel-labs/just-bash\n');

    this.mkdir('/home/user/src', { recursive: true });
    this.writeFile('/home/user/src/hello.sh', `#!/usr/bin/env bash
echo "Hello from Just-Bash client sandbox!"
date
whoami
`);

    this.mkdir('/home/user/data', { recursive: true });
    this.writeFile('/home/user/data/stats.json', JSON.stringify({
      users: 1042,
      activeSessions: 38,
      status: "online",
      region: "client-edge"
    }, null, 2));
  }

  // Event dispatching for HTMX / UI reactivity
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try { cb(data); } catch (e) { console.error('VFS listener error:', e); }
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`vfs:${event}`, { detail: data }));
    }
  }

  resolvePath(target, cwd = '/home/user') {
    if (!target) return cwd;
    let absolute = target.startsWith('/') ? target : `${cwd}/${target}`;
    const segments = absolute.split('/').filter(Boolean);
    const resolved = [];

    for (const seg of segments) {
      if (seg === '.') continue;
      if (seg === '..') {
        if (resolved.length > 0) resolved.pop();
      } else {
        resolved.push(seg);
      }
    }

    return '/' + resolved.join('/');
  }

  _getNode(absolutePath) {
    if (absolutePath === '/' || absolutePath === '') return this.root;
    const parts = absolutePath.split('/').filter(Boolean);
    let curr = this.root;

    for (const p of parts) {
      if (curr.type !== 'dir' || !curr.children) return null;
      curr = curr.children.get(p);
      if (!curr) return null;
    }
    return curr;
  }

  exists(path, cwd = '/home/user') {
    return this._getNode(this.resolvePath(path, cwd)) !== null;
  }

  readFile(path, cwd = '/home/user') {
    const abs = this.resolvePath(path, cwd);
    const node = this._getNode(abs);
    if (!node) throw new Error(`cat: ${path}: No such file or directory`);
    if (node.type === 'dir') throw new Error(`cat: ${path}: Is a directory`);
    return node.content;
  }

  writeFile(path, content, cwd = '/home/user') {
    const abs = this.resolvePath(path, cwd);
    const parts = abs.split('/').filter(Boolean);
    if (parts.length === 0) throw new Error('Cannot write to root directory');

    const fileName = parts.pop();
    const dirPath = '/' + parts.join('/');
    let dir = this._getNode(dirPath);

    if (!dir) {
      this.mkdir(dirPath, { recursive: true });
      dir = this._getNode(dirPath);
    }

    if (dir.type !== 'dir') throw new Error(`Not a directory: ${dirPath}`);

    const existing = dir.children.get(fileName);
    if (existing) {
      if (existing.type === 'dir') throw new Error(`${path}: Is a directory`);
      existing.content = String(content);
      existing.updatedAt = Date.now();
    } else {
      const newFile = this._createFileNode(fileName, String(content));
      dir.children.set(fileName, newFile);
    }

    this.emit('change', { type: 'write', path: abs });
  }

  mkdir(path, options = {}, cwd = '/home/user') {
    const abs = this.resolvePath(path, cwd);
    if (abs === '/') return;
    const parts = abs.split('/').filter(Boolean);
    let curr = this.root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      let next = curr.children.get(part);

      if (!next) {
        if (i < parts.length - 1 && !options.recursive) {
          throw new Error(`mkdir: cannot create directory '${path}': No such file or directory`);
        }
        next = this._createDirNode(part);
        curr.children.set(part, next);
      } else if (next.type !== 'dir') {
        throw new Error(`mkdir: cannot create directory '${path}': Not a directory`);
      }
      curr = next;
    }

    this.emit('change', { type: 'mkdir', path: abs });
  }

  rm(path, options = {}, cwd = '/home/user') {
    const abs = this.resolvePath(path, cwd);
    if (abs === '/') throw new Error('rm: cannot remove root directory');

    const parts = abs.split('/').filter(Boolean);
    const name = parts.pop();
    const parentDir = this._getNode('/' + parts.join('/'));

    if (!parentDir || !parentDir.children || !parentDir.children.has(name)) {
      if (options.force) return;
      throw new Error(`rm: cannot remove '${path}': No such file or directory`);
    }

    const target = parentDir.children.get(name);
    if (target.type === 'dir' && !options.recursive) {
      throw new Error(`rm: cannot remove '${path}': Is a directory`);
    }

    parentDir.children.delete(name);
    this.emit('change', { type: 'rm', path: abs });
  }

  readDir(path, cwd = '/home/user') {
    const abs = this.resolvePath(path, cwd);
    const node = this._getNode(abs);
    if (!node) throw new Error(`ls: cannot access '${path}': No such file or directory`);
    if (node.type !== 'dir') throw new Error(`ls: ${path}: Not a directory`);
    return Array.from(node.children.keys()).sort();
  }

  stat(path, cwd = '/home/user') {
    const abs = this.resolvePath(path, cwd);
    const node = this._getNode(abs);
    if (!node) throw new Error(`stat: cannot stat '${path}': No such file or directory`);

    return {
      name: node.name,
      path: abs,
      type: node.type,
      size: node.type === 'file' ? (node.content ? node.content.length : 0) : node.children.size,
      mode: node.mode,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt
    };
  }

  walk(startPath = '/', cwd = '/home/user') {
    const abs = this.resolvePath(startPath, cwd);
    const results = [];

    const traverse = (node, currentPath) => {
      const pathStr = currentPath || '/';
      results.push({
        path: pathStr,
        name: node.name || '/',
        type: node.type,
        size: node.type === 'file' ? (node.content ? node.content.length : 0) : node.children.size
      });

      if (node.type === 'dir' && node.children) {
        for (const child of node.children.values()) {
          const childPath = currentPath === '/' ? `/${child.name}` : `${currentPath}/${child.name}`;
          traverse(child, childPath);
        }
      }
    };

    const rootNode = this._getNode(abs);
    if (rootNode) traverse(rootNode, abs === '/' ? '/' : abs);
    return results;
  }

  exportJSON() {
    return JSON.stringify(this.walk('/'), null, 2);
  }
}
