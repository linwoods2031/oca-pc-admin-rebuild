import { describe, expect, it } from 'vitest';
import { buildBasePayload, cleanPayload, normalizeMsList, toNumberOrNull } from './basePayload.js';

describe('base payload helpers', () => {
  it('keeps empty strings for edit payloads', () => {
    expect(cleanPayload({ name: '', age: null, keep: 'x', missing: undefined }, { keepEmpty: true })).toEqual({
      name: '',
      age: null,
      keep: 'x',
    });
  });

  it('removes empty fields for create payloads', () => {
    expect(cleanPayload({ name: '', age: null, keep: 'x', missing: undefined }, { keepEmpty: false })).toEqual({
      keep: 'x',
    });
  });

  it('normalizes medication rows and drops empty rows', () => {
    expect(
      normalizeMsList([
        { medication: '', dose: '', frequency: '', way: '' },
        { medication: '药物A', dose: '', frequency: '每日一次', way: '' },
      ]),
    ).toEqual([{ medication: '药物A', dose: '', frequency: '每日一次', way: '' }]);
  });

  it('does not submit msList when all medication rows are empty', () => {
    const payload = buildBasePayload(
      {
        id: 1,
        nativePlace: '',
        msList: [{ medication: '', dose: '', frequency: '', way: '' }],
      },
      { patientId: 10, outpatientId: 20, keepEmpty: true },
    );

    // 删除全部用药的后端语义未确认前，不通过空 msList 清空后端用药。
    expect(payload).not.toHaveProperty('msList');
  });

  it('submits non-empty msList rows', () => {
    const payload = buildBasePayload(
      {
        msList: [{ medication: '药物A', dose: '1片', frequency: '', way: '' }],
      },
      { patientId: 10, outpatientId: 20 },
    );

    expect(payload.msList).toEqual([{ medication: '药物A', dose: '1片', frequency: '', way: '' }]);
  });

  it('converts blank numeric fields to null in edit mode', () => {
    expect(toNumberOrNull('')).toBeNull();
    const payload = buildBasePayload(
      {
        id: 1,
        height: '',
        weight: '60.5',
        msList: [],
      },
      { patientId: 10, outpatientId: 20, keepEmpty: true },
    );

    expect(payload.height).toBeNull();
    expect(payload.weight).toBe(60.5);
  });
});
