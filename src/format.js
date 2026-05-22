import dayjs from 'dayjs';

export function dateText(value) {
  if (!value) return '-';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '-';
}

export function valueText(value) {
  return value === null || value === undefined || value === '' ? '/' : String(value);
}

export function sexText(value) {
  return Number(value) === 1 ? '女' : '男';
}
