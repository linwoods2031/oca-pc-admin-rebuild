import { describe, expect, it } from 'vitest';
import { buildPatientPayload, inferArchiveOwner } from './patientPayload.js';

const form = {
  name: 'Mock Patient',
  sex: 0,
  idNumber: '<id-number>',
  birthday: '1940-01-01',
  phone: '<phone>',
  guardianName: 'Mock Guardian',
  guardianPhone: '<phone>',
  patientNumber: 'patient-number-mock',
  admissionNumber: 'admission-number-mock',
  sickroomNumber: '',
  sickbedNumber: '',
  homeAddress: '',
};

describe('patient payload helpers', () => {
  it('infers owner fields from recovered backend getInfo shape', () => {
    expect(
      inferArchiveOwner({
        user: {
          userId: 'user-owner-1',
          deptId: 'dept-user-1',
          hospitalId: 'hospital-user-1',
          dept: { deptId: 'dept-nested-1', hospitalId: 'hospital-nested-1' },
        },
      }),
    ).toEqual({
      deptId: 'dept-user-1',
      hospitalId: 'hospital-user-1',
      attendingDoctor: 'user-owner-1',
    });
  });

  it('uses nested dept hospital and userId when direct owner fields are missing', () => {
    expect(
      inferArchiveOwner({
        user: {
          userId: 'user-mock-1',
          dept: { deptId: 'dept-nested-1', hospitalId: 'hospital-nested-1' },
        },
      }),
    ).toEqual({
      deptId: 'dept-nested-1',
      hospitalId: 'hospital-nested-1',
      attendingDoctor: 'user-mock-1',
    });
  });

  it('does not trust non-backend attendingDoctor fields as doctor ownership', () => {
    expect(
      inferArchiveOwner({
        user: {
          userId: 'user-owner-1',
          attendingDoctor: 'legacy-doctor-field',
          dept: { deptId: 'dept-nested-1', hospitalId: 'hospital-nested-1' },
        },
      }),
    ).toEqual({
      deptId: 'dept-nested-1',
      hospitalId: 'hospital-nested-1',
      attendingDoctor: 'user-owner-1',
    });
  });

  it('returns an empty object when source has no usable owner fields', () => {
    expect(inferArchiveOwner({ user: {} })).toEqual({});
  });

  it('keeps empty strings for edit payloads', () => {
    const payload = buildPatientPayload({
      form,
      original: {
        deptId: 'dept-original-1',
        hospitalId: 'hospital-original-1',
        attendingDoctor: 'doctor-original-1',
        guardianList: [{ id: 'guardian-allow-1', patientId: 'patient-allow-1' }],
      },
      patientId: 'patient-allow-1',
      isEdit: true,
    });

    expect(payload.homeAddress).toBe('');
    expect(payload.sickroomNumber).toBe('');
    expect(payload.guardianList[0].name).toBe('Mock Guardian');
    expect(payload.guardianList[0].patientId).toBe('patient-allow-1');
  });

  it('filters empty fields for create payloads', () => {
    const payload = buildPatientPayload({
      form,
      ownerDefaults: {
        deptId: 'dept-default-1',
        hospitalId: 'hospital-default-1',
        attendingDoctor: 'doctor-default-1',
      },
      isEdit: false,
    });

    expect(payload).not.toHaveProperty('homeAddress');
    expect(payload).not.toHaveProperty('sickroomNumber');
    expect(payload.deptId).toBe('dept-default-1');
    expect(payload.guardianList[0]).toEqual({
      name: 'Mock Guardian',
      phone: '<phone>',
    });
  });
});
