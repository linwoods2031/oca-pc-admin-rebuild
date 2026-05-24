import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.map', '.svg', '.txt']);
const WRITE_BANNER = '当前允许写入生产 API';

function joinLiteral(parts) {
  return parts.join('');
}

function normalizeAssetPrefix(base) {
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return `${normalized}assets/`;
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split('\n').length;
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

function refsFromIndex(indexHtml) {
  const refs = [];
  const pattern = /\b(?:src|href)=["']([^"']+)["']/g;
  for (const match of indexHtml.matchAll(pattern)) {
    const ref = match[1];
    if (/\.(?:js|css)(?:\?|$)/.test(ref)) refs.push(ref);
  }
  return refs;
}

function createSensitiveRules() {
  const tokenWord = joinLiteral(['to', 'ken']);
  return [
    {
      name: 'literal-test-account',
      pattern: new RegExp(joinLiteral(['Oca', 'Test']), 'g'),
      message: 'dist must not include legacy account names.',
    },
    {
      name: 'authorization-bearer-secret',
      pattern: new RegExp(String.raw`\b${joinLiteral(['Author', 'ization'])}\s*:?\s*${joinLiteral(['Bear', 'er'])}\s+(?!<${tokenWord}>|\$\{)[A-Za-z0-9._~+/=-]{10,}`, 'gi'),
      message: 'dist must not include bearer credentials.',
    },
    {
      name: 'token-query-value',
      pattern: new RegExp(String.raw`(?:^|[?&\s])${tokenWord}=(?!<${tokenWord}>|<[^>]+>)[^\s&'"` + '`' + String.raw`]+`, 'gi'),
      message: 'dist must not include token query values.',
    },
    {
      name: 'real-allow-list-id',
      pattern: /VITE_WRITE_ALLOW_(?:PATIENT|OUTPATIENT|REPORT)_IDS\s*=\s*(?!<)[0-9]/g,
      message: 'dist must not include committed numeric allow-list ids.',
    },
    {
      name: 'prod-writes-env-enabled',
      pattern: /VITE_ENABLE_PROD_WRITES=true/g,
      message: 'default build must not embed a production-write env toggle.',
    },
  ];
}

function scanDistText({ root, distDir, allowWriteBanner }) {
  const issues = [];
  for (const file of collectFiles(distDir)) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    const content = fs.readFileSync(file, 'utf8');
    for (const rule of createSensitiveRules()) {
      for (const match of content.matchAll(rule.pattern)) {
        issues.push({
          file: relative,
          line: lineNumberAt(content, match.index || 0),
          rule: rule.name,
          message: rule.message,
        });
      }
    }
    if (!allowWriteBanner) {
      const index = content.indexOf(WRITE_BANNER);
      if (index >= 0) {
        issues.push({
          file: relative,
          line: lineNumberAt(content, index),
          rule: 'write-banner-in-readonly-build',
          message: 'default npm run build must remain read-only and must not include the write-enabled banner text.',
        });
      }
    }
  }
  return issues;
}

export function checkBuildOutput({ root = process.cwd(), dist = 'dist', env = process.env } = {}) {
  const distDir = path.join(root, dist);
  const indexFile = path.join(distDir, 'index.html');
  const issues = [];
  const refs = [];
  const appBase = env.VITE_APP_BASE || '/pc-rebuild/';
  const expectedAssetPrefix = env.VITE_APP_BASE === '/' ? '/assets/' : normalizeAssetPrefix(appBase);
  const allowWriteBanner = env.VITE_ENABLE_PROD_WRITES === 'true';

  if (!fs.existsSync(indexFile)) {
    issues.push({
      file: `${dist}/index.html`,
      line: 1,
      rule: 'missing-index',
      message: 'Run npm run build and ensure dist/index.html exists.',
    });
    return { issues, refs, expectedAssetPrefix };
  }

  const indexHtml = fs.readFileSync(indexFile, 'utf8');
  refs.push(...refsFromIndex(indexHtml));
  for (const ref of refs) {
    if (!ref.startsWith(expectedAssetPrefix)) {
      issues.push({
        file: `${dist}/index.html`,
        line: 1,
        rule: 'asset-base',
        message: `JS/CSS asset "${ref}" must start with "${expectedAssetPrefix}". Use VITE_APP_BASE=/ only for an explicit root build.`,
      });
    }
  }

  issues.push(...scanDistText({ root, distDir, allowWriteBanner }));
  return { issues, refs, expectedAssetPrefix };
}

function printIssues(issues) {
  for (const issue of issues) {
    console.error(`${issue.file}:${issue.line} build output check failed (${issue.rule})`);
    console.error(`  fix: ${issue.message}`);
  }
}

const isMain = import.meta.url === pathToFileURL(fileURLToPath(import.meta.url)).href
  && process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const result = checkBuildOutput();
  if (result.issues.length) {
    printIssues(result.issues);
    process.exit(1);
  }
  console.log(`Build output check passed. assetPrefix=${result.expectedAssetPrefix} jsCssRefs=${result.refs.length}`);
  for (const ref of result.refs) console.log(`- ${ref}`);
}
