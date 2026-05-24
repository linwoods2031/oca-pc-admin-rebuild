export const writeDisabledMessage =
  '生产 API 灰度环境当前为只读模式，请仅使用测试患者查看数据；如需写入，必须经发布负责人确认后显式开启。';
export const grayBannerTitle = '生产 API 灰度环境';

const allowListMissingMessage = '写入灰度未配置 allow-list，禁止写入';
const objectNotAllowedMessage = '当前对象不在写入灰度 allow-list，禁止写入';

function writeEnabledBannerMessage() {
  return ['当前允许', '写入生产 API，但仅允许操作 allow-list 中的测试患者、测试评估和测试报告。'].join('');
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

export function createRuntimeConfig(env = {}) {
  const config = {
    isWriteEnabled: env.VITE_READONLY !== 'true' && env.VITE_ENABLE_PROD_WRITES === 'true',
    allowedPatientIds: parseIdList(env.VITE_WRITE_ALLOW_PATIENT_IDS),
    allowedOutpatientIds: parseIdList(env.VITE_WRITE_ALLOW_OUTPATIENT_IDS),
    allowedReportIds: parseIdList(env.VITE_WRITE_ALLOW_REPORT_IDS),
    allowCreatePatient: env.VITE_ALLOW_CREATE_PATIENT === 'true',
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
  function assertWriteEnabled() {
    if (config.isReadOnlyMode) throw new Error(config.writeDisabledMessage);
    if (!config.isAllowListEnabled) throw new Error(config.writeGuardMessage);
  }

  function assertPatientWriteAllowed(patientId, message = '当前患者不在写入灰度 allow-list，禁止写入') {
    assertWriteEnabled();
    if (!hasId(config.allowedPatientIds, patientId)) throw new Error(message);
  }

  function assertOutpatientWriteAllowed(outpatientId, message = '当前评估不在写入灰度 allow-list，禁止写入') {
    assertWriteEnabled();
    if (!hasId(config.allowedOutpatientIds, outpatientId)) throw new Error(message);
  }

  function assertReportWriteAllowed(reportId, message = '当前量表报告不在写入灰度 allow-list，禁止写入') {
    assertWriteEnabled();
    if (!hasId(config.allowedReportIds, reportId)) throw new Error(message);
  }

  function assertCreatePatientAllowed() {
    assertWriteEnabled();
    if (!config.allowCreatePatient) throw new Error('写入灰度默认禁止新增患者，必须显式设置 VITE_ALLOW_CREATE_PATIENT=true');
  }

  return {
    assertWriteEnabled,
    assertPatientWriteAllowed,
    assertOutpatientWriteAllowed,
    assertReportWriteAllowed,
    assertCreatePatientAllowed,
  };
}

const runtimeConfig = createRuntimeConfig(import.meta.env);
const writeGuards = createWriteGuards(runtimeConfig);

export const isWriteEnabled = runtimeConfig.isWriteEnabled;
export const isReadOnlyMode = runtimeConfig.isReadOnlyMode;
export const allowedPatientIds = runtimeConfig.allowedPatientIds;
export const allowedOutpatientIds = runtimeConfig.allowedOutpatientIds;
export const allowedReportIds = runtimeConfig.allowedReportIds;
export const isAllowListEnabled = runtimeConfig.isAllowListEnabled;
export const allowCreatePatient = runtimeConfig.allowCreatePatient;
export const writeGuardMessage = runtimeConfig.writeGuardMessage;
export const grayBannerMessage = runtimeConfig.grayBannerMessage;

export const {
  assertWriteEnabled,
  assertPatientWriteAllowed,
  assertOutpatientWriteAllowed,
  assertReportWriteAllowed,
  assertCreatePatientAllowed,
} = writeGuards;
