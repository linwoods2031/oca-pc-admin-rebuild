import { api } from './client.js';

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  );
}

export function login(username, password) {
  return api.post('/login', { username, password, code: '', uuid: '' });
}

export function getInfo() {
  return api.get('/getInfo');
}

export function getPatients(params) {
  return api.get('/patient/archive/listPage', { params: cleanParams(params) });
}

export function getPatient(id) {
  return api.get(`/patient/archive/${id}`);
}

export function addPatient(payload) {
  return api.post('/patient/archive/add', payload);
}

export function updatePatient(payload) {
  return api.post('/patient/archive/update', payload);
}

export function getFollowUps(params) {
  return api.get('/patient/archive/listPage', {
    params: cleanParams({ pageNum: 1, pageSize: 20, ...params }),
  });
}

export function updateVisitor(payload) {
  return api.post('/patient/archive/updateVisitor', payload);
}

export function getBase(patientId) {
  return api.get(`/outpatient/base/${patientId}`).then((result) => {
    if (result && result.code === 200 && result.data === undefined) return {};
    return result || {};
  });
}

export function getBaseMedications(patientId) {
  return api.get('/ext/base/msList', { params: { patientId }, silent: true });
}

export function addBase(payload) {
  return api.post('/outpatient/base/add', payload);
}

export function updateBase(payload) {
  return api.post('/outpatient/base/update', payload);
}

export function saveBase(payload) {
  return payload.id ? updateBase(payload) : addBase({ tableId: 4, ...payload });
}

export function getDict(dictType) {
  return api.get(`/system/dict/data/type/${dictType}`);
}

export function getAssessmentTables(outpatientId) {
  return api.get(`/outpatient/check/tables/pc`, { params: { outpatientId } });
}

export function getQuestionReport(tableId, reportId) {
  return api.get('/outpatient/check/selectReport', { params: { tableId, reportId } });
}

export function saveQuestionReport(reportId, itemList) {
  return api.post('/outpatient/check/editCheckReport', { reportId, itemList });
}

export async function openCompositePrint(outpatientId) {
  const response = await api.get(`/outpatient/check/composite/print/${outpatientId}`, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
