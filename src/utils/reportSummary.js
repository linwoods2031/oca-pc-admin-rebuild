import { nrsDetailText, nrsScoreText } from './reportDetails.js';

export const REPORT_SUMMARY_LAYOUT = [
  [{ label: 'Tinetti\n平衡', tableId: 13 }, { label: 'ADL\n(功能)', tableId: 101 }],
  [{ label: 'Tinetti\n步态', tableId: 14 }, { label: 'IADL\n(生活)', tableId: 102 }],
  [{ label: 'MMSE\n(认知)', tableId: 105 }, { label: 'SAS\n(焦虑)', tableId: 103 }],
  [{ label: 'Mini Cog\n(认知)', handwrite: true }, { label: 'SDS\n(抑郁)', tableId: 104 }],
  [{ label: 'NRS2002\n(营养)', handwrite: true }, { label: 'CAM\n(谵妄)', handwrite: true }],
  [{ label: 'MNA-SF\n(营养)', tableId: 107 }, { label: 'AIS\n(睡眠)', tableId: 109 }],
  [{ label: 'CFS-09\n(衰弱)', tableId: 112 }, { label: 'EAT-10\n(吞咽)', tableId: 111 }],
  [{ label: 'FRIED\n(衰弱)', tableId: 117 }, { label: 'SARC-F\n(简易五项)', tableId: 108 }],
  [{ label: 'Frail\n(衰弱)', tableId: 110 }, { label: '中医体质\n辨识', tableId: 116 }],
  [{ label: 'FRA\n(跌倒)', tableId: 106 }, { label: 'SPPB', tableId: 114 }],
  [{ label: 'NRS\n(疼痛)', tableId: 113 }, { label: '疼痛信息', detail: 'nrs' }],
];

function buildTableMap(tables = []) {
  return new Map((tables || []).map((row) => [Number(row.checkTableId), row]));
}

export function reportSummarySlotResult(slot, tableById, details = {}) {
  if (!slot) return '';
  if (slot.detail === 'nrs') return nrsDetailText(details.nrs);
  if (slot.handwrite) return '';

  const row = tableById.get(Number(slot.tableId));
  if (!row || row.previousOnly) return '/';

  const scoreTextValue = Number(slot.tableId) === 113 ? nrsScoreText(row, details.nrs) : row.scoreText;
  const score = scoreTextValue && scoreTextValue !== '/' ? `得分：${scoreTextValue}` : '';
  const remark = row.remarkText && row.remarkText !== '/' ? `结论：${row.remarkText}` : '';
  return [score, remark].filter(Boolean).join('\n') || '/';
}

export function buildReportSummaryRows(tables = [], details = {}) {
  const tableById = buildTableMap(tables);
  return REPORT_SUMMARY_LAYOUT.map(([left, right]) => ({
    leftName: left?.label || '',
    leftResult: reportSummarySlotResult(left, tableById, details),
    rightName: right?.label || '',
    rightResult: reportSummarySlotResult(right, tableById, details),
  }));
}
