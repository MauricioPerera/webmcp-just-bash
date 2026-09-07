/**
 * bash-runtime.js - Pure Client-Side Bash Execution Engine
 * Conforms to CCDD Contract 02 (contract-02-bash-engine.md)
 */

export class BashRuntime {
  constructor(vfs, options = {}) {
    this.vfs = vfs;
    this.cwd = options.cwd || '/home/user';
    this.env = {
      HOME: '/home/user',
      PWD: this.cwd,
      USER: 'user',
      SHELL: '/bin/bash',
      PATH: '/bin:/usr/bin',
      TERM: 'xterm-256color',
      ...options.env
    };
    this.aliases = new Map();
    this.history = [];
    this.lastExitCode = 0;
    this.customCommands = new Map();
    this.agentRunner = options.agentRunner || null;
    this._registerCustomCommands();
  }

  setAgentRunner(runner) {
    this.agentRunner = runner;
  }

  _registerCustomCommands() {
    this.customCommands.set('about', async () => ({
      stdout: `just-bash v3.4.2
A TypeScript bash interpreter with in-memory filesystem.
Designed for AI agents needing a secure, sandboxed environment.

Custom commands:
  about       About just-bash
  install     Installation instructions
  github      GitHub repository
  webmcp      WebMCP tools registry inspector
  agent <q>   Autonomous AI tool-loop agent

Or try any bash command: ls, cat, echo, grep, awk, jq, sed, wc, etc.
Type 'help' for a list of all built-in commands.\n`,
      stderr: '',
      exitCode: 0
    }));

    this.customCommands.set('install', async () => ({
      stdout: `npm install just-bash\n`,
      stderr: '',
      exitCode: 0
    }));

    this.customCommands.set('github', async () => ({
      stdout: `https://github.com/vercel-labs/just-bash\n`,
      stderr: '',
      exitCode: 0
    }));

    this.customCommands.set('webmcp', async () => {
      const tools = typeof window !== 'undefined' && window.webmcp
        ? window.webmcp.listTools()
        : [];
      return {
        stdout: `[FastWebMCP Runtime] Connected to document.modelContext & window.webmcp
Spec: https://webmcp.com
Active Tools (${tools.length}):
${tools.map(t => `  - ${t.name}: ${t.description}`).join('\n') || '  (No tools registered yet)'}\n`,
        stderr: '',
        exitCode: 0
      };
    });
  }

  registerCommand(name, fn) {
    this.customCommands.set(name, fn);
  }

  // Tokenize string taking quotes and escapes into account
  _tokenize(line) {
    const tokens = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === "'" && !inDouble) {
        inSingle = !inSingle;
        continue;
      }
      if (char === '"' && !inSingle) {
        inDouble = !inDouble;
        continue;
      }
      if (char === '\\' && i + 1 < line.length) {
        const nextChar = line[i + 1];
        if (inDouble) {
          if (nextChar === '"' || nextChar === '\\' || nextChar === '$' || nextChar === '`') {
            current += nextChar;
            i++;
            continue;
          }
        } else if (!inSingle) {
          current += nextChar;
          i++;
          continue;
        }
      }

      if (!inSingle && !inDouble) {
        if (char === ' ' || char === '\t') {
          if (current.length > 0) {
            tokens.push(current);
            current = '';
          }
          continue;
        }
        if (char === '|' || char === ';' || char === '>' || char === '<' || char === '&') {
          if (current.length > 0) {
            tokens.push(current);
            current = '';
          }
          if (char === '|' && line[i + 1] === '|') {
            tokens.push('||');
            i++;
          } else if (char === '&' && line[i + 1] === '&') {
            tokens.push('&&');
            i++;
          } else if (char === '>' && line[i + 1] === '>') {
            tokens.push('>>');
            i++;
          } else if (char === '2' && line[i + 1] === '>' && line[i + 2] === '&' && line[i + 3] === '1') {
            tokens.push('2>&1');
            i += 3;
          } else {
            tokens.push(char);
          }
          continue;
        }
      }

      // In single quotes, escape $ with sentinel \uFFF0 so it is not expanded at runtime
      if (inSingle && char === '$') {
        current += '\uFFF0';
        continue;
      }

      current += char;
    }

    if (current.length > 0) tokens.push(current);
    return tokens;
  }

  // Expand environment variables: $VAR, ${VAR}, $?, $PWD, $HOME (and restore protected $)
  _expandVariables(str) {
    const expanded = str.replace(/\$(?:\{([A-Za-z0-9_]+)\}|([A-Za-z0-9_]+)|\?|\$)/g, (match, g1, g2) => {
      if (match === '$?') return String(this.lastExitCode);
      if (match === '$$') return '1000';
      const varName = g1 || g2;
      return this.env[varName] !== undefined ? this.env[varName] : '';
    });
    return expanded.replace(/\uFFF0/g, '$');
  }

  // Split tokens into pipelines and chaining statements (&&, ||, ;)
  _parseStatements(tokens) {
    const statements = [];
    let currentCommand = [];
    let currentConnector = ';';

    for (const tok of tokens) {
      if (tok === '&&' || tok === '||' || tok === ';') {
        if (currentCommand.length > 0) {
          statements.push({ connector: currentConnector, tokens: currentCommand });
          currentCommand = [];
        }
        currentConnector = tok;
      } else {
        currentCommand.push(tok);
      }
    }

    if (currentCommand.length > 0) {
      statements.push({ connector: currentConnector, tokens: currentCommand });
    }

    return statements;
  }

  // Split command tokens by pipe '|'
  _splitPipeline(tokens) {
    const pipeline = [];
    let curr = [];

    for (const tok of tokens) {
      if (tok === '|') {
        if (curr.length > 0) pipeline.push(curr);
        curr = [];
      } else {
        curr.push(tok);
      }
    }
    if (curr.length > 0) pipeline.push(curr);
    return pipeline;
  }

  async exec(commandLine) {
    if (!commandLine || !commandLine.trim()) {
      return { stdout: '', stderr: '', exitCode: 0 };
    }

    this.history.push(commandLine);
    const tokens = this._tokenize(commandLine);
    const statements = this._parseStatements(tokens);

    let totalStdout = '';
    let totalStderr = '';
    let lastExitCode = 0;

    for (const stmt of statements) {
      if (stmt.connector === '&&' && lastExitCode !== 0) continue;
      if (stmt.connector === '||' && lastExitCode === 0) continue;

      const pipelineStages = this._splitPipeline(stmt.tokens);
      let pipeStdin = '';
      let stageRes = { stdout: '', stderr: '', exitCode: 0 };

      for (let i = 0; i < pipelineStages.length; i++) {
        const stageTokens = pipelineStages[i];
        stageRes = await this._executeSingleStage(stageTokens, pipeStdin);
        pipeStdin = stageRes.stdout;
        this.lastExitCode = stageRes.exitCode;
      }

      totalStdout += stageRes.stdout;
      totalStderr += stageRes.stderr;
      lastExitCode = stageRes.exitCode;
    }

    return { stdout: totalStdout, stderr: totalStderr, exitCode: lastExitCode };
  }

  async _executeSingleStage(tokens, stdin = '') {
    // Check for redirections (> or >>)
    let redirectFile = null;
    let append = false;
    const cleanTokens = [];

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t === '>' && i + 1 < tokens.length) {
        redirectFile = tokens[++i];
        append = false;
      } else if (t === '>>' && i + 1 < tokens.length) {
        redirectFile = tokens[++i];
        append = true;
      } else if (t === '<' && i + 1 < tokens.length) {
        const srcFile = tokens[++i];
        try {
          stdin = this.vfs.readFile(srcFile, this.cwd);
        } catch (e) {
          return { stdout: '', stderr: e.message + '\n', exitCode: 1 };
        }
      } else if (t === '2>&1') {
        // merge stderr into stdout
      } else {
        cleanTokens.push(this._expandVariables(t));
      }
    }

    if (cleanTokens.length === 0) {
      return { stdout: '', stderr: '', exitCode: 0 };
    }

    let cmdName = cleanTokens[0];
    let args = cleanTokens.slice(1);

    // 1. Alias expansion
    if (this.aliases && this.aliases.has(cmdName)) {
      const aliasVal = this.aliases.get(cmdName);
      const aliasTokens = this._tokenize(aliasVal);
      if (aliasTokens.length > 0) {
        cmdName = aliasTokens[0];
        args = aliasTokens.slice(1).concat(args);
      }
    }

    let res;
    if (this.customCommands.has(cmdName)) {
      res = await this.customCommands.get(cmdName)(args, { stdin, cwd: this.cwd, env: this.env, vfs: this.vfs, bash: this });
    } else {
      res = await this._runBuiltin(cmdName, args, stdin);
    }

    if (redirectFile) {
      try {
        const targetPath = this.vfs.resolvePath(redirectFile, this.cwd);
        let existingContent = '';
        if (append && this.vfs.exists(targetPath)) {
          existingContent = this.vfs.readFile(targetPath);
        }
        this.vfs.writeFile(targetPath, existingContent + res.stdout);
        res.stdout = '';
      } catch (err) {
        res.stderr += err.message + '\n';
        res.exitCode = 1;
      }
    }

    return res;
  }

  async _runBuiltin(cmd, args, stdin) {
    switch (cmd) {
      case 'echo': {
        let noNewline = false;
        let startIdx = 0;
        if (args[0] === '-n') {
          noNewline = true;
          startIdx = 1;
        }
        const text = args.slice(startIdx).join(' ').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
        return { stdout: text + (noNewline ? '' : '\n'), stderr: '', exitCode: 0 };
      }

      case 'printf': {
        const fmt = args[0] || '';
        const formatArgs = args.slice(1);
        let idx = 0;
        const formatted = fmt
          .replace(/%s/g, () => formatArgs[idx++] || '')
          .replace(/%d/g, () => String(parseInt(formatArgs[idx++] || '0', 10)))
          .replace(/\\n/g, '\n');
        return { stdout: formatted, stderr: '', exitCode: 0 };
      }

      case 'pwd':
        return { stdout: this.cwd + '\n', stderr: '', exitCode: 0 };

      case 'cd': {
        const dest = args[0] || this.env.HOME || '/home/user';
        const target = dest === '~' ? (this.env.HOME || '/home/user') : dest;
        const resolved = this.vfs.resolvePath(target, this.cwd);

        if (!this.vfs.exists(resolved)) {
          return { stdout: '', stderr: `bash: cd: ${dest}: No such file or directory\n`, exitCode: 1 };
        }
        const st = this.vfs.stat(resolved);
        if (st.type !== 'dir') {
          return { stdout: '', stderr: `bash: cd: ${dest}: Not a directory\n`, exitCode: 1 };
        }
        this.cwd = resolved;
        this.env.PWD = resolved;
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      case 'ls': {
        let showHidden = false;
        let longFormat = false;
        const targets = [];

        for (const arg of args) {
          if (arg.startsWith('-')) {
            if (arg.includes('a')) showHidden = true;
            if (arg.includes('l')) longFormat = true;
          } else {
            targets.push(arg);
          }
        }

        const targetPath = targets[0] || '.';
        const resolved = this.vfs.resolvePath(targetPath, this.cwd);
        if (!this.vfs.exists(resolved)) {
          return { stdout: '', stderr: `ls: cannot access '${targetPath}': No such file or directory\n`, exitCode: 1 };
        }

        try {
          const stat = this.vfs.stat(resolved);
          if (stat.type === 'file') {
            return { stdout: stat.name + '\n', stderr: '', exitCode: 0 };
          }
          let entries = this.vfs.readDir(resolved);
          if (!showHidden) entries = entries.filter(e => !e.startsWith('.'));

          if (longFormat) {
            const lines = entries.map(name => {
              const childStat = this.vfs.stat(`${resolved}/${name}`);
              const typeChar = childStat.type === 'dir' ? 'd' : '-';
              const perms = `${typeChar}rwxr-xr-x`;
              const size = String(childStat.size).padStart(6, ' ');
              return `${perms} 1 user user ${size} Jan 1 00:00 ${name}`;
            });
            return { stdout: `total ${entries.length}\n` + lines.join('\n') + '\n', stderr: '', exitCode: 0 };
          }

          return { stdout: entries.join('  ') + (entries.length > 0 ? '\n' : ''), stderr: '', exitCode: 0 };
        } catch (err) {
          return { stdout: '', stderr: err.message + '\n', exitCode: 1 };
        }
      }

      case 'cat': {
        if (args.length === 0) {
          return { stdout: stdin, stderr: '', exitCode: 0 };
        }
        let out = '';
        for (const f of args) {
          try {
            out += this.vfs.readFile(f, this.cwd);
          } catch (e) {
            return { stdout: out, stderr: e.message + '\n', exitCode: 1 };
          }
        }
        return { stdout: out, stderr: '', exitCode: 0 };
      }

      case 'head': {
        let count = 10;
        let files = [];
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '-n' && i + 1 < args.length) count = parseInt(args[++i], 10);
          else if (args[i].startsWith('-') && !isNaN(parseInt(args[i].slice(1), 10))) count = parseInt(args[i].slice(1), 10);
          else files.push(args[i]);
        }
        let content = files.length > 0 ? this.vfs.readFile(files[0], this.cwd) : stdin;
        const lines = content.split('\n').slice(0, count).join('\n');
        return { stdout: lines + '\n', stderr: '', exitCode: 0 };
      }

      case 'tail': {
        let count = 10;
        let files = [];
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '-n' && i + 1 < args.length) count = parseInt(args[++i], 10);
          else files.push(args[i]);
        }
        let content = files.length > 0 ? this.vfs.readFile(files[0], this.cwd) : stdin;
        const splitted = content.split('\n');
        const lines = splitted.slice(-count).join('\n');
        return { stdout: lines + '\n', stderr: '', exitCode: 0 };
      }

      case 'wc': {
        let countLines = false, countWords = false, countBytes = false;
        let files = [];
        for (const arg of args) {
          if (arg.startsWith('-')) {
            if (arg.includes('l')) countLines = true;
            if (arg.includes('w')) countWords = true;
            if (arg.includes('c')) countBytes = true;
          } else {
            files.push(arg);
          }
        }
        if (!countLines && !countWords && !countBytes) {
          countLines = true; countWords = true; countBytes = true;
        }

        const content = files.length > 0 ? this.vfs.readFile(files[0], this.cwd) : stdin;
        const lines = content === '' ? 0 : content.split('\n').filter(Boolean).length;
        const words = content.trim() === '' ? 0 : content.trim().split(/\s+/).length;
        const bytes = content.length;

        const parts = [];
        if (countLines) parts.push(String(lines));
        if (countWords) parts.push(String(words));
        if (countBytes) parts.push(String(bytes));
        if (files.length > 0) parts.push(files[0]);

        return { stdout: parts.join(' ') + '\n', stderr: '', exitCode: 0 };
      }

      case 'grep': {
        let ignoreCase = false, invert = false, lineNums = false;
        const rest = [];
        for (const arg of args) {
          if (arg === '-i') ignoreCase = true;
          else if (arg === '-v') invert = true;
          else if (arg === '-n') lineNums = true;
          else if (arg.startsWith('-')) {} // other flags ignored
          else rest.push(arg);
        }

        if (rest.length === 0) return { stdout: '', stderr: 'grep: search pattern required\n', exitCode: 2 };
        const patternStr = rest[0];
        const pattern = new RegExp(patternStr, ignoreCase ? 'i' : '');
        let text = rest.length > 1 ? this.vfs.readFile(rest[1], this.cwd) : stdin;

        const matched = [];
        const lines = text.split('\n');
        for (let idx = 0; idx < lines.length; idx++) {
          const l = lines[idx];
          const hasMatch = pattern.test(l);
          if ((hasMatch && !invert) || (!hasMatch && invert)) {
            matched.push(lineNums ? `${idx + 1}:${l}` : l);
          }
        }

        return {
          stdout: matched.length > 0 ? matched.join('\n') + '\n' : '',
          stderr: '',
          exitCode: matched.length > 0 ? 0 : 1
        };
      }

      case 'sort': {
        let reverse = args.includes('-r');
        let numeric = args.includes('-n');
        let text = stdin;
        if (args.find(a => !a.startsWith('-'))) {
          text = this.vfs.readFile(args.find(a => !a.startsWith('-')), this.cwd);
        }
        let items = text.split('\n').filter(Boolean);
        items.sort((a, b) => {
          if (numeric) {
            const diff = parseFloat(a) - parseFloat(b);
            return isNaN(diff) ? a.localeCompare(b) : diff;
          }
          return a.localeCompare(b);
        });
        if (reverse) items.reverse();
        return { stdout: items.join('\n') + '\n', stderr: '', exitCode: 0 };
      }

      case 'uniq': {
        const text = stdin;
        const lines = text.split('\n').filter(Boolean);
        const unique = [];
        let prev = null;
        for (const l of lines) {
          if (l !== prev) {
            unique.push(l);
            prev = l;
          }
        }
        return { stdout: unique.join('\n') + '\n', stderr: '', exitCode: 0 };
      }

      case 'cut': {
        let delim = '\t';
        let field = 1;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '-d' && i + 1 < args.length) delim = args[++i];
          else if (args[i] === '-f' && i + 1 < args.length) field = parseInt(args[++i], 10);
        }
        const lines = stdin.split('\n');
        const res = lines.map(l => {
          const parts = l.split(delim);
          return parts[field - 1] || '';
        }).join('\n');
        return { stdout: res + '\n', stderr: '', exitCode: 0 };
      }

      case 'tr': {
        const from = args[0] || '';
        const to = args[1] || '';
        let result = stdin;
        if (from === 'a-z' && to === 'A-Z') result = result.toUpperCase();
        else if (from === 'A-Z' && to === 'a-z') result = result.toLowerCase();
        return { stdout: result, stderr: '', exitCode: 0 };
      }

      case 'sed': {
        const expr = args[0] || '';
        const match = expr.match(/^s\/(.*?)\/(.*?)\/([gimsuy]*)$/);
        if (match) {
          const [, pattern, repl, flags] = match;
          const regex = new RegExp(pattern, flags);
          return { stdout: stdin.replace(regex, repl), stderr: '', exitCode: 0 };
        }
        return { stdout: stdin, stderr: '', exitCode: 0 };
      }

      case 'awk': {
        const program = args[0] || '';
        const match = program.match(/\{print\s+(.*?)\}/);
        if (match) {
          const fields = match[1].split(/[,\s]+/).filter(Boolean);
          const lines = stdin.split('\n').filter(Boolean);
          const output = lines.map(line => {
            const cols = line.trim().split(/\s+/);
            return fields.map(f => {
              if (f === '$0') return line;
              const idx = parseInt(f.replace('$', ''), 10);
              return !isNaN(idx) && idx > 0 ? (cols[idx - 1] || '') : f.replace(/['"]/g, '');
            }).join(' ');
          }).join('\n');
          return { stdout: output + '\n', stderr: '', exitCode: 0 };
        }
        return { stdout: stdin, stderr: '', exitCode: 0 };
      }

      case 'jq': {
        const filter = (args[0] || '.').trim();
        try {
          const raw = stdin.trim();
          if (!raw) return { stdout: '', stderr: '', exitCode: 0 };
          const data = JSON.parse(raw);
          if (filter === '.' || filter === '') {
            return { stdout: JSON.stringify(data, null, 2) + '\n', stderr: '', exitCode: 0 };
          }
          if (filter.startsWith('.')) {
            const key = filter.slice(1).replace(/['"]/g, '');
            const val = data[key];
            if (val === undefined) return { stdout: 'null\n', stderr: '', exitCode: 0 };
            if (typeof val === 'string') return { stdout: `"${val}"\n`, stderr: '', exitCode: 0 };
            return { stdout: JSON.stringify(val, null, 2) + '\n', stderr: '', exitCode: 0 };
          }
          return { stdout: JSON.stringify(data, null, 2) + '\n', stderr: '', exitCode: 0 };
        } catch (e) {
          return { stdout: '', stderr: `jq: parse error: ${e.message}\n`, exitCode: 1 };
        }
      }

      case 'tree': {
        const path = args[0] || '.';
        const items = this.vfs.walk(path, this.cwd);
        const lines = items.map(item => `${item.type === 'dir' ? '[D]' : '[F]'} ${item.path}`);
        return { stdout: lines.join('\n') + '\n', stderr: '', exitCode: 0 };
      }

      case 'find': {
        const path = args[0] || '.';
        const nameIdx = args.indexOf('-name');
        const namePattern = nameIdx !== -1 ? args[nameIdx + 1] : null;
        const items = this.vfs.walk(path, this.cwd);
        const filtered = items.filter(item => {
          if (!namePattern) return true;
          return item.name.includes(namePattern.replace(/\*/g, ''));
        });
        return { stdout: filtered.map(i => i.path).join('\n') + '\n', stderr: '', exitCode: 0 };
      }

      case 'mkdir': {
        const recursive = args.includes('-p');
        const paths = args.filter(a => !a.startsWith('-'));
        for (const p of paths) {
          try {
            this.vfs.mkdir(p, { recursive }, this.cwd);
          } catch (e) {
            return { stdout: '', stderr: e.message + '\n', exitCode: 1 };
          }
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      case 'touch': {
        for (const f of args) {
          try {
            if (!this.vfs.exists(f, this.cwd)) {
              this.vfs.writeFile(f, '', this.cwd);
            }
          } catch (e) {
            return { stdout: '', stderr: e.message + '\n', exitCode: 1 };
          }
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      case 'rm': {
        const recursive = args.includes('-r') || args.includes('-rf') || args.includes('-R');
        const force = args.includes('-f') || args.includes('-rf');
        const targets = args.filter(a => !a.startsWith('-'));
        for (const t of targets) {
          try {
            this.vfs.rm(t, { recursive, force }, this.cwd);
          } catch (e) {
            if (!force) return { stdout: '', stderr: e.message + '\n', exitCode: 1 };
          }
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      case 'cp': {
        if (args.length < 2) return { stdout: '', stderr: 'cp: missing file operand\n', exitCode: 1 };
        try {
          const content = this.vfs.readFile(args[0], this.cwd);
          this.vfs.writeFile(args[1], content, this.cwd);
          return { stdout: '', stderr: '', exitCode: 0 };
        } catch (e) {
          return { stdout: '', stderr: e.message + '\n', exitCode: 1 };
        }
      }

      case 'mv': {
        if (args.length < 2) return { stdout: '', stderr: 'mv: missing destination file operand\n', exitCode: 1 };
        try {
          const content = this.vfs.readFile(args[0], this.cwd);
          this.vfs.writeFile(args[1], content, this.cwd);
          this.vfs.rm(args[0], {}, this.cwd);
          return { stdout: '', stderr: '', exitCode: 0 };
        } catch (e) {
          return { stdout: '', stderr: e.message + '\n', exitCode: 1 };
        }
      }

      case 'stat': {
        if (args.length === 0) return { stdout: '', stderr: 'stat: missing operand\n', exitCode: 1 };
        try {
          const s = this.vfs.stat(args[0], this.cwd);
          return {
            stdout: `  File: ${s.path}\n  Size: ${s.size} bytes\n  Type: ${s.type}\n  Mode: ${s.mode.toString(8)}\n`,
            stderr: '',
            exitCode: 0
          };
        } catch (e) {
          return { stdout: '', stderr: e.message + '\n', exitCode: 1 };
        }
      }

      case 'env':
      case 'printenv': {
        const lines = Object.entries(this.env).map(([k, v]) => `${k}=${v}`);
        return { stdout: lines.join('\n') + '\n', stderr: '', exitCode: 0 };
      }

      case 'export': {
        for (const item of args) {
          if (item.includes('=')) {
            const [k, ...rest] = item.split('=');
            this.env[k.trim()] = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
          }
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      case 'whoami':
        return { stdout: `${this.env.USER || 'user'}\n`, stderr: '', exitCode: 0 };

      case 'date':
        return { stdout: new Date().toUTCString() + '\n', stderr: '', exitCode: 0 };

      case 'clear':
        return { stdout: '\x1b[2J\x1b[H', stderr: '', exitCode: 0 };

      case 'true':
        return { stdout: '', stderr: '', exitCode: 0 };

      case 'false':
        return { stdout: '', stderr: '', exitCode: 1 };

      case 'seq': {
        const start = args.length > 1 ? parseInt(args[0], 10) : 1;
        const end = args.length > 1 ? parseInt(args[1], 10) : parseInt(args[0] || '1', 10);
        const nums = [];
        for (let n = start; n <= end; n++) nums.push(n);
        return { stdout: nums.join('\n') + '\n', stderr: '', exitCode: 0 };
      }

      case 'base64': {
        const decode = args.includes('-d');
        const content = stdin;
        if (decode) {
          const decoded = Buffer.from(content.trim(), 'base64').toString('utf8');
          return { stdout: decoded, stderr: '', exitCode: 0 };
        }
        const encoded = Buffer.from(content, 'utf8').toString('base64');
        return { stdout: encoded + '\n', stderr: '', exitCode: 0 };
      }

      case 'alias': {
        if (args.length === 0) {
          if (!this.aliases || this.aliases.size === 0) {
            return { stdout: '', stderr: '', exitCode: 0 };
          }
          let out = '';
          for (const [name, val] of this.aliases.entries()) {
            out += `alias ${name}='${val}'\n`;
          }
          return { stdout: out, stderr: '', exitCode: 0 };
        }

        for (const arg of args) {
          const eqIdx = arg.indexOf('=');
          if (eqIdx === -1) {
            if (this.aliases && this.aliases.has(arg)) {
              return { stdout: `alias ${arg}='${this.aliases.get(arg)}'\n`, stderr: '', exitCode: 0 };
            } else {
              return { stdout: '', stderr: `alias: ${arg}: not found\n`, exitCode: 1 };
            }
          } else {
            const name = arg.slice(0, eqIdx).trim();
            let val = arg.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            this.aliases.set(name, val);
          }
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      case 'unalias': {
        if (args.length === 0) {
          return { stdout: '', stderr: 'unalias: usage: unalias [-a] name [name ...]\n', exitCode: 1 };
        }
        if (args[0] === '-a') {
          this.aliases.clear();
          return { stdout: '', stderr: '', exitCode: 0 };
        }
        let exitCode = 0;
        let stderr = '';
        for (const name of args) {
          if (this.aliases && this.aliases.has(name)) {
            this.aliases.delete(name);
          } else {
            stderr += `unalias: ${name}: not found\n`;
            exitCode = 1;
          }
        }
        return { stdout: '', stderr, exitCode };
      }

      case 'defcmd': {
        if (args.length === 0) {
          let out = 'Custom commands:\n';
          for (const [name] of this.customCommands.entries()) {
            out += `  ${name}\n`;
          }
          return { stdout: out, stderr: '', exitCode: 0 };
        }

        if (args[0] === '--remove' || args[0] === '-d') {
          const name = args[1];
          if (!name || !this.customCommands.has(name)) {
            return { stdout: '', stderr: `defcmd: command '${name}' not found\n`, exitCode: 1 };
          }
          this.customCommands.delete(name);
          try {
            if (this.vfs.exists(`/bin/${name}`)) this.vfs.rm(`/bin/${name}`);
          } catch (e) {}
          return { stdout: `Command '${name}' removed.\n`, stderr: '', exitCode: 0 };
        }

        const name = args[0];
        let isJs = false;
        let codeStartIdx = 1;

        if (args[1] === '--js') {
          isJs = true;
          codeStartIdx = 2;
        }

        const code = args.slice(codeStartIdx).join(' ');
        if (!code) {
          return { stdout: 'Usage: defcmd <name> [--js] <code>\n', stderr: '', exitCode: 1 };
        }

        if (isJs) {
          try {
            const fn = new Function('args', 'context', `return (async () => {\n${code}\n})();`);
            this.customCommands.set(name, async (cmdArgs, ctx) => {
              try {
                const res = await fn(cmdArgs, ctx);
                if (res && typeof res === 'object') {
                  return {
                    stdout: res.stdout || '',
                    stderr: res.stderr || '',
                    exitCode: typeof res.exitCode === 'number' ? res.exitCode : 0
                  };
                }
                return { stdout: String(res ?? '') + '\n', stderr: '', exitCode: 0 };
              } catch (err) {
                return { stdout: '', stderr: `${name}: ${err.message}\n`, exitCode: 1 };
              }
            });
            try {
              this.vfs.writeFile(`/bin/${name}`, `// @js\n${code}\n`);
            } catch (e) {}
          } catch (err) {
            return { stdout: '', stderr: `defcmd syntax error: ${err.message}\n`, exitCode: 1 };
          }
        } else {
          this.customCommands.set(name, async (cmdArgs) => {
            let script = code;
            script = script.replace(/\$0\b/g, name);
            script = script.replace(/\$#/g, String(cmdArgs.length));
            script = script.replace(/\$[@*]/g, cmdArgs.join(' '));
            script = script.replace(/\$([1-9][0-9]*)/g, (_, num) => {
              const idx = parseInt(num, 10) - 1;
              return idx < cmdArgs.length ? cmdArgs[idx] : '';
            });
            return await this.exec(script);
          });
          try {
            this.vfs.writeFile(`/bin/${name}`, `#!/bin/sh\n${code}\n`);
          } catch (e) {}
        }

        return { stdout: `Command '${name}' defined successfully.\n`, stderr: '', exitCode: 0 };
      }

      case 'sh':
      case 'bash':
      case 'source':
      case '.': {
        const scriptFile = args[0];
        if (!scriptFile) {
          return { stdout: '', stderr: `${cmd}: missing script argument\n`, exitCode: 1 };
        }
        const targetPath = this.vfs.resolvePath(scriptFile, this.cwd);
        if (!this.vfs.exists(targetPath)) {
          return { stdout: '', stderr: `${cmd}: ${scriptFile}: No such file or directory\n`, exitCode: 1 };
        }
        if (this.vfs.stat(targetPath).type === 'dir') {
          return { stdout: '', stderr: `${cmd}: ${scriptFile}: Is a directory\n`, exitCode: 1 };
        }
        const scriptArgs = args.slice(1);
        return await this._executeScript(targetPath, scriptArgs, stdin);
      }

      case 'chmod': {
        if (args.length < 2) {
          return { stdout: '', stderr: 'chmod: missing operand\n', exitCode: 1 };
        }
        const target = args[args.length - 1];
        const targetPath = this.vfs.resolvePath(target, this.cwd);
        if (!this.vfs.exists(targetPath)) {
          return { stdout: '', stderr: `chmod: cannot access '${target}': No such file or directory\n`, exitCode: 1 };
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      case 'which': {
        const target = args[0];
        if (!target) return { stdout: '', stderr: 'which: missing argument\n', exitCode: 1 };
        if (this.aliases && this.aliases.has(target)) {
          return { stdout: `${target}: aliased to ${this.aliases.get(target)}\n`, stderr: '', exitCode: 0 };
        }
        if (this.customCommands.has(target)) {
          return { stdout: `/bin/${target}\n`, stderr: '', exitCode: 0 };
        }
        const pathDirs = (this.env.PATH || '/bin:/usr/bin').split(':');
        for (const dir of pathDirs) {
          const candidate = this.vfs.resolvePath(`${dir}/${target}`);
          if (this.vfs.exists(candidate)) {
            return { stdout: `${candidate}\n`, stderr: '', exitCode: 0 };
          }
        }
        if (['ls', 'cat', 'echo', 'grep', 'wc', 'cd', 'pwd', 'mkdir', 'rm', 'cp', 'mv', 'awk', 'sed', 'jq', 'sh', 'bash', 'alias', 'defcmd'].includes(target)) {
          return { stdout: `/bin/${target}\n`, stderr: '', exitCode: 0 };
        }
        return { stdout: '', stderr: `${target} not found\n`, exitCode: 1 };
      }

      case 'help': {
        return {
          stdout: `Available built-in commands:
  File Operations:
    cat, cp, ls, mkdir, mv, rm, stat, touch, tree, find, chmod
  Text Processing:
    awk, base64, cut, grep, head, jq, sed, sort, tail, tr, uniq, wc
  Navigation & Shell:
    cd, clear, date, echo, env, export, false, help, history,
    printf, printenv, pwd, seq, true, which, whoami
  Scripting & Custom:
    sh <script>, bash <script>, source <script>, . <script>,
    alias [name=val], unalias <name>, defcmd <name> [--js] <code>
  Custom Commands:
    about, install, github, webmcp, agent <query>

Type 'help' or 'defcmd' for custom commands.\n`,
          stderr: '',
          exitCode: 0
        };
      }

      case 'agent': {
        const query = args.join(' ');
        if (!query) {
          return { stdout: 'Usage: agent "<your question or task>"\n', stderr: '', exitCode: 1 };
        }
        if (this.agentRunner) {
          const res = await this.agentRunner.runQuery(query);
          return { stdout: res.response + '\n', stderr: '', exitCode: 0 };
        }
        return {
          stdout: `[Agent] Query received: "${query}"\nAnalyzing virtual filesystem...\nDone.\n`,
          stderr: '',
          exitCode: 0
        };
      }

      default: {
        const fileRes = await this._tryExecuteFile(cmd, args, stdin);
        if (fileRes !== null) {
          return fileRes;
        }
        return { stdout: '', stderr: `bash: ${cmd}: command not found\n`, exitCode: 127 };
      }
    }
  }

  async _tryExecuteFile(cmd, args, stdin) {
    let targetPath = null;
    if (cmd.includes('/')) {
      const resolved = this.vfs.resolvePath(cmd, this.cwd);
      if (this.vfs.exists(resolved) && this.vfs.stat(resolved).type === 'file') {
        targetPath = resolved;
      }
    } else {
      const pathDirs = (this.env.PATH || '/bin:/usr/bin').split(':');
      for (const dir of pathDirs) {
        const candidate = this.vfs.resolvePath(`${dir}/${cmd}`);
        if (this.vfs.exists(candidate) && this.vfs.stat(candidate).type === 'file') {
          targetPath = candidate;
          break;
        }
      }
    }

    if (!targetPath) return null;
    return await this._executeScript(targetPath, args, stdin);
  }

  async _executeScript(scriptPath, args = [], stdin = '') {
    const content = this.vfs.readFile(scriptPath);

    // JavaScript script execution
    if (content.startsWith('#!/usr/bin/env node') || content.startsWith('// @js') || content.startsWith('/* @js */')) {
      try {
        const code = content.replace(/^#![^\n]*\n/, '');
        const fn = new Function('args', 'context', `return (async () => {\n${code}\n})();`);
        const output = await fn(args, { stdin, cwd: this.cwd, env: this.env, vfs: this.vfs, bash: this });
        if (output && typeof output === 'object') {
          return {
            stdout: output.stdout || '',
            stderr: output.stderr || '',
            exitCode: typeof output.exitCode === 'number' ? output.exitCode : 0
          };
        }
        return { stdout: String(output ?? '') + '\n', stderr: '', exitCode: 0 };
      } catch (e) {
        return { stdout: '', stderr: `js error in ${scriptPath}: ${e.message}\n`, exitCode: 1 };
      }
    }

    // Shell script execution
    const lines = content.split('\n');
    let lastResult = { stdout: '', stderr: '', exitCode: 0 };
    let fullStdout = '';
    let fullStderr = '';

    for (let rawLine of lines) {
      let line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      line = line.replace(/\$0\b/g, scriptPath);
      line = line.replace(/\$#/g, String(args.length));
      line = line.replace(/\$[@*]/g, args.join(' '));
      line = line.replace(/\$([1-9][0-9]*)/g, (_, num) => {
        const idx = parseInt(num, 10) - 1;
        return idx < args.length ? args[idx] : '';
      });

      lastResult = await this.exec(line);
      fullStdout += lastResult.stdout;
      fullStderr += lastResult.stderr;

      if (lastResult.exitCode !== 0) {
        return { stdout: fullStdout, stderr: fullStderr, exitCode: lastResult.exitCode };
      }
    }

    return { stdout: fullStdout, stderr: fullStderr, exitCode: lastResult.exitCode };
  }
}
