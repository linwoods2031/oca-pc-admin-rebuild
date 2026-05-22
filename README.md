# 老年综合评估 PC 后台重建版

这是老年综合评估 PC 后台前端源码重建工程，使用 Vue 3、Vite、Element Plus 实现，接口通过 `/prod-api` 接入现有后端。

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

## 构建

```bash
npm run build
```

构建产物输出到 `dist/`。不要直接覆盖线上生产目录，先按 `docs/deploy-plan.md` 走 `/pc-rebuild/` 灰度路径。

## 安全边界

- 不修改生产后端。
- 不修改微信小程序。
- 不直接覆盖线上 `/srv/oca-source/opt/html`。
- 写入验证只应使用明确的测试患者和未提交测试评估。

