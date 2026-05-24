import { internalApi } from './client.js';
import {
  assertCreatePatientAllowed,
  assertOutpatientWriteAllowed,
  assertPatientWriteAllowed,
  assertReportWriteAllowed,
} from '../config/runtime.js';

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  );
}

export function login(username, password) {
  return internalApi.post('/login', { username, password, code: '', uuid: '' });
}

export function getInfo() {
  return internalApi.get('/getInfo');
}

export function getPatients(params) {
  return internalApi.get('/patient/archive/listPage', { params: cleanParams(params) });
}

export function getPatient(id) {
  return internalApi.get(`/patient/archive/${id}`);
}

export function addPatient(payload) {
  assertCreatePatientAllowed();
  return internalApi.post('/patient/archive/add', payload);
}

export function updatePatient(payload) {
  assertPatientWriteAllowed(payload?.id, '当前患者不在写入灰度 allow-list，禁止编辑患者');
  return internalApi.post('/patient/archive/update', payload);
}

export function getFollowUps(params) {
  return internalApi.get('/patient/archive/listPage', {
    params: cleanParams({ pageNum: 1, pageSize: 20, ...params }),
  });
}

export function updateVisitor(payload) {
  assertPatientWriteAllowed(payload?.id, '当前患者不在写入灰度 allow-list，禁止修改回访状态');
  return internalApi.post('/patient/archive/updateVisitor', payload);
}

export function getBase(patientId) {
  return internalApi.get(`/outpatient/base/${patientId}`).then((result) => {
    if (result && result.code === 200 && result.data === undefined) return {};
    return result || {};
  });
}

export function getBaseMedications(patientId) {
  return internalApi.get('/ext/base/msList', { params: { patientId }, silent: true });
}

export function addBase(payload) {
  assertPatientWriteAllowed(payload?.patientId, '当前患者不在写入灰度 allow-list，禁止保存一般情况表');
  assertOutpatientWriteAllowed(payload?.outpatientId, '当前评估不在写入灰度 allow-list，禁止保存一般情况表');
  return internalApi.post('/outpatient/base/add', payload);
}

export function updateBase(payload) {
  assertPatientWriteAllowed(payload?.patientId, '当前患者不在写入灰度 allow-list，禁止保存一般情况表');
  assertOutpatientWriteAllowed(payload?.outpatientId, '当前评估不在写入灰度 allow-list，禁止保存一般情况表');
  return internalApi.post('/outpatient/base/update', payload);
}

export function saveBase(payload) {
  return payload.id ? updateBase(payload) : addBase({ tableId: 4, ...payload });
}

export function getDict(dictType) {
  return internalApi.get(`/system/dict/data/type/${dictType}`);
}

export function getAssessmentTables(outpatientId) {
  return internalApi.get(`/outpatient/check/tables/pc`, { params: { outpatientId } });
}

export function getQuestionReport(tableId, reportId) {
  return internalApi.get('/outpatient/check/selectReport', { params: { tableId, reportId } });
}

export function saveQuestionReport(reportId, itemList, context = {}) {
  assertPatientWriteAllowed(context?.patientId, '当前患者不在写入灰度 allow-list，禁止保存量表');
  assertOutpatientWriteAllowed(context?.outpatientId, '当前评估不在写入灰度 allow-list，禁止保存量表');
  assertReportWriteAllowed(reportId, '当前量表报告不在写入灰度 allow-list，禁止保存量表');
  return internalApi.post('/outpatient/check/editCheckReport', { reportId, itemList });
}

export async function openCompositePrint(outpatientId) {
  const response = await internalApi.get(`/outpatient/check/composite/print/${outpatientId}`, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
