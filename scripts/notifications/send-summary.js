#!/usr/bin/env node

// Send project chat highlights to Slack based on /chat/summary-search API.
// Usage:
//   node scripts/notifications/send-summary.js --project PRJ-1001 --base-url http://localhost:3001 --keyword "リスク" --top 3 --webhook https://hooks.slack.com/services/...

const https = require('node:https');
const http = require('node:http');
const { URL } = require('node:url');

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.PROJECT_API_BASE || 'http://localhost:3001',
    keyword: 'ハイライト',
    top: 5,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('-')) continue;
    const next = argv[i + 1];
    switch (token) {
      case '--project':
      case '-p':
        options.project = next;
        i += 1;
        break;
      case '--base-url':
      case '-b':
        options.baseUrl = next;
        i += 1;
        break;
      case '--keyword':
      case '-k':
        options.keyword = next;
        i += 1;
        break;
      case '--top':
      case '-t':
        options.top = Number.parseInt(next ?? '5', 10);
        i += 1;
        break;
      case '--min-score':
        options.minScore = Number.parseFloat(next ?? '0.2');
        i += 1;
        break;
      case '--webhook':
      case '-w':
        options.webhook = next;
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
        console.warn(`Unknown option ${token}`);
        break;
    }
  }
  return options;
}

function printHelp() {
  console.log(`Usage: send-summary --project <id> [options]\n\nOptions:\n  --project, -p      Project ID (required)\n  --base-url, -b     Project API base URL (default: http://localhost:3001)\n  --keyword, -k      Search keyword or phrase (default: ハイライト)\n  --top, -t          Number of summaries to fetch (default: 5)\n  --min-score        Minimum similarity score (default: 0.2)\n  --webhook, -w      Slack Incoming Webhook URL (optional)\n  --dry-run          Print result without posting\n  --help, -h         Show this message\n`);
}

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client
      .get(url, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Request failed with status ${res.statusCode}: ${body}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

async function postSlack(webhookUrl, payload) {
  const url = new URL(webhookUrl);
  const body = Buffer.from(JSON.stringify(payload));
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': body.length,
    },
  };
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Slack webhook failed with status ${res.statusCode}: ${text}`));
          return;
        }
        resolve(text);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    process.exit(0);
  }
  if (!options.project) {
    console.error('Error: --project is required');
    printHelp();
    process.exit(1);
  }

  const params = new URLSearchParams();
  params.set('q', options.keyword);
  if (options.top) params.set('top', String(options.top));
  if (options.minScore != null) params.set('minScore', String(options.minScore));

  const endpoint = `${options.baseUrl.replace(/\/$/, '')}/api/v1/projects/${encodeURIComponent(options.project)}/chat/summary-search?${params.toString()}`;

  let results;
  try {
    results = await fetchJson(endpoint);
  } catch (error) {
    console.error('[send-summary] failed to fetch summaries:', error.message);
    process.exit(1);
  }

  if (!Array.isArray(results) || results.length === 0) {
    console.log('No summaries found for the specified query.');
    process.exit(0);
  }

  const lines = results.map((entry, index) => {
    const score = typeof entry.score === 'number' ? entry.score.toFixed(3) : '0.000';
    const header = `${index + 1}. [${entry.provider}] ${entry.channelName ?? entry.threadId} (score: ${score})`;
    const body = entry.summary ?? '';
    return `${header}\n${body}`;
  });

  const text = `*Project ${options.project} — 日次ハイライト (${options.keyword})*\n${lines.join('\n\n')}`;

  if (options.dryRun || !options.webhook) {
    console.log(text);
    process.exit(0);
  }

  try {
    const response = await postSlack(options.webhook, { text });
    console.log('Slack webhook response:', response);
  } catch (error) {
    console.error('[send-summary] failed to post to Slack:', error.message);
    process.exit(1);
  }
})();
