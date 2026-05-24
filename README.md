# 老年综合评估 PC 后台重建版

这是老年综合评估 PC 后台前端源码重建工程，使用 Vue 3、Vite、Element Plus 实现，接口通过 `/prod-api` 接入现有后端。

不要把真实账号、密码、测试患者姓名、身份证、手机号或生产验证细节提交到仓库。文档中的登录信息统一使用 `<username>`、`<password>`、`<test-patient>` 等占位符。

## 发布级别

当前源码支持三个发布级别：

1. 只读灰度：默认级别，本地 dev 和生产构建默认只读，除登录外拦截业务写入。
2. 受限写入灰度：必须显式设置 `VITE_ENABLE_PROD_WRITES=true`，并配置患者、评估、报告 allow-list，仅用于授权测试患者。
3. 正式上线评审候选：源码、测试、预检、构建和文档达到提交评审条件，但仍必须完成恢复契约对应的运行包一致性、生产权限、回滚、审计和备份确认。

构建脚本使用 `VITE_RELEASE_PROFILE` 区分候选包类型。默认值是 `formal-candidate`，必须保持只读；受限写入灰度包必须显式使用 `VITE_RELEASE_PROFILE=restricted-write-gray`，不能作为正式上线评审候选包提交。

当前代码达到的是正式上线评审候选，不代表可直接正式上线；直接正式上线仍需人工批准或发布负责人批准。无人工参与时，只能完成源码、自动化准入和恢复材料反查，不能完成服务器运行包一致性确认、生产审批或正式变更窗口操作。

## 已覆盖功能

- 登录和当前用户信息
- 患者列表、患者详情、患者新增、患者编辑
- 回访管理和回访状态更新
- 一般情况调查表和当前用药只读查看
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

默认 `npm run verify` 生成的是只读 `formal-candidate` 自动化准入结果。若构建环境设置了 `VITE_ENABLE_PROD_WRITES=true` 但没有同时设置 `VITE_RELEASE_PROFILE=restricted-write-gray`，构建产物检查和 release readiness 会失败，避免写入灰度包被误当作正式上线评审候选包。

受限写入灰度可以用于完整业务流程测试，但必须与正式候选包分离。测试包可额外设置 `VITE_ENABLE_SESSION_WRITE_ALLOWLIST=true`，使本会话刚新增的测试患者继续允许编辑，并在患者详情页显示“创建测试评估”测试按钮；该能力只能用于受控测试入口和脱敏测试样本，不能作为正式上线候选能力提交。一般情况表和当前用药仍保持 PC 只读，修改继续走平板/小程序。

生成评审证据包时运行：

```bash
npm run release:evidence:verified
npm run release:evidence:verified:markdown
npm run release:cross-system:markdown
```

证据包会汇总 commit、发布档位、自动化 gate、GitHub Actions 状态、已从恢复材料确认的契约和仍需外部批准的事项。`release:cross-system:markdown` 会额外扫描本机小程序维护目录、已认可小程序壳、恢复后端热修源码和 SQL 热修文件，生成 PC/小程序/后端/SQL 对齐报告。动态证据只用于评审单附件，不提交到仓库；模板说明见 `docs/release-evidence.md` 和 `docs/cross-system-alignment-report.md`。

`submitFormalReviewCandidate=true` 必须同时满足干净工作树、本地 `release:evidence:verified` 通过和 GitHub Actions `Verify frontend safety gates` 成功。只有本地通过或只有 CI 通过时，证据包会分别标记本地/CI 候选状态，但最终正式评审候选字段保持 false。

患者新增/编辑的归属字段、量表保存 payload、提交态字段、一般情况表和用药范围已按恢复后端和已认可小程序壳完成反查；记录见 `docs/recovered-contracts.md`。其中一般情况表和用药已确认是患者级共享数据，业务用户已确认 PC 后台正式使用时保持只读，修改保留在平板/小程序流程中完成。

小程序最终验收口径以后面业务用户确认的版本为准；量表名称、题目、评分和结论对齐清单见 `docs/mini-program-final-requirements.md`。PC 后台不单独硬编码这些评分和结论规则，展示以后端返回值为准。

正式上线不是只靠前端决定，还需要完成：

- 线上运行包与本地恢复材料一致性确认。
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
- 如需受限写入灰度，必须经发布负责人确认后显式设置 `VITE_ENABLE_PROD_WRITES=true`，且只应使用明确的 `<test-patient>` 和未提交测试评估；一般情况表和当前用药仍保持只读。
- 受限写入灰度必须配置 allow-list：`VITE_WRITE_ALLOW_PATIENT_IDS`、`VITE_WRITE_ALLOW_OUTPATIENT_IDS`、`VITE_WRITE_ALLOW_REPORT_IDS`。
- 全流程测试入口如启用 `VITE_ENABLE_SESSION_WRITE_ALLOWLIST=true`，只允许本会话内由测试包创建的测试患者、测试评估和测试报告继续写入，不得扩大为真实业务患者通用写入。
- 新增患者默认禁止；如需验证新增，必须显式设置 `VITE_ALLOW_CREATE_PATIENT=true`，并确认线上运行包与恢复材料中的归属字段语义一致。
- 不得提交真实 allow-list id、真实账号、患者姓名、身份证、手机号、token 或生产验证细节。
- 新增患者归属字段已按恢复后端确认从当前用户/部门信息推导；无法推导时会停止新增。
- 当前后端一般情况表读取接口按 `patientId` 返回；PC 端仅只读展示，不提交一般情况表或当前用药保存。
- 恢复后端已确认 `msList` 存在时会替换用药；PC 端不开放用药保存，也不支持通过空 `msList` 清空后端用药。
