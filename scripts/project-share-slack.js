#!/usr/bin/env node

/**
 * Generate a Slack message template for sharing the Projects view.
 *
 * Usage:
 *   node scripts/project-share-slack.js --url https://example.com/projects?status=active --title "今週の Projects 共有" --notes "17件をフォロー中"
 *
 * Options:
 *   --url <value>     Required. Projects 共有リンク (absolute URL)。
 *   --title <value>   Optional. 見出しに使うタイトル。デフォルトは "Projects 共有リンク"。
 *   --notes <value>   Optional. 箇条書きの末尾に補足を追加。
 *   --format <value>  Optional. 出力形式 text|markdown|json（既定: text）。
 *   --count <value>   Optional. 対象件数を bullet に追加。
 *   --post <value>    Optional. Slack Incoming Webhook URL に投稿。
 *   --help            このヘルプを表示します。
 */

const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');

const args = process.argv.slice(2);

const optionAliases = new Map([
  ['-u', 'url'],
  ['-t', 'title'],
  ['-n', 'notes'],
  ['-f', 'format'],
  ['-c', 'count'],
  ['-o', 'out'],
  ['-p', 'post'],
  ['-C', 'config'],
  ['-h', 'help'],
]);

const options = {};
for (let index = 0; index < args.length; index += 1) {
  const token = args[index];
  if (token.startsWith('--')) {
    const key = token.slice(2);
    if (key === 'help') {
      options.help = true;
      continue;
    }
    const next = args[index + 1];
    if (!next || next.startsWith('-')) {
      console.error(`Option --${key} requires a value`);
      process.exit(1);
    }
    if (key === 'post') {
      if (!Array.isArray(options.post)) {
        options.post = [];
      }
      options.post.push(next);
      index += 1;
      continue;
    }
    options[key] = next;
    index += 1;
  } else if (token.startsWith('-')) {
    const alias = optionAliases.get(token);
    if (!alias) {
      console.error(`Unknown option: ${token}`);
      process.exit(1);
    }
    if (alias === 'help') {
      options.help = true;
      continue;
    }
    const next = args[index + 1];
    if (!next || next.startsWith('-')) {
      console.error(`Option ${token} requires a value`);
      process.exit(1);
    }
    if (alias === 'post') {
      if (!Array.isArray(options.post)) {
        options.post = [];
      }
      options.post.push(next);
      index += 1;
      continue;
    }
    options[alias] = next;
    index += 1;
  } else if (!options.url) {
    options.url = token;
  } else {
    console.warn(`Ignoring unexpected argument: ${token}`);
  }
}

const USAGE_TEXT = `Usage:
  node scripts/project-share-slack.js --url <projects-share-url> [--title <title>] [--notes <notes>] [--config <path>]

Options:
  --url <value>     Required. Projects の共有リンク (絶対 URL)。
  --title <value>   Optional. Slack メッセージのタイトル。デフォルト "Projects 共有リンク"。
  --notes <value>   Optional. 箇条書きに追加するメモ。
  --format <value>  Optional. text | markdown | json。
  --count <value>   Optional. 対象件数を追加表示します。
  --out <value>     Optional. 出力内容をファイルへ保存します。
  --post <value>    Optional. Slack Incoming Webhook URL に投稿します。複数指定可。
  --config <path>   Optional. 上記オプションの既定値を含む JSON を読み込みます。
  --help            このヘルプを表示します。
`;

if (options.help) {
  console.log(USAGE_TEXT);
  process.exit(0);
}

let config = {};
if (options.config) {
  const configPath = String(options.config).trim();
  try {
    const rawConfig = fs.readFileSync(configPath, 'utf-8');
    const parsedConfig = JSON.parse(rawConfig);
    if (!parsedConfig || typeof parsedConfig !== 'object') {
      throw new Error('Config must be a JSON object');
    }
    config = parsedConfig;
  } catch (error) {
    console.error(`Failed to load config file: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

const assignDefault = (key) => {
  if (options[key] === undefined && config[key] !== undefined) {
    options[key] = config[key];
  }
};

['url', 'title', 'notes', 'format', 'count', 'out'].forEach(assignDefault);

if (config.post !== undefined) {
  const configPosts = Array.isArray(config.post) ? config.post : [config.post];
  configPosts
    .filter((value) => value !== undefined && value !== null && String(value).trim().length > 0)
    .forEach((value) => {
      if (!Array.isArray(options.post)) {
        options.post = options.post ? [options.post] : [];
      }
      options.post.push(String(value));
    });
}

if (!options.url) {
  console.log(USAGE_TEXT);
  process.exit(1);
}

options.url = String(options.url).trim();
options.title = options.title !== undefined ? String(options.title) : undefined;
options.notes = options.notes !== undefined ? String(options.notes) : undefined;
options.format = options.format !== undefined ? String(options.format) : undefined;
options.out = options.out !== undefined ? String(options.out) : undefined;
if (Array.isArray(options.post)) {
  options.post = options.post.map((value) => String(value).trim()).filter((value) => value.length > 0);
}

let parsedUrl;
try {
  parsedUrl = new URL(options.url);
} catch (error) {
  console.error(`Invalid URL provided: ${options.url}`);
  process.exit(1);
}

const statusLabels = new Map([
  ['all', 'すべて'],
  ['planned', 'Planned'],
  ['active', 'Active'],
  ['onhold', 'On Hold'],
  ['closed', 'Closed'],
]);

const params = parsedUrl.searchParams;
const status = params.get('status')?.toLowerCase() ?? 'all';
const keyword = params.get('keyword');
const manager = params.get('manager');
const tag = params.get('tag');
const tags = params.get('tags');
const health = params.get('health');

const trimmedNotes = options.notes?.trim() ?? '';
const tagList = [tag?.trim(), ...(tags ? tags.split(',').map((value) => value.trim()) : [])].filter(Boolean);

let projectCount = null;
if (typeof options.count !== 'undefined') {
  const parsedCount = Number(options.count);
  if (!Number.isFinite(parsedCount) || parsedCount < 0) {
    console.error(`Invalid count provided: ${options.count}`);
    process.exit(1);
  }
  projectCount = Math.floor(parsedCount);
}

const bulletLines = [];

if (params.has('status') && status !== 'all') {
  const label = statusLabels.get(status) ?? status;
  bulletLines.push(`• ステータス: *${label}*`);
}
if (projectCount !== null) {
  bulletLines.push(`• 件数: ${projectCount}`);
}
if (keyword) {
  bulletLines.push(`• キーワード: \`${keyword}\``);
}
if (manager) {
  bulletLines.push(`• マネージャ: ${manager}`);
}
if (health) {
  bulletLines.push(`• ヘルス: ${health}`);
}
if (tagList.length > 0) {
  bulletLines.push(`• タグ: ${tagList.join(', ')}`);
}
if (trimmedNotes) {
  bulletLines.push(`• メモ: ${trimmedNotes}`);
}
if (bulletLines.length === 0) {
  bulletLines.push('• フィルタ: 指定なし');
}

const title = options.title ?? 'Projects 共有リンク';
const generatedAt = new Date();
const timestamp = generatedAt.toLocaleString('ja-JP', { hour12: false, timeZone: 'Asia/Tokyo' });

const message = [
  `:clipboard: *${title}* _(${timestamp})_`,
  parsedUrl.toString(),
  '',
  ...bulletLines,
].join('\n');

const format = (options.format ?? 'text').toLowerCase();
const outPath = typeof options.out === 'string' ? options.out.trim() : '';
const rawWebhookOption = options.post;
const webhookTargets = Array.isArray(rawWebhookOption)
  ? rawWebhookOption.map((value) => String(value).trim()).filter(Boolean)
  : rawWebhookOption
    ? [String(rawWebhookOption).trim()].filter(Boolean)
    : [];
const filters = {
  status: params.has('status') ? status : 'all',
  keyword: keyword ?? '',
  manager: manager ?? '',
  health: health ?? '',
  tags: tagList,
  count: projectCount,
};

const markdown = [
  `**${title}** (_${timestamp}_)`,
  parsedUrl.toString(),
  '',
  ...bulletLines.map((line) => line.replace(/^• /, '- ')),
].join('\n');

const payload = {
  title,
  url: parsedUrl.toString(),
  generatedAt: generatedAt.toISOString(),
  filters,
  notes: trimmedNotes,
  message,
  projectCount,
};

const jsonOutput = JSON.stringify(payload, null, 2);

const allowedFormats = new Set(['text', 'markdown', 'json']);
if (!allowedFormats.has(format)) {
  console.error(`Unknown format: ${format}. Use text | markdown | json.`);
  process.exit(1);
}

let renderedOutput = '';

if (format === 'markdown') {
  renderedOutput = markdown;
} else if (format === 'json') {
  renderedOutput = jsonOutput;
} else {
  renderedOutput = message;
}

function postToWebhook(url, text) {
  const target = new URL(url);
  const isHttps = target.protocol === 'https:';
  if (!isHttps && target.protocol !== 'http:') {
    return Promise.reject(new Error(`Unsupported protocol for webhook: ${target.protocol}`));
  }
  const client = isHttps ? https : http;
  const body = JSON.stringify({ text });
  const timeoutMs = 10000;

  return new Promise((resolve, reject) => {
    const request = client.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: target.pathname + target.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => {
          if (chunks.length < 256) {
            chunks.push(chunk);
          }
        });
        response.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf-8');
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            resolve();
          } else {
            reject(
              new Error(
                `Failed to post to webhook (${response.statusCode ?? 'unknown'}): ${responseBody}`,
              ),
            );
          }
        });
      },
    );

    request.on('timeout', () => {
      request.destroy(new Error(`Webhook request timed out after ${timeoutMs} ms`));
    });
    request.on('error', (error) => {
      reject(error);
    });

    request.write(body);
    request.end();
  });
}

(async () => {
  console.log(renderedOutput);

  if (outPath) {
    try {
      fs.writeFileSync(outPath, `${renderedOutput}\n`, 'utf-8');
    } catch (error) {
      console.error(`Failed to write output to ${outPath}: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  }

  for (const target of webhookTargets) {
    if (!/^https?:\/\//i.test(target)) {
      console.error(`Invalid webhook URL: ${target}`);
      process.exit(1);
    }
    await postToWebhook(target, payload.message);
    console.error(`Posted share message to webhook: ${target}`);
  }
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
