import { describe, expect, it } from 'vitest';
import { createRuntimeConfig, createWriteGuards, hasId, parseIdList } from './runtime.js';

describe('runtime config', () => {
  it('parses comma-separated allow-list ids', () => {
    expect(parseIdList(' 1,2, ,003 ')).toEqual(['1', '2', '003']);
    expect(hasId(['1', '2'], 2)).toBe(true);
    expect(hasId(['1', '2'], '')).toBe(false);
  });

  it('defaults dev to read-only', () => {
    const config = createRuntimeConfig({ MODE: 'development' });
    expect(config.isReadOnlyMode).toBe(true);
    expect(config.isWriteEnabled).toBe(false);
  });

  it('defaults prod to read-only', () => {
    const config = createRuntimeConfig({ MODE: 'production' });
    expect(config.isReadOnlyMode).toBe(true);
    expect(config.isWriteEnabled).toBe(false);
  });

  it('enables writes only when VITE_ENABLE_PROD_WRITES=true', () => {
    const config = createRuntimeConfig({
      VITE_ENABLE_PROD_WRITES: 'true',
      VITE_WRITE_ALLOW_PATIENT_IDS: '10',
    });
    expect(config.isReadOnlyMode).toBe(false);
    expect(config.isWriteEnabled).toBe(true);
  });

  it('forces read-only when VITE_READONLY=true', () => {
    const config = createRuntimeConfig({
      VITE_ENABLE_PROD_WRITES: 'true',
      VITE_READONLY: 'true',
      VITE_WRITE_ALLOW_PATIENT_IDS: '10',
    });
    expect(config.isReadOnlyMode).toBe(true);
    expect(config.isWriteEnabled).toBe(false);
  });

  it('throws when writes are enabled without any allow-list', () => {
    const guards = createWriteGuards(createRuntimeConfig({ VITE_ENABLE_PROD_WRITES: 'true' }));
    expect(() => guards.assertWriteEnabled()).toThrow('写入灰度未配置 allow-list，禁止写入');
  });

  it('checks patient, outpatient and report allow-lists', () => {
    const guards = createWriteGuards(
      createRuntimeConfig({
        VITE_ENABLE_PROD_WRITES: 'true',
        VITE_WRITE_ALLOW_PATIENT_IDS: '10',
        VITE_WRITE_ALLOW_OUTPATIENT_IDS: '20',
        VITE_WRITE_ALLOW_REPORT_IDS: '30',
      }),
    );

    expect(() => guards.assertPatientWriteAllowed(10)).not.toThrow();
    expect(() => guards.assertPatientWriteAllowed(11)).toThrow('当前患者不在写入灰度 allow-list，禁止写入');
    expect(() => guards.assertOutpatientWriteAllowed('20')).not.toThrow();
    expect(() => guards.assertOutpatientWriteAllowed('21')).toThrow('当前评估不在写入灰度 allow-list，禁止写入');
    expect(() => guards.assertReportWriteAllowed(30)).not.toThrow();
    expect(() => guards.assertReportWriteAllowed(31)).toThrow('当前量表报告不在写入灰度 allow-list，禁止写入');
  });

  it('blocks patient creation unless explicitly enabled', () => {
    const guards = createWriteGuards(
      createRuntimeConfig({
        VITE_ENABLE_PROD_WRITES: 'true',
        VITE_WRITE_ALLOW_PATIENT_IDS: '10',
      }),
    );

    expect(() => guards.assertCreatePatientAllowed()).toThrow('VITE_ALLOW_CREATE_PATIENT=true');
  });
});
