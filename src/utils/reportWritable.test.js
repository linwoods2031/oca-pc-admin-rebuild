import { describe, expect, it } from 'vitest';
import { decideReportWritable, findReportByMeta } from './reportWritable.js';

const freshPatient = {
  checkList: [
    { id: 'outpatient-allow-1', state: 0 },
    { id: 'outpatient-submitted-1', state: 1 },
  ],
};

const assessmentTables = {
  list: [
    { id: 'report-allow-1', reportId: 'report-allow-1', checkTableId: 'table-allow-1', state: 0 },
    { id: 'report-submitted-1', reportId: 'report-submitted-1', checkTableId: 'table-submitted-1', reportState: 2 },
  ],
};

describe('report writable guards', () => {
  it('finds fresh reports by report id or table id', () => {
    expect(findReportByMeta(assessmentTables, { id: 'report-allow-1' })?.id).toBe('report-allow-1');
    expect(findReportByMeta(assessmentTables, { checkTableId: 'table-allow-1' })?.id).toBe('report-allow-1');
  });

  it('fails closed when patient or assessment context is missing', () => {
    expect(decideReportWritable({ freshPatient: null }).code).toBe('fresh-patient-missing');
    expect(decideReportWritable({ freshPatient: {}, currentOutpatientId: 'outpatient-allow-1' }).code).toBe(
      'fresh-check-list-invalid',
    );
    expect(
      decideReportWritable({
        freshPatient,
        assessmentTables,
        currentOutpatientId: 'outpatient-missing-1',
        reportMeta: { id: 'report-allow-1' },
      }).code,
    ).toBe('fresh-assessment-missing');
  });

  it('allows session-created test assessments only when explicitly marked', () => {
    const decision = decideReportWritable({
      freshPatient,
      assessmentTables,
      currentOutpatientId: 'outpatient-session-1',
      reportMeta: { id: 'report-allow-1' },
      allowSessionAssessment: true,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.freshAssessment.source).toBe('session-created-test-assessment');
  });

  it('blocks submitted assessment and submitted report fields', () => {
    expect(
      decideReportWritable({
        freshPatient,
        assessmentTables,
        currentOutpatientId: 'outpatient-submitted-1',
        reportMeta: { id: 'report-allow-1' },
      }).code,
    ).toBe('assessment-submitted');
    expect(
      decideReportWritable({
        freshPatient,
        assessmentTables,
        currentOutpatientId: 'outpatient-allow-1',
        reportMeta: { id: 'report-submitted-1' },
      }).code,
    ).toBe('report-submitted');
  });

  it('fails closed when the fresh report is missing', () => {
    expect(
      decideReportWritable({
        freshPatient,
        assessmentTables,
        currentOutpatientId: 'outpatient-allow-1',
        reportMeta: { id: 'report-missing-1', checkTableId: 'table-missing-1' },
      }).code,
    ).toBe('fresh-report-missing');
  });

  it('allows writable fresh assessment and report', () => {
    const decision = decideReportWritable({
      freshPatient,
      assessmentTables,
      currentOutpatientId: 'outpatient-allow-1',
      reportMeta: { id: 'report-allow-1' },
    });

    expect(decision.allowed).toBe(true);
    expect(decision.mergedReport.id).toBe('report-allow-1');
  });
});
