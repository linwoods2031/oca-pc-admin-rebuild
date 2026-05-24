import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.map', '.svg', '.txt']);
const WRITE_BANNER = '当前允许写入生产 API';
const RELEASE_PROFILES = new Set(['formal-candidate', 'readonly-gray', 'restricted-write-gray']);

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

export function checkReleaseProfile(env = process.env) {
  const releaseProfile = env.VITE_RELEASE_PROFILE || 'formal-candidate';
  const writesRequested = env.VITE_ENABLE_PROD_WRITES === 'true';
  const readonlyOverride = env.VITE_READONLY === 'true';
  const issues = [];

  if (!RELEASE_PROFILES.has(releaseProfile)) {
    issues.push({
      file: 'environment',
      line: 1,
      rule: 'release-profile-unknown',
      message: `VITE_RELEASE_PROFILE must be one of ${Array.from(RELEASE_PROFILES).join(', ')}.`,
    });
  }

  if (writesRequested && releaseProfile !== 'restricted-write-gray') {
    issues.push({
      file: 'environment',
      line: 1,
      rule: 'writes-enabled-outside-restricted-write-gray',
      message: 'Formal review and readonly gray builds must not set VITE_ENABLE_PROD_WRITES=true. Use VITE_RELEASE_PROFILE=restricted-write-gray only for a separately approved allow-list write gray package.',
    });
  }

  if (releaseProfile === 'restricted-write-gray' && !writesRequested) {
    issues.push({
      file: 'environment',
      line: 1,
      rule: 'restricted-write-gray-without-write-toggle',
      message: 'A restricted-write-gray build must explicitly set VITE_ENABLE_PROD_WRITES=true; use the default formal-candidate profile for readonly candidate builds.',
    });
  }

  if (releaseProfile === 'restricted-write-gray' && readonlyOverride) {
    issues.push({
      file: 'environment',
      line: 1,
      rule: 'restricted-write-gray-readonly-override',
      message: 'A restricted-write-gray build must not set VITE_READONLY=true because that forces readonly mode and invalidates write gray verification.',
    });
  }

  return {
    releaseProfile,
    writesRequested,
    readonlyOverride,
    allowWriteBanner: releaseProfile === 'restricted-write-gray' && writesRequested && !readonlyOverride,
    issues,
  };
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

function checkReleaseInfo({ root, dist, distDir, appBase, releaseProfile }) {
  const issues = [];
  const releaseInfoFile = path.join(distDir, 'release-info.json');
  const relativeFile = `${dist}/release-info.json`;
  let releaseInfo = null;

  if (!fs.existsSync(releaseInfoFile)) {
    return {
      releaseInfo,
      issues: [{
        file: relativeFile,
        line: 1,
        rule: 'missing-release-info',
        message: 'Run npm run build so dist/release-info.json is generated for gray deployment version verification.',
      }],
    };
  }

  try {
    releaseInfo = JSON.parse(fs.readFileSync(releaseInfoFile, 'utf8'));
  } catch {
    issues.push({
      file: relativeFile,
      line: 1,
      rule: 'invalid-release-info-json',
      message: 'dist/release-info.json must be valid JSON.',
    });
    return { releaseInfo, issues };
  }

  if (releaseInfo.app !== 'oca-pc-admin-rebuild') {
    issues.push({
      file: relativeFile,
      line: 1,
      rule: 'release-info-app',
      message: 'release-info.json must identify app as oca-pc-admin-rebuild.',
    });
  }

  if (releaseInfo.releaseProfile !== releaseProfile.releaseProfile) {
    issues.push({
      file: relativeFile,
      line: 1,
      rule: 'release-info-profile',
      message: `release-info.json releaseProfile must be "${releaseProfile.releaseProfile}" for this build.`,
    });
  }

  if (releaseInfo.base !== appBase) {
    issues.push({
      file: relativeFile,
      line: 1,
      rule: 'release-info-base',
      message: `release-info.json base must be "${appBase}" for this build.`,
    });
  }

  if (releaseInfo.router !== 'hash') {
    issues.push({
      file: relativeFile,
      line: 1,
      rule: 'release-info-router',
      message: 'release-info.json router must be "hash" so /pc-rebuild/ gray links can be refreshed safely.',
    });
  }

  if (!releaseProfile.allowWriteBanner && releaseInfo.productionWritesEnabled) {
    issues.push({
      file: relativeFile,
      line: 1,
      rule: 'release-info-writes-enabled',
      message: 'formal-candidate and readonly-gray release-info.json must report productionWritesEnabled=false.',
    });
  }

  if (!releaseProfile.allowWriteBanner && releaseInfo.readonly !== true) {
    issues.push({
      file: relativeFile,
      line: 1,
      rule: 'release-info-readonly',
      message: 'formal-candidate and readonly-gray release-info.json must report readonly=true.',
    });
  }

  return { releaseInfo, issues };
}

export function checkBuildOutput({ root = process.cwd(), dist = 'dist', env = process.env } = {}) {
  const distDir = path.join(root, dist);
  const indexFile = path.join(distDir, 'index.html');
  const issues = [];
  const refs = [];
  const appBase = env.VITE_APP_BASE || '/pc-rebuild/';
  const expectedAssetPrefix = env.VITE_APP_BASE === '/' ? '/assets/' : normalizeAssetPrefix(appBase);
  const releaseProfile = checkReleaseProfile(env);
  let releaseInfo = null;
  issues.push(...releaseProfile.issues);

  if (!fs.existsSync(indexFile)) {
    issues.push({
      file: `${dist}/index.html`,
      line: 1,
      rule: 'missing-index',
      message: 'Run npm run build and ensure dist/index.html exists.',
    });
    return { issues, refs, expectedAssetPrefix, releaseProfile };
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

  issues.push(...scanDistText({ root, distDir, allowWriteBanner: releaseProfile.allowWriteBanner }));
  const releaseInfoResult = checkReleaseInfo({ root, dist, distDir, appBase, releaseProfile });
  releaseInfo = releaseInfoResult.releaseInfo;
  issues.push(...releaseInfoResult.issues);
  return { issues, refs, expectedAssetPrefix, releaseProfile, releaseInfo };
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
  const releaseInfoSummary = result.releaseInfo
    ? ` releaseInfoCommit=${result.releaseInfo.commit?.shortSha || 'unknown'} releaseInfoReadonly=${result.releaseInfo.readonly}`
    : '';
  console.log(`Build output check passed. releaseProfile=${result.releaseProfile.releaseProfile} writesRequested=${result.releaseProfile.writesRequested} assetPrefix=${result.expectedAssetPrefix} jsCssRefs=${result.refs.length}${releaseInfoSummary}`);
  for (const ref of result.refs) console.log(`- ${ref}`);
}
