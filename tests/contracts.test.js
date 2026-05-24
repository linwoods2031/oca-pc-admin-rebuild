import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decideBaseWritable, verifyBaseAssociation } from '../src/utils/baseWritable.js';
import { buildQuestionPayload } from '../src/utils/reportPayload.js';
import { decideReportWritable } from '../src/utils/reportWritable.js';
import { inferArchiveOwner } from '../src/utils/patientPayload.js';

function fixture(name) {
  const file = new URL(`./fixtures/contracts/${name}`, import.meta.url);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function toEditableQuestions(list) {
  return list.map((item) => ({
    ...item,
    selectedOptionId: item.checkItem?.optionId ?? null,
    inputValue: item.checkItem?.input || '',
  }));
}

describe('mock API contract fixtures', () => {
  it('uses脱敏 mock fixtures for owner inference', () => {
    expect(inferArchiveOwner(fixture('getInfo.mock.json'))).toEqual({
      deptId: 'dept-mock-1',
      hospitalId: 'hospital-mock-1',
      attendingDoctor: 'doctor-mock-1',
    });
  });

  it('validates general base ownership with outpatient ids', () => {
    const patient = fixture('patient-detail.mock.json');
    const base = fixture('base-with-outpatient.mock.json');
    const missingOutpatientBase = fixture('base-without-outpatient.mock.json');

    expect(
      decideBaseWritable({
        freshPatient: patient,
        freshBase: base,
        outpatientId: 'outpatient-allow-1',
        baseFormId: 'base-allow-1',
      }).allowed,
    ).toBe(true);
    expect(
      verifyBaseAssociation({
        freshBase: missingOutpatientBase,
        baseFormId: 'base-missing-outpatient-1',
        outpatientId: 'outpatient-allow-1',
        isCreateBase: false,
      }).code,
    ).toBe('fresh-base-missing-outpatient');
  });

  it('validates report writability from patient and assessment table fixtures', () => {
    expect(
      decideReportWritable({
        freshPatient: fixture('patient-detail.mock.json'),
        assessmentTables: fixture('assessment-tables.mock.json'),
        currentOutpatientId: 'outpatient-allow-1',
        reportMeta: { id: 'report-allow-1', checkTableId: 'table-allow-1' },
      }).allowed,
    ).toBe(true);
  });

  it('keeps PC editCheckReport payload aligned with the mock mini-program equivalent payload', () => {
    const questionReport = fixture('question-report.mock.json');
    const editPayload = fixture('edit-check-report-payload.mock.json');
    const miniProgramPayload = fixture('mini-program-equivalent-payload.mock.json');
    const itemList = buildQuestionPayload(toEditableQuestions(questionReport));

    expect({ reportId: 'report-allow-1', itemList }).toEqual(editPayload);
    expect(editPayload).toEqual(miniProgramPayload);
  });
});
