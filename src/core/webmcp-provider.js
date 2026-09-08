/**
 * webmcp-provider.js - FastWebMCP & WebMCP Standard Implementation
 * Conforms to CCDD Contract 03 (contract-03-webmcp-bridge.md)
 * Standards: https://webmcp.com & https://mauricioperera.github.io/fastwebmcp/
 */
import { validateContract } from './contract-validator.js';

export class WebMCPProvider {
  constructor(vfs, bash) {
    this.vfs = vfs;
    this.bash = bash;
    this.registry = new Map();
    this.callLogs = [];
    this.setupPolyfill();
  }

  setupPolyfill() {
    const context = typeof document !== 'undefined' ? document.modelContext : null;
    this.nativeContext = context && !context.isPolyfill && typeof context.registerTool === 'function' ? context : null;
    this.nativeRegistrations = new Map();
    const runtime = {
      isPolyfill: true,
      version: '0.4.2',
      spec: 'https://webmcp.com',
      tools: this.registry,
      registerTool: (tool) => this.registerImperativeTool(tool),
      listTools: () => this.listTools(),
      getTool: (name) => this.registry.get(name) || null,
      invokeTool: (name, args) => this.invokeTool(name, args)
    };

    if (typeof document !== 'undefined' && !document.modelContext) {
      document.modelContext = runtime;
    }

    if (typeof window !== 'undefined') {
      window.webmcp = runtime;
      window.FastWebMCP = {
        version: '0.4.2',
        core: runtime,
        invoke: (name, args) => this.invokeTool(name, args)
      };
    }
  }

  registerImperativeTool(tool) {
    if (!tool || !tool.name || typeof tool.name !== 'string') {
      throw new Error('WebMCP Tool must have a valid string name');
    }

    // Spec validation: 1-128 chars [A-Za-z0-9_.-]
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(tool.name)) {
      throw new Error(`Invalid tool name '${tool.name}'. Must match [A-Za-z0-9_.-]{1,128}`);
    }

    const toolEntry = {
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || { type: 'object', properties: {} },
      execute: tool.execute,
      annotations: tool.annotations || { readOnlyHint: false, destructiveHint: false }
    };

    this.registry.set(tool.name, toolEntry);
    // Declarative forms are registered by Chrome itself, not a second time here.
    if (this.nativeContext && !tool.declarative) {
      const previous = this.nativeRegistrations.get(tool.name);
      const registration = Promise.resolve(previous).then(async () => {
        if (previous) await this.nativeContext.unregisterTool(tool.name);
        await this.nativeContext.registerTool({
          name: toolEntry.name,
          description: toolEntry.description,
          inputSchema: toolEntry.inputSchema,
          annotations: toolEntry.annotations,
          execute: async (args) => {
            const response = await this.invokeTool(toolEntry.name, args);
            if (response.status === 'error') throw new Error(response.error);
            return response.result;
          }
        });
      });
      this.nativeRegistrations.set(tool.name, registration);
      registration.catch(error => console.error(`WebMCP registration failed: ${tool.name}`, error));
    }
    return toolEntry;
  }

  listTools() {
    return Array.from(this.registry.values()).map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: t.annotations
    }));
  }

  getTool(name) {
    return this.registry.get(name) || null;
  }

  async invokeTool(name, args = {}) {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const callLog = {
      id: `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tool: name,
      args,
      timestamp: new Date().toISOString(),
      status: 'executing'
    };

    try {
      const tool = this.registry.get(name);
      if (!tool) {
        throw new Error(`WebMCP Tool '${name}' not found in registry.`);
      }

      this.validateArguments(tool.inputSchema, args);
      const result = await tool.execute(args);
      const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const durationMs = (endTime - startTime).toFixed(2);

      callLog.status = 'success';
      callLog.result = result;
      callLog.durationMs = durationMs;
      this.callLogs.unshift(callLog);
      if (this.callLogs.length > 50) this.callLogs.pop();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('webmcp:tool-executed', { detail: callLog }));
      }

      return {
        status: 'success',
        tool: name,
        result,
        durationMs
      };
    } catch (err) {
      const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const durationMs = (endTime - startTime).toFixed(2);

      callLog.status = 'error';
      callLog.error = err.message || String(err);
      callLog.durationMs = durationMs;
      this.callLogs.unshift(callLog);
      if (this.callLogs.length > 50) this.callLogs.length = 50;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('webmcp:tool-executed', { detail: callLog }));
      }

      return {
        status: 'error',
        tool: name,
        error: err.message || String(err),
        durationMs
      };
    }
  }

  // Validate the subset of JSON Schema used by this application's tools.
  validateArguments(schema, args) {
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      throw new Error('Tool arguments must be an object');
    }
    for (const key of schema.required || []) {
      if (!Object.hasOwn(args, key)) throw new Error(`Missing required argument: ${key}`);
    }
    for (const [key, rule] of Object.entries(schema.properties || {})) {
      if (!Object.hasOwn(args, key)) continue;
      if (rule.type && typeof args[key] !== rule.type) {
        throw new Error(`Invalid type for ${key}: expected ${rule.type}`);
      }
      if (rule.enum && !rule.enum.includes(args[key])) throw new Error(`Invalid value for ${key}`);
    }
  }

  initDefaultTools() {
    // 1. bash_exec
    this.registerImperativeTool({
      name: 'bash_exec',
      description: 'Execute arbitrary bash commands and scripts in the virtual sandbox.',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Bash command string to execute' }
        },
        required: ['command']
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
      execute: async (args) => {
        return await this.bash.exec(args.command);
      }
    });

    // 2. fs_read_file
    this.registerImperativeTool({
      name: 'fs_read_file',
      description: 'Read the text content of a virtual file.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Virtual file path (e.g. /home/user/README.md)' }
        },
        required: ['path']
      },
      annotations: { readOnlyHint: true },
      execute: async (args) => {
        const content = this.vfs.readFile(args.path, this.bash.cwd);
        return { path: args.path, content, size: content.length };
      }
    });

    // 3. fs_write_file
    this.registerImperativeTool({
      name: 'fs_write_file',
      description: 'Create or overwrite a file in the virtual filesystem.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Destination file path' },
          content: { type: 'string', description: 'UTF-8 file content' }
        },
        required: ['path', 'content']
      },
      annotations: { destructiveHint: false },
      execute: async (args) => {
        this.vfs.writeFile(args.path, args.content, this.bash.cwd);
        return { success: true, path: args.path, bytesWritten: new TextEncoder().encode(args.content).length };
      }
    });

    // 4. fs_list_dir
    this.registerImperativeTool({
      name: 'fs_list_dir',
      description: 'List contents of a directory in the virtual sandbox.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (defaults to current working directory)' }
        }
      },
      annotations: { readOnlyHint: true },
      execute: async (args) => {
        const target = args?.path || this.bash.cwd;
        const entries = this.vfs.readDir(target, this.bash.cwd);
        return { path: target, entries, total: entries.length };
      }
    });

    // 5. fs_mkdir
    this.registerImperativeTool({
      name: 'fs_mkdir',
      description: 'Create a new directory in the virtual filesystem.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to create' },
          recursive: { type: 'boolean', description: 'Create parent directories if needed' }
        },
        required: ['path']
      },
      annotations: { destructiveHint: false },
      execute: async (args) => {
        this.vfs.mkdir(args.path, { recursive: args.recursive ?? true }, this.bash.cwd);
        return { success: true, path: args.path };
      }
    });

    // 6. fs_stat
    this.registerImperativeTool({
      name: 'fs_stat',
      description: 'Get file or directory metadata and stats.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to inspect' }
        },
        required: ['path']
      },
      annotations: { readOnlyHint: true },
      execute: async (args) => {
        return this.vfs.stat(args.path, this.bash.cwd);
      }
    });

    // 7. kdd_validate_contract
    this.registerImperativeTool({
      name: 'kdd_validate_contract',
      description: 'Validate CCDD contract fields and its frozen test-file SHA-256. Use a repository contract filename or an absolute virtual contract path (oracle under /tests). Returns integrity checks, not test execution or proof of implementation correctness.',
      inputSchema: {
        type: 'object',
        properties: {
          contractName: { type: 'string', description: 'Contract filename (e.g. contract-01-virtual-fs.md)' }
        },
        required: ['contractName']
      },
      annotations: { readOnlyHint: true },
      execute: async (args) => {
        return await validateContract(args.contractName, this.vfs);
      }
    });

    // 8. bash_register_command
    this.registerImperativeTool({
      name: 'bash_register_command',
      description: 'Create and register a new custom command into the bash environment. It becomes immediately executable in the shell terminal and pipelines.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Command name (e.g. "wordcount", "calc", "summarize")' },
          type: { type: 'string', enum: ['bash'], description: 'Command type. Only the virtual bash language is supported.' },
          code: { type: 'string', description: 'The virtual shell script body' },
          description: { type: 'string', description: 'Optional brief description of what the command does' }
        },
        required: ['name', 'type', 'code']
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
      execute: async ({ name, type = 'bash', code, description = '' }) => {
        if (typeof name !== 'string' || !/^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}$/.test(name)) {
          throw new Error('Command name must be 1-128 safe filename characters and cannot contain paths');
        }
        if (!code || typeof code !== 'string') {
          throw new Error('Command code is required');
        }

        if (type !== 'bash') {
          throw new Error('Only virtual bash commands are supported. JavaScript commands are disabled.');
        }
        // Persist first: a failed write must not register an in-memory command.
        this.vfs.writeFile(`/bin/${name}`, `#!/bin/sh\n${code}\n`);
        this.bash.registerCommand(name, async (cmdArgs) => {
          // Expand parameters only after parsing, never interpolate shell source.
          // Each invocation gets its own environment to avoid concurrent argument leaks.
          return await this.bash.execWithArguments(code, name, cmdArgs);
        });

        return {
          success: true,
          command: name,
          type,
          location: `/bin/${name}`,
          message: `Command '${name}' registered and saved to /bin/${name}.`
        };
      }
    });

    // 9. bash_list_commands
    this.registerImperativeTool({
      name: 'bash_list_commands',
      description: 'List all available shell builtins, custom commands, and active aliases in the bash sandbox.',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const custom = Array.from(this.bash.customCommands.keys());
        const aliases = Object.fromEntries(this.bash.aliases ? this.bash.aliases.entries() : []);
        let binFiles = [];
        try {
          if (this.vfs.exists('/bin')) {
            binFiles = this.vfs.readDir('/bin');
          }
        } catch (e) {}

        return {
          builtins: this.bash.listBuiltins(),
          customCommands: custom,
          aliases,
          binExecutables: binFiles
        };
      }
    });

  }

  scanDeclarativeTools(container = (typeof document !== 'undefined' ? document : null)) {
    if (!container || !container.querySelectorAll) return;
    const forms = container.querySelectorAll('form[toolname]');

    for (const form of forms) {
      const name = form.getAttribute('toolname');
      const desc = form.getAttribute('tooldescription') || '';
      if (!name) continue;

      const properties = {};
      const required = [];
      const inputs = form.querySelectorAll('input, select, textarea');

      for (const input of inputs) {
        const paramName = input.name || input.id;
        if (!paramName) continue;
        const paramDesc = input.getAttribute('toolparamdescription') || '';
        properties[paramName] = { type: 'string', description: paramDesc };
        if (input.required) required.push(paramName);
      }

      this.registerImperativeTool({
        name,
        declarative: true,
        description: desc,
        inputSchema: { type: 'object', properties, required },
        execute: async (args) => {
          if (name === 'run_bash') {
            return await this.bash.exec(args.command || '');
          }
          if (name === 'read_virtual_file') {
            return { content: this.vfs.readFile(args.path || '', this.bash.cwd) };
          }
          return { status: 'executed', args };
        }
      });
    }
  }
}
