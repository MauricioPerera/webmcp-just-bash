/**
 * terminal.js - LiteTerminal UI Component with ANSI Rendering and Autocomplete
 * Conforms to CCDD Contract 04 (contract-04-terminal-ui.md)
 */

export class LiteTerminal {
  constructor(options = {}) {
    this.vfs = options.vfs;
    this.bash = options.bash;
    this.cwd = options.cwd || (this.bash ? this.bash.cwd : '/home/user');
    this.history = [];
    this.historyIndex = -1;
    this.currentLine = '';
    this.cursorPos = 0;
    this.container = null;
    this.outputElement = null;
    this.inputLineElement = null;
    this.promptElement = null;
    this.buffer = [];
    this.isExecuting = false;
    this.onCommand = options.onCommand || (async (cmd) => {
      if (this.bash) return await this.bash.exec(cmd);
      return { stdout: '', stderr: '', exitCode: 0 };
    });
  }

  static stripAnsi(str) {
    if (!str) return '';
    return str
      // Strip OSC 8 hyperlinks & terminal control
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
      // Strip CSI ANSI escape codes
      .replace(/\x1b\[[0-9;?]*[A-Za-z@~]/g, '')
      .replace(/\x1b[@-_]/g, '');
  }

  static ansiToHtml(str) {
    if (!str) return '';
    let text = str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Standard ANSI color codes mapping to Tailwind/Terminal styles
    text = text
      .replace(/\x1b\[0m/g, '</span>')
      .replace(/\x1b\[1m/g, '<span class="font-bold text-white">')
      .replace(/\x1b\[2m/g, '<span class="opacity-60">')
      .replace(/\x1b\[31m/g, '<span class="text-red-400">')
      .replace(/\x1b\[32m/g, '<span class="text-emerald-400">')
      .replace(/\x1b\[33m/g, '<span class="text-amber-300">')
      .replace(/\x1b\[34m/g, '<span class="text-blue-400">')
      .replace(/\x1b\[35m/g, '<span class="text-purple-400">')
      .replace(/\x1b\[36m/g, '<span class="text-cyan-400">')
      .replace(/\x1b\[37m/g, '<span class="text-gray-200">')
      .replace(/\x1b\[90m/g, '<span class="text-gray-500">')
      .replace(/\x1b\[96m/g, '<span class="text-teal-300">');

    // Clean remaining unhandled codes
    text = LiteTerminal.stripAnsi(text);
    return text;
  }

  historyPush(cmd) {
    if (cmd && cmd.trim()) {
      if (this.history[this.history.length - 1] !== cmd) {
        this.history.push(cmd);
      }
    }
    this.historyIndex = this.history.length;
  }

  historyPrevious() {
    if (this.history.length === 0) return null;
    if (this.historyIndex > 0) {
      this.historyIndex--;
    }
    return this.history[this.historyIndex] || null;
  }

  historyNext() {
    if (this.history.length === 0) return null;
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      return this.history[this.historyIndex];
    } else {
      this.historyIndex = this.history.length;
      return '';
    }
  }

  getCompletions(input) {
    const trimmed = input.trimStart();
    const parts = trimmed.split(/\s+/);
    const builtins = new Set([
      'about', 'agent', 'alias', 'awk', 'base64', 'bash', 'cat', 'cd', 'chmod',
      'clear', 'cp', 'cut', 'date', 'defcmd', 'echo', 'env', 'export', 'false',
      'find', 'github', 'grep', 'head', 'help', 'history', 'install', 'jq', 'ls',
      'mkdir', 'mv', 'printf', 'pwd', 'rm', 'sed', 'seq', 'sh', 'sleep', 'sort',
      'source', 'stat', 'tail', 'touch', 'tr', 'tree', 'true', 'unalias', 'uniq',
      'wc', 'webmcp', 'which', 'whoami'
    ]);

    if (this.bash) {
      if (this.bash.customCommands) {
        for (const k of this.bash.customCommands.keys()) builtins.add(k);
      }
      if (this.bash.aliases) {
        for (const k of this.bash.aliases.keys()) builtins.add(k);
      }
    }
    if (this.vfs) {
      try {
        if (this.vfs.exists('/bin')) {
          for (const f of this.vfs.readDir('/bin')) builtins.add(f);
        }
      } catch (e) {}
    }

    if (parts.length <= 1 && !trimmed.endsWith(' ')) {
      const prefix = parts[0] || '';
      return Array.from(builtins).filter(c => c.startsWith(prefix)).sort();
    }

    // Path completions from VFS
    if (this.vfs) {
      const lastToken = parts[parts.length - 1] || '';
      const isAbsolute = lastToken.startsWith('/');
      let searchDir = this.cwd;
      let filePrefix = lastToken;

      if (lastToken.includes('/')) {
        const slashIdx = lastToken.lastIndexOf('/');
        const dirPart = lastToken.slice(0, slashIdx);
        filePrefix = lastToken.slice(slashIdx + 1);
        searchDir = this.vfs.resolvePath(dirPart, this.cwd);
      }

      try {
        if (this.vfs.exists(searchDir)) {
          const entries = this.vfs.readDir(searchDir);
          return entries
            .filter(e => e.startsWith(filePrefix))
            .map(e => {
              const full = isAbsolute || lastToken.includes('/')
                ? (lastToken.slice(0, lastToken.lastIndexOf('/') + 1) + e)
                : e;
              const isDir = this.vfs.stat(`${searchDir}/${e}`).type === 'dir';
              return isDir ? `${full}/` : full;
            });
        }
      } catch (e) {}
    }

    return [];
  }

  mount(container) {
    this.container = container;
    this.container.innerHTML = `
      <div class="lite-terminal-wrapper font-mono text-sm leading-relaxed p-4 h-full flex flex-col select-text">
        <div class="terminal-output flex-1 overflow-y-auto space-y-1 mb-2 pr-1 font-mono"></div>
        <div class="terminal-input-row flex items-center gap-2 pt-2 border-t border-gray-800/80">
          <span class="terminal-prompt text-teal-400 font-semibold select-none whitespace-nowrap"></span>
          <div class="relative flex-1 flex items-center">
            <input type="text" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"
              class="terminal-input w-full bg-transparent outline-none text-gray-100 caret-teal-400 font-mono" />
          </div>
        </div>
      </div>
    `;

    this.outputElement = this.container.querySelector('.terminal-output');
    this.inputLineElement = this.container.querySelector('.terminal-input');
    this.promptElement = this.container.querySelector('.terminal-prompt');

    this.updatePrompt();
    this._attachEvents();
    this.focus();
  }

  updatePrompt() {
    const cwd = this.bash ? this.bash.cwd : this.cwd;
    const displayCwd = cwd === '/home/user' ? '~' : (cwd.startsWith('/home/user/') ? '~' + cwd.slice(10) : cwd);
    if (this.promptElement) {
      this.promptElement.innerHTML = `<span class="text-cyan-400 font-bold">user@just-bash</span>:<span class="text-teal-300">${displayCwd}</span>$ `;
    }
  }

  write(str) {
    if (!this.outputElement) return;
    const span = document.createElement('div');
    span.className = 'terminal-line break-words whitespace-pre-wrap';
    span.innerHTML = LiteTerminal.ansiToHtml(str);
    this.outputElement.appendChild(span);
    this.scrollToBottom();
  }

  writeln(str = '') {
    this.write(str + '\n');
  }

  clear() {
    if (this.outputElement) {
      this.outputElement.innerHTML = '';
    }
  }

  scrollToBottom() {
    if (this.outputElement) {
      this.outputElement.scrollTop = this.outputElement.scrollHeight;
    }
  }

  focus() {
    if (this.inputLineElement) {
      this.inputLineElement.focus();
    }
  }

  _attachEvents() {
    this.container.addEventListener('click', () => this.focus());

    this.inputLineElement.addEventListener('keydown', async (e) => {
      if (this.isExecuting) return;

      if (e.key === 'Enter') {
        const cmd = this.inputLineElement.value;
        this.inputLineElement.value = '';
        await this.executeCommandLine(cmd);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = this.historyPrevious();
        if (prev !== null) this.inputLineElement.value = prev;
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = this.historyNext();
        if (next !== null) this.inputLineElement.value = next;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const val = this.inputLineElement.value;
        const matches = this.getCompletions(val);
        if (matches.length === 1) {
          const parts = val.split(/\s+/);
          if (parts.length <= 1) {
            this.inputLineElement.value = matches[0] + ' ';
          } else {
            parts[parts.length - 1] = matches[0];
            this.inputLineElement.value = parts.join(' ');
          }
        } else if (matches.length > 1) {
          this.writeln(`\x1b[36m${matches.join('   ')}\x1b[0m`);
        }
      } else if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        this.writeln(`\x1b[90m^C\x1b[0m`);
        this.inputLineElement.value = '';
      } else if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        this.clear();
      }
    });
  }

  async executeCommandLine(cmd) {
    const cleanCmd = cmd.trim();
    const promptText = this.promptElement ? this.promptElement.textContent : 'user@just-bash:~$ ';

    // Echo executed command to terminal output
    this.writeln(`\x1b[36m${promptText}\x1b[0m${cmd}`);

    if (!cleanCmd) return;

    this.historyPush(cmd);
    this.isExecuting = true;

    try {
      if (cleanCmd === 'clear') {
        this.clear();
      } else {
        const res = await this.onCommand(cleanCmd);
        if (res.stdout) this.write(res.stdout);
        if (res.stderr) this.write(`\x1b[31m${res.stderr}\x1b[0m`);
      }
    } catch (err) {
      this.write(`\x1b[31mbash error: ${err.message}\x1b[0m\n`);
    } finally {
      this.isExecuting = false;
      this.updatePrompt();
      this.scrollToBottom();
      this.focus();
    }
  }
}
