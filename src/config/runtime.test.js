import { afterEach, describe, expect, it } from 'vitest';
import { createRuntimeConfig, createWriteGuards, hasId, parseIdList } from './runtime.js';

describe('runtime config', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  function mockSessionStorage(seed = {}) {
    const store = { ...seed };
    globalThis.window = {
      sessionStorage: {
        getItem: (key) => store[key] || '',
        setItem: (key, value) => {
          store[key] = String(value);
        },
      },
    };
  }

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

  it('allows test-session ids only when the explicit session allow-list flag is enabled', () => {
    mockSessionStorage({
      'oca-pc-session-write-patient-ids': 'patient-created-1',
      'oca-pc-session-write-outpatient-ids': 'outpatient-created-1',
      'oca-pc-session-write-report-ids': 'report-created-1',
    });
    const sessionGuards = createWriteGuards(
      createRuntimeConfig({
        VITE_ENABLE_PROD_WRITES: 'true',
        VITE_ENABLE_SESSION_WRITE_ALLOWLIST: 'true',
        VITE_WRITE_ALLOW_PATIENT_IDS: 'patient-bootstrap-1',
      }),
    );
    const staticOnlyGuards = createWriteGuards(
      createRuntimeConfig({
        VITE_ENABLE_PROD_WRITES: 'true',
        VITE_WRITE_ALLOW_PATIENT_IDS: 'patient-bootstrap-1',
      }),
    );

    expect(() => sessionGuards.assertPatientWriteAllowed('patient-created-1')).not.toThrow();
    expect(() => sessionGuards.assertOutpatientWriteAllowed('outpatient-created-1')).not.toThrow();
    expect(() => sessionGuards.assertReportWriteAllowed('report-created-1')).not.toThrow();
    expect(() => staticOnlyGuards.assertPatientWriteAllowed('patient-created-1')).toThrow('allow-list');
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

  it('keeps general situation and medication writes disabled on PC even in write gray mode', () => {
    const config = createRuntimeConfig({
      VITE_ENABLE_PROD_WRITES: 'true',
      VITE_WRITE_ALLOW_PATIENT_IDS: 'patient-allow-1',
      VITE_WRITE_ALLOW_OUTPATIENT_IDS: 'outpatient-allow-1',
      VITE_WRITE_ALLOW_REPORT_IDS: 'report-allow-1',
    });
    const guards = createWriteGuards(config);

    expect(config.isWriteEnabled).toBe(true);
    expect(config.isBaseWriteEnabled).toBe(false);
    expect(config.grayBannerMessage).toContain('一般情况表和当前用药保持只读');
    expect(() => guards.assertBaseWriteAllowed()).toThrow('平板端完成');
  });
});
