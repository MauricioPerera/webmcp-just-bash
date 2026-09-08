/**
 * main.js - Application Entry Point for 100% Client-Side Just-Bash Clone
 */

import { VirtualFS } from './core/vfs.js';
import { BashRuntime } from './core/bash-runtime.js';
import { WebMCPProvider } from './core/webmcp-provider.js';
import { AgentRunner } from './core/agent-runner.js';
import { LiteTerminal } from './ui/terminal.js';
import { HTMXBridge } from './ui/htmx-bridge.js';
import { JUST_BASH_ASCII, WELCOME_MESSAGE } from './ui/ascii-art.js';

// Application initialization
window.addEventListener('DOMContentLoaded', () => {
  // 0. Initialize theme from localStorage
  try {
    const savedTheme = localStorage.getItem('justbash:theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  } catch (e) {}

  // 1. Initialize Core Services
  const vfs = new VirtualFS();
  const bash = new BashRuntime(vfs);
  const webmcp = new WebMCPProvider(vfs, bash);
  webmcp.initDefaultTools();

  const agent = new AgentRunner(webmcp);
  bash.setAgentRunner(agent);

  // 2. Initialize Terminal UI
  const terminalContainer = document.getElementById('terminal-container');
  const term = new LiteTerminal({
    vfs,
    bash,
    cwd: '/home/user',
    onCommand: async (cmd) => {
      return await bash.exec(cmd);
    }
  });

  if (terminalContainer) {
    term.mount(terminalContainer);
    term.writeln(JUST_BASH_ASCII);
    term.write(WELCOME_MESSAGE);
  }

  // 3. Initialize HTMX and Reactive Bridge
  const htmxBridge = new HTMXBridge(vfs, bash, webmcp, term);
  webmcp.scanDeclarativeTools(document);

  // Render initial panels
  htmxBridge.renderFileExplorer();
  htmxBridge.renderWebMCPToolsList();
  htmxBridge.renderWebMCPLatestLogs();

  // 4. Global helper for quick execution
  window.quickRunCommand = (cmd) => {
    window.switchTab('terminal');
    const playgroundEl = document.getElementById('playground');
    if (playgroundEl) {
      playgroundEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    term.executeCommandLine(cmd);
  };

  // 5. Global Tab Switcher
  window.switchTab = (tabName) => {
    const tabs = ['terminal', 'explorer', 'webmcp', 'kdd', 'settings'];
    for (const t of tabs) {
      const panel = document.getElementById(`tab-panel-${t}`);
      const btn = document.getElementById(`tab-btn-${t}`);
      if (panel) {
        panel.classList.toggle('hidden', t !== tabName);
      }
      if (btn) {
        btn.classList.toggle('tab-active', t === tabName);
      }
    }
    if (tabName === 'terminal') {
      term.focus();
    } else if (tabName === 'explorer') {
      htmxBridge.renderFileExplorer();
    } else if (tabName === 'webmcp') {
      htmxBridge.renderWebMCPToolsList();
      htmxBridge.renderWebMCPLatestLogs();
    }
  };

  // 6. Theme Toggle Handler
  window.toggleTheme = () => {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const nextTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem('justbash:theme', nextTheme);
    } catch (e) {}
  };

  // 7. Copy Snippet Helper
  window.copySnippet = (elementId, btnElement) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const text = el.innerText || el.textContent;
    navigator.clipboard.writeText(text.trim()).then(() => {
      if (btnElement) {
        const origText = btnElement.innerText;
        btnElement.innerText = 'Copied!';
        setTimeout(() => {
          btnElement.innerText = origText;
        }, 2000);
      }
    }).catch(() => {});
  };

  // 8. BYOK Settings Handler
  window.saveAgentSettings = () => {
    const keyInput = document.getElementById('agent-api-key');
    const providerSelect = document.getElementById('agent-provider');
    const modelInput = document.getElementById('agent-model');

    agent.setApiKeyConfig({
      key: keyInput?.value.trim(),
      provider: providerSelect?.value,
      model: modelInput?.value.trim()
    });

    alert('Agent settings enabled for this browser tab only.');
    window.switchTab('terminal');
  };

  window.clearAgentSettings = () => {
    agent.setApiKeyConfig(null);
    const keyInput = document.getElementById('agent-api-key');
    if (keyInput) keyInput.value = '';
    alert('API key cleared from this tab.');
  };

  document.addEventListener('click', (event) => {
    const control = event.target.closest('[data-action]');
    if (!control) return;

    switch (control.dataset.action) {
      case 'toggle-theme':
        window.toggleTheme();
        break;
      case 'switch-tab':
        window.switchTab(control.dataset.tab);
        break;
      case 'quick-run':
        window.quickRunCommand(control.dataset.command);
        break;
      case 'new-note':
        window.quickRunCommand(`touch /home/user/note_${Date.now()}.txt`);
        break;
      case 'save-agent-settings':
        window.saveAgentSettings();
        break;
      case 'clear-agent-settings':
        window.clearAgentSettings();
        break;
      case 'copy-snippet':
        window.copySnippet(control.dataset.snippet, control);
        break;
      default:
        break;
    }
  });

  const runBashForm = document.getElementById('run-bash-form');
  runBashForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = webmcp.invokeTool('run_bash', { command: runBashForm.elements.command?.value || '' }).then(response => {
      if (response.status === 'error') throw new Error(response.error);
      window.switchTab('terminal');
      term.writeln(response.result.stdout || response.result.stderr || '(no output)');
      return response.result;
    });
    if (event.agentInvoked && typeof event.respondWith === 'function') event.respondWith(result);
    else result.catch(error => term.writeln(error.message));
  });

  // Expose singletons for debugging in console or testing
  window.__justbash = { vfs, bash, webmcp, agent, term };
  console.log('[Just-Bash] Client-side application mounted successfully.');
});
