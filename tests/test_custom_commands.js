import assert from 'node:assert';
import { VirtualFS } from '../src/core/vfs.js';
import { BashRuntime } from '../src/core/bash-runtime.js';
import { WebMCPProvider } from '../src/core/webmcp-provider.js';
import { LiteTerminal } from '../src/ui/terminal.js';

console.log('[Test Custom Commands] Starting unit tests for custom command creation...');

const vfs = new VirtualFS();
const bash = new BashRuntime(vfs);
const webmcp = new WebMCPProvider(vfs, bash);
webmcp.initDefaultTools();

// 1. Alias creation and execution
{
  await bash.exec('alias ll="ls -la"');
  assert.strictEqual(bash.aliases.get('ll'), 'ls -la');
  const res = await bash.exec('ll');
  assert.strictEqual(res.exitCode, 0);
  assert.ok(res.stdout.includes('README.md'));
  console.log('  [PASS 1] Alias created and executed successfully');
}

// 2. Alias listing and unalias
{
  const listRes = await bash.exec('alias');
  assert.strictEqual(listRes.exitCode, 0);
  assert.ok(listRes.stdout.includes("alias ll='ls -la'"));

  await bash.exec('unalias ll');
  assert.strictEqual(bash.aliases.has('ll'), false);

  const missingRes = await bash.exec('unalias missing_alias');
  assert.strictEqual(missingRes.exitCode, 1);
  console.log('  [PASS 2] Alias listing and unalias validated');
}

// 3. defcmd Bash syntax
{
  const defRes = await bash.exec('defcmd greet \'echo "Hello, $1! Total args: $#"\'');
  assert.strictEqual(defRes.exitCode, 0);
  assert.ok(defRes.stdout.includes('defined successfully'));

  const greetRes = await bash.exec('greet Mauricio');
  assert.strictEqual(greetRes.exitCode, 0);
  assert.strictEqual(greetRes.stdout.trim(), 'Hello, Mauricio! Total args: 1');

  // Verify file was written to /bin/greet
  assert.ok(vfs.exists('/bin/greet'));
  console.log('  [PASS 3] defcmd bash script creation and execution passed');
}

// 4. defcmd JavaScript syntax
{
  const defJs = await bash.exec('defcmd multiply --js "const [a, b] = args.map(Number); return { stdout: (a * b) + \'\\n\', exitCode: 0 };"');
  assert.strictEqual(defJs.exitCode, 0);

  const mulRes = await bash.exec('multiply 6 7');
  assert.strictEqual(mulRes.exitCode, 0);
  assert.strictEqual(mulRes.stdout.trim(), '42');
  console.log('  [PASS 4] defcmd JavaScript command creation and execution passed');
}

// 5. defcmd removal
{
  const rmRes = await bash.exec('defcmd -d greet');
  assert.strictEqual(rmRes.exitCode, 0);
  assert.strictEqual(bash.customCommands.has('greet'), false);
  assert.strictEqual(vfs.exists('/bin/greet'), false);
  console.log('  [PASS 5] defcmd removal validated');
}

// 6. POSIX Script in /bin ($PATH execution)
{
  vfs.writeFile('/bin/custom_posix', 'echo "POSIX Script: $1 and $2"');
  await bash.exec('chmod +x /bin/custom_posix');
  const res = await bash.exec('custom_posix Alpha Beta');
  assert.strictEqual(res.exitCode, 0);
  assert.strictEqual(res.stdout.trim(), 'POSIX Script: Alpha and Beta');
  console.log('  [PASS 6] Script in /bin executed directly from $PATH');
}

// 7. sh and bash execution of relative script
{
  vfs.writeFile('/home/user/test_run.sh', 'echo "Running test_run" && pwd');
  const shRes = await bash.exec('sh test_run.sh');
  assert.strictEqual(shRes.exitCode, 0);
  assert.ok(shRes.stdout.includes('Running test_run'));
  assert.ok(shRes.stdout.includes('/home/user'));

  const dotRes = await bash.exec('./test_run.sh');
  assert.strictEqual(dotRes.exitCode, 0);
  assert.ok(dotRes.stdout.includes('Running test_run'));
  console.log('  [PASS 7] sh / bash / relative path execution validated');
}

// 8. FastWebMCP tool: bash_register_command
{
  const regRes = await webmcp.invokeTool('bash_register_command', {
    name: 'mcp_calc',
    type: 'javascript',
    code: 'return { stdout: "CALC: " + (Number(args[0]) + 10) + "\\n", exitCode: 0 };',
    description: 'Adds 10 to input number'
  });
  assert.strictEqual(regRes.status, 'success');
  assert.strictEqual(regRes.result.command, 'mcp_calc');

  // Verify it can be executed from bash
  const execRes = await bash.exec('mcp_calc 32');
  assert.strictEqual(execRes.exitCode, 0);
  assert.strictEqual(execRes.stdout.trim(), 'CALC: 42');
  console.log('  [PASS 8] FastWebMCP bash_register_command tool verified');
}

// 9. FastWebMCP tool: bash_list_commands
{
  const listRes = await webmcp.invokeTool('bash_list_commands', {});
  assert.strictEqual(listRes.status, 'success');
  assert.ok(listRes.result.customCommands.includes('mcp_calc'));
  assert.ok(listRes.result.binExecutables.includes('custom_posix'));
  console.log('  [PASS 9] FastWebMCP bash_list_commands tool verified');
}

// 10. LiteTerminal autocomplete with custom commands
{
  const term = new LiteTerminal({ vfs, bash, cwd: '/home/user' });
  const completions = term.getCompletions('mcp_');
  assert.ok(completions.includes('mcp_calc'));

  const aliasCompletions = term.getCompletions('defc');
  assert.ok(aliasCompletions.includes('defcmd'));
  console.log('  [PASS 10] LiteTerminal autocomplete for dynamic commands verified');
}

console.log('[Test Custom Commands] All 10 test cases passed successfully! (100% green)\n');
