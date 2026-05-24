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

export function isAssessmentSubmitted(state) {
  // 后端评估 state === 1 表示整次评估已提交。
  return Number(state) === 1;
}

export function isReportSubmitted(report = {}) {
  // 量表报告 state/reportState/status/finishState === 2 暂按已提交处理，实际主字段仍需接口回归确认。
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

    // 空答案继续提交 checkItem: null；该语义仍需与小程序和后端最终确认。
    row.checkItem = null;

    const selectedOptionId = selectedOptionIdOf(item);
    if (Number(item.type) === 0 && hasAnswerValue(selectedOptionId)) {
      const option = findOption(item, selectedOptionId);
      row.checkItem = {
        questionId: item.id,
        // optionId 当前按后端正整数处理；这里仍保留 0 或字符串数字，避免前端误丢合法值。
        optionId: Number(selectedOptionId),
        score: option ? Number(option.optionScore ?? option.score ?? 0) : 0,
        question: item.content,
      };
    } else if (hasAnswerValue(item.inputValue)) {
      row.checkItem = {
        questionId: item.id,
        input: item.inputValue,
        question: item.content,
      };
    }

    return row;
  });
}
