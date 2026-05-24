# 发布证据包

本页定义正式上线评审前应附带的证据包格式。证据包只证明源码、自动化 gate、CI 和外部确认记录的状态；不代表 Codex 可以执行生产部署，也不代表可以绕过发布负责人审批。

动态证据不要提交到仓库。评审前在干净环境运行：

```bash
npm ci
npm run release:evidence:verified
npm run release:evidence:verified:markdown
```

`release:evidence:verified` 会先执行完整 `npm run verify`，通过后才生成 JSON；`release:evidence:verified:markdown` 会生成可附到评审单的 Markdown。最终 `submitFormalReviewCandidate=true` 必须同时满足干净工作树、本地 verified 命令通过和 GitHub Actions `Verify frontend safety gates` 成功。如果本机没有 GitHub CLI 或没有仓库读取权限，可以先运行 `npm run release:evidence` 生成本地 JSON，但最终正式评审候选字段会保持 false，直到发布负责人补齐 CI 成功证据。

## 自动化证据

证据包会自动输出：

- 当前 commit、分支和 dirty 状态。
- `VITE_RELEASE_PROFILE` 发布档位。
- `npm run verify` 对应的自动化 gate 状态。
- GitHub Actions 的 `Verify frontend safety gates` 运行状态，前提是使用 `release:evidence:github`。
- 本地候选、CI 候选、最终候选三个字段；最终候选必须干净工作树、本地和 CI 同时通过。
- 只读灰度/受限写入灰度 feasibility 字段；这些字段同样要求干净工作树，并至少具备本地 verified 或 CI 成功证据。
- `productionActionsExecuted=false`。
- `realWriteApiCalled=false`。
- `deploymentExecuted=false`。
- `directProductionLaunchAllowed=false`。
- 已从恢复代码和已认可小程序壳反查确认的契约，例如患者归属字段、量表保存 payload、提交态字段、一般情况表和用药范围。
- 已从业务用户使用口径确认的外部决策，例如 PC 端一般情况表和当前用药保持只读。

默认 `formal-candidate` 必须是只读候选包。受限写入灰度包必须使用 `VITE_RELEASE_PROFILE=restricted-write-gray`，只能作为 allow-list 测试患者验证证据，不能作为正式上线评审候选包。

## 已反查确认的契约

以下契约已经通过恢复后端 JAR、Mapper、数据库结构和已认可小程序壳反查确认，记录见 `docs/recovered-contracts.md`。这些项不再作为未知 payload 契约要求人工确认；正式发布时仍需确认服务器运行包与本地恢复材料一致。

- 患者归属字段。
- 量表保存 payload。
- 提交态字段。
- 一般情况表和用药范围。

## 已确认的外部决策

业务用户已从使用角度确认：一般情况调查表里的当前用药属于患者基础信息；PC 后台正式使用时不允许修改一般情况表和当前用药，相关修改保留在已认可的平板/小程序流程中完成。

因此，本仓库把 PC 端一般情况表和当前用药固定为只读展示：UI 禁用保存，API wrapper 阻断一般情况表新增/更新。该决策不替代服务器运行包一致性证据。

小程序最终验收口径以后面业务用户确认的版本为准，量表名称、题目、评分和结论对齐项见 `docs/mini-program-final-requirements.md`。PC 后台不通过前端硬编码修正这些量表规则，正式候选展示以后端返回值为准。

## 外部证据

以下项目必须由发布负责人、后端负责人或小程序负责人补充脱敏证据，不得包含真实账号、真实患者信息、真实 allow-list id、token 或生产验证细节：

- `server artifact parity for recovered contracts`：确认线上运行包与本地恢复材料一致，才能把上述 recovered contracts 作为发布证据使用。
- 只读灰度记录：读链路、路由刷新、静态资源和只读 guard。
- 受限写入灰度记录：仅 allow-list 测试患者、测试评估、测试报告。
- 回滚演练记录。
- 数据备份确认。
- 操作审计和账号权限确认。
- 凭据轮换确认。

## 发布判断

可以提交正式上线评审的最低条件：

1. `npm run verify` 通过。
2. GitHub Actions `Verify frontend safety gates` 通过。
3. `release:evidence:verified` 或等价证据包中 `cleanWorktree=true`、`submitFormalReviewCandidateLocal=true`、`submitFormalReviewCandidateCi=true`、`submitFormalReviewCandidate=true`。
4. 所有外部证据已由负责人补齐。

即使以上条件全部满足，`directProductionLaunchAllowed` 仍必须是 `false`，最终正式上线只能由发布负责人按变更单执行。
