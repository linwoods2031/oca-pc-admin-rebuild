# 老年综合评估 PC 后台重建版

这是老年综合评估 PC 后台前端源码重建工程，使用 Vue 3、Vite、Element Plus 实现，接口通过 `/prod-api` 接入现有后端。

不要把真实账号、密码、测试患者姓名、身份证、手机号或生产验证细节提交到仓库。文档中的登录信息统一使用 `<username>`、`<password>`、`<test-patient>` 等占位符。

## 发布级别

当前源码支持三个发布级别：

1. 只读灰度：默认级别，本地 dev 和生产构建默认只读，除登录外拦截业务写入。
2. 受限写入灰度：必须显式设置 `VITE_ENABLE_PROD_WRITES=true`，并配置患者、评估、报告 allow-list，仅用于授权测试患者。
3. 正式上线评审候选：源码、测试、预检、构建和文档达到提交评审条件，但仍必须完成后端接口契约、小程序 payload 对齐、生产权限、回滚、审计和备份确认。

当前代码达到的是正式上线评审候选，不代表可直接正式上线；直接正式上线仍需人工批准或发布负责人批准。无人工参与时，只能完成源码和自动化准入，不能完成真实接口契约确认和生产审批。

## 已覆盖功能

- 登录和当前用户信息
- 患者列表、患者详情、患者新增、患者编辑
- 回访管理和回访状态更新
- 一般情况调查表查看、编辑、新增和保存
- 量表结果列表、量表明细查看、待填写量表编辑保存
- 已提交量表只读保护
- 总报告预览和原 PDF 打印入口
- 灰度部署方案，见 `docs/deploy-plan.md`

## 本地运行

```bash
npm ci
npm run dev
```

默认开发服务使用 `vite.config.js` 中的 `/prod-api` 代理。
该代理指向既有生产 API 域名；本地 `npm run dev` 默认仍为只读，除登录外会拦截业务写请求。

## 构建

```bash
npm run build
```

生产构建默认使用 `/pc-rebuild/` 作为资源 base，本地开发默认使用 `/`。如需显式覆盖：

```bash
VITE_APP_BASE=/pc-rebuild/ npm run build
```

构建产物输出到 `dist/`。不要直接覆盖线上生产目录，先按 `docs/deploy-plan.md` 走 `/pc-rebuild/` 灰度路径。

## 正式上线前检查

提交正式上线评审前必须在干净环境运行：

```bash
npm ci
npm run verify
```

`npm run verify` 会执行 API 边界检查、敏感信息扫描、Vitest、生产默认构建、构建产物校验、preflight 和 release readiness 报告。该链路不需要生产密钥，不应设置真实生产账号或真实 allow-list id。

正式上线不是只靠前端决定，还需要完成：

- 后端接口契约确认。
- 小程序 payload 对齐。
- 生产账号权限确认。
- 回滚演练。
- 操作审计确认。
- 数据备份确认。

## Mock 契约 fixtures

`tests/fixtures/contracts/` 中的 fixtures 均为脱敏 mock，不代表真实生产数据，也不证明真实接口已确认。它们只用于自动化固定前端 payload、提交态判断、一般情况表归属判断和小程序等价 payload 的本地契约预期。

## 安全边界

- 不修改生产后端。
- 不修改微信小程序。
- 不直接覆盖线上 `/srv/oca-source/opt/html`。
- Codex 可以生成代码、测试、文档和构建产物校验，但不得执行生产部署。
- Codex 不得调用真实生产写接口，最终上线必须由发布负责人按变更单执行。
- 默认启用只读保护，包括本地 dev 和生产构建；除登录外，业务写请求默认会被拦截。
- 如需受限写入灰度，必须经发布负责人确认后显式设置 `VITE_ENABLE_PROD_WRITES=true`，且只应使用明确的 `<test-patient>` 和未提交测试评估。
- 受限写入灰度必须配置 allow-list：`VITE_WRITE_ALLOW_PATIENT_IDS`、`VITE_WRITE_ALLOW_OUTPATIENT_IDS`、`VITE_WRITE_ALLOW_REPORT_IDS`。
- 新增患者默认禁止；如需验证新增，必须显式设置 `VITE_ALLOW_CREATE_PATIENT=true`，并确认归属字段语义。
- 不得提交真实 allow-list id、真实账号、患者姓名、身份证、手机号、token 或生产验证细节。
- 新增患者归属字段优先从当前用户/部门信息推导，无法推导时会停止新增，需要后端确认归属规则。
- 当前后端一般情况表读取接口按 `patientId` 返回，若无法确认返回记录与当前 `outpatientId` 关联，前端会禁止保存以避免误更新其他评估。
- 当前版本不支持通过删除全部用药来清空后端用药；需要后端提供明确 delete/replace 语义后再开放。
