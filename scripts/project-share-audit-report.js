#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const inputs = [];
let format = 'text';
let failOnError = false;

for (let index = 0; index < args.length; index += 1) {
  const token = args[index];
  if (token === '--help' || token === '-h') {
    printUsage();
    process.exit(0);
  }
  if (token === '--input' || token === '-i') {
    const next = args[index + 1];
    if (!next || next.startsWith('-')) {
      console.error('Option --input requires a value');
      process.exit(1);
    }
    inputs.push(next);
    index += 1;
    continue;
  }
  if (token === '--format' || token === '-f') {
    const next = args[index + 1];
    if (!next || next.startsWith('-')) {
      console.error('Option --format requires a value');
      process.exit(1);
    }
    format = next.toLowerCase();
    index += 1;
    continue;
  }
  if (token === '--fail-on-error') {
    failOnError = true;
    continue;
  }
  console.error(`Unknown argument: ${token}`);
  process.exit(1);
}

if (inputs.length === 0) {
  console.error('No input files provided.');
  printUsage();
  process.exit(1);
}

const resolvedFiles = collectInputFiles(inputs);
if (resolvedFiles.length === 0) {
  console.error('No audit log files found for the provided inputs.');
  process.exit(1);
}

const summaries = resolvedFiles.map((file) => summarizeAuditLog(file));

if (format === 'json') {
  process.stdout.write(`${JSON.stringify(summaries, null, 2)}\n`);
} else if (format === 'text') {
  printTextSummary(summaries);
} else {
  console.error(`Unknown format: ${format}. Use text | json.`);
  process.exit(1);
}

const hasFailures = summaries.some((summary) => summary.hasFailure);
if (hasFailures && failOnError) {
  process.exit(1);
}

process.exit(0);

function printUsage() {
  console.log(`Usage:
  node scripts/project-share-audit-report.js --input <file|directory> [--input <...>] [--format text|json] [--fail-on-error]

Options:
  --input,  -i       Audit log file or directory containing JSON logs (can be specified multiple times)
  --format, -f       Output format text|json (default: text)
  --fail-on-error    Exit with code 1 when any webhook reports a final failure
  --help,   -h       Show this help message

Examples:
  node scripts/project-share-audit-report.js --input artifacts/share-primary.json
  node scripts/project-share-audit-report.js --input artifacts --fail-on-error
`);
}

function collectInputFiles(inputsList) {
  const files = [];
  for (const input of inputsList) {
    const resolved = path.resolve(input);
    if (!fs.existsSync(resolved)) {
      console.error(`Input path not found: ${input}`);
      continue;
    }
    const stats = fs.statSync(resolved);
    if (stats.isDirectory()) {
      const entries = fs.readdirSync(resolved, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
        .map((entry) => path.join(resolved, entry.name));
      files.push(...entries);
    } else if (stats.isFile()) {
      files.push(resolved);
    }
  }
  return Array.from(new Set(files));
}

function summarizeAuditLog(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    return {
      file: filePath,
      title: null,
      generatedAt: null,
      hasFailure: true,
      error: `Failed to read file: ${error instanceof Error ? error.message : error}`,
      webhooks: [],
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      file: filePath,
      title: null,
      generatedAt: null,
      hasFailure: true,
      error: `Failed to parse JSON: ${error instanceof Error ? error.message : error}`,
      webhooks: [],
    };
  }

  const attempts = Array.isArray(parsed.attempts) ? parsed.attempts : [];
  const grouped = new Map();

  for (const attempt of attempts) {
    const webhook = (attempt && attempt.webhook) || 'unknown';
    if (!grouped.has(webhook)) {
      grouped.set(webhook, {
        url: webhook,
        attempts: 0,
        successes: 0,
        failures: 0,
        lastAttempt: null,
      });
    }
    const bucket = grouped.get(webhook);
    bucket.attempts += 1;
    if (attempt && attempt.success) {
      bucket.successes += 1;
    } else {
      bucket.failures += 1;
    }
    bucket.lastAttempt = attempt;
  }

  const webhookSummaries = Array.from(grouped.values()).map((bucket) => {
    const last = bucket.lastAttempt || {};
    const lastStatus = last.success ? 'success' : 'failure';
    const responseBody = last.responseBody ?? last.error ?? '';
    return {
      url: bucket.url,
      attempts: bucket.attempts,
      successes: bucket.successes,
      failures: bucket.failures,
      lastStatus,
      lastStatusCode: last.statusCode ?? null,
      lastMessage: responseBody,
      lastTimestamp: last.timestamp ?? null,
      lastElapsedMs: last.elapsedMs ?? null,
    };
  });

  const hasFailure = webhookSummaries.some((item) => item.lastStatus !== 'success');

  return {
    file: filePath,
    title: parsed.title ?? null,
    generatedAt: parsed.generatedAt ?? null,
    hasFailure,
    webhooks: webhookSummaries,
  };
}

function printTextSummary(summaries) {
  for (const summary of summaries) {
    console.log(`=== ${summary.file} ===`);
    if (summary.error) {
      console.log(`  Error: ${summary.error}`);
      console.log('');
      continue;
    }
    if (summary.title) {
      console.log(`  Title       : ${summary.title}`);
    }
    if (summary.generatedAt) {
      console.log(`  Generated At: ${summary.generatedAt}`);
    }
    console.log('  Webhooks:');
    if (summary.webhooks.length === 0) {
      console.log('    (no attempts recorded)');
    }
    for (const webhook of summary.webhooks) {
      console.log(`    - ${webhook.url}`);
      console.log(
        `      Attempts: ${webhook.attempts} (success: ${webhook.successes}, failure: ${webhook.failures})`,
      );
      console.log(`      Last status : ${webhook.lastStatus}`);
      if (webhook.lastStatusCode !== null) {
        console.log(`      Last code   : ${webhook.lastStatusCode}`);
      }
      if (webhook.lastTimestamp) {
        console.log(`      Last at     : ${webhook.lastTimestamp}`);
      }
      if (webhook.lastElapsedMs !== null) {
        console.log(`      Last elapsed: ${webhook.lastElapsedMs} ms`);
      }
      if (webhook.lastMessage) {
        console.log(`      Last message: ${webhook.lastMessage}`);
      }
    }
    console.log(`  Overall result: ${summary.hasFailure ? 'failure' : 'success'}`);
    console.log('');
  }

  const failed = summaries.filter((summary) => summary.hasFailure);
  if (failed.length > 0) {
    console.log(`Failures detected in ${failed.length} file(s).`);
  } else {
    console.log('All webhooks reported success.');
  }
}
