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
  ['-T', 'template'],
  ['-E', 'ensure-ok'],
  ['-r', 'retry'],
  ['-d', 'retry-delay'],
  ['-b', 'retry-backoff'],
  ['-m', 'retry-max-delay'],
  ['-j', 'retry-jitter'],
  ['-h', 'help'],
]);

const options = {};
for (let index = 0; index < args.length;) {
  const token = args[index];
  if (token.startsWith('--')) {
    const key = token.slice(2);
    if (key === 'help') {
      options.help = true;
      index += 1;
      continue;
    }
    if (key === 'ensure-ok') {
      options['ensure-ok'] = true;
      index += 1;
      continue;
    }
    if (key === 'post') {
      const next = args[index + 1];
      if (!next || next.startsWith('-')) {
        console.error('Option --post requires a value');
        process.exit(1);
      }
      if (!Array.isArray(options.post)) {
        options.post = [];
      }
      options.post.push(next);
      index += 2;
      continue;
    }
    const next = args[index + 1];
    if (!next || next.startsWith('-')) {
      console.error(`Option --${key} requires a value`);
      process.exit(1);
    }
    options[key] = next;
    index += 2;
  } else if (token.startsWith('-')) {
    const alias = optionAliases.get(token);
    if (!alias) {
      console.error(`Unknown option: ${token}`);
      process.exit(1);
    }
    if (alias === 'help') {
      options.help = true;
      index += 1;
      continue;
    }
    if (alias === 'ensure-ok') {
      options['ensure-ok'] = true;
      index += 1;
      continue;
    }
    if (alias === 'post') {
      const next = args[index + 1];
      if (!next || next.startsWith('-')) {
        console.error(`Option ${token} requires a value`);
        process.exit(1);
      }
      if (!Array.isArray(options.post)) {
        options.post = [];
      }
      options.post.push(next);
      index += 2;
      continue;
    }
    const next = args[index + 1];
    if (!next || next.startsWith('-')) {
      console.error(`Option ${token} requires a value`);
      process.exit(1);
    }
    options[alias] = next;
    index += 2;
  } else if (!options.url) {
    options.url = token;
    index += 1;
  } else {
    console.warn(`Ignoring unexpected argument: ${token}`);
    index += 1;
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
  --template <value> Optional. config に定義したテンプレート名を適用します。
  --ensure-ok       Optional. Webhook 応答が "ok" でなければエラーにします。
  --retry <value>   Optional. 投稿失敗時の再試行回数。
  --retry-delay <ms> Optional. 最初の再試行までの待機ミリ秒（既定: 1000）。
  --retry-backoff <value> Optional. 再試行ごとの遅延乗数（既定: 2）。
  --retry-max-delay <ms> Optional. 再試行遅延の上限ミリ秒（既定: 60000）。
  --retry-jitter <ms> Optional. 再試行遅延に加算する最大ジッタ。
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

const applyDefaultsFromObject = (source) => {
  if (!source || typeof source !== 'object') {
    return;
  }
  ['url', 'title', 'notes', 'format', 'count', 'out', 'retry', 'retry-delay', 'retry-backoff', 'retry-max-delay', 'retry-jitter'].forEach((key) => {
    if (source[key] !== undefined && options[key] === undefined) {
      options[key] = source[key];
    }
  });

  if (source.post !== undefined) {
    const posts = Array.isArray(source.post) ? source.post : [source.post];
    posts
      .filter((value) => value !== undefined && value !== null && String(value).trim().length > 0)
      .forEach((value) => {
        if (!Array.isArray(options.post)) {
          options.post = options.post ? [options.post] : [];
        }
        options.post.push(String(value));
      });
  }

  const ensureValue = source['ensure-ok'] ?? source.ensureOk;
  if (options['ensure-ok'] === undefined && ensureValue !== undefined) {
    options['ensure-ok'] = Boolean(ensureValue);
  }
};

const templates = config.templates && typeof config.templates === 'object' ? config.templates : undefined;
const templateName = options.template ?? config.template ?? config.defaultTemplate ?? config['default-template'];
if (templateName) {
  const template = templates?.[templateName];
  if (!template) {
    console.error(`Unknown template: ${templateName}`);
    process.exit(1);
  }
  applyDefaultsFromObject(template);
}

['url', 'title', 'notes', 'format', 'count', 'out', 'retry', 'retry-delay', 'retry-backoff', 'retry-max-delay', 'retry-jitter'].forEach(assignDefault);

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

const configEnsureValue = config['ensure-ok'] ?? config.ensureOk;
if (options['ensure-ok'] === undefined && configEnsureValue !== undefined) {
  options['ensure-ok'] = Boolean(configEnsureValue);
}

if (options['retry-delay'] === undefined && config.retryDelay !== undefined) {
  options['retry-delay'] = config.retryDelay;
}

if (options['retry-backoff'] === undefined && config.retryBackoff !== undefined) {
  options['retry-backoff'] = config.retryBackoff;
}

if (options['retry-max-delay'] === undefined && config.retryMaxDelay !== undefined) {
  options['retry-max-delay'] = config.retryMaxDelay;
}

if (options['retry-jitter'] === undefined && config.retryJitter !== undefined) {
  options['retry-jitter'] = config.retryJitter;
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
options.retry = options.retry !== undefined ? String(options.retry) : undefined;
options['retry-delay'] = options['retry-delay'] !== undefined ? String(options['retry-delay']) : undefined;
options['retry-backoff'] = options['retry-backoff'] !== undefined ? String(options['retry-backoff']) : undefined;
options['retry-max-delay'] = options['retry-max-delay'] !== undefined ? String(options['retry-max-delay']) : undefined;
options['retry-jitter'] = options['retry-jitter'] !== undefined ? String(options['retry-jitter']) : undefined;
if (Array.isArray(options.post)) {
  options.post = options.post.map((value) => String(value).trim()).filter((value) => value.length > 0);
}

let retryCount = 0;
if (options.retry !== undefined) {
  const parsedRetry = Number(options.retry);
  if (!Number.isFinite(parsedRetry) || parsedRetry < 0) {
    console.error(`Invalid retry value: ${options.retry}`);
    process.exit(1);
  }
  retryCount = Math.floor(parsedRetry);
}

let retryDelayMs = 1000;
if (options['retry-delay'] !== undefined) {
  const parsedDelay = Number(options['retry-delay']);
  if (!Number.isFinite(parsedDelay) || parsedDelay < 0) {
    console.error(`Invalid retry-delay value: ${options['retry-delay']}`);
    process.exit(1);
  }
  retryDelayMs = Math.floor(parsedDelay);
} else if (retryCount === 0) {
  retryDelayMs = 0;
}

let retryBackoff = 2;
if (options['retry-backoff'] !== undefined) {
  const parsedBackoff = Number(options['retry-backoff']);
  if (!Number.isFinite(parsedBackoff) || parsedBackoff < 1) {
    console.error(`Invalid retry-backoff value: ${options['retry-backoff']}`);
    process.exit(1);
  }
  retryBackoff = parsedBackoff;
}

let retryMaxDelayMs = 60000;
if (options['retry-max-delay'] !== undefined) {
  const parsedMaxDelay = Number(options['retry-max-delay']);
  if (!Number.isFinite(parsedMaxDelay) || parsedMaxDelay < 0) {
    console.error(`Invalid retry-max-delay value: ${options['retry-max-delay']}`);
    process.exit(1);
  }
  retryMaxDelayMs = Math.floor(parsedMaxDelay);
}

let retryJitterMs = 0;
if (options['retry-jitter'] !== undefined) {
  const parsedJitter = Number(options['retry-jitter']);
  if (!Number.isFinite(parsedJitter) || parsedJitter < 0) {
    console.error(`Invalid retry-jitter value: ${options['retry-jitter']}`);
    process.exit(1);
  }
  retryJitterMs = Math.floor(parsedJitter);
}

if (retryDelayMs > retryMaxDelayMs && retryMaxDelayMs > 0) {
  retryDelayMs = retryMaxDelayMs;
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
const webhookTargets = Array.isArray(options.post)
  ? options.post.map((value) => String(value).trim()).filter((value) => value.length > 0)
  : [];
const ensureOk = Boolean(options['ensure-ok']);
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

function postToWebhook(url, text, ensureOkResponse) {
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
            if (ensureOkResponse) {
              const normalized = responseBody.trim().toLowerCase();
              if (normalized !== 'ok') {
                reject(new Error(`Unexpected webhook response body: ${responseBody.trim() || '(empty)'}`));
                return;
              }
            }
            resolve(responseBody);
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function postWithRetry(url, text, ensureOkResponse, retries, initialDelayMs, backoff, maxDelayMs, jitterMs) {
  const maxDelayBound = maxDelayMs > 0 ? maxDelayMs : Number.MAX_SAFE_INTEGER;
  let attempt = 0;
  let currentDelay = initialDelayMs;

  while (true) {
    try {
      await postToWebhook(url, text, ensureOkResponse);
      return;
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      const boundedDelay = Math.max(0, Math.min(maxDelayBound, currentDelay));
      if (boundedDelay > 0) {
        const jitter = jitterMs > 0 ? Math.floor(Math.random() * (jitterMs + 1)) : 0;
        await sleep(boundedDelay + jitter);
      }
      attempt += 1;
      if (currentDelay > 0) {
        const nextDelay = Math.min(maxDelayBound, Math.max(0, Math.floor(currentDelay * backoff)));
        currentDelay = nextDelay > 0 ? nextDelay : currentDelay;
      } else {
        currentDelay = initialDelayMs;
      }
    }
  }
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
    await postWithRetry(target, payload.message, ensureOk, retryCount, retryDelayMs, retryBackoff, retryMaxDelayMs, retryJitterMs);
    console.error(`Posted share message to webhook: ${target}`);
  }
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
