import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_TARGETS = ['src'];
const EXCLUDED_RELATIVE_FILES = new Set(['src/api/oca.js', 'src/api/client.js']);

const FILE_EXTENSIONS = new Set(['.js', '.vue', '.ts', '.mjs']);

const RULES = [
  {
    name: 'api-direct-write',
    pattern: /\bapi\s*\.\s*(post|put|patch|delete)\s*\(/g,
    message: '业务写接口必须通过 src/api/oca.js wrapper',
  },
  {
    name: 'internal-api-direct-write',
    pattern: /\binternalApi\s*\.\s*(post|put|patch|delete)\s*\(/g,
    message: 'internalApi 写接口只能出现在 src/api/oca.js',
  },
  {
    name: 'axios-direct-write',
    pattern: /\baxios\s*\.\s*(post|put|patch|delete)\s*\(/g,
    message: '业务代码不得直接调用 axios 写接口',
  },
  {
    name: 'fetch-prod-api-write',
    pattern: /\bfetch\s*\(\s*['"`]\/prod-api[^'"`]*['"`]\s*,\s*\{[\s\S]{0,600}?\bmethod\s*:\s*['"`](?:POST|PUT|PATCH|DELETE)['"`]/gi,
    message: '业务代码不得直接通过 fetch 调用 /prod-api 写接口',
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

function normalizeRelative(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function withJsExtension(file) {
  return path.extname(file) ? file : `${file}.js`;
}

function resolveImportTarget({ root, file, specifier }) {
  if (!specifier.startsWith('.')) return null;
  const resolved = withJsExtension(path.resolve(path.dirname(file), specifier));
  return normalizeRelative(root, resolved);
}

function collectApiClientImports({ root, file, content }) {
  const issues = [];
  const importPatterns = [
    /\bimport\b[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of importPatterns) {
    for (const match of content.matchAll(pattern)) {
      const specifier = match[1];
      const resolved = resolveImportTarget({ root, file, specifier });
      const importsClient =
        resolved === 'src/api/client.js' ||
        /(?:^|\/)api\/client(?:\.js)?$/.test(specifier) ||
        (normalizeRelative(root, file).startsWith('src/api/') && specifier === './client.js');
      if (importsClient) {
        issues.push({
          file: normalizeRelative(root, file),
          line: lineNumberAt(content, match.index || 0),
          rule: 'import-api-client',
          message: '业务代码不得直接 import src/api/client.js',
          match: match[0],
        });
      }
    }
  }

  return issues;
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

export function checkApiBoundary({ root = process.cwd(), targets = DEFAULT_TARGETS } = {}) {
  const files = targets
    .flatMap((target) => collectFiles(path.join(root, target)))
    .filter((file) => !EXCLUDED_RELATIVE_FILES.has(normalizeRelative(root, file)));
  const issues = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    issues.push(...collectApiClientImports({ root, file, content }));
    for (const rule of RULES) {
      for (const match of content.matchAll(rule.pattern)) {
        issues.push({
          file: normalizeRelative(root, file),
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
