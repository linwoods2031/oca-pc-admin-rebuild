# pc-rebuild 灰度部署方案

本方案只作为发布操作文档示例。执行前必须由发布负责人复核，本文中的 `ssh`、`rsync`、`sudo`、`nginx` 命令均不得在本地修复或审计阶段执行。

禁止直接覆盖生产前端目录 `/srv/oca-source/opt/html`。灰度发布必须使用独立 release 目录和 `current` 软链接，通过 `/pc-rebuild/` 路径访问。

## 0. 凭据和敏感信息

- 轮换此前出现在聊天、截图、文档或提交记录中的真实账号和密码。
- 仓库内不得提交真实账号、密码、测试患者姓名、身份证、手机号、生产接口验证细节。
- 文档统一使用 `<username>`、`<password>`、`<test-patient>`、`<domain>`、`<server>` 等占位符。
- 灰度验证只允许使用授权测试账号和测试患者；默认生产构建启用只读保护。

## 1. 本地构建要求

生产灰度路径必须构建为 `/pc-rebuild/` base，路由必须使用 `createWebHistory(import.meta.env.BASE_URL)`。

```bash
cd /Users/w5/codex/老年评估/pc-rebuild
npm ci
VITE_APP_BASE=/pc-rebuild/ VITE_READONLY=true npm run build
```

确认 `dist/index.html` 中的 JS/CSS 资源路径以 `/pc-rebuild/assets/` 开头，并记录真实 hashed 文件名用于上线验证。

## 2. 服务器备份

示例命令如下，仅供发布时参考：

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

示例命令：

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

示例命令：

```bash
ssh <user>@<server> 'sudo nginx -t'
ssh <user>@<server> 'sudo systemctl reload nginx'
```

## 5. 灰度验证

不要只验证 `/pc-rebuild/assets/` 目录。应从 `dist/index.html` 获取真实 hashed 资源文件名后验证：

```bash
curl -fsSI https://<domain>/pc-rebuild/
curl -fsSI https://<domain>/pc-rebuild/assets/<hashed>.js
curl -fsSI https://<domain>/pc-rebuild/assets/<hashed>.css
```

浏览器验证清单：

1. 使用 `<username> / <password>` 登录。
2. 确认页面显示“生产 API 灰度环境”提示。
3. 患者列表、患者详情、一般情况表、量表明细、总报告预览可读取。
4. 默认只读构建下，患者新增/编辑、一般情况保存、量表保存、回访开关均不可写。
5. 如需写入验证，必须单独构建显式设置 `VITE_ENABLE_PROD_WRITES=true`，且仅使用 `<test-patient>` 的未提交测试评估。

## 6. 回滚判定

出现以下任一情况应立即回滚灰度路径：

- `/pc-rebuild/` 或 hashed JS/CSS 返回非 2xx。
- 刷新深层路由返回 404。
- 页面未显示灰度只读提示或写按钮可误触。
- 登录后患者列表/详情等核心只读链路异常。
- 控制台出现阻断渲染的 JS 错误。
- Nginx 配置检查失败或 `/prod-api/` 代理受影响。

回滚示例：

```bash
ssh <user>@<server> 'ln -sfn /srv/oca-source/opt/pc-rebuild/releases/<previous-ts> /srv/oca-source/opt/pc-rebuild/current'
ssh <user>@<server> 'sudo nginx -t && sudo systemctl reload nginx'
```

如需完全移除灰度路径，只移除 `/pc-rebuild/` Nginx 配置和 `/srv/oca-source/opt/pc-rebuild`，不得触碰 `/srv/oca-source/opt/html`。
