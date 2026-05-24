import { toIdValue } from './basePayload.js';

export function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

export function compact(payload, { keepEmpty = false } = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => (keepEmpty ? value !== undefined : value !== '' && value !== null && value !== undefined)),
  );
}

export function inferArchiveOwner(source = {}) {
  const user = source.user || source;
  const dept = source.dept || user.dept || (Array.isArray(source.depts) ? source.depts[0] : null);
  return compact({
    deptId: firstDefined(user.deptId, dept?.deptId, dept?.id),
    hospitalId: firstDefined(user.hospitalId, dept?.hospitalId, source.hospitalId),
    // attendingDoctor 由 user.attendingDoctor 优先，其次退回 userId/id；该退回语义仍需后端确认。
    attendingDoctor: firstDefined(user.attendingDoctor, user.userId, user.id),
  });
}

export function buildPatientPayload({ form, original = {}, patientId, ownerDefaults = {}, isEdit = false }) {
  const owner = {
    deptId: firstDefined(original.deptId, ownerDefaults.deptId),
    hospitalId: firstDefined(original.hospitalId, ownerDefaults.hospitalId),
    attendingDoctor: firstDefined(original.attendingDoctor, ownerDefaults.attendingDoctor),
  };
  const guardian = original.guardianList?.[0] || {};
  const payload = compact({
    id: patientId ? toIdValue(patientId) : undefined,
    name: form.name,
    sex: form.sex,
    idNumber: form.idNumber,
    birthday: form.birthday,
    phone: form.phone,
    patientNumber: form.patientNumber,
    admissionNumber: form.admissionNumber,
    homeAddress: form.homeAddress,
    sickroomNumber: form.sickroomNumber,
    sickbedNumber: form.sickbedNumber,
    deptId: owner.deptId,
    hospitalId: owner.hospitalId,
    attendingDoctor: owner.attendingDoctor,
    guardianList: [
      compact({
        id: guardian.id,
        patientId: guardian.patientId ?? (patientId ? toIdValue(patientId) : undefined),
        name: form.guardianName,
        phone: form.guardianPhone,
      }, { keepEmpty: isEdit }),
    ],
  }, { keepEmpty: isEdit });

  return compact(payload, { keepEmpty: isEdit });
}
