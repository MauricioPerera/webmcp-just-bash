/**
 * htmx-bridge.js - Reactive HTMX and Client-Side Hypermedia Integration
 */

export class HTMXBridge {
  constructor(vfs, bash, webmcp, terminal) {
    this.vfs = vfs;
    this.bash = bash;
    this.webmcp = webmcp;
    this.terminal = terminal;
    this._initListeners();
  }

  _initListeners() {
    // Listen for VFS changes and update file explorer
    window.addEventListener('vfs:change', () => {
      this.renderFileExplorer();
    });

    // Listen for WebMCP tool executions and update telemetry log
    window.addEventListener('webmcp:tool-executed', () => {
      this.renderWebMCPLatestLogs();
    });
  }

  static escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  renderFileExplorer() {
    const el = document.getElementById('vfs-tree-container');
    if (!el) return;

    const files = this.vfs.walk('/home/user');
    let html = '<ul class="space-y-1 font-mono text-xs">';
    for (const item of files) {
      const isDir = item.type === 'dir';
      const icon = isDir ? '📁' : '📄';
      const sizeStr = isDir ? '' : `<span class="text-gray-500 text-[10px]">(${item.size} B)</span>`;
      const path = HTMXBridge.escapeHTML(item.path);
      html += `
        <li class="flex items-center justify-between p-1.5 rounded hover:bg-gray-800/60 cursor-pointer group"
            data-vfs-entry>
          <span class="flex items-center gap-1.5 truncate">
            <span>${icon}</span>
            <span class="${isDir ? 'text-teal-300 font-semibold' : 'text-gray-300'} group-hover:text-cyan-400">${path}</span>
          </span>
          ${sizeStr}
        </li>
      `;
    }
    html += '</ul>';
    el.innerHTML = html;
    el.querySelectorAll('[data-vfs-entry]').forEach((node, index) => {
      node.addEventListener('click', () => this.openVirtualEntry(files[index]));
    });
  }

  openVirtualEntry(entry) {
    if (entry.type === 'dir') {
      this.terminal.writeln(`${entry.path}: directory`);
      return;
    }
    try {
      this.terminal.writeln(this.vfs.readFile(entry.path));
    } catch (error) {
      this.terminal.writeln(`cat: ${error.message}`);
    }
  }

  renderWebMCPToolsList() {
    const el = document.getElementById('webmcp-tools-list');
    if (!el) return;

    const tools = this.webmcp.listTools();
    let html = '<div class="space-y-3 font-mono text-xs">';
    for (const tool of tools) {
      const toolName = HTMXBridge.escapeHTML(tool.name);
      const description = HTMXBridge.escapeHTML(tool.description);
      const schema = HTMXBridge.escapeHTML(JSON.stringify(tool.inputSchema, null, 2));
      html += `
        <div class="border border-gray-800 bg-gray-900/60 rounded p-3 hover:border-teal-500/50 transition">
          <div class="flex items-center justify-between mb-1">
            <span class="font-bold text-teal-400">${toolName}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">tool</span>
          </div>
          <p class="text-gray-400 text-xs mb-2 leading-relaxed">${description}</p>
          <pre class="bg-black/50 p-2 rounded text-[11px] text-gray-300 overflow-x-auto">${schema}</pre>
        </div>
      `;
    }
    html += '</div>';
    el.innerHTML = html;
  }

  renderWebMCPLatestLogs() {
    const el = document.getElementById('webmcp-logs-container');
    if (!el) return;

    const logs = this.webmcp.callLogs.slice(0, 15);
    if (logs.length === 0) {
      el.innerHTML = '<p class="text-gray-500 text-xs font-mono italic">No tool calls recorded yet.</p>';
      return;
    }

    let html = '<div class="space-y-2 font-mono text-xs">';
    for (const log of logs) {
      const isOk = log.status === 'success';
      const statusColor = isOk ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40' : 'text-rose-400 bg-rose-950/40 border-rose-800/40';
      const tool = HTMXBridge.escapeHTML(log.tool);
      const status = HTMXBridge.escapeHTML(log.status);
      const duration = HTMXBridge.escapeHTML(log.durationMs);
      const args = HTMXBridge.escapeHTML(JSON.stringify(log.args));
      const result = HTMXBridge.escapeHTML(JSON.stringify(log.result));
      const error = HTMXBridge.escapeHTML(log.error);
      html += `
        <div class="p-2.5 rounded border border-gray-800 bg-gray-950/50 space-y-1">
          <div class="flex items-center justify-between">
            <span class="font-semibold text-cyan-400">${tool}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded border ${statusColor}">${status} (${duration}ms)</span>
          </div>
          <div class="text-[11px] text-gray-400 truncate">Args: ${args}</div>
          ${log.result ? `<div class="text-[11px] text-gray-300 truncate">Result: ${result}</div>` : ''}
          ${log.error ? `<div class="text-[11px] text-red-400 truncate">Error: ${error}</div>` : ''}
        </div>
      `;
    }
    html += '</div>';
    el.innerHTML = html;
  }
}
