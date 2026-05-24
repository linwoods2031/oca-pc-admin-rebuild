import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_TARGETS = [
  'src/views',
  'src/components',
  'src/router.js',
  'src/main.js',
  'src/App.vue',
];

const FILE_EXTENSIONS = new Set(['.js', '.vue', '.ts', '.mjs']);

const RULES = [
  {
    name: 'import-api-client',
    pattern: /\bimport\b[\s\S]*?\bfrom\s*['"][^'"]*\/?api\/client(?:\.js)?['"]/g,
    message: '业务代码不得直接 import src/api/client.js',
  },
  {
    name: 'api-direct-write',
    pattern: /\bapi\s*\.\s*(post|put|patch|delete)\s*\(/g,
    message: '业务写接口必须通过 src/api/oca.js wrapper',
  },
  {
    name: 'axios-direct-write',
    pattern: /\baxios\s*\.\s*(post|put|patch|delete)\s*\(/g,
    message: '业务代码不得直接调用 axios 写接口',
  },
];

function collectFiles(entry, files = []) {
  if (!fs.existsSync(entry)) return files;
  const stat = fs.statSync(entry);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(entry)) {
      collectFiles(path.join(entry, child), files);
    }
    return files;
  }
  if (FILE_EXTENSIONS.has(path.extname(entry))) files.push(entry);
  return files;
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

export function checkApiBoundary({ root = process.cwd(), targets = DEFAULT_TARGETS } = {}) {
  const files = targets.flatMap((target) => collectFiles(path.join(root, target)));
  const issues = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const rule of RULES) {
      for (const match of content.matchAll(rule.pattern)) {
        issues.push({
          file: path.relative(root, file),
          line: lineNumberAt(content, match.index || 0),
          rule: rule.name,
          message: rule.message,
          match: match[0],
        });
      }
    }
  }

  return issues;
}

function printIssues(issues) {
  for (const issue of issues) {
    console.error(`${issue.file}:${issue.line} ${issue.message} (${issue.rule})`);
  }
}

const isMain = import.meta.url === pathToFileURL(fileURLToPath(import.meta.url)).href
  && process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const issues = checkApiBoundary();
  if (issues.length) {
    printIssues(issues);
    process.exit(1);
  }
  console.log('API boundary check passed.');
}
