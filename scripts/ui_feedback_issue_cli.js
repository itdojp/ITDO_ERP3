#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backlogPath = resolve(__dirname, '..', 'docs', 'ui-poc-feedback-backlog.md');

let fileContent;
try {
  fileContent = readFileSync(backlogPath, 'utf-8');
} catch (error) {
  console.error(`[ui-feedback-cli] failed to read ${backlogPath}: ${error.message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const readOption = (flag) => {
  const index = args.indexOf(flag);
  if (index >= 0 && index + 1 < args.length) {
    return args[index + 1];
  }
  return '';
};

const createMode = hasFlag('--create');
const labelValue = readOption('--label');
const assigneeValue = readOption('--assignee');

const tasks = [];
let currentSection = 'General';
for (const line of fileContent.split(/\r?\n/)) {
  if (line.startsWith('## ')) {
    currentSection = line.replace(/^##\s+/, '').trim();
    continue;
  }
  const match = line.match(/^- \[( |x)\]\s+(.+)$/);
  if (!match) continue;
  if (match[1].toLowerCase() === 'x') continue;
  const rawText = match[2].trim();
  let title = rawText;
  let body = '';
  const colonIndex = rawText.indexOf(':');
  if (colonIndex > 0) {
    title = rawText.slice(0, colonIndex).trim();
    body = rawText.slice(colonIndex + 1).trim();
  }
  tasks.push({ section: currentSection, title, body, raw: rawText });
}

if (tasks.length === 0) {
  console.log('[ui-feedback-cli] no unchecked items found.');
  process.exit(0);
}

const cleanMarkup = (value) => value.replace(/\*\*/g, '').replace(/`/g, '').trim();

const formatIssue = (task) => {
  const titlePrefix = `[UI] ${cleanMarkup(task.section)}`;
  const issueTitle = `${titlePrefix} - ${cleanMarkup(task.title)}`;
  const lines = [
    '## Context',
    `- Section: ${cleanMarkup(task.section)}`,
    `- Raw: ${task.raw}`,
  ];
  if (task.body) {
    lines.push('', task.body);
  }
  return { issueTitle, body: lines.join('\n') };
};

const runGhIssueCreate = (issueTitle, body) => {
  const commandArgs = ['issue', 'create', '--title', issueTitle, '--body', body];
  if (labelValue) {
    commandArgs.push('--label', labelValue);
  }
  if (assigneeValue) {
    commandArgs.push('--assignee', assigneeValue);
  }
  const result = spawnSync('gh', commandArgs, { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`[ui-feedback-cli] gh issue create failed for ${issueTitle}`);
  }
};

for (const task of tasks) {
  const { issueTitle, body } = formatIssue(task);
  if (!createMode) {
    console.log('---');
    console.log(issueTitle);
    console.log(body);
  } else {
    runGhIssueCreate(issueTitle, body);
  }
}

if (!createMode) {
  console.log(`---\n[ui-feedback-cli] ${tasks.length} tasks listed. Use --create to open issues.`);
}
