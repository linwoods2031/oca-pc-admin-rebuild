import fs from 'node:fs';
import path from 'node:path';
import { checkApiBoundary } from './check-api-boundary.mjs';

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function collectFiles(entry, files = []) {
  if (!fs.existsSync(entry)) return files;
  const stat = fs.statSync(entry);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(entry)) collectFiles(path.join(entry, child), files);
    return files;
  }
  if (/\.(md|js|vue|ts|mjs|css|html)$/i.test(entry)) files.push(entry);
  return files;
}

function checkBuildBase() {
  const viteConfig = readText('vite.config.js');
  const hasProductionBaseDefault =
    viteConfig.includes("process.env.NODE_ENV === 'production' ? '/pc-rebuild/' : '/'") ||
    viteConfig.includes('process.env.NODE_ENV === "production" ? "/pc-rebuild/" : "/"');

  if (!process.env.VITE_APP_BASE && !hasProductionBaseDefault) {
    fail('vite.config.js 未保留 production 默认 /pc-rebuild/ base。');
  }
  if (process.env.NODE_ENV === 'production' && !process.env.VITE_APP_BASE && !hasProductionBaseDefault) {
    fail('NODE_ENV=production 且未设置 VITE_APP_BASE 时，默认 base 必须为 /pc-rebuild/。');
  }
}

function checkSensitiveText() {
  const files = [
    path.join(root, 'README.md'),
    ...collectFiles(path.join(root, 'docs')),
    ...collectFiles(path.join(root, 'src')),
  ].filter((file) => fs.existsSync(file));

  const patterns = [
    { name: 'OcaTest', pattern: /OcaTest/ },
    { name: 'ry-password-pattern', pattern: /\bry\s*\//i },
    { name: 'token-query', pattern: /\btoken=/i },
    { name: 'authorization-bearer-literal', pattern: /Authorization:\s*Bearer/i },
    { name: 'real-composite-print-id', pattern: /composite\/print\/\d+/i },
    { name: 'possible-phone-number', pattern: /(?<![\d<])1[3-9]\d{9}(?![\d>])/ },
    {
      name: 'real-allow-list-id',
      pattern: /VITE_WRITE_ALLOW_(?:PATIENT|OUTPATIENT|REPORT)_IDS\s*=\s*(?!<)[0-9]/,
    },
  ];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const { name, pattern } of patterns) {
      const match = pattern.exec(content);
      if (match) {
        const line = content.slice(0, match.index).split('\n').length;
        fail(`${path.relative(root, file)}:${line} 命中敏感信息规则 ${name}`);
      }
    }
  }
}

function checkBoundary() {
  const issues = checkApiBoundary({ root });
  for (const issue of issues) {
    fail(`${issue.file}:${issue.line} API 边界检查失败：${issue.message}`);
  }
}

checkBuildBase();
checkSensitiveText();
checkBoundary();

if (failures.length) {
  console.error('Preflight failed:');
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log('Preflight checks passed.');
