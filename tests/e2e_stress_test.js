/**
 * e2e_stress_test.js - Comprehensive End-to-End, Stress, and Error Injection Battery
 * 
 * Tests every single module, function, branch, and edge case:
 * 1. VFS Error Injection & Edge Cases
 * 2. Bash Engine Syntax Torture, Error Injection & Pipeline Stress
 * 3. FastWebMCP Protocol Compliance, Tool Schema & Error Telemetry
 * 4. Autonomous Agent Tool Loop & Fallback Resilience
 * 5. LiteTerminal Autocomplete, History & ANSI Parser Under Stress
 * 6. Multi-Step Full System E2E Workflow
 */

import assert from 'node:assert/strict';
import { VirtualFS } from '../src/core/vfs.js';
import { BashRuntime } from '../src/core/bash-runtime.js';
import { WebMCPProvider } from '../src/core/webmcp-provider.js';
import { AgentRunner } from '../src/core/agent-runner.js';
import { LiteTerminal } from '../src/ui/terminal.js';

console.log('================================================================');
console.log(' STARTING COMPREHENSIVE E2E STRESS & ERROR INJECTION BATTERY   ');
console.log('================================================================\n');

let totalChecks = 0;
function check(description, fn) {
  totalChecks++;
  try {
    fn();
    console.log(`  [PASS ${String(totalChecks).padStart(3, '0')}] ${description}`);
  } catch (err) {
    console.error(`  [FAIL ${String(totalChecks).padStart(3, '0')}] ${description}`);
    console.error('         Error:', err.message);
    throw err;
  }
}

async function asyncCheck(description, fn) {
  totalChecks++;
  try {
    await fn();
    console.log(`  [PASS ${String(totalChecks).padStart(3, '0')}] ${description}`);
  } catch (err) {
    console.error(`  [FAIL ${String(totalChecks).padStart(3, '0')}] ${description}`);
    console.error('         Error:', err.message);
    throw err;
  }
}

async function runBattery() {
  const vfs = new VirtualFS();
  const bash = new BashRuntime(vfs);
  const webmcp = new WebMCPProvider(vfs, bash);
  webmcp.initDefaultTools();
  const agent = new AgentRunner(webmcp);
  bash.setAgentRunner(agent);

  // =========================================================================
  // SECTION 1: VirtualFS Error Injection & Edge Cases
  // =========================================================================
  console.log('\n>>> SECTION 1: VirtualFS Error Injection & Edge Cases');

  check('VFS: readFile throws on non-existent file', () => {
    assert.throws(() => {
      vfs.readFile('/non/existent/file.txt');
    }, /No such file or directory/);
  });

  check('VFS: readFile throws when path is a directory', () => {
    assert.throws(() => {
      vfs.readFile('/home/user');
    }, /Is a directory/);
  });

  check('VFS: writeFile throws when writing to root path "/"', () => {
    assert.throws(() => {
      vfs.writeFile('/', 'bad content');
    }, /Cannot write to root directory/);
  });

  check('VFS: writeFile throws when path conflicts with an existing directory', () => {
    assert.throws(() => {
      vfs.writeFile('/home/user', 'conflicting text');
    }, /Is a directory/);
  });

  check('VFS: mkdir throws without recursive flag on missing intermediate parent', () => {
    assert.throws(() => {
      vfs.mkdir('/a/b/c/d', { recursive: false });
    }, /No such file or directory/);
  });

  check('VFS: mkdir throws when attempting to create a directory over an existing file', () => {
    vfs.writeFile('/home/user/existing_file.txt', 'data');
    assert.throws(() => {
      vfs.mkdir('/home/user/existing_file.txt/nested', { recursive: true });
    }, /Not a directory/);
  });

  check('VFS: rm throws when attempting to remove root "/"', () => {
    assert.throws(() => {
      vfs.rm('/');
    }, /cannot remove root directory/);
  });

  check('VFS: rm throws when removing non-existent file without force', () => {
    assert.throws(() => {
      vfs.rm('/home/user/ghost_file.txt', { force: false });
    }, /No such file or directory/);
  });

  check('VFS: rm does NOT throw when removing non-existent file WITH force', () => {
    assert.doesNotThrow(() => {
      vfs.rm('/home/user/ghost_file.txt', { force: true });
    });
  });

  check('VFS: rm throws when removing directory without recursive: true', () => {
    vfs.mkdir('/home/user/test_dir');
    assert.throws(() => {
      vfs.rm('/home/user/test_dir', { recursive: false });
    }, /Is a directory/);
  });

  check('VFS: readDir throws on non-existent directory', () => {
    assert.throws(() => {
      vfs.readDir('/missing_dir');
    }, /No such file or directory/);
  });

  check('VFS: readDir throws on regular file', () => {
    assert.throws(() => {
      vfs.readDir('/home/user/README.md');
    }, /Not a directory/);
  });

  check('VFS: stat throws on non-existent path', () => {
    assert.throws(() => {
      vfs.stat('/home/user/does_not_exist.bin');
    }, /cannot stat/);
  });

  check('VFS: resolvePath handles extreme dot traversal past root', () => {
    const res = vfs.resolvePath('../../../../../../../tmp', '/home/user');
    assert.equal(res, '/tmp');
  });

  check('VFS: resolvePath handles mixed slashes and dots', () => {
    const res = vfs.resolvePath('a/./b/../c/./d/..', '/home/user');
    assert.equal(res, '/home/user/a/c');
  });

  check('VFS: event listener handles listener callback exceptions safely', () => {
    let called = false;
    const crashListener = () => {
      called = true;
      throw new Error('Listener crash test');
    };
    vfs.on('change', crashListener);
    // Should not crash the main writeFile operation
    assert.doesNotThrow(() => {
      vfs.writeFile('/home/user/event_test.txt', 'ok');
    });
    assert.equal(called, true);
    vfs.off('change', crashListener);
  });

  check('VFS: exportJSON produces valid JSON representing all files', () => {
    const json = vfs.exportJSON();
    assert.doesNotThrow(() => JSON.parse(json));
    assert.ok(json.includes('README.md'));
  });

  // =========================================================================
  // SECTION 2: Bash Engine Syntax Torture, Error Injection & Pipelines
  // =========================================================================
  console.log('\n>>> SECTION 2: Bash Engine Syntax Torture & Error Injection');

  await asyncCheck('Bash: returns exitCode 127 for unknown command', async () => {
    const res = await bash.exec('invalid_command_xyz --flag');
    assert.equal(res.exitCode, 127);
    assert.ok(res.stderr.includes('command not found'));
  });

  await asyncCheck('Bash: empty or whitespace-only command returns exitCode 0', async () => {
    const res = await bash.exec('     ');
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout, '');
    assert.equal(res.stderr, '');
  });

  await asyncCheck('Bash: redirection from non-existent file "< missing.txt" fails with exitCode 1', async () => {
    const res = await bash.exec('cat < /missing/file/xyz.txt');
    assert.equal(res.exitCode, 1);
    assert.ok(res.stderr.includes('No such file or directory'));
  });

  await asyncCheck('Bash: cd to non-existent directory fails with exitCode 1', async () => {
    const res = await bash.exec('cd /non_existent_directory_abc');
    assert.equal(res.exitCode, 1);
    assert.ok(res.stderr.includes('No such file or directory'));
  });

  await asyncCheck('Bash: cd into regular file fails with exitCode 1', async () => {
    const res = await bash.exec('cd /home/user/README.md');
    assert.equal(res.exitCode, 1);
    assert.ok(res.stderr.includes('Not a directory'));
  });

  await asyncCheck('Bash: ls on non-existent path returns exitCode 1', async () => {
    const res = await bash.exec('ls /imaginary/path');
    assert.equal(res.exitCode, 1);
    assert.ok(res.stderr.includes('cannot access'));
  });

  await asyncCheck('Bash: cat on non-existent file returns exitCode 1', async () => {
    const res = await bash.exec('cat /missing_file.log');
    assert.equal(res.exitCode, 1);
    assert.ok(res.stderr.includes('No such file or directory'));
  });

  await asyncCheck('Bash: cat on directory returns exitCode 1', async () => {
    const res = await bash.exec('cat /home/user');
    assert.equal(res.exitCode, 1);
    assert.ok(res.stderr.includes('Is a directory'));
  });

  await asyncCheck('Bash: grep with no pattern returns exitCode 2', async () => {
    const res = await bash.exec('grep');
    assert.equal(res.exitCode, 2);
    assert.ok(res.stderr.includes('search pattern required'));
  });

  await asyncCheck('Bash: grep when nothing matches returns exitCode 1', async () => {
    const res = await bash.exec('echo "alpha beta gamma" | grep "delta"');
    assert.equal(res.exitCode, 1);
    assert.equal(res.stdout, '');
  });

  await asyncCheck('Bash: grep -v inverts matches correctly', async () => {
    const res = await bash.exec('printf "foo\\nbar\\nbaz\\n" | grep -v "bar"');
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout.trim(), 'foo\nbaz');
  });

  await asyncCheck('Bash: grep -i handles case-insensitive search', async () => {
    const res = await bash.exec('echo "HELLO WORLD" | grep -i "hello"');
    assert.equal(res.exitCode, 0);
    assert.ok(res.stdout.includes('HELLO WORLD'));
  });

  await asyncCheck('Bash: grep -n prints 1-indexed line numbers', async () => {
    const res = await bash.exec('printf "one\\ntwo\\nthree\\n" | grep -n "two"');
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout.trim(), '2:two');
  });

  await asyncCheck('Bash: jq returns exitCode 1 on invalid/corrupted JSON', async () => {
    const res = await bash.exec('echo "{ invalid json " | jq .');
    assert.equal(res.exitCode, 1);
    assert.ok(res.stderr.includes('parse error'));
  });

  await asyncCheck('Bash: jq returns null/empty on missing property without crashing', async () => {
    const res = await bash.exec('echo \'{"valid": true}\' | jq .missingKey');
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout.trim(), 'null');
  });

  await asyncCheck('Bash: cp with missing arguments returns exitCode 1', async () => {
    const res = await bash.exec('cp only_one_arg');
    assert.equal(res.exitCode, 1);
    assert.ok(res.stderr.includes('missing file operand'));
  });

  await asyncCheck('Bash: mv with missing arguments returns exitCode 1', async () => {
    const res = await bash.exec('mv');
    assert.equal(res.exitCode, 1);
    assert.ok(res.stderr.includes('missing destination file operand'));
  });

  await asyncCheck('Bash: rm without -r on directory returns exitCode 1', async () => {
    vfs.mkdir('/tmp/protected_dir');
    const res = await bash.exec('rm /tmp/protected_dir');
    assert.equal(res.exitCode, 1);
    assert.ok(res.stderr.includes('Is a directory'));
  });

  await asyncCheck('Bash: stat without arguments returns exitCode 1', async () => {
    const res = await bash.exec('stat');
    assert.equal(res.exitCode, 1);
    assert.ok(res.stderr.includes('missing operand'));
  });

  await asyncCheck('Bash: which returns exitCode 1 on non-existent command', async () => {
    const res = await bash.exec('which imaginary_binary');
    assert.equal(res.exitCode, 1);
    assert.ok(res.stderr.includes('not found'));
  });

  await asyncCheck('Bash: base64 decode parses valid base64 and encodes text', async () => {
    const resEnc = await bash.exec('echo "Secret123" | base64');
    assert.equal(resEnc.exitCode, 0);
    const encoded = resEnc.stdout.trim();
    assert.ok(encoded.length > 0);

    const resDec = await bash.exec(`echo "${encoded}" | base64 -d`);
    assert.equal(resDec.exitCode, 0);
    assert.equal(resDec.stdout.trim(), 'Secret123');
  });

  await asyncCheck('Bash: tr translates characters', async () => {
    const res = await bash.exec('echo "lowercase words" | tr "a-z" "A-Z"');
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout.trim(), 'LOWERCASE WORDS');
  });

  await asyncCheck('Bash: sed performs regex substitution', async () => {
    const res = await bash.exec('echo "apple banana apple" | sed s/apple/orange/g');
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout.trim(), 'orange banana orange');
  });

  await asyncCheck('Bash: cut extracts specified field by delimiter', async () => {
    const res = await bash.exec('echo "usr:x:1000:1000:User:/home/user:/bin/bash" | cut -d ":" -f 1');
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout.trim(), 'usr');
  });

  await asyncCheck('Bash: cut out-of-range field returns empty string gracefully', async () => {
    const res = await bash.exec('echo "a,b,c" | cut -d "," -f 99');
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout.trim(), '');
  });

  await asyncCheck('Bash: awk extracts multiple fields and formats output', async () => {
    const res = await bash.exec('echo "col1 col2 col3 col4" | awk \'{print $1, $3}\'');
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout.trim(), 'col1 col3');
  });

  await asyncCheck('Bash: seq produces sequence of numbers', async () => {
    const res = await bash.exec('seq 3 6');
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout.trim(), '3\n4\n5\n6');
  });

  await asyncCheck('Bash: sort and uniq in pipeline', async () => {
    const res = await bash.exec('printf "cat\\ndog\\ncat\\napple\\n" | sort | uniq');
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout.trim(), 'apple\ncat\ndog');
  });

  await asyncCheck('Bash: sort -n handles numeric sorting correctly', async () => {
    const res = await bash.exec('printf "100\\n2\\n30\\n1\\n" | sort -n');
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout.trim(), '1\n2\n30\n100');
  });

  await asyncCheck('Bash: complex 5-stage pipeline stress test', async () => {
    const res = await bash.exec('cat /home/user/package.json | grep "version" | cut -d ":" -f 2 | tr "a-z" "A-Z" | wc -w');
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout.trim(), '1');
  });

  await asyncCheck('Bash: quotes torture: single quote preserves literal $VAR and spaces', async () => {
    await bash.exec('export TEST_VAR="expanded"');
    const res = await bash.exec('echo \'$TEST_VAR literal\'');
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout.trim(), '$TEST_VAR literal');
  });

  await asyncCheck('Bash: quotes torture: double quote expands $VAR', async () => {
    const res = await bash.exec('echo "$TEST_VAR real"');
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout.trim(), 'expanded real');
  });

  await asyncCheck('Bash: $? returns previous command exitCode', async () => {
    await bash.exec('false');
    const res = await bash.exec('echo $?');
    assert.equal(res.stdout.trim(), '1');

    await bash.exec('true');
    const res2 = await bash.exec('echo $?');
    assert.equal(res2.stdout.trim(), '0');
  });

  await asyncCheck('Bash: conditional chaining short-circuits correctly on failure', async () => {
    const res = await bash.exec('false && echo "SHOULD_NOT_EXECUTE"');
    assert.equal(res.stdout.trim(), '');

    const res2 = await bash.exec('false || echo "FALLBACK_EXECUTED"');
    assert.equal(res2.stdout.trim(), 'FALLBACK_EXECUTED');
  });

  await asyncCheck('Bash: append redirection ">>" appends data to file', async () => {
    await bash.exec('echo "first line" > /home/user/append_test.txt');
    await bash.exec('echo "second line" >> /home/user/append_test.txt');
    const res = await bash.exec('cat /home/user/append_test.txt');
    assert.equal(res.stdout.trim(), 'first line\nsecond line');
  });

  // =========================================================================
  // SECTION 3: FastWebMCP Protocol Compliance, Tool Schema & Error Telemetry
  // =========================================================================
  console.log('\n>>> SECTION 3: FastWebMCP Protocol Compliance & Error Telemetry');

  check('WebMCP: registerImperativeTool throws on missing name', () => {
    assert.throws(() => {
      webmcp.registerImperativeTool({});
    }, /WebMCP Tool must have a valid string name/);
  });

  check('WebMCP: registerImperativeTool throws on tool name with spaces', () => {
    assert.throws(() => {
      webmcp.registerImperativeTool({ name: 'my tool with space' });
    }, /Invalid tool name/);
  });

  check('WebMCP: registerImperativeTool throws on tool name with illegal characters', () => {
    assert.throws(() => {
      webmcp.registerImperativeTool({ name: 'bad/tool@name!' });
    }, /Invalid tool name/);
  });

  await asyncCheck('WebMCP: invokeTool returns error object when calling unregistered tool', async () => {
    const res = await webmcp.invokeTool('non_existent_tool_xyz', {});
    assert.equal(res.status, 'error');
    assert.ok(res.error.includes('not found in registry'));
    assert.ok(parseFloat(res.durationMs) >= 0);
  });

  await asyncCheck('WebMCP: invokeTool catches and logs tools that throw exceptions', async () => {
    webmcp.registerImperativeTool({
      name: 'failing_tool_test',
      description: 'Deliberately throws error',
      execute: async () => {
        throw new Error('Simulated internal tool crash');
      }
    });

    const res = await webmcp.invokeTool('failing_tool_test', {});
    assert.equal(res.status, 'error');
    assert.ok(res.error.includes('Simulated internal tool crash'));

    // Check telemetry log
    const lastLog = webmcp.callLogs[0];
    assert.equal(lastLog.tool, 'failing_tool_test');
    assert.equal(lastLog.status, 'error');
    assert.ok(lastLog.error.includes('Simulated internal tool crash'));
  });

  await asyncCheck('WebMCP: fs_read_file tool throws error on non-existent file cleanly', async () => {
    const res = await webmcp.invokeTool('fs_read_file', { path: '/missing_virtual_path.txt' });
    assert.equal(res.status, 'error');
    assert.ok(res.error.includes('No such file or directory'));
  });

  await asyncCheck('WebMCP: declarative tools can be scanned and invoked', async () => {
    // Simulate DOM form element
    const mockForm = {
      getAttribute: (attr) => {
        if (attr === 'toolname') return 'test_declarative_form';
        if (attr === 'tooldescription') return 'Form description';
        return null;
      },
      querySelectorAll: () => [
        { name: 'inputField', getAttribute: () => 'A string field', required: true }
      ]
    };
    const mockDoc = { querySelectorAll: () => [mockForm] };
    webmcp.scanDeclarativeTools(mockDoc);

    const registered = webmcp.getTool('test_declarative_form');
    assert.ok(registered !== null);
    assert.equal(registered.name, 'test_declarative_form');
  });

  // =========================================================================
  // SECTION 4: Autonomous Agent Tool Loop & Fallback Resilience
  // =========================================================================
  console.log('\n>>> SECTION 4: Autonomous Agent Tool Loop & Fallback Resilience');

  await asyncCheck('Agent: runQuery handles unknown / edge query gracefully', async () => {
    const chunks = [];
    const res = await agent.runQuery('random unknown query that has no keywords', {
      onChunk: (c) => chunks.push(c)
    });
    assert.ok(res.response.length > 0);
    assert.ok(chunks.length > 0);
  });

  await asyncCheck('Agent: runQuery executes tool calls to inspect package dependencies', async () => {
    const chunks = [];
    const res = await agent.runQuery('What are the dependencies in package.json?', {
      onChunk: (c) => chunks.push(c)
    });
    assert.ok(res.response.includes('fastwebmcp') || res.response.includes('htmx'));
    // Verify tool execution occurred
    const hasToolCall = chunks.some(c => c.includes('Tool Call') || c.includes('Observation'));
    assert.ok(hasToolCall);
  });

  await asyncCheck('Agent: online LLM failure triggers graceful fallback to offline runner', async () => {
    // Mock invalid API key in localStorage
    globalThis.localStorage = {
      getItem: (k) => {
        if (k === 'justbash_agent_api_key') return 'invalid_test_key_sk_123';
        if (k === 'justbash_agent_provider') return 'openai';
        return null;
      }
    };

    const chunks = [];
    const res = await agent.runQuery('What is just-bash?', {
      onChunk: (c) => chunks.push(c)
    });

    // Verify warning was emitted and offline fallback answered
    const hasFallbackWarning = chunks.some(c => c.includes('Online LLM failed') || c.includes('Falling back'));
    assert.ok(hasFallbackWarning, 'Should log fallback warning');
    assert.ok(res.response.includes('just-bash'), 'Should return offline response');

    delete globalThis.localStorage;
  });

  // =========================================================================
  // SECTION 5: LiteTerminal Autocomplete, History & ANSI Parser Under Stress
  // =========================================================================
  console.log('\n>>> SECTION 5: LiteTerminal Autocomplete, History & ANSI Under Stress');

  const term = new LiteTerminal({ vfs, bash, cwd: '/home/user' });

  check('Terminal: stripAnsi removes complex OSC 8 hyperlinks and color escapes', () => {
    const complexAnsi = '\x1b]8;;https://example.com\x07Click Here\x1b]8;;\x07 \x1b[1m\x1b[38;2;10;197;179mColored Text\x1b[0m';
    const clean = LiteTerminal.stripAnsi(complexAnsi);
    assert.equal(clean, 'Click Here Colored Text');
  });

  check('Terminal: stripAnsi handles empty, null or undefined input safely', () => {
    assert.equal(LiteTerminal.stripAnsi(''), '');
    assert.equal(LiteTerminal.stripAnsi(null), '');
    assert.equal(LiteTerminal.stripAnsi(undefined), '');
  });

  check('Terminal: ansiToHtml safely escapes HTML special characters', () => {
    const dangerous = '<script>alert("xss")</script> & "quotes"';
    const html = LiteTerminal.ansiToHtml(dangerous);
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(html.includes('&amp;'));
  });

  check('Terminal: history previous/next behaves properly at start and end bounds', () => {
    const t = new LiteTerminal({ vfs, bash });
    // Empty history
    assert.equal(t.historyPrevious(), null);
    assert.equal(t.historyNext(), null);

    t.historyPush('cmd 1');
    t.historyPush('cmd 2');

    assert.equal(t.historyPrevious(), 'cmd 2');
    assert.equal(t.historyPrevious(), 'cmd 1');
    // At boundary: should stay at cmd 1
    assert.equal(t.historyPrevious(), 'cmd 1');

    assert.equal(t.historyNext(), 'cmd 2');
    // Past boundary: returns empty line for new typing
    assert.equal(t.historyNext(), '');
  });

  check('Terminal: getCompletions handles nested directory path autocompletion', () => {
    vfs.mkdir('/home/user/deep/nested/folder', { recursive: true });
    vfs.writeFile('/home/user/deep/nested/folder/target.js', '// code');

    const completions = term.getCompletions('cat deep/nested/folder/tar');
    assert.ok(completions.length > 0);
    assert.ok(completions[0].includes('target.js'));
  });

  check('Terminal: getCompletions returns empty array for non-matching input', () => {
    const completions = term.getCompletions('cat /home/user/non_existent_prefix_xyz');
    assert.equal(completions.length, 0);
  });

  // =========================================================================
  // SECTION 6: Multi-Step Full System E2E Workflow
  // =========================================================================
  console.log('\n>>> SECTION 6: Multi-Step Full System E2E Workflow');

  await asyncCheck('Full E2E: Create script -> execute -> redirect output -> inspect via WebMCP -> query via Agent', async () => {
    // 1. Write script via bash echo redirection
    const scriptContent = 'printf "step 1\\nstep 2\\nstep 3\\n"';
    await bash.exec(`echo '${scriptContent}' > /home/user/pipeline_demo.sh`);
    assert.equal(vfs.exists('/home/user/pipeline_demo.sh'), true);

    // 2. Read and pipe script output into transformation pipeline
    await bash.exec('cat /home/user/pipeline_demo.sh | grep "step" | wc -l > /home/user/count.txt');
    assert.equal(vfs.exists('/home/user/count.txt'), true);
    const countResult = vfs.readFile('/home/user/count.txt').trim();
    assert.equal(countResult, '3');

    // 3. WebMCP tool reads the result
    const mcpRead = await webmcp.invokeTool('fs_read_file', { path: '/home/user/count.txt' });
    assert.equal(mcpRead.status, 'success');
    assert.equal(mcpRead.result.content.trim(), '3');

    // 4. Agent inspects file count and answers query
    const agentRes = await agent.runQuery('Tell me what count.txt has in /home/user');
    assert.ok(agentRes.response.length > 0);
  });

  console.log('\n================================================================');
  console.log(` E2E STRESS BATTERY COMPLETED: ${totalChecks}/${totalChecks} CHECKS PASSED (100%) `);
  console.log('================================================================\n');
}

runBattery().catch(err => {
  console.error('\n[FATAL ERROR IN E2E BATTERY]:', err);
  process.exit(1);
});
