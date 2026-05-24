import { describe, expect, it } from 'vitest';
import { decideFollowupWritable, followupWriteConfirmMessage } from './followupGuard.js';

describe('followup guard', () => {
  it('blocks read-only mode', () => {
    expect(
      decideFollowupWritable({
        isReadOnly: true,
        patientId: 'patient-allow-1',
        allowedPatientIds: ['patient-allow-1'],
        readOnlyMessage: 'readonly',
      }),
    ).toEqual({ allowed: false, reason: 'readonly' });
  });

  it('blocks patients outside the allow-list', () => {
    expect(
      decideFollowupWritable({
        isReadOnly: false,
        patientId: 'patient-blocked-1',
        allowedPatientIds: ['patient-allow-1'],
      }).allowed,
    ).toBe(false);
  });

  it('allows patients inside the allow-list', () => {
    expect(
      decideFollowupWritable({
        isReadOnly: false,
        patientId: 'patient-allow-1',
        allowedPatientIds: ['patient-allow-1'],
      }).allowed,
    ).toBe(true);
  });

  it('allows a caller-provided test-session allow decision', () => {
    expect(
      decideFollowupWritable({
        isReadOnly: false,
        patientId: 'patient-created-1',
        allowedPatientIds: [],
        isPatientAllowed: true,
      }).allowed,
    ).toBe(true);
  });

  it('uses a production write warning for the confirmation text', () => {
    expect(followupWriteConfirmMessage).toContain('写入生产 API，仅限测试患者');
  });
});
