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
