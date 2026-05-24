# 恢复代码契约反查记录

本文件记录从本地恢复材料中已经能确认的接口契约。它只引用脱敏的本地代码证据，不包含真实账号、真实患者信息、真实 allow-list id 或生产验证结果。

## 患者归属字段

状态：`confirmed_by_recovered_backend_artifacts`

范围：

- `deptId`
- `hospitalId`
- `attendingDoctor`

反查结论：

- 新增患者时，如果前端没有提交 `deptId`，恢复后端会使用当前登录用户的科室 ID。
- 新增患者时，如果前端没有提交 `attendingDoctor`，恢复后端会使用当前登录用户 ID，也就是 `sys_user.user_id`。
- 新增患者时，恢复后端会使用当前登录用户所属科室的医院 ID 写入 `hospitalId`。
- 患者详情会通过 `userService.selectUserById(attendingDoctor)` 反查医生姓名，因此 `attendingDoctor` 不是医生姓名，而是系统用户 ID。
- 已认可的小程序壳提交的是配置中的科室、医院和医生用户 ID，与上述恢复后端语义一致。

PC 前端要求：

- 新增患者归属字段应从 `/getInfo` 的当前登录用户信息推导。
- `attendingDoctor` 必须使用 `user.userId`，不得优先使用非后端正式字段。
- 编辑已有患者时应保留原患者的 `deptId / hospitalId / attendingDoctor`，不得因为当前登录用户不同而自动改挂归属。
- 如果归属字段无法推导，新增患者必须 fail closed。

仍需在正式发布流程确认：

- 发布包对应的服务器运行代码必须与本地恢复材料一致。
- 该确认属于部署证据，不再属于未知 payload 契约。

## 量表保存 payload

状态：`confirmed_by_recovered_backend_and_accepted_mini_program_artifacts`

范围：

- `POST /outpatient/check/editCheckReport`
- `{ reportId, itemList }`
- 题目行内的 `checkItem`

反查结论：

- 已认可小程序壳保存量表时提交 `{ reportId, itemList }`。
- 小程序壳提交的是完整题目行；未答题行保留 `checkItem: null`。
- 恢复后端 `OutpatientCheckController.editCheckReport` 会把 `itemList` 解析为题目 DTO 列表，提取非空 `checkItem` 后交给量表保存服务。
- 恢复后端的 `checkItem` 字段范围包括 `questionId / optionId / score / question / input`。

PC 前端要求：

- 当前只固定单选题和输入题 payload。
- 未答题行继续提交 `checkItem: null`。
- 单选题如果选中的 option 不存在，必须 fail closed，不得猜测分值。
- 多选、矩阵或其他特殊题型在后端契约明确前不得静默扩展。

仍需在正式发布流程确认：

- 发布包对应的服务器运行代码必须与本地恢复材料一致。
- 如果以后新增特殊题型，需要重新补契约测试。

## 提交态字段

状态：`confirmed_by_recovered_backend_and_accepted_mini_program_artifacts`

范围：

- 整次评估的 `OutpatientCheck.state`
- 单个量表报告的 `OutpatientCheckReport.state`

反查结论：

- 恢复后端中，整次评估 `state` 为 `0` 表示进行中，`1` 表示已提交。
- 恢复后端中，量表报告 `state` 为 `0` 表示未开始，`1` 表示已保存，`2` 表示已提交。
- 恢复后端提交整次评估时，会把整次评估置为已提交，并把该评估下的量表报告置为已提交。
- 已认可小程序壳把量表报告 `state` 为 `2` 视为已完成/只读。

PC 前端要求：

- 整次评估 `state === 1` 时，一般情况表和量表保存必须 fail closed。
- 量表报告 `state === 2` 时，量表保存必须 fail closed。
- `reportState / status / finishState` 只作为 PC 侧防御性兼容别名；恢复后端确认的主字段是 `state`。

仍需在正式发布流程确认：

- 发布包对应的服务器运行代码必须与本地恢复材料一致。

## 一般情况表和用药范围

状态：`confirmed_by_recovered_backend_and_accepted_mini_program_artifacts`

范围：

- `GET /outpatient/base/{patientId}`
- `GET /ext/base/msList`
- 一般情况表保存 payload 中的 `outpatientId / tableId / msList`

反查结论：

- 恢复后端按患者 ID 查询一般情况表主记录；该主记录是患者级，不是单次评估级。
- 恢复后端保存一般情况表时，会使用 payload 里的 `outpatientId / tableId` 标记当前评估下的一般情况表报告已保存。
- 恢复后端用药记录挂在一般情况表主记录上；保存时如果提交了 `msList`，后端会先删除旧用药再重建。
- 已认可小程序壳同样按患者读取一般情况表和用药；当用药为空时不提交 `msList`。

PC 前端要求：

- 空用药不得提交 `msList: []`，避免误清空后端已有用药。
- 一般情况表和用药写入属于患者级共享数据。
- 业务用户已从使用角度确认：一般情况表里的当前用药属于患者基础信息；PC 后台正式使用时不允许修改一般情况表和当前用药，相关修改保留在已认可的平板/小程序流程中完成。
- 当前 PC 对一般情况表和当前用药保持只读；UI 禁用保存，API wrapper 也会直接阻断一般情况表新增/更新。
- 因 PC 不开放一般情况表和当前用药保存，空用药清空后端的语义不作为本轮上线前置确认项。

仍需在正式发布流程确认：

- 发布包对应的服务器运行代码必须与本地恢复材料一致。

## 用户侧使用口径确认

状态：`confirmed_user_decision_readonly`

范围：

- 新入口用户侧全流程测试口径
- 一般情况表和当前用药在 PC 端的正式使用权限

确认结论：

- 业务用户确认，修正入口后的全量测试使用的是新入口，不是旧版本入口。
- 业务用户确认，除另行列出的量表题目、评分和结论文案问题外，登录、建患者、建评估、填一般情况调查表、保存量表、提交整单等主流程能走通。
- 业务用户确认，一般情况调查表里的当前用药属于患者基础信息；同一患者再次评估看到最近保存内容是合理的。
- 业务用户确认，PC 后台正式使用时不允许修改一般情况表和当前用药；用药修改在平板端完成。

PC 前端要求：

- 一般情况表和当前用药在 PC 端只读展示。
- 受限写入灰度不得把一般情况表和当前用药纳入 PC 写入范围。
- 如果后续要让 PC 编辑这些共享数据，必须重新取得业务确认、补充后端契约和回归测试。
