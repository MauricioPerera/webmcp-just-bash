import { execSync } from 'node:child_process';

const testSuites = [
  'tests/test_vfs.js',
  'tests/test_bash.js',
  'tests/test_webmcp.js',
  'tests/test_terminal.js',
  'tests/test_agent.js',
  'tests/test_custom_commands.js',
  'tests/test_cloudflare_temporary.js',
  'tests/e2e_stress_test.js'
];

console.log('====================================================');
console.log('  JUST-BASH CLONE: RUNNING ALL ORACLE TEST SUITES   ');
console.log('====================================================\n');

let totalPassed = 0;
let totalFailed = 0;

for (const suite of testSuites) {
  try {
    console.log(`>>> Executing ${suite}...`);
    execSync(`node ${suite}`, { stdio: 'inherit', cwd: process.cwd() });
    totalPassed++;
    console.log(`[PASS] ${suite}\n`);
  } catch (err) {
    totalFailed++;
    console.error(`[FAIL] ${suite}\n`);
  }
}

console.log('====================================================');
console.log(`TOTAL SUITES: ${testSuites.length} | PASSED: ${totalPassed} | FAILED: ${totalFailed}`);
console.log('====================================================');

if (totalFailed > 0) {
  process.exit(1);
} else {
  console.log('\nAll test suites passed successfully! 100% green.');
}
