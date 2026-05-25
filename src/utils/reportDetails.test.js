import { describe, expect, it } from 'vitest';
import {
  buildNrsPainDetails,
  buildSppbPhysicalDetails,
  normalizeReportDetailItems,
  nrsDetailText,
  nrsScoreText,
} from './reportDetails.js';

describe('report detail helpers', () => {
  it('normalizes selectReport rows and saved reportContent rows', () => {
    expect(
      normalizeReportDetailItems([
        { id: 11404, content: '4 米试验（秒）', checkItem: { questionId: 11404, input: '6.1' } },
        { questionId: 248, question: '疼痛分数（0-10）', input: '9', score: 9 },
      ]),
    ).toEqual([
      { questionId: 11404, question: '4 米试验（秒）', input: '6.1', score: undefined },
      { questionId: 248, question: '疼痛分数（0-10）', input: '9', score: 9 },
    ]);
  });

  it('extracts SPPB physical values with seconds', () => {
    const details = buildSppbPhysicalDetails([
      { id: 11401, content: '双脚并拢站立（秒）', checkItem: { questionId: 11401, input: '10' } },
      { id: 11402, content: '半串联站立（秒）', checkItem: { questionId: 11402, input: '8秒' } },
      { id: 11403, content: '串联站立（秒）', checkItem: { questionId: 11403, input: '3' } },
      { id: 11404, content: '4 米试验（秒）', checkItem: { questionId: 11404, input: '6.1' } },
      { id: 11405, content: '五次起立试验（秒）', checkItem: { questionId: 11405, input: '12.3' } },
    ]);

    expect(details).toEqual({
      fourMeter: '6.1 秒',
      fiveRise: '12.3 秒',
      feetTogether: '10 秒',
      tandem: '3 秒',
      semiTandem: '8秒',
    });
  });

  it('extracts NRS pain score and detail text', () => {
    const details = buildNrsPainDetails([
      { questionId: 246, question: '疼痛部位', input: '头' },
      { questionId: 247, question: '持续时间', input: '10分钟' },
      { questionId: 248, question: '疼痛分数（0-10）', input: '9' },
    ]);

    expect(nrsScoreText({ score: null }, details)).toBe('9');
    expect(nrsScoreText({ score: 5 }, details)).toBe('5');
    expect(nrsDetailText(details)).toBe('部位：头\n持续时间：10分钟');
  });
});
