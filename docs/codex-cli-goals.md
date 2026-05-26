# Codex CLI Goals

这套 goal 用于让 Codex CLI 按阶段重建 PC 后台源码。每个阶段都要求 Codex 自己开发、自己验证、自己修复，不把测试留给人工。

注意：本文记录的是早期重建目标。后续业务用户已确认 PC 后台正式使用时一般情况表和当前用药只读，修改保留在平板/小程序流程中完成；当前发布口径以 `docs/recovered-contracts.md`、`docs/release-evidence.md` 和 `docs/mini-program-final-requirements.md` 为准。

## 使用方式

在终端进入项目：

```bash
cd /Users/w5/codex/老年评估/pc-rebuild
```

每次只执行一个 goal。一个 goal 完成后，确认它的最终报告里包含：

- 改了哪些文件
- 跑了哪些验证命令
- 哪些功能已确认可用
- 哪些问题还没做或有风险

## Goal 1：补患者新增和编辑

```text
目标：在 /Users/w5/codex/老年评估/pc-rebuild 中补齐患者新增和编辑功能。

背景：
- 这是老年综合评估 PC 后台重建版。
- 现有源码已包含登录、患者列表、患者详情、回访管理、量表结果查看、总报告 PDF 打印入口。
- 后端 API 基址通过 Vite 代理走 /prod-api。
- 不要把真实账号密码、测试患者姓名、身份证、手机号或生产验证细节提交到仓库；文档统一使用 `<username>`、`<password>`、`<test-patient>` 占位符。
- 不要改生产后端，不要改小程序。

任务：
1. 阅读 docs/pc-admin-rebuild-spec.md、src/api/oca.js、src/views/PatientsView.vue、src/views/PatientDetailView.vue。
2. 新增患者表单页面或弹窗，支持新增患者。
3. 支持从患者详情进入编辑患者。
4. 字段至少包含：姓名、性别、身份证号、生日、电话、门诊号、住院号、病房号、病床号、家庭住址。
5. 接口优先复用现有小程序接口：
   - POST /prod-api/patient/archive/add
   - POST /prod-api/patient/archive/update
6. 表单提交后自动回到列表或详情，并刷新数据。
7. 输入为空时要有基础校验，不要让用户提交明显无效数据。

验证要求：
1. npm run build 必须通过。
2. 启动本地服务后，用 `<username> / <password>` 通过接口登录或浏览器自动化验证登录链路。
3. 至少用接口或浏览器自动化验证患者列表能加载。
4. 如果新增/编辑接口因必填字段不明确失败，要根据错误信息修正字段映射。
5. 最终报告说明已验证的链路和剩余风险。
```

## Goal 2：补一般情况表查看和编辑

```text
目标：补齐患者详情中的一般情况表查看和编辑能力。

背景：
- 当前小程序一般情况表已经调整为：居住楼层、电梯房、跌倒史、听力情况、视力情况、尿失禁史、便失禁史、残余牙齿、义齿等新口径。
- PC 后台旧打包页面仍是旧字段，本重建版必须按新口径实现。

任务：
1. 阅读 /Users/w5/codex/oca-miniprogram-shell/pages/assessment/base/index.js 和 index.wxml，参考小程序字段。
2. 在 pc-rebuild 中新增一般情况表组件或页面。
3. 在患者详情中增加“一般情况表”入口。
4. 接口：
   - GET /prod-api/outpatient/base/{patientId}
   - POST /prod-api/outpatient/base/add
   - POST /prod-api/outpatient/base/update
5. 字段显示未填写时统一显示 /。
6. 表单保存后刷新详情。

验证要求：
1. npm run build 必须通过。
2. 用真实接口验证至少一个患者的一般情况表能读取。
3. 如果保存接口需要 tableId/patientId/outpatientId，按小程序实现补齐。
4. 不允许只写 UI 不接接口。
```

## Goal 3：补量表填写和保存

```text
目标：在 PC 后台重建版中补齐量表明细编辑和保存。

背景：
- 当前第一版能查看量表明细，但还不能编辑保存。
- 小程序已实现通用量表填写，PC 端应复用同一套后端接口。

任务：
1. 阅读 /Users/w5/codex/oca-miniprogram-shell/pages/assessment/questions/index.js。
2. 在 PatientDetailView 的量表明细弹窗中支持编辑：
   - 单选题展示选项
   - 输入题展示输入框
3. 保存接口：
   - POST /prod-api/outpatient/check/editCheckReport
   - payload 结构参考小程序 saveQuestionReport(reportId, itemList)
4. 保存成功后刷新量表列表，更新得分和结论。
5. 已提交量表可先支持只读，待填写/已保存量表支持保存。

验证要求：
1. npm run build 必须通过。
2. 至少调用真实接口读取一个量表明细。
3. 如果没有安全的测试报告可写，先做只读保护并在最终报告说明原因；不能随意覆盖生产数据。
4. 代码结构要为后续编辑保存保留清晰入口。
```

## Goal 4：补总报告页面预览和打印

```text
目标：补齐 PC 后台内的总报告预览页面，并保留 PDF 打印入口。

背景：
- 后端已有 /prod-api/outpatient/check/composite/print/{outpatientId} 返回 PDF。
- 用户后续需要电脑端打印总报告，并且未填写量表用 / 占位。

任务：
1. 保留现有“总报告打印”打开 PDF 功能。
2. 新增“总报告预览”页面或弹窗。
3. 预览内容至少包含：
   - 患者基本信息
   - 科室：账号所属机构名或接口返回科室
   - 评估者：当前账号姓名
   - 床号：预留空白展示
   - 所有量表结果，已填写显示得分和结论，未填写显示 /
   - 上次评估对比字段：上次得分、上次结论
4. 如果后端没有完整 JSON 总报告接口，先用患者详情 + tables/pc 返回数据聚合出预览。
5. 打印样式使用 CSS @media print，确保 A4 可打印。

验证要求：
1. npm run build 必须通过。
2. 用真实接口加载一个患者和一条评估记录，确认预览有数据。
3. 浏览器自动化或截图验证打印预览页面基本可读。
```

## Goal 5：整理部署包和上线方案

```text
目标：整理 pc-rebuild 的部署方案，但不要直接覆盖生产。

任务：
1. 确认 npm run build 输出 dist。
2. 写 docs/deploy-plan.md，说明：
   - 如何备份当前 /srv/oca-source/opt/html
   - 如何把 dist 上传到新目录
   - 如何通过 nginx 临时路径灰度访问，例如 /pc-rebuild/
   - 如何验证登录、患者列表、总报告打印
   - 如何回滚
3. 不要直接替换线上 /srv/oca-source/opt/html。

验证要求：
1. npm run build 必须通过。
2. deploy-plan.md 必须包含明确命令和回滚命令。
```
