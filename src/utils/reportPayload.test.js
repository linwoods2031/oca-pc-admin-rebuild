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
        id: 'question-allow-1',
        type: 0,
        content: '单选题',
        selectedOptionId: 'option-allow-1',
        options: [{ id: 'option-allow-1', optionScore: 3 }],
        order: 1,
        displayContent: '单选题',
        showGroup: true,
      },
    ]);

    expect(row.checkItem).toEqual({
      questionId: 'question-allow-1',
      optionId: 'option-allow-1',
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
        id: 'question-input-1',
        type: 2,
        content: '输入题',
        inputValue: '说明文字',
      },
    ]);

    expect(row.checkItem).toEqual({
      questionId: 'question-input-1',
      input: '说明文字',
      question: '输入题',
    });
  });

  it('treats unknown non-radio types with inputValue as input questions only', () => {
    const [row] = buildQuestionPayload([
      {
        id: 'question-special-1',
        type: 99,
        content: '未知题型',
        inputValue: '保守按输入题提交',
      },
    ]);

    expect(row.checkItem).toEqual({
      questionId: 'question-special-1',
      input: '保守按输入题提交',
      question: '未知题型',
    });
  });

  it('throws when a selected radio option is not present in options', () => {
    expect(() =>
      buildQuestionPayload([
        {
          id: 'question-bad-option-1',
          type: 0,
          content: '异常单选题',
          selectedOptionId: 'option-missing-1',
          options: [{ id: 'option-allow-1', optionScore: 1 }],
        },
      ]),
    ).toThrow('量表选项数据异常，已禁止保存');
  });

  it('keeps empty answers as checkItem null', () => {
    const [row] = buildQuestionPayload([{ id: 301, type: 0, content: '未答题', selectedOptionId: '' }]);
    // 已认可小程序和恢复后端契约固定为空答案提交 checkItem: null。
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
