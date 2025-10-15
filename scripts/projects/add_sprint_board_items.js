#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');

const ITEMS = [
  {
    sprint: 'Sprint5',
    name: 'CRM Sales CI パイプライン導入',
    url: 'https://github.com/itdojp/ITDO_ERP3/pull/310',
  },
  {
    sprint: 'Sprint5',
    name: 'CRM/販売 E2E テスト拡充',
    url: 'https://github.com/itdojp/ITDO_ERP3/issues/303',
  },
  {
    sprint: 'Sprint6',
    name: 'HR リマインド API デプロイ',
    url: 'https://github.com/itdojp/ITDO_ERP3/pull/311',
  },
  {
    sprint: 'Sprint6',
    name: 'HR Module CI テスト強化',
    url: 'https://github.com/itdojp/ITDO_ERP3/issues/304',
  },
  {
    sprint: 'Sprint8',
    name: 'AI Ops 品質ゲート運用',
    url: 'https://github.com/itdojp/ITDO_ERP3/pull/312',
  },
  {
    sprint: 'Sprint8',
    name: 'AI Ops 自動化ワークフロー仕上げ',
    url: 'https://github.com/itdojp/ITDO_ERP3/issues/305',
  },
  {
    sprint: 'Sprint7',
    name: 'Analytics Observability Terraform',
    url: 'https://github.com/itdojp/ITDO_ERP3/pull/311',
  },
  {
    sprint: 'Sprint5',
    name: 'Sprint5-8 ボードテンプレート共有',
    url: 'https://github.com/itdojp/ITDO_ERP3/pull/313',
  },
];

const args = process.argv.slice(2);
let projectId = null;
let dryRun = true;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--project' || arg === '-p') {
    projectId = args[index + 1] ?? null;
    index += 1;
  } else if (arg === '--execute') {
    dryRun = false;
  } else if (arg === '--help' || arg === '-h') {
    showHelp();
    process.exit(0);
  }
}

if (!projectId) {
  showHelp('プロジェクト番号を指定してください。');
  process.exit(1);
}

console.log(`# Sprint5-8 ボードへの追加コマンド (${dryRun ? 'dry-run' : 'execute'})`);

ITEMS.forEach((item) => {
  const ghArgs = [
    'project',
    'item-add',
    projectId,
    '--owner',
    'itdojp',
    '--url',
    item.url,
    '--format',
    'json',
  ];

  if (dryRun) {
    console.log(`gh ${ghArgs.join(' ')}  # ${item.sprint} / ${item.name}`);
    return;
  }

  const result = spawnSync('gh', ghArgs, { encoding: 'utf8' });
  if (result.error) {
    console.error(`✖ ${item.name}: ${result.error.message}`);
    return;
  }

  if (result.status !== 0) {
    console.error(`✖ ${item.name}: ${result.stderr.trim()}`);
    return;
  }

  try {
    const parsed = JSON.parse(result.stdout);
    const itemId = parsed?.id ?? 'unknown';
    console.log(`✓ ${item.sprint} / ${item.name} (item id: ${itemId})`);
    console.log(`  → iteration を設定: gh project item-edit ${itemId} --field "Iteration=${item.sprint}"`);
  } catch (error) {
    console.log(`✓ ${item.sprint} / ${item.name}`);
    console.log('  (item id を取得できませんでした。Iteration は手動で設定してください)');
  }
});

function showHelp(message) {
  if (message) {
    console.error(message);
  }
  console.log(`Usage: node scripts/projects/add_sprint_board_items.js --project <project-number> [--execute]

Options:
  --project, -p   GitHub Projects の番号
  --execute       実際に gh project item-add を実行（省略時はコマンドのみ出力）
  --help, -h      このヘルプを表示
`);
  console.log('例: node scripts/projects/add_sprint_board_items.js --project 5');
}
