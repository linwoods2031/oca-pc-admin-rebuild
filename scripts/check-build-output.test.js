import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkBuildOutput } from './check-build-output.mjs';

const WRITE_BANNER = '当前允许写入生产 API';

let tmpDir;

function writeDist({ banner = '' } = {}) {
  const dist = path.join(tmpDir, 'dist');
  fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
  fs.writeFileSync(
    path.join(dist, 'index.html'),
    '<!doctype html><script type="module" src="/pc-rebuild/assets/index.js"></script><link rel="stylesheet" href="/pc-rebuild/assets/index.css">',
  );
  fs.writeFileSync(path.join(dist, 'assets', 'index.js'), `console.log(${JSON.stringify(banner)});\n`);
  fs.writeFileSync(path.join(dist, 'assets', 'index.css'), 'body{margin:0}\n');
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-output-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('check-build-output', () => {
  it('passes the default readonly formal candidate build', () => {
    writeDist();

    const result = checkBuildOutput({ root: tmpDir, env: {} });

    expect(result.issues).toEqual([]);
    expect(result.releaseProfile.releaseProfile).toBe('formal-candidate');
    expect(result.releaseProfile.writesRequested).toBe(false);
  });

  it('blocks write-enabled builds from being classified as formal candidates', () => {
    writeDist();

    const result = checkBuildOutput({
      root: tmpDir,
      env: { VITE_ENABLE_PROD_WRITES: 'true' },
    });

    expect(result.issues.map((issue) => issue.rule)).toContain('writes-enabled-outside-restricted-write-gray');
  });

  it('allows the write banner only for an explicit restricted write gray package', () => {
    writeDist({ banner: WRITE_BANNER });

    const result = checkBuildOutput({
      root: tmpDir,
      env: {
        VITE_RELEASE_PROFILE: 'restricted-write-gray',
        VITE_ENABLE_PROD_WRITES: 'true',
      },
    });

    expect(result.issues).toEqual([]);
    expect(result.releaseProfile.allowWriteBanner).toBe(true);
  });

  it('requires restricted write gray packages to opt into writes explicitly', () => {
    writeDist();

    const result = checkBuildOutput({
      root: tmpDir,
      env: { VITE_RELEASE_PROFILE: 'restricted-write-gray' },
    });

    expect(result.issues.map((issue) => issue.rule)).toContain('restricted-write-gray-without-write-toggle');
  });
});
