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
const path = require('node:path');
const { buildShareTemplate } = require('../shared/cjs/share-template');

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
  ['-L', 'list-templates'],
  ['-X', 'remove-template'],
  ['-E', 'ensure-ok'],
  ['-R', 'respect-retry-after'],
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
    if (key === 'respect-retry-after') {
      options['respect-retry-after'] = true;
      index += 1;
      continue;
    }
    if (key === 'list-templates') {
      options['list-templates'] = true;
      index += 1;
      continue;
    }
    if (key === 'remove-template') {
      const next = args[index + 1];
      if (!next || next.startsWith('-')) {
        console.error('Option --remove-template requires a value');
        process.exit(1);
      }
      if (!Array.isArray(options['remove-template'])) {
        options['remove-template'] = [];
      }
      options['remove-template'].push(next);
      index += 2;
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
    if (key === 'fetch-metrics') {
      options['fetch-metrics'] = true;
      index += 1;
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
    if (alias === 'respect-retry-after') {
      options['respect-retry-after'] = true;
      index += 1;
      continue;
    }
    if (alias === 'list-templates') {
      options['list-templates'] = true;
      index += 1;
      continue;
    }
    if (alias === 'remove-template') {
      const next = args[index + 1];
      if (!next || next.startsWith('-')) {
        console.error(`Option ${token} requires a value`);
        process.exit(1);
      }
      if (!Array.isArray(options['remove-template'])) {
        options['remove-template'] = [];
      }
      options['remove-template'].push(next);
      index += 2;
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
  --respect-retry-after Optional. Webhook 応答の Retry-After ヘッダーがあれば待機時間に反映します。
  --fetch-metrics   Optional. Projects API から KPI を取得し JSON 出力へ含めます。
  --projects-api-base <url> Optional. Projects API のベース URL（省略時は共有リンクのオリジン）。
  --projects-api-token <value> Optional. Projects API への Bearer トークン。
  --projects-api-tenant <value> Optional. Projects API 呼び出し時の X-Tenant-ID。
  --projects-api-timeout <ms> Optional. Projects API 呼び出しのタイムアウト（既定: 10000）。
  --help            このヘルプを表示します。
`;

if (options.help) {
  console.log(USAGE_TEXT);
  process.exit(0);
}

let config = {};
let configPath = null;
if (options.config) {
  configPath = String(options.config).trim();
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
  [
    'url',
    'title',
    'notes',
    'format',
    'count',
    'out',
    'retry',
    'retry-delay',
    'retry-backoff',
    'retry-max-delay',
    'retry-jitter',
    'audit-log',
    'fetch-metrics',
    'projects-api-base',
    'projects-api-token',
    'projects-api-tenant',
    'projects-api-timeout',
  ].forEach((key) => {
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

const removalTargets = Array.isArray(options['remove-template'])
  ? options['remove-template']
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0)
  : [];

let managementPerformed = false;

if (removalTargets.length > 0) {
  if (!configPath) {
    console.error('Using --remove-template requires --config <path>');
    process.exit(1);
  }
  if (!templates || Object.keys(templates).length === 0) {
    console.error('No templates defined in the provided config.');
    process.exit(1);
  }
  const missing = removalTargets.filter((name) => !Object.prototype.hasOwnProperty.call(templates, name));
  if (missing.length > 0) {
    missing.forEach((name) => {
      console.error(`Unknown template: ${name}`);
    });
    process.exit(1);
  }
  removalTargets.forEach((name) => {
    delete templates[name];
    console.log(`Removed template: ${name}`);
  });
  if (Object.keys(templates).length === 0) {
    delete config.templates;
  }
  try {
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
  } catch (error) {
    console.error(`Failed to update config file: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
  managementPerformed = true;
}

if (options['list-templates']) {
  const entries = templates ? Object.entries(templates) : [];
  if (entries.length === 0) {
    console.log('No templates defined.');
  } else {
    console.log('Available templates:');
    entries
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([name, template]) => {
        const title = template && typeof template === 'object' && template.title ? String(template.title) : '';
        if (title) {
          console.log(`- ${name} (title: ${title})`);
        } else {
          console.log(`- ${name}`);
        }
      });
  }
  managementPerformed = true;
}

if (managementPerformed) {
  process.exit(0);
}

const templateName = options.template ?? config.template ?? config.defaultTemplate ?? config['default-template'];
if (templateName) {
  const template = templates?.[templateName];
  if (!template) {
    console.error(`Unknown template: ${templateName}`);
    process.exit(1);
  }
  applyDefaultsFromObject(template);
}

[
  'url',
  'title',
  'notes',
  'format',
  'count',
  'out',
  'retry',
  'retry-delay',
  'retry-backoff',
  'retry-max-delay',
  'retry-jitter',
  'audit-log',
  'fetch-metrics',
  'projects-api-base',
  'projects-api-token',
  'projects-api-tenant',
  'projects-api-timeout',
].forEach(assignDefault);

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

if (config.projectsApi && typeof config.projectsApi === 'object') {
  const projectsApi = config.projectsApi;
  if (options['projects-api-base'] === undefined && typeof projectsApi.baseUrl === 'string') {
    options['projects-api-base'] = projectsApi.baseUrl;
  }
  if (options['projects-api-token'] === undefined && typeof projectsApi.token === 'string') {
    options['projects-api-token'] = projectsApi.token;
  }
  if (options['projects-api-tenant'] === undefined && typeof projectsApi.tenant === 'string') {
    options['projects-api-tenant'] = projectsApi.tenant;
  }
  const timeoutCandidate = projectsApi.timeoutMs ?? projectsApi.timeout;
  if (options['projects-api-timeout'] === undefined && timeoutCandidate !== undefined) {
    options['projects-api-timeout'] = timeoutCandidate;
  }
  if (options['fetch-metrics'] === undefined && typeof projectsApi.fetchMetrics === 'boolean') {
    options['fetch-metrics'] = projectsApi.fetchMetrics;
  }
}

const configRespectRetryAfter = config['respect-retry-after'] ?? config.respectRetryAfter;
if (options['respect-retry-after'] === undefined && configRespectRetryAfter !== undefined) {
  options['respect-retry-after'] = Boolean(configRespectRetryAfter);
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
options['audit-log'] = options['audit-log'] !== undefined ? String(options['audit-log']) : undefined;
options['projects-api-base'] = options['projects-api-base'] !== undefined ? String(options['projects-api-base']) : undefined;
options['projects-api-token'] = options['projects-api-token'] !== undefined ? String(options['projects-api-token']) : undefined;
options['projects-api-tenant'] = options['projects-api-tenant'] !== undefined ? String(options['projects-api-tenant']) : undefined;
options['projects-api-timeout'] = options['projects-api-timeout'] !== undefined ? String(options['projects-api-timeout']) : undefined;
if (options['projects-api-base'] === undefined && typeof process.env.PROJECTS_API_BASE === 'string') {
  options['projects-api-base'] = process.env.PROJECTS_API_BASE;
}
if (options['projects-api-token'] === undefined && typeof process.env.PROJECTS_API_TOKEN === 'string') {
  options['projects-api-token'] = process.env.PROJECTS_API_TOKEN;
}
if (options['projects-api-tenant'] === undefined && typeof process.env.PROJECTS_API_TENANT === 'string') {
  options['projects-api-tenant'] = process.env.PROJECTS_API_TENANT;
}
if (options['projects-api-timeout'] === undefined && typeof process.env.PROJECTS_API_TIMEOUT === 'string') {
  options['projects-api-timeout'] = process.env.PROJECTS_API_TIMEOUT;
}
options['respect-retry-after'] = Boolean(options['respect-retry-after']);
if (typeof options['fetch-metrics'] === 'string') {
  const normalizedFetchValue = options['fetch-metrics'].trim().toLowerCase();
  options['fetch-metrics'] = ['1', 'true', 'yes', 'on'].includes(normalizedFetchValue);
} else {
  options['fetch-metrics'] = Boolean(options['fetch-metrics']);
}
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

let projectsApiTimeoutMs = 10000;
if (options['projects-api-timeout'] !== undefined) {
  const parsedTimeout = Number(options['projects-api-timeout']);
  if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
    console.error(`Invalid projects-api-timeout value: ${options['projects-api-timeout']}`);
    process.exit(1);
  }
  projectsApiTimeoutMs = Math.floor(parsedTimeout);
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
const trimmedKeyword = keyword?.trim() ?? '';
const trimmedManager = manager?.trim() ?? '';
const trimmedHealth = health?.trim() ?? '';

let projectCount = null;
if (typeof options.count !== 'undefined') {
  const parsedCount = Number(options.count);
  if (!Number.isFinite(parsedCount) || parsedCount < 0) {
    console.error(`Invalid count provided: ${options.count}`);
    process.exit(1);
  }
  projectCount = Math.floor(parsedCount);
}

const generatedAt = new Date();

const format = (options.format ?? 'text').toLowerCase();
const outPath = typeof options.out === 'string' ? options.out.trim() : '';
const webhookTargets = Array.isArray(options.post)
  ? options.post.map((value) => String(value).trim()).filter((value) => value.length > 0)
  : [];
const ensureOk = Boolean(options['ensure-ok']);
const auditLogPath = typeof options['audit-log'] === 'string' ? options['audit-log'].trim() : '';
const auditEvents = auditLogPath ? [] : null;
const shareFilters = {
  status: params.has('status') ? status : 'all',
  statusLabel: statusLabels.get(status) ?? status,
  keyword: trimmedKeyword,
  manager: trimmedManager,
  health: trimmedHealth,
  tags: tagList,
  count: projectCount,
};

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
          const statusCode = response.statusCode ?? null;
          const retryAfterMs = parseRetryAfterMs(response.headers);
          if (statusCode && statusCode >= 200 && statusCode < 300) {
            if (ensureOkResponse) {
              const normalized = responseBody.trim().toLowerCase();
              if (normalized !== 'ok') {
                const error = new Error(`Unexpected webhook response body: ${responseBody.trim() || '(empty)'}`);
                error.statusCode = statusCode;
                error.responseBody = responseBody;
                error.retryAfterMs = retryAfterMs ?? null;
                reject(error);
                return;
              }
            }
            resolve({ statusCode, responseBody, retryAfterMs });
          } else {
            const error = new Error(
              `Failed to post to webhook (${statusCode ?? 'unknown'}): ${responseBody}`,
            );
            error.statusCode = statusCode;
            error.responseBody = responseBody;
            error.retryAfterMs = retryAfterMs ?? null;
            reject(error);
          }
        });
      },
    );

    request.on('timeout', () => {
      request.destroy(new Error(`Webhook request timed out after ${timeoutMs} ms`));
    });
    request.on('error', (error) => {
      error.statusCode = null;
      error.retryAfterMs = null;
      reject(error);
    });

    request.write(body);
    request.end();
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseRetryAfterMs(headers) {
  if (!headers) {
    return null;
  }
  const candidate = headers['retry-after'];
  const value = Array.isArray(candidate) ? candidate[0] : candidate;
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    const numericMs = asNumber * 1000;
    return numericMs >= 0 ? Math.floor(numericMs) : null;
  }
  const parsedDate = Date.parse(trimmed);
  if (!Number.isNaN(parsedDate)) {
    const diff = parsedDate - Date.now();
    return diff > 0 ? Math.floor(diff) : 0;
  }
  return null;
}

async function fetchShareMetrics({ baseUrl, token, tenant, timeoutMs }) {
  const resolvedBase = baseUrl ? baseUrl.trim() : '';
  const apiBaseUrl = resolvedBase.length > 0 ? resolvedBase : parsedUrl.origin;
  let apiBase;
  try {
    apiBase = new URL(apiBaseUrl);
  } catch (error) {
    throw new Error(`Invalid projects API base URL: ${apiBaseUrl}`);
  }

  const forwardKeys = ['status', 'keyword', 'manager', 'tag', 'tags', 'health'];
  const buildSearchParams = (overrides = {}) => {
    const search = new URLSearchParams();
    for (const key of forwardKeys) {
      const values = parsedUrl.searchParams.getAll(key);
      if (values.length === 0) {
        continue;
      }
      if (values.length === 1) {
        const value = values[0]?.trim();
        if (value) {
          search.set(key, value);
        }
      } else {
        values
          .map((value) => value?.trim())
          .filter((value) => value && value.length > 0)
          .forEach((value) => {
            search.append(key, value);
          });
      }
    }

    for (const [key, value] of Object.entries(overrides)) {
      if (value === null || value === undefined || value === '') {
        search.delete(key);
      } else {
        search.set(key, String(value));
      }
    }

    if (!search.has('first')) {
      search.set('first', '1');
    }

    return search;
  };

  const headers = {
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (tenant) {
    headers['X-Tenant-ID'] = tenant;
  }

  const requestLog = [];
  const executeRequest = async (label, overrides) => {
    const url = new URL('/api/v1/projects', apiBase);
    url.search = buildSearchParams(overrides).toString();
    const controller = new AbortController();
    const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Projects API returned ${response.status}`);
      }
      const data = await response.json();
      requestLog.push({
        label,
        url: url.toString(),
        status: response.status,
        total: data?.meta?.total ?? null,
      });
      return data;
    } catch (error) {
      if (error && typeof error === 'object' && error.name === 'AbortError') {
        throw new Error(`Projects API request timed out after ${timeoutMs} ms (${url.toString()})`);
      }
      throw error;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  };

  const totalsResponse = await executeRequest('total', {});
  const totalProjects = Number(totalsResponse?.meta?.total ?? 0);

  const riskResponse = await executeRequest('risk', { health: 'red' });
  const riskProjects = Number(riskResponse?.meta?.total ?? 0);

  const warningResponse = await executeRequest('warning', { health: 'yellow' });
  const warningProjects = Number(warningResponse?.meta?.total ?? 0);

  const metrics = {
    fetchedAt: new Date().toISOString(),
    apiBaseUrl: apiBase.origin,
    totalProjects: Number.isFinite(totalProjects) ? totalProjects : null,
    riskProjects: Number.isFinite(riskProjects) ? riskProjects : null,
    warningProjects: Number.isFinite(warningProjects) ? warningProjects : null,
    forwardedFilters: forwardKeys.reduce((accumulator, key) => {
      const values = parsedUrl.searchParams.getAll(key);
      if (values.length === 0) {
        return accumulator;
      }
      accumulator[key] = values.length === 1 ? values[0] : values;
      return accumulator;
    }, {}),
    requests: requestLog,
  };

  return metrics;
}

async function postWithRetry(
  url,
  text,
  ensureOkResponse,
  retries,
  initialDelayMs,
  backoff,
  maxDelayMs,
  jitterMs,
  events,
  respectRetryAfter,
) {

  const maxDelayBound = maxDelayMs > 0 ? maxDelayMs : Number.MAX_SAFE_INTEGER;
  let attempt = 0;
  let currentDelay = initialDelayMs;

  while (true) {
    const attemptStartedAt = Date.now();
    try {
      const result = await postToWebhook(url, text, ensureOkResponse);
      events?.push({
        timestamp: new Date().toISOString(),
        webhook: url,
        attempt,
        success: true,
        statusCode: result.statusCode,
        responseBody: result.responseBody,
        elapsedMs: Date.now() - attemptStartedAt,
        retryAfterMs: result.retryAfterMs ?? null,
      });
      return;
    } catch (error) {
      const retryAfterMs =
        typeof error?.retryAfterMs === 'number' && Number.isFinite(error.retryAfterMs) && error.retryAfterMs >= 0
          ? Math.floor(error.retryAfterMs)
          : null;
      const boundedDelay = Math.max(0, Math.min(maxDelayBound, currentDelay));
      const jitter = jitterMs > 0 ? Math.floor(Math.random() * (jitterMs + 1)) : 0;
      let waitMs = attempt >= retries ? 0 : Math.max(0, boundedDelay + jitter);
      if (respectRetryAfter && attempt < retries && retryAfterMs !== null) {
        waitMs = Math.max(waitMs, retryAfterMs);
      }
      events?.push({
        timestamp: new Date().toISOString(),
        webhook: url,
        attempt,
        success: false,
        statusCode: error?.statusCode ?? null,
        responseBody: error?.responseBody,
        error: error instanceof Error ? error.message : String(error),
        elapsedMs: Date.now() - attemptStartedAt,
        nextDelayMs: waitMs > 0 ? waitMs : null,
        retryAfterMs,
      });
      if (attempt >= retries) {
        throw error;
      }
      if (waitMs > 0) {
        await sleep(waitMs);
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
  let metricsPayload = null;
  if (options['fetch-metrics']) {
    try {
      metricsPayload = await fetchShareMetrics({
        baseUrl: options['projects-api-base'],
        token: options['projects-api-token'],
        tenant: options['projects-api-tenant'],
        timeoutMs: projectsApiTimeoutMs,
      });
    } catch (error) {
      console.error(`Failed to fetch metrics: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  }

  let shareTemplate;
  try {
    shareTemplate = buildShareTemplate({
      title: options.title,
      url: parsedUrl.toString(),
      notes: trimmedNotes,
      filters: shareFilters,
      generatedAt,
      timezone: 'Asia/Tokyo',
      metrics: metricsPayload ?? undefined,
    });
  } catch (error) {
    console.error(`Failed to build share template: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  const allowedFormats = new Set(['text', 'markdown', 'json']);
  if (!allowedFormats.has(format)) {
    console.error(`Unknown format: ${format}. Use text | markdown | json.`);
    process.exit(1);
  }

  let renderedOutput = '';
  if (format === 'markdown') {
    renderedOutput = shareTemplate.markdown;
  } else if (format === 'json') {
    renderedOutput = shareTemplate.json;
  } else {
    renderedOutput = shareTemplate.text;
  }

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
    await postWithRetry(
      target,
      shareTemplate.payload.message,
      ensureOk,
      retryCount,
      retryDelayMs,
      retryBackoff,
      retryMaxDelayMs,
      retryJitterMs,
      auditEvents,
      options['respect-retry-after'],
    );
    console.error(`Posted share message to webhook: ${target}`);
  }

  if (auditLogPath) {
    try {
      const auditPayload = {
        generatedAt: new Date().toISOString(),
        title: shareTemplate.payload.title,
        url: shareTemplate.payload.url,
        attempts: auditEvents,
      };
      if (metricsPayload) {
        auditPayload.metrics = metricsPayload;
      }
      const directory = path.dirname(auditLogPath);
      if (directory && directory !== '.') {
        fs.mkdirSync(directory, { recursive: true });
      }
      fs.writeFileSync(auditLogPath, `${JSON.stringify(auditPayload, null, 2)}\n`, 'utf-8');
    } catch (error) {
      console.error(`Failed to write audit log: ${error instanceof Error ? error.message : error}`);
    }
  }
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
