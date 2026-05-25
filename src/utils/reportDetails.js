const SPPB_FIELDS = [
  { key: 'fourMeter', label: '4米步速试验', ids: [11404], markers: ['4 米试验', '4米试验', '4 米', '4米'] },
  { key: 'fiveRise', label: '5次起坐', ids: [11405], markers: ['五次起立', '5次起坐', '五次起坐'] },
  { key: 'feetTogether', label: '并足站立', ids: [11401], markers: ['双脚并拢', '并足'] },
  { key: 'tandem', label: '串联站立', ids: [11403], markers: ['串联站立', '串联'] },
  { key: 'semiTandem', label: '半串联站立', ids: [11402], markers: ['半串联'] },
];

const NRS_FIELDS = [
  { key: 'part', label: '疼痛部位', ids: [246], markers: ['疼痛部位'] },
  { key: 'duration', label: '持续时间', ids: [247], markers: ['持续时间'] },
  { key: 'score', label: '疼痛分数', ids: [248], markers: ['疼痛分数', '0-10'] },
];

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function normalizeReportDetailItems(source) {
  return asArray(source).map((row) => {
    const checkItem = row?.checkItem || row || {};
    return {
      questionId: checkItem.questionId ?? row?.id,
      question: checkItem.question ?? row?.content ?? row?.question ?? '',
      input: checkItem.input ?? row?.input ?? row?.answer ?? '',
      score: checkItem.score ?? row?.score,
    };
  });
}

function valueText(value) {
  return value === null || value === undefined || value === '' ? '' : String(value).trim();
}

function findAnswer(items, field) {
  const normalized = normalizeReportDetailItems(items);
  const byId = normalized.find((item) => {
    const questionId = Number(item.questionId);
    return field.ids?.some((id) => Number(id) === questionId);
  });
  if (byId) return valueText(byId.input);
  const found = normalized.find((item) => field.markers?.some((marker) => String(item.question || '').includes(marker)));
  return valueText(found?.input);
}

function secondsText(value) {
  const text = valueText(value);
  if (!text) return '';
  return /秒|s$/i.test(text) ? text : `${text} 秒`;
}

export function buildSppbPhysicalDetails(items) {
  return SPPB_FIELDS.reduce((details, field) => {
    details[field.key] = secondsText(findAnswer(items, field));
    return details;
  }, {});
}

export function buildNrsPainDetails(items) {
  return NRS_FIELDS.reduce((details, field) => {
    details[field.key] = findAnswer(items, field);
    return details;
  }, {});
}

export function nrsScoreText(report = {}, details = {}) {
  if (report.score !== null && report.score !== undefined && report.score !== '') return String(report.score);
  return valueText(details.score) || '/';
}

export function nrsDetailText(details = {}) {
  const rows = [
    ['部位', details.part],
    ['持续时间', details.duration],
  ].filter(([, value]) => valueText(value));
  return rows.length ? rows.map(([label, value]) => `${label}：${value}`).join('\n') : '/';
}
