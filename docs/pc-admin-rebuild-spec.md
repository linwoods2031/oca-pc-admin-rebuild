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

## 已知边界

- 当前第一版不修改生产后端，不替换线上 PC 后台。
- 一般情况表编辑、患者新增/编辑、量表填写保存可继续补第二阶段。
- 页面字段以现有接口返回为准，未填写值统一显示 `/`。
- 热修版 PC 后台和本重建版后续必须保持需求迁移清单一致，避免替换时功能倒退。
