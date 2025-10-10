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
 *   --help            このヘルプを表示します。
 */

const args = process.argv.slice(2);

const optionAliases = new Map([
  ['-u', 'url'],
  ['-t', 'title'],
  ['-n', 'notes'],
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
    options[alias] = next;
    index += 1;
  } else if (!options.url) {
    options.url = token;
  } else {
    console.warn(`Ignoring unexpected argument: ${token}`);
  }
}

if (options.help || !options.url) {
  console.log(`Usage:
  node scripts/project-share-slack.js --url <projects-share-url> [--title <title>] [--notes <notes>]

Options:
  --url <value>     Required. Projects の共有リンク (絶対 URL)。
  --title <value>   Optional. Slack メッセージのタイトル。デフォルト "Projects 共有リンク"。
  --notes <value>   Optional. 箇条書きに追加するメモ。
  --help            このヘルプを表示します。
`);
  process.exit(options.help ? 0 : 1);
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

const tagList = [
  tag?.trim(),
  ...(tags ? tags.split(',').map((value) => value.trim()) : []),
].filter(Boolean);

const bulletLines = [];

if (params.has('status') && status !== 'all') {
  const label = statusLabels.get(status) ?? status;
  bulletLines.push(`• ステータス: *${label}*`);
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
if (options.notes) {
  bulletLines.push(`• メモ: ${options.notes}`);
}
if (bulletLines.length === 0) {
  bulletLines.push('• フィルタ: 指定なし');
}

const title = options.title ?? 'Projects 共有リンク';
const timestamp = new Date().toLocaleString('ja-JP', { hour12: false, timeZone: 'Asia/Tokyo' });

const message = [
  `:clipboard: *${title}* _(${timestamp})_`,
  parsedUrl.toString(),
  '',
  ...bulletLines,
].join('\n');

console.log(message);
