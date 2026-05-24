import { describe, expect, it } from 'vitest';
import { decideBaseWritable, findAssessmentById, verifyBaseAssociation } from './baseWritable.js';

const patient = {
  checkList: [
    { id: 'outpatient-allow-1', state: 0 },
    { id: 'outpatient-submitted-1', state: 1 },
  ],
};

describe('base writable guards', () => {
  it('finds an assessment by string id', () => {
    expect(findAssessmentById(patient.checkList, 'outpatient-allow-1')).toEqual({ id: 'outpatient-allow-1', state: 0 });
  });

  it('blocks mismatched fresh base ids', () => {
    expect(
      verifyBaseAssociation({
        freshBase: { id: 'base-other-1', outpatientId: 'outpatient-allow-1' },
        baseFormId: 'base-allow-1',
        outpatientId: 'outpatient-allow-1',
        isCreateBase: false,
      }).allowed,
    ).toBe(false);
  });

  it('blocks missing or mismatched outpatient ownership', () => {
    expect(
      verifyBaseAssociation({
        freshBase: { id: 'base-allow-1' },
        baseFormId: 'base-allow-1',
        outpatientId: 'outpatient-allow-1',
        isCreateBase: false,
      }).code,
    ).toBe('fresh-base-missing-outpatient');
    expect(
      verifyBaseAssociation({
        freshBase: { id: 'base-allow-1', outpatientId: 'outpatient-other-1' },
        baseFormId: 'base-allow-1',
        outpatientId: 'outpatient-allow-1',
        isCreateBase: false,
      }).code,
    ).toBe('fresh-base-outpatient-mismatch');
  });

  it('blocks create/update race conditions', () => {
    expect(
      verifyBaseAssociation({
        freshBase: { id: 'base-allow-1', outpatientId: 'outpatient-allow-1' },
        baseFormId: null,
        outpatientId: 'outpatient-allow-1',
        isCreateBase: true,
      }).code,
    ).toBe('fresh-base-exists-during-create');
    expect(
      verifyBaseAssociation({
        freshBase: {},
        baseFormId: 'base-allow-1',
        outpatientId: 'outpatient-allow-1',
        isCreateBase: false,
      }).code,
    ).toBe('fresh-base-missing-during-update');
    expect(
      verifyBaseAssociation({
        freshBase: {},
        baseFormId: null,
        outpatientId: 'outpatient-allow-1',
        isCreateBase: true,
      }).allowed,
    ).toBe(true);
  });

  it('fails closed when patient or assessment context is missing', () => {
    expect(decideBaseWritable({ freshPatient: null, outpatientId: 'outpatient-allow-1' }).code).toBe('fresh-patient-missing');
    expect(decideBaseWritable({ freshPatient: {}, outpatientId: 'outpatient-allow-1' }).code).toBe('fresh-check-list-invalid');
    expect(decideBaseWritable({ freshPatient: patient, outpatientId: 'outpatient-missing-1' }).code).toBe('fresh-assessment-missing');
  });

  it('blocks submitted assessments and allows clear ownership', () => {
    expect(decideBaseWritable({ freshPatient: patient, outpatientId: 'outpatient-submitted-1' }).code).toBe('assessment-submitted');
    expect(
      decideBaseWritable({
        freshPatient: patient,
        freshBase: { id: 'base-allow-1', outpatientId: 'outpatient-allow-1' },
        outpatientId: 'outpatient-allow-1',
        baseFormId: 'base-allow-1',
      }).allowed,
    ).toBe(true);
  });
});
