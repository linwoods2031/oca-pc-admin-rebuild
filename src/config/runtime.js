function parseIdList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasId(list, id) {
  return id !== '' && id !== null && id !== undefined && list.includes(String(id));
}

export const isWriteEnabled = import.meta.env.VITE_READONLY !== 'true' && import.meta.env.VITE_ENABLE_PROD_WRITES === 'true';
export const isReadOnlyMode = !isWriteEnabled;

export const allowedPatientIds = parseIdList(import.meta.env.VITE_WRITE_ALLOW_PATIENT_IDS);
export const allowedOutpatientIds = parseIdList(import.meta.env.VITE_WRITE_ALLOW_OUTPATIENT_IDS);
export const allowedReportIds = parseIdList(import.meta.env.VITE_WRITE_ALLOW_REPORT_IDS);
export const isAllowListEnabled = Boolean(
  allowedPatientIds.length || allowedOutpatientIds.length || allowedReportIds.length,
);
export const allowCreatePatient = import.meta.env.VITE_ALLOW_CREATE_PATIENT === 'true';

export const writeDisabledMessage =
  '生产 API 灰度环境当前为只读模式，请仅使用测试患者查看数据；如需写入，必须经发布负责人确认后显式开启。';

export const writeGuardMessage = isWriteEnabled && !isAllowListEnabled
  ? '写入灰度未配置 allow-list，禁止写入'
  : '当前对象不在写入灰度 allow-list，禁止写入';

export const grayBannerTitle = '生产 API 灰度环境';

export const grayBannerMessage = isReadOnlyMode
  ? '当前已启用只读保护，请仅使用测试患者查看数据，患者新增/编辑、一般情况表、量表保存和回访开关均已禁用。'
  : '当前允许写入生产 API，但仅允许操作 allow-list 中的测试患者、测试评估和测试报告。';

export function assertWriteEnabled() {
  if (isReadOnlyMode) throw new Error(writeDisabledMessage);
  if (!isAllowListEnabled) throw new Error(writeGuardMessage);
}

export function assertPatientWriteAllowed(patientId, message = '当前患者不在写入灰度 allow-list，禁止写入') {
  assertWriteEnabled();
  if (!hasId(allowedPatientIds, patientId)) throw new Error(message);
}

export function assertOutpatientWriteAllowed(outpatientId, message = '当前评估不在写入灰度 allow-list，禁止写入') {
  assertWriteEnabled();
  if (!hasId(allowedOutpatientIds, outpatientId)) throw new Error(message);
}

export function assertReportWriteAllowed(reportId, message = '当前量表报告不在写入灰度 allow-list，禁止写入') {
  assertWriteEnabled();
  if (!hasId(allowedReportIds, reportId)) throw new Error(message);
}

export function assertCreatePatientAllowed() {
  assertWriteEnabled();
  if (!allowCreatePatient) throw new Error('写入灰度默认禁止新增患者，必须显式设置 VITE_ALLOW_CREATE_PATIENT=true');
}
