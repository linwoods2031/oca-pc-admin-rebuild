import { describe, expect, it } from 'vitest';
import { buildReportSummaryRows, reportSummarySlotResult } from './reportSummary.js';

describe('report summary rows', () => {
  it('builds the PDF-style assessment summary rows from table results', () => {
    const rows = buildReportSummaryRows([
      { checkTableId: 13, scoreText: '16', remarkText: '平衡风险低' },
      { checkTableId: 101, scoreText: '80', remarkText: '轻度功能缺陷' },
    ]);

    expect(rows[0]).toEqual({
      leftName: 'Tinetti\n平衡',
      leftResult: '得分：16\n结论：平衡风险低',
      rightName: 'ADL\n(功能)',
      rightResult: '得分：80\n结论：轻度功能缺陷',
    });
  });

  it('keeps handwrite slots blank and missing reports as slash placeholders', () => {
    const rows = buildReportSummaryRows([]);

    expect(rows[3].leftResult).toBe('');
    expect(rows[3].rightResult).toBe('/');
  });

  it('uses NRS detail answers for the pain info slot', () => {
    const rows = buildReportSummaryRows(
      [{ checkTableId: 113, scoreText: '/', remarkText: '轻度疼痛' }],
      { nrs: { score: '2', part: '膝关节', duration: '3天' } },
    );

    expect(rows[10].leftResult).toBe('得分：2\n结论：轻度疼痛');
    expect(rows[10].rightResult).toBe('部位：膝关节\n持续时间：3天');
  });

  it('does not display previous-only reports as current results', () => {
    const result = reportSummarySlotResult(
      { tableId: 101 },
      new Map([[101, { checkTableId: 101, previousOnly: true, scoreText: '90', remarkText: '上次结果' }]]),
    );

    expect(result).toBe('/');
  });
});
