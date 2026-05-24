import { isAssessmentSubmitted, isReportSubmitted } from './reportPayload.js';
import { findAssessmentById } from './baseWritable.js';

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function sameId(left, right) {
  return hasValue(left) && hasValue(right) && String(left) === String(right);
}

function decision(allowed, code, reason, extra = {}) {
  return { allowed, code, reason, ...extra };
}

function listOfTables(assessmentTables) {
  if (Array.isArray(assessmentTables)) return assessmentTables;
  if (Array.isArray(assessmentTables?.list)) return assessmentTables.list;
  return [];
}

export function findReportByMeta(assessmentTables, reportMeta = {}) {
  return listOfTables(assessmentTables).find(
    (item) =>
      sameId(item?.id, reportMeta.id) ||
      sameId(item?.reportId, reportMeta.id) ||
      sameId(item?.id, reportMeta.reportId) ||
      sameId(item?.reportId, reportMeta.reportId) ||
      sameId(item?.checkTableId, reportMeta.checkTableId),
  ) || null;
}

export function decideReportWritable({
  freshPatient,
  assessmentTables,
  currentOutpatientId,
  reportMeta,
  allowSessionAssessment = false,
}) {
  if (!freshPatient) {
    return decision(false, 'fresh-patient-missing', '保存前无法读取当前患者，已禁止保存量表。');
  }
  if (!Array.isArray(freshPatient.checkList)) {
    return decision(false, 'fresh-check-list-invalid', '保存前无法确认当前患者评估列表，已禁止保存量表。');
  }

  const freshAssessment =
    findAssessmentById(freshPatient.checkList, currentOutpatientId) ||
    (allowSessionAssessment
      ? {
          id: currentOutpatientId,
          state: assessmentTables?.state ?? assessmentTables?.outpatientState ?? 0,
          source: 'session-created-test-assessment',
        }
      : null);
  if (!freshAssessment) {
    return decision(false, 'fresh-assessment-missing', '保存前无法在患者评估列表中确认当前评估，已禁止保存量表。');
  }

  const assessmentState = freshAssessment.state ?? assessmentTables?.state ?? assessmentTables?.outpatientState;
  if ([freshAssessment.state, assessmentTables?.state, assessmentTables?.outpatientState].some(isAssessmentSubmitted)) {
    return decision(false, 'assessment-submitted', '评估已提交，禁止保存量表。', {
      assessmentState,
      freshAssessment,
    });
  }

  const freshReport = findReportByMeta(assessmentTables, reportMeta);
  if (!freshReport) {
    return decision(false, 'fresh-report-missing', '保存前无法确认当前量表报告仍存在，已禁止保存量表。', {
      assessmentState,
      freshAssessment,
    });
  }

  const mergedReport = { ...reportMeta, ...freshReport };
  if (isReportSubmitted(mergedReport)) {
    return decision(false, 'report-submitted', '量表报告已提交，禁止保存量表。', {
      assessmentState,
      freshAssessment,
      freshReport,
      mergedReport,
    });
  }

  return decision(true, 'report-writable', '', {
    assessmentState,
    freshAssessment,
    freshReport,
    mergedReport,
  });
}
