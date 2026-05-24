import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkSensitive } from './check-sensitive.mjs';

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sensitive-'));
  fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ scripts: { verify: 'npm run test' } }));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('check-sensitive', () => {
  it('allows placeholders and string mock ids', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'README.md'),
      [
        'username=<username>',
        'password=<password>',
        'token=<token>',
        'patientId: "patient-allow-1"',
        'outpatientId: "outpatient-allow-1"',
        'reportId: "report-allow-1"',
      ].join('\n'),
    );

    expect(checkSensitive({ root: tmpDir, entries: ['README.md'] })).toEqual([]);
  });

  it('flags credentials and real numeric ids', () => {
    const tokenAssignment = `${['to', 'ken'].join('')}=abcdef1234567890`;
    const authHeader = `${['Author', 'ization'].join('')}: ${['Bear', 'er'].join('')} abcdef1234567890`;
    fs.writeFileSync(
      path.join(tmpDir, 'README.md'),
      [
        `${['Oca', 'Test'].join('')}`,
        tokenAssignment,
        authHeader,
        'patientId: 12345',
        `${['VITE_WRITE_ALLOW_', 'PATIENT', '_IDS'].join('')}=12345`,
      ].join('\n'),
    );

    expect(checkSensitive({ root: tmpDir, entries: ['README.md'] }).map((issue) => issue.rule)).toEqual([
      'literal-test-account',
      'real-allow-list-id',
      'token-query-value',
      'authorization-bearer-secret',
      'patientId-real-number',
    ]);
  });
});
