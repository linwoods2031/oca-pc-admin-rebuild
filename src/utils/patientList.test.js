import { describe, expect, it } from 'vitest';
import { sortFollowUpRows, sortPatientRows } from './patientList.js';

describe('patient list sorting', () => {
  it('sorts archive patients by newest create time by default', () => {
    const rows = [
      { id: 'patient-old', name: 'B', createTime: '2026-05-01T08:00:00+08:00' },
      { id: 'patient-new', name: 'A', createTime: '2026-05-03T08:00:00+08:00' },
      { id: 'patient-mid', name: 'C', createTime: '2026-05-02T08:00:00+08:00' },
    ];

    expect(sortPatientRows(rows).map((row) => row.id)).toEqual(['patient-new', 'patient-mid', 'patient-old']);
  });

  it('keeps missing dates last when sorting archive patients by revisit date', () => {
    const rows = [
      { id: 'patient-empty', name: 'A', createTime: '2026-05-03T08:00:00+08:00', nextVisitDate: null },
      { id: 'patient-late', name: 'B', createTime: '2026-05-02T08:00:00+08:00', nextVisitDate: '2026-05-10' },
      { id: 'patient-early', name: 'C', createTime: '2026-05-01T08:00:00+08:00', nextVisitDate: '2026-05-01' },
    ];

    expect(sortPatientRows(rows, { prop: 'nextVisitDate', order: 'ascending' }).map((row) => row.id)).toEqual([
      'patient-early',
      'patient-late',
      'patient-empty',
    ]);
  });

  it('sorts follow-up patients by nearest revisit date and keeps missing dates last', () => {
    const rows = [
      { id: 'patient-none', name: 'A', nextVisitDate: null },
      { id: 'patient-late', name: 'B', nextVisitDate: '2026-05-09' },
      { id: 'patient-early', name: 'C', nextVisitDate: '2026-05-02' },
    ];

    expect(sortFollowUpRows(rows).map((row) => row.id)).toEqual(['patient-early', 'patient-late', 'patient-none']);
  });
});
