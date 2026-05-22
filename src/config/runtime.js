export const isReadOnlyMode =
  import.meta.env.VITE_READONLY === 'true' ||
  (import.meta.env.PROD && import.meta.env.VITE_ENABLE_PROD_WRITES !== 'true');

export const writeDisabledMessage =
  '生产 API 灰度环境当前为只读模式，请仅使用测试患者查看数据；如需写入，必须经发布负责人确认后显式开启。';

export const grayBannerTitle = '生产 API 灰度环境';

export const grayBannerMessage = isReadOnlyMode
  ? '当前已启用只读保护，请仅使用测试患者查看数据，患者新增/编辑、一般情况表、量表保存和回访开关均已禁用。'
  : '当前允许写入生产 API，仅可使用测试患者操作，并需确认不会影响真实业务数据。';
