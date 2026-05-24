# pc-rebuild 灰度部署方案

本方案只作为发布操作文档示例。执行前必须由发布负责人复核，本文中的 `ssh`、`rsync`、`sudo`、`nginx` 命令均不得在本地修复或审计阶段执行。Codex 不得执行生产部署，不得调用真实生产写接口；正式上线前禁止使用 Codex 自动部署。

禁止直接覆盖生产前端目录 `/srv/oca-source/opt/html`。灰度发布必须使用独立 release 目录和 `current` 软链接，通过 `/pc-rebuild/` 路径访问。

## 0. 凭据和敏感信息

- 轮换此前出现在聊天、截图、文档或提交记录中的真实账号和密码。
- 仓库内不得提交真实账号、密码、测试患者姓名、身份证、手机号、生产接口验证细节。
- 文档统一使用 `<username>`、`<password>`、`<test-patient>`、`<domain>`、`<server>` 等占位符。
- 灰度验证只允许使用授权测试账号和测试患者；默认生产构建启用只读保护。
- 受限写入灰度不是正式上线，不得扩大到真实业务患者或全量写入。
- 不得将真实 allow-list id、账号、患者姓名、身份证、手机号、token 或生产验证细节提交到仓库。

## 0.1 准入分层

自动化准入由源码仓库完成，包含 `npm run verify`、CI、sensitive scan、API boundary、build output 校验、mock 契约测试和 release readiness JSON 报告。自动化准入只能证明当前源码候选包满足本地工程 gate。

人工/外部准入必须由发布负责人、后端负责人和小程序负责人完成，包含后端契约、小程序 payload、备份、回滚演练、账号权限、变更窗口和生产审批。无人工参与时，不得把 mock 契约测试解释成真实接口契约已确认。

构建包还必须声明或继承发布档位：默认 `VITE_RELEASE_PROFILE=formal-candidate`，且必须是只读构建；受限写入灰度包必须单独设置 `VITE_RELEASE_PROFILE=restricted-write-gray` 和 `VITE_ENABLE_PROD_WRITES=true`，只能用于 allow-list 测试患者验证，不能作为正式上线评审候选包。

评审前应生成发布证据包：`npm run release:evidence:verified` 会先执行完整 `verify` 再输出机器可读 JSON，`npm run release:evidence:verified:markdown` 输出可附到评审单的 Markdown。最终 `submitFormalReviewCandidate=true` 必须同时满足干净工作树、本地 verified 命令通过和 GitHub Actions `Verify frontend safety gates` 成功；只有单边证据或未提交改动时不得提交为完整正式评审候选。动态证据不提交仓库，证据格式见 `docs/release-evidence.md`。

## 1. 本地构建要求

生产灰度路径必须构建为 `/pc-rebuild/` base。当前用户测试灰度包使用 `createWebHashHistory(import.meta.env.BASE_URL)`，避免服务器缺少 `/pc-rebuild/*` history fallback 时刷新页面回到旧后台；如后续切回 history 模式，必须先补齐 Nginx fallback 并完成刷新、深链和旧后台隔离回归。以下命令只用于发布负责人在授权环境中参考，Codex 不得执行。

```bash
cd /Users/w5/codex/老年评估/pc-rebuild
npm ci
VITE_APP_BASE=/pc-rebuild/ VITE_READONLY=true npm run build
```

确认 `dist/index.html` 中的 JS/CSS 资源路径以 `/pc-rebuild/assets/` 开头，并记录真实 hashed 文件名用于上线验证。

本地 `npm run dev` 通过 Vite proxy 连接既有生产 API 域名；运行时默认只读，只有显式设置 `VITE_ENABLE_PROD_WRITES=true` 才会放开业务写入 guard。

默认 `npm run build && npm run check:build-output` 会按 `formal-candidate` 档位校验，只允许只读候选包通过。若构建写入灰度包，必须显式切换到 `restricted-write-gray` 档位，并单独保存为灰度验证证据。

## 2. 服务器备份

示例命令如下，仅供发布负责人在变更窗口参考，Codex 不得执行：

```bash
ssh <user>@<server> 'set -e
ts=$(date +%Y%m%d%H%M%S)
sudo mkdir -p /srv/oca-source/backups
sudo tar -C /srv/oca-source/opt -czf /srv/oca-source/backups/html-$ts.tar.gz html
sudo sh -c "nginx -T > /srv/oca-source/backups/nginx-full-$ts.conf"
sudo ls -lh /srv/oca-source/backups/html-$ts.tar.gz /srv/oca-source/backups/nginx-full-$ts.conf
'
```

注意：`sudo nginx -T > file` 的重定向由当前 shell 执行，可能无权限；应使用 `sudo sh -c "nginx -T > file"`。

## 3. 原子灰度发布目录

建议目录结构：

```text
/srv/oca-source/opt/pc-rebuild/
  releases/
    20260522153000/
  current -> /srv/oca-source/opt/pc-rebuild/releases/20260522153000
```

示例命令如下，仅供发布负责人在变更窗口参考，Codex 不得执行：

```bash
ts=$(date +%Y%m%d%H%M%S)
ssh <user>@<server> "sudo mkdir -p /srv/oca-source/opt/pc-rebuild/releases/$ts && sudo chown -R <user>:<user> /srv/oca-source/opt/pc-rebuild"
rsync -av --delete dist/ <user>@<server>:/srv/oca-source/opt/pc-rebuild/releases/$ts/
ssh <user>@<server> "ln -sfn /srv/oca-source/opt/pc-rebuild/releases/$ts /srv/oca-source/opt/pc-rebuild/current"
```

## 4. Nginx 灰度路径

示例配置：

```nginx
location ^~ /pc-rebuild/ {
    alias /srv/oca-source/opt/pc-rebuild/current/;
    try_files $uri $uri/ /pc-rebuild/index.html;
}

location ^~ /prod-api/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

示例命令如下，仅供发布负责人在变更窗口参考，Codex 不得执行：

```bash
ssh <user>@<server> 'sudo nginx -t'
ssh <user>@<server> 'sudo systemctl reload nginx'
```

## 5. 灰度验证

不要只验证 `/pc-rebuild/assets/` 目录。应从 `dist/index.html` 获取真实 hashed 资源文件名后验证静态入口和资源：

```bash
curl -fsSI https://<domain>/pc-rebuild/
curl -fsSI https://<domain>/pc-rebuild/assets/<hashed>.js
curl -fsSI https://<domain>/pc-rebuild/assets/<hashed>.css
```

当前灰度包使用 hash 路由，`#/patients` 之后的片段不会发送到服务器；深链和刷新必须用浏览器验证：

```text
https://<domain>/pc-rebuild/#/patients
https://<domain>/pc-rebuild/#/follow-up
https://<domain>/pc-rebuild/#/patients/<patient-id>
```

浏览器验证清单：

1. 使用 `<username> / <password>` 登录。
2. 确认页面显示“生产 API 灰度环境”提示。
3. 患者列表、患者详情、一般情况表、量表明细、总报告预览可读取。
4. 默认只读构建下，患者新增/编辑、一般情况保存、量表保存、回访开关均不可写；一般情况表和当前用药在 PC 端始终只读展示。
5. 如需写入验证，必须单独构建显式设置 `VITE_ENABLE_PROD_WRITES=true`，且仅使用 `<test-patient>` 的未提交测试评估。

## 5.1 写入灰度准入

写入灰度不得复用只读灰度包，必须重新构建并确认页面顶部提示为“当前允许写入生产 API”。写入包必须配置 allow-list，否则页面仍可登录和读取，但所有业务写入都会中止并提示“写入灰度未配置 allow-list，禁止写入”。Codex 不得构建或验证包含真实 allow-list id 的写入包。

示例命令中的 id 均为占位符，真实 id 只能由发布负责人在构建环境中临时注入，不得写入源码、文档或提交记录：

```bash
cd /Users/w5/codex/老年评估/pc-rebuild
VITE_APP_BASE=/pc-rebuild/ \
VITE_RELEASE_PROFILE=restricted-write-gray \
VITE_ENABLE_PROD_WRITES=true \
VITE_WRITE_ALLOW_PATIENT_IDS=<patient-id> \
VITE_WRITE_ALLOW_OUTPATIENT_IDS=<outpatient-id> \
VITE_WRITE_ALLOW_REPORT_IDS=<report-id> \
npm run build
```

如需验证新增患者，还必须额外显式设置 `VITE_ALLOW_CREATE_PATIENT=true`。默认即使开启 `VITE_ENABLE_PROD_WRITES=true`，也禁止新增患者。

写入灰度只允许覆盖以下最小范围：

1. 使用授权测试账号登录。
2. 仅打开明确的 `<test-patient>`。
3. 仅操作未提交评估记录；已提交评估的量表和一般情况表必须保持只读。
4. 患者编辑、量表保存、回访开关必须命中对应 allow-list；一般情况表和当前用药不纳入 PC 写入灰度范围。
5. 新增或编辑患者前，确认当前用户接口可返回 `deptId`、`hospitalId`、`attendingDoctor` 所需归属字段；前端无法推导时会中止新增。
6. 一般情况表和当前用药已确认是患者级共享数据；业务用户明确要求 PC 后台正式使用时保持只读，修改保留在平板/小程序流程中完成。
7. 当前用药为空时 PC 不提交 `msList` 字段；PC 端不开放用药保存，也不支持通过空 `msList` 清空后端用药。
8. 量表保存前会重新读取患者详情和量表列表，若评估或量表已提交会中止保存。

写入灰度验证清单：

1. 新增测试患者后能回到详情页，患者归属不串机构、不丢科室。
2. 编辑测试患者后列表和详情字段一致。
3. 一般情况表和当前用药在 PC 端应只读展示，保存按钮不可用；不得出现 PC 端一般情况表或用药写入。
4. 平板/小程序端仍是一般情况表和用药修改入口；PC 不验证清空用药语义。
5. 未提交测试量表可保存并刷新得分和结论。
6. 已提交评估的量表保存按钮不可用；一般情况表在 PC 端始终只读。
7. 回访开关只对 `<test-patient>` 验证，失败时刷新列表恢复后端状态。
8. 回访开关取消确认框、关闭确认框、接口失败后，列表均刷新并恢复后端状态。

出现任一非测试患者写入、已提交评估被写入、PC 端一般情况表或用药写入、`msList` 误清空、归属字段异常，应立即回滚到只读包。

## 5.2 正式上线评审准入

正式上线评审候选必须同时满足以下条件：

1. 本地 `npm run verify` 通过。
2. GitHub Actions `Verify frontend safety gates` 通过。
3. `npm run release:evidence:verified` 或等价证据包已附到评审单。
4. `npm run release:cross-system:markdown` 或等价脱敏材料已附到评审单，用于证明 PC、小程序最终口径、恢复后端热修源码和 SQL 热修材料在本地可对齐。
5. 正式评审候选构建保持默认 `VITE_RELEASE_PROFILE=formal-candidate`，且未设置 `VITE_ENABLE_PROD_WRITES=true`。
6. 只读灰度验证完成，读链路、路由刷新、静态资源和只读 guard 均通过。
7. 受限写入灰度验证完成，且仅覆盖 allow-list 中的授权测试患者、测试评估和测试报告；该写入灰度包必须标记为 `VITE_RELEASE_PROFILE=restricted-write-gray`，不得冒充正式评审候选包。
8. 患者归属字段、量表保存 payload、提交态字段、一般情况表和用药范围已从恢复后端和已认可小程序壳反查确认，见 `docs/recovered-contracts.md`。业务用户已确认 PC 端一般情况表和当前用药正式使用时只读。小程序最终量表口径见 `docs/mini-program-final-requirements.md`，跨系统对齐报告见 `docs/cross-system-alignment-report.md`。当前仓库中的 mock fixtures 只用于自动化契约预期，不代表真实生产验证结果。
9. 以下外部证据已由发布负责人补齐：
   - 线上运行包与本地恢复材料一致。
   - 已认可小程序版本已经完成微信正式提审/发布，并且正式长期二维码已经切换到新版本。
   - 只读灰度和受限写入灰度均有脱敏记录，且不包含真实账号、真实患者信息或真实 allow-list id。
10. 回滚包、回滚命令和回滚权限已演练，且发布负责人确认可在变更窗口内完成回退。
11. 操作审计、数据备份、生产账号权限和凭据轮换均已确认。
12. 生产静态目录仍不得直接覆盖，正式切换也必须使用 release/current 或等价可回滚软链策略。

正式上线仍需人工批准。Codex 可以生成代码、测试、文档和构建产物校验；Codex 不得执行生产部署，不得调用真实生产写接口，最终上线必须由发布负责人按变更单执行。

## 6. 回滚判定

出现以下任一情况应立即回滚灰度路径：

- `/pc-rebuild/` 或 hashed JS/CSS 返回非 2xx。
- 刷新深层路由返回 404。
- 页面未显示灰度只读提示或写按钮可误触。
- 登录后患者列表/详情等核心只读链路异常。
- 写入 guard 未生效。
- allow-list 外患者可写。
- 新增患者未显式开启却可提交。
- 已提交评估或已提交量表可写。
- PC 端一般情况表或用药写入。
- `msList` 被误清空。
- 患者归属字段异常。
- 控制台出现阻断渲染的 JS 错误。
- Nginx 配置检查失败或 `/prod-api/` 代理受影响。

回滚示例：

```bash
ssh <user>@<server> 'ln -sfn /srv/oca-source/opt/pc-rebuild/releases/<previous-ts> /srv/oca-source/opt/pc-rebuild/current'
ssh <user>@<server> 'sudo nginx -t && sudo systemctl reload nginx'
```

如需完全移除灰度路径，只移除 `/pc-rebuild/` Nginx 配置和 `/srv/oca-source/opt/pc-rebuild`，不得触碰 `/srv/oca-source/opt/html`。
