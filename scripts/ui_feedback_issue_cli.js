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
let createMode = false;
let labelValue = '';
let assigneeValue = '';
const sectionFilters = [];
let containsFilter = '';

for (let index = 0; index < args.length; index += 1) {
  const flag = args[index];
  switch (flag) {
    case '--create':
      createMode = true;
      break;
    case '--label':
      labelValue = args[index + 1] || '';
      index += 1;
      break;
    case '--assignee':
      assigneeValue = args[index + 1] || '';
      index += 1;
      break;
    case '--section':
      if (args[index + 1]) {
        sectionFilters.push(args[index + 1].toLowerCase());
        index += 1;
      }
      break;
    case '--contains':
      containsFilter = (args[index + 1] || '').toLowerCase();
      index += 1;
      break;
    case '--help':
    case '-h':
      console.log('Usage: ui_feedback_issue_cli.js [--create] [--label LABEL] [--assignee USER] [--section NAME] [--contains TEXT]');
      process.exit(0);
    default:
      break;
  }
}

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
  const sectionMatch = sectionFilters.length === 0 || sectionFilters.includes(currentSection.toLowerCase());
  const containsMatch = !containsFilter || rawText.toLowerCase().includes(containsFilter);
  if (!sectionMatch || !containsMatch) {
    continue;
  }
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
