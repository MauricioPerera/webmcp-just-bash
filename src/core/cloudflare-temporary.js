/**
 * Cloudflare Temporary Accounts & Worker Deployer (PoC)
 * 
 * Implements Cloudflare's autonomous agent deployment protocol (wrangler deploy --temporary):
 * 1. Requests a Proof-of-Work (PoW) challenge from Cloudflare v4 provisioning API.
 * 2. Solves the sequential SHA-256 hash chain (k segments of g hashes, recording checkpoints).
 * 3. Provisions an ephemeral throwaway preview account (60-minute lifetime) with claim URL.
 * 4. Deploys the worker script and enables the *.workers.dev subdomain route.
 */

// Pure JS SHA-256 implementation for universal browser/WASM/Node runtime compatibility
function sha256Uint8(bytes) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  const len = bytes.length;
  const bitLen = len * 8;
  const padLen = (((len + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(padLen);
  padded.set(bytes);
  padded[len] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 4, bitLen, false);

  const W = new Int32Array(64);

  for (let chunk = 0; chunk < padLen; chunk += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = view.getInt32(chunk + (i << 2), false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = ((W[i - 15] >>> 7) | (W[i - 15] << 25)) ^
                 ((W[i - 15] >>> 18) | (W[i - 15] << 14)) ^
                 (W[i - 15] >>> 3);
      const s1 = ((W[i - 2] >>> 17) | (W[i - 2] << 15)) ^
                 ((W[i - 2] >>> 19) | (W[i - 2] << 13)) ^
                 (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }

    let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;

    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H0 = (H0 + a) | 0;
    H1 = (H1 + b) | 0;
    H2 = (H2 + c) | 0;
    H3 = (H3 + d) | 0;
    H4 = (H4 + e) | 0;
    H5 = (H5 + f) | 0;
    H6 = (H6 + g) | 0;
    H7 = (H7 + h) | 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setInt32(0, H0, false);
  outView.setInt32(4, H1, false);
  outView.setInt32(8, H2, false);
  outView.setInt32(12, H3, false);
  outView.setInt32(16, H4, false);
  outView.setInt32(20, H5, false);
  outView.setInt32(24, H6, false);
  outView.setInt32(28, H7, false);
  return out;
}

// Convert base64url string to Uint8Array
function base64UrlToBytes(base64UrlStr) {
  let b64 = base64UrlStr.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Convert Uint8Array to base64 string
function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Solve Cloudflare Proof of Work challenge:
 * Sequential SHA-256 chain: h0 = SHA256(seed), then k segments of g hashes,
 * recording a 32-byte checkpoint at each segment boundary.
 */
export async function solvePowChallenge(seedBase64Url, k, g, onProgress = null) {
  let seedBytes = base64UrlToBytes(seedBase64Url);

  // Check if Node crypto is available for ultra-fast C++ hashing
  let nodeCrypto = null;
  try {
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const mod = await import('node:crypto');
      nodeCrypto = mod.default || mod;
    }
  } catch (e) {}

  const totalCheckpoints = k + 1;
  const allCheckpoints = new Uint8Array(totalCheckpoints * 32);

  if (nodeCrypto && nodeCrypto.createHash) {
    let h = nodeCrypto.createHash('sha256').update(seedBytes).digest();
    allCheckpoints.set(h, 0);

    for (let j = 0; j < k; j++) {
      for (let i = 0; i < g; i++) {
        h = nodeCrypto.createHash('sha256').update(h).digest();
      }
      allCheckpoints.set(h, (j + 1) * 32);
      if (onProgress && j % 100 === 0) {
        onProgress(Math.round(((j + 1) / k) * 100));
      }
    }
  } else {
    // Pure JS fallback
    let h = sha256Uint8(seedBytes);
    allCheckpoints.set(h, 0);

    for (let j = 0; j < k; j++) {
      for (let i = 0; i < g; i++) {
        h = sha256Uint8(h);
      }
      allCheckpoints.set(h, (j + 1) * 32);
      if (onProgress && j % 50 === 0) {
        onProgress(Math.round(((j + 1) / k) * 100));
      }
    }
  }

  return bytesToBase64(allCheckpoints);
}

/**
 * Cloudflare Temporary Account Client
 */
export class CloudflareTemporaryDeployer {
  constructor(options = {}) {
    this.apiBaseUrl = options.apiBaseUrl || 'https://api.cloudflare.com/client/v4';
    this.userAgent = options.userAgent || 'wrangler/4.102.0';
  }

  /**
   * Request a Proof-of-Work challenge from Cloudflare
   */
  async requestChallenge() {
    const res = await fetch(`${this.apiBaseUrl}/provisioning/previews/challenge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': this.userAgent
      },
      body: '{}'
    });

    if (!res.ok) {
      throw new Error(`Failed to request challenge (${res.status} ${res.statusText})`);
    }

    const body = await res.json();
    if (!body.success || !body.result) {
      throw new Error(`Invalid challenge response: ${JSON.stringify(body)}`);
    }

    return body.result; // { challengeToken, seed, k, g }
  }

  /**
   * Provision a temporary account using the solved Proof-of-Work
   */
  async provisionAccount(challengeToken, solutionBase64) {
    const res = await fetch(`${this.apiBaseUrl}/provisioning/previews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': this.userAgent
      },
      body: JSON.stringify({
        termsOfService: 'https://www.cloudflare.com/terms/',
        privacyPolicy: 'https://www.cloudflare.com/privacypolicy/',
        acceptTermsOfService: 'yes',
        challengeToken,
        solution: { checkpoints: solutionBase64 }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to provision temporary account (${res.status}): ${errText}`);
    }

    const body = await res.json();
    if (!body.success || !body.result) {
      throw new Error(`Provisioning failed: ${JSON.stringify(body)}`);
    }

    return body.result; // { account: { id, name, apiToken, expiresAt }, claim: { url, expiresAt } }
  }

  /**
   * Get the assigned workers.dev subdomain for the account
   */
  async getSubdomain(accountId, apiToken) {
    const res = await fetch(`${this.apiBaseUrl}/accounts/${accountId}/workers/subdomain`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'User-Agent': this.userAgent
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch subdomain (${res.status})`);
    }

    const body = await res.json();
    return body.result?.subdomain || 'workers';
  }

  /**
   * Deploy worker script to the temporary account
   */
  async uploadWorker(accountId, apiToken, scriptName, code) {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const metadata = JSON.stringify({
      main_module: 'index.js',
      compatibility_date: '2024-09-01'
    });

    const bodyParts = [
      '--' + boundary,
      'Content-Disposition: form-data; name="metadata"',
      'Content-Type: application/json',
      '',
      metadata,
      '--' + boundary,
      'Content-Disposition: form-data; name="index.js"; filename="index.js"',
      'Content-Type: application/javascript+module',
      '',
      code,
      '--' + boundary + '--',
      ''
    ];
    const payload = bodyParts.join('\r\n');

    const res = await fetch(`${this.apiBaseUrl}/accounts/${accountId}/workers/scripts/${scriptName}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'User-Agent': this.userAgent
      },
      body: payload
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Worker upload failed (${res.status}): ${errText}`);
    }

    // Enable subdomain route
    const subRouteRes = await fetch(`${this.apiBaseUrl}/accounts/${accountId}/workers/scripts/${scriptName}/subdomain`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'User-Agent': this.userAgent
      },
      body: JSON.stringify({ enabled: true })
    });

    if (!subRouteRes.ok) {
      const errText = await subRouteRes.text();
      throw new Error(`Subdomain activation failed (${subRouteRes.status}): ${errText}`);
    }

    return true;
  }

  /**
   * Full end-to-end deployment workflow for agents
   */
  async deployTemporary({ scriptName, code, onStatus = null }) {
    const report = (msg) => { if (onStatus) onStatus(msg); };

    report('[1/4] Solicitando desafío Proof-of-Work a Cloudflare...');
    const challenge = await this.requestChallenge();

    report(`[2/4] Resolviendo desafío SHA-256 (k=${challenge.k}, g=${challenge.g})...`);
    const solution = await solvePowChallenge(challenge.seed, challenge.k, challenge.g, (pct) => {
      report(`[2/4] Resolviendo Proof-of-Work: ${pct}% completado...`);
    });

    report('[3/4] Aprovisionando cuenta temporal de 60 minutos...');
    const prov = await this.provisionAccount(challenge.challengeToken, solution);
    const accountId = prov.account.id;
    const apiToken = prov.account.apiToken;
    const accountName = prov.account.name;
    const claimUrl = prov.claim.url;
    const expiresAt = prov.account.expiresAt;

    report('[4/4] Subiendo Worker y activando ruta en Cloudflare Global Edge...');
    const subdomain = await this.getSubdomain(accountId, apiToken);
    const safeScriptName = (scriptName || 'agent-worker').toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    await this.uploadWorker(accountId, apiToken, safeScriptName, code);

    const liveUrl = `https://${safeScriptName}.${subdomain}.workers.dev`;

    return {
      success: true,
      accountId,
      accountName,
      subdomain,
      scriptName: safeScriptName,
      liveUrl,
      claimUrl,
      expiresAt
    };
  }
}
