# PC 后台源码重建说明

## 目标

现有 PC 后台前端源码已丢失，本工程用于重建一套可维护的 Vue 3 后台，先覆盖当前交付必须使用的功能，再逐步替换线上打包静态资源。

## 第一版范围

- 登录：`POST /prod-api/login`，验证码开关已关闭，提交空 `code/uuid`。
- 当前用户：`GET /prod-api/getInfo`。
- 患者管理：`GET /prod-api/patient/archive/listPage`。
- 患者详情：`GET /prod-api/patient/archive/{id}`。
- 回访管理：复用 `patient/archive/listPage`，后端已负责 7 天内到期和 3 个月隐藏规则。
- 回访状态：`POST /prod-api/patient/archive/updateVisitor`。
- 评估量表列表：`GET /prod-api/outpatient/check/tables/pc?outpatientId=`。
- 量表明细：`GET /prod-api/outpatient/check/selectReport?tableId=&reportId=`。
- 总报告打印：`GET /prod-api/outpatient/check/composite/print/{outpatientId}`，以 PDF blob 新窗口打开。

## 安全和灰度约束

- 生产构建默认通过 `/pc-rebuild/` base 发布，并启用只读保护；除登录外，前端会阻止 POST/PUT/PATCH/DELETE 写请求。
- 灰度页面必须显示生产 API 提示，并默认禁用患者新增/编辑、一般情况表保存、量表保存、回访开关。
- 真实账号密码、测试患者姓名、身份证、手机号和生产验证细节不得写入仓库。
- 一般情况表读取接口当前按 `patientId` 获取；当返回记录无法确认与当前 `outpatientId` 对应时，前端禁止更新，避免同一患者多条评估之间误写。
- 新增患者归属字段已按恢复后端确认从当前用户/部门推导；无法推导时停止新增，正式发布仍需确认线上运行包与恢复材料一致。

## 已知边界

- 当前第一版不修改生产后端，不替换线上 PC 后台。
- 页面字段以现有接口返回为准，未填写值统一显示 `/`。
- 热修版 PC 后台和本重建版后续必须保持需求迁移清单一致，避免替换时功能倒退。
