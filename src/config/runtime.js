export const writeDisabledMessage =
  '生产 API 灰度环境当前为只读模式，请仅使用测试患者查看数据；如需写入，必须经发布负责人确认后显式开启。';
export const baseWriteDisabledMessage = 'PC 端一般情况表和当前用药当前按只读处理，修改请在平板端完成。';
export const grayBannerTitle = '生产 API 灰度环境';

const allowListMissingMessage = '写入灰度未配置 allow-list，禁止写入';
const objectNotAllowedMessage = '当前对象不在写入灰度 allow-list，禁止写入';
const sessionAllowListKeys = {
  patient: 'oca-pc-session-write-patient-ids',
  outpatient: 'oca-pc-session-write-outpatient-ids',
  report: 'oca-pc-session-write-report-ids',
};

function writeEnabledBannerMessage() {
  return [
    '当前允许',
    '写入生产 API，但仅允许操作 allow-list 中的测试患者、测试评估和测试报告；一般情况表和当前用药保持只读。',
  ].join('');
}

export function parseIdList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function hasId(list, id) {
  return id !== '' && id !== null && id !== undefined && list.includes(String(id));
}

function readSessionIds(key) {
  if (typeof window === 'undefined' || !window.sessionStorage) return [];
  try {
    return parseIdList(window.sessionStorage.getItem(key));
  } catch {
    return [];
  }
}

function rememberSessionIds(key, ids = []) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  const next = new Set(readSessionIds(key));
  ids.filter((id) => id !== '' && id !== null && id !== undefined).forEach((id) => next.add(String(id)));
  try {
    window.sessionStorage.setItem(key, Array.from(next).join(','));
  } catch {
    // sessionStorage is best-effort; static allow-list guards remain in force.
  }
}

export function createRuntimeConfig(env = {}) {
  const config = {
    isWriteEnabled: env.VITE_READONLY !== 'true' && env.VITE_ENABLE_PROD_WRITES === 'true',
    allowedPatientIds: parseIdList(env.VITE_WRITE_ALLOW_PATIENT_IDS),
    allowedOutpatientIds: parseIdList(env.VITE_WRITE_ALLOW_OUTPATIENT_IDS),
    allowedReportIds: parseIdList(env.VITE_WRITE_ALLOW_REPORT_IDS),
    allowCreatePatient: env.VITE_ALLOW_CREATE_PATIENT === 'true',
    allowSessionWriteIds: env.VITE_ENABLE_SESSION_WRITE_ALLOWLIST === 'true',
    isBaseWriteEnabled: false,
  };

  config.isReadOnlyMode = !config.isWriteEnabled;
  config.isAllowListEnabled = Boolean(
    config.allowedPatientIds.length || config.allowedOutpatientIds.length || config.allowedReportIds.length,
  );
  config.writeDisabledMessage = writeDisabledMessage;
  config.writeGuardMessage =
    config.isWriteEnabled && !config.isAllowListEnabled ? allowListMissingMessage : objectNotAllowedMessage;
  config.grayBannerTitle = grayBannerTitle;
  config.grayBannerMessage = config.isReadOnlyMode
    ? '当前已启用只读保护，请仅使用测试患者查看数据，患者新增/编辑、一般情况表、量表保存和回访开关均已禁用。'
    : writeEnabledBannerMessage();

  return config;
}

export function createWriteGuards(config) {
  function hasConfiguredId(staticList, key, id) {
    if (hasId(staticList, id)) return true;
    if (!config.allowSessionWriteIds) return false;
    return hasId(readSessionIds(key), id);
  }

  function assertWriteEnabled() {
    if (config.isReadOnlyMode) throw new Error(config.writeDisabledMessage);
    if (!config.isAllowListEnabled) throw new Error(config.writeGuardMessage);
  }

  function assertPatientWriteAllowed(patientId, message = '当前患者不在写入灰度 allow-list，禁止写入') {
    assertWriteEnabled();
    if (!hasConfiguredId(config.allowedPatientIds, sessionAllowListKeys.patient, patientId)) throw new Error(message);
  }

  function assertOutpatientWriteAllowed(outpatientId, message = '当前评估不在写入灰度 allow-list，禁止写入') {
    assertWriteEnabled();
    if (!hasConfiguredId(config.allowedOutpatientIds, sessionAllowListKeys.outpatient, outpatientId)) throw new Error(message);
  }

  function assertReportWriteAllowed(reportId, message = '当前量表报告不在写入灰度 allow-list，禁止写入') {
    assertWriteEnabled();
    if (!hasConfiguredId(config.allowedReportIds, sessionAllowListKeys.report, reportId)) throw new Error(message);
  }

  function assertCreatePatientAllowed() {
    assertWriteEnabled();
    if (!config.allowCreatePatient) throw new Error('写入灰度默认禁止新增患者，必须显式设置 VITE_ALLOW_CREATE_PATIENT=true');
  }

  function assertBaseWriteAllowed() {
    throw new Error(baseWriteDisabledMessage);
  }

  return {
    assertWriteEnabled,
    assertPatientWriteAllowed,
    assertOutpatientWriteAllowed,
    assertReportWriteAllowed,
    assertCreatePatientAllowed,
    assertBaseWriteAllowed,
  };
}

const runtimeConfig = createRuntimeConfig(import.meta.env);
const writeGuards = createWriteGuards(runtimeConfig);

export function rememberWriteAllowIds({ patientIds = [], outpatientIds = [], reportIds = [] } = {}) {
  if (!runtimeConfig.allowSessionWriteIds) return;
  rememberSessionIds(sessionAllowListKeys.patient, patientIds);
  rememberSessionIds(sessionAllowListKeys.outpatient, outpatientIds);
  rememberSessionIds(sessionAllowListKeys.report, reportIds);
}

function hasRuntimeId(staticList, key, id) {
  if (hasId(staticList, id)) return true;
  if (!runtimeConfig.allowSessionWriteIds) return false;
  return hasId(readSessionIds(key), id);
}

export function hasPatientWriteId(id) {
  return hasRuntimeId(runtimeConfig.allowedPatientIds, sessionAllowListKeys.patient, id);
}

export function hasOutpatientWriteId(id) {
  return hasRuntimeId(runtimeConfig.allowedOutpatientIds, sessionAllowListKeys.outpatient, id);
}

export function hasReportWriteId(id) {
  return hasRuntimeId(runtimeConfig.allowedReportIds, sessionAllowListKeys.report, id);
}

export const isWriteEnabled = runtimeConfig.isWriteEnabled;
export const isReadOnlyMode = runtimeConfig.isReadOnlyMode;
export const allowedPatientIds = runtimeConfig.allowedPatientIds;
export const allowedOutpatientIds = runtimeConfig.allowedOutpatientIds;
export const allowedReportIds = runtimeConfig.allowedReportIds;
export const isAllowListEnabled = runtimeConfig.isAllowListEnabled;
export const allowCreatePatient = runtimeConfig.allowCreatePatient;
export const allowSessionWriteIds = runtimeConfig.allowSessionWriteIds;
export const isBaseWriteEnabled = runtimeConfig.isBaseWriteEnabled;
export const writeGuardMessage = runtimeConfig.writeGuardMessage;
export const grayBannerMessage = runtimeConfig.grayBannerMessage;

export const {
  assertWriteEnabled,
  assertPatientWriteAllowed,
  assertOutpatientWriteAllowed,
  assertReportWriteAllowed,
  assertCreatePatientAllowed,
  assertBaseWriteAllowed,
} = writeGuards;
