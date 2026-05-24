import { hasId } from '../config/runtime.js';

export const followupWriteConfirmMessage = '将写入生产 API，仅限测试患者。确认修改当前患者回访状态？';

export function decideFollowupWritable({
  isReadOnly,
  patientId,
  allowedPatientIds = [],
  readOnlyMessage,
  notAllowedMessage = '当前患者不在写入灰度 allow-list，禁止修改回访状态',
} = {}) {
  if (isReadOnly) {
    return { allowed: false, reason: readOnlyMessage };
  }
  if (!hasId(allowedPatientIds, patientId)) {
    return { allowed: false, reason: notAllowedMessage };
  }
  return { allowed: true, reason: '', confirmMessage: followupWriteConfirmMessage };
}
