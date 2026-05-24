import { describe, expect, it } from 'vitest';
import { buildQuestionPayload, isAssessmentSubmitted, isReportSubmitted, scoreText } from './reportPayload.js';

describe('report payload helpers', () => {
  it('treats assessment state 1 as submitted', () => {
    expect(isAssessmentSubmitted(1)).toBe(true);
    expect(isAssessmentSubmitted('1')).toBe(true);
    expect(isAssessmentSubmitted(0)).toBe(false);
  });

  it('treats report state-like fields equal to 2 as submitted', () => {
    expect(isReportSubmitted({ state: 2 })).toBe(true);
    expect(isReportSubmitted({ reportState: '2' })).toBe(true);
    expect(isReportSubmitted({ status: 2 })).toBe(true);
    expect(isReportSubmitted({ finishState: 2 })).toBe(true);
    expect(isReportSubmitted({ state: 1, status: 0 })).toBe(false);
  });

  it('builds radio question payload', () => {
    const [row] = buildQuestionPayload([
      {
        id: 101,
        type: 0,
        content: '单选题',
        selectedOptionId: '5',
        options: [{ id: 5, optionScore: 3 }],
        order: 1,
        displayContent: '单选题',
        showGroup: true,
      },
    ]);

    expect(row.checkItem).toEqual({
      questionId: 101,
      optionId: 5,
      score: 3,
      question: '单选题',
    });
    expect(row.order).toBeUndefined();
  });

  it('keeps optionId 0 instead of treating it as empty', () => {
    const [row] = buildQuestionPayload([
      {
        id: 102,
        type: 0,
        content: '零值选项',
        selectedOptionId: 0,
        options: [{ id: 0, optionScore: 0 }],
      },
    ]);

    expect(row.checkItem).toMatchObject({ questionId: 102, optionId: 0, score: 0 });
  });

  it('builds input question payload', () => {
    const [row] = buildQuestionPayload([
      {
        id: 201,
        type: 2,
        content: '输入题',
        inputValue: '说明文字',
      },
    ]);

    expect(row.checkItem).toEqual({
      questionId: 201,
      input: '说明文字',
      question: '输入题',
    });
  });

  it('keeps empty answers as checkItem null', () => {
    const [row] = buildQuestionPayload([{ id: 301, type: 0, content: '未答题', selectedOptionId: '' }]);
    // 当前固定为空答案提交 checkItem: null，仍需与小程序和后端确认最终语义。
    expect(row.checkItem).toBeNull();
  });

  it('prefers selected option score over stale row score', () => {
    expect(
      scoreText({
        score: 99,
        selectedOptionId: '2',
        options: [
          { id: 1, optionScore: 1 },
          { id: 2, optionScore: 4 },
        ],
      }),
    ).toBe(4);
    expect(scoreText({ score: 7, selectedOptionId: '', options: [] })).toBe(7);
  });
});
