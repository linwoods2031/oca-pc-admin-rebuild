import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkApiBoundary } from './check-api-boundary.mjs';

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-boundary-'));
  fs.mkdirSync(path.join(tmpDir, 'src', 'views'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'src', 'components'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('check-api-boundary', () => {
  it('passes wrapper-based business code', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'views', 'SafeView.js'),
      "import { updatePatient } from '../api/oca.js';\nupdatePatient({ id: 1 });\n",
    );

    expect(checkApiBoundary({ root: tmpDir })).toEqual([]);
  });

  it('flags direct client imports and write calls', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'views', 'UnsafeView.js'),
      "import { api } from '../api/client.js';\napi.post('/x');\naxios.delete('/x');\n",
    );

    const issues = checkApiBoundary({ root: tmpDir });
    expect(issues.map((issue) => issue.rule)).toEqual([
      'import-api-client',
      'api-direct-write',
      'axios-direct-write',
    ]);
  });
});
