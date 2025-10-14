#!/usr/bin/env node

const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.PROJECT_API_BASE || 'http://localhost:3000',
    eventType: 'SIGNED',
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    switch (token) {
      case '--project':
      case '-p':
        options.contractId = next;
        i += 1;
        break;
      case '--code':
      case '-c':
        options.contractCode = next;
        i += 1;
        break;
      case '--event':
      case '-e':
        options.eventType = next;
        i += 1;
        break;
      case '--customer-email':
        options.customerEmail = next;
        i += 1;
        break;
      case '--base-url':
      case '-b':
        options.baseUrl = next;
        i += 1;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        break;
    }
  }
  return options;
}

function printHelp() {
  console.log(`Usage: replay-invoice --project <id> --code <code> [options]\n\nOptions:\n  --project, -p        Contract ID (required)\n  --code, -c           Contract code (required)\n  --event, -e          Event type (default SIGNED)\n  --customer-email     Optional recipient email\n  --base-url, -b       API base URL (default http://localhost:3000)\n  --dry-run            Show payload without POST\n  --help               Show this help\n`);
}

async function postJson(url, body) {
  const target = new URL(url);
  const payload = Buffer.from(JSON.stringify(body));
  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length,
    },
  };
  const client = target.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(target, requestOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${text}`));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch {
          resolve(text);
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    process.exit(0);
  }
  if (!options.contractId || !options.contractCode) {
    console.error('Error: --project and --code are required');
    printHelp();
    process.exit(1);
  }

  const payload = {
    contractId: options.contractId,
    contractCode: options.contractCode,
    eventType: options.eventType,
    customerEmail: options.customerEmail,
  };

  if (options.dryRun) {
    console.log('[dry-run] POST', `${options.baseUrl.replace(/\/$/, '')}/billing/contracts/replay`);
    console.log(JSON.stringify(payload, null, 2));
    process.exit(0);
  }

  try {
    const response = await postJson(`${options.baseUrl.replace(/\/$/, '')}/billing/contracts/replay`, payload);
    console.log('Replay response:', response);
  } catch (error) {
    console.error('[replay-invoice] failed:', error.message);
    process.exit(1);
  }
})();
