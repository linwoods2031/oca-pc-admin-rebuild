import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.ts', '.vue', '.yaml', '.yml']);
const DEFAULT_ENTRIES = ['README.md', 'docs', 'src', 'scripts', 'tests', 'fixtures', '.github/workflows'];
const DOC_LIKE_ENTRIES = ['README.md', 'docs', 'tests/fixtures', 'fixtures'];

function joinLiteral(parts) {
  return parts.join('');
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

function normalizeRelative(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function collectFiles(entry, files = []) {
  if (!fs.existsSync(entry)) return files;
  const stat = fs.statSync(entry);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(entry)) collectFiles(path.join(entry, child), files);
    return files;
  }
  if (TEXT_EXTENSIONS.has(path.extname(entry))) files.push(entry);
  return files;
}

function packageScriptIssues(root) {
  const packageFile = path.join(root, 'package.json');
  if (!fs.existsSync(packageFile)) return [];
  const content = fs.readFileSync(packageFile, 'utf8');
  const parsed = JSON.parse(content);
  const scripts = JSON.stringify(parsed.scripts || {}, null, 2);
  return scanContent({
    root,
    file: packageFile,
    content: scripts,
    docLike: false,
    lineOffset: content.slice(0, content.indexOf('"scripts"')).split('\n').length - 1,
  });
}

function createRules({ docLike = false } = {}) {
  const authWord = joinLiteral(['Author', 'ization']);
  const bearerWord = joinLiteral(['Bear', 'er']);
  const tokenWord = joinLiteral(['to', 'ken']);
  const passwordWord = joinLiteral(['pass', 'word']);
  const usernameWord = joinLiteral(['user', 'name']);
  const numericIdValue = String.raw`['"]?[0-9][0-9,]*['"]?`;
  const envPrefix = joinLiteral(['VITE_WRITE_ALLOW_', '(?:PATIENT|OUTPATIENT|REPORT)', '_IDS']);

  const rules = [
    {
      name: 'literal-test-account',
      pattern: new RegExp(joinLiteral(['Oca', 'Test']), 'g'),
      suggestion: 'Use <username> or a mock username instead of a real or legacy test account.',
    },
    {
      name: 'legacy-account-password-shorthand',
      pattern: /\bry\s*\//gi,
      suggestion: 'Replace account/password shorthand with <username> / <password> placeholders.',
    },
    {
      name: 'composite-print-real-id',
      pattern: /composite\/print\/\d+/gi,
      suggestion: 'Use composite/print/<outpatient-id> instead of a real PDF or outpatient id.',
    },
    {
      name: 'phone-number',
      pattern: /(?<![\d<])1[3-9]\d{9}(?![\d>])/g,
      suggestion: 'Replace real phone numbers with <phone> or mock non-numeric values.',
    },
    {
      name: 'id-card-number',
      pattern: /\b\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g,
      suggestion: 'Replace real identity numbers with <id-number> or mock non-numeric values.',
    },
    {
      name: 'real-allow-list-id',
      pattern: new RegExp(`${envPrefix}\\s*(?:=|:)\\s*(?!['"]?<[^>]+>['"]?)${numericIdValue}`, 'g'),
      suggestion: 'Do not commit real allow-list ids; use <patient-id>, <outpatient-id>, or <report-id>.',
    },
    {
      name: 'token-query-value',
      pattern: new RegExp(String.raw`(?:^|[?&\s])${tokenWord}=(?!<${tokenWord}>|<[^>]+>)[^\s&'"` + '`' + String.raw`]+`, 'gi'),
      suggestion: 'Replace token query values with <token> placeholders.',
    },
    {
      name: 'authorization-bearer-secret',
      pattern: new RegExp(String.raw`\b${authWord}\s*:?\s*${bearerWord}\s+(?!<${tokenWord}>|\$\{)[A-Za-z0-9._~+/=-]{10,}`, 'gi'),
      suggestion: 'Do not commit bearer credentials; use Authorization: Bearer <token> only in docs.',
    },
    {
      name: 'password-value',
      pattern: new RegExp(String.raw`(?:^|[?&\s])${passwordWord}=(?!<${passwordWord}>|<[^>]+>|placeholder|changeme|example)[^\s&'"` + '`' + String.raw`]+`, 'gi'),
      suggestion: 'Replace real password values with <password>.',
    },
    {
      name: 'username-value',
      pattern: new RegExp(String.raw`(?:^|[?&\s])${usernameWord}=(?!<${usernameWord}>|<[^>]+>|placeholder|example)[^\s&'"` + '`' + String.raw`]+`, 'gi'),
      suggestion: 'Replace real username values with <username>.',
    },
  ];

  if (docLike) {
    for (const key of ['patientId', 'outpatientId', 'reportId']) {
      rules.push({
        name: `${key}-real-number`,
        pattern: new RegExp(String.raw`\b${key}\s*[:=]\s*["']?\d+["']?`, 'g'),
        suggestion: `Use <${key.replace('Id', '-id')}> or mock string ids such as patient-allow-1 in docs and fixtures.`,
      });
    }
  }

  return rules;
}

function scanContent({ root, file, content, docLike, lineOffset = 0 }) {
  const issues = [];
  for (const rule of createRules({ docLike })) {
    for (const match of content.matchAll(rule.pattern)) {
      issues.push({
        file: normalizeRelative(root, file),
        line: lineNumberAt(content, match.index || 0) + lineOffset,
        rule: rule.name,
        message: rule.suggestion,
      });
    }
  }
  return issues;
}

function docLikeFileSet(root) {
  return new Set(
    DOC_LIKE_ENTRIES.flatMap((entry) => collectFiles(path.join(root, entry))).map((file) => normalizeRelative(root, file)),
  );
}

export function checkSensitive({ root = process.cwd(), entries = DEFAULT_ENTRIES } = {}) {
  const docFiles = docLikeFileSet(root);
  const files = entries.flatMap((entry) => collectFiles(path.join(root, entry)));
  const uniqueFiles = [...new Set(files.map((file) => path.resolve(file)))];
  const issues = [];

  for (const file of uniqueFiles) {
    const content = fs.readFileSync(file, 'utf8');
    issues.push(
      ...scanContent({
        root,
        file,
        content,
        docLike: docFiles.has(normalizeRelative(root, file)),
      }),
    );
  }

  issues.push(...packageScriptIssues(root));
  return issues;
}

function printIssues(issues) {
  for (const issue of issues) {
    console.error(`${issue.file}:${issue.line} sensitive scan failed (${issue.rule})`);
    console.error(`  fix: ${issue.message}`);
  }
}

const isMain = import.meta.url === pathToFileURL(fileURLToPath(import.meta.url)).href
  && process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const issues = checkSensitive();
  if (issues.length) {
    printIssues(issues);
    process.exit(1);
  }
  console.log('Sensitive information check passed.');
}
