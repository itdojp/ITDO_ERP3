#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const options = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    switch (key) {
      case '--type':
        options.type = value;
        i += 1;
        break;
      case '--name':
        options.name = value;
        i += 1;
        break;
      case '--target':
        options.target = value;
        i += 1;
        break;
      case '--help':
        options.help = true;
        break;
      default:
        break;
    }
  }
  return options;
}

function usage() {
  console.log(`Usage: create-module --type <nest-module|terraform-stack|runbook> --name <identifier> --target <path>`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function toPascal(str) {
  return str
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

function applyTemplate(templatePath, targetPath, context) {
  const content = fs.readFileSync(templatePath, 'utf8');
  const replaced = content
    .replace(/{{name}}/g, context.name)
    .replace(/{{fileName}}/g, context.fileName)
    .replace(/{{pascalName}}/g, context.pascalName)
    .replace(/{{date}}/g, context.date);
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, replaced, 'utf8');
}

function main() {
  const options = parseArgs(process.argv);
  if (options.help || !options.type || !options.name || !options.target) {
    usage();
    if (options.help) process.exit(0);
    process.exit(1);
  }

  const root = path.resolve(__dirname, '..', '..');
  const templateDir = path.join(root, 'templates', options.type);
  if (!fs.existsSync(templateDir)) {
    console.error(`[error] unknown template type: ${options.type}`);
    process.exit(1);
  }

  const name = options.name;
  const context = {
    name,
    pascalName: toPascal(name),
    fileName: name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
    date: new Date().toISOString().slice(0, 10),
  };

  const files = fs.readdirSync(templateDir);
  files.forEach((file) => {
    const templatePath = path.join(templateDir, file);
    const targetFileName = file.replace('.hbs', '').replace('{{fileName}}', context.fileName);
    const targetPath = path.join(path.resolve(options.target), targetFileName);
    applyTemplate(templatePath, targetPath, context);
  });

  console.log(`[ok] generated ${files.length} file(s) for ${options.type}`);
}

main();
