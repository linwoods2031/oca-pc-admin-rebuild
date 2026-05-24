const TCM_TABLE_ID = 116;
const TCM_TRANSFORMED_SCORE_MARKER = '转化分：';

function valueText(value) {
  return value === null || value === undefined || value === '' ? '/' : String(value);
}

export function isTcmReport(row = {}) {
  const table = row.checkTable || {};
  return Number(row.checkTableId || table.id) === TCM_TABLE_ID
    || String(table.name || row.tableName || '').includes('中医体质');
}

export function splitTransformedScoreRemark(remark) {
  const text = remark || '';
  const index = text.indexOf(TCM_TRANSFORMED_SCORE_MARKER);
  if (index < 0) return { conclusion: text, transformedScore: '' };
  return {
    conclusion: text.slice(0, index).replace(/[；;，,\s]+$/, ''),
    transformedScore: text.slice(index + TCM_TRANSFORMED_SCORE_MARKER.length).trim(),
  };
}

export function reportDisplayText(row = {}) {
  const currentTcm = isTcmReport(row) ? splitTransformedScoreRemark(row.remark) : null;
  const previousTcm = isTcmReport(row) ? splitTransformedScoreRemark(row.exRemark) : null;

  return {
    scoreText: currentTcm?.transformedScore || valueText(row.score),
    remarkText: currentTcm?.conclusion || valueText(row.remark),
    exScoreText: previousTcm?.transformedScore || valueText(row.exScore),
    exRemarkText: previousTcm?.conclusion || valueText(row.exRemark),
  };
}
