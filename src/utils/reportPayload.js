function hasAnswerValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function selectedOptionIdOf(row = {}) {
  if (Object.prototype.hasOwnProperty.call(row, 'selectedOptionId')) return row.selectedOptionId;
  return row.checkItem?.optionId;
}

function findOption(row = {}, optionId) {
  if (!hasAnswerValue(optionId)) return null;
  return (row.options || []).find((entry) => String(entry.id) === String(optionId)) || null;
}

function normalizeOptionId(optionId) {
  const number = Number(optionId);
  return Number.isNaN(number) ? optionId : number;
}

export function isAssessmentSubmitted(state) {
  // 恢复后端 OutpatientCheck.state === 1 表示整次评估已提交。
  return Number(state) === 1;
}

export function isReportSubmitted(report = {}) {
  // 恢复后端 OutpatientCheckReport.state === 2 表示量表已提交；其他字段是保守兼容别名。
  return [report.state, report.reportState, report.status, report.finishState].some((value) => Number(value) === 2);
}

export function scoreText(row = {}) {
  const selectedOptionId = selectedOptionIdOf(row);
  const option = findOption(row, selectedOptionId);
  const optionScore = option?.optionScore ?? option?.score;
  if (optionScore !== undefined && optionScore !== null) return optionScore;
  if (row.score !== undefined && row.score !== null) return row.score;
  return '/';
}

export function buildQuestionPayload(questions = []) {
  return questions.map((item) => {
    const row = { ...item };
    delete row.order;
    delete row.displayContent;
    delete row.showGroup;
    delete row.selectedOptionId;
    delete row.inputValue;

    // 已认可小程序和恢复后端均接受未答题行 checkItem: null；后端保存时会过滤非空 checkItem。
    row.checkItem = null;

    const selectedOptionId = selectedOptionIdOf(item);
    if (Number(item.type) === 0 && hasAnswerValue(selectedOptionId)) {
      const option = findOption(item, selectedOptionId);
      if (!option) {
        throw new Error('量表选项数据异常，已禁止保存：所选选项不在当前题目选项列表中。');
      }
      row.checkItem = {
        questionId: item.id,
        // optionId 当前生产接口按数字处理；测试契约允许字符串 mock id，0 也不能被误判为空。
        optionId: normalizeOptionId(selectedOptionId),
        score: Number(option.optionScore ?? option.score ?? 0),
        question: item.content,
      };
    } else if (hasAnswerValue(item.inputValue)) {
      // 当前仅固定单选题 type=0；其他题型只在有 inputValue 时按输入题提交。多选、矩阵等特殊题型需后端契约确认后再开放。
      row.checkItem = {
        questionId: item.id,
        input: item.inputValue,
        question: item.content,
      };
    }

    return row;
  });
}
