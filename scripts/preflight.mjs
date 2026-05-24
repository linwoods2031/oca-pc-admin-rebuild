import fs from 'node:fs';
import path from 'node:path';
import { checkApiBoundary } from './check-api-boundary.mjs';
import { checkSensitive } from './check-sensitive.mjs';

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
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

function checkBoundary() {
  const issues = checkApiBoundary({ root });
  for (const issue of issues) {
    fail(`${issue.file}:${issue.line} API 边界检查失败：${issue.message}`);
  }
}

function checkSensitiveGate() {
  const issues = checkSensitive({ root });
  for (const issue of issues) {
    fail(`${issue.file}:${issue.line} 敏感信息检查失败：${issue.rule}；${issue.message}`);
  }
}

function combinedVerifyScript(packageJson) {
  const scripts = packageJson.scripts || {};
  const verify = scripts.verify || '';
  const verifyCi = scripts['verify:ci'] || '';
  return `${verify}\n${verify.includes('verify:ci') ? verifyCi : ''}`;
}

function checkVerifyScript() {
  const packageJson = JSON.parse(readText('package.json'));
  const script = combinedVerifyScript(packageJson);
  const required = ['test', 'build', 'preflight', 'check:api-boundary', 'check:sensitive', 'check:build-output'];
  for (const item of required) {
    if (!script.includes(item)) {
      fail(`package.json verify/verify:ci 必须包含 ${item}。`);
    }
  }
}

function checkRequiredText(file, phrases) {
  const content = readText(file);
  for (const phrase of phrases) {
    if (!content.includes(phrase)) fail(`${file} 必须包含 “${phrase}”。`);
  }
}

function checkDocs() {
  checkRequiredText('docs/deploy-plan.md', [
    '正式上线评审候选',
    'Codex 不得执行生产部署',
    '不得调用真实生产写接口',
    'release/current',
    '回滚',
    'allow-list',
  ]);
  checkRequiredText('README.md', [
    'npm run verify',
    '默认只读',
    '受限写入灰度',
    '正式上线评审候选',
    '直接正式上线仍需人工批准',
  ]);
}

checkBuildBase();
checkSensitiveGate();
checkBoundary();
checkVerifyScript();
checkDocs();

if (failures.length) {
  console.error('Preflight failed:');
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log('Preflight checks passed.');
