import { describe, expect, it } from 'vitest';
import { createRuntimeConfig, createWriteGuards, hasId, parseIdList } from './runtime.js';

describe('runtime config', () => {
  it('parses comma-separated allow-list ids', () => {
    expect(parseIdList(' patient-allow-1,outpatient-allow-1, ,report-allow-1 ')).toEqual([
      'patient-allow-1',
      'outpatient-allow-1',
      'report-allow-1',
    ]);
    expect(hasId(['patient-allow-1', 'patient-allow-2'], 'patient-allow-2')).toBe(true);
    expect(hasId(['patient-allow-1', 'patient-allow-2'], '')).toBe(false);
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
      VITE_WRITE_ALLOW_PATIENT_IDS: 'patient-allow-1',
    });
    expect(config.isReadOnlyMode).toBe(false);
    expect(config.isWriteEnabled).toBe(true);
  });

  it('forces read-only when VITE_READONLY=true', () => {
    const config = createRuntimeConfig({
      VITE_ENABLE_PROD_WRITES: 'true',
      VITE_READONLY: 'true',
      VITE_WRITE_ALLOW_PATIENT_IDS: 'patient-allow-1',
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
        VITE_WRITE_ALLOW_PATIENT_IDS: 'patient-allow-1',
        VITE_WRITE_ALLOW_OUTPATIENT_IDS: 'outpatient-allow-1',
        VITE_WRITE_ALLOW_REPORT_IDS: 'report-allow-1',
      }),
    );

    expect(() => guards.assertPatientWriteAllowed('patient-allow-1')).not.toThrow();
    expect(() => guards.assertPatientWriteAllowed('patient-blocked-1')).toThrow('当前患者不在写入灰度 allow-list，禁止写入');
    expect(() => guards.assertOutpatientWriteAllowed('outpatient-allow-1')).not.toThrow();
    expect(() => guards.assertOutpatientWriteAllowed('outpatient-blocked-1')).toThrow('当前评估不在写入灰度 allow-list，禁止写入');
    expect(() => guards.assertReportWriteAllowed('report-allow-1')).not.toThrow();
    expect(() => guards.assertReportWriteAllowed('report-blocked-1')).toThrow('当前量表报告不在写入灰度 allow-list，禁止写入');
  });

  it('blocks patient creation unless explicitly enabled', () => {
    const guards = createWriteGuards(
      createRuntimeConfig({
        VITE_ENABLE_PROD_WRITES: 'true',
        VITE_WRITE_ALLOW_PATIENT_IDS: 'patient-allow-1',
      }),
    );

    expect(() => guards.assertCreatePatientAllowed()).toThrow('VITE_ALLOW_CREATE_PATIENT=true');
  });
});
