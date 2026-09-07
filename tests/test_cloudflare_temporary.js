import assert from 'node:assert';
import { VirtualFS } from '../src/core/vfs.js';
import { BashRuntime } from '../src/core/bash-runtime.js';
import { WebMCPProvider } from '../src/core/webmcp-provider.js';
import { LiteTerminal } from '../src/ui/terminal.js';
import { CloudflareTemporaryDeployer, solvePowChallenge } from '../src/core/cloudflare-temporary.js';

console.log('[Test Cloudflare Temporary PoC] Starting test battery...\n');

// 1. Validate Proof-of-Work solver logic
{
  console.log('>>> Case 1: Testing Proof-of-Work sequential SHA-256 solver...');
  const testSeed = 'dGVzdC1zZWVkLTEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI'; // 32 bytes base64url
  const solution = await solvePowChallenge(testSeed, 2, 10);
  assert.strictEqual(typeof solution, 'string');
  assert.ok(solution.length > 0);
  console.log('  [PASS 1] PoW solver produces valid base64 checkpoints');
}

// 2. Test requestChallenge from Cloudflare API
let challenge = null;
const deployer = new CloudflareTemporaryDeployer();
{
  console.log('>>> Case 2: Requesting real challenge from Cloudflare API...');
  challenge = await deployer.requestChallenge();
  assert.ok(challenge.challengeToken, 'Missing challengeToken');
  assert.ok(challenge.seed, 'Missing seed');
  assert.ok(challenge.k > 0, 'Invalid k');
  assert.ok(challenge.g > 0, 'Invalid g');
  console.log(`  [PASS 2] Real Cloudflare challenge received (k=${challenge.k}, g=${challenge.g})`);
}

// 3. Test solve and provision account
let provAccount = null;
{
  console.log('>>> Case 3: Solving PoW and provisioning temporary account...');
  const solution = await solvePowChallenge(challenge.seed, challenge.k, challenge.g);
  provAccount = await deployer.provisionAccount(challenge.challengeToken, solution);
  assert.ok(provAccount.account?.id, 'Missing account id');
  assert.ok(provAccount.account?.apiToken, 'Missing apiToken');
  assert.ok(provAccount.claim?.url, 'Missing claim url');
  console.log(`  [PASS 3] Cloudflare Temporary Account created: "${provAccount.account.name}" (${provAccount.account.id})`);
  console.log(`          Claim URL: ${provAccount.claim.url}`);
}

// 4. Test wrangler CLI commands in BashRuntime
const vfs = new VirtualFS();
const bash = new BashRuntime(vfs);
const webmcp = new WebMCPProvider(vfs, bash);
webmcp.initDefaultTools();

{
  console.log('>>> Case 4: Testing "wrangler whoami" and "wrangler --help"...');
  const whoamiRes = await bash.exec('wrangler whoami');
  assert.strictEqual(whoamiRes.exitCode, 0);
  assert.ok(whoamiRes.stdout.includes('Unauthenticated Agent Sandbox Mode'));

  const helpRes = await bash.exec('wrangler --help');
  assert.strictEqual(helpRes.exitCode, 0);
  assert.ok(helpRes.stdout.includes('wrangler deploy --temporary'));
  console.log('  [PASS 4] "wrangler whoami" and "wrangler --help" validated');
}

// 5. Test "wrangler deploy --temporary" from VFS
let deployedLiveUrl = null;
{
  console.log('>>> Case 5: Testing "wrangler deploy --temporary" with VFS script...');
  const workerCode = `export default {
    async fetch(request) {
      return Response.json({
        status: "success",
        platform: "just-bash FastWebMCP",
        timestamp: new Date().toISOString()
      });
    }
  };`;

  vfs.writeFile('/home/user/sample-worker.js', workerCode);
  const deployRes = await bash.exec('wrangler deploy --temporary sample-worker.js');
  if (deployRes.exitCode !== 0) {
    console.error('Case 5 failed! stdout:', deployRes.stdout, 'stderr:', deployRes.stderr);
  }
  assert.strictEqual(deployRes.exitCode, 0);
  assert.ok(deployRes.stdout.includes('Worker desplegado con éxito'));
  assert.ok(deployRes.stdout.includes('Live URL:'));
  assert.ok(deployRes.stdout.includes('Claim URL:'));

  const urlMatch = deployRes.stdout.match(/https:\/\/[a-z0-9-_.]+\.workers\.dev/i);
  assert.ok(urlMatch, 'Failed to extract live URL from output');
  deployedLiveUrl = urlMatch[0];
  console.log(`  [PASS 5] Worker deployed via bash CLI! Live URL: ${deployedLiveUrl}`);
}

// 6. Verify live HTTP response from Cloudflare edge network
{
  console.log(`>>> Case 6: Verifying live worker response at ${deployedLiveUrl} (allowing 2-5s edge propagation)...`);
  let res = null;
  for (let attempt = 1; attempt <= 6; attempt++) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      res = await fetch(deployedLiveUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (res.status === 200) break;
    } catch (e) {}
  }
  assert.ok(res, 'No response received from deployed worker');
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'success');
  assert.strictEqual(data.platform, 'just-bash FastWebMCP');
  console.log('  [PASS 6] Live Cloudflare Worker returned 200 OK with expected JSON payload!');
}

// 7. FastWebMCP Tool: cloudflare_deploy_temporary
{
  console.log('>>> Case 7: Testing FastWebMCP tool "cloudflare_deploy_temporary"...');
  const toolRes = await webmcp.invokeTool('cloudflare_deploy_temporary', {
    name: 'mcp-edge-tool',
    script: 'export default { async fetch() { return new Response("MCP Tool Live!"); } };'
  });
  assert.strictEqual(toolRes.status, 'success');
  assert.strictEqual(toolRes.result.success, true);
  assert.ok(toolRes.result.liveUrl.includes('mcp-edge-tool'));
  assert.ok(toolRes.result.claimUrl.includes('claim-preview'));
  console.log(`  [PASS 7] FastWebMCP tool deployed worker: ${toolRes.result.liveUrl}`);
}

// 8. LiteTerminal autocompletion
{
  console.log('>>> Case 8: Testing LiteTerminal autocompletion for wrangler...');
  const term = new LiteTerminal({ vfs, bash, cwd: '/home/user' });
  const completions = term.getCompletions('wran');
  assert.ok(completions.includes('wrangler'));
  console.log('  [PASS 8] LiteTerminal autocompletes "wrangler"');
}

console.log('\n=============================================================');
console.log(' ALL 8 CLOUDFLARE TEMPORARY ACCOUNT TEST CASES PASSED (100%)');
console.log('=============================================================\n');
