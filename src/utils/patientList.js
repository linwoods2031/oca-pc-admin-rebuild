function toTime(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function compareNullable(a, b, direction = 'ascending') {
  const aMissing = a === null || a === undefined || a === '';
  const bMissing = b === null || b === undefined || b === '';
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  const result = a > b ? 1 : a < b ? -1 : 0;
  return direction === 'descending' ? -result : result;
}

function compareText(a, b, direction) {
  const result = compareNullable(a, b, 'ascending');
  if (result === 0) return 0;
  return direction === 'descending' ? -result : result;
}

function patientSortValue(row, prop) {
  if (prop === 'createTime' || prop === 'updateTime' || prop === 'nextVisitDate' || prop === 'birthday') {
    return toTime(row?.[prop]);
  }
  return row?.[prop];
}

export function sortPatientRows(rows = [], { prop = 'createTime', order = 'descending' } = {}) {
  if (!Array.isArray(rows)) return [];
  return rows.slice().sort((a, b) => {
    const primary = compareNullable(patientSortValue(a, prop), patientSortValue(b, prop), order);
    if (primary !== 0) return primary;
    return compareNullable(toTime(a?.createTime), toTime(b?.createTime), 'descending') || compareText(a?.name, b?.name, 'ascending');
  });
}

export function sortFollowUpRows(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows.slice().sort((a, b) => {
    const dueDate = compareNullable(toTime(a?.nextVisitDate), toTime(b?.nextVisitDate), 'ascending');
    if (dueDate !== 0) return dueDate;
    return compareText(a?.name, b?.name, 'ascending') || compareNullable(a?.id, b?.id, 'descending');
  });
}
