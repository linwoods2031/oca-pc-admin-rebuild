import { isAssessmentSubmitted } from './reportPayload.js';

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function sameId(left, right) {
  return hasValue(left) && hasValue(right) && String(left) === String(right);
}

function decision(allowed, code, reason, extra = {}) {
  return { allowed, code, reason, ...extra };
}

export function findAssessmentById(list = [], outpatientId) {
  if (!Array.isArray(list) || !hasValue(outpatientId)) return null;
  return list.find((item) => sameId(item?.id, outpatientId)) || null;
}

export function verifyBaseAssociation({ freshBase, baseFormId, outpatientId, isCreateBase }) {
  const hasFreshBaseId = hasValue(freshBase?.id);

  if (hasFreshBaseId && isCreateBase) {
    return decision(false, 'fresh-base-exists-during-create', '保存前复查发现一般情况表已存在，请重新打开后编辑。');
  }
  if (hasFreshBaseId && hasValue(baseFormId) && !sameId(freshBase.id, baseFormId)) {
    return decision(false, 'fresh-base-id-mismatch', '重新读取的一般情况表记录与当前编辑记录不一致，已禁止保存。');
  }
  if (hasFreshBaseId && !hasValue(freshBase.outpatientId)) {
    return decision(false, 'fresh-base-missing-outpatient', '后端仅按患者返回一般情况表，无法确认该记录是否属于当前评估，已禁止保存以避免误更新。');
  }
  if (hasFreshBaseId && !sameId(freshBase.outpatientId, outpatientId)) {
    return decision(false, 'fresh-base-outpatient-mismatch', '当前一般情况表记录归属的评估与所选评估不一致，已禁止保存以避免误更新。');
  }
  if (!hasFreshBaseId && !isCreateBase) {
    return decision(false, 'fresh-base-missing-during-update', '保存前复查未找到当前一般情况表记录，已禁止保存。');
  }
  return decision(true, 'base-association-ok', '');
}

export function decideBaseWritable({ freshPatient, freshBase, outpatientId, baseFormId }) {
  if (!freshPatient) {
    return decision(false, 'fresh-patient-missing', '保存前无法读取当前患者，已禁止保存一般情况表。');
  }
  if (!Array.isArray(freshPatient.checkList)) {
    return decision(false, 'fresh-check-list-invalid', '保存前无法确认当前患者评估列表，已禁止保存一般情况表。');
  }

  const assessment = findAssessmentById(freshPatient.checkList, outpatientId);
  if (!assessment) {
    return decision(false, 'fresh-assessment-missing', '保存前无法在患者评估列表中确认当前评估，已禁止保存一般情况表。');
  }
  if (isAssessmentSubmitted(assessment.state)) {
    return decision(false, 'assessment-submitted', '评估已提交，禁止保存一般情况表。', { assessment });
  }

  const association = verifyBaseAssociation({
    freshBase,
    baseFormId,
    outpatientId,
    isCreateBase: !hasValue(baseFormId),
  });
  return { ...association, assessment };
}
