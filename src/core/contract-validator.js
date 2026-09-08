// Deterministic structure + frozen-oracle integrity check. Never executes code.
const REQUIRED = ['type', 'title', 'description', 'tags', 'task', 'intent', 'target',
  'signature', 'test_command', 'budget', 'tests', 'touch_only', 'tests_sha256'];
const MAX_BYTES = 1024 * 1024;
const encoder = new TextEncoder();

function scalar(value) {
  if (value.startsWith('[') && value.endsWith(']')) {
    return value.slice(1, -1).split(',').filter(s => s.trim()).map(s => scalar(s.trim()));
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (/^\d+$/.test(value)) return Number(value);
  if (!value || /^[!&*>{|]/.test(value)) throw new Error('Unsupported frontmatter syntax');
  return value;
}

// Only the repository's flat scalars, inline lists and one-level maps are supported.
// Unsupported/ambiguous YAML fails closed instead of guessing its meaning.
export function parseContract(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match) throw new Error('Missing or malformed contract frontmatter');
  const fields = Object.create(null);
  let parent = null;
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const entry = /^( {2})?([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (!entry) throw new Error('Unsupported frontmatter line');
    const [, indent, key, raw] = entry;
    const target = indent ? fields[parent] : fields;
    if (!target || typeof target !== 'object' || Array.isArray(target)) throw new Error('Invalid nested frontmatter');
    if (Object.hasOwn(target, key)) throw new Error(`Duplicate contract field: ${key}`);
    target[key] = raw ? scalar(raw) : Object.create(null);
    if (!indent) parent = key;
  }
  for (const key of REQUIRED) {
    if (!Object.hasOwn(fields, key)) throw new Error(`Missing contract field: ${key}`);
  }
  for (const key of REQUIRED.filter(k => !['tags', 'touch_only', 'budget'].includes(k))) {
    if (typeof fields[key] !== 'string' || !fields[key].trim()) throw new Error(`Invalid contract field: ${key}`);
  }
  for (const key of ['tags', 'touch_only']) {
    if (!Array.isArray(fields[key]) || !fields[key].length || fields[key].some(v => typeof v !== 'string' || !v.trim())) {
      throw new Error(`Invalid contract list: ${key}`);
    }
  }
  if (fields.type !== 'Task Contract') throw new Error('Contract type must be Task Contract');
  if (!Number.isInteger(fields.budget?.max_cyclomatic_complexity) || fields.budget.max_cyclomatic_complexity < 1) {
    throw new Error('Invalid complexity budget');
  }
  if (!/^tests\/[A-Za-z0-9_-]+\.js$/.test(fields.tests)) throw new Error('Unsafe test oracle path');
  if (!/^[a-fA-F0-9]{64}$/.test(fields.tests_sha256)) throw new Error('Invalid tests_sha256');
  return fields;
}

async function readRepositoryAsset(path) {
  // The caller supplies only validated repository-relative paths, never URLs.
  const url = new URL(`../../${path}`, import.meta.url);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Repository assets require an HTTP-served site');
  const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Cannot load ${path}: HTTP ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error(`Empty response for ${path}`);
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_BYTES) throw new Error('Contract asset exceeds 1 MiB limit');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

function limited(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_BYTES) throw new Error('Invalid or oversized contract asset');
  return bytes;
}

export async function validateContract(contractName, vfs, readAsset = readRepositoryAsset) {
  if (typeof contractName !== 'string') throw new Error('contractName must be a string');
  const virtual = contractName.startsWith('/');
  if (!virtual && !/^contract-[A-Za-z0-9_-]+\.md$/.test(contractName)) throw new Error('Use a contract filename or absolute virtual path');
  const contractPath = virtual ? vfs.resolvePath(contractName) : `knowledge/contracts/${contractName}`;
  const bytes = limited(virtual ? encoder.encode(vfs.readFile(contractPath)) : await readAsset(contractPath));
  const fields = parseContract(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const oraclePath = virtual ? `/${fields.tests}` : fields.tests;
  const oracle = limited(virtual ? encoder.encode(vfs.readFile(oraclePath)) : await readAsset(oraclePath));
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 requires Web Crypto in a secure context');
  const digest = await crypto.subtle.digest('SHA-256', oracle);
  const actual = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  if (actual !== fields.tests_sha256.toLowerCase()) throw new Error(`tests_sha256 mismatch: expected ${fields.tests_sha256}, got ${actual}`);
  return {
    contract: contractPath, status: 'verified', source: virtual ? 'virtual-filesystem' : 'served-repository',
    checks: ['required-fields', 'field-types', 'oracle-sha256'], oracle: oraclePath,
    expectedSha256: fields.tests_sha256.toLowerCase(), actualSha256: actual,
    testsExecuted: false, note: 'Structure and frozen test-file hash verified. Test execution and implementation correctness are not verified.',
    timestamp: new Date().toISOString()
  };
}
