import { describe, expect, it } from 'vitest';
import { formatTransformedScore, reportDisplayText, splitTransformedScoreRemark } from './reportDisplay.js';

describe('report display helpers', () => {
  it('splits TCM transformed scores from conclusion text', () => {
    expect(splitTransformedScoreRemark('平和质；转化分：平和质 75，气虚质 20')).toEqual({
      conclusion: '平和质',
      transformedScore: '平和质 75\n气虚质 20',
    });
  });

  it('formats TCM transformed score text as readable lines', () => {
    expect(formatTransformedScore('平和质 75，气虚质 20；阳虚质 10')).toBe('平和质 75\n气虚质 20\n阳虚质 10');
  });

  it('puts TCM transformed scores in the score column and conclusion in the conclusion column', () => {
    expect(
      reportDisplayText({
        checkTableId: 116,
        score: 123,
        remark: '基本是平和质；转化分：平和质 75，气虚质 20',
        exScore: 88,
        exRemark: '气虚质倾向；转化分：平和质 55，气虚质 35',
      }),
    ).toEqual({
      isTcmReport: true,
      scoreText: '平和质 75\n气虚质 20',
      remarkText: '基本是平和质',
      exScoreText: '平和质 55\n气虚质 35',
      exRemarkText: '气虚质倾向',
    });
  });

  it('keeps ordinary reports unchanged', () => {
    expect(reportDisplayText({ checkTableId: 101, score: 80, remark: '轻度功能缺陷' })).toMatchObject({
      isTcmReport: false,
      scoreText: '80',
      remarkText: '轻度功能缺陷',
      exScoreText: '/',
      exRemarkText: '/',
    });
  });
});
