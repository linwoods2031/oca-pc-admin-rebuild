const NUMERIC_BASE_FIELDS = [
  'height',
  'weight',
  'bmi',
  'sonNumber',
  'daughtersNumber',
  'alseToothNumber',
  'dentureStatus',
  'livingFloor',
  'hasElevator',
  'fallHistory',
  'isBowelProblem',
];

export function emptyMedicine() {
  return { medication: '', dose: '', frequency: '', way: '' };
}

export function cleanPayload(payload, { keepEmpty = false } = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => (keepEmpty ? value !== undefined : value !== '' && value !== null && value !== undefined)),
  );
}

export function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

export function toIdValue(value) {
  if (value === '' || value === null || value === undefined) return value;
  const number = Number(value);
  return Number.isNaN(number) ? value : number;
}

export function normalizeMsList(list) {
  const rows = Array.isArray(list) ? list : [];
  return rows
    .map((item) => ({ ...emptyMedicine(), ...(item || {}) }))
    .filter((item) => item.medication || item.dose || item.frequency || item.way);
}

export function buildBasePayload(form, { patientId, outpatientId, tableId = 4, keepEmpty = false } = {}) {
  const payloadSource = {
    ...form,
    patientId: toIdValue(patientId),
    outpatientId,
    tableId,
  };
  delete payloadSource.msList;

  NUMERIC_BASE_FIELDS.forEach((field) => {
    payloadSource[field] = toNumberOrNull(form?.[field]);
  });

  const payload = cleanPayload(payloadSource, { keepEmpty });
  const msList = normalizeMsList(form?.msList);
  if (msList.length) {
    payload.msList = msList;
  }
  // 当前版本不支持通过删除全部用药清空后端用药；后端提供明确 delete/replace 语义前，不提交空 msList。
  return payload;
}
