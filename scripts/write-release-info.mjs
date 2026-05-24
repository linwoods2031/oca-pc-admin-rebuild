import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export function buildReleaseInfo({ env = process.env } = {}) {
  const writesRequested = env.VITE_ENABLE_PROD_WRITES === 'true';
  const readonlyOverride = env.VITE_READONLY === 'true';
  const productionWritesEnabled = writesRequested && !readonlyOverride;

  return {
    schemaVersion: 1,
    app: 'oca-pc-admin-rebuild',
    generatedAt: new Date().toISOString(),
    commit: {
      sha: git(['rev-parse', 'HEAD']),
      shortSha: git(['rev-parse', '--short', 'HEAD']),
      branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
      dirty: Boolean(git(['status', '--short'])),
    },
    releaseProfile: env.VITE_RELEASE_PROFILE || 'formal-candidate',
    base: env.VITE_APP_BASE || '/pc-rebuild/',
    router: 'hash',
    readonly: !productionWritesEnabled,
    productionWritesEnabled,
  };
}

export function writeReleaseInfo({ root = process.cwd(), dist = 'dist', env = process.env } = {}) {
  const distDir = path.join(root, dist);
  fs.mkdirSync(distDir, { recursive: true });
  const releaseInfo = buildReleaseInfo({ env });
  const file = path.join(distDir, 'release-info.json');
  fs.writeFileSync(file, `${JSON.stringify(releaseInfo, null, 2)}\n`);
  return { file, releaseInfo };
}

const isMain = import.meta.url === pathToFileURL(fileURLToPath(import.meta.url)).href
  && process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const result = writeReleaseInfo();
  console.log(`Wrote ${path.relative(process.cwd(), result.file)} for commit ${result.releaseInfo.commit.shortSha || 'unknown'} profile=${result.releaseInfo.releaseProfile} readonly=${result.releaseInfo.readonly}`);
}
